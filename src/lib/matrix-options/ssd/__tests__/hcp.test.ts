import { describe, expect, it } from 'vitest';
import { SSD_FIXTURE_ROWS } from '../fixtures';
import { buildSsdAnalysis, calculateEmpiricalHcp } from '../hcp';
import type { SsdWorkbenchSettings } from '../types';

const BASE_SETTINGS: SsdWorkbenchSettings = {
  chemicalNames: ['Copper'],
  mediaFilter: 'water',
  environmentFilter: 'freshwater',
  endpointFilters: [],
  aggregationMethod: 'geometric_mean',
  pValue: 0.05,
  analysisMode: 'empirical_preview',
  bootstrapIterations: 0,
  randomSeed: 42,
  sourceMode: 'fixture',
  ecotoxMirrorRecordCount: 582125,
  extractedAt: '2026-05-24',
};

describe('SSD HCp preview', () => {
  it('builds a deterministic fixture-backed derived candidate receipt', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, BASE_SETTINGS);

    expect(result.hcp).toBeGreaterThan(0);
    expect(result.speciesCount).toBe(10);
    expect(result.cleanedRecordCount).toBe(11);
    expect(result.excludedRecordCount).toBe(4);
    expect(result.diagnostics).toHaveLength(1);
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
