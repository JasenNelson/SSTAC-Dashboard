// engine_v2 S4 read-side: EvidenceStatusCell.tsx
//
// Presentational, READ-ONLY cell that replaces the AI verdict badge for 0.1.0
// per-policy rows. Legacy 0.0.1 rows keep VerdictBadge; the caller branches on
// resolveEvidenceStatus(row).isEvidenceStatus before choosing which to render.
//
// Mirrors the inline VerdictBadge / TierBadge style from PerPolicyResultsTable
// (span + Tailwind palette + data-testid). No adequacy / sufficiency / tier
// words anywhere. Plain ASCII only (code-point <= 127).

import type { EvidenceSignalCounts } from "@/lib/engine-v2/schema_version";

interface EvidenceStatusCellProps {
  // Whether relevant evidence was located. Null is treated as "unknown" but
  // should not occur for 0.1.0 rows in practice.
  present: boolean | null;
  // Per-packet signal rollup. Null when the engine did not emit signal counts.
  signalCounts: EvidenceSignalCounts | null;
  // Confidence in the evidence match (the EXISTING confidence column, reframed).
  // Only rendered when confidenceScope === "EVIDENCE_MATCH_NOT_ADEQUACY".
  confidence: number | null;
  // Scope tag from evidence_synthesis; must equal "EVIDENCE_MATCH_NOT_ADEQUACY"
  // for the confidence value to be displayed (guards against wrong labelling).
  confidenceScope: string | null;
  // True when indigenous_content_signal.matched is true in the packet.
  indigenousMatched: boolean;
  // Keywords that triggered the indigenous content detector.
  indigenousKeywords: string[];
}

// ---- Present / absent indicator badge ----

function PresentBadge({ present }: { present: boolean | null }): React.ReactElement {
  if (present === true) {
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
        data-testid="evidence-present-badge"
        data-evidence-present="true"
      >
        Evidence present
      </span>
    );
  }
  if (present === false) {
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300"
        data-testid="evidence-present-badge"
        data-evidence-present="false"
      >
        Evidence absent
      </span>
    );
  }
  // present === null (should not occur for 0.1.0; renders defensively).
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400"
      data-testid="evidence-present-badge"
      data-evidence-present="unknown"
    >
      Unknown
    </span>
  );
}

// ---- Compact signal readout ----

function SignalReadout({ signalCounts }: { signalCounts: EvidenceSignalCounts | null }): React.ReactElement | null {
  if (!signalCounts) return null;
  const parts: string[] = [];
  const { total_cited, supporting, negating } = signalCounts;
  if (typeof total_cited === "number") parts.push(`${total_cited} cited`);
  if (typeof supporting === "number") parts.push(`${supporting} support`);
  if (typeof negating === "number") parts.push(`${negating} negate`);
  if (parts.length === 0) return null;
  return (
    <span
      data-testid="evidence-signal-readout"
      className="text-[11px] font-mono text-slate-600 dark:text-slate-400"
    >
      {parts.join(" / ")}
    </span>
  );
}

// ---- Indigenous uses content-type badge ----

function IndigenousContentBadge({ keywords }: { keywords: string[] }): React.ReactElement {
  const title =
    keywords.length > 0
      ? "Indigenous uses content detected: " + keywords.join(", ")
      : "Indigenous uses content detected";
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
      data-testid="indigenous-content-badge"
      title={title}
    >
      Indigenous uses content
    </span>
  );
}

// ---- Main component ----

export function EvidenceStatusCell({
  present,
  signalCounts,
  confidence,
  confidenceScope,
  indigenousMatched,
  indigenousKeywords,
}: EvidenceStatusCellProps): React.ReactElement {
  // Only display the confidence value when it is scoped to evidence match,
  // never as an adequacy or verdict score.
  const showConfidence =
    confidenceScope === "EVIDENCE_MATCH_NOT_ADEQUACY" &&
    confidence !== null &&
    Number.isFinite(confidence);

  return (
    <div
      data-testid="evidence-status-cell"
      className="flex flex-col gap-1"
    >
      {/* Present / absent indicator (replaces the old NOT_FOUND verdict) */}
      <PresentBadge present={present} />

      {/* Compact signal readout */}
      <SignalReadout signalCounts={signalCounts} />

      {/* Match-confidence (only when scope guard passes) */}
      {showConfidence ? (
        <span
          data-testid="evidence-match-confidence"
          className="text-[11px] font-mono text-slate-500 dark:text-slate-400"
        >
          match confidence: {confidence!.toFixed(2)}
        </span>
      ) : null}

      {/* Indigenous uses content-type badge (content-type metadata only;
          no procedural / consultation / tier / SDM / QP language). */}
      {indigenousMatched ? (
        <IndigenousContentBadge keywords={indigenousKeywords} />
      ) : null}
    </div>
  );
}
