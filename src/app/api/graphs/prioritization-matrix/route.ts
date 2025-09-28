// src/app/api/graphs/prioritization-matrix/route.ts

import { createClient } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

// Helper function to combine results from CEW and survey-results paths
function combineResults(existingResults: any[], newResults: any[]): any[] {
  const combined = [...existingResults];
  
  for (const newResult of newResults) {
    const existingIndex = combined.findIndex(r => r.option_index === newResult.option_index);
    if (existingIndex >= 0) {
      // Combine votes for the same option
      combined[existingIndex].votes += newResult.votes;
    } else {
      // Add new option
      combined.push(newResult);
    }
  }
  
  return combined;
}

// Define the pairs of poll indices (Importance, Feasibility)
const QUESTION_PAIRS = [
  // Prioritization: Q0-Q1 (Site-Specific Standards)
  { title: "Site-Specific Standards (Bioavailability)", importanceIndex: 0, feasibilityIndex: 1, pagePath: 'prioritization' },
  
  // Holistic Protection: Matrix Standards - based on CEW page structure
  // Pairs are: Q1+Q2 (poll_index 0+1), Q3+Q4 (poll_index 2+3), Q5+Q6 (poll_index 4+5), Q7+Q8 (poll_index 6+7)
  { title: "Matrix Standards (Ecosystem Health - Direct Toxicity)", importanceIndex: 0, feasibilityIndex: 1, pagePath: 'holistic-protection' },
  { title: "Matrix Standards (Human Health - Direct Toxicity)", importanceIndex: 2, feasibilityIndex: 3, pagePath: 'holistic-protection' },
  { title: "Matrix Standards (Ecosystem Health - Food-Related)", importanceIndex: 4, feasibilityIndex: 5, pagePath: 'holistic-protection' },
  { title: "Matrix Standards (Human Health - Food-Related)", importanceIndex: 6, feasibilityIndex: 7, pagePath: 'holistic-protection' },
];

export async function GET(request: Request) {
  const supabase = createClient();
  
  // Get filter parameter from URL
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';

  try {
    // 1. Fetch poll results from BOTH survey and CEW paths
    const { data: pollResults, error } = await supabase
      .from('poll_results')
      .select('*')
      .in('page_path', [
        '/survey-results/prioritization',
        '/cew-polls/prioritization',
        '/survey-results/holistic-protection',
        '/cew-polls/holistic-protection'
      ]);

    if (error) throw error;

    // 2. Filter poll results based on filter parameter
    let filteredPollResults = pollResults;
    if (filter === 'twg') {
      // Only survey-results data
      filteredPollResults = pollResults.filter(poll => poll.page_path.startsWith('/survey-results'));
    } else if (filter === 'cew') {
      // Only CEW data
      filteredPollResults = pollResults.filter(poll => poll.page_path.startsWith('/cew-polls'));
    }
    // 'all' filter keeps all data

    // 3. Group poll results by page path and poll index, combining CEW and survey data
    const pollsByPathAndIndex = new Map<string, Map<number, any>>();
    for (const poll of filteredPollResults) {
      const pagePath = poll.page_path.includes('prioritization') ? 'prioritization' : 'holistic-protection';
      
      if (!pollsByPathAndIndex.has(pagePath)) {
        pollsByPathAndIndex.set(pagePath, new Map());
      }
      
      const existingPoll = pollsByPathAndIndex.get(pagePath)!.get(poll.poll_index);
      if (existingPoll) {
        // Combine data from both CEW and survey-results paths
        const combinedPoll = {
          ...poll,
          total_votes: (existingPoll.total_votes || 0) + (poll.total_votes || 0),
          results: combineResults(existingPoll.results || [], poll.results || [])
        };
        pollsByPathAndIndex.get(pagePath)!.set(poll.poll_index, combinedPoll);
      } else {
        pollsByPathAndIndex.get(pagePath)!.set(poll.poll_index, poll);
      }
    }

    // 4. Process data for each defined pair
    const matrixData = QUESTION_PAIRS.map(pair => {
      const pagePolls = pollsByPathAndIndex.get(pair.pagePath);
      if (!pagePolls) {
        return { title: pair.title, avgImportance: 0, avgFeasibility: 0, responses: 0 };
      }

      const importancePoll = pagePolls.get(pair.importanceIndex);
      const feasibilityPoll = pagePolls.get(pair.feasibilityIndex);

      if (!importancePoll || !feasibilityPoll) {
        return { title: pair.title, avgImportance: 0, avgFeasibility: 0, responses: 0 };
      }

      // Calculate average importance score (1-5 scale, inverted for display)
      let avgImportance = 0;
      if (importancePoll.results && importancePoll.results.length > 0) {
        const totalVotes = importancePoll.results.reduce((sum: number, result: any) => sum + result.votes, 0);
        if (totalVotes > 0) {
          const weightedSum = importancePoll.results.reduce((sum: number, result: any) => 
            sum + (result.votes * (result.option_index + 1)), 0);
          avgImportance = 6 - (weightedSum / totalVotes); // Invert scale (1->5, 2->4, etc.)
        }
      }

      // Calculate average feasibility score (1-5 scale, inverted for display)
      let avgFeasibility = 0;
      if (feasibilityPoll.results && feasibilityPoll.results.length > 0) {
        const totalVotes = feasibilityPoll.results.reduce((sum: number, result: any) => sum + result.votes, 0);
        if (totalVotes > 0) {
          const weightedSum = feasibilityPoll.results.reduce((sum: number, result: any) => 
            sum + (result.votes * (result.option_index + 1)), 0);
          avgFeasibility = 6 - (weightedSum / totalVotes); // Invert scale (1->5, 2->4, etc.)
        }
      }

      // Use the total votes from either poll as response count
      const responses = Math.max(importancePoll.total_votes || 0, feasibilityPoll.total_votes || 0);

      // Debug logging for holistic protection
      if (pair.pagePath === 'holistic-protection') {
        console.log(`🔍 Matrix data for ${pair.title}:`, {
          importanceIndex: pair.importanceIndex,
          feasibilityIndex: pair.feasibilityIndex,
          importancePoll: {
            total_votes: importancePoll.total_votes,
            results: importancePoll.results?.length || 0
          },
          feasibilityPoll: {
            total_votes: feasibilityPoll.total_votes,
            results: feasibilityPoll.results?.length || 0
          },
          avgImportance,
          avgFeasibility,
          responses
        });
      }

      return {
        title: pair.title,
        avgImportance,
        avgFeasibility,
        responses,
      };
    });

    return NextResponse.json(matrixData);

  } catch (error) {
    console.error('Graph data API error:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
