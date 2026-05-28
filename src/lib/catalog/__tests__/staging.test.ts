import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  listPendingStagingRows,
  approveStagingRow,
  rejectStagingRow,
  markSupersededStagingRows,
} from '../staging';

// ---------------------------------------------------------------------------
// Supabase mock infrastructure
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock('@/lib/supabase-auth', () => ({
  createAuthenticatedClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock state + fixtures
// ---------------------------------------------------------------------------

interface MockState {
  user: { id: string } | null;
  isAdmin: boolean;
  // For listPendingStagingRows
  listRows: unknown[];
  listError: { message: string } | null;
  // For approveStagingRow (RPC)
  rpcResult: { data: unknown; error: { message: string } | null };
  // For rejectStagingRow
  rejectUpdateResult: { data: unknown; error: { message: string } | null };
  // For markSupersededStagingRows
  supersedeUpdateResult: { data: unknown[]; error: { message: string } | null };
}

const callTrace: {
  rpc: { fn: string; args: unknown }[];
  from: string[];
  update: { table: string; payload: unknown }[];
  insert: { table: string; payload: unknown }[];
} = { rpc: [], from: [], update: [], insert: [] };

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'staging-1',
    source_zotero_key: 'ZK_001',
    source_attachment_path: '/zotero/a.pdf',
    extraction_pass_id: 'pass-1',
    extraction_pass_started_at: '2026-05-27T10:00:00Z',
    extraction_pass_finished_at: null,
    extracted_at: '2026-05-27T10:05:00Z',
    proposed_kind: 'parameter_value',
    proposed_payload: { substance_key: 'cadmium', value: '0.6' },
    confidence: 0.85,
    extraction_notes: 'Page 12, Table 3',
    extraction_model: 'gemma3:12b',
    hitl_status: 'pending',
    hitl_reviewed_by: null,
    hitl_reviewed_at: null,
    hitl_review_notes: null,
    promoted_to_id: null,
    created_by: null,
    created_by_role: 'agent_service_role',
    created_at: '2026-05-27T10:05:00Z',
    ...overrides,
  };
}

let mockState: MockState;

beforeEach(() => {
  vi.clearAllMocks();
  callTrace.rpc = [];
  callTrace.from = [];
  callTrace.update = [];
  callTrace.insert = [];

  mockState = {
    user: { id: 'admin-uuid-1' },
    isAdmin: true,
    listRows: [makeRow()],
    listError: null,
    rpcResult: { data: 'promoted-uuid-1', error: null },
    rejectUpdateResult: { data: { id: 'staging-1' }, error: null },
    supersedeUpdateResult: {
      data: [{ id: 'staging-1' }, { id: 'staging-2' }, { id: 'staging-3' }],
      error: null,
    },
  };

  mockGetUser.mockImplementation(async () => ({
    data: { user: mockState.user },
    error: null,
  }));

  mockRpc.mockImplementation((fn: string, args: unknown) => {
    callTrace.rpc.push({ fn, args });
    return Promise.resolve(mockState.rpcResult);
  });

  mockFrom.mockImplementation((tableName: string) => {
    callTrace.from.push(tableName);

    if (tableName === 'user_roles') {
      return {
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({
              data: mockState.isAdmin ? [{ role: 'admin' }] : [],
              error: null,
            }),
          }),
        }),
      };
    }

    if (tableName === 'catalog_extraction_staging') {
      return {
        // listPendingStagingRows chain
        select: () => {
          const listResult = { data: mockState.listRows, error: mockState.listError };
          const builder: Record<string, unknown> = {};
          (builder as any).eq = () => builder;
          (builder as any).order = () => builder;
          (builder as any).range = () => builder;
          (builder as any).in = () => builder;
          (builder as any).then = (resolve: (v: unknown) => void) => resolve(listResult);
          return builder;
        },
        update: (payload: unknown) => {
          callTrace.update.push({ table: tableName, payload });
          const builder: Record<string, unknown> = {};
          (builder as any).eq = () => builder;
          (builder as any).select = () => {
            const sub: Record<string, unknown> = {};
            (sub as any).single = async () => mockState.rejectUpdateResult;
            (sub as any).then = (resolve: (v: unknown) => void) =>
              resolve(mockState.supersedeUpdateResult);
            return sub;
          };
          (builder as any).then = (resolve: (v: unknown) => void) =>
            resolve(mockState.rejectUpdateResult);
          return builder;
        },
        insert: (payload: unknown) => {
          callTrace.insert.push({ table: tableName, payload });
          return {
            select: () => ({
              single: async () => ({ data: null, error: { message: 'unexpected staging insert' } }),
            }),
          };
        },
      };
    }

    if (
      tableName === 'promoted_parameter_values' ||
      tableName === 'catalog_evidence_items' ||
      tableName === 'source_lead_triage'
    ) {
      // Production targets: this file's approve flow no longer calls .from(target)
      // directly (it uses .rpc). Any insert here would indicate a regression.
      return {
        insert: (payload: unknown) => {
          callTrace.insert.push({ table: tableName, payload });
          return {
            select: () => ({
              single: async () => ({
                data: null,
                error: { message: `unexpected direct insert on ${tableName} from staging.ts` },
              }),
            }),
          };
        },
      };
    }

    throw new Error(`unexpected from(${tableName})`);
  });
});

// ---------------------------------------------------------------------------
// listPendingStagingRows
// ---------------------------------------------------------------------------

describe('listPendingStagingRows', () => {
  it('returns mapped rows on success', async () => {
    mockState.listRows = [makeRow({ id: 'staging-A' }), makeRow({ id: 'staging-B' })];
    const rows = await listPendingStagingRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('staging-A');
    expect(rows[1].id).toBe('staging-B');
    expect(rows[0].proposed_kind).toBe('parameter_value');
    expect(rows[0].hitl_status).toBe('pending');
    expect(callTrace.from).toContain('catalog_extraction_staging');
  });

  it('returns empty list when Supabase returns an error (does not throw)', async () => {
    mockState.listError = { message: 'permission denied' };
    mockState.listRows = [];
    const rows = await listPendingStagingRows();
    expect(rows).toEqual([]);
  });

  it('returns empty list when limit=0 (short-circuit)', async () => {
    const rows = await listPendingStagingRows({ limit: 0 });
    expect(rows).toEqual([]);
    // Should not even hit the database for limit=0.
    expect(callTrace.from).not.toContain('catalog_extraction_staging');
  });
});

// ---------------------------------------------------------------------------
// approveStagingRow (RPC-based)
// ---------------------------------------------------------------------------

describe('approveStagingRow', () => {
  it('throws when no authenticated user', async () => {
    mockState.user = null;
    await expect(
      approveStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/no authenticated user/);
    expect(callTrace.rpc).toEqual([]);
  });

  it('throws when user lacks admin role', async () => {
    mockState.isAdmin = false;
    await expect(
      approveStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/admin or matrix_admin role/);
    expect(callTrace.rpc).toEqual([]);
  });

  it('throws when stagingId is empty', async () => {
    await expect(
      approveStagingRow({ stagingId: '' }),
    ).rejects.toThrow(/stagingId is required/);
    expect(callTrace.rpc).toEqual([]);
  });

  it('admin can approve: calls RPC catalog_approve_staging_row and returns promotedToId', async () => {
    mockState.rpcResult = { data: 'promoted-uuid-XYZ', error: null };
    const result = await approveStagingRow({
      stagingId: 'staging-1',
      hitlNotes: 'Looks good',
    });
    expect(result.ok).toBe(true);
    expect(result.promotedToId).toBe('promoted-uuid-XYZ');
    expect(callTrace.rpc).toHaveLength(1);
    expect(callTrace.rpc[0].fn).toBe('catalog_approve_staging_row');
    expect(callTrace.rpc[0].args).toEqual({
      p_staging_id: 'staging-1',
      p_hitl_notes: 'Looks good',
    });
    // CRITICAL: no direct INSERT into any production table from staging.ts.
    const productionInserts = callTrace.insert.filter(
      (c) =>
        c.table === 'promoted_parameter_values' ||
        c.table === 'catalog_evidence_items' ||
        c.table === 'source_lead_triage',
    );
    expect(productionInserts).toEqual([]);
  });

  it('passes null hitlNotes through when omitted', async () => {
    await approveStagingRow({ stagingId: 'staging-1' });
    expect(callTrace.rpc[0].args).toEqual({
      p_staging_id: 'staging-1',
      p_hitl_notes: null,
    });
  });

  it('throws when RPC returns unknown proposed_kind error (surfaces RPC message)', async () => {
    mockState.rpcResult = {
      data: null,
      error: {
        message: 'catalog_approve_staging_row: unknown proposed_kind invalid_kind on staging row staging-1',
      },
    };
    await expect(
      approveStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/unknown proposed_kind/);
  });

  it('throws when RPC returns "already non-pending" error (surfaces RPC message)', async () => {
    mockState.rpcResult = {
      data: null,
      error: {
        message: 'catalog_approve_staging_row: staging row staging-1 is approved, cannot approve',
      },
    };
    await expect(
      approveStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/is approved, cannot approve/);
  });

  it('throws when RPC returns "no payload columns match target" error', async () => {
    mockState.rpcResult = {
      data: null,
      error: {
        message: 'catalog_approve_staging_row: no payload columns match target table promoted_parameter_values schema for staging row staging-1',
      },
    };
    await expect(
      approveStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/no payload columns match/);
  });

  it('throws when RPC returns null promoted_to_id (defensive)', async () => {
    mockState.rpcResult = { data: null, error: null };
    await expect(
      approveStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/no promoted_to_id/);
  });

  it('accepts RPC response wrapped as {catalog_approve_staging_row: id}', async () => {
    // Defensive: some PostgREST shapes wrap scalar returns in the function name key.
    mockState.rpcResult = {
      data: { catalog_approve_staging_row: 'wrapped-id-1' },
      error: null,
    };
    const result = await approveStagingRow({ stagingId: 'staging-1' });
    expect(result.promotedToId).toBe('wrapped-id-1');
  });
});

// ---------------------------------------------------------------------------
// rejectStagingRow
// ---------------------------------------------------------------------------

describe('rejectStagingRow', () => {
  it('throws when no authenticated user', async () => {
    mockState.user = null;
    await expect(
      rejectStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/no authenticated user/);
    expect(callTrace.update).toEqual([]);
  });

  it('throws when user lacks admin role', async () => {
    mockState.isAdmin = false;
    await expect(
      rejectStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/admin or matrix_admin role/);
    expect(callTrace.update).toEqual([]);
  });

  it('updates staging row to hitl_status=rejected and does NOT promote', async () => {
    const result = await rejectStagingRow({
      stagingId: 'staging-1',
      hitlNotes: 'Out-of-scope substance',
    });
    expect(result.ok).toBe(true);
    // No production insert.
    const productionInserts = callTrace.insert.filter(
      (c) =>
        c.table === 'promoted_parameter_values' ||
        c.table === 'catalog_evidence_items' ||
        c.table === 'source_lead_triage',
    );
    expect(productionInserts).toEqual([]);
    // Staging UPDATE with hitl_status=rejected.
    const stagingUpdates = callTrace.update.filter(
      (c) => c.table === 'catalog_extraction_staging',
    );
    expect(stagingUpdates.length).toBeGreaterThanOrEqual(1);
    const upd = stagingUpdates[0].payload as Record<string, unknown>;
    expect(upd.hitl_status).toBe('rejected');
    expect(upd.hitl_review_notes).toBe('Out-of-scope substance');
    expect(upd).not.toHaveProperty('promoted_to_id');
  });

  it('throws when staging row is missing or already non-pending', async () => {
    mockState.rejectUpdateResult = { data: null, error: null };
    await expect(
      rejectStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/not found or not pending/);
  });

  it('throws when Supabase UPDATE returns an error', async () => {
    mockState.rejectUpdateResult = {
      data: null,
      error: { message: 'connection failed' },
    };
    await expect(
      rejectStagingRow({ stagingId: 'staging-1' }),
    ).rejects.toThrow(/UPDATE failed/);
  });
});

// ---------------------------------------------------------------------------
// markSupersededStagingRows
// ---------------------------------------------------------------------------

describe('markSupersededStagingRows', () => {
  it('throws when no authenticated user', async () => {
    mockState.user = null;
    await expect(
      markSupersededStagingRows({ extractionPassId: 'pass-1' }),
    ).rejects.toThrow(/no authenticated user/);
  });

  it('throws when extractionPassId is empty', async () => {
    await expect(
      markSupersededStagingRows({ extractionPassId: '' }),
    ).rejects.toThrow(/extractionPassId is required/);
  });

  it('bulk-marks rows superseded and returns count; rows stay in staging table', async () => {
    const result = await markSupersededStagingRows({ extractionPassId: 'pass-1' });
    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
    // Staging table received an UPDATE; no row deletion.
    const stagingUpdates = callTrace.update.filter(
      (c) => c.table === 'catalog_extraction_staging',
    );
    expect(stagingUpdates.length).toBeGreaterThanOrEqual(1);
    const upd = stagingUpdates[0].payload as Record<string, unknown>;
    expect(upd.hitl_status).toBe('superseded');
    expect(upd).not.toHaveProperty('promoted_to_id');
    expect(upd).not.toHaveProperty('hitl_reviewed_by');
    expect(upd).not.toHaveProperty('hitl_reviewed_at');
    // No INSERT into any target production table.
    const productionInserts = callTrace.insert.filter(
      (c) =>
        c.table === 'promoted_parameter_values' ||
        c.table === 'catalog_evidence_items' ||
        c.table === 'source_lead_triage',
    );
    expect(productionInserts).toEqual([]);
  });
});
