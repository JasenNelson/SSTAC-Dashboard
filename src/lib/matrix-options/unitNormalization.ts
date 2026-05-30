// Unit normalization for cross-source TRV comparison (A1 guard).
// Plain ASCII only.
//
// WHY THIS EXISTS
// The catalog deliberately groups candidate values for one substance + pathway +
// input_key across sources so a Qualified Professional can compare them (Protocol 1
// sec 4.4). Sources express the SAME quantity in different units: an inhalation RfC may
// be "2e-05 mg/m3" from one source and "2E-2 ug/m3" from another -- numerically the same
// value, 1000x apart in raw magnitude. An inhalation unit risk (IUR) may be "per ug/m3"
// vs "(mg/m3)-1" -- a RECIPROCAL basis. Any numeric comparison or most-stringent pick
// across such a group MUST convert to a common base first, or it mis-ranks by up to 1000x.
//
// This module is the single conversion path. It is FAIL-CLOSED: an unrecognized unit
// returns null, and callers must refuse to compare rather than guess.

import { parseDecimalInput } from './parseDecimal';

export interface NormalizedQuantity {
  value: number; // value expressed in baseUnit
  baseUnit: string; // canonical base label for the dimension
}

// mass-prefix multipliers to milligrams (the canonical mass base)
const MASS_PREFIX_TO_MG: Record<string, number> = {
  ng: 1e-6,
  ug: 1e-3,
  mcg: 1e-3, // microgram alias
  mg: 1,
  g: 1e3,
};

// canonical base labels per (dimension, reciprocal?)
const BASE_LABEL = {
  air: 'mg/m3',
  air_reciprocal: '(mg/m3)-1',
  dose: 'mg/kg-d',
  dose_reciprocal: '(mg/kg-d)-1',
  dimensionless: 'dimensionless',
} as const;

function canon(unit: string): string {
  return unit.toLowerCase().replace(/\s+/g, '').replace(/bw/g, '').replace(/cu\.?m/g, 'm3');
}

function isReciprocal(u: string): boolean {
  // "per mg/m3", "(mg/m3)-1", "mg/m3^-1", "...-1" trailing
  return /per/.test(u) || /\)-1/.test(u) || /\^-1/.test(u) || /-1$/.test(u);
}

function massPrefix(u: string): string | null {
  // Token-safe: take the NUMERATOR (before the first '/'), strip punctuation and a
  // leading 'per', and require it to be EXACTLY a known mass unit. This rejects the
  // 'g' inside a denominator 'kg' (e.g. 'kg/day' -> numerator 'kg' -> no match -> null)
  // and any malformed numerator (fail-closed).
  const numerator = u.split('/')[0].replace(/[^a-z0-9]/g, '').replace(/^per/, '');
  const m = numerator.match(/^(ng|ug|mcg|mg|g)$/);
  return m ? m[1] : null;
}

function dimension(u: string): 'air' | 'dose' | 'dimensionless' | null {
  // Explicit dimensionless only; a BLANK/missing unit is NOT comparable -> fail closed
  // (falls through to the air/dose checks, which both miss, returning null).
  if (u.includes('dimensionless') || u.includes('unitless')) {
    return 'dimensionless';
  }
  const hasAir = u.includes('m3');
  const hasDose = u.includes('kg') && (u.includes('day') || /\/d(\b|$|[^a-z])/.test(u) || u.endsWith('-d') || u.includes('-d'));
  if (hasAir && !hasDose) return 'air';
  if (hasDose && !hasAir) return 'dose';
  return null; // ambiguous or unrecognized -> fail closed
}

/**
 * Convert a catalog value + unit to a canonical base unit so values from different
 * sources in the same input_key family can be compared. Returns null (fail-closed)
 * when the unit cannot be confidently recognized or the value cannot be parsed.
 *
 * inputKey is accepted for future family-specific rules but classification is driven
 * by the unit string itself (robust across both legacy and canonical input_key vocab).
 */
export function normalizeToBase(
  rawValue: number | string,
  rawUnit: string,
  _inputKey?: string,
): NormalizedQuantity | null {
  const parsed =
    typeof rawValue === 'number'
      ? { value: rawValue, state: Number.isFinite(rawValue) ? 'valid' : 'invalid' }
      : parseDecimalInput(String(rawValue), { allowNegative: true });
  if (parsed.state !== 'valid') return null;

  const u = canon(rawUnit ?? '');
  const dim = dimension(u);
  if (dim === null) return null;

  if (dim === 'dimensionless') {
    return { value: parsed.value, baseUnit: BASE_LABEL.dimensionless };
  }

  const prefix = massPrefix(u);
  if (prefix === null || !(prefix in MASS_PREFIX_TO_MG)) return null;
  const massFactor = MASS_PREFIX_TO_MG[prefix];
  const reciprocal = isReciprocal(u);

  // forward quantity (concentration/dose) scales with the mass prefix;
  // reciprocal quantity (per-concentration / per-dose) scales inversely.
  const factorToBase = reciprocal ? 1 / massFactor : massFactor;
  const baseUnit =
    dim === 'air'
      ? reciprocal
        ? BASE_LABEL.air_reciprocal
        : BASE_LABEL.air
      : reciprocal
        ? BASE_LABEL.dose_reciprocal
        : BASE_LABEL.dose;

  return { value: parsed.value * factorToBase, baseUnit };
}

export interface SlotUnitConsistency {
  units: string[]; // distinct raw unit strings in the slot
  baseUnits: string[]; // distinct canonical base units after normalization
  allNormalizable: boolean; // every row's unit was recognized
  homogeneousBase: boolean; // all normalizable rows share one base unit
  // true only when the slot is SAFE to compare numerically:
  // every unit recognized AND all share one base.
  comparable: boolean;
}

/**
 * Assess whether a set of {value, unit} rows for one input_key slot can be compared
 * numerically. comparable=false means a consumer MUST NOT run a most-stringent / min /
 * max across these rows without resolving the unit mismatch (fail-closed signal).
 */
export function assessSlotUnitConsistency(
  rows: ReadonlyArray<{ value: number | string; unit: string; input_key?: string }>,
): SlotUnitConsistency {
  const units = Array.from(new Set(rows.map((r) => r.unit ?? ''))).sort();
  const normalized = rows.map((r) => normalizeToBase(r.value, r.unit, r.input_key));
  const allNormalizable = normalized.every((n) => n !== null);
  const baseUnits = Array.from(
    new Set(normalized.filter((n): n is NormalizedQuantity => n !== null).map((n) => n.baseUnit)),
  ).sort();
  const homogeneousBase = baseUnits.length <= 1;
  return {
    units,
    baseUnits,
    allNormalizable,
    homogeneousBase,
    comparable: allNormalizable && homogeneousBase,
  };
}
