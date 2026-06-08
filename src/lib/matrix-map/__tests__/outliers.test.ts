// Outliers screening test suite.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section E.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import { runDixonTest, runRosnerTest, runOutliersCheck } from '../outliers';

describe('Outlier Screening Tests (outliers)', () => {
  it('verifies Dixon test on small sample (n <= 25)', () => {
    // n = 3, critical values: alpha05 = 0.970, alpha01 = 0.994
    const data1 = [1, 2, 100];
    const res1 = runDixonTest(data1);
    expect(res1.length).toBe(1);
    expect(res1[0].value).toBe(100);
    expect(res1[0].testUsed).toBe('Dixon 5%'); // 0.9898 > 0.970 but < 0.994

    const data2 = [1.0, 1.1, 1000.0];
    const res2 = runDixonTest(data2);
    expect(res2.length).toBe(1);
    expect(res2[0].value).toBe(1000.0);
    expect(res2[0].testUsed).toBe('Dixon 1%'); // 998.9 / 999.0 = 0.9999 > 0.994
  });

  it('verifies Rosner test on Pyrene detects including outlier 2982 (n = 45)', () => {
    const detectsWithOutlier = [
      31, 32, 34, 40, 47, 48, 59, 63, 64, 64, 67, 67, 67, 72, 73, 84, 86, 87, 94, 98,
      100, 103, 103, 105, 107, 110, 111, 119, 119, 122, 132, 133, 133, 138, 163, 187,
      190, 222, 238, 273, 289, 306, 333, 459, 2982
    ];
    
    expect(detectsWithOutlier.length).toBe(45);

    const res = runRosnerTest(detectsWithOutlier);
    expect(res.length).toBe(2);
    expect(res[0].value).toBe(2982);
    expect(res[0].testUsed).toBe('Rosner 1%');
    expect(res[1].value).toBe(459);
    expect(res[1].testUsed).toBe('Rosner 1%');
  });

  it('handles small datasets or no outliers', () => {
    expect(runOutliersCheck([1, 2])).toEqual([]);
    expect(runOutliersCheck([10, 11, 12, 13, 14, 15])).toEqual([]);
  });
});
