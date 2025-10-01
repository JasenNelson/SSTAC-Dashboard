-- ============================================================================
-- INVESTIGATE MATRIX GRAPH CLUSTERING DISCREPANCY
-- ============================================================================
-- Purpose: Understand why 15 paired responses show as only 8 individual data points
-- Matrix: "Matrix Standards (Ecosystem Health - Direct Toxicity)"
-- Questions: Q1 (poll_index 0) + Q2 (poll_index 1) - both importance and feasibility
-- ============================================================================

-- Step 1: Get all individual vote pairs for this matrix
WITH individual_votes AS (
  SELECT 
    pv1.user_id,
    pv1.option_index + 1 as importance_score,  -- Q1: importance (poll_index 0)
    pv2.option_index + 1 as feasibility_score  -- Q2: feasibility (poll_index 1)
  FROM poll_votes pv1
  JOIN polls p1 ON pv1.poll_id = p1.id
  JOIN poll_votes pv2 ON pv2.user_id = pv1.user_id
  JOIN polls p2 ON pv2.poll_id = p2.id
  WHERE p1.page_path = '/cew-polls/holistic-protection'
    AND p1.poll_index = 0  -- Importance question
    AND p2.page_path = '/cew-polls/holistic-protection'
    AND p2.poll_index = 1  -- Feasibility question
    AND pv1.voted_at = (
      SELECT MAX(pv3.voted_at) 
      FROM poll_votes pv3 
      WHERE pv3.poll_id = pv1.poll_id AND pv3.user_id = pv1.user_id
    )
    AND pv2.voted_at = (
      SELECT MAX(pv4.voted_at) 
      FROM poll_votes pv4 
      WHERE pv4.poll_id = pv2.poll_id AND pv4.user_id = pv2.user_id
    )
)
-- Step 2: Count responses by coordinate (importance, feasibility)
SELECT 
  importance_score,
  feasibility_score,
  COUNT(*) as response_count,
  ARRAY_AGG(user_id ORDER BY user_id) as user_ids
FROM individual_votes
GROUP BY importance_score, feasibility_score
ORDER BY response_count DESC, importance_score, feasibility_score;

-- Step 3: Summary statistics
WITH individual_votes AS (
  SELECT 
    pv1.user_id,
    pv1.option_index + 1 as importance_score,
    pv2.option_index + 1 as feasibility_score
  FROM poll_votes pv1
  JOIN polls p1 ON pv1.poll_id = p1.id
  JOIN poll_votes pv2 ON pv2.user_id = pv1.user_id
  JOIN polls p2 ON pv2.poll_id = p2.id
  WHERE p1.page_path = '/cew-polls/holistic-protection'
    AND p1.poll_index = 0
    AND p2.page_path = '/cew-polls/holistic-protection'
    AND p2.poll_index = 1
    AND pv1.voted_at = (
      SELECT MAX(pv3.voted_at) 
      FROM poll_votes pv3 
      WHERE pv3.poll_id = pv1.poll_id AND pv3.user_id = pv1.user_id
    )
    AND pv2.voted_at = (
      SELECT MAX(pv4.voted_at) 
      FROM poll_votes pv4 
      WHERE pv4.poll_id = pv2.poll_id AND pv4.user_id = pv2.user_id
    )
),
coordinate_counts AS (
  SELECT 
    importance_score,
    feasibility_score,
    COUNT(*) as response_count
  FROM individual_votes
  GROUP BY importance_score, feasibility_score
)
SELECT 
  'Summary' as metric,
  COUNT(*) as total_paired_responses,
  (SELECT COUNT(*) FROM coordinate_counts) as unique_coordinates,
  SUM(response_count) as total_responses_verified,
  MAX(response_count) as max_cluster_size,
  MIN(response_count) as min_cluster_size,
  AVG(response_count::numeric) as avg_responses_per_coordinate
FROM coordinate_counts;

-- Step 4: Check for any data filtering issues
SELECT 
  'Data Integrity Check' as check_type,
  COUNT(DISTINCT pv1.user_id) as users_with_importance_votes,
  COUNT(DISTINCT pv2.user_id) as users_with_feasibility_votes,
  COUNT(DISTINCT CASE WHEN pv1.user_id = pv2.user_id THEN pv1.user_id END) as users_with_both_votes
FROM poll_votes pv1
JOIN polls p1 ON pv1.poll_id = p1.id
FULL OUTER JOIN poll_votes pv2 ON pv2.user_id = pv1.user_id
JOIN polls p2 ON pv2.poll_id = p2.id
WHERE p1.page_path = '/cew-polls/holistic-protection'
  AND p1.poll_index = 0
  AND p2.page_path = '/cew-polls/holistic-protection'
  AND p2.poll_index = 1;
