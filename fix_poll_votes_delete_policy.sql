-- Fix the missing DELETE policy for poll_votes table
-- This will allow authenticated users to delete their own votes

-- Add DELETE policy for poll_votes
-- CRITICAL: Only allow authenticated users to delete votes, NOT CEW users
CREATE POLICY "Authenticated users can delete their own votes" ON poll_votes 
    FOR DELETE 
    USING (
        -- ONLY allow deletion if user is authenticated and matches the user_id
        -- EXPLICITLY EXCLUDE CEW users (session-based user_ids)
        auth.uid()::text = user_id
        AND user_id NOT LIKE '%session_%' 
        AND user_id NOT LIKE '%CEW%'
    );

-- Verify the policy was created
SELECT 
    'New DELETE policy created:' as status,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'poll_votes' 
AND policyname = 'Users can delete their own votes';
