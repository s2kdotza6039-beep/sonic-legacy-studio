// security-verify-hash: re-runs a rule's dry-run evaluation and compares the
// freshly computed evaluation_hash + computed fields against a stored dry-run
// audit log entry. Highlights any drift (matched count, retry/DLQ rates,
// destination changes, etc.). Founder-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveCaller, callerHasRole } from "../_shared/authGuard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  event_source: "playback" | "payfast" | "ai" | "audit" | "delivery_meta";
  event_kind: string;
  threshold: number;
  window_minutes: number;
  channel: "email" | "webhook";
  destination: string;
  cooldown_minutes: number;
  last_triggered_at: string | null;
};

const SOURCE_TABLE: Record<Exclude<Rule["event_source"], "delivery_meta">, { table: string; kindCol: string; tsCol: string }> = {
  playback: { table: "playback_events", kindCol: "event_kind", tsCol: "created_at" },
  payfast: { table: "payfast_notify_log", kindCol: "outcome", tsCol: "created_at" },
  ai: { table: "ai_activity_log", kindCol: "action", tsCol: "created_at" },
  audit: { table: "security_audit_log", kindCol: "action", tsCol: "created_at" },
};

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify((v as Record<string, unknown>)[k])).join(",") + "}";
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function evaluationHash(rule: Rule, matched: number, detail: Record<string, unknown>): Promise<string> {
  const fingerprint = {
    rule_id: rule.id,
    source: rule.event_source,
    kind: rule.event_kind,
    threshold: rule.threshold,
    window_minutes: rule.window_minutes,
    channel: rule.channel,
    destination: rule.destination,
    cooldown_minutes: rule.cooldown_minutes,
    matched,
    detail,
  };
  return (await sha256Hex(stableStringify(fingerprint))).slice(0, 32);
}

async function evaluateMetaRule(sb: ReturnType<typeof createClient>, rule: Rule, sinceIso: string) {
  const [{ data: disp }, { data: dlq }] = await Promise.all([
    sb.from("security_alert_dispatch_log").select("id,rule_id,attempt,status,created_at").gte("created_at", sinceIso).neq("rule_id", rule.id).limit(2000),
    sb.from("security_alert_dlq").select("id,rule_id,created_at").gte("created_at", sinceIso).limit(500),
  ]);
  const disps = (disp ?? []) as Array<{ attempt: number }>;
  const dlqs = (dlq ?? []) as unknown[];
  const total = disps.length;
  const retries = disps.reduce((acc, r) => acc + Math.max(0, (r.attempt ?? 1) - 1), 0);
  const retryRatePct = total > 0 ? Math.round((retries / total) * 100) : 0;
  const dlqRatePct = total > 0 ? Math.round((dlqs.length / total) * 100) : (dlqs.length > 0 ? 100 : 0);
  const detail = { total_attempts: total, retries, retry_rate_pct: retryRatePct, dlq_count: dlqs.length, dlq_rate_pct: dlqRatePct };

  if (rule.event_kind === "delivery_spike") return { matched: total >= rule.threshold ? total : 0, detail };
  if (rule.event_kind === "retry_rate_high") return { matched: (total >= 5 && retryRatePct >= rule.threshold) ? retryRatePct : 0, detail };
  if (rule.event_kind === "dlq_rate_high") return { matched: ((total >= 5 && dlqRatePct >= rule.threshold) || dlqs.length >= rule.threshold) ? dlqs.length : 0, detail };
  return { matched: 0, detail };
}

function diff(prev: Record<string, unknown>, curr: Record<string, unknown>) {
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(curr ?? {})]);
  const out: Record<string, { prev: unknown; curr: unknown }> = {};
  for (const k of keys) {
    if (JSON.stringify(prev?.[k]) !== JSON.stringify(curr?.[k])) {
      out[k] = { prev: prev?.[k], curr: curr?.[k] };
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const caller = await resolveCaller(req);
  if (!caller.userId || !(await callerHasRole(caller.userId, "founder"))) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: { audit_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  if (!body.audit_id) {
    return new Response(JSON.stringify({ error: "audit_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: row, error } = await sb.from("security_audit_log").select("*").eq("id", body.audit_id).maybeSingle();
  if (error || !row) {
    return new Response(JSON.stringify({ error: "audit row not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (row.action !== "alert_rule_dryrun") {
    return new Response(JSON.stringify({ error: "not a dry-run entry" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const stored = ((row.metadata as Record<string, unknown>)?.results as Array<Record<string, unknown>> | undefined)?.[0];
  if (!stored?.rule_id) {
    return new Response(JSON.stringify({ error: "stored dry-run has no rule_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: rule } = await sb.from("security_alert_rules").select("*").eq("id", stored.rule_id).maybeSingle();
  if (!rule) {
    return new Response(JSON.stringify({ error: "rule no longer exists", rule_id: stored.rule_id }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const r = rule as Rule;
  const sinceIso = new Date(Date.now() - r.window_minutes * 60_000).toISOString();
  let matched = 0;
  let detail: Record<string, unknown> = {};
  if (r.event_source === "delivery_meta") {
    const m = await evaluateMetaRule(sb, r, sinceIso);
    matched = m.matched;
    detail = m.detail;
  } else {
    const cfg = SOURCE_TABLE[r.event_source];
    if (cfg) {
      let qq = sb.from(cfg.table).select("*", { count: "exact", head: true }).gte(cfg.tsCol, sinceIso);
      if (r.event_kind && r.event_kind !== "*") qq = qq.eq(cfg.kindCol, r.event_kind);
      const { count } = await qq;
      matched = count ?? 0;
    }
  }
  const currentHash = await evaluationHash(r, matched, detail);
  const storedHash = stored.evaluation_hash as string | undefined;

  const compare = {
    matched: { prev: stored.matched, curr: matched },
    threshold: { prev: stored.threshold, curr: r.threshold },
    window_minutes: { prev: stored.window_minutes, curr: r.window_minutes },
    channel: { prev: stored.channel, curr: r.channel },
    destination: { prev: stored.destination, curr: r.destination },
    cooldown_minutes: { prev: (stored.conditions as Record<string, unknown> | undefined)?.effective_cooldown_min, curr: r.cooldown_minutes },
    detail_diff: diff(((stored as Record<string, unknown>).detail as Record<string, unknown>) ?? {}, detail),
  };
  const differingFields = Object.entries(compare)
    .filter(([k, v]) => k !== "detail_diff" && JSON.stringify((v as { prev: unknown }).prev) !== JSON.stringify((v as { curr: unknown }).curr))
    .map(([k]) => k);
  if (Object.keys(compare.detail_diff).length > 0) differingFields.push("detail");

  return new Response(JSON.stringify({
    ok: true,
    audit_id: body.audit_id,
    rule_id: r.id,
    rule_name: r.name,
    stored_hash: storedHash,
    current_hash: currentHash,
    hash_match: storedHash === currentHash,
    differing_fields: differingFields,
    compare,
    current: { matched, detail },
    evaluated_at: new Date().toISOString(),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
