-- ============================================================================
-- ACTUAL VOTE DATA INSPECTION SCRIPT
-- Purpose: Check how votes are actually stored in the database
-- ============================================================================

-- 1. CHECK RECENT VOTE SUBMISSIONS
-- ============================================================================
SELECT 
  'Recent Vote Submissions' as section,
  COUNT(*) as total_votes,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(voted_at) as earliest_vote,
  MAX(voted_at) as latest_vote
FROM poll_votes
WHERE voted_at >= NOW() - INTERVAL '1 hour';

-- 2. SAMPLE VOTE RECORDS (LAST 20)
-- ============================================================================
SELECT 
  'Sample Vote Records' as section,
  user_id,
  poll_id,
  option_index,
  voted_at,
  other_text
FROM poll_votes
ORDER BY voted_at DESC
LIMIT 20;

-- 3. USER ID PATTERNS
-- ============================================================================
SELECT 
  'User ID Patterns' as section,
  CASE 
    WHEN user_id LIKE 'CEW2025_%' THEN 'CEW Users'
    WHEN user_id LIKE '%_%_%_%' THEN 'Complex Pattern'
    ELSE 'Other Pattern'
  END as user_type,
  COUNT(*) as vote_count,
  COUNT(DISTINCT user_id) as unique_users
FROM poll_votes
GROUP BY 
  CASE 
    WHEN user_id LIKE 'CEW2025_%' THEN 'CEW Users'
    WHEN user_id LIKE '%_%_%_%' THEN 'Complex Pattern'
    ELSE 'Other Pattern'
  END;

-- 4. VOTES BY POLL INDEX (to see which questions are being voted on)
-- ============================================================================
SELECT 
  'Votes by Poll Index' as section,
  p.poll_index,
  p.page_path,
  LEFT(p.question, 50) as question_preview,
  COUNT(pv.id) as vote_count,
  COUNT(DISTINCT pv.user_id) as unique_voters
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
GROUP BY p.poll_index, p.page_path, p.question
ORDER BY p.poll_index;

-- 5. CHECK FOR MATRIX PAIRING POTENTIAL
-- ============================================================================
SELECT 
  'Matrix Pairing Analysis' as section,
  p.page_path,
  p.poll_index,
  COUNT(DISTINCT pv.user_id) as users_who_voted,
  STRING_AGG(DISTINCT CAST(pv.option_index + 1 AS TEXT), ', ' ORDER BY CAST(pv.option_index + 1 AS TEXT)) as scores_selected
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path IN ('/cew-polls/holistic-protection', '/cew-polls/prioritization')
GROUP BY p.page_path, p.poll_index
ORDER BY p.page_path, p.poll_index;

-- 6. SPECIFIC USER VOTE PATTERNS
-- ============================================================================
SELECT 
  'Specific User Vote Patterns' as section,
  pv.user_id,
  p.page_path,
  p.poll_index,
  pv.option_index + 1 as score,
  pv.voted_at
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id LIKE 'CEW2025_%'
  AND p.page_path IN ('/cew-polls/holistic-protection', '/cew-polls/prioritization')
ORDER BY pv.user_id, pv.voted_at
LIMIT 30;

-- 7. CHECK FOR DUPLICATE VOTES (same user, same poll)
-- ============================================================================
SELECT 
  'Duplicate Vote Check' as section,
  pv.user_id,
  p.poll_index,
  p.page_path,
  COUNT(*) as vote_count,
  STRING_AGG(CAST(pv.option_index + 1 AS TEXT), ', ' ORDER BY pv.voted_at) as scores_over_time
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id LIKE 'CEW2025_%'
GROUP BY pv.user_id, p.poll_index, p.page_path
HAVING COUNT(*) > 1
ORDER BY vote_count DESC
LIMIT 20;