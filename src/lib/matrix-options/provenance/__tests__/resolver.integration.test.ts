// Integration test: resolveProvenanceRows against the REAL wired catalog (no mocks), guarding the
// value-aware tuple fallback. Two things must hold once eco_values.json is wired in:
//  1. HH-direct default-load TRV rows (rfd/sf), which are emitted WITHOUT a parameter_value_id and
//     seed from the substanceLibrary, must keep attribution to their current_default catalog record
//     even though a same-valued IRIS/P28 sibling row shares the tuple (the current_default tie-break).
//  2. An eco library-seeded value that matches NO catalog candidate must resolve to null (no
//     mis-attribution), which is the whole reason the eco rows were not wired until now.
// Plain ASCII only (code point <= 127).
import { describe, it, expect } from 'vitest';
import { resolveProvenanceRows } from '../resolver';
import type { CalculatorUsedValue } from '../types';

describe('resolveProvenanceRows -- real wired catalog (value-aware tuple fallback regression)', () => {
  // unit MUST mirror what HHDirectContactCalculator emits (rfd 'mg/kg-bw/day', sf
  // 'per mg/kg-bw/day') -- the value-aware match is unit-aware, so a wrong unit would (correctly) fail.
  const hhDefaultLoad: Array<{ substance: string; input: string; value: number; unit: string }> = [
    // Values updated 2026-07-02 for the IRIS 2025 inorganic-arsenic reassessment
    // (RfD 3e-4 -> 6e-5, SF 1.5 -> 32); these must mirror the live catalog current_default
    // rows (pv-arsenic-hh-direct-rfd / pv-arsenic-hh-direct-slope) for the tuple match to hold.
    { substance: 'arsenic_inorganic', input: 'rfd_oral_mg_per_kg_bw_day', value: 0.00006, unit: 'mg/kg-bw/day' },
    { substance: 'arsenic_inorganic', input: 'sf_oral_per_mg_per_kg_bw_per_day', value: 32, unit: 'per mg/kg-bw/day' },
    { substance: 'zinc', input: 'rfd_oral_mg_per_kg_bw_day', value: 0.3, unit: 'mg/kg-bw/day' },
    { substance: 'cadmium', input: 'rfd_oral_mg_per_kg_bw_day', value: 0.001, unit: 'mg/kg-bw/day' },
    { substance: 'methylmercury', input: 'rfd_oral_mg_per_kg_bw_day', value: 0.0001, unit: 'mg/kg-bw/day' },
  ];

  for (const c of hhDefaultLoad) {
    it(`keeps current_default attribution for HH-direct ${c.substance} ${c.input}`, () => {
      const used: CalculatorUsedValue[] = [
        {
          input_key: c.input,
          label: c.input,
          value: c.value,
          unit: c.unit,
          role: 'current calculator default',
          pathway: 'human-health-direct',
          substance_key: c.substance,
        },
      ];
      const [row] = resolveProvenanceRows(used);
      expect(row.catalog_record, `${c.substance} ${c.input}`).not.toBeNull();
      expect(row.catalog_record?.default_status).toBe('current_default');
      expect(row.sources.length).toBeGreaterThan(0);
    });
  }

  it('does NOT mis-attribute an eco-food library value to a needs_review TRV candidate', () => {
    // arsenic eco-food catalog TRVs are 1.04 (mammal) + 4.4 (bird); the substanceLibrary value (0.043)
    // matches neither, so the resolver must return null rather than attributing to either row.
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'trv_eco_mg_per_kg_bw_day',
        label: 'Eco TRV',
        value: 0.043,
        unit: 'mg/kg-bw/day',
        role: 'current calculator default',
        pathway: 'eco-food-bsaf',
        substance_key: 'arsenic_inorganic',
      },
    ];
    const [row] = resolveProvenanceRows(used);
    expect(row.catalog_record).toBeNull();
    expect(row.qa_status).toBe('not_cataloged');
  });
});

describe('resolveProvenanceRows -- approved-tiebreak fallback (2026-07-03) + dual-approved current_default', () => {
  // needs_review-dupe: exactly one approved IRIS/HC row + a same-valued needs_review BC P28 sibling.
  // The approved-tiebreak fallback (scoped AFTER the current_default tiebreak) now attributes to the
  // single approved row instead of returning null (unsourced scaffold).
  const needsReviewDupe: Array<{ substance: string; value: number }> = [
    { substance: 'manganese', value: 0.14 },
    { substance: 'benzene', value: 0.004 },
    { substance: 'hexachlorobenzene', value: 0.0008 },
  ];
  for (const c of needsReviewDupe) {
    it(`attributes HH-direct ${c.substance} rfd to the single approved row (was unsourced)`, () => {
      const used: CalculatorUsedValue[] = [
        {
          input_key: 'rfd_oral_mg_per_kg_bw_day',
          label: 'rfd',
          value: c.value,
          unit: 'mg/kg-bw/day',
          role: 'current calculator default',
          pathway: 'human-health-direct',
          substance_key: c.substance,
        },
      ];
      const [row] = resolveProvenanceRows(used);
      expect(row.catalog_record, c.substance).not.toBeNull();
      expect(row.catalog_record?.qa_status).toBe('approved');
      expect(row.sources.length).toBeGreaterThan(0);
    });
  }
  // NOTE: the 2 genuinely dual-approved cases (naphthalene, pyrene -- IRIS + HC both approved at the
  // same value) are NOT fixed here; no qa_status rule can break that tie. They need an owner
  // jurisdiction pick (IRIS vs HC) + a current_default marker, deferred to a follow-up.
});
