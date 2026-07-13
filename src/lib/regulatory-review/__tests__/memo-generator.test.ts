import { describe, expect, it } from "vitest";

import {
  calculateStats,
  filterAssessments,
  generateMarkdown,
  generateHTML,
  generateCSV,
  generateWordHTML,
  generatePreview,
  type LocalAssessment,
  type LocalJudgment,
  type ExportOptions,
  type MemoData,
} from "../memo-generator";

function makeAssessment(overrides: Partial<LocalAssessment> = {}): LocalAssessment {
  return {
    id: "a1",
    policyId: "POL-1",
    policyTitle: "Test Policy",
    section: "General",
    tier: "TIER_1_BINARY",
    status: "pass",
    evidence: [],
    notes: "Notes",
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

function makeJudgment(overrides: Partial<LocalJudgment> = {}): LocalJudgment {
  return {
    humanResult: "ACCEPT",
    humanConfidence: "HIGH",
    evidenceSufficiency: "SUFFICIENT",
    reviewStatus: "COMPLETED",
    ...overrides,
  };
}

function baseInput(opts: {
  assessments: LocalAssessment[];
  judgments: LocalJudgment[];
  optionsOverrides?: Partial<ExportOptions>;
}): { data: MemoData; options: ExportOptions } {
  const judgmentsMap = new Map<string, LocalJudgment>();
  opts.assessments.forEach((a, i) => {
    if (opts.judgments[i]) {
      judgmentsMap.set(a.id, opts.judgments[i]);
    }
  });

  return {
    data: {
      submissionId: "SUB-123",
      siteId: "SITE-456",
      assessments: opts.assessments,
      judgments: judgmentsMap,
    },
    options: {
      format: "markdown",
      memoType: "interim",
      includePending: true,
      twoColumnFormat: false,
      includeEvidence: true,
      onlyNeedsAttention: false,
      ...opts.optionsOverrides,
    },
  };
}

describe("memo-generator pure exports", () => {
  describe("calculateStats", () => {
    it("handles empty assessments with no divide-by-zero (all zero counts)", () => {
      const stats = calculateStats([], new Map());
      expect(stats.total).toBe(0);
      expect(stats.reviewed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.deferred).toBe(0);
      expect(stats.sufficient).toBe(0);
      expect(stats.insufficient).toBe(0);
      expect(stats.needsMoreEvidence).toBe(0);
      expect(stats.unreviewed).toBe(0);
    });

    it("percentages are 0 not NaN when empty in markdown generation", () => {
      const { data, options } = baseInput({ assessments: [], judgments: [] });
      const md = generateMarkdown(data, options);
      expect(md).toContain("Reviewed: 0 (0%)");
    });
  });

  describe("filterAssessments", () => {
    it("date-range excludes items with no reviewedAt", () => {
      const a = makeAssessment({ id: "a1", reviewedAt: null });
      const j = makeJudgment({ reviewedAt: undefined });
      const { data, options } = baseInput({
        assessments: [a],
        judgments: [j],
        optionsOverrides: { dateFrom: new Date("2026-01-01T00:00:00Z") },
      });
      const filtered = filterAssessments(data.assessments, data.judgments, options);
      expect(filtered.length).toBe(0);
    });

    it("onlyNeedsAttention includes fail, pending, flagged and excludes pass", () => {
      const aPass = makeAssessment({ id: "a1", status: "pass" });
      const aFail = makeAssessment({ id: "a2", status: "fail" });
      const aPending = makeAssessment({ id: "a3", status: "pending" });
      const aFlagged = makeAssessment({ id: "a4", status: "flagged" });
      
      const { data, options } = baseInput({
        assessments: [aPass, aFail, aPending, aFlagged],
        judgments: [],
        optionsOverrides: { onlyNeedsAttention: true },
      });
      const filtered = filterAssessments(data.assessments, data.judgments, options);
      expect(filtered.map(a => a.id)).toEqual(["a2", "a3", "a4"]);
    });

    it("includePending false excludes unreviewed items", () => {
      const a1 = makeAssessment({ id: "a1" });
      const j1 = makeJudgment({ reviewStatus: "PENDING" });
      
      const a2 = makeAssessment({ id: "a2" });
      const j2 = makeJudgment({ reviewStatus: "COMPLETED" });

      const { data, options } = baseInput({
        assessments: [a1, a2],
        judgments: [j1, j2],
        optionsOverrides: { includePending: false },
      });
      const filtered = filterAssessments(data.assessments, data.judgments, options);
      expect(filtered.map(a => a.id)).toEqual(["a2"]);
    });

    it("memoType 'final' excludes non-includeInFinal items", () => {
      const a1 = makeAssessment({ id: "a1" });
      const j1 = makeJudgment({ includeInFinal: false });
      
      const a2 = makeAssessment({ id: "a2" });
      const j2 = makeJudgment({ includeInFinal: true });

      const { data, options } = baseInput({
        assessments: [a1, a2],
        judgments: [j1, j2],
        optionsOverrides: { memoType: "final" },
      });
      const filtered = filterAssessments(data.assessments, data.judgments, options);
      expect(filtered.map(a => a.id)).toEqual(["a2"]);
    });
  });

  describe("generateCSV", () => {
    it("escapes fields with comma/quote/newline", () => {
      const a = makeAssessment({ 
        policyId: "POL,1",
        section: 'Sec"tion',
        policyTitle: "Line1\nLine2"
      });
      const { data, options } = baseInput({ assessments: [a], judgments: [] });
      const csv = generateCSV(data, options);
      
      expect(csv).toContain('"POL,1"');
      expect(csv).toContain('"Sec""tion"');
      expect(csv).toContain('"Line1\nLine2"');
    });

    it("neutralizes CSV injection prefixes", () => {
      // The source escapeCSV should mitigate = + - @ \t \r
      const triggers = ["=cmd|calc", "+1", "-2", "@SUM", "\tval", "\rval"];
      for (const t of triggers) {
        const a = makeAssessment({ policyId: t });
        const { data, options } = baseInput({ assessments: [a], judgments: [] });
        const csv = generateCSV(data, options);
        // It should prepend a single quote
        expect(csv).toContain("'" + t);
      }
    });
  });

  describe("generateHTML", () => {
    it("escapes XSS chars < > & \" ' per escapeHtml", () => {
      const a = makeAssessment({ 
        policyTitle: '<script>alert("1" & \'2\')</script>'
      });
      const { data, options } = baseInput({ assessments: [a], judgments: [] });
      const html = generateHTML(data, options);
      
      expect(html).toContain("&lt;script&gt;alert(&quot;1&quot; &amp; &#039;2&#039;)&lt;/script&gt;");
      expect(html).not.toContain("<script>");
    });
  });

  describe("citation label fallback", () => {
    it("falls back to policyId when citationLabel is absent", () => {
      const a = makeAssessment({ policyId: "POL-007", citationLabel: undefined });
      const { data, options } = baseInput({ assessments: [a], judgments: [] });
      const md = generateMarkdown(data, options);
      expect(md).toContain("### POL-007 - General");
    });

    it("uses citationLabel if present", () => {
      const a = makeAssessment({ policyId: "POL-007", citationLabel: "CIT-001" });
      const { data, options } = baseInput({ assessments: [a], judgments: [] });
      const md = generateMarkdown(data, options);
      expect(md).toContain("### CIT-001 - General");
      expect(md).toContain("**Internal ID:** POL-007");
    });
  });
  
  describe("generateWordHTML and generatePreview", () => {
    it("generateWordHTML outputs word compatible html with mso headers", () => {
      const { data, options } = baseInput({ assessments: [], judgments: [] });
      const wordHtml = generateWordHTML(data, options);
      expect(wordHtml).toContain("urn:schemas-microsoft-com:office:office");
    });
    
    it("generatePreview limits to maxItems", () => {
      const a1 = makeAssessment({ id: "a1" });
      const a2 = makeAssessment({ id: "a2" });
      const a3 = makeAssessment({ id: "a3" });
      const { data, options } = baseInput({ assessments: [a1, a2, a3], judgments: [] });
      
      const preview = generatePreview(data, options, 2);
      expect(preview).toContain("POL-1");
      expect(preview.match(/POL-1/g)?.length).toBe(2);
      // But it's simpler to assert that it generated a markdown format by default.
      expect(typeof preview).toBe("string");
    });
  });
});
