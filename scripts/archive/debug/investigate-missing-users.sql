-- ============================================================================
-- INVESTIGATE MISSING USERS: Find the 7 additional paired users not in matrix
-- ============================================================================
-- Current data shows 8 users with paired votes, but user submitted 15 pairs
-- Need to find where the other 7 pairs went
-- ============================================================================

-- Step 1: Show ALL users who have ANY votes on Q1 or Q2 (not just paired ones)
SELECT 
  pv.user_id,
  COUNT(CASE WHEN p.poll_index = 0 THEN 1 END) as q1_votes,
  COUNT(CASE WHEN p.poll_index = 1 THEN 1 END) as q2_votes,
  COUNT(DISTINCT p.poll_index) as questions_voted,
  MIN(pv.voted_at) as first_vote,
  MAX(pv.voted_at) as last_vote
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
GROUP BY pv.user_id
ORDER BY pv.user_id;

-- Step 2: Check if there are users with votes on both questions but different page paths
SELECT 
  pv.user_id,
  p.page_path,
  p.poll_index,
  COUNT(*) as vote_count
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.poll_index IN (0, 1)
  AND (p.page_path = '/cew-polls/holistic-protection' OR p.page_path = '/survey-results/holistic-protection')
GROUP BY pv.user_id, p.page_path, p.poll_index
ORDER BY pv.user_id, p.page_path, p.poll_index;

-- Step 3: Check if votes were deleted or if there are votes in survey-results path
SELECT 
  'CEW Path' as path_type,
  COUNT(DISTINCT pv.user_id) as unique_users,
  COUNT(*) as total_votes
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
UNION ALL
SELECT 
  'Survey Results Path' as path_type,
  COUNT(DISTINCT pv.user_id) as unique_users,
  COUNT(*) as total_votes
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/survey-results/holistic-protection'
  AND p.poll_index IN (0, 1);

-- Step 4: Check if there are any votes that might have been deleted or lost
-- Look for patterns in vote IDs or timestamps that might indicate missing data
SELECT 
  'Vote Analysis' as analysis_type,
  COUNT(DISTINCT pv.user_id) as total_unique_users,
  COUNT(DISTINCT CASE WHEN p.poll_index = 0 THEN pv.user_id END) as users_with_q1,
  COUNT(DISTINCT CASE WHEN p.poll_index = 1 THEN pv.user_id END) as users_with_q2,
  COUNT(DISTINCT CASE WHEN p.poll_index IN (0,1) THEN pv.user_id END) as users_with_either_q,
  COUNT(*) as total_votes
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1);
