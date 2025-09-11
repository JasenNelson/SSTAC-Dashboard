-- Fix ranking polls to support CEW pages
-- Update ranking_votes table to support both authenticated users and CEW codes

-- First, drop the foreign key constraint on user_id
ALTER TABLE ranking_votes DROP CONSTRAINT IF EXISTS ranking_votes_user_id_fkey;

-- Change user_id column to TEXT to support both UUIDs and CEW codes
ALTER TABLE ranking_votes ALTER COLUMN user_id TYPE TEXT;

-- Add a CHECK constraint to validate user_id format
ALTER TABLE ranking_votes ADD CONSTRAINT ranking_votes_user_id_check CHECK (
    user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR 
    user_id LIKE 'anon_%' OR 
    user_id LIKE 'CEW%'
);

-- Update the unique constraint to work with TEXT user_id
DROP INDEX IF EXISTS ranking_votes_ranking_poll_id_user_id_option_index_key;
CREATE UNIQUE INDEX IF NOT EXISTS ranking_votes_ranking_poll_id_user_id_option_index_key 
ON ranking_votes (ranking_poll_id, user_id, option_index);

-- Add RLS policies for anonymous users (CEW pages)
CREATE POLICY "Allow anonymous users to read ranking polls" ON ranking_polls
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "Allow anonymous users to insert ranking votes" ON ranking_votes
    FOR INSERT TO anon
    WITH CHECK (user_id LIKE 'CEW%' OR user_id LIKE 'anon_%');

CREATE POLICY "Allow anonymous users to read ranking votes" ON ranking_votes
    FOR SELECT TO anon
    USING (user_id LIKE 'CEW%' OR user_id LIKE 'anon_%');

-- Grant necessary permissions to anon role
GRANT SELECT ON ranking_polls TO anon;
GRANT INSERT, SELECT ON ranking_votes TO anon;
