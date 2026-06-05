import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/payfast.ts";
import { mintStreamToken, normalizeObjectKey, encodeObjectKeyForUrl } from "../_shared/streamSign.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const R2_BASE_RAW = (Deno.env.get("R2_PUBLIC_BASE") ?? "https://newsingle.s2kdotza.com").trim().replace(/\/$/, "");
// Defensive: ensure protocol so the browser <audio src> isn't treated as a relative path.
const R2_BASE = /^https?:\/\//i.test(R2_BASE_RAW) ? R2_BASE_RAW : `https://${R2_BASE_RAW}`;

type Tier = "free" | "standard" | "gold" | "cristal";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const url = new URL(req.url);
    const track_id = url.searchParams.get("track_id") ?? "";
    const tier = (url.searchParams.get("tier") ?? "free") as Tier;
    const ref = url.searchParams.get("ref") ?? null;
    const asJson = url.searchParams.get("json") === "1";

    if (!track_id) return json({ error: "track_id required" }, 400);
    if (!["free", "standard", "gold", "cristal"].includes(tier)) {
      return json({ error: "invalid tier" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: track, error: tErr } = await admin
      .from("tracks").select("*").eq("id", track_id).eq("is_active", true).maybeSingle();
    if (tErr || !track) return json({ error: "track not found" }, 404);

    // Resolve highest-allowed tier server-side
    let granted: Tier = "free";

    // Check JWT (founder bypass / user payments lookup)
    let userId: string | null = null;
    let isFounder = false;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.replace("Bearer ", "");
      const u = createClient(SUPABASE_URL, ANON_KEY);
      const { data } = await u.auth.getClaims(token);
      userId = data?.claims?.sub ?? null;
      if (userId) {
        const { data: role } = await admin
          .from("user_roles").select("role").eq("user_id", userId).eq("role", "founder").maybeSingle();
        isFounder = !!role;
      }
    }

    if (tier === "cristal") {
      if (!isFounder) return json({ error: "cristal requires founder role" }, 403);
      granted = "cristal";
    } else if (tier === "standard" || tier === "gold") {
      if (isFounder) {
        granted = tier;
      } else {
        // Validate against a paid payment
        const wantedKind = tier === "gold" ? "tier_gold" : "tier_standard";
        let q = admin.from("payments").select("id,kind,status,track_id,user_id,m_payment_id")
          .eq("track_id", track_id).eq("status", "paid").eq("kind", wantedKind);
        if (ref) q = q.eq("m_payment_id", ref);
        else if (userId) q = q.eq("user_id", userId);
        else return json({ error: "ref or auth required for paid tier" }, 401);
        const { data: pmt } = await q.maybeSingle();
        if (!pmt) return json({ error: "no paid entitlement" }, 403);
        granted = tier;
      }
    } else {
      granted = "free";
    }

    const pct =
      granted === "cristal" ? 1 :
      granted === "gold" ? Number(track.pct_gold) :
      granted === "standard" ? Number(track.pct_standard) :
      Number(track.pct_free);

    const token = await mintStreamToken({
      objectKey: track.r2_object_key,
      pct,
      ttlSeconds: 300,
    });

    const signedUrl = `${R2_BASE}/${track.r2_object_key}?t=${encodeURIComponent(token)}`;

    if (asJson) return json({ url: signedUrl, granted, pct, expires_in: 300 });
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders(), Location: signedUrl },
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
