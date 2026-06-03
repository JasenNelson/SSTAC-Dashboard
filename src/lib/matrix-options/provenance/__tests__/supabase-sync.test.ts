import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  fetchPromotedValues,
  upsertPromotedValue,
  deletePromotedValue,
} from '../supabase-sync';
import type { PromotedParameterValueRecord } from '../promotion';

// Chainable Supabase builder mock. Awaiting any builder resolves to the next
// queued result; we also capture the last upsert payload + onConflict option so
// we can assert the deterministic record->payload mapping (String coercion,
// uncertainty null-coalescing, conflict key) without any network behaviour.

const mockFrom = vi.fn();
let resultQueue: Array<Record<string, unknown>> = [];
let lastUpsertPayload: Record<string, unknown> | undefined;
let lastUpsertOptions: { onConflict?: string } | undefined;

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'eq', 'upsert', 'delete']) {
    b[m] = vi.fn((...args: unknown[]) => {
      if (m === 'upsert') {
        lastUpsertPayload = args[0] as Record<string, unknown>;
        lastUpsertOptions = args[1] as { onConflict?: string };
      }
      return b;
    });
  }
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(resultQueue.shift() ?? { data: null, error: null });
  return b;
}

vi.mock('@/lib/supabase-auth', () => ({
  createAuthenticatedClient: vi.fn(() =>
    Promise.resolve({ from: mockFrom }),
  ),
}));

beforeEach(() => {
  resultQueue = [];
  lastUpsertPayload = undefined;
  lastUpsertOptions = undefined;
  mockFrom.mockReset();
  mockFrom.mockImplementation(() => builder());
});

function fullRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    parameter_value_id: 'pv-1',
    substance_key: 'lead',
    pathway: 'human-health-direct',
    input_key: 'rfd',
    display_name: 'Reference dose',
    value: '0.0036',
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    candidate_group_id: 'cg-1',
    default_status: 'current_default',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'approved',
    source_ids: ['s1', 's2'],
    equation_ids: ['e1'],
    jurisdiction: 'BC',
    applicability: 'screening',
    uncertainty: 'low',
    review_notes: 'ok',
    audit_history: [{ action: 'promote', actor: 'admin', timestamp: 't', note: null }],
    created_at: 't',
    updated_at: 't',
    ...overrides,
  };
}

function record(
  overrides: Partial<PromotedParameterValueRecord> = {},
): PromotedParameterValueRecord {
  return {
    parameter_value_id: 'pv-1',
    substance_key: 'lead',
    pathway: 'human-health-direct',
    input_key: 'rfd',
    display_name: 'Reference dose',
    value: 0.0036,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    candidate_group_id: 'cg-1',
    default_status: 'current_default',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'approved',
    source_ids: ['s1'],
    equation_ids: [],
    jurisdiction: 'BC',
    applicability: '',
    uncertainty: null,
    evidence_items: [],
    review_notes: '',
    audit_history: [],
    ...overrides,
  };
}

describe('fetchPromotedValues -- rowToRecord mapping', () => {
  it('maps a full row faithfully', () => {
    resultQueue = [{ data: [fullRow()], error: null }];
    return fetchPromotedValues().then((rows) => {
      expect(rows).toHaveLength(1);
      const r = rows[0];
      expect(r.parameter_value_id).toBe('pv-1');
      expect(r.substance_key).toBe('lead');
      expect(r.source_ids).toEqual(['s1', 's2']);
      expect(r.equation_ids).toEqual(['e1']);
      expect(r.uncertainty).toBe('low');
      expect(r.audit_history).toHaveLength(1);
    });
  });

  it('always sets evidence_items to [] (column does not exist in Supabase)', () => {
    // even if the row carried an evidence_items field, the mapper drops it.
    resultQueue = [{ data: [fullRow({ evidence_items: [{ junk: true }] })], error: null }];
    return fetchPromotedValues().then((rows) => {
      expect(rows[0].evidence_items).toEqual([]);
    });
  });

  it('coalesces missing scalar fields to empty strings / null', () => {
    resultQueue = [
      {
        data: [
          fullRow({
            substance_key: undefined,
            input_key: undefined,
            display_name: undefined,
            value: undefined,
            unit: undefined,
            jurisdiction: undefined,
            applicability: undefined,
            uncertainty: undefined,
            review_notes: undefined,
          }),
        ],
        error: null,
      },
    ];
    return fetchPromotedValues().then((rows) => {
      const r = rows[0];
      expect(r.substance_key).toBe('');
      expect(r.input_key).toBe('');
      expect(r.display_name).toBe('');
      expect(r.value).toBe('');
      expect(r.unit).toBe('');
      expect(r.jurisdiction).toBe('');
      expect(r.applicability).toBe('');
      expect(r.uncertainty).toBeNull();
      expect(r.review_notes).toBe('');
    });
  });

  it('guards non-array source_ids / equation_ids / audit_history to []', () => {
    resultQueue = [
      {
        data: [
          fullRow({
            source_ids: 'not-an-array',
            equation_ids: null,
            audit_history: undefined,
          }),
        ],
        error: null,
      },
    ];
    return fetchPromotedValues().then((rows) => {
      expect(rows[0].source_ids).toEqual([]);
      expect(rows[0].equation_ids).toEqual([]);
      expect(rows[0].audit_history).toEqual([]);
    });
  });

  it('returns [] on a Supabase error', () => {
    resultQueue = [{ data: null, error: { message: 'boom' } }];
    return fetchPromotedValues().then((rows) => expect(rows).toEqual([]));
  });

  it('returns [] when data is null', () => {
    resultQueue = [{ data: null, error: null }];
    return fetchPromotedValues().then((rows) => expect(rows).toEqual([]));
  });
});

describe('upsertPromotedValue -- recordToUpsertPayload mapping', () => {
  it('coerces a numeric value to a string and uses parameter_value_id as the conflict key', async () => {
    resultQueue = [{ error: null }];
    const ok = await upsertPromotedValue(record({ value: 0.0036 }));
    expect(ok).toBe(true);
    expect(lastUpsertPayload?.value).toBe('0.0036');
    expect(typeof lastUpsertPayload?.value).toBe('string');
    expect(lastUpsertOptions).toEqual({ onConflict: 'parameter_value_id' });
  });

  it('stamps an updated_at timestamp on the payload', async () => {
    resultQueue = [{ error: null }];
    await upsertPromotedValue(record());
    expect(typeof lastUpsertPayload?.updated_at).toBe('string');
    expect(Number.isNaN(Date.parse(lastUpsertPayload?.updated_at as string))).toBe(false);
  });

  it('null-coalesces an undefined uncertainty to null in the payload', async () => {
    resultQueue = [{ error: null }];
    await upsertPromotedValue(record({ uncertainty: undefined }));
    expect(lastUpsertPayload?.uncertainty).toBeNull();
  });

  it('does not include id or created_at in the payload', async () => {
    resultQueue = [{ error: null }];
    await upsertPromotedValue(record());
    expect(lastUpsertPayload).not.toHaveProperty('id');
    expect(lastUpsertPayload).not.toHaveProperty('created_at');
  });

  it('returns false on an upsert error', async () => {
    resultQueue = [{ error: { message: 'conflict' } }];
    expect(await upsertPromotedValue(record())).toBe(false);
  });
});

describe('deletePromotedValue', () => {
  it('returns true on success', async () => {
    resultQueue = [{ error: null }];
    expect(await deletePromotedValue('pv-1')).toBe(true);
  });

  it('returns false on a Supabase error', async () => {
    resultQueue = [{ error: { message: 'nope' } }];
    expect(await deletePromotedValue('pv-1')).toBe(false);
  });
});
