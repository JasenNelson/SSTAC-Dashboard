import { NextResponse, type NextRequest } from 'next/server';
import {
  createEcotoxClient,
  getEcotoxClientConfig,
  normalizeSearchTerm,
  searchEcotoxChemicals,
} from '@/lib/matrix-options/ssd/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const term = normalizeSearchTerm(
    request.nextUrl.searchParams.get('q') ?? '',
  );
  if (term.length < 2) {
    return NextResponse.json({ chemicals: [] });
  }

  const config = getEcotoxClientConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'ecotox_supabase_not_configured', chemicals: [] },
      { status: 503 },
    );
  }

  try {
    const client = createEcotoxClient(config);
    const chemicals = await searchEcotoxChemicals(client, term);
    return NextResponse.json({ chemicals });
  } catch (err) {
    console.error('[matrix-options/ssd/chemicals] search failed', err);
    return NextResponse.json(
      {
        error: 'ecotox_chemical_search_failed',
        chemicals: [],
      },
      { status: 500 },
    );
  }
}
