/**
 * Reads rls-coverage.json (written by the rlsAccess test suite) and emits a
 * Markdown table for GitHub Actions $GITHUB_STEP_SUMMARY.
 */
import { readFileSync, existsSync } from "node:fs";

const path = process.env.RLS_COVERAGE_OUT ?? "rls-coverage.json";
if (!existsSync(path)) {
  console.log("## RLS coverage\n\n_No coverage file written._");
  process.exit(0);
}

type Row = {
  table: string;
  policy: string;
  operation: string;
  outcome: "allowed" | "blocked" | "empty";
  test: string;
};
const rows: Row[] = JSON.parse(readFileSync(path, "utf8"));

console.log("## RLS policy coverage");
console.log("");
console.log(`Exercised **${rows.length}** policy assertions.`);
console.log("");
console.log("| Table / bucket | Policy | Op | Outcome | Test |");
console.log("|---|---|---|---|---|");
for (const r of rows) {
  console.log(
    `| \`${r.table}\` | ${r.policy} | ${r.operation} | ${r.outcome} | ${r.test} |`,
  );
}
