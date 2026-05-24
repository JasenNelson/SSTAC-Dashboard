import { describe, expect, it } from 'vitest';
import {
  ECOTOX_MAX_FETCH_ROWS,
  ECOTOX_PAGE_SIZE,
  ECOTOX_REQUIRED_COLUMNS,
  ECOTOX_SEARCH_LIMIT,
  ECOTOX_TABLE_NAME,
  buildEcotoxFetchRequest,
  fetchEcotoxRows,
  normalizeChemicalNames,
  normalizeSearchTerm,
  searchEcotoxChemicals,
} from '../supabase';
import type { RawEcotoxRecord } from '../types';

interface QueryCall {
  table: string;
  select?: string;
  ilike?: { column: string; pattern: string };
  limit?: number;
  in?: { column: string; values: string[] };
  range?: { start: number; end: number };
  eq?: { column: string; value: string };
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
        endpointFilters: ['Mortality', 'Mortality'],
        maxRows: 999999,
      }),
    ).toEqual({
      chemicalNames: ['Copper', 'Zinc'],
      medium: 'freshwater',
      endpointFilters: ['Mortality'],
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
});
