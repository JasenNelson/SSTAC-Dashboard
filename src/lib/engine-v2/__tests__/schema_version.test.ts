// engine_v2 S4 read-side: tests for schema_version.ts helpers.
//
// Covers:
//   - resolveS4Version: column present / raw fallback / both absent / empty-string
//   - isEvidenceStatusVersion: forward-safety for 0.1.0+ / legacy / malformed
//   - resolveEvidenceStatus: column-first, raw fallback, indigenous, sortKey
//
// Follows the factory-mock / no-external-fixture style of eval_result_import.test.ts.

import { describe, it, expect } from "vitest";
import {
  resolveS4Version,
  isEvidenceStatusVersion,
  resolveEvidenceStatus,
  formatEvidenceStatusSummary,
  surfaceableConfidence,
} from "../schema_version";
import type { EvidenceStatus } from "../schema_version";

// ---- resolveS4Version ----

describe("resolveS4Version", () => {
  it("returns the dedicated column value when populated", () => {
    expect(
      resolveS4Version({ s4_schema_version: "0.1.0" }),
    ).toBe("0.1.0");
  });

  it("falls through to raw_result_json.schema_version when column is null", () => {
    expect(
      resolveS4Version({
        s4_schema_version: null,
        raw_result_json: { schema_version: "0.1.0" },
      }),
    ).toBe("0.1.0");
  });

  it("falls through to raw_result_json.schema_version when column is undefined", () => {
    expect(
      resolveS4Version({
        raw_result_json: { schema_version: "0.0.1" },
      }),
    ).toBe("0.0.1");
  });

  it("returns '0.0.1' default when both column and raw_result_json are absent", () => {
    expect(resolveS4Version({})).toBe("0.0.1");
  });

  it("returns '0.0.1' default when both column and raw are explicitly null", () => {
    expect(
      resolveS4Version({ s4_schema_version: null, raw_result_json: null }),
    ).toBe("0.0.1");
  });

  it("empty-string column falls through to raw (NOT returned as empty string)", () => {
    // An empty s4_schema_version MUST NOT resolve to "".
    expect(
      resolveS4Version({
        s4_schema_version: "",
        raw_result_json: { schema_version: "0.1.0" },
      }),
    ).toBe("0.1.0");
  });

  it("empty-string column with no raw falls through to '0.0.1' default", () => {
    expect(
      resolveS4Version({ s4_schema_version: "" }),
    ).toBe("0.0.1");
  });

  it("column takes priority even when raw also has a version", () => {
    expect(
      resolveS4Version({
        s4_schema_version: "0.1.0",
        raw_result_json: { schema_version: "0.0.1" },
      }),
    ).toBe("0.1.0");
  });

  it("raw_result_json that is not an object -> falls through to default", () => {
    expect(
      resolveS4Version({ raw_result_json: "unexpected_string" }),
    ).toBe("0.0.1");
  });

  it("raw_result_json.schema_version that is not a string -> falls through to default", () => {
    expect(
      resolveS4Version({ raw_result_json: { schema_version: 42 } }),
    ).toBe("0.0.1");
  });
});

// ---- isEvidenceStatusVersion ----

describe("isEvidenceStatusVersion", () => {
  it("'0.1.0' is evidence-status (current new version)", () => {
    expect(isEvidenceStatusVersion("0.1.0")).toBe(true);
  });

  it("'0.1.1' is evidence-status (forward-compat minor patch)", () => {
    expect(isEvidenceStatusVersion("0.1.1")).toBe(true);
  });

  it("'0.2.0' is evidence-status (forward-compat minor bump)", () => {
    expect(isEvidenceStatusVersion("0.2.0")).toBe(true);
  });

  it("'1.0.0' is evidence-status (forward-compat major bump)", () => {
    expect(isEvidenceStatusVersion("1.0.0")).toBe(true);
  });

  it("'0.0.1' is legacy (current old version)", () => {
    expect(isEvidenceStatusVersion("0.0.1")).toBe(false);
  });

  it("'0.0.0' is legacy", () => {
    expect(isEvidenceStatusVersion("0.0.0")).toBe(false);
  });

  it("null is legacy", () => {
    expect(isEvidenceStatusVersion(null)).toBe(false);
  });

  it("undefined is legacy", () => {
    expect(isEvidenceStatusVersion(undefined)).toBe(false);
  });

  it("empty string is legacy", () => {
    expect(isEvidenceStatusVersion("")).toBe(false);
  });

  it("garbage string is legacy", () => {
    expect(isEvidenceStatusVersion("garbage")).toBe(false);
  });

  it("string with only 2 parts is legacy (malformed)", () => {
    expect(isEvidenceStatusVersion("0.1")).toBe(false);
  });

  it("string with 4 parts is legacy (malformed)", () => {
    expect(isEvidenceStatusVersion("0.1.0.0")).toBe(false);
  });

  it("non-numeric token: prerelease suffix is legacy (codex P3; parseInt would truncate)", () => {
    // "0.1.0-canary".split(".") -> ["0","1","0-canary"]; parseInt("0-canary")===0 would
    // wrongly pass without strict /^\d+$/ validation.
    expect(isEvidenceStatusVersion("0.1.0-canary")).toBe(false);
  });

  it("non-numeric token: alpha inside a segment is legacy (codex P3)", () => {
    expect(isEvidenceStatusVersion("1.0x.0")).toBe(false);
  });

  it("whitespace/padded token is legacy (codex P3)", () => {
    expect(isEvidenceStatusVersion("0. 1.0")).toBe(false);
  });
});

// ---- resolveEvidenceStatus ----

describe("resolveEvidenceStatus", () => {
  // Helper factories.
  function make010Row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      s4_schema_version: "0.1.0",
      evidence_present: true,
      evidence_signal_counts: {
        total_cited: 5,
        supporting: 3,
        negating: 1,
        absence_or_category_mismatch: 0,
        neutral: 1,
      },
      confidence: 0.88,
      confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
      evidence_synthesis_self_score: {
        appropriateness: 2.5,
        sufficiency: 2.0,
        banned_phrase_hits: [],
      },
      raw_result_json: {
        schema_version: "0.1.0",
        indigenous_content_signal: {
          matched: false,
          trigger_keywords_matched: [],
          detector_version: "indigenous_v1",
        },
      },
      ...overrides,
    };
  }

  function make001Row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      s4_schema_version: "0.0.1",
      verdict_suggestion: "PASS",
      ai_suggestion: "PASS",
      confidence: 0.92,
      evidence_synthesis_self_score: null,
      raw_result_json: {
        schema_version: "0.0.1",
      },
      ...overrides,
    };
  }

  // ---- version + isEvidenceStatus ----

  it("0.1.0 row resolves isEvidenceStatus=true", () => {
    const status = resolveEvidenceStatus(make010Row());
    expect(status.version).toBe("0.1.0");
    expect(status.isEvidenceStatus).toBe(true);
  });

  it("0.0.1 row resolves isEvidenceStatus=false", () => {
    const status = resolveEvidenceStatus(make001Row());
    expect(status.version).toBe("0.0.1");
    expect(status.isEvidenceStatus).toBe(false);
  });

  // ---- 0.1.0 columns populated -> fields returned ----

  it("0.1.0 row with columns populated returns evidence fields from columns", () => {
    const status = resolveEvidenceStatus(make010Row());
    expect(status.present).toBe(true);
    expect(status.signalCounts).toMatchObject({ total_cited: 5, supporting: 3 });
    expect(status.confidence).toBe(0.88);
    expect(status.confidenceScope).toBe("EVIDENCE_MATCH_NOT_ADEQUACY");
    expect(status.synthesisSelfScore).toMatchObject({
      appropriateness: 2.5,
      sufficiency: 2.0,
      banned_phrase_hits: [],
    });
  });

  // ---- column-first: column wins over raw_result_json value ----

  it("column value wins over raw_result_json value when both present", () => {
    const row = make010Row({
      evidence_present: true,
      evidence_signal_counts: { total_cited: 5, supporting: 3, negating: 1, absence_or_category_mismatch: 0, neutral: 1 },
      raw_result_json: {
        schema_version: "0.1.0",
        evidence_present: false,
        evidence_signal_counts: { total_cited: 99 },
        indigenous_content_signal: { matched: false, trigger_keywords_matched: [], detector_version: "v1" },
      },
    });
    const status = resolveEvidenceStatus(row);
    expect(status.present).toBe(true);
    expect(status.signalCounts?.total_cited).toBe(5);
  });

  // ---- explicit falsy column wins over truthy raw (locks ?? not || semantics) ----

  it("explicit falsy column value (false / 0) is honored over a truthy raw fallback", () => {
    // Discriminating case: passes under ?? but FAILS under ||. Guards against a
    // future refactor silently dropping false/0 honoring (Opus review P2).
    const row = make010Row({
      evidence_present: false,
      confidence: 0,
      raw_result_json: {
        schema_version: "0.1.0",
        evidence_present: true,
        confidence: 0.9,
        indigenous_content_signal: {
          matched: false,
          trigger_keywords_matched: [],
          detector_version: "v1",
        },
      },
    });
    const status = resolveEvidenceStatus(row);
    expect(status.present).toBe(false);
    expect(status.confidence).toBe(0);
  });

  // ---- NULL columns but populated raw_result_json -> fallback path ----

  it("0.1.0 row with NULL columns recovers fields from raw_result_json fallback", () => {
    const row = {
      s4_schema_version: "0.1.0",
      evidence_present: null,
      evidence_signal_counts: null,
      confidence: null,
      confidence_scope: null,
      evidence_synthesis_self_score: null,
      raw_result_json: {
        schema_version: "0.1.0",
        evidence_present: false,
        evidence_signal_counts: {
          total_cited: 2,
          supporting: 0,
          negating: 2,
          absence_or_category_mismatch: 0,
          neutral: 0,
        },
        confidence: 0.55,
        confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
        evidence_synthesis_self_score: {
          appropriateness: 1.5,
          sufficiency: 1.0,
          banned_phrase_hits: [],
        },
        indigenous_content_signal: {
          matched: false,
          trigger_keywords_matched: [],
          detector_version: "v1",
        },
      },
    };
    const status = resolveEvidenceStatus(row);
    expect(status.present).toBe(false);
    expect(status.signalCounts?.total_cited).toBe(2);
    expect(status.signalCounts?.negating).toBe(2);
    expect(status.confidence).toBe(0.55);
    expect(status.confidenceScope).toBe("EVIDENCE_MATCH_NOT_ADEQUACY");
    expect(status.synthesisSelfScore?.appropriateness).toBe(1.5);
  });

  // ---- indigenous_content_signal reads from raw_result_json ----

  it("indigenousMatched is true when raw_result_json.indigenous_content_signal.matched is true", () => {
    const row = make010Row({
      raw_result_json: {
        schema_version: "0.1.0",
        indigenous_content_signal: {
          matched: true,
          trigger_keywords_matched: ["traditional garden", "fishing"],
          detector_version: "indigenous_v2",
        },
      },
    });
    const status = resolveEvidenceStatus(row);
    expect(status.indigenousMatched).toBe(true);
    expect(status.indigenousKeywords).toEqual(["traditional garden", "fishing"]);
  });

  it("indigenousMatched is false when matched is false", () => {
    const status = resolveEvidenceStatus(make010Row());
    expect(status.indigenousMatched).toBe(false);
    expect(status.indigenousKeywords).toEqual([]);
  });

  it("indigenousMatched is false when indigenous_content_signal is absent from raw", () => {
    const row = make010Row({
      raw_result_json: { schema_version: "0.1.0" },
    });
    const status = resolveEvidenceStatus(row);
    expect(status.indigenousMatched).toBe(false);
    expect(status.indigenousKeywords).toEqual([]);
  });

  // ---- sortKey is finite for both versions ----

  it("sortKey is a finite number for 0.1.0 present=true", () => {
    const status = resolveEvidenceStatus(make010Row());
    expect(Number.isFinite(status.sortKey)).toBe(true);
  });

  it("sortKey is a finite number for 0.0.1 legacy row", () => {
    const status = resolveEvidenceStatus(make001Row());
    expect(Number.isFinite(status.sortKey)).toBe(true);
  });

  it("0.1.0 present=true sorts before present=false (lower sortKey)", () => {
    const presentTrue = resolveEvidenceStatus(make010Row({ evidence_present: true }));
    const presentFalse = resolveEvidenceStatus(
      make010Row({ evidence_present: false }),
    );
    expect(presentTrue.sortKey).toBeLessThan(presentFalse.sortKey);
  });

  it("within 0.1.0 present=true, more supporting -> lower sortKey", () => {
    const highSupport = resolveEvidenceStatus(
      make010Row({
        evidence_signal_counts: {
          total_cited: 10,
          supporting: 8,
          negating: 1,
          absence_or_category_mismatch: 0,
          neutral: 1,
        },
      }),
    );
    const lowSupport = resolveEvidenceStatus(
      make010Row({
        evidence_signal_counts: {
          total_cited: 5,
          supporting: 1,
          negating: 3,
          absence_or_category_mismatch: 0,
          neutral: 1,
        },
      }),
    );
    expect(highSupport.sortKey).toBeLessThan(lowSupport.sortKey);
  });

  it("0.1.0 rows sort before legacy 0.0.1 rows (bands do not overlap)", () => {
    const ev = resolveEvidenceStatus(make010Row({ evidence_present: false }));
    const legacy = resolveEvidenceStatus(make001Row({ verdict_suggestion: "PASS" }));
    expect(ev.sortKey).toBeLessThan(legacy.sortKey);
  });

  // ---- legacy row has null evidence fields ----

  it("legacy 0.0.1 row has null present / signalCounts / synthesisSelfScore", () => {
    const status = resolveEvidenceStatus(make001Row());
    expect(status.present).toBeNull();
    expect(status.signalCounts).toBeNull();
    expect(status.synthesisSelfScore).toBeNull();
    expect(status.indigenousMatched).toBe(false);
  });

  // ---- malformed input does not throw ----

  it("does not throw on completely empty row", () => {
    expect(() => resolveEvidenceStatus({})).not.toThrow();
    const status = resolveEvidenceStatus({});
    expect(status.version).toBe("0.0.1");
    expect(status.isEvidenceStatus).toBe(false);
    expect(Number.isFinite(status.sortKey)).toBe(true);
  });

  it("does not throw when raw_result_json is an unexpected type", () => {
    expect(() =>
      resolveEvidenceStatus({ raw_result_json: "not-an-object" as unknown as Record<string, unknown> }),
    ).not.toThrow();
  });
});

// ---- formatEvidenceStatusSummary ----

describe("formatEvidenceStatusSummary", () => {
  function makeStatus(overrides: Partial<EvidenceStatus> = {}): EvidenceStatus {
    return {
      version: "0.1.0",
      isEvidenceStatus: true,
      present: true,
      signalCounts: { total_cited: 5, supporting: 3, negating: 1, absence_or_category_mismatch: 0, neutral: 1 },
      confidence: 0.88,
      confidenceScope: "EVIDENCE_MATCH_NOT_ADEQUACY",
      synthesisSelfScore: null,
      indigenousMatched: false,
      indigenousKeywords: [],
      sortKey: 996,
      ...overrides,
    };
  }

  it("present=true with full signalCounts returns 'Evidence present (...)'", () => {
    const result = formatEvidenceStatusSummary(makeStatus());
    expect(result).toBe("Evidence present (5 cited / 3 support / 1 negate)");
  });

  it("present=false with full signalCounts returns 'Evidence absent (...)'", () => {
    const result = formatEvidenceStatusSummary(
      makeStatus({ present: false, sortKey: 1000 }),
    );
    expect(result).toBe("Evidence absent (5 cited / 3 support / 1 negate)");
  });

  it("present=true with null signalCounts returns 'Evidence present' (no parens)", () => {
    const result = formatEvidenceStatusSummary(
      makeStatus({ signalCounts: null }),
    );
    expect(result).toBe("Evidence present");
  });

  it("present=false with null signalCounts returns 'Evidence absent'", () => {
    const result = formatEvidenceStatusSummary(
      makeStatus({ present: false, signalCounts: null, sortKey: 1000 }),
    );
    expect(result).toBe("Evidence absent");
  });

  it("present=null returns 'Evidence status unknown'", () => {
    const result = formatEvidenceStatusSummary(
      makeStatus({ present: null, signalCounts: null, sortKey: 2400 }),
    );
    expect(result).toBe("Evidence status unknown");
  });

  it("omits keys that are absent (undefined) from signalCounts", () => {
    const result = formatEvidenceStatusSummary(
      makeStatus({ signalCounts: { total_cited: 3 } }),
    );
    // Only total_cited is present; supporting and negating are absent.
    expect(result).toBe("Evidence present (3 cited)");
    expect(result).not.toContain("support");
    expect(result).not.toContain("negate");
  });

  it("returns 'Evidence present' (no parens) when all signalCounts keys are absent", () => {
    const result = formatEvidenceStatusSummary(
      makeStatus({ signalCounts: {} }),
    );
    expect(result).toBe("Evidence present");
  });

  it("never includes adequacy/verdict/tier words", () => {
    const result = formatEvidenceStatusSummary(makeStatus());
    expect(result.toLowerCase()).not.toContain("adequacy");
    expect(result.toLowerCase()).not.toContain("verdict");
    expect(result.toLowerCase()).not.toContain("tier");
  });

  it("is plain ASCII (all code points <= 127)", () => {
    const result = formatEvidenceStatusSummary(makeStatus());
    for (let i = 0; i < result.length; i++) {
      expect(result.charCodeAt(i)).toBeLessThanOrEqual(127);
    }
  });
});

// ---- surfaceableConfidence (P3: shared scope-gate for controls + export) ----

describe("surfaceableConfidence", () => {
  it("scoped 0.1.0 row returns the resolved confidence", () => {
    expect(
      surfaceableConfidence({
        s4_schema_version: "0.1.0",
        confidence: 0.82,
        confidence_scope: "EVIDENCE_MATCH_NOT_ADEQUACY",
        raw_result_json: { schema_version: "0.1.0" },
      }),
    ).toBe(0.82);
  });

  it("unscoped 0.1.0 row returns null (no surfaceable confidence)", () => {
    expect(
      surfaceableConfidence({
        s4_schema_version: "0.1.0",
        confidence: 0.82,
        confidence_scope: null,
        raw_result_json: { schema_version: "0.1.0" },
      }),
    ).toBeNull();
  });

  it("0.1.0 row with a wrong confidence_scope returns null", () => {
    expect(
      surfaceableConfidence({
        s4_schema_version: "0.1.0",
        confidence: 0.82,
        confidence_scope: "SOMETHING_ELSE",
        raw_result_json: { schema_version: "0.1.0" },
      }),
    ).toBeNull();
  });

  it("legacy 0.0.1 row returns its confidence", () => {
    expect(
      surfaceableConfidence({
        s4_schema_version: "0.0.1",
        confidence: 0.5,
        raw_result_json: { schema_version: "0.0.1" },
      }),
    ).toBe(0.5);
  });

  it("legacy row with null confidence returns null", () => {
    expect(
      surfaceableConfidence({
        s4_schema_version: "0.0.1",
        confidence: null,
        raw_result_json: { schema_version: "0.0.1" },
      }),
    ).toBeNull();
  });
});
