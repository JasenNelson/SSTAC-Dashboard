"use client";

// engine_v2 frontend Lane 1 / Module L1-4d: Step 5 - proposed applicable policies.
//
// The engine PROPOSES a scored + filtered policy list; the HITL curates which
// policies to include before project creation. No tier language; no adequacy
// language. The UI describes the engine's proposal, not its judgment.
//
// Rendering strategy for large payloads (~3500 signal_fired rows):
// - Policies are GROUPED into collapsed accordion sections by policy family
//   (first TWO dash-separated segments of policy_id). Only the expanded group
//   renders its rows, keeping the DOM small (no external virtualization library
//   needed). Live data shows ALL signal ids share the "CSAP" first segment, so
//   a single-segment key collapses everything into one ~3518-row group; the
//   two-segment key (e.g. "CSAP-RAPG", "CSAP-NPG") yields workable groups.
// - Any group larger than GROUP_SLICE_LIMIT renders its rows in incremental
//   "show N more" slices so even a large group never mounts all rows at once.
// - Floor tail is ONE collapsed section, default unchecked.
// - Each row: checkbox (default CHECKED for signal_fired) + policy_id + rationale.
// - Selection counter shown at the bottom. Zero selection triggers a warning.

import { useState, useMemo, useCallback } from "react";
import type { ProposerCliOutput } from "@/lib/engine-v2/propose_policies";

// CP-3: band preset shape. Mirrors Cp3BandPreset in WizardClient (kept local to
// avoid a circular import; the two must stay in sync).
export interface Cp3BandPreset {
  label: string;
  min: number;
}

// Groups larger than this render rows in incremental slices.
const GROUP_SLICE_LIMIT = 300;
// Rows revealed per "show more" click (and as the initial slice for big groups).
const GROUP_SLICE_STEP = 250;

// Extract the policy family key: the first TWO dash-separated segments.
// e.g. "CSAP-RAPG-ERA-COPC-21" -> "CSAP-RAPG"
// Falls back to the full id when there are fewer than two segments.
function policyFamily(policyId: string): string {
  const parts = policyId.split("-");
  if (parts.length >= 2) {
    return parts[0] + "-" + parts[1];
  }
  return policyId;
}

interface SignalGroup {
  family: string;
  entries: Array<{
    policy_id: string;
    score: number;
    rationale: string;
  }>;
}

function buildGroups(
  signal_fired: ProposerCliOutput["signal_fired"],
): SignalGroup[] {
  const order: string[] = [];
  const map: Record<string, SignalGroup> = {};
  for (const entry of signal_fired) {
    const fam = policyFamily(entry.policy_id);
    if (!map[fam]) {
      order.push(fam);
      map[fam] = { family: fam, entries: [] };
    }
    map[fam].entries.push(entry);
  }
  return order.map((f) => map[f]!);
}

// Default presets used when the parent does not supply bandPresets (e.g. tests
// that pre-date CP-3 and do not exercise the band control).
const DEFAULT_BAND_PRESETS: readonly Cp3BandPreset[] = [
  { label: "Strong (>=12)", min: 12 },
  { label: "Production (>=11)", min: 11 },
  { label: "Broad (>=9)", min: 9 },
  { label: "All signal-fired", min: 0 },
];

interface Props {
  proposal: ProposerCliOutput | null;
  loading: boolean;
  error: string | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onRetry: () => void;
  // CP-3 band preset control props. Optional: defaults to DEFAULT_BAND_PRESETS /
  // min=11 / no-op so callers that do not need the control can omit them.
  bandPresets?: readonly Cp3BandPreset[];
  activeBandMin?: number;
  onBandChange?: (min: number) => void;
}

export function ApplicablePolicyStep({
  proposal,
  loading,
  error,
  selectedIds,
  onChange,
  onRetry,
  bandPresets = DEFAULT_BAND_PRESETS,
  activeBandMin = 11,
  onBandChange = () => undefined,
}: Props) {
  // Track which accordion sections are open. Key: family name or "floor".
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Per-group count of currently revealed rows. Absent key = use the default
  // initial slice (GROUP_SLICE_STEP for big groups, full length for small ones).
  const [revealCounts, setRevealCounts] = useState<Record<string, number>>({});

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const revealMore = useCallback((key: string, total: number) => {
    setRevealCounts((prev) => {
      const current = prev[key] ?? GROUP_SLICE_STEP;
      return { ...prev, [key]: Math.min(current + GROUP_SLICE_STEP, total) };
    });
  }, []);

  const groups = useMemo(
    () => (proposal ? buildGroups(proposal.signal_fired) : []),
    [proposal],
  );

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleId = useCallback(
    (id: string) => {
      if (selectedSet.has(id)) {
        onChange(selectedIds.filter((x) => x !== id));
      } else {
        onChange([...selectedIds, id]);
      }
    },
    [selectedIds, selectedSet, onChange],
  );

  const checkAllGroup = useCallback(
    (group: SignalGroup) => {
      const ids = new Set(group.entries.map((e) => e.policy_id));
      const alreadySelected = selectedIds.filter((id) => ids.has(id));
      if (alreadySelected.length === ids.size) {
        // All checked -> uncheck all in group.
        onChange(selectedIds.filter((id) => !ids.has(id)));
      } else {
        // Not all checked -> check all in group.
        const next = new Set(selectedIds);
        for (const e of group.entries) next.add(e.policy_id);
        onChange(Array.from(next));
      }
    },
    [selectedIds, onChange],
  );

  const toggleFloorAll = useCallback(() => {
    if (!proposal) return;
    const floorSet = new Set(proposal.floor_tail_policy_ids);
    const currentlySelected = selectedIds.filter((id) => floorSet.has(id));
    if (currentlySelected.length === floorSet.size && floorSet.size > 0) {
      onChange(selectedIds.filter((id) => !floorSet.has(id)));
    } else {
      const next = new Set(selectedIds);
      for (const id of proposal.floor_tail_policy_ids) next.add(id);
      onChange(Array.from(next));
    }
  }, [proposal, selectedIds, onChange]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Proposed applicable policies
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Requesting policy proposal from engine...
          </p>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"
            aria-hidden="true"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Scoring policies against your application context...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Proposed applicable policies
          </h3>
        </div>
        <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-4 space-y-3">
          <p className="text-sm text-red-800 dark:text-red-100">
            Policy proposal failed: {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You may also skip this step by clicking Next -- the project will use
          the engine default policy set.
        </p>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Proposed applicable policies
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Waiting for proposal...
          </p>
        </div>
      </div>
    );
  }

  const { counts } = proposal;
  const totalSignal = proposal.signal_fired.length;
  const totalFloor = proposal.floor_tail_policy_ids.length;
  const totalProposed = totalSignal + totalFloor;

  const floorSelected = proposal.floor_tail_policy_ids.filter((id) =>
    selectedSet.has(id),
  );
  const floorAllChecked =
    totalFloor > 0 && floorSelected.length === totalFloor;
  const floorSomeChecked =
    floorSelected.length > 0 && floorSelected.length < totalFloor;

  const warnEmpty = selectedIds.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Proposed applicable policies
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          The engine scored {counts.total_scored} knowledge-base policies
          against your application context and proposed {counts.signal_fired_count} signal
          matches plus {counts.floor_tail_count} floor policies. Review the
          proposal below and include or exclude policies before creating the
          project.
        </p>
      </div>

      {/* CP-3 score-band preset control. Sets which signal-fired policies start
          checked. All signal-fired entries remain visible and tickable regardless
          of the active band (recall guarantee). */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          id="cp3-band-caption"
          className="text-sm font-medium text-slate-700 dark:text-slate-200 shrink-0"
        >
          Default-checked band:
        </span>
        <div
          role="group"
          aria-labelledby="cp3-band-caption"
          className="flex flex-wrap gap-1"
        >
          {bandPresets.map((preset) => {
            const isActive = preset.min === activeBandMin;
            return (
              <button
                key={preset.min}
                type="button"
                onClick={() => onBandChange(preset.min)}
                aria-pressed={isActive}
                className={
                  "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors " +
                  (isActive
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700")
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {warnEmpty ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-800 dark:text-amber-100">
          No policies selected. The project will use the engine default policy
          set at evaluation time.
        </div>
      ) : null}

      {/* Signal-fired groups */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
        {groups.map((group) => {
          const isOpen = Boolean(openSections[group.family]);
          const checkedCount = group.entries.filter((e) =>
            selectedSet.has(e.policy_id),
          ).length;
          const allChecked = checkedCount === group.entries.length;
          const someChecked = checkedCount > 0 && checkedCount < group.entries.length;
          // Slice large groups so we never mount thousands of rows at once.
          const total = group.entries.length;
          const sliced = total > GROUP_SLICE_LIMIT;
          const revealed = sliced
            ? Math.min(revealCounts[group.family] ?? GROUP_SLICE_STEP, total)
            : total;
          const visibleEntries = sliced
            ? group.entries.slice(0, revealed)
            : group.entries;
          const remaining = total - revealed;

          return (
            <section key={group.family}>
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(group.family)}
                  className="flex-1 flex items-center gap-2 text-left text-sm font-medium text-slate-800 dark:text-slate-100"
                >
                  <span
                    className={
                      "text-xs transition-transform " +
                      (isOpen ? "rotate-90" : "")
                    }
                    aria-hidden="true"
                  >
                    {">"}
                  </span>
                  <span>{group.family}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({group.entries.length} policies)
                  </span>
                </button>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={() => checkAllGroup(group)}
                    aria-label={`Select all ${group.family} policies`}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>{checkedCount} / {group.entries.length}</span>
                </label>
              </div>
              {isOpen ? (
                <>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {visibleEntries.map((entry) => {
                      const checked = selectedSet.has(entry.policy_id);
                      return (
                        <li key={entry.policy_id}>
                          <label className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleId(entry.policy_id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 shrink-0"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-slate-900 dark:text-white">
                                {entry.policy_id}
                              </span>
                              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {entry.rationale}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {sliced && remaining > 0 ? (
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40">
                      <button
                        type="button"
                        onClick={() => revealMore(group.family, total)}
                        className="text-sm font-medium text-sky-700 dark:text-sky-300 hover:underline"
                      >
                        Show {Math.min(GROUP_SLICE_STEP, remaining)} more (
                        {remaining} remaining)
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          );
        })}

        {/* Floor tail section */}
        {totalFloor > 0 ? (
          <section>
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
              <button
                type="button"
                aria-expanded={Boolean(openSections["floor"])}
                onClick={() => toggleSection("floor")}
                className="flex-1 flex items-center gap-2 text-left text-sm font-medium text-slate-800 dark:text-slate-100"
              >
                <span
                  className={
                    "text-xs transition-transform " +
                    (openSections["floor"] ? "rotate-90" : "")
                  }
                  aria-hidden="true"
                >
                  {">"}
                </span>
                <span>
                  {totalFloor} additional policies included by inclusive floor
                  -- expand to review
                </span>
              </button>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
                <input
                  type="checkbox"
                  checked={floorAllChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = floorSomeChecked;
                  }}
                  onChange={toggleFloorAll}
                  aria-label="Select all floor policies"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>
                  {floorSelected.length} / {totalFloor}
                </span>
              </label>
            </div>
            {openSections["floor"] ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {proposal.floor_tail_policy_ids.map((id) => {
                  const checked = selectedSet.has(id);
                  return (
                    <li key={id}>
                      <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleId(id)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 shrink-0"
                        />
                        <span className="text-sm text-slate-900 dark:text-white">
                          {id}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* Selection counter */}
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {selectedIds.length} of {totalProposed} proposed policies selected for
        inclusion.
      </p>
    </div>
  );
}
