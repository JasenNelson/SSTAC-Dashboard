-- ============================================================================
-- CLEANUP HOLISTIC PROTECTION TEST DATA
-- ============================================================================
-- Purpose: Delete all test votes for Holistic Protection matrix graph questions to start fresh
-- Target: Holistic Protection Q1-8 (poll_index 0-7) from /cew-polls/holistic-protection
-- Note: Leaving Prioritization votes alone - they're working perfectly
-- ============================================================================

-- Step 1: Show what we're about to delete (SAFETY CHECK)
SELECT 
  'BEFORE DELETE - Holistic Protection Vote Counts' as status,
  p.poll_index,
  CASE WHEN p.poll_index = 0 THEN 'Q1: Ecosystem Health Direct Toxicity (Importance)' 
       WHEN p.poll_index = 1 THEN 'Q2: Ecosystem Health Direct Toxicity (Feasibility)'
       WHEN p.poll_index = 2 THEN 'Q3: Human Health Direct Toxicity (Importance)'
       WHEN p.poll_index = 3 THEN 'Q4: Human Health Direct Toxicity (Feasibility)'
       WHEN p.poll_index = 4 THEN 'Q5: Ecosystem Health Food-Related (Importance)'
       WHEN p.poll_index = 5 THEN 'Q6: Ecosystem Health Food-Related (Feasibility)'
       WHEN p.poll_index = 6 THEN 'Q7: Human Health Food-Related (Importance)'
       WHEN p.poll_index = 7 THEN 'Q8: Human Health Food-Related (Feasibility)'
       ELSE 'Unknown Question' END as question_description,
  COUNT(pv.id) as vote_count
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index BETWEEN 0 AND 7
GROUP BY p.poll_index
ORDER BY p.poll_index;

-- Step 2: Delete votes for Holistic Protection Questions 1-8 (poll_index 0-7)
DELETE FROM poll_votes 
WHERE poll_id IN (
  SELECT p.id 
  FROM polls p 
  WHERE p.page_path = '/cew-polls/holistic-protection' 
    AND p.poll_index BETWEEN 0 AND 7
);

-- Step 3: Verify deletion (SAFETY CHECK)
SELECT 
  'AFTER DELETE - Holistic Protection Vote Counts' as status,
  p.poll_index,
  CASE WHEN p.poll_index = 0 THEN 'Q1: Ecosystem Health Direct Toxicity (Importance)' 
       WHEN p.poll_index = 1 THEN 'Q2: Ecosystem Health Direct Toxicity (Feasibility)'
       WHEN p.poll_index = 2 THEN 'Q3: Human Health Direct Toxicity (Importance)'
       WHEN p.poll_index = 3 THEN 'Q4: Human Health Direct Toxicity (Feasibility)'
       WHEN p.poll_index = 4 THEN 'Q5: Ecosystem Health Food-Related (Importance)'
       WHEN p.poll_index = 5 THEN 'Q6: Ecosystem Health Food-Related (Feasibility)'
       WHEN p.poll_index = 6 THEN 'Q7: Human Health Food-Related (Importance)'
       WHEN p.poll_index = 7 THEN 'Q8: Human Health Food-Related (Feasibility)'
       ELSE 'Unknown Question' END as question_description,
  COUNT(pv.id) as vote_count
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index BETWEEN 0 AND 7
GROUP BY p.poll_index
ORDER BY p.poll_index;

-- Step 4: Summary
SELECT 
  'CLEANUP COMPLETE' as status,
  'All test votes deleted for Holistic Protection Q1-8 from CEW polls. Prioritization votes preserved.' as message;
