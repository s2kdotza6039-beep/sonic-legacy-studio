// End-to-end test for log-security-export.
//
// Verifies:
//   1. Anon callers cannot invoke the function (founder JWT required).
//   2. Missing Authorization is rejected.
//   3. Wrong methods are rejected.
//   4. No audit row is written for unauthorized calls (using a service-role
//      client to inspect security_audit_log, which RLS otherwise hides).
//
// We deliberately do NOT exercise the success path here because issuing a
// founder JWT requires Supabase admin credentials. The contract under test
// is that NO unauthorized call ever writes an audit row.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ??
  Deno.env.get("SUPABASE_URL") ??
  "https://dvmftknddmssmpyhnjob.supabase.co";
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const fnUrl = `${SUPABASE_URL}/functions/v1/log-security-export`;

const auditCount = async (sb: ReturnType<typeof createClient>) => {
  const { count } = await sb
    .from("security_audit_log")
    .select("*", { count: "exact", head: true })
    .eq("entity", "security_audit_log");
  return count ?? 0;
};

Deno.test("log-security-export: rejects anon and writes no audit row", async () => {
  if (!ANON_KEY || !SERVICE_KEY) {
    console.warn("Skipping: missing ANON_KEY or SERVICE_ROLE_KEY in env.");
    return;
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const before = await auditCount(sb);

  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entity: "security_audit_log", row_count: 1, filters: {} }),
  });
  await res.text();
  assert([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);

  const after = await auditCount(sb);
  assertEquals(after, before, "anon call must NOT create an audit row");
});

Deno.test("log-security-export: rejects missing Authorization header", async () => {
  if (!ANON_KEY) return;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  await res.text();
  assert([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
});

Deno.test("log-security-export: rejects GET", async () => {
  if (!ANON_KEY) return;
  const res = await fetch(fnUrl, {
    method: "GET",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  await res.text();
  // 405 method_not_allowed, or 401/403 if auth check happens first.
  assert([401, 403, 405].includes(res.status), `expected 401/403/405, got ${res.status}`);
});

Deno.test("log-security-export: CORS preflight succeeds", async () => {
  const res = await fetch(fnUrl, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
});
