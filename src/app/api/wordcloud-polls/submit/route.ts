import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pagePath, pollIndex, question, maxWords, wordLimit, words, authCode } = body;
    

    // Validate required fields
    if (!pagePath || pollIndex === undefined || !question || !words || !Array.isArray(words)) {
      return NextResponse.json(
        { error: 'Missing required fields: pagePath, pollIndex, question, words' },
        { status: 400 }
      );
    }

    // Validate words array
    if (words.length === 0) {
      return NextResponse.json(
        { error: 'At least one word is required' },
        { status: 400 }
      );
    }

    if (words.length > (maxWords || 3)) {
      return NextResponse.json(
        { error: `Maximum ${maxWords || 3} words allowed` },
        { status: 400 }
      );
    }

    // Validate word length
    const wordLimitValue = wordLimit || 20;
    const invalidWords = words.filter((word: string) => word.length > wordLimitValue);
    if (invalidWords.length > 0) {
      return NextResponse.json(
        { error: `Words must be ${wordLimitValue} characters or less. Invalid: ${invalidWords.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for duplicates
    const uniqueWords = [...new Set(words.map((word: string) => word.toLowerCase()))];
    if (uniqueWords.length !== words.length) {
      return NextResponse.json(
        { error: 'Duplicate words are not allowed' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Determine user_id based on authentication
    let userId: string;
    
    if (authCode) {
      // CEW conference mode - use authCode as user_id
      userId = authCode;
    } else {
      // Authenticated user mode
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    // Get or create the wordcloud poll
    const { data: pollData, error: pollError } = await supabase
      .rpc('get_or_create_wordcloud_poll_fixed', {
        p_page_path: pagePath,
        p_poll_index: pollIndex,
        p_question: question,
        p_max_words: maxWords || 3,
        p_word_limit: wordLimit || 20
      });

    if (pollError) {
      console.error('Error getting/creating wordcloud poll:', pollError);
      return NextResponse.json(
        { error: `Failed to get or create poll: ${pollError.message}` },
        { status: 500 }
      );
    }

    const pollId = pollData;

    // Check if user has already voted
    const { data: existingVote, error: checkError } = await supabase
      .from('wordcloud_votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing vote:', checkError);
      return NextResponse.json(
        { error: `Failed to check existing vote: ${checkError.message}` },
        { status: 500 }
      );
    }

    // Delete existing votes for this user and poll
    const { error: deleteError } = await supabase
      .from('wordcloud_votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting existing votes:', deleteError);
      return NextResponse.json(
        { error: `Failed to clear existing votes: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Insert new votes (one record per word)
    const voteRecords = words.map((word: string) => ({
      poll_id: pollId,
      user_id: userId,
      word: word.toLowerCase().trim()
    }));

    const { error: voteError } = await supabase
      .from('wordcloud_votes')
      .insert(voteRecords);

    if (voteError) {
      console.error('Error submitting wordcloud vote:', voteError);
      return NextResponse.json(
        { error: `Failed to submit words: ${voteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Words submitted successfully',
      pollId: pollId
    });

  } catch (error) {
    console.error('Wordcloud poll submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
