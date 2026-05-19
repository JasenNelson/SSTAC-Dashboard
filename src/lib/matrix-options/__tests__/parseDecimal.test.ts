// Unit tests for parseDecimalInput.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import {
  DECIMAL_NUMBER_RE,
  parseDecimalInput,
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
});
