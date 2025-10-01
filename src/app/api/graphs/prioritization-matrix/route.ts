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

// Enhanced interface for matrix data with individual vote pairs
interface IndividualVotePair {
  userId: string;
  importance: number;
  feasibility: number;
  userType: 'authenticated' | 'cew';
}

interface EnhancedMatrixData {
  title: string;
  avgImportance: number;
  avgFeasibility: number;
  responses: number;
  individualPairs: IndividualVotePair[];
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
  console.log('🚀 MATRIX API CALLED - Starting prioritization matrix API');
  const supabase = createClient();
  
  // Get filter parameter from URL
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';
  console.log(`🚀 MATRIX API - Filter mode: ${filter}`);

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

    // 4. Fetch individual vote pairs for each question pair
    const individualVotesData = new Map<string, IndividualVotePair[]>();
    
    for (const pair of QUESTION_PAIRS) {
      try {
        // Get poll IDs for importance and feasibility questions
        const pagePolls = pollsByPathAndIndex.get(pair.pagePath);
        if (!pagePolls) continue;
        
        const importancePoll = pagePolls.get(pair.importanceIndex);
        const feasibilityPoll = pagePolls.get(pair.feasibilityIndex);
        
        if (!importancePoll || !feasibilityPoll) continue;

        
        // Use poll_id if id is undefined (fallback for different data structures)
        const importancePollId = importancePoll.id || importancePoll.poll_id;
        const feasibilityPollId = feasibilityPoll.id || feasibilityPoll.poll_id;
        
        if (!importancePollId || !feasibilityPollId) {
          console.error(`Missing poll IDs for ${pair.title}:`, {
            importancePollId,
            feasibilityPollId,
            importancePoll,
            feasibilityPoll
          });
          continue;
        }

        // CRITICAL FIX: For individual vote lookup, we need to use poll IDs that actually contain votes
        // The combined data might give us survey-results poll IDs which have no individual votes.
        // For now, prioritize CEW polls since they contain the actual votes.
        let actualImportancePollId = importancePollId;
        let actualFeasibilityPollId = feasibilityPollId;
        
        // For holistic-protection questions, check if we should use CEW poll IDs for individual vote lookup
        if (pair.pagePath === 'holistic-protection') {
          // Get CEW poll IDs directly from database
          const { data: cewImportancePoll } = await supabase
            .from('polls')
            .select('id')
            .eq('page_path', '/cew-polls/holistic-protection')
            .eq('poll_index', pair.importanceIndex)
            .single();
            
          const { data: cewFeasibilityPoll } = await supabase
            .from('polls')
            .select('id')
            .eq('page_path', '/cew-polls/holistic-protection')
            .eq('poll_index', pair.feasibilityIndex)
            .single();
            
          if (cewImportancePoll?.id) {
            actualImportancePollId = cewImportancePoll.id;
            console.log(`🔄 Using CEW importance poll ID: ${actualImportancePollId} instead of ${importancePollId}`);
          }
          
          if (cewFeasibilityPoll?.id) {
            actualFeasibilityPollId = cewFeasibilityPoll.id;
            console.log(`🔄 Using CEW feasibility poll ID: ${actualFeasibilityPollId} instead of ${feasibilityPollId}`);
          }
        }

        // Debug: Log what polls we're querying
        console.log(`🔍 Poll lookup for ${pair.title}:`, {
          importanceIndex: pair.importanceIndex,
          feasibilityIndex: pair.feasibilityIndex,
          originalImportancePollId: importancePollId,
          originalFeasibilityPollId: feasibilityPollId,
          actualImportancePollId,
          actualFeasibilityPollId,
          importancePoll: importancePoll,
          feasibilityPoll: feasibilityPoll
        });

        // STEP 1: Get votes with simple query (no JOIN to test if basic data works)
        const { data: individualVotes, error: votesError } = await supabase
          .from('poll_votes')
          .select('user_id, option_index, voted_at, poll_id')
          .in('poll_id', [actualImportancePollId, actualFeasibilityPollId]);

        if (votesError) {
          console.error(`Error fetching individual votes for ${pair.title}:`, votesError);
          continue;
        }

        // STEP 2: Get poll metadata separately
        const { data: polls, error: pollsError } = await supabase
          .from('polls')
          .select('id, poll_index, page_path')
          .in('id', [actualImportancePollId, actualFeasibilityPollId]);

        if (pollsError) {
          console.error(`Error fetching poll metadata for ${pair.title}:`, pollsError);
          continue;
        }

        // STEP 3: Create poll map for manual combination
        const pollMap = new Map(polls.map(p => [p.id, p]));
        
        // STEP 4: Enrich votes with poll metadata and filter by poll_index
        const enrichedVotes = individualVotes
          ?.map(vote => ({
            ...vote,
            poll: pollMap.get(vote.poll_id)
          }))
          ?.filter(vote => vote.poll && [pair.importanceIndex, pair.feasibilityIndex].includes(vote.poll.poll_index));



        // Group votes by user_id - use last vote per user per question
        const userVotes = new Map<string, { 
          userType: string; 
          importance?: number; 
          feasibility?: number;
        }>();
        
        enrichedVotes?.forEach((vote: any) => {
          const userId = vote.user_id;
          const pollIndex = vote.poll.poll_index; // Now using the enriched poll data
          const score = vote.option_index + 1; // Convert 0-based to 1-based
          const userType = vote.user_id.startsWith('CEW2025') ? 'cew' : 'authenticated';
          
          if (!userVotes.has(userId)) {
            userVotes.set(userId, { userType });
          }
          
          const userData = userVotes.get(userId)!;
          if (pollIndex === pair.importanceIndex) {
            userData.importance = score; // This will be the last vote for this question
          } else if (pollIndex === pair.feasibilityIndex) {
            userData.feasibility = score; // This will be the last vote for this question
          }
        });

        // Debug: Log vote pairing results
        console.log(`🔍 Vote pairing debug for ${pair.title}:`, {
          totalVotesFound: individualVotes?.length || 0,
          enrichedVotesFound: enrichedVotes?.length || 0,
          uniqueUsers: userVotes.size,
          pairsCreated: 0, // Will be calculated below
          sampleVotes: enrichedVotes?.slice(0, 3).map(v => ({
            user_id: v.user_id,
            poll_index: v.poll?.poll_index,
            poll_id: v.poll_id,
            page_path: v.poll?.page_path,
            score: v.option_index + 1,
            voted_at: v.voted_at
          })),
          pollIds: {
            actualImportancePollId,
            actualFeasibilityPollId,
            pollsFound: polls?.length || 0
          }
        });

        // Create individual pairs for users who voted on both questions
        const individualPairs: IndividualVotePair[] = [];
        userVotes.forEach((data, userId) => {
          if (data.importance !== undefined && data.feasibility !== undefined) {
            individualPairs.push({
              userId,
              importance: data.importance,
              feasibility: data.feasibility,
              userType: data.userType as 'authenticated' | 'cew'
            });
          }
        });

        // Update debug info with actual pairs created
        console.log(`🔍 Final pairing results for ${pair.title}:`, {
          totalVotesFound: individualVotes?.length || 0,
          enrichedVotesFound: enrichedVotes?.length || 0,
          uniqueUsers: userVotes.size,
          pairsCreated: individualPairs.length,
          samplePairs: individualPairs.slice(0, 3).map(pair => ({
            userId: pair.userId,
            importance: pair.importance,
            feasibility: pair.feasibility,
            userType: pair.userType
          })),
          pollIds: {
            actualImportancePollId,
            actualFeasibilityPollId,
            pollsFound: polls?.length || 0
          }
        });


        // Apply filter to individual pairs
        let filteredPairs = individualPairs;
        if (filter === 'twg') {
          filteredPairs = individualPairs.filter(pair => pair.userType === 'authenticated');
        } else if (filter === 'cew') {
          filteredPairs = individualPairs.filter(pair => pair.userType === 'cew');
        }

        individualVotesData.set(pair.title, filteredPairs);

      } catch (error) {
        console.error(`Error processing individual votes for ${pair.title}:`, error);
        individualVotesData.set(pair.title, []);
      }
    }

    // 5. Process data for each defined pair
    const matrixData: EnhancedMatrixData[] = QUESTION_PAIRS.map(pair => {
      const pagePolls = pollsByPathAndIndex.get(pair.pagePath);
      if (!pagePolls) {
        return { 
          title: pair.title, 
          avgImportance: 0, 
          avgFeasibility: 0, 
          responses: 0,
          individualPairs: []
        };
      }

      const importancePoll = pagePolls.get(pair.importanceIndex);
      const feasibilityPoll = pagePolls.get(pair.feasibilityIndex);

      if (!importancePoll || !feasibilityPoll) {
        return { 
          title: pair.title, 
          avgImportance: 0, 
          avgFeasibility: 0, 
          responses: 0,
          individualPairs: []
        };
      }

      // Calculate average importance score (1-5 scale, raw scores for frontend)
      let avgImportance = 0;
      if (importancePoll.results && importancePoll.results.length > 0) {
        const totalVotes = importancePoll.results.reduce((sum: number, result: any) => sum + result.votes, 0);
        if (totalVotes > 0) {
          const weightedSum = importancePoll.results.reduce((sum: number, result: any) => 
            sum + (result.votes * (result.option_index + 1)), 0);
          avgImportance = weightedSum / totalVotes; // Raw score (1-5 scale)
        }
      }

      // Calculate average feasibility score (1-5 scale, raw scores for frontend)
      let avgFeasibility = 0;
      if (feasibilityPoll.results && feasibilityPoll.results.length > 0) {
        const totalVotes = feasibilityPoll.results.reduce((sum: number, result: any) => sum + result.votes, 0);
        if (totalVotes > 0) {
          const weightedSum = feasibilityPoll.results.reduce((sum: number, result: any) => 
            sum + (result.votes * (result.option_index + 1)), 0);
          avgFeasibility = weightedSum / totalVotes; // Raw score (1-5 scale)
        }
      }

      // Use the total votes from either poll as response count
      const responses = Math.max(importancePoll.total_votes || 0, feasibilityPoll.total_votes || 0);

      // Get individual pairs for this question pair
      const individualPairs = individualVotesData.get(pair.title) || [];


      return {
        title: pair.title,
        avgImportance,
        avgFeasibility,
        responses,
        individualPairs,
      };
    });

    return NextResponse.json(matrixData);

  } catch (error) {
    console.error('Graph data API error:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
