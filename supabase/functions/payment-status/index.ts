import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/payfast.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Returns payment status. The one-use `download_token` is ONLY returned if the
// caller proves ownership:
//   - JWT whose `sub` matches payments.user_id, OR
//   - `?email=` query parameter that matches payments.buyer_email (case-insensitive).
// The non-sensitive status fields are returned without auth so the polling UI on
// /listen?ref=... can still detect "paid" / "pending" / "failed".
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  const emailParam = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!ref) return json({ error: "missing ref" }, 400);

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: pmt } = await supa
    .from("payments")
    .select("id,status,kind,track_id,amount_cents,paid_at,pf_payment_id,user_id,buyer_email")
    .eq("m_payment_id", ref).maybeSingle();
  if (!pmt) return json({ error: "not found" }, 404);

  // Resolve caller identity (optional)
  let callerUserId: string | null = null;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    try {
      const u = createClient(SUPABASE_URL, ANON_KEY);
      const { data } = await u.auth.getClaims(auth.replace("Bearer ", ""));
      callerUserId = data?.claims?.sub ?? null;
    } catch { /* invalid token, fall through */ }
  }

  const ownsByJwt = !!(callerUserId && pmt.user_id && callerUserId === pmt.user_id);
  const ownsByEmail = !!(emailParam && pmt.buyer_email && pmt.buyer_email.toLowerCase() === emailParam);
  const isOwner = ownsByJwt || ownsByEmail;

  let download_token: string | null = null;
  let download_expires_at: string | null = null;
  if (isOwner && pmt.status === "paid" && pmt.kind === "download") {
    const { data: tok } = await supa.from("download_tokens")
      .select("token,used_at,expires_at")
      .eq("payment_id", pmt.id).is("used_at", null).maybeSingle();
    if (tok && new Date(tok.expires_at) > new Date()) {
      download_token = tok.token;
      download_expires_at = tok.expires_at as string;
    }
  }

  return json({
    status: pmt.status,
    kind: pmt.kind,
    track_id: pmt.track_id,
    amount_cents: pmt.amount_cents,
    paid_at: pmt.paid_at,
    pf_payment_id: pmt.pf_payment_id,
    download_token,
    download_expires_at,
    requires_ownership_proof: !isOwner && pmt.status === "paid" && pmt.kind === "download",
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
