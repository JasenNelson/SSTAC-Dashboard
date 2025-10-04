-- Test the API logic directly by simulating what should happen
-- Check the current state and test the delete operation

-- 1. Check current votes for poll 7 (the one you're testing)
WITH poll_info AS (
    SELECT id as poll_id, poll_index, page_path
    FROM polls 
    WHERE page_path = '/survey-results/holistic-protection' 
    AND poll_index = 7
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    'Current votes for poll 7:' as test_type,
    pv.id,
    pv.user_id,
    pv.option_index,
    pv.voted_at,
    CASE 
        WHEN pv.user_id LIKE '%session_%' OR pv.user_id LIKE '%CEW%' THEN 'CEW'
        ELSE 'Authenticated'
    END as user_type
FROM poll_votes pv
CROSS JOIN poll_info pi
WHERE pv.poll_id = pi.poll_id
ORDER BY pv.voted_at DESC;

-- 2. Test if the unique index would prevent duplicates
-- This simulates what should happen when trying to insert a duplicate
WITH poll_info AS (
    SELECT id as poll_id, poll_index, page_path
    FROM polls 
    WHERE page_path = '/survey-results/holistic-protection' 
    AND poll_index = 7
    ORDER BY created_at DESC 
    LIMIT 1
),
sample_user AS (
    SELECT DISTINCT pv.user_id
    FROM poll_votes pv
    CROSS JOIN poll_info pi
    WHERE pv.poll_id = pi.poll_id
    AND pv.user_id NOT LIKE '%session_%' 
    AND pv.user_id NOT LIKE '%CEW%'
    LIMIT 1
)
SELECT 
    'Testing unique constraint for user:' as test_type,
    su.user_id,
    pi.poll_id,
    'This should fail if unique index is working' as expected_result
FROM sample_user su
CROSS JOIN poll_info pi;

-- 3. Check if there are any RLS policies that might be affecting the delete operation
SELECT 
    'RLS Policies on poll_votes:' as test_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'poll_votes';
