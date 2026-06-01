// log-security-export: records a Security dashboard CSV export to
// public.security_audit_log with the requester user ID, IP (from x-forwarded-for),
// and user agent. Founder-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveCaller, callerHasRole } from "../_shared/authGuard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const caller = await resolveCaller(req);
  if (!caller.userId || !(await callerHasRole(caller.userId, "founder"))) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { row_count?: number; filters?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const xff = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "";
  const ip = (xff.split(",")[0] ?? "").trim().slice(0, 64) || null;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 512) || null;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await sb.from("security_audit_log").insert({
    actor_user_id: caller.userId,
    action: "csv_export",
    entity: "security_events",
    row_count: typeof body.row_count === "number" ? body.row_count : null,
    filters: body.filters ?? {},
    ip,
    user_agent: ua,
    metadata: { source: "log-security-export" },
  }).select("id").maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: data?.id, ip, ua_recorded: !!ua }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
