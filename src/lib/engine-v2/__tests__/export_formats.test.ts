// Unit tests for engine_v2 Lane 2d / Module L2d-3 export_formats.ts.
//
// Coverage:
//   - CSV: header row, data row count, escape (comma/quote/newline/CR), UNJUDGED_MARKER.
//   - Markdown: header table, escape (pipe + newline), locale-locked dates.
//   - HTML: HTML5 doctype, escape (& < > " '), table structure.
//   - Tier discretion invariants:
//       TIER_2 + ADEQUATE -> throws ExportInvariantError (CSV / MD / HTML).
//       TIER_3 + non-OBSERVATION_ONLY -> throws ExportInvariantError.
//       Unjudged TIER_2 / TIER_3 rows render with "Not yet judged".
//   - Filename + MIME descriptors are ASCII + ext-correct.

import { describe, expect, it } from "vitest";

import {
  buildExportFilename,
  ExportInvariantError,
  generateCSV,
  generateExport,
  generateHTML,
  generateMarkdown,
  getFormatDescriptor,
  UNJUDGED_MARKER,
  type ExportInput,
} from "../export_formats";
import type {
  JudgmentTier,
  JudgmentVerdict,
  V2Evaluation,
  V2Judgment,
  V2PerPolicyResult,
} from "../types_lane2";
import type { V2Project } from "../types";

// --- Fixtures -------------------------------------------------------------

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const EVAL_ID = "22222222-2222-4222-8222-222222222222";
const NOW_ISO = "2026-05-13T12:00:00.000Z";
const GEN_DATE = new Date("2026-05-13T18:30:00.000Z");

function makeProject(): Pick<V2Project, "id" | "name"> {
  return { id: PROJECT_ID, name: "Test Project Alpha" };
}

function makeEvaluation(): Pick<
  V2Evaluation,
  "id" | "bench_fixture" | "status" | "started_at" | "completed_at" | "updated_at"
> {
  return {
    id: EVAL_ID,
    bench_fixture: "bench_v0_3_2026_05_13",
    status: "completed",
    started_at: NOW_ISO,
    completed_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

function makeResult(
  id: string,
  policyId: string,
  tier: JudgmentTier | null,
  overrides: Partial<V2PerPolicyResult> = {},
): V2PerPolicyResult {
  return {
    id,
    evaluation_id: EVAL_ID,
    policy_id: policyId,
    stage: "S4",
    packet_id: null,
    tier,
    verdict_suggestion: null,
    ai_suggestion: "PASS",
    confidence: 0.85,
    confidence_method: "rubric",
    summary: "A short summary.",
    evidence_packet: {},
    pathway_notes: {},
    rubric_self_score: null,
    raw_result_json: {},
    created_at: NOW_ISO,
    ...overrides,
  };
}

function makeJudgment(
  resultId: string,
  tier: JudgmentTier,
  verdict: JudgmentVerdict,
  rationale: string | null = "Looks good.",
): V2Judgment {
  return {
    id: `j-${resultId}`,
    per_policy_result_id: resultId,
    reviewer_user_id: "user-1",
    tier,
    verdict,
    rationale,
    evidence_refs: [],
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

function baseInput(opts: {
  results: V2PerPolicyResult[];
  judgments: V2Judgment[];
}): ExportInput {
  return {
    project: makeProject(),
    evaluation: makeEvaluation(),
    perPolicy: opts.results,
    judgments: opts.judgments,
    options: { generatedAt: GEN_DATE },
  };
}

// --- CSV ------------------------------------------------------------------

describe("generateCSV", () => {
  it("emits header + one data row per per-policy result", () => {
    const r1 = makeResult("r1", "POL-001", "TIER_1_BINARY");
    const r2 = makeResult("r2", "POL-002", "TIER_2_PROFESSIONAL");
    const j1 = makeJudgment("r1", "TIER_1_BINARY", "ADEQUATE");
    const j2 = makeJudgment("r2", "TIER_2_PROFESSIONAL", "DEFICIENT");

    const csv = generateCSV(baseInput({ results: [r1, r2], judgments: [j1, j2] }));
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe(
      "Policy ID,Tier,AI Suggestion,Confidence,Reviewer Verdict,Rationale,Summary,Reviewed At",
    );
    // TIER_1 sorts before TIER_2; both are present.
    expect(lines[1].startsWith("POL-001,TIER_1_BINARY,")).toBe(true);
    expect(lines[2].startsWith("POL-002,TIER_2_PROFESSIONAL,")).toBe(true);
  });

  it("escapes commas, double quotes, and newlines in field values", () => {
    const r = makeResult("r1", "POL,A", "TIER_1_BINARY", {
      summary: 'has "quote" inside',
    });
    const j = makeJudgment("r1", "TIER_1_BINARY", "ADEQUATE", "line1\nline2");
    const csv = generateCSV(baseInput({ results: [r], judgments: [j] }));
    expect(csv).toContain('"POL,A"');
    expect(csv).toContain('"has ""quote"" inside"');
    expect(csv).toContain('"line1\nline2"');
  });

  it("renders unjudged rows with the Not yet judged marker", () => {
    const r = makeResult("r1", "POL-XYZ", "TIER_1_BINARY");
    const csv = generateCSV(baseInput({ results: [r], judgments: [] }));
    expect(csv).toContain(UNJUDGED_MARKER);
  });

  // --- CWE-1236 CSV formula-injection neutralization ----------------------
  //
  // OWASP-recommended defense: prefix `'` to any field that begins with a
  // spreadsheet formula trigger character. The single-quote is rendered as
  // literal text by Excel / LibreOffice / Numbers and prevents formula
  // evaluation. Defense applies BEFORE quote-wrap so a prefixed field that
  // also contains commas / quotes / newlines is still RFC4180-correct.

  // Build a row whose policy_id starts with the given trigger character and
  // assert the CSV output's policy_id field begins with `'` followed by the
  // original text. We test against the policy_id column (column 0) so the
  // assertion is positional and unambiguous.
  function csvWithPolicyIdPrefix(prefixChar: string): {
    line: string;
    field: string;
  } {
    const policyId = prefixChar + "hostile-value";
    const r = makeResult("r1", policyId, "TIER_1_BINARY");
    const j = makeJudgment("r1", "TIER_1_BINARY", "ADEQUATE");
    const csv = generateCSV(baseInput({ results: [r], judgments: [j] }));
    const lines = csv.split("\r\n");
    // First data row is lines[1] (lines[0] is the header).
    const line = lines[1];
    const firstField = line.split(",")[0];
    return { line, field: firstField };
  }

  it.each([
    ["="],
    ["+"],
    ["-"],
    ["@"],
    ["\t"],
    ["\r"],
  ])(
    "CWE-1236: neutralizes formula-injection trigger %j by prefixing single-quote",
    (trigger) => {
      const { field } = csvWithPolicyIdPrefix(trigger);
      // The field MAY be quote-wrapped (it will be for "\r" because CR is a
      // separator-like character that triggers the RFC4180 wrap; also for
      // any trigger if the value contains other unsafe chars). For triggers
      // that do not require wrap, the field is the raw prefixed form.
      // Either way the FIRST visible character of the underlying value must
      // be the literal `'` followed by the trigger character.
      if (field.startsWith('"')) {
        // Wrapped form: `"'<trigger>hostile-value..."`
        expect(field.startsWith(`"'${trigger}`)).toBe(true);
      } else {
        // Unwrapped form: `'<trigger>hostile-value`
        expect(field.startsWith(`'${trigger}`)).toBe(true);
      }
      // The dangerous prefix is never the first character of the field.
      expect(field.startsWith(trigger)).toBe(false);
    },
  );

  it("CWE-1236: prefixes single-quote when the only character is '='", () => {
    const r = makeResult("r1", "=", "TIER_1_BINARY");
    const j = makeJudgment("r1", "TIER_1_BINARY", "ADEQUATE");
    const csv = generateCSV(baseInput({ results: [r], judgments: [j] }));
    const dataLine = csv.split("\r\n")[1];
    const firstField = dataLine.split(",")[0];
    // Field after neutralization is the two-character string `'=`. It
    // contains no commas / quotes / CR / LF so RFC4180 does not require
    // wrapping; the unwrapped form is therefore expected.
    expect(firstField).toBe("'=");
  });

  it("CWE-1236: leading dangerous char + embedded comma is wrapped after prefixing", () => {
    // rationale value "=cmd,calc" needs both formula-neutralization AND
    // quote-wrap (because it contains a comma). Confirm we get the
    // composed result: `"'=cmd,calc"`.
    const r = makeResult("r1", "POL-CWE", "TIER_1_BINARY");
    const j = makeJudgment(
      "r1",
      "TIER_1_BINARY",
      "ADEQUATE",
      "=cmd,calc",
    );
    const csv = generateCSV(baseInput({ results: [r], judgments: [j] }));
    expect(csv).toContain(`"'=cmd,calc"`);
    // Critically, the unprefixed dangerous form must NOT appear.
    expect(csv).not.toContain(`"=cmd,calc"`);
  });

  it("CWE-1236: does not prefix when leading character is safe", () => {
    // Sanity guard: a normal alphanumeric leading char must NOT receive the
    // single-quote prefix (we would otherwise corrupt every export).
    const r = makeResult("r1", "POL-SAFE", "TIER_1_BINARY");
    const j = makeJudgment(
      "r1",
      "TIER_1_BINARY",
      "ADEQUATE",
      "Looks reasonable.",
    );
    const csv = generateCSV(baseInput({ results: [r], judgments: [j] }));
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine.startsWith("POL-SAFE,")).toBe(true);
    // Rationale column (index 5) must NOT be prefixed.
    const fields = dataLine.split(",");
    expect(fields[5].startsWith("'")).toBe(false);
  });

  it("CWE-1236: defense applies to ALL columns (summary + rationale + policy_id)", () => {
    // Hostile values in three different columns; all three must be
    // neutralized.
    const r = makeResult("r1", "-PolicyStartsWithDash", "TIER_1_BINARY", {
      summary: "@MentionAtStart",
    });
    const j = makeJudgment(
      "r1",
      "TIER_1_BINARY",
      "ADEQUATE",
      "+1.5 leading-plus",
    );
    const csv = generateCSV(baseInput({ results: [r], judgments: [j] }));
    const dataLine = csv.split("\r\n")[1];
    const fields = dataLine.split(",");
    // policy_id (col 0) - starts with `-`, must be prefixed.
    expect(fields[0].startsWith("'-")).toBe(true);
    // rationale (col 5) - starts with `+`, must be prefixed.
    expect(fields[5].startsWith("'+")).toBe(true);
    // summary (col 6) - starts with `@`, must be prefixed.
    expect(fields[6].startsWith("'@")).toBe(true);
  });

  it("CWE-1236: MD and HTML do NOT prefix (no formula attack surface)", () => {
    // MD and HTML are not interpreted by spreadsheet engines; prefixing
    // every leading dash / plus / equals / at-sign would visibly corrupt
    // valid content (e.g., a policy_id that legitimately starts with `-`).
    const r = makeResult("r1", "-LeadingDash", "TIER_1_BINARY");
    const j = makeJudgment(
      "r1",
      "TIER_1_BINARY",
      "ADEQUATE",
      "=cmd|calc",
    );
    const md = generateMarkdown(
      baseInput({ results: [r], judgments: [j] }),
    );
    const html = generateHTML(
      baseInput({ results: [r], judgments: [j] }),
    );
    // Original leading-dash policy id appears verbatim in MD (cell border
    // syntax `| -LeadingDash |`).
    expect(md).toContain("| -LeadingDash |");
    // Original `=cmd|calc` rationale (with escaped pipe) appears in MD.
    expect(md).toContain("=cmd\\|calc");
    // HTML carries the verbatim values (HTML-escaped, no formula prefix).
    expect(html).toContain(">-LeadingDash<");
    expect(html).toContain(">=cmd|calc<");
  });

  it("never emits ADEQUATE on a TIER_2_PROFESSIONAL row", () => {
    // Mock-built fixture violates the constraint. Expect the generator to
    // throw rather than render the invalid row.
    const r = makeResult("r1", "POL-T2", "TIER_2_PROFESSIONAL");
    // Build a judgment whose tier is TIER_2 + verdict ADEQUATE -- this is what
    // would slip through if the DB CHECK trigger failed (defence-in-depth).
    const badJudgment: V2Judgment = makeJudgment(
      "r1",
      "TIER_2_PROFESSIONAL",
      // The type system blocks this at compile time via ALLOWED_VERDICTS_BY_TIER,
      // but the verdict field is JudgmentVerdict broadly. Use a cast to simulate
      // a corrupt row from the DB.
      "ADEQUATE" as JudgmentVerdict,
    );
    expect(() =>
      generateCSV(baseInput({ results: [r], judgments: [badJudgment] })),
    ).toThrow(ExportInvariantError);
  });

  it("never emits non-OBSERVATION_ONLY on a TIER_3_STATUTORY row", () => {
    const r = makeResult("r1", "POL-T3", "TIER_3_STATUTORY");
    const badJudgment: V2Judgment = makeJudgment(
      "r1",
      "TIER_3_STATUTORY",
      "INADEQUATE" as JudgmentVerdict,
    );
    expect(() =>
      generateCSV(baseInput({ results: [r], judgments: [badJudgment] })),
    ).toThrow(ExportInvariantError);
  });
});

// --- Markdown -------------------------------------------------------------

describe("generateMarkdown", () => {
  it("emits a markdown table with header + escape rules", () => {
    const r1 = makeResult("r1", "POL-1", "TIER_1_BINARY");
    const j1 = makeJudgment(
      "r1",
      "TIER_1_BINARY",
      "ADEQUATE",
      "pipe | inside and\nnewline",
    );
    const md = generateMarkdown(
      baseInput({ results: [r1], judgments: [j1] }),
    );
    expect(md).toContain("# Test Project Alpha: Regulatory Review Export");
    expect(md).toMatch(/\| Policy ID \| Tier \|/);
    expect(md).toMatch(/\|-+\|-+\|/);
    // Pipe escape:
    expect(md).toContain("pipe \\| inside and newline");
  });

  it("renders unjudged rows with marker", () => {
    const r = makeResult("r1", "POL-Z", "TIER_2_PROFESSIONAL");
    const md = generateMarkdown(baseInput({ results: [r], judgments: [] }));
    expect(md).toContain(UNJUDGED_MARKER);
  });

  it("locale-locks dates to en-US", () => {
    // Completion date in NOW_ISO -> "May 13, 2026" in en-US long format.
    const r = makeResult("r1", "POL-1", "TIER_1_BINARY");
    const j = makeJudgment("r1", "TIER_1_BINARY", "ADEQUATE");
    const md = generateMarkdown(baseInput({ results: [r], judgments: [j] }));
    expect(md).toContain("May 13, 2026");
  });

  it("never emits ADEQUATE on a TIER_2 row", () => {
    const r = makeResult("r1", "POL-1", "TIER_2_PROFESSIONAL");
    const bad: V2Judgment = makeJudgment(
      "r1",
      "TIER_2_PROFESSIONAL",
      "ADEQUATE" as JudgmentVerdict,
    );
    expect(() =>
      generateMarkdown(baseInput({ results: [r], judgments: [bad] })),
    ).toThrow(ExportInvariantError);
  });

  it("never emits non-OBSERVATION_ONLY on a TIER_3 row", () => {
    const r = makeResult("r1", "POL-3", "TIER_3_STATUTORY");
    const bad: V2Judgment = makeJudgment(
      "r1",
      "TIER_3_STATUTORY",
      "DEFICIENT" as JudgmentVerdict,
    );
    expect(() =>
      generateMarkdown(baseInput({ results: [r], judgments: [bad] })),
    ).toThrow(ExportInvariantError);
  });
});

// --- HTML ----------------------------------------------------------------

describe("generateHTML", () => {
  it("emits valid-shaped HTML5 with doctype + table structure", () => {
    const r = makeResult("r1", "POL-H1", "TIER_1_BINARY");
    const j = makeJudgment("r1", "TIER_1_BINARY", "ADEQUATE");
    const html = generateHTML(baseInput({ results: [r], judgments: [j] }));
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<head>");
    expect(html).toContain("</head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
    expect(html).toContain("</html>");
    expect(html).toContain("<table>");
    expect(html).toContain("<thead>");
    expect(html).toContain("<tbody>");
  });

  it("escapes & < > \" ' in field values", () => {
    const r = makeResult("r1", "POL<&\"'>", "TIER_1_BINARY", {
      summary: "a & b < c > d \"q\" 'apostrophe'",
    });
    const j = makeJudgment(
      "r1",
      "TIER_1_BINARY",
      "ADEQUATE",
      "<script>alert(1)</script>",
    );
    const html = generateHTML(baseInput({ results: [r], judgments: [j] }));
    expect(html).toContain("POL&lt;&amp;&quot;&#39;&gt;");
    expect(html).toContain(
      "a &amp; b &lt; c &gt; d &quot;q&quot; &#39;apostrophe&#39;",
    );
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("renders unjudged rows with the marker", () => {
    const r = makeResult("r1", "POL-Z", "TIER_3_STATUTORY");
    const html = generateHTML(baseInput({ results: [r], judgments: [] }));
    expect(html).toContain(UNJUDGED_MARKER);
  });

  it("locale-locks dates to en-US", () => {
    const r = makeResult("r1", "POL-1", "TIER_1_BINARY");
    const j = makeJudgment("r1", "TIER_1_BINARY", "ADEQUATE");
    const html = generateHTML(baseInput({ results: [r], judgments: [j] }));
    expect(html).toContain("May 13, 2026");
  });

  it("never emits ADEQUATE on a TIER_2 row", () => {
    const r = makeResult("r1", "POL-1", "TIER_2_PROFESSIONAL");
    const bad: V2Judgment = makeJudgment(
      "r1",
      "TIER_2_PROFESSIONAL",
      "ADEQUATE" as JudgmentVerdict,
    );
    expect(() =>
      generateHTML(baseInput({ results: [r], judgments: [bad] })),
    ).toThrow(ExportInvariantError);
  });

  it("never emits non-OBSERVATION_ONLY on a TIER_3 row", () => {
    const r = makeResult("r1", "POL-3", "TIER_3_STATUTORY");
    const bad: V2Judgment = makeJudgment(
      "r1",
      "TIER_3_STATUTORY",
      "REQUIRES_REVIEW" as JudgmentVerdict,
    );
    expect(() =>
      generateHTML(baseInput({ results: [r], judgments: [bad] })),
    ).toThrow(ExportInvariantError);
  });
});

// --- Dispatch + descriptors ------------------------------------------------

describe("generateExport (dispatch) + descriptors", () => {
  it("dispatches to the right format generator", () => {
    const r = makeResult("r1", "POL-D", "TIER_1_BINARY");
    const j = makeJudgment("r1", "TIER_1_BINARY", "ADEQUATE");
    const input = baseInput({ results: [r], judgments: [j] });
    const csv = generateExport("csv", input);
    const md = generateExport("md", input);
    const html = generateExport("html", input);
    expect(csv).toBe(generateCSV(input));
    expect(md).toBe(generateMarkdown(input));
    expect(html).toBe(generateHTML(input));
  });

  it("getFormatDescriptor returns ASCII MIME + correct extension", () => {
    expect(getFormatDescriptor("csv").ext).toBe("csv");
    expect(getFormatDescriptor("md").ext).toBe("md");
    expect(getFormatDescriptor("html").ext).toBe("html");
    expect(getFormatDescriptor("csv").mime).toMatch(/^text\/csv/);
    expect(getFormatDescriptor("md").mime).toMatch(/^text\/markdown/);
    expect(getFormatDescriptor("html").mime).toMatch(/^text\/html/);
  });

  it("buildExportFilename is ASCII-only and has the right extension", () => {
    const fnameCsv = buildExportFilename("csv", EVAL_ID);
    const fnameMd = buildExportFilename("md", EVAL_ID);
    const fnameHtml = buildExportFilename("html", EVAL_ID);
    // Plain ASCII: every char between 0x20 and 0x7E.
    for (const f of [fnameCsv, fnameMd, fnameHtml]) {
      for (const ch of f) {
        const cp = ch.codePointAt(0)!;
        expect(cp).toBeGreaterThanOrEqual(0x20);
        expect(cp).toBeLessThanOrEqual(0x7e);
      }
    }
    expect(fnameCsv.endsWith(".csv")).toBe(true);
    expect(fnameMd.endsWith(".md")).toBe(true);
    expect(fnameHtml.endsWith(".html")).toBe(true);
  });
});
