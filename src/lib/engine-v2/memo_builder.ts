// engine_v2 frontend Lane 2b / Module L2b-6: pure memo builder.
//
// Produces a Word .docx (Open XML) document summarizing an evaluation +
// reviewer judgments. Pure function: no DB access, no env reads, no fetch.
// Callers (the memo route) own all I/O. Hashes are deterministic over the
// input shape so the route can compute judgment_snapshot_hash before the
// build and content_sha256 after the build.
//
// Tier discretion (CLAUDE.md NON-NEGOTIABLE):
//   - TIER_2_PROFESSIONAL rows MUST NOT show ADEQUATE.
//   - TIER_3_STATUTORY rows MUST be OBSERVATION_ONLY (or null when unjudged).
// The database CHECK constraint + the per-policy judgment route already
// enforce this on insert. The builder enforces it again defensively and
// throws a typed error so any regression surfaces as a test failure rather
// than as an invalid memo on a Crown desk.
//
// ASCII-only in code; the produced Word document uses plain ASCII headers
// per CLAUDE.md (memo body may contain Unicode from upstream content but
// builder code introduces no smart quotes / em dashes).
//
// Typography (owner feedback 2026-05-12):
//   - Single font family throughout: Times New Roman.
//   - Body 11pt, headings 14pt, title 18pt.
//   - Paragraph spacing-after on every paragraph so text is not jammed.
//   - Table cells have visible padding.
// Content hygiene (owner feedback 2026-05-12):
//   - Hide raw UUIDs (project_id, evaluation_id, run_id_engine,
//     variant_config_hash) and internal-only fields (backend, bench
//     fixture, generator version) from the rendered memo.
//   - Project header uses project.name; evaluation header uses an
//     en-US-formatted completion date.

import { createHash } from "crypto";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type {
  EvalCoverageStatement,
  JudgmentTier,
  V2Evaluation,
  V2Judgment,
  V2PerPolicyResult,
} from "./types_lane2";
import type { V2Project } from "./types";
import type { EvidenceSliceMap, EvidenceSlice } from "./evidence_slices";

export const MEMO_GENERATOR_VERSION = "lane2b-memo-v1";

// Typography constants. docx sizes are in half-points.
export const MEMO_FONT_FAMILY = "Times New Roman";
const BODY_SIZE_HP = 22; // 11pt
const HEADING_SIZE_HP = 28; // 14pt
const TITLE_SIZE_HP = 36; // 18pt
const FOOTER_SIZE_HP = 18; // 9pt
// Paragraph spacing-after (twips). 120 twips = ~6pt.
const PARA_SPACING_AFTER = 120;
const HEADING_SPACING_BEFORE = 240; // ~12pt
const HEADING_SPACING_AFTER = 120; // ~6pt
// Table cell margins (twips).
const CELL_MARGIN_TOP = 60;
const CELL_MARGIN_BOTTOM = 60;
const CELL_MARGIN_LEFT = 80;
const CELL_MARGIN_RIGHT = 80;

export interface MemoBuilderInput {
  project: Pick<V2Project, "id" | "name">;
  evaluation: V2Evaluation;
  results: V2PerPolicyResult[];
  judgments: V2Judgment[];
  // Optional: evidence_slices dereferenced from eval_result.json.
  // When provided, each per-policy section includes verbatim submission
  // excerpt(s) the AI cited as evidence. Null/absent means older schema
  // (schema_version 0.0.1) -- renders a stub instead.
  evidenceSlices?: EvidenceSliceMap | null;
}

export interface MemoBuilderOutput {
  bytes: Uint8Array;
  contentSha256: string;
  judgmentSnapshotHash: string;
  generatorVersion: string;
}

export class MemoBuildInvariantError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "MemoBuildInvariantError";
  }
}

const TIER_ORDER: readonly JudgmentTier[] = [
  "TIER_1_BINARY",
  "TIER_2_PROFESSIONAL",
  "TIER_3_STATUTORY",
];

// en-US locale-locked date formatter (date-only; no time / timezone noise).
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "n/a";
  return DATE_FORMATTER.format(d);
}

function sha256Hex(input: string | Uint8Array): string {
  const h = createHash("sha256");
  if (typeof input === "string") {
    h.update(input, "utf8");
  } else {
    h.update(Buffer.from(input));
  }
  return h.digest("hex");
}

// Snapshot hash: deterministic over judgments + evidence_slices content hashes.
// Sorted by id, stringifies [id, updated_at, verdict] tuples for judgments,
// then appends a sorted evidence_slices content-hash digest so cached memos
// invalidate when slices change (e.g. after Commit 2 submission-text fix).
// Drives the idempotency key on v2_memo_exports (evaluation_id, judgment_snapshot_hash).
export function computeJudgmentSnapshotHash(
  judgments: readonly V2Judgment[],
  evidenceSlices?: EvidenceSliceMap | null,
): string {
  const sorted = [...judgments].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const tuples = sorted.map((j) => [j.id, j.updated_at, j.verdict]);

  // Include a digest of all rendered slice fields so the snapshot hash changes
  // whenever slice content OR source anchors change (engine re-run fix).
  // We hash all fields the memo renders: content_hash (content integrity),
  // title, doc_id, page, section (source anchor fields). Using content_hash
  // alone would miss corrections to page/section/title that change the memo.
  let slicesDigest = "";
  if (evidenceSlices) {
    const sliceEntries = Object.entries(evidenceSlices)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([id, slice]) => [
        id,
        slice.content_hash,
        slice.source.title,
        slice.source.doc_id,
        slice.source.page,
        slice.source.section,
      ]);
    slicesDigest = sha256Hex(JSON.stringify(sliceEntries));
  }

  return sha256Hex(JSON.stringify({ tuples, slicesDigest }));
}

interface JoinedRow {
  result: V2PerPolicyResult;
  judgment: V2Judgment | null;
}

function joinByTier(
  results: readonly V2PerPolicyResult[],
  judgments: readonly V2Judgment[],
): Map<JudgmentTier, JoinedRow[]> {
  const byResultId = new Map<string, V2Judgment>();
  for (const j of judgments) {
    byResultId.set(j.per_policy_result_id, j);
  }
  const buckets = new Map<JudgmentTier, JoinedRow[]>();
  for (const t of TIER_ORDER) buckets.set(t, []);
  for (const r of results) {
    if (!r.tier) continue;
    if (!TIER_ORDER.includes(r.tier as JudgmentTier)) continue;
    const tier = r.tier as JudgmentTier;
    const j = byResultId.get(r.id) ?? null;
    buckets.get(tier)!.push({ result: r, judgment: j });
  }
  // Stable sort within bucket by policy_id for deterministic output.
  for (const arr of buckets.values()) {
    arr.sort((a, b) =>
      a.result.policy_id < b.result.policy_id
        ? -1
        : a.result.policy_id > b.result.policy_id
          ? 1
          : 0,
    );
  }
  return buckets;
}

function assertTierDiscretion(
  buckets: Map<JudgmentTier, JoinedRow[]>,
): void {
  for (const row of buckets.get("TIER_2_PROFESSIONAL") ?? []) {
    if (row.judgment && row.judgment.verdict === "ADEQUATE") {
      throw new MemoBuildInvariantError(
        "memo_build_invariant_violation_tier_2_adequate",
      );
    }
  }
  for (const row of buckets.get("TIER_3_STATUTORY") ?? []) {
    if (row.judgment === null) continue;
    if (row.judgment.verdict !== "OBSERVATION_ONLY") {
      throw new MemoBuildInvariantError(
        "memo_build_invariant_violation_tier_3_non_observation",
      );
    }
  }
}

// --- Typography helpers ----------------------------------------------------

interface BodyTextOpts {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  size?: number;
}

function bodyText(text: string, opts: BodyTextOpts = {}): TextRun {
  return new TextRun({
    text,
    font: MEMO_FONT_FAMILY,
    size: opts.size ?? BODY_SIZE_HP,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color,
  });
}

function headingText(text: string, size: number = HEADING_SIZE_HP): TextRun {
  return new TextRun({
    text,
    font: MEMO_FONT_FAMILY,
    size,
    bold: true,
  });
}

function bodyParagraph(
  children: TextRun[],
  opts: { spacingAfter?: number } = {},
): Paragraph {
  return new Paragraph({
    spacing: { after: opts.spacingAfter ?? PARA_SPACING_AFTER },
    children,
  });
}

function headingParagraph(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
): Paragraph {
  const size = level === HeadingLevel.TITLE ? TITLE_SIZE_HP : HEADING_SIZE_HP;
  return new Paragraph({
    heading: level,
    alignment: AlignmentType.LEFT,
    spacing: { before: HEADING_SPACING_BEFORE, after: HEADING_SPACING_AFTER },
    children: [headingText(text, size)],
  });
}

// --- Tables ---------------------------------------------------------------

function thinBorder() {
  return {
    top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  };
}

function cell(text: string, opts?: { bold?: boolean; widthPct?: number }): TableCell {
  return new TableCell({
    width: opts?.widthPct
      ? { size: opts.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    margins: {
      top: CELL_MARGIN_TOP,
      bottom: CELL_MARGIN_BOTTOM,
      left: CELL_MARGIN_LEFT,
      right: CELL_MARGIN_RIGHT,
    },
    children: [
      new Paragraph({
        spacing: { after: 0 },
        children: [
          bodyText(text === "" ? " " : text, { bold: opts?.bold ?? false }),
        ],
      }),
    ],
  });
}

function buildHeaderRow(headers: readonly string[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: headers.map((h) => cell(h, { bold: true })),
  });
}

function buildTable(rows: TableRow[]): Table {
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder(),
  });
}

function emptySectionParagraph(): Paragraph {
  return bodyParagraph([
    bodyText("(no results in this tier)", { italics: true, color: "666666" }),
  ]);
}

function pickString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

// --- Evidence-packet helpers -----------------------------------------------
//
// The engine_v2 evidence_packet is a polymorphic object whose items may live
// under various sub-keys (items / evidence_items / chunks) or at the top level.
// Each item that carries an `evidence_item_id` string keys into the top-level
// evidence_slices map emitted by the engine.
//
// REGULATORY INVARIANT: only submission-side evidence (index_side === "submission")
// is rendered. Corpus-side entries (index_side === "corpus") are silently
// skipped -- same rule enforced in PerPolicyResultsTable.tsx. The memo must
// never show policy KB text labelled as submission evidence.

interface EvidenceItemEntry {
  evidence_item_id: string;
  // evidence_type is POSITIVE / NEGATIVE / NEUTRAL per engine contract.
  // For the memo, NEGATIVE maps to "negating"; all others map to "supporting".
  evidence_type: string | null;
  raw: Record<string, unknown>;
}

function isEvidenceItemObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const id = (v as Record<string, unknown>).evidence_item_id;
  return typeof id === "string" && id.length > 0;
}

// isCorpusSide mirrors the full corpus-side filtering from PerPolicyResultsTable
// including the self-reference fallback (source_document_provenance.doc_id ===
// rowPolicyId). The policy_id is passed in so self-referenced policy text is
// blocked even when index_side is absent from the engine payload.
function isCorpusSide(
  raw: Record<string, unknown>,
  rowPolicyId: string | null,
): boolean {
  const refRaw = raw.evidence_item_ref;
  if (refRaw && typeof refRaw === "object" && !Array.isArray(refRaw)) {
    const ref = refRaw as Record<string, unknown>;
    if (ref.index_side === "corpus") return true;
    // Fallback self-reference check: engine may use doc_id === policy_id as the
    // corpus marker when index_side is absent. Same rule as PerPolicyResultsTable.
    const provRaw = ref.source_document_provenance;
    if (provRaw && typeof provRaw === "object" && !Array.isArray(provRaw)) {
      const prov = provRaw as Record<string, unknown>;
      if (
        rowPolicyId !== null &&
        typeof prov.doc_id === "string" &&
        prov.doc_id === rowPolicyId
      ) {
        return true;
      }
    }
  }
  // Defense-in-depth: engine may flatten index_side onto the item directly.
  if (raw.index_side === "corpus") return true;
  return false;
}

function extractEvidencePacketItems(
  evidencePacket: unknown[] | Record<string, unknown> | null | undefined,
  rowPolicyId: string | null,
): EvidenceItemEntry[] {
  if (!evidencePacket || typeof evidencePacket !== "object") return [];
  const out: EvidenceItemEntry[] = [];
  const seen = new Set<string>();

  function consider(v: unknown): void {
    if (isEvidenceItemObject(v)) {
      const item = v as Record<string, unknown>;
      const id = String(item.evidence_item_id);
      if (seen.has(id)) return;
      seen.add(id);
      if (isCorpusSide(item, rowPolicyId)) return;
      const et = item.evidence_type;
      out.push({
        evidence_item_id: id,
        evidence_type: typeof et === "string" ? et : null,
        raw: item,
      });
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) consider(x);
    }
  }

  // When the engine emits evidence_packet as a top-level array (S4 contract),
  // iterate the array elements directly.
  if (Array.isArray(evidencePacket)) {
    for (const x of evidencePacket) consider(x);
    return out;
  }

  for (const key of ["items", "evidence_items", "chunks"]) {
    consider((evidencePacket as Record<string, unknown>)[key]);
  }
  for (const v of Object.values(evidencePacket)) {
    consider(v);
  }
  return out;
}

// Build a human-readable source anchor: "p. 3, Section 2.1" or whatever
// fields are present. Returns empty string when no location info.
function buildSourceAnchor(slice: EvidenceSlice): string {
  const parts: string[] = [];
  if (slice.source.page !== null) parts.push(`p. ${slice.source.page}`);
  if (slice.source.section) parts.push(`Section ${slice.source.section}`);
  return parts.join(", ");
}

// Build "cited by" cross-reference label if other policies in the memo
// also reference the same evidence_item_id.
function buildCitedBy(
  evidenceItemId: string,
  currentPolicyId: string,
  allRows: readonly JoinedRow[],
): string {
  const citing: string[] = [];
  for (const row of allRows) {
    if (row.result.policy_id === currentPolicyId) continue;
    const items = extractEvidencePacketItems(row.result.evidence_packet, row.result.policy_id);
    for (const item of items) {
      if (item.evidence_item_id === evidenceItemId) {
        citing.push(row.result.policy_id);
        break;
      }
    }
  }
  if (citing.length === 0) return "";
  return `Also cited by: ${citing.join(", ")}`;
}

// Render one verbatim evidence excerpt block into docx paragraph elements.
// Returns an array of Paragraph objects suitable for insertion into a section.
function buildEvidenceExcerptParagraphs(
  entry: EvidenceItemEntry,
  slice: EvidenceSlice,
  citedByLabel: string,
): Paragraph[] {
  const paras: Paragraph[] = [];

  // Source line: title + page/section anchor + evidence type label.
  const sourceAnchor = buildSourceAnchor(slice);
  const titleLabel = slice.source.title || slice.source.doc_id || "(unknown source)";
  const roleLabel =
    entry.evidence_type && entry.evidence_type.toUpperCase() === "NEGATIVE"
      ? "[negating]"
      : "[supporting]";
  const sourceLine = [titleLabel, sourceAnchor, roleLabel]
    .filter(Boolean)
    .join(" -- ");

  paras.push(
    bodyParagraph(
      [bodyText(sourceLine, { bold: true, size: 20 })],
      { spacingAfter: 40 },
    ),
  );

  // Verbatim content as an indented block-quote paragraph.
  paras.push(
    new Paragraph({
      spacing: { after: PARA_SPACING_AFTER },
      indent: { left: 360, right: 360 },
      children: [
        bodyText(slice.content, { italics: true }),
      ],
    }),
  );

  // Cited-by cross-reference (when applicable).
  if (citedByLabel) {
    paras.push(
      bodyParagraph(
        [bodyText(citedByLabel, { italics: true, color: "888888", size: 18 })],
        { spacingAfter: 60 },
      ),
    );
  }

  return paras;
}

// Build all evidence excerpt paragraphs for a single per-policy result row.
// Returns paragraphs to insert after the row's table. If no slices are
// available or the packet is empty, returns a single stub paragraph.
function buildPolicyEvidenceSection(
  row: JoinedRow,
  evidenceSlices: EvidenceSliceMap | null | undefined,
  allRows: readonly JoinedRow[],
): Paragraph[] {
  const items = extractEvidencePacketItems(row.result.evidence_packet, row.result.policy_id);
  if (items.length === 0 || !evidenceSlices) {
    return [
      bodyParagraph(
        [
          bodyText("No verbatim submission evidence cited by AI.", {
            italics: true,
            color: "888888",
          }),
        ],
        { spacingAfter: 60 },
      ),
    ];
  }

  const out: Paragraph[] = [];
  let anyResolved = false;
  for (const item of items) {
    const slice = evidenceSlices[item.evidence_item_id] ?? null;
    if (!slice) continue;
    anyResolved = true;
    const citedBy = buildCitedBy(item.evidence_item_id, row.result.policy_id, allRows);
    const excerptParas = buildEvidenceExcerptParagraphs(item, slice, citedBy);
    out.push(...excerptParas);
  }

  if (!anyResolved) {
    return [
      bodyParagraph(
        [
          bodyText("No verbatim submission evidence cited by AI.", {
            italics: true,
            color: "888888",
          }),
        ],
        { spacingAfter: 60 },
      ),
    ];
  }

  return out;
}

// --- Tier sections --------------------------------------------------------

const TIER_1_EXPLAINER =
  "These regulatory items are binary requirements (must / shall / required). " +
  "The AI provided an initial determination; the reviewer's judgment is the " +
  "final position.";

const TIER_2_EXPLAINER =
  "These items require professional judgment. The AI can only flag potential " +
  "deficiencies; a qualified professional (QP) must make the adequacy " +
  "determination.";

const TIER_3_EXPLAINER =
  "These items involve statutory discretion (Director, Statutory Decision " +
  "Maker). The AI provides observations only; final adequacy is determined " +
  "by the SDM / Crown.";

// Build a labelled heading for a per-policy evidence sub-section.
function policyEvidenceHeading(policyId: string): Paragraph {
  return bodyParagraph(
    [bodyText(`Evidence for ${policyId}:`, { bold: true, size: 20 })],
    { spacingAfter: 40 },
  );
}

function buildTier1Section(
  rows: JoinedRow[],
  evidenceSlices: EvidenceSliceMap | null | undefined,
  allRows: readonly JoinedRow[],
): Array<Paragraph | Table> {
  const heading = headingParagraph(
    "Tier 1 (Binary) Findings",
    HeadingLevel.HEADING_2,
  );
  const explainer = bodyParagraph([bodyText(TIER_1_EXPLAINER)]);
  if (rows.length === 0) return [heading, explainer, emptySectionParagraph()];
  const header = buildHeaderRow([
    "Policy ID",
    "AI Suggestion",
    "Reviewer Judgment",
    "Rationale",
  ]);
  const body = rows.map((r) =>
    new TableRow({
      children: [
        cell(r.result.policy_id, { widthPct: 18 }),
        cell(pickString(r.result.ai_suggestion ?? r.result.verdict_suggestion), { widthPct: 16 }),
        cell(r.judgment ? r.judgment.verdict : "(unjudged)", { widthPct: 18 }),
        cell(r.judgment?.rationale ?? "", { widthPct: 48 }),
      ],
    }),
  );
  const out: Array<Paragraph | Table> = [heading, explainer, buildTable([header, ...body])];
  // Per-policy verbatim evidence sub-sections.
  for (const row of rows) {
    out.push(policyEvidenceHeading(row.result.policy_id));
    out.push(...buildPolicyEvidenceSection(row, evidenceSlices, allRows));
  }
  return out;
}

function buildTier2Section(
  rows: JoinedRow[],
  evidenceSlices: EvidenceSliceMap | null | undefined,
  allRows: readonly JoinedRow[],
): Array<Paragraph | Table> {
  const heading = headingParagraph(
    "Tier 2 (Professional Judgment) Flagged Items",
    HeadingLevel.HEADING_2,
  );
  const explainer = bodyParagraph([bodyText(TIER_2_EXPLAINER)]);
  if (rows.length === 0) return [heading, explainer, emptySectionParagraph()];
  const header = buildHeaderRow([
    "Policy ID",
    "AI Flag",
    "Reviewer Flag",
    "Rationale",
  ]);
  const body = rows.map((r) =>
    new TableRow({
      children: [
        cell(r.result.policy_id, { widthPct: 18 }),
        cell(pickString(r.result.ai_suggestion ?? r.result.verdict_suggestion), { widthPct: 16 }),
        cell(r.judgment ? r.judgment.verdict : "(unjudged)", { widthPct: 18 }),
        cell(r.judgment?.rationale ?? "", { widthPct: 48 }),
      ],
    }),
  );
  const out: Array<Paragraph | Table> = [heading, explainer, buildTable([header, ...body])];
  for (const row of rows) {
    out.push(policyEvidenceHeading(row.result.policy_id));
    out.push(...buildPolicyEvidenceSection(row, evidenceSlices, allRows));
  }
  return out;
}

function buildTier3Section(
  rows: JoinedRow[],
  evidenceSlices: EvidenceSliceMap | null | undefined,
  allRows: readonly JoinedRow[],
): Array<Paragraph | Table> {
  const heading = headingParagraph(
    "Tier 3 (Statutory Discretion) Observations",
    HeadingLevel.HEADING_2,
  );
  const explainer = bodyParagraph([bodyText(TIER_3_EXPLAINER)]);
  if (rows.length === 0) return [heading, explainer, emptySectionParagraph()];
  const header = buildHeaderRow(["Policy ID", "Observation", "Notes"]);
  const body = rows.map((r) =>
    new TableRow({
      children: [
        cell(r.result.policy_id, { widthPct: 22 }),
        cell(
          r.judgment ? r.judgment.verdict : "(no observation recorded)",
          { widthPct: 22 },
        ),
        cell(r.judgment?.rationale ?? r.result.summary ?? "", { widthPct: 56 }),
      ],
    }),
  );
  const out: Array<Paragraph | Table> = [heading, explainer, buildTable([header, ...body])];
  for (const row of rows) {
    out.push(policyEvidenceHeading(row.result.policy_id));
    out.push(...buildPolicyEvidenceSection(row, evidenceSlices, allRows));
  }
  return out;
}

// --- Overview / title / footer -------------------------------------------

function buildOverviewSection(
  evaluation: V2Evaluation,
): Array<Paragraph | Table> {
  const coverage = (evaluation.coverage_statement ?? {}) as EvalCoverageStatement;
  const total = coverage.total_policies ?? 0;
  const evaluated = coverage.evaluated ?? 0;
  const deferred = coverage.deferred ?? 0;
  const errored = coverage.error ?? 0;

  const heading = headingParagraph("Overview", HeadingLevel.HEADING_2);

  // Coverage prose: human-readable summary; the table below mirrors it.
  const coverageProse = bodyParagraph([
    bodyText("Coverage: ", { bold: true }),
    bodyText(
      `${evaluated} of ${total} policies evaluated, ${deferred} deferred, ${errored} errored.`,
    ),
  ]);

  const coverageHeader = buildHeaderRow(["Total", "Evaluated", "Deferred", "Errored"]);
  const coverageRow = new TableRow({
    children: [
      cell(String(total), { widthPct: 25 }),
      cell(String(evaluated), { widthPct: 25 }),
      cell(String(deferred), { widthPct: 25 }),
      cell(String(errored), { widthPct: 25 }),
    ],
  });

  return [heading, coverageProse, buildTable([coverageHeader, coverageRow])];
}

function buildTitleParagraphs(
  project: MemoBuilderInput["project"],
  evaluation: V2Evaluation,
): Paragraph[] {
  const completionIso =
    evaluation.completed_at ?? evaluation.updated_at ?? evaluation.started_at;
  const title = new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: HEADING_SPACING_AFTER },
    children: [
      headingText(`${project.name}: Regulatory Review Memo`, TITLE_SIZE_HP),
    ],
  });
  const subtitle = bodyParagraph(
    [
      bodyText(`Evaluation completed ${formatDate(completionIso)}`, {
        italics: true,
        color: "666666",
      }),
    ],
    { spacingAfter: HEADING_SPACING_AFTER },
  );
  return [title, subtitle];
}

function buildFooterParagraphs(generatedAt: Date): Paragraph[] {
  return [
    bodyParagraph(
      [
        bodyText(`Generated ${DATE_FORMATTER.format(generatedAt)}`, {
          italics: true,
          color: "666666",
          size: FOOTER_SIZE_HP,
        }),
      ],
      { spacingAfter: 0 },
    ),
  ];
}

// Pure build. Returns docx bytes plus the two hashes the route persists.
export async function buildMemo(
  input: MemoBuilderInput,
): Promise<MemoBuilderOutput> {
  const { project, evaluation, results, judgments, evidenceSlices } = input;

  const buckets = joinByTier(results, judgments);
  assertTierDiscretion(buckets);

  // Flatten all rows for cross-policy cited-by lookups.
  const allRows: JoinedRow[] = [
    ...(buckets.get("TIER_1_BINARY") ?? []),
    ...(buckets.get("TIER_2_PROFESSIONAL") ?? []),
    ...(buckets.get("TIER_3_STATUTORY") ?? []),
  ];

  const titleParas = buildTitleParagraphs(project, evaluation);
  const overview = buildOverviewSection(evaluation);
  const t1 = buildTier1Section(
    buckets.get("TIER_1_BINARY") ?? [],
    evidenceSlices,
    allRows,
  );
  const t2 = buildTier2Section(
    buckets.get("TIER_2_PROFESSIONAL") ?? [],
    evidenceSlices,
    allRows,
  );
  const t3 = buildTier3Section(
    buckets.get("TIER_3_STATUTORY") ?? [],
    evidenceSlices,
    allRows,
  );
  // Use a deterministic generated_at derived from evaluation timestamps so
  // identical inputs produce identical bytes. Falls back to a fixed epoch
  // only if no usable timestamp is present.
  const generatedAtIso =
    evaluation.updated_at ?? evaluation.completed_at ?? evaluation.started_at;
  const generatedAtDate = generatedAtIso
    ? new Date(generatedAtIso)
    : new Date(0);
  const footer = buildFooterParagraphs(
    Number.isNaN(generatedAtDate.getTime()) ? new Date(0) : generatedAtDate,
  );

  const doc = new Document({
    creator: MEMO_GENERATOR_VERSION,
    title: `${project.name}: Regulatory Review Memo`,
    description: `engine_v2 evaluation`,
    styles: {
      default: {
        document: {
          run: {
            font: MEMO_FONT_FAMILY,
            size: BODY_SIZE_HP,
          },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          ...titleParas,
          ...overview,
          ...t1,
          ...t2,
          ...t3,
          ...footer,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  // docx Packer returns a Buffer; normalize to Uint8Array for callers.
  const bytes = new Uint8Array(buffer);
  const contentSha256 = sha256Hex(bytes);
  // Include evidenceSlices in the snapshot hash so cached memos invalidate
  // when slices change (e.g. after engine re-run fixes submission content).
  const judgmentSnapshotHash = computeJudgmentSnapshotHash(
    judgments,
    evidenceSlices,
  );
  return {
    bytes,
    contentSha256,
    judgmentSnapshotHash,
    generatorVersion: MEMO_GENERATOR_VERSION,
  };
}
