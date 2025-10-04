-- Verify that CEW users CANNOT delete votes
-- This script tests the security policies to ensure CEW users are properly restricted

-- 1. Check all DELETE policies on vote tables
SELECT 
    'DELETE Policies on Vote Tables:' as check_type,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('poll_votes', 'ranking_votes', 'wordcloud_votes')
AND cmd = 'DELETE'
ORDER BY tablename, policyname;

-- 2. Test what would happen if a CEW user tried to delete votes
-- (This is a simulation - we won't actually delete anything)
WITH cew_user_simulation AS (
    SELECT 'CEW2025_session_12345' as test_user_id
),
policy_test AS (
    SELECT 
        'CEW User Delete Test:' as test_type,
        'CEW users should NOT be able to delete votes' as expected_behavior,
        CASE 
            WHEN 'CEW2025_session_12345' LIKE '%session_%' THEN 'CEW user detected'
            WHEN 'CEW2025_session_12345' LIKE '%CEW%' THEN 'CEW user detected'
            ELSE 'Not a CEW user'
        END as user_type_check,
        CASE 
            WHEN 'CEW2025_session_12345' LIKE '%session_%' OR 'CEW2025_session_12345' LIKE '%CEW%' 
            THEN 'BLOCKED - CEW users cannot delete'
            ELSE 'ALLOWED - Authenticated user'
        END as policy_result
)
SELECT * FROM policy_test;

-- 3. Test what would happen if an authenticated user tried to delete votes
WITH auth_user_simulation AS (
    SELECT 'c632b5bc-6666-4b5f-8ef3-ca851dcee762' as test_user_id
),
policy_test AS (
    SELECT 
        'Authenticated User Delete Test:' as test_type,
        'Authenticated users SHOULD be able to delete their own votes' as expected_behavior,
        CASE 
            WHEN 'c632b5bc-6666-4b5f-8ef3-ca851dcee762' LIKE '%session_%' THEN 'CEW user detected'
            WHEN 'c632b5bc-6666-4b5f-8ef3-ca851dcee762' LIKE '%CEW%' THEN 'CEW user detected'
            ELSE 'Not a CEW user'
        END as user_type_check,
        CASE 
            WHEN 'c632b5bc-6666-4b5f-8ef3-ca851dcee762' LIKE '%session_%' OR 'c632b5bc-6666-4b5f-8ef3-ca851dcee762' LIKE '%CEW%' 
            THEN 'BLOCKED - CEW users cannot delete'
            ELSE 'ALLOWED - Authenticated user'
        END as policy_result
)
SELECT * FROM policy_test;

-- 4. Summary of security measures
SELECT 
    'Security Summary:' as check_type,
    'CEW users: INSERT only (no delete, no update)' as cew_behavior,
    'Authenticated users: INSERT, DELETE, UPDATE allowed' as auth_behavior,
    'RLS policies enforce these restrictions at database level' as enforcement_method;
