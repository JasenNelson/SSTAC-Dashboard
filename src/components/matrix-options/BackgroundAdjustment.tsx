'use client';

// Background Adjustment -- UTL_{95/95} for Provincial + Regional reference sets.
// Reframed from Tier 0 UTL pre-screen 2026-05-19: BC CSR applies the UTL as a
// post-derivation adjustment to the Tier 1 generic standard so naturally-
// elevated background concentrations are not forced into remediation. The
// Olsgard et al. / ACFN pre-screen pattern is for jurisdictions without
// protocol-derived standards and does not apply to BC CSR.
//
// Math (utl9595 + lookupK9595) is unchanged from the prior Tier 0 component.
// Plain ASCII only.

import React, { useMemo, useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { utl9595 } from '@/lib/matrix-options/derivations';
import {
  DECIMAL_NUMBER_RE,
  parseDecimalInput,
} from '@/lib/matrix-options/parseDecimal';

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

export default function BackgroundAdjustment() {
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
  const csAtOrBelowBackground: boolean | null = useMemo(() => {
    if (!utlResult || !csIsValid) return null;
    return csParsed <= utlResult.utl;
  }, [utlResult, csIsValid, csParsed]);

  const scopeLabel = scope === 'provincial' ? 'Provincial' : 'Regional';
  const scopeDescription =
    scope === 'provincial'
      ? 'BC province-wide reference set (fallback when regional reference data is unavailable).'
      : 'Site-specific regional reference set (preferred over Provincial where geochemical equivalence is met -- Phase 2 Paper App D.4).';

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
      <header className="mb-4">
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

      <div className="mb-4">
        <MathRenderer
          content={
            'Formula: $UTL_{95/95} = \\bar{x} + K \\cdot s$ where $K$ is the ' +
            'one-sided 95 percent coverage, 95 percent confidence ' +
            'tolerance factor for sample size $n$ (NIST/SEMATECH ' +
            'e-Handbook 7.2.6.3).'
          }
        />
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
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
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
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
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {utlResult === null && parsed.samples.length < 2 && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
          Provide at least 2 numeric samples to compute the UTL.
        </p>
      )}
    </section>
  );
}
