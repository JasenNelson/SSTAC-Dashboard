'use client';

// Human Health Direct Contact screening calculator.
// Plain ASCII only.

import React, { useEffect, useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { getEquation } from '@/lib/matrix-options/equationDispatch';
import { getActiveFrameDefaults } from '@/lib/matrix-options/frameDefaults';
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
import RegulatoryFrameNotice from './RegulatoryFrameNotice';
import FrameVariantFallbackNotice from './FrameVariantFallbackNotice';

// Unsourced calculator baselines for the seven HC PQRA exposure-factor inputs, used
// when the selected frame has no active human-health-direct frame default. Each value
// preserves the prior hardcoded useState default so behavior is unchanged off-frame.
const BASELINE_BW_DIRECT_KG = '15';
const BASELINE_ED_YEARS = '6';
const BASELINE_EF_DAYS = '40';
const BASELINE_AT_CANCER_YEARS = '70';
const BASELINE_IR_SED_MG_PER_DAY = '200';
const BASELINE_SA_CM2 = '2800';
const BASELINE_AF_SED = '0.2';

// The active human-health-direct frame default for a given input key (or null when the
// frame has no active default for that key). One shared helper for all seven seeds.
function activeDirectDefaultFor(jurisdiction: Jurisdiction, inputKey: string) {
  return (
    getActiveFrameDefaults(jurisdiction, 'human-health-direct').find(
      (d) => d.inputKey === inputKey,
    ) ?? null
  );
}

// The string value to seed an input for a jurisdiction: the active frame default, else
// the input's baseline. Deterministic (static catalog) -> SSR == CSR.
function seedDirectFor(
  jurisdiction: Jurisdiction,
  inputKey: string,
  baseline: string,
): string {
  const active = activeDirectDefaultFor(jurisdiction, inputKey);
  return active && active.value != null ? String(active.value) : baseline;
}

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
  jurisdiction = DEFAULT_JURISDICTION,
  className,
  onOpenEvidenceLibrary,
}: HHDirectContactCalculatorProps) {
  const substance = findSubstance(substanceKey);
  // LAZY seed each exposure factor from the active frame default for the initial frame
  // (no flash; SSR == CSR because the catalog is static). The frame-switch re-seed
  // happens DURING render (below), mirroring HHFoodWebCalculator, so a new frame never
  // paints the previous frame's value.
  const [bwInput, setBwInput] = useState(() =>
    seedDirectFor(jurisdiction, 'BW_kg', BASELINE_BW_DIRECT_KG),
  );
  const [edInput, setEdInput] = useState(() =>
    seedDirectFor(jurisdiction, 'ED_years', BASELINE_ED_YEARS),
  );
  const [efInput, setEfInput] = useState(() =>
    seedDirectFor(jurisdiction, 'EF_days_per_year', BASELINE_EF_DAYS),
  );
  const [atCancerInput, setAtCancerInput] = useState(() =>
    seedDirectFor(jurisdiction, 'AT_cancer_years', BASELINE_AT_CANCER_YEARS),
  );
  const [irSedInput, setIrSedInput] = useState(() =>
    seedDirectFor(jurisdiction, 'IR_sed_mg_per_day', BASELINE_IR_SED_MG_PER_DAY),
  );
  const [skinAreaInput, setSkinAreaInput] = useState(() =>
    seedDirectFor(jurisdiction, 'SA_cm2', BASELINE_SA_CM2),
  );
  const [adherenceInput, setAdherenceInput] = useState(() =>
    seedDirectFor(jurisdiction, 'AF_sed_mg_per_cm2', BASELINE_AF_SED),
  );
  const [prevJurisdiction, setPrevJurisdiction] = useState(jurisdiction);
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

  // Re-seed each exposure factor on frame change, DURING render (React "adjust state
  // when a prop changes" pattern) so the new frame never paints the previous frame's
  // value. Re-seed an input only when it still holds the PREVIOUS frame's seed (the user
  // has NOT moved it off-default); otherwise preserve the user's edit. The guard makes
  // this run once per jurisdiction change (no render loop).
  if (jurisdiction !== prevJurisdiction) {
    setPrevJurisdiction(jurisdiction);
    if (bwInput === seedDirectFor(prevJurisdiction, 'BW_kg', BASELINE_BW_DIRECT_KG)) {
      setBwInput(seedDirectFor(jurisdiction, 'BW_kg', BASELINE_BW_DIRECT_KG));
    }
    if (edInput === seedDirectFor(prevJurisdiction, 'ED_years', BASELINE_ED_YEARS)) {
      setEdInput(seedDirectFor(jurisdiction, 'ED_years', BASELINE_ED_YEARS));
    }
    if (efInput === seedDirectFor(prevJurisdiction, 'EF_days_per_year', BASELINE_EF_DAYS)) {
      setEfInput(seedDirectFor(jurisdiction, 'EF_days_per_year', BASELINE_EF_DAYS));
    }
    if (atCancerInput === seedDirectFor(prevJurisdiction, 'AT_cancer_years', BASELINE_AT_CANCER_YEARS)) {
      setAtCancerInput(seedDirectFor(jurisdiction, 'AT_cancer_years', BASELINE_AT_CANCER_YEARS));
    }
    if (irSedInput === seedDirectFor(prevJurisdiction, 'IR_sed_mg_per_day', BASELINE_IR_SED_MG_PER_DAY)) {
      setIrSedInput(seedDirectFor(jurisdiction, 'IR_sed_mg_per_day', BASELINE_IR_SED_MG_PER_DAY));
    }
    if (skinAreaInput === seedDirectFor(prevJurisdiction, 'SA_cm2', BASELINE_SA_CM2)) {
      setSkinAreaInput(seedDirectFor(jurisdiction, 'SA_cm2', BASELINE_SA_CM2));
    }
    if (adherenceInput === seedDirectFor(prevJurisdiction, 'AF_sed_mg_per_cm2', BASELINE_AF_SED)) {
      setAdherenceInput(seedDirectFor(jurisdiction, 'AF_sed_mg_per_cm2', BASELINE_AF_SED));
    }
  }

  // The active frame default per input for the current frame (drives the label, the
  // reset button, and provenance attribution -- all pure functions of render state).
  const activeBwDefault = useMemo(
    () => activeDirectDefaultFor(jurisdiction, 'BW_kg'),
    [jurisdiction],
  );
  const activeEdDefault = useMemo(
    () => activeDirectDefaultFor(jurisdiction, 'ED_years'),
    [jurisdiction],
  );
  const activeEfDefault = useMemo(
    () => activeDirectDefaultFor(jurisdiction, 'EF_days_per_year'),
    [jurisdiction],
  );
  const activeAtCancerDefault = useMemo(
    () => activeDirectDefaultFor(jurisdiction, 'AT_cancer_years'),
    [jurisdiction],
  );
  const activeIrSedDefault = useMemo(
    () => activeDirectDefaultFor(jurisdiction, 'IR_sed_mg_per_day'),
    [jurisdiction],
  );
  const activeSaDefault = useMemo(
    () => activeDirectDefaultFor(jurisdiction, 'SA_cm2'),
    [jurisdiction],
  );
  const activeAfDefault = useMemo(
    () => activeDirectDefaultFor(jurisdiction, 'AF_sed_mg_per_cm2'),
    [jurisdiction],
  );

  const bwIsFrameDefault =
    activeBwDefault != null &&
    activeBwDefault.value != null &&
    bwInput === String(activeBwDefault.value);
  const edIsFrameDefault =
    activeEdDefault != null &&
    activeEdDefault.value != null &&
    edInput === String(activeEdDefault.value);
  const efIsFrameDefault =
    activeEfDefault != null &&
    activeEfDefault.value != null &&
    efInput === String(activeEfDefault.value);
  const atCancerIsFrameDefault =
    activeAtCancerDefault != null &&
    activeAtCancerDefault.value != null &&
    atCancerInput === String(activeAtCancerDefault.value);
  const irSedIsFrameDefault =
    activeIrSedDefault != null &&
    activeIrSedDefault.value != null &&
    irSedInput === String(activeIrSedDefault.value);
  const saIsFrameDefault =
    activeSaDefault != null &&
    activeSaDefault.value != null &&
    skinAreaInput === String(activeSaDefault.value);
  const afIsFrameDefault =
    activeAfDefault != null &&
    activeAfDefault.value != null &&
    adherenceInput === String(activeAfDefault.value);

  // Resolve the equation for the selected regulatory frame (empty FRAME_VARIANTS
  // -> baseline + usedBaselineFallback: true). Call site below is unchanged.
  const { run: humanHealthDirectContact, usedBaselineFallback, fallbackReason } =
    useMemo(() => getEquation(jurisdiction, 'human-health-direct'), [jurisdiction]);

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
    humanHealthDirectContact,
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
        // When the field holds the active frame default, attribute it to the EXACT cited
        // catalog record (by id) so the panel shows its source/evidence. Otherwise it is a
        // plain user-adjustable screening assumption.
        ...(bwIsFrameDefault && activeBwDefault
          ? {
              role: 'source-backed default' as const,
              pathway: 'human-health-direct' as const,
              substance_key: 'generic',
              parameter_value_id: activeBwDefault.parameterValueId,
            }
          : { role: 'screening assumption' as const }),
      },
      {
        input_key: 'ED_years',
        label: 'Exposure duration',
        value: edInput,
        unit: 'years',
        ...(edIsFrameDefault && activeEdDefault
          ? {
              role: 'source-backed default' as const,
              pathway: 'human-health-direct' as const,
              substance_key: 'generic',
              parameter_value_id: activeEdDefault.parameterValueId,
            }
          : { role: 'screening assumption' as const }),
      },
      {
        input_key: 'IR_sed_mg_per_day',
        label: 'Sediment ingestion',
        value: irSedInput,
        unit: 'mg/day',
        ...(irSedIsFrameDefault && activeIrSedDefault
          ? {
              role: 'source-backed default' as const,
              pathway: 'human-health-direct' as const,
              substance_key: 'generic',
              parameter_value_id: activeIrSedDefault.parameterValueId,
            }
          : { role: 'screening assumption' as const }),
      },
      {
        input_key: 'AT_cancer_years',
        label: 'Cancer averaging time',
        value: atCancerInput,
        unit: 'years',
        ...(atCancerIsFrameDefault && activeAtCancerDefault
          ? {
              role: 'source-backed default' as const,
              pathway: 'human-health-direct' as const,
              substance_key: 'generic',
              parameter_value_id: activeAtCancerDefault.parameterValueId,
            }
          : { role: 'screening assumption' as const }),
      },
      {
        input_key: 'SA_cm2',
        label: 'Skin surface area',
        value: skinAreaInput,
        unit: 'cm2',
        ...(saIsFrameDefault && activeSaDefault
          ? {
              role: 'source-backed default' as const,
              pathway: 'human-health-direct' as const,
              substance_key: 'generic',
              parameter_value_id: activeSaDefault.parameterValueId,
            }
          : { role: 'screening assumption' as const }),
      },
      {
        input_key: 'AF_sed_mg_per_cm2',
        label: 'Sediment adherence',
        value: adherenceInput,
        unit: 'mg/cm2',
        ...(afIsFrameDefault && activeAfDefault
          ? {
              role: 'source-backed default' as const,
              pathway: 'human-health-direct' as const,
              substance_key: 'generic',
              parameter_value_id: activeAfDefault.parameterValueId,
            }
          : { role: 'screening assumption' as const }),
      },
      {
        input_key: 'EF_days_per_year',
        label: 'Exposure frequency',
        value: efInput,
        unit: 'days/year',
        ...(efIsFrameDefault && activeEfDefault
          ? {
              role: 'source-backed default' as const,
              pathway: 'human-health-direct' as const,
              substance_key: 'generic',
              parameter_value_id: activeEfDefault.parameterValueId,
            }
          : { role: 'screening assumption' as const }),
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
      activeAfDefault,
      activeAtCancerDefault,
      activeBwDefault,
      activeEdDefault,
      activeEfDefault,
      activeIrSedDefault,
      activeSaDefault,
      adherenceInput,
      afIsFrameDefault,
      atCancerInput,
      atCancerIsFrameDefault,
      baOralInput,
      bwInput,
      bwIsFrameDefault,
      edInput,
      edIsFrameDefault,
      efInput,
      efIsFrameDefault,
      hazardQuotientInput,
      irSedInput,
      irSedIsFrameDefault,
      rfdInput,
      saIsFrameDefault,
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

      <RegulatoryFrameNotice
        frameId={jurisdiction}
        pathway="human-health-direct"
      />

      <FrameVariantFallbackNotice
        usedBaselineFallback={usedBaselineFallback}
        fallbackReason={fallbackReason}
      />

      <div
        className="space-y-4 mb-6"
        data-testid="hh-direct-inputs-section"
        aria-label="Human Health Direct Contact inputs"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Body weight (kg)
            <input data-testid="hh-direct-bw-input" value={bwInput} onChange={(e) => setBwInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
            {activeBwDefault && activeBwDefault.value != null && (
              <p data-testid="hh-direct-bw-frame-default-label" className="mt-1 text-xs font-normal text-sky-700 dark:text-sky-400">
                Frame default {activeBwDefault.value} kg ({activeBwDefault.label}). Adjustable.
              </p>
            )}
            {activeBwDefault && activeBwDefault.value != null && !bwIsFrameDefault && (
              <button type="button" data-testid="hh-direct-bw-reset-to-frame-default" onClick={() => setBwInput(String(activeBwDefault.value))} className="mt-1 px-2.5 py-1 text-xs rounded-md border border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
                Reset to frame default
              </button>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Exposure duration (yr)
            <input data-testid="hh-direct-ed-input" value={edInput} onChange={(e) => setEdInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
            {activeEdDefault && activeEdDefault.value != null && (
              <p data-testid="hh-direct-ed-frame-default-label" className="mt-1 text-xs font-normal text-sky-700 dark:text-sky-400">
                Frame default {activeEdDefault.value} years ({activeEdDefault.label}). Adjustable.
              </p>
            )}
            {activeEdDefault && activeEdDefault.value != null && !edIsFrameDefault && (
              <button type="button" data-testid="hh-direct-ed-reset-to-frame-default" onClick={() => setEdInput(String(activeEdDefault.value))} className="mt-1 px-2.5 py-1 text-xs rounded-md border border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
                Reset to frame default
              </button>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Exposure frequency (days/yr)
            <input data-testid="hh-direct-ef-input" value={efInput} onChange={(e) => setEfInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
            {activeEfDefault && activeEfDefault.value != null && (
              <p data-testid="hh-direct-ef-frame-default-label" className="mt-1 text-xs font-normal text-sky-700 dark:text-sky-400">
                Frame default {activeEfDefault.value} days/year ({activeEfDefault.label}). Adjustable.
              </p>
            )}
            {activeEfDefault && activeEfDefault.value != null && !efIsFrameDefault && (
              <button type="button" data-testid="hh-direct-ef-reset-to-frame-default" onClick={() => setEfInput(String(activeEfDefault.value))} className="mt-1 px-2.5 py-1 text-xs rounded-md border border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
                Reset to frame default
              </button>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Cancer averaging time (yr)
            <input data-testid="hh-direct-at-cancer-input" value={atCancerInput} onChange={(e) => setAtCancerInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
            {activeAtCancerDefault && activeAtCancerDefault.value != null && (
              <p data-testid="hh-direct-at-cancer-frame-default-label" className="mt-1 text-xs font-normal text-sky-700 dark:text-sky-400">
                Frame default {activeAtCancerDefault.value} years ({activeAtCancerDefault.label}). Adjustable.
              </p>
            )}
            {activeAtCancerDefault && activeAtCancerDefault.value != null && !atCancerIsFrameDefault && (
              <button type="button" data-testid="hh-direct-at-cancer-reset-to-frame-default" onClick={() => setAtCancerInput(String(activeAtCancerDefault.value))} className="mt-1 px-2.5 py-1 text-xs rounded-md border border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
                Reset to frame default
              </button>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sediment ingestion (mg/day)
            <input data-testid="hh-direct-ir-sed-input" value={irSedInput} onChange={(e) => setIrSedInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
            {activeIrSedDefault && activeIrSedDefault.value != null && (
              <p data-testid="hh-direct-ir-sed-frame-default-label" className="mt-1 text-xs font-normal text-sky-700 dark:text-sky-400">
                Frame default {activeIrSedDefault.value} mg/day ({activeIrSedDefault.label}). Adjustable.
              </p>
            )}
            {activeIrSedDefault && activeIrSedDefault.value != null && !irSedIsFrameDefault && (
              <button type="button" data-testid="hh-direct-ir-sed-reset-to-frame-default" onClick={() => setIrSedInput(String(activeIrSedDefault.value))} className="mt-1 px-2.5 py-1 text-xs rounded-md border border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
                Reset to frame default
              </button>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Skin area (cm2)
            <input data-testid="hh-direct-sa-input" value={skinAreaInput} onChange={(e) => setSkinAreaInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
            {activeSaDefault && activeSaDefault.value != null && (
              <p data-testid="hh-direct-sa-frame-default-label" className="mt-1 text-xs font-normal text-sky-700 dark:text-sky-400">
                Frame default {activeSaDefault.value} cm2 ({activeSaDefault.label}). Adjustable.
              </p>
            )}
            {activeSaDefault && activeSaDefault.value != null && !saIsFrameDefault && (
              <button type="button" data-testid="hh-direct-sa-reset-to-frame-default" onClick={() => setSkinAreaInput(String(activeSaDefault.value))} className="mt-1 px-2.5 py-1 text-xs rounded-md border border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
                Reset to frame default
              </button>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Adherence (mg/cm2)
            <input data-testid="hh-direct-af-input" value={adherenceInput} onChange={(e) => setAdherenceInput(e.target.value)} className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono" />
            {activeAfDefault && activeAfDefault.value != null && (
              <p data-testid="hh-direct-af-frame-default-label" className="mt-1 text-xs font-normal text-sky-700 dark:text-sky-400">
                Frame default {activeAfDefault.value} mg/cm2 ({activeAfDefault.label}). Adjustable.
              </p>
            )}
            {activeAfDefault && activeAfDefault.value != null && !afIsFrameDefault && (
              <button type="button" data-testid="hh-direct-af-reset-to-frame-default" onClick={() => setAdherenceInput(String(activeAfDefault.value))} className="mt-1 px-2.5 py-1 text-xs rounded-md border border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200">
                Reset to frame default
              </button>
            )}
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
        regulatoryFrameId={jurisdiction}
        onOpenEvidenceLibrary={onOpenEvidenceLibrary}
      />
    </section>
  );
}
