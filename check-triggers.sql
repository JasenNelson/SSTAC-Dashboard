-- Check for triggers that might be modifying poll_index
-- Run this script to investigate poll_index 999 issue

-- 1. Check all triggers on poll_votes table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'poll_votes'
ORDER BY trigger_name;

-- 2. Check all triggers on polls table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE event_object_table = 'polls'
ORDER BY trigger_name;

-- 3. Check for any functions that might modify poll_index
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%poll_index%'
   OR routine_definition ILIKE '%999%'
ORDER BY routine_name;

-- 4. Check recent poll_votes to see poll_index values
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
ORDER BY pv.voted_at DESC;

-- 5. Check if there are any polls with poll_index 999
SELECT 
    id,
    page_path,
    poll_index,
    question,
    created_at
FROM polls 
WHERE poll_index = 999
ORDER BY created_at DESC;

-- 6. Check the get_or_create_poll function definition
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_poll';

-- 7. Check for any constraints or rules on poll_index
SELECT 
    constraint_name,
    table_name,
    column_name
FROM information_schema.constraint_column_usage 
WHERE column_name = 'poll_index'
   OR table_name = 'poll_votes'
   OR table_name = 'polls';

-- 8. Check recent poll creation activity
SELECT 
    id,
    page_path,
    poll_index,
    created_at
FROM polls 
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC;
