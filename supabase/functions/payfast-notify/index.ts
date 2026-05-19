import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyItn, corsHeaders } from "../_shared/payfast.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const raw = await req.text();
  const payload: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) payload[k] = v;

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const mRef = payload.m_payment_id ?? null;
  const sourceIp =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const bodyHash = await sha256Hex(raw);

  const logRow = async (extra: Record<string, unknown>) => {
    try {
      await supa.from("payfast_notify_log").insert({
        m_payment_id: mRef,
        raw_payload: payload,
        raw_body_hash: bodyHash,
        source_ip: sourceIp,
        pf_payment_status: payload.payment_status ?? null,
        received_amount: payload.amount_gross ?? null,
        ...extra,
      });
    } catch { /* never block notify on logging failure */ }
  };

  if (!mRef) {
    await logRow({ outcome: "invalid", verify_reason: "missing m_payment_id" });
    return new Response("missing ref", { status: 400 });
  }

  const { data: pmt } = await supa
    .from("payments").select("*").eq("m_payment_id", mRef).maybeSingle();
  if (!pmt) {
    await logRow({ outcome: "unknown_payment" });
    return new Response("unknown payment", { status: 404 });
  }

  // Idempotent: only act if still pending
  if (pmt.status === "paid") {
    await logRow({
      payment_id: pmt.id,
      outcome: "ignored",
      was_idempotent_skip: true,
      expected_amount_cents: pmt.amount_cents,
      signature_ok: true,
      amount_ok: true,
    });
    return new Response("ok", { status: 200 });
  }

  const verify = await verifyItn(raw, payload);
  const expected = (pmt.amount_cents / 100).toFixed(2);
  const amountMatches = (payload.amount_gross ?? "").trim() === expected;

  if (!verify.ok || !amountMatches) {
    await supa.from("payments").update({
      status: "failed",
      signature_verified: verify.ok,
      itn_payload: payload,
    }).eq("id", pmt.id);
    await logRow({
      payment_id: pmt.id,
      outcome: "invalid",
      signature_ok: verify.ok,
      amount_ok: amountMatches,
      verify_reason: verify.reason ?? (amountMatches ? null : "amount-mismatch"),
      expected_amount_cents: pmt.amount_cents,
    });
    return new Response(`fail:${verify.reason ?? "amount-mismatch"}`, { status: 400 });
  }

  const paid = payload.payment_status === "COMPLETE";
  if (!paid) {
    await supa.from("payments").update({
      status: "failed", signature_verified: true, itn_payload: payload,
    }).eq("id", pmt.id);
    await logRow({
      payment_id: pmt.id,
      outcome: "failed",
      signature_ok: true,
      amount_ok: true,
      verify_reason: `status=${payload.payment_status}`,
      expected_amount_cents: pmt.amount_cents,
    });
    return new Response("not complete", { status: 200 });
  }

  await supa.from("payments").update({
    status: "paid",
    signature_verified: true,
    pf_payment_id: payload.pf_payment_id ?? null,
    paid_at: new Date().toISOString(),
    itn_payload: payload,
  }).eq("id", pmt.id);

  if (pmt.kind === "download" && pmt.track_id) {
    const token = randomToken();
    const expires = new Date(Date.now() + 10 * 60_000).toISOString();
    await supa.from("download_tokens").insert({
      payment_id: pmt.id, track_id: pmt.track_id, token, expires_at: expires,
    });
  }

  await logRow({
    payment_id: pmt.id,
    outcome: "paid",
    signature_ok: true,
    amount_ok: true,
    expected_amount_cents: pmt.amount_cents,
  });

  return new Response("ok", { status: 200 });
});
