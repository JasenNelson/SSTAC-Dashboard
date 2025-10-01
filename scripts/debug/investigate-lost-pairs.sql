-- ============================================================================
-- INVESTIGATE LOST PAIRS: Why 15 manual test votes = only 8 pairs in matrix
-- ============================================================================
-- User submitted 15 pairs manually, but matrix graph only shows 8 pairs
-- Need to find what's causing the 7 lost pairs
-- ============================================================================

-- Step 1: Show ALL votes with timestamps to see the submission pattern
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
ORDER BY pv.voted_at, pv.user_id, p.poll_index;

-- Step 2: Check if there are multiple votes per user per question (shouldn't be for manual test)
SELECT 
  pv.user_id,
  p.poll_index,
  COUNT(*) as vote_count,
  ARRAY_AGG(pv.option_index + 1 ORDER BY pv.voted_at) as scores_in_order,
  ARRAY_AGG(pv.voted_at ORDER BY pv.voted_at) as vote_times
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index IN (0, 1)
GROUP BY pv.user_id, p.poll_index
HAVING COUNT(*) > 1
ORDER BY pv.user_id, p.poll_index;

-- Step 3: Simulate the exact pairing logic the matrix API uses
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
    MAX(CASE WHEN poll_index = 1 THEN score END) as feasibility_score,
    MAX(CASE WHEN poll_index = 0 THEN voted_at END) as importance_time,
    MAX(CASE WHEN poll_index = 1 THEN voted_at END) as feasibility_time
  FROM latest_votes
  WHERE rn = 1
  GROUP BY user_id
  HAVING COUNT(DISTINCT poll_index) = 2  -- Must have votes on both questions
)
SELECT 
  user_id,
  importance_score,
  feasibility_score,
  importance_time,
  feasibility_time,
  EXTRACT(EPOCH FROM (feasibility_time - importance_time)) as time_diff_seconds
FROM user_pairs
ORDER BY user_id;

-- Step 4: Show users who voted on only one question (the "lost" users)
WITH user_vote_status AS (
  SELECT 
    pv.user_id,
    MAX(CASE WHEN p.poll_index = 0 THEN 1 ELSE 0 END) as voted_q1,
    MAX(CASE WHEN p.poll_index = 1 THEN 1 ELSE 0 END) as voted_q2,
    COUNT(DISTINCT p.poll_index) as questions_voted
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (0, 1)
  GROUP BY pv.user_id
)
SELECT 
  user_id,
  voted_q1,
  voted_q2,
  questions_voted,
  CASE 
    WHEN voted_q1 = 1 AND voted_q2 = 1 THEN 'Both questions - SHOULD appear in matrix'
    WHEN voted_q1 = 1 AND voted_q2 = 0 THEN 'Q1 only - MISSING from matrix'
    WHEN voted_q1 = 0 AND voted_q2 = 1 THEN 'Q2 only - MISSING from matrix'
    ELSE 'Neither - ERROR'
  END as status
FROM user_vote_status
ORDER BY status, user_id;
