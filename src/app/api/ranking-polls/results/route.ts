import { NextRequest, NextResponse } from 'next/server';
import { createClientForPagePath, getAuthenticatedUser } from '@/lib/supabase-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pagePath = searchParams.get('pagePath');
    const pollIndex = searchParams.get('pollIndex');
    const authCode = searchParams.get('authCode');

    if (!pagePath || pollIndex === null) {
      return NextResponse.json({ error: 'Missing pagePath or pollIndex' }, { status: 400 });
    }

    // Create appropriate client based on page path (CEW vs authenticated)
    const { supabase, isCEWPage } = await createClientForPagePath(pagePath);
    
    let userId = null;
    
    if (isCEWPage && authCode) {
      // CEW pages: don't return user votes for privacy
      userId = null;
      if (process.env.NODE_ENV === 'development') {
        console.log(`CEW ranking poll - not returning user rankings for privacy (pollIndex: ${pollIndex})`);
        console.log(`Looking for CEW user rankings for poll ${pollIndex} with authCode: ${authCode}`);
      }
    } else {
      // Authenticated pages: use user session
      const user = await getAuthenticatedUser(supabase);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
      if (process.env.NODE_ENV === 'development') {
        console.log(`Looking for authenticated user rankings for poll ${pollIndex}`);
      }
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
      if (process.env.NODE_ENV === 'development') {
        console.log(`Poll exists for pollIndex ${pollIndex}:`, pollData);
      }
      
      // Poll exists, get results from view
      const { data: resultsData, error: resultsError } = await supabase
        .from('ranking_results')
        .select('*')
        .eq('page_path', pagePath)
        .eq('poll_index', parseInt(pollIndex))
        .single();

      if (!resultsError) {
        results = resultsData;
        if (process.env.NODE_ENV === 'development') {
          console.log(`Results found for poll ${pollIndex}:`, results);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No results found for poll ${pollIndex}:`, resultsError);
        }
      }

      // Get user's rankings if we have a userId
      if (userId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Looking for user rankings for poll ${pollData.id} (pollIndex: ${pollIndex}) with userId: ${userId}`);
        }
        const { data: userVoteData, error: voteError } = await supabase
          .from('ranking_votes')
          .select('option_index, rank')
          .eq('ranking_poll_id', pollData.id)
          .eq('user_id', userId)
          .order('rank');

        if (process.env.NODE_ENV === 'development') {
          console.log(`User vote data for poll ${pollIndex}:`, { userVoteData, voteError });
        }
        if (!voteError && userVoteData && userVoteData.length > 0) {
          // Convert to array format where index = option_index, value = rank
          // Find the maximum option_index to determine array size
          const maxOptionIndex = Math.max(...userVoteData.map((vote: { option_index: number }) => vote.option_index));
          const rankings = new Array(maxOptionIndex + 1);
          userVoteData.forEach((vote: { option_index: number; rank: number }) => {
            rankings[vote.option_index] = vote.rank;
          });
          userRankings = rankings;
          if (process.env.NODE_ENV === 'development') {
            console.log(`Converted rankings for poll ${pollIndex}:`, userRankings);
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log(`No user rankings found for poll ${pollIndex}`);
          }
        }
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Poll does not exist yet for pollIndex ${pollIndex}`);
      }
    }

    return NextResponse.json({ results, userRankings });
  } catch (error) {
    console.error('Error in ranking poll results API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
