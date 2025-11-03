-- Debug K6 votes to see what's happening
-- Run this after running the K6 test

-- 1. Check if K6 votes are being stored at all
SELECT 
    pv.id,
    pv.poll_id,
    p.poll_index,
    p.page_path,
    pv.user_id,
    pv.option_index,
    pv.voted_at
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id LIKE '%test_session%'
ORDER BY pv.voted_at DESC
LIMIT 10;

-- 2. Check if new polls were created by K6 test
SELECT 
    id,
    page_path,
    poll_index,
    question,
    created_at
FROM polls 
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 3. Check poll_results view to see what's available
SELECT 
    page_path,
    poll_index,
    responses,
    created_at
FROM poll_results
WHERE page_path LIKE '%cew-polls%'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if there are any votes in the last 10 minutes
SELECT 
    COUNT(*) as total_votes,
    COUNT(DISTINCT pv.poll_id) as unique_polls,
    COUNT(DISTINCT pv.user_id) as unique_users
FROM poll_votes pv
WHERE pv.voted_at > NOW() - INTERVAL '10 minutes';

-- 5. Check the specific polls that should be used for matrix graphs
SELECT 
    p.id,
    p.page_path,
    p.poll_index,
    COUNT(pv.id) as vote_count
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path IN ('/cew-polls/holistic-protection', '/cew-polls/prioritization')
  AND p.poll_index IN (0, 1, 2, 3, 4, 5, 6, 7)
GROUP BY p.id, p.page_path, p.poll_index
ORDER BY p.page_path, p.poll_index;
