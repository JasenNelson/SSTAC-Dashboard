-- Check poll_votes table constraints
-- This will show us what check constraint is blocking CEW user IDs

-- 1. Check all constraints on poll_votes table
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'poll_votes'
AND con.contype = 'c'  -- 'c' = CHECK constraint
ORDER BY con.conname;

-- 2. Check the specific constraint that's failing
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition,
    con.convalidated AS is_validated
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'poll_votes'
AND con.conname = 'poll_votes_user_id_check';

-- 3. Test what user_id formats would pass/fail
-- Replace with actual CEW user ID format being generated
SELECT 
    'CEW2025_session_1234567890_abc123' AS test_user_id,
    CASE 
        WHEN 'CEW2025_session_1234567890_abc123' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN 'PASS (UUID format)'
        ELSE 'FAIL (Not UUID format)'
    END AS uuid_check;

