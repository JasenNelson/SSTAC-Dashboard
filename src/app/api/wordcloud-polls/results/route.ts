import { NextRequest, NextResponse } from 'next/server';
import { createClientForPagePath, getAuthenticatedUser } from '@/lib/supabase-auth';

// Type definitions for wordcloud API
interface WordcloudResult {
  poll_id: string;
  page_path: string;
  poll_index: number;
  question: string;
  max_words: number;
  word_limit: number;
  total_responses: number;
  word: string;
  frequency: number;
  percentage: number;
}

interface ProcessedWordItem {
  text: string;
  value: number;
}

interface WordcloudResponse {
  results: {
    total_votes: number;
    words: ProcessedWordItem[];
    user_words: string[] | null;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Create appropriate client based on page path (CEW vs authenticated)
    const { supabase, isCEWPage } = await createClientForPagePath(pagePath);
    let userId: string | null = null;

    if (isCEWPage) {
      // CEW pages: Use anonymous connection
      userId = authCode || 'CEW2025';
    } else {
      // Survey-results pages: Use authenticated connection (require login)
      const user = await getAuthenticatedUser(supabase);
      if (user) {
        userId = user.id;
      }
    }

    // Get wordcloud poll results - need to combine data from both survey-results and cew-polls
    // Extract the topic from the pagePath to match both paths
    const topic = pagePath.replace('/survey-results/', '').replace('/cew-polls/', '');
    const surveyPath = `/survey-results/${topic}`;
    const cewPath = `/cew-polls/${topic}`;

    // Fetch data from both paths (similar to admin panel logic)
    const [surveyData, cewData] = await Promise.all([
      supabase
        .from('wordcloud_results')
        .select('*')
        .eq('page_path', surveyPath)
        .eq('poll_index', pollIndexNum)
        .order('frequency', { ascending: false })
        .order('word', { ascending: true }),
      supabase
        .from('wordcloud_results')
        .select('*')
        .eq('page_path', cewPath)
        .eq('poll_index', pollIndexNum)
        .order('frequency', { ascending: false })
        .order('word', { ascending: true })
    ]);

    if (surveyData.error || cewData.error) {
      console.error('Error fetching wordcloud poll results:', {
        surveyError: surveyData.error,
        cewError: cewData.error,
        pagePath,
        pollIndex: pollIndexNum,
        isCEWPage,
        userId
      });
      
      // Return more detailed error for debugging
      return NextResponse.json(
        { 
          error: 'Failed to fetch poll results',
          details: surveyData.error?.message || cewData.error?.message,
          code: surveyData.error?.code || cewData.error?.code
        },
        { status: 500 }
      );
    }

    // Combine results from both paths
    // Group by word and sum frequencies (same as admin panel logic)
    const wordMap = new Map<string, number>();
    const allResults: WordcloudResult[] = [];

    // Add survey results
    if (surveyData.data) {
      allResults.push(...(surveyData.data as WordcloudResult[]));
    }

    // Add CEW results
    if (cewData.data) {
      allResults.push(...(cewData.data as WordcloudResult[]));
    }

    // Aggregate words by summing frequencies
    allResults.forEach((item: WordcloudResult) => {
      if (item.word) {
        wordMap.set(item.word, (wordMap.get(item.word) || 0) + (item.frequency || 0));
      }
    });
    
    // Convert to array and sort by frequency
    const resultsData = Array.from(wordMap.entries())
      .map(([word, frequency]) => ({
        poll_id: allResults[0]?.poll_id,
        page_path: pagePath,
        poll_index: pollIndexNum,
        question: allResults[0]?.question || '',
        max_words: allResults[0]?.max_words || 1,
        word_limit: allResults[0]?.word_limit || 20,
        total_responses: 0, // Will calculate below
        word,
        frequency,
        percentage: 0
      }))
      .sort((a, b) => b.frequency - a.frequency);
    
    // Calculate total responses by getting the total_responses field from the view
    // Each poll_id in the view has the same total_responses value (count of distinct users)
    // We need to get them from both paths and sum them
    const surveyTotalResponses = surveyData.data && surveyData.data.length > 0 
      ? (surveyData.data[0].total_responses || 0) 
      : 0;
    const cewTotalResponses = cewData.data && cewData.data.length > 0 
      ? (cewData.data[0].total_responses || 0) 
      : 0;
    const totalResponses = surveyTotalResponses + cewTotalResponses;
    
    // Update total_responses for all entries
    resultsData.forEach(item => {
      item.total_responses = totalResponses;
    });

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

    // Get user's submitted words if authenticated
    let userWords: string[] | null = null;
    if (userId && !isCEWPage) {
      // Fetch user's words for this poll
      const { data: pollData } = await supabase
        .from('wordcloud_polls')
        .select('id')
        .eq('page_path', pagePath)
        .eq('poll_index', pollIndexNum)
        .single();

      if (pollData?.id) {
        const { data: userVotesData } = await supabase
          .from('wordcloud_votes')
          .select('word')
          .eq('poll_id', pollData.id)
          .eq('user_id', userId);

        if (userVotesData && userVotesData.length > 0) {
          userWords = userVotesData.map(v => v.word);
        }
      }
    }

    // Process words from view (already aggregated and sorted)
    const words: ProcessedWordItem[] = resultsData
      .filter((item: WordcloudResult) => item.word !== null && item.word !== undefined)
      .map((item: WordcloudResult) => ({
        text: item.word,
        value: item.frequency
      }));

    // Get total_votes from first row (total_responses field in view)
    const totalVotes = resultsData.length > 0 && resultsData[0].total_responses 
      ? resultsData[0].total_responses 
      : 0;

    return NextResponse.json({
      results: {
        total_votes: totalVotes,
        words: words,
        user_words: userWords // User's submitted words for remembering their submission
      }
    });

  } catch (error) {
    console.error('Wordcloud poll results error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
