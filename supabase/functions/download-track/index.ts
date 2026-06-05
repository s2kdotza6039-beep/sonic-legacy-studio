import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/payfast.ts";
import { normalizeObjectKey, encodeObjectKeyForUrl } from "../_shared/streamSign.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const R2_BASE = (Deno.env.get("R2_PUBLIC_BASE") ?? "https://newsingle.s2kdotza.com").replace(/\/$/, "");

// Redeems a one-use download token and 302-redirects to the R2 file with
// a Content-Disposition attachment header (best-effort; depends on bucket).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("missing token", { status: 400 });

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: t } = await supa.from("download_tokens")
    .select("id,track_id,expires_at,used_at,tracks(r2_object_key,title,artist_name)")
    .eq("token", token).maybeSingle();
  if (!t) return new Response("invalid", { status: 404 });
  if (t.used_at) return new Response("already used", { status: 410 });
  if (new Date(t.expires_at) < new Date()) return new Response("expired", { status: 410 });

  await supa.from("download_tokens").update({ used_at: new Date().toISOString() }).eq("id", t.id);

  // deno-lint-ignore no-explicit-any
  const track: any = t.tracks;
  const target = `${R2_BASE}/${encodeObjectKeyForUrl(normalizeObjectKey(track.r2_object_key))}`;
  return Response.redirect(target, 302);
  return Response.redirect(target, 302);
});
