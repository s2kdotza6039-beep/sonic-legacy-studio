// Automated RLS checks for founder-only security tables used by the daily
// digest, timeline CSV exports, and scheduled CSV export runs.
//
// Contract under test (anon JWT — i.e. a non-founder caller):
//   1. SELECT on each table returns 0 rows (RLS hides everything).
//   2. INSERT is rejected by RLS (anon cannot create rows).
//   3. UPDATE never affects any row (RLS hides target rows from anon).
//
// These tests are intentionally non-destructive: they only attempt anon-scope
// writes that RLS must reject. A separate service-role client is used purely
// to assert that the database state did not change.

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

type TableSpec = {
  name: string;
  // A minimal payload anon would try to insert; the exact column shape is not
  // important — RLS should block before column validation runs.
  insertPayload: Record<string, unknown>;
};

const TABLES: TableSpec[] = [
  // Digest run history is recorded in security_audit_log (action =
  // 'daily_report_manual_run' or 'daily_report_sent').
  {
    name: "security_audit_log",
    insertPayload: { action: "daily_report_manual_run", entity: "security_audit_log" },
  },
  // Timeline CSV exports are configured via scheduled_exports …
  {
    name: "security_scheduled_exports",
    insertPayload: {
      owner_user_id: "00000000-0000-0000-0000-000000000000",
      name: "anon-attack",
      cadence: "daily",
      lookback_hours: 24,
      delivery_method: "email",
      destination: "evil@example.com",
    },
  },
  // … and their per-run delivery status is tracked here.
  {
    name: "security_scheduled_export_runs",
    insertPayload: {
      schedule_id: "00000000-0000-0000-0000-000000000000",
      status: "queued",
      retry_count: 0,
    },
  },
];

const opts = { sanitizeOps: false, sanitizeResources: false };

Deno.test({
  ...opts,
  name: "RLS: anon SELECT returns 0 rows on founder-only security tables",
  fn: async () => {
    if (!ANON_KEY) { console.warn("Skipping: missing ANON_KEY"); return; }
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    for (const t of TABLES) {
      const { data, error } = await anon.from(t.name).select("*").limit(5);
      // RLS hides rows but should not return a permission error for SELECT
      // (the policies are scoped to `authenticated` with has_role(...)).
      assert(!error || /permission|denied|policy/i.test(error.message),
        `${t.name}: unexpected error ${error?.message}`);
      assertEquals((data ?? []).length, 0,
        `${t.name}: anon must see 0 rows, got ${(data ?? []).length}`);
    }
  },
});

Deno.test({
  ...opts,
  name: "RLS: anon INSERT is rejected on founder-only security tables",
  fn: async () => {
    if (!ANON_KEY || !SERVICE_KEY) { console.warn("Skipping: missing keys"); return; }
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    for (const t of TABLES) {
      const { count: before } = await admin.from(t.name).select("*", { count: "exact", head: true });
      const { error } = await anon.from(t.name).insert(t.insertPayload);
      assert(error, `${t.name}: anon insert must be rejected`);
      assert(/row-level security|policy|permission|denied/i.test(error.message),
        `${t.name}: expected RLS rejection, got ${error.message}`);
      const { count: after } = await admin.from(t.name).select("*", { count: "exact", head: true });
      assertEquals(after, before, `${t.name}: row count must be unchanged`);
    }
  },
});

Deno.test({
  ...opts,
  name: "RLS: anon UPDATE affects 0 rows on founder-only security tables",
  fn: async () => {
    if (!ANON_KEY) { console.warn("Skipping: missing ANON_KEY"); return; }
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    for (const t of TABLES) {
      // Generic harmless update — RLS hides every row from anon, so the
      // affected-rows count must be 0 regardless of the column being touched.
      const { data, error } = await anon
        .from(t.name)
        .update({ destination: "anon-was-here" })
        .gte("created_at", "1970-01-01")
        .select("id");
      // Either RLS rejects entirely, or it silently filters all rows.
      if (error) {
        assert(/row-level security|policy|permission|denied|column/i.test(error.message),
          `${t.name}: unexpected update error ${error.message}`);
      } else {
        assertEquals((data ?? []).length, 0,
          `${t.name}: anon update must touch 0 rows, touched ${(data ?? []).length}`);
      }
    }
  },
});
