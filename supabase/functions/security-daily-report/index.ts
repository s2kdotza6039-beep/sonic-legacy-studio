// security-daily-report: aggregates the last 24h of security alert delivery
// metrics per meta-rule and emails a digest to all founders.
//
// Modes:
//   * default → enqueue digest emails to founders
//   * { dry_run: true } → return the templateData and resolved recipients without sending
//   * { preview: true } → return rendered HTML + subject (founder UI preview)
//   * { manual: true } → on-demand run; recorded with action="daily_report_manual_run"
//
// Triggered by pg_cron daily, or callable by the service role / founder for
// ad-hoc runs.
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireFounderOrService } from "../_shared/authGuard.ts";
import { resolveCaller } from "../_shared/authGuard.ts";
import { template as dailyReportTemplate } from "../_shared/transactional-email-templates/security-daily-report.tsx";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Dispatch = { rule_id: string | null; rule_name: string | null; attempt: number; created_at: string };
type Dlq = { rule_id: string | null; rule_name: string | null; created_at: string };

type RuleAgg = {
  rule_id: string;
  rule_name: string;
  attempts: number;
  retries: number;
  retry_rate_pct: number;
  dlq_count: number;
  dlq_rate_pct: number;
  retry_rate_delta_pct: number;
  dlq_rate_delta_pct: number;
};

function aggregate(disps: Dispatch[], dlqs: Dlq[]): Map<string, { name: string; attempts: number; retries: number; dlq: number }> {
  const m = new Map<string, { name: string; attempts: number; retries: number; dlq: number }>();
  for (const d of disps) {
    if (!d.rule_id) continue;
    const e = m.get(d.rule_id) ?? { name: d.rule_name ?? "(rule)", attempts: 0, retries: 0, dlq: 0 };
    e.attempts++;
    e.retries += Math.max(0, (d.attempt ?? 1) - 1);
    if (d.rule_name) e.name = d.rule_name;
    m.set(d.rule_id, e);
  }
  for (const q of dlqs) {
    if (!q.rule_id) continue;
    const e = m.get(q.rule_id) ?? { name: q.rule_name ?? "(rule)", attempts: 0, retries: 0, dlq: 0 };
    e.dlq++;
    if (q.rule_name) e.name = q.rule_name;
    m.set(q.rule_id, e);
  }
  return m;
}

function ratesFor(agg: { attempts: number; retries: number; dlq: number }) {
  const retry = agg.attempts > 0 ? (agg.retries / agg.attempts) * 100 : 0;
  const dlq = agg.attempts > 0 ? (agg.dlq / agg.attempts) * 100 : (agg.dlq > 0 ? 100 : 0);
  return { retry, dlq };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireFounderOrService(req);
  if (denied) return denied;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: { window_hours?: number; dry_run?: boolean; preview?: boolean; manual?: boolean; recipients?: string[]; template_data?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const windowHours = Math.max(1, Math.min(168, body.window_hours ?? 24));
  const windowMs = windowHours * 3600_000;

  // Re-render an old run's stored templateData without recomputing metrics.
  if (body.preview && body.template_data && typeof body.template_data === "object") {
    try {
      const td = body.template_data as Record<string, unknown>;
      const html = await renderAsync(React.createElement(dailyReportTemplate.component, td));
      const subject = typeof dailyReportTemplate.subject === "function"
        ? dailyReportTemplate.subject(td)
        : dailyReportTemplate.subject;
      return new Response(JSON.stringify({ ok: true, preview: true, replay: true, subject, html, templateData: td }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const now = Date.now();
  const currentSince = new Date(now - windowMs).toISOString();
  const priorSince = new Date(now - 2 * windowMs).toISOString();
  const priorUntil = currentSince;

  const { data: metaRules } = await sb
    .from("security_alert_rules")
    .select("id,name")
    .eq("event_source", "delivery_meta");
  const metaRuleIds = new Set((metaRules ?? []).map((r) => r.id as string));

  const [curDisp, curDlq, priorDisp, priorDlq] = await Promise.all([
    sb.from("security_alert_dispatch_log").select("rule_id,rule_name,attempt,created_at").gte("created_at", currentSince).limit(5000),
    sb.from("security_alert_dlq").select("rule_id,rule_name,created_at").gte("created_at", currentSince).limit(2000),
    sb.from("security_alert_dispatch_log").select("rule_id,rule_name,attempt,created_at").gte("created_at", priorSince).lt("created_at", priorUntil).limit(5000),
    sb.from("security_alert_dlq").select("rule_id,rule_name,created_at").gte("created_at", priorSince).lt("created_at", priorUntil).limit(2000),
  ]);

  const filt = <T extends { rule_id: string | null }>(rows: T[]) =>
    rows.filter((r) => r.rule_id && metaRuleIds.has(r.rule_id));

  const curMap = aggregate(filt((curDisp.data ?? []) as Dispatch[]), filt((curDlq.data ?? []) as Dlq[]));
  const priorMap = aggregate(filt((priorDisp.data ?? []) as Dispatch[]), filt((priorDlq.data ?? []) as Dlq[]));

  const rows: RuleAgg[] = [];
  for (const [rule_id, c] of curMap.entries()) {
    const cr = ratesFor(c);
    const p = priorMap.get(rule_id) ?? { name: c.name, attempts: 0, retries: 0, dlq: 0 };
    const pr = ratesFor(p);
    rows.push({
      rule_id,
      rule_name: c.name,
      attempts: c.attempts,
      retries: c.retries,
      retry_rate_pct: Math.round(cr.retry * 100) / 100,
      dlq_count: c.dlq,
      dlq_rate_pct: Math.round(cr.dlq * 100) / 100,
      retry_rate_delta_pct: Math.round((cr.retry - pr.retry) * 100) / 100,
      dlq_rate_delta_pct: Math.round((cr.dlq - pr.dlq) * 100) / 100,
    });
  }

  const totals = rows.reduce((acc, r) => ({
    total_attempts: acc.total_attempts + r.attempts,
    total_retries: acc.total_retries + r.retries,
    total_dlq: acc.total_dlq + r.dlq_count,
  }), { total_attempts: 0, total_retries: 0, total_dlq: 0 });

  const topByAttempts = [...rows].sort((a, b) => b.attempts - a.attempts).slice(0, 5);
  const topByRetrySpike = [...rows]
    .filter((r) => r.retry_rate_delta_pct > 0 || r.retries > 0)
    .sort((a, b) => b.retry_rate_delta_pct - a.retry_rate_delta_pct).slice(0, 5);
  const topByDlqChange = [...rows]
    .filter((r) => Math.abs(r.dlq_rate_delta_pct) > 0 || r.dlq_count > 0)
    .sort((a, b) => Math.abs(b.dlq_rate_delta_pct) - Math.abs(a.dlq_rate_delta_pct)).slice(0, 5);

  const date = new Date(now).toISOString().slice(0, 10);
  const templateData = { date, windowHours, totals, topByAttempts, topByRetrySpike, topByDlqChange };

  // Preview: render the email HTML+subject and return without sending.
  if (body.preview) {
    let html = "";
    let subject = "";
    try {
      html = await renderAsync(React.createElement(dailyReportTemplate.component, templateData));
      subject = typeof dailyReportTemplate.subject === "function"
        ? dailyReportTemplate.subject(templateData)
        : dailyReportTemplate.subject;
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, preview: true, subject, html, templateData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve recipients: explicit > all founders' emails.
  let recipients: string[] = (body.recipients ?? []).filter((s) => typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  if (recipients.length === 0) {
    const { data: founderRoles } = await sb.from("user_roles").select("user_id").eq("role", "founder");
    for (const fr of (founderRoles ?? []) as Array<{ user_id: string }>) {
      try {
        const { data: u } = await sb.auth.admin.getUserById(fr.user_id);
        const email = u?.user?.email;
        if (email) recipients.push(email);
      } catch { /* skip */ }
    }
  }

  if (body.dry_run) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, recipients, templateData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_recipients" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const idemSuffix = body.manual ? `-manual-${Date.now()}` : "";
  const sent: Array<{ to: string; ok: boolean; error?: string }> = [];
  for (const to of recipients) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          template_name: "security-daily-report",
          recipient_email: to,
          templateData,
          idempotency_key: `security-daily-report-${date}-${to}${idemSuffix}`,
        }),
      });
      sent.push({ to, ok: r.ok, error: r.ok ? undefined : `${r.status} ${(await r.text()).slice(0, 200)}` });
    } catch (e) {
      sent.push({ to, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Audit entry — manual runs get a distinct action so they show up in the
  // audit log "Daily reports" tab alongside scheduled runs.
  try {
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;
    if (body.manual) {
      const caller = await resolveCaller(req);
      actorUserId = caller.userId;
      if (caller.userId) {
        try {
          const { data: u } = await sb.auth.admin.getUserById(caller.userId);
          actorEmail = u?.user?.email ?? null;
        } catch { /* ignore */ }
      }
    }
    await sb.from("security_audit_log").insert({
      actor_user_id: actorUserId,
      action: body.manual ? "daily_report_manual_run" : "daily_report_sent",
      entity: "security_alert_rule",
      row_count: rows.length,
      filters: { window_hours: windowHours, manual: !!body.manual },
      metadata: { actor_email: actorEmail, recipients, totals, top_count: topByAttempts.length, sent_results: sent },
    });
  } catch { /* best-effort */ }

  return new Response(JSON.stringify({ ok: true, sent, templateData }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
