-- ============================================================================
-- MATRIX VOTE DIAGNOSTICS SCRIPT
-- Purpose: Understand why some matrix graphs show individual pairs and others don't
-- ============================================================================

-- 1. EXAMINE HOLISTIC PROTECTION POLL STRUCTURE
-- ============================================================================
\echo '========================================================================'
\echo '1. HOLISTIC PROTECTION POLL STRUCTURE'
\echo '========================================================================'

SELECT 
    poll_index,
    page_path,
    LEFT(question, 80) as question_preview,
    id,
    created_at
FROM polls 
WHERE page_path LIKE '%holistic-protection%'
ORDER BY page_path, poll_index;

-- 2. EXAMINE INDIVIDUAL VOTES FOR EACH POLL
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '2. INDIVIDUAL VOTES BY POLL (showing first 10 votes per poll)'
\echo '========================================================================'

-- Get poll IDs for holistic protection
WITH holistic_polls AS (
    SELECT id, poll_index, page_path
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
)
SELECT 
    hp.page_path,
    hp.poll_index,
    pv.user_id,
    pv.option_index,
    pv.option_index + 1 as score,
    pv.voted_at
FROM holistic_polls hp
JOIN poll_votes pv ON hp.id = pv.poll_id
ORDER BY hp.page_path, hp.poll_index, pv.voted_at
LIMIT 40;

-- 3. CHECK USER VOTE PATTERNS
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '3. USER VOTE PATTERNS - Who voted on which questions?'
\echo '========================================================================'

WITH holistic_polls AS (
    SELECT id, poll_index, page_path
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
),
user_votes AS (
    SELECT 
        hp.page_path,
        hp.poll_index,
        pv.user_id,
        pv.option_index + 1 as score
    FROM holistic_polls hp
    JOIN poll_votes pv ON hp.id = pv.poll_id
)
SELECT 
    user_id,
    STRING_AGG(
        CONCAT(page_path, ' Q', poll_index::text, '=', score::text), 
        ', ' ORDER BY page_path, poll_index
    ) as vote_pattern
FROM user_votes
GROUP BY user_id
ORDER BY user_id;

-- 4. SPECIFIC PAIRING ANALYSIS
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '4. SPECIFIC PAIRING ANALYSIS - Matrix Standards (Ecosystem Health - Direct Toxicity)'
\echo '   Looking for users who voted on both poll_index 0 AND poll_index 1'
\echo '========================================================================'

-- Get poll IDs for the first matrix pair (poll_index 0 and 1)
WITH target_polls AS (
    SELECT id, poll_index, page_path
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
    AND poll_index IN (0, 1)
),
user_votes AS (
    SELECT 
        tp.poll_index,
        pv.user_id,
        pv.option_index + 1 as score
    FROM target_polls tp
    JOIN poll_votes pv ON tp.id = pv.poll_id
),
paired_users AS (
    SELECT 
        uv1.user_id,
        uv1.score as importance_score,
        uv2.score as feasibility_score
    FROM user_votes uv1
    JOIN user_votes uv2 ON uv1.user_id = uv2.user_id
    WHERE uv1.poll_index = 0 AND uv2.poll_index = 1
)
SELECT 
    user_id,
    importance_score,
    feasibility_score,
    CASE 
        WHEN user_id LIKE 'CEW%' THEN 'cew'
        ELSE 'authenticated'
    END as user_type
FROM paired_users
ORDER BY user_id;

-- 5. COMPARE WITH WORKING PAIR
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '5. COMPARE WITH WORKING PAIR - Matrix Standards (Human Health - Food-Related)'
\echo '   Looking for users who voted on both poll_index 6 AND poll_index 7'
\echo '========================================================================'

WITH target_polls AS (
    SELECT id, poll_index, page_path
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
    AND poll_index IN (6, 7)
),
user_votes AS (
    SELECT 
        tp.poll_index,
        pv.user_id,
        pv.option_index + 1 as score
    FROM target_polls tp
    JOIN poll_votes pv ON tp.id = pv.poll_id
),
paired_users AS (
    SELECT 
        uv1.user_id,
        uv1.score as importance_score,
        uv2.score as feasibility_score
    FROM user_votes uv1
    JOIN user_votes uv2 ON uv1.user_id = uv2.user_id
    WHERE uv1.poll_index = 6 AND uv2.poll_index = 7
)
SELECT 
    user_id,
    importance_score,
    feasibility_score,
    CASE 
        WHEN user_id LIKE 'CEW%' THEN 'cew'
        ELSE 'authenticated'
    END as user_type
FROM paired_users
ORDER BY user_id;

-- 6. VOTE COUNT SUMMARY
-- ============================================================================
\echo ''
\echo '========================================================================'
\echo '6. VOTE COUNT SUMMARY BY POLL'
\echo '========================================================================'

WITH holistic_polls AS (
    SELECT id, poll_index, page_path, LEFT(question, 60) as question_preview
    FROM polls 
    WHERE page_path LIKE '%holistic-protection%'
)
SELECT 
    hp.page_path,
    hp.poll_index,
    hp.question_preview,
    COUNT(pv.id) as vote_count,
    COUNT(DISTINCT pv.user_id) as unique_users
FROM holistic_polls hp
LEFT JOIN poll_votes pv ON hp.id = pv.poll_id
GROUP BY hp.id, hp.page_path, hp.poll_index, hp.question_preview
ORDER BY hp.page_path, hp.poll_index;
