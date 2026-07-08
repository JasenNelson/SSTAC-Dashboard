// Unit tests for dlPcbTeqTdi.ts.
// Exercises resolveDlPcbTeqTdi in isolation: happy path plus every fail-closed
// branch (missing record, non-finite/non-positive value, unit mismatch).
// Plain ASCII only (code point <= 127).

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveDlPcbTeqTdi } from '../dlPcbTeqTdi';
import { getParameterValueRecord } from '../provenance/catalog';
import type { ParameterValueRecord } from '../provenance/types';

vi.mock('../provenance/catalog', () => ({
  getParameterValueRecord: vi.fn(),
}));

const mockGetRecord = vi.mocked(getParameterValueRecord);

function baseRecord(overrides: Partial<ParameterValueRecord> = {}): ParameterValueRecord {
  return {
    parameter_value_id: 'pv-hc-dioxin-like-teq-hh-direct-oral-tdi',
    substance_key: 'dioxin_like_teq',
    pathway: 'human-health-direct',
    input_key: 'oral_tdi_teq_mg_per_kg_bw_day',
    display_name: 'Dioxin-like TEQ oral TDI (provisional) - Health Canada TRV v4.0 (2025)',
    value: 2.3e-9,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    candidate_group_id: 'human-health-direct__dioxin_like_teq__oral_tdi_teq_mg_per_kg_bw_day',
    default_status: 'available_option',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: ['src-health-canada-trv-v4-2025'],
    equation_ids: ['eq-human-health-direct-contact'],
    jurisdiction: 'Canada_federal',
    applicability: 'Health Canada oral TDI for dioxin-like TEQ.',
    uncertainty: 'TDI is PROVISIONAL.',
    evidence_items: [],
    review_notes: '',
    ...overrides,
  } as ParameterValueRecord;
}

describe('resolveDlPcbTeqTdi', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves the happy path: finite positive value with the expected unit', () => {
    mockGetRecord.mockReturnValue(baseRecord());
    const result = resolveDlPcbTeqTdi();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tdi_mg_per_kg_bw_day).toBe(2.3e-9);
      expect(result.parameterValueId).toBe('pv-hc-dioxin-like-teq-hh-direct-oral-tdi');
      expect(result.qaStatus).toBe('needs_review');
      expect(result.unit).toBe('mg/kg-bw/day');
    }
  });

  it('is fail-closed when the catalog record is missing', () => {
    mockGetRecord.mockReturnValue(undefined);
    const result = resolveDlPcbTeqTdi();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/not found/i);
    }
  });

  it('is fail-closed when the value is non-finite (NaN)', () => {
    mockGetRecord.mockReturnValue(baseRecord({ value: 'not-a-number' }));
    const result = resolveDlPcbTeqTdi();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/finite positive number/i);
    }
  });

  it('is fail-closed when the value is zero', () => {
    mockGetRecord.mockReturnValue(baseRecord({ value: 0 }));
    const result = resolveDlPcbTeqTdi();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/finite positive number/i);
    }
  });

  it('is fail-closed when the value is negative', () => {
    mockGetRecord.mockReturnValue(baseRecord({ value: -2.3e-9 }));
    const result = resolveDlPcbTeqTdi();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/finite positive number/i);
    }
  });

  it('is fail-closed when the unit does not match mg/kg-bw/day', () => {
    mockGetRecord.mockReturnValue(baseRecord({ unit: 'ug/kg-bw/day' }));
    const result = resolveDlPcbTeqTdi();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/unit/i);
    }
  });
});
