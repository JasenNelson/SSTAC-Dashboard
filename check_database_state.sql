-- Check the current state of the database for duplicate votes
-- This will help us understand what's happening

-- 1. Check if the unique index exists
SELECT 
    'Unique Index Check:' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'poll_votes' 
            AND indexname = 'unique_authenticated_poll_vote'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as status;

-- 2. Check recent votes for poll 7 (the one you were testing)
WITH poll_info AS (
    SELECT id as poll_id, poll_index, page_path
    FROM polls 
    WHERE page_path = '/survey-results/holistic-protection' 
    AND poll_index = 7
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    'Recent Votes for Poll 7:' as check_type,
    pv.id,
    pv.user_id,
    pv.option_index,
    pv.voted_at,
    CASE 
        WHEN pv.user_id LIKE '%session_%' OR pv.user_id LIKE '%CEW%' THEN 'CEW'
        ELSE 'Authenticated'
    END as user_type
FROM poll_votes pv
CROSS JOIN poll_info pi
WHERE pv.poll_id = pi.poll_id
ORDER BY pv.voted_at DESC
LIMIT 10;

-- 3. Count votes by user for poll 7
WITH poll_info AS (
    SELECT id as poll_id, poll_index, page_path
    FROM polls 
    WHERE page_path = '/survey-results/holistic-protection' 
    AND poll_index = 7
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    'Vote Count by User for Poll 7:' as check_type,
    pv.user_id,
    COUNT(*) as vote_count,
    CASE 
        WHEN pv.user_id LIKE '%session_%' OR pv.user_id LIKE '%CEW%' THEN 'CEW'
        ELSE 'Authenticated'
    END as user_type,
    ARRAY_AGG(pv.option_index ORDER BY pv.voted_at) as option_sequence
FROM poll_votes pv
CROSS JOIN poll_info pi
WHERE pv.poll_id = pi.poll_id
GROUP BY pv.user_id
ORDER BY vote_count DESC;

-- 4. Check all indexes on poll_votes table
SELECT 
    'All Indexes on poll_votes:' as check_type,
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'poll_votes';
