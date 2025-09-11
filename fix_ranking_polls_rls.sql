-- Fix RLS policy for ranking_polls table to allow CEW polls
-- This allows anonymous users (CEW conference attendees) to create new ranking polls

-- Add RLS policy to allow anonymous users to insert ranking polls
CREATE POLICY IF NOT EXISTS "Allow anonymous users to insert ranking polls" ON ranking_polls
    FOR INSERT TO anon
    WITH CHECK (true);

-- Grant INSERT permission to anonymous role for ranking_polls
GRANT INSERT ON ranking_polls TO anon;

-- Verify the policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ranking_polls' 
ORDER BY policyname;
