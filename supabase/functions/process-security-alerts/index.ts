// Process-security-alerts: scans recent security events against enabled rules,
// dispatches notifications via email or webhook, retries failed deliveries
// with exponential backoff, and moves exhausted attempts to a DLQ.
//
// Modes:
//   POST {}                — scan rules + send first-attempt deliveries.
//   POST {"mode":"retry"}  — retry previously-failed dispatch rows whose
//                            next_retry_at has elapsed.
//
// Founder-only via authGuard (service-role calls from cron also pass).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireFounder } from "../_shared/authGuard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60_000; // 1 min, doubled each attempt

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

async function sendOnce(
  channel: "email" | "webhook",
  destination: string,
  ruleName: string,
  payload: unknown,
  source: string,
  kind: string,
  windowMin: number,
  threshold: number,
  count: number,
  sample: unknown[],
): Promise<void> {
  if (channel === "webhook") {
    const r = await fetch(destination, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`webhook ${r.status} ${(await r.text()).slice(0, 200)}`);
    return;
  }
  const r = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({
      to: destination,
      subject: `[Security] ${ruleName} — ${count} ${kind} events`,
      html: `<h2>${ruleName}</h2><p><strong>${count}</strong> <code>${kind}</code> events on <code>${source}</code> in the last ${windowMin} minutes (threshold ${threshold}).</p><pre>${JSON.stringify(sample, null, 2).slice(0, 4000)}</pre>`,
      template_name: "security-alert",
    }),
  });
  if (!r.ok) throw new Error(`email ${r.status} ${(await r.text()).slice(0, 200)}`);
}

const nextBackoff = (attempt: number) =>
  new Date(Date.now() + BASE_BACKOFF_MS * Math.pow(2, attempt - 1)).toISOString();

async function scanAndDispatch(sb: ReturnType<typeof createClient>) {
  const { data: rules } = await sb.from("security_alert_rules").select("*").eq("enabled", true);
  const now = Date.now();
  const results: Array<Record<string, unknown>> = [];

  for (const rule of (rules ?? []) as Rule[]) {
    const cfg = SOURCE_TABLE[rule.event_source];
    if (!cfg) continue;

    if (rule.last_triggered_at && now - new Date(rule.last_triggered_at).getTime() < rule.cooldown_minutes * 60_000) {
      await sb.from("security_alert_dispatch_log").insert({
        rule_id: rule.id, rule_name: rule.name, channel: rule.channel, destination: rule.destination,
        matched_count: 0, status: "skipped_cooldown", attempt: 0, max_attempts: 0,
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

    const payload = {
      rule: rule.name, source: rule.event_source, kind: rule.event_kind,
      matched, threshold: rule.threshold, window_minutes: rule.window_minutes,
      sample: rows ?? [], at: new Date().toISOString(),
    };

    try {
      await sendOnce(rule.channel, rule.destination, rule.name, payload,
        rule.event_source, rule.event_kind, rule.window_minutes, rule.threshold, matched, rows ?? []);
      await sb.from("security_alert_rules").update({ last_triggered_at: new Date().toISOString() }).eq("id", rule.id);
      await sb.from("security_alert_dispatch_log").insert({
        rule_id: rule.id, rule_name: rule.name, channel: rule.channel, destination: rule.destination,
        matched_count: matched, status: "sent", attempt: 1, max_attempts: MAX_ATTEMPTS, payload, rule_snapshot: rule,
      });
      results.push({ rule: rule.name, status: "sent", matched });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from("security_alert_dispatch_log").insert({
        rule_id: rule.id, rule_name: rule.name, channel: rule.channel, destination: rule.destination,
        matched_count: matched, status: "failed", attempt: 1, max_attempts: MAX_ATTEMPTS,
        next_retry_at: nextBackoff(1), last_error: msg, payload, rule_snapshot: rule,
      });
      results.push({ rule: rule.name, status: "failed_will_retry", matched, error: msg });
    }
  }
  return results;
}

async function retryFailed(sb: ReturnType<typeof createClient>) {
  const nowIso = new Date().toISOString();
  const { data: due } = await sb.from("security_alert_dispatch_log")
    .select("*")
    .eq("status", "failed")
    .lte("next_retry_at", nowIso)
    .order("next_retry_at", { ascending: true })
    .limit(50);

  const results: Array<Record<string, unknown>> = [];

  for (const row of (due ?? []) as Array<{
    id: string; rule_id: string | null; rule_name: string | null;
    channel: "email" | "webhook"; destination: string; matched_count: number | null;
    payload: Record<string, unknown> | null; rule_snapshot: Rule | null;
    attempt: number; max_attempts: number;
  }>) {
    const nextAttempt = row.attempt + 1;
    const snap = row.rule_snapshot;
    try {
      await sendOnce(
        row.channel, row.destination, row.rule_name ?? "(rule)",
        row.payload, snap?.event_source ?? "?", snap?.event_kind ?? "?",
        snap?.window_minutes ?? 0, snap?.threshold ?? 0,
        row.matched_count ?? 0, (row.payload as { sample?: unknown[] } | null)?.sample ?? [],
      );
      // Mark this row as sent on retry; also insert a new "sent" row for clarity.
      await sb.from("security_alert_dispatch_log").insert({
        rule_id: row.rule_id, rule_name: row.rule_name, channel: row.channel, destination: row.destination,
        matched_count: row.matched_count, status: "sent", attempt: nextAttempt, max_attempts: row.max_attempts,
        payload: row.payload, rule_snapshot: snap,
      });
      // Suppress further retries on the original row.
      await sb.from("security_alert_dispatch_log").update({ status: "retried_ok", next_retry_at: null }).eq("id", row.id);
      if (row.rule_id) await sb.from("security_alert_rules").update({ last_triggered_at: new Date().toISOString() }).eq("id", row.rule_id);
      results.push({ id: row.id, status: "sent_on_retry", attempt: nextAttempt });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (nextAttempt >= row.max_attempts) {
        // Move to DLQ
        await sb.from("security_alert_dlq").insert({
          rule_id: row.rule_id, rule_name: row.rule_name, channel: row.channel, destination: row.destination,
          matched_count: row.matched_count, attempts: nextAttempt, last_error: msg,
          payload: row.payload, rule_snapshot: snap, first_failed_at: nowIso,
        });
        await sb.from("security_alert_dispatch_log").update({
          status: "dlq", next_retry_at: null, attempt: nextAttempt, last_error: msg,
        }).eq("id", row.id);
        results.push({ id: row.id, status: "dlq", attempts: nextAttempt, error: msg });
      } else {
        await sb.from("security_alert_dispatch_log").update({
          attempt: nextAttempt, next_retry_at: nextBackoff(nextAttempt), last_error: msg,
        }).eq("id", row.id);
        results.push({ id: row.id, status: "retry_scheduled", attempt: nextAttempt, error: msg });
      }
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireFounder(req);
  if (denied) return denied;

  let mode = "scan";
  try {
    if (req.headers.get("Content-Type")?.includes("application/json")) {
      const body = await req.json();
      if (body?.mode === "retry") mode = "retry";
    }
  } catch { /* empty body ok */ }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const results = mode === "retry" ? await retryFailed(sb) : await scanAndDispatch(sb);

  return new Response(JSON.stringify({ mode, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
