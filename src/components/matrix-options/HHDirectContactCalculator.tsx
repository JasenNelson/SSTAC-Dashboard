'use client';

// Human Health Direct Contact screening calculator.
// Plain ASCII only.

import React, { useEffect, useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { humanHealthDirectContact } from '@/lib/matrix-options/derivations';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';
import type { HumanHealthDirectContactResult } from '@/lib/matrix-options/types';
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

export interface HHDirectContactCalculatorProps {
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

export default function HHDirectContactCalculator({
  substanceKey = DEFAULT_SUBSTANCE_KEY,
  jurisdiction: _jurisdiction = DEFAULT_JURISDICTION,
  className,
  onOpenEvidenceLibrary,
}: HHDirectContactCalculatorProps) {
  const substance = findSubstance(substanceKey);
  const [bwInput, setBwInput] = useState('15');
  const [edInput, setEdInput] = useState('6');
  const [efInput, setEfInput] = useState('40');
  const [atCancerInput, setAtCancerInput] = useState('70');
  const [irSedInput, setIrSedInput] = useState('200');
  const [skinAreaInput, setSkinAreaInput] = useState('2800');
  const [adherenceInput, setAdherenceInput] = useState('0.2');
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
  const [absDermalInput, setAbsDermalInput] = useState(
    substance ? String(substance.abs_dermal) : '0.001',
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
    setAbsDermalInput(next ? String(next.abs_dermal) : '0.001');
    setBaOralInput(next ? String(next.ba_oral) : '1');
  }, [substanceKey]);

  const result: HumanHealthDirectContactResult | { error: string } = useMemo(() => {
    const fields = {
      BW_kg: positiveInput(bwInput, 'Body weight'),
      ED_years: positiveInput(edInput, 'Exposure duration'),
      EF_days_per_year: positiveInput(efInput, 'Exposure frequency'),
      AT_cancer_years: positiveInput(atCancerInput, 'Cancer averaging time'),
      IR_sed_mg_per_day: positiveInput(irSedInput, 'Sediment ingestion rate'),
      SA_cm2: positiveInput(skinAreaInput, 'Skin surface area'),
      AF_sed_mg_per_cm2: positiveInput(adherenceInput, 'Sediment adherence factor'),
      targetRisk: positiveInput(targetRiskInput, 'Target risk'),
      hazardQuotient: positiveInput(hazardQuotientInput, 'Hazard quotient'),
      rfd_oral_mg_per_kg_bw_day: optionalPositiveInput(rfdInput, 'RfD'),
      sf_oral_per_mg_per_kg_bw_per_day: optionalPositiveInput(slopeInput, 'Oral slope factor'),
      abs_dermal: positiveInput(absDermalInput, 'Dermal absorption fraction'),
      ba_oral: positiveInput(baOralInput, 'Oral bioavailability'),
    };

    for (const value of Object.values(fields)) {
      if (typeof value === 'object' && value !== null && 'error' in value) {
        return value;
      }
    }

    try {
      return humanHealthDirectContact(fields as {
        rfd_oral_mg_per_kg_bw_day: number | null;
        sf_oral_per_mg_per_kg_bw_per_day: number | null;
        targetRisk: number;
        hazardQuotient: number;
        BW_kg: number;
        ED_years: number;
        EF_days_per_year: number;
        AT_cancer_years: number;
        IR_sed_mg_per_day: number;
        SA_cm2: number;
        AF_sed_mg_per_cm2: number;
        abs_dermal: number;
        ba_oral: number;
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [
    bwInput,
    edInput,
    efInput,
    atCancerInput,
    irSedInput,
    skinAreaInput,
    adherenceInput,
    targetRiskInput,
    hazardQuotientInput,
    rfdInput,
    slopeInput,
    absDermalInput,
    baOralInput,
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
        pathway: 'human-health-direct',
        substance_key: substanceKey,
      },
      {
        input_key: 'sf_oral_per_mg_per_kg_bw_per_day',
        label: 'Oral slope factor',
        value: slopeInput === '' ? null : slopeInput,
        unit: 'per mg/kg-bw/day',
        role: 'current calculator default',
        pathway: 'human-health-direct',
        substance_key: substanceKey,
      },
      {
        input_key: 'abs_dermal',
        label: 'Dermal absorption',
        value: absDermalInput,
        role: 'current calculator default',
        pathway: 'human-health-direct',
        substance_key: substanceKey,
      },
      {
        input_key: 'ba_oral',
        label: 'Oral bioavailability',
        value: baOralInput,
        role: 'current calculator default',
        pathway: 'human-health-direct',
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
        input_key: 'ED_years',
        label: 'Exposure duration',
        value: edInput,
        unit: 'years',
        role: 'screening assumption',
      },
      {
        input_key: 'IR_sed_mg_per_day',
        label: 'Sediment ingestion',
        value: irSedInput,
        unit: 'mg/day',
        role: 'screening assumption',
      },
      {
        input_key: 'AT_cancer_years',
        label: 'Cancer averaging time',
        value: atCancerInput,
        unit: 'years',
        role: 'screening assumption',
      },
      {
        input_key: 'SA_cm2',
        label: 'Skin surface area',
        value: skinAreaInput,
        unit: 'cm2',
        role: 'screening assumption',
      },
      {
        input_key: 'AF_sed_mg_per_cm2',
        label: 'Sediment adherence',
        value: adherenceInput,
        unit: 'mg/cm2',
        role: 'screening assumption',
      },
      {
        input_key: 'EF_days_per_year',
        label: 'Exposure frequency',
        value: efInput,
        unit: 'days/year',
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
    ],
    [
      absDermalInput,
      adherenceInput,
      atCancerInput,
      baOralInput,
      bwInput,
      edInput,
      efInput,
      hazardQuotientInput,
      irSedInput,
      rfdInput,
      skinAreaInput,
      slopeInput,
      substanceKey,
      targetRiskInput,
    ],
  );

  return (
    <section
      data-testid="hh-direct-contact-calculator"
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm${className ? ` ${className}` : ''}`}
    >
      <header className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Human Health Direct Contact
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Screening value for incidental ingestion plus dermal contact with
          wet sediment. Inputs are editable so reviewers can test sensitive
          receptor and site-use assumptions.
        </p>
        {substance && (
          <p
            className="text-xs text-slate-500 dark:text-slate-400 mt-2"
            data-testid="hh-direct-substance-summary"
          >
            Active substance: <span className="font-semibold">{substance.displayName}</span>{' '}
            (class: {substance.contaminantClass}).
          </p>
        )}
      </header>

      <div
        className="space-y-4 mb-6"
        data-testid="hh-direct-inputs-section"
        aria-label="Human Health Direct Contact inputs"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Body weight (kg)
            <input value={bwInput} onChange={(e) => setBwInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Exposure duration (yr)
            <input value={edInput} onChange={(e) => setEdInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Exposure frequency (days/yr)
            <input value={efInput} onChange={(e) => setEfInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Cancer averaging time (yr)
            <input value={atCancerInput} onChange={(e) => setAtCancerInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sediment ingestion (mg/day)
            <input value={irSedInput} onChange={(e) => setIrSedInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Skin area (cm2)
            <input value={skinAreaInput} onChange={(e) => setSkinAreaInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Adherence (mg/cm2)
            <input value={adherenceInput} onChange={(e) => setAdherenceInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            RfD (mg/kg-bw/day)
            <input data-testid="hh-direct-rfd-input" value={rfdInput} onChange={(e) => setRfdInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Oral slope factor
            <input data-testid="hh-direct-slope-input" value={slopeInput} onChange={(e) => setSlopeInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Target risk
            <input value={targetRiskInput} onChange={(e) => setTargetRiskInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Hazard quotient
            <input value={hazardQuotientInput} onChange={(e) => setHazardQuotientInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Dermal absorption
            <input value={absDermalInput} onChange={(e) => setAbsDermalInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Oral bioavailability
            <input value={baOralInput} onChange={(e) => setBaOralInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
          </label>
        </div>
      </div>

      {'error' in result && (
        <div
          className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200 mb-6"
          data-testid="hh-direct-error"
        >
          {result.error}
        </div>
      )}

      <div
        className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner mb-6"
        data-testid="hh-direct-preliminary-standard"
      >
        <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
          Preliminary Human Health Screening Value (Direct Contact)
        </div>
        <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
          {hhResult ? hhResult.sedS.toPrecision(4) : '--'}{' '}
          <span className="text-lg text-slate-500 font-medium">mg/kg dry</span>
        </div>
        {hhResult && (
          <div className="mt-3 inline-block px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            Driver: {hhResult.driver}
          </div>
        )}
        <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-3 italic">
          Screening-grade value for options analysis; confirm exposure
          assumptions before regulator-facing use.
        </p>
      </div>

      <details
        className="group bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
        data-testid="hh-direct-technical-details"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 select-none flex items-center justify-between">
          <span>Technical details (formula + endpoint comparison)</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 group-open:hidden">show</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden group-open:inline">hide</span>
        </summary>
        <div className="px-4 py-4 space-y-4 border-t border-slate-200 dark:border-slate-800">
          <MathRenderer
            content={
              'Dose = $C_s \\cdot CF \\cdot EF \\cdot ED \\cdot ' +
              '(IR_{sed} \\cdot BA_o + SA \\cdot AF_{sed} \\cdot ABS_d) / ' +
              '(BW \\cdot AT)$. The calculator solves for $C_s$ for the ' +
              'available non-cancer and cancer endpoints and selects the lower value.'
            }
          />
          {hhResult && (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Non-cancer value</span>
                <span>{hhResult.nonCancerSedS?.toPrecision(4) ?? 'n/a'}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Cancer value</span>
                <span>{hhResult.cancerSedS?.toPrecision(4) ?? 'n/a'}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Adjusted contact rate</span>
                <span>{hhResult.contactRate_mg_per_day.toPrecision(4)} mg/day</span>
              </div>
            </div>
          )}
          {hhResult && hhResult.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
              <div className="font-semibold">Endpoint notes</div>
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
        pathway="human-health-direct"
        usedValues={provenanceValues}
        onOpenEvidenceLibrary={onOpenEvidenceLibrary}
      />
    </section>
  );
}
