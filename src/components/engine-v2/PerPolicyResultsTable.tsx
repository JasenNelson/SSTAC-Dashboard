"use client";

// engine_v2 frontend Lane 2b / Modules L2b-3 + L2b-5 + L2b-2 (UI portion):
// per-policy results table with rich evidence/pathway rendering, filter/sort UX,
// and inline tier-aware HITL judgment buttons.
//
// L2b-3: evidence_packet + pathway_notes rendering inside the expand-row.
// L2b-5: tier / verdict / confidence filters + sort selector in a toolbar.
// L2b-2 (UI): inline JudgmentEditor with tier-allowed verdict dropdown,
//             rationale textarea, save button calling
//             POST /api/engine-v2/per-policy/<id>/judgment.
//
// Constraints:
//   - ASCII only. No em dashes, smart quotes, or Unicode arrows.
//   - Date formatters lock locale to "en-US" so server and client hydration
//     match (Lane 1 hydration-safety pattern).
//   - data-testid values from Lane 2a are preserved verbatim.

import { Fragment, useMemo, useState } from "react";
import type {
  V2PerPolicyResult,
  V2Judgment,
  JudgmentTier,
  JudgmentVerdict,
} from "@/lib/engine-v2/types_lane2";
import { ALLOWED_VERDICTS_BY_TIER } from "@/lib/engine-v2/types_lane2";
import {
  dereferenceSlice,
  type EvidenceSlice,
  type EvidenceSliceMap,
} from "@/lib/engine-v2/evidence_slices";

interface Props {
  results: V2PerPolicyResult[];
  judgments: V2Judgment[];
  // Lane 2c: top-level evidence_slices dict pulled from
  // evaluation.raw_eval_result_json. null when the evaluation was produced
  // by engine schema_version 0.0.1 (no evidence_slices emitted). Defaults
  // to null so existing call sites (tests, older pages) keep working.
  evidenceSlices?: EvidenceSliceMap | null;
}

type SortKey = "policy_id" | "tier" | "verdict" | "confidence";
type SortDir = "asc" | "desc";
type TierFilter = JudgmentTier | "ALL";
type VerdictFilter = string | "ALL";

interface JudgmentDraft {
  verdict: JudgmentVerdict | "";
  rationale: string;
}

const ALL_VERDICT_SUGGESTIONS: readonly string[] = [
  "PASS",
  "FAIL",
  "NOT_FOUND",
  "ESCALATE",
] as const;

const ALL_JUDGMENT_VERDICTS: readonly JudgmentVerdict[] = [
  "ADEQUATE",
  "INADEQUATE",
  "DEFICIENT",
  "REQUIRES_REVIEW",
  "OBSERVATION_ONLY",
] as const;

const RATIONALE_MAX_LEN = 8192;

function formatConfidence(c: number | null): string {
  if (c === null || c === undefined || Number.isNaN(c)) return "-";
  return c.toFixed(2);
}

function formatDateLocaleLocked(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
}

function TierBadge({ tier }: { tier: string | null }): React.ReactElement {
  let palette =
    "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
  if (tier === "TIER_1_BINARY") {
    palette =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  } else if (tier === "TIER_2_PROFESSIONAL") {
    palette =
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  } else if (tier === "TIER_3_STATUTORY") {
    palette = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  }
  const label = tier ?? "unknown";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${palette}`}
      data-testid="per-policy-tier-badge"
      data-tier={label}
    >
      {label}
    </span>
  );
}

function VerdictBadge({
  verdict,
}: {
  verdict: string | null;
}): React.ReactElement {
  let palette =
    "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
  if (verdict === "PASS" || verdict === "ADEQUATE") {
    palette =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  } else if (verdict === "FAIL" || verdict === "INADEQUATE") {
    palette = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  } else if (
    verdict === "ESCALATE" ||
    verdict === "REQUIRES_REVIEW" ||
    verdict === "DEFICIENT"
  ) {
    palette =
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  } else if (verdict === "OBSERVATION_ONLY") {
    palette =
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200";
  }
  const label = verdict ?? "-";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${palette}`}
      data-testid="per-policy-verdict-badge"
      data-verdict={label}
    >
      {label}
    </span>
  );
}

// Render a JSONB-ish value inline. Strings render as text; objects/arrays as
// <pre> JSON. No external deps; ASCII only.
function renderJsonValue(value: unknown): React.ReactElement {
  if (value === null || value === undefined) {
    return (
      <span className="italic text-slate-400 dark:text-slate-500">(empty)</span>
    );
  }
  if (typeof value === "string") {
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="font-mono">{String(value)}</span>;
  }
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-100 dark:bg-slate-800 p-2 text-[11px] font-mono text-slate-700 dark:text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function JsonObjectView({
  obj,
  emptyLabel,
  testId,
}: {
  obj: Record<string, unknown> | null | undefined;
  emptyLabel: string;
  testId: string;
}): React.ReactElement {
  const entries =
    obj && typeof obj === "object" ? Object.entries(obj) : [];
  if (entries.length === 0) {
    return (
      <div
        data-testid={`${testId}-empty`}
        className="italic text-slate-400 dark:text-slate-500"
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    <dl data-testid={testId} className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="space-y-0.5">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {k}
          </dt>
          <dd className="text-xs text-slate-700 dark:text-slate-300">
            {renderJsonValue(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StringListView({
  items,
  emptyLabel,
  testId,
}: {
  items: unknown;
  emptyLabel: string;
  testId: string;
}): React.ReactElement {
  const arr = Array.isArray(items) ? items : [];
  if (arr.length === 0) {
    return (
      <div
        data-testid={`${testId}-empty`}
        className="italic text-slate-400 dark:text-slate-500 text-xs"
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    <ul
      data-testid={testId}
      className="list-disc list-inside text-xs text-slate-700 dark:text-slate-300 space-y-0.5"
    >
      {arr.map((item, idx) => (
        <li key={idx} className="break-words">
          {typeof item === "string" ? item : JSON.stringify(item)}
        </li>
      ))}
    </ul>
  );
}

// Helper: pull a possibly-array sub-field out of evidence_packet for the
// minority findings / evidence gaps display.
function pickListField(
  obj: Record<string, unknown> | null | undefined,
  key: string,
): unknown {
  if (!obj || typeof obj !== "object") return null;
  return (obj as Record<string, unknown>)[key];
}

// Lane 2c: extract evidence items (objects carrying evidence_item_id) from
// the polymorphic evidence_packet. The engine_v2 contract states each
// evidence_item has an `evidence_item_id` of the form "slice_<sha256>" that
// keys into the top-level evidence_slices dict. The packet itself may
// contain items under common keys (items / evidence_items / chunks) or as
// a top-level array; we walk all values and collect any object that looks
// like an evidence item. Each returned entry also preserves the original
// item so callers can read auxiliary fields (e.g. evidence_type,
// evidence_item_ref.index_side, evidence_item_ref.source_document_provenance).
interface EvidenceItemRef {
  evidence_item_id: string;
  evidence_type: string | null;
  raw: Record<string, unknown>;
}

function isEvidenceItem(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const id = (v as Record<string, unknown>).evidence_item_id;
  return typeof id === "string" && id.length > 0;
}

// REGULATORY INVARIANT (owner directive 2026-05-12): evidence
// citations on the per-policy results table render ONLY submission
// content. Policy KB chunks (index_side === "corpus") are NEVER
// rendered here, regardless of how matched. Showing related or
// self-referenced policies under an evidence label is a known
// anti-pattern the owner has already rejected once historically.
// If you find yourself adding a fallback that surfaces policy-side
// content here, STOP and read this comment again.
//
// Enforcement: isCorpusSideItem() drops any evidence_packet entry whose
// evidence_item_ref.index_side === "corpus" (engine-side primary marker)
// or whose source_document_provenance.doc_id self-references the row's
// own policy_id (engine-side fallback marker for self-references).
function isCorpusSideItem(
  raw: Record<string, unknown>,
  rowPolicyId: string | null,
): boolean {
  const refRaw = raw.evidence_item_ref;
  if (refRaw && typeof refRaw === "object" && !Array.isArray(refRaw)) {
    const ref = refRaw as Record<string, unknown>;
    if (ref.index_side === "corpus") return true;
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
  // Defense-in-depth: the engine may flatten index_side onto the item.
  if (raw.index_side === "corpus") return true;
  return false;
}

function collectEvidenceItems(
  evidencePacket: Record<string, unknown> | null | undefined,
  rowPolicyId: string | null,
): EvidenceItemRef[] {
  if (!evidencePacket || typeof evidencePacket !== "object") return [];
  const out: EvidenceItemRef[] = [];
  const seen = new Set<string>();

  function consider(v: unknown): void {
    if (isEvidenceItem(v)) {
      const item = v as Record<string, unknown>;
      const id = String(item.evidence_item_id);
      if (seen.has(id)) return;
      seen.add(id);
      // REGULATORY INVARIANT: drop corpus-side / self-referenced entries
      // before they reach the renderer. See sentinel comment at the
      // evidence-citations render site.
      if (isCorpusSideItem(item, rowPolicyId)) return;
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

  // Walk known sub-keys plus the whole top-level dict's values, defensively.
  for (const key of ["items", "evidence_items", "chunks"]) {
    consider((evidencePacket as Record<string, unknown>)[key]);
  }
  // Also handle the case where evidence_packet itself is an array-like or
  // hosts top-level evidence item entries.
  for (const v of Object.values(evidencePacket)) {
    consider(v);
  }
  return out;
}

function truncateHash(hash: string, n = 12): string {
  if (!hash) return "";
  return hash.length <= n ? hash : `${hash.slice(0, n)}...`;
}

function EvidenceTypeBadge({
  evidenceType,
}: {
  evidenceType: string | null;
}): React.ReactElement | null {
  if (!evidenceType) return null;
  const upper = evidenceType.toUpperCase();
  let palette =
    "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
  if (upper === "POSITIVE") {
    palette =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  } else if (upper === "NEGATIVE") {
    palette = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  } else if (upper === "NEUTRAL") {
    palette =
      "bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200";
  }
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${palette}`}
      data-testid="evidence-type-badge"
      data-evidence-type={upper}
    >
      {upper}
    </span>
  );
}

function copyToClipboard(text: string): void {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    void navigator.clipboard.writeText(text);
  }
}

function EvidenceCitationCard({
  itemRef,
  slice,
}: {
  itemRef: EvidenceItemRef;
  slice: EvidenceSlice;
}): React.ReactElement {
  const src = slice.source;
  const titleText = src.title || src.doc_id || "(unknown source)";
  const pageLabel = src.page !== null ? `p. ${src.page}` : null;
  const sectionLabel = src.section ? `Section ${src.section}` : null;
  return (
    <div
      data-testid="evidence-citation-card"
      data-evidence-item-id={itemRef.evidence_item_id}
      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="evidence-citation-source"
          className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-md"
          title={titleText}
        >
          {titleText}
        </span>
        {pageLabel ? (
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {pageLabel}
          </span>
        ) : null}
        {sectionLabel ? (
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {sectionLabel}
          </span>
        ) : null}
        <EvidenceTypeBadge evidenceType={itemRef.evidence_type} />
        <button
          type="button"
          data-testid="evidence-citation-hash"
          onClick={() => copyToClipboard(slice.content_hash)}
          title={slice.content_hash}
          className="ml-auto rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          {truncateHash(slice.content_hash)}
        </button>
      </div>
      <blockquote
        data-testid="evidence-citation-content"
        className="border-l-4 border-indigo-300 dark:border-indigo-500/60 pl-3 italic text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line break-words"
      >
        {slice.content}
      </blockquote>
    </div>
  );
}

function compareResults(
  a: V2PerPolicyResult,
  b: V2PerPolicyResult,
  key: SortKey,
): number {
  if (key === "policy_id") {
    return (a.policy_id ?? "").localeCompare(b.policy_id ?? "");
  }
  if (key === "tier") {
    return (a.tier ?? "").localeCompare(b.tier ?? "");
  }
  if (key === "verdict") {
    return (a.verdict_suggestion ?? "").localeCompare(
      b.verdict_suggestion ?? "",
    );
  }
  // confidence: nulls sort last (treat as -Infinity for asc, so they end up
  // smallest; but we want nulls last regardless of direction, so use a
  // sentinel approach).
  const av = a.confidence ?? Number.NEGATIVE_INFINITY;
  const bv = b.confidence ?? Number.NEGATIVE_INFINITY;
  if (av === bv) return 0;
  return av < bv ? -1 : 1;
}

function isJudgmentTier(value: unknown): value is JudgmentTier {
  return (
    value === "TIER_1_BINARY" ||
    value === "TIER_2_PROFESSIONAL" ||
    value === "TIER_3_STATUTORY"
  );
}

function allowedVerdictsForRow(tier: string | null): readonly JudgmentVerdict[] {
  if (isJudgmentTier(tier)) return ALLOWED_VERDICTS_BY_TIER[tier];
  // Tier unknown: fall back to all verdicts (the UI will disable the form).
  return ALL_JUDGMENT_VERDICTS;
}

function tierHelpText(tier: string | null): string | null {
  if (tier === "TIER_2_PROFESSIONAL") {
    return "Professional judgment tier: cannot return ADEQUATE.";
  }
  if (tier === "TIER_3_STATUTORY") {
    return "Statutory tier: SDM/Crown determines adequacy; reviewer can only observe.";
  }
  if (!isJudgmentTier(tier)) {
    return "Tier unknown: judgment disabled until tier is resolved.";
  }
  return null;
}

export function PerPolicyResultsTable({
  results,
  judgments,
  evidenceSlices = null,
}: Props): React.ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Toolbar state (L2b-5).
  const [filterTier, setFilterTier] = useState<TierFilter>("ALL");
  const [filterVerdict, setFilterVerdict] = useState<VerdictFilter>("ALL");
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortKey>("policy_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Judgment state (L2b-2 UI portion).
  const initialLatest: Record<string, V2Judgment> = useMemo(() => {
    const out: Record<string, V2Judgment> = {};
    for (const j of judgments) {
      const existing = out[j.per_policy_result_id];
      if (!existing) {
        out[j.per_policy_result_id] = j;
      } else if (
        new Date(j.updated_at).getTime() >
        new Date(existing.updated_at).getTime()
      ) {
        out[j.per_policy_result_id] = j;
      }
    }
    return out;
  }, [judgments]);

  const [judgmentLatest, setJudgmentLatest] =
    useState<Record<string, V2Judgment>>(initialLatest);
  const [judgmentDraft, setJudgmentDraft] = useState<
    Record<string, JudgmentDraft>
  >({});
  const [judgmentSaving, setJudgmentSaving] = useState<Set<string>>(new Set());
  const [judgmentError, setJudgmentError] = useState<
    Record<string, string>
  >({});

  // Per-row disclosure state for engineering-only fields (stage/packet line).
  const [techDetailsOpen, setTechDetailsOpen] = useState<Set<string>>(new Set());

  function toggleTechDetails(id: string): void {
    setTechDetailsOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Lane 2c: locate the policy text for a row from evidence_slices. Several
  // slices may carry the same policy_id (rare); take the first match for a
  // prominent quote. Returns null when slices map is null/empty or when no
  // slice matches the policy_id.
  function findPolicyText(policyId: string | null): string | null {
    if (!policyId || !evidenceSlices) return null;
    for (const slice of Object.values(evidenceSlices)) {
      if (slice && slice.policy_id === policyId) {
        return slice.content;
      }
    }
    return null;
  }

  // Filter + sort.
  const filtered = useMemo(() => {
    const filteredArr = results.filter((r) => {
      if (filterTier !== "ALL" && r.tier !== filterTier) return false;
      if (
        filterVerdict !== "ALL" &&
        r.verdict_suggestion !== filterVerdict
      ) {
        return false;
      }
      if ((r.confidence ?? 0) < minConfidence) return false;
      return true;
    });
    // Stable sort: decorate with original index.
    const decorated = filteredArr.map((r, idx) => ({ r, idx }));
    decorated.sort((a, b) => {
      const cmp = compareResults(a.r, b.r, sortBy);
      if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
      return a.idx - b.idx;
    });
    return decorated.map((d) => d.r);
  }, [results, filterTier, filterVerdict, minConfidence, sortBy, sortDir]);

  function setDraftField(
    id: string,
    field: keyof JudgmentDraft,
    value: string,
  ): void {
    setJudgmentDraft((prev) => {
      const cur = prev[id] ?? { verdict: "", rationale: "" };
      return { ...prev, [id]: { ...cur, [field]: value } };
    });
  }

  function getDraft(id: string, tier: string | null): JudgmentDraft {
    const existing = judgmentDraft[id];
    if (existing) return existing;
    const latest = judgmentLatest[id];
    if (latest) {
      return {
        verdict: latest.verdict,
        rationale: latest.rationale ?? "",
      };
    }
    // Pre-fill with the first allowed verdict for the tier.
    const allowed = allowedVerdictsForRow(tier);
    return {
      verdict: allowed.length > 0 ? allowed[0]! : "",
      rationale: "",
    };
  }

  async function saveJudgment(
    resultId: string,
    tier: string | null,
  ): Promise<void> {
    const draft = getDraft(resultId, tier);
    if (!draft.verdict) {
      setJudgmentError((prev) => ({
        ...prev,
        [resultId]: "Select a verdict before saving.",
      }));
      return;
    }
    setJudgmentSaving((prev) => {
      const next = new Set(prev);
      next.add(resultId);
      return next;
    });
    setJudgmentError((prev) => {
      const next = { ...prev };
      delete next[resultId];
      return next;
    });
    try {
      const resp = await fetch(
        `/api/engine-v2/per-policy/${encodeURIComponent(resultId)}/judgment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            per_policy_result_id: resultId,
            verdict: draft.verdict,
            rationale: draft.rationale.length === 0 ? null : draft.rationale,
          }),
        },
      );
      if (resp.status === 200) {
        const body = (await resp.json()) as V2Judgment;
        setJudgmentLatest((prev) => ({ ...prev, [resultId]: body }));
        setJudgmentDraft((prev) => {
          const next = { ...prev };
          delete next[resultId];
          return next;
        });
      } else if (resp.status === 422) {
        let detail = "Verdict not allowed for tier.";
        try {
          const body = (await resp.json()) as {
            error?: string;
            tier?: string;
            verdict?: string;
            allowed?: string[];
          };
          if (
            body &&
            body.error === "verdict_not_allowed_for_tier" &&
            Array.isArray(body.allowed)
          ) {
            detail =
              `verdict_not_allowed_for_tier: tier=${body.tier ?? "?"} ` +
              `verdict=${body.verdict ?? "?"}; allowed=${body.allowed.join(", ")}`;
          }
        } catch {
          // fall through with default detail
        }
        setJudgmentError((prev) => ({ ...prev, [resultId]: detail }));
      } else {
        let detail = `Save failed (HTTP ${resp.status}).`;
        try {
          const body = (await resp.json()) as { error?: string };
          if (body && body.error) {
            detail = `Save failed: ${body.error} (HTTP ${resp.status}).`;
          }
        } catch {
          // fall through with default detail
        }
        setJudgmentError((prev) => ({ ...prev, [resultId]: detail }));
      }
    } catch (err) {
      setJudgmentError((prev) => ({
        ...prev,
        [resultId]: `Save failed: ${(err as Error).message}`,
      }));
    } finally {
      setJudgmentSaving((prev) => {
        const next = new Set(prev);
        next.delete(resultId);
        return next;
      });
    }
  }

  if (results.length === 0) {
    return (
      <div
        data-testid="per-policy-results-empty"
        className="text-sm italic text-slate-500 dark:text-slate-400"
      >
        No per-policy results yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar (L2b-5) */}
      <div
        data-testid="per-policy-results-toolbar"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
      >
        <label className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
          <span className="mb-1 font-semibold uppercase tracking-wide">
            Tier
          </span>
          <select
            data-testid="filter-tier"
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value as TierFilter)}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white"
          >
            <option value="ALL">All tiers</option>
            <option value="TIER_1_BINARY">TIER_1_BINARY</option>
            <option value="TIER_2_PROFESSIONAL">TIER_2_PROFESSIONAL</option>
            <option value="TIER_3_STATUTORY">TIER_3_STATUTORY</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
          <span className="mb-1 font-semibold uppercase tracking-wide">
            AI Verdict
          </span>
          <select
            data-testid="filter-verdict"
            value={filterVerdict}
            onChange={(e) => setFilterVerdict(e.target.value)}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white"
          >
            <option value="ALL">All verdicts</option>
            {ALL_VERDICT_SUGGESTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
          <span className="mb-1 font-semibold uppercase tracking-wide">
            Min Confidence ({minConfidence.toFixed(2)})
          </span>
          <input
            data-testid="filter-min-confidence"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minConfidence}
            onChange={(e) =>
              setMinConfidence(Number.parseFloat(e.target.value))
            }
            className="w-40"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
          <span className="mb-1 font-semibold uppercase tracking-wide">
            Sort by
          </span>
          <select
            data-testid="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white"
          >
            <option value="policy_id">Policy ID</option>
            <option value="tier">Tier</option>
            <option value="verdict">Verdict</option>
            <option value="confidence">Confidence</option>
          </select>
        </label>
        <button
          type="button"
          data-testid="sort-dir-toggle"
          onClick={() =>
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
          }
          className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
        <div
          data-testid="results-count"
          className="ml-auto text-xs text-slate-500 dark:text-slate-400"
        >
          Showing {filtered.length} of {results.length}
        </div>
      </div>

      {/* Table */}
      <div
        data-testid="per-policy-results-table"
        className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      >
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                Policy
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                Tier
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                AI Verdict
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                Confidence
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                AI Determination
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                Judgment
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                Expand
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  data-testid="per-policy-results-filtered-empty"
                  className="px-4 py-6 text-center text-sm italic text-slate-400 dark:text-slate-500"
                >
                  No rows match current filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isExpanded = expandedId === r.id;
                const latestJudgment = judgmentLatest[r.id];
                const draft = getDraft(r.id, r.tier);
                const allowed = allowedVerdictsForRow(r.tier);
                const tierKnown = isJudgmentTier(r.tier);
                const saving = judgmentSaving.has(r.id);
                const errorMsg = judgmentError[r.id];
                const helpText = tierHelpText(r.tier);
                const minorityFindings = pickListField(
                  r.evidence_packet,
                  "minority_findings",
                );
                const evidenceGaps = pickListField(
                  r.evidence_packet,
                  "evidence_gaps",
                );

                return (
                  <Fragment key={r.id}>
                    <tr
                      data-testid="per-policy-row"
                      data-policy-id={r.policy_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 align-top"
                    >
                      <td className="px-4 py-2 text-sm font-mono text-slate-900 dark:text-white whitespace-nowrap">
                        {r.policy_id}
                      </td>
                      <td className="px-4 py-2 text-sm whitespace-nowrap">
                        <TierBadge tier={r.tier} />
                      </td>
                      <td className="px-4 py-2 text-sm whitespace-nowrap">
                        <VerdictBadge verdict={r.verdict_suggestion} />
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatConfidence(r.confidence)}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 max-w-xl">
                        <span className="line-clamp-2">
                          {r.summary ?? (
                            <span className="italic text-slate-400 dark:text-slate-500">
                              (no determination)
                            </span>
                          )}
                        </span>
                      </td>
                      <td
                        className="px-4 py-2 text-sm whitespace-nowrap"
                        data-testid="per-policy-judgment-cell"
                      >
                        {latestJudgment ? (
                          <VerdictBadge verdict={latestJudgment.verdict} />
                        ) : (
                          <span
                            className="text-xs italic text-slate-400 dark:text-slate-500"
                            data-testid="per-policy-no-judgment"
                          >
                            Not yet judged
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm whitespace-nowrap">
                        <button
                          type="button"
                          data-testid="per-policy-expand-toggle"
                          onClick={() =>
                            setExpandedId((prev) =>
                              prev === r.id ? null : r.id,
                            )
                          }
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr
                        data-testid="per-policy-detail-row"
                        className="bg-slate-50 dark:bg-slate-800/40"
                      >
                        <td
                          colSpan={7}
                          className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 space-y-4"
                        >
                          {/* Policy text (prominent, first) -- Lane 2c per-row
                              ask: surface verbatim policy text from
                              evidence_slices keyed by policy_id. */}
                          <section data-testid="per-policy-policy-text-section">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                              Policy text
                            </div>
                            {(() => {
                              const policyText = findPolicyText(r.policy_id);
                              if (policyText) {
                                return (
                                  <blockquote
                                    data-testid="per-policy-policy-text"
                                    className="border-l-4 border-indigo-400 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20 pl-4 pr-3 py-2 text-sm leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words"
                                  >
                                    {policyText}
                                  </blockquote>
                                );
                              }
                              if (evidenceSlices === null) {
                                return (
                                  <div
                                    data-testid="per-policy-policy-text-older-schema"
                                    className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2 text-xs italic text-slate-500 dark:text-slate-400"
                                  >
                                    Policy text not available (eval schema
                                    v0.0.1).
                                  </div>
                                );
                              }
                              return (
                                <div
                                  data-testid="per-policy-policy-text-missing"
                                  className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2 text-xs italic text-slate-500 dark:text-slate-400"
                                >
                                  Policy text not retrieved by this evaluation.
                                </div>
                              );
                            })()}
                          </section>

                          {/* AI Determination (formerly "Summary"). This is
                              the AI's verdict + supporting prose for THIS
                              submission against THIS policy, not a recap of
                              the policy itself. */}
                          <section>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                              AI Determination
                            </div>
                            <div
                              data-testid="per-policy-full-summary"
                              className="whitespace-pre-wrap break-words text-xs"
                            >
                              {r.summary ?? (
                                <span className="italic text-slate-400 dark:text-slate-500">
                                  (no determination)
                                </span>
                              )}
                            </div>
                          </section>

                          {/* Verbatim evidence citations (Lane 2c, schema 0.1.0). */}
                          {/* REGULATORY INVARIANT (owner directive 2026-05-12): submission */}
                          {/* content ONLY -- see sentinel comment above isCorpusSideItem(). */}
                          <section data-testid="per-policy-verbatim-section">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                              Verbatim evidence citations
                            </div>
                            {(() => {
                              const items = collectEvidenceItems(
                                r.evidence_packet,
                                r.policy_id,
                              );
                              if (items.length === 0) {
                                return (
                                  <div
                                    data-testid="per-policy-evidence-empty-submission"
                                    className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs italic text-slate-600 dark:text-slate-300 whitespace-pre-line"
                                  >
                                    {
                                      "No submission evidence cited. The engine could not locate matching\ncontent in the structured submission for this policy. Reviewer should\nexamine the AI determination above and the structured submission\ndirectly to verify whether the AI's read is supported by the source."
                                    }
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-2">
                                  {items.map((itemRef) => {
                                    const slice = dereferenceSlice(
                                      evidenceSlices,
                                      itemRef.evidence_item_id,
                                    );
                                    if (slice) {
                                      return (
                                        <EvidenceCitationCard
                                          key={itemRef.evidence_item_id}
                                          itemRef={itemRef}
                                          slice={slice}
                                        />
                                      );
                                    }
                                    if (evidenceSlices === null) {
                                      return (
                                        <div
                                          key={itemRef.evidence_item_id}
                                          data-testid="per-policy-verbatim-older-schema"
                                          data-evidence-item-id={
                                            itemRef.evidence_item_id
                                          }
                                          className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2 text-[11px] italic text-slate-500 dark:text-slate-400"
                                        >
                                          Verbatim text not available (this
                                          evaluation was produced with engine
                                          schema v0.0.1; re-run on schema
                                          v0.1.0+ to surface verbatim evidence).
                                        </div>
                                      );
                                    }
                                    return (
                                      <div
                                        key={itemRef.evidence_item_id}
                                        data-testid="per-policy-verbatim-missing-slice"
                                        data-evidence-item-id={
                                          itemRef.evidence_item_id
                                        }
                                        className="rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2 text-[11px] text-amber-800 dark:text-amber-200"
                                      >
                                        Slice{" "}
                                        <span className="font-mono">
                                          {truncateHash(
                                            itemRef.evidence_item_id,
                                            18,
                                          )}
                                        </span>{" "}
                                        not present in evidence_slices dict.
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </section>

                          {/* Evidence packet */}
                          <section>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                              Evidence packet
                            </div>
                            <JsonObjectView
                              obj={r.evidence_packet}
                              emptyLabel="No evidence packet emitted by this stage."
                              testId="per-policy-evidence-packet"
                            />
                          </section>

                          {/* Pathway notes */}
                          <section>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                              Pathway notes
                            </div>
                            <JsonObjectView
                              obj={r.pathway_notes}
                              emptyLabel="No pathway notes recorded."
                              testId="per-policy-pathway-notes"
                            />
                          </section>

                          {/* Minority findings + evidence gaps */}
                          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                                Minority findings
                              </div>
                              <StringListView
                                items={minorityFindings}
                                emptyLabel="No minority findings recorded."
                                testId="per-policy-minority-findings"
                              />
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                                Evidence gaps
                              </div>
                              <StringListView
                                items={evidenceGaps}
                                emptyLabel="No evidence gaps recorded."
                                testId="per-policy-evidence-gaps"
                              />
                            </div>
                          </section>

                          {/* Technical details disclosure (engineering-only:
                              stage / packet_id / ai_suggestion /
                              confidence_method). Default-hidden so reviewers
                              don't see internal pipeline IDs. */}
                          <section data-testid="per-policy-tech-details-section">
                            <button
                              type="button"
                              data-testid="per-policy-tech-details-toggle"
                              aria-expanded={techDetailsOpen.has(r.id)}
                              onClick={() => toggleTechDetails(r.id)}
                              className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline"
                            >
                              {techDetailsOpen.has(r.id)
                                ? "Hide technical details"
                                : "Show technical details"}
                            </button>
                            {techDetailsOpen.has(r.id) ? (
                              <div className="mt-1">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                                  Stage / Packet
                                </div>
                                <div
                                  data-testid="per-policy-stage-info"
                                  className="font-mono text-xs break-words text-slate-600 dark:text-slate-400"
                                >
                                  stage={r.stage ?? "-"} packet_id=
                                  {r.packet_id ?? "-"} ai_suggestion=
                                  {r.ai_suggestion ?? "-"} confidence_method=
                                  {r.confidence_method ?? "-"}
                                </div>
                              </div>
                            ) : null}
                          </section>

                          {/* Current judgment status */}
                          {latestJudgment ? (
                            <section
                              data-testid="per-policy-current-judgment"
                              className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs"
                            >
                              Last judgment:{" "}
                              <strong>{latestJudgment.verdict}</strong> by{" "}
                              <span className="font-mono">
                                {latestJudgment.reviewer_user_id}
                              </span>{" "}
                              on{" "}
                              <span className="font-mono">
                                {formatDateLocaleLocked(
                                  latestJudgment.updated_at,
                                )}
                              </span>
                              {latestJudgment.rationale ? (
                                <div className="mt-1 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">
                                  Rationale: {latestJudgment.rationale}
                                </div>
                              ) : null}
                            </section>
                          ) : null}

                          {/* HITL judgment form */}
                          <section
                            data-testid="per-policy-judgment-form"
                            className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2"
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              HITL Judgment
                            </div>
                            {helpText ? (
                              <div
                                data-testid="per-policy-tier-help"
                                className="text-[11px] italic text-slate-500 dark:text-slate-400"
                              >
                                {helpText}
                              </div>
                            ) : null}
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Verdict
                              </span>
                              <select
                                data-testid="per-policy-judgment-verdict"
                                value={draft.verdict}
                                disabled={!tierKnown || saving}
                                onChange={(e) =>
                                  setDraftField(
                                    r.id,
                                    "verdict",
                                    e.target.value,
                                  )
                                }
                                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                              >
                                {allowed.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Rationale (optional)
                              </span>
                              <textarea
                                data-testid="per-policy-judgment-rationale"
                                value={draft.rationale}
                                maxLength={RATIONALE_MAX_LEN}
                                disabled={!tierKnown || saving}
                                onChange={(e) =>
                                  setDraftField(
                                    r.id,
                                    "rationale",
                                    e.target.value,
                                  )
                                }
                                rows={3}
                                className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                              />
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 self-end">
                                {draft.rationale.length} / {RATIONALE_MAX_LEN}
                              </span>
                            </label>
                            {errorMsg ? (
                              <div
                                data-testid="per-policy-judgment-error"
                                className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words"
                              >
                                {errorMsg}
                              </div>
                            ) : null}
                            <div className="flex justify-end">
                              <button
                                type="button"
                                data-testid="per-policy-judgment-save"
                                disabled={!tierKnown || saving}
                                onClick={() => {
                                  void saveJudgment(r.id, r.tier);
                                }}
                                className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                              >
                                {saving ? "Saving..." : "Save judgment"}
                              </button>
                            </div>
                          </section>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PerPolicyResultsTable;
