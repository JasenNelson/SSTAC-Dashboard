import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pagePath, pollIndex, question, maxWords, wordLimit, words, authCode } = body;
    console.log(`[Wordcloud Submit] Received words for poll ${pollIndex} on page ${pagePath}, words: ${words}${authCode ? `, authCode: "${authCode}"` : ''}`);

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

    // Determine if this is a CEW page
    const isCEWPage = pagePath.startsWith('/cew-polls/');
    console.log(`[Wordcloud Submit] isCEWPage: ${isCEWPage}, authCode: "${authCode}"`);
    let supabase, finalUserId;

    if (isCEWPage) {
      // CEW pages: Use anonymous connection with unique userId for each submission
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get() { return null; },
            set() {},
            remove() {},
          },
        }
      );
      
      // Generate unique user_id for each CEW submission to count unique participants
      // This allows multiple people to submit and be counted as separate responses
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      finalUserId = `${authCode || 'CEW2025'}_${timestamp}_${randomSuffix}`;
      console.log(`[Wordcloud Submit] CEW page, using unique userId: ${finalUserId}`);
    } else {
      // Survey-results pages: Use authenticated connection (require login)
      const cookieStore = await cookies();
      supabase = createServerClient(
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
      finalUserId = user.id;
      console.log(`[Wordcloud Submit] Authenticated user: ${finalUserId}`);
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

    // For CEW pages, allow multiple votes by inserting new records
    // For authenticated users, delete existing and insert new ones
    if (isCEWPage) {
      // CEW pages: Always insert new votes (allow multiple votes per CEW code)
      console.log(`[Wordcloud Submit] CEW page - inserting new wordcloud votes`);
    } else {
      // Authenticated users: Delete existing votes first
      console.log(`[Wordcloud Submit] Authenticated user - deleting existing votes first`);
      const { error: deleteError } = await supabase
        .from('wordcloud_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('user_id', finalUserId);

      if (deleteError) {
        console.error('Error deleting existing wordcloud votes:', deleteError);
        console.log('Continuing with vote submission despite delete error');
      }
    }

    // Insert new votes (one record per word)
    const voteRecords = words.map((word: string) => ({
      poll_id: pollId,
      user_id: finalUserId,
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