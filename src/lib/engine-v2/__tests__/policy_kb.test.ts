// engine_v2 Lane 2d / L2d-1 unit tests for the policy KB adapter.
//
// Uses a `:memory:` SQLite fixture with the relevant tables seeded inline.
// The real `rraa_v3_2.db` is NEVER touched by these tests.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { searchPolicies, getPolicyById } from "../policy_kb";

// We need an on-disk DB because the adapter opens its own connection from a
// path. Use a tempfile per-test (cheap on Windows) so the adapter can open it
// read-only via its own better-sqlite3 driver.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3") as new (
  p: string,
  o?: Record<string, unknown>,
) => {
  exec: (sql: string) => void;
  prepare: (sql: string) => { run: (...p: unknown[]) => void };
  close: () => void;
};

function makeFixtureDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-v2-kb-"));
  const p = path.join(dir, "fixture.db");
  const db = new Database(p);
  db.exec(`
    CREATE TABLE policy_statements (
      id TEXT PRIMARY KEY,
      original_text TEXT,
      plain_language_summary TEXT,
      discretion_tier TEXT,
      topic_category TEXT,
      sub_category TEXT,
      source_document_name TEXT,
      source_section_reference TEXT,
      source_page_reference TEXT,
      keywords TEXT,
      review_question TEXT,
      is_active INTEGER
    );
    -- Standalone (non-external-content) FTS5. The id column is included so
    -- the route's join (p.id = fts.id) resolves cleanly via a non-rowid key.
    CREATE VIRTUAL TABLE policy_statements_fts USING fts5(
      id UNINDEXED,
      original_text, plain_language_summary, keywords, review_question,
      tokenize='unicode61'
    );
  `);
  const insert = db.prepare(
    "INSERT INTO policy_statements (id, original_text, plain_language_summary, discretion_tier, topic_category, sub_category, source_document_name, source_section_reference, source_page_reference, keywords, review_question, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const rows: Array<
    [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      number,
    ]
  > = [
    [
      "P-001",
      "Arsenic exceedance in soil requires investigation",
      "Soil arsenic must be investigated",
      "TIER_1_BINARY",
      "Soil",
      "Metals",
      "CSR",
      "12.3",
      "45",
      "arsenic,soil,metals",
      "Was arsenic investigated?",
      1,
    ],
    [
      "P-002",
      "Groundwater monitoring should be appropriate to the site",
      "Groundwater monitoring is professional judgment",
      "TIER_2_PROFESSIONAL",
      "Groundwater",
      "Monitoring",
      "Protocol 1",
      "2.1",
      "10",
      "groundwater,monitoring",
      "Was groundwater monitoring appropriate?",
      1,
    ],
    [
      "P-003",
      "Director may require additional sampling",
      "Director discretion",
      "TIER_3_STATUTORY",
      "Soil",
      "Sampling",
      "EMA",
      "53(2)",
      "8",
      "director,sampling",
      "Did the Director require sampling?",
      1,
    ],
    [
      "P-004",
      "Inactive policy on lead",
      "Inactive lead policy",
      "TIER_1_BINARY",
      "Soil",
      "Metals",
      "Old Doc",
      "X",
      "0",
      "lead,inactive",
      null as unknown as string,
      0,
    ],
  ];
  for (const r of rows) insert.run(...r);

  // Populate the FTS5 index. Standalone (non-external-content) table so the
  // join in policy_kb.ts (p.id = fts.id) works via the UNINDEXED id column.
  db.exec(`
    INSERT INTO policy_statements_fts (id, original_text, plain_language_summary, keywords, review_question)
    SELECT id, original_text, plain_language_summary, keywords, review_question
    FROM policy_statements
    WHERE is_active = 1;
  `);
  db.close();
  return p;
}

let fixturePath: string;
let fixtureDir: string;

beforeEach(() => {
  fixturePath = makeFixtureDb();
  fixtureDir = path.dirname(fixturePath);
});

afterEach(() => {
  try {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
});

describe("searchPolicies", () => {
  it("finds active rows via FTS5", () => {
    const { rows, usedFallback } = searchPolicies("arsenic", {
      dbPathOverride: fixturePath,
    });
    expect(usedFallback).toBe(false);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].id).toBe("P-001");
  });

  it("excludes inactive rows", () => {
    const { rows } = searchPolicies("lead", { dbPathOverride: fixturePath });
    // P-004 is inactive; should not appear.
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain("P-004");
  });

  it("filters by tier", () => {
    const { rows } = searchPolicies("sampling", {
      tier: "TIER_3_STATUTORY",
      dbPathOverride: fixturePath,
    });
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("P-003");
  });

  it("filters by topic", () => {
    const { rows } = searchPolicies("monitoring", {
      topic: "Groundwater",
      dbPathOverride: fixturePath,
    });
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("P-002");
  });

  it("clamps limit to [1, 100]", () => {
    // limit < 1 -> 1
    const r1 = searchPolicies("soil", {
      limit: 0,
      dbPathOverride: fixturePath,
    });
    expect(r1.rows.length).toBeLessThanOrEqual(1);

    // limit > 100 -> capped silently; result count bounded by fixture size.
    const r2 = searchPolicies("soil", {
      limit: 9999,
      dbPathOverride: fixturePath,
    });
    expect(r2.rows.length).toBeLessThanOrEqual(100);
  });

  it("falls back to LIKE when sanitizer returns null", () => {
    // Single-char query -> sanitizer returns null -> LIKE fallback fires.
    // (The route would normally 400 on q.length < 2, but the adapter is
    // permissive so the chat path can call it with arbitrary text later.)
    const { usedFallback } = searchPolicies("x", {
      dbPathOverride: fixturePath,
    });
    expect(usedFallback).toBe(true);
  });

  it("LIKE fallback escapes user wildcards", () => {
    // A query containing `%` should NOT match unrelated rows. Insert a
    // throwaway probe via the adapter using a query that, unescaped, would
    // match every row.
    const { rows } = searchPolicies("100%", {
      dbPathOverride: fixturePath,
    });
    // No row contains the literal "100%", so the LIKE fallback should return
    // zero rows (rather than every row, which would happen if % were left as
    // a wildcard).
    expect(rows.length).toBe(0);
  });

  it("returns topic list for filtering UI", () => {
    const { topics } = searchPolicies("soil", {
      dbPathOverride: fixturePath,
    });
    expect(topics).toContain("Soil");
    expect(topics).toContain("Groundwater");
  });

  it("survives the classic injection probe (no throw)", () => {
    const probe = "', 1) DROP TABLE policy_statements; --";
    expect(() =>
      searchPolicies(probe, { dbPathOverride: fixturePath }),
    ).not.toThrow();
    // Table must still exist after the call.
    const after = searchPolicies("arsenic", { dbPathOverride: fixturePath });
    expect(after.rows.length).toBeGreaterThanOrEqual(1);
  });
});

describe("getPolicyById", () => {
  it("returns the row when found", () => {
    const row = getPolicyById("P-001", { dbPathOverride: fixturePath });
    expect(row).not.toBeNull();
    expect(row?.id).toBe("P-001");
  });

  it("returns null when not found", () => {
    const row = getPolicyById("P-DOES-NOT-EXIST", {
      dbPathOverride: fixturePath,
    });
    expect(row).toBeNull();
  });
});
