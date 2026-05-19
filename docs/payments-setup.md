# Payments + Stream Setup

## Required secrets

| Secret | Purpose |
|---|---|
| `PAYFAST_MERCHANT_ID` | PayFast dashboard → Settings → Integration |
| `PAYFAST_MERCHANT_KEY` | PayFast dashboard → Settings → Integration |
| `PAYFAST_PASSPHRASE` | PayFast dashboard → Settings → Integration (recommended) |
| `PAYFAST_MODE` | `sandbox` or `live` |
| `APP_PUBLIC_URL` | e.g. `https://s2kdotza.com` (used for return/cancel URLs) |
| `R2_PUBLIC_BASE` | e.g. `https://newsingle.s2kdotza.com` |
| `R2_SIGNING_SECRET` | Long random string shared with the Cloudflare Worker |

## PayFast dashboard

1. Set the **Notify URL** to:
   `https://<your-project>.functions.supabase.co/payfast-notify`
   (this function is public — `verify_jwt = false`).
2. Whitelist this URL in the PayFast ITN settings.
3. Use a passphrase in both the PayFast settings and the `PAYFAST_PASSPHRASE` secret.

## Audit trail

Every inbound PayFast notify call is written to `payfast_notify_log` (signature OK, amount OK, idempotency skip, raw payload, source IP). View it under **Dashboard → PayFast Log** (founder only).

## Sandbox test page

Founders can exercise the full PayFast → notify → unlock loop end-to-end at `/sandbox/payments`.

## Cloudflare Worker — sign-token + range gating

Deploy this Worker on `newsingle.s2kdotza.com` (the route that fronts your R2 bucket). It:

- Requires a `?t=<payload>.<sig>` query parameter on every request.
- Verifies HMAC-SHA256 against `R2_SIGNING_SECRET`.
- Enforces expiry (`e`) and the URL path (`p`) the token was minted for.
- Limits how many bytes the client can receive to `floor(content_length * pct)`.

### `wrangler.toml`

```toml
name = "s2k-stream-gate"
main = "src/worker.ts"
compatibility_date = "2024-09-01"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "newsingle-s2kdotza"
```

Then `wrangler secret put R2_SIGNING_SECRET` (use the exact same value as the Supabase secret).

### `src/worker.ts`

```ts
interface Env { BUCKET: R2Bucket; R2_SIGNING_SECRET: string; }

const b64urlDecode = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};

const verify = async (payloadB64: string, sigB64: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, b64urlDecode(sigB64), new TextEncoder().encode(payloadB64));
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const t = url.searchParams.get("t");
    if (!key || !t) return new Response("missing token", { status: 401 });

    const [payloadB64, sigB64] = t.split(".");
    if (!payloadB64 || !sigB64) return new Response("bad token", { status: 401 });

    const ok = await verify(payloadB64, sigB64, env.R2_SIGNING_SECRET);
    if (!ok) return new Response("bad signature", { status: 401 });

    let p: { p: string; e: number; pct: number };
    try { p = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))); }
    catch { return new Response("bad payload", { status: 401 }); }

    if (p.e < Date.now()) return new Response("expired", { status: 401 });
    if (p.p !== key) return new Response("path mismatch", { status: 403 });

    // Read object so we can compute the allowed byte cap.
    const head = await env.BUCKET.head(key);
    if (!head) return new Response("not found", { status: 404 });
    const total = head.size;
    const maxBytes = Math.max(1, Math.floor(total * Math.min(1, Math.max(0, p.pct))));

    // Parse incoming Range, clamp to maxBytes.
    const rangeHeader = req.headers.get("Range");
    let start = 0, end = maxBytes - 1;
    if (rangeHeader) {
      const m = /bytes=(\d+)-(\d+)?/.exec(rangeHeader);
      if (m) {
        start = parseInt(m[1], 10);
        end = m[2] ? Math.min(parseInt(m[2], 10), maxBytes - 1) : maxBytes - 1;
      }
    }
    if (start >= maxBytes) return new Response("forbidden range", { status: 416 });

    const obj = await env.BUCKET.get(key, {
      range: { offset: start, length: end - start + 1 },
    });
    if (!obj) return new Response("not found", { status: 404 });

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, no-store");
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(obj.body, { status: rangeHeader ? 206 : 200, headers });
  },
};
```

## How the pieces fit together

1. Frontend calls `stream-track` edge function with `track_id`, `tier`, and either a paid-`m_payment_id` (`?ref=`) or a logged-in JWT.
2. Edge function checks entitlement against `payments` / `user_roles`, then mints a short HMAC token bound to the R2 object key and the allowed percentage.
3. The signed URL is returned to the client; the `<audio>` element fetches it from `newsingle.s2kdotza.com`.
4. The Worker validates the token and caps the response bytes to the tier's percentage — even if the user scrubs ahead.
