// security-retention-cleanup: deletes rows from security_audit_log,
// security_alert_dispatch_log, and security_alert_dlq older than the
// retention windows configured in public.security_retention_config.
//
// Founder-only via authGuard; service-role cron calls also pass.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireFounder } from "../_shared/authGuard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await requireFounder(req);
  if (denied) return denied;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: cfg } = await sb.from("security_retention_config").select("*").eq("id", 1).maybeSingle();
  if (!cfg) {
    return new Response(JSON.stringify({ error: "no retention config" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!cfg.cleanup_enabled) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "cleanup_disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auditCutoff = new Date(Date.now() - cfg.audit_log_days * 86_400_000).toISOString();
  const dispatchCutoff = new Date(Date.now() - cfg.dispatch_log_days * 86_400_000).toISOString();
  const dlqCutoff = new Date(Date.now() - cfg.dlq_days * 86_400_000).toISOString();

  const audit = await sb.from("security_audit_log").delete({ count: "exact" }).lt("created_at", auditCutoff);
  const dispatch = await sb.from("security_alert_dispatch_log").delete({ count: "exact" }).lt("created_at", dispatchCutoff);
  const dlq = await sb.from("security_alert_dlq").delete({ count: "exact" }).lt("created_at", dlqCutoff);

  const summary = {
    audit_deleted: audit.count ?? 0, audit_cutoff: auditCutoff,
    dispatch_deleted: dispatch.count ?? 0, dispatch_cutoff: dispatchCutoff,
    dlq_deleted: dlq.count ?? 0, dlq_cutoff: dlqCutoff,
    audit_error: audit.error?.message, dispatch_error: dispatch.error?.message, dlq_error: dlq.error?.message,
  };

  await sb.from("security_retention_config").update({
    last_cleanup_at: new Date().toISOString(),
    last_cleanup_summary: summary,
  }).eq("id", 1);

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
