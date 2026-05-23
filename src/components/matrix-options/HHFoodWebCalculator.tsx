'use client';

// Human Health Food Web screening calculator.
// Plain ASCII only.

import React, { useEffect, useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { humanHealthFoodWeb } from '@/lib/matrix-options/derivations';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';
import type {
  Ecosystem,
  HumanHealthFoodWebResult,
} from '@/lib/matrix-options/types';
import type {
  CalculatorUsedValue,
  EvidenceLibraryFilterRequest,
} from '@/lib/matrix-options/provenance/types';
import { parseDecimalInput } from '@/lib/matrix-options/parseDecimal';
import { DEFAULT_SUBSTANCE_KEY } from './SharedGlobalInputs';
import {
  DEFAULT_JURISDICTION,
  type Jurisdiction,
} from './guide/content/jurisdictions';
import CalculatorProvenancePanel from './CalculatorProvenancePanel';

const ECOSYSTEM_OPTIONS: ReadonlyArray<{ value: Ecosystem; label: string }> = [
  { value: 'freshwater', label: 'Freshwater' },
  { value: 'estuarine', label: 'Estuarine' },
  { value: 'coastal-marine', label: 'Coastal-Marine' },
];

export interface HHFoodWebCalculatorProps {
  substanceKey?: string;
  jurisdiction?: Jurisdiction;
  className?: string;
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
}

function positiveInput(value: string, label: string): number | { error: string } {
  const parsed = parseDecimalInput(value, { allowNegative: false });
  if (parsed.state !== 'valid' || parsed.value <= 0) {
    return { error: `${label} must be a positive decimal number.` };
  }
  return parsed.value;
}

function optionalPositiveInput(value: string, label: string): number | null | { error: string } {
  const parsed = parseDecimalInput(value, { allowNegative: false });
  if (parsed.state === 'blank') return null;
  if (parsed.state !== 'valid' || parsed.value <= 0) {
    return { error: `${label} must be blank or a positive decimal number.` };
  }
  return parsed.value;
}

export default function HHFoodWebCalculator({
  substanceKey = DEFAULT_SUBSTANCE_KEY,
  jurisdiction: _jurisdiction = DEFAULT_JURISDICTION,
  className,
  onOpenEvidenceLibrary,
}: HHFoodWebCalculatorProps) {
  const substance = findSubstance(substanceKey);
  const [ecosystem, setEcosystem] = useState<Ecosystem>('freshwater');
  const [bwInput, setBwInput] = useState('70');
  const [foodIrInput, setFoodIrInput] = useState('0.142');
  const [fLipidPercent, setFLipidPercent] = useState(5);
  const [focPercent, setFocPercent] = useState(2);
  const [targetRiskInput, setTargetRiskInput] = useState('0.00001');
  const [hazardQuotientInput, setHazardQuotientInput] = useState('1');
  const [rfdInput, setRfdInput] = useState(
    substance?.rfd_oral_mg_per_kg_bw_per_day != null
      ? String(substance.rfd_oral_mg_per_kg_bw_per_day)
      : '',
  );
  const [slopeInput, setSlopeInput] = useState(
    substance?.sf_oral_per_mg_per_kg_bw_per_day != null
      ? String(substance.sf_oral_per_mg_per_kg_bw_per_day)
      : '',
  );
  const [bsafInput, setBsafInput] = useState(
    substance?.bsaf_loc_freshwater != null
      ? String(substance.bsaf_loc_freshwater)
      : '',
  );
  const [baOralInput, setBaOralInput] = useState(
    substance ? String(substance.ba_oral) : '1',
  );

  useEffect(() => {
    const next = findSubstance(substanceKey);
    setRfdInput(
      next?.rfd_oral_mg_per_kg_bw_per_day != null
        ? String(next.rfd_oral_mg_per_kg_bw_per_day)
        : '',
    );
    setSlopeInput(
      next?.sf_oral_per_mg_per_kg_bw_per_day != null
        ? String(next.sf_oral_per_mg_per_kg_bw_per_day)
        : '',
    );
    setBsafInput(
      next?.bsaf_loc_freshwater != null
        ? String(next.bsaf_loc_freshwater)
        : '',
    );
    setBaOralInput(next ? String(next.ba_oral) : '1');
  }, [substanceKey]);

  const result: HumanHealthFoodWebResult | { error: string } = useMemo(() => {
    if (!substance) return { error: 'No substance selected.' };

    const fields = {
      BW_kg: positiveInput(bwInput, 'Body weight'),
      IR_food_kg_per_day: positiveInput(foodIrInput, 'Food ingestion rate'),
      targetRisk: positiveInput(targetRiskInput, 'Target risk'),
      hazardQuotient: positiveInput(hazardQuotientInput, 'Hazard quotient'),
      rfd_oral_mg_per_kg_bw_day: optionalPositiveInput(rfdInput, 'RfD'),
      sf_oral_per_mg_per_kg_bw_per_day: optionalPositiveInput(slopeInput, 'Oral slope factor'),
      BSAF_loc_freshwater: positiveInput(bsafInput, 'BSAF_loc'),
      ba_oral: positiveInput(baOralInput, 'Oral bioavailability'),
    };

    for (const value of Object.values(fields)) {
      if (typeof value === 'object' && value !== null && 'error' in value) {
        return value;
      }
    }

    try {
      return humanHealthFoodWeb({
        ...fields,
        fLipid: fLipidPercent / 100,
        foc: focPercent / 100,
        ecosystem,
        contaminantClass: substance.contaminantClass,
      } as {
        rfd_oral_mg_per_kg_bw_day: number | null;
        sf_oral_per_mg_per_kg_bw_per_day: number | null;
        targetRisk: number;
        hazardQuotient: number;
        BW_kg: number;
        IR_food_kg_per_day: number;
        ba_oral: number;
        BSAF_loc_freshwater: number;
        fLipid: number;
        foc: number;
        ecosystem: Ecosystem;
        contaminantClass: typeof substance.contaminantClass;
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [
    substance,
    bwInput,
    foodIrInput,
    targetRiskInput,
    hazardQuotientInput,
    rfdInput,
    slopeInput,
    bsafInput,
    baOralInput,
    fLipidPercent,
    focPercent,
    ecosystem,
  ]);

  const hhResult = 'error' in result ? null : result;
  const provenanceValues: CalculatorUsedValue[] = useMemo(
    () => [
      {
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        label: 'Oral RfD',
        value: rfdInput === '' ? null : rfdInput,
        unit: 'mg/kg-bw/day',
        role: 'current calculator default',
        pathway: 'human-health-food',
        substance_key: substanceKey,
      },
      {
        input_key: 'sf_oral_per_mg_per_kg_bw_per_day',
        label: 'Oral slope factor',
        value: slopeInput === '' ? null : slopeInput,
        unit: 'per mg/kg-bw/day',
        role: 'current calculator default',
        pathway: 'human-health-food',
        substance_key: substanceKey,
      },
      {
        input_key: 'bsaf_loc_freshwater',
        label: 'Local BSAF',
        value: bsafInput === '' ? null : bsafInput,
        role: 'current calculator default',
        pathway: 'human-health-food',
        substance_key: substanceKey,
      },
      {
        input_key: 'ba_oral',
        label: 'Oral bioavailability',
        value: baOralInput,
        role: 'current calculator default',
        pathway: 'human-health-food',
        substance_key: substanceKey,
      },
      {
        input_key: 'BW_kg',
        label: 'Body weight',
        value: bwInput,
        unit: 'kg',
        role: 'screening assumption',
      },
      {
        input_key: 'IR_food_kg_per_day',
        label: 'Food ingestion',
        value: foodIrInput,
        unit: 'kg/day',
        role: 'screening assumption',
      },
      {
        input_key: 'targetRisk',
        label: 'Target risk',
        value: targetRiskInput,
        role: 'screening assumption',
      },
      {
        input_key: 'hazardQuotient',
        label: 'Hazard quotient',
        value: hazardQuotientInput,
        role: 'screening assumption',
      },
      {
        input_key: 'fLipid',
        label: 'Tissue lipid fraction',
        value: fLipidPercent.toFixed(2),
        unit: '%',
        role: 'screening assumption',
      },
      {
        input_key: 'foc',
        label: 'Sediment organic carbon',
        value: focPercent.toFixed(2),
        unit: '%',
        role: 'screening assumption',
      },
      {
        input_key: 'ecosystem',
        label: 'Ecosystem',
        value: ecosystem,
        role: 'screening assumption',
      },
    ],
    [
      baOralInput,
      bsafInput,
      bwInput,
      ecosystem,
      fLipidPercent,
      focPercent,
      foodIrInput,
      hazardQuotientInput,
      rfdInput,
      slopeInput,
      substanceKey,
      targetRiskInput,
    ],
  );

  return (
    <section
      data-testid="hh-food-web-calculator"
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm${className ? ` ${className}` : ''}`}
    >
      <header className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Human Health Food Web
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Screening value for fish or shellfish consumption. The tool first
          derives a protective tissue concentration, then back-calculates a
          sediment value through the BSAF path.
        </p>
        {substance && (
          <p
            className="text-xs text-slate-500 dark:text-slate-400 mt-2"
            data-testid="hh-food-substance-summary"
          >
            Active substance: <span className="font-semibold">{substance.displayName}</span>{' '}
            (class: {substance.contaminantClass}).
          </p>
        )}
      </header>

      <div
        className="space-y-4 mb-6"
        data-testid="hh-food-inputs-section"
        aria-label="Human Health Food Web inputs"
      >
        <fieldset>
          <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Ecosystem
          </legend>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Human Health Food Web ecosystem">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Body weight (kg)
            <input value={bwInput} onChange={(e) => setBwInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Food ingestion (kg/day)
            <input data-testid="hh-food-ir-input" value={foodIrInput} onChange={(e) => setFoodIrInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => setFoodIrInput('0.032')} className="px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              32 g/day
            </button>
            <button type="button" onClick={() => setFoodIrInput('0.142')} className="px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              142 g/day
            </button>
            <button type="button" onClick={() => setFoodIrInput('0.388')} className="px-2.5 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              388 g/day
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            RfD (mg/kg-bw/day)
            <input data-testid="hh-food-rfd-input" value={rfdInput} onChange={(e) => setRfdInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Oral slope factor
            <input data-testid="hh-food-slope-input" value={slopeInput} onChange={(e) => setSlopeInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            BSAF_loc
            <input data-testid="hh-food-bsaf-input" value={bsafInput} onChange={(e) => setBsafInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Oral bioavailability
            <input value={baOralInput} onChange={(e) => setBaOralInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Target risk
            <input value={targetRiskInput} onChange={(e) => setTargetRiskInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Hazard quotient
            <input value={hazardQuotientInput} onChange={(e) => setHazardQuotientInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="hh-food-flipid" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Tissue lipid fraction
              </label>
              <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">
                {fLipidPercent.toFixed(2)} %
              </span>
            </div>
            <input id="hh-food-flipid" type="range" min="1" max="15" step="0.1" value={fLipidPercent} onChange={(e) => setFLipidPercent(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="hh-food-foc" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Sediment f_oc
              </label>
              <span className="text-sm font-mono text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded shadow-sm">
                {focPercent.toFixed(2)} %
              </span>
            </div>
            <input id="hh-food-foc" type="range" min="0.1" max="15" step="0.1" value={focPercent} onChange={(e) => setFocPercent(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600" />
          </div>
        </div>
      </div>

      {'error' in result && (
        <div
          className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200 mb-6"
          data-testid="hh-food-error"
        >
          {result.error}
        </div>
      )}

      <div
        className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner mb-6"
        data-testid="hh-food-preliminary-standard"
      >
        <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
          Preliminary Human Health Screening Value (Food Web)
        </div>
        <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
          {hhResult && !hhResult.blocked ? hhResult.sedS.toPrecision(4) : '--'}{' '}
          <span className="text-lg text-slate-500 font-medium">mg/kg dry</span>
        </div>
        {hhResult && (
          <div className="mt-3 inline-flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              Driver: {hhResult.driver}
            </span>
            {hhResult.blocked && (
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                Diagnostic only
              </span>
            )}
          </div>
        )}
        <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-3 italic">
          Screening-grade value for options analysis; confirm consumption
          assumptions and tissue-linkage data before regulator-facing use.
        </p>
      </div>

      <details
        className="group bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
        data-testid="hh-food-technical-details"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 select-none flex items-center justify-between">
          <span>Technical details (tissue target + BSAF chain)</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 group-open:hidden">show</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden group-open:inline">hide</span>
        </summary>
        <div className="px-4 py-4 space-y-4 border-t border-slate-200 dark:border-slate-800">
          <MathRenderer
            content={
              'Tissue target = $targetDose \\cdot BW / (IR_{food} \\cdot BA_o)$. ' +
              'Sediment value = $C_{tissue} / BSAF_{effective}$.'
            }
          />
          {hhResult && (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Tissue target</span>
                <span>{hhResult.tissueTarget_mg_per_kg.toPrecision(4)} mg/kg</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">BSAF_effective</span>
                <span>{hhResult.BSAF_effective.toPrecision(4)}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">M_eco</span>
                <span>{hhResult.M_eco}</span>
              </div>
            </div>
          )}
          {hhResult && hhResult.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
              <div className="font-semibold">Endpoint and model notes</div>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {hhResult.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
      <CalculatorProvenancePanel
        pathway="human-health-food"
        usedValues={provenanceValues}
        onOpenEvidenceLibrary={onOpenEvidenceLibrary}
      />
    </section>
  );
}
