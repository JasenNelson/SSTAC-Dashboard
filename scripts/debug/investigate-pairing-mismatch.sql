-- ============================================================================
-- INVESTIGATE PAIRING MISMATCH: 15 votes per question but only 8 pairs
-- ============================================================================
-- Matrix: "Matrix Standards (Ecosystem Health - Direct Toxicity)"
-- Q1 (poll_index 0): Importance - should have 15 votes
-- Q2 (poll_index 1): Feasibility - should have 15 votes  
-- Expected: 15 paired votes (all 15 users voted on both)
-- Actual: Only 8 paired votes
-- ============================================================================

-- Step 1: Count votes per question
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

-- Step 2: Find users who voted on Q1 only, Q2 only, or both
WITH user_vote_status AS (
  SELECT 
    pv.user_id,
    MAX(CASE WHEN p.poll_index = 0 THEN 1 ELSE 0 END) as voted_q1,
    MAX(CASE WHEN p.poll_index = 1 THEN 1 ELSE 0 END) as voted_q2
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (0, 1)
  GROUP BY pv.user_id
)
SELECT 
  CASE 
    WHEN voted_q1 = 1 AND voted_q2 = 1 THEN 'Both Q1 and Q2'
    WHEN voted_q1 = 1 AND voted_q2 = 0 THEN 'Q1 only'
    WHEN voted_q1 = 0 AND voted_q2 = 1 THEN 'Q2 only'
    ELSE 'Neither'
  END as vote_status,
  COUNT(*) as user_count,
  ARRAY_AGG(user_id ORDER BY user_id LIMIT 5) as sample_user_ids
FROM user_vote_status
GROUP BY 
  CASE 
    WHEN voted_q1 = 1 AND voted_q2 = 1 THEN 'Both Q1 and Q2'
    WHEN voted_q1 = 1 AND voted_q2 = 0 THEN 'Q1 only'
    WHEN voted_q1 = 0 AND voted_q2 = 1 THEN 'Q2 only'
    ELSE 'Neither'
  END
ORDER BY user_count DESC;

-- Step 3: Check for duplicate votes (same user, same question, multiple votes)
SELECT 
  pv.user_id,
  p.poll_index,
  COUNT(*) as vote_count,
  ARRAY_AGG(pv.option_index ORDER BY pv.voted_at) as vote_progression,
  MIN(pv.voted_at) as first_vote,
  MAX(pv.voted_at) as last_vote
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
GROUP BY pv.user_id, p.poll_index
HAVING COUNT(*) > 1
ORDER BY vote_count DESC;

-- Step 4: Show all user votes for both questions (to see the pairing data)
SELECT 
  pv.user_id,
  p.poll_index,
  CASE WHEN p.poll_index = 0 THEN 'Importance' ELSE 'Feasibility' END as question_type,
  pv.option_index + 1 as score,
  pv.voted_at
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
ORDER BY pv.user_id, p.poll_index, pv.voted_at DESC;
