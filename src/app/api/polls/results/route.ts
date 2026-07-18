import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';
import { logger } from '@/lib/logger';

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
      logger.debug('Poll exists', { pollIndex, pollData });

      // Poll exists, get results from view
      const { data: resultsData, error: resultsError } = await supabase
        .from('poll_results')
        .select('*')
        .eq('page_path', pagePath)
        .eq('poll_index', parseInt(pollIndex))
        .single();

      if (!resultsError) {
        results = resultsData;
        logger.debug('Results found for poll', { pollIndex, results });
      } else {
        logger.debug('No results found for poll', { pollIndex, resultsError });
      }

      // Get user's vote (for both authenticated users and CEW pages)
      let userId = null;
      
      // Check for authCode first (CEW pages take priority)
      const authCode = request.nextUrl.searchParams.get('authCode');
      if (authCode) {
        // For CEW pages, don't return user votes for privacy
        logger.debug('CEW poll - not returning user vote for privacy', { pollIndex });
      } else if (isAuthenticated && user) {
        userId = user.id;
        logger.debug('Looking for authenticated user vote', { pollId: pollData.id, pollIndex });
      }

      if (userId) {
        const { data: userVoteData, error: voteError } = await supabase
          .from('poll_votes')
          .select('option_index, other_text')
          .eq('poll_id', pollData.id)
          .eq('user_id', userId)
          .single();

        logger.debug('User vote data for poll', { pollIndex, userVoteData, voteError });
        if (!voteError && userVoteData) {
          userVote = userVoteData.option_index;
          userOtherText = userVoteData.other_text;
          logger.debug('User vote found for poll', { pollIndex, userVote, userOtherText });
        } else {
          logger.debug('No user vote found for poll', { pollIndex });
        }
      } else {
        logger.debug('No user identifier available - no user vote lookup', { pollIndex });
      }
    } else {
      logger.debug('Poll does not exist yet', { pollIndex });
    }

    return NextResponse.json({ results, userVote, userOtherText });
  } catch (error) {
    console.error('Error in poll results API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
