-- ============================================================================
-- USER ID ANALYSIS FOR MATRIX GRAPH VOTES
-- Purpose: Understand the actual user_id patterns in the database
-- ============================================================================

-- 1. ANALYZE USER ID PATTERNS FOR HOLISTIC PROTECTION QUESTIONS 6 & 7
-- ============================================================================

-- Get all user_ids and their vote patterns for questions 6 & 7 (Human Health - Food-Related)
WITH holistic_questions_6_7 AS (
    SELECT 
        pv.user_id,
        pv.option_index + 1 as score,
        p.poll_index,
        pv.voted_at,
        ROW_NUMBER() OVER (PARTITION BY pv.user_id, p.poll_index ORDER BY pv.voted_at DESC) as vote_rank
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (6, 7)  -- Questions 6 & 7 (Human Health - Food-Related)
),
user_vote_summary AS (
    SELECT 
        user_id,
        COUNT(*) as total_votes,
        COUNT(DISTINCT poll_index) as questions_voted_on,
        MIN(voted_at) as first_vote,
        MAX(voted_at) as last_vote,
        STRING_AGG(
            CONCAT('Q', poll_index, '=', score, 
                   CASE WHEN vote_rank = 1 THEN ' (LATEST)' ELSE '' END), 
            ', ' ORDER BY poll_index, vote_rank
        ) as vote_details
    FROM holistic_questions_6_7
    GROUP BY user_id
)
SELECT 
    user_id,
    total_votes,
    questions_voted_on,
    first_vote,
    last_vote,
    CASE 
        WHEN questions_voted_on = 2 THEN 'HAS_BOTH_QUESTIONS'
        WHEN questions_voted_on = 1 THEN 'MISSING_ONE_QUESTION'
        ELSE 'UNEXPECTED'
    END as pair_status,
    vote_details
FROM user_vote_summary
ORDER BY 
    total_votes DESC,
    last_vote DESC;

-- 2. ANALYZE USER ID PATTERNS BY TIME PERIOD
-- ============================================================================

-- Group users by time periods to see if there are different test runs
WITH user_time_analysis AS (
    SELECT 
        pv.user_id,
        p.poll_index,
        pv.voted_at,
        DATE_TRUNC('day', pv.voted_at) as vote_date,
        COUNT(*) as votes_per_day
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (6, 7)
    GROUP BY pv.user_id, p.poll_index, pv.voted_at, DATE_TRUNC('day', pv.voted_at)
)
SELECT 
    vote_date,
    COUNT(DISTINCT user_id) as unique_users_per_day,
    SUM(votes_per_day) as total_votes_per_day,
    STRING_AGG(DISTINCT user_id, ', ') as sample_user_ids
FROM user_time_analysis
GROUP BY vote_date
ORDER BY vote_date DESC;

-- 3. ANALYZE USER ID FORMATS AND PATTERNS
-- ============================================================================

-- Look at the different user_id formats to understand the patterns
WITH user_id_patterns AS (
    SELECT 
        pv.user_id,
        CASE 
            WHEN pv.user_id LIKE 'CEW%' THEN 'CEW_PATTERN'
            WHEN pv.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID_PATTERN'
            WHEN pv.user_id LIKE '%_%' THEN 'UNDERSCORE_PATTERN'
            ELSE 'OTHER_PATTERN'
        END as user_id_type,
        COUNT(*) as vote_count,
        MIN(pv.voted_at) as first_vote,
        MAX(pv.voted_at) as last_vote
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (6, 7)
    GROUP BY pv.user_id
)
SELECT 
    user_id_type,
    COUNT(*) as user_count,
    SUM(vote_count) as total_votes,
    MIN(first_vote) as earliest_vote,
    MAX(last_vote) as latest_vote,
    STRING_AGG(user_id, ', ') as sample_user_ids
FROM user_id_patterns
GROUP BY user_id_type
ORDER BY total_votes DESC;

-- 4. DETAILED ANALYSIS OF RECENT VOTES (LAST 24 HOURS)
-- ============================================================================

-- Focus on votes from the last 24 hours to see the most recent test data
WITH recent_votes AS (
    SELECT 
        pv.user_id,
        p.poll_index,
        pv.option_index + 1 as score,
        pv.voted_at,
        ROW_NUMBER() OVER (PARTITION BY pv.user_id, p.poll_index ORDER BY pv.voted_at DESC) as vote_rank
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (6, 7)
    AND pv.voted_at >= NOW() - INTERVAL '24 hours'
),
recent_user_summary AS (
    SELECT 
        user_id,
        COUNT(*) as total_votes,
        COUNT(DISTINCT poll_index) as questions_voted_on,
        STRING_AGG(
            CONCAT('Q', poll_index, '=', score, 
                   CASE WHEN vote_rank = 1 THEN ' (LATEST)' ELSE '' END), 
            ', ' ORDER BY poll_index, vote_rank
        ) as vote_details
    FROM recent_votes
    GROUP BY user_id
)
SELECT 
    user_id,
    total_votes,
    questions_voted_on,
    CASE 
        WHEN questions_voted_on = 2 THEN 'HAS_BOTH_QUESTIONS'
        WHEN questions_voted_on = 1 THEN 'MISSING_ONE_QUESTION'
        ELSE 'UNEXPECTED'
    END as pair_status,
    vote_details
FROM recent_user_summary
ORDER BY 
    total_votes DESC,
    user_id;

-- 5. COUNT USERS WITH COMPLETE PAIRS (QUESTIONS 6 & 7)
-- ============================================================================

-- Count how many users actually have votes on both questions 6 and 7
WITH user_pairs AS (
    SELECT 
        user_id,
        MAX(CASE WHEN poll_index = 6 THEN 1 ELSE 0 END) as has_question_6,
        MAX(CASE WHEN poll_index = 7 THEN 1 ELSE 0 END) as has_question_7
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path LIKE '%holistic-protection%'
    AND p.poll_index IN (6, 7)
    GROUP BY user_id
)
SELECT 
    CASE 
        WHEN has_question_6 = 1 AND has_question_7 = 1 THEN 'HAS_BOTH_QUESTIONS'
        WHEN has_question_6 = 1 THEN 'ONLY_QUESTION_6'
        WHEN has_question_7 = 1 THEN 'ONLY_QUESTION_7'
        ELSE 'NEITHER_QUESTION'
    END as pair_status,
    COUNT(*) as user_count
FROM user_pairs
GROUP BY pair_status
ORDER BY user_count DESC;
