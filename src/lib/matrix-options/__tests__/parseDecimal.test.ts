// Unit tests for parseDecimalInput.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import {
  DECIMAL_NUMBER_RE,
  parseDecimalInput,
  positiveInput,
  optionalPositiveInput,
} from '../parseDecimal';

describe('DECIMAL_NUMBER_RE', () => {
  it('matches plain decimals', () => {
    expect(DECIMAL_NUMBER_RE.test('0')).toBe(true);
    expect(DECIMAL_NUMBER_RE.test('0.014')).toBe(true);
    expect(DECIMAL_NUMBER_RE.test('1000')).toBe(true);
    expect(DECIMAL_NUMBER_RE.test('-1.5')).toBe(true);
  });

  it('matches scientific notation', () => {
    expect(DECIMAL_NUMBER_RE.test('1e5')).toBe(true);
    expect(DECIMAL_NUMBER_RE.test('1.5e-3')).toBe(true);
    expect(DECIMAL_NUMBER_RE.test('-2.0E+10')).toBe(true);
  });

  it('rejects hex literals (the core cursor-review concern)', () => {
    // Number('0x10') === 16 in JavaScript. Without the regex whitelist,
    // a hex paste would silently inject the wrong value. Cursor CLI
    // secondary review 2026-05-18.
    expect(DECIMAL_NUMBER_RE.test('0x10')).toBe(false);
    expect(DECIMAL_NUMBER_RE.test('0xFF')).toBe(false);
    expect(DECIMAL_NUMBER_RE.test('0X10')).toBe(false);
  });

  it('rejects octal and other non-decimal forms', () => {
    // Note: Number('0o10') === 8 in modern JS; Number('010') === 10 (no
    // octal auto-detect in modern JS). The regex rejects the 0o prefix.
    expect(DECIMAL_NUMBER_RE.test('0o10')).toBe(false);
    expect(DECIMAL_NUMBER_RE.test('0b10')).toBe(false);
    // Trailing or leading whitespace is rejected (must be pre-trimmed).
    expect(DECIMAL_NUMBER_RE.test(' 5')).toBe(false);
    expect(DECIMAL_NUMBER_RE.test('5 ')).toBe(false);
    // Multiple dots or commas are rejected.
    expect(DECIMAL_NUMBER_RE.test('1.2.3')).toBe(false);
    expect(DECIMAL_NUMBER_RE.test('1,000')).toBe(false);
    // Empty and pure-whitespace already filtered at parseDecimalInput
    // upstream, but the regex rejects them too.
    expect(DECIMAL_NUMBER_RE.test('')).toBe(false);
    expect(DECIMAL_NUMBER_RE.test('abc')).toBe(false);
  });
});

describe('parseDecimalInput', () => {
  it('returns blank state for empty / whitespace-only input', () => {
    expect(parseDecimalInput('').state).toBe('blank');
    expect(parseDecimalInput('   ').state).toBe('blank');
    expect(parseDecimalInput('\t\n').state).toBe('blank');
  });

  it('trims surrounding whitespace before validating', () => {
    // Number('  6.0  ') === 6 in plain JS; the trimmed value is '6.0'.
    expect(parseDecimalInput('  6.0  ')).toEqual({ value: 6, state: 'valid' });
    expect(parseDecimalInput('\n0.014\n')).toEqual({
      value: 0.014,
      state: 'valid',
    });
  });

  it('returns invalid state for hex literals', () => {
    expect(parseDecimalInput('0x10').state).toBe('invalid');
    expect(parseDecimalInput('0xFF').state).toBe('invalid');
  });

  it('returns invalid state for non-numeric text', () => {
    expect(parseDecimalInput('abc').state).toBe('invalid');
    expect(parseDecimalInput('1.2.3').state).toBe('invalid');
    expect(parseDecimalInput('1,000').state).toBe('invalid');
  });

  it('returns negative state for finite negatives when allowNegative=false', () => {
    const result = parseDecimalInput('-1.5');
    expect(result.state).toBe('negative');
    expect(result.value).toBe(-1.5);
  });

  it('returns valid state for finite negatives when allowNegative=true', () => {
    const result = parseDecimalInput('-1.5', { allowNegative: true });
    expect(result.state).toBe('valid');
    expect(result.value).toBe(-1.5);
  });

  it('returns valid state for zero and positive numbers', () => {
    expect(parseDecimalInput('0')).toEqual({ value: 0, state: 'valid' });
    expect(parseDecimalInput('0.0001')).toEqual({
      value: 0.0001,
      state: 'valid',
    });
    expect(parseDecimalInput('1e6')).toEqual({ value: 1_000_000, state: 'valid' });
  });

  it('returns invalid state for out-of-range exponents that produce Infinity', () => {
    // '1e999' passes the regex (valid decimal-scientific form) but
    // Number('1e999') === Infinity, which is not finite -> { value: NaN, state: 'invalid' }.
    expect(parseDecimalInput('1e999')).toEqual({ value: Number.NaN, state: 'invalid' });
    // Same for large negative exponent: Number('-1e9999') === -Infinity.
    expect(parseDecimalInput('-1e9999')).toEqual({ value: Number.NaN, state: 'invalid' });
  });
});

describe('positiveInput', () => {
  it('returns an error object for blank / whitespace-only input', () => {
    expect(positiveInput('', 'Dose')).toEqual({ error: 'Dose must be a positive decimal number.' });
    expect(positiveInput('   ', 'Dose')).toEqual({ error: 'Dose must be a positive decimal number.' });
  });

  it('returns an error object for non-numeric input', () => {
    expect(positiveInput('abc', 'Rate')).toEqual({ error: 'Rate must be a positive decimal number.' });
    expect(positiveInput('1.2.3', 'Rate')).toEqual({ error: 'Rate must be a positive decimal number.' });
  });

  it('returns an error object for zero (not strictly positive)', () => {
    expect(positiveInput('0', 'BW')).toEqual({ error: 'BW must be a positive decimal number.' });
  });

  it('returns an error object for negative numbers (incl. negative scientific)', () => {
    expect(positiveInput('-1', 'BW')).toEqual({ error: 'BW must be a positive decimal number.' });
    expect(positiveInput('-1e3', 'BW')).toEqual({ error: 'BW must be a positive decimal number.' });
  });

  it('returns the parsed number for positive integers and decimals', () => {
    expect(positiveInput('5', 'Dose')).toBe(5);
    expect(positiveInput('0.0001', 'IR')).toBe(0.0001);
  });

  it('returns the parsed number for positive scientific notation', () => {
    expect(positiveInput('1e-3', 'Cs')).toBe(0.001);
    expect(positiveInput('2.5E+2', 'Cs')).toBe(250);
  });

  it('returns an error object for Infinity-producing exponents', () => {
    expect(positiveInput('1e999', 'Dose')).toEqual({ error: 'Dose must be a positive decimal number.' });
  });

  it('uses the label argument verbatim in the error message', () => {
    const label = 'Ingestion Rate (kg/day)';
    expect(positiveInput('', label)).toEqual({ error: `${label} must be a positive decimal number.` });
  });
});

describe('optionalPositiveInput', () => {
  it('returns null for blank and whitespace-only input', () => {
    expect(optionalPositiveInput('', 'AF')).toBeNull();
    expect(optionalPositiveInput('   ', 'AF')).toBeNull();
    expect(optionalPositiveInput('\t', 'AF')).toBeNull();
  });

  it('returns an error object for non-numeric input (not blank)', () => {
    expect(optionalPositiveInput('abc', 'AF')).toEqual({
      error: 'AF must be blank or a positive decimal number.',
    });
  });

  it('returns an error object for zero (not strictly positive)', () => {
    expect(optionalPositiveInput('0', 'AF')).toEqual({
      error: 'AF must be blank or a positive decimal number.',
    });
  });

  it('returns an error object for negative numbers (incl. negative scientific)', () => {
    expect(optionalPositiveInput('-5', 'EF')).toEqual({
      error: 'EF must be blank or a positive decimal number.',
    });
    expect(optionalPositiveInput('-1e3', 'EF')).toEqual({
      error: 'EF must be blank or a positive decimal number.',
    });
  });

  it('returns the parsed number for valid positive inputs', () => {
    expect(optionalPositiveInput('7.5', 'AF')).toBe(7.5);
    expect(optionalPositiveInput('1e-3', 'Cs')).toBe(0.001);
  });

  it('uses the label argument verbatim in the error message', () => {
    const label = 'Absorption Factor (unitless)';
    expect(optionalPositiveInput('bad', label)).toEqual({
      error: `${label} must be blank or a positive decimal number.`,
    });
  });
});
