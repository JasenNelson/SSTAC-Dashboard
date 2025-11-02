// src/app/api/discussions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();
    const user = await getAuthenticatedUser(supabase);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: discussions, error } = await supabase
      .from('discussions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching discussions:', error);
      return NextResponse.json({ error: 'Failed to fetch discussions' }, { status: 500 });
    }

    return NextResponse.json({ discussions });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();
    const user = await getAuthenticatedUser(supabase);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const { data: discussion, error } = await supabase
      .from('discussions')
      .insert({
        title,
        content,
        user_id: user.id,
        user_email: user.email
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating discussion:', error);
      return NextResponse.json({ error: 'Failed to create discussion' }, { status: 500 });
    }

    return NextResponse.json({ discussion });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
