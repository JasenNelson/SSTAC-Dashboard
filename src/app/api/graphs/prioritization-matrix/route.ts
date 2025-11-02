// src/app/api/graphs/prioritization-matrix/route.ts

import { NextResponse } from 'next/server';
import { createAnonymousClient } from '@/lib/supabase-auth';

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
  const supabase = await createAnonymousClient();
  
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
    console.log('🔍 Initial poll results:', {
      filter,
      totalPolls: pollResults.length,
      pollPaths: pollResults.map(p => p.page_path),
      pollIndices: pollResults.map(p => `${p.page_path}:${p.poll_index}`)
    });
    
    if (filter === 'twg') {
      // Only survey-results data
      filteredPollResults = pollResults.filter(poll => poll.page_path.startsWith('/survey-results'));
    } else if (filter === 'cew') {
      // Only CEW data
      filteredPollResults = pollResults.filter(poll => poll.page_path.startsWith('/cew-polls'));
    }
    // 'all' filter keeps all data
    
    console.log('🔍 Filtered poll results:', {
      filter,
      totalPolls: filteredPollResults.length,
      pollPaths: filteredPollResults.map(p => p.page_path),
      pollIndices: filteredPollResults.map(p => `${p.page_path}:${p.poll_index}`)
    });

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
    
    // Debug: Log what's in the pollsByPathAndIndex map
    console.log('🔍 Polls by path and index:', {
      prioritization: Array.from(pollsByPathAndIndex.get('prioritization')?.entries() || []),
      holisticProtection: Array.from(pollsByPathAndIndex.get('holistic-protection')?.entries() || [])
    });
    
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

        // Get both CEW and survey-results poll IDs for comprehensive vote lookup
        const actualImportancePollId = importancePollId;
        const actualFeasibilityPollId = feasibilityPollId;
        let importancePollIds: string[] = [];
        let feasibilityPollIds: string[] = [];
        
        // For holistic-protection and prioritization questions, get both CEW and survey-results poll IDs
        if (pair.pagePath === 'holistic-protection' || pair.pagePath === 'prioritization') {
          // Get CEW poll IDs
          const { data: cewImportancePoll } = await supabase
            .from('polls')
            .select('id')
            .eq('page_path', `/cew-polls/${pair.pagePath}`)
            .eq('poll_index', pair.importanceIndex)
            .single();
            
          const { data: cewFeasibilityPoll } = await supabase
            .from('polls')
            .select('id')
            .eq('page_path', `/cew-polls/${pair.pagePath}`)
            .eq('poll_index', pair.feasibilityIndex)
            .single();
            
          // Get survey-results poll IDs
          const { data: surveyImportancePoll } = await supabase
            .from('polls')
            .select('id')
            .eq('page_path', `/survey-results/${pair.pagePath}`)
            .eq('poll_index', pair.importanceIndex)
            .single();
            
          const { data: surveyFeasibilityPoll } = await supabase
            .from('polls')
            .select('id')
            .eq('page_path', `/survey-results/${pair.pagePath}`)
            .eq('poll_index', pair.feasibilityIndex)
            .single();
            
          // Use both poll IDs for comprehensive vote lookup
          importancePollIds = [cewImportancePoll?.id, surveyImportancePoll?.id].filter(Boolean) as string[];
          feasibilityPollIds = [cewFeasibilityPoll?.id, surveyFeasibilityPoll?.id].filter(Boolean) as string[];
          
          console.log(`🔄 Using comprehensive poll IDs for ${pair.title}:`, {
            importancePollIds,
            feasibilityPollIds,
            originalImportancePollId: importancePollId,
            originalFeasibilityPollId: feasibilityPollId
          });
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
        let pollIdsToQuery = [actualImportancePollId, actualFeasibilityPollId];
        
        // For holistic-protection and prioritization, use both CEW and survey-results poll IDs
        if (pair.pagePath === 'holistic-protection' || pair.pagePath === 'prioritization') {
          pollIdsToQuery = [...importancePollIds, ...feasibilityPollIds];
        }
        
        const { data: individualVotes, error: votesError } = await supabase
          .from('poll_votes')
          .select('user_id, option_index, voted_at, poll_id')
          .in('poll_id', pollIdsToQuery);

        if (votesError) {
          console.error(`Error fetching individual votes for ${pair.title}:`, votesError);
          continue;
        }

        // STEP 2: Get poll metadata separately
        const { data: polls, error: pollsError } = await supabase
          .from('polls')
          .select('id, poll_index, page_path')
          .in('id', pollIdsToQuery);

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



        // Group votes by user_id - for CEW polls, allow multiple votes per user
        // For authenticated users, use last vote per user per question
        const userVotes = new Map<string, { 
          userType: string; 
          importance?: number; 
          feasibility?: number;
          importanceVotes: Array<{score: number, voted_at: string}>; // Track all votes for CEW
          feasibilityVotes: Array<{score: number, voted_at: string}>; // Track all votes for CEW
        }>();
        
        enrichedVotes?.forEach((vote: any) => {
          const userId = vote.user_id;
          const pollIndex = vote.poll.poll_index; // Now using the enriched poll data
          const score = vote.option_index + 1; // Convert 0-based to 1-based
          const userType = vote.user_id.startsWith('CEW2025') ? 'cew' : 'authenticated';
          
          if (!userVotes.has(userId)) {
            userVotes.set(userId, { 
              userType,
              importanceVotes: [],
              feasibilityVotes: []
            });
          }
          
          const userData = userVotes.get(userId)!;
          if (pollIndex === pair.importanceIndex) {
            if (userType === 'cew') {
              // For CEW users, track all votes
              userData.importanceVotes.push({ score, voted_at: vote.voted_at });
            } else {
              // For authenticated users, use last vote only
              userData.importance = score;
            }
          } else if (pollIndex === pair.feasibilityIndex) {
            if (userType === 'cew') {
              // For CEW users, track all votes
              userData.feasibilityVotes.push({ score, voted_at: vote.voted_at });
            } else {
              // For authenticated users, use last vote only
              userData.feasibility = score;
            }
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
          if (data.userType === 'cew') {
            // For CEW users, create pairs based on chronological vote submissions
            // Sort votes by timestamp to maintain chronological order
            const sortedImportanceVotes = data.importanceVotes.sort((a, b) => 
              new Date(a.voted_at).getTime() - new Date(b.voted_at).getTime()
            );
            const sortedFeasibilityVotes = data.feasibilityVotes.sort((a, b) => 
              new Date(a.voted_at).getTime() - new Date(b.voted_at).getTime()
            );
            
            // Create pairs based on chronological voting sessions
            // Each data point represents one voting session (one importance + one feasibility vote)
            const maxResponses = Math.max(sortedImportanceVotes.length, sortedFeasibilityVotes.length);
            for (let i = 0; i < maxResponses; i++) {
              const impVote = sortedImportanceVotes[i];
              const feasVote = sortedFeasibilityVotes[i];
              
              if (impVote && feasVote) {
                individualPairs.push({
                  userId: `${userId}_session_${i}`, // Unique ID for each voting session
                  importance: impVote.score,
                  feasibility: feasVote.score,
                  userType: data.userType as 'authenticated' | 'cew'
                });
              }
            }
          } else {
            // For authenticated users, use the traditional single pair approach
            if (data.importance !== undefined && data.feasibility !== undefined) {
              individualPairs.push({
                userId,
                importance: data.importance,
                feasibility: data.feasibility,
                userType: data.userType as 'authenticated' | 'cew'
              });
            }
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
        console.log(`🔍 Filtering individual pairs for ${pair.title}:`, {
          filter,
          totalPairs: individualPairs.length,
          userTypes: individualPairs.map(p => p.userType),
          samplePairs: individualPairs.slice(0, 2)
        });
        
        if (filter === 'twg') {
          filteredPairs = individualPairs.filter(pair => pair.userType === 'authenticated');
        } else if (filter === 'cew') {
          filteredPairs = individualPairs.filter(pair => pair.userType === 'cew');
        }
        // For 'all' filter, keep all pairs (no filtering needed)
        
        console.log(`🔍 Filtered pairs result:`, {
          filter,
          filteredCount: filteredPairs.length,
          sampleFiltered: filteredPairs.slice(0, 2)
        });

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
