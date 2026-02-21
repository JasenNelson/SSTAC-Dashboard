/**
 * GET /api/hitl-packets
 *
 * List available HITL packet sessions with metadata.
 * Returns discovered sessions from HITL_PACKET_DIR.
 */

import { NextResponse } from 'next/server';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';
import { discoverPacketSessions } from '@/lib/hitl-packets';

export async function GET() {
  try {
    const supabase = await createAuthenticatedClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = discoverPacketSessions();

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        hasCSV: s.csvPath !== null,
        hasMD: s.mdPath !== null,
        metadata: s.metadata,
        modifiedAt: s.modifiedAt,
      })),
      count: sessions.length,
    });
  } catch (error) {
    console.error('Error listing HITL packets:', error);
    return NextResponse.json(
      { error: 'Failed to list HITL packets' },
      { status: 500 }
    );
  }
}
