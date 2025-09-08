import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const pagePath = searchParams.get('pagePath');
    const pollIndex = searchParams.get('pollIndex');

    if (!pagePath || pollIndex === null) {
      return NextResponse.json({ error: 'Missing pagePath or pollIndex' }, { status: 400 });
    }

    // First, try to get the poll from ranking_polls table
    const { data: pollData, error: pollError } = await supabase
      .from('ranking_polls')
      .select('*')
      .eq('page_path', pagePath)
      .eq('poll_index', parseInt(pollIndex))
      .single();

    let results = null;
    let userRankings = null;

    if (pollError && pollError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine for new polls
      console.error('Error fetching ranking poll:', pollError);
      return NextResponse.json({ error: 'Failed to fetch poll' }, { status: 500 });
    }

    if (pollData) {
      console.log(`Poll exists for pollIndex ${pollIndex}:`, pollData);
      
      // Poll exists, get results from view
      const { data: resultsData, error: resultsError } = await supabase
        .from('ranking_results')
        .select('*')
        .eq('page_path', pagePath)
        .eq('poll_index', parseInt(pollIndex))
        .single();

      if (!resultsError) {
        results = resultsData;
        console.log(`Results found for poll ${pollIndex}:`, results);
      } else {
        console.log(`No results found for poll ${pollIndex}:`, resultsError);
      }

      // Get user's rankings
      console.log(`Looking for user rankings for poll ${pollData.id} (pollIndex: ${pollIndex})`);
      const { data: userVoteData, error: voteError } = await supabase
        .from('ranking_votes')
        .select('option_index, rank')
        .eq('ranking_poll_id', pollData.id)
        .eq('user_id', user.id)
        .order('rank');

      console.log(`User vote data for poll ${pollIndex}:`, { userVoteData, voteError });
      if (!voteError && userVoteData && userVoteData.length > 0) {
        // Convert to array format where index = option_index, value = rank
        // Find the maximum option_index to determine array size
        const maxOptionIndex = Math.max(...userVoteData.map((vote: any) => vote.option_index));
        const rankings = new Array(maxOptionIndex + 1);
        userVoteData.forEach((vote: any) => {
          rankings[vote.option_index] = vote.rank;
        });
        userRankings = rankings;
        console.log(`Converted rankings for poll ${pollIndex}:`, userRankings);
      } else {
        console.log(`No user rankings found for poll ${pollIndex}`);
      }
    } else {
      console.log(`Poll does not exist yet for pollIndex ${pollIndex}`);
    }

    return NextResponse.json({ results, userRankings });
  } catch (error) {
    console.error('Error in ranking poll results API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
