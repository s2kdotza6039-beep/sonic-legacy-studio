// S2K Stream Gate — Cloudflare Worker
//
// Routes: bound to newsingle.s2kdotza.com/*
// Responsibilities:
//   1. Verify HMAC-SHA256 token (?t=payloadB64.sigB64) against R2_SIGNING_SECRET.
//   2. Enforce expiry (e), path binding (p), and percent cap (pct).
//   3. Range-gate the response so a client cannot scrub past pct*content_length.
//   4. Replay-protect each token via KV (per-token first-use wins, TTL = REPLAY_TTL_SECONDS).
//   5. Cheap per-IP rate limit (per-minute bucket in KV).
//   6. Fire-and-forget audit log to Supabase (HMAC-signed body).
//
// Failure modes are mapped to playback_events kinds:
//   worker_granted, worker_denied_signature, worker_denied_expired,
//   worker_denied_path, worker_denied_range, worker_denied_replay,
//   worker_denied_rate_limit
//
// Deploy:
//   wrangler kv namespace create REPLAY    # paste id into wrangler.toml
//   wrangler secret put R2_SIGNING_SECRET  # paste value from Supabase secrets
//   wrangler secret put SUPABASE_LOG_URL   # https://<ref>.functions.supabase.co/log-worker-playback
//   wrangler deploy

interface Env {
  BUCKET: R2Bucket;
  REPLAY: KVNamespace;
  R2_SIGNING_SECRET: string;
  SUPABASE_LOG_URL: string;
  REPLAY_TTL_SECONDS: string;
  RATE_LIMIT_PER_MIN: string;
}

const b64urlDecode = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

async function verifySig(payloadB64: string, sigB64: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, b64urlDecode(sigB64), new TextEncoder().encode(payloadB64));
}

async function hmacBody(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return b64url(new Uint8Array(sig));
}

async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return b64url(new Uint8Array(h));
}

type LogKind =
  | "worker_granted"
  | "worker_denied_signature"
  | "worker_denied_expired"
  | "worker_denied_path"
  | "worker_denied_range"
  | "worker_denied_replay"
  | "worker_denied_rate_limit";

async function logEvent(env: Env, req: Request, kind: LogKind, metadata: Record<string, unknown>, trackHint?: string) {
  if (!env.SUPABASE_LOG_URL) return;
  const body = JSON.stringify({
    event_kind: kind,
    track_id: null, // resolved server-side if needed
    tier: null,
    user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
    metadata: {
      ...metadata,
      path: trackHint ?? null,
      ip: req.headers.get("cf-connecting-ip") ?? null,
      ray: req.headers.get("cf-ray") ?? null,
    },
  });
  try {
    const sig = await hmacBody(body, env.R2_SIGNING_SECRET);
    await fetch(env.SUPABASE_LOG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-worker-sig": sig },
      body,
    });
  } catch {
    // Best effort — never let logging failures break playback.
  }
}

async function handleAdminRename(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const sig = req.headers.get("x-admin-sig") ?? "";
  if (!sig) return new Response("missing sig", { status: 401 });
  const raw = await req.text();
  const expected = await hmacBody(raw, env.R2_SIGNING_SECRET);
  if (expected !== sig) return new Response("bad sig", { status: 401 });
  let body: { from?: string; to?: string; dry_run?: boolean };
  try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  const from = (body.from ?? "").trim();
  const to = (body.to ?? "").trim();
  const dryRun = body.dry_run === true;
  if (!from || !to || from === to) return new Response("from/to required", { status: 400 });

  if (dryRun) {
    const srcHead = await env.BUCKET.head(from);
    const dstHead = await env.BUCKET.head(to);
    return new Response(JSON.stringify({
      ok: true,
      dry_run: true,
      from,
      to,
      source_exists: !!srcHead,
      source_bytes: srcHead?.size ?? null,
      destination_exists: !!dstHead,
      destination_bytes: dstHead?.size ?? null,
      would_succeed: !!srcHead && !dstHead,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const src = await env.BUCKET.get(from);
  if (!src) return new Response("source not found", { status: 404 });
  const existing = await env.BUCKET.head(to);
  if (existing) return new Response("destination exists", { status: 409 });
  await env.BUCKET.put(to, src.body, {
    httpMetadata: src.httpMetadata,
    customMetadata: src.customMetadata,
  });
  await env.BUCKET.delete(from);
  return new Response(JSON.stringify({ ok: true, from, to, bytes: src.size }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/__admin/rename") {
      return handleAdminRename(req, env);
    }

    const rawPath = url.pathname.replace(/^\/+/, "");
    if (!rawPath) return new Response("missing path", { status: 400 });

    let decodedPath: string;
    try { decodedPath = decodeURIComponent(rawPath); } catch { decodedPath = rawPath; }



    const t = url.searchParams.get("t");
    if (!t) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_signature", { reason: "missing_token" }, decodedPath));
      return new Response("missing token", { status: 401 });
    }

    const [payloadB64, sigB64] = t.split(".");
    if (!payloadB64 || !sigB64) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_signature", { reason: "malformed_token" }, decodedPath));
      return new Response("bad token", { status: 401 });
    }

    // Rate limit per IP (1 minute bucket).
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    const minute = Math.floor(Date.now() / 60_000);
    const rateKey = `rate:${ip}:${minute}`;
    const limit = parseInt(env.RATE_LIMIT_PER_MIN ?? "120", 10);
    const current = parseInt((await env.REPLAY.get(rateKey)) ?? "0", 10);
    if (current >= limit) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_rate_limit", { ip, limit, current }, decodedPath));
      return new Response("rate limited", { status: 429 });
    }
    ctx.waitUntil(env.REPLAY.put(rateKey, String(current + 1), { expirationTtl: 90 }));

    const ok = await verifySig(payloadB64, sigB64, env.R2_SIGNING_SECRET);
    if (!ok) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_signature", { reason: "hmac_verify_failed" }, decodedPath));
      return new Response("bad signature", { status: 401 });
    }

    let p: { p: string; e: number; pct: number };
    try { p = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))); }
    catch {
      ctx.waitUntil(logEvent(env, req, "worker_denied_signature", { reason: "bad_payload" }, decodedPath));
      return new Response("bad payload", { status: 401 });
    }

    if (p.e < Date.now()) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_expired", { exp: p.e, now: Date.now() }, decodedPath));
      return new Response("expired", { status: 401 });
    }
    if (p.p !== decodedPath) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_path", { token_path: p.p, actual_path: decodedPath }, decodedPath));
      return new Response("path mismatch", { status: 403 });
    }

    // Replay protection — first use wins per token signature.
    const replayKey = `replay:${await sha256(sigB64)}`;
    const seen = await env.REPLAY.get(replayKey);
    if (seen) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_replay", { first_seen: seen }, decodedPath));
      return new Response("token already used", { status: 401 });
    }
    const ttl = parseInt(env.REPLAY_TTL_SECONDS ?? "600", 10);
    ctx.waitUntil(env.REPLAY.put(replayKey, new Date().toISOString(), { expirationTtl: ttl }));

    const head = await env.BUCKET.head(p.p);
    if (!head) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_path", { reason: "object_not_found" }, decodedPath));
      return new Response("not found", { status: 404 });
    }
    const total = head.size;
    const maxBytes = Math.max(1, Math.floor(total * Math.min(1, Math.max(0, p.pct))));

    const rangeHeader = req.headers.get("Range");
    let start = 0, end = maxBytes - 1;
    if (rangeHeader) {
      const m = /bytes=(\d+)-(\d+)?/.exec(rangeHeader);
      if (m) {
        start = parseInt(m[1], 10);
        end = m[2] ? Math.min(parseInt(m[2], 10), maxBytes - 1) : maxBytes - 1;
      }
    }
    if (start >= maxBytes) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_range", { start, maxBytes, pct: p.pct }, decodedPath));
      return new Response("forbidden range", { status: 416 });
    }

    const obj = await env.BUCKET.get(p.p, { range: { offset: start, length: end - start + 1 } });
    if (!obj) {
      ctx.waitUntil(logEvent(env, req, "worker_denied_path", { reason: "get_failed" }, decodedPath));
      return new Response("not found", { status: 404 });
    }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, no-store");
    headers.set("Access-Control-Allow-Origin", "*");

    ctx.waitUntil(logEvent(env, req, "worker_granted", { bytes: end - start + 1, pct: p.pct, total }, decodedPath));

    return new Response(obj.body, { status: rangeHeader ? 206 : 200, headers });
  },
};
