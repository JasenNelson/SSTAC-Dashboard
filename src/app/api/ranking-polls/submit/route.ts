import { NextRequest, NextResponse } from 'next/server';
import { createClientForPagePath, getAuthenticatedUser } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  try {
    const { pagePath, pollIndex, question, options, rankings, authCode } = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Ranking Poll Submit] Received ranking for poll ${pollIndex} on page ${pagePath}${authCode ? `, authCode: "${authCode}"` : ''}`);
    }
    
    // Create appropriate client based on page path (CEW vs authenticated)
    const { supabase: supabaseClient, isCEWPage } = await createClientForPagePath(pagePath);
    let finalUserId;
    
    if (isCEWPage) {
      // CEW pages: Generate unique user_id for each CEW submission to count unique participants
      // This allows multiple people to submit and be counted as separate responses
      // Note: Using inline generation to maintain exact backward compatibility with existing format
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      finalUserId = `${authCode || 'CEW2025'}_${timestamp}_${randomSuffix}`;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Ranking Poll Submit] CEW page, using unique userId: ${finalUserId}`);
      }
    } else {
      // Authenticated pages: Get user ID from authenticated user
      const user = await getAuthenticatedUser(supabaseClient);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      finalUserId = user.id;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Ranking Poll Submit] Authenticated user: ${finalUserId}`);
      }
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

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Ranking Poll Submit] Poll created/found for pollIndex ${pollIndex}:`, pollId);
    }

    // For CEW pages, allow multiple votes by inserting new records
    // For authenticated users, delete existing and insert new ones
    if (isCEWPage && authCode) {
      // CEW pages: Always insert new votes (allow multiple votes per CEW code)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Ranking Poll Submit] CEW page - inserting new ranking votes`);
      }
    } else {
      // Authenticated users: Delete existing votes first
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Ranking Poll Submit] Authenticated user - deleting existing votes first`);
      }
      const { error: deleteError } = await supabaseClient
        .from('ranking_votes')
        .delete()
        .eq('ranking_poll_id', pollId)
        .eq('user_id', finalUserId);

      if (deleteError) {
        console.error('Error deleting existing ranking votes:', deleteError);
        if (process.env.NODE_ENV === 'development') {
          console.log('Continuing with vote submission despite delete error');
        }
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
      return NextResponse.json({ error: 'Failed to submit ranking votes', details: voteError.message }, { status: 500 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Ranking Poll Submit] Successfully submitted ${voteInserts.length} ranking votes for poll ${pollId}`);
    }
    return NextResponse.json({ success: true, pollId: pollId });
  } catch (error) {
    console.error('Error in ranking poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
