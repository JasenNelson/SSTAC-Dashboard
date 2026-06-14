import { describe, expect, it } from 'vitest';
import { SSD_FIXTURE_ROWS } from '../fixtures';
import { buildSsdSpeciesCsv, buildSsdReceiptJson } from '../export';
import { buildSsdAnalysis } from '../hcp';
import type { RawEcotoxRecord, SsdWorkbenchSettings } from '../types';

const MIXED_UNIT_ROWS: RawEcotoxRecord[] = Array.from(
  { length: 6 },
  (_, index) => ({
    chemical_name: 'Zinc',
    species_scientific_name: `Species ${index + 1}`,
    conc1_mean: 0.1 + index * 0.01,
    unit: index === 5 ? 'ng/L' : 'mg/L',
    species_group: 'Fish',
    media_type: 'FW',
    endpoint: 'Mortality',
  }),
);

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

describe('SSD export builders', () => {
  it('builds a species aggregate CSV with unit and record counts', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, SETTINGS);
    const csv = buildSsdSpeciesCsv(result);

    expect(csv.split('\n')[0]).toBe(
      'species_scientific_name,broad_group,ssd_value,unit,value_count,source_record_count,min_value,max_value',
    );
    expect(csv).toContain('Daphnia magna,Invertebrate');
    expect(csv).toContain('mg/L');
  });

  it('builds a receipt JSON without embedding raw source records', () => {
    const result = buildSsdAnalysis(SSD_FIXTURE_ROWS, SETTINGS);
    const parsed = JSON.parse(buildSsdReceiptJson(result)) as {
      hcp: number;
      derivedCandidate: { canDriveCalculations: boolean };
      fittedCurvePoints: unknown[];
      excludedRecords: Array<{ reason: string; raw?: unknown }>;
    };

    expect(parsed.hcp).toBeGreaterThan(0);
    expect(parsed.fittedCurvePoints.length).toBeGreaterThan(0);
    expect(parsed.derivedCandidate.canDriveCalculations).toBe(false);
    expect(parsed.excludedRecords[0]).not.toHaveProperty('raw');
  });

  it('returns a blocked marker CSV with no data rows for mixed-unit input', () => {
    const result = buildSsdAnalysis(MIXED_UNIT_ROWS, {
      ...SETTINGS,
      chemicalNames: ['Zinc'],
    });
    const csv = buildSsdSpeciesCsv(result);

    expect(result.isBlocked).toBe(true);
    expect(csv).toContain('# ANALYSIS BLOCKED');
    expect(csv).toMatch(/# Reason: .*single consistent/i);
    expect(csv).not.toContain('species_scientific_name');
    expect(csv).not.toContain('ssd_value');
    // No data rows: only the two comment lines.
    expect(csv.trim().split('\n').filter((line) => line.trim().length > 0)).toHaveLength(2);
  });

  it('marks the receipt JSON blocked and omits blended species values', () => {
    const result = buildSsdAnalysis(MIXED_UNIT_ROWS, {
      ...SETTINGS,
      chemicalNames: ['Zinc'],
    });
    const parsed = JSON.parse(buildSsdReceiptJson(result)) as {
      blocked: boolean;
      blockReason: string | null;
      hcp: number | null;
      speciesAggregates: unknown[];
    };

    expect(parsed.blocked).toBe(true);
    expect(parsed.blockReason).toMatch(/single consistent/i);
    expect(parsed.hcp).toBeNull();
    expect(parsed.speciesAggregates).toEqual([]);
  });
});
