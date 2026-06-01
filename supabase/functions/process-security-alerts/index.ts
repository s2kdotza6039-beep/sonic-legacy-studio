// Process-security-alerts: scans recent security events against enabled rules
// and dispatches notifications via email (send-transactional-email) or webhook.
//
// Founder-only via authGuard. Service-role Supabase client used for reads/writes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireFounder } from "../_shared/authGuard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  event_source: "playback" | "payfast" | "ai" | "audit";
  event_kind: string;
  threshold: number;
  window_minutes: number;
  channel: "email" | "webhook";
  destination: string;
  cooldown_minutes: number;
  last_triggered_at: string | null;
};

const SOURCE_TABLE: Record<Rule["event_source"], { table: string; kindCol: string; tsCol: string }> = {
  playback: { table: "playback_events", kindCol: "event_kind", tsCol: "created_at" },
  payfast: { table: "payfast_notify_log", kindCol: "outcome", tsCol: "created_at" },
  ai: { table: "ai_activity_log", kindCol: "action", tsCol: "created_at" },
  audit: { table: "security_audit_log", kindCol: "action", tsCol: "created_at" },
};

async function dispatch(rule: Rule, count: number, sample: unknown[]) {
  const payload = {
    rule: rule.name,
    source: rule.event_source,
    kind: rule.event_kind,
    matched: count,
    threshold: rule.threshold,
    window_minutes: rule.window_minutes,
    sample,
    at: new Date().toISOString(),
  };

  if (rule.channel === "webhook") {
    const r = await fetch(rule.destination, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`webhook ${r.status}`);
    return payload;
  }

  // email: defer to existing transactional email function
  const r = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      to: rule.destination,
      subject: `[Security] ${rule.name} — ${count} ${rule.event_kind} events`,
      html: `<h2>${rule.name}</h2><p><strong>${count}</strong> <code>${rule.event_kind}</code> events on <code>${rule.event_source}</code> in the last ${rule.window_minutes} minutes (threshold ${rule.threshold}).</p><pre>${JSON.stringify(sample, null, 2).slice(0, 4000)}</pre>`,
      template_name: "security-alert",
    }),
  });
  if (!r.ok) throw new Error(`email ${r.status}`);
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireFounder(req);
  if (denied) return denied;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: rules } = await sb
    .from("security_alert_rules")
    .select("*")
    .eq("enabled", true);

  const results: Array<{ rule: string; status: string; matched?: number; error?: string }> = [];
  const now = Date.now();

  for (const rule of (rules ?? []) as Rule[]) {
    const cfg = SOURCE_TABLE[rule.event_source];
    if (!cfg) continue;

    // Cooldown
    if (rule.last_triggered_at && now - new Date(rule.last_triggered_at).getTime() < rule.cooldown_minutes * 60_000) {
      await sb.from("security_alert_dispatch_log").insert({
        rule_id: rule.id, rule_name: rule.name, channel: rule.channel, destination: rule.destination,
        matched_count: 0, status: "skipped_cooldown",
      });
      results.push({ rule: rule.name, status: "skipped_cooldown" });
      continue;
    }

    const since = new Date(now - rule.window_minutes * 60_000).toISOString();
    let q = sb.from(cfg.table).select("*", { count: "exact", head: false }).gte(cfg.tsCol, since).limit(5);
    if (rule.event_kind && rule.event_kind !== "*") q = q.eq(cfg.kindCol, rule.event_kind);

    const { data: rows, count, error: qErr } = await q;
    if (qErr) {
      results.push({ rule: rule.name, status: "query_error", error: qErr.message });
      continue;
    }
    const matched = count ?? rows?.length ?? 0;
    if (matched < rule.threshold) {
      results.push({ rule: rule.name, status: "below_threshold", matched });
      continue;
    }

    try {
      const payload = await dispatch(rule, matched, rows ?? []);
      await sb.from("security_alert_rules").update({ last_triggered_at: new Date().toISOString() }).eq("id", rule.id);
      await sb.from("security_alert_dispatch_log").insert({
        rule_id: rule.id, rule_name: rule.name, channel: rule.channel, destination: rule.destination,
        matched_count: matched, status: "sent", payload,
      });
      results.push({ rule: rule.name, status: "sent", matched });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from("security_alert_dispatch_log").insert({
        rule_id: rule.id, rule_name: rule.name, channel: rule.channel, destination: rule.destination,
        matched_count: matched, status: "failed", error: msg,
      });
      results.push({ rule: rule.name, status: "failed", matched, error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
