## Music Tier System — Server Enforcement, Admin & Diagnostics

Five coordinated additions building on the existing PayFast + tier system.

---

### 1. Server-side playback enforcement (`stream-track` edge function + Worker)

**New edge function** `supabase/functions/stream-track/index.ts` (public, `verify_jwt = false`):
- Input: `?track_id=<uuid>&tier=<free|standard|gold|cristal>` plus optional `Authorization: Bearer <jwt>` (for Cristal/founder) or `?ref=<m_payment_id>` (to prove paid Standard/Gold).
- Resolves the highest tier the caller is entitled to:
  - `free` → always allowed (25%).
  - `standard`/`gold` → verified against `payments` table (status=`paid`, matching `track_id`, matching `kind`).
  - `cristal` → JWT must belong to a user with `founder` role.
- Computes `pct` from the track row.
- Builds a short-lived HMAC token: `base64url(payload).base64url(sig)` where
  `payload = {track_id, exp, pct, max_bytes?}`, signed with `R2_SIGNING_SECRET`.
- Returns `302` redirect to `https://newsingle.s2kdotza.com/<r2_object_key>?t=<token>` (or JSON `{url}` when `?json=1`).
- TTL = 5 minutes, single track scope.

**Cloudflare Worker update** (`docs/payments-setup.md`): replace template with a worker that:
- Reads `?t=` token from request.
- Splits payload/sig, verifies HMAC with `R2_SIGNING_SECRET` (Workers secret).
- Checks `exp`, checks `track_id` matches the requested object key prefix/mapping.
- If `pct < 1`, uses HTTP `Range` semantics: it fetches the R2 object, reads `Content-Length`, computes `allowedBytes = floor(length * pct)`, rewrites/limits the response Range to `0-(allowedBytes-1)`. Rejects requests for bytes beyond `allowedBytes` with `416`.
- On failure: `401` or `403`.

**New secret needed:** `R2_SIGNING_SECRET` (also configured as a Worker secret).

**Frontend (`src/lib/musicTier.ts`)**:
- Replace `trackStreamUrl(track)` with `async signedStreamUrl(track, tier, ref?)` that calls the `stream-track` function with `?json=1` and returns the signed URL. Audio `src` is the signed URL.

---

### 2. Sandbox PayFast test page (`/sandbox/payments`)

New page `src/pages/SandboxPayments.tsx` (route registered in `App.tsx`, founder-only via `FounderRoute`):
- Track picker (loads from `tracks`).
- Buttons: "Buy Standard", "Buy Gold", "Buy Download" (uses sandbox `PAYFAST_MODE`).
- Step list rendered live:
  1. `payfast-create` request + response (`m_payment_id`).
  2. PayFast redirect (submit form in new tab).
  3. Polling `payment-status` — shows each tick + status transitions.
  4. On `paid`: shows minted token, attempts `stream-track` request, displays tier unlock from `localStorage`.
- Reset / clear-access controls.
- Visible only when `import.meta.env.DEV` OR user is founder.

---

### 3. Hardened Listen page (`src/pages/Listen.tsx`)

- Add a `seeking` guard: in the `timeupdate` and new `seeking`/`seeked` listeners, clamp `currentTime` to `allowedSec - 0.25` if user scrubs past it (free/standard tiers).
- Disable seek beyond `allowedSec` on the progress UI (custom click handler instead of HTML default).
- Use signed URLs (`signedStreamUrl`) — set `audio.src` only after fetch resolves; show inline loader.
- Upgrade prompt: clearer copy showing exactly how much more they'd unlock (e.g. "+45% with Standard, full song with Gold").
- After successful upgrade (when `PaymentReturnHandler` grants access), auto-resume from the last `progress` value of the matching track (store `lastProgress[trackId]` in `sessionStorage`).
- Toast on tier unlock now offers a "Resume" action.

---

### 4. Music admin (`src/components/dashboard/MusicAdmin.tsx`)

Added as a new Dashboard tab (founder-only — existing `Dashboard` already restricts).
Table of `tracks` with editable cells:
- Title, artist, R2 object key.
- Prices (Standard / Gold / Download) in ZAR.
- Percentages (Free / Standard / Gold) as 0–100 sliders.
- `is_active` switch.
- `sort_order` number.
- "Publish as New Single" quick action: sets `is_active = true`, bumps `sort_order` to top, optionally creates a matching `releases` row (`status='New Single'`, `is_featured=true`).
All edits via `supabase.from('tracks').update(...)`. Optimistic UI + toast.

No new table — uses existing `tracks` + `releases`.

---

### 5. PayFast notify audit log

**New table** `payfast_notify_log`:
- `id`, `created_at`,
- `m_payment_id` (text, nullable),
- `payment_id` (uuid, nullable, refs `payments.id` logically),
- `signature_ok` (bool),
- `amount_ok` (bool),
- `was_idempotent_skip` (bool) — true when payment was already `paid`,
- `pf_payment_status` (text),
- `expected_amount_cents` (int, nullable),
- `received_amount` (text, nullable),
- `verify_reason` (text, nullable),
- `outcome` (text: `paid` | `failed` | `ignored` | `unknown_payment` | `invalid`),
- `source_ip` (text, nullable),
- `raw_payload` (jsonb),
- `raw_body_hash` (text) — sha256 of raw body, lets you dedupe replays without storing duplicates.

RLS: founders SELECT; service_role full ALL. No update/delete for users.

**`payfast-notify` edge function** writes one row per inbound POST (after parsing, regardless of outcome), and sets `was_idempotent_skip = true` when the early `pmt.status === 'paid'` short-circuit fires.

**Admin UI** `src/components/dashboard/PayFastAuditLog.tsx` (Dashboard tab, founder-only):
- Reverse-chronological table, filters by `outcome` and date range.
- Row expander shows `raw_payload` JSON.
- Badge colors: green `paid`, red `invalid`/`failed`, gray `ignored`/`unknown_payment`.
- "Resend test ITN" button (sandbox only) that calls `payfast-notify` with a stored payload for replay troubleshooting.

---

### Build order

1. Migration: create `payfast_notify_log` (RLS + indexes).
2. Add secret `R2_SIGNING_SECRET`.
3. Edge functions: new `stream-track`; update `payfast-notify` to log; (no change needed to `payfast-create`/`payment-status`).
4. Update `src/lib/musicTier.ts` → signed-URL helper.
5. Rewrite Listen card playback (seek clamping, resume).
6. Sandbox payments page + route.
7. `MusicAdmin` + `PayFastAuditLog` dashboard tabs.
8. Update `docs/payments-setup.md` with new Worker code + signing key instructions.

---

### Open questions

1. **`R2_SIGNING_SECRET`** — OK to add a new runtime + Worker secret? (Required for any real enforcement.)
2. **Worker deployment** — can you deploy the updated Worker to `newsingle.s2kdotza.com`? Without it, the signed-URL function still works but R2 will accept unsigned requests too (best-effort only).
3. **Cristal via JWT** — confirm that any logged-in user with the existing `founder` role should get Cristal (no new role needed).
4. **Sandbox page route** — `/sandbox/payments` founder-only is fine, or do you want it gated behind `PAYFAST_MODE === 'sandbox'` as well so it disappears in production?
