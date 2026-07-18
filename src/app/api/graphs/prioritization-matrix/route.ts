// src/app/api/graphs/prioritization-matrix/route.ts

import { NextResponse } from 'next/server';
import { createAnonymousClient, createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';
import { createHmac } from 'crypto';
import { logger } from '@/lib/logger';

// SECURITY (2026-07-13): the pseudonym salt MUST be a server-only secret.
// NEXT_PUBLIC_* env vars are bundled into client JS, so using one here would
// let an attacker who already knows a target user's UUID recompute the
// pseudonym locally and confirm that user's votes. MATRIX_PSEUDONYM_SALT is
// a dedicated server-only var (never NEXT_PUBLIC_-prefixed); set it in the
// deployment environment for stronger secret separation from other
// credentials. We fall back to SUPABASE_SERVICE_ROLE_KEY (which is always
// present in real deployments and never in source). If neither is present
// (e.g. local dev), we fail closed and return a fixed redacted string rather
// than exposing recomputable pseudonyms.

// Type definitions for API responses
interface VotingResult {
  option_index: number;
  votes: number;
}

interface PollResult {
  id?: string;
  poll_id?: string;
  page_path: string;
  poll_index: number;
  total_votes: number;
  results: VotingResult[];
}

interface EnrichedVote {
  user_id: string;
  option_index: number;
  voted_at: string;
  poll_id: string;
  poll?: PollMetadata;
}

interface PollMetadata {
  id: string;
  poll_index: number;
  page_path: string;
}

interface CachedMatrixData {
  data: EnhancedMatrixData[];
  timestamp: number;
}

interface UserVoteData {
  userType: 'authenticated' | 'cew';
  importance?: number;
  feasibility?: number;
  importanceVotes: Array<{ score: number; voted_at: string }>;
  feasibilityVotes: Array<{ score: number; voted_at: string }>;
}

// Helper function to combine results from CEW and survey-results paths
function combineResults(existingResults: VotingResult[], newResults: VotingResult[]): VotingResult[] {
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

// Cache storage with TTL (10 minutes for matrix data)
const MATRIX_CACHE_TTL_MS = 10 * 60 * 1000;
const matrixDataCache = new Map<string, CachedMatrixData>();

export async function GET(request: Request) {
  logger.debug('Matrix API called - starting prioritization matrix API');
  const supabase = await createAnonymousClient();

  // SECURITY (2026-07-11, tiers refined 2026-07-13): this route has both
  // public/anonymous consumers (CEW conference kiosk charts, always
  // filter=cew) and authenticated consumers (survey-results pages, gated by
  // middleware to any logged-in user; the admin poll-results page, gated to
  // admins at the page level). The route itself must not rely on page-level
  // gating -- it is a public HTTP endpoint. So the route determines its own
  // auth tier here:
  //   - "admin" tier (admin / matrix_admin role): individual vote rows for
  //     BOTH cew and authenticated users, including the RAW authenticated
  //     user_id -- needed for admin-only cross-referencing on the
  //     poll-results page.
  //   - "auth" tier (any other logged-in caller): individual vote rows for
  //     BOTH cew and authenticated users, but the authenticated user_id is
  //     PSEUDONYMIZED (see MATRIX_PSEUDONYM_SALT below) so a non-admin
  //     caller cannot use the raw UUID to identify or confirm another
  //     specific person's votes; the scatter-plot consumer only needs a
  //     stable per-user identifier, not the real UUID.
  //   - "public" tier (no session): aggregate stats + already-pseudonymized
  //     CEW individual vote rows only. Individual authenticated vote rows
  //     are never included at all.
  // The in-memory cache key and the HTTP Cache-Control header are BOTH tier
  // aware so a cached admin/authenticated-tier response (or a shared/CDN
  // HTTP cache) can never be replayed to a lower-privilege caller.
  const authClient = await createAuthenticatedClient();
  const requester = await getAuthenticatedUser(authClient);
  const isAuthenticated = !!requester;

  let isAdmin = false;
  if (requester) {
    try {
      const { data: role, error: roleError } = await authClient
        .from('user_roles')
        .select('role')
        .eq('user_id', requester.id)
        .in('role', ['admin', 'matrix_admin'])
        .limit(1)
        .maybeSingle();
      if (roleError) throw roleError;
      isAdmin = !!role;
    } catch (roleLookupError) {
      // Fail SAFE (not fail-open): a broken/erroring role lookup must never
      // grant admin-tier (raw user_id) access. Treat as non-admin so the
      // caller still gets a working, pseudonymized "auth" tier response
      // instead of the whole route throwing a 500.
      console.error('Error checking admin role for prioritization-matrix:', roleLookupError);
      isAdmin = false;
    }
  }

  const cacheTier = isAdmin ? 'admin' : (isAuthenticated ? 'auth' : 'public');
  const cacheControlHeader = isAuthenticated
    ? 'private, no-store'
    : 'public, max-age=600, s-maxage=600';

  // Get filter parameter from URL
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';
  const cacheKey = `matrix_${filter}_${cacheTier}`;
  logger.debug('Matrix API filter mode', { filter, cacheTier });

  // Check cache
  if (matrixDataCache.has(cacheKey)) {
    const cachedEntry = matrixDataCache.get(cacheKey)!;
    const cacheAge = Date.now() - cachedEntry.timestamp;

    if (cacheAge < MATRIX_CACHE_TTL_MS) {
      logger.debug('Matrix API cache hit', { filter, cacheTier, cacheAge });
      return NextResponse.json(cachedEntry.data, {
        headers: {
          'Cache-Control': cacheControlHeader,
          'X-Cache': 'HIT',
          'X-Cache-Age': `${cacheAge}ms`
        }
      });
    }
  }

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
    logger.debug('Initial poll results', {
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
    
    logger.debug('Filtered poll results', {
      filter,
      totalPolls: filteredPollResults.length,
      pollPaths: filteredPollResults.map(p => p.page_path),
      pollIndices: filteredPollResults.map(p => `${p.page_path}:${p.poll_index}`)
    });

    // 3. Group poll results by page path and poll index, combining CEW and survey data
    const pollsByPathAndIndex = new Map<string, Map<number, PollResult>>();
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
    logger.debug('Polls by path and index', {
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
          
          logger.debug('Using comprehensive poll IDs', {
            pairTitle: pair.title,
            importancePollIds,
            feasibilityPollIds,
            originalImportancePollId: importancePollId,
            originalFeasibilityPollId: feasibilityPollId
          });
        }

        // Debug: Log what polls we're querying
        logger.debug('Poll lookup', {
          pairTitle: pair.title,
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
        const userVotes = new Map<string, UserVoteData>();
        
        enrichedVotes?.forEach((vote: EnrichedVote) => {
          const userId = vote.user_id;
          const pollIndex = vote.poll?.poll_index; // Now using the enriched poll data
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
        logger.debug('Vote pairing debug', {
          pairTitle: pair.title,
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
        logger.debug('Final pairing results', {
          pairTitle: pair.title,
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
        logger.debug('Filtering individual pairs', {
          pairTitle: pair.title,
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

        logger.debug('Filtered pairs result', {
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
        const totalVotes = importancePoll.results.reduce((sum: number, result: VotingResult) => sum + result.votes, 0);
        if (totalVotes > 0) {
          const weightedSum = importancePoll.results.reduce((sum: number, result: VotingResult) =>
            sum + (result.votes * (result.option_index + 1)), 0);
          avgImportance = weightedSum / totalVotes; // Raw score (1-5 scale)
        }
      }

      // Calculate average feasibility score (1-5 scale, raw scores for frontend)
      let avgFeasibility = 0;
      if (feasibilityPoll.results && feasibilityPoll.results.length > 0) {
        const totalVotes = feasibilityPoll.results.reduce((sum: number, result: VotingResult) => sum + result.votes, 0);
        if (totalVotes > 0) {
          const weightedSum = feasibilityPoll.results.reduce((sum: number, result: VotingResult) =>
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

    // SECURITY: never return individual authenticated-vote rows (raw
    // user_id + that user's importance/feasibility scores) to an
    // unauthenticated caller. CEW individual pairs are already
    // pseudonymized (userId prefixed CEW2025_...) and are safe to keep in
    // the public tier; aggregate stats are never identity-bearing and are
    // identical across tiers. Fail closed: strip the whole row, not just
    // the userId field.
    const responseData: EnhancedMatrixData[] = matrixData.map(entry => ({
          ...entry,
          individualPairs: entry.individualPairs.map(pair => {
            if (pair.userType === 'authenticated' && !isAdmin) {
              const pseudonymSalt = process.env.MATRIX_PSEUDONYM_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY;
              
              // If we have no server-secret salt, fail closed: return a fixed, redacted 
              // placeholder (length > 8 so UI substring(0,8) doesn't crash) for all non-admin
              // users so no recomputable pseudonyms leak, collapsing all such votes to one label.
              // In a real deployment, MATRIX_PSEUDONYM_SALT or SUPABASE_SERVICE_ROLE_KEY will
              // be present to drive actual pseudonymization.
              if (!pseudonymSalt) {
                return { ...pair, userId: 'redacted-no-salt' };
              }

              const pseudoId = createHmac('sha256', pseudonymSalt).update(pair.userId).digest('hex');
              return { ...pair, userId: pseudoId };
            }
            return pair;
          }).filter(pair => isAuthenticated || pair.userType !== 'authenticated'),
        }));

    // Store in cache (tier-scoped key -- see cacheKey construction above)
    matrixDataCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': cacheControlHeader,
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('Graph data API error:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
