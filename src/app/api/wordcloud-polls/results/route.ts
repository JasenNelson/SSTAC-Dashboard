import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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

    // Determine if this is a CEW page
    const isCEWPage = pagePath.startsWith('/cew-polls/');
    let supabase, userId: string | null = null;

    if (isCEWPage || authCode) {
      // CEW pages: Use anonymous connection
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
      
      userId = authCode || 'CEW2025';
    } else {
      // Authenticated pages: Use authenticated connection
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
      if (user) {
        userId = user.id;
      }
    }

    // Get wordcloud poll results using the helper function
    const { data: resultsData, error: resultsError } = await supabase
      .rpc('get_wordcloud_word_counts', {
        p_page_path: pagePath,
        p_poll_index: pollIndexNum
      });

    if (resultsError) {
      console.error('Error fetching wordcloud poll results:', resultsError);
      return NextResponse.json(
        { error: 'Failed to fetch poll results' },
        { status: 500 }
      );
    }

    // Process the word counts data
    if (!resultsData || resultsData.length === 0) {
      return NextResponse.json({
        results: {
          total_votes: 0,
          words: [],
          user_words: null
        }
      });
    }

    // Aggregate words and get total votes
    const words = resultsData.map((item: any) => ({
      text: item.word,
      value: item.frequency
    }));

    const totalVotes = resultsData.length > 0 ? resultsData[0].total_votes : 0;

    return NextResponse.json({
      results: {
        total_votes: totalVotes,
        words: words,
        user_words: null // We'll implement user-specific words later if needed
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
