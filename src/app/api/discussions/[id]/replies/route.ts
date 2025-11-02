// src/app/api/discussions/[id]/replies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createAuthenticatedClient();
    
    const user = await getAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: replies, error } = await supabase
      .from('discussion_replies')
      .select('*')
      .eq('discussion_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching replies:', error);
      return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
    }

    return NextResponse.json({ replies });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createAuthenticatedClient();
    
    const user = await getAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify the discussion exists
    const { data: discussion, error: discussionError } = await supabase
      .from('discussions')
      .select('id')
      .eq('id', id)
      .single();

    if (discussionError || !discussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    const { data: reply, error } = await supabase
      .from('discussion_replies')
      .insert({
        content,
        user_id: user.id,
        user_email: user.email,
        discussion_id: id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating reply:', error);
      return NextResponse.json({ error: 'Failed to create reply' }, { status: 500 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
