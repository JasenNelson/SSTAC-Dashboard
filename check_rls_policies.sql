-- Check RLS policies on poll_votes table
SELECT 
    'RLS Policies on poll_votes:' as check_type,
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

-- Check if RLS is enabled on poll_votes
SELECT 
    'RLS Status on poll_votes:' as check_type,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'poll_votes';

-- Check current user and permissions
SELECT 
    'Current user and permissions:' as check_type,
    current_user,
    session_user,
    current_database();
