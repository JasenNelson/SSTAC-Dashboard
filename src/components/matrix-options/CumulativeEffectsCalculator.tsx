'use client';

// Cumulative Effects calculator UI (Stage 2 Lane A2, base row #22).
//
// Surfaces the STANDALONE cumulative-effects reducers from lib/matrix-options/cumulative.ts
// (computeTEQ / computeBaPeq / computeBaPeqLifetime) as a UI card. Per decision D0 (declared at the
// top of cumulative.ts), those functions are NOT registered in equationDispatch.ts and do NOT extend
// the ProvenancePathway union -- this component imports and calls them DIRECTLY, exactly like the
// dlPcbTeqTdi precedent in HHDirectContactCalculator.tsx. Do NOT wire this pathway into
// equationDispatch.ts, ProvenancePathway, CalculatorProvenancePanel, or FrameImpactCard -- all of
// those require a registered ProvenancePathway id, which D0 explicitly forbids for this lane.
//
// Two independent sub-tools:
//   1. Carcinogenic PAHs (BaP-eq): computeBaPeq, optionally computeBaPeqLifetime when the
//      lifetime ADAF-weighting toggle is on.
//   2. Dioxins/Furans/DL-PCB (TEQ): computeTEQ.
// Both reducers are already fail-closed (they return `blocked: true` + `warnings` rather than
// throwing), but the compute calls here are still wrapped in try/catch as defense in depth -- this
// component must never crash on bad user input.
//
// Plain ASCII only.

import React, { useMemo, useRef, useState } from 'react';
import {
  computeBaPeq,
  computeBaPeqLifetime,
  computeTEQ,
  type AdafBin,
  type AgeBinFraction,
  type BaPeqEntry,
  type CumulativeResult,
  type TeqEntry,
} from '@/lib/matrix-options/cumulative';
import { RPF_TABLE, RPF_SCHEMES, type RpfScheme } from '@/lib/matrix-options/rpfTable';
import { TEF_TABLE, TEF_EDITIONS, type TefEdition } from '@/lib/matrix-options/tefTable';
import type { EvidenceLibraryFilterRequest } from '@/lib/matrix-options/provenance/types';
import type { Jurisdiction } from './guide/content/jurisdictions';

export interface CumulativeEffectsCalculatorProps {
  // Mirrors the sibling calculators' prop shape for call-site consistency. Cumulative effects works
  // over its own list of analyte entries (not a single substanceKey/jurisdiction), so these two are
  // accepted but currently unused by this component -- kept for a consistent MatrixDashboard call
  // site and in case a future frame-aware default seed is added.
  substanceKey?: string;
  jurisdiction?: Jurisdiction;
  className?: string;
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
}

const MASS_UNITS = [
  'mg/kg',
  'ug/kg',
  'ng/kg',
  'pg/kg',
  'mg/g',
  'ug/g',
  'ng/g',
  'pg/g',
] as const;

interface PahRow {
  id: string;
  pahKey: string;
  concentrationInput: string;
  unit: string;
}

interface CongenerRow {
  id: string;
  congenerId: string;
  concentrationInput: string;
  unit: string;
  isNonDetect: boolean;
  mdlInput: string;
}

// Small, deliberately verified-scheme-friendly default cohort (all 4 rows have a defined RPF under
// the default scheme ccme-2010, so the initial render shows a real computed equivalent rather than
// a "not scored" row).
const DEFAULT_PAH_ROWS: PahRow[] = [
  { id: 'pah-1', pahKey: 'benzo_a_pyrene', concentrationInput: '0.5', unit: 'mg/kg' },
  { id: 'pah-2', pahKey: 'chrysene', concentrationInput: '0.3', unit: 'mg/kg' },
  { id: 'pah-3', pahKey: 'benz_a_anthracene', concentrationInput: '0.2', unit: 'mg/kg' },
  { id: 'pah-4', pahKey: 'dibenz_ah_anthracene', concentrationInput: '0.05', unit: 'mg/kg' },
];

// Default congener cohort, all defined under the default (verified) edition who-2022-devito-2024.
const DEFAULT_CONGENER_ROWS: CongenerRow[] = [
  {
    id: 'cong-1',
    congenerId: '2378-tcdd',
    concentrationInput: '0.5',
    unit: 'ng/kg',
    isNonDetect: false,
    mdlInput: '',
  },
  {
    id: 'cong-2',
    congenerId: 'pcb-126',
    concentrationInput: '2.0',
    unit: 'ng/kg',
    isNonDetect: false,
    mdlInput: '',
  },
  {
    id: 'cong-3',
    congenerId: 'pcb-118',
    concentrationInput: '15',
    unit: 'ng/kg',
    isNonDetect: false,
    mdlInput: '',
  },
];

// Standard 70-year lifetime averaging period exposure-duration weighting (2/70, 14/70, 54/70),
// expressed as decimals that sum to exactly 1.0000 -- a common EPA-style default lifetime split.
const DEFAULT_AGE_BIN_FRACTIONS: Record<AdafBin, string> = {
  '0-<2': '0.0286',
  '2-<16': '0.2000',
  '16+': '0.7714',
};

function updateRowById<T extends { id: string }>(
  setRows: React.Dispatch<React.SetStateAction<T[]>>,
  id: string,
  patch: Partial<T>,
): void {
  setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

function toBaPeqEntries(rows: readonly PahRow[]): BaPeqEntry[] {
  return rows.map((r) => ({
    pahKey: r.pahKey,
    concentration:
      r.concentrationInput.trim() === '' ? Number.NaN : Number(r.concentrationInput),
    unit: r.unit,
  }));
}

function toTeqEntries(rows: readonly CongenerRow[]): TeqEntry[] {
  return rows.map((r) => ({
    congenerId: r.congenerId,
    concentration:
      r.concentrationInput.trim() === '' ? Number.NaN : Number(r.concentrationInput),
    unit: r.unit,
    isNonDetect: r.isNonDetect,
    mdl: r.isNonDetect
      ? r.mdlInput.trim() === ''
        ? undefined
        : Number(r.mdlInput)
      : undefined,
    // The MDL input shares the row and has no separate unit selector, so it is interpreted in the
    // row's VISIBLE concentration unit (r.unit) -- NOT a fixed 'ng/kg' -- otherwise an MDL typed for a
    // row shown in e.g. ug/kg would be silently understated 1000x by computeTEQ's normalization.
    mdlUnit: r.isNonDetect ? r.unit : undefined,
  }));
}

type ComputeOutcome = CumulativeResult | { error: string };

function isComputeError(r: ComputeOutcome): r is { error: string } {
  return 'error' in r;
}

// Shared result renderer for both sub-tools. Fail-closed display contract: when the result is
// blocked, the warnings/block reason are shown and NO computed total is rendered as if it were
// valid -- the equivalent number is withheld entirely (not shown as "0" or as a real value).
function CumulativeResultView({
  result,
  testIdPrefix,
}: {
  result: ComputeOutcome;
  testIdPrefix: string;
}) {
  if (isComputeError(result)) {
    return (
      <div
        className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200"
        data-testid={`${testIdPrefix}-error`}
        role="alert"
      >
        {result.error}
      </div>
    );
  }

  return (
    <div data-testid={`${testIdPrefix}-result`}>
      {result.blocked ? (
        <div
          className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200 mb-4"
          data-testid={`${testIdPrefix}-blocked`}
          role="alert"
        >
          <div className="font-bold uppercase tracking-wide text-xs mb-2">
            Blocked -- result withheld (fail-closed)
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-4 text-center border border-sky-100 dark:border-sky-800 shadow-inner mb-4"
          data-testid={`${testIdPrefix}-equivalent`}
        >
          <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
            Equivalent concentration
          </div>
          <div
            className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tighter"
            data-testid={`${testIdPrefix}-value`}
          >
            {result.equivalent.toPrecision(4)}{' '}
            <span className="text-base text-slate-500 font-medium">
              {result.equivalentUnit}
            </span>
          </div>
        </div>
      )}

      {!result.blocked && result.warnings.length > 0 && (
        <div
          className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1 mb-4"
          data-testid={`${testIdPrefix}-warnings`}
        >
          <div className="font-semibold">Warnings</div>
          <ul className="list-disc pl-5 space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {result.contributions.length > 0 && (
        <div className="overflow-x-auto" data-testid={`${testIdPrefix}-contributions`}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-1 pr-2">Component</th>
                <th className="py-1 pr-2">Factor</th>
                <th className="py-1 pr-2">Conc. (mg/kg)</th>
                <th className="py-1 pr-2">Contribution (mg/kg)</th>
              </tr>
            </thead>
            <tbody>
              {result.contributions.map((c, i) => (
                <tr
                  key={`${c.componentId}-${i}`}
                  className="border-b border-slate-100 dark:border-slate-800"
                >
                  <td className="py-1 pr-2 font-mono">{c.componentId}</td>
                  <td className="py-1 pr-2 font-mono">
                    {c.factor === null ? 'n/a' : c.factor}
                  </td>
                  <td className="py-1 pr-2 font-mono">
                    {c.concentrationNorm === null ? 'n/a' : c.concentrationNorm.toPrecision(3)}
                  </td>
                  <td className="py-1 pr-2 font-mono">
                    {c.contribution === null ? 'not scored' : c.contribution.toPrecision(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CumulativeEffectsCalculator({
  className,
}: CumulativeEffectsCalculatorProps) {
  // --- Section 1: Carcinogenic PAHs (BaP-eq) ---
  const [pahRows, setPahRows] = useState<PahRow[]>(DEFAULT_PAH_ROWS);
  const [rpfScheme, setRpfScheme] = useState<RpfScheme>('ccme-2010');
  const [lifetimeAdaf, setLifetimeAdaf] = useState<boolean>(false);
  const [ageBinFractions, setAgeBinFractions] = useState<Record<AdafBin, string>>(
    DEFAULT_AGE_BIN_FRACTIONS,
  );
  const nextPahIdRef = useRef<number>(DEFAULT_PAH_ROWS.length + 1);

  const addPahRow = (): void => {
    const id = `pah-${nextPahIdRef.current++}`;
    setPahRows((prev) => [
      ...prev,
      { id, pahKey: RPF_TABLE[0].pahKey, concentrationInput: '', unit: 'mg/kg' },
    ]);
  };
  const removePahRow = (id: string): void => {
    setPahRows((prev) => prev.filter((r) => r.id !== id));
  };

  const ageBins: AgeBinFraction[] = useMemo(
    () =>
      (Object.keys(ageBinFractions) as AdafBin[]).map((bin) => ({
        ageBin: bin,
        exposureFraction:
          ageBinFractions[bin].trim() === '' ? Number.NaN : Number(ageBinFractions[bin]),
      })),
    [ageBinFractions],
  );

  const bapeqResult: ComputeOutcome = useMemo(() => {
    try {
      const entries = toBaPeqEntries(pahRows);
      if (lifetimeAdaf) {
        return computeBaPeqLifetime(entries, rpfScheme, ageBins);
      }
      return computeBaPeq(entries, rpfScheme, {});
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [pahRows, rpfScheme, lifetimeAdaf, ageBins]);

  // --- Section 2: Dioxins/Furans/DL-PCB (TEQ) ---
  const [congenerRows, setCongenerRows] = useState<CongenerRow[]>(DEFAULT_CONGENER_ROWS);
  const [tefEdition, setTefEdition] = useState<TefEdition>('who-2022-devito-2024');
  const [nonDetectFractionInput, setNonDetectFractionInput] = useState<string>('0.5');
  const nextCongenerIdRef = useRef<number>(DEFAULT_CONGENER_ROWS.length + 1);

  const addCongenerRow = (): void => {
    const id = `cong-${nextCongenerIdRef.current++}`;
    setCongenerRows((prev) => [
      ...prev,
      {
        id,
        congenerId: TEF_TABLE[0].congenerId,
        concentrationInput: '',
        unit: 'ng/kg',
        isNonDetect: false,
        mdlInput: '',
      },
    ]);
  };
  const removeCongenerRow = (id: string): void => {
    setCongenerRows((prev) => prev.filter((r) => r.id !== id));
  };

  const teqResult: ComputeOutcome = useMemo(() => {
    try {
      const entries = toTeqEntries(congenerRows);
      // Validate the non-detect substitution fraction at the boundary: computeTEQ does NOT range-check
      // it, so an out-of-range value (e.g. 2) would silently produce an unblocked, valid-looking TEQ
      // (2 x MDL). Fail closed unless it is finite and within [0, 1].
      const rawFraction = nonDetectFractionInput.trim();
      let nonDetectFraction: number | undefined;
      if (rawFraction !== '') {
        const parsed = Number(rawFraction);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
          return {
            error: `Non-detect fraction "${rawFraction}" is invalid (must be a number between 0 and 1); TEQ withheld (fail-closed).`,
          };
        }
        nonDetectFraction = parsed;
      }
      return computeTEQ(entries, tefEdition, { nonDetectFraction });
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [congenerRows, tefEdition, nonDetectFractionInput]);

  return (
    <section
      data-testid="cumulative-effects-calculator"
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm${className ? ` ${className}` : ''}`}
    >
      <header className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Cumulative Effects
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Additive toxicity screening for carcinogenic PAH mixtures (BaP-eq, RPF-weighted) and
          dioxin-like congener mixtures (TEQ, TEF-weighted). Standalone screening tool -- not wired
          into the regulatory-frame equation dispatch (see the D0 note in cumulative.ts).
        </p>
      </header>

      {/* Section 1: Carcinogenic PAHs (BaP-eq) */}
      <div className="mb-8" data-testid="cum-bapeq-section">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
          Carcinogenic PAHs (BaP-eq)
        </h4>

        <div className="space-y-2 mb-3" data-testid="cum-bapeq-rows">
          {pahRows.map((row, idx) => (
            <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
              <select
                className="col-span-5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                value={row.pahKey}
                aria-label={`PAH ${idx + 1}`}
                onChange={(e) => updateRowById(setPahRows, row.id, { pahKey: e.target.value })}
              >
                {RPF_TABLE.map((r) => (
                  <option key={r.pahKey} value={r.pahKey}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                className="col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono"
                value={row.concentrationInput}
                aria-label={`PAH ${idx + 1} concentration`}
                data-testid={`cum-bapeq-conc-${idx}`}
                onChange={(e) =>
                  updateRowById(setPahRows, row.id, { concentrationInput: e.target.value })
                }
              />
              <select
                className="col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                value={row.unit}
                aria-label={`PAH ${idx + 1} unit`}
                onChange={(e) => updateRowById(setPahRows, row.id, { unit: e.target.value })}
              >
                {MASS_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="col-span-1 text-slate-400 hover:text-rose-600 text-xs font-bold"
                aria-label={`Remove PAH row ${idx + 1}`}
                onClick={() => removePahRow(row.id)}
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-200"
            data-testid="cum-bapeq-add-row"
            onClick={addPahRow}
          >
            + Add PAH
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-3">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            RPF scheme
            <select
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
              value={rpfScheme}
              data-testid="cum-bapeq-scheme"
              onChange={(e) => setRpfScheme(e.target.value as RpfScheme)}
            >
              {RPF_SCHEMES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <input
              type="checkbox"
              checked={lifetimeAdaf}
              data-testid="cum-bapeq-lifetime-toggle"
              onChange={(e) => setLifetimeAdaf(e.target.checked)}
            />
            Lifetime ADAF weighting
          </label>
        </div>

        {lifetimeAdaf && (
          <div
            className="grid grid-cols-3 gap-2 mb-3"
            data-testid="cum-bapeq-agebins"
          >
            {(Object.keys(ageBinFractions) as AdafBin[]).map((bin) => (
              <label
                key={bin}
                className="text-xs font-medium text-slate-700 dark:text-slate-300 flex flex-col gap-1"
              >
                {bin} yr fraction
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono"
                  value={ageBinFractions[bin]}
                  data-testid={`cum-bapeq-agebin-${bin}`}
                  onChange={(e) =>
                    setAgeBinFractions((prev) => ({ ...prev, [bin]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        )}

        <CumulativeResultView result={bapeqResult} testIdPrefix="cum-bapeq" />
      </div>

      {/* Section 2: Dioxins/Furans/DL-PCB (TEQ) */}
      <div data-testid="cum-teq-section">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
          Dioxins/Furans/DL-PCB (TEQ)
        </h4>

        <div className="space-y-2 mb-3" data-testid="cum-teq-rows">
          {congenerRows.map((row, idx) => (
            <div key={row.id} className="space-y-1">
              <div className="grid grid-cols-12 gap-2 items-center">
                <select
                  className="col-span-5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                  value={row.congenerId}
                  aria-label={`Congener ${idx + 1}`}
                  onChange={(e) =>
                    updateRowById(setCongenerRows, row.id, { congenerId: e.target.value })
                  }
                >
                  {TEF_TABLE.map((r) => (
                    <option key={r.congenerId} value={r.congenerId}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  className="col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono"
                  value={row.concentrationInput}
                  aria-label={`Congener ${idx + 1} concentration`}
                  data-testid={`cum-teq-conc-${idx}`}
                  onChange={(e) =>
                    updateRowById(setCongenerRows, row.id, {
                      concentrationInput: e.target.value,
                    })
                  }
                />
                <select
                  className="col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                  value={row.unit}
                  aria-label={`Congener ${idx + 1} unit`}
                  onChange={(e) =>
                    updateRowById(setCongenerRows, row.id, { unit: e.target.value })
                  }
                >
                  {MASS_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="col-span-1 text-slate-400 hover:text-rose-600 text-xs font-bold"
                  aria-label={`Remove congener row ${idx + 1}`}
                  onClick={() => removeCongenerRow(row.id)}
                >
                  x
                </button>
              </div>
              <div className="pl-1">
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.isNonDetect}
                    aria-label={`Congener ${idx + 1} non-detect`}
                    onChange={(e) =>
                      updateRowById(setCongenerRows, row.id, { isNonDetect: e.target.checked })
                    }
                  />
                  Non-detect
                </label>
                {row.isNonDetect && (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    placeholder="MDL"
                    className="mt-1 w-32 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs font-mono"
                    value={row.mdlInput}
                    aria-label={`Congener ${idx + 1} MDL`}
                    onChange={(e) =>
                      updateRowById(setCongenerRows, row.id, { mdlInput: e.target.value })
                    }
                  />
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-200"
            data-testid="cum-teq-add-row"
            onClick={addCongenerRow}
          >
            + Add congener
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-3">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            TEF edition
            <select
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
              value={tefEdition}
              data-testid="cum-teq-edition"
              onChange={(e) => setTefEdition(e.target.value as TefEdition)}
            >
              {TEF_EDITIONS.map((ed) => (
                <option key={ed} value={ed}>
                  {ed}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            Non-detect fraction (x MDL)
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="1"
              className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-mono"
              value={nonDetectFractionInput}
              data-testid="cum-teq-nd-fraction"
              onChange={(e) => setNonDetectFractionInput(e.target.value)}
            />
          </label>
        </div>

        <CumulativeResultView result={teqResult} testIdPrefix="cum-teq" />
      </div>
    </section>
  );
}
