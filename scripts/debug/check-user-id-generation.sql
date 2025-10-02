-- ============================================================================
-- USER ID GENERATION INSPECTION SCRIPT
-- Purpose: Check how user IDs are actually being generated and stored
-- ============================================================================

-- 1. USER ID PATTERN ANALYSIS
-- ============================================================================
SELECT 
  'User ID Pattern Analysis' as section,
  CASE 
    WHEN user_id LIKE 'CEW2025_CEW2025-%' THEN 'CEW Session Pattern'
    WHEN user_id LIKE 'CEW2025_session_%' THEN 'CEW Fallback Pattern'
    WHEN user_id LIKE '%_%_%_%_%' THEN 'Complex Multi-Part ID'
    WHEN user_id LIKE '%_%_%_%' THEN 'Four-Part ID'
    WHEN user_id LIKE '%_%_%' THEN 'Three-Part ID'
    WHEN user_id LIKE '%_%' THEN 'Two-Part ID'
    ELSE 'Simple ID'
  END as id_pattern,
  COUNT(*) as vote_count,
  COUNT(DISTINCT user_id) as unique_users,
  STRING_AGG(DISTINCT user_id, ', ' ORDER BY user_id) as sample_ids
FROM poll_votes
WHERE voted_at >= NOW() - INTERVAL '1 hour'
GROUP BY 
  CASE 
    WHEN user_id LIKE 'CEW2025_CEW2025-%' THEN 'CEW Session Pattern'
    WHEN user_id LIKE 'CEW2025_session_%' THEN 'CEW Fallback Pattern'
    WHEN user_id LIKE '%_%_%_%_%' THEN 'Complex Multi-Part ID'
    WHEN user_id LIKE '%_%_%_%' THEN 'Four-Part ID'
    WHEN user_id LIKE '%_%_%' THEN 'Three-Part ID'
    WHEN user_id LIKE '%_%' THEN 'Two-Part ID'
    ELSE 'Simple ID'
  END
ORDER BY vote_count DESC;

-- 2. BREAKDOWN OF CEW USER ID COMPONENTS
-- ============================================================================
WITH cew_user_analysis AS (
  SELECT 
    user_id,
    -- Extract components from CEW2025_CEW2025-VU-ITERATION-TIMESTAMP-RANDOM format
    CASE 
      WHEN user_id ~ '^CEW2025_CEW2025-(\d+)-(\d+)-(\d+)-([a-z0-9]+)$' THEN
        SPLIT_PART(SPLIT_PART(user_id, '_', 2), '-', 1) -- VU number
      ELSE NULL
    END as vu_number,
    CASE 
      WHEN user_id ~ '^CEW2025_CEW2025-(\d+)-(\d+)-(\d+)-([a-z0-9]+)$' THEN
        SPLIT_PART(SPLIT_PART(user_id, '_', 2), '-', 2) -- Iteration number
      ELSE NULL
    END as iteration_number,
    CASE 
      WHEN user_id ~ '^CEW2025_CEW2025-(\d+)-(\d+)-(\d+)-([a-z0-9]+)$' THEN
        SPLIT_PART(SPLIT_PART(user_id, '_', 2), '-', 3) -- Timestamp
      ELSE NULL
    END as timestamp_part,
    CASE 
      WHEN user_id ~ '^CEW2025_CEW2025-(\d+)-(\d+)-(\d+)-([a-z0-9]+)$' THEN
        SPLIT_PART(SPLIT_PART(user_id, '_', 2), '-', 4) -- Random suffix
      ELSE NULL
    END as random_suffix,
    COUNT(*) as vote_count
  FROM poll_votes
  WHERE user_id LIKE 'CEW2025_%'
    AND voted_at >= NOW() - INTERVAL '1 hour'
  GROUP BY user_id
)
SELECT 
  'CEW User ID Component Analysis' as section,
  vu_number,
  iteration_number,
  COUNT(*) as unique_users,
  SUM(vote_count) as total_votes,
  STRING_AGG(DISTINCT timestamp_part, ', ' ORDER BY timestamp_part LIMIT 3) as sample_timestamps,
  STRING_AGG(DISTINCT random_suffix, ', ' ORDER BY random_suffix LIMIT 3) as sample_suffixes
FROM cew_user_analysis
WHERE vu_number IS NOT NULL
GROUP BY vu_number, iteration_number
ORDER BY vu_number::INTEGER, iteration_number::INTEGER;

-- 3. CHECK FOR USER ID CONSISTENCY ACROSS VOTES
-- ============================================================================
SELECT 
  'User ID Consistency Check' as section,
  user_id,
  COUNT(DISTINCT DATE_TRUNC('second', voted_at)) as unique_vote_seconds,
  MIN(voted_at) as first_vote,
  MAX(voted_at) as last_vote,
  COUNT(*) as total_votes,
  STRING_AGG(DISTINCT CAST(option_index + 1 AS TEXT), ', ' ORDER BY CAST(option_index + 1 AS TEXT)) as scores_voted
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE user_id LIKE 'CEW2025_%'
  AND voted_at >= NOW() - INTERVAL '1 hour'
  AND p.page_path IN ('/cew-polls/holistic-protection', '/cew-polls/prioritization')
GROUP BY user_id
ORDER BY total_votes DESC, user_id
LIMIT 20;

-- 4. VOTE SUBMISSION PATTERNS BY USER
-- ============================================================================
SELECT 
  'Vote Submission Patterns' as section,
  user_id,
  p.page_path,
  p.poll_index,
  COUNT(*) as votes_for_this_question,
  STRING_AGG(CAST(option_index + 1 AS TEXT), ', ' ORDER BY voted_at) as score_sequence,
  MIN(voted_at) as first_vote_time,
  MAX(voted_at) as last_vote_time,
  EXTRACT(EPOCH FROM (MAX(voted_at) - MIN(voted_at))) as seconds_span
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE user_id LIKE 'CEW2025_%'
  AND voted_at >= NOW() - INTERVAL '1 hour'
  AND p.page_path IN ('/cew-polls/holistic-protection', '/cew-polls/prioritization')
GROUP BY user_id, p.page_path, p.poll_index
HAVING COUNT(*) > 1
ORDER BY user_id, p.page_path, p.poll_index
LIMIT 25;

-- 5. CHECK FOR CROSS-POLL VOTE PAIRING POTENTIAL
-- ============================================================================
WITH user_poll_votes AS (
  SELECT 
    pv.user_id,
    p.page_path,
    p.poll_index,
    COUNT(*) as vote_count,
    STRING_AGG(CAST(pv.option_index + 1 AS TEXT), ', ' ORDER BY pv.voted_at) as scores
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE pv.user_id LIKE 'CEW2025_%'
    AND pv.voted_at >= NOW() - INTERVAL '1 hour'
    AND p.page_path IN ('/cew-polls/holistic-protection', '/cew-polls/prioritization')
  GROUP BY pv.user_id, p.page_path, p.poll_index
)
SELECT 
  'Cross-Poll Vote Pairing Potential' as section,
  upv1.user_id,
  upv1.page_path,
  upv1.poll_index as importance_poll,
  upv1.vote_count as importance_votes,
  upv1.scores as importance_scores,
  upv2.poll_index as feasibility_poll,
  upv2.vote_count as feasibility_votes,
  upv2.scores as feasibility_scores,
  -- Calculate potential combinations
  upv1.vote_count * upv2.vote_count as potential_combinations
FROM user_poll_votes upv1
JOIN user_poll_votes upv2 ON upv1.user_id = upv2.user_id 
  AND upv1.page_path = upv2.page_path
  AND upv2.poll_index = upv1.poll_index + 1  -- Feasibility is always poll_index + 1
WHERE upv1.poll_index IN (0, 2, 4, 6)  -- Importance questions
  AND upv1.vote_count > 0 
  AND upv2.vote_count > 0
ORDER BY potential_combinations DESC, upv1.user_id, upv1.poll_index
LIMIT 15;
