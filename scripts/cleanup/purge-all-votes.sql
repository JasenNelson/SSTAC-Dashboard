-- ============================================================================
-- PURGE ALL VOTES SCRIPT
-- Purpose: Clean slate for testing with proper user_id patterns
-- ============================================================================

-- 1. DELETE ALL VOTES FROM ALL POLL TABLES
-- ============================================================================

-- Delete all poll votes (single-choice polls)
DELETE FROM poll_votes;

-- Delete all ranking votes
DELETE FROM ranking_votes;

-- Delete all wordcloud votes  
DELETE FROM wordcloud_votes;

-- 2. RESET POLL TABLES (OPTIONAL - UNCOMMENT IF NEEDED)
-- ============================================================================

-- Uncomment these lines if you want to reset the polls themselves
-- DELETE FROM polls;
-- DELETE FROM ranking_polls;
-- DELETE FROM wordcloud_polls;

-- 3. VERIFY CLEANUP
-- ============================================================================

-- Check that all vote tables are empty
SELECT 'poll_votes' as table_name, COUNT(*) as remaining_votes FROM poll_votes
UNION ALL
SELECT 'ranking_votes' as table_name, COUNT(*) as remaining_votes FROM ranking_votes  
UNION ALL
SELECT 'wordcloud_votes' as table_name, COUNT(*) as remaining_votes FROM wordcloud_votes;

-- 4. SHOW POLL COUNTS (SHOULD REMAIN)
-- ============================================================================

-- Show remaining polls (should remain unless you uncommented the DELETE statements above)
SELECT 'polls' as table_name, COUNT(*) as poll_count FROM polls
UNION ALL
SELECT 'ranking_polls' as table_name, COUNT(*) as poll_count FROM ranking_polls
UNION ALL
SELECT 'wordcloud_polls' as table_name, COUNT(*) as poll_count FROM wordcloud_polls;
