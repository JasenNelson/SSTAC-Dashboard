-- Fix anonymous voting by modifying poll_votes table to allow non-UUID user_ids
-- This allows both authenticated users (UUID) and anonymous users (string) to vote

-- First, drop the foreign key constraint
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_user_id_fkey;

-- Modify the user_id column to accept both UUIDs and strings
ALTER TABLE poll_votes ALTER COLUMN user_id TYPE TEXT;

-- Add a check constraint to ensure user_id is either a valid UUID or starts with 'anon_'
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_user_id_check 
  CHECK (user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR user_id LIKE 'anon_%');

-- Update the unique constraint to work with the new data type
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_poll_id_user_id_key;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_poll_id_user_id_key UNIQUE(poll_id, user_id);

-- Add other_text column if it doesn't exist
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS other_text TEXT;

-- Update the poll_results view to include other_texts
DROP VIEW IF EXISTS poll_results;
CREATE OR REPLACE VIEW poll_results AS
SELECT 
    p.id as poll_id,
    p.page_path,
    p.poll_index,
    p.question,
    p.options,
    COALESCE(option_counts.total_votes, 0) as total_votes,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'option_index', option_counts.option_index,
                'option_text', p.options->>option_counts.option_index,
                'votes', option_counts.vote_count,
                'other_texts', option_counts.other_texts
            ) ORDER BY option_counts.option_index
        ) FILTER (WHERE option_counts.option_index IS NOT NULL),
        '[]'::jsonb
    ) as results
FROM polls p
LEFT JOIN (
    SELECT 
        poll_id, 
        option_index, 
        COUNT(*) as vote_count,
        SUM(COUNT(*)) OVER (PARTITION BY poll_id) as total_votes,
        COALESCE(
            jsonb_agg(
                CASE 
                    WHEN other_text IS NOT NULL AND other_text != '' 
                    THEN other_text 
                    ELSE NULL 
                END
            ) FILTER (WHERE other_text IS NOT NULL AND other_text != ''),
            '[]'::jsonb
        ) as other_texts
    FROM poll_votes 
    GROUP BY poll_id, option_index
) option_counts ON p.id = option_counts.poll_id
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options, option_counts.total_votes;

-- Add RLS policies for anonymous users
CREATE POLICY IF NOT EXISTS "Allow anonymous users to read polls" ON polls
    FOR SELECT TO anon
    USING (true);

CREATE POLICY IF NOT EXISTS "Allow anonymous users to vote on polls" ON poll_votes
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow anonymous users to read poll results" ON poll_votes
    FOR SELECT TO anon
    USING (true);

-- Grant necessary permissions
GRANT SELECT ON polls TO anon;
GRANT INSERT ON poll_votes TO anon;
GRANT SELECT ON poll_votes TO anon;
GRANT SELECT ON poll_results TO anon;
