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
  // dual-approved: US EPA IRIS (US_federal) + Health Canada (Canada_federal) both approve the same
  // value. The Canada_federal jurisdiction default (BC Protocol 1 v5.0 Section 4.4: Health Canada is
  // the default source where values are concordant) now resolves these to the HC row.
  const dualApprovedHC: Array<{ substance: string; value: number; pvid: string }> = [
    { substance: 'naphthalene', value: 0.02, pvid: 'pv-hc-naphthalene-hh-direct-rfd' },
    { substance: 'pyrene', value: 0.03, pvid: 'pv-hc-pyrene-hh-direct-rfd' },
  ];
  for (const c of dualApprovedHC) {
    it(`attributes HH-direct ${c.substance} rfd to the Health Canada row (Protocol 1 4.4 default)`, () => {
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
      expect(row.catalog_record?.jurisdiction).toBe('Canada_federal');
      expect(row.catalog_record?.parameter_value_id).toBe(c.pvid);
    });
  }

  // Frame-aware: under a US regulatory frame the same dual-approved tie must prefer the US_federal
  // (IRIS) row instead of Health Canada, so the primary provenance agrees with the frame's evidence
  // filter (BC Protocol 1 4.4 HC-default applies only to BC/Canada frames).
  const usFrameDualApproved: Array<{ substance: string; value: number; pvid: string }> = [
    { substance: 'naphthalene', value: 0.02, pvid: 'pv-iris-naphthalene-hh-direct-rfd' },
    { substance: 'pyrene', value: 0.03, pvid: 'pv-iris-pyrene-hh-direct-rfd' },
  ];
  for (const c of usFrameDualApproved) {
    it(`attributes HH-direct ${c.substance} rfd to the US EPA IRIS row under a US frame`, () => {
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
      const [row] = resolveProvenanceRows(used, 'us-epa-usace-sediment');
      expect(row.catalog_record, c.substance).not.toBeNull();
      expect(row.catalog_record?.jurisdiction).toBe('US_federal');
      expect(row.catalog_record?.parameter_value_id).toBe(c.pvid);
    });
  }
});

describe('resolveProvenanceRows -- Lane 1 metals cohort SOURCED (beryllium + selenium, 2026-07-03)', () => {
  // selenium: exactly one approved IRIS row + a same-valued needs_review BC P28 sibling ->
  // approved-tiebreak (#461) attributes to the IRIS row, frame-independent (SOURCED, not scaffold).
  it('attributes HH-direct selenium rfd to the single approved IRIS row (SOURCED)', () => {
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        label: 'rfd',
        value: 0.005,
        unit: 'mg/kg-bw/day',
        role: 'current calculator default',
        pathway: 'human-health-direct',
        substance_key: 'selenium',
      },
    ];
    const [row] = resolveProvenanceRows(used);
    expect(row.catalog_record).not.toBeNull();
    expect(row.catalog_record?.qa_status).toBe('approved');
    expect(row.catalog_record?.evidence_support_status).toBe('approved_source_backed');
    expect(row.catalog_record?.jurisdiction).toBe('US_federal');
    expect(row.catalog_record?.parameter_value_id).toBe('pv-iris-selenium-hh-direct-rfd');
    expect(row.sources.length).toBeGreaterThan(0);
  });

  // beryllium: dual-approved IRIS (US_federal) + HC (Canada_federal) at the identical value 0.002,
  // plus a needs_review P28 sibling -> the approved-tiebreak cannot break the 2-approved tie, so the
  // frame-aware jurisdiction tiebreak (#462) decides: HC under the default (BC) frame.
  it('attributes HH-direct beryllium rfd to the Health Canada row under the default (BC) frame (SOURCED)', () => {
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        label: 'rfd',
        value: 0.002,
        unit: 'mg/kg-bw/day',
        role: 'current calculator default',
        pathway: 'human-health-direct',
        substance_key: 'beryllium',
      },
    ];
    const [row] = resolveProvenanceRows(used);
    expect(row.catalog_record).not.toBeNull();
    expect(row.catalog_record?.qa_status).toBe('approved');
    expect(row.catalog_record?.evidence_support_status).toBe('approved_source_backed');
    expect(row.catalog_record?.jurisdiction).toBe('Canada_federal');
    expect(row.catalog_record?.parameter_value_id).toBe('pv-hc-beryllium-hh-direct-rfd');
    expect(row.sources.length).toBeGreaterThan(0);
  });

  // beryllium under a US regulatory frame: the same dual-approved tie must prefer the US_federal
  // (IRIS) row so provenance agrees with the frame's evidence filter (BC Protocol 1 4.4 HC-default
  // applies only to BC/Canada frames).
  it('attributes HH-direct beryllium rfd to the US EPA IRIS row under a US frame (SOURCED)', () => {
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'rfd_oral_mg_per_kg_bw_day',
        label: 'rfd',
        value: 0.002,
        unit: 'mg/kg-bw/day',
        role: 'current calculator default',
        pathway: 'human-health-direct',
        substance_key: 'beryllium',
      },
    ];
    const [row] = resolveProvenanceRows(used, 'us-epa-usace-sediment');
    expect(row.catalog_record).not.toBeNull();
    expect(row.catalog_record?.qa_status).toBe('approved');
    expect(row.catalog_record?.evidence_support_status).toBe('approved_source_backed');
    expect(row.catalog_record?.jurisdiction).toBe('US_federal');
    expect(row.catalog_record?.parameter_value_id).toBe('pv-iris-beryllium-hh-direct-rfd');
    expect(row.sources.length).toBeGreaterThan(0);
  });
});

describe('resolveProvenanceRows -- Phase 1a metal-salts + organometallics SOURCED (2026-07-04)', () => {
  // 7 own-key oral RfD wires, each with a single approved catalog row at the wired value -> resolves
  // SOURCED by value-match (no tiebreak needed). Values live-verified against IRIS/HC 2026-07-04.
  const cases: Array<{ substance: string; value: number; pvid: string; jurisdiction: string }> = [
    { substance: 'mercuric_chloride_hgcl2', value: 0.0003, pvid: 'pv-iris-mercuric_chloride_hgcl2-hh-direct-rfd', jurisdiction: 'US_federal' },
    { substance: 'selenious_acid', value: 0.005, pvid: 'pv-iris-selenious_acid-hh-direct-rfd', jurisdiction: 'US_federal' },
    { substance: 'uranium_soluble_salts', value: 0.003, pvid: 'pv-iris-uranium_soluble_salts-hh-direct-rfd', jurisdiction: 'US_federal' },
    { substance: 'nickel_soluble_salts', value: 0.02, pvid: 'pv-iris-nickel_soluble_salts-hh-direct-rfd', jurisdiction: 'US_federal' },
    { substance: 'nickel_sulfate', value: 0.012, pvid: 'pv-hc-nickel_sulfate-hh-direct-rfd', jurisdiction: 'Canada_federal' },
    { substance: 'tetraethyl_lead', value: 0.0000001, pvid: 'pv-iris-tetraethyl_lead-hh-direct-rfd', jurisdiction: 'US_federal' },
    { substance: 'tributyltin_oxide_tbto', value: 0.0003, pvid: 'pv-iris-tributyltin_oxide_tbto-hh-direct-rfd', jurisdiction: 'US_federal' },
  ];
  for (const c of cases) {
    it(`attributes HH-direct ${c.substance} rfd to its single approved row (SOURCED)`, () => {
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
      expect(row.catalog_record?.jurisdiction).toBe(c.jurisdiction);
      expect(row.catalog_record?.parameter_value_id).toBe(c.pvid);
      expect(row.sources.length).toBeGreaterThan(0);
    });
  }
});

describe('resolveProvenanceRows -- Phase 2 batch A1 HC-default backfills SOURCED (2026-07-04)', () => {
  // toluene/ethylbenzene/xylenes seeded at the HC FCSAP TRV v4.0 oral TDI (BC Protocol 1 s4.4
  // Health Canada default). Each HC value uniquely value-matches the approved Canada_federal row
  // (the IRIS/P28 rows sit at the higher IRIS value), so it resolves SOURCED to Health Canada.
  const cases: Array<{ substance: string; value: number; pvid: string }> = [
    { substance: 'toluene', value: 0.0097, pvid: 'pv-hc-toluene-hh-direct-rfd' },
    { substance: 'ethylbenzene', value: 0.022, pvid: 'pv-hc-ethylbenzene-hh-direct-rfd' },
    { substance: 'xylenes', value: 0.013, pvid: 'pv-hc-xylenes-hh-direct-rfd' },
  ];
  for (const c of cases) {
    it(`attributes HH-direct ${c.substance} rfd to the Health Canada row (SOURCED)`, () => {
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
      expect(row.catalog_record?.jurisdiction).toBe('Canada_federal');
      expect(row.catalog_record?.parameter_value_id).toBe(c.pvid);
      expect(row.sources.length).toBeGreaterThan(0);
    });
  }
});

describe('resolveProvenanceRows -- Phase 2 batch A2 HC-default backfills SOURCED (2026-07-04)', () => {
  // carbon_tetrachloride/tetrachloroethylene seeded at the HC FCSAP TRV v4.0 oral TDI (BC Protocol 1
  // s4.4 HC default). Each HC value uniquely value-matches its approved Canada_federal row -> SOURCED.
  const cases: Array<{ substance: string; value: number; pvid: string }> = [
    { substance: 'carbon_tetrachloride', value: 0.00071, pvid: 'pv-hc-carbon_tetrachloride-hh-direct-rfd' },
    { substance: 'tetrachloroethylene', value: 0.0047, pvid: 'pv-hc-tetrachloroethylene-hh-direct-rfd' },
  ];
  for (const c of cases) {
    it(`attributes HH-direct ${c.substance} rfd to the Health Canada row (SOURCED)`, () => {
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
      expect(row.catalog_record?.jurisdiction).toBe('Canada_federal');
      expect(row.catalog_record?.parameter_value_id).toBe(c.pvid);
      expect(row.sources.length).toBeGreaterThan(0);
    });
  }
});

describe('resolveProvenanceRows -- Phase 2 batch A3 SOURCED (2026-07-04)', () => {
  // chlorobenzene/dichlorobenzene_1_2 = HC-default (SOURCED to Canada_federal); trichloroethylene =
  // most-protective IRIS override (SOURCED to US_federal). Each value uniquely matches its approved row.
  const cases: Array<{ substance: string; value: number; pvid: string; jur: string }> = [
    { substance: 'chlorobenzene', value: 0.43, pvid: 'pv-hc-chlorobenzene-hh-direct-rfd', jur: 'Canada_federal' },
    { substance: 'dichlorobenzene_1_2', value: 0.43, pvid: 'pv-hc-dichlorobenzene_1_2-hh-direct-rfd', jur: 'Canada_federal' },
    { substance: 'trichloroethylene', value: 0.0005, pvid: 'pv-iris-trichloroethylene-hh-direct-rfd', jur: 'US_federal' },
  ];
  for (const c of cases) {
    it(`attributes HH-direct ${c.substance} rfd to its approved row (SOURCED)`, () => {
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
      expect(row.catalog_record?.jurisdiction).toBe(c.jur);
      expect(row.catalog_record?.parameter_value_id).toBe(c.pvid);
      expect(row.sources.length).toBeGreaterThan(0);
    });
  }
});
