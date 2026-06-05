// Service-role logging endpoint for the Cloudflare Worker.
// The Worker computes HMAC-SHA256 of the JSON body using R2_SIGNING_SECRET
// and sends it as the `x-worker-sig` header. This function verifies, then
// inserts a row into public.playback_events via the service role.
//
// Body shape:
// {
//   event_kind: "worker_granted" | "worker_denied_signature" | "worker_denied_expired"
//              | "worker_denied_path" | "worker_denied_range" | "worker_denied_replay"
//              | "worker_denied_rate_limit",
//   track_id?: string,    // when resolvable (path matched a known r2_object_key)
//   tier?: string,
//   user_agent?: string,
//   metadata?: { reason?, path?, expected_path?, range?, ip?, request_id?, ... }
// }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/payfast.ts";
import { verifyLogBody } from "../_shared/streamSign.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED = new Set([
  "worker_granted",
  "worker_denied_signature",
  "worker_denied_expired",
  "worker_denied_path",
  "worker_denied_range",
  "worker_denied_replay",
  "worker_denied_rate_limit",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const sig = req.headers.get("x-worker-sig") ?? "";
  if (!sig) return json({ error: "missing signature" }, 401);

  const raw = await req.text();
  const ok = await verifyLogBody(raw, sig).catch(() => false);
  if (!ok) return json({ error: "bad signature" }, 401);

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }

  const event_kind = String(body.event_kind ?? "");
  if (!ALLOWED.has(event_kind)) return json({ error: "invalid event_kind" }, 400);

  const track_id = typeof body.track_id === "string" ? body.track_id : null;
  const tier = typeof body.tier === "string" ? body.tier.slice(0, 32) : null;
  const ua = typeof body.user_agent === "string" ? body.user_agent.slice(0, 512) : null;
  const metadata = (body.metadata && typeof body.metadata === "object") ? body.metadata : {};

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error } = await admin.from("playback_events").insert({
    event_kind,
    track_id,
    tier,
    user_agent: ua,
    metadata: { ...metadata, source: "cf_worker" },
  });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
