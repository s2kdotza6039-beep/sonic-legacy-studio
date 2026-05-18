import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCheckoutFields, PAYFAST_CHECKOUT, corsHeaders } from "../_shared/payfast.ts";

const APP_URL = Deno.env.get("APP_PUBLIC_URL") ?? "https://s2kdotza.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Kind = "tier_standard" | "tier_gold" | "download";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  try {
    const { track_id, kind, email } = await req.json() as {
      track_id: string; kind: Kind; email?: string;
    };
    if (!track_id || !["tier_standard","tier_gold","download"].includes(kind)) {
      return json({ error: "invalid input" }, 400);
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: track, error: tErr } = await supa
      .from("tracks").select("*").eq("id", track_id).eq("is_active", true).maybeSingle();
    if (tErr || !track) return json({ error: "track not found" }, 404);

    const amount =
      kind === "tier_standard" ? track.price_standard_cents
      : kind === "tier_gold" ? track.price_gold_cents
      : track.price_download_cents;

    // Optional auth-user link
    let user_id: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const u = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data } = await u.auth.getClaims(auth.replace("Bearer ", ""));
      user_id = data?.claims?.sub ?? null;
    }

    const mPaymentId = crypto.randomUUID();
    const { error: pErr } = await supa.from("payments").insert({
      m_payment_id: mPaymentId,
      user_id, buyer_email: email ?? null,
      track_id, kind, amount_cents: amount, status: "pending",
    });
    if (pErr) return json({ error: pErr.message }, 500);

    const itemName =
      kind === "download" ? `Download — ${track.title}`
      : kind === "tier_gold" ? `Gold Access — ${track.title}`
      : `Standard Access — ${track.title}`;

    const fields = buildCheckoutFields({
      amountCents: amount,
      itemName,
      itemDescription: `${track.artist_name} — ${track.title}`,
      mPaymentId,
      email,
      returnUrl: `${APP_URL}/listen?pf=return&ref=${mPaymentId}`,
      cancelUrl: `${APP_URL}/listen?pf=cancel&ref=${mPaymentId}`,
      notifyUrl: `${SUPABASE_URL}/functions/v1/payfast-notify`,
      customStr1: kind,
    });

    return json({ checkout_url: PAYFAST_CHECKOUT, fields, m_payment_id: mPaymentId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
