/**
 * GET /api/hitl-packets/[sessionId]
 *
 * Return full packet JSON + validation result for a session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';
import {
  isValidSessionId,
  loadPacketBySessionId,
  validatePacket,
} from '@/lib/hitl-packets';

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

    const packet = loadPacketBySessionId(sessionId);

    if (!packet) {
      return NextResponse.json(
        { error: 'Packet not found' },
        { status: 404 }
      );
    }

    const validation = validatePacket(packet);

    return NextResponse.json({
      packet,
      validation,
    });
  } catch (error) {
    console.error('Error loading HITL packet:', error);
    return NextResponse.json(
      { error: 'Failed to load HITL packet' },
      { status: 500 }
    );
  }
}
