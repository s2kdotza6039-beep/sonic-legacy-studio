# PayFast + R2 Music Tier — Setup Guide

## 1. PayFast configuration

In your PayFast dashboard (Settings → Integration):

- **Notify URL**: `https://dvmftknddmssmpyhnjob.supabase.co/functions/v1/payfast-notify`
- **Return URL**: `https://s2kdotza.com/listen?pf=return`
- **Cancel URL**: `https://s2kdotza.com/listen?pf=cancel`
- Set a passphrase and copy it into the `PAYFAST_PASSPHRASE` secret.
- `PAYFAST_MODE` = `sandbox` while testing, `live` when ready.

The Notify URL is the only one PayFast actually calls server-to-server; the
return/cancel URLs are filled in dynamically per-checkout anyway.

## 2. Cloudflare R2 hardening (recommended)

Right now `https://newsingle.s2kdotza.com/*.mp3` is publicly downloadable, which
means the tier system is enforced **client-side only**. To enforce server-side:

1. Make the R2 bucket private (remove the public custom-domain binding, or set
   the binding behind a Worker route).
2. Deploy a Worker at `newsingle.s2kdotza.com/*` that:
   - Requires a signed `?token=` query param.
   - Verifies the HMAC against an `R2_SIGNING_SECRET` shared with the
     `stream-track` / `download-track` Supabase edge functions.
   - Streams the R2 object through `env.BUCKET.get(key)`.

Worker skeleton:

```js
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const exp = Number(url.searchParams.get("exp") ?? 0);
    const key = decodeURIComponent(url.pathname.slice(1));
    if (!token || !exp || Date.now() / 1000 > exp) return new Response("expired", { status: 410 });
    const expected = await hmacHex(env.R2_SIGNING_SECRET, `${key}|${exp}`);
    if (expected !== token) return new Response("bad token", { status: 403 });
    const obj = await env.BUCKET.get(key);
    if (!obj) return new Response("not found", { status: 404 });
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata.contentType ?? "audio/mpeg",
        "Cache-Control": "private, max-age=60",
      },
    });
  },
};
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

Then add an `R2_SIGNING_SECRET` Supabase secret and update `download-track`
(and a new `stream-track`) to mint signed URLs instead of redirecting to the
raw public URL.

## 3. Local testing

Use a PayFast sandbox account and run a `R5` test purchase. PayFast's sandbox
will hit your Notify URL exactly like production.
