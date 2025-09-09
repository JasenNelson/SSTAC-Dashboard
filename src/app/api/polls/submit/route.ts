import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
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

    const { pagePath, pollIndex, question, options, optionIndex, otherText } = await request.json();
    console.log(`[Poll Submit] Received vote for poll ${pollIndex} on page ${pagePath}, option ${optionIndex}${otherText ? `, otherText: "${otherText}"` : ''}`);

    // Get or create poll
    const { data: pollData, error: pollError } = await supabase
      .rpc('get_or_create_poll', {
        p_page_path: pagePath,
        p_poll_index: pollIndex,
        p_question: question,
        p_options: options
      });

    if (pollError) {
      console.error(`[Poll Submit] Error creating/getting poll for pollIndex ${pollIndex}:`, pollError);
      return NextResponse.json({ error: 'Failed to create/get poll' }, { status: 500 });
    }

    console.log(`[Poll Submit] Poll created/found for pollIndex ${pollIndex}:`, pollData);

    // Submit vote
    const { data: voteData, error: voteError } = await supabase
      .rpc('submit_poll_vote', {
        p_poll_id: pollData,
        p_option_index: optionIndex,
        p_other_text: otherText || null
      });

    if (voteError) {
      console.error(`[Poll Submit] Error submitting vote for pollIndex ${pollIndex}:`, voteError);
      return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
    }

    console.log(`[Poll Submit] Vote submitted successfully for pollIndex ${pollIndex}:`, voteData);
    return NextResponse.json({ success: true, pollId: pollData });
  } catch (error) {
    console.error('Error in poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
