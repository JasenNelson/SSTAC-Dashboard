import { describe, it, expect } from 'vitest';
import {
  HC_PQRA_INHALATION_PROMOTION_VALUE_IDS,
  HC_PQRA_INHALATION_PROMOTION_SOURCE_ID,
  planPromotion,
} from '../promote-hc-pqra-inhalation.mjs';

// The required EXACT keys as given by precedent. No more, no less.
const EXACT_KEYS = [
  'parameter_value_id',
  'substance_key',
  'pathway',
  'value_type',
  'default_status',
  'evidence_support_status',
  'extraction_status',
  'qa_status',
  'source_ids',
  'equation_ids',
  'jurisdiction',
  'source_authority_tier',
  'canonical_source_status',
  'bc_protocol_alignment',
  'bc_protocol_basis',
  'source_crystallization_date',
  'receptor_groups',
  'species_groups',
  'input_key',
  'display_name',
  'value',
  'unit',
  'applicability',
  'uncertainty',
  'evidence_items',
  'review_notes',
  'source_relationships',
  'population_groups',
  'assumption_tags',
  'candidate_group_id',
].sort();

describe('promote-hc-pqra-inhalation', () => {
  it('a) produces exactly 4 rows with exact keys, values, and units', () => {
    const plan = planPromotion([], {});
    expect(plan.appendRecords).toHaveLength(4);

    const adultIr = plan.appendRecords.find(r => r.parameter_value_id === 'pv-hc-pqra-v4-2024-ir-air-adult-ca');
    expect(adultIr.input_key).toBe('IR_air_m3_per_day');
    expect(adultIr.value).toBe(16.6);
    expect(adultIr.unit).toBe('m3/day');

    const toddlerIr = plan.appendRecords.find(r => r.parameter_value_id === 'pv-hc-pqra-v4-2024-ir-air-toddler-ca');
    expect(toddlerIr.input_key).toBe('IR_air_m3_per_day');
    expect(toddlerIr.value).toBe(8.3);
    expect(toddlerIr.unit).toBe('m3/day');

    const hi = plan.appendRecords.find(r => r.parameter_value_id === 'pv-bc-csr-hi-target-ca');
    expect(hi.input_key).toBe('HI');
    expect(hi.value).toBe(1.0);
    expect(hi.unit).toBe('unitless');
    expect(hi.jurisdiction).toBe('BC');
    expect(hi.source_ids).toEqual(['src-bc-csr-375-96']);

    const ilcr = plan.appendRecords.find(r => r.parameter_value_id === 'pv-hc-pqra-v4-2024-ilcr-target-ca');
    expect(ilcr.input_key).toBe('ILCR_target');
    expect(ilcr.value).toBe(0.00001);
    expect(ilcr.unit).toBe('unitless');
  });

  it('b) every row has qa_status needs_review and default_status not_default', () => {
    const plan = planPromotion([], {});
    for (const r of plan.appendRecords) {
      expect(r.qa_status).toBe('needs_review');
      expect(r.default_status).toBe('not_default');
    }
  });

  it('c) pathway human-health-direct + substance_key generic', () => {
    const plan = planPromotion([], {});
    for (const r of plan.appendRecords) {
      expect(r.pathway).toBe('human-health-direct');
      expect(r.substance_key).toBe('generic');
    }
  });

  it('d) source_ids: 2 IR_air rows use the HC source; the HI and ILCR rows use the BC CSR source', () => {
    const plan = planPromotion([], {});
    for (const r of plan.appendRecords) {
      if (r.parameter_value_id === 'pv-bc-csr-hi-target-ca' || r.parameter_value_id === 'pv-hc-pqra-v4-2024-ilcr-target-ca') {
        expect(r.source_ids).toEqual(['src-bc-csr-375-96']);
      } else {
        expect(r.source_ids).toEqual([HC_PQRA_INHALATION_PROMOTION_SOURCE_ID]);
      }
    }
  });

  it('e) idempotency guard rejects re-apply of an existing id', () => {
    const existingParamValues = [
      { parameter_value_id: 'pv-bc-csr-hi-target-ca' }
    ];
    expect(() => planPromotion(existingParamValues, {})).toThrow(/idempotency guard rejected re-apply/);
  });

  it('f) field set matches the precedent row exact keys (no missing/extra keys)', () => {
    const plan = planPromotion([], {});
    for (const r of plan.appendRecords) {
      const recordKeys = Object.keys(r).sort();
      expect(recordKeys).toEqual(EXACT_KEYS);
    }
  });
});
