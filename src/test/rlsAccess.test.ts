/**
 * RLS access tests — run after each migration to verify that
 * the public anon key cannot reach sensitive columns or buckets.
 *
 * Each assertion records which policy it exercised into rls-coverage.json,
 * consumed by scripts/rls-coverage-summary.ts to produce a CI summary.
 */
import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://dvmftknddmssmpyhnjob.supabase.co";
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2bWZ0a25kZG1zc21weWhuam9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzMwOTQsImV4cCI6MjA5MDQwOTA5NH0._dNyR6YdELWW0-cLHr9zaxqrFH3DFIr0GZV6LGRtKfs";

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

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

// ---- Coverage recorder -------------------------------------------------------
type CoverageRow = {
  table: string;
  policy: string;
  operation: string;
  outcome: "allowed" | "blocked" | "empty";
  test: string;
};
const coverage: CoverageRow[] = [];
const cover = (row: CoverageRow) => coverage.push(row);

afterAll(() => {
  const out = process.env.RLS_COVERAGE_OUT ?? "rls-coverage.json";
  try {
    mkdirSync(dirname(out), { recursive: true });
  } catch {}
  writeFileSync(out, JSON.stringify(coverage, null, 2));
});

// ---- Tests -------------------------------------------------------------------

describe("tracks RLS", () => {
  it("anon CAN read non-sensitive columns", async ({ task }) => {
    const res = await rest("/tracks?select=id,title,artist_name&limit=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    cover({ table: "public.tracks", policy: "Public reads active tracks", operation: "SELECT", outcome: "allowed", test: task.name });
  });

  it("anon CANNOT read r2_object_key", async ({ task }) => {
    const res = await rest("/tracks?select=id,r2_object_key&limit=1");
    expect([401, 403]).toContain(res.status);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/permission denied|42501/i);
    cover({ table: "public.tracks", policy: "Column REVOKE on r2_object_key", operation: "SELECT(col)", outcome: "blocked", test: task.name });
  });

  it("anon CANNOT insert into tracks", async ({ task }) => {
    const res = await rest("/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ slug: "rls-test", title: "x", artist_name: "x" }),
    });
    expect([401, 403]).toContain(res.status);
    cover({ table: "public.tracks", policy: "Founders manage tracks", operation: "INSERT", outcome: "blocked", test: task.name });
  });
});

describe("submissions bucket RLS", () => {
  it("anon list submissions returns empty (RLS hides objects)", async ({ task }) => {
    const res = await storage("/object/list/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 100, prefix: "" }),
    });
    if (res.status === 200) {
      const body = await res.json();
      expect(Array.isArray(body) && body.length).toBe(0);
      cover({ table: "storage.submissions", policy: "Founders read submissions", operation: "SELECT", outcome: "empty", test: task.name });
    } else {
      expect([400, 401, 403]).toContain(res.status);
      cover({ table: "storage.submissions", policy: "Founders read submissions", operation: "SELECT", outcome: "blocked", test: task.name });
    }
  });

  it("anon CANNOT upload outside careers/ prefix", async ({ task }) => {
    const res = await storage("/object/submissions/rogue/test.mp3", {
      method: "POST",
      headers: { "Content-Type": "audio/mpeg" },
      body: new Blob([new Uint8Array([0])], { type: "audio/mpeg" }),
    });
    expect([400, 401, 403]).toContain(res.status);
    cover({ table: "storage.submissions", policy: "Public submissions INSERT careers/*", operation: "INSERT", outcome: "blocked", test: task.name });
  });

  it("anon CANNOT upload disallowed extensions", async ({ task }) => {
    const res = await storage("/object/submissions/careers/malware.exe", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Blob([new Uint8Array([0])], { type: "application/octet-stream" }),
    });
    expect([400, 401, 403]).toContain(res.status);
    cover({ table: "storage.submissions", policy: "Public submissions INSERT extension allowlist", operation: "INSERT", outcome: "blocked", test: task.name });
  });
});

describe("contract-files bucket RLS", () => {
  it("anon list contract-files returns empty (RLS hides objects)", async ({ task }) => {
    const res = await storage("/object/list/contract-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 100, prefix: "" }),
    });
    if (res.status === 200) {
      const body = await res.json();
      expect(Array.isArray(body) && body.length).toBe(0);
      cover({ table: "storage.contract-files", policy: "Founders read contract-files", operation: "SELECT", outcome: "empty", test: task.name });
    } else {
      expect([400, 401, 403]).toContain(res.status);
      cover({ table: "storage.contract-files", policy: "Founders read contract-files", operation: "SELECT", outcome: "blocked", test: task.name });
    }
  });

  it("anon CANNOT upload to contract-files", async ({ task }) => {
    const res = await storage("/object/contract-files/test.pdf", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: new Blob([new Uint8Array([0])], { type: "application/pdf" }),
    });
    expect([400, 401, 403]).toContain(res.status);
    cover({ table: "storage.contract-files", policy: "Founders write contract-files", operation: "INSERT", outcome: "blocked", test: task.name });
  });

  it("anon CANNOT download arbitrary contract-files object", async ({ task }) => {
    const res = await storage("/object/contract-files/anything.pdf");
    expect([400, 401, 403, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
    cover({ table: "storage.contract-files", policy: "Founders read contract-files", operation: "GET", outcome: "blocked", test: task.name });
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
    "security_audit_log",
    "security_alert_rules",
    "security_alert_dispatch_log",
  ];
  for (const t of tables) {
    it(`anon CANNOT read ${t}`, async ({ task }) => {
      const res = await rest(`/${t}?select=*&limit=1`);
      if (res.status === 200) {
        const body = await res.json();
        expect(Array.isArray(body) && body.length).toBe(0);
        cover({ table: `public.${t}`, policy: "Founders-only RLS", operation: "SELECT", outcome: "empty", test: task.name });
      } else {
        expect([401, 403]).toContain(res.status);
        cover({ table: `public.${t}`, policy: "Founders-only RLS", operation: "SELECT", outcome: "blocked", test: task.name });
      }
    });
  }
});
