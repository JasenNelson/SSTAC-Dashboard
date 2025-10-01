-- ============================================================================
-- MATRIX VOTE PAIRING DIAGNOSTICS - SINGLE QUERY VERSION
-- Purpose: Get all diagnostic information in one query result
-- ============================================================================

WITH matrix_pairs AS (
    SELECT 
        'Matrix Standards (Ecosystem Health - Direct Toxicity)' as graph_title,
        0 as importance_index,
        1 as feasibility_index
    UNION ALL
    SELECT 
        'Matrix Standards (Human Health - Direct Toxicity)' as graph_title,
        2 as importance_index,
        3 as feasibility_index
    UNION ALL
    SELECT 
        'Matrix Standards (Ecosystem Health - Food-Related)' as graph_title,
        4 as importance_index,
        5 as feasibility_index
    UNION ALL
    SELECT 
        'Matrix Standards (Human Health - Food-Related)' as graph_title,
        6 as importance_index,
        7 as feasibility_index
),
holistic_polls AS (
    SELECT id, poll_index, page_path
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
),
user_votes AS (
    SELECT 
        pv.user_id,
        hp.poll_index,
        pv.option_index + 1 as score,
        pv.voted_at,
        ROW_NUMBER() OVER (PARTITION BY pv.user_id, hp.poll_index ORDER BY pv.voted_at DESC) as vote_rank
    FROM holistic_polls hp
    JOIN poll_votes pv ON hp.id = pv.poll_id
),
user_latest_votes AS (
    SELECT 
        user_id,
        poll_index,
        score,
        voted_at
    FROM user_votes
    WHERE vote_rank = 1
),
matrix_pair_analysis AS (
    SELECT 
        mp.graph_title,
        mp.importance_index,
        mp.feasibility_index,
        ulv_imp.user_id,
        ulv_imp.score as importance_score,
        ulv_feas.score as feasibility_score,
        ulv_imp.voted_at as importance_voted_at,
        ulv_feas.voted_at as feasibility_voted_at,
        CASE WHEN ulv_imp.user_id LIKE 'CEW%' THEN 'cew' ELSE 'authenticated' END as user_type
    FROM matrix_pairs mp
    LEFT JOIN user_latest_votes ulv_imp ON ulv_imp.poll_index = mp.importance_index
    LEFT JOIN user_latest_votes ulv_feas ON ulv_feas.poll_index = mp.feasibility_index 
        AND ulv_feas.user_id = ulv_imp.user_id
),
pair_summary AS (
    SELECT 
        graph_title,
        COUNT(*) as total_users_with_votes,
        COUNT(importance_score) as users_with_importance_vote,
        COUNT(feasibility_score) as users_with_feasibility_vote,
        COUNT(CASE WHEN importance_score IS NOT NULL AND feasibility_score IS NOT NULL THEN 1 END) as users_with_complete_pairs,
        STRING_AGG(
            CASE WHEN importance_score IS NOT NULL AND feasibility_score IS NOT NULL 
                 THEN CONCAT(user_id, '(', importance_score, ',', feasibility_score, ')')
                 ELSE NULL END, 
            ', '
        ) as paired_users_details
    FROM matrix_pair_analysis
    GROUP BY graph_title
)
SELECT 
    graph_title,
    total_users_with_votes,
    users_with_importance_vote,
    users_with_feasibility_vote,
    users_with_complete_pairs,
    CASE 
        WHEN users_with_complete_pairs > 0 THEN 'SHOULD_SHOW_DOTS'
        ELSE 'NO_DOTS_EXPECTED'
    END as expected_dots_status,
    paired_users_details
FROM pair_summary
ORDER BY graph_title;
