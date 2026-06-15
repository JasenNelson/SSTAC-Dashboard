import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  EcotoxFetchRequest,
  RawEcotoxRecord,
  SsdMediaFilter,
  SsdMedium,
} from './types';
import { mediumToCode } from './cleaning';

export const ECOTOX_TABLE_NAME = 'toxicology_data';
export const ECOTOX_OPERATIONAL_COLUMNS = [
  'chemical_name',
  'species_scientific_name',
  'conc1_mean',
  'species_group',
  'media_type',
  'endpoint',
  'test_id',
] as const;
export const ECOTOX_REFERENCE_NUMBER_COLUMN = 'reference_number';
export const ECOTOX_REFERENCE_FALLBACK_COLUMNS = [
  'reference_db',
  'original_source',
  'source',
  'source_url',
  'doi',
  'title',
] as const;
// buildEcotoxSelectColumns assembles the column list for a page query.
// Each optional column is controlled independently so that a missing-column
// error for one column does not strip the other.
//
// useReferenceFallback=false -> include ECOTOX_REFERENCE_NUMBER_COLUMN
// useReferenceFallback=true  -> include ECOTOX_REFERENCE_FALLBACK_COLUMNS instead
// dropUnit=false             -> include 'unit'
// dropUnit=true              -> omit 'unit'
export function buildEcotoxSelectColumns(opts: {
  useReferenceFallback: boolean;
  dropUnit: boolean;
}): string[] {
  return [
    ...ECOTOX_OPERATIONAL_COLUMNS,
    ...(opts.useReferenceFallback
      ? ECOTOX_REFERENCE_FALLBACK_COLUMNS
      : [ECOTOX_REFERENCE_NUMBER_COLUMN]),
    ...(opts.dropUnit ? [] : ['unit']),
  ];
}

// ECOTOX_PREFERRED_SELECT_COLUMNS and ECOTOX_FALLBACK_SELECT_COLUMNS are kept
// exported for consumers and tests that reference them directly.
// PREFERRED = both optional columns present; FALLBACK = both dropped/substituted.
export const ECOTOX_PREFERRED_SELECT_COLUMNS = buildEcotoxSelectColumns({
  useReferenceFallback: false,
  dropUnit: false,
}) as unknown as readonly string[];
export const ECOTOX_FALLBACK_SELECT_COLUMNS = buildEcotoxSelectColumns({
  useReferenceFallback: true,
  dropUnit: true,
}) as unknown as readonly string[];
export const ECOTOX_REQUIRED_COLUMNS = [
  ...ECOTOX_OPERATIONAL_COLUMNS,
  'reference_number_or_reference_metadata',
] as const;

export const ECOTOX_SEARCH_LIMIT = 50;
export const ECOTOX_PAGE_SIZE = 1000;
export const ECOTOX_MAX_FETCH_ROWS = 5000;
export const ECOTOX_SUPABASE_URL_ENV = 'ECOTOX_SUPABASE_URL';
export const ECOTOX_SUPABASE_ANON_KEY_ENV = 'ECOTOX_SUPABASE_ANON_KEY';

type EcotoxEnv = Record<string, string | undefined>;
type EcotoxConfigError =
  | 'ecotox_supabase_not_configured'
  | 'ecotox_supabase_invalid_config';

export interface EcotoxClientConfig {
  url: string;
  anonKey: string;
}

export interface EcotoxConfigStatus {
  configured: boolean;
  error: EcotoxConfigError | null;
  missing: string[];
  invalid: string[];
}

export interface EcotoxConfigErrorPayload {
  error: EcotoxConfigError;
  configured: false;
  missing: string[];
  invalid: string[];
}

export interface EcotoxMirrorHealth {
  configured: true;
  status: 'ok';
  table: string;
  requiredColumns: string[];
  rowCount: number | null;
  rowCountAvailable: boolean;
  readable: true;
  limits: {
    search: number;
    pageSize: number;
    maxFetchRows: number;
  };
}

function normalizeSupabaseUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') {
      const isLocalHttp =
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
      if (!isLocalHttp) return null;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getEcotoxConfigStatus(
  env: EcotoxEnv = process.env,
): EcotoxConfigStatus {
  const rawUrl = env[ECOTOX_SUPABASE_URL_ENV]?.trim() ?? '';
  const anonKey = env[ECOTOX_SUPABASE_ANON_KEY_ENV]?.trim() ?? '';
  const missing = [
    rawUrl ? null : ECOTOX_SUPABASE_URL_ENV,
    anonKey ? null : ECOTOX_SUPABASE_ANON_KEY_ENV,
  ].filter((value): value is string => value !== null);

  if (missing.length > 0) {
    return {
      configured: false,
      error: 'ecotox_supabase_not_configured',
      missing,
      invalid: [],
    };
  }

  const invalid = normalizeSupabaseUrl(rawUrl)
    ? []
    : [ECOTOX_SUPABASE_URL_ENV];
  if (invalid.length > 0) {
    return {
      configured: false,
      error: 'ecotox_supabase_invalid_config',
      missing: [],
      invalid,
    };
  }

  return { configured: true, error: null, missing: [], invalid: [] };
}

export function getEcotoxConfigErrorPayload(
  status: EcotoxConfigStatus,
): EcotoxConfigErrorPayload {
  return {
    error: status.error ?? 'ecotox_supabase_invalid_config',
    configured: false,
    missing: status.missing,
    invalid: status.invalid,
  };
}

export function getEcotoxClientConfig(
  env: EcotoxEnv = process.env,
): EcotoxClientConfig | null {
  const status = getEcotoxConfigStatus(env);
  if (!status.configured) return null;
  const url = normalizeSupabaseUrl(env[ECOTOX_SUPABASE_URL_ENV] ?? '');
  const anonKey = env[ECOTOX_SUPABASE_ANON_KEY_ENV]?.trim();
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
        .map((value) =>
          value
            .trim()
            .replace(/_/g, ' ')
            .replace(/[^a-zA-Z0-9+\-/ ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 60),
        )
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

export function buildEcotoxMirrorHealth(
  rowCount: number | null,
): EcotoxMirrorHealth {
  return {
    configured: true,
    status: 'ok',
    table: ECOTOX_TABLE_NAME,
    requiredColumns: [...ECOTOX_REQUIRED_COLUMNS],
    rowCount,
    rowCountAvailable: typeof rowCount === 'number',
    readable: true,
    limits: {
      search: ECOTOX_SEARCH_LIMIT,
      pageSize: ECOTOX_PAGE_SIZE,
      maxFetchRows: ECOTOX_MAX_FETCH_ROWS,
    },
  };
}

export async function checkEcotoxMirrorHealth(
  client: SupabaseClient,
): Promise<EcotoxMirrorHealth> {
  const preferredResponse = await client
    .from(ECOTOX_TABLE_NAME)
    .select(ECOTOX_PREFERRED_SELECT_COLUMNS.join(','), {
      count: 'exact',
      head: true,
    });
  if (!preferredResponse.error) {
    return buildEcotoxMirrorHealth(preferredResponse.count ?? null);
  }
  if (
    !shouldTryReferenceFallback(
      preferredResponse.error,
      preferredResponse.status,
    )
  ) {
    throw preferredResponse.error;
  }

  const fallbackResponse = await client
    .from(ECOTOX_TABLE_NAME)
    .select(ECOTOX_FALLBACK_SELECT_COLUMNS.join(','), {
      count: 'exact',
      head: true,
    });
  if (fallbackResponse.error) throw fallbackResponse.error;
  return buildEcotoxMirrorHealth(fallbackResponse.count ?? null);
}

function mediaTypeFilterExpression(
  mediaFilter: SsdMediaFilter | undefined,
): string | null {
  if (mediaFilter === 'water') {
    return 'media_type.eq.FW,media_type.eq.MW,media_type.ilike.%water%';
  }
  if (mediaFilter === 'sediment') {
    return 'media_type.eq.SD,media_type.ilike.%sed%,media_type.ilike.%solid%';
  }
  return null;
}

function endpointFilterExpression(endpointFilters: string[]): string | null {
  const filters = normalizeEndpointFilters(endpointFilters);
  if (filters.length === 0) return null;
  return filters.map((filter) => `endpoint.ilike.%${filter}%`).join(',');
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

// identifyMissingColumn returns 'unit', 'reference_number', or null depending
// on which optional preferred column the error message names. Uses word-boundary
// matching to avoid false matches on column names that contain these words as
// substrings.
function identifyMissingColumn(error: unknown): 'unit' | 'reference_number' | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message =
    typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  const isMissingColumn =
    code === '42703' || message.includes('does not exist');
  if (!isMissingColumn) return null;
  if (/\bunit\b/.test(message)) return 'unit';
  if (/\breference_number\b/.test(message)) return 'reference_number';
  return null;
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
  // Both flags start false. Each flips at most once (bounded degradation).
  // Once set they persist across all subsequent pages.
  let useReferenceFallback = false;
  let dropUnit = false;

  while (rows.length < maxRows) {
    const start = page * ECOTOX_PAGE_SIZE;
    const remaining = maxRows - rows.length;
    const pageSize = Math.min(ECOTOX_PAGE_SIZE, remaining);
    const end = start + pageSize - 1;

    // Build the column list from current flag state.
    const columns = buildEcotoxSelectColumns({ useReferenceFallback, dropUnit });
    let response = await executeEcotoxPageQuery(
      client,
      request,
      chemicalNames,
      start,
      end,
      columns,
    );

    // Inner retry loop: flip at most one new flag per iteration.
    // Bounded: each flag flips at most once (useReferenceFallback, dropUnit),
    // so at most 2 retries per page. Flags persist across pages once set.
    while (response.error) {
      // Check for the blank-head-400 case (triggers reference fallback).
      if (
        response.status === 400 &&
        isBlankSupabaseHeadError(response.error) &&
        !useReferenceFallback
      ) {
        useReferenceFallback = true;
        response = await executeEcotoxPageQuery(
          client,
          request,
          chemicalNames,
          start,
          end,
          buildEcotoxSelectColumns({ useReferenceFallback, dropUnit }),
        );
        continue;
      }

      // Check for a named missing-optional-column error.
      const missing = identifyMissingColumn(response.error);
      if (missing === 'unit' && !dropUnit) {
        dropUnit = true;
        response = await executeEcotoxPageQuery(
          client,
          request,
          chemicalNames,
          start,
          end,
          buildEcotoxSelectColumns({ useReferenceFallback, dropUnit }),
        );
        continue;
      }
      if (missing === 'reference_number' && !useReferenceFallback) {
        useReferenceFallback = true;
        response = await executeEcotoxPageQuery(
          client,
          request,
          chemicalNames,
          start,
          end,
          buildEcotoxSelectColumns({ useReferenceFallback, dropUnit }),
        );
        continue;
      }

      // Already degraded on this column, or an unrelated error: propagate.
      throw response.error;
    }

    const pageRows = deriveReferenceNumbers(
      (response.data ?? []) as unknown as RawEcotoxRecord[],
    );
    rows.push(...pageRows);

    if (pageRows.length < pageSize) break;
    if (rows.length >= maxRows) truncated = true;
    page += 1;
  }

  return { rows, truncated };
}

function shouldTryReferenceFallback(
  error: unknown,
  status?: number,
): boolean {
  if (status === 400 && isBlankSupabaseHeadError(error)) {
    return true;
  }
  return isMissingOptionalPreferredColumnError(error);
}

function isBlankSupabaseHeadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: unknown };
  return candidate.message === '';
}

// Columns that, when absent from the mirror, trigger a graceful fallback to
// ECOTOX_FALLBACK_SELECT_COLUMNS rather than a hard error. 'unit' is included
// so that mirrors that predate the unit column still work; the mixed-unit guard
// in hcp.ts becomes inactive (units.length===0 path) rather than hard-breaking.
const ECOTOX_OPTIONAL_PREFERRED_COLUMNS: readonly string[] = [
  ECOTOX_REFERENCE_NUMBER_COLUMN,
  'unit',
];

function isMissingOptionalPreferredColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message =
    typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  const isMissingColumn =
    code === '42703' || message.includes('does not exist');
  return (
    isMissingColumn &&
    ECOTOX_OPTIONAL_PREFERRED_COLUMNS.some((col) =>
      new RegExp(`\\b${col}\\b`).test(message),
    )
  );
}

function firstReferenceValue(row: RawEcotoxRecord): string | number | null {
  return (
    row.reference_number ??
    row.reference_db ??
    row.original_source ??
    row.doi ??
    row.source ??
    row.source_url ??
    row.title ??
    null
  );
}

function deriveReferenceNumbers(rows: RawEcotoxRecord[]): RawEcotoxRecord[] {
  return rows.map((row) => ({
    ...row,
    reference_number: firstReferenceValue(row),
  }));
}

function executeEcotoxPageQuery(
  client: SupabaseClient,
  request: EcotoxFetchRequest,
  chemicalNames: string[],
  start: number,
  end: number,
  columns: readonly string[],
) {
  let query = client
    .from(ECOTOX_TABLE_NAME)
    .select(columns.join(','))
    .in('chemical_name', chemicalNames)
    .range(start, end);

  const mediaExpression = mediaTypeFilterExpression(request.mediaFilter);
  if (request.mediaFilter === 'water' && request.medium) {
    query = query.eq('media_type', mediumToCode(request.medium));
  } else if (mediaExpression) {
    query = query.or(mediaExpression);
  } else if (request.medium) {
    query = query.eq('media_type', mediumToCode(request.medium));
  }

  const endpointExpression = endpointFilterExpression(
    request.endpointFilters ?? [],
  );
  if (endpointExpression) {
    query = query.or(endpointExpression);
  }

  return query;
}
