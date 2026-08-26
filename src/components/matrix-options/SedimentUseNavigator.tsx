'use client';

// Sediment Use Navigator component for B.C. Protocol 1 frame.
// Plain ASCII only.

import React, { useRef } from 'react';

export interface SedimentUseScenario {
  readonly scenarioId: string;
  readonly scenarioLabel: string;
  readonly isDefault?: boolean;
}

export interface SedimentUseNavigatorProps {
  readonly selectedScenarioId?: string;
  readonly selectableScenarios: readonly SedimentUseScenario[];
  readonly onSelectScenario: (scenarioId: string) => void;
  readonly className?: string;
}

export default function SedimentUseNavigator({
  selectedScenarioId,
  selectableScenarios,
  onSelectScenario,
  className,
}: SedimentUseNavigatorProps) {
  const isTwnSelected = selectedScenarioId === 'twn-toddler-subsistence';
  const scenarioRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleScenarioKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentId: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectScenario(currentId);
      return;
    }
    const navKeys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!navKeys.includes(event.key)) return;
    event.preventDefault();

    const ids = selectableScenarios.map((s) => s.scenarioId);
    if (ids.length === 0) return;
    const currentIdx = ids.indexOf(currentId);
    const safeIdx = currentIdx === -1 ? 0 : currentIdx;
    let nextIdx = safeIdx;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIdx = (safeIdx + 1) % ids.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIdx = (safeIdx - 1 + ids.length) % ids.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = ids.length - 1;
    }

    const nextId = ids[nextIdx];
    onSelectScenario(nextId);
    scenarioRefs.current[nextId]?.focus();
  };

  return (
    <div
      data-testid="sediment-use-navigator"
      className={`mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40${className ? ` ${className}` : ''}`}
    >
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span>B.C. Sediment-Use Categories (Phase 2)</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
            Phase 2 Navigation
          </span>
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Phase 2 evaluates four sediment-use categories. Active approved scenarios for Aquatic Recreational / Traditional Harvest (AR/TH) are selectable below. Values for AW, CA, and IA are proposed/pending and do not change calculator inputs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Category 1: Aquatic Wildlands (AW) - Proposed / Pending */}
        <div
          data-testid="sediment-use-category-aw"
          className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 flex flex-col justify-between opacity-80"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                1. Aquatic Wildlands (AW)
              </span>
              <span
                data-testid="sediment-use-pending-badge-aw"
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
              >
                Proposed / Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              142 g/day direction under Phase 2 review.
            </p>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
            Proposed/pending: does not change calculator inputs.
          </p>
        </div>

        {/* Category 2: Aquatic Recreational / Traditional Harvest (AR/TH) - Active Approved */}
        <div
          data-testid="sediment-use-category-arth"
          className="p-3 rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50/40 dark:bg-sky-950/20 flex flex-col justify-between ring-1 ring-sky-300/50 dark:ring-sky-700/50"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                2. Aquatic Rec / Traditional Harvest (AR/TH)
              </span>
              <span
                data-testid="sediment-use-active-badge-arth"
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
              >
                Active Scenarios
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
              Approved B.C. exposure scenarios available for calculation:
            </p>
          </div>

          {selectableScenarios.length > 0 ? (
            <div
              className="space-y-2 mt-1"
              role="radiogroup"
              aria-label="Aquatic Recreational / Traditional Harvest scenarios"
            >
              {selectableScenarios.map((scenario, index) => {
                const isSelected = selectedScenarioId === scenario.scenarioId;
                const isAcfn = scenario.scenarioId === 'acfn-community-specific';
                const isToddler = scenario.scenarioId.includes('toddler');
                const isTabTarget =
                  isSelected || (!selectedScenarioId && index === 0);

                return (
                  <button
                    key={scenario.scenarioId}
                    ref={(el) => {
                      scenarioRefs.current[scenario.scenarioId] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isTabTarget ? 0 : -1}
                    data-testid={`sediment-use-scenario-btn-${scenario.scenarioId}`}
                    onClick={() => onSelectScenario(scenario.scenarioId)}
                    onKeyDown={(e) => handleScenarioKeyDown(e, scenario.scenarioId)}
                    className={`w-full min-h-[44px] text-left px-3 py-2 rounded-lg text-xs border transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-sky-600 text-white font-medium border-sky-700 shadow-sm ring-2 ring-sky-400 dark:ring-sky-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500'
                    }`}
                  >
                    <span className="leading-snug">{scenario.scenarioLabel}</span>
                    {isAcfn && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          isSelected
                            ? 'bg-sky-800 text-sky-100'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Community-specific
                      </span>
                    )}
                    {isToddler && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          isSelected
                            ? 'bg-sky-800 text-sky-100'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Toddler receptor
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No selectable scenarios available under current frame.
            </p>
          )}

          {isTwnSelected && (
            <div
              data-testid="sediment-use-twn-caveat"
              className="mt-3 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed"
            >
              <span className="font-bold">CAVEAT:</span> TWN tissue screening values are for ambient water quality objectives and must not be used to derive remediation or CSR guidelines; this calculator uses only the receptor consumption-rate exposure factor (0.094 kg/day).
            </div>
          )}
        </div>

        {/* Category 3: Commercial Aquatic (CA) - Proposed / Pending */}
        <div
          data-testid="sediment-use-category-ca"
          className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 flex flex-col justify-between opacity-80"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                3. Commercial Aquatic (CA)
              </span>
              <span
                data-testid="sediment-use-pending-badge-ca"
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
              >
                Proposed / Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              40 g/day direction under Phase 2 review.
            </p>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
            Proposed/pending: does not change calculator inputs.
          </p>
        </div>

        {/* Category 4: Industrial Marine / Aquatic (IA) - Proposed / Pending */}
        <div
          data-testid="sediment-use-category-ia"
          className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 flex flex-col justify-between opacity-80"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                4. Industrial Marine / Aquatic (IA)
              </span>
              <span
                data-testid="sediment-use-pending-badge-ia"
                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
              >
                Proposed / Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              40 g/day direction under Phase 2 review.
            </p>
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
            Proposed/pending: does not change calculator inputs.
          </p>
        </div>
      </div>
    </div>
  );
}
