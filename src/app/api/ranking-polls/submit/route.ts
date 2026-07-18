import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClientForPagePath, getAuthenticatedUser } from '@/lib/supabase-auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { pagePath, pollIndex, question, options, rankings, authCode } = await request.json();
    logger.debug('Received ranking submission', { pollIndex, pagePath, authCode });

    // Create appropriate client based on page path (CEW vs authenticated)
    const { supabase: supabaseClient, isCEWPage } = await createClientForPagePath(pagePath);
    let finalUserId;
    
    if (isCEWPage) {
      // CEW pages: Generate unique user_id for each CEW submission to count unique participants
      // This allows multiple people to submit and be counted as separate responses.
      // SECURITY: use a cryptographically secure random suffix (randomBytes) rather
      // than Math.random(), which is predictable. The "<code>_<timestamp>_<hex>" shape
      // is preserved for backward compatibility.
      const timestamp = Date.now();
      const randomSuffix = randomBytes(4).toString('hex');
      finalUserId = `${authCode || 'CEW2025'}_${timestamp}_${randomSuffix}`;
      logger.debug('CEW page, using unique userId', { finalUserId });
    } else {
      // Authenticated pages: Get user ID from authenticated user
      const user = await getAuthenticatedUser(supabaseClient);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      finalUserId = user.id;
      logger.debug('Authenticated user', { finalUserId });
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

    logger.debug('Poll created/found for pollIndex', { pollIndex, pollId });

    // For CEW pages, allow multiple votes by inserting new records
    // For authenticated users, delete existing and insert new ones
    if (isCEWPage && authCode) {
      // CEW pages: Always insert new votes (allow multiple votes per CEW code)
      logger.debug('CEW page - inserting new ranking votes');
    } else {
      // Authenticated users: Delete existing votes first
      logger.debug('Authenticated user - deleting existing votes first');
      const { error: deleteError } = await supabaseClient
        .from('ranking_votes')
        .delete()
        .eq('ranking_poll_id', pollId)
        .eq('user_id', finalUserId);

      if (deleteError) {
        console.error('Error deleting existing ranking votes:', deleteError);
        logger.debug('Continuing with vote submission despite delete error');
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

    const { error: voteError } = await supabaseClient
      .from('ranking_votes')
      .insert(voteInserts)
      .select();

    if (voteError) {
      console.error('Error submitting ranking votes:', voteError);
      console.error(`[Ranking Poll Submit] Vote error details:`, JSON.stringify(voteError, null, 2));
      // SECURITY: do not leak the raw Postgres/Supabase error text to the client
      // (information disclosure). The full error is logged server-side above.
      return NextResponse.json({ error: 'Failed to submit ranking votes' }, { status: 500 });
    }

    logger.debug('Successfully submitted ranking votes', { count: voteInserts.length, pollId });
    return NextResponse.json({ success: true, pollId: pollId });
  } catch (error) {
    console.error('Error in ranking poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
