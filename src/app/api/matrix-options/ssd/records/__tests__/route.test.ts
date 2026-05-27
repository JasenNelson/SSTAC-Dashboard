// Unit tests for POST /api/matrix-options/ssd/records and GET health check.
//
// The existing routes.test.ts at src/app/api/matrix-options/ssd/__tests__/
// already covers:
//   - GET 503 when ECOTOX env vars are missing (not_configured)
//   - GET/POST 503 when ECOTOX_SUPABASE_URL is invalid (invalid_config)
//
// This file covers the REMAINING uncovered paths:
//   - GET: successful health response (configured + healthy client)
//   - GET: 502 when checkEcotoxMirrorHealth throws
//   - POST: 400 when chemicalNames is missing / empty
//   - POST: 400 when request body is invalid JSON
//   - POST: 200 successful fetch with chemical filter
//   - POST: 503 when not configured (belt-and-suspenders path)
//   - POST: 500 when fetchEcotoxRows throws
//   - POST: truncated response at maxRows cap

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Hoisted mock handles
// ---------------------------------------------------------------------------
const {
  mockGetEcotoxConfigStatus,
  mockGetEcotoxClientConfig,
  mockCreateEcotoxClient,
  mockCheckEcotoxMirrorHealth,
  mockFetchEcotoxRows,
  mockBuildEcotoxFetchRequest,
  mockGetEcotoxConfigErrorPayload,
} = vi.hoisted(() => ({
  mockGetEcotoxConfigStatus: vi.fn(),
  mockGetEcotoxClientConfig: vi.fn(),
  mockCreateEcotoxClient: vi.fn(),
  mockCheckEcotoxMirrorHealth: vi.fn(),
  mockFetchEcotoxRows: vi.fn(),
  mockBuildEcotoxFetchRequest: vi.fn(),
  mockGetEcotoxConfigErrorPayload: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/matrix-options/ssd/supabase', () => ({
  ECOTOX_REQUIRED_COLUMNS: ['chemical_name', 'species_scientific_name', 'conc1_mean'],
  ECOTOX_TABLE_NAME: 'toxicology_data',
  buildEcotoxFetchRequest: mockBuildEcotoxFetchRequest,
  checkEcotoxMirrorHealth: mockCheckEcotoxMirrorHealth,
  createEcotoxClient: mockCreateEcotoxClient,
  fetchEcotoxRows: mockFetchEcotoxRows,
  getEcotoxConfigErrorPayload: mockGetEcotoxConfigErrorPayload,
  getEcotoxConfigStatus: mockGetEcotoxConfigStatus,
  getEcotoxClientConfig: mockGetEcotoxClientConfig,
}));

// ---------------------------------------------------------------------------
// Import handlers AFTER mocks
// ---------------------------------------------------------------------------
import { GET, POST } from '../route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STUB_CONFIG = { url: 'https://ecotox.supabase.co', anonKey: 'anon-key' };
const STUB_CLIENT = {} as unknown as import('@supabase/supabase-js').SupabaseClient;

function makePostRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

function makePostRequestThrows(): NextRequest {
  return {
    json: async () => { throw new SyntaxError('Unexpected token'); },
  } as unknown as NextRequest;
}

function configuredStatus() {
  return { configured: true, error: null, missing: [], invalid: [] };
}

function notConfiguredStatus() {
  return {
    configured: false,
    error: 'ecotox_supabase_not_configured',
    missing: ['ECOTOX_SUPABASE_URL'],
    invalid: [],
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: configured + valid client
  mockGetEcotoxConfigStatus.mockReturnValue(configuredStatus());
  mockGetEcotoxClientConfig.mockReturnValue(STUB_CONFIG);
  mockCreateEcotoxClient.mockReturnValue(STUB_CLIENT);
  mockGetEcotoxConfigErrorPayload.mockImplementation((status: { error: string; missing: string[]; invalid: string[] }) => ({
    error: status.error,
    configured: false,
    missing: status.missing,
    invalid: status.invalid,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET health check
// ---------------------------------------------------------------------------

describe('GET /api/matrix-options/ssd/records -- health check', () => {
  it('returns 200 with health payload when configured and healthy', async () => {
    const healthPayload = {
      configured: true,
      status: 'ok',
      table: 'toxicology_data',
      requiredColumns: ['chemical_name', 'species_scientific_name', 'conc1_mean'],
      rowCount: 120000,
      rowCountAvailable: true,
      readable: true,
      limits: { search: 50, pageSize: 1000, maxFetchRows: 5000 },
    };
    mockCheckEcotoxMirrorHealth.mockResolvedValue(healthPayload);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.status).toBe('ok');
    expect(body.rowCount).toBe(120000);
    expect(mockCheckEcotoxMirrorHealth).toHaveBeenCalledWith(STUB_CLIENT);
  });

  it('returns 503 when not_configured (config status says not configured)', async () => {
    mockGetEcotoxConfigStatus.mockReturnValue(notConfiguredStatus());
    mockGetEcotoxClientConfig.mockReturnValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.rowCount).toBeNull();
    expect(body.readable).toBe(false);
    expect(body.rowCountAvailable).toBe(false);
    // Health check must NOT have been called
    expect(mockCheckEcotoxMirrorHealth).not.toHaveBeenCalled();
  });

  it('returns 502 when checkEcotoxMirrorHealth throws', async () => {
    mockCheckEcotoxMirrorHealth.mockRejectedValue(new Error('connection refused'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('ecotox_mirror_health_failed');
    expect(body.configured).toBe(true);
    expect(body.readable).toBe(false);
    expect(body.rowCount).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST fetch records
// ---------------------------------------------------------------------------

describe('POST /api/matrix-options/ssd/records -- fetch records', () => {
  it('returns 400 when request body fails JSON parse', async () => {
    mockBuildEcotoxFetchRequest.mockImplementation(() => {
      throw new SyntaxError('Unexpected token');
    });

    const response = await POST(makePostRequestThrows());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_request');
    expect(typeof body.detail).toBe('string');
  });

  it('returns 400 when chemicalNames is empty after normalisation', async () => {
    mockBuildEcotoxFetchRequest.mockReturnValue({
      chemicalNames: [],
      medium: undefined,
      mediaFilter: undefined,
      endpointFilters: [],
      maxRows: 5000,
    });

    const response = await POST(makePostRequest({ chemicalNames: [] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('chemicalNames_required');
    expect(body.rows).toEqual([]);
    expect(body.truncated).toBe(false);
  });

  it('returns 400 when chemicalNames is absent (normalises to empty)', async () => {
    mockBuildEcotoxFetchRequest.mockReturnValue({
      chemicalNames: [],
      medium: undefined,
      mediaFilter: undefined,
      endpointFilters: [],
      maxRows: 5000,
    });

    const response = await POST(makePostRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('chemicalNames_required');
  });

  it('returns 503 when not configured (belt-and-suspenders POST path)', async () => {
    mockBuildEcotoxFetchRequest.mockReturnValue({
      chemicalNames: ['Copper'],
      medium: undefined,
      mediaFilter: undefined,
      endpointFilters: [],
      maxRows: 5000,
    });
    mockGetEcotoxConfigStatus.mockReturnValue(notConfiguredStatus());
    mockGetEcotoxClientConfig.mockReturnValue(null);

    const response = await POST(makePostRequest({ chemicalNames: ['Copper'] }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.rows).toEqual([]);
    expect(body.truncated).toBe(false);
    expect(mockFetchEcotoxRows).not.toHaveBeenCalled();
  });

  it('returns 200 with rows on successful fetch with chemical filter', async () => {
    const stubRows = [
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Oncorhynchus mykiss',
        conc1_mean: 0.012,
        species_group: 'Fish',
        media_type: 'FW',
        endpoint: 'LC50',
        test_id: 1234,
        reference_number: 'REF-001',
      },
    ];
    mockBuildEcotoxFetchRequest.mockReturnValue({
      chemicalNames: ['Copper'],
      medium: 'freshwater',
      mediaFilter: 'water',
      endpointFilters: ['LC50'],
      maxRows: 100,
    });
    mockFetchEcotoxRows.mockResolvedValue({ rows: stubRows, truncated: false });

    const response = await POST(
      makePostRequest({ chemicalNames: ['Copper'], medium: 'freshwater', maxRows: 100 }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].chemical_name).toBe('Copper');
    expect(body.truncated).toBe(false);
    expect(mockBuildEcotoxFetchRequest).toHaveBeenCalledWith(
      expect.objectContaining({ chemicalNames: ['Copper'] }),
    );
    expect(mockFetchEcotoxRows).toHaveBeenCalledWith(STUB_CLIENT, expect.objectContaining({
      chemicalNames: ['Copper'],
    }));
  });

  it('returns 200 with truncated: true when maxRows cap is hit', async () => {
    mockBuildEcotoxFetchRequest.mockReturnValue({
      chemicalNames: ['Zinc'],
      medium: undefined,
      mediaFilter: undefined,
      endpointFilters: [],
      maxRows: 2,
    });
    const stubRows = [
      { chemical_name: 'Zinc', test_id: 1, reference_number: 'R1' },
      { chemical_name: 'Zinc', test_id: 2, reference_number: 'R2' },
    ];
    mockFetchEcotoxRows.mockResolvedValue({ rows: stubRows, truncated: true });

    const response = await POST(makePostRequest({ chemicalNames: ['Zinc'], maxRows: 2 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows).toHaveLength(2);
    expect(body.truncated).toBe(true);
  });

  it('returns 500 when fetchEcotoxRows throws', async () => {
    mockBuildEcotoxFetchRequest.mockReturnValue({
      chemicalNames: ['Lead'],
      medium: undefined,
      mediaFilter: undefined,
      endpointFilters: [],
      maxRows: 5000,
    });
    mockFetchEcotoxRows.mockRejectedValue(new Error('DB error'));

    const response = await POST(makePostRequest({ chemicalNames: ['Lead'] }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('ecotox_record_fetch_failed');
    expect(body.rows).toEqual([]);
    expect(body.truncated).toBe(false);
  });
});
