-- ============================================================================
-- MATRIX GRAPH DATA INSPECTION SCRIPT
-- Purpose: Check how matrix graph data is actually being generated
-- ============================================================================

-- 1. CHECK MATRIX PAIR VOTES (Holistic Protection Pairs)
-- ============================================================================
WITH matrix_pairs AS (
  -- Define the matrix pairs we expect
  SELECT 0 as importance_index, 1 as feasibility_index, 'Pair 1: Direct toxicity to ecological receptors' as pair_name
  UNION ALL SELECT 2, 3, 'Pair 2: Direct toxicity to human receptors'
  UNION ALL SELECT 4, 5, 'Pair 3: Food-related toxicity to ecological receptors'
  UNION ALL SELECT 6, 7, 'Pair 4: Food-related toxicity to human receptors'
),
vote_data AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    pv.voted_at,
    p.page_path
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7)
)
SELECT 
  'Matrix Pair Vote Analysis' as section,
  mp.pair_name,
  mp.importance_index,
  mp.feasibility_index,
  COUNT(DISTINCT vd.user_id) as users_with_importance_vote,
  COUNT(DISTINCT vd2.user_id) as users_with_feasibility_vote,
  COUNT(DISTINCT CASE WHEN vd.user_id = vd2.user_id THEN vd.user_id END) as users_with_both_votes
FROM matrix_pairs mp
LEFT JOIN vote_data vd ON vd.poll_index = mp.importance_index
LEFT JOIN vote_data vd2 ON vd2.poll_index = mp.feasibility_index AND vd2.user_id = vd.user_id
GROUP BY mp.pair_name, mp.importance_index, mp.feasibility_index
ORDER BY mp.importance_index;

-- 2. DETAILED VOTE PAIRING FOR EACH USER
-- ============================================================================
WITH user_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    pv.voted_at,
    CASE WHEN p.poll_index IN (0, 2, 4, 6) THEN 'importance' ELSE 'feasibility' END as vote_type,
    CASE 
      WHEN p.poll_index IN (0, 1) THEN 1
      WHEN p.poll_index IN (2, 3) THEN 2
      WHEN p.poll_index IN (4, 5) THEN 3
      WHEN p.poll_index IN (6, 7) THEN 4
    END as pair_number
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7)
    AND pv.user_id LIKE 'CEW2025_%'
)
SELECT 
  'Detailed Vote Pairing' as section,
  uv.user_id,
  uv.pair_number,
  COUNT(CASE WHEN uv.vote_type = 'importance' THEN 1 END) as importance_votes,
  COUNT(CASE WHEN uv.vote_type = 'feasibility' THEN 1 END) as feasibility_votes,
  STRING_AGG(
    CASE WHEN uv.vote_type = 'importance' THEN 'I:' || uv.score ELSE NULL END, 
    ', ' ORDER BY uv.voted_at
  ) as importance_scores,
  STRING_AGG(
    CASE WHEN uv.vote_type = 'feasibility' THEN 'F:' || uv.score ELSE NULL END, 
    ', ' ORDER BY uv.voted_at
  ) as feasibility_scores
FROM user_votes uv
GROUP BY uv.user_id, uv.pair_number
HAVING COUNT(CASE WHEN uv.vote_type = 'importance' THEN 1 END) > 0 
   AND COUNT(CASE WHEN uv.vote_type = 'feasibility' THEN 1 END) > 0
ORDER BY uv.user_id, uv.pair_number
LIMIT 20;

-- 3. CHECK PRIORITIZATION PAIR (Questions 0+1)
-- ============================================================================
WITH prioritization_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    pv.voted_at,
    CASE WHEN p.poll_index = 0 THEN 'importance' ELSE 'feasibility' END as vote_type
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/prioritization'
    AND p.poll_index IN (0, 1)
    AND pv.user_id LIKE 'CEW2025_%'
)
SELECT 
  'Prioritization Pair Analysis' as section,
  pv.user_id,
  COUNT(CASE WHEN pv.vote_type = 'importance' THEN 1 END) as importance_votes,
  COUNT(CASE WHEN pv.vote_type = 'feasibility' THEN 1 END) as feasibility_votes,
  STRING_AGG(
    CASE WHEN pv.vote_type = 'importance' THEN 'I:' || pv.score ELSE NULL END, 
    ', ' ORDER BY pv.voted_at
  ) as importance_scores,
  STRING_AGG(
    CASE WHEN pv.vote_type = 'feasibility' THEN 'F:' || pv.score ELSE NULL END, 
    ', ' ORDER BY pv.voted_at
  ) as feasibility_scores
FROM prioritization_votes pv
GROUP BY pv.user_id
HAVING COUNT(CASE WHEN pv.vote_type = 'importance' THEN 1 END) > 0 
   AND COUNT(CASE WHEN pv.vote_type = 'feasibility' THEN 1 END) > 0
ORDER BY pv.user_id
LIMIT 15;

-- 4. VOTE TIMESTAMP ANALYSIS
-- ============================================================================
SELECT 
  'Vote Timestamp Analysis' as section,
  DATE_TRUNC('minute', pv.voted_at) as vote_minute,
  COUNT(*) as votes_in_minute,
  COUNT(DISTINCT pv.user_id) as unique_users_in_minute,
  STRING_AGG(DISTINCT SUBSTRING(pv.user_id, 1, 20), ', ') as sample_user_ids
FROM poll_votes pv
WHERE pv.voted_at >= NOW() - INTERVAL '1 hour'
  AND pv.user_id LIKE 'CEW2025_%'
GROUP BY DATE_TRUNC('minute', pv.voted_at)
ORDER BY vote_minute DESC
LIMIT 10;

-- 5. CHECK FOR VOTE SEQUENCING (same user, different questions)
-- ============================================================================
SELECT 
  'Vote Sequencing Analysis' as section,
  pv.user_id,
  p.poll_index,
  pv.option_index + 1 as score,
  pv.voted_at,
  LAG(p.poll_index) OVER (PARTITION BY pv.user_id ORDER BY pv.voted_at) as previous_poll_index,
  LAG(pv.voted_at) OVER (PARTITION BY pv.user_id ORDER BY pv.voted_at) as previous_vote_time,
  EXTRACT(EPOCH FROM (pv.voted_at - LAG(pv.voted_at) OVER (PARTITION BY pv.user_id ORDER BY pv.voted_at))) as seconds_since_previous
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id LIKE 'CEW2025_%'
  AND p.page_path IN ('/cew-polls/holistic-protection', '/cew-polls/prioritization')
ORDER BY pv.user_id, pv.voted_at
LIMIT 30;
