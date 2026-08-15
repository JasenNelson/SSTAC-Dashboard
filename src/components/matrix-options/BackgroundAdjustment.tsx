'use client';

// Background Adjustment -- UTL_{95/95} for Provincial + Regional reference sets.
// Reframed from Tier 0 UTL pre-screen 2026-05-19: BC CSR applies the UTL as a
// post-derivation adjustment to the Tier 1 generic standard so naturally-
// elevated background concentrations are not forced into remediation. The
// Olsgard et al. / ACFN pre-screen pattern is for jurisdictions without
// protocol-derived standards and does not apply to BC CSR.
//
// Math (utl9595 + lookupK9595) is unchanged from the prior Tier 0 component.
//
// Step 4 of the Calculator redesign (DESIGN.md "The calculator produces an
// adjusted standard, not a verdict"): this component renders Stages 3 and 4
// of the FOUR-stage derivation sequence -- Background Reference (3) and
// Adjusted Standard (4) -- wrapped in CalculatorStage. (Corrected 2026-08-14,
// adversarial UI QA audit fix 3/P2-4/P2-7: the derivation is Stages 1-2 in
// the active pathway calculator plus Stages 3-4 here, FOUR stages total, not
// five -- "Site Comparison" below is NOT part of the derivation; see its own
// comment near its render.) Stage 3 is mathematically independent of Stages
// 1-2 (the UTL depends only on the reference samples), so it computes even
// when the caller's preliminary standard is invalid or not yet available;
// only Stage 4's max() waits on it. No calculation, coefficient, rounding
// rule, or displayed numeric value from the prior single-panel version has
// changed -- this is a presentation wrap plus the Stage 4 max() comparison,
// which uses only the two operands already computed elsewhere (the
// caller-supplied preliminary standard and this component's own utl9595
// result).
//
// Site Comparison caution (see report): the Cs comparison below is
// UNCHANGED -- it still compares the measured site concentration against the
// background UTL only, exactly as the prior version did. DESIGN.md describes
// the eventual comparison as against the ADJUSTED standard, but rewiring it
// would change the displayed outcome whenever the preliminary standard
// governs (Cs values between the UTL and the higher preliminary standard
// would flip from "exceeds" to "within standard"). That is a behavioural
// change to a regulatory comparison, so it is intentionally NOT made here;
// it is reported for owner sign-off instead of applied silently. It is also
// no longer numbered as "Stage 5" -- the owner has stated a measured site
// concentration does not belong in this standards-derivation tool at all, so
// it is kept, pending that decision, as an unnumbered block.
//
// Plain ASCII only.

import React, { useEffect, useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { utl9595 } from '@/lib/matrix-options/derivations';
import {
  DECIMAL_NUMBER_RE,
  parseDecimalInput,
} from '@/lib/matrix-options/parseDecimal';
import { formatMagnitude } from '@/lib/matrix-options/formatMagnitude';
import type {
  CalculatorUsedValue,
  EvidenceLibraryFilterRequest,
} from '@/lib/matrix-options/provenance/types';
import CalculatorProvenancePanel from './CalculatorProvenancePanel';
import RegulatoryFrameNotice from './RegulatoryFrameNotice';
import CalculatorStage, {
  STAGE_STATE_LABELS,
  StageStateChip,
  type StageState,
} from './CalculatorStage';
import {
  DEFAULT_JURISDICTION,
  type Jurisdiction,
} from './guide/content/jurisdictions';

interface ParseResult {
  samples: number[];
  rejected: string[];
}

function parseSamples(raw: string): ParseResult {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const samples: number[] = [];
  const rejected: string[] = [];
  tokens.forEach((tok) => {
    if (!DECIMAL_NUMBER_RE.test(tok)) {
      rejected.push(tok);
      return;
    }
    const n = Number(tok);
    if (!Number.isFinite(n) || n < 0) {
      rejected.push(tok);
      return;
    }
    samples.push(n);
  });
  return { samples, rejected };
}

type Scope = 'provincial' | 'regional';

const PROVINCIAL_DEFAULT_SAMPLES =
  '4.8, 5.1, 4.9, 5.3, 4.7, 5.0, 5.2, 4.6, 5.4, 5.0';
const REGIONAL_DEFAULT_SAMPLES = '5.7, 5.9, 5.5, 5.8, 6.0, 5.6, 5.9, 5.7';

const TOTAL_STAGES = 4;

// Fix 3 (P2-4/P2-7): the derivation is Stage 1 (exposure factors) + Stage 2
// (preliminary standard), both inside the active pathway calculator, then
// Stage 3 (background reference) + Stage 4 (adjusted standard) here. The
// former Stage 5 "Site Comparison" is NOT a stage of the derivation -- the
// owner has stated a measured site concentration does not belong in this
// tool at all -- so it is kept (pending an owner decision) as an unnumbered
// block below, not wrapped in CalculatorStage.

// Fix 2 (P2-1): the unit BackgroundAdjustment reports for the UTL. Matches
// the preliminary/adjusted standard's 'mg/kg dry' default so the same
// physical quantity is not shown with two different unit strings across the
// summary bar (it used to be a bare 'mg/kg' here vs 'mg/kg dry' elsewhere).
const UTL_UNIT = 'mg/kg dry';

// Fix 2 (P2-A, REVERTED 2026-08-14 third adversarial round): 'mg/kg' is NOT
// an equivalent spelling of 'mg/kg dry' in this codebase -- it is the
// WET-WEIGHT TISSUE basis used elsewhere in this feature (see
// HHFoodWebCalculator.tsx tissueTarget_mg_per_kg, rendered as 'mg/kg').
// The original justification for aliasing them here was that this
// component's OWN inputs printed the bare 'mg/kg' string; that justification
// no longer holds -- every one of those inputs was relabelled to
// 'mg/kg dry' in the same commit that added this alias (see the UTL_UNIT
// comment above and the preliminary/adjusted-standard unit strings below).
// With the alias in place, a future caller that reports a tissue value in
// 'mg/kg' (wet weight) would silently PASS this guard, and
// max(tissue mg/kg wet, sediment mg/kg dry) would render as an adjusted
// sediment standard with no warning -- exactly the error this guard exists
// to catch. So only genuinely equal unit strings (after trim/case
// normalization) pass; 'mg/kg' and 'mg/kg dry' are treated as different
// units, as they are.
function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

// The preliminary standard from an earlier pathway calculator's own Stage 2
// (or equivalent), as reported via that calculator's onPreliminaryStandardChange
// callback. Stage 4 below never recomputes this -- it only reads value/unit/state
// and takes max() against the UTL already computed in Stage 3.
export interface BackgroundAdjustmentPreliminaryStandard {
  value: number | null;
  unit: string;
  state: StageState;
  /** e.g. "Preliminary standard (HH Food Web)". Defaults to a generic label. */
  label?: string;
}

// Reports Stage 3's UTL result upward (e.g. to the Calculator tab summary
// bar) so a parent can display it without recomputing anything.
export interface BackgroundUtlReport {
  value: number | null;
  unit: string;
  state: StageState;
  scope: Scope;
  n: number;
}

// Reports Stage 4's adjusted-standard result upward. value is
// Math.max(preliminary, utl) -- a plain comparison of the two operands
// already computed elsewhere, never a new derivation.
export interface AdjustedStandardReport {
  value: number | null;
  unit: string;
  state: StageState;
  governedBy: 'preliminary' | 'background' | null;
}

interface BackgroundAdjustmentProps {
  jurisdiction?: Jurisdiction;
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
  /** Stage 4's other operand. Omitted/undefined is treated as unavailable (Stage 4 waits). */
  preliminaryStandard?: BackgroundAdjustmentPreliminaryStandard;
  onUtlChange?: (report: BackgroundUtlReport) => void;
  onAdjustedStandardChange?: (report: AdjustedStandardReport) => void;
}

export default function BackgroundAdjustment({
  jurisdiction = DEFAULT_JURISDICTION,
  onOpenEvidenceLibrary,
  preliminaryStandard,
  onUtlChange,
  onAdjustedStandardChange,
}: BackgroundAdjustmentProps) {
  // Persist BOTH reference sample sets so flipping the Scope radio does not
  // lose the user's work (UX choice 2026-05-19 -- single-textarea + scope-radio
  // option, with both sets preserved internally).
  const [scope, setScope] = useState<Scope>('provincial');
  const [provincialSamples, setProvincialSamples] = useState<string>(
    PROVINCIAL_DEFAULT_SAMPLES,
  );
  const [regionalSamples, setRegionalSamples] = useState<string>(
    REGIONAL_DEFAULT_SAMPLES,
  );
  const [csInput, setCsInput] = useState<string>('');

  const activeSamples =
    scope === 'provincial' ? provincialSamples : regionalSamples;
  const setActiveSamples =
    scope === 'provincial' ? setProvincialSamples : setRegionalSamples;

  const parsed = useMemo(() => parseSamples(activeSamples), [activeSamples]);

  const utlResult = useMemo(() => {
    if (parsed.samples.length < 2) return null;
    try {
      return utl9595(parsed.samples);
    } catch {
      return null;
    }
  }, [parsed.samples]);

  // Cs input parse delegates to parseDecimalInput for the discriminated
  // blank / invalid / negative / valid state. Same pattern as Tier 1
  // calculators (codex hardening from prior slices).
  const csParseResult = parseDecimalInput(csInput, { allowNegative: false });
  const csIsBlank = csParseResult.state === 'blank';
  const csIsInvalid = csParseResult.state === 'invalid';
  const csIsNegative = csParseResult.state === 'negative';
  const csIsValid = csParseResult.state === 'valid';
  const csParsed = csParseResult.value;

  // Comparison of measured Cs against the background UTL for the active
  // scope -- diagnostic only; does NOT determine compliance. The operative
  // BC CSR comparison is against `max(Tier 1 generic, UTL)`, derived elsewhere.
  // UNCHANGED per the Stage 5 caution above -- still Cs vs UTL, not Cs vs the
  // new Stage 4 adjusted standard.
  const csAtOrBelowBackground: boolean | null = useMemo(() => {
    if (!utlResult || !csIsValid) return null;
    return csParsed <= utlResult.utl;
  }, [utlResult, csIsValid, csParsed]);

  const scopeLabel = scope === 'provincial' ? 'Provincial' : 'Regional';
  const scopeDescription =
    scope === 'provincial'
      ? 'BC province-wide reference set (fallback when regional reference data is unavailable).'
      : 'Site-specific regional reference set (preferred over Provincial where geochemical equivalence is met -- Phase 2 Paper App D.4).';

  // ---------------------------------------------------------------------
  // Stage 3 -- Background Reference. Independent of Stages 1-2: computes
  // from the reference samples alone, so it is never WAITING.
  // ---------------------------------------------------------------------
  const stage3Blocked = parsed.rejected.length > 0;
  const stage3State: StageState = utlResult
    ? 'computed'
    : stage3Blocked
      ? 'blocked'
      : 'pending';
  const stage3Detail = utlResult
    ? `UTL 95/95 computed from n = ${utlResult.n} ${scopeLabel.toLowerCase()} reference samples.`
    : stage3Blocked
      ? `Rejected non-numeric tokens: ${parsed.rejected.join(', ')}. Fix the reference samples below.`
      : 'Provide at least 2 numeric reference samples to compute the UTL.';

  // ---------------------------------------------------------------------
  // Stage 4 -- Adjusted Standard = max(preliminary, UTL). WAITING whenever
  // either operand is unavailable; a plain comparison of two numbers
  // already computed, never a new derivation.
  // ---------------------------------------------------------------------
  const preliminaryValue = preliminaryStandard?.value ?? null;
  const preliminaryState: StageState = preliminaryStandard?.state ?? 'pending';
  const preliminaryLabel = preliminaryStandard?.label ?? 'Preliminary standard';
  const preliminaryAvailable =
    preliminaryState === 'computed' && preliminaryValue != null;
  const utlAvailable = stage3State === 'computed' && utlResult != null;
  const adjustedUnit = preliminaryStandard?.unit ?? 'mg/kg dry';

  // Fix 2 (P2-1) guard: the UTL's unit (UTL_UNIT) and the preliminary
  // standard's caller-supplied unit must agree before max() is taken.
  // Every current caller passes 'mg/kg dry' for both, so this never trips
  // today -- it exists to REFUSE (not silently mis-max) a future caller
  // that reports a different unit, since adjustedUnit is otherwise taken
  // unconditionally from the preliminary side and would make a wrong
  // comparison look correct.
  const unitsMismatched =
    preliminaryAvailable &&
    utlAvailable &&
    normalizeUnit(preliminaryStandard!.unit) !== normalizeUnit(UTL_UNIT);

  const stage4State: StageState = unitsMismatched
    ? 'blocked'
    : preliminaryAvailable && utlAvailable
      ? 'computed'
      : 'waiting';

  const adjustedValue: number | null =
    !unitsMismatched && preliminaryAvailable && utlAvailable
      ? Math.max(preliminaryValue as number, (utlResult as NonNullable<typeof utlResult>).utl)
      : null;

  const governedBy: 'preliminary' | 'background' | null =
    adjustedValue === null
      ? null
      : (preliminaryValue as number) >= (utlResult as NonNullable<typeof utlResult>).utl
        ? 'preliminary'
        : 'background';

  const stage4MissingReasons: string[] = [];
  if (!preliminaryAvailable) {
    stage4MissingReasons.push(
      preliminaryStandard
        ? `the preliminary standard (currently ${STAGE_STATE_LABELS[preliminaryState]})`
        : 'the preliminary standard (not connected to this pathway yet)',
    );
  }
  if (!utlAvailable) {
    stage4MissingReasons.push('the background UTL 95/95 from Stage 3 above');
  }
  const stage4UnitMismatchDetail = unitsMismatched
    ? `Blocked: the preliminary standard's unit (${preliminaryStandard!.unit}) does not match ` +
      `the background UTL's unit (${UTL_UNIT}). max() cannot be taken across mismatched units -- ` +
      `fix the unit before an adjusted standard can be computed.`
    : null;
  const stage4Detail = stage4UnitMismatchDetail
    ? stage4UnitMismatchDetail
    : stage4State === 'computed'
      ? `Adjusted standard = max(preliminary, UTL) = ${formatMagnitude(adjustedValue as number)} ${adjustedUnit}.`
      : `Waiting on ${stage4MissingReasons.join(' and ')}.`;

  const governingSentence: string =
    adjustedValue === null || governedBy === null || !utlResult
      ? ''
      : governedBy === 'background'
        ? `Which one governed: the background UTL 95/95 (${formatMagnitude(utlResult.utl)} ${UTL_UNIT}) governs, ` +
          `because it exceeds the preliminary standard (${formatMagnitude(preliminaryValue as number)} ${adjustedUnit}). ` +
          `Adjusted standard = max(${formatMagnitude(preliminaryValue as number)}, ${formatMagnitude(utlResult.utl)}) = ` +
          `${formatMagnitude(adjustedValue)} ${adjustedUnit}. In plain terms, the risk-based preliminary standard sits ` +
          `below what already occurs naturally in this ${scopeLabel.toLowerCase()} reference set, so the adjusted ` +
          `standard uses background instead of forcing remediation of naturally occurring background.`
        : `Which one governed: the preliminary standard (${formatMagnitude(preliminaryValue as number)} ${adjustedUnit}) governs, ` +
          `because it is at or above the background UTL 95/95 (${formatMagnitude(utlResult.utl)} ${UTL_UNIT}). ` +
          `Adjusted standard = max(${formatMagnitude(preliminaryValue as number)}, ${formatMagnitude(utlResult.utl)}) = ` +
          `${formatMagnitude(adjustedValue)} ${adjustedUnit}.`;

  // ---------------------------------------------------------------------
  // Site Comparison -- NOT a derivation stage (fix 3/P2-4/P2-7; see the
  // file header comment). Presentation-only wrap of the EXISTING Cs-vs-UTL
  // comparison (see the Site Comparison caution in the file header). Fix 4
  // (P3-D, 2026-08-14): renamed from stage5State/stage5Detail (and the
  // matching bg-adjust-stage-5* testids below) -- "stage 5" no longer
  // denotes a stage number anywhere, including the DOM/test contract, so the
  // block is named for what it IS: the site comparison.
  // ---------------------------------------------------------------------
  const siteComparisonState: StageState = csIsInvalid || csIsNegative
    ? 'blocked'
    : csIsBlank
      ? 'pending'
      : utlResult
        ? 'computed'
        : 'waiting';
  const siteComparisonDetail = csIsInvalid
    ? 'Blocked: the measured site concentration is not a valid decimal number.'
    : csIsNegative
      ? 'Blocked: the measured site concentration cannot be negative.'
      : csIsBlank
        ? 'No measured site concentration entered yet -- optional diagnostic input.'
        : utlResult
          ? csAtOrBelowBackground
            ? `Measured Cs is at or below the ${scopeLabel.toLowerCase()} background UTL.`
            : `Measured Cs exceeds the ${scopeLabel.toLowerCase()} background UTL.`
          : 'Waiting on Stage 3: the background UTL has not been computed yet.';

  const provenanceValues: CalculatorUsedValue[] = useMemo(
    () => [
      {
        input_key: 'background_samples_mg_per_kg',
        label: `${scopeLabel} reference samples`,
        value: `${parsed.samples.length} accepted samples`,
        role: 'user-entered value',
        note: 'Reference-set data entered or seeded in the UI. Source data set provenance is tracked outside this v1 panel.',
      },
      {
        // K is a statistics-table lookup value (typically O(1-3)), not a
        // standard-like magnitude compared against other stages -- decimal-
        // place precision stays appropriate here (see the mean/sd/K stat
        // card decision in the file's Stage 3 render below).
        input_key: 'K_95_95',
        label: 'K factor',
        value: utlResult ? utlResult.K.toFixed(4) : null,
        role: 'derived value',
        note: 'Screening lookup or interpolation from the current K table.',
      },
      {
        input_key: 'utl_mg_per_kg',
        label: 'UTL 95/95',
        value: utlResult ? formatMagnitude(utlResult.utl) : null,
        unit: UTL_UNIT,
        role: 'derived value',
      },
      {
        input_key: 'Cs_mg_per_kg',
        label: 'Measured site concentration',
        value: csInput === '' ? null : csInput,
        unit: 'mg/kg dry',
        role: 'user-entered value',
        note: 'Optional diagnostic comparison input.',
      },
    ],
    [csInput, parsed.samples.length, scopeLabel, utlResult],
  );

  // Report Stage 3's UTL and Stage 4's adjusted standard upward (e.g. to the
  // Calculator tab summary bar). Both effects read already-memoized values
  // only -- neither computes anything new. Fix 3 (P3-C): cleanup added for
  // consistency with the five pathway calculators' reporting effects, which
  // all clear their reported slot on unmount/dep-change so a parent summary
  // bar never keeps a stale value around after this component stops
  // reporting. Benign today (this component does not unmount while its tab
  // is open) but kept consistent.
  useEffect(() => {
    if (!onUtlChange) return;
    onUtlChange({
      value: utlResult ? utlResult.utl : null,
      unit: UTL_UNIT,
      state: stage3State,
      scope,
      n: parsed.samples.length,
    });
    return () => {
      onUtlChange({
        value: null,
        unit: UTL_UNIT,
        state: 'pending',
        scope,
        n: 0,
      });
    };
  }, [onUtlChange, utlResult, stage3State, scope, parsed.samples.length]);

  useEffect(() => {
    if (!onAdjustedStandardChange) return;
    onAdjustedStandardChange({
      value: adjustedValue,
      unit: adjustedUnit,
      state: stage4State,
      governedBy,
    });
    return () => {
      onAdjustedStandardChange({
        value: null,
        unit: adjustedUnit,
        state: 'pending',
        governedBy: null,
      });
    };
  }, [onAdjustedStandardChange, adjustedValue, adjustedUnit, stage4State, governedBy]);

  return (
    <section
      data-testid="background-adjustment"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-8"
    >
      <header className="mb-2">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Background Adjustment -- UTL 95/95
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Apply this UTL<sub>95/95</sub> as a post-derivation adjustment to
          your Tier 1 generic standard so naturally-elevated background
          concentrations are not forced into remediation: adjusted Tier 1
          standard = max(Tier 1 generic, UTL). Regional UTL takes precedence
          over Provincial where geochemical equivalence is met (Phase 2 Paper
          App D.4).
        </p>
      </header>

      <RegulatoryFrameNotice
        frameId={jurisdiction}
        pathway="background-adjustment"
      />

      <div className="-mt-2">
        <MathRenderer
          content={
            'Formula: $UTL_{95/95} = \\bar{x} + K \\cdot s$ where $K$ is the ' +
            'one-sided 95 percent coverage, 95 percent confidence ' +
            'tolerance factor for sample size $n$ (NIST/SEMATECH ' +
            'e-Handbook 7.2.6.3).'
          }
        />
      </div>

      {/* ================= STAGE 3: BACKGROUND REFERENCE ================= */}
      <CalculatorStage
        number={3}
        totalStages={TOTAL_STAGES}
        title="Background Reference"
        state={stage3State}
        stateDetail={stage3Detail}
        // Fix 5 (P2-C, this component's half): previously `stage4State !==
        // 'computed'`, which kept Stage 3 lit as "current" for as long as
        // Stage 4 was waiting -- including while Stage 4 was waiting SOLELY
        // on the external preliminary standard from the active pathway
        // calculator, i.e. after Stage 3 itself was already done. That let
        // this component's Stage 3 and the calculator's own current stage
        // both light up at once on the assembled page.
        // Rule applied here (safe in isolation): a stage is "current" only
        // while ITS OWN prerequisites are already met (true for Stage 3 --
        // it is mathematically independent of Stages 1-2/4) AND it is
        // genuinely the next actionable step for the user, i.e. it has not
        // finished yet. Once Stage 3 computes, this component has nothing
        // further for the user to do here, so it stops claiming "current"
        // regardless of what Stage 4 (which has no user input of its own)
        // is still waiting on. Stage 4 itself is never marked current below
        // for the same reason -- it is a pure derivation with no action a
        // user takes on it directly.
        //
        // Fix 3 (P2, third adversarial round, 2026-08-14): the rule above was
        // still incomplete -- it made no reference to Stage 2 (the pathway
        // calculator's own preliminary standard), so Stage 3 could go
        // current again (e.g. the reference-sample textarea is cleared to
        // paste a new set, dropping n below 2) WHILE the active pathway
        // calculator's Stage 2 is unconditionally current too
        // (`!stage1Blocked`, with no knowledge of this component at all --
        // the two are separate React components that do not share state).
        // Two lit stages resulted. Fix: Stage 3 is current only once Stage 2
        // has actually produced a preliminary standard (`preliminaryAvailable`)
        // -- before that, Stage 2 is still the real next step, not Stage 3,
        // even if Stage 3 also has not computed yet. The matching half of
        // this fix lives in each pathway calculator: Stage 2's `current` now
        // also checks `!backgroundReferenceNeedsAttention`, a boolean the
        // assembling parent (MatrixDashboard) computes from this exact same
        // pair of facts (preliminarySlot.state and utlSlot.state) and passes
        // down -- explicit shared state, since neither component can see the
        // other's internals directly.
        current={preliminaryAvailable && stage3State !== 'computed'}
        testId="bg-adjust-stage-3"
      >
        <fieldset className="mb-4">
          <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Reference scope
          </legend>
          <div
            role="radiogroup"
            aria-label="Background reference scope"
            className="flex gap-2"
            data-testid="bg-adjust-scope-radio"
          >
            <label
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                scope === 'provincial'
                  ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-500 text-sky-700 dark:text-sky-300'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-400'
              }`}
            >
              <input
                type="radio"
                name="bg-adjust-scope"
                value="provincial"
                checked={scope === 'provincial'}
                onChange={() => setScope('provincial')}
                className="sr-only"
              />
              Provincial
            </label>
            <label
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                scope === 'regional'
                  ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-500 text-sky-700 dark:text-sky-300'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-400'
              }`}
            >
              <input
                type="radio"
                name="bg-adjust-scope"
                value="regional"
                checked={scope === 'regional'}
                onChange={() => setScope('regional')}
                className="sr-only"
              />
              Regional
            </label>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {scopeDescription}
          </p>
        </fieldset>

        <div className="mb-4">
          <label
            htmlFor="bg-adjust-samples"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            {scopeLabel} reference samples (comma- or whitespace-separated, mg/kg dry)
          </label>
          <textarea
            id="bg-adjust-samples"
            value={activeSamples}
            onChange={(e) => setActiveSamples(e.target.value)}
            rows={4}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            n = {parsed.samples.length}
            {parsed.rejected.length > 0
              ? ` -- rejected non-numeric tokens: ${parsed.rejected.join(', ')}`
              : ''}
          </p>
        </div>

        {/*
          Mean / Std Dev / K stay on toFixed(4) deliberately (P1-1 audit
          decision): they are reference-sample STATISTICS, not standard-like
          magnitudes maxed or compared across stages the way the UTL,
          preliminary, and adjusted-standard values are. This reference
          sample set is always O(1-10) mg/kg, so decimal-place precision is
          the more legible choice here; formatMagnitude is reserved for the
          values that can legitimately be sub-1e-4 screening standards.
        */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Mean
            </div>
            <div className="text-xl font-mono text-slate-900 dark:text-white">
              {utlResult ? utlResult.mean.toFixed(4) : '--'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Std Dev (n-1)
            </div>
            <div className="text-xl font-mono text-slate-900 dark:text-white">
              {utlResult ? utlResult.sd.toFixed(4) : '--'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              K (n = {utlResult ? utlResult.n : '--'})
            </div>
            <div className="text-xl font-mono text-slate-900 dark:text-white">
              {utlResult ? utlResult.K.toFixed(4) : '--'}
            </div>
          </div>
        </div>

        <div
          className="mt-4 bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner"
          data-testid="bg-adjust-utl-hero"
        >
          <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
            {scopeLabel} UTL 95/95
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
            {utlResult ? formatMagnitude(utlResult.utl) : '--'}{' '}
            <span className="text-lg text-slate-500 font-medium">{UTL_UNIT}</span>
          </div>
          <p className="text-xs text-sky-800 dark:text-sky-300 mt-3 font-medium">
            Apply as adjustment: max(Tier 1 generic, {utlResult ? formatMagnitude(utlResult.utl) : 'UTL'})
          </p>
        </div>

        {/*
          Screening-only caution: shown in the NORMAL state (n < 5), not only
          on error, per DESIGN.md "The calculator produces an adjusted
          standard, not a verdict".
        */}
        {utlResult && utlResult.warnings.length > 0 && (
          <div
            className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50"
            data-testid="bg-adjust-k-clamp-warning"
          >
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">
              K-factor screening qualifier
            </p>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
              {utlResult.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              UTL above is screening-only; compute K exactly from the noncentral
              t-distribution for regulatory submissions.
            </p>
          </div>
        )}

        {utlResult === null && parsed.samples.length < 2 && (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            Provide at least 2 numeric samples to compute the UTL.
          </p>
        )}

        {/*
          Fix 4 (P2-7 continued): the provenance panel belongs with Stage 3,
          where the UTL is actually derived -- it previously sat inside the
          (unnumbered, post-derivation) Site Comparison block below, which is
          not where the UTL's provenance is produced.
        */}
        <CalculatorProvenancePanel
          pathway="background-adjustment"
          usedValues={provenanceValues}
          regulatoryFrameId={jurisdiction}
          onOpenEvidenceLibrary={onOpenEvidenceLibrary}
        />
      </CalculatorStage>

      {/* ================= STAGE 4: ADJUSTED STANDARD ================= */}
      <CalculatorStage
        number={4}
        totalStages={TOTAL_STAGES}
        title="Adjusted Standard"
        state={stage4State}
        stateDetail={stage4Detail}
        receivedFrom="the preliminary standard (exposure derivation) and Stage 3 background UTL 95/95"
        testId="bg-adjust-stage-4"
      >
        <div className="space-y-2 mb-4">
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5"
            data-testid="bg-adjust-operand-preliminary"
          >
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {preliminaryLabel}
            </span>
            <span className="flex items-center gap-2 font-mono text-sm font-bold text-slate-900 dark:text-white">
              {preliminaryAvailable
                ? `${formatMagnitude(preliminaryValue as number)} ${adjustedUnit}`
                : '--'}
              <StageStateChip state={preliminaryState} />
            </span>
          </div>
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5"
            data-testid="bg-adjust-operand-utl"
          >
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Background UTL 95/95 (Stage 3, {scopeLabel})
            </span>
            <span className="flex items-center gap-2 font-mono text-sm font-bold text-slate-900 dark:text-white">
              {utlAvailable ? `${formatMagnitude(utlResult!.utl)} ${UTL_UNIT}` : '--'}
              <StageStateChip state={stage3State} />
            </span>
          </div>
        </div>

        {stage4State === 'computed' ? (
          <div
            className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-4"
            data-testid="bg-adjust-result"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                Adjusted standard
              </span>
              <StageStateChip state="computed" />
            </div>
            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {formatMagnitude(adjustedValue as number)}{' '}
              <span className="text-sm font-medium text-slate-500">{adjustedUnit}</span>
            </p>
            <p
              className="mt-3 text-sm text-slate-700 dark:text-slate-200"
              data-testid="bg-adjust-governing-sentence"
            >
              {governingSentence}
            </p>
          </div>
        ) : unitsMismatched ? (
          <div
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4"
            data-testid="bg-adjust-result-blocked"
            role="alert"
          >
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
              Adjusted standard blocked: unit mismatch.
            </p>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
              {stage4UnitMismatchDetail}
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4"
            data-testid="bg-adjust-result-waiting"
          >
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Adjusted standard not yet available.
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Waiting on {stage4MissingReasons.join(' and ')}. The max() cannot
              be taken of a number and an absence.
            </p>
          </div>
        )}
      </CalculatorStage>

      {/*
        =========== SITE COMPARISON (NOT A DERIVATION STAGE) ===========
        Fix 3 (P2-4/P2-7): the derivation is Stages 1-4 only (exposure
        factors, preliminary standard, background reference, adjusted
        standard). This comparison of a measured site concentration against
        the background UTL is kept for now, but the owner has stated that a
        measured site concentration does not belong in this standards-
        derivation tool at all -- so it is rendered here as an unnumbered,
        clearly separated block, not as "Stage 5" of the derivation, pending
        an owner decision on whether to keep it. Its comparison LOGIC is
        unchanged (see the file-header Stage 5 caution above the component
        function) -- only its presentation (unwrapped from CalculatorStage,
        no stage number) changed.
      */}
      <section
        className="border-t-2 border-dashed border-[var(--db-border)] pt-6"
        data-testid="bg-adjust-site-comparison"
        aria-labelledby="bg-adjust-site-comparison-title"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h4
            id="bg-adjust-site-comparison-title"
            className="m-0 text-base font-semibold text-[var(--db-text-primary)]"
          >
            Site Comparison
          </h4>
          <StageStateChip state={siteComparisonState} testId="bg-adjust-site-comparison-chip" />
        </div>
        <p className="mb-4 text-xs text-[var(--db-text-muted)]" data-testid="bg-adjust-site-comparison-state-detail">
          Not part of the standards derivation above (Stages 1-4). Optional,
          diagnostic-only comparison of a measured site concentration against
          the background UTL; its role in this tool is under review.
          {siteComparisonDetail ? ` ${siteComparisonDetail}` : ''}
        </p>
        <div>
          <label
            htmlFor="bg-adjust-cs"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Measured site concentration C<sub>s</sub> (mg/kg dry, optional)
          </label>
          <input
            id="bg-adjust-cs"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={csInput}
            onChange={(e) => setCsInput(e.target.value)}
            placeholder="Leave blank to display the UTL only"
            className="w-full max-w-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
          {csIsBlank && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Optional: enter a measured site concentration to compare against
              the background UTL.
            </p>
          )}
          {csIsInvalid && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              C<sub>s</sub> must be a decimal number (e.g., 6.0).
            </p>
          )}
          {csIsNegative && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              C<sub>s</sub> must be greater than or equal to zero.
            </p>
          )}
        </div>

        {csAtOrBelowBackground !== null && (
          <div
            className={`mt-4 p-4 rounded-xl text-sm tracking-tight ${
              csAtOrBelowBackground
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
            }`}
            data-testid="bg-adjust-cs-comparison"
          >
            {csAtOrBelowBackground
              ? `Measured Cs (${csParsed}) is at or below the ${scopeLabel.toLowerCase()} background UTL. The background adjustment may apply: compare your Tier 1 derived standard against the max(Tier 1 generic, UTL) above.`
              : `Measured Cs (${csParsed}) exceeds the ${scopeLabel.toLowerCase()} background UTL. The background adjustment will not relax your Tier 1 standard; compare Cs against your Tier 1 generic standard directly.`}
          </div>
        )}
      </section>
    </section>
  );
}
