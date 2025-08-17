// src/app/api/discussions/[id]/route.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
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
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: discussion, error } = await supabase
      .from('discussions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching discussion:', error);
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    return NextResponse.json({ discussion });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
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
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user owns the discussion
    const { data: existingDiscussion, error: fetchError } = await supabase
      .from('discussions')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingDiscussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    if (existingDiscussion.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const { data: discussion, error } = await supabase
      .from('discussions')
      .update({ 
        title, 
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating discussion:', error);
      return NextResponse.json({ error: 'Failed to update discussion' }, { status: 500 });
    }

    return NextResponse.json({ discussion });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
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
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user owns the discussion
    const { data: existingDiscussion, error: fetchError } = await supabase
      .from('discussions')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingDiscussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    if (existingDiscussion.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete replies first (due to foreign key constraints)
    const { error: deleteRepliesError } = await supabase
      .from('discussion_replies')
      .delete()
      .eq('discussion_id', id);

    if (deleteRepliesError) {
      console.error('Error deleting replies:', deleteRepliesError);
      return NextResponse.json({ error: 'Failed to delete discussion replies' }, { status: 500 });
    }

    // Delete the discussion
    const { error: deleteError } = await supabase
      .from('discussions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting discussion:', deleteError);
      return NextResponse.json({ error: 'Failed to delete discussion' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Discussion deleted successfully' });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
