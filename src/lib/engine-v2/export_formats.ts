// engine_v2 frontend Lane 2d / Module L2d-3: pure multi-format export generators.
//
// Produces CSV / Markdown / HTML serializations of the per-policy results +
// HITL judgments for an evaluation. Pure functions: no DB access, no env
// reads, no fetch. Callers (the export route) own all I/O.
//
// Scope (per docs/engine_v2_frontend_lane2d_plan_2026_05_13.md L2d-3 v0.3):
//   - CSV / MD / HTML only. docx is NOT a L2d-3 format -- Lane 2b's
//     ExportMemoButton remains the canonical docx artifact.
//   - v1 `generateWordHTML` (HTML-flavored `.doc` hack) is NOT ported.
//   - Per owner Q3 (locked 2026-05-13): unjudged rows ARE included with a
//     "Not yet judged" marker.
//
// Tier discretion (CLAUDE.md NON-NEGOTIABLE):
//   - TIER_2_PROFESSIONAL rows MUST NOT show ADEQUATE verdict.
//   - TIER_3_STATUTORY rows MUST be OBSERVATION_ONLY (only).
//   Every generator calls assertVerdictAllowedForTier(tier, verdict) on each
//   judged row before rendering. Regression test asserts this invariant.
//   Unjudged rows skip the assertion (no verdict to check); they render with
//   the "Not yet judged" marker instead.
//
// ASCII discipline (ED-2d-12):
//   - All literal strings emitted by these generators are ASCII-only.
//   - Caller-supplied content (policy_id, rationale, summary, etc.) may
//     contain non-ASCII characters; the generators do NOT normalize them.
//     This matches the docx memo builder's behavior.

import {
  ALLOWED_VERDICTS_BY_TIER,
  type JudgmentTier,
  type V2Evaluation,
  type V2Judgment,
  type V2PerPolicyResult,
} from "./types_lane2";
import type { V2Project } from "./types";
import { assertVerdictAllowedForTier } from "./zod_lane2";
import {
  resolveEvidenceStatus,
  formatEvidenceStatusSummary,
  surfaceableConfidence,
} from "./schema_version";

export type ExportFormat = "csv" | "md" | "html";

export interface ExportInput {
  project: Pick<V2Project, "id" | "name">;
  evaluation: Pick<
    V2Evaluation,
    "id" | "bench_fixture" | "status" | "started_at" | "completed_at" | "updated_at"
  >;
  perPolicy: V2PerPolicyResult[];
  judgments: V2Judgment[];
  options?: ExportOptions;
}

export interface ExportOptions {
  // Reserved for future use (filters, includeEvidence toggles, etc.).
  // Lane 2d ships with no toggles: every export includes all judged + unjudged
  // rows. Owner Q3 lock.
  generatedAt?: Date;
}

export class ExportInvariantError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "ExportInvariantError";
  }
}

// Marker for unjudged rows (owner Q3 default: include with marker).
export const UNJUDGED_MARKER = "Not yet judged";

const TIER_ORDER: readonly JudgmentTier[] = [
  "TIER_1_BINARY",
  "TIER_2_PROFESSIONAL",
  "TIER_3_STATUTORY",
];

// en-US locale-locked date formatters. Lane 2a/2b/2c regression guard
// (ED-2d-10): every date string in emitted output goes through one of these
// inline formatters so machine-locale drift cannot reach the file content.
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "n/a";
  return DATE_FORMATTER.format(d);
}

function formatDateTime(d: Date): string {
  return DATETIME_FORMATTER.format(d);
}

interface JoinedRow {
  result: V2PerPolicyResult;
  judgment: V2Judgment | null;
}

function isValidTier(value: unknown): value is JudgmentTier {
  return (
    typeof value === "string" &&
    (TIER_ORDER as readonly string[]).includes(value)
  );
}

// Join per-policy results with judgments by per_policy_result_id.
// Order: stable sort by tier (TIER_1, TIER_2, TIER_3, then any unknown/null),
// then by policy_id for deterministic output. This matches the memo builder
// behavior and is the order reviewers see in the on-screen table after
// filter/sort defaults.
function joinResults(
  perPolicy: readonly V2PerPolicyResult[],
  judgments: readonly V2Judgment[],
): JoinedRow[] {
  const judgmentByResultId = new Map<string, V2Judgment>();
  for (const j of judgments) {
    judgmentByResultId.set(j.per_policy_result_id, j);
  }
  const tierIndex = new Map<string, number>();
  TIER_ORDER.forEach((t, i) => tierIndex.set(t, i));
  const rows: JoinedRow[] = perPolicy.map((r) => ({
    result: r,
    judgment: judgmentByResultId.get(r.id) ?? null,
  }));
  rows.sort((a, b) => {
    const ta = a.result.tier ?? "";
    const tb = b.result.tier ?? "";
    const ia = tierIndex.has(ta) ? (tierIndex.get(ta) as number) : 99;
    const ib = tierIndex.has(tb) ? (tierIndex.get(tb) as number) : 99;
    if (ia !== ib) return ia - ib;
    if (a.result.policy_id < b.result.policy_id) return -1;
    if (a.result.policy_id > b.result.policy_id) return 1;
    return 0;
  });
  return rows;
}

// Defensive tier-discretion check. The DB CHECK constraint + judgment
// route already enforce this; we re-assert at export time so any regression
// surfaces as a typed error rather than as an invalid file on a Crown desk.
function assertRowTierDiscretion(row: JoinedRow): void {
  if (!row.judgment) return; // Unjudged rows are exempt (no verdict to check).
  if (!isValidTier(row.judgment.tier)) {
    throw new ExportInvariantError(
      `export_invariant_violation_invalid_tier:${row.judgment.tier}`,
    );
  }
  // Direct lookup against the canonical allowed-verdicts table is faster than
  // throwing/catching in a hot loop, but assertVerdictAllowedForTier is the
  // documented entrypoint per ED-2d-8 so we call it for behavior compliance.
  // It throws a plain Error on violation; we re-wrap as ExportInvariantError.
  try {
    assertVerdictAllowedForTier(row.judgment.tier, row.judgment.verdict);
  } catch {
    throw new ExportInvariantError(
      `export_invariant_violation_tier_verdict:tier=${row.judgment.tier}:verdict=${row.judgment.verdict}`,
    );
  }
  // Reference the imported constant so the type-checker keeps the import live
  // and so downstream readers see the relationship to types_lane2.
  void ALLOWED_VERDICTS_BY_TIER;
}

function verdictDisplay(row: JoinedRow): string {
  if (!row.judgment) return UNJUDGED_MARKER;
  return row.judgment.verdict;
}

function tierDisplay(row: JoinedRow): string {
  return row.result.tier ?? "";
}

function aiSuggestionDisplay(row: JoinedRow): string {
  // S4: for 0.1.0 evidence-status rows, return the compact evidence-status
  // summary (e.g. "Evidence present (5 cited / 3 support / 1 negate)").
  // Legacy 0.0.1 rows keep the existing ai_suggestion / verdict_suggestion fallback.
  const es = resolveEvidenceStatus(row.result);
  if (es.isEvidenceStatus) {
    return formatEvidenceStatusSummary(es);
  }
  return (
    row.result.ai_suggestion ?? row.result.verdict_suggestion ?? ""
  );
}

function confidenceDisplay(row: JoinedRow): string {
  // Scope-aware (P3): an unscoped 0.1.0 row has no surfaceable confidence, so the
  // export "Confidence" column is blank for it -- matching the dashboard, which
  // neither displays it nor lets it drive controls. Scoped 0.1.0 + legacy rows
  // export the value.
  const c = surfaceableConfidence(row.result);
  if (c === null || c === undefined || Number.isNaN(c)) return "";
  return c.toFixed(2);
}

function rationaleDisplay(row: JoinedRow): string {
  return row.judgment?.rationale ?? "";
}

function summaryDisplay(row: JoinedRow): string {
  return row.result.summary ?? "";
}

function reviewedAtDisplay(row: JoinedRow): string {
  if (!row.judgment?.updated_at) return "";
  return formatDate(row.judgment.updated_at);
}

// --- CSV ------------------------------------------------------------------

// CSV formula-injection trigger characters (CWE-1236). Excel / LibreOffice /
// Numbers will evaluate a cell as a formula when the cell starts with any of
// these. Free-text fields (rationale, summary, policy_id) are caller-supplied
// and can plausibly begin with these characters (e.g. "-1 + 2", "@username",
// "=cmd|...", a stray TAB or CR from upstream parsing). The OWASP-recommended
// neutralization is to prefix a single quote ('), which Excel renders as
// literal text rather than a formula.
const CSV_FORMULA_TRIGGERS = new Set<string>(["=", "+", "-", "@", "\t", "\r"]);

// RFC 4180-ish CSV escape with CWE-1236 formula-injection neutralization:
//   1. Prefix `'` if the field begins with any formula-trigger character
//      ({=, +, -, @, TAB, CR}).
//   2. If the (possibly prefixed) field contains comma, quote, CR, or LF,
//      wrap in double quotes and double internal quotes per RFC 4180.
//
// MD and HTML generators do NOT need this prefix -- those formats are not
// interpreted by spreadsheet engines. CSV only.
function escapeCSV(text: string): string {
  if (text === null || text === undefined || text === "") return "";
  let s = text;
  // CWE-1236 neutralization: applied BEFORE quote-wrap so the prefix gets the
  // same downstream escape treatment if the field also needs quoting.
  if (s.length > 0 && CSV_FORMULA_TRIGGERS.has(s.charAt(0))) {
    s = "'" + s;
  }
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_HEADERS: readonly string[] = [
  "Policy ID",
  "Tier",
  "AI Suggestion",
  "Confidence",
  "Reviewer Verdict",
  "Rationale",
  "Summary",
  "Reviewed At",
] as const;

export function generateCSV(input: ExportInput): string {
  const rows = joinResults(input.perPolicy, input.judgments);
  const lines: string[] = [];
  // Metadata header (commented via leading "#" is non-standard for CSV;
  // include as a small preamble of regular rows so Excel still parses cleanly).
  // The first row is the column header line. We embed project / eval metadata
  // in a separate file would be cleaner, but reviewers want one file. We
  // therefore emit ONLY the header line + data rows. Project / eval metadata
  // lives in the filename (and is set by the API route). This preserves
  // Excel "open with no parse error" -- the acceptance criterion.
  lines.push(CSV_HEADERS.map((h) => escapeCSV(h)).join(","));
  for (const row of rows) {
    assertRowTierDiscretion(row);
    const fields = [
      escapeCSV(row.result.policy_id),
      escapeCSV(tierDisplay(row)),
      escapeCSV(aiSuggestionDisplay(row)),
      escapeCSV(confidenceDisplay(row)),
      escapeCSV(verdictDisplay(row)),
      escapeCSV(rationaleDisplay(row)),
      escapeCSV(summaryDisplay(row)),
      escapeCSV(reviewedAtDisplay(row)),
    ];
    lines.push(fields.join(","));
  }
  return lines.join("\r\n");
}

// --- Markdown -------------------------------------------------------------

// Escape pipe, backslash, and newline characters in Markdown table cells.
// Backslashes must be escaped first (before other escapes add new backslashes)
// to avoid double-escaping. Pipes break the table column structure; newlines
// collapse a row visually.
function escapeMd(text: string): string {
  if (text === null || text === undefined || text === "") return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ");
}

export function generateMarkdown(input: ExportInput): string {
  const rows = joinResults(input.perPolicy, input.judgments);
  const generatedAt = input.options?.generatedAt ?? new Date();
  const completionIso =
    input.evaluation.completed_at ??
    input.evaluation.updated_at ??
    input.evaluation.started_at;

  const lines: string[] = [];
  lines.push(`# ${escapeMd(input.project.name)}: Regulatory Review Export`);
  lines.push("");
  lines.push(`**Evaluation completed:** ${formatDate(completionIso)}`);
  lines.push(`**Bench fixture:** ${escapeMd(input.evaluation.bench_fixture)}`);
  lines.push(`**Status:** ${escapeMd(input.evaluation.status)}`);
  lines.push(`**Generated:** ${formatDateTime(generatedAt)}`);
  lines.push("");
  lines.push(`**Total rows:** ${rows.length}`);
  lines.push("");
  lines.push("## Per-Policy Results");
  lines.push("");
  // Table header. MD intentionally omits the Summary column for
  // terminal-friendliness (long summaries balloon row width in plain-text
  // rendering); CSV and HTML carry Summary for completeness. Lane 2e may
  // revisit if reviewers ask for it.
  lines.push(
    "| Policy ID | Tier | AI Suggestion | Confidence | Reviewer Verdict | Rationale | Reviewed At |",
  );
  lines.push(
    "|-----------|------|---------------|------------|------------------|-----------|-------------|",
  );
  for (const row of rows) {
    assertRowTierDiscretion(row);
    const cells = [
      escapeMd(row.result.policy_id),
      escapeMd(tierDisplay(row)),
      escapeMd(aiSuggestionDisplay(row)),
      escapeMd(confidenceDisplay(row)),
      escapeMd(verdictDisplay(row)),
      escapeMd(rationaleDisplay(row)),
      escapeMd(reviewedAtDisplay(row)),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push(
    `*Generated by engine_v2 Lane 2d export (CSV / MD / HTML). Document of record is the Lane 2b .docx memo.*`,
  );
  return lines.join("\n");
}

// --- HTML -----------------------------------------------------------------

function escapeHtml(text: string): string {
  if (text === null || text === undefined || text === "") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateHTML(input: ExportInput): string {
  const rows = joinResults(input.perPolicy, input.judgments);
  const generatedAt = input.options?.generatedAt ?? new Date();
  const completionIso =
    input.evaluation.completed_at ??
    input.evaluation.updated_at ??
    input.evaluation.started_at;
  const title = `${input.project.name}: Regulatory Review Export`;

  const out: string[] = [];
  out.push("<!DOCTYPE html>");
  out.push('<html lang="en">');
  out.push("<head>");
  out.push('  <meta charset="utf-8">');
  out.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  out.push(`  <title>${escapeHtml(title)}</title>`);
  out.push("  <style>");
  out.push(
    "    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; max-width: 1100px; margin: 0 auto; padding: 2rem; color: #1a202c; }",
  );
  out.push(
    "    h1 { color: #1a365d; border-bottom: 2px solid #3182ce; padding-bottom: 0.5rem; }",
  );
  out.push("    h2 { color: #2d3748; margin-top: 2rem; }");
  out.push("    .meta { color: #4a5568; margin: 0.25rem 0; }");
  out.push(
    "    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }",
  );
  out.push(
    "    th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }",
  );
  out.push("    th { background: #f7fafc; font-weight: 600; }");
  out.push("    tr:nth-child(even) td { background: #f9fafb; }");
  out.push(
    "    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; color: #718096; font-size: 0.85rem; }",
  );
  out.push("  </style>");
  out.push("</head>");
  out.push("<body>");
  out.push(`  <h1>${escapeHtml(title)}</h1>`);
  out.push(
    `  <p class="meta"><strong>Evaluation completed:</strong> ${escapeHtml(formatDate(completionIso))}</p>`,
  );
  out.push(
    `  <p class="meta"><strong>Bench fixture:</strong> ${escapeHtml(input.evaluation.bench_fixture)}</p>`,
  );
  out.push(
    `  <p class="meta"><strong>Status:</strong> ${escapeHtml(input.evaluation.status)}</p>`,
  );
  out.push(
    `  <p class="meta"><strong>Generated:</strong> ${escapeHtml(formatDateTime(generatedAt))}</p>`,
  );
  out.push(`  <p class="meta"><strong>Total rows:</strong> ${rows.length}</p>`);
  out.push("  <h2>Per-Policy Results</h2>");
  out.push("  <table>");
  out.push("    <thead>");
  out.push("      <tr>");
  out.push("        <th>Policy ID</th>");
  out.push("        <th>Tier</th>");
  out.push("        <th>AI Suggestion</th>");
  out.push("        <th>Confidence</th>");
  out.push("        <th>Reviewer Verdict</th>");
  out.push("        <th>Rationale</th>");
  out.push("        <th>Summary</th>");
  out.push("        <th>Reviewed At</th>");
  out.push("      </tr>");
  out.push("    </thead>");
  out.push("    <tbody>");
  for (const row of rows) {
    assertRowTierDiscretion(row);
    out.push("      <tr>");
    out.push(`        <td>${escapeHtml(row.result.policy_id)}</td>`);
    out.push(`        <td>${escapeHtml(tierDisplay(row))}</td>`);
    out.push(`        <td>${escapeHtml(aiSuggestionDisplay(row))}</td>`);
    out.push(`        <td>${escapeHtml(confidenceDisplay(row))}</td>`);
    out.push(`        <td>${escapeHtml(verdictDisplay(row))}</td>`);
    out.push(`        <td>${escapeHtml(rationaleDisplay(row))}</td>`);
    out.push(`        <td>${escapeHtml(summaryDisplay(row))}</td>`);
    out.push(`        <td>${escapeHtml(reviewedAtDisplay(row))}</td>`);
    out.push("      </tr>");
  }
  out.push("    </tbody>");
  out.push("  </table>");
  out.push('  <div class="footer">');
  out.push(
    `    <p>Generated by engine_v2 Lane 2d export. Document of record is the Lane 2b .docx memo.</p>`,
  );
  out.push("  </div>");
  out.push("</body>");
  out.push("</html>");
  return out.join("\n");
}

// --- MIME + filename helpers ---------------------------------------------

export interface FormatDescriptor {
  mime: string;
  ext: "csv" | "md" | "html";
}

const FORMAT_DESCRIPTORS: Record<ExportFormat, FormatDescriptor> = {
  csv: { mime: "text/csv; charset=utf-8", ext: "csv" },
  md: { mime: "text/markdown; charset=utf-8", ext: "md" },
  html: { mime: "text/html; charset=utf-8", ext: "html" },
};

export function getFormatDescriptor(format: ExportFormat): FormatDescriptor {
  return FORMAT_DESCRIPTORS[format];
}

// ASCII-only filename. Strips non-ASCII codepoints from the project name to
// avoid encoded-attachment quirks in older browsers; UUID short-hash is
// already ASCII.
function asciiOnly(s: string): string {
  // Strip any byte with codepoint > 0x7E or below 0x20 (control chars).
  // Keep underscore, hyphen, dot, alphanumerics, and space.
  return s.replace(/[^\x20-\x7E]/g, "").replace(/[\s/\\?%*:|"<>]+/g, "-");
}

export function buildExportFilename(
  format: ExportFormat,
  evaluationId: string,
): string {
  const descriptor = FORMAT_DESCRIPTORS[format];
  const evalShort = asciiOnly(evaluationId).slice(0, 8);
  return `evaluation-${evalShort}-${descriptor.ext}.${descriptor.ext}`;
}

// Top-level dispatch. Used by the API route.
export function generateExport(
  format: ExportFormat,
  input: ExportInput,
): string {
  switch (format) {
    case "csv":
      return generateCSV(input);
    case "md":
      return generateMarkdown(input);
    case "html":
      return generateHTML(input);
    default: {
      // Exhaustiveness check; throws if a new format is added without a case.
      const _exhaustive: never = format;
      throw new ExportInvariantError(
        `unknown_export_format:${String(_exhaustive)}`,
      );
    }
  }
}
