## AI Music Tier Access System

A tier-gated playback + paid download system for the Listen page, powered by PayFast and Cloudflare R2 signed URLs. No cart — one-tap tier selection, automatic unlock after payment.

---

### 1. Tier model

Four tiers, applied per-track per-session:

| Tier | Price | Playback | Auth |
|------|-------|----------|------|
| Free | R0 | 25% of duration | none |
| Standard | R3.50 | 55% | PayFast |
| Gold | R5.00 | 100% | PayFast |
| Cristal | R0 | 100% | Founder role only |

Download Now: **R10** per track via PayFast → time-limited signed R2 URL → auto-download.

---

### 2. UX flow (Listen page)

```
[ Track card ]
   LISTEN NOW  →  shows 4 tier chips (Free / Standard / Gold / Cristal)
                  ├─ Free      → plays instantly, auto-pause at 25%, upgrade popup
                  ├─ Standard  → PayFast checkout → unlock 55%
                  ├─ Gold      → PayFast checkout → unlock 100%
                  └─ Cristal   → only visible if founder, unlocks 100%
   DOWNLOAD NOW — R10  →  PayFast → signed download link auto-starts
```

- Tier chips: rounded, gradient-accented, hover lift, mobile-first.
- Playback enforcement client-side via `timeupdate` listener + auto-pause at `duration * tierPct`.
- Upgrade modal on limit reached, offering Standard / Gold.
- Unlocked tiers persisted per track in `localStorage` AND verified server-side against `payments` table.

---

### 3. Backend (Lovable Cloud)

**New tables**
- `payments` — id, user_id (nullable for guest), email, track_id, kind (`tier_standard` | `tier_gold` | `download`), amount, status (`pending|paid|failed`), pf_payment_id, m_payment_id (our ref), signature_verified, created_at, paid_at.
- `download_tokens` — id, payment_id, token (random), track_id, expires_at, used_at.
- `track_access` — derived view / table linking email+track → highest tier paid (for cross-device unlock by email).

RLS: founders manage all; users read their own by email match; service role writes from edge functions.

**Edge functions**
- `payfast-create` — builds signed PayFast checkout payload (merchant_id, merchant_key, amount, item_name, m_payment_id, return/cancel/notify URLs, MD5 signature with passphrase). Inserts `pending` payment row. Returns redirect URL.
- `payfast-notify` (ITN webhook, no JWT) — validates: signature, source IP against PayFast IP ranges, server-to-server postback to `https://www.payfast.co.za/eng/query/validate`, amount match. Marks payment `paid`. For downloads, mints a `download_tokens` row.
- `payfast-return` — thin redirect back into app with `?m_payment_id=…`.
- `payfast-cancel` — redirect with cancel state.
- `stream-track` — returns short-lived signed R2 URL for the audio (HMAC-signed query param verified by a Cloudflare Worker on `newsingle.s2kdotza.com`, OR Supabase-signed redirect). Validates the requesting session's tier entitlement.
- `download-track` — exchanges a one-time token for a signed R2 URL, marks token used.

**Secrets to add** (will request via add_secret after approval):
- `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_MODE` (`sandbox|live`)
- `R2_SIGNING_SECRET` (HMAC key shared with the Cloudflare Worker that fronts R2)

---

### 4. Audio security

- Audio `<audio src>` is set to `stream-track` edge function output, which 302-redirects to a signed R2 URL valid ~2 minutes.
- Worker on `newsingle.s2kdotza.com` rejects unsigned requests, blocks directory listing, and enforces token expiry.
- Downloads use a single-use token, expires in 10 minutes.
- No permanent public URLs exposed in the client bundle.

> Note: the Cloudflare Worker + R2 bucket policy itself must be configured by you in Cloudflare — I'll provide the Worker script and exact env vars. Lovable can't deploy to your Cloudflare account.

---

### 5. Admin (Founder dashboard)

New dashboard module `MusicAdmin`:
- Upload track metadata (title, artist, R2 object key, cover).
- Override per-track pricing and playback percentages.
- Sales table (payments, filter by status / kind / date).
- Download log.
- Toggle Cristal access for specific founder accounts.

Founder-only via existing `FounderRoute` + `has_role`.

---

### 6. Future-ready structure

- `payments.kind` enum extensible to `subscription_monthly`, etc.
- Separate `entitlements` resolver hook so subscriptions, artist accounts, and AI recommendations can plug in.
- All playback events emitted to a `playback_events` table later for analytics + royalty tracking.

---

### 7. Build order

1. DB migration: `payments`, `download_tokens`, `track_access`, RLS, indexes.
2. Add secrets (PayFast + R2 signing).
3. Edge functions: `payfast-create`, `payfast-notify`, `payfast-return`, `payfast-cancel`, `stream-track`, `download-track`.
4. Listen page rebuild: tier chip UI, playback enforcement, upgrade modal, download button, payment-return handler.
5. Founder dashboard `MusicAdmin` module.
6. Provide Cloudflare Worker script + setup instructions for R2 signing.
7. Sandbox end-to-end test with PayFast sandbox credentials.

---

### Open questions before I start

1. **PayFast account**: do you have a PayFast merchant account ready (sandbox + live), and the passphrase set in the PayFast dashboard? If not, I'll wire it for sandbox first.
2. **Cloudflare Worker**: are you OK deploying a small Worker on `newsingle.s2kdotza.com` that I provide? Without it, R2 objects either stay fully public (insecure) or have to be proxied through an edge function (slower, costs Supabase egress).
3. **Guest checkout**: should non-logged-in visitors be able to pay (email captured at checkout), or do you want to require sign-up before Standard/Gold/Download?
4. **Cristal**: lock to existing `founder` role, or add a new `cristal` role in `user_roles`?
