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

  it('calculates deterministic bootstrap confidence intervals when requested', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, {
      ...BASE_SETTINGS,
      analysisMode: 'single_distribution',
      selectedDistribution: 'Log-Normal',
      bootstrapIterations: 25,
    });
    const repeated = buildSsdAnalysis(SSD_FIXTURE_ROWS, {
      ...BASE_SETTINGS,
      analysisMode: 'single_distribution',
      selectedDistribution: 'Log-Normal',
      bootstrapIterations: 25,
    });

    expect(result.bootstrapInterval).not.toBeNull();
    expect(result.bootstrapInterval?.iterations).toBe(25);
    expect(result.bootstrapInterval?.successfulIterations).toBeGreaterThan(10);
    expect(result.bootstrapInterval?.lower).toBeGreaterThan(0);
    expect(result.bootstrapInterval?.upper).toBeGreaterThan(
      result.bootstrapInterval?.lower ?? 0,
    );
    expect(result.bootstrapInterval).toEqual(repeated.bootstrapInterval);
    expect(result.derivedCandidate.confidenceInterval).toEqual(
      result.bootstrapInterval,
    );
    expect(result.warnings.join(' ')).toMatch(/deterministic TypeScript/i);
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

  // Candidate 1: single_distribution mode falls back to empiricalHcp when
  // selectedFit === null (species count < MIN_SPECIES_FOR_SSDTOOLS_FIT = 6).
  // FIVE_SPECIES_ROWS has exactly 5 species which satisfies hasMinimumSpecies
  // (>= 5) but fitSsdDistributions returns [] so selectedFit is always null.
  // The hcp ternary at hcp.ts:306-310 falls back to empiricalHcp. This branch
  // is distinct from the model_averaging fallback test at line 154 above.
  it('Candidate 1: single_distribution with no valid fit falls back to empiricalHcp and warns', () => {
    const result = buildSsdAnalysis(FIVE_SPECIES_ROWS, {
      ...BASE_SETTINGS,
      chemicalNames: ['Zinc'],
      analysisMode: 'single_distribution',
      selectedDistribution: 'Log-Normal',
    });

    // 5 species -> hasMinimumSpecies true, empiricalHcp is finite.
    expect(result.speciesCount).toBe(5);
    expect(result.hcp).toBeGreaterThan(0);
    expect(Number.isFinite(result.hcp)).toBe(true);

    // A Log-Normal fit cannot succeed on 5 species (needs >= 6).
    // The fallback must match calculateEmpiricalHcp directly.
    const expectedEmpiricalHcp = calculateEmpiricalHcp(
      result.speciesAggregates,
      BASE_SETTINGS.pValue,
    );
    expect(result.hcp).toBeCloseTo(expectedEmpiricalHcp, 10);

    // The soft warning about the failed fit must be present.
    expect(result.warnings.join(' ')).toMatch(/Log-Normal did not produce a valid fit/i);
  });

  // Candidate 2: inferAnalysisUnit 'mixed reported units' warning branch.
  // aggregateSpeciesValues operates on raw record.concentration with no unit
  // normalization; when records carry mixed units the only signal is the
  // 'mixed reported units' label + the convert-units warning. No existing test
  // drives the units.length > 1 branch (hcp.ts:86-92).
  it('Candidate 2: mixed reported units sets unit label and emits convert-units warning', () => {
    const mixedUnitRows: RawEcotoxRecord[] = [
      ...Array.from({ length: 4 }, (_, i) => ({
        chemical_name: 'Copper',
        species_scientific_name: `Species_mgL_${i + 1}`,
        conc1_mean: 0.1 + i * 0.05,
        unit: 'mg/L',
        species_group: 'Fish' as const,
        media_type: 'FW',
        endpoint: 'Mortality',
      })),
      // One record with a different unit (ug/L) -- forces units.length === 2.
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Species_ugL_1',
        conc1_mean: 50.0,
        unit: 'ug/L',
        species_group: 'Fish' as const,
        media_type: 'FW',
        endpoint: 'Mortality',
      },
    ];

    const result = buildSsdAnalysis(mixedUnitRows, {
      ...BASE_SETTINGS,
      chemicalNames: ['Copper'],
    });

    // Must reach the mixed-units branch (>= 1 species needed).
    expect(result.speciesCount).toBeGreaterThanOrEqual(1);
    expect(result.unit).toBe('mixed reported units');
    expect(result.warnings.some((w) => w.includes('convert units before interpreting'))).toBe(true);
  });

  // Candidate 11: calculateEmpiricalHcp log-space interpolation value pinned.
  // Existing tests only assert > 0 or toThrow. Neither the exact-index short-circuit
  // nor the log-space interpolation result is ever asserted by value.
  it('Candidate 11: exact-index short-circuit returns the species value without interpolation', () => {
    // 5 values [1,2,4,8,16] pValue=0.5:
    // position = (5-1)*0.5 = 2.0 -> integer -> exact-index branch -> exp(log(4)) = 4
    const aggregates = [1, 2, 4, 8, 16].map((v, i) => ({
      speciesScientificName: `S${i + 1}`,
      broadGroup: 'Other' as const,
      value: v,
      valueCount: 1,
      sourceRecordCount: 1,
      minValue: v,
      maxValue: v,
    }));
    const result = calculateEmpiricalHcp(aggregates, 0.5);
    // Exact-index branch: lowerIndex === upperIndex === 2 -> exp(log(4)) = 4 exactly.
    expect(result).toBeCloseTo(4, 10);
  });

  it('Candidate 11: log-space interpolation is distinguishable from linear-in-value interpolation', () => {
    // 5 values [1, 10, 100, 1000, 10000] pValue=0.05:
    // position = (5-1)*0.05 = 0.2 -> lowerIndex=0, upperIndex=1, fraction=0.2
    // log-space: exp(log(1) + (log(10)-log(1))*0.2)
    //          = exp(0 + 2.302585*0.2) = exp(0.460517) ~= 1.5849
    // linear-in-value: 1 + (10 - 1)*0.2 = 1 + 1.8 = 2.8  (very different)
    // This distinguishes a log-space regression from a linear-in-value regression.
    const aggregates = [1, 10, 100, 1000, 10000].map((v, i) => ({
      speciesScientificName: `S${i + 1}`,
      broadGroup: 'Other' as const,
      value: v,
      valueCount: 1,
      sourceRecordCount: 1,
      minValue: v,
      maxValue: v,
    }));
    const result = calculateEmpiricalHcp(aggregates, 0.05);
    // Log-space result ~= 1.585; linear-in-value would give 2.8 -- not close.
    expect(result).toBeCloseTo(Math.exp(Math.log(1) + (Math.log(10) - Math.log(1)) * 0.2), 10);
    // Confirm it is NOT the linear-in-value answer (regression guard).
    expect(result).not.toBeCloseTo(2.8, 1);
  });
});
