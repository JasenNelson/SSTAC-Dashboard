import { describe, expect, it } from 'vitest';
import { getSsdFixtureDataset, SSD_FIXTURE_ROWS } from '../fixtures';
import { buildSsdAnalysis, calculateEmpiricalHcp } from '../hcp';
import type { RawEcotoxRecord, SsdWorkbenchSettings } from '../types';

const BASE_SETTINGS: SsdWorkbenchSettings = {
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

const FIVE_SPECIES_ROWS: RawEcotoxRecord[] = Array.from(
  { length: 5 },
  (_, index) => ({
    chemical_name: 'Zinc',
    species_scientific_name: `Species ${index + 1}`,
    conc1_mean: 0.1 + index * 0.01,
    unit: 'mg/L',
    species_group: 'Fish',
    media_type: 'FW',
    endpoint: 'Mortality',
  }),
);

describe('SSD HCp preview', () => {
  it('builds a deterministic fixture-backed derived candidate receipt', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, BASE_SETTINGS);

    expect(result.hcp).toBeGreaterThan(0);
    expect(result.speciesCount).toBe(10);
    expect(result.cleanedRecordCount).toBe(11);
    expect(result.excludedRecordCount).toBe(4);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(7);
    expect(result.diagnostics.map((diagnostic) => diagnostic.name)).toEqual(
      expect.arrayContaining([
        'Gamma (gamma)',
        'Log-Gumbel (lgumbel)',
        'Log-Logistic (llogis)',
        'Log-Normal (lnorm)',
        'Log-Normal Mixture (lnorm_lnorm)',
        'Weibull (weibull)',
      ]),
    );
    expect(result.fittedCurvePoints.length).toBeGreaterThan(20);
    expect(result.derivedCandidate).toMatchObject({
      label: 'HC5 SSD-derived candidate',
      evidenceSupportStatus: 'user_entered_or_derived',
      qaStatus: 'needs_review',
      canDriveCalculations: false,
      unit: 'mg/L',
    });
  });

  it('keeps insufficient filtered data as a warning state', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, {
      ...BASE_SETTINGS,
      endpointFilters: ['Reproduction'],
    });

    expect(result.speciesCount).toBe(1);
    expect(result.hcp).toBeNaN();
    expect(result.fittedCurvePoints).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/at least 5 are required/i);
    expect(result.derivedCandidate.canDriveCalculations).toBe(false);
  });

  it('keeps selected chemical provenance aligned with the analyzed records', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, {
      ...BASE_SETTINGS,
      chemicalNames: ['Zinc'],
    });

    expect(result.speciesCount).toBe(0);
    expect(result.hcp).toBeNaN();
    expect(
      result.excludedRecords.every(
        (record) => record.reason === 'chemical_mismatch',
      ),
    ).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/Only 0 species remain/i);
  });

  it('can use the fitted Log-Normal HCp in single-distribution mode', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, {
      ...BASE_SETTINGS,
      analysisMode: 'single_distribution',
      selectedDistribution: 'Log-Normal',
    });
    const logNormalDiagnostic = result.diagnostics.find(
      (diagnostic) => diagnostic.name === 'Log-Normal (lnorm)',
    );

    expect(logNormalDiagnostic).toBeDefined();
    expect(result.hcp).toBe(logNormalDiagnostic?.hcp);
    expect(result.hcp).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).not.toMatch(/only log-normal/i);
  });

  it('can use ssdtools-style model averaging as the candidate HCp', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, {
      ...BASE_SETTINGS,
      analysisMode: 'model_averaging',
    });
    const modelAverageDiagnostic = result.diagnostics.find(
      (diagnostic) => diagnostic.name === 'ssdtools model average',
    );

    expect(modelAverageDiagnostic).toBeDefined();
    expect(result.hcp).toBe(modelAverageDiagnostic?.hcp);
    expect(result.fittedCurvePoints[0]?.distribution).toBe('Model Average');
    expect(result.warnings.join(' ')).toMatch(/TypeScript parity candidate/i);
    expect(result.warnings.join(' ')).toMatch(/bootstrap confidence intervals/i);
  });

  it('falls back to empirical HCp below the ssdtools fitting row minimum', () => {
    const result = buildSsdAnalysis(FIVE_SPECIES_ROWS, {
      ...BASE_SETTINGS,
      chemicalNames: ['Zinc'],
      analysisMode: 'model_averaging',
    });

    expect(result.speciesCount).toBe(5);
    expect(result.hcp).toBeGreaterThan(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.name)).not.toContain(
      'ssdtools model average',
    );
    expect(result.warnings.join(' ')).toMatch(
      /ssdtools distribution fitting requires at least 6 species/i,
    );
  });

  it('builds CCME boron validation results with the ssddata row count', () => {
    const boron = getSsdFixtureDataset('ccme_boron_validation');
    const result = buildSsdAnalysis(boron.rows, {
      ...BASE_SETTINGS,
      chemicalNames: ['Boron'],
      analysisMode: 'model_averaging',
    });

    expect(result.speciesCount).toBe(28);
    expect(result.cleanedRecordCount).toBe(28);
    expect(result.unit).toBe('mg/L');
    expect(result.hcp).toBeGreaterThan(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.name)).toEqual(
      expect.arrayContaining(['ssdtools model average', 'Gamma (gamma)']),
    );
  });

  it('builds CCME endosulfan validation results with reported ng/L units', () => {
    const endosulfan = getSsdFixtureDataset('ccme_endosulfan_validation');
    const result = buildSsdAnalysis(endosulfan.rows, {
      ...BASE_SETTINGS,
      chemicalNames: ['Endosulfan'],
      analysisMode: 'single_distribution',
      selectedDistribution: 'Log-Logistic',
    });

    expect(result.speciesCount).toBe(12);
    expect(result.cleanedRecordCount).toBe(12);
    expect(result.unit).toBe('ng/L');
    expect(result.hcp).toBeGreaterThan(0);
  });

  it('keeps the numeric helper strict for parity tests', () => {
    expect(() =>
      calculateEmpiricalHcp(
        [
          {
            speciesScientificName: 'Species 1',
            broadGroup: 'Other',
            value: 0.01,
            valueCount: 1,
            sourceRecordCount: 1,
            minValue: 0.01,
            maxValue: 0.01,
          },
        ],
        0.05,
      ),
    ).toThrow(/at least 5 species/i);
  });
});
