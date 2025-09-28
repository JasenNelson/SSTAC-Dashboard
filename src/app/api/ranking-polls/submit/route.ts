import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { pagePath, pollIndex, question, options, rankings, authCode } = await request.json();
    console.log(`[Ranking Poll Submit] Received ranking for poll ${pollIndex} on page ${pagePath}${authCode ? `, authCode: "${authCode}"` : ''}`);
    
    // Check if this is a CEW page
    const isCEWPage = pagePath.startsWith('/cew-polls/');
    console.log(`[Ranking Poll Submit] isCEWPage: ${isCEWPage}, authCode: "${authCode}"`);
    let supabaseClient, finalUserId;
    
    if (isCEWPage) {
      // CEW pages: Use anonymous connection with authCode as userId
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
      
      // Test if the anonymous client is truly anonymous
      const { data: { user } } = await supabaseClient.auth.getUser();
      console.log(`[Ranking Poll Submit] Anonymous client user check:`, user);
      
      // Generate unique user_id for each CEW submission to count unique participants
      // This allows multiple people to submit and be counted as separate responses
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      finalUserId = `${authCode || 'CEW2025'}_${timestamp}_${randomSuffix}`;
      console.log(`[Ranking Poll Submit] CEW page, using unique userId: ${finalUserId}`);
      console.log(`[Ranking Poll Submit] Supabase client created for CEW page`);
    } else {
      // Authenticated pages: Use authenticated connection
      const cookieStore = await cookies();
      supabaseClient = createServerClient(
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

      const { data: { user } } = await supabaseClient.auth.getUser();
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

    // For CEW pages, allow multiple votes by inserting new records
    // For authenticated users, delete existing and insert new ones
    if (isCEWPage && authCode) {
      // CEW pages: Always insert new votes (allow multiple votes per CEW code)
      console.log(`[Ranking Poll Submit] CEW page - inserting new ranking votes`);
    } else {
      // Authenticated users: Delete existing votes first
      console.log(`[Ranking Poll Submit] Authenticated user - deleting existing votes first`);
      const { error: deleteError } = await supabaseClient
        .from('ranking_votes')
        .delete()
        .eq('ranking_poll_id', pollId)
        .eq('user_id', finalUserId);

      if (deleteError) {
        console.error('Error deleting existing ranking votes:', deleteError);
        console.log('Continuing with vote submission despite delete error');
      }
    }

    // Submit ranking votes directly to ranking_votes table
    const voteInserts = rankings.map((ranking: { optionIndex: number; rank: number }) => ({
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
      console.error(`[Ranking Poll Submit] Vote error details:`, JSON.stringify(voteError, null, 2));
      return NextResponse.json({ error: 'Failed to submit ranking votes', details: voteError.message }, { status: 500 });
    }

    console.log(`[Ranking Poll Submit] Successfully submitted ${voteInserts.length} ranking votes for poll ${pollId}`);
    return NextResponse.json({ success: true, pollId: pollId });
  } catch (error) {
    console.error('Error in ranking poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
