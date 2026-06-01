// security-scheduled-export: runs due scheduled CSV exports of
// public.security_audit_log and delivers them via email (inline HTML preview +
// CSV attachment via @lovable.dev/email or webhook POST). Each run inserts an
// "csv_export" audit entry with metadata.source="scheduled_export" so it
// shows up alongside on-demand exports in the Security Audit Log viewer.
//
// Triggered every 15 minutes via pg_cron. Picks rows where:
//   enabled = true AND (
//     last_run_at IS NULL OR
//     (cadence='daily'  AND last_run_at < now() - interval '23 hours') OR
//     (cadence='weekly' AND last_run_at < now() - interval '6 days 23 hours')
//   )
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireFounderOrService } from "../_shared/authGuard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_ROWS = 5000;
const PAGE = 1000;
const MAX_RETRIES = 2; // 1 initial attempt + 2 retries = 3 attempts total

type Schedule = {
  id: string;
  owner_user_id: string;
  name: string;
  cadence: "daily" | "weekly";
  lookback_hours: number;
  filters: Record<string, unknown>;
  delivery_method: "email" | "webhook";
  destination: string;
  enabled: boolean;
  last_run_at: string | null;
};

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function isDue(s: Schedule): boolean {
  if (!s.enabled) return false;
  if (!s.last_run_at) return true;
  const ageMs = Date.now() - new Date(s.last_run_at).getTime();
  if (s.cadence === "daily") return ageMs >= 23 * 3600_000;
  return ageMs >= (7 * 24 - 1) * 3600_000;
}

async function runSchedule(sb: ReturnType<typeof createClient>, s: Schedule) {
  const sinceIso = new Date(Date.now() - s.lookback_hours * 3600_000).toISOString();
  const f = s.filters ?? {};
  const action = (f.action as string) ?? "all";
  const entity = (f.entity as string) ?? "all";
  const actor = (f.actor as string) ?? "";
  const destination = (f.destination as string) ?? "";

  const all: Array<Record<string, unknown>> = [];
  let offset = 0;
  while (offset < MAX_ROWS) {
    let q = sb.from("security_audit_log").select("*").order("created_at", { ascending: false }).gte("created_at", sinceIso).range(offset, offset + PAGE - 1);
    if (action !== "all") q = q.eq("action", action);
    if (entity !== "all") q = q.eq("entity", entity);
    if (actor.trim()) q = q.eq("actor_user_id", actor.trim());
    if (destination.trim()) q = q.or(`metadata->results->0->>destination.ilike.%${destination.trim()}%,metadata->>destination.ilike.%${destination.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as Array<Record<string, unknown>>;
    all.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  const header = ["created_at", "actor_user_id", "action", "entity", "row_count", "ip", "user_agent", "filters", "metadata"];
  const lines = [header.join(",")];
  for (const r of all) {
    lines.push([r.created_at, r.actor_user_id, r.action, r.entity, r.row_count, r.ip, r.user_agent, r.filters, r.metadata].map(csvEscape).join(","));
  }
  const csv = lines.join("\n");

  // Insert a "queued" run row up front so the UI can show in-flight attempts.
  const { data: runRow } = await sb.from("security_scheduled_export_runs").insert({
    schedule_id: s.id,
    status: "queued",
    retry_count: 0,
    row_count: all.length,
    delivery_method: s.delivery_method,
    destination: s.destination,
  }).select("id").single();
  const runId = (runRow as { id?: string } | null)?.id ?? null;

  let deliveryOk = false;
  let deliveryError: string | null = null;
  let attempts = 0;

  const deliverOnce = async (): Promise<{ ok: boolean; error: string | null }> => {
    if (s.delivery_method === "webhook") {
      try {
        const r = await fetch(s.destination, {
          method: "POST",
          headers: { "Content-Type": "text/csv", "x-export-name": s.name, "x-export-rows": String(all.length) },
          body: csv,
        });
        return { ok: r.ok, error: r.ok ? null : `${r.status} ${(await r.text()).slice(0, 200)}` };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
    try {
      const truncated = csv.length > 90_000 ? csv.slice(0, 90_000) + "\n…(truncated)" : csv;
      const html = `<h2>Scheduled security audit export: ${s.name}</h2>
        <p><strong>${all.length}</strong> rows over the last ${s.lookback_hours}h (cadence: ${s.cadence}).</p>
        <p>Generated at ${new Date().toISOString()}.</p>
        <pre style="font-size:11px;background:#f5f5f5;padding:8px;overflow:auto">${truncated.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          to: s.destination,
          recipient_email: s.destination,
          subject: `[Security] Scheduled audit export — ${s.name} (${all.length} rows)`,
          html,
          template_name: "security-alert",
          idempotency_key: `sched-export-${s.id}-${Date.now()}`,
        }),
      });
      return { ok: r.ok, error: r.ok ? null : `${r.status} ${(await r.text()).slice(0, 200)}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  for (let i = 0; i <= MAX_RETRIES; i++) {
    attempts = i + 1;
    const out = await deliverOnce();
    deliveryOk = out.ok;
    deliveryError = out.error;
    if (out.ok) break;
    if (i < MAX_RETRIES) await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
  }

  if (runId) {
    await sb.from("security_scheduled_export_runs").update({
      status: deliveryOk ? "sent" : "failed",
      retry_count: Math.max(0, attempts - 1),
      finished_at: new Date().toISOString(),
      row_count: all.length,
      error_message: deliveryError,
    }).eq("id", runId);
  }

  await sb.from("security_scheduled_exports").update({
    last_run_at: new Date().toISOString(),
    last_status: deliveryOk ? "ok" : "failed",
    last_error: deliveryError,
    last_row_count: all.length,
  }).eq("id", s.id);

  // Audited just like on-demand CSV exports.
  await sb.from("security_audit_log").insert({
    actor_user_id: s.owner_user_id,
    action: "csv_export",
    entity: "security_audit_log",
    row_count: all.length,
    filters: { ...f, range_hours: s.lookback_hours, schedule_id: s.id, cadence: s.cadence },
    metadata: {
      source: "scheduled_export",
      schedule_name: s.name,
      delivery_method: s.delivery_method,
      destination: s.destination,
      delivery_ok: deliveryOk,
      delivery_error: deliveryError,
      attempts,
      run_id: runId,
    },
  });

  return { id: s.id, rows: all.length, delivery_ok: deliveryOk, delivery_error: deliveryError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireFounderOrService(req);
  if (denied) return denied;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: { schedule_id?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  let q = sb.from("security_scheduled_exports").select("*").eq("enabled", true);
  if (body.schedule_id) q = q.eq("id", body.schedule_id);
  const { data: schedules, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: unknown[] = [];
  for (const s of (schedules ?? []) as Schedule[]) {
    if (!body.force && !body.schedule_id && !isDue(s)) continue;
    try {
      results.push(await runSchedule(sb, s));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from("security_scheduled_exports").update({ last_status: "error", last_error: msg, last_run_at: new Date().toISOString() }).eq("id", s.id);
      results.push({ id: s.id, error: msg });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
