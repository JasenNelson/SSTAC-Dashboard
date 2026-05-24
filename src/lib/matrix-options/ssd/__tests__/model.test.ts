import { describe, expect, it } from 'vitest';
import { SSD_FIXTURE_ROWS } from '../fixtures';
import { buildSsdAnalysis } from '../hcp';
import {
  buildModelAveragedFit,
  fitLogNormalDistribution,
  fitSsdDistributions,
  inverseStandardNormal,
  SSDTOOLS_DISTRIBUTIONS,
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

  it('fits the BCANZ ssdtools candidate distribution set', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, SETTINGS);
    const fits = fitSsdDistributions(result.speciesAggregates, 0.05);

    expect(fits.map((fit) => fit.distribution).sort()).toEqual(
      [...SSDTOOLS_DISTRIBUTIONS].sort(),
    );
    expect(fits.reduce((sum, fit) => sum + fit.weight, 0)).toBeCloseTo(1, 8);
    expect(fits.every((fit) => fit.hcp > 0)).toBe(true);
    expect(
      fits.every(
        (fit) => fit.deltaAicc === null || fit.deltaAicc >= -Number.EPSILON,
      ),
    ).toBe(true);
  });

  it('uses weighted CDF inversion for the model-averaged HCp', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, SETTINGS);
    const average = buildModelAveragedFit(result.speciesAggregates, 0.05);

    expect(average).not.toBeNull();
    if (!average) return;

    const fractionAffected = average.activeFits.reduce(
      (sum, fit) => sum + fit.weight * fit.cdf(average.hcp),
      0,
    );
    expect(average.activeFits.length).toBeGreaterThan(1);
    expect(fractionAffected).toBeCloseTo(0.05, 5);
    expect(average.curvePoints[0]?.distribution).toBe('Model Average');
  });
});
