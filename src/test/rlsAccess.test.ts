/**
 * RLS access tests — run after each migration to verify that
 * the public anon key cannot reach sensitive columns or buckets.
 *
 * These tests hit the live Supabase Data API and Storage with the
 * publishable anon key only. They will pass in CI as long as the
 * production schema/policies stay locked down.
 */
import { describe, it, expect } from "vitest";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://dvmftknddmssmpyhnjob.supabase.co";
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2bWZ0a25kZG1zc21weWhuam9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzMwOTQsImV4cCI6MjA5MDQwOTA5NH0._dNyR6YdELWW0-cLHr9zaxqrFH3DFIr0GZV6LGRtKfs";

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });

const storage = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/storage/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });

describe("tracks RLS", () => {
  it("anon CAN read non-sensitive columns", async () => {
    const res = await rest("/tracks?select=id,title,artist_name&limit=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("anon CANNOT read r2_object_key", async () => {
    const res = await rest("/tracks?select=id,r2_object_key&limit=1");
    // Postgres returns 42501 permission denied → REST surfaces as 401/403.
    expect([401, 403]).toContain(res.status);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/permission denied|42501/i);
  });

  it("anon CANNOT insert into tracks", async () => {
    const res = await rest("/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ slug: "rls-test", title: "x", artist_name: "x" }),
    });
    expect([401, 403]).toContain(res.status);
  });
});

describe("submissions bucket RLS", () => {
  it("anon CANNOT list submissions", async () => {
    const res = await storage("/object/list/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1, prefix: "" }),
    });
    expect([400, 401, 403]).toContain(res.status);
  });

  it("anon CANNOT upload outside careers/ prefix", async () => {
    const res = await storage("/object/submissions/rogue/test.mp3", {
      method: "POST",
      headers: { "Content-Type": "audio/mpeg" },
      body: new Blob([new Uint8Array([0])], { type: "audio/mpeg" }),
    });
    expect([400, 401, 403]).toContain(res.status);
  });

  it("anon CANNOT upload disallowed extensions", async () => {
    const res = await storage("/object/submissions/careers/malware.exe", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Blob([new Uint8Array([0])], { type: "application/octet-stream" }),
    });
    expect([400, 401, 403]).toContain(res.status);
  });
});

describe("contract-files bucket RLS", () => {
  it("anon CANNOT list contract-files", async () => {
    const res = await storage("/object/list/contract-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1, prefix: "" }),
    });
    expect([400, 401, 403]).toContain(res.status);
  });

  it("anon CANNOT upload to contract-files", async () => {
    const res = await storage("/object/contract-files/test.pdf", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: new Blob([new Uint8Array([0])], { type: "application/pdf" }),
    });
    expect([400, 401, 403]).toContain(res.status);
  });

  it("anon CANNOT download arbitrary contract-files object", async () => {
    const res = await storage("/object/contract-files/anything.pdf");
    expect([400, 401, 403, 404]).toContain(res.status);
    // Must NOT be a 200 with file body
    expect(res.status).not.toBe(200);
  });
});

describe("founder-only tables are not anon-readable", () => {
  const tables = [
    "contract_templates",
    "contracts",
    "payments",
    "download_tokens",
    "invoices",
    "ai_drafts",
    "ai_activity_log",
    "user_roles",
  ];
  for (const t of tables) {
    it(`anon CANNOT read ${t}`, async () => {
      const res = await rest(`/${t}?select=*&limit=1`);
      if (res.status === 200) {
        const body = await res.json();
        // Even if 200, RLS should return an empty array (no rows visible).
        expect(Array.isArray(body) && body.length).toBe(0);
      } else {
        expect([401, 403]).toContain(res.status);
      }
    });
  }
});
