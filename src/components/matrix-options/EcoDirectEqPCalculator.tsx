'use client';

// Eco-Direct (EqP) sediment standard calculator.
// See .tmp_calculator_design_v1.md sections 2.1 + 5.
// v1 single-substance, non-ionic organics path only. Mixture handling +
// divalent metals AVS/SEM path are out of scope per design doc section 9.
//
// PR-A2 commit 4 refactor (2026-05-19): substance + jurisdiction lifted to
// MatrixDashboard via SharedGlobalInputs; this calculator now accepts both
// as props. FCV reset contract per plan v3 section 4.6 + v6: a useEffect
// keyed on substanceKey re-seeds FCV from the library default unless the
// user has clicked the FCV field and marked it as an explicit override
// (fcvIsOverride === true). The Reset button clears the override flag,
// which lets the useEffect re-seed on the next render. A "User override"
// badge is visible whenever fcvIsOverride is true so the HITL can see
// they are no longer tracking the library default.
//
// jurisdiction now carries the selected regulatory frame. It controls
// source hierarchy and value lookup eligibility.
//
// Eco-wiring Step 4 (2026-06-17): the FCV seed is now FRAME-AWARE. computeFcvSeed prefers the eco
// References & Values catalog value for (substance, frame) -- a provisional, source-priority-selected
// needs_review candidate via resolveEcoSeed -- and falls back to the substance-library FCV. The
// header comment above describing a library-only re-seed is the pre-Step-4 contract.
//
// Plain ASCII only.

import React, { useEffect, useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { getEquation } from '@/lib/matrix-options/equationDispatch';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';
import { resolveEcoSeed } from '@/lib/matrix-options/ecoSeed';
import {
  getPathwayApplicability,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';
import type { EcoDirectEqPResult } from '@/lib/matrix-options/types';
import { parseDecimalInput } from '@/lib/matrix-options/parseDecimal';
import type {
  CalculatorUsedValue,
  EvidenceLibraryFilterRequest,
} from '@/lib/matrix-options/provenance/types';
import CalculatorProvenancePanel from './CalculatorProvenancePanel';
import FrameImpactCard from './FrameImpactCard';
import { DEFAULT_SUBSTANCE_KEY } from './SharedGlobalInputs';
import {
  DEFAULT_JURISDICTION,
  type Jurisdiction,
} from './guide/content/jurisdictions';

export interface EcoDirectEqPCalculatorProps {
  // Props are optional with the same defaults SharedGlobalInputs uses, so
  // this calculator stays build-green at the prior call site
  // (`<EcoDirectEqPCalculator />` in MatrixDashboard.tsx) between PR-A2
  // commit 4 (this refactor) and commit 6 (MatrixDashboard wire-up).
  // Once commit 6 lands, MatrixDashboard always passes explicit values
  // from its lifted state; the defaults below remain as a safety net for
  // any direct render in stories / debug pages.
  substanceKey?: string;
  jurisdiction?: Jurisdiction;
  className?: string;
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
}

interface FcvSeed {
  value: string;
  // The exact catalog row id when the seed came from the eco References & Values catalog (so
  // provenance attributes the precise source row); null when it fell back to the substance library.
  parameterValueId: string | null;
  // true while the catalog row is a build-first needs_review candidate (not yet HITL-verified).
  provisional: boolean;
}

// Resolve the FCV seed for (substance, frame): prefer the frame-aware, source-priority eco catalog
// value (resolveEcoSeed, which honors the provisional gate + jurisdiction + reference-only guards).
// When resolveEcoSeed returns null, fall back to the substance-library FCV ONLY if the pathway is
// applicable for the frame; in reference_only / unsupported frames the static fallback is SUPPRESSED
// (blank) so a library current-default value cannot leak into a frame meant to read reference-only.
// Pure; deterministic (static catalog + static frame table) so SSR == CSR.
function computeFcvSeed(
  substanceKey: string,
  frameId: RegulatoryFrameId,
): FcvSeed {
  const seed = resolveEcoSeed(
    substanceKey,
    'eco-direct-eqp',
    'fcv_ug_per_L',
    frameId,
  );
  if (seed) {
    return {
      value: String(seed.value),
      parameterValueId: seed.parameterValueId,
      provisional: seed.provisional,
    };
  }
  // Suppress the static library fallback when the frame marks eco-direct reference_only/unsupported:
  // no default should seed there (mirrors resolveEcoSeed's own reference_only/unsupported guard).
  const status = getPathwayApplicability(frameId, 'eco-direct-eqp').status;
  if (status === 'reference_only' || status === 'unsupported') {
    return { value: '', parameterValueId: null, provisional: false };
  }
  const lib = findSubstance(substanceKey);
  return {
    value: lib?.fcv_ug_per_L != null ? String(lib.fcv_ug_per_L) : '',
    parameterValueId: null,
    provisional: false,
  };
}

export default function EcoDirectEqPCalculator({
  substanceKey = DEFAULT_SUBSTANCE_KEY,
  jurisdiction = DEFAULT_JURISDICTION,
  className,
  onOpenEvidenceLibrary,
}: EcoDirectEqPCalculatorProps) {
  const substance = findSubstance(substanceKey);

  const ecoDirectFrameStatus = useMemo(
    () => getPathwayApplicability(jurisdiction, 'eco-direct-eqp').status,
    [jurisdiction],
  );
  const isReferenceOnlyFrame =
    ecoDirectFrameStatus === 'reference_only' || ecoDirectFrameStatus === 'unsupported';

  // foc as percent in the UI (0.2 -- 10.0), stored as fraction in derivation.
  // foc + Cs stay LOCAL to the calculator: they are per-pathway inputs that
  // do not generalize to other categories, so lifting them would couple
  // unrelated calculators. Only substance + jurisdiction are global.
  const [focPercent, setFocPercent] = useState<number>(2.0);
  const [csInput, setCsInput] = useState<string>('');

  // FCV reset contract (plan v3 section 4.6), now FRAME-AWARE. The seed prefers the eco References &
  // Values catalog value for (substance, frame) -- a provisional, source-priority-selected needs_review
  // candidate -- and falls back to the substance-library FCV (empty when neither exists; the downstream
  // "FCV must be a positive number" guard surfaces the gap to the HITL). In reference_only / unsupported
  // frames the static fallback is suppressed (blank) so a library current-default cannot leak.
  const fcvSeed = useMemo(
    () => computeFcvSeed(substanceKey, jurisdiction),
    [substanceKey, jurisdiction],
  );

  const [fcvInput, setFcvInput] = useState<string>(() => fcvSeed.value);
  const [fcvIsOverride, setFcvIsOverride] = useState<boolean>(false);

  // Re-seed FCV when the substance OR the regulatory frame changes, unless the user has marked FCV as
  // a manual override. fcvSeed is a fresh object only when (substance, frame) changes, so this fires
  // exactly on those transitions (and on the reset that clears fcvIsOverride).
  useEffect(() => {
    if (fcvIsOverride) return;
    setFcvInput(fcvSeed.value);
  }, [fcvSeed, fcvIsOverride]);

  const handleFcvInput = (next: string): void => {
    setFcvInput(next);
    // Any user edit promotes FCV to an explicit override so subsequent
    // substance changes do not silently clobber the HITL's value.
    setFcvIsOverride(true);
  };

  const handleResetFcv = (): void => {
    // Clearing the override flag triggers the useEffect on the next render
    // (because fcvIsOverride is a dep), which re-seeds FCV from the current
    // (substance, frame) seed (fcvSeed -- eco catalog value when available, else
    // the substance-library default). Single source of truth -- no need to set
    // FCV here too.
    setFcvIsOverride(false);
  };

  // Resolve the equation for the selected regulatory frame. With FRAME_VARIANTS
  // empty (Phase 4 commit 1) this always returns the BC Protocol 1 v5 DRA
  // baseline function and usedBaselineFallback: true; the call site is
  // unchanged. When a frame-specific variant ships, getEquation swaps run().
  const { run: ecoDirectEqP, usedBaselineFallback, fallbackReason } = useMemo(
    () => getEquation(jurisdiction, 'eco-direct-eqp'),
    [jurisdiction],
  );

  const result: EcoDirectEqPResult | { error: string } | null = useMemo(() => {
    if (!substance || substance.logKow === null) {
      return {
        error:
          'Selected substance has no log K_ow; the EqP path is not ' +
          'applicable. Use a different substance or the AVS/SEM path ' +
          '(out of scope in v1).',
      };
    }
    // FCV: enforce decimal whitelist + positive value. Cursor secondary
    // review surfaced this gap (Tier 0 samples got the regex in codex
    // round 1; FCV had only the bare `Number()` path).
    const fcvParse = parseDecimalInput(fcvInput, { allowNegative: false });
    if (fcvParse.state !== 'valid' || fcvParse.value <= 0) {
      return { error: 'FCV must be a positive decimal number (ug/L).' };
    }
    // Cs: same decimal whitelist + benchmark-only mode when blank.
    // Negative Cs is rejected here for the visible error; the derivation
    // function also self-guards via the blocked=true path (defense in depth).
    const csParse = parseDecimalInput(csInput, { allowNegative: false });
    if (csParse.state === 'invalid') {
      return { error: 'Cs must be a decimal number (e.g., 0.1) or blank.' };
    }
    if (csParse.state === 'negative') {
      return { error: 'Cs must be greater than or equal to zero.' };
    }
    const csForDerivation =
      csParse.state === 'blank' ? Number.NaN : csParse.value;
    try {
      return ecoDirectEqP({
        Cs_mg_per_kg: csForDerivation,
        foc: focPercent / 100,
        logKow: substance.logKow,
        fcv_ug_per_L: fcvParse.value,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [ecoDirectEqP, substance, focPercent, fcvInput, csInput]);

  const isResult = result !== null && !('error' in result);
  const provenanceValues: CalculatorUsedValue[] = useMemo(
    () => [
      {
        input_key: 'logKow',
        label: 'log K_ow',
        value: substance?.logKow ?? null,
        role: 'current calculator default',
        pathway: 'eco-direct-eqp',
        substance_key: substanceKey,
      },
      {
        input_key: 'fcv_ug_per_L',
        label: 'Final Chronic Value',
        value: fcvInput === '' ? null : fcvInput,
        unit: 'ug/L',
        role: fcvIsOverride
          ? 'user-entered value'
          : fcvSeed.parameterValueId
            ? 'source-backed default'
            : 'current calculator default',
        pathway: 'eco-direct-eqp',
        substance_key: substanceKey,
        // Attribute to the EXACT eco catalog row when the (non-override) seed came from the catalog,
        // so the provenance panel shows that source row + its needs_review status. When the seed fell
        // back to the substance library, no id is set and the resolver uses its value-aware tuple match.
        parameter_value_id:
          !fcvIsOverride && fcvSeed.parameterValueId
            ? fcvSeed.parameterValueId
            : undefined,
        note: fcvIsOverride
          ? 'User-edited FCV. Catalog source row remains visible for comparison.'
          : fcvSeed.provisional && fcvSeed.parameterValueId
            ? 'Provisional eco value -- needs_review catalog candidate, not yet HITL-verified.'
            : undefined,
      },
      {
        input_key: 'foc',
        label: 'Fraction organic carbon',
        value: focPercent.toFixed(2),
        unit: '%',
        role: 'user-entered value',
        note: 'Site-specific input. The current UI default is editable.',
      },
      {
        input_key: 'Cs_mg_per_kg',
        label: 'Measured sediment concentration',
        value: csInput === '' ? null : csInput,
        unit: 'mg/kg',
        role: 'user-entered value',
        note: 'Optional site measurement used for comparison only.',
      },
    ],
    [csInput, fcvInput, fcvIsOverride, focPercent, substance?.logKow, substanceKey, fcvSeed],
  );

  return (
    <section
      data-testid="eco-direct-eqp-calculator"
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm${className ? ` ${className}` : ''}`}
    >
      <header className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Eco-Direct (EqP) -- Non-Ionic Organics
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Equilibrium partitioning sediment benchmark via the Di Toro
          K_oc regression (design doc section 2.1). v1 covers single
          substances on the non-ionic organics path only; AVS/SEM
          divalent-metals path and PAH IWTU mixture summation are out
          of scope per design doc section 9.
        </p>
        {substance && (
          <p
            className="text-xs text-slate-500 dark:text-slate-400 mt-2"
            data-testid="eqp-substance-summary"
          >
            Active substance: <span className="font-semibold">{substance.displayName}</span>{' '}
            (class: {substance.contaminantClass}; log K_ow:{' '}
            {substance.logKow ?? 'n/a'}).
          </p>
        )}
      </header>

      <FrameImpactCard
        frameId={jurisdiction}
        pathway="eco-direct-eqp"
        usedBaselineFallback={usedBaselineFallback}
        fallbackReason={fallbackReason}
      />

      {/*
        Layout reorders per plan v3 section 1 (top-to-bottom flow):
          1. INPUTS (foc, FCV with override + Reset, Cs)
          2. ERROR box (if inputs invalid)
          3. PRELIMINARY TOXICITY-BASED STANDARD hero (the result)
          4. TECHNICAL DETAILS <details> disclosure (formula + intermediates +
             warnings); collapsed by default so the user sees the hero first.
        The "SedS (Eco-Direct EqP)" hero label is renamed to "Preliminary
        Toxicity-Based Standard" to match plan v3 section 1 + section 2
        wording. The legacy 2-col grid (inputs left / output right) is
        replaced with this vertical flow so users see the prominent
        result immediately after adjusting inputs.
      */}

      {/* 1. INPUTS */}
      <div
        className="space-y-4 mb-6"
        data-testid="eqp-inputs-section"
        aria-label="Eco-Direct EqP inputs"
      >
        <div>
          <div className="flex justify-between items-center mb-2">
            <label
              htmlFor="eqp-foc"
              className="text-sm font-bold text-slate-700 dark:text-slate-300"
            >
              Fraction Organic Carbon (f<sub>oc</sub>)
            </label>
            <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">
              {focPercent.toFixed(2)} %
            </span>
          </div>
          <input
            id="eqp-foc"
            type="range"
            min="0.1"
            max="15"
            step="0.1"
            value={focPercent}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) setFocPercent(v);
            }}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0.1%</span>
            <span>EqP window: 0.2% -- 10%</span>
            <span>15%</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="eqp-fcv"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Final Chronic Value FCV (ug/L) -- editable
            </label>
            {fcvIsOverride && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                data-testid="eqp-fcv-override-badge"
              >
                User override
              </span>
            )}
            {!fcvIsOverride && fcvSeed.provisional && fcvSeed.parameterValueId && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800"
                data-testid="eqp-fcv-provisional-badge"
                title="Seeded from a needs_review eco catalog candidate; not yet HITL-verified."
              >
                Provisional -- needs review
              </span>
            )}
          </div>
          <input
            id="eqp-fcv"
            type="number"
            inputMode="decimal"
            step="0.001"
            value={fcvInput}
            onChange={(e) => handleFcvInput(e.target.value)}
            data-testid="eqp-fcv-input"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Default seeded from the eco References &amp; Values catalog
              (provisional, frame-aware) or the substance library; HITL
              overrides per site review.
            </p>
            {fcvIsOverride && (
              <button
                type="button"
                onClick={handleResetFcv}
                data-testid="eqp-fcv-reset"
                className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-200 underline underline-offset-2"
              >
                Reset to default
              </button>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="eqp-cs"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Measured C<sub>s</sub> (mg/kg, optional)
          </label>
          <input
            id="eqp-cs"
            type="number"
            inputMode="decimal"
            step="0.001"
            value={csInput}
            onChange={(e) => setCsInput(e.target.value)}
            placeholder="Leave blank for benchmark-only mode"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supply C<sub>s</sub> to compare the measured sediment
            concentration against the benchmark; leave blank to view
            the benchmark only.
          </p>
        </div>
      </div>

      {/* 2. ERROR box (input validation failures only) */}
      {result && 'error' in result && (
        <div
          className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200 mb-6"
          data-testid="eqp-error"
        >
          {result.error}
        </div>
      )}

      {/* 3. PRELIMINARY TOXICITY-BASED STANDARD hero -- prominent result */}
      {isReferenceOnlyFrame && (
        <div
          data-testid="eqp-reference-only-notice"
          role="note"
          className="mb-6 border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 rounded-lg p-3 text-sm"
        >
          {fcvIsOverride
            ? "Diagnostic only: this result is computed from your manually entered FCV under a reference-only/unsupported regulatory frame. It is NOT a frame-supported standard."
            : "Reference-only under the selected regulatory frame: no frame-supported default is seeded for the EqP pathway. Any value shown is for reference/diagnostic use only."}
        </div>
      )}
      <div
        className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner mb-6"
        data-testid="eqp-preliminary-standard"
        aria-label="Preliminary Toxicity-Based Standard (Eco-Direct EqP)"
      >
        <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
          Preliminary Toxicity-Based Standard (Eco-Direct EqP)
        </div>
        <div
          className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter"
          data-testid="eqp-standard-value"
        >
          {/* Fail-closed: a blocked result computes sedS for diagnostics only and MUST NOT be
              quoted as a benchmark (see ecoDirectEqP derivation). Withhold the number (show '--')
              when blocked -- the verdict is already suppressed and the warnings box explains why.
              Matches the HHFoodWeb/EcoFoodBSAF blocked-render contract. */}
          {isResult && !(result as EcoDirectEqPResult).blocked
            ? (result as EcoDirectEqPResult).sedS.toPrecision(4)
            : '--'}{' '}
          <span className="text-lg text-slate-500 font-medium">
            mg/kg dry
          </span>
        </div>
        {isResult &&
          (result as EcoDirectEqPResult).verdict !== null && (
            <div
              className={`mt-3 inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                (result as EcoDirectEqPResult).verdict === 'PASS'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200'
              }`}
              data-testid="eqp-verdict"
            >
              {(result as EcoDirectEqPResult).verdict}
            </div>
          )}
        <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-3 italic">
          Preliminary -- not a final standard. HITL professional judgment +
          Background Adjustment apply downstream.
        </p>
      </div>

      {/* 4. TECHNICAL DETAILS disclosure (collapsed by default) */}
      <details
        className="group bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
        data-testid="eqp-technical-details"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 select-none flex items-center justify-between">
          <span>Technical details (formula + intermediate quantities)</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 group-open:hidden">
            show
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden group-open:inline">
            hide
          </span>
        </summary>
        <div className="px-4 py-4 space-y-4 border-t border-slate-200 dark:border-slate-800">
          <MathRenderer
            content={
              'Formulas: $\\log K_{oc} = 0.00028 + 0.983 \\cdot \\log K_{ow}$, ' +
              '$ESB_{oc} = FCV \\cdot K_{oc} \\cdot 10^{-3}$ (mg/kg-OC), ' +
              '$SedS_{eco\\text{-}direct} = ESB_{oc} \\cdot f_{oc}$ ' +
              '(mg/kg dry).'
            }
          />

          {isResult && (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">log K_oc</span>
                <span className="text-slate-900 dark:text-white">
                  {(result as EcoDirectEqPResult).logKoc.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">K_oc (L/kg-OC)</span>
                <span className="text-slate-900 dark:text-white">
                  {(result as EcoDirectEqPResult).Koc_L_per_kg_OC.toPrecision(4)}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">ESB_oc (mg/kg-OC)</span>
                <span className="text-slate-900 dark:text-white">
                  {(result as EcoDirectEqPResult).ESBoc_mg_per_kg_OC.toPrecision(4)}
                </span>
              </div>
            </div>
          )}

          {isResult && (result as EcoDirectEqPResult).warnings.length > 0 && (
            <div
              className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 space-y-2"
              data-testid="eqp-warnings"
            >
              <div className="font-semibold">Warnings</div>
              <ul className="list-disc pl-5 space-y-1">
                {(result as EcoDirectEqPResult).warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      <CalculatorProvenancePanel
        pathway="eco-direct-eqp"
        usedValues={provenanceValues}
        regulatoryFrameId={jurisdiction}
        onOpenEvidenceLibrary={onOpenEvidenceLibrary}
      />
    </section>
  );
}
