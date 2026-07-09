// engine_v2: static safeguard for scripts/gate2b/import_verify_e58.mjs's provenance note.
//
// The E-58 fixture's evaluation_id directory ("33333333-3333-3333-3333-333333333333") started
// as a placeholder-looking id but a v2_evaluations row with this EXACT id is now REAL,
// live production data (project_id 11111111-1111-1111-1111-111111111111, "M6 Dress
// Rehearsal"). This test guards against the clarifying comment being silently removed or
// the id itself being changed without updating the comment, either of which would make a
// future reader (human or AI) more likely to mistake this for throwaway test data and
// accidentally delete or overwrite it.
//
// This is a plain-text static check, not a live-data check: it does not query Supabase or
// the filesystem staging directory, only the script's own source text.

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

const SCRIPT_PATH = path.join(
  __dirname,
  "../../../../scripts/gate2b/import_verify_e58.mjs",
);

describe("import_verify_e58.mjs provenance note (static safeguard)", () => {
  const src = fs.readFileSync(SCRIPT_PATH, "utf8");

  it("still embeds the real E-58 evaluation_id in the DEFAULT_FIXTURE_PATH assignment itself", () => {
    // Anchored to the actual assignment line (not just anywhere in the
    // file's prose) so this fails if DEFAULT_FIXTURE_PATH is repointed at a
    // different evaluation directory while a stale comment still mentions
    // the old id elsewhere.
    const assignmentLine = src
      .split("\n")
      .find((l) => l.includes("const DEFAULT_FIXTURE_PATH ="));
    expect(assignmentLine).toBeDefined();
    expect(assignmentLine).toContain(
      "33333333-3333-3333-3333-333333333333",
    );
  });

  it("carries a clarifying comment that this id is now real production data", () => {
    expect(src).toMatch(/REAL, live[\s\S]{0,20}production data/);
    expect(src).toMatch(
      /Do not delete or overwrite this local[\s\S]{0,20}staging directory/,
    );
  });

  it("does NOT conflate the real id with TEST_EVALUATION_ID (a distinct, still-fictional placeholder)", () => {
    expect(src).toContain(
      'const TEST_EVALUATION_ID = "22222222-2222-2222-2222-222222222222"',
    );
    expect(src).toContain("TEST_EVALUATION_ID is a placeholder only");
  });
});
