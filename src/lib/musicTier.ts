import { supabase } from "@/integrations/supabase/client";

export type Tier = "free" | "standard" | "gold" | "cristal";

export interface Track {
  id: string;
  slug: string;
  title: string;
  artist_name: string;
  artist_slug: string | null;
  r2_object_key: string;
  cover_url: string | null;
  duration_seconds: number | null;
  price_standard_cents: number;
  price_gold_cents: number;
  price_download_cents: number;
  pct_free: number;
  pct_standard: number;
  pct_gold: number;
  is_active: boolean;
  sort_order: number;
}

const R2_BASE =
  (import.meta.env.VITE_R2_PUBLIC_BASE as string | undefined)?.replace(/\/$/, "") ??
  "https://newsingle.s2kdotza.com";

export const trackStreamUrl = (t: Track) => `${R2_BASE}/${t.r2_object_key}`;

export const tierPercentage = (track: Track, tier: Tier) => {
  if (tier === "cristal") return 1;
  if (tier === "gold") return track.pct_gold;
  if (tier === "standard") return track.pct_standard;
  return track.pct_free;
};

export const tierRank: Record<Tier, number> = { free: 0, standard: 1, gold: 2, cristal: 3 };

const ACCESS_KEY = "s2k.tierAccess.v1";
type AccessMap = Record<string, Tier>; // track_id -> highest tier

export const loadAccess = (): AccessMap => {
  try { return JSON.parse(localStorage.getItem(ACCESS_KEY) ?? "{}"); } catch { return {}; }
};

export const grantAccess = (trackId: string, tier: Tier) => {
  const cur = loadAccess();
  if (!cur[trackId] || tierRank[tier] > tierRank[cur[trackId]]) {
    cur[trackId] = tier;
    localStorage.setItem(ACCESS_KEY, JSON.stringify(cur));
  }
};

export async function startPayFast(args: {
  track_id: string;
  kind: "tier_standard" | "tier_gold" | "download";
  email?: string;
}): Promise<{ checkout_url: string; fields: Record<string, string>; m_payment_id: string }> {
  const { data, error } = await supabase.functions.invoke("payfast-create", { body: args });
  if (error) throw error;
  return data;
}

/** Submit a hidden form to PayFast with the signed fields. */
export function submitPayFast(checkoutUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkoutUrl;
  form.style.display = "none";
  for (const [k, v] of Object.entries(fields)) {
    const i = document.createElement("input");
    i.type = "hidden"; i.name = k; i.value = v;
    form.appendChild(i);
  }
  document.body.appendChild(form);
  form.submit();
}

export async function pollPaymentStatus(ref: string) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-status?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json() as Promise<{
    status: "pending" | "paid" | "failed" | "cancelled";
    kind: "tier_standard" | "tier_gold" | "download";
    track_id: string;
    download_token: string | null;
  }>;
}

export const downloadUrl = (token: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-track?token=${encodeURIComponent(token)}`;

export const formatZAR = (cents: number) =>
  `R${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

export const kindToTier = (kind: string): Tier | null =>
  kind === "tier_standard" ? "standard"
  : kind === "tier_gold" ? "gold"
  : null;
