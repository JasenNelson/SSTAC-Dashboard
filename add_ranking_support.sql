-- Add ranking support to poll_votes table
-- This allows polls to support both single-choice and ranking questions

-- Add rank column to poll_votes table
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS rank INTEGER;

-- Update the unique constraint to allow multiple votes per user per poll for ranking
-- (but still enforce uniqueness for single-choice polls)
DROP INDEX IF EXISTS poll_votes_poll_id_user_id_key;

-- Create a new unique constraint that allows multiple votes per user per poll
-- but ensures each option can only be voted on once per user per poll
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_id_user_id_option_index_key 
ON poll_votes (poll_id, user_id, option_index);

-- Update the poll_results view to handle ranking data
CREATE OR REPLACE VIEW poll_results AS
SELECT 
    p.id as poll_id,
    p.page_path,
    p.poll_index,
    p.question,
    p.options,
    COUNT(DISTINCT pv.user_id) as total_votes,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'option_index', pv.option_index,
                'option_text', p.options->>pv.option_index,
                'votes', option_counts.vote_count,
                'averageRank', option_counts.average_rank
            ) ORDER BY pv.option_index
        ) FILTER (WHERE pv.id IS NOT NULL),
        '[]'::jsonb
    ) as results
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
LEFT JOIN (
    SELECT 
        poll_id, 
        option_index, 
        COUNT(*) as vote_count,
        CASE 
            WHEN COUNT(*) > 0 AND COUNT(rank) > 0 THEN 
                ROUND(AVG(rank)::numeric, 2)
            ELSE NULL 
        END as average_rank
    FROM poll_votes 
    GROUP BY poll_id, option_index
) option_counts ON p.id = option_counts.poll_id AND pv.option_index = option_counts.option_index
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options;
