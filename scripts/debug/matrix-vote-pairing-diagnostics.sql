-- ============================================================================
-- MATRIX VOTE PAIRING DIAGNOSTICS SCRIPT
-- Purpose: Verify if vote data represents true paired submissions from individual users
-- ============================================================================

-- 1. EXAMINE VOTE STRUCTURE AND USER PATTERNS
-- ============================================================================

-- Show all users and their vote patterns across holistic protection questions
WITH holistic_polls AS (
    SELECT id, poll_index, page_path, LEFT(question, 60) as question_preview
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
),
user_vote_patterns AS (
    SELECT 
        hp.page_path,
        hp.poll_index,
        hp.question_preview,
        pv.user_id,
        pv.option_index + 1 as score,
        pv.voted_at,
        ROW_NUMBER() OVER (PARTITION BY hp.id, pv.user_id ORDER BY pv.voted_at DESC) as vote_rank
    FROM holistic_polls hp
    JOIN poll_votes pv ON hp.id = pv.poll_id
)
SELECT 
    user_id,
    STRING_AGG(
        CONCAT(page_path, ' Q', poll_index::text, '=', score::text, 
               CASE WHEN vote_rank = 1 THEN ' (LATEST)' ELSE '' END), 
        ', ' ORDER BY page_path, poll_index, vote_rank
    ) as vote_pattern
FROM user_vote_patterns
GROUP BY user_id
ORDER BY user_id;

-- 2. SPECIFIC PAIRING ANALYSIS FOR MATRIX GRAPHS
-- ============================================================================

-- Check each matrix graph pair individually
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
pair_votes AS (
    SELECT 
        mp.graph_title,
        mp.importance_index,
        mp.feasibility_index,
        pv.user_id,
        hp.poll_index as actual_poll_index,
        pv.option_index + 1 as score,
        pv.voted_at,
        ROW_NUMBER() OVER (PARTITION BY pv.user_id, hp.poll_index ORDER BY pv.voted_at DESC) as vote_rank
    FROM matrix_pairs mp
    JOIN holistic_polls hp ON hp.poll_index IN (mp.importance_index, mp.feasibility_index)
    JOIN poll_votes pv ON hp.id = pv.poll_id
)
SELECT 
    graph_title,
    user_id,
    MAX(CASE WHEN actual_poll_index = importance_index AND vote_rank = 1 THEN score END) as importance_score,
    MAX(CASE WHEN actual_poll_index = feasibility_index AND vote_rank = 1 THEN score END) as feasibility_score,
    CASE 
        WHEN MAX(CASE WHEN actual_poll_index = importance_index AND vote_rank = 1 THEN score END) IS NOT NULL
         AND MAX(CASE WHEN actual_poll_index = feasibility_index AND vote_rank = 1 THEN score END) IS NOT NULL
        THEN 'HAS_PAIR'
        ELSE 'MISSING_PAIR'
    END as pair_status
FROM pair_votes
GROUP BY graph_title, user_id
ORDER BY graph_title, user_id;

-- 3. COUNT PAIRS PER MATRIX GRAPH
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
pair_votes AS (
    SELECT 
        mp.graph_title,
        mp.importance_index,
        mp.feasibility_index,
        pv.user_id,
        hp.poll_index as actual_poll_index,
        pv.option_index + 1 as score,
        pv.voted_at,
        ROW_NUMBER() OVER (PARTITION BY pv.user_id, hp.poll_index ORDER BY pv.voted_at DESC) as vote_rank
    FROM matrix_pairs mp
    JOIN holistic_polls hp ON hp.poll_index IN (mp.importance_index, mp.feasibility_index)
    JOIN poll_votes pv ON hp.id = pv.poll_id
),
user_pairs AS (
    SELECT 
        graph_title,
        user_id,
        MAX(CASE WHEN actual_poll_index = importance_index AND vote_rank = 1 THEN score END) as importance_score,
        MAX(CASE WHEN actual_poll_index = feasibility_index AND vote_rank = 1 THEN score END) as feasibility_score
    FROM pair_votes
    GROUP BY graph_title, user_id
)
SELECT 
    graph_title,
    COUNT(*) as total_users,
    COUNT(importance_score) as users_with_importance_vote,
    COUNT(feasibility_score) as users_with_feasibility_vote,
    COUNT(CASE WHEN importance_score IS NOT NULL AND feasibility_score IS NOT NULL THEN 1 END) as users_with_complete_pairs,
    STRING_AGG(
        CASE WHEN importance_score IS NOT NULL AND feasibility_score IS NOT NULL 
             THEN CONCAT(user_id, '(', importance_score, ',', feasibility_score, ')')
             ELSE NULL END, 
        ', '
    ) as paired_users_details
FROM user_pairs
GROUP BY graph_title
ORDER BY graph_title;

-- 4. DETAILED VOTE TIMELINE FOR SAMPLE USERS
-- ============================================================================

-- Show detailed voting timeline for users who have pairs
WITH matrix_pairs AS (
    SELECT 
        'Matrix Standards (Human Health - Food-Related)' as graph_title,
        6 as importance_index,
        7 as feasibility_index
),
holistic_polls AS (
    SELECT id, poll_index, page_path
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
    AND poll_index IN (6, 7)  -- Focus on the working pair
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
    WHERE pv.user_id IN (
        SELECT DISTINCT pv2.user_id 
        FROM poll_votes pv2 
        JOIN holistic_polls hp2 ON pv2.poll_id = hp2.id 
        WHERE hp2.poll_index = 6
        INTERSECT
        SELECT DISTINCT pv3.user_id 
        FROM poll_votes pv3 
        JOIN holistic_polls hp3 ON pv3.poll_id = hp3.id 
        WHERE hp3.poll_index = 7
    )
)
SELECT 
    user_id,
    poll_index,
    score,
    voted_at,
    vote_rank,
    CASE WHEN vote_rank = 1 THEN 'LATEST_VOTE' ELSE 'OLDER_VOTE' END as vote_type
FROM user_votes
ORDER BY user_id, poll_index, vote_rank;

-- 5. API QUERY SIMULATION
-- ============================================================================

-- Simulate what the API should return for individual pairs
WITH matrix_pairs AS (
    SELECT 
        'Matrix Standards (Human Health - Food-Related)' as graph_title,
        6 as importance_index,
        7 as feasibility_index
),
holistic_polls AS (
    SELECT id, poll_index, page_path
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
    AND poll_index IN (6, 7)
),
api_simulation AS (
    SELECT 
        mp.graph_title,
        pv.user_id,
        hp.poll_index,
        pv.option_index + 1 as score,
        pv.voted_at,
        ROW_NUMBER() OVER (PARTITION BY pv.user_id, hp.poll_index ORDER BY pv.voted_at DESC) as vote_rank
    FROM matrix_pairs mp
    JOIN holistic_polls hp ON hp.poll_index IN (mp.importance_index, mp.feasibility_index)
    JOIN poll_votes pv ON hp.id = pv.poll_id
),
user_pairs AS (
    SELECT 
        graph_title,
        user_id,
        MAX(CASE WHEN poll_index = 6 AND vote_rank = 1 THEN score END) as importance_score,
        MAX(CASE WHEN poll_index = 7 AND vote_rank = 1 THEN score END) as feasibility_score,
        CASE WHEN user_id LIKE 'CEW%' THEN 'cew' ELSE 'authenticated' END as user_type
    FROM api_simulation
    GROUP BY graph_title, user_id
)
SELECT 
    graph_title,
    user_id,
    importance_score,
    feasibility_score,
    user_type,
    'INDIVIDUAL_PAIR' as pair_type
FROM user_pairs
WHERE importance_score IS NOT NULL AND feasibility_score IS NOT NULL
ORDER BY user_id;

-- 6. SUMMARY STATISTICS
-- ============================================================================

SELECT 
    'Total Votes in Database' as metric,
    COUNT(*) as value
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path LIKE '%holistic-protection%'

UNION ALL

SELECT 
    'Unique Users Voting' as metric,
    COUNT(DISTINCT pv.user_id) as value
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path LIKE '%holistic-protection%'

UNION ALL

SELECT 
    'Users with Multiple Votes' as metric,
    COUNT(*) as value
FROM (
    SELECT pv.user_id, p.poll_index, COUNT(*) as vote_count
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path LIKE '%holistic-protection%'
    GROUP BY pv.user_id, p.poll_index
    HAVING COUNT(*) > 1
) multi_votes;
