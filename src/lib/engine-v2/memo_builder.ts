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

export const MEMO_GENERATOR_VERSION = "lane2b-memo-v1";

export interface MemoBuilderInput {
  project: Pick<V2Project, "id" | "name">;
  evaluation: V2Evaluation;
  results: V2PerPolicyResult[];
  judgments: V2Judgment[];
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

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
  timeZoneName: "short",
});

function formatTimestamp(iso: string | null | undefined): string {
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

// Snapshot hash: deterministic over judgments only. Sorted by id, stringifies
// [id, updated_at, verdict] tuples. Drives the idempotency key on
// v2_memo_exports (evaluation_id, judgment_snapshot_hash).
export function computeJudgmentSnapshotHash(
  judgments: readonly V2Judgment[],
): string {
  const sorted = [...judgments].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const tuples = sorted.map((j) => [j.id, j.updated_at, j.verdict]);
  return sha256Hex(JSON.stringify(tuples));
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
    children: [
      new Paragraph({
        children: [new TextRun({ text: text === "" ? " " : text, bold: opts?.bold ?? false })],
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
  return new Paragraph({
    children: [
      new TextRun({
        text: "(no results in this tier)",
        italics: true,
        color: "666666",
      }),
    ],
  });
}

function pickString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

function buildTier1Section(rows: JoinedRow[]): Array<Paragraph | Table> {
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({ text: "Tier 1 (Binary) Findings", bold: true }),
    ],
  });
  if (rows.length === 0) return [heading, emptySectionParagraph()];
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
  return [heading, buildTable([header, ...body])];
}

function buildTier2Section(rows: JoinedRow[]): Array<Paragraph | Table> {
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({ text: "Tier 2 (Professional Judgment) Flagged Items", bold: true }),
    ],
  });
  const note = new Paragraph({
    children: [
      new TextRun({
        text:
          "Note: Professional judgment tier; adequacy determination requires a Qualified Professional.",
        italics: true,
      }),
    ],
  });
  if (rows.length === 0) return [heading, note, emptySectionParagraph()];
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
  return [heading, note, buildTable([header, ...body])];
}

function buildTier3Section(rows: JoinedRow[]): Array<Paragraph | Table> {
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({ text: "Tier 3 (Statutory Discretion) Observations", bold: true }),
    ],
  });
  const note = new Paragraph({
    children: [
      new TextRun({
        text:
          "Note: Statutory discretion; adequacy determination requires the Statutory Decision Maker (SDM).",
        italics: true,
      }),
    ],
  });
  if (rows.length === 0) return [heading, note, emptySectionParagraph()];
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
  return [heading, note, buildTable([header, ...body])];
}

function buildOverviewSection(
  project: MemoBuilderInput["project"],
  evaluation: V2Evaluation,
): Array<Paragraph | Table> {
  const coverage = (evaluation.coverage_statement ?? {}) as EvalCoverageStatement;
  const total = coverage.total_policies ?? 0;
  const evaluated = coverage.evaluated ?? 0;
  const deferred = coverage.deferred ?? 0;
  const errored = coverage.error ?? 0;

  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "Overview", bold: true })],
  });
  const meta = new Paragraph({
    children: [
      new TextRun({ text: "Status: ", bold: true }),
      new TextRun({ text: evaluation.status }),
      new TextRun({ text: "   Backend: ", bold: true }),
      new TextRun({ text: evaluation.evaluation_backend }),
      new TextRun({ text: "   Bench: ", bold: true }),
      new TextRun({ text: evaluation.bench_fixture }),
    ],
  });
  const dates = new Paragraph({
    children: [
      new TextRun({ text: "Started: ", bold: true }),
      new TextRun({ text: formatTimestamp(evaluation.started_at) }),
      new TextRun({ text: "   Completed: ", bold: true }),
      new TextRun({ text: formatTimestamp(evaluation.completed_at) }),
    ],
  });
  const projectLine = new Paragraph({
    children: [
      new TextRun({ text: "Project: ", bold: true }),
      new TextRun({ text: project.name }),
      new TextRun({ text: "   Project ID: " }),
      new TextRun({ text: project.id, font: "Consolas" }),
    ],
  });
  const evalLine = new Paragraph({
    children: [
      new TextRun({ text: "Evaluation ID: " }),
      new TextRun({ text: evaluation.id, font: "Consolas" }),
    ],
  });

  const coverageHeader = buildHeaderRow(["Total", "Evaluated", "Deferred", "Errored"]);
  const coverageRow = new TableRow({
    children: [
      cell(String(total), { widthPct: 25 }),
      cell(String(evaluated), { widthPct: 25 }),
      cell(String(deferred), { widthPct: 25 }),
      cell(String(errored), { widthPct: 25 }),
    ],
  });

  return [
    heading,
    projectLine,
    evalLine,
    meta,
    dates,
    buildTable([coverageHeader, coverageRow]),
  ];
}

function buildTelemetrySection(evaluation: V2Evaluation): Array<Paragraph | Table> {
  const heading = new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "Telemetry", bold: true })],
  });
  const raw = (evaluation.raw_eval_result_json ?? {}) as Record<string, unknown>;
  const corpusVersion = pickString(raw["corpus_version"]) || "n/a";
  const gitSha = pickString(raw["git_sha_at_run"]) || "n/a";
  const embedder = evaluation.embedder_backend || "n/a";
  const model = evaluation.model || "n/a";

  const header = buildHeaderRow(["Field", "Value"]);
  const rows: TableRow[] = [
    new TableRow({
      children: [cell("corpus_version", { bold: true, widthPct: 30 }), cell(corpusVersion, { widthPct: 70 })],
    }),
    new TableRow({
      children: [cell("embedder_backend", { bold: true }), cell(embedder)],
    }),
    new TableRow({
      children: [cell("model", { bold: true }), cell(model)],
    }),
    new TableRow({
      children: [cell("git_sha_at_run", { bold: true }), cell(gitSha)],
    }),
  ];
  return [heading, buildTable([header, ...rows])];
}

function buildTitleParagraphs(
  project: MemoBuilderInput["project"],
  evaluation: V2Evaluation,
): Paragraph[] {
  return [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: `${project.name}: Regulatory Review Memo`,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Evaluation ${evaluation.id} // ${evaluation.bench_fixture}`,
          italics: true,
        }),
      ],
    }),
  ];
}

function buildFooterParagraphs(generatedAt: Date): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated by ${MEMO_GENERATOR_VERSION} at ${DATE_FORMATTER.format(generatedAt)} (locale en-US)`,
          italics: true,
          color: "666666",
          size: 18,
        }),
      ],
    }),
  ];
}

// Pure build. Returns docx bytes plus the two hashes the route persists.
export async function buildMemo(
  input: MemoBuilderInput,
): Promise<MemoBuilderOutput> {
  const { project, evaluation, results, judgments } = input;

  const buckets = joinByTier(results, judgments);
  assertTierDiscretion(buckets);

  const titleParas = buildTitleParagraphs(project, evaluation);
  const overview = buildOverviewSection(project, evaluation);
  const t1 = buildTier1Section(buckets.get("TIER_1_BINARY") ?? []);
  const t2 = buildTier2Section(buckets.get("TIER_2_PROFESSIONAL") ?? []);
  const t3 = buildTier3Section(buckets.get("TIER_3_STATUTORY") ?? []);
  const telemetry = buildTelemetrySection(evaluation);
  // Use a deterministic generated_at derived from the snapshot hash so identical
  // inputs produce identical bytes. We do this by reusing evaluation.updated_at
  // when present; falls back to a fixed epoch only if updated_at is empty.
  const generatedAtIso = evaluation.updated_at || evaluation.started_at;
  const generatedAtDate = generatedAtIso
    ? new Date(generatedAtIso)
    : new Date(0);
  const footer = buildFooterParagraphs(
    Number.isNaN(generatedAtDate.getTime()) ? new Date(0) : generatedAtDate,
  );

  const doc = new Document({
    creator: MEMO_GENERATOR_VERSION,
    title: `${project.name}: Regulatory Review Memo`,
    description: `engine_v2 evaluation ${evaluation.id}`,
    sections: [
      {
        properties: {},
        children: [
          ...titleParas,
          ...overview,
          ...t1,
          ...t2,
          ...t3,
          ...telemetry,
          ...footer,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  // docx Packer returns a Buffer; normalize to Uint8Array for callers.
  const bytes = new Uint8Array(buffer);
  const contentSha256 = sha256Hex(bytes);
  const judgmentSnapshotHash = computeJudgmentSnapshotHash(judgments);
  return {
    bytes,
    contentSha256,
    judgmentSnapshotHash,
    generatorVersion: MEMO_GENERATOR_VERSION,
  };
}
