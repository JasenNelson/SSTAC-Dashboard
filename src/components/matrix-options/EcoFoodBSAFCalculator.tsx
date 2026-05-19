'use client';

// Eco-Food (BSAF) sediment standard calculator.
// See .tmp_calculator_design_v1.md sections 2.2 + 5 + 8.2 + 8.4.
// v1 single-substance, single-receptor; MeHg uses the protein-normalized
// branch documented in design doc 2.2 / 8.3.
// Plain ASCII only.

import React, { useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { ecoFoodBSAF } from '@/lib/matrix-options/derivations';
import {
  SUBSTANCE_LIBRARY,
  findSubstance,
} from '@/lib/matrix-options/substanceLibrary';
import type {
  EcoFoodBSAFResult,
  Ecosystem,
} from '@/lib/matrix-options/types';
import { parseDecimalInput } from '@/lib/matrix-options/parseDecimal';

// Default substance: the first library entry that carries a positive
// freshwater BSAF (i.e., the Eco-Food path is meaningful). Falls back to
// the first entry overall if none qualify.
const BSAF_CAPABLE = SUBSTANCE_LIBRARY.filter(
  (s) => s.bsaf_loc_freshwater !== null && s.bsaf_loc_freshwater > 0,
);
const DEFAULT_SUBSTANCE_KEY =
  BSAF_CAPABLE[0]?.key ?? SUBSTANCE_LIBRARY[0].key;

const ECOSYSTEM_OPTIONS: ReadonlyArray<{ value: Ecosystem; label: string }> = [
  { value: 'freshwater', label: 'Freshwater' },
  { value: 'estuarine', label: 'Estuarine' },
  { value: 'coastal-marine', label: 'Coastal-Marine' },
];

export default function EcoFoodBSAFCalculator() {
  const [substanceKey, setSubstanceKey] = useState<string>(
    DEFAULT_SUBSTANCE_KEY,
  );
  const substance = findSubstance(substanceKey);

  // Ecosystem selector (default freshwater per design doc 2.2).
  const [ecosystem, setEcosystem] = useState<Ecosystem>('freshwater');

  // Receptor inputs: default to mink piscivore (design doc 2.2 inputs table).
  const [bwInput, setBwInput] = useState<string>('0.85');
  const [irInput, setIrInput] = useState<string>('0.18');

  // fLipid as percent (default 5%, screening window 1 - 15%).
  const [fLipidPercent, setFLipidPercent] = useState<number>(5);
  // foc as percent. Design doc section 2.2 sets default = 0.01 (1.0 %);
  // codex P2 2026-05-19 round 2 noted the previous 2 % initial state
  // displayed an Eco-Food SedS double the spec's worked-example default
  // until the user adjusted the slider. EqP validity window remains
  // 0.2 - 10 %.
  const [focPercent, setFocPercent] = useState<number>(1);
  // F_site (default 1.0 resident; 0.2 quick-set for anadromous salmon).
  const [fsiteInput, setFsiteInput] = useState<string>('1.0');

  // TRV is editable; seeded from the substance library row.
  const [trvInput, setTrvInput] = useState<string>(
    substance?.trv_eco_mg_per_kg_bw_day != null
      ? String(substance.trv_eco_mg_per_kg_bw_day)
      : '',
  );
  // BSAF_loc is editable; seeded from the substance library row.
  const [bsafInput, setBsafInput] = useState<string>(
    substance?.bsaf_loc_freshwater != null
      ? String(substance.bsaf_loc_freshwater)
      : '',
  );

  const handleSubstanceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setSubstanceKey(next);
    const nextSub = findSubstance(next);
    setTrvInput(
      nextSub?.trv_eco_mg_per_kg_bw_day != null
        ? String(nextSub.trv_eco_mg_per_kg_bw_day)
        : '',
    );
    setBsafInput(
      nextSub?.bsaf_loc_freshwater != null
        ? String(nextSub.bsaf_loc_freshwater)
        : '',
    );
  };

  const handleAnadromousQuickSet = () => {
    setFsiteInput('0.2');
  };
  const handleResidentQuickSet = () => {
    setFsiteInput('1.0');
  };

  const result: EcoFoodBSAFResult | { error: string } | null = useMemo(() => {
    if (!substance) {
      return { error: 'No substance selected.' };
    }
    if (substance.bsaf_loc_freshwater === null) {
      return {
        error:
          'Selected substance has no freshwater BSAF; the Eco-Food path ' +
          'is not applicable. Use a different substance or the AVS/SEM ' +
          'path (out of scope in v1).',
      };
    }

    const trvParse = parseDecimalInput(trvInput, { allowNegative: false });
    if (trvParse.state !== 'valid' || trvParse.value <= 0) {
      return {
        error:
          'TRV_eco must be a positive decimal number (mg/kg-bw/day).',
      };
    }
    const bwParse = parseDecimalInput(bwInput, { allowNegative: false });
    if (bwParse.state !== 'valid' || bwParse.value <= 0) {
      return { error: 'Body weight must be a positive decimal number (kg).' };
    }
    const irParse = parseDecimalInput(irInput, { allowNegative: false });
    if (irParse.state !== 'valid' || irParse.value <= 0) {
      return {
        error:
          'Ingestion rate must be a positive decimal number (kg-wet/day).',
      };
    }
    const bsafParse = parseDecimalInput(bsafInput, { allowNegative: false });
    if (bsafParse.state !== 'valid' || bsafParse.value <= 0) {
      return { error: 'BSAF_loc must be a positive decimal number.' };
    }
    const fsiteParse = parseDecimalInput(fsiteInput, { allowNegative: false });
    if (fsiteParse.state !== 'valid' || fsiteParse.value <= 0) {
      return { error: 'F_site must be a positive decimal number.' };
    }

    try {
      return ecoFoodBSAF({
        TRV_eco_mg_per_kg_bw_day: trvParse.value,
        BW_eco_kg: bwParse.value,
        IR_eco_kg_per_day: irParse.value,
        BSAF_loc_freshwater: bsafParse.value,
        fLipid: fLipidPercent / 100,
        foc: focPercent / 100,
        Fsite: fsiteParse.value,
        ecosystem,
        contaminantClass: substance.contaminantClass,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [
    substance,
    trvInput,
    bwInput,
    irInput,
    bsafInput,
    fLipidPercent,
    focPercent,
    fsiteInput,
    ecosystem,
  ]);

  const isResult = result !== null && !('error' in result);
  const ecoResult = isResult ? (result as EcoFoodBSAFResult) : null;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
      <header className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Eco-Food (BSAF) -- Wildlife / Fish Receptor
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Back-calculated sediment benchmark via the lipid+OC-normalized
          BSAF pathway (design doc section 2.2). MeHg uses the
          protein-normalized branch (design doc section 8.3); coastal-marine
          PAH bivalves apply the x15 multiplier (design doc section 8.2);
          anadromous salmonids default F_site = 0.2 (design doc section 8.4).
        </p>
      </header>

      <div className="mb-4">
        <MathRenderer
          content={
            'Formula: $SedS_{eco\\text{-}food} = \\dfrac{TRV_{eco} \\cdot ' +
            'BW_{eco}}{IR_{eco} \\cdot BSAF_{effective} \\cdot F_{site}}$, ' +
            'with $BSAF_{effective} = BSAF_{loc} \\cdot (f_{lipid} / f_{oc}) ' +
            '\\cdot M_{eco}$ (MeHg path skips lipid normalization).'
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="ecofood-substance"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Substance
            </label>
            <select
              id="ecofood-substance"
              value={substanceKey}
              onChange={handleSubstanceChange}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {SUBSTANCE_LIBRARY.filter(
                (s) =>
                  s.bsaf_loc_freshwater !== null && s.bsaf_loc_freshwater > 0,
              ).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.displayName}
                </option>
              ))}
            </select>
            {substance && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Class: {substance.contaminantClass}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Ecosystem
            </legend>
            <div
              className="flex gap-2 flex-wrap"
              role="radiogroup"
              aria-label="Ecosystem"
              data-testid="ecofood-ecosystem"
            >
              {ECOSYSTEM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={ecosystem === opt.value}
                  onClick={() => setEcosystem(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    ecosystem === opt.value
                      ? 'bg-sky-100 dark:bg-sky-900/40 border-sky-400 dark:border-sky-600 text-sky-800 dark:text-sky-200 font-semibold'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ecofood-bw"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                BW_eco (kg)
              </label>
              <input
                id="ecofood-bw"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={bwInput}
                onChange={(e) => setBwInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Default 0.85 (mink piscivore).
              </p>
            </div>
            <div>
              <label
                htmlFor="ecofood-ir"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                IR_eco (kg-wet/day)
              </label>
              <input
                id="ecofood-ir"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={irInput}
                onChange={(e) => setIrInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Default 0.18 (mink daily diet).
              </p>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                htmlFor="ecofood-flipid"
                className="text-sm font-bold text-slate-700 dark:text-slate-300"
              >
                Tissue lipid fraction (f<sub>lipid</sub>)
              </label>
              <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">
                {fLipidPercent.toFixed(2)} %
              </span>
            </div>
            <input
              id="ecofood-flipid"
              type="range"
              min="1"
              max="15"
              step="0.1"
              value={fLipidPercent}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) setFLipidPercent(v);
              }}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>1%</span>
              <span>Screening window: 1% -- 15%</span>
              <span>15%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                htmlFor="ecofood-foc"
                className="text-sm font-bold text-slate-700 dark:text-slate-300"
              >
                Sediment f<sub>oc</sub>
              </label>
              <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">
                {focPercent.toFixed(2)} %
              </span>
            </div>
            <input
              id="ecofood-foc"
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
              htmlFor="ecofood-fsite"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              F_site (site-use fraction)
            </label>
            <input
              id="ecofood-fsite"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={fsiteInput}
              onChange={(e) => setFsiteInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleResidentQuickSet}
                data-testid="ecofood-fsite-resident"
                className="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-400"
              >
                Resident (1.0)
              </button>
              <button
                type="button"
                onClick={handleAnadromousQuickSet}
                data-testid="ecofood-fsite-anadromous"
                className="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-400"
              >
                Anadromous salmon (0.2)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ecofood-trv"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                TRV_eco (mg/kg-bw/day)
              </label>
              <input
                id="ecofood-trv"
                type="number"
                inputMode="decimal"
                step="0.0001"
                value={trvInput}
                onChange={(e) => setTrvInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Seeded from substance library; HITL overrides.
              </p>
            </div>
            <div>
              <label
                htmlFor="ecofood-bsaf"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                BSAF_loc (freshwater)
              </label>
              <input
                id="ecofood-bsaf"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={bsafInput}
                onChange={(e) => setBsafInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                MeHg uses protein-normalized BSAF directly.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner">
            <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
              SedS (Eco-Food BSAF)
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
              {ecoResult && !ecoResult.blocked
                ? ecoResult.sedS.toPrecision(4)
                : '--'}{' '}
              <span className="text-lg text-slate-500 font-medium">
                mg/kg dry
              </span>
            </div>
            {ecoResult && ecoResult.blocked && (
              <div
                className="mt-3 inline-block px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200"
                data-testid="ecofood-blocked"
              >
                Diagnostic only (blocked by input validity)
              </div>
            )}
          </div>

          {ecoResult && (
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">M_eco</span>
                <span
                  className="text-slate-900 dark:text-white"
                  data-testid="ecofood-meco"
                >
                  {ecoResult.M_eco}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">BSAF_effective</span>
                <span
                  className="text-slate-900 dark:text-white"
                  data-testid="ecofood-bsaf-effective"
                >
                  {ecoResult.BSAF_effective.toPrecision(4)}
                </span>
              </div>
            </div>
          )}

          {result && 'error' in result && (
            <div
              className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200"
              data-testid="ecofood-error"
            >
              {result.error}
            </div>
          )}

          {ecoResult && ecoResult.warnings.length > 0 && (
            <div
              className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200 space-y-2"
              data-testid="ecofood-warnings"
            >
              <div className="font-semibold">Warnings</div>
              <ul className="list-disc pl-5 space-y-1">
                {ecoResult.warnings.map((w) => (
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
