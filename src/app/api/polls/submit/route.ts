import { NextRequest, NextResponse } from 'next/server';
import { createClientForPagePath, getAuthenticatedUser, generateCEWUserId } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  try {
    const { pagePath, pollIndex, question, options, optionIndex, otherText, authCode } = await request.json();
    
    // Create appropriate client based on page path (CEW vs authenticated)
    const { supabase, isCEWPage } = await createClientForPagePath(pagePath);
    let finalUserId;

    if (isCEWPage) {
      // CEW pages: Generate unique user ID for anonymous submissions
      const sessionId = request.headers.get('x-session-id');
      finalUserId = generateCEWUserId(authCode || 'CEW2025', sessionId);
    } else {
      // Authenticated pages: Get user ID from authenticated user
      const user = await getAuthenticatedUser(supabase);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      finalUserId = user.id;
    }

    // Get or create poll
    const { data: pollData, error: pollError } = await supabase
      .rpc('get_or_create_poll', {
        p_page_path: pagePath,
        p_poll_index: pollIndex,
        p_question: question,
        p_options: options
      });

    if (pollError) {
      console.error(`Error creating/getting poll for pollIndex ${pollIndex}:`, pollError);
      return NextResponse.json({ error: 'Failed to create/get poll' }, { status: 500 });
    }


    // For CEW pages, allow multiple votes by inserting new records
    // For authenticated users, use upsert to allow vote changes
    
    let voteError;
    
    if (isCEWPage) {
      // CEW pages: Always insert new vote (allow multiple votes per CEW code)
      const { error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: pollData,
          user_id: finalUserId,
          option_index: optionIndex,
          other_text: otherText || null,
          voted_at: new Date().toISOString()
        });
      
      voteError = error;
    } else {
      // Authenticated users: Delete existing votes first, then insert new one
      // This ensures we don't have duplicates and allows vote changes
      const { error: deleteError } = await supabase
        .from('poll_votes')
        .delete()
        .eq('poll_id', pollData)
        .eq('user_id', finalUserId);

      if (deleteError) {
        console.error(`Error deleting existing vote for pollIndex ${pollIndex}:`, deleteError);
        // Continue with insert even if delete fails
      }

      // Insert new vote
      const { error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: pollData,
          user_id: finalUserId,
          option_index: optionIndex,
          other_text: otherText || null,
          voted_at: new Date().toISOString()
        });
      
      voteError = error;
    }

    if (voteError) {
      console.error(`Error submitting vote for pollIndex ${pollIndex}:`, voteError);
      return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
    }

    // Success - vote submitted
    return NextResponse.json({ success: true, pollId: pollData });
  } catch (error) {
    console.error('Error in poll submit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}