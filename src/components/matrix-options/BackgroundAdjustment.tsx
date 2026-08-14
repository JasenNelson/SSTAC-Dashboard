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
// adjusted standard, not a verdict"): this component now renders Stages 3-5
// of the five-stage derivation sequence -- Background Reference (3),
// Adjusted Standard (4), and Site Comparison (5) -- wrapped in
// CalculatorStage. Stage 3 is mathematically independent of Stages 1-2 (the
// UTL depends only on the reference samples), so it computes even when the
// caller's preliminary standard is invalid or not yet available; only Stage
// 4's max() and Stage 5's presentation wait on it. No calculation,
// coefficient, rounding rule, or displayed numeric value from the prior
// single-panel version has changed -- this is a presentation wrap plus the
// new Stage 4 max() comparison, which uses only the two operands already
// computed elsewhere (the caller-supplied preliminary standard and this
// component's own utl9595 result).
//
// Stage 5 caution (see report): the Cs comparison below is UNCHANGED -- it
// still compares the measured site concentration against the background UTL
// only, exactly as the prior version did. DESIGN.md describes the eventual
// comparison as against the ADJUSTED standard, but rewiring it would change
// the displayed outcome whenever the preliminary standard governs (Cs values
// between the UTL and the higher preliminary standard would flip from
// "exceeds" to "within standard"). That is a behavioural change to a
// regulatory comparison, so it is intentionally NOT made here; it is
// reported for owner sign-off instead of applied silently.
//
// Plain ASCII only.

import React, { useEffect, useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { utl9595 } from '@/lib/matrix-options/derivations';
import {
  DECIMAL_NUMBER_RE,
  parseDecimalInput,
} from '@/lib/matrix-options/parseDecimal';
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

const TOTAL_STAGES = 5;

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

  const stage4State: StageState =
    preliminaryAvailable && utlAvailable ? 'computed' : 'waiting';

  const adjustedValue: number | null =
    preliminaryAvailable && utlAvailable
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
  const stage4Detail =
    stage4State === 'computed'
      ? `Adjusted standard = max(preliminary, UTL) = ${(adjustedValue as number).toFixed(4)} ${adjustedUnit}.`
      : `Waiting on ${stage4MissingReasons.join(' and ')}.`;

  const governingSentence: string =
    adjustedValue === null || governedBy === null || !utlResult
      ? ''
      : governedBy === 'background'
        ? `Which one governed: the background UTL 95/95 (${utlResult.utl.toFixed(4)} mg/kg) governs, ` +
          `because it exceeds the preliminary standard (${(preliminaryValue as number).toPrecision(4)} ${adjustedUnit}). ` +
          `Adjusted standard = max(${(preliminaryValue as number).toPrecision(4)}, ${utlResult.utl.toFixed(4)}) = ` +
          `${adjustedValue.toFixed(4)} ${adjustedUnit}. In plain terms, the risk-based preliminary standard sits ` +
          `below what already occurs naturally in this ${scopeLabel.toLowerCase()} reference set, so the adjusted ` +
          `standard uses background instead of forcing remediation of naturally occurring background.`
        : `Which one governed: the preliminary standard (${(preliminaryValue as number).toPrecision(4)} ${adjustedUnit}) governs, ` +
          `because it is at or above the background UTL 95/95 (${utlResult.utl.toFixed(4)} mg/kg). ` +
          `Adjusted standard = max(${(preliminaryValue as number).toPrecision(4)}, ${utlResult.utl.toFixed(4)}) = ` +
          `${adjustedValue.toFixed(4)} ${adjustedUnit}.`;

  // ---------------------------------------------------------------------
  // Stage 5 -- Site Comparison. Presentation-only wrap of the EXISTING
  // Cs-vs-UTL comparison (see the Stage 5 caution in the file header).
  // ---------------------------------------------------------------------
  const stage5State: StageState = csIsInvalid || csIsNegative
    ? 'blocked'
    : csIsBlank
      ? 'pending'
      : utlResult
        ? 'computed'
        : 'waiting';
  const stage5Detail = csIsInvalid
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
        input_key: 'K_95_95',
        label: 'K factor',
        value: utlResult ? utlResult.K.toFixed(4) : null,
        role: 'derived value',
        note: 'Screening lookup or interpolation from the current K table.',
      },
      {
        input_key: 'utl_mg_per_kg',
        label: 'UTL 95/95',
        value: utlResult ? utlResult.utl.toFixed(4) : null,
        unit: 'mg/kg',
        role: 'derived value',
      },
      {
        input_key: 'Cs_mg_per_kg',
        label: 'Measured site concentration',
        value: csInput === '' ? null : csInput,
        unit: 'mg/kg',
        role: 'user-entered value',
        note: 'Optional diagnostic comparison input.',
      },
    ],
    [csInput, parsed.samples.length, scopeLabel, utlResult],
  );

  // Report Stage 3's UTL and Stage 4's adjusted standard upward (e.g. to the
  // Calculator tab summary bar). Both effects read already-memoized values
  // only -- neither computes anything new.
  useEffect(() => {
    if (!onUtlChange) return;
    onUtlChange({
      value: utlResult ? utlResult.utl : null,
      unit: 'mg/kg',
      state: stage3State,
      scope,
      n: parsed.samples.length,
    });
  }, [onUtlChange, utlResult, stage3State, scope, parsed.samples.length]);

  useEffect(() => {
    if (!onAdjustedStandardChange) return;
    onAdjustedStandardChange({
      value: adjustedValue,
      unit: adjustedUnit,
      state: stage4State,
      governedBy,
    });
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
        current={stage4State !== 'computed'}
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
            {scopeLabel} reference samples (comma- or whitespace-separated, mg/kg)
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
            {utlResult ? utlResult.utl.toFixed(4) : '--'}{' '}
            <span className="text-lg text-slate-500 font-medium">mg/kg</span>
          </div>
          <p className="text-xs text-sky-800 dark:text-sky-300 mt-3 font-medium">
            Apply as adjustment: max(Tier 1 generic, {utlResult ? utlResult.utl.toFixed(4) : 'UTL'})
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
                ? `${(preliminaryValue as number).toPrecision(4)} ${adjustedUnit}`
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
              {utlAvailable ? `${utlResult!.utl.toFixed(4)} mg/kg` : '--'}
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
              {(adjustedValue as number).toFixed(4)}{' '}
              <span className="text-sm font-medium text-slate-500">{adjustedUnit}</span>
            </p>
            <p
              className="mt-3 text-sm text-slate-700 dark:text-slate-200"
              data-testid="bg-adjust-governing-sentence"
            >
              {governingSentence}
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

      {/* ================= STAGE 5: SITE COMPARISON ================= */}
      <CalculatorStage
        number={5}
        totalStages={TOTAL_STAGES}
        title="Site Comparison"
        state={stage5State}
        stateDetail={stage5Detail}
        receivedFrom={!utlResult ? 'Stage 3 background UTL 95/95' : undefined}
        testId="bg-adjust-stage-5"
      >
        <div>
          <label
            htmlFor="bg-adjust-cs"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Measured site concentration C<sub>s</sub> (mg/kg, optional)
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

        <CalculatorProvenancePanel
          pathway="background-adjustment"
          usedValues={provenanceValues}
          regulatoryFrameId={jurisdiction}
          onOpenEvidenceLibrary={onOpenEvidenceLibrary}
        />
      </CalculatorStage>
    </section>
  );
}
