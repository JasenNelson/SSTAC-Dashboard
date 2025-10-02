-- Matrix Graph Vote Pairing Integrity Verification
-- This script verifies that the matrix graph pairing logic is working correctly
-- by checking that paired votes are truly from single unique users

-- 1. Overall vote distribution analysis
SELECT 
  'OVERALL VOTE DISTRIBUTION' as analysis_type,
  COUNT(*) as total_votes,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN user_id LIKE 'CEW2025%' THEN 1 END) as cew_votes,
  COUNT(CASE WHEN user_id NOT LIKE 'CEW2025%' THEN 1 END) as authenticated_votes
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path LIKE '%holistic-protection%'
  AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7);

-- 2. User pairing capability analysis for each question pair
WITH user_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    pv.voted_at,
    CASE WHEN pv.user_id LIKE 'CEW2025%' THEN 'cew' ELSE 'authenticated' END as user_type,
    p.page_path
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7)
),
question_pairs AS (
  SELECT 'Q1+Q2 (Direct Toxicity - Ecosystem)' as pair_name, 0 as importance_idx, 1 as feasibility_idx
  UNION ALL SELECT 'Q3+Q4 (Direct Toxicity - Human)', 2, 3
  UNION ALL SELECT 'Q5+Q6 (Food-Related - Ecosystem)', 4, 5
  UNION ALL SELECT 'Q7+Q8 (Food-Related - Human)', 6, 7
)
SELECT 
  'USER PAIRING ANALYSIS' as analysis_type,
  qp.pair_name,
  uv.user_type,
  COUNT(DISTINCT uv.user_id) as total_users,
  COUNT(DISTINCT CASE WHEN uv.poll_index = qp.importance_idx THEN uv.user_id END) as users_voted_importance,
  COUNT(DISTINCT CASE WHEN uv.poll_index = qp.feasibility_idx THEN uv.user_id END) as users_voted_feasibility,
  COUNT(DISTINCT CASE WHEN uv.poll_index IN (qp.importance_idx, qp.feasibility_idx) THEN uv.user_id END) as users_voted_both
FROM question_pairs qp
CROSS JOIN user_votes uv
WHERE uv.poll_index IN (qp.importance_idx, qp.feasibility_idx)
GROUP BY qp.pair_name, uv.user_type
ORDER BY qp.pair_name, uv.user_type;

-- 3. Detailed user vote patterns for each question pair
WITH user_vote_sequence AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    pv.voted_at,
    p.page_path,
    CASE WHEN pv.user_id LIKE 'CEW2025%' THEN 'cew' ELSE 'authenticated' END as user_type,
    ROW_NUMBER() OVER (PARTITION BY pv.user_id, p.poll_index ORDER BY pv.voted_at) as vote_sequence
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7)
),
question_pairs AS (
  SELECT 'Q1+Q2 (Direct Toxicity - Ecosystem)' as pair_name, 0 as importance_idx, 1 as feasibility_idx
  UNION ALL SELECT 'Q3+Q4 (Direct Toxicity - Human)', 2, 3
  UNION ALL SELECT 'Q5+Q6 (Food-Related - Ecosystem)', 4, 5
  UNION ALL SELECT 'Q7+Q8 (Food-Related - Human)', 6, 7
)
SELECT 
  'DETAILED VOTE PATTERNS' as analysis_type,
  qp.pair_name,
  uvs.user_id,
  uvs.user_type,
  COUNT(CASE WHEN uvs.poll_index = qp.importance_idx THEN 1 END) as importance_votes,
  COUNT(CASE WHEN uvs.poll_index = qp.feasibility_idx THEN 1 END) as feasibility_votes,
  CASE 
    WHEN COUNT(CASE WHEN uvs.poll_index = qp.importance_idx THEN 1 END) > 0 
     AND COUNT(CASE WHEN uvs.poll_index = qp.feasibility_idx THEN 1 END) > 0 
    THEN 'CAN PAIR' 
    ELSE 'CANNOT PAIR' 
  END as pairing_capability,
  STRING_AGG(
    CASE 
      WHEN uvs.poll_index = qp.importance_idx THEN 'Importance:' || uvs.score || '(' || uvs.vote_sequence || ')'
      WHEN uvs.poll_index = qp.feasibility_idx THEN 'Feasibility:' || uvs.score || '(' || uvs.vote_sequence || ')'
    END, 
    ', ' 
    ORDER BY uvs.voted_at
  ) as vote_sequence
FROM question_pairs qp
JOIN user_vote_sequence uvs ON uvs.poll_index IN (qp.importance_idx, qp.feasibility_idx)
GROUP BY qp.pair_name, uvs.user_id, uvs.user_type
ORDER BY qp.pair_name, uvs.user_type, uvs.user_id;

-- 4. Poll ID verification - ensure we're looking at the right polls
SELECT 
  'POLL ID VERIFICATION' as analysis_type,
  p.page_path,
  p.poll_index,
  p.id as poll_id,
  COUNT(pv.id) as vote_count,
  COUNT(DISTINCT pv.user_id) as unique_voters
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path LIKE '%holistic-protection%'
  AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7)
GROUP BY p.page_path, p.poll_index, p.id
ORDER BY p.page_path, p.poll_index;

-- 5. Session ID consistency check for CEW users
SELECT 
  'CEW SESSION CONSISTENCY' as analysis_type,
  user_id,
  COUNT(*) as total_votes,
  COUNT(DISTINCT poll_id) as unique_polls,
  MIN(voted_at) as first_vote,
  MAX(voted_at) as last_vote,
  STRING_AGG(
    CONCAT('Poll:', poll_id, ' Score:', option_index + 1, ' Time:', voted_at), 
    ' | ' 
    ORDER BY voted_at
  ) as vote_details
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id LIKE 'CEW2025%'
  AND p.page_path LIKE '%holistic-protection%'
  AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7)
GROUP BY user_id
ORDER BY user_id;

-- 6. Authenticated user vote consistency
SELECT 
  'AUTHENTICATED USER CONSISTENCY' as analysis_type,
  user_id,
  COUNT(*) as total_votes,
  COUNT(DISTINCT poll_id) as unique_polls,
  MIN(voted_at) as first_vote,
  MAX(voted_at) as last_vote,
  STRING_AGG(
    CONCAT('Poll:', poll_id, ' Score:', option_index + 1, ' Time:', voted_at), 
    ' | ' 
    ORDER BY voted_at
  ) as vote_details
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id NOT LIKE 'CEW2025%'
  AND p.page_path LIKE '%holistic-protection%'
  AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7)
GROUP BY user_id
ORDER BY user_id;
