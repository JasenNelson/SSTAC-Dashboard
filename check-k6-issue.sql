-- Focused script to check K6 testing issue
-- Run each query separately to get specific results

-- 1. Check for polls with poll_index 999
SELECT 
    id,
    page_path,
    poll_index,
    question,
    created_at
FROM polls 
WHERE poll_index = 999;

-- 2. Check recent poll_votes to see what poll_index values are being stored
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
WHERE pv.voted_at > NOW() - INTERVAL '2 hours'
ORDER BY pv.voted_at DESC
LIMIT 10;

-- 3. Check if there are any votes with user_id containing 'test_session'
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
ORDER BY pv.voted_at DESC;

-- 4. Check the get_or_create_poll function definition
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_poll';

-- 5. Check all triggers on poll_votes table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'poll_votes';
