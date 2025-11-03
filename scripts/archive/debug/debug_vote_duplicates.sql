-- Debug script to investigate duplicate vote issue
-- Check recent votes for a specific poll to see if duplicates are being created

-- First, let's see what polls exist for holistic-protection page
SELECT 
    id,
    page_path,
    poll_index,
    question,
    created_at
FROM polls 
WHERE page_path = '/survey-results/holistic-protection'
ORDER BY poll_index, created_at;

-- Check if the unique index exists
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'poll_votes' 
AND indexname = 'unique_authenticated_poll_vote';

-- Check recent votes for the first poll (poll_index 0) on holistic-protection page
-- Replace the poll_id with the actual ID from the first query
WITH poll_info AS (
    SELECT id as poll_id, poll_index
    FROM polls 
    WHERE page_path = '/survey-results/holistic-protection' 
    AND poll_index = 0
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    pv.id,
    pv.poll_id,
    pv.user_id,
    pv.option_index,
    pv.other_text,
    pv.voted_at,
    pi.poll_index,
    CASE 
        WHEN pv.user_id LIKE '%session_%' OR pv.user_id LIKE '%CEW%' THEN 'CEW'
        ELSE 'Authenticated'
    END as user_type
FROM poll_votes pv
CROSS JOIN poll_info pi
WHERE pv.poll_id = pi.poll_id
ORDER BY pv.voted_at DESC
LIMIT 20;

-- Count votes by user_id for the same poll
WITH poll_info AS (
    SELECT id as poll_id, poll_index
    FROM polls 
    WHERE page_path = '/survey-results/holistic-protection' 
    AND poll_index = 0
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    pv.user_id,
    COUNT(*) as vote_count,
    CASE 
        WHEN pv.user_id LIKE '%session_%' OR pv.user_id LIKE '%CEW%' THEN 'CEW'
        ELSE 'Authenticated'
    END as user_type,
    ARRAY_AGG(pv.option_index ORDER BY pv.voted_at) as option_sequence,
    ARRAY_AGG(pv.voted_at ORDER BY pv.voted_at) as vote_times
FROM poll_votes pv
CROSS JOIN poll_info pi
WHERE pv.poll_id = pi.poll_id
GROUP BY pv.user_id
ORDER BY vote_count DESC;
