'use client';

// Tier 0 UTL_{95/95} pre-screen component.
// See .tmp_calculator_design_v1.md section 3.
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
    // Reject negative reference samples: site Cs is constrained >= 0 by the
    // codex-round-2 fix; reference samples must follow the same asymmetry.
    // Cursor CLI secondary review P3 2026-05-18.
    if (!Number.isFinite(n) || n < 0) {
      rejected.push(tok);
      return;
    }
    samples.push(n);
  });
  return { samples, rejected };
}

export default function Tier0Screen() {
  const [rawSamples, setRawSamples] = useState<string>(
    '4.8, 5.1, 4.9, 5.3, 4.7, 5.0, 5.2, 4.6, 5.4, 5.0',
  );
  const [csInput, setCsInput] = useState<string>('6.0');

  const parsed = useMemo(() => parseSamples(rawSamples), [rawSamples]);

  const utlResult = useMemo(() => {
    if (parsed.samples.length < 2) return null;
    try {
      return utl9595(parsed.samples);
    } catch {
      return null;
    }
  }, [parsed.samples]);

  // A blank input must NOT yield a verdict (codex round 1: Number('') is 0).
  // A negative Cs must NOT yield PASS even when finite (codex round 2).
  // A hex-like or otherwise non-decimal Cs must NOT silently parse to a number
  // (cursor secondary review: symmetric with reference-sample validation).
  // All three concerns delegate to parseDecimalInput which returns a
  // discriminated state.
  const csParseResult = parseDecimalInput(csInput, { allowNegative: false });
  const csIsBlank = csParseResult.state === 'blank';
  const csIsInvalid = csParseResult.state === 'invalid';
  const csIsNegative = csParseResult.state === 'negative';
  const csIsValid = csParseResult.state === 'valid';
  const csParsed = csParseResult.value;
  const verdict: 'PASS' | 'FAIL' | null = useMemo(() => {
    if (!utlResult || !csIsValid) return null;
    return csParsed <= utlResult.utl ? 'PASS' : 'FAIL';
  }, [utlResult, csIsValid, csParsed]);

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
      <header className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Tier 0 -- UTL 95/95 Pre-Screen
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          If the measured site concentration is statistically at or below
          the natural regional background, the site is deemed
          uncontaminated and no further pathway derivation is needed
          (design doc section 3; Phase 2 Options Paper App D.2).
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="tier0-samples"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Reference samples (comma- or whitespace-separated, mg/kg)
          </label>
          <textarea
            id="tier0-samples"
            value={rawSamples}
            onChange={(e) => setRawSamples(e.target.value)}
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
            htmlFor="tier0-cs"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Measured site concentration C<sub>s</sub> (mg/kg)
          </label>
          <input
            id="tier0-cs"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={csInput}
            onChange={(e) => setCsInput(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
          {csIsBlank && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter a measured concentration to see the verdict.
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

      <div className="mt-4 bg-sky-50 dark:bg-sky-900/20 rounded-xl p-6 text-center border border-sky-100 dark:border-sky-800 shadow-inner">
        <div className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-widest mb-1">
          UTL 95/95
        </div>
        <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
          {utlResult ? utlResult.utl.toFixed(4) : '--'}{' '}
          <span className="text-lg text-slate-500 font-medium">mg/kg</span>
        </div>
      </div>

      {utlResult && utlResult.warnings.length > 0 && (
        <div
          className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50"
          data-testid="tier0-k-clamp-warning"
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
            Verdict below is screening-only; compute K exactly from the
            noncentral t-distribution for regulatory submissions.
          </p>
        </div>
      )}

      {verdict !== null && (
        <div
          className={`mt-4 p-4 rounded-xl text-center font-semibold tracking-tight ${
            verdict === 'PASS'
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}
          data-testid="tier0-verdict"
        >
          {verdict === 'PASS'
            ? 'PASS -- Cs is at or below background; site deemed uncontaminated for this constituent.'
            : 'FAIL -- Cs exceeds background. Proceed to Tier 1 generic screen, then Tier 2 mechanistic if needed.'}
          {utlResult && utlResult.warnings.length > 0 && (
            <span className="block mt-1 text-xs font-medium opacity-80">
              (screening-only; K factor clamped)
            </span>
          )}
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
