import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createClient: vi.fn(),
  cookies: vi.fn(),
  checkCsrf: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/engine-v2/csrf', () => ({
  checkCsrf: mocks.checkCsrf,
}));

import { POST } from '../route';

const SAMPLE_ID = '11111111-1111-4111-8111-111111111111';
const COPPER_ID = '33333333-3333-4333-8333-333333333333';
const LEAD_ID = '44444444-4444-4444-8444-444444444444';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/matrix-map/export', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

function chain(finalValue: unknown) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    limit: vi.fn(() => api),
    maybeSingle: vi.fn(async () => finalValue),
  };
  return api;
}

describe('POST /api/matrix-map/export', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    mocks.cookies.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
    });
    mocks.checkCsrf.mockReturnValue({ ok: true });
  });

  it('server-refetches measurements and writes export/service audit rows', async () => {
    const roleQuery = chain({ data: { role: 'matrix_admin' }, error: null });
    const rpc = vi.fn(async () => ({
      data: [
        {
          sample_id: SAMPLE_ID,
          sample_station_id: 'STA-1',
          event_date: '2026-01-02',
          medium: 'sediment',
          substance_id: COPPER_ID,
          substance_key: 'copper',
          substance_display_name: 'Copper',
          value: 12.5,
          unit: 'mg/kg',
          detection_limit: null,
          qualifier: null,
          censored: false,
          coordinate_quality_tier: 'high',
          classification: 'reference',
          source_dra_id: 'dra-1',
          source_dra_title: 'Source DRA',
        },
        {
          sample_id: SAMPLE_ID,
          sample_station_id: 'STA-1',
          event_date: '2026-01-02',
          medium: 'water',
          substance_id: LEAD_ID,
          substance_key: 'lead',
          substance_display_name: 'Lead',
          value: 3,
          unit: 'ug/L',
          detection_limit: null,
          qualifier: null,
          censored: false,
          coordinate_quality_tier: 'medium',
          classification: 'reference',
          source_dra_id: 'dra-1',
          source_dra_title: 'Source DRA',
        },
      ],
      error: null,
    }));
    const authClient = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
          error: null,
        })),
      },
      from: vi.fn(() => roleQuery),
      schema: vi.fn(() => ({ rpc })),
    };

    const exportAuditInsert = vi.fn(async () => ({ error: null }));
    const serviceAuditInsert = vi.fn(async () => ({ error: null }));
    const serviceClient = {
      schema: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'export_audit') return { insert: exportAuditInsert };
          if (table === 'service_role_audit') return { insert: serviceAuditInsert };
          throw new Error(`unexpected table ${table}`);
        }),
      })),
    };
    mocks.createServerClient.mockReturnValue(authClient);
    mocks.createClient.mockReturnValue(serviceClient);

    const response = await POST(makeRequest({
      export_type: 'measurements',
      selected_sample_ids: [SAMPLE_ID],
      filters: {
        mediums: ['sediment'],
        substance_ids: [COPPER_ID],
        qa: 'detected',
        classification: 'reference',
      },
    }));

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('coordinate_provenance');
    expect(csv).toContain('Surveyed');
    expect(csv).toContain('Copper');
    expect(csv).not.toContain('Lead');
    expect(response.headers.get('content-disposition')).toContain('matrix-map-measurements');
    expect(rpc).toHaveBeenCalledWith('fetch_measurements_for_samples', {
      p_sample_ids: [SAMPLE_ID],
    });
    expect(exportAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        exported_by: '22222222-2222-4222-8222-222222222222',
        row_count: 1,
      }),
    );
    expect(serviceAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        rpc_name: 'matrix_map_export_csv',
        affected_rows: 1,
      }),
    );
    const serviceAuditPayload = serviceAuditInsert.mock.calls.at(0)?.at(0) as
      | Record<string, unknown>
      | undefined;
    expect(serviceAuditPayload).not.toHaveProperty('client_ip');
  });

  it('excludes undated rows under an active date filter and emits the date_precision column', async () => {
    const roleQuery = chain({ data: { role: 'matrix_admin' }, error: null });
    const rpc = vi.fn(async () => ({
      data: [
        {
          sample_id: SAMPLE_ID,
          sample_station_id: 'STA-1',
          event_date: '2026-01-02',
          date_precision: 'exact',
          medium: 'sediment',
          substance_id: COPPER_ID,
          substance_key: 'copper',
          substance_display_name: 'Copper',
          value: 12.5,
          unit: 'mg/kg',
          detection_limit: null,
          qualifier: null,
          censored: false,
          coordinate_quality_tier: 'high',
          classification: 'reference',
          source_dra_id: 'dra-1',
          source_dra_title: 'Source DRA',
        },
        {
          sample_id: SAMPLE_ID,
          sample_station_id: 'STA-1',
          event_date: null,
          date_precision: 'undated',
          medium: 'sediment',
          substance_id: LEAD_ID,
          substance_key: 'lead',
          substance_display_name: 'Lead',
          value: 3,
          unit: 'mg/kg',
          detection_limit: null,
          qualifier: null,
          censored: false,
          coordinate_quality_tier: 'medium',
          classification: 'reference',
          source_dra_id: 'dra-1',
          source_dra_title: 'Source DRA',
        },
      ],
      error: null,
    }));
    const authClient = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
          error: null,
        })),
      },
      from: vi.fn(() => roleQuery),
      schema: vi.fn(() => ({ rpc })),
    };
    const serviceClient = {
      schema: vi.fn(() => ({
        from: vi.fn((table: string) => ({ insert: vi.fn(async () => ({ error: null })), _t: table })),
      })),
    };
    mocks.createServerClient.mockReturnValue(authClient);
    mocks.createClient.mockReturnValue(serviceClient);

    // (1) With a date filter active, the undated Lead row is excluded; only dated Copper exports.
    const filtered = await POST(makeRequest({
      export_type: 'measurements',
      selected_sample_ids: [SAMPLE_ID],
      filters: { date_from: '2026-01-01' },
    }));
    expect(filtered.status).toBe(200);
    const filteredCsv = await filtered.text();
    expect(filteredCsv).toContain('date_precision'); // header column present
    expect(filteredCsv).toContain('coordinate_provenance');
    expect(filteredCsv).toContain('Surveyed');
    expect(filteredCsv).toContain('Copper');
    expect(filteredCsv).not.toContain('Lead');

    // (2) With no date filter, the undated row IS included and carries date_precision=undated.
    const unfiltered = await POST(makeRequest({
      export_type: 'measurements',
      selected_sample_ids: [SAMPLE_ID],
      filters: {},
    }));
    const unfilteredCsv = await unfiltered.text();
    expect(unfilteredCsv).toContain('Lead');
    expect(unfilteredCsv).toContain('Centroid');
    expect(unfilteredCsv).toContain('undated');
  });

  it('rejects invalid sample ids before querying Supabase', async () => {
    const authClient = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
          error: null,
        })),
      },
      from: vi.fn(() => chain({ data: { role: 'admin' }, error: null })),
      schema: vi.fn(),
    };
    mocks.createServerClient.mockReturnValue(authClient);

    const response = await POST(makeRequest({
      export_type: 'selection',
      selected_sample_ids: ['not-a-uuid'],
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_payload',
    });
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  describe('auth + CSRF gate', () => {
    it('returns 401 when there is no user', async () => {
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: null },
            error: null,
          })),
        },
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({ export_type: 'selection', selected_sample_ids: [SAMPLE_ID] }));
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'unauthorized' });
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 403 when user is authenticated but not an admin', async () => {
      // A non-admin user's role query returns no row because the DB-level admin-role
      // filter excludes them. Capture the chain so we can also assert the CRITICAL
      // .in('role', ['admin','matrix_admin']) filter is applied -- so that dropping or
      // broadening that filter (fail-open) would make this test FAIL, not silently pass.
      const roleQuery = chain({ data: null, error: null });
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => roleQuery),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({ export_type: 'selection', selected_sample_ids: [SAMPLE_ID] }));
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({ error: 'forbidden' });
      // Lock BOTH admin-check predicates so either fail-open regression makes this test fail:
      // - .eq('user_id', <caller>) -- dropping it lets a non-admin match ANY admin row.
      // - .in('role', ['admin','matrix_admin']) -- dropping/broadening it accepts non-admins.
      expect(authClient.from).toHaveBeenCalledWith('user_roles');
      expect(roleQuery.eq).toHaveBeenCalledWith('user_id', '22222222-2222-4222-8222-222222222222');
      expect(roleQuery.in).toHaveBeenCalledWith('role', ['admin', 'matrix_admin']);
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 500 with admin_role_query_failed when role query returns an error', async () => {
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: null, error: { message: 'db error' } })),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({ export_type: 'selection', selected_sample_ids: [SAMPLE_ID] }));
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('admin_role_query_failed');
      expect(data.detail).toBe('db error');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 415 when checkCsrf rejects with missing/wrong content-type', async () => {
      mocks.checkCsrf.mockReturnValue({ ok: false, reason: 'missing_content_type' });
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({ export_type: 'selection', selected_sample_ids: [SAMPLE_ID] }));
      expect(response.status).toBe(415);
      const data = await response.json();
      expect(data.error).toBe('missing_content_type');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 403 when checkCsrf rejects on origin mismatch', async () => {
      mocks.checkCsrf.mockReturnValue({ ok: false, reason: 'origin_mismatch' });
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({ export_type: 'selection', selected_sample_ids: [SAMPLE_ID] }));
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('origin_mismatch');
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });
});
