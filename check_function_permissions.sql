-- Check Function Permissions for Anonymous Users
-- Verify that the poll functions are accessible to anonymous role

-- Check function permissions
SELECT 
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges 
WHERE routine_name IN ('get_or_create_poll', 'get_or_create_ranking_poll')
AND grantee = 'anon';

-- If no results, try to grant permissions again
GRANT EXECUTE ON FUNCTION get_or_create_poll(VARCHAR, INTEGER, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION get_or_create_ranking_poll(VARCHAR, INTEGER, TEXT, JSONB) TO anon;

-- Check again after granting
SELECT 
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges 
WHERE routine_name IN ('get_or_create_poll', 'get_or_create_ranking_poll')
AND grantee = 'anon';
