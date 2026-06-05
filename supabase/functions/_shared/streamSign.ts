// Shared HMAC signing for R2 stream tokens.
// Token format: base64url(payload).base64url(sig)
// Payload: { p: object_key, e: expiry_ms, pct: 0..1 }

const SECRET = Deno.env.get("R2_SIGNING_SECRET") ?? "";

const enc = new TextEncoder();

function b64url(bytes: Uint8Array | string): string {
  const buf = typeof bytes === "string" ? enc.encode(bytes) : bytes;
  let s = btoa(String.fromCharCode(...buf));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(payloadB64: string): Promise<string> {
  if (!SECRET) throw new Error("R2_SIGNING_SECRET not set");
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return b64url(new Uint8Array(sig));
}

// Decode a stored R2 key to the form the Worker compares against.
// The Worker does decodeURIComponent(url.pathname) before checking payload.p,
// so we must sign the DECODED key — never the raw stored value that may
// contain %20 / other percent-encoding from historical uploads.
//
// IMPORTANT: this MUST match the bytes the R2 object is actually stored
// under. Do NOT trim whitespace here — if an object is genuinely keyed
// with a trailing space in R2, the Worker's `url.pathname` will contain
// that space and the signature must agree. Use canonicalObjectKey() for
// display/comparison instead.
export function normalizeObjectKey(raw: string): string {
  if (!raw) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// Canonical form for cross-track comparison, dedup, scorecards, exports.
// Strips trailing whitespace and collapses internal runs of whitespace to
// a single space — used by the Worker Test diff view and any analytics
// that need to treat "TITLE .mp3" and "TITLE.mp3" as the same logical
// asset. NEVER pass the output of this function to mintStreamToken.
export function canonicalObjectKey(raw: string): string {
  const decoded = normalizeObjectKey(raw);
  return decoded.replace(/\s+/g, " ").replace(/\s+(\.\w+)?$/g, "$1").trim();
}

// True when the stored key has a trailing-space anomaly that should be
// surfaced for cleanup (rename R2 object + update DB row).
export function hasTrailingSpaceAnomaly(raw: string): boolean {
  const decoded = normalizeObjectKey(raw);
  return /\s\.[A-Za-z0-9]+$/.test(decoded) || /\s$/.test(decoded);
}

// Re-encode a decoded key for use in a URL pathname. Preserves '/' so
// nested keys still address the right object, but escapes spaces, etc.
export function encodeObjectKeyForUrl(decodedKey: string): string {
  return decodedKey
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

export async function mintStreamToken(args: {
  objectKey: string;
  pct: number;
  ttlSeconds?: number;
  // Negative ttl is intentional in test=expired flows.
  allowExpired?: boolean;
  // Override the payload p (test=path_mismatch).
  overridePath?: string;
}): Promise<string> {
  const decoded = args.overridePath ?? normalizeObjectKey(args.objectKey);
  const ttl = args.ttlSeconds ?? 300;
  const payload = {
    p: decoded,
    e: Date.now() + ttl * 1000,
    pct: Math.min(1, Math.max(0, args.pct)),
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = await hmac(payloadB64);
  return `${payloadB64}.${sig}`;
}

// Used by the Worker → Supabase logging endpoint. Worker HMACs the JSON
// body with R2_SIGNING_SECRET; the edge function verifies before insert.
export async function signLogBody(bodyJson: string): Promise<string> {
  return hmac(bodyJson);
}

export async function verifyLogBody(bodyJson: string, sigB64: string): Promise<boolean> {
  if (!SECRET) return false;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  // sigB64 may arrive as base64url or base64; normalize.
  let s = sigB64.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, bytes, enc.encode(bodyJson));
}

