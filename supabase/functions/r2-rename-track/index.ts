// Renames an R2 object via the Worker admin endpoint, then updates
// tracks.r2_object_key. Founder-only.
//
// Body: { track_id: string, to?: string }   // `to` defaults to canonical key
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/payfast.ts";
import { requireFounder } from "../_shared/authGuard.ts";
import { canonicalObjectKey, normalizeObjectKey, signLogBody } from "../_shared/streamSign.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const R2_BASE_RAW = (Deno.env.get("R2_PUBLIC_BASE") ?? "https://newsingle.s2kdotza.com").trim().replace(/\/$/, "");
const WORKER_BASE = /^https?:\/\//i.test(R2_BASE_RAW) ? R2_BASE_RAW : `https://${R2_BASE_RAW}`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const guard = await requireFounder(req);
  if (guard) return guard;

  let body: { track_id?: string; to?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const track_id = body.track_id;
  if (!track_id) return json({ error: "track_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: track, error: tErr } = await admin
    .from("tracks").select("id,title,r2_object_key").eq("id", track_id).maybeSingle();
  if (tErr || !track) return json({ error: "track not found" }, 404);

  const decodedFrom = normalizeObjectKey(track.r2_object_key);
  const decodedTo = (body.to && body.to.trim()) || canonicalObjectKey(track.r2_object_key);
  if (decodedFrom === decodedTo) {
    return json({ ok: true, noop: true, from: decodedFrom, to: decodedTo });
  }

  const renameBody = JSON.stringify({ from: decodedFrom, to: decodedTo });
  const sig = await signLogBody(renameBody);
  const workerRes = await fetch(`${WORKER_BASE}/__admin/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-sig": sig },
    body: renameBody,
  });
  const workerText = await workerRes.text();
  if (!workerRes.ok) {
    return json({
      error: "worker_rename_failed",
      status: workerRes.status,
      detail: workerText.slice(0, 500),
      worker_url: `${WORKER_BASE}/__admin/rename`,
    }, 502);
  }

  // Store the rewritten key WITHOUT percent-encoding — stream-track normalises
  // on the way out and the Worker decodes pathname before comparing.
  const { error: uErr } = await admin
    .from("tracks").update({ r2_object_key: decodedTo }).eq("id", track_id);
  if (uErr) {
    return json({
      error: "rename_succeeded_but_db_update_failed",
      detail: uErr.message,
      from: decodedFrom,
      to: decodedTo,
    }, 500);
  }

  // Audit trail
  await admin.from("playback_events").insert({
    event_kind: "worker_granted",
    track_id,
    tier: null,
    metadata: { source: "r2_rename", from: decodedFrom, to: decodedTo, worker: workerText.slice(0, 200) },
  });

  return json({ ok: true, from: decodedFrom, to: decodedTo, worker: workerText.slice(0, 200) });
});
