"use client";

// engine_v2 frontend Lane 2a / Module L2a-5: per-policy results table.
//
// Client Component. Renders the V2PerPolicyResult[] rows in a Tailwind table
// matching the slate-palette + dark-mode styling used by Lane 1 (see FileList).
// Each row is expandable: a "Show more" toggle reveals the full summary,
// evidence_packet keys, and pathway_notes keys inline below the row.
//
// Constraints:
//   - ASCII only. No em dashes, smart quotes, or Unicode arrows.
//   - Date formatters (if any are added) must lock locale to "en-US" so server
//     and client hydration match (Lane 1 hydration-safety pattern).

import { Fragment, useState } from "react";
import type { V2PerPolicyResult } from "@/lib/engine-v2/types_lane2";

interface Props {
  results: V2PerPolicyResult[];
}

const SUMMARY_TRUNCATE_CHARS = 120;

function truncate(s: string | null, limit: number): string {
  if (!s) return "";
  if (s.length <= limit) return s;
  return s.slice(0, limit).trimEnd() + "...";
}

function formatConfidence(c: number | null): string {
  if (c === null || c === undefined || Number.isNaN(c)) return "-";
  return c.toFixed(2);
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
  if (verdict === "PASS") {
    palette =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  } else if (verdict === "FAIL") {
    palette = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  } else if (verdict === "ESCALATE") {
    palette =
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
  // NOT_FOUND and unknown both fall to the default slate palette.
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

function keyList(obj: Record<string, unknown> | null | undefined): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj);
}

export function PerPolicyResultsTable({
  results,
}: Props): React.ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
              Verdict
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
              Summary
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {results.map((r) => {
            const isExpanded = expandedId === r.id;
            const fullSummary = r.summary ?? "";
            const needsTruncation = fullSummary.length > SUMMARY_TRUNCATE_CHARS;
            const evidenceKeys = keyList(r.evidence_packet);
            const pathwayKeys = keyList(r.pathway_notes);
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
                  <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
                    {needsTruncation && !isExpanded ? (
                      <span>
                        {truncate(fullSummary, SUMMARY_TRUNCATE_CHARS)}{" "}
                        <button
                          type="button"
                          onClick={() => setExpandedId(r.id)}
                          data-testid="per-policy-show-more"
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
                        >
                          Show more
                        </button>
                      </span>
                    ) : (
                      <span>
                        {fullSummary || (
                          <span className="italic text-slate-400 dark:text-slate-500">
                            (no summary)
                          </span>
                        )}
                        {needsTruncation && isExpanded ? (
                          <>
                            {" "}
                            <button
                              type="button"
                              onClick={() => setExpandedId(null)}
                              data-testid="per-policy-show-less"
                              className="text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:underline"
                            >
                              Show less
                            </button>
                          </>
                        ) : null}
                      </span>
                    )}
                  </td>
                </tr>
                {isExpanded ? (
                  <tr
                    data-testid="per-policy-detail-row"
                    className="bg-slate-50 dark:bg-slate-800/40"
                  >
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 space-y-2"
                    >
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                          Stage / Packet
                        </div>
                        <div className="font-mono text-xs">
                          stage={r.stage ?? "-"} packet_id=
                          {r.packet_id ?? "-"} ai_suggestion=
                          {r.ai_suggestion ?? "-"} confidence_method=
                          {r.confidence_method ?? "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                          Evidence packet keys ({evidenceKeys.length})
                        </div>
                        {evidenceKeys.length === 0 ? (
                          <div className="italic text-slate-400 dark:text-slate-500">
                            (empty)
                          </div>
                        ) : (
                          <div className="font-mono text-xs break-words">
                            {evidenceKeys.join(", ")}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                          Pathway notes keys ({pathwayKeys.length})
                        </div>
                        {pathwayKeys.length === 0 ? (
                          <div className="italic text-slate-400 dark:text-slate-500">
                            (empty)
                          </div>
                        ) : (
                          <div className="font-mono text-xs break-words">
                            {pathwayKeys.join(", ")}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PerPolicyResultsTable;
