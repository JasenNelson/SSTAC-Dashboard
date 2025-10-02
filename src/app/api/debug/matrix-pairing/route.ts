import { createClient } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';
  
  try {
    // 1. Get all votes for holistic protection questions 1-2
    const { data: votes } = await supabase
      .from('poll_votes')
      .select(`
        user_id, 
        option_index, 
        voted_at, 
        poll_id,
        polls!inner(page_path, poll_index)
      `)
      .in('polls.page_path', [
        '/survey-results/holistic-protection',
        '/cew-polls/holistic-protection'
      ])
      .in('polls.poll_index', [0, 1]); // Questions 1 and 2

    // 2. Group by user_id and analyze
    const userAnalysis = new Map();
    votes?.forEach((vote: any) => {
      const userId = vote.user_id;
      const userType = userId.startsWith('CEW2025') ? 'cew' : 'authenticated';
      const polls = vote.polls as any;
      const question = polls?.poll_index === 0 ? 'importance' : 'feasibility';
      const score = vote.option_index + 1;
      
      if (!userAnalysis.has(userId)) {
        userAnalysis.set(userId, {
          user_id: userId,
          user_type: userType,
          votes: [],
          has_importance: false,
          has_feasibility: false,
          can_pair: false
        });
      }
      
      const user = userAnalysis.get(userId);
      user.votes.push({
        question,
        score,
        voted_at: vote.voted_at,
        poll_id: vote.poll_id
      });
      
      if (question === 'importance') user.has_importance = true;
      if (question === 'feasibility') user.has_feasibility = true;
    });

    // 3. Determine pairing capability
    userAnalysis.forEach(user => {
      user.can_pair = user.has_importance && user.has_feasibility;
    });

    // 4. Create summary
    const summary = {
      total_votes: votes?.length || 0,
      unique_users: userAnalysis.size,
      cew_users: Array.from(userAnalysis.values()).filter(u => u.user_type === 'cew').length,
      authenticated_users: Array.from(userAnalysis.values()).filter(u => u.user_type === 'authenticated').length,
      users_with_pairs: Array.from(userAnalysis.values()).filter(u => u.can_pair).length,
      sample_users: Array.from(userAnalysis.values()).slice(0, 3).map(u => ({
        user_id: u.user_id.substring(0, 20) + '...',
        user_type: u.user_type,
        can_pair: u.can_pair,
        vote_count: u.votes.length,
        votes: u.votes.map((v: any) => `${v.question}:${v.score}`)
      }))
    };

    return NextResponse.json({
      success: true,
      summary,
      debug_info: {
        filter_applied: filter,
        questions_analyzed: 'Holistic Protection Q1+Q2',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug_info: {
        filter_applied: filter,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}
