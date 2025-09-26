import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pagePath = searchParams.get('pagePath');
    const pollIndex = searchParams.get('pollIndex');
    const authCode = searchParams.get('authCode');

    // Validate required parameters
    if (!pagePath || pollIndex === null) {
      return NextResponse.json(
        { error: 'Missing required parameters: pagePath, pollIndex' },
        { status: 400 }
      );
    }

    const pollIndexNum = parseInt(pollIndex);
    if (isNaN(pollIndexNum)) {
      return NextResponse.json(
        { error: 'Invalid pollIndex parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Determine user_id for checking user's previous submission
    let userId: string | null = null;
    
    if (authCode) {
      // CEW conference mode - use authCode as user_id
      userId = authCode;
    } else {
      // Authenticated user mode
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        userId = user.id;
      }
    }

    // Get wordcloud poll results using the helper function
    const { data: resultsData, error: resultsError } = await supabase
      .rpc('get_wordcloud_poll_results', {
        p_page_path: pagePath,
        p_poll_index: pollIndexNum,
        p_user_id: userId
      });

    if (resultsError) {
      console.error('Error fetching wordcloud poll results:', resultsError);
      return NextResponse.json(
        { error: 'Failed to fetch poll results' },
        { status: 500 }
      );
    }

    // Check if poll exists
    if (!resultsData || resultsData.length === 0) {
      return NextResponse.json({
        results: {
          total_votes: 0,
          words: [],
          user_words: null
        }
      });
    }

    const result = resultsData[0];

    return NextResponse.json({
      results: {
        total_votes: result.total_votes || 0,
        words: result.words || [],
        user_words: result.user_words || null
      }
    });

  } catch (error) {
    console.error('Wordcloud poll results error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
