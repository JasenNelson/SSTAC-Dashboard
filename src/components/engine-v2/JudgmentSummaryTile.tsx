// engine_v2 frontend Lane 2b: JudgmentSummaryTile.
//
// Server Component (no interactivity). Renders a reviewer-facing rollup of
// judgment progress across all per-policy results for the current evaluation:
//   - Section 1: Progress (Judged X of Y + bar)
//   - Section 2: Judgment verdicts (counts by JudgmentVerdict)
//   - Section 3: Tier mix (counts by AI-suggested tier on per-policy results)
//
// Defensive against undefined verdict/tier values. ASCII only. No `any`.

import type {
  V2PerPolicyResult,
  V2Judgment,
  JudgmentTier,
  JudgmentVerdict,
} from "@/lib/engine-v2/types_lane2";

interface Props {
  results: V2PerPolicyResult[];
  judgments: V2Judgment[];
}

const VERDICT_ORDER: readonly JudgmentVerdict[] = [
  "ADEQUATE",
  "INADEQUATE",
  "DEFICIENT",
  "REQUIRES_REVIEW",
  "OBSERVATION_ONLY",
] as const;

const TIER_ORDER: readonly (JudgmentTier | "Unknown")[] = [
  "TIER_1_BINARY",
  "TIER_2_PROFESSIONAL",
  "TIER_3_STATUTORY",
  "Unknown",
] as const;

function verdictPalette(verdict: JudgmentVerdict): string {
  // Match VerdictBadge in PerPolicyResultsTable.tsx.
  if (verdict === "ADEQUATE") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (verdict === "INADEQUATE") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  }
  if (verdict === "REQUIRES_REVIEW" || verdict === "DEFICIENT") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
  // OBSERVATION_ONLY falls through to slate (per spec: "slate for the others").
  return "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
}

function tierPalette(tier: JudgmentTier | "Unknown"): string {
  // Match TierBadge in PerPolicyResultsTable.tsx.
  if (tier === "TIER_1_BINARY") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (tier === "TIER_2_PROFESSIONAL") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
  if (tier === "TIER_3_STATUTORY") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
}

function isJudgmentVerdict(v: unknown): v is JudgmentVerdict {
  return (
    typeof v === "string" &&
    (VERDICT_ORDER as readonly string[]).includes(v)
  );
}

function classifyTier(t: string | null | undefined): JudgmentTier | "Unknown" {
  if (t === "TIER_1_BINARY" || t === "TIER_2_PROFESSIONAL" || t === "TIER_3_STATUTORY") {
    return t;
  }
  return "Unknown";
}

export function JudgmentSummaryTile({
  results,
  judgments,
}: Props): React.ReactElement {
  const total = results.length;

  // Build set of result ids that have at least one judgment row.
  const judgedResultIds = new Set<string>();
  for (const j of judgments) {
    if (j && typeof j.per_policy_result_id === "string") {
      judgedResultIds.add(j.per_policy_result_id);
    }
  }
  const judged = judgedResultIds.size;
  const unjudged = Math.max(0, total - judged);
  const pct = total > 0 ? Math.round((judged / total) * 100) : 0;

  // Verdict counts across all judgment rows. Initialize all known verdicts to 0
  // so the grid always renders the full set.
  const verdictCounts: Record<JudgmentVerdict, number> = {
    ADEQUATE: 0,
    INADEQUATE: 0,
    DEFICIENT: 0,
    REQUIRES_REVIEW: 0,
    OBSERVATION_ONLY: 0,
  };
  for (const j of judgments) {
    const v = j?.verdict;
    if (isJudgmentVerdict(v)) {
      verdictCounts[v] += 1;
    }
  }

  // Tier counts across per-policy results (AI-suggested tier).
  const tierCounts: Record<JudgmentTier | "Unknown", number> = {
    TIER_1_BINARY: 0,
    TIER_2_PROFESSIONAL: 0,
    TIER_3_STATUTORY: 0,
    Unknown: 0,
  };
  for (const r of results) {
    const key = classifyTier(r?.tier ?? null);
    tierCounts[key] += 1;
  }

  return (
    <section
      data-testid="judgment-summary-tile"
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-5"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Judgment summary
      </h3>

      {/* Section 1: Progress */}
      <div data-testid="judgment-summary-progress" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
            <span data-testid="judgment-summary-judged">{judged}</span>
            <span className="text-slate-400 dark:text-slate-500"> of </span>
            <span data-testid="judgment-summary-total">{total}</span>
            <span className="ml-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              judged
            </span>
          </div>
          <div
            className="text-xs font-mono text-slate-500 dark:text-slate-400"
            data-testid="judgment-summary-unjudged"
          >
            {unjudged} unjudged
          </div>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Judgment progress"
        >
          <div
            data-testid="judgment-summary-progress-bar"
            className="h-full bg-sky-500 dark:bg-sky-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Section 2: Judgment verdicts */}
      <div data-testid="judgment-summary-verdicts" className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Judgment verdicts
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {VERDICT_ORDER.map((v) => (
            <span
              key={v}
              data-testid="judgment-summary-verdict-pill"
              data-verdict={v}
              className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${verdictPalette(v)}`}
            >
              <span>{v}</span>
              <span className="font-mono normal-case tracking-normal">
                {verdictCounts[v]}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Section 3: Tier mix */}
      <div data-testid="judgment-summary-tiers" className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Tier mix (AI-suggested)
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {TIER_ORDER.map((t) => (
            <span
              key={t}
              data-testid="judgment-summary-tier-pill"
              data-tier={t}
              className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium ${tierPalette(t)}`}
            >
              <span>{t}</span>
              <span className="font-mono">{tierCounts[t]}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default JudgmentSummaryTile;
