-- ============================================================================
-- CHECK ACTUAL VOTE DATA - No Assumptions
-- ============================================================================
-- Purpose: See the actual vote data to understand the 15 vs 8 discrepancy
-- ============================================================================

-- Step 1: Show ALL individual votes for Q1 and Q2
SELECT 
  pv.user_id,
  p.poll_index,
  pv.option_index + 1 as score,
  pv.voted_at,
  pv.id as vote_id
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
ORDER BY pv.user_id, p.poll_index, pv.voted_at;

-- Step 2: Count total votes per question (what left panel sees)
SELECT 
  p.poll_index,
  CASE WHEN p.poll_index = 0 THEN 'Q1: Importance' ELSE 'Q2: Feasibility' END as question_type,
  COUNT(pv.id) as total_votes,
  COUNT(DISTINCT pv.user_id) as unique_users
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
GROUP BY p.poll_index
ORDER BY p.poll_index;

-- Step 3: Show what the poll_results view returns (what left panel uses)
SELECT 
  p.poll_index,
  p.question,
  pr.total_votes,
  pr.results
FROM polls p
LEFT JOIN poll_results pr ON p.id = pr.poll_id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
ORDER BY p.poll_index;
