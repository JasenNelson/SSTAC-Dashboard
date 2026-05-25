import { describe, expect, it } from 'vitest';
import {
  ECOTOX_MAX_FETCH_ROWS,
  ECOTOX_PAGE_SIZE,
  ECOTOX_REQUIRED_COLUMNS,
  ECOTOX_SEARCH_LIMIT,
  ECOTOX_TABLE_NAME,
  buildEcotoxFetchRequest,
  checkEcotoxMirrorHealth,
  fetchEcotoxRows,
  getEcotoxClientConfig,
  getEcotoxConfigErrorPayload,
  getEcotoxConfigStatus,
  normalizeChemicalNames,
  normalizeSearchTerm,
  searchEcotoxChemicals,
} from '../supabase';
import type { RawEcotoxRecord } from '../types';

interface QueryCall {
  table: string;
  select?: string;
  selectOptions?: { count?: string; head?: boolean };
  ilike?: { column: string; pattern: string };
  limit?: number;
  in?: { column: string; values: string[] };
  range?: { start: number; end: number };
  eq?: { column: string; value: string };
  or?: string[];
}

function createSearchClient() {
  const calls: QueryCall[] = [];
  const responses = [
    {
      data: [{ chemical_name: 'Copper' }, { chemical_name: 'Copper sulfate' }],
      error: null,
    },
    {
      data: [{ chemical_name: 'Copper' }, { chemical_name: 'Zinc copperate' }],
      error: null,
    },
  ];

  return {
    calls,
    client: {
      from(table: string) {
        const call: QueryCall = { table };
        calls.push(call);
        return {
          select(columns: string) {
            call.select = columns;
            return this;
          },
          ilike(column: string, pattern: string) {
            call.ilike = { column, pattern };
            return this;
          },
          limit(limit: number) {
            call.limit = limit;
            return Promise.resolve(responses.shift());
          },
        };
      },
    },
  };
}

function createHealthClient(count: number | null, error: unknown = null) {
  const calls: QueryCall[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        const call: QueryCall = { table };
        calls.push(call);
        return {
          select(
            columns: string,
            options?: { count?: string; head?: boolean },
          ) {
            call.select = columns;
            call.selectOptions = options;
            return Promise.resolve({ data: null, count, error });
          },
        };
      },
    },
  };
}

function createFetchClient(pages: RawEcotoxRecord[][]) {
  const calls: QueryCall[] = [];
  const responses = [...pages];

  return {
    calls,
    client: {
      from(table: string) {
        const call: QueryCall = { table };
        calls.push(call);
        const query = {
          select(columns: string) {
            call.select = columns;
            return this;
          },
          in(column: string, values: string[]) {
            call.in = { column, values };
            return this;
          },
          range(start: number, end: number) {
            call.range = { start, end };
            return this;
          },
          eq(column: string, value: string) {
            call.eq = { column, value };
            return this;
          },
          or(expression: string) {
            call.or = [...(call.or ?? []), expression];
            return this;
          },
          then(
            resolve: (value: { data: RawEcotoxRecord[]; error: null }) => unknown,
            reject?: (reason: unknown) => unknown,
          ) {
            return Promise.resolve({
              data: responses.shift() ?? [],
              error: null,
            }).then(resolve, reject);
          },
        };
        return query;
      },
    },
  };
}

describe('SSD ECOTOX Supabase query shaping', () => {
  it('reports safe config status without exposing env values', () => {
    const missingStatus = getEcotoxConfigStatus({});
    expect(missingStatus).toEqual({
      configured: false,
      error: 'ecotox_supabase_not_configured',
      missing: ['ECOTOX_SUPABASE_URL', 'ECOTOX_SUPABASE_ANON_KEY'],
      invalid: [],
    });
    expect(getEcotoxConfigErrorPayload(missingStatus)).toEqual({
      error: 'ecotox_supabase_not_configured',
      configured: false,
      missing: ['ECOTOX_SUPABASE_URL', 'ECOTOX_SUPABASE_ANON_KEY'],
      invalid: [],
    });

    const invalidStatus = getEcotoxConfigStatus({
      ECOTOX_SUPABASE_URL: 'not-a-url',
      ECOTOX_SUPABASE_ANON_KEY: 'private-anon-key',
    });
    const payload = getEcotoxConfigErrorPayload(invalidStatus);
    expect(payload).toEqual({
      error: 'ecotox_supabase_invalid_config',
      configured: false,
      missing: [],
      invalid: ['ECOTOX_SUPABASE_URL'],
    });
    expect(JSON.stringify(payload)).not.toContain('private-anon-key');

    expect(
      getEcotoxConfigStatus({
        ECOTOX_SUPABASE_URL: 'http://project.supabase.co',
        ECOTOX_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      configured: false,
      error: 'ecotox_supabase_invalid_config',
      missing: [],
      invalid: ['ECOTOX_SUPABASE_URL'],
    });

    expect(
      getEcotoxClientConfig({
        ECOTOX_SUPABASE_URL: 'https://project.supabase.co/',
        ECOTOX_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      url: 'https://project.supabase.co',
      anonKey: 'anon-key',
    });

    expect(
      getEcotoxClientConfig({
        ECOTOX_SUPABASE_URL: 'http://localhost:54321',
        ECOTOX_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      url: 'http://localhost:54321',
      anonKey: 'anon-key',
    });
  });

  it('checks mirror health with a head count query only', async () => {
    const { client, calls } = createHealthClient(582125);

    const health = await checkEcotoxMirrorHealth(client as never);

    expect(health).toEqual({
      configured: true,
      status: 'ok',
      table: ECOTOX_TABLE_NAME,
      requiredColumns: [...ECOTOX_REQUIRED_COLUMNS],
      rowCount: 582125,
      rowCountAvailable: true,
      readable: true,
      limits: {
        search: ECOTOX_SEARCH_LIMIT,
        pageSize: ECOTOX_PAGE_SIZE,
        maxFetchRows: ECOTOX_MAX_FETCH_ROWS,
      },
    });
    expect(calls).toEqual([
      {
        table: ECOTOX_TABLE_NAME,
        select: ECOTOX_REQUIRED_COLUMNS.join(','),
        selectOptions: { count: 'exact', head: true },
      },
    ]);
  });

  it('surfaces mirror health read errors to the API layer', async () => {
    const { client } = createHealthClient(null, {
      message: 'permission denied',
    });

    await expect(checkEcotoxMirrorHealth(client as never)).rejects.toEqual({
      message: 'permission denied',
    });
  });

  it('normalizes user-controlled search and fetch request inputs', () => {
    expect(normalizeSearchTerm('  Copper_%  ')).toBe('Copper');
    expect(normalizeChemicalNames(['Copper', ' Copper ', '', 123, 'Zinc'])).toEqual([
      'Copper',
      'Zinc',
    ]);
    expect(
      buildEcotoxFetchRequest({
        chemicalNames: ['Copper', 'Copper', 'Zinc'],
        medium: 'freshwater',
        mediaFilter: 'water',
        endpointFilters: ['Mortality', 'Mortality', 'Growth_Response%'],
        maxRows: 999999,
      }),
    ).toEqual({
      chemicalNames: ['Copper', 'Zinc'],
      medium: 'freshwater',
      mediaFilter: 'water',
      endpointFilters: ['Mortality', 'Growth Response'],
      maxRows: ECOTOX_MAX_FETCH_ROWS,
    });
  });

  it('searches prefix and substring matches without exposing wildcard input', async () => {
    const { client, calls } = createSearchClient();

    const names = await searchEcotoxChemicals(client as never, ' Copper_ ');

    expect(names).toEqual(['Copper', 'Copper sulfate', 'Zinc copperate']);
    expect(calls).toEqual([
      {
        table: ECOTOX_TABLE_NAME,
        select: 'chemical_name',
        ilike: { column: 'chemical_name', pattern: 'Copper%' },
        limit: ECOTOX_SEARCH_LIMIT,
      },
      {
        table: ECOTOX_TABLE_NAME,
        select: 'chemical_name',
        ilike: { column: 'chemical_name', pattern: '%Copper%' },
        limit: ECOTOX_SEARCH_LIMIT,
      },
    ]);
  });

  it('fetches ECOTOX rows by selected chemical, medium, and capped pages', async () => {
    const firstPage = Array.from({ length: ECOTOX_PAGE_SIZE }, (_, index) => ({
      chemical_name: 'Copper',
      species_scientific_name: `Species ${index}`,
      conc1_mean: 0.01,
      species_group: 'Fish',
      media_type: 'FW',
      endpoint: 'Mortality',
    }));
    const secondPage = [
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Last species',
        conc1_mean: 0.02,
        species_group: 'Fish',
        media_type: 'FW',
        endpoint: 'Mortality',
      },
    ];
    const { client, calls } = createFetchClient([firstPage, secondPage]);

    const result = await fetchEcotoxRows(client as never, {
      chemicalNames: ['Copper'],
      medium: 'freshwater',
      maxRows: ECOTOX_PAGE_SIZE + 5,
    });

    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(ECOTOX_PAGE_SIZE + 1);
    expect(calls[0]).toMatchObject({
      table: ECOTOX_TABLE_NAME,
      select: ECOTOX_REQUIRED_COLUMNS.join(','),
      in: { column: 'chemical_name', values: ['Copper'] },
      range: { start: 0, end: ECOTOX_PAGE_SIZE - 1 },
      eq: { column: 'media_type', value: 'FW' },
    });
    expect(calls[1].range).toEqual({
      start: ECOTOX_PAGE_SIZE,
      end: ECOTOX_PAGE_SIZE + 4,
    });
  });

  it('enforces max rows and reports truncation when a capped page is full', async () => {
    const { client, calls } = createFetchClient([
      [
        {
          chemical_name: 'Copper',
          species_scientific_name: 'Species 1',
          conc1_mean: 0.01,
          species_group: 'Fish',
          media_type: 'FW',
          endpoint: 'Mortality',
        },
      ],
    ]);

    const result = await fetchEcotoxRows(client as never, {
      chemicalNames: ['Copper'],
      maxRows: 1,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].range).toEqual({ start: 0, end: 0 });
  });

  it('applies media and endpoint filters server-side for mirror fetches', async () => {
    const { client, calls } = createFetchClient([
      [
        {
          chemical_name: 'Copper',
          species_scientific_name: 'Sediment species',
          conc1_mean: 0.01,
          species_group: 'Invertebrate',
          media_type: 'sediment',
          endpoint: 'Mortality',
        },
      ],
    ]);

    await fetchEcotoxRows(client as never, {
      chemicalNames: ['Copper'],
      mediaFilter: 'sediment',
      endpointFilters: ['Mortality', 'Growth_Response%'],
      maxRows: 25,
    });

    expect(calls[0]).toMatchObject({
      table: ECOTOX_TABLE_NAME,
      select: ECOTOX_REQUIRED_COLUMNS.join(','),
      in: { column: 'chemical_name', values: ['Copper'] },
      range: { start: 0, end: 24 },
    });
    expect(calls[0].or).toEqual([
      'media_type.eq.SD,media_type.ilike.%sed%,media_type.ilike.%solid%',
      'endpoint.ilike.%Mortality%,endpoint.ilike.%Growth Response%',
    ]);
  });
});
