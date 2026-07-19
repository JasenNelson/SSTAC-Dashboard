'use client';

// Human Health Inhalation screening calculator (Matrix Options row #31).
// Plain ASCII only.
//
// OWNER RULING (2026-07-17, binding, fail-closed): VF (volatilization factor) and PEF
// (particulate emission factor) are USER-SUPPLIED inputs only. This component never
// seeds, defaults, or hardcodes either -- both fields start blank regardless of
// substance, and the calculator (deriveInhalationStandards) blocks the whole pathway
// when both are absent. See src/lib/matrix-options/inhalation/calculator.ts for the
// full equation derivation and citations (EPA/540/R-96/018 Eq. 5/8 framework).
//
// Structure mirrors HHDirectContactCalculator.tsx (inputs -> error -> headline result
// -> technical details disclosure -> provenance panel) but omits that calculator's
// frame/receptor-scenario machinery: inhalation has no frame-variant or receptor-
// scenario rows defined anywhere in this codebase today, so there is nothing to
// dispatch on. RfC/IUR seed from the substance library (same static-catalog pattern as
// RfD/SF in HHDirectContactCalculator); the provenance panel resolves them against the
// REAL catalog pathway those rows live on ('human-health-direct' -- see
// matrix_research/reference_catalog/human_health_trv_values.json), not an invented
// inhalation-specific pathway id.

import React, { useEffect, useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';
import {
  deriveInhalationStandards,
  type HumanHealthInhalationInput,
  type HumanHealthInhalationResult,
} from '@/lib/matrix-options/inhalation/calculator';
import type {
  CalculatorUsedValue,
  EvidenceLibraryFilterRequest,
} from '@/lib/matrix-options/provenance/types';
import { positiveInput, optionalPositiveInput } from '@/lib/matrix-options/parseDecimal';
import { DEFAULT_SUBSTANCE_KEY } from './SharedGlobalInputs';
import {
  DEFAULT_JURISDICTION,
  type Jurisdiction,
} from './guide/content/jurisdictions';
import CalculatorProvenancePanel from './CalculatorProvenancePanel';

// Unsourced (screening-assumption) exposure-factor baselines. EF/ED/AT_cancer default
// to the EPA/540/R-96/018 (1996 SSG) residential Table 1 defaults reproduced in the
// discovery packet Section 4.1 (EFr=350 d/yr, EDr=30 yr, AT cancer=70 yr) -- these ARE
// source-cited (primary-verified), unlike VF/PEF, which is why they may be seeded as
// adjustable baselines while VF/PEF may not. Every value stays user-adjustable.
const BASELINE_EF_DAYS = '350';
const BASELINE_ED_YEARS = '30';
const BASELINE_AT_CANCER_YEARS = '70';
const BASELINE_TARGET_RISK = '0.00001';
const BASELINE_HAZARD_QUOTIENT = '1';

// EXACT catalog parameter_value_id for each substanceLibrary.ts-wired RfC/IUR value
// (codex ship-gate P2, 2026-07-17): the catalog's IUR rows are keyed
// `unit_risk_inhalation_per_ug_m3` with unit "per ug/m3" and a DIFFERENT (pre-x1000)
// numeric value than this calculator's per-mg/m3 field -- so the resolver's ambiguous
// (substance_key, pathway, input_key, value) tuple match can never attribute the
// converted IUR back to its source row (RfC has no unit-conversion, so it usually
// resolves fine by value-match, but tetrachloroethylene has TWO same-valued approved
// candidates -- IRIS and HC -- which is itself an ambiguous tie without an explicit
// id). Since substanceLibrary.ts's code comments already cite the EXACT wired
// parameter_value_id for each of these three substances, pin it here directly
// (mirrors the `activeBwDefault.parameterValueId` pattern in
// HHDirectContactCalculator.tsx) rather than relying on tuple-match inference.
// Only attached when the current input still equals the as-wired seed (see
// rfcMatchesSeed / iurMatchesSeed below) -- a user edit is no longer attributable to
// that exact catalog row and must fall back to a plain calculator-default row.
const INHALATION_TOXICITY_PARAMETER_VALUE_IDS: Record<
  string,
  { rfc: string; iur: string } | undefined
> = {
  benzene: { rfc: 'pv-iris-benzene-hh-direct-rfc', iur: 'pv-hc-benzene-hh-direct-iur' },
  trichloroethylene: {
    rfc: 'pv-iris-trichloroethylene-hh-direct-rfc',
    iur: 'pv-iris-trichloroethylene-hh-direct-iur',
  },
  tetrachloroethylene: {
    rfc: 'pv-iris-tetrachloroethylene-hh-direct-rfc',
    iur: 'pv-iris-tetrachloroethylene-hh-direct-iur',
  },
};

const INHALATION_THRESHOLD_PARAMETER_VALUE_IDS = { hazardQuotient: 'pv-bc-csr-hi-target-ca', targetRisk: 'pv-hc-pqra-v4-2024-ilcr-target-ca' } as const;

export interface HHInhalationCalculatorProps {
  substanceKey?: string;
  jurisdiction?: Jurisdiction;
  className?: string;
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
}

export default function HHInhalationCalculator({
  substanceKey = DEFAULT_SUBSTANCE_KEY,
  jurisdiction = DEFAULT_JURISDICTION,
  className,
  onOpenEvidenceLibrary,
}: HHInhalationCalculatorProps) {
  const substance = findSubstance(substanceKey);

  // VF/PEF: ALWAYS blank on mount and on every substance change. Never seeded from any
  // source (owner ruling). Free-text so the user can paste a site-specific derivation.
  const [vfInput, setVfInput] = useState('');
  const [pefInput, setPefInput] = useState('');

  const [rfcInput, setRfcInput] = useState(
    substance?.rfc_inhalation_mg_per_m3 != null
      ? String(substance.rfc_inhalation_mg_per_m3)
      : '',
  );
  const [iurInput, setIurInput] = useState(
    substance?.iur_inhalation_per_mg_per_m3 != null
      ? String(substance.iur_inhalation_per_mg_per_m3)
      : '',
  );
  const [efInput, setEfInput] = useState(BASELINE_EF_DAYS);
  const [edInput, setEdInput] = useState(BASELINE_ED_YEARS);
  const [atCancerInput, setAtCancerInput] = useState(BASELINE_AT_CANCER_YEARS);
  const [targetRiskInput, setTargetRiskInput] = useState(BASELINE_TARGET_RISK);
  const [hazardQuotientInput, setHazardQuotientInput] = useState(BASELINE_HAZARD_QUOTIENT);

  // Re-seed RfC/IUR on substance change (same contract as HHDirectContactCalculator's
  // RfD/SF re-seed). VF/PEF are deliberately NOT touched here -- they stay whatever the
  // user has typed, or blank; a substance switch must never silently populate a
  // transport factor.
  useEffect(() => {
    const next = findSubstance(substanceKey);
    setRfcInput(
      next?.rfc_inhalation_mg_per_m3 != null ? String(next.rfc_inhalation_mg_per_m3) : '',
    );
    setIurInput(
      next?.iur_inhalation_per_mg_per_m3 != null
        ? String(next.iur_inhalation_per_mg_per_m3)
        : '',
    );
  }, [substanceKey]);

  const result: HumanHealthInhalationResult | { error: string } = useMemo(() => {
    const fields = {
      volatilization_factor_m3_per_kg: optionalPositiveInput(vfInput, 'Volatilization factor (VF)'),
      particulate_emission_factor_m3_per_kg: optionalPositiveInput(
        pefInput,
        'Particulate emission factor (PEF)',
      ),
      rfc_inhalation_mg_per_m3: optionalPositiveInput(rfcInput, 'RfC'),
      iur_inhalation_per_mg_per_m3: optionalPositiveInput(iurInput, 'IUR'),
      EF_days_per_year: positiveInput(efInput, 'Exposure frequency'),
      ED_years: positiveInput(edInput, 'Exposure duration'),
      AT_cancer_years: positiveInput(atCancerInput, 'Cancer averaging time'),
      targetRisk: positiveInput(targetRiskInput, 'Target risk'),
      hazardQuotient: positiveInput(hazardQuotientInput, 'Hazard quotient'),
    };

    for (const value of Object.values(fields)) {
      if (typeof value === 'object' && value !== null && 'error' in value) {
        return value;
      }
    }

    try {
      return deriveInhalationStandards(fields as HumanHealthInhalationInput);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [
    vfInput,
    pefInput,
    rfcInput,
    iurInput,
    efInput,
    edInput,
    atCancerInput,
    targetRiskInput,
    hazardQuotientInput,
  ]);

  const inhResult = 'error' in result ? null : result;

  // Exact-id provenance attribution (codex ship-gate P2, 2026-07-17): only attach the
  // catalog parameter_value_id while the input still equals the as-wired seed for a
  // substance the lookup table above knows about. A user edit (or a substance the
  // table has no entry for) falls back to a plain 'current calculator default' row --
  // never a stale/mismatched catalog attribution.
  const wiredToxicityIds = INHALATION_TOXICITY_PARAMETER_VALUE_IDS[substanceKey];
  const rfcSeed =
    substance?.rfc_inhalation_mg_per_m3 != null
      ? String(substance.rfc_inhalation_mg_per_m3)
      : null;
  const iurSeed =
    substance?.iur_inhalation_per_mg_per_m3 != null
      ? String(substance.iur_inhalation_per_mg_per_m3)
      : null;
  const rfcMatchesSeed =
    wiredToxicityIds != null && rfcSeed != null && rfcInput === rfcSeed;
  const iurMatchesSeed =
    wiredToxicityIds != null && iurSeed != null && iurInput === iurSeed;
  const hazardQuotientMatchesSeed = hazardQuotientInput === BASELINE_HAZARD_QUOTIENT;
  const targetRiskMatchesSeed = targetRiskInput === BASELINE_TARGET_RISK;
  // Effective input_key for the IUR provenance row (codex ship-gate P3, 2026-07-17):
  // switches to the catalog's real key ONLY while the exact-id attribution above is
  // active, so CalculatorProvenancePanel's "View alternatives" button (which filters by
  // row.input_key) opens the correct evidence-library filter instead of an
  // empty/misfiltered one. See the longer comment on the IUR row below.
  const iurEffectiveInputKey = iurMatchesSeed
    ? 'unit_risk_inhalation_per_ug_m3'
    : 'iur_inhalation_per_mg_per_m3';

  const provenanceValues: CalculatorUsedValue[] = useMemo(
    () => [
      {
        input_key: 'rfc_inhalation_mg_per_m3',
        label: 'Inhalation RfC (non-cancer)',
        value: rfcInput === '' ? null : rfcInput,
        unit: 'mg/m3',
        pathway: 'human-health-direct',
        substance_key: substanceKey,
        ...(rfcMatchesSeed && wiredToxicityIds
          ? {
              role: 'source-backed default' as const,
              parameter_value_id: wiredToxicityIds.rfc,
            }
          : { role: 'current calculator default' as const }),
      },
      {
        // This row's DEFAULT input_key/unit reflect THIS calculator's own per-mg/m3
        // IUR basis, not the catalog's native `unit_risk_inhalation_per_ug_m3` (per
        // ug/m3) key -- see the module header's unit-conversion note. The tuple
        // resolver therefore can never value-match this row to a catalog record on its
        // own; correct attribution relies entirely on the explicit parameter_value_id
        // below. iurEffectiveInputKey switches to the catalog's real key ONLY while
        // that attribution is active (see its definition above) so the "View
        // alternatives" button filters correctly instead of opening an empty view.
        input_key: iurEffectiveInputKey,
        label: 'Inhalation unit risk (cancer)',
        value: iurInput === '' ? null : iurInput,
        unit: 'per mg/m3',
        pathway: 'human-health-direct',
        substance_key: substanceKey,
        ...(iurMatchesSeed && wiredToxicityIds
          ? {
              role: 'source-backed default' as const,
              parameter_value_id: wiredToxicityIds.iur,
            }
          : { role: 'current calculator default' as const }),
      },
      {
        input_key: 'volatilization_factor_m3_per_kg',
        label: 'Volatilization factor (VF)',
        value: vfInput === '' ? null : vfInput,
        unit: 'm3/kg',
        role: 'user-entered value',
      },
      {
        input_key: 'particulate_emission_factor_m3_per_kg',
        label: 'Particulate emission factor (PEF)',
        value: pefInput === '' ? null : pefInput,
        unit: 'm3/kg',
        role: 'user-entered value',
      },
      {
        input_key: 'EF_days_per_year',
        label: 'Exposure frequency',
        value: efInput,
        unit: 'days/year',
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
        input_key: 'AT_cancer_years',
        label: 'Cancer averaging time',
        value: atCancerInput,
        unit: 'years',
        role: 'screening assumption',
      },
      {
        input_key: 'targetRisk',
        label: 'Target risk',
        value: targetRiskInput,
        ...(targetRiskMatchesSeed
          ? {
              role: 'source-backed default' as const,
              parameter_value_id: INHALATION_THRESHOLD_PARAMETER_VALUE_IDS.targetRisk,
            }
          : { role: 'screening assumption' as const }),
      },
      {
        input_key: 'hazardQuotient',
        label: 'Hazard quotient',
        value: hazardQuotientInput,
        ...(hazardQuotientMatchesSeed
          ? {
              role: 'source-backed default' as const,
              parameter_value_id: INHALATION_THRESHOLD_PARAMETER_VALUE_IDS.hazardQuotient,
            }
          : { role: 'screening assumption' as const }),
      },
    ],
    [
      atCancerInput,
      edInput,
      efInput,
      hazardQuotientInput,
      hazardQuotientMatchesSeed,
      iurEffectiveInputKey,
      iurInput,
      iurMatchesSeed,
      pefInput,
      rfcInput,
      rfcMatchesSeed,
      substanceKey,
      targetRiskInput,
      targetRiskMatchesSeed,
      vfInput,
      wiredToxicityIds,
    ],
  );

  return (
    <section
      data-testid="hh-inhalation-calculator"
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm${className ? ` ${className}` : ''}`}
    >
      <header className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Human Health Inhalation
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Screening value for inhalation of volatilized and windborne-particulate
          contaminant from sediment/soil. Requires a USER-SUPPLIED volatilization factor
          (VF) and/or particulate emission factor (PEF); this calculator never invents or
          defaults either.
        </p>
        {substance && (
          <p
            className="text-xs text-slate-500 dark:text-slate-400 mt-2"
            data-testid="hh-inhalation-substance-summary"
          >
            Active substance: <span className="font-semibold">{substance.displayName}</span>{' '}
            (class: {substance.contaminantClass}). Jurisdiction: {jurisdiction}.
          </p>
        )}
      </header>

      <div
        className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
        data-testid="hh-inhalation-vfpef-notice"
      >
        <span className="font-semibold">Fail-closed by design:</span> VF and PEF are not
        looked up or estimated by this tool. Supply a site- or chemical-specific value
        derived independently (e.g. EPA/540/R-96/018 Eq. 8 for VF, Eq. 5 for PEF, or an
        equivalent professional derivation) for at least one of the two fields below to
        unblock a result.
      </div>

      <div
        className="space-y-4 mb-6"
        data-testid="hh-inhalation-inputs-section"
        aria-label="Human Health Inhalation inputs"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Volatilization factor VF (m3/kg) -- user-supplied
            <input
              data-testid="hh-inhalation-vf-input"
              value={vfInput}
              onChange={(e) => setVfInput(e.target.value)}
              placeholder="Not supplied"
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Particulate emission factor PEF (m3/kg) -- user-supplied
            <input
              data-testid="hh-inhalation-pef-input"
              value={pefInput}
              onChange={(e) => setPefInput(e.target.value)}
              placeholder="Not supplied"
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            RfC (mg/m3, non-cancer)
            <input
              data-testid="hh-inhalation-rfc-input"
              value={rfcInput}
              onChange={(e) => setRfcInput(e.target.value)}
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            IUR (per mg/m3, cancer)
            <input
              data-testid="hh-inhalation-iur-input"
              value={iurInput}
              onChange={(e) => setIurInput(e.target.value)}
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Exposure frequency (days/yr)
            <input
              data-testid="hh-inhalation-ef-input"
              value={efInput}
              onChange={(e) => setEfInput(e.target.value)}
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Exposure duration (yr)
            <input
              data-testid="hh-inhalation-ed-input"
              value={edInput}
              onChange={(e) => setEdInput(e.target.value)}
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Cancer averaging time (yr)
            <input
              data-testid="hh-inhalation-at-cancer-input"
              value={atCancerInput}
              onChange={(e) => setAtCancerInput(e.target.value)}
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Target risk (unitless probability)
            <input
              data-testid="hh-inhalation-target-risk-input"
              value={targetRiskInput}
              onChange={(e) => setTargetRiskInput(e.target.value)}
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Hazard quotient (unitless)
            <input
              data-testid="hh-inhalation-hazard-quotient-input"
              value={hazardQuotientInput}
              onChange={(e) => setHazardQuotientInput(e.target.value)}
              className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"
            />
          </label>
        </div>
      </div>

      {'error' in result && (
        <div
          className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200 mb-6"
          data-testid="hh-inhalation-error"
        >
          {result.error}
        </div>
      )}

      {inhResult && inhResult.blocked ? (
        <div
          className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-6 text-center border border-slate-200 dark:border-slate-700 shadow-inner mb-6"
          data-testid="hh-inhalation-blocked"
        >
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-1">
            Inhalation pathway blocked
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            No standard is computed until the required transport factor (VF and/or PEF)
            and at least one toxicity value (RfC and/or IUR) are supplied.
          </p>
        </div>
      ) : (
        inhResult && (
          <div
            className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner mb-6"
            data-testid="hh-inhalation-preliminary-standard"
          >
            <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
              Preliminary Human Health Screening Value (Inhalation)
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
              {inhResult.sedS !== null ? inhResult.sedS.toPrecision(4) : '--'}{' '}
              <span className="text-lg text-slate-500 font-medium">mg/kg dry</span>
            </div>
            <div className="mt-3 inline-block px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              Driver: {inhResult.driver}
            </div>
            <p className="text-xs text-sky-700 dark:text-sky-400 mt-3 italic">
              Screening-grade value for options analysis; confirm the supplied VF/PEF and
              exposure assumptions before regulator-facing use.
            </p>
          </div>
        )
      )}

      <details
        className="group bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
        data-testid="hh-inhalation-technical-details"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 select-none flex items-center justify-between">
          <span>Technical details (formula + endpoint comparison)</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 group-open:hidden">show</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden group-open:inline">hide</span>
        </summary>
        <div className="px-4 py-4 space-y-4 border-t border-slate-200 dark:border-slate-800">
          <MathRenderer
            content={
              '$C_{air} = C_s \\cdot (1/VF + 1/PEF)$, $EC = C_{air} \\cdot EF \\cdot ED / (AT \\cdot 365)$. ' +
              'Non-cancer: $C_s = THQ \\cdot RfC \\cdot 365 / [(1/VF + 1/PEF) \\cdot EF]$ (AT = ED cancels). ' +
              'Cancer: $C_s = TR \\cdot AT_{cancer} \\cdot 365 / [(1/VF + 1/PEF) \\cdot EF \\cdot ED \\cdot IUR]$. ' +
              'The calculator solves for $C_s$ for the available endpoints and selects the ' +
              'lower (more protective) value. See EPA/540/R-96/018 (1996) Eq. 5 (PEF) and Eq. 8 (VF).'
            }
          />
          {inhResult && !inhResult.blocked && (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Non-cancer value</span>
                <span>{inhResult.nonCancerSedS?.toPrecision(4) ?? 'n/a'}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Cancer value</span>
                <span>{inhResult.cancerSedS?.toPrecision(4) ?? 'n/a'}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Combined VF/PEF transport factor</span>
                <span>
                  {inhResult.vfPefCombined_m3_per_kg !== null
                    ? `${inhResult.vfPefCombined_m3_per_kg.toPrecision(4)} m3/kg`
                    : 'n/a'}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Forward air-concentration check</span>
                <span>
                  {inhResult.airConcentration_mg_per_m3 !== null
                    ? `${inhResult.airConcentration_mg_per_m3.toPrecision(4)} mg/m3`
                    : 'n/a'}
                </span>
              </div>
            </div>
          )}
          {inhResult && inhResult.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
              <div className="font-semibold">Endpoint notes</div>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {inhResult.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
      <CalculatorProvenancePanel
        pathway="human-health-direct"
        // equationIds pinned to an EXPLICIT empty array (codex ship-gate P2,
        // 2026-07-17): CalculatorProvenancePanel falls back to
        // resolveEquationsForPathway(pathway) whenever equationIds is omitted, which
        // would pull in eq-human-health-direct-contact (the ingestion/dermal
        // equation) -- wrong for this inhalation pathway. The catalog has no
        // inhalation-specific equation entry yet (the VF/PEF discovery packet's
        // eq-human-health-inhalation-vf-infinite-source-chronic proposal was never
        // ingested -- VF/PEF stay user-supplied, not calculator-derived), so the
        // honest state is "no catalog equation to show" rather than a mismatched one.
        equationIds={[]}
        usedValues={provenanceValues}
        regulatoryFrameId={jurisdiction}
        onOpenEvidenceLibrary={onOpenEvidenceLibrary}
      />
    </section>
  );
}
