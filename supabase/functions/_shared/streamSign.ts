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

export async function mintStreamToken(args: {
  objectKey: string;
  pct: number;
  ttlSeconds?: number;
}): Promise<string> {
  const payload = {
    p: args.objectKey,
    e: Date.now() + (args.ttlSeconds ?? 300) * 1000,
    pct: Math.min(1, Math.max(0, args.pct)),
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = await hmac(payloadB64);
  return `${payloadB64}.${sig}`;
}
