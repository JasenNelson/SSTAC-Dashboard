import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    // Get poll indices for matrix graph questions
    const { data: polls, error: pollsError } = await supabase
      .from('polls')
      .select('id, page_path, poll_index, question')
      .or('page_path.like.%holistic-protection%,page_path.like.%prioritization%')
      .order('page_path')
      .order('poll_index');

    if (pollsError) throw pollsError;

    // Get recent votes
    const { data: recentVotes, error: votesError } = await supabase
      .from('poll_votes')
      .select(`
        poll_id,
        user_id,
        option_index,
        voted_at,
        polls!inner(page_path, poll_index)
      `)
      .gte('voted_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('voted_at', { ascending: false })
      .limit(20);

    if (votesError) throw votesError;

    // Get poll_results data
    const { data: pollResults, error: resultsError } = await supabase
      .from('poll_results')
      .select('page_path, poll_index, responses')
      .or('page_path.like.%holistic-protection%,page_path.like.%prioritization%')
      .order('page_path')
      .order('poll_index');

    if (resultsError) throw resultsError;

    return NextResponse.json({
      success: true,
      data: {
        polls: polls || [],
        recentVotes: recentVotes || [],
        pollResults: pollResults || [],
        summary: {
          totalPolls: polls?.length || 0,
          totalRecentVotes: recentVotes?.length || 0,
          totalPollResults: pollResults?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Debug poll indices error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
