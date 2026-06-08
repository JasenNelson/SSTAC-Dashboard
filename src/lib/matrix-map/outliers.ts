// Dixon and Rosner outlier screening tests.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section E.
// Plain ASCII only (code point <= 127).

import { studentTInv } from './inverse-t';

export interface OutlierResult {
  value: number;
  index: number; // Index in the original array
  testUsed: string; // "Dixon 5%" | "Dixon 1%" | "Rosner 5%" | "Rosner 1%"
  level: '5%' | '1%';
}

// Dixon two-sided critical values table for n = 3 to 25.
// Traced to Rorabacher (1991) two-sided critical values at 5% (p=0.025) and 1% (p=0.005).
interface DixonCritEntry {
  n: number;
  alpha05: number; // Two-sided 5% level (p=0.025)
  alpha01: number; // Two-sided 1% level (p=0.005)
}

const DIXON_CRIT_TABLE: Record<number, DixonCritEntry> = {
  3: { n: 3, alpha05: 0.970, alpha01: 0.994 },
  4: { n: 4, alpha05: 0.829, alpha01: 0.926 },
  5: { n: 5, alpha05: 0.710, alpha01: 0.821 },
  6: { n: 6, alpha05: 0.625, alpha01: 0.740 },
  7: { n: 7, alpha05: 0.568, alpha01: 0.680 },
  8: { n: 8, alpha05: 0.615, alpha01: 0.725 },
  9: { n: 9, alpha05: 0.570, alpha01: 0.677 },
  10: { n: 10, alpha05: 0.534, alpha01: 0.639 },
  11: { n: 11, alpha05: 0.710, alpha01: 0.816 },
  12: { n: 12, alpha05: 0.664, alpha01: 0.760 },
  13: { n: 13, alpha05: 0.625, alpha01: 0.713 },
  14: { n: 14, alpha05: 0.590, alpha01: 0.674 },
  15: { n: 15, alpha05: 0.568, alpha01: 0.647 },
  16: { n: 16, alpha05: 0.548, alpha01: 0.624 },
  17: { n: 17, alpha05: 0.531, alpha01: 0.605 },
  18: { n: 18, alpha05: 0.516, alpha01: 0.589 },
  19: { n: 19, alpha05: 0.503, alpha01: 0.575 },
  20: { n: 20, alpha05: 0.491, alpha01: 0.562 },
  21: { n: 21, alpha05: 0.480, alpha01: 0.551 },
  22: { n: 22, alpha05: 0.470, alpha01: 0.541 },
  23: { n: 23, alpha05: 0.461, alpha01: 0.532 },
  24: { n: 24, alpha05: 0.452, alpha01: 0.524 },
  25: { n: 25, alpha05: 0.445, alpha01: 0.516 },
};

// Computes the Dixon statistic for a sorted array.
// side: "low" (tests smallest) or "high" (tests largest).
function calculateDixonStat(sorted: number[], side: 'low' | 'high'): number {
  const n = sorted.length;
  if (n < 3) return 0.0;

  if (n <= 7) {
    // r10
    const denom = sorted[n - 1] - sorted[0];
    if (denom === 0) return 0.0;
    return side === 'low'
      ? (sorted[1] - sorted[0]) / denom
      : (sorted[n - 1] - sorted[n - 2]) / denom;
  } else if (n <= 10) {
    // r11
    if (side === 'low') {
      const denom = sorted[n - 2] - sorted[0];
      if (denom === 0) return 0.0;
      return (sorted[1] - sorted[0]) / denom;
    } else {
      const denom = sorted[n - 1] - sorted[1];
      if (denom === 0) return 0.0;
      return (sorted[n - 1] - sorted[n - 2]) / denom;
    }
  } else if (n <= 13) {
    // r21
    if (side === 'low') {
      const denom = sorted[n - 2] - sorted[0];
      if (denom === 0) return 0.0;
      return (sorted[2] - sorted[0]) / denom;
    } else {
      const denom = sorted[n - 1] - sorted[1];
      if (denom === 0) return 0.0;
      return (sorted[n - 1] - sorted[n - 3]) / denom;
    }
  } else {
    // r22 (for n = 14..25)
    if (side === 'low') {
      const denom = sorted[n - 3] - sorted[0];
      if (denom === 0) return 0.0;
      return (sorted[2] - sorted[0]) / denom;
    } else {
      const denom = sorted[n - 1] - sorted[2];
      if (denom === 0) return 0.0;
      return (sorted[n - 1] - sorted[n - 3]) / denom;
    }
  }
}

// Runs Dixon outlier test on an array of numbers.
// Returns list of outliers detected.
export function runDixonTest(values: number[]): OutlierResult[] {
  const n = values.length;
  if (n < 3 || n > 25) return [];

  // Sort values and keep track of original indices
  const indexed = values.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);
  const sortedVals = indexed.map((x) => x.val);

  const crit = DIXON_CRIT_TABLE[n];
  if (!crit) return [];

  const outliers: OutlierResult[] = [];

  // 1. Test low end (smallest value)
  const rLow = calculateDixonStat(sortedVals, 'low');
  if (rLow > crit.alpha01) {
    outliers.push({
      value: indexed[0].val,
      index: indexed[0].idx,
      testUsed: 'Dixon 1%',
      level: '1%',
    });
  } else if (rLow > crit.alpha05) {
    outliers.push({
      value: indexed[0].val,
      index: indexed[0].idx,
      testUsed: 'Dixon 5%',
      level: '5%',
    });
  }

  // 2. Test high end (largest value)
  // Ensure we don't double-test a single point if n is tiny (though low and high are distinct for n >= 3)
  const rHigh = calculateDixonStat(sortedVals, 'high');
  if (rHigh > crit.alpha01) {
    outliers.push({
      value: indexed[n - 1].val,
      index: indexed[n - 1].idx,
      testUsed: 'Dixon 1%',
      level: '1%',
    });
  } else if (rHigh > crit.alpha05) {
    outliers.push({
      value: indexed[n - 1].val,
      index: indexed[n - 1].idx,
      testUsed: 'Dixon 5%',
      level: '5%',
    });
  }

  return outliers;
}

// Solves critical value lambda for Rosner's test on-the-fly.
// df = n - i - 1
function getRosnerCritVal(n: number, i: number, alpha: number): number {
  const df = n - i - 1;
  if (df <= 0) return 0.0;
  
  // Probability level for two-sided Student's-t quantile
  const p = 1.0 - alpha / (2.0 * (n - i + 1));
  const tVal = studentTInv(p, df);
  if (!Number.isFinite(tVal) || tVal <= 0) return 0.0;

  const denom = Math.sqrt((df + tVal * tVal) * (n - i + 1));
  if (denom === 0) return 0.0;

  return ((n - i) * tVal) / denom;
}

// Runs Rosner's Generalized ESD outlier test for n > 25.
export function runRosnerTest(values: number[]): OutlierResult[] {
  const n = values.length;
  if (n <= 25) return [];

  // Limit potential outliers to max 10 or n/2
  const maxOutliers = Math.min(10, Math.floor(n / 2));

  // We will perform the iterative removal process
  let currentSet = values.map((val, idx) => ({ val, idx }));
  
  const stats: { rStat: number; removedItem: { val: number; idx: number } }[] = [];
  const crit05: number[] = [];
  const crit01: number[] = [];

  for (let step = 1; step <= maxOutliers; step++) {
    const k = currentSet.length;
    if (k < 3) break;

    // Compute mean and standard deviation of current set
    const sum = currentSet.reduce((acc, x) => acc + x.val, 0);
    const meanVal = sum / k;
    
    let sumSq = 0.0;
    for (const item of currentSet) {
      sumSq += (item.val - meanVal) * (item.val - meanVal);
    }
    const sdVal = Math.sqrt(sumSq / (k - 1));

    if (sdVal === 0) break; // All remaining values are identical

    // Find the most extreme observation
    let maxDev = -1;
    let extremeIdx = -1;
    for (let j = 0; j < k; j++) {
      const dev = Math.abs(currentSet[j].val - meanVal);
      if (dev > maxDev) {
        maxDev = dev;
        extremeIdx = j;
      }
    }

    const rStat = maxDev / sdVal;
    const removedItem = currentSet[extremeIdx];

    stats.push({ rStat, removedItem });

    // Solve critical values on-the-fly
    crit05.push(getRosnerCritVal(n, step, 0.05));
    crit01.push(getRosnerCritVal(n, step, 0.01));

    // Remove the extreme item
    currentSet = currentSet.filter((_, idx) => idx !== extremeIdx);
  }

  // Find the largest step number where rStat > critVal
  let numOutliers01 = 0;
  for (let step = stats.length; step >= 1; step--) {
    if (stats[step - 1].rStat > crit01[step - 1]) {
      numOutliers01 = step;
      break;
    }
  }

  let numOutliers05 = 0;
  for (let step = stats.length; step >= 1; step--) {
    if (stats[step - 1].rStat > crit05[step - 1]) {
      numOutliers05 = step;
      break;
    }
  }

  const outliers: OutlierResult[] = [];

  // Decide which level of significance to output
  if (numOutliers01 > 0) {
    // Flag all first numOutliers01 removed items as 1% outliers
    for (let j = 0; j < numOutliers01; j++) {
      outliers.push({
        value: stats[j].removedItem.val,
        index: stats[j].removedItem.idx,
        testUsed: 'Rosner 1%',
        level: '1%',
      });
    }
  } else if (numOutliers05 > 0) {
    // Flag all first numOutliers05 removed items as 5% outliers
    for (let j = 0; j < numOutliers05; j++) {
      outliers.push({
        value: stats[j].removedItem.val,
        index: stats[j].removedItem.idx,
        testUsed: 'Rosner 5%',
        level: '5%',
      });
    }
  }

  return outliers;
}

// Main entry point for outlier detection. Runs on detected measurements only.
export function runOutliersCheck(values: number[]): OutlierResult[] {
  const n = values.length;
  if (n < 3) return [];
  if (n <= 25) {
    return runDixonTest(values);
  } else {
    return runRosnerTest(values);
  }
}
