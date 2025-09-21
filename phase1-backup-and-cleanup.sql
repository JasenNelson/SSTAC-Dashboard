-- =====================================================
-- PHASE 1: SAFE DATABASE CLEANUP - WIKS & TEST DATA REMOVAL
-- =====================================================
-- 
-- CRITICAL SAFEGUARDS:
-- 1. Create comprehensive backups before any changes
-- 2. Document current state
-- 3. Remove only WIKS and test data
-- 4. Verify system still works after each step
--
-- EXECUTION ORDER:
-- 1. Create backups
-- 2. Document current state  
-- 3. Remove WIKS polls and votes
-- 4. Remove test polls and votes
-- 5. Verify final state
-- =====================================================

-- =====================================================
-- STEP 1: CREATE COMPREHENSIVE BACKUPS
-- =====================================================

-- Create timestamped backup tables
CREATE TABLE polls_backup_20250120 AS SELECT * FROM polls;
CREATE TABLE ranking_polls_backup_20250120 AS SELECT * FROM ranking_polls;
CREATE TABLE poll_votes_backup_20250120 AS SELECT * FROM poll_votes;
CREATE TABLE ranking_votes_backup_20250120 AS SELECT * FROM ranking_votes;

-- Verify backups were created successfully
SELECT 'BACKUP VERIFICATION' as status;
SELECT 'polls_backup_20250120' as table_name, COUNT(*) as count FROM polls_backup_20250120
UNION ALL
SELECT 'ranking_polls_backup_20250120' as table_name, COUNT(*) as count FROM ranking_polls_backup_20250120
UNION ALL
SELECT 'poll_votes_backup_20250120' as table_name, COUNT(*) as count FROM poll_votes_backup_20250120
UNION ALL
SELECT 'ranking_votes_backup_20250120' as table_name, COUNT(*) as count FROM ranking_votes_backup_20250120;

-- =====================================================
-- STEP 2: DOCUMENT CURRENT STATE
-- =====================================================

-- Document what exists before cleanup
SELECT 'BEFORE CLEANUP - Current Polls' as status;
SELECT id, page_path, poll_index, LEFT(question, 50) as question_preview, created_at 
FROM polls 
ORDER BY page_path, poll_index;

-- Document current vote counts
SELECT 'BEFORE CLEANUP - Vote Counts by Poll' as status;
SELECT p.page_path, p.poll_index, COUNT(pv.id) as vote_count
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
GROUP BY p.id, p.page_path, p.poll_index
ORDER BY p.page_path, p.poll_index;

-- Document WIKS polls that will be removed
SELECT 'WIKS POLLS TO BE REMOVED' as status;
SELECT id, page_path, poll_index, LEFT(question, 50) as question_preview
FROM polls 
WHERE page_path LIKE '%wiks%'
ORDER BY page_path, poll_index;

-- Document test polls that will be removed
SELECT 'TEST POLLS TO BE REMOVED' as status;
SELECT id, page_path, poll_index, LEFT(question, 50) as question_preview
FROM polls 
WHERE page_path LIKE '%test%'
ORDER BY page_path, poll_index;

-- =====================================================
-- STEP 3: REMOVE WIKS POLLS AND VOTES
-- =====================================================

-- First, remove all votes for WIKS polls
DELETE FROM poll_votes 
WHERE poll_id IN (
    SELECT id FROM polls WHERE page_path LIKE '%wiks%'
);

-- Verify WIKS votes removed
SELECT 'WIKS VOTES REMOVED - Remaining WIKS votes' as status;
SELECT COUNT(*) as remaining_wiks_votes
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path LIKE '%wiks%';

-- Now remove WIKS polls
DELETE FROM polls WHERE page_path LIKE '%wiks%';

-- Verify WIKS polls removed
SELECT 'WIKS POLLS REMOVED - Remaining WIKS polls' as status;
SELECT COUNT(*) as remaining_wiks_polls
FROM polls 
WHERE page_path LIKE '%wiks%';

-- =====================================================
-- STEP 4: REMOVE TEST POLLS AND VOTES
-- =====================================================

-- Remove votes for test polls
DELETE FROM poll_votes 
WHERE poll_id IN (
    SELECT id FROM polls WHERE page_path LIKE '%test%'
);

-- Remove test polls
DELETE FROM polls WHERE page_path LIKE '%test%';

-- Verify test polls removed
SELECT 'TEST POLLS REMOVED - Remaining test polls' as status;
SELECT COUNT(*) as remaining_test_polls
FROM polls 
WHERE page_path LIKE '%test%';

-- =====================================================
-- STEP 5: VERIFY FINAL STATE
-- =====================================================

-- Document what remains after cleanup
SELECT 'AFTER CLEANUP - Remaining Polls' as status;
SELECT id, page_path, poll_index, LEFT(question, 50) as question_preview, created_at 
FROM polls 
ORDER BY page_path, poll_index;

-- Document remaining vote counts
SELECT 'AFTER CLEANUP - Remaining Vote Counts' as status;
SELECT p.page_path, p.poll_index, COUNT(pv.id) as vote_count
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
GROUP BY p.id, p.page_path, p.poll_index
ORDER BY p.page_path, p.poll_index;

-- Summary of changes
SELECT 'PHASE 1 CLEANUP SUMMARY' as status;
SELECT 
    'Polls removed' as action,
    (SELECT COUNT(*) FROM polls_backup_20250120) - (SELECT COUNT(*) FROM polls) as count
UNION ALL
SELECT 
    'Votes removed' as action,
    (SELECT COUNT(*) FROM poll_votes_backup_20250120) - (SELECT COUNT(*) FROM poll_votes) as count
UNION ALL
SELECT 
    'Remaining polls' as action,
    (SELECT COUNT(*) FROM polls) as count
UNION ALL
SELECT 
    'Remaining votes' as action,
    (SELECT COUNT(*) FROM poll_votes) as count;

-- =====================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- =====================================================
-- 
-- If anything goes wrong, restore from backup:
-- 
-- DROP TABLE IF EXISTS polls;
-- DROP TABLE IF EXISTS ranking_polls;
-- DROP TABLE IF EXISTS poll_votes;
-- DROP TABLE IF EXISTS ranking_votes;
-- 
-- ALTER TABLE polls_backup_20250120 RENAME TO polls;
-- ALTER TABLE ranking_polls_backup_20250120 RENAME TO ranking_polls;
-- ALTER TABLE poll_votes_backup_20250120 RENAME TO poll_votes;
-- ALTER TABLE ranking_votes_backup_20250120 RENAME TO ranking_votes;
-- =====================================================
