import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/payfast.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Polls the payment status for a given m_payment_id. Returns:
//   { status, kind, track_id, amount_cents, paid_at, download_token?, download_expires_at? }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  if (!ref) return json({ error: "missing ref" }, 400);

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: pmt } = await supa
    .from("payments").select("id,status,kind,track_id,amount_cents,paid_at,pf_payment_id")
    .eq("m_payment_id", ref).maybeSingle();
  if (!pmt) return json({ error: "not found" }, 404);

  let download_token: string | null = null;
  let download_expires_at: string | null = null;
  if (pmt.status === "paid" && pmt.kind === "download") {
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
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
