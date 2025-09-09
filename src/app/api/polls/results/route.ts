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

    // First, try to get the poll from polls table
    const { data: pollData, error: pollError } = await supabase
      .from('polls')
      .select('*')
      .eq('page_path', pagePath)
      .eq('poll_index', parseInt(pollIndex))
      .single();

    let results = null;
    let userVote = null;
    let userOtherText = null;

    if (pollError && pollError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine for new polls
      console.error('Error fetching poll:', pollError);
      return NextResponse.json({ error: 'Failed to fetch poll' }, { status: 500 });
    }

    if (pollData) {
      console.log(`Poll exists for pollIndex ${pollIndex}:`, pollData);
      
      // Poll exists, get results from view
      const { data: resultsData, error: resultsError } = await supabase
        .from('poll_results')
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

      // Get user's vote
      console.log(`Looking for user vote for poll ${pollData.id} (pollIndex: ${pollIndex})`);
      const { data: userVoteData, error: voteError } = await supabase
        .from('poll_votes')
        .select('option_index, other_text')
        .eq('poll_id', pollData.id)
        .eq('user_id', user.id)
        .single();

      console.log(`User vote data for poll ${pollIndex}:`, { userVoteData, voteError });
      if (!voteError && userVoteData) {
        userVote = userVoteData.option_index;
        userOtherText = userVoteData.other_text;
        console.log(`User vote found for poll ${pollIndex}:`, userVote, userOtherText ? `with other text: "${userOtherText}"` : '');
      } else {
        console.log(`No user vote found for poll ${pollIndex}`);
      }
    } else {
      console.log(`Poll does not exist yet for pollIndex ${pollIndex}`);
    }

    return NextResponse.json({ results, userVote, userOtherText });
  } catch (error) {
    console.error('Error in poll results API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
