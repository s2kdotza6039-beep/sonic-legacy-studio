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

  let body: { row_count?: number; filters?: Record<string, unknown>; entity?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const xff = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "";
  const ip = (xff.split(",")[0] ?? "").trim().slice(0, 64) || null;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 512) || null;
  const requestId = (req.headers.get("x-request-id") ?? crypto.randomUUID()).slice(0, 64);

  // Whitelist of entities that may be exported. Keeps the audit action consistent
  // and prevents arbitrary entity strings being written to the audit log.
  const ALLOWED_ENTITIES = new Set(["security_events", "security_audit_log"]);
  const entity = body.entity && ALLOWED_ENTITIES.has(body.entity) ? body.entity : "security_events";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve actor email via admin API; tolerated as null on failure so export still audits.
  let actorEmail: string | null = null;
  try {
    const { data: u } = await sb.auth.admin.getUserById(caller.userId);
    actorEmail = u?.user?.email ?? null;
  } catch { /* ignore */ }

  const { data, error } = await sb.from("security_audit_log").insert({
    actor_user_id: caller.userId,
    action: "csv_export",
    entity,
    row_count: typeof body.row_count === "number" ? body.row_count : null,
    filters: body.filters ?? {},
    ip,
    user_agent: ua,
    metadata: { source: "log-security-export", request_id: requestId, actor_email: actorEmail },
  }).select("id").maybeSingle();


  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: data?.id, ip, ua_recorded: !!ua, request_id: requestId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId },
  });
});
