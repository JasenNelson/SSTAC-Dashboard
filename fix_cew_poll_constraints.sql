-- Fix CEW Poll Constraints to Allow Multiple Votes
-- This removes the unique constraints that prevent multiple votes per CEW code

-- Step 1: Remove existing unique constraints
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_poll_id_user_id_key;
ALTER TABLE ranking_votes DROP CONSTRAINT IF EXISTS ranking_votes_ranking_poll_id_user_id_key;

-- Step 2: Clean up duplicate votes for authenticated users (UUIDs only)
-- Keep only the most recent vote for each authenticated user per poll

-- Clean up poll_votes duplicates for authenticated users
DELETE FROM poll_votes 
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY poll_id, user_id 
                   ORDER BY voted_at DESC
               ) as rn
        FROM poll_votes 
        WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) t 
    WHERE rn > 1
);

-- Clean up ranking_votes duplicates for authenticated users
DELETE FROM ranking_votes 
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY ranking_poll_id, user_id, option_index
                   ORDER BY voted_at DESC
               ) as rn
        FROM ranking_votes 
        WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) t 
    WHERE rn > 1
);

-- Step 3: Add new unique constraints that allow multiple votes per CEW code
-- but prevent multiple votes per authenticated user

-- For poll_votes: Only enforce uniqueness for UUID users (authenticated users)
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_unique_auth_users 
ON poll_votes (poll_id, user_id) 
WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- For ranking_votes: Only enforce uniqueness for UUID users (authenticated users)
CREATE UNIQUE INDEX IF NOT EXISTS ranking_votes_unique_auth_users 
ON ranking_votes (ranking_poll_id, user_id) 
WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 4: Verify the changes
SELECT 
    table_name,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name IN ('poll_votes', 'ranking_votes') 
AND constraint_type = 'UNIQUE';

-- Show the new indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('poll_votes', 'ranking_votes')
AND indexname LIKE '%unique_auth_users%';

-- Show cleanup results
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
