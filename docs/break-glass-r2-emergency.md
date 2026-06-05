# Break-Glass: R2 Direct Emergency Hostname

**Hostname:** `r2-direct-emergency.s2kdotza.com`
**Purpose:** Restore playback/download if the signed-URL Worker on
`newsingle.s2kdotza.com` is misbehaving (bad deploy, secret mismatch,
Cloudflare incident). Bypasses HMAC token verification and serves R2
objects directly.
**Lifetime:** Maximum **7 days** from activation. Auto-expires.
**Authorization:** Founder only. Open a `worker_break_glass` incident in
the CEO Diary before cutover, link this runbook, and record start/end
timestamps.

> Activating break-glass means audio is publicly fetchable by URL during
> that window. There is **no token gating, no percent caps, no replay
> protection** on the emergency hostname. Treat every minute as billable
> risk and unbind as soon as the Worker is healthy.

---

## 0. Pre-flight checks (≤ 5 min)

Run before doing anything destructive.

- [ ] Confirm the outage is actually the Worker, not Supabase / R2.
      Quick test: `curl -I https://newsingle.s2kdotza.com/<known-key>?t=<valid token>`
      Anything other than `200/206` or `401 expired/bad signature` is
      probably Worker-side.
- [ ] Pull `wrangler tail s2k-stream-gate --format pretty` for 30 s and
      grep for `bad signature` / runtime errors.
- [ ] Confirm `R2_SIGNING_SECRET` in Supabase and Worker still match
      (compare last-rotated timestamp; do not print values).
- [ ] Open Cloudflare → R2 → bucket `newsingle-s2kdotza` and verify
      objects still list.
- [ ] Open the **Worker Test** tab in the Founder Dashboard and try a
      fresh `Mint signed URL` + `Probe worker`. Capture status + body.

If all four point at the Worker, proceed.

---

## 1. Cutover — bring up `r2-direct-emergency.s2kdotza.com` (≤ 10 min)

Run from a workstation with `wrangler` ≥ 3 and a Cloudflare API token
scoped to Workers + DNS for `s2kdotza.com`.

1. **Create DNS record (orange-cloud / proxied)**
   Cloudflare dashboard → DNS → `s2kdotza.com` →
   `Add record`:
   - Type: `CNAME`
   - Name: `r2-direct-emergency`
   - Target: `public.r2.dev` *(or your bucket's R2-managed public hostname — see
     Cloudflare → R2 → bucket → Settings → Public Access)*
   - Proxy: **Proxied (orange cloud)**
   - TTL: Auto
2. **Enable R2 public access** on `newsingle-s2kdotza` if not already
   enabled, and bind `r2-direct-emergency.s2kdotza.com` as a custom
   domain on the bucket (R2 → bucket → Settings → Custom Domains).
3. **Wait for SSL** — Cloudflare provisions a cert in 1–3 min. Verify:
   `curl -I https://r2-direct-emergency.s2kdotza.com/<key>` returns
   `200`, `Content-Type: audio/mpeg`.
4. **Flip `R2_PUBLIC_BASE`** in Supabase secrets to
   `https://r2-direct-emergency.s2kdotza.com`. (Dashboard → Backend →
   Edge Function Secrets.)
5. **Redeploy affected edge functions** so they pick up the new env:
   ```bash
   supabase functions deploy stream-track download-track
   ```
6. **Set the calendar reminder.** Add a CEO Diary task
   `Unbind r2-direct-emergency (auto-expires <date+7d>)` due in 6 days.

### Validation checklist (must all pass before declaring restored)

- [ ] `/listen` page plays both active tracks in an incognito window.
- [ ] Founder Dashboard → **Worker Test** → mint URL → "Open in new
      tab" plays a download.
- [ ] No new `worker_denied_*` events in `playback_events` for 5 min.
- [ ] Status page / Slack: post "playback restored via break-glass,
      Worker repair in progress".

---

## 2. Repair the Worker (in parallel)

While break-glass is live, fix the real issue. Common causes & checks:

| Symptom | Likely cause | Action |
|---|---|---|
| `401 bad signature` for fresh tokens | Secret drift | Re-run `wrangler secret put R2_SIGNING_SECRET` with the value from Supabase secrets |
| `403 path mismatch` for all tracks | Token `p` not decoded / new encoding in DB | Confirm `_shared/streamSign.ts` calls `normalizeObjectKey` and stream-track is redeployed |
| `404 not found` | Wrong R2 bucket binding | Check `wrangler.toml` `bucket_name` |
| All 5xx | Bad Worker deploy | `wrangler deployments list` → `wrangler rollback <id>` |

After fixing, validate on `newsingle.s2kdotza.com` with a fresh signed
URL from the Worker Test tab. Do **not** unbind break-glass until you
see `worker_granted` events flowing again.

---

## 3. Rollback — tear down break-glass (≤ 10 min)

When the Worker is healthy:

1. **Flip `R2_PUBLIC_BASE` back** to
   `https://newsingle.s2kdotza.com` in Supabase secrets.
2. **Redeploy** `stream-track` and `download-track`.
3. **Smoke test**: open `/listen` incognito; mint + probe in Worker
   Test tab; confirm `worker_granted` event appears within 30 s.
4. **Unbind the custom domain** on R2 bucket
   `newsingle-s2kdotza` → remove `r2-direct-emergency.s2kdotza.com`.
5. **Delete the DNS record** `r2-direct-emergency` in Cloudflare DNS.
6. **Disable R2 public access** on the bucket if it was off prior to
   cutover.
7. **Verify lockdown**:
   `curl -I https://r2-direct-emergency.s2kdotza.com/<key>` must return
   DNS failure or `530`. If it still serves, do not close the incident.
8. **Close the CEO Diary incident** with: start time, end time, root
   cause, who approved cutover, validation evidence.

---

## 4. Hard expiry (7 day cap)

If the break-glass hostname is still live at **T+6 days**, an automated
reminder fires. At **T+7 days**, the on-call founder MUST either:

- Complete §3 rollback, OR
- Document a written extension in the CEO Diary incident with a new
  hard expiry no more than 7 days out. No silent extensions.

Quarterly review: confirm `r2-direct-emergency.s2kdotza.com` resolves to
nothing outside an active incident.
