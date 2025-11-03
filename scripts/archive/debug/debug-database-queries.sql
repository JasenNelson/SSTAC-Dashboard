-- Focused database queries for matrix pairing debugging
-- Run these one at a time to avoid overwhelming output

-- 1. Check current vote distribution
SELECT 
  'Vote Distribution' as analysis_type,
  COUNT(*) as total_votes,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN user_id LIKE 'CEW2025%' THEN 1 END) as cew_votes,
  COUNT(CASE WHEN user_id NOT LIKE 'CEW2025%' THEN 1 END) as authenticated_votes
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path LIKE '%holistic-protection%'
  AND p.poll_index IN (0, 1);

-- 2. Check user pairing capability
WITH user_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    CASE WHEN pv.user_id LIKE 'CEW2025%' THEN 'cew' ELSE 'authenticated' END as user_type
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (0, 1)
)
SELECT 
  'User Pairing Analysis' as analysis_type,
  user_type,
  COUNT(DISTINCT user_id) as total_users,
  COUNT(DISTINCT CASE WHEN poll_index = 0 THEN user_id END) as users_voted_q1,
  COUNT(DISTINCT CASE WHEN poll_index = 1 THEN user_id END) as users_voted_q2,
  COUNT(DISTINCT CASE WHEN poll_index IN (0, 1) THEN user_id END) as users_voted_both
FROM user_votes
GROUP BY user_type;

-- 3. Sample user vote patterns
WITH user_vote_sequence AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    pv.voted_at,
    CASE WHEN pv.user_id LIKE 'CEW2025%' THEN 'cew' ELSE 'authenticated' END as user_type,
    ROW_NUMBER() OVER (PARTITION BY pv.user_id, p.poll_index ORDER BY pv.voted_at) as vote_sequence
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (0, 1)
)
SELECT 
  'Sample Vote Patterns' as analysis_type,
  user_id,
  user_type,
  STRING_AGG(
    CONCAT('Q', poll_index + 1, ':', score, '(', vote_sequence, ')'), 
    ', ' 
    ORDER BY voted_at
  ) as vote_sequence
FROM user_vote_sequence
GROUP BY user_id, user_type
ORDER BY user_type, COUNT(*) DESC
LIMIT 5;
