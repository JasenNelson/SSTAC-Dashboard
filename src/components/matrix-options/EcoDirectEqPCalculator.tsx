'use client';

// Eco-Direct (EqP) sediment standard calculator.
// See .tmp_calculator_design_v1.md sections 2.1 + 5.
// v1 single-substance, non-ionic organics path only. Mixture handling +
// divalent metals AVS/SEM path are out of scope per design doc section 9.
// Plain ASCII only.

import React, { useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { ecoDirectEqP } from '@/lib/matrix-options/derivations';
import {
  SUBSTANCE_LIBRARY,
  findSubstance,
} from '@/lib/matrix-options/substanceLibrary';
import type { EcoDirectEqPResult } from '@/lib/matrix-options/types';
import { parseDecimalInput } from '@/lib/matrix-options/parseDecimal';

// Default substance: the first library entry that has both logKow and FCV
// populated (i.e., the EqP path is meaningful). Falls back to the first
// entry overall if none qualify.
const EQP_CAPABLE = SUBSTANCE_LIBRARY.filter(
  (s) => s.logKow !== null && s.fcv_ug_per_L !== null,
);
const DEFAULT_SUBSTANCE_KEY =
  EQP_CAPABLE[0]?.key ?? SUBSTANCE_LIBRARY[0].key;

export default function EcoDirectEqPCalculator() {
  const [substanceKey, setSubstanceKey] = useState<string>(
    DEFAULT_SUBSTANCE_KEY,
  );
  const substance = findSubstance(substanceKey);

  // foc as percent in the UI (0.2 -- 10.0), stored as fraction in derivation.
  const [focPercent, setFocPercent] = useState<number>(2.0);
  // FCV is editable; default seeded from the substance library row.
  const [fcvInput, setFcvInput] = useState<string>(
    substance?.fcv_ug_per_L != null ? String(substance.fcv_ug_per_L) : '0.014',
  );
  const [csInput, setCsInput] = useState<string>('');

  const handleSubstanceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setSubstanceKey(next);
    const nextSub = findSubstance(next);
    if (nextSub?.fcv_ug_per_L != null) {
      setFcvInput(String(nextSub.fcv_ug_per_L));
    } else {
      // No library FCV default for the new substance; clear stale FCV from
      // the prior substance so we don't silently derive against the wrong
      // water-only chronic value. Downstream guard at line 60 then surfaces
      // the "FCV must be a positive number" error until the user enters one.
      // Opus adversarial review P2 2026-05-18: defensive guard for future
      // substance-library additions where logKow exists but FCV does not.
      setFcvInput('');
    }
  };

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
  }, [substance, focPercent, fcvInput, csInput]);

  const isResult = result !== null && !('error' in result);

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
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
      </header>

      <div className="mb-4">
        <MathRenderer
          content={
            'Formulas: $\\log K_{oc} = 0.00028 + 0.983 \\cdot \\log K_{ow}$, ' +
            '$ESB_{oc} = FCV \\cdot K_{oc} \\cdot 10^{-3}$ (mg/kg-OC), ' +
            '$SedS_{eco\\text{-}direct} = ESB_{oc} \\cdot f_{oc}$ ' +
            '(mg/kg dry).'
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="eqp-substance"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Substance
            </label>
            <select
              id="eqp-substance"
              value={substanceKey}
              onChange={handleSubstanceChange}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {SUBSTANCE_LIBRARY.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.displayName}
                  {s.logKow === null ? ' (no log K_ow; not EqP-applicable)' : ''}
                </option>
              ))}
            </select>
            {substance && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Class: {substance.contaminantClass}; log K_ow:{' '}
                {substance.logKow ?? 'n/a'}
              </p>
            )}
          </div>

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
            <label
              htmlFor="eqp-fcv"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Final Chronic Value FCV (ug/L) -- editable
            </label>
            <input
              id="eqp-fcv"
              type="number"
              inputMode="decimal"
              step="0.001"
              value={fcvInput}
              onChange={(e) => setFcvInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Default seeded from substance library; HITL overrides per
              site review.
            </p>
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
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner">
            <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
              SedS (Eco-Direct EqP)
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
              {isResult ? (result as EcoDirectEqPResult).sedS.toPrecision(4) : '--'}{' '}
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
          </div>

          {isResult && (
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">log K_oc</span>
                <span className="text-slate-900 dark:text-white">
                  {(result as EcoDirectEqPResult).logKoc.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">K_oc (L/kg-OC)</span>
                <span className="text-slate-900 dark:text-white">
                  {(result as EcoDirectEqPResult).Koc_L_per_kg_OC.toPrecision(
                    4,
                  )}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">ESB_oc (mg/kg-OC)</span>
                <span className="text-slate-900 dark:text-white">
                  {(result as EcoDirectEqPResult).ESBoc_mg_per_kg_OC.toPrecision(
                    4,
                  )}
                </span>
              </div>
            </div>
          )}

          {result && 'error' in result && (
            <div
              className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200"
              data-testid="eqp-error"
            >
              {result.error}
            </div>
          )}

          {isResult && (result as EcoDirectEqPResult).warnings.length > 0 && (
            <div
              className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200 space-y-2"
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
      </div>
    </section>
  );
}
