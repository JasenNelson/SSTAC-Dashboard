import { describe, it, expect } from 'vitest';

import {
  TEF_TABLE,
  TEF_EDITIONS,
  TEF_EDITION_QA,
  lookupTef,
  type TefEdition,
} from '../tefTable';

// tefTable.ts holds regulatory TEF numbers; a silent transcription slip is dangerous + invisible.
// The EXPECTED map below is an INDEPENDENT second transcription of the source values (SPEC Section 2
// for the WHO columns; HC v4.0 Table 4 / the DeVito extraction JSON for the DeVito column). The
// full-table cross-check asserts every one of the 29 x 5 cells equals its independently-keyed value,
// so a wrong or dropped cell fails a test rather than shipping. A censored "<x" source cell is
// encoded here as the string "<x" (mirrors the table's bound: 'upper').
//
// This proves table == source-transcription (double entry), NOT table == primary-truth; the per-
// edition qa flags carry the real trust level (DeVito verified; WHO columns needs_review).

type Expected = number | string; // number = exact; "<x" = censored upper bound

// Column order in each tuple: who-2005, who-1998-mammal, who-1998-avian, who-1998-fish, devito-2024.
const EXPECTED: Record<string, [Expected, Expected, Expected, Expected, Expected]> = {
  '2378-tcdd': [1.0, 1.0, 1.0, 1.0, 1.0],
  '12378-pecdd': [1.0, 1.0, 1.0, 1.0, 0.4],
  '123478-hxcdd': [0.1, 0.1, 0.05, 0.5, 0.09],
  '123678-hxcdd': [0.1, 0.1, 0.01, 0.01, 0.07],
  '123789-hxcdd': [0.1, 0.1, 0.1, 0.01, 0.05],
  '1234678-hpcdd': [0.01, 0.01, '<0.001', 0.001, 0.05],
  ocdd: [0.0003, 0.0001, '<0.0001', '<0.0001', 0.001],
  '2378-tcdf': [0.1, 0.1, 1.0, 0.05, 0.07],
  '12378-pecdf': [0.03, 0.05, 0.1, 0.05, 0.01],
  '23478-pecdf': [0.3, 0.5, 1.0, 0.5, 0.1],
  '123478-hxcdf': [0.1, 0.1, 0.1, 0.1, 0.3],
  '123678-hxcdf': [0.1, 0.1, 0.1, 0.1, 0.09],
  '123789-hxcdf': [0.1, 0.1, 0.1, 0.1, 0.2],
  '234678-hxcdf': [0.1, 0.1, 0.1, 0.1, 0.1],
  '1234678-hpcdf': [0.01, 0.01, 0.01, 0.01, 0.02],
  '1234789-hpcdf': [0.01, 0.01, 0.01, 0.01, 0.1],
  ocdf: [0.0003, 0.0001, '<0.0001', '<0.0001', 0.002],
  'pcb-77': [0.0001, 0.0001, 0.05, 0.0001, 0.0003],
  'pcb-81': [0.0003, 0.0001, 0.1, 0.0005, 0.006],
  'pcb-126': [0.1, 0.1, 0.1, 0.005, 0.05],
  'pcb-169': [0.03, 0.01, 0.001, 0.00005, 0.005],
  'pcb-105': [0.00003, 0.0001, 0.0001, '<0.000005', 0.00003],
  'pcb-114': [0.00003, 0.0005, 0.0001, '<0.000005', 0.00003],
  'pcb-118': [0.00003, 0.0001, 0.00001, '<0.000005', 0.00003],
  'pcb-123': [0.00003, 0.0001, 0.00001, '<0.000005', 0.00003],
  'pcb-156': [0.00003, 0.0005, 0.0001, '<0.000005', 0.00003],
  'pcb-157': [0.00003, 0.0005, 0.0001, '<0.000005', 0.00003],
  'pcb-167': [0.00003, 0.00001, 0.00001, '<0.000005', 0.00003],
  'pcb-189': [0.00003, 0.0001, 0.00001, '<0.000005', 0.00003],
};

function parseExpected(e: Expected): { factor: number; bound: 'exact' | 'upper' } {
  if (typeof e === 'number') return { factor: e, bound: 'exact' };
  return { factor: Number(e.slice(1)), bound: 'upper' };
}

describe('TEF_TABLE structure', () => {
  it('has exactly 29 congeners (7 PCDD + 10 PCDF + 4 non-ortho + 8 mono-ortho)', () => {
    expect(TEF_TABLE).toHaveLength(29);
    const bySection = TEF_TABLE.reduce<Record<string, number>>((acc, r) => {
      acc[r.section] = (acc[r.section] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySection).toEqual({
      pcdd: 7,
      pcdf: 10,
      'pcb-non-ortho': 4,
      'pcb-mono-ortho': 8,
    });
  });

  it('has unique congener ids and a cell for every edition', () => {
    const ids = new Set(TEF_TABLE.map((r) => r.congenerId));
    expect(ids.size).toBe(29);
    for (const row of TEF_TABLE) {
      for (const edition of TEF_EDITIONS) {
        expect(row.tef[edition]).toBeDefined();
      }
    }
  });

  it('every EXPECTED key is present in the table and vice versa', () => {
    const ids = new Set(TEF_TABLE.map((r) => r.congenerId));
    expect(new Set(Object.keys(EXPECTED))).toEqual(ids);
  });
});

describe('TEF_TABLE full-table cross-check (independent double-entry)', () => {
  for (const [id, tuple] of Object.entries(EXPECTED)) {
    TEF_EDITIONS.forEach((edition, i) => {
      it(`${id} / ${edition} matches source`, () => {
        const { factor, bound } = parseExpected(tuple[i]);
        const got = lookupTef(id, edition);
        expect(got.factor).toBeCloseTo(factor, 12);
        expect(got.bound).toBe(bound);
      });
    });
  }
});

describe('lookupTef -- bounds, qa, warnings', () => {
  it('surfaces censored upper-bound cells with a warning', () => {
    const got = lookupTef('ocdd', 'who-1998-avian');
    expect(got.bound).toBe('upper');
    expect(got.warning).toMatch(/upper bound/i);
  });

  it('exact cells carry no upper-bound warning', () => {
    const got = lookupTef('2378-tcdd', 'who-2005');
    expect(got.bound).toBe('exact');
    expect(got.warning).toBeNull();
  });

  it('only the DeVito-2024 edition is verified; WHO editions stay needs_review', () => {
    expect(TEF_EDITION_QA['who-2022-devito-2024']).toBe('verified');
    expect(TEF_EDITION_QA['who-2005']).toBe('needs_review');
    expect(TEF_EDITION_QA['who-1998-mammal']).toBe('needs_review');
    expect(TEF_EDITION_QA['who-1998-avian']).toBe('needs_review');
    expect(TEF_EDITION_QA['who-1998-fish']).toBe('needs_review');
    expect(lookupTef('pcb-126', 'who-2022-devito-2024').qa).toBe('verified');
    expect(lookupTef('pcb-126', 'who-2005').qa).toBe('needs_review');
  });

  it('fails closed (null + warning) on an unknown congener, never a silent 0', () => {
    const got = lookupTef('not-a-congener', 'who-2005');
    expect(got.factor).toBeNull();
    expect(got.warning).toMatch(/unknown congener/i);
  });

  it('fails closed on an unknown edition', () => {
    const got = lookupTef('2378-tcdd', 'who-9999' as unknown as TefEdition);
    expect(got.factor).toBeNull();
    expect(got.warning).toMatch(/unknown tef edition/i);
  });
});
