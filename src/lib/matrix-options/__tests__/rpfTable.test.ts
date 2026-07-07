import { describe, it, expect } from 'vitest';

import {
  RPF_TABLE,
  RPF_SCHEMES,
  RPF_SCHEME_QA,
  lookupRpf,
  type RpfScheme,
} from '../rpfTable';

// rpfTable.ts holds regulatory RPF numbers. EXPECTED below is an INDEPENDENT second transcription of
// the source values (SPEC Section 3 for nisbet-1992 / hc-pqra-v3 / epa-2010-draft; A2 verification for
// ccme-2010; who-1998-pah mirrors the CCME lineage placeholder pending framework-A2). The full-table
// cross-check asserts every 24 x 5 cell. Cell encoding: a number = an RPF value; 'excl' = excluded
// (non-carcinogenic); 'nd' = not defined in that scheme.

type Cell = number | 'excl' | 'nd';

// Column order: nisbet-1992, hc-pqra-v3, epa-2010-draft, ccme-2010, who-1998-pah.
const EXPECTED: Record<string, [Cell, Cell, Cell, Cell, Cell]> = {
  naphthalene: [0.001, 'excl', 'excl', 'excl', 'excl'],
  acenaphthylene: [0.001, 'excl', 'excl', 'excl', 'excl'],
  acenaphthene: [0.001, 'excl', 'excl', 'excl', 'excl'],
  fluorene: [0.001, 'excl', 'excl', 'excl', 'excl'],
  phenanthrene: [0.001, 0.001, 'excl', 'excl', 'excl'],
  anthracene: [0.01, 'excl', 'excl', 'excl', 'excl'],
  fluoranthene: [0.001, 'excl', 'excl', 'excl', 'excl'],
  pyrene: [0.001, 'excl', 'excl', 'excl', 'excl'],
  benz_a_anthracene: [0.1, 0.1, 0.2, 0.1, 0.1],
  chrysene: [0.01, 0.01, 0.1, 0.01, 0.01],
  // b/j/k are not-defined under the group schemes (hc/ccme/who) -- see benzo_bjk_fluoranthene; kept
  // per-isomer only under nisbet-1992 + epa-2010-draft. Corrected per CCME 2010 Table 6-6 (primary).
  benzo_b_fluoranthene: [0.1, 'nd', 0.8, 'nd', 'nd'],
  benzo_j_fluoranthene: [0.1, 'nd', 0.3, 'nd', 'nd'],
  benzo_k_fluoranthene: [0.1, 'nd', 0.03, 'nd', 'nd'],
  benzo_bjk_fluoranthene: ['nd', 0.1, 'nd', 0.1, 0.1],
  benzo_a_pyrene: [1.0, 1.0, 1.0, 1.0, 1.0],
  dibenz_ah_anthracene: [5.0, 1.0, 10, 1.0, 1.0],
  indeno_123cd_pyrene: [0.1, 0.1, 0.07, 0.1, 0.1],
  benzo_ghi_perylene: [0.01, 0.01, 0.009, 0.01, 0.01],
  dibenzo_ae_pyrene: [1.0, 1.0, 0.4, 'nd', 'nd'],
  dibenzo_ah_pyrene: [10, 10, 0.9, 'nd', 'nd'],
  dibenzo_ai_pyrene: [10, 10, 0.6, 'nd', 'nd'],
  dibenzo_al_pyrene: [10, 10, 30, 'nd', 'nd'],
  '5_methylchrysene': ['nd', 1.0, 'nd', 'nd', 'nd'],
  cyclopenta_cd_pyrene: ['nd', 'nd', 0.4, 'nd', 'nd'],
};

describe('RPF_TABLE structure', () => {
  it('has 24 PAH rows with unique keys and a cell for every scheme', () => {
    expect(RPF_TABLE).toHaveLength(24);
    const keys = new Set(RPF_TABLE.map((r) => r.pahKey));
    expect(keys.size).toBe(24);
    for (const row of RPF_TABLE) {
      for (const scheme of RPF_SCHEMES) {
        expect(row.rpf[scheme]).toBeDefined();
      }
    }
  });

  it('EXPECTED keys match the table keys exactly', () => {
    expect(new Set(Object.keys(EXPECTED))).toEqual(
      new Set(RPF_TABLE.map((r) => r.pahKey)),
    );
  });

  it('benzo[a]pyrene is the index (RPF 1.0) in every value-bearing scheme', () => {
    for (const scheme of RPF_SCHEMES) {
      expect(lookupRpf('benzo_a_pyrene', scheme).rpf).toBe(1.0);
    }
  });
});

describe('RPF_TABLE full-table cross-check (independent double-entry)', () => {
  for (const [key, tuple] of Object.entries(EXPECTED)) {
    RPF_SCHEMES.forEach((scheme, i) => {
      it(`${key} / ${scheme} matches source`, () => {
        const expected = tuple[i];
        const got = lookupRpf(key, scheme);
        if (expected === 'excl') {
          expect(got.kind).toBe('excluded');
          expect(got.rpf).toBe(0);
        } else if (expected === 'nd') {
          expect(got.kind).toBe('not-defined');
          expect(got.rpf).toBeNull();
        } else {
          expect(got.kind).toBe('value');
          expect(got.rpf).toBeCloseTo(expected, 12);
        }
      });
    });
  }
});

describe('lookupRpf -- fail-closed + qa semantics', () => {
  it('excluded PAH contributes 0 with an informational warning (not silently dropped)', () => {
    const got = lookupRpf('naphthalene', 'hc-pqra-v3');
    expect(got.rpf).toBe(0);
    expect(got.kind).toBe('excluded');
    expect(got.warning).toMatch(/excluded/i);
  });

  it('not-defined PAH fails closed (null, warning) -- never coerced to 0', () => {
    const got = lookupRpf('cyclopenta_cd_pyrene', 'nisbet-1992');
    expect(got.rpf).toBeNull();
    expect(got.kind).toBe('not-defined');
    expect(got.warning).toMatch(/no rpf defined/i);
  });

  it('unknown PAH key fails closed', () => {
    const got = lookupRpf('not-a-pah', 'nisbet-1992');
    expect(got.rpf).toBeNull();
    expect(got.warning).toMatch(/unknown pah key/i);
  });

  it('unknown scheme fails closed', () => {
    const got = lookupRpf('benzo_a_pyrene', 'made-up' as unknown as RpfScheme);
    expect(got.rpf).toBeNull();
    expect(got.warning).toMatch(/unknown rpf scheme/i);
  });

  it('nisbet-1992 and ccme-2010 are verified; hc/epa-2010/who-1998-pah are needs_review', () => {
    expect(RPF_SCHEME_QA['nisbet-1992']).toBe('verified');
    expect(RPF_SCHEME_QA['ccme-2010']).toBe('verified');
    expect(RPF_SCHEME_QA['hc-pqra-v3']).toBe('needs_review');
    expect(RPF_SCHEME_QA['epa-2010-draft']).toBe('needs_review');
    expect(RPF_SCHEME_QA['who-1998-pah']).toBe('needs_review');
  });

  it('a needs_review scheme value carries a provisional warning', () => {
    const got = lookupRpf('benz_a_anthracene', 'epa-2010-draft');
    expect(got.rpf).toBe(0.2);
    expect(got.warning).toMatch(/needs_review|provisional/i);
  });
});
