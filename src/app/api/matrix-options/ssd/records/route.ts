import { NextResponse, type NextRequest } from 'next/server';
import {
  ECOTOX_REQUIRED_COLUMNS,
  ECOTOX_TABLE_NAME,
  buildEcotoxFetchRequest,
  checkEcotoxMirrorHealth,
  createEcotoxClient,
  fetchEcotoxRows,
  getEcotoxConfigErrorPayload,
  getEcotoxConfigStatus,
  getEcotoxClientConfig,
} from '@/lib/matrix-options/ssd/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const configStatus = getEcotoxConfigStatus();
  const config = getEcotoxClientConfig();
  if (!configStatus.configured || !config) {
    return NextResponse.json(
      {
        ...getEcotoxConfigErrorPayload(configStatus),
        table: ECOTOX_TABLE_NAME,
        requiredColumns: [...ECOTOX_REQUIRED_COLUMNS],
        rowCount: null,
        rowCountAvailable: false,
        readable: false,
      },
      { status: 503 },
    );
  }

  try {
    const client = createEcotoxClient(config);
    const health = await checkEcotoxMirrorHealth(client);
    return NextResponse.json(health);
  } catch (err) {
    console.error('[matrix-options/ssd/records] health check failed', err);
    return NextResponse.json(
      {
        error: 'ecotox_mirror_health_failed',
        configured: true,
        table: ECOTOX_TABLE_NAME,
        requiredColumns: [...ECOTOX_REQUIRED_COLUMNS],
        rowCount: null,
        rowCountAvailable: false,
        readable: false,
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let fetchRequest;
  try {
    fetchRequest = buildEcotoxFetchRequest(await request.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  if (fetchRequest.chemicalNames.length === 0) {
    return NextResponse.json(
      { error: 'chemicalNames_required', rows: [], truncated: false },
      { status: 400 },
    );
  }

  const configStatus = getEcotoxConfigStatus();
  const config = getEcotoxClientConfig();
  if (!configStatus.configured || !config) {
    return NextResponse.json(
      {
        ...getEcotoxConfigErrorPayload(configStatus),
        rows: [],
        truncated: false,
      },
      { status: 503 },
    );
  }

  try {
    const client = createEcotoxClient(config);
    const result = await fetchEcotoxRows(client, fetchRequest);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[matrix-options/ssd/records] fetch failed', err);
    return NextResponse.json(
      {
        error: 'ecotox_record_fetch_failed',
        rows: [],
        truncated: false,
      },
      { status: 500 },
    );
  }
}
