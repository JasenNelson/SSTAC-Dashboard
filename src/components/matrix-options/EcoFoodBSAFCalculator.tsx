'use client';

// Eco-Food (BSAF) sediment standard calculator.
// See .tmp_calculator_design_v1.md sections 2.2 + 5 + 8.2 + 8.4.
// v1 single-substance, single-receptor; MeHg uses the protein-normalized
// branch documented in design doc 2.2 / 8.3.
//
// PR-A2 commit 5 refactor (2026-05-19): substance + jurisdiction lifted to
// MatrixDashboard via SharedGlobalInputs; this calculator now accepts both
// as optional props with defaults sourced from canonical exports (same
// pattern as EcoDirectEqPCalculator commit 4). TRV + BSAF_loc reset
// contracts mirror EcoDirect's FCV contract per plan v3 section 4.6:
//   - useEffect re-seeds TRV on substanceKey change unless trvIsOverride
//   - useEffect re-seeds BSAF_loc on substanceKey change unless
//     bsafIsOverride
//   - User edit promotes the respective field to override; Reset clears it
// Layout per plan v3 section 1 (vertical flow): inputs -> error -> the
// prominent "Preliminary Toxicity-Based Standard" hero -> a Technical
// details <details> disclosure (collapsed by default).
//
// jurisdiction now carries the selected regulatory frame. It controls
// source hierarchy and value lookup eligibility. For the eco-food TRV, a
// reference-only or unsupported frame now suppresses the calculator input
// default (blank) instead of showing an unsupported static value; supported
// frames still seed from the catalog or the current default.
//
// Plain ASCII only.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { getEquation } from '@/lib/matrix-options/equationDispatch';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';
import { resolveEcoSeed, type EcoReceptor } from '@/lib/matrix-options/ecoSeed';
import {
  getPathwayApplicability,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';
import type {
  EcoFoodBSAFResult,
  Ecosystem,
} from '@/lib/matrix-options/types';
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

const ECOSYSTEM_OPTIONS: ReadonlyArray<{ value: Ecosystem; label: string }> = [
  { value: 'freshwater', label: 'Freshwater' },
  { value: 'estuarine', label: 'Estuarine' },
  { value: 'coastal-marine', label: 'Coastal-Marine' },
];

export interface EcoFoodBSAFCalculatorProps {
  // Optional with defaults to keep the existing MatrixDashboard call site
  // (`<EcoFoodBSAFCalculator />`) build-green between this commit and
  // commit 6 (MatrixDashboard wire-up). Commit 6 always passes explicit
  // values from lifted state; defaults remain a safety net for direct
  // renders in stories / debug pages.
  substanceKey?: string;
  jurisdiction?: Jurisdiction;
  className?: string;
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
}

// Eco-food TRVs are per-receptor (dose-based wildlife values). The receptor selector picks which
// catalog TRV row seeds; BW/IR stay user-adjustable (the catalog carries only TRVs, not receptor
// body weights / ingestion rates).
const RECEPTORS: readonly EcoReceptor[] = ['mammal', 'bird'];
const RECEPTOR_LABELS: Record<EcoReceptor, string> = {
  mammal: 'Mammal',
  bird: 'Bird',
};

interface TrvSeed {
  value: string;
  // Exact catalog row id when the seed came from the eco catalog (so provenance attributes the precise
  // per-receptor source row); null when it fell back to the substance library.
  parameterValueId: string | null;
  provisional: boolean;
}

// Resolve the TRV seed for (substance, frame, receptor): prefer the frame-aware, source-priority,
// provisional-gated eco catalog value (resolveEcoSeed). When it returns null, fall back to the
// substance-library TRV ONLY if the pathway is applicable for the frame; in reference_only /
// unsupported frames the static fallback is SUPPRESSED (blank) so a library current-default TRV
// cannot leak into a frame meant to read reference-only.
function computeTrvSeed(
  substanceKey: string,
  frameId: RegulatoryFrameId,
  receptor: EcoReceptor,
): TrvSeed {
  const seed = resolveEcoSeed(
    substanceKey,
    'eco-food-bsaf',
    'trv_eco_mg_per_kg_bw_day',
    frameId,
    receptor,
  );
  if (seed) {
    return {
      value: String(seed.value),
      parameterValueId: seed.parameterValueId,
      provisional: seed.provisional,
    };
  }
  // Suppress the static library fallback when the frame marks eco-food reference_only/unsupported
  // (mirrors resolveEcoSeed's own guard); no default should seed there.
  const status = getPathwayApplicability(frameId, 'eco-food-bsaf').status;
  if (status === 'reference_only' || status === 'unsupported') {
    return { value: '', parameterValueId: null, provisional: false };
  }
  const lib = findSubstance(substanceKey);
  return {
    value:
      lib?.trv_eco_mg_per_kg_bw_day != null
        ? String(lib.trv_eco_mg_per_kg_bw_day)
        : '',
    parameterValueId: null,
    provisional: false,
  };
}

export default function EcoFoodBSAFCalculator({
  substanceKey = DEFAULT_SUBSTANCE_KEY,
  jurisdiction = DEFAULT_JURISDICTION,
  className,
  onOpenEvidenceLibrary,
}: EcoFoodBSAFCalculatorProps) {
  const substance = findSubstance(substanceKey);

  const ecoFoodFrameStatus = useMemo(
    () => getPathwayApplicability(jurisdiction, 'eco-food-bsaf').status,
    [jurisdiction],
  );
  const isReferenceOnlyFrame =
    ecoFoodFrameStatus === 'reference_only' || ecoFoodFrameStatus === 'unsupported';

  // Ecosystem selector (default freshwater per design doc 2.2). LOCAL.
  const [ecosystem, setEcosystem] = useState<Ecosystem>('freshwater');
  const ecosystemRefs = useRef<Record<Ecosystem, HTMLButtonElement | null>>({
    freshwater: null,
    estuarine: null,
    'coastal-marine': null,
  });

  const handleEcosystemKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentVal: Ecosystem,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setEcosystem(currentVal);
      return;
    }
    const navKeys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!navKeys.includes(event.key)) return;
    event.preventDefault();

    const options = ECOSYSTEM_OPTIONS.map((o) => o.value);
    const currentIdx = options.indexOf(currentVal);
    const safeIdx = currentIdx === -1 ? 0 : currentIdx;
    let nextIdx = safeIdx;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIdx = (safeIdx + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIdx = (safeIdx - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = options.length - 1;
    }

    const nextVal = options[nextIdx];
    setEcosystem(nextVal);
    ecosystemRefs.current[nextVal]?.focus();
  };

  // Receptor inputs: default to mink piscivore (design doc 2.2 inputs table). LOCAL.
  const [bwInput, setBwInput] = useState<string>('0.85');
  const [irInput, setIrInput] = useState<string>('0.18');

  // fLipid as percent (default 5%, screening window 1 - 15%). LOCAL.
  const [fLipidPercent, setFLipidPercent] = useState<number>(5);
  // foc as percent. Design doc section 2.2 sets default = 0.01 (1.0 %).
  // codex P2 2026-05-19 round 2 caught the prior 2 % default. LOCAL.
  const [focPercent, setFocPercent] = useState<number>(1);
  // F_site (default 1.0 resident; 0.2 quick-set for anadromous salmon). LOCAL.
  const [fsiteInput, setFsiteInput] = useState<string>('1.0');

  // Receptor selector for the per-receptor eco-food TRV (eco-wiring Step 5). availableReceptors = the
  // receptors that have a frame-eligible catalog TRV for this substance; the dropdown only offers
  // those. When none exist, TRV falls back to the substance-library value (legacy behavior).
  const availableReceptors = useMemo(
    () =>
      RECEPTORS.filter(
        (r) =>
          resolveEcoSeed(
            substanceKey,
            'eco-food-bsaf',
            'trv_eco_mg_per_kg_bw_day',
            jurisdiction,
            r,
          ) !== null,
      ),
    [substanceKey, jurisdiction],
  );

  const [receptor, setReceptor] = useState<EcoReceptor>('mammal');

  // Snap the receptor to an available one when the current selection has no catalog TRV for this
  // (substance, frame) but others do (e.g. a bird-only substance). Converges in one extra render.
  useEffect(() => {
    if (
      availableReceptors.length > 0 &&
      !availableReceptors.includes(receptor)
    ) {
      setReceptor(availableReceptors[0]);
    }
  }, [availableReceptors, receptor]);

  // TRV seed for the CURRENT (substance, frame, receptor): prefer the provisional eco catalog value,
  // else the substance-library TRV. BSAF stays library-seeded (MVP seeds fcv + trv only; fLipid/foc/
  // BSAF remain user-entered until source-backed catalog rows exist).
  const trvSeed = useMemo(
    () => computeTrvSeed(substanceKey, jurisdiction, receptor),
    [substanceKey, jurisdiction, receptor],
  );

  // TRV + BSAF reset contract (plan v3 section 4.6). Both fields follow the same override pattern:
  // user edit promotes to override; Reset clears it. TRV re-seeds on substance/frame/receptor change;
  // BSAF re-seeds on substance change. Both only while their override flag is false.
  const [trvInput, setTrvInput] = useState<string>(() => trvSeed.value);
  const [trvIsOverride, setTrvIsOverride] = useState<boolean>(false);

  const [bsafInput, setBsafInput] = useState<string>(
    substance?.bsaf_loc_freshwater != null
      ? String(substance.bsaf_loc_freshwater)
      : '',
  );
  const [bsafIsOverride, setBsafIsOverride] = useState<boolean>(false);

  useEffect(() => {
    if (trvIsOverride) return;
    setTrvInput(trvSeed.value);
  }, [trvSeed, trvIsOverride]);

  useEffect(() => {
    if (bsafIsOverride) return;
    const next = findSubstance(substanceKey);
    setBsafInput(
      next?.bsaf_loc_freshwater != null
        ? String(next.bsaf_loc_freshwater)
        : '',
    );
  }, [substanceKey, bsafIsOverride]);

  const handleTrvInput = (next: string): void => {
    setTrvInput(next);
    setTrvIsOverride(true);
  };

  const handleResetTrv = (): void => {
    setTrvIsOverride(false);
  };

  const handleBsafInput = (next: string): void => {
    setBsafInput(next);
    setBsafIsOverride(true);
  };

  const handleResetBsaf = (): void => {
    setBsafIsOverride(false);
  };

  const handleAnadromousQuickSet = () => {
    setFsiteInput('0.2');
  };
  const handleResidentQuickSet = () => {
    setFsiteInput('1.0');
  };

  // Resolve the equation for the selected regulatory frame (empty FRAME_VARIANTS
  // -> baseline + usedBaselineFallback: true). Call site below is unchanged.
  const { run: ecoFoodBSAF, usedBaselineFallback, fallbackReason } = useMemo(
    () => getEquation(jurisdiction, 'eco-food-bsaf'),
    [jurisdiction],
  );

  const result: EcoFoodBSAFResult | { error: string } | null = useMemo(() => {
    if (!substance) {
      return { error: 'No substance selected.' };
    }
    // Relaxed BSAF gate (eco-wiring Step 5), SCOPED to catalog-backed substances. The legacy
    // "no freshwater BSAF -> path not applicable" block is kept for substances that have NEITHER a
    // library BSAF NOR a frame-eligible catalog TRV driving the calc (e.g. a metal under a frame whose
    // eco-food TRV jurisdiction is ineligible). Only when a catalog TRV seeded this slot
    // (trvSeed.parameterValueId != null) do we allow a site-specific BSAF to drive a computation.
    if (
      substance.bsaf_loc_freshwater === null &&
      trvSeed.parameterValueId === null
    ) {
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
    // Relaxed BSAF gate (eco-wiring Step 5): a null-library-BSAF substance is no longer hard-blocked
    // up front -- a catalog-seeded TRV can compute once the user supplies a site-specific BSAF. The
    // error only fires when BSAF is actually missing/invalid, and is context-aware for null-library
    // substances.
    const bsafParse = parseDecimalInput(bsafInput, { allowNegative: false });
    if (bsafParse.state !== 'valid' || bsafParse.value <= 0) {
      return {
        error:
          substance.bsaf_loc_freshwater === null
            ? 'Enter a site-specific BSAF_loc to compute (this substance has no library BSAF; the AVS/SEM path is out of scope in v1).'
            : 'BSAF_loc must be a positive decimal number.',
      };
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
    trvSeed,
    trvInput,
    bwInput,
    irInput,
    bsafInput,
    fLipidPercent,
    focPercent,
    fsiteInput,
    ecosystem,
    ecoFoodBSAF,
  ]);

  const isResult = result !== null && !('error' in result);
  const ecoResult = isResult ? (result as EcoFoodBSAFResult) : null;
  const provenanceValues: CalculatorUsedValue[] = useMemo(
    () => [
      {
        input_key: 'trv_eco_mg_per_kg_bw_day',
        label: 'Ecological TRV',
        value: trvInput === '' ? null : trvInput,
        unit: 'mg/kg-bw/day',
        role: trvIsOverride
          ? 'user-entered value'
          : trvSeed.parameterValueId
            ? 'source-backed default'
            : 'current calculator default',
        pathway: 'eco-food-bsaf',
        substance_key: substanceKey,
        // Attribute to the EXACT per-receptor eco catalog row when the (non-override) seed came from
        // the catalog; else no id (library fallback -> resolver value-aware tuple match).
        parameter_value_id:
          !trvIsOverride && trvSeed.parameterValueId
            ? trvSeed.parameterValueId
            : undefined,
        note: trvIsOverride
          ? 'User-edited TRV. Catalog source row remains visible for comparison.'
          : trvSeed.provisional && trvSeed.parameterValueId
            ? `Provisional eco TRV (${RECEPTOR_LABELS[receptor]} receptor) -- needs_review catalog candidate, not yet HITL-verified.`
            : undefined,
      },
      {
        input_key: 'bsaf_loc_freshwater',
        label: 'Local BSAF',
        value: bsafInput === '' ? null : bsafInput,
        role: bsafIsOverride
          ? 'user-entered value'
          : 'current calculator default',
        pathway: 'eco-food-bsaf',
        substance_key: substanceKey,
        note: bsafIsOverride
          ? 'User-edited BSAF. Catalog source row remains visible for comparison.'
          : undefined,
      },
      {
        input_key: 'BW_eco_kg',
        label: 'Body weight',
        value: bwInput === '' ? null : bwInput,
        unit: 'kg',
        role: 'screening assumption',
        note: 'Receptor input. Current default represents a mink piscivore screen.',
      },
      {
        input_key: 'IR_eco_kg_per_day',
        label: 'Ingestion rate',
        value: irInput === '' ? null : irInput,
        unit: 'kg-wet/day',
        role: 'screening assumption',
        note: 'Receptor input. Current default represents a mink daily diet screen.',
      },
      {
        input_key: 'fLipid',
        label: 'Tissue lipid fraction',
        value: fLipidPercent.toFixed(2),
        unit: '%',
        role: 'user-entered value',
      },
      {
        input_key: 'foc',
        label: 'Sediment organic carbon',
        value: focPercent.toFixed(2),
        unit: '%',
        role: 'user-entered value',
      },
      {
        input_key: 'Fsite',
        label: 'Site-use fraction',
        value: fsiteInput === '' ? null : fsiteInput,
        role: 'screening assumption',
        note: `Current ecosystem: ${ecosystem}.`,
      },
    ],
    [
      bsafInput,
      bsafIsOverride,
      bwInput,
      ecosystem,
      fLipidPercent,
      focPercent,
      fsiteInput,
      irInput,
      receptor,
      substanceKey,
      trvInput,
      trvIsOverride,
      trvSeed,
    ],
  );

  return (
    <section
      data-testid="eco-food-bsaf-calculator"
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm${className ? ` ${className}` : ''}`}
    >
      <header className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Eco-Food (BSAF) -- Wildlife consumers (bird/mammal)
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Back-calculated sediment benchmark via the lipid+OC-normalized
          BSAF pathway (design doc section 2.2). MeHg uses the
          protein-normalized branch (design doc section 8.3); coastal-marine
          PAH bivalves apply the x15 multiplier (design doc section 8.2);
          anadromous salmonids default F_site = 0.2 (design doc section 8.4).
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Dietary-dose pathway for wildlife consumers (bird / mammal receptors).
          Fish here is BSAF prey, not a protected receptor. For aquatic life
          (fish, invertebrates, aquatic plants) use the Eco-Direct (EqP) pathway.
        </p>
        {substance && (
          <p
            className="text-xs text-slate-500 dark:text-slate-400 mt-2"
            data-testid="ecofood-substance-summary"
          >
            Active substance: <span className="font-semibold">{substance.displayName}</span>{' '}
            (class: {substance.contaminantClass}).
          </p>
        )}
      </header>

      <FrameImpactCard
        frameId={jurisdiction}
        pathway="eco-food-bsaf"
        usedBaselineFallback={usedBaselineFallback}
        fallbackReason={fallbackReason}
      />

      {/*
        Layout per plan v3 section 1 vertical flow: inputs -> error
        -> Preliminary Toxicity-Based Standard hero -> Technical details
        disclosure. Same pattern as EcoDirectEqPCalculator commit 4.
      */}

      {/* 1. INPUTS section */}
      <div
        className="space-y-4 mb-6"
        data-testid="ecofood-inputs-section"
        aria-label="Eco-Food BSAF inputs"
      >
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
                ref={(el) => {
                  ecosystemRefs.current[opt.value] = el;
                }}
                type="button"
                role="radio"
                aria-checked={ecosystem === opt.value}
                tabIndex={ecosystem === opt.value ? 0 : -1}
                onClick={() => setEcosystem(opt.value)}
                onKeyDown={(e) => handleEcosystemKeyDown(e, opt.value)}
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

        {availableReceptors.length >= 1 && (
          <div data-testid="ecofood-receptor">
            <label
              htmlFor="ecofood-receptor-select"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Wildlife receptor (TRV basis)
            </label>
            <select
              id="ecofood-receptor-select"
              data-testid="ecofood-receptor-select"
              value={receptor}
              onChange={(e) => setReceptor(e.target.value as EcoReceptor)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {availableReceptors.map((r) => (
                <option key={r} value={r}>
                  {RECEPTOR_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Selects which per-receptor eco-TRV catalog value seeds TRV_eco below. Body weight and
              ingestion rate stay adjustable.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            F_site (fraction, 0-1)
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="ecofood-trv"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                TRV_eco (mg/kg-bw/day)
              </label>
              {trvIsOverride && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                  data-testid="ecofood-trv-override-badge"
                >
                  User override
                </span>
              )}
              {!trvIsOverride &&
                trvSeed.provisional &&
                trvSeed.parameterValueId && (
                  <>
                    <span
                      id="ecofood-trv-provisional-desc"
                      className="sr-only"
                    >
                      Seeded from a needs_review eco catalog candidate; not yet HITL-verified.
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800"
                      data-testid="ecofood-trv-provisional-badge"
                      title="Seeded from a needs_review eco catalog candidate; not yet HITL-verified."
                      aria-describedby="ecofood-trv-provisional-desc"
                    >
                      Provisional -- needs review
                    </span>
                  </>
                )}
            </div>
            <input
              id="ecofood-trv"
              type="number"
              inputMode="decimal"
              step="0.0001"
              value={trvInput}
              onChange={(e) => handleTrvInput(e.target.value)}
              data-testid="ecofood-trv-input"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seeded from the eco catalog (provisional, per receptor) or the
                substance library; HITL overrides.
              </p>
              {trvIsOverride && (
                <button
                  type="button"
                  onClick={handleResetTrv}
                  data-testid="ecofood-trv-reset"
                  className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-200 underline underline-offset-2"
                >
                  Reset to frame default
                </button>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="ecofood-bsaf"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                BSAF_loc (freshwater)
              </label>
              {bsafIsOverride && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                  data-testid="ecofood-bsaf-override-badge"
                >
                  User override
                </span>
              )}
            </div>
            <input
              id="ecofood-bsaf"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={bsafInput}
              onChange={(e) => handleBsafInput(e.target.value)}
              data-testid="ecofood-bsaf-input"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                MeHg uses protein-normalized BSAF directly.
              </p>
              {bsafIsOverride && (
                <button
                  type="button"
                  onClick={handleResetBsaf}
                  data-testid="ecofood-bsaf-reset"
                  className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-200 underline underline-offset-2"
                >
                  Reset to frame default
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. ERROR box */}
      {result && 'error' in result && (
        <div
          className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-800 dark:text-rose-200 mb-6"
          data-testid="ecofood-error"
        >
          {result.error}
        </div>
      )}

      {/* 3. PRELIMINARY TOXICITY-BASED STANDARD hero */}
      {isReferenceOnlyFrame && (
        <div
          data-testid="ecofood-reference-only-notice"
          role="note"
          className="mb-6 border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 rounded-lg p-3 text-sm"
        >
          {trvIsOverride
            ? "Diagnostic only: this result is computed from your manually entered wildlife dietary TRV under a reference-only/unsupported regulatory frame. It is NOT a frame-supported standard."
            : "Reference-only under the selected regulatory frame: no frame-supported default is seeded for the BSAF pathway. Any value shown is for reference/diagnostic use only."}
        </div>
      )}
      {ecoResult && ecoResult.blocked && (
        <div
          data-testid="ecofood-blocked-notice"
          role="note"
          className="mb-6 border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 rounded-lg p-3 text-sm"
        >
          <span className="font-semibold">Diagnostic only:</span>{' '}
          {ecoResult.warnings.length === 1 ? (
            ecoResult.warnings[0]
          ) : (
            <ul className="list-disc pl-5 space-y-1 mt-1">
              {ecoResult.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div
        className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner mb-6"
        data-testid="ecofood-preliminary-standard"
        aria-label="Preliminary Toxicity-Based Standard (Eco-Food BSAF)"
      >
        <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
          Preliminary Toxicity-Based Standard (Eco-Food BSAF)
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
        <p className="text-xs text-sky-700 dark:text-sky-400 mt-3 italic">
          Preliminary -- not a final standard. HITL professional judgment +
          Background Adjustment apply downstream.
        </p>
      </div>

      {/* 4. TECHNICAL DETAILS disclosure */}
      <details
        className="group bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
        data-testid="ecofood-technical-details"
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
              'Formula: $SedS_{eco\\text{-}food} = \\dfrac{TRV_{eco} \\cdot ' +
              'BW_{eco}}{IR_{eco} \\cdot BSAF_{effective} \\cdot F_{site}}$, ' +
              'with $BSAF_{effective} = BSAF_{loc} \\cdot (f_{lipid} / f_{oc}) ' +
              '\\cdot M_{eco}$ (MeHg path skips lipid normalization).'
            }
          />

          {ecoResult && (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-lg p-4 space-y-2 text-sm">
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

          {ecoResult && ecoResult.warnings.length > 0 && (
            <div
              className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 space-y-2"
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
      </details>

      <CalculatorProvenancePanel
        pathway="eco-food-bsaf"
        usedValues={provenanceValues}
        regulatoryFrameId={jurisdiction}
        onOpenEvidenceLibrary={onOpenEvidenceLibrary}
      />
    </section>
  );
}
