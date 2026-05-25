import type { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { GET as searchChemicals } from '../chemicals/route';
import { GET as checkRecordsHealth, POST as fetchRecords } from '../records/route';
import {
  ECOTOX_REQUIRED_COLUMNS,
  ECOTOX_TABLE_NAME,
} from '@/lib/matrix-options/ssd/supabase';

const savedUrl = process.env.ECOTOX_SUPABASE_URL;
const savedAnonKey = process.env.ECOTOX_SUPABASE_ANON_KEY;

function restoreEnv() {
  if (savedUrl === undefined) {
    delete process.env.ECOTOX_SUPABASE_URL;
  } else {
    process.env.ECOTOX_SUPABASE_URL = savedUrl;
  }
  if (savedAnonKey === undefined) {
    delete process.env.ECOTOX_SUPABASE_ANON_KEY;
  } else {
    process.env.ECOTOX_SUPABASE_ANON_KEY = savedAnonKey;
  }
}

function makeGetRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

function makePostRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

describe('Matrix Options ECOTOX API safety', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('returns safe health metadata when ECOTOX anon config is missing', async () => {
    delete process.env.ECOTOX_SUPABASE_URL;
    delete process.env.ECOTOX_SUPABASE_ANON_KEY;

    const response = await checkRecordsHealth();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: 'ecotox_supabase_not_configured',
      configured: false,
      missing: ['ECOTOX_SUPABASE_URL', 'ECOTOX_SUPABASE_ANON_KEY'],
      invalid: [],
      table: ECOTOX_TABLE_NAME,
      requiredColumns: [...ECOTOX_REQUIRED_COLUMNS],
      rowCount: null,
      rowCountAvailable: false,
      readable: false,
    });
  });

  it('does not echo invalid ECOTOX credential values from API errors', async () => {
    process.env.ECOTOX_SUPABASE_URL = 'not-a-url';
    process.env.ECOTOX_SUPABASE_ANON_KEY = 'private-anon-key';

    const response = await searchChemicals(
      makeGetRequest('http://localhost/api/matrix-options/ssd/chemicals?q=copper'),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: 'ecotox_supabase_invalid_config',
      configured: false,
      missing: [],
      invalid: ['ECOTOX_SUPABASE_URL'],
      chemicals: [],
    });
    expect(JSON.stringify(body)).not.toContain('private-anon-key');
  });

  it('returns safe fetch errors before attempting mirror reads when config is invalid', async () => {
    process.env.ECOTOX_SUPABASE_URL = 'not-a-url';
    process.env.ECOTOX_SUPABASE_ANON_KEY = 'private-anon-key';

    const response = await fetchRecords(
      makePostRequest({ chemicalNames: ['Copper'], maxRows: 25 }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: 'ecotox_supabase_invalid_config',
      configured: false,
      missing: [],
      invalid: ['ECOTOX_SUPABASE_URL'],
      rows: [],
      truncated: false,
    });
    expect(JSON.stringify(body)).not.toContain('private-anon-key');
  });
});
