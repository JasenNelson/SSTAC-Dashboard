import { describe, expect, it } from 'vitest';
import { findSubstance } from '../substanceLibrary';
import fs from 'node:fs';
import path from 'node:path';
import type { ParameterValueRecord } from '../provenance/types';

function floatEqual(a: number | null | undefined, b: number | null | undefined) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= 1e-9 * Math.max(1, Math.abs(Number(a)), Math.abs(Number(b)));
}

// add a substance_key here ONLY with a documented, temporary library!=current_default quarantine state
const DOCUMENTED_EXCEPTIONS = new Set<string>();

describe('librarySeedCurrentDefault', () => {
  it('should ensure library values match current_default catalog rows for rfd/sf', () => {
    // Read all catalog value files (a current_default row for these inputs may live in either
    // human_health_trv_values.json or parameter_values.json), so the invariant is checked catalog-wide.
    const hhValuesPath = path.resolve(__dirname, '../../../../matrix_research/reference_catalog/human_health_trv_values.json');
    const paramValuesPath = path.resolve(__dirname, '../../../../matrix_research/reference_catalog/parameter_values.json');
    const ecoValuesPath = path.resolve(__dirname, '../../../../matrix_research/reference_catalog/eco_values.json');
    
    const parameterValueRecords: ParameterValueRecord[] = [];
    if (fs.existsSync(hhValuesPath)) {
      parameterValueRecords.push(...JSON.parse(fs.readFileSync(hhValuesPath, 'utf8')));
    }
    if (fs.existsSync(paramValuesPath)) {
      parameterValueRecords.push(...JSON.parse(fs.readFileSync(paramValuesPath, 'utf8')));
    }
    if (fs.existsSync(ecoValuesPath)) {
      parameterValueRecords.push(...JSON.parse(fs.readFileSync(ecoValuesPath, 'utf8')));
    }
    
    const currentDefaults = parameterValueRecords.filter((r: ParameterValueRecord) => 
      r.default_status === 'current_default' && 
      r.pathway === 'human-health-direct' &&
      (r.input_key === 'rfd_oral_mg_per_kg_bw_day' || r.input_key === 'sf_oral_per_mg_per_kg_bw_per_day')
    );

    let checkedRows = 0;
    
    for (const row of currentDefaults) {
      if (DOCUMENTED_EXCEPTIONS.has(row.substance_key)) {
        continue;
      }
      
      const substance = findSubstance(row.substance_key);
      if (!substance) {
        throw new Error(`Substance ${row.substance_key} found in catalog but missing in SUBSTANCE_LIBRARY`);
      }
      
      let libraryValue: number | null = null;
      if (row.input_key === 'rfd_oral_mg_per_kg_bw_day') {
        libraryValue = substance.rfd_oral_mg_per_kg_bw_per_day;
      } else if (row.input_key === 'sf_oral_per_mg_per_kg_bw_per_day') {
        libraryValue = substance.sf_oral_per_mg_per_kg_bw_per_day;
      }
      
      if (!floatEqual(libraryValue, row.value as number)) {
        throw new Error(`Divergence for ${row.substance_key} ${row.input_key}: library has ${libraryValue}, catalog default_status='current_default' has ${row.value}`);
      }
      checkedRows++;
    }
    
    expect(checkedRows).toBeGreaterThanOrEqual(20);
  });
});
