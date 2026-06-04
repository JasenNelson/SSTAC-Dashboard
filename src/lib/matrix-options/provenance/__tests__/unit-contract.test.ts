import { describe, expect, it } from 'vitest';
import { normalizeToCanonical } from '../../../../../scripts/matrix-options/generate-catalog-records.mjs';
import fixtureRaw from '../../../../../scripts/matrix-options/__tests__/unit_contract_fixtures.json';

// F3 cross-language unit CONTRACT -- JS (builder) side + the e2e canonicalization invariant.
//
// This reads the SAME fixture scripts/matrix-options/__tests__/unit_contract_fixtures.json that the
// pytest recon side (test_unit_contract.py) reads. The recon side asserts unit_consistent ==
// expect_accept; this side asserts the builder normalizeToCanonical THROWS iff the row is rejected and,
// for accepted rows, reproduces the independently-computed canonical value+unit. Because both languages
// pin the SAME table, the recon accept-set and the builder convert-set cannot drift apart -- and the
// magnitude column also catches a 1000x-scale drift (the 2026-06-03 ETBE defect class), not just
// accept/reject. The e2e block then exercises the raw EPA (value,unit) -> canonical invariant
// table-driven across mass prefixes, with idempotency and the ETBE bad-shape regression.

interface ContractRow {
  input_key: string;
  raw_unit: string;
  raw_value: number;
  expect_accept: boolean;
  expect_canonical_value?: number;
  expect_canonical_unit?: string;
}
const rows = (fixtureRaw as unknown as { rows: ContractRow[] }).rows;
const accepted = rows.filter((r) => r.expect_accept);

// Tight tolerance: these are exact power-of-ten conversions, so only float-repr noise is allowed
// (NOT the 2% EPA-rounding tolerance used elsewhere -- here we want exactness).
function approx(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.abs(b) * 1e-9 + 1e-12;
}

// Extract the mass-prefix token from a raw unit's numerator (mirrors the builder numeratorPrefix
// shape): text before the first '/', strip non-alphanumerics, strip a leading 'per'. Makes the
// coverage assertion MEANINGFUL -- a substring check ('g' in 'mg/kg-day') is trivially satisfied, so
// deleting the only bare-'g' row would still pass; matching an actual prefix token does not.
function numeratorToken(rawUnit: string): string {
  return rawUnit.split('/')[0].replace(/[^a-z0-9]/gi, '').replace(/^per/i, '').toLowerCase();
}

function tryNormalize(r: ContractRow): { threw: boolean; out: { value: number; unit: string } | null } {
  try {
    return { threw: false, out: normalizeToCanonical(r.raw_value, r.raw_unit, r.input_key) };
  } catch {
    return { threw: true, out: null };
  }
}

describe('F3 unit contract: builder convert-set + magnitude match the shared fixture', () => {
  it('fixture is populated with a numeric raw_value on every row (AMEND-F3a)', () => {
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows.filter((r) => typeof r.raw_value !== 'number')).toEqual([]);
    // Accepted rows carry the canonical pair; rejected rows do not assert one.
    expect(
      accepted.filter((r) => typeof r.expect_canonical_value !== 'number' || typeof r.expect_canonical_unit !== 'string'),
    ).toEqual([]);
    expect(rows.filter((r) => !r.expect_accept && (r.expect_canonical_value !== undefined || r.expect_canonical_unit !== undefined))).toEqual([]);
  });

  it('normalizeToCanonical throws iff rejected, and reproduces the canonical value+unit on accepted rows', () => {
    const failures: string[] = [];
    for (const r of rows) {
      const { threw, out } = tryNormalize(r);
      if (threw === r.expect_accept) {
        failures.push(`${r.input_key} "${r.raw_unit}": contract expect_accept=${r.expect_accept} but builder ${threw ? 'threw' : 'converted'}`);
        continue;
      }
      if (r.expect_accept && out) {
        if (!approx(out.value, r.expect_canonical_value as number)) {
          failures.push(`${r.input_key} "${r.raw_unit}": builder value ${out.value} != expected ${r.expect_canonical_value}`);
        }
        if (out.unit !== r.expect_canonical_unit) {
          failures.push(`${r.input_key} "${r.raw_unit}": builder unit "${out.unit}" != expected "${r.expect_canonical_unit}"`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('F3 e2e canonicalization invariant: raw EPA -> canonical, idempotent, ETBE-shape caught', () => {
  it('the contract covers every mass prefix (ng/ug/mcg/mg/g) and all four input types', () => {
    for (const p of ['ng', 'ug', 'mcg', 'mg', 'g']) {
      expect(accepted.some((r) => numeratorToken(r.raw_unit) === p), `no accepted row with numerator prefix ${p}`).toBe(true);
    }
    for (const k of [
      'rfd_oral_mg_per_kg_bw_day',
      'sf_oral_per_mg_per_kg_bw_per_day',
      'rfc_inhalation_mg_per_m3',
      'unit_risk_inhalation_per_ug_m3',
    ]) {
      expect(accepted.some((r) => r.input_key === k), `missing accepted row for ${k}`).toBe(true);
    }
  });

  it('canonicalization is idempotent: re-normalizing the canonical pair is a no-op within tolerance', () => {
    const failures: string[] = [];
    for (const r of accepted) {
      const renorm = normalizeToCanonical(r.expect_canonical_value as number, r.expect_canonical_unit as string, r.input_key);
      if (!approx(renorm.value, r.expect_canonical_value as number)) {
        failures.push(`${r.input_key} "${r.expect_canonical_unit}": re-normalize ${renorm.value} != ${r.expect_canonical_value}`);
      }
      if (renorm.unit !== r.expect_canonical_unit) {
        failures.push(`${r.input_key}: re-normalize unit drift "${renorm.unit}" != "${r.expect_canonical_unit}"`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('catches the ETBE 1000x scale shape: 8 per mg/m3 IUR -> 0.008 per ug/m3, never 8', () => {
    const out = normalizeToCanonical(8, 'per mg/m3', 'unit_risk_inhalation_per_ug_m3');
    expect(out.unit).toBe('per ug/m3');
    expect(approx(out.value, 0.008)).toBe(true);
    expect(approx(out.value, 8)).toBe(false);
  });
});
