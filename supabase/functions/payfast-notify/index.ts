import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyItn, corsHeaders } from "../_shared/payfast.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const raw = await req.text();
  const payload: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) payload[k] = v;

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const mRef = payload.m_payment_id;
  if (!mRef) return new Response("missing ref", { status: 400 });

  const { data: pmt } = await supa
    .from("payments").select("*").eq("m_payment_id", mRef).maybeSingle();
  if (!pmt) return new Response("unknown payment", { status: 404 });

  // Idempotent: only act if still pending
  if (pmt.status === "paid") return new Response("ok", { status: 200 });

  const verify = await verifyItn(raw, payload);
  const expected = (pmt.amount_cents / 100).toFixed(2);
  const amountMatches = (payload.amount_gross ?? "").trim() === expected;

  if (!verify.ok || !amountMatches) {
    await supa.from("payments").update({
      status: "failed",
      signature_verified: verify.ok,
      itn_payload: payload,
    }).eq("id", pmt.id);
    return new Response(`fail:${verify.reason ?? "amount-mismatch"}`, { status: 400 });
  }

  const paid = payload.payment_status === "COMPLETE";
  if (!paid) {
    await supa.from("payments").update({
      status: "failed", signature_verified: true, itn_payload: payload,
    }).eq("id", pmt.id);
    return new Response("not complete", { status: 200 });
  }

  await supa.from("payments").update({
    status: "paid",
    signature_verified: true,
    pf_payment_id: payload.pf_payment_id ?? null,
    paid_at: new Date().toISOString(),
    itn_payload: payload,
  }).eq("id", pmt.id);

  // Mint download token
  if (pmt.kind === "download" && pmt.track_id) {
    const token = randomToken();
    const expires = new Date(Date.now() + 10 * 60_000).toISOString();
    await supa.from("download_tokens").insert({
      payment_id: pmt.id, track_id: pmt.track_id, token, expires_at: expires,
    });
  }

  return new Response("ok", { status: 200 });
});
