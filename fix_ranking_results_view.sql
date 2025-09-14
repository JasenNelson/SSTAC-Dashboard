-- Fix Ranking Results View to Count Unique Users Instead of Individual Votes
-- The current view counts individual ranking votes instead of unique users

-- Drop and recreate the ranking_results view with proper aggregation
DROP VIEW IF EXISTS ranking_results;

CREATE VIEW ranking_results AS
SELECT 
    rp.id as ranking_poll_id,
    rp.page_path,
    rp.poll_index,
    rp.question,
    rp.options,
    rp.created_at,
    rp.updated_at,
    COUNT(DISTINCT rv.user_id) as total_votes, -- Count unique users, not individual votes
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'option_index', option_stats.option_index,
                    'option_text', rp.options[option_stats.option_index + 1],
                    'averageRank', option_stats.avg_rank,
                    'votes', option_stats.vote_count
                ) ORDER BY option_stats.option_index
            )
            FROM (
                SELECT 
                    rv2.option_index,
                    AVG(rv2.rank::numeric) as avg_rank,
                    COUNT(rv2.id) as vote_count
                FROM ranking_votes rv2
                WHERE rv2.ranking_poll_id = rp.id
                GROUP BY rv2.option_index
            ) option_stats
        ),
        '[]'::jsonb
    ) as results
FROM ranking_polls rp
LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id
GROUP BY rp.id, rp.page_path, rp.poll_index, rp.question, rp.options, rp.created_at, rp.updated_at;

-- Test the view to see if it's working correctly
SELECT 
    ranking_poll_id,
    total_votes,
    jsonb_array_length(results) as result_count
FROM ranking_results 
WHERE page_path = '/cew-polls/holistic-protection' 
AND poll_index = 1;
