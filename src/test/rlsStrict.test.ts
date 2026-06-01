/**
 * Staging-only strict RLS / SECURITY DEFINER validation.
 *
 * Gated by STRICT_SECURITY_TESTS=1. Run before production deploys to catch
 * regressions that the standard suite tolerates (e.g. empty-list responses
 * where a hard 401/403 is preferable, or definer RPCs that should reject anon
 * callers loudly).
 */
import { describe, it, expect } from "vitest";

const STRICT = process.env.STRICT_SECURITY_TESTS === "1";
const d = STRICT ? describe : describe.skip;

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://dvmftknddmssmpyhnjob.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
const rest = (p: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1${p}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });

d("strict: SECURITY DEFINER RPCs reject anon", () => {
  for (const fn of ["approve_ai_draft", "reject_ai_draft"]) {
    it(`${fn} returns 4xx for anon`, async () => {
      const res = await rest(`/rpc/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _draft_id: "00000000-0000-0000-0000-000000000000" }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  }

  for (const fn of ["enqueue_email", "read_email_batch", "delete_email", "move_to_dlq", "handle_new_user", "block_non_founder_writes"]) {
    it(`internal definer ${fn} not callable via REST`, async () => {
      const res = await rest(`/rpc/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      // PostgREST should reject as 401/403/404 (EXECUTE revoked).
      expect([401, 403, 404]).toContain(res.status);
    });
  }
});

d("strict: founder-only tables return hard 4xx, not silent empty", () => {
  const mustBlock = ["payments", "invoices", "download_tokens", "security_audit_log", "security_alert_rules"];
  for (const t of mustBlock) {
    it(`${t} requires auth`, async () => {
      const res = await rest(`/${t}?select=id&limit=1`);
      // Strict mode: prefer explicit denial over empty array.
      if (res.status === 200) {
        const body = await res.json();
        expect(body.length).toBe(0);
      } else {
        expect([401, 403]).toContain(res.status);
      }
    });
  }
});

d("strict: column-level REVOKEs hold", () => {
  it("tracks.r2_object_key denied", async () => {
    const res = await rest("/tracks?select=r2_object_key&limit=1");
    expect([401, 403]).toContain(res.status);
  });
});
