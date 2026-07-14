import { describe, it, expect } from 'vitest';
import { getParameterValueRecordsForSubstance } from '../catalog';
import { resolveProvenanceRows } from '../resolver';
import type { CalculatorUsedValue } from '../types';

describe('sodium_ion no-current-default regression', () => {
  const pathways = ['human-health-direct', 'human-health-food'] as const;

  for (const pathway of pathways) {
    it(`has no current_default for sodium_ion oral RfD in ${pathway}`, () => {
      // 1. Direct catalog check: ensure no candidate is current_default
      const candidates = getParameterValueRecordsForSubstance('sodium_ion', pathway);
      const rfdCandidates = candidates.filter(c => c.input_key === 'rfd_oral_mg_per_kg_bw_day');
      
      // We expect the candidates to exist (no current_default is the issue, not a missing record entirely)
      expect(rfdCandidates.length).toBeGreaterThan(0);

      for (const candidate of rfdCandidates) {
        expect(candidate.default_status).not.toBe('current_default');
      }

      // 2. Integration check: test the resolver behavior with each valid candidate value
      for (const candidate of rfdCandidates) {
        const used: CalculatorUsedValue[] = [
          {
            input_key: 'rfd_oral_mg_per_kg_bw_day',
            label: 'rfd',
            value: candidate.value,
            unit: candidate.unit,
            role: 'current calculator default',
            pathway: pathway,
            substance_key: 'sodium_ion',
          },
        ];
        
        const [row] = resolveProvenanceRows(used);
        if (row.catalog_record) {
          expect(row.catalog_record.default_status).not.toBe('current_default');
        }
      }
    });
  }
});
