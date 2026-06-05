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
export function normalizeObjectKey(raw: string): string {
  if (!raw) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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
}): Promise<string> {
  const decoded = normalizeObjectKey(args.objectKey);
  const payload = {
    p: decoded,
    e: Date.now() + (args.ttlSeconds ?? 300) * 1000,
    pct: Math.min(1, Math.max(0, args.pct)),
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = await hmac(payloadB64);
  return `${payloadB64}.${sig}`;
}
