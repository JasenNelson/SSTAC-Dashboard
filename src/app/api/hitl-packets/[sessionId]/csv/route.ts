/**
 * GET /api/hitl-packets/[sessionId]/csv
 *
 * Serve the pre-generated CSV artifact for a packet session.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';
import { isValidSessionId, getArtifactPath } from '@/lib/hitl-packets';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const supabase = await createAuthenticatedClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    if (!isValidSessionId(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    const csvPath = getArtifactPath(sessionId, 'csv');
    if (!csvPath) {
      return NextResponse.json(
        { error: 'CSV artifact not found' },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(csvPath, 'utf-8');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="HITL_PACKET_${sessionId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error serving CSV:', error);
    return NextResponse.json(
      { error: 'Failed to serve CSV' },
      { status: 500 }
    );
  }
}
