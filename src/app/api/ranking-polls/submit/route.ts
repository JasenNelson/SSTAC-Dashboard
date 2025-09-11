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

    const { pagePath, pollIndex, question, options, rankings, authCode } = await request.json();
    
    // Check if this is a CEW page
    const isCEWPage = pagePath.startsWith('/cew-polls/');
    
    let finalUserId;
    let supabaseClient = supabase; // Default to authenticated connection
    
    if (isCEWPage && authCode) {
      // CEW pages: use authCode as userId and anonymous connection
      finalUserId = authCode;
      // Create anonymous connection for CEW pages
      supabaseClient = createServerClient(
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
      console.log(`[Ranking Poll Submit] CEW page, using authCode: ${finalUserId}`);
    } else {
      // Authenticated pages: use user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      finalUserId = user.id;
      console.log(`[Ranking Poll Submit] Authenticated user: ${finalUserId}`);
    }

    // Get or create ranking poll using the existing function
    const { data: pollId, error: pollError } = await supabaseClient
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

    console.log(`[Ranking Poll Submit] Poll created/found for pollIndex ${pollIndex}:`, pollId);

    // First, delete any existing votes for this user and poll
    const { error: deleteError } = await supabaseClient
      .from('ranking_votes')
      .delete()
      .eq('ranking_poll_id', pollId)
      .eq('user_id', finalUserId);

    if (deleteError) {
      console.error('Error deleting existing ranking votes:', deleteError);
      return NextResponse.json({ error: 'Failed to clear existing votes' }, { status: 500 });
    }

    // Submit ranking votes directly to ranking_votes table
    const voteInserts = rankings.map((ranking: any) => ({
      ranking_poll_id: pollId,
      user_id: finalUserId,
      option_index: ranking.optionIndex,
      rank: ranking.rank,
      voted_at: new Date().toISOString()
    }));

    const { data: voteData, error: voteError } = await supabaseClient
      .from('ranking_votes')
      .insert(voteInserts)
      .select();

    if (voteError) {
      console.error('Error submitting ranking votes:', voteError);
      return NextResponse.json({ error: 'Failed to submit ranking votes' }, { status: 500 });
    }

    console.log(`[Ranking Poll Submit] Successfully submitted ${voteInserts.length} ranking votes for poll ${pollId}`);
    return NextResponse.json({ success: true, pollId: pollId });
  } catch (error) {
    console.error('Error in ranking poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
