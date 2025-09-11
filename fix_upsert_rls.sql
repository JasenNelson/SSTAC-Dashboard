-- Fix RLS policy to allow upsert operations for anon role
-- This allows both INSERT and UPDATE operations for anonymous users

-- Drop existing anon policy and recreate with proper permissions
DROP POLICY IF EXISTS "Allow anonymous users to insert votes" ON poll_votes;
DROP POLICY IF EXISTS "Allow anonymous users to read poll results" ON poll_votes;

-- Create new policy that allows both INSERT and UPDATE for anon role
CREATE POLICY "Allow anonymous users to vote" ON poll_votes
FOR ALL TO anon
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON poll_votes TO anon;
