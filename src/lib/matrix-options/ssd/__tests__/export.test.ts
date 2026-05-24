import { describe, expect, it } from 'vitest';
import { SSD_FIXTURE_ROWS } from '../fixtures';
import { buildSsdSpeciesCsv, buildSsdReceiptJson } from '../export';
import { buildSsdAnalysis } from '../hcp';
import type { SsdWorkbenchSettings } from '../types';

const SETTINGS: SsdWorkbenchSettings = {
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
      excludedRecords: Array<{ reason: string; raw?: unknown }>;
    };

    expect(parsed.hcp).toBeGreaterThan(0);
    expect(parsed.derivedCandidate.canDriveCalculations).toBe(false);
    expect(parsed.excludedRecords[0]).not.toHaveProperty('raw');
  });
});
