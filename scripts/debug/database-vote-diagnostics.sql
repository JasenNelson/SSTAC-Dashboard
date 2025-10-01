-- ============================================================================
-- DATABASE VOTE DIAGNOSTICS SCRIPT
-- Purpose: Understand how votes are stored and how to pair them for matrix graphs
-- ============================================================================

-- 1. EXAMINE TABLE STRUCTURE
-- ============================================================================
\echo '========================================================================'
\echo '1. EXAMINING POLL_VOTES TABLE STRUCTURE'
\echo '========================================================================'

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'poll_votes'
ORDER BY ordinal_position;

-- 2. EXAMINE SAMPLE VOTES FOR HOLISTIC PROTECTION QUESTIONS
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '2. SAMPLE VOTES - Matrix Standards (Human Health - Food-Related)'
\echo '   Importance Question (poll_index 6) + Feasibility Question (poll_index 7)'
\echo '========================================================================'

-- Get poll IDs first
WITH poll_ids AS (
    SELECT 
        id as poll_id,
        page_path,
        poll_index,
        LEFT(question, 80) as question_preview
    FROM polls
    WHERE page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
    AND poll_index IN (6, 7)
    ORDER BY page_path, poll_index
)
SELECT * FROM poll_ids;

-- 3. EXAMINE INDIVIDUAL VOTES
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '3. INDIVIDUAL VOTES FOR THESE QUESTIONS'
\echo '========================================================================'

WITH poll_ids AS (
    SELECT id as poll_id, page_path, poll_index
    FROM polls
    WHERE page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
    AND poll_index IN (6, 7)
)
SELECT 
    pv.user_id,
    p.poll_index,
    p.page_path,
    pv.option_index,
    pv.option_index + 1 as score,  -- Convert 0-based to 1-based
    LEFT(p.question, 50) as question_type,
    pv.voted_at
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.poll_id IN (SELECT poll_id FROM poll_ids)
ORDER BY pv.user_id, p.poll_index
LIMIT 50;

-- 4. IDENTIFY USERS WHO VOTED ON BOTH QUESTIONS
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '4. USERS WHO VOTED ON BOTH IMPORTANCE AND FEASIBILITY'
\echo '========================================================================'

WITH poll_ids AS (
    SELECT id as poll_id, page_path, poll_index
    FROM polls
    WHERE page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
    AND poll_index IN (6, 7)
),
user_votes AS (
    SELECT 
        pv.user_id,
        p.poll_index,
        p.page_path,
        pv.option_index + 1 as score
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE pv.poll_id IN (SELECT poll_id FROM poll_ids)
),
paired_votes AS (
    SELECT 
        importance.user_id,
        importance.score as importance_score,
        feasibility.score as feasibility_score,
        importance.page_path,
        CASE 
            WHEN importance.user_id LIKE 'CEW2025%' THEN 'cew'
            ELSE 'authenticated'
        END as user_type
    FROM user_votes importance
    JOIN user_votes feasibility 
        ON importance.user_id = feasibility.user_id 
        AND importance.page_path = feasibility.page_path
    WHERE importance.poll_index = 6  -- Importance question
    AND feasibility.poll_index = 7    -- Feasibility question
)
SELECT 
    user_id,
    importance_score,
    feasibility_score,
    user_type,
    page_path
FROM paired_votes
ORDER BY user_type, user_id
LIMIT 20;

-- 5. COUNT TOTAL PAIRED VS UNPAIRED VOTES
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '5. VOTE PAIRING STATISTICS'
\echo '========================================================================'

WITH poll_ids AS (
    SELECT id as poll_id, page_path, poll_index
    FROM polls
    WHERE page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
    AND poll_index IN (6, 7)
),
user_votes AS (
    SELECT 
        pv.user_id,
        p.poll_index,
        p.page_path
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE pv.poll_id IN (SELECT poll_id FROM poll_ids)
),
vote_counts AS (
    SELECT 
        user_id,
        page_path,
        COUNT(DISTINCT poll_index) as questions_answered
    FROM user_votes
    GROUP BY user_id, page_path
)
SELECT 
    page_path,
    questions_answered,
    COUNT(*) as user_count,
    CASE 
        WHEN questions_answered = 2 THEN 'PAIRED (can plot as dot)'
        ELSE 'UNPAIRED (only voted on one question)'
    END as status
FROM vote_counts
GROUP BY page_path, questions_answered
ORDER BY page_path, questions_answered;

-- 6. EXAMINE ALL HOLISTIC PROTECTION QUESTION PAIRS
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '6. PAIRING STATISTICS FOR ALL HOLISTIC PROTECTION QUESTION PAIRS'
\echo '========================================================================'

WITH pair_stats AS (
    SELECT 
        0 as importance_index, 
        1 as feasibility_index,
        'Matrix Standards (Ecosystem Health - Direct Toxicity)' as title
    UNION ALL SELECT 2, 3, 'Matrix Standards (Human Health - Direct Toxicity)'
    UNION ALL SELECT 4, 5, 'Matrix Standards (Ecosystem Health - Food-Related)'
    UNION ALL SELECT 6, 7, 'Matrix Standards (Human Health - Food-Related)'
)
SELECT 
    ps.title,
    ps.importance_index,
    ps.feasibility_index,
    COUNT(DISTINCT CASE WHEN p.poll_index = ps.importance_index THEN pv.user_id END) as importance_votes,
    COUNT(DISTINCT CASE WHEN p.poll_index = ps.feasibility_index THEN pv.user_id END) as feasibility_votes,
    COUNT(DISTINCT CASE 
        WHEN EXISTS (
            SELECT 1 FROM poll_votes pv2 
            JOIN polls p2 ON pv2.poll_id = p2.id
            WHERE pv2.user_id = pv.user_id 
            AND p2.page_path = p.page_path
            AND p2.poll_index = ps.feasibility_index
        ) AND p.poll_index = ps.importance_index 
        THEN pv.user_id 
    END) as paired_users
FROM pair_stats ps
LEFT JOIN polls p ON p.poll_index IN (ps.importance_index, ps.feasibility_index)
    AND p.page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
LEFT JOIN poll_votes pv ON pv.poll_id = p.id
GROUP BY ps.title, ps.importance_index, ps.feasibility_index
ORDER BY ps.importance_index;

-- 7. EXAMPLE QUERY TO CREATE PAIRED DATA FOR GRAPHING
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '7. EXAMPLE: CREATE PAIRED DATA FOR ONE QUESTION PAIR'
\echo '   (This is what the API should do to get individual dots)'
\echo '========================================================================'

WITH importance_votes AS (
    SELECT 
        pv.user_id,
        pv.option_index + 1 as importance_score,
        p.page_path,
        CASE WHEN pv.user_id LIKE 'CEW2025%' THEN 'cew' ELSE 'authenticated' END as user_type
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
    AND p.poll_index = 6  -- Importance question
),
feasibility_votes AS (
    SELECT 
        pv.user_id,
        pv.option_index + 1 as feasibility_score,
        p.page_path
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
    AND p.poll_index = 7  -- Feasibility question
)
SELECT 
    iv.user_id,
    iv.importance_score,
    fv.feasibility_score,
    iv.user_type,
    iv.page_path
FROM importance_votes iv
INNER JOIN feasibility_votes fv 
    ON iv.user_id = fv.user_id 
    AND iv.page_path = fv.page_path
ORDER BY iv.user_type, iv.user_id
LIMIT 20;

\echo ''
\echo '========================================================================'
\echo 'DIAGNOSTIC COMPLETE'
\echo '========================================================================'
\echo ''
\echo 'KEY FINDINGS:'
\echo '- Individual votes are stored separately in poll_votes table'
\echo '- Each vote has: user_id, poll_id, option_index (0-4)'
\echo '- To create paired data points, we need to JOIN votes from'
\echo '  the same user_id across two different poll_index values'
\echo '- Only users who voted on BOTH questions can be plotted as dots'
\echo '- The average (golden star) is calculated from ALL votes,'
\echo '  but individual dots require PAIRED votes'
\echo ''

