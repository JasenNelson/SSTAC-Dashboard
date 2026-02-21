/**
 * GET /api/hitl-packets/[sessionId]/md
 *
 * Serve the pre-generated Markdown artifact for a packet session.
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

    const mdPath = getArtifactPath(sessionId, 'md');
    if (!mdPath) {
      return NextResponse.json(
        { error: 'Markdown artifact not found' },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(mdPath, 'utf-8');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="HITL_PACKET_${sessionId}.md"`,
      },
    });
  } catch (error) {
    console.error('Error serving Markdown:', error);
    return NextResponse.json(
      { error: 'Failed to serve Markdown' },
      { status: 500 }
    );
  }
}
