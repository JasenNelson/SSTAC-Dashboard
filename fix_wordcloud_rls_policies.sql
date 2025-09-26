-- Fix RLS policies for wordcloud_votes table to allow CEW and survey-results submissions
-- This script updates the RLS policies to properly handle both authenticated and anonymous users

-- First, let's check the current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'wordcloud_votes';

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own wordcloud votes" ON wordcloud_votes;
DROP POLICY IF EXISTS "Users can view their own wordcloud votes" ON wordcloud_votes;
DROP POLICY IF EXISTS "Users can update their own wordcloud votes" ON wordcloud_votes;
DROP POLICY IF EXISTS "Users can delete their own wordcloud votes" ON wordcloud_votes;
DROP POLICY IF EXISTS "Anyone can view wordcloud votes" ON wordcloud_votes;
DROP POLICY IF EXISTS "Anyone can insert wordcloud votes" ON wordcloud_votes;

-- Create new policies that allow both authenticated users and CEW users
-- Policy for inserting wordcloud votes (allows both authenticated and anonymous with authCode)
CREATE POLICY "Allow wordcloud vote insertion" ON wordcloud_votes
FOR INSERT
WITH CHECK (
  -- Allow authenticated users to insert their own votes (for survey-results pages)
  (auth.uid() IS NOT NULL AND user_id = auth.uid()::text) OR
  -- Allow anonymous users with CEW codes (for cew-polls pages)
  (auth.uid() IS NULL AND user_id = 'CEW2025')
);

-- Policy for viewing wordcloud votes (allows both authenticated and anonymous)
CREATE POLICY "Allow wordcloud vote viewing" ON wordcloud_votes
FOR SELECT
USING (
  -- Allow authenticated users to view their own votes
  (auth.uid() IS NOT NULL AND user_id = auth.uid()::text) OR
  -- Allow anonymous users to view all votes (for public results)
  auth.uid() IS NULL OR
  -- Allow viewing votes from CEW users
  user_id = 'CEW2025'
);

-- Policy for updating wordcloud votes (allows both authenticated and anonymous)
CREATE POLICY "Allow wordcloud vote updating" ON wordcloud_votes
FOR UPDATE
USING (
  -- Allow authenticated users to update their own votes
  (auth.uid() IS NOT NULL AND user_id = auth.uid()::text) OR
  -- Allow anonymous users with CEW codes
  (auth.uid() IS NULL AND user_id = 'CEW2025')
)
WITH CHECK (
  -- Same conditions for the new values
  (auth.uid() IS NOT NULL AND user_id = auth.uid()::text) OR
  (auth.uid() IS NULL AND user_id = 'CEW2025')
);

-- Policy for deleting wordcloud votes (allows both authenticated and anonymous)
CREATE POLICY "Allow wordcloud vote deletion" ON wordcloud_votes
FOR DELETE
USING (
  -- Allow authenticated users to delete their own votes
  (auth.uid() IS NOT NULL AND user_id = auth.uid()::text) OR
  -- Allow anonymous users with CEW codes
  (auth.uid() IS NULL AND user_id = 'CEW2025')
);

-- Also update the wordcloud_polls table policies if needed
-- Check current policies for wordcloud_polls
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'wordcloud_polls';

-- Drop existing policies for wordcloud_polls
DROP POLICY IF EXISTS "Anyone can view wordcloud polls" ON wordcloud_polls;
DROP POLICY IF EXISTS "Anyone can insert wordcloud polls" ON wordcloud_polls;

-- Create new policies for wordcloud_polls
CREATE POLICY "Allow wordcloud poll viewing" ON wordcloud_polls
FOR SELECT
USING (true); -- Allow everyone to view polls

CREATE POLICY "Allow wordcloud poll insertion" ON wordcloud_polls
FOR INSERT
WITH CHECK (true); -- Allow everyone to create polls

-- Verify the new policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('wordcloud_votes', 'wordcloud_polls')
ORDER BY tablename, policyname;
