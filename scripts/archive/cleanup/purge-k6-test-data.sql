-- ============================================================================
-- PURGE K6 TEST DATA
-- ============================================================================
-- Purpose: Remove k6 test data that has unique user_id per question
-- This data is not useful for testing matrix graphs because it can't be paired
-- ============================================================================

-- First, let's see what we're about to delete
SELECT 
  'K6 Test Data Summary' as description,
  COUNT(*) as votes_to_delete,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(voted_at) as earliest_vote,
  MAX(voted_at) as latest_vote
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id LIKE 'CEW2025-%-%-%';

-- Show vote distribution by page
SELECT 
  p.page_path,
  COUNT(*) as votes,
  COUNT(DISTINCT pv.user_id) as unique_users
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id LIKE 'CEW2025-%-%-%'
GROUP BY p.page_path;

-- ============================================================================
-- PURGE COMMAND (uncomment to execute)
-- ============================================================================
-- WARNING: This will permanently delete all k6 test data
-- Backup first if you want to analyze it later!

-- Delete all votes with k6 test user_id pattern
DELETE FROM poll_votes
WHERE user_id LIKE 'CEW2025-%-%-%';

-- Verify deletion
SELECT 
  'After Purge' as description,
  COUNT(*) as remaining_votes,
  COUNT(DISTINCT user_id) as unique_users
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection');

-- Show what data remains (should be your manual test data)
SELECT 
  pv.user_id,
  p.page_path,
  p.poll_index,
  LEFT(p.question, 60) as question_preview,
  pv.option_index + 1 as score,
  pv.voted_at
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
ORDER BY pv.user_id, p.poll_index
LIMIT 50;

