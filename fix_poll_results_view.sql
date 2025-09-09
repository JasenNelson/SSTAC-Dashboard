-- Fix for duplicate Option A bars in poll results
-- This updates the poll_results view to properly handle aggregation

-- Drop and recreate the poll_results view with proper aggregation
DROP VIEW IF EXISTS poll_results;

CREATE VIEW poll_results AS
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
                'votes', option_counts.vote_count
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
        SUM(COUNT(*)) OVER (PARTITION BY poll_id) as total_votes
    FROM poll_votes 
    GROUP BY poll_id, option_index
) option_counts ON p.id = option_counts.poll_id
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options, option_counts.total_votes;
