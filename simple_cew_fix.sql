-- Simple Fix: Remove Unique Constraints Entirely
-- This allows multiple votes for both CEW codes and authenticated users
-- We'll handle uniqueness in the application logic instead

-- Step 1: Remove all unique constraints
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_poll_id_user_id_key;
ALTER TABLE ranking_votes DROP CONSTRAINT IF EXISTS ranking_votes_ranking_poll_id_user_id_key;

-- Step 2: Verify constraints are removed
SELECT 
    table_name,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name IN ('poll_votes', 'ranking_votes') 
AND constraint_type = 'UNIQUE';

-- Step 3: Show current vote counts
SELECT 
    'poll_votes' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT CASE WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN user_id END) as authenticated_users,
    COUNT(DISTINCT CASE WHEN user_id LIKE 'CEW%' THEN user_id END) as cew_codes
FROM poll_votes

UNION ALL

SELECT 
    'ranking_votes' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT CASE WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN user_id END) as authenticated_users,
    COUNT(DISTINCT CASE WHEN user_id LIKE 'CEW%' THEN user_id END) as cew_codes
FROM ranking_votes;
