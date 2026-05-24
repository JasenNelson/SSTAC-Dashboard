import { describe, expect, it } from 'vitest';
import { SSD_FIXTURE_ROWS } from '../fixtures';
import { buildSsdAnalysis } from '../hcp';
import {
  fitLogNormalDistribution,
  inverseStandardNormal,
  standardNormalCdf,
} from '../model';
import type { SsdWorkbenchSettings } from '../types';

const SETTINGS: SsdWorkbenchSettings = {
  chemicalNames: ['Copper'],
  mediaFilter: 'water',
  environmentFilter: 'freshwater',
  endpointFilters: [],
  aggregationMethod: 'geometric_mean',
  pValue: 0.05,
  analysisMode: 'empirical_preview',
  selectedDistribution: 'Log-Normal',
  bootstrapIterations: 0,
  randomSeed: 42,
  sourceMode: 'fixture',
  ecotoxMirrorRecordCount: 582125,
  extractedAt: '2026-05-24',
};

describe('SSD Log-Normal fitting', () => {
  it('keeps normal probability helpers numerically stable', () => {
    expect(standardNormalCdf(0)).toBeCloseTo(0.5, 6);
    expect(inverseStandardNormal(0.05)).toBeCloseTo(-1.644853626, 6);
    expect(inverseStandardNormal(0.95)).toBeCloseTo(1.644853626, 6);
  });

  it('fits Log-Normal diagnostics and curve points from species aggregates', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, SETTINGS);
    const fit = fitLogNormalDistribution(result.speciesAggregates, 0.05);

    expect(fit).not.toBeNull();
    expect(fit?.distribution).toBe('Log-Normal');
    expect(fit?.hcp).toBeGreaterThan(0);
    expect(fit?.aic).toEqual(expect.any(Number));
    expect(fit?.aicc).toEqual(expect.any(Number));
    expect(fit?.parameters).toHaveLength(2);
    expect(fit?.curvePoints.length).toBeGreaterThan(20);
  });
});
