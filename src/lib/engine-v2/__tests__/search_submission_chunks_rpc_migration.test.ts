// engine_v2: static safeguard for the search_submission_chunks RPC migration.
//
// This repo has no live-Postgres test harness for RPC function bodies, so
// this test cannot execute the SQL. It exists solely to guard against
// reintroducing the exact "column reference \"evidence_item_id\" is
// ambiguous" bug fixed by
// 20260709_v2_submission_chunks_search_rpc_fix_ambiguous_evidence_item_id.sql:
// the function's RETURNS TABLE(... evidence_item_id ...) clause declares an
// implicit PL/pgSQL block variable of that name, so any unqualified
// reference to evidence_item_id inside the function body is ambiguous
// against a table column of the same name. The inner correlated subquery
// over v2_chunk_policy_citations must alias that table and qualify every
// reference to evidence_item_id through the alias.

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const MIGRATION_PATH = path.join(
  __dirname,
  "../../../../supabase/migrations/20260709_v2_submission_chunks_search_rpc_fix_ambiguous_evidence_item_id.sql",
);

describe("search_submission_chunks RPC migration (static safeguard)", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

  it("qualifies the inner v2_chunk_policy_citations subquery with an alias", () => {
    expect(sql).toMatch(/FROM v2_chunk_policy_citations cpc\b/);
  });

  it("never selects a bare, unqualified evidence_item_id inside the subquery", () => {
    // The only acceptable unqualified appearance of "evidence_item_id" in the
    // whole file is the RETURNS TABLE column declaration itself. Everywhere
    // else it must be prefixed by a table alias (c., cc., or cpc.).
    const lines = sql.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("--")) continue; // prose comments may say the name freely
      if (!line.includes("evidence_item_id")) continue;
      if (/^\s*evidence_item_id\s+text,/.test(line)) continue; // RETURNS TABLE column decl
      const qualified = /\b(c|cc|cpc)\.evidence_item_id\b/.test(line);
      expect(qualified).toBe(true);
    }
  });

  it("preserves the function signature and grants unchanged", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.search_submission_chunks(",
    );
    expect(sql).toContain("SECURITY INVOKER");
    expect(sql).toContain(
      "GRANT  EXECUTE ON FUNCTION public.search_submission_chunks(uuid, text, int) TO authenticated;",
    );
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.search_submission_chunks(uuid, text, int) FROM PUBLIC;",
    );
  });
});
