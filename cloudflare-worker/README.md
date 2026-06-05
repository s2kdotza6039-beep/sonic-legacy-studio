# Cloudflare Worker — Deploy Phase 2

## One-time setup

From your workstation, in this directory:

```bash
cd cloudflare-worker

# 1. Auth (browser flow, opens Cloudflare login)
npx wrangler login

# 2. Create the replay KV namespace and paste the printed id into wrangler.toml
npx wrangler kv namespace create REPLAY
# → edit wrangler.toml [[kv_namespaces]] id = "..."

# 3. Push secrets (Worker side — independent of Supabase secrets storage)
#    Use the SAME R2_SIGNING_SECRET value as the Supabase secret.
npx wrangler secret put R2_SIGNING_SECRET
npx wrangler secret put SUPABASE_LOG_URL
#    Value for SUPABASE_LOG_URL:
#    https://dvmftknddmssmpyhnjob.functions.supabase.co/log-worker-playback

# 4. Deploy and bind route
npx wrangler deploy
# Cloudflare → Workers → s2k-stream-gate → Triggers → add route:
#   newsingle.s2kdotza.com/*  →  s2k-stream-gate
```

## Re-deploy after code changes

```bash
npx wrangler deploy
```

## Tail logs while debugging

```bash
npx wrangler tail s2k-stream-gate --format pretty
```

## Verifying end-to-end

1. Open Founder Dashboard → **Worker Test** tab.
2. Mint a signed URL for `Kule Life`, tier `free`. Press **Probe worker**.
   - Expect `206` and a fresh `worker_granted` row in `playback_events`
     (visible in the recent events table within ~2 s of the probe).
3. Run **Automated checks**. All three should turn green:
   - Expired → `401 expired` → `worker_denied_expired`
   - Bad signature → `401 bad signature` → `worker_denied_signature`
   - Path mismatch → `403 path mismatch` → `worker_denied_path`
4. Press **Mint signed URL** again, **Probe worker** twice:
   - First probe → `worker_granted`
   - Second probe → `401 token already used` → `worker_denied_replay`

If step 4 fails (second probe succeeds), the KV binding is missing —
revisit step 2 of setup.

## Rollback

See `docs/break-glass-r2-emergency.md` §1 cutover for the emergency
hostname, and §3 for re-locking once the Worker is healthy.
