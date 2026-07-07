import { describe, it, expect } from 'vitest';

import { ADAF_TABLE, ADAF_QA, lookupAdaf } from '../adafTable';

// ADAF values are the canonical US EPA 2005 3-bin set: 0-<2 = 10, 2-<16 = 3, 16+ = 1.
// Expectations below are the published values, independently stated (not read back from the table).

describe('ADAF_TABLE', () => {
  it('is the canonical 3-bin EPA 2005 set', () => {
    expect(ADAF_TABLE).toHaveLength(3);
    expect(ADAF_TABLE.map((r) => r.adaf)).toEqual([10, 3, 1]);
  });

  it('bins are contiguous and cover [0, inf)', () => {
    expect(ADAF_TABLE[0].lowerYears).toBe(0);
    expect(ADAF_TABLE[0].upperYears).toBe(ADAF_TABLE[1].lowerYears);
    expect(ADAF_TABLE[1].upperYears).toBe(ADAF_TABLE[2].lowerYears);
    expect(ADAF_TABLE[2].upperYears).toBeNull();
  });
});

describe('lookupAdaf', () => {
  const cases: Array<[number, number]> = [
    [0, 10],
    [1.99, 10],
    [2, 3],
    [10, 3],
    [15.99, 3],
    [16, 1],
    [45, 1],
    [1000, 1],
  ];
  for (const [age, adaf] of cases) {
    it(`age ${age} -> ADAF ${adaf}`, () => {
      const got = lookupAdaf(age);
      expect(got.adaf).toBe(adaf);
      expect(got.qa).toBe(ADAF_QA);
      expect(got.warning).toBeNull();
    });
  }

  it('boundary is inclusive-lower / exclusive-upper (2.0 -> 3, not 10)', () => {
    expect(lookupAdaf(2).adaf).toBe(3);
    expect(lookupAdaf(16).adaf).toBe(1);
  });

  it('fails closed on a negative or non-finite age', () => {
    expect(lookupAdaf(-1).adaf).toBeNull();
    expect(lookupAdaf(-1).warning).toMatch(/invalid age/i);
    expect(lookupAdaf(Number.NaN).adaf).toBeNull();
  });
});
