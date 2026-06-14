// Shared decimal-input parsing for the matrix-options calculator.
// Plain ASCII only.
//
// Without this whitelist, Number('0x10') would silently parse as 16 (hex
// literal) and inject a wrong value into any numeric input. Browser
// <input type="number"> filters most of this at the UI level, but defense
// in depth applies to programmatic state injection (tests, future paste-
// from-spreadsheet handlers) and to symmetric validation across all
// numeric calculator inputs.
//
// Codex round 1 fixed this for Tier 0 reference samples. Cursor CLI
// secondary review 2026-05-18 surfaced the same gap on Tier 0 Cs and on
// Eco-Direct Cs/FCV. This module is the single source of truth.

export const DECIMAL_NUMBER_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

export type ParsedNumberState =
  | 'blank'
  | 'invalid' // failed regex or non-finite after Number()
  | 'negative' // finite but < 0 when allowNegative=false
  | 'valid';

export interface ParsedNumberResult {
  value: number;
  state: ParsedNumberState;
}

// Parse a single free-text token to a number with discriminated state so
// the UI can route to the appropriate empty / error / value message.
//
// When state !== 'valid' the value field carries:
//  - Number.NaN for 'blank' or 'invalid'
//  - the parsed negative number for 'negative' (UI may display "must be >= 0")
export function parseDecimalInput(
  raw: string,
  opts: { allowNegative?: boolean } = {},
): ParsedNumberResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { value: Number.NaN, state: 'blank' };
  }
  if (!DECIMAL_NUMBER_RE.test(trimmed)) {
    return { value: Number.NaN, state: 'invalid' };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { value: Number.NaN, state: 'invalid' };
  }
  if (!opts.allowNegative && n < 0) {
    return { value: n, state: 'negative' };
  }
  return { value: n, state: 'valid' };
}

// Shared calculator input validators used by HHFoodWebCalculator and
// HHDirectContactCalculator. Defined here to avoid byte-identical copies in
// each component.

export function positiveInput(value: string, label: string): number | { error: string } {
  const parsed = parseDecimalInput(value, { allowNegative: false });
  if (parsed.state !== 'valid' || parsed.value <= 0) {
    return { error: `${label} must be a positive decimal number.` };
  }
  return parsed.value;
}

export function optionalPositiveInput(value: string, label: string): number | null | { error: string } {
  const parsed = parseDecimalInput(value, { allowNegative: false });
  if (parsed.state === 'blank') return null;
  if (parsed.state !== 'valid' || parsed.value <= 0) {
    return { error: `${label} must be blank or a positive decimal number.` };
  }
  return parsed.value;
}
