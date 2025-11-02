import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();
    const user = await getAuthenticatedUser(supabase);
    
    // For anonymous users, we'll still return results but no user vote
    const isAuthenticated = !!user;

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
      if (process.env.NODE_ENV === 'development') {
        console.log(`Poll exists for pollIndex ${pollIndex}:`, pollData);
      }
      
      // Poll exists, get results from view
      const { data: resultsData, error: resultsError } = await supabase
        .from('poll_results')
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

      // Get user's vote (for both authenticated users and CEW pages)
      let userId = null;
      
      // Check for authCode first (CEW pages take priority)
      const authCode = request.nextUrl.searchParams.get('authCode');
      if (authCode) {
        // For CEW pages, don't return user votes for privacy
        if (process.env.NODE_ENV === 'development') {
          console.log(`CEW poll - not returning user vote for privacy (pollIndex: ${pollIndex})`);
        }
      } else if (isAuthenticated && user) {
        userId = user.id;
        if (process.env.NODE_ENV === 'development') {
          console.log(`Looking for authenticated user vote for poll ${pollData.id} (pollIndex: ${pollIndex})`);
        }
      }

      if (userId) {
        const { data: userVoteData, error: voteError } = await supabase
          .from('poll_votes')
          .select('option_index, other_text')
          .eq('poll_id', pollData.id)
          .eq('user_id', userId)
          .single();

        if (process.env.NODE_ENV === 'development') {
          console.log(`User vote data for poll ${pollIndex}:`, { userVoteData, voteError });
        }
        if (!voteError && userVoteData) {
          userVote = userVoteData.option_index;
          userOtherText = userVoteData.other_text;
          if (process.env.NODE_ENV === 'development') {
            console.log(`User vote found for poll ${pollIndex}:`, userVote, userOtherText ? `with other text: "${userOtherText}"` : '');
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log(`No user vote found for poll ${pollIndex}`);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No user identifier available - no user vote lookup for poll ${pollIndex}`);
        }
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Poll does not exist yet for pollIndex ${pollIndex}`);
      }
    }

    return NextResponse.json({ results, userVote, userOtherText });
  } catch (error) {
    console.error('Error in poll results API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
