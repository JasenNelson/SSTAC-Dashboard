-- Fix all poll vote table constraints that block CEW user IDs
-- This drops any check constraints on user_id columns for all three vote tables

-- 1. Check what constraints exist
SELECT 
    con.conname AS constraint_name,
    rel.relname AS table_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname IN ('poll_votes', 'ranking_votes', 'wordcloud_votes')
AND con.contype = 'c'  -- 'c' = CHECK constraint
ORDER BY rel.relname, con.conname;

-- 2. Drop all user_id check constraints
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_user_id_check;
ALTER TABLE ranking_votes DROP CONSTRAINT IF EXISTS ranking_votes_user_id_check;
ALTER TABLE wordcloud_votes DROP CONSTRAINT IF EXISTS wordcloud_votes_user_id_check;

-- 3. Verify constraints are gone
SELECT 
    con.conname AS constraint_name,
    rel.relname AS table_name
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname IN ('poll_votes', 'ranking_votes', 'wordcloud_votes')
AND con.contype = 'c'
AND con.conname LIKE '%user_id%';

