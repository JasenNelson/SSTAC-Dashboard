// src/app/api/graphs/prioritization-matrix/route.ts

import { createClient } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

// Define the pairs of poll indices (Importance, Feasibility)
const QUESTION_PAIRS = [
  { title: "Site-Specific Standards (Bioavailability)", importanceIndex: 0, feasibilityIndex: 1 },
  { title: "Matrix Standards (Ecosystem - Direct Toxicity)", importanceIndex: 2, feasibilityIndex: 3 },
  { title: "Matrix Standards (Human Health - Direct Toxicity)", importanceIndex: 4, feasibilityIndex: 5 },
  { title: "Matrix Standards (Ecosystem - Food-Related)", importanceIndex: 6, feasibilityIndex: 7 },
  { title: "Matrix Standards (Human Health - Food-Related)", importanceIndex: 8, feasibilityIndex: 9 },
];

export async function GET() {
  const supabase = createClient();

  try {
    // 1. CORRECTLY fetch votes from BOTH survey and CEW paths
    const { data: votes, error } = await supabase
      .from('poll_votes')
      .select(`
        user_id,
        option_index,
        polls!inner(poll_index)
      `)
      .in('polls.page_path', [
        '/survey-results/prioritization',
        '/cew-polls/prioritization'
      ]);

    if (error) throw error;

    // 2. Group all votes by user
    const votesByUser = new Map<string, Map<number, number>>();
    for (const vote of votes) {
      if (!votesByUser.has(vote.user_id)) {
        votesByUser.set(vote.user_id, new Map());
      }
      // The `option_index` is 0-4. The score is index + 1.
      votesByUser.get(vote.user_id)!.set((vote.polls as any).poll_index, vote.option_index + 1);
    }

    // 3. Process data for each defined pair
    const matrixData = QUESTION_PAIRS.map(pair => {
      const validPairedVotes = [];
      for (const userVotes of votesByUser.values()) {
        if (userVotes.has(pair.importanceIndex) && userVotes.has(pair.feasibilityIndex)) {
          // 4. CORRECTLY invert the scale (1->5, 2->4, ..., 5->1)
          const importanceScore = 6 - userVotes.get(pair.importanceIndex)!;
          const feasibilityScore = 6 - userVotes.get(pair.feasibilityIndex)!;
          validPairedVotes.push({ importanceScore, feasibilityScore });
        }
      }

      if (validPairedVotes.length === 0) {
        return { title: pair.title, avgImportance: 0, avgFeasibility: 0, responses: 0 };
      }

      const totalImportance = validPairedVotes.reduce((sum, v) => sum + v.importanceScore, 0);
      const totalFeasibility = validPairedVotes.reduce((sum, v) => sum + v.feasibilityScore, 0);

      return {
        title: pair.title,
        avgImportance: totalImportance / validPairedVotes.length,
        avgFeasibility: totalFeasibility / validPairedVotes.length,
        responses: validPairedVotes.length,
      };
    });

    return NextResponse.json(matrixData);

  } catch (error) {
    console.error('Graph data API error:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
