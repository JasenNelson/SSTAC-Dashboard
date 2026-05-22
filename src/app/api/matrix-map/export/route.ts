import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { checkCsrf } from '@/lib/engine-v2/csrf';

export const runtime = 'nodejs';

const ADMIN_ROLES = ['admin', 'matrix_admin'];
const EXPORT_TYPES = ['selection', 'measurements'] as const;
const MEDIUMS = ['all', 'sediment', 'water', 'tissue', 'toxicity', 'community'] as const;
const QA_FLAGS = ['all', 'detected', 'censored'] as const;
const CLASSIFICATIONS = ['all', 'reference', 'impacted', 'unknown'] as const;
const MAX_SELECTED_SAMPLE_IDS = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ExportType = (typeof EXPORT_TYPES)[number];
type MediumFilter = (typeof MEDIUMS)[number];
type QaFilter = (typeof QA_FLAGS)[number];
type ClassificationFilter = (typeof CLASSIFICATIONS)[number];

interface ExportPayload {
  export_type: ExportType;
  selected_sample_ids: string[];
  filters?: {
    medium?: MediumFilter;
    mediums?: Exclude<MediumFilter, 'all'>[];
    substance_ids?: string[];
    qa?: QaFilter;
    classification?: ClassificationFilter;
    date_from?: string;
    date_to?: string;
  };
  selection_token?: string | null;
}

interface MeasurementRow {
  sample_id: string;
  sample_station_id: string;
  event_date: string;
  medium: string;
  substance_id: string | null;
  substance_key: string | null;
  substance_display_name: string;
  value: string | number | null;
  unit: string | null;
  detection_limit: string | number | null;
  qualifier: string | null;
  censored: boolean | null;
  coordinate_quality_tier: string;
  classification: string;
  source_dra_id: string | null;
  source_dra_title: string | null;
}

interface SampleRow {
  id: string;
  station_id: string;
  display_name: string;
  classification: string;
  coordinate_quality_tier: string;
  source_dra_id: string | null;
  bc_region: string | null;
  waterbody: string | null;
  geometry?: { coordinates?: [number, number] };
}

async function createAuthenticatedClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    },
  );
}

function createServiceRoleClient(): SupabaseClient | NextResponse {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'service_role_not_configured' },
      { status: 500 },
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireMatrixMapAdmin(
  client: SupabaseClient,
): Promise<{ user: User } | NextResponse> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: role, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ADMIN_ROLES)
    .limit(1)
    .maybeSingle();

  if (roleError) {
    return NextResponse.json(
      { error: 'admin_role_query_failed', detail: roleError.message },
      { status: 500 },
    );
  }

  if (!role) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return { user };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authClient = await createAuthenticatedClient();
  const auth = await requireMatrixMapAdmin(authClient);
  if (auth instanceof NextResponse) return auth;

  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === 'missing_content_type' ||
      csrf.reason === 'wrong_content_type'
        ? 415
        : 403;
    return NextResponse.json(
      { error: csrf.reason, detail: csrf.detail },
      { status },
    );
  }

  let payload: ExportPayload;
  try {
    payload = parsePayload(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const exportResult =
    payload.export_type === 'selection'
      ? await buildSelectionExport(authClient, payload)
      : await buildMeasurementsExport(authClient, payload);

  if (exportResult instanceof NextResponse) return exportResult;

  const serviceClient = createServiceRoleClient();
  if (serviceClient instanceof NextResponse) return serviceClient;

  const auditResult = await writeExportAudit({
    serviceClient,
    userId: auth.user.id,
    payload,
    rowCount: exportResult.rowCount,
    byteLength: exportResult.byteLength,
  });
  if (auditResult instanceof NextResponse) return auditResult;

  return new NextResponse(exportResult.csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
      'Content-Length': String(exportResult.byteLength),
      'Cache-Control': 'private, no-store',
    },
  });
}

function parsePayload(value: unknown): ExportPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('body must be an object');
  }
  const body = value as Record<string, unknown>;
  if (!isOneOf(body.export_type, EXPORT_TYPES)) {
    throw new Error('export_type must be selection or measurements');
  }
  if (!Array.isArray(body.selected_sample_ids)) {
    throw new Error('selected_sample_ids must be an array');
  }
  const selectedIds = Array.from(new Set(body.selected_sample_ids));
  if (selectedIds.length === 0) {
    throw new Error('at least one selected sample is required');
  }
  if (selectedIds.length > MAX_SELECTED_SAMPLE_IDS) {
    throw new Error(`selected_sample_ids exceeds ${MAX_SELECTED_SAMPLE_IDS}`);
  }
  if (!selectedIds.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
    throw new Error('selected_sample_ids must contain UUID strings');
  }

  const rawFilters =
    body.filters && typeof body.filters === 'object'
      ? (body.filters as Record<string, unknown>)
      : {};
  const filters = {
    medium: isOneOf(rawFilters.medium, MEDIUMS) ? rawFilters.medium : 'all',
    mediums: parseMediumArray(rawFilters.mediums, rawFilters.medium),
    substance_ids: parseUuidArray(rawFilters.substance_ids, 'substance_ids'),
    qa: isOneOf(rawFilters.qa, QA_FLAGS) ? rawFilters.qa : 'all',
    classification: isOneOf(rawFilters.classification, CLASSIFICATIONS)
      ? rawFilters.classification
      : 'all',
    date_from: dateOrEmpty(rawFilters.date_from),
    date_to: dateOrEmpty(rawFilters.date_to),
  };

  return {
    export_type: body.export_type,
    selected_sample_ids: selectedIds,
    filters,
    selection_token:
      typeof body.selection_token === 'string' && body.selection_token.trim()
        ? body.selection_token.trim()
        : null,
  };
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function dateOrEmpty(value: unknown) {
  if (typeof value !== 'string' || value === '') return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('date filters must use YYYY-MM-DD');
  }
  return value;
}

function parseMediumArray(value: unknown, legacyMedium: unknown): Exclude<MediumFilter, 'all'>[] {
  if (Array.isArray(value)) {
    const next = Array.from(new Set(value));
    if (!next.every((item) => isOneOf(item, MEDIUMS) && item !== 'all')) {
      throw new Error('mediums must contain allowed medium values');
    }
    return next as Exclude<MediumFilter, 'all'>[];
  }

  if (isOneOf(legacyMedium, MEDIUMS) && legacyMedium !== 'all') {
    return [legacyMedium];
  }

  return [];
}

function parseUuidArray(value: unknown, fieldName: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  const next = Array.from(new Set(value));
  if (!next.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
    throw new Error(`${fieldName} must contain UUID strings`);
  }
  return next;
}

async function buildSelectionExport(
  authClient: SupabaseClient,
  payload: ExportPayload,
): Promise<{ csv: string; filename: string; rowCount: number; byteLength: number } | NextResponse> {
  const { data, error } = await authClient
    .schema('matrix_map')
    .rpc('fetch_samples_with_hidden_summary', { p_bbox: null });

  if (error) {
    return NextResponse.json(
      { error: 'sample_refetch_failed', detail: error.message },
      { status: 500 },
    );
  }

  const selectedIds = new Set(payload.selected_sample_ids);
  const rows = normalizeSamples(data).filter((sample) => selectedIds.has(sample.id));
  const csv = rowsToCsv([
    [
      'sample_id',
      'station_id',
      'display_name',
      'classification',
      'coordinate_quality_tier',
      'source_dra_id',
      'bc_region',
      'waterbody',
      'longitude',
      'latitude',
    ],
    ...rows.map((sample) => [
      sample.id,
      sample.station_id,
      sample.display_name,
      sample.classification,
      sample.coordinate_quality_tier,
      sample.source_dra_id ?? '',
      sample.bc_region ?? '',
      sample.waterbody ?? '',
      String(sample.geometry?.coordinates?.[0] ?? ''),
      String(sample.geometry?.coordinates?.[1] ?? ''),
    ]),
  ]);
  return {
    csv,
    filename: datedFilename('matrix-map-selection'),
    rowCount: rows.length,
    byteLength: Buffer.byteLength(csv, 'utf8'),
  };
}

async function buildMeasurementsExport(
  authClient: SupabaseClient,
  payload: ExportPayload,
): Promise<{ csv: string; filename: string; rowCount: number; byteLength: number } | NextResponse> {
  const { data, error } = await authClient
    .schema('matrix_map')
    .rpc('fetch_measurements_for_samples', {
      p_sample_ids: payload.selected_sample_ids,
    });

  if (error) {
    return NextResponse.json(
      { error: 'measurement_refetch_failed', detail: error.message },
      { status: 500 },
    );
  }

  const filters = payload.filters ?? {};
  const mediumSet = new Set(filters.mediums ?? []);
  const substanceIdSet = new Set(filters.substance_ids ?? []);
  const rows = normalizeMeasurements(data).filter((row) => {
    if (substanceIdSet.size > 0 && (!row.substance_id || !substanceIdSet.has(row.substance_id))) return false;
    if (mediumSet.size > 0 && !mediumSet.has(row.medium as Exclude<MediumFilter, 'all'>)) return false;
    if (filters.medium && filters.medium !== 'all' && row.medium !== filters.medium) return false;
    if (filters.qa === 'detected' && row.censored) return false;
    if (filters.qa === 'censored' && !row.censored) return false;
    if (
      filters.classification &&
      filters.classification !== 'all' &&
      row.classification !== filters.classification
    ) return false;
    if (filters.date_from && row.event_date < filters.date_from) return false;
    if (filters.date_to && row.event_date > filters.date_to) return false;
    return true;
  });

  const csv = rowsToCsv([
    [
      'sample_id',
      'sample_station_id',
      'event_date',
      'medium',
      'substance_id',
      'substance_key',
      'substance',
      'value',
      'unit',
      'detection_limit',
      'qualifier',
      'censored',
      'coordinate_quality_tier',
      'classification',
      'source_dra_id',
      'source_dra_title',
    ],
    ...rows.map((row) => [
      row.sample_id,
      row.sample_station_id,
      row.event_date,
      row.medium,
      row.substance_id ?? '',
      row.substance_key ?? '',
      row.substance_display_name,
      formatCell(row.value),
      row.unit ?? '',
      formatCell(row.detection_limit),
      row.qualifier ?? '',
      row.censored === null ? '' : String(row.censored),
      row.coordinate_quality_tier,
      row.classification,
      row.source_dra_id ?? '',
      row.source_dra_title ?? '',
    ]),
  ]);
  return {
    csv,
    filename: datedFilename('matrix-map-measurements'),
    rowCount: rows.length,
    byteLength: Buffer.byteLength(csv, 'utf8'),
  };
}

function normalizeSamples(value: unknown): SampleRow[] {
  const visibleSamples =
    value && typeof value === 'object'
      ? (value as { visible_samples?: unknown }).visible_samples
      : null;
  if (!Array.isArray(visibleSamples)) return [];
  return visibleSamples
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: stringField(item.id),
      station_id: stringField(item.station_id),
      display_name: stringField(item.display_name),
      classification: stringField(item.classification),
      coordinate_quality_tier: stringField(item.coordinate_quality_tier),
      source_dra_id: nullableString(item.source_dra_id),
      bc_region: nullableString(item.bc_region),
      waterbody: nullableString(item.waterbody),
      geometry:
        item.geometry && typeof item.geometry === 'object'
          ? (item.geometry as SampleRow['geometry'])
          : undefined,
    }))
    .filter((sample) => sample.id);
}

function normalizeMeasurements(value: unknown): MeasurementRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      sample_id: stringField(item.sample_id),
      sample_station_id: stringField(item.sample_station_id) || stringField(item.station_id),
      event_date: stringField(item.event_date),
      medium: stringField(item.medium),
      substance_id: nullableString(item.substance_id),
      substance_key: nullableString(item.substance_key),
      substance_display_name:
        stringField(item.substance_display_name) || stringField(item.substance),
      value: scalarField(item.value),
      unit: nullableString(item.unit),
      detection_limit: scalarField(item.detection_limit),
      qualifier: nullableString(item.qualifier),
      censored: typeof item.censored === 'boolean' ? item.censored : null,
      coordinate_quality_tier: stringField(item.coordinate_quality_tier),
      classification: stringField(item.classification),
      source_dra_id: nullableString(item.source_dra_id),
      source_dra_title: nullableString(item.source_dra_title) || nullableString(item.dra_title),
    }))
    .filter((row) => row.sample_id);
}

async function writeExportAudit({
  serviceClient,
  userId,
  payload,
  rowCount,
  byteLength,
}: {
  serviceClient: SupabaseClient;
  userId: string;
  payload: ExportPayload;
  rowCount: number;
  byteLength: number;
}): Promise<true | NextResponse> {
  const filterSummary = {
    export_type: payload.export_type,
    selected_sample_count: payload.selected_sample_ids.length,
    filters: payload.filters ?? {},
  };

  const { error: exportAuditError } = await serviceClient
    .schema('matrix_map')
    .from('export_audit')
    .insert({
      exported_by: userId,
      selection_token: payload.selection_token ?? null,
      row_count: rowCount,
      bytes: byteLength,
      filter_summary: filterSummary,
    });
  if (exportAuditError) {
    return NextResponse.json(
      { error: 'export_audit_failed', detail: exportAuditError.message },
      { status: 500 },
    );
  }

  const { error: serviceAuditError } = await serviceClient
    .schema('matrix_map')
    .from('service_role_audit')
    .insert({
      rpc_name: 'matrix_map_export_csv',
      invoked_by_role: 'service_role',
      args_summary: filterSummary,
      affected_rows: rowCount,
      notes: 'POST /api/matrix-map/export; client_ip intentionally omitted because forwarding headers are not trusted here; csv_exports budget increment requires DB-side atomic RPC follow-up.',
    });
  if (serviceAuditError) {
    return NextResponse.json(
      { error: 'service_role_audit_failed', detail: serviceAuditError.message },
      { status: 500 },
    );
  }

  return true;
}

function rowsToCsv(rows: string[][]) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

function escapeCsvCell(value: string) {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (!/[",\n\r]/.test(safeValue)) return safeValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function stringField(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function scalarField(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return null;
}

function formatCell(value: string | number | null) {
  return value === null ? '' : String(value);
}

function datedFilename(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
