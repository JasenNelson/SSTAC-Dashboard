import { describe, expect, it } from 'vitest';
import { getSsdFixtureDataset, SSD_FIXTURE_ROWS } from '../fixtures';
import { buildSsdAnalysis } from '../hcp';
import {
  fitLogNormalDistribution,
  fitSsdDistributions,
  type SsdDistributionFit,
} from '../model';
import type { SsdDistribution, SsdWorkbenchSettings } from '../types';

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

const SSDTOOLS_CCME_BORON_MODEL_AVERAGE_HC5 = 1.25678;
const SSDDATA_CCME_ENDOSULFAN_SSDTOOLS_AVERAGED_HC5 = 0.00767325714903464;

const SSDTOOLS_CCME_BORON_HC5_REFERENCE = {
  Gamma: {
    hcp: 1.07428,
    weight: 0.356574,
    aicc: 238.11,
    deltaAicc: 0.005,
    parameters: { scale: 25.1268, shape: 0.950179 },
  },
  'Log-Gumbel': {
    hcp: 1.76939,
    weight: 0.0134466,
    aicc: 244.666,
    deltaAicc: 6.561,
    parameters: { locationlog: 1.92263, scalelog: 1.23224 },
  },
  'Log-Logistic': {
    hcp: 1.56226,
    weight: 0.0656452,
    aicc: 241.495,
    deltaAicc: 3.39,
    parameters: { locationlog: 2.62628, scalelog: 0.740426 },
  },
  'Log-Normal': {
    hcp: 1.68117,
    weight: 0.177236,
    aicc: 239.508,
    deltaAicc: 1.403,
    parameters: { meanlog: 2.56165, sdlog: 1.24154 },
  },
  'Log-Normal Mixture': {
    hcp: 1.54147,
    weight: 0.0296268,
    aicc: 243.086,
    deltaAicc: 4.981,
    parameters: {
      meanlog1: 0.949483,
      sdlog1: 0.554465,
      meanlog2: 3.20102,
      sdlog2: 0.768862,
      pmix: 0.283968,
    },
  },
  Weibull: {
    hcp: 1.08673,
    weight: 0.357472,
    aicc: 238.105,
    deltaAicc: 0,
    parameters: { scale: 23.514, shape: 0.9661 },
  },
} satisfies Record<
  SsdDistribution,
  {
    hcp: number;
    weight: number;
    aicc: number;
    deltaAicc: number;
    parameters: Record<string, number>;
  }
>;

function parameterValue(
  fit: SsdDistributionFit,
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

  it('matches official ssdtools snapshots for ssddata::ccme_boron BCANZ fits', () => {
    const boron = getSsdFixtureDataset('ccme_boron_validation');
    const result = buildSsdAnalysis(boron.rows, {
      ...SETTINGS,
      chemicalNames: ['Boron'],
      analysisMode: 'model_averaging',
    });
    const fits = fitSsdDistributions(result.speciesAggregates, 0.05);

    expect(result.speciesCount).toBe(28);
    expect(result.unit).toBe('mg/L');
    expect(result.hcp).toBeCloseTo(SSDTOOLS_CCME_BORON_MODEL_AVERAGE_HC5, 4);
    expect(fits).toHaveLength(6);

    for (const [distribution, reference] of Object.entries(
      SSDTOOLS_CCME_BORON_HC5_REFERENCE,
    ) as Array<
      [
        SsdDistribution,
        (typeof SSDTOOLS_CCME_BORON_HC5_REFERENCE)[SsdDistribution],
      ]
    >) {
      const fit = fits.find((candidate) => candidate.distribution === distribution);
      expect(fit).toBeDefined();
      if (!fit) continue;

      expect(Math.abs(fit.hcp - reference.hcp)).toBeLessThanOrEqual(0.0002);
      expect(fit.weight).toBeCloseTo(reference.weight, 5);
      expect(fit.aicc).toBeCloseTo(reference.aicc, 3);
      expect(fit.deltaAicc).toBeCloseTo(reference.deltaAicc, 3);
      for (const [name, value] of Object.entries(reference.parameters)) {
        expect(parameterValue(fit, name)).toBeCloseTo(value, 3);
      }
    }
  });

  it('tracks ssddata::ssd_fits for ssddata::ccme_endosulfan averaged HC5', () => {
    const endosulfan = getSsdFixtureDataset('ccme_endosulfan_validation');
    const result = buildSsdAnalysis(endosulfan.rows, {
      ...SETTINGS,
      chemicalNames: ['Endosulfan'],
      analysisMode: 'model_averaging',
    });

    expect(result.speciesCount).toBe(12);
    expect(result.unit).toBe('ng/L');
    expect(
      Math.abs(result.hcp - SSDDATA_CCME_ENDOSULFAN_SSDTOOLS_AVERAGED_HC5),
    ).toBeLessThanOrEqual(0.00005);
  });
});
