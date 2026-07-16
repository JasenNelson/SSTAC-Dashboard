import { describe, it, expect } from 'vitest';

import { computeBaPeq, computeBaPeqLifetime, CANONICAL_UNIT } from '../cumulative';
import type { AgeBinFraction, BaPeqEntry } from '../cumulative';

// Lifetime multi-window ADAF weighting: effective ADAF = sum(ADAF(bin) * bin.exposureFraction),
// applied to the NO-ADAF (ADAF = 1) base BaP-eq. Anchor cases use HAND-COMPUTED expected values.

const THREE_PAH_ENTRIES: readonly BaPeqEntry[] = [
  { pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' },
  { pahKey: 'benz_a_anthracene', concentration: 2, unit: 'mg/kg' },
  { pahKey: 'chrysene', concentration: 10, unit: 'mg/kg' },
];

describe('computeBaPeqLifetime -- multi-window ADAF weighting', () => {
  it('hand-computed happy path: fractions 0.1/0.5/0.4 -> effective ADAF 2.9', () => {
    // BaP 1.0 + BaA 0.2 + chrysene 0.1 = 1.3 (no-ADAF base, hand-computed same as
    // computeBaPeq's own hc-pqra-v3 anchor case). Effective ADAF = 10*0.1 + 3*0.5 + 1*0.4
    //   = 1.0 + 1.5 + 0.4 = 2.9. Total = 1.3 * 2.9 = 3.77.
    const ageBins: AgeBinFraction[] = [
      { ageBin: '0-<2', exposureFraction: 0.1 },
      { ageBin: '2-<16', exposureFraction: 0.5 },
      { ageBin: '16+', exposureFraction: 0.4 },
    ];
    const base = computeBaPeq(THREE_PAH_ENTRIES, 'hc-pqra-v3', {});
    expect(base.blocked).toBe(false);
    expect(base.equivalent).toBeCloseTo(1.3, 12);

    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', ageBins);
    expect(res.blocked).toBe(false);
    expect(res.equivalentUnit).toBe(CANONICAL_UNIT);
    expect(res.equivalent).toBeCloseTo(base.equivalent * 2.9, 12);
    expect(res.equivalent).toBeCloseTo(3.77, 12);

    // Per-entry breakdown is scaled the same way: contribution = base contribution * effective ADAF;
    // factor / concentrationNorm are left untouched (mirrors computeBaPeq's own single-scalar contract).
    const bapRow = res.contributions.find((c) => c.componentId === 'benzo_a_pyrene');
    const baseBapRow = base.contributions.find((c) => c.componentId === 'benzo_a_pyrene');
    expect(bapRow?.factor).toBe(baseBapRow?.factor);
    expect(bapRow?.concentrationNorm).toBe(baseBapRow?.concentrationNorm);
    expect(bapRow?.contribution).toBeCloseTo((baseBapRow?.contribution ?? 0) * 2.9, 12);
  });

  it('all-adult ({16+: 1.0}) -> effective ADAF 1.0 -> equals the no-ADAF base', () => {
    const ageBins: AgeBinFraction[] = [{ ageBin: '16+', exposureFraction: 1.0 }];
    const base = computeBaPeq(THREE_PAH_ENTRIES, 'hc-pqra-v3', {});
    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', ageBins);
    expect(res.blocked).toBe(false);
    expect(res.equivalent).toBeCloseTo(base.equivalent, 12);
    expect(res.equivalent).toBeCloseTo(1.3, 12);
  });

  it('blocks on empty ageBins', () => {
    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', []);
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /no age bins supplied/i.test(w))).toBe(true);
  });

  it('blocks on a non-finite exposureFraction (NaN)', () => {
    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', [
      { ageBin: '16+', exposureFraction: Number.NaN },
    ]);
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /invalid exposureFraction/i.test(w))).toBe(true);
  });

  it('blocks on a non-finite exposureFraction (Infinity)', () => {
    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', [
      { ageBin: '16+', exposureFraction: Number.POSITIVE_INFINITY },
    ]);
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /invalid exposureFraction/i.test(w))).toBe(true);
  });

  it('blocks on a negative exposureFraction', () => {
    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', [
      { ageBin: '0-<2', exposureFraction: -0.1 },
      { ageBin: '16+', exposureFraction: 1.1 },
    ]);
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /invalid exposureFraction/i.test(w))).toBe(true);
  });

  it('blocks on an exposureFraction > 1', () => {
    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', [
      { ageBin: '16+', exposureFraction: 1.5 },
    ]);
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /invalid exposureFraction/i.test(w))).toBe(true);
  });

  it('blocks when exposureFractions do not sum to 1.0', () => {
    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', [
      { ageBin: '0-<2', exposureFraction: 0.2 },
      { ageBin: '16+', exposureFraction: 0.5 },
    ]);
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /not 1\.0/i.test(w))).toBe(true);
  });

  it('blocks on an ageBin not in ADAF_TABLE', () => {
    const res = computeBaPeqLifetime(
      THREE_PAH_ENTRIES,
      'hc-pqra-v3',
      [{ ageBin: 'not-a-bin', exposureFraction: 1.0 }] as unknown as AgeBinFraction[],
    );
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /unknown age bin/i.test(w))).toBe(true);
  });

  it('blocks on a duplicate ageBin', () => {
    const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', [
      { ageBin: '16+', exposureFraction: 0.5 },
      { ageBin: '16+', exposureFraction: 0.5 },
    ]);
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /duplicate age bin/i.test(w))).toBe(true);
  });

  it('blocks on a null or undefined age bin entry (malformed array element)', () => {
    for (const bad of [[null], [undefined]] as unknown as AgeBinFraction[][]) {
      const res = computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', bad);
      expect(res.blocked).toBe(true);
      expect(res.warnings.some((w) => /malformed age bin entry/i.test(w))).toBe(true);
    }
  });

  it('propagates a blocked base BaP-eq unchanged (not-defined PAH under nisbet-1992)', () => {
    const blockingEntries: readonly BaPeqEntry[] = [
      { pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' },
      { pahKey: 'cyclopenta_cd_pyrene', concentration: 5, unit: 'mg/kg' }, // not-defined under nisbet
    ];
    const base = computeBaPeq(blockingEntries, 'nisbet-1992', {});
    expect(base.blocked).toBe(true);

    const res = computeBaPeqLifetime(blockingEntries, 'nisbet-1992', [
      { ageBin: '16+', exposureFraction: 1.0 },
    ]);
    expect(res.blocked).toBe(true);
    expect(res.warnings).toEqual(base.warnings);
    expect(res.equivalent).toBe(base.equivalent);
  });

  it('never throws on malformed input (catch-all fail-closed fuzz)', () => {
    const malformedAgeBins: unknown[] = [
      [],
      [{ ageBin: '16+', exposureFraction: Number.NaN }],
      [{ ageBin: '16+', exposureFraction: Number.POSITIVE_INFINITY }],
      [{ ageBin: '16+', exposureFraction: Number.NEGATIVE_INFINITY }],
      [{ ageBin: '16+', exposureFraction: -1 }],
      [{ ageBin: '16+', exposureFraction: 2 }],
      [{ ageBin: '16+', exposureFraction: 0.3 }],
      [{ ageBin: 'not-a-bin', exposureFraction: 1 }],
      [{ ageBin: '16+', exposureFraction: 0.5 }, { ageBin: '16+', exposureFraction: 0.5 }],
      [{ ageBin: null, exposureFraction: 1 }],
      [{ ageBin: undefined, exposureFraction: 1 }],
      [{ exposureFraction: 1 }],
      [{ ageBin: '16+' }],
      [null],
      [undefined],
      null,
      undefined,
    ];
    for (const bad of malformedAgeBins) {
      expect(() =>
        computeBaPeqLifetime(THREE_PAH_ENTRIES, 'hc-pqra-v3', bad as unknown as AgeBinFraction[]),
      ).not.toThrow();
    }
  });
});
