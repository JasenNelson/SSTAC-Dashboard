import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pagePath, pollIndex, question, options, optionIndex, otherText, authCode } = await request.json();
    // Determine if this is a CEW page
    const isCEWPage = pagePath.startsWith('/cew-polls/');
    let supabase, finalUserId;

    if (isCEWPage) {
      // CEW pages: Use anonymous connection with unique userId for each submission
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get() { return null; },
            set() {},
            remove() {},
          },
        }
      );
      
      // Generate session-based user_id for CEW submissions to enable vote pairing
      // This allows votes from the same session to be paired together for matrix graphs
      // Use authCode + a session identifier that persists across multiple votes
      const sessionId = request.headers.get('x-session-id') || 'default';
      finalUserId = `${authCode || 'CEW2025'}_${sessionId}`;
    } else {
      // Authenticated pages: Use authenticated connection
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
              try { cookieStore.set({ name, value, ...options }); } catch (error) {}
            },
            remove(name: string, options: CookieOptions) {
              try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      finalUserId = user.id;
    }

    // Get or create poll
    const { data: pollData, error: pollError } = await supabase
      .rpc('get_or_create_poll', {
        p_page_path: pagePath,
        p_poll_index: pollIndex,
        p_question: question,
        p_options: options
      });

    if (pollError) {
      console.error(`Error creating/getting poll for pollIndex ${pollIndex}:`, pollError);
      return NextResponse.json({ error: 'Failed to create/get poll' }, { status: 500 });
    }


    // For CEW pages, allow multiple votes by inserting new records
    // For authenticated users, use upsert to allow vote changes
    
    let voteData, voteError;
    
    if (authCode) {
      // CEW pages: Always insert new vote (allow multiple votes per CEW code)
      const { data, error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: pollData,
          user_id: finalUserId,
          option_index: optionIndex,
          other_text: otherText || null,
          voted_at: new Date().toISOString()
        })
        .select();
      
      voteData = data;
      voteError = error;
    } else {
      // Authenticated users: Use upsert to allow vote changes
      const { data, error } = await supabase
        .from('poll_votes')
        .upsert({
          poll_id: pollData,
          user_id: finalUserId,
          option_index: optionIndex,
          other_text: otherText || null,
          voted_at: new Date().toISOString()
        })
        .select();
      
      voteData = data;
      voteError = error;
    }
    

    if (voteError) {
      console.error(`Error submitting vote for pollIndex ${pollIndex}:`, voteError);
      return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
    }

    // Success - vote submitted
    return NextResponse.json({ success: true, pollId: pollData });
  } catch (error) {
    console.error('Error in poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}