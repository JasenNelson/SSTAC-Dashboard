-- Fix poll_votes_user_id_check constraint to allow CEW user IDs
-- 
-- The constraint is likely checking for UUID format, which blocks CEW user IDs
-- We need to modify it to allow both UUIDs (authenticated users) and CEW format (anonymous users)

-- Step 1: Check current constraint definition
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'poll_votes'
AND con.conname = 'poll_votes_user_id_check';

-- Step 2: Drop the existing constraint
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_user_id_check;

-- Step 3: Create new constraint that allows both UUID and CEW formats
-- This allows:
-- - UUID format: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' (authenticated users)
-- - CEW format: 'CEW2025_*' or any text starting with CEW code (anonymous users)
-- - Session format: '*_session_*' (CEW session-based IDs)
ALTER TABLE poll_votes 
ADD CONSTRAINT poll_votes_user_id_check 
CHECK (
    -- Allow UUID format (authenticated users)
    user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR
    -- Allow CEW format (anonymous users - starts with any code followed by underscore)
    user_id ~ '^[A-Za-z0-9]+_[A-Za-z0-9_]+$'
    OR
    -- Allow session-based format (CEW with session IDs)
    user_id LIKE '%_session_%'
);

-- Step 4: Verify the constraint was created
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'poll_votes'
AND con.conname = 'poll_votes_user_id_check';

-- Step 5: Test the constraint with sample values
SELECT 
    'Test UUID' AS test_type,
    '550e8400-e29b-41d4-a716-446655440000' AS test_value,
    CASE 
        WHEN '550e8400-e29b-41d4-a716-446655440000' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS result
UNION ALL
SELECT 
    'Test CEW Format',
    'CEW2025_session_1234567890_abc123',
    CASE 
        WHEN 'CEW2025_session_1234567890_abc123' ~ '^[A-Za-z0-9]+_[A-Za-z0-9_]+$'
        THEN 'PASS'
        ELSE 'FAIL'
    END;

