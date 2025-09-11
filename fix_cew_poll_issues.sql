-- Fix CEW Poll Issues
-- This script addresses the RLS policy and function signature issues

-- 1. Add missing RLS policy for ranking_polls INSERT for anonymous users
CREATE POLICY IF NOT EXISTS "Allow anonymous users to insert ranking polls" ON ranking_polls
    FOR INSERT TO anon
    WITH CHECK (true);

-- 2. Grant INSERT permission to anonymous role for ranking_polls
GRANT INSERT ON ranking_polls TO anon;

-- 3. Verify the policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ranking_polls' 
ORDER BY policyname;

-- 4. Check if the get_or_create_poll function exists with correct signature
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_poll' 
AND routine_schema = 'public';
