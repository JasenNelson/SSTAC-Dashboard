import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  EcotoxFetchRequest,
  RawEcotoxRecord,
  SsdMediaFilter,
  SsdMedium,
} from './types';
import { mediumToCode } from './cleaning';

export const ECOTOX_TABLE_NAME = 'toxicology_data';
export const ECOTOX_REQUIRED_COLUMNS = [
  'chemical_name',
  'species_scientific_name',
  'conc1_mean',
  'species_group',
  'media_type',
  'endpoint',
  'reference_number',
  'test_id',
] as const;

export const ECOTOX_SEARCH_LIMIT = 50;
export const ECOTOX_PAGE_SIZE = 1000;
export const ECOTOX_MAX_FETCH_ROWS = 5000;

export interface EcotoxClientConfig {
  url: string;
  anonKey: string;
}

export function getEcotoxClientConfig(): EcotoxClientConfig | null {
  const url = process.env.ECOTOX_SUPABASE_URL;
  const anonKey = process.env.ECOTOX_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function createEcotoxClient(
  config: EcotoxClientConfig,
): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function normalizeSearchTerm(term: string): string {
  return term
    .trim()
    .replace(/[%_]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

export function normalizeChemicalNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );
}

export function normalizeEndpointFilters(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );
}

export function coerceMedium(value: unknown): SsdMedium | undefined {
  return value === 'freshwater' || value === 'marine' ? value : undefined;
}

export function coerceMediaFilter(value: unknown): SsdMediaFilter | undefined {
  return value === 'water' || value === 'sediment' ? value : undefined;
}

export function coerceMaxRows(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ECOTOX_MAX_FETCH_ROWS;
  }
  return Math.max(1, Math.min(ECOTOX_MAX_FETCH_ROWS, Math.floor(value)));
}

export function buildEcotoxFetchRequest(value: unknown): EcotoxFetchRequest {
  const body = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
  return {
    chemicalNames: normalizeChemicalNames(body.chemicalNames),
    medium: coerceMedium(body.medium),
    mediaFilter: coerceMediaFilter(body.mediaFilter),
    endpointFilters: normalizeEndpointFilters(body.endpointFilters),
    maxRows: coerceMaxRows(body.maxRows),
  };
}

export async function searchEcotoxChemicals(
  client: SupabaseClient,
  rawTerm: string,
): Promise<string[]> {
  const term = normalizeSearchTerm(rawTerm);
  if (term.length < 2) return [];

  const column = 'chemical_name';
  const selectColumns = `${column}`;
  const prefix = await client
    .from(ECOTOX_TABLE_NAME)
    .select(selectColumns)
    .ilike(column, `${term}%`)
    .limit(ECOTOX_SEARCH_LIMIT);
  if (prefix.error) throw prefix.error;

  const substring = await client
    .from(ECOTOX_TABLE_NAME)
    .select(selectColumns)
    .ilike(column, `%${term}%`)
    .limit(ECOTOX_SEARCH_LIMIT);
  if (substring.error) throw substring.error;

  const names = [
    ...(prefix.data ?? []),
    ...(substring.data ?? []),
  ]
    .map((row) => (row as { chemical_name?: unknown }).chemical_name)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .map((name) => name.trim());

  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

export async function fetchEcotoxRows(
  client: SupabaseClient,
  request: EcotoxFetchRequest,
): Promise<{ rows: RawEcotoxRecord[]; truncated: boolean }> {
  const chemicalNames = normalizeChemicalNames(request.chemicalNames);
  if (chemicalNames.length === 0) return { rows: [], truncated: false };

  const maxRows = coerceMaxRows(request.maxRows);
  const rows: RawEcotoxRecord[] = [];
  let page = 0;
  let truncated = false;

  while (rows.length < maxRows) {
    const start = page * ECOTOX_PAGE_SIZE;
    const remaining = maxRows - rows.length;
    const pageSize = Math.min(ECOTOX_PAGE_SIZE, remaining);
    const end = start + pageSize - 1;
    let query = client
      .from(ECOTOX_TABLE_NAME)
      .select(ECOTOX_REQUIRED_COLUMNS.join(','))
      .in('chemical_name', chemicalNames)
      .range(start, end);

    if (request.medium) {
      query = query.eq('media_type', mediumToCode(request.medium));
    }

    const response = await query;
    if (response.error) throw response.error;
    const pageRows = (response.data ?? []) as unknown as RawEcotoxRecord[];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) break;
    if (rows.length >= maxRows) truncated = true;
    page += 1;
  }

  return { rows, truncated };
}
