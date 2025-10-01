-- ============================================================================
-- INVESTIGATE ALL USERS: Check actual user patterns for matrix pairing
-- ============================================================================
-- Purpose: See ALL users and their vote patterns, not just assumptions
-- ============================================================================

-- Step 1: Show ALL users who voted on Q1 and Q2, with their vote counts
SELECT 
  pv.user_id,
  p.poll_index,
  COUNT(*) as vote_count,
  ARRAY_AGG(pv.option_index ORDER BY pv.voted_at) as all_votes,
  MIN(pv.voted_at) as first_vote,
  MAX(pv.voted_at) as last_vote
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
GROUP BY pv.user_id, p.poll_index
ORDER BY pv.user_id, p.poll_index;

-- Step 2: Show which users have votes on BOTH Q1 and Q2
WITH user_question_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    COUNT(*) as vote_count
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (0, 1)
  GROUP BY pv.user_id, p.poll_index
),
user_summary AS (
  SELECT 
    user_id,
    MAX(CASE WHEN poll_index = 0 THEN vote_count ELSE 0 END) as q1_votes,
    MAX(CASE WHEN poll_index = 1 THEN vote_count ELSE 0 END) as q2_votes
  FROM user_question_votes
  GROUP BY user_id
)
SELECT 
  user_id,
  q1_votes,
  q2_votes,
  CASE 
    WHEN q1_votes > 0 AND q2_votes > 0 THEN 'Both questions'
    WHEN q1_votes > 0 AND q2_votes = 0 THEN 'Q1 only'
    WHEN q1_votes = 0 AND q2_votes > 0 THEN 'Q2 only'
    ELSE 'Neither'
  END as vote_status
FROM user_summary
ORDER BY user_id;

-- Step 3: Show the actual latest votes that would be used for pairing
WITH latest_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    pv.voted_at,
    ROW_NUMBER() OVER (PARTITION BY pv.user_id, p.poll_index ORDER BY pv.voted_at DESC) as rn
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (0, 1)
)
SELECT 
  user_id,
  poll_index,
  score,
  voted_at
FROM latest_votes
WHERE rn = 1  -- Only the latest vote per user per question
ORDER BY user_id, poll_index;

-- Step 4: Count actual paired users (users with latest votes on BOTH questions)
WITH latest_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    pv.voted_at,
    ROW_NUMBER() OVER (PARTITION BY pv.user_id, p.poll_index ORDER BY pv.voted_at DESC) as rn
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (0, 1)
),
user_pairs AS (
  SELECT 
    user_id,
    MAX(CASE WHEN poll_index = 0 THEN score END) as importance_score,
    MAX(CASE WHEN poll_index = 1 THEN score END) as feasibility_score
  FROM latest_votes
  WHERE rn = 1
  GROUP BY user_id
  HAVING COUNT(DISTINCT poll_index) = 2  -- Must have votes on both questions
)
SELECT 
  'Paired Users Count' as metric,
  COUNT(*) as count,
  ARRAY_AGG(user_id ORDER BY user_id) as user_ids
FROM user_pairs;
