import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  ALLOWED_VERDICTS_BY_TIER,
  type JudgmentTier,
  type JudgmentVerdict,
} from "../types_lane2";
import { assertVerdictAllowedForTier } from "../zod_lane2";

describe("ALLOWED_VERDICTS_BY_TIER constant", () => {
  it("matches CLAUDE.md tier discretion rules", () => {
    expect(ALLOWED_VERDICTS_BY_TIER.TIER_1_BINARY).toEqual(
      ["ADEQUATE", "INADEQUATE", "DEFICIENT", "REQUIRES_REVIEW"],
    );
    expect(ALLOWED_VERDICTS_BY_TIER.TIER_2_PROFESSIONAL).toEqual(
      ["DEFICIENT", "REQUIRES_REVIEW"],
    );
    expect(ALLOWED_VERDICTS_BY_TIER.TIER_3_STATUTORY).toEqual(
      ["OBSERVATION_ONLY"],
    );
  });

  it("TIER_2_PROFESSIONAL never allows ADEQUATE (CLAUDE.md NON-NEGOTIABLE)", () => {
    expect(ALLOWED_VERDICTS_BY_TIER.TIER_2_PROFESSIONAL).not.toContain("ADEQUATE");
  });

  it("TIER_3_STATUTORY allows only OBSERVATION_ONLY (CLAUDE.md NON-NEGOTIABLE)", () => {
    expect(ALLOWED_VERDICTS_BY_TIER.TIER_3_STATUTORY).toEqual(["OBSERVATION_ONLY"]);
  });

  it("matches the SQL CHECK constraint in the patch", () => {
    const sql = readFileSync(
      resolve(__dirname, "..", "..", "..", "..", "supabase", "engine_v2", "database_schema_engine_v2_lane2b_patch.sql"),
      "utf-8",
    );
    expect(sql).toContain("CONSTRAINT v2_judgments_tier_verdict_check");
    // Spot-check each tier's verdict list appears in the SQL.
    expect(sql).toContain("'ADEQUATE','INADEQUATE','DEFICIENT','REQUIRES_REVIEW'");
    expect(sql).toContain("verdict IN ('DEFICIENT','REQUIRES_REVIEW')");
    expect(sql).toContain("verdict = 'OBSERVATION_ONLY'");
  });
});

describe("assertVerdictAllowedForTier", () => {
  const cases: Array<[JudgmentTier, JudgmentVerdict, boolean]> = [
    ["TIER_1_BINARY", "ADEQUATE", true],
    ["TIER_1_BINARY", "INADEQUATE", true],
    ["TIER_1_BINARY", "OBSERVATION_ONLY", false],
    ["TIER_2_PROFESSIONAL", "ADEQUATE", false],
    ["TIER_2_PROFESSIONAL", "DEFICIENT", true],
    ["TIER_3_STATUTORY", "ADEQUATE", false],
    ["TIER_3_STATUTORY", "OBSERVATION_ONLY", true],
  ];
  for (const [tier, verdict, expectOk] of cases) {
    it(`${tier} + ${verdict} -> ${expectOk ? "OK" : "throws"}`, () => {
      if (expectOk) {
        expect(() => assertVerdictAllowedForTier(tier, verdict)).not.toThrow();
      } else {
        expect(() => assertVerdictAllowedForTier(tier, verdict)).toThrow(/verdict_not_allowed_for_tier/);
      }
    });
  }
});
