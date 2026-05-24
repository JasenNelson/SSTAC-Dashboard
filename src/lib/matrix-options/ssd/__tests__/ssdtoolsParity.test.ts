import { describe, expect, it } from 'vitest';
import { SSD_FIXTURE_ROWS } from '../fixtures';
import { buildSsdAnalysis } from '../hcp';
import { fitLogNormalDistribution } from '../model';
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

const SSDTOOLS_LNORM_REFERENCE = {
  packageName: 'ssdtools',
  packageVersion: '2.6.0',
  distribution: 'lnorm',
  pValue: 0.05,
  speciesCount: 10,
  meanlog: -3.5242583281288575,
  sdlog: 0.7518587897512835,
  hc5: 0.008557424712758329,
  logLikelihood: 23.90526547175336,
  aic: -43.81053094350672,
  aicc: -42.096245229221005,
};

function parameterValue(
  fit: NonNullable<ReturnType<typeof fitLogNormalDistribution>>,
  name: string,
): number {
  const parameter = fit.parameters.find((item) => item.name === name);
  if (!parameter) throw new Error(`Missing ${name} parameter.`);
  return parameter.value;
}

describe('SSD ssdtools parity', () => {
  it('matches the ssdtools lnorm reference fixture', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, SETTINGS);
    const fit = fitLogNormalDistribution(result.speciesAggregates, 0.05);

    expect(fit).not.toBeNull();
    if (!fit) return;

    expect(result.speciesCount).toBe(SSDTOOLS_LNORM_REFERENCE.speciesCount);
    expect(fit.distribution).toBe('Log-Normal');
    expect(parameterValue(fit, 'meanlog')).toBeCloseTo(
      SSDTOOLS_LNORM_REFERENCE.meanlog,
      12,
    );
    expect(parameterValue(fit, 'sdlog')).toBeCloseTo(
      SSDTOOLS_LNORM_REFERENCE.sdlog,
      12,
    );
    expect(fit.hcp).toBeCloseTo(SSDTOOLS_LNORM_REFERENCE.hc5, 10);
    expect(fit.logLikelihood).toBeCloseTo(
      SSDTOOLS_LNORM_REFERENCE.logLikelihood,
      12,
    );
    expect(fit.aic).toBeCloseTo(SSDTOOLS_LNORM_REFERENCE.aic, 12);
    expect(fit.aicc).toBeCloseTo(SSDTOOLS_LNORM_REFERENCE.aicc, 12);
  });
});
