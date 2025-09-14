-- Debug CEW Polls - Check RLS Policies and Permissions

-- Check RLS policies on poll tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('polls', 'poll_votes', 'ranking_polls', 'ranking_votes');

-- Check if RLS is enabled on these tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('polls', 'poll_votes', 'ranking_polls', 'ranking_votes');

-- Test if anonymous user can access the tables
SET ROLE anon;
SELECT COUNT(*) as poll_votes_count FROM poll_votes;
SELECT COUNT(*) as ranking_votes_count FROM ranking_votes;
SELECT COUNT(*) as polls_count FROM polls;
SELECT COUNT(*) as ranking_polls_count FROM ranking_polls;
RESET ROLE;
