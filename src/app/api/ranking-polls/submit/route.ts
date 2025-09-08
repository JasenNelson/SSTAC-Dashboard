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

    const { pagePath, pollIndex, question, options, rankings } = await request.json();

    // Get or create ranking poll
    const { data: pollData, error: pollError } = await supabase
      .rpc('get_or_create_ranking_poll', {
        p_page_path: pagePath,
        p_poll_index: pollIndex,
        p_question: question,
        p_options: options
      });

    if (pollError) {
      console.error('Error creating/getting ranking poll:', pollError);
      return NextResponse.json({ error: 'Failed to create/get ranking poll' }, { status: 500 });
    }

    // Submit ranking votes
    const { data: voteData, error: voteError } = await supabase
      .rpc('submit_ranking_votes', {
        p_ranking_poll_id: pollData,
        p_rankings: rankings
      });

    if (voteError) {
      console.error('Error submitting ranking votes:', voteError);
      return NextResponse.json({ error: 'Failed to submit ranking votes' }, { status: 500 });
    }

    return NextResponse.json({ success: true, pollId: pollData });
  } catch (error) {
    console.error('Error in ranking poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
