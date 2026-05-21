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

export const tierPercentage = (track: Track, tier: Tier) => {
  if (tier === "cristal") return 1;
  if (tier === "gold") return Number(track.pct_gold);
  if (tier === "standard") return Number(track.pct_standard);
  return Number(track.pct_free);
};

export const tierRank: Record<Tier, number> = { free: 0, standard: 1, gold: 2, cristal: 3 };

const ACCESS_KEY = "s2k.tierAccess.v1";
const REF_KEY = "s2k.tierRefs.v1";
type AccessMap = Record<string, Tier>;
type RefMap = Record<string, string>;

export const loadAccess = (): AccessMap => {
  try { return JSON.parse(localStorage.getItem(ACCESS_KEY) ?? "{}"); } catch { return {}; }
};
export const loadRefs = (): RefMap => {
  try { return JSON.parse(localStorage.getItem(REF_KEY) ?? "{}"); } catch { return {}; }
};

export const grantAccess = (trackId: string, tier: Tier, ref?: string | null) => {
  const cur = loadAccess();
  if (!cur[trackId] || tierRank[tier] > tierRank[cur[trackId]]) {
    cur[trackId] = tier;
    localStorage.setItem(ACCESS_KEY, JSON.stringify(cur));
  }
  if (ref) {
    const refs = loadRefs();
    refs[trackId] = ref;
    localStorage.setItem(REF_KEY, JSON.stringify(refs));
  }
};

export const clearAccess = () => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REF_KEY);
};

/** Ask the backend for a signed Cloudflare URL for the given tier. */
export async function signedStreamUrl(
  track: Track, tier: Tier, opts?: { ref?: string | null; jwt?: string | null },
): Promise<{ url: string; granted: Tier; pct: number }> {
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-track`;
  const qs = new URLSearchParams({ track_id: track.id, tier, json: "1" });
  if (opts?.ref) qs.set("ref", opts.ref);
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  };
  if (opts?.jwt) headers.Authorization = `Bearer ${opts.jwt}`;
  const res = await fetch(`${base}?${qs}`, { headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`stream-track ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function startPayFast(args: {
  track_id: string;
  kind: "tier_standard" | "tier_gold" | "download";
  email?: string;
}): Promise<{ checkout_url: string; fields: Record<string, string>; m_payment_id: string }> {
  const { data, error } = await supabase.functions.invoke("payfast-create", { body: args });
  if (error) throw error;
  return data;
}

export function submitPayFast(
  checkoutUrl: string,
  fields: Record<string, string>,
  opts?: { target?: string },
) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkoutUrl;
  if (opts?.target) form.target = opts.target;
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
    amount_cents: number;
    paid_at: string | null;
    pf_payment_id: string | null;
    download_token: string | null;
    download_expires_at: string | null;
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

/* ------------------------------------------------------------------ *
 * Pure playback-cap helpers (kept here so they're unit-testable
 * independently of the React audio component).
 * ------------------------------------------------------------------ */

export interface CapState {
  /** Where the player should jump to. */
  currentTime: number;
  /** Whether playback should be paused. */
  paused: boolean;
  /** Whether the upgrade prompt should be raised. */
  promptUpgrade: boolean;
  /** Whether the helper modified anything. */
  clamped: boolean;
}

/**
 * Enforce the playback cap on a current-time reading. Used by every
 * source that can advance the playhead: `timeupdate`, `seeking`,
 * `seeked`, `ratechange`, and the 250 ms mobile watchdog.
 */
export function enforceCap(args: {
  currentTime: number;
  allowedSec: number;
  capped: boolean;
  wasPlaying: boolean;
  /** Safety margin so the next tick can't immediately re-trigger. */
  margin?: number;
}): CapState {
  const margin = args.margin ?? 0.25;
  if (!args.capped || args.allowedSec <= 0 || args.currentTime <= args.allowedSec) {
    return { currentTime: args.currentTime, paused: !args.wasPlaying, promptUpgrade: false, clamped: false };
  }
  return {
    currentTime: Math.max(0, args.allowedSec - margin),
    paused: true,
    promptUpgrade: true,
    clamped: true,
  };
}

/**
 * Clamp a user-requested seek target (mouse scrub, keyboard arrow,
 * or programmatic `MediaSession.seekto`) to the tier's allowed range.
 */
export function clampSeekTarget(args: {
  target: number;
  duration: number;
  allowedSec: number;
  capped: boolean;
  margin?: number;
}): { currentTime: number; promptUpgrade: boolean } {
  const margin = args.margin ?? 0.25;
  const bounded = Math.max(0, Math.min(args.duration, args.target));
  if (args.capped && bounded > args.allowedSec) {
    return { currentTime: Math.max(0, args.allowedSec - margin), promptUpgrade: true };
  }
  return { currentTime: bounded, promptUpgrade: false };
}

/**
 * Decide where to resume from on (re)mount. Used after a tier upgrade
 * and on initial load. Never resumes past the cap.
 */
export function resolveResumePosition(args: {
  saved: number | undefined;
  duration: number;
  allowedSec: number;
  capped: boolean;
}): number {
  if (!args.saved || !isFinite(args.saved) || args.saved <= 0) return 0;
  if (args.saved >= args.duration) return 0;
  if (args.capped && args.saved >= args.allowedSec) return Math.max(0, args.allowedSec - 0.25);
  return args.saved;
}
