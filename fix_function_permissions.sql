-- Fix Function Permissions for Anonymous Users (CEW Polls)
-- Grant necessary permissions to anonymous role for CEW polling

-- Grant execute permissions on poll functions to anonymous role
GRANT EXECUTE ON FUNCTION get_or_create_poll(VARCHAR, INTEGER, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION get_or_create_ranking_poll(VARCHAR, INTEGER, TEXT, JSONB) TO anon;

-- Verify permissions
SELECT 
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges 
WHERE routine_name IN ('get_or_create_poll', 'get_or_create_ranking_poll')
AND grantee = 'anon';

-- Show current permissions for anon role
SELECT 
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges 
WHERE grantee = 'anon' 
AND table_name IN ('polls', 'poll_votes', 'ranking_polls', 'ranking_votes');
