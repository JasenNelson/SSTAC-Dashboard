import { NextResponse, type NextRequest } from 'next/server';
import {
  buildEcotoxFetchRequest,
  createEcotoxClient,
  fetchEcotoxRows,
  getEcotoxClientConfig,
} from '@/lib/matrix-options/ssd/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const config = getEcotoxClientConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'ecotox_supabase_not_configured', rows: [], truncated: false },
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
