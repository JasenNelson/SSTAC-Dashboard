-- Test Poll System Functionality
-- Run this in your Supabase SQL Editor to check if the poll system is working

-- 1. Check if poll tables exist
SELECT 'Checking poll tables...' as test_step;
SELECT table_name, 'EXISTS' as status 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('polls', 'poll_votes', 'poll_results');

-- 2. Check if poll functions exist
SELECT 'Checking poll functions...' as test_step;
SELECT routine_name, 'EXISTS' as status 
FROM information_schema.routines 
WHERE routine_name IN ('get_or_create_poll', 'submit_poll_vote', 'get_poll_results');

-- 3. Check if poll views exist
SELECT 'Checking poll views...' as test_step;
SELECT table_name, 'EXISTS' as status 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'poll_results';

-- 4. Test poll creation function
SELECT 'Testing poll creation...' as test_step;
SELECT get_or_create_poll(
    '/test-page'::VARCHAR(255),
    0::INTEGER,
    'Test Question'::TEXT,
    '["Option 1", "Option 2"]'::JSONB
) as test_poll_id;

-- 5. Check if poll was created
SELECT 'Checking created poll...' as test_step;
SELECT id, page_path, poll_index, question, options 
FROM polls 
WHERE page_path = '/test-page' AND poll_index = 0;

-- 6. Test vote submission (this will fail if not authenticated, but that's expected)
SELECT 'Testing vote submission...' as test_step;
-- Note: This will only work if you're authenticated as a user
-- SELECT submit_poll_vote(
--     (SELECT id FROM polls WHERE page_path = '/test-page' AND poll_index = 0),
--     0::INTEGER
-- ) as vote_result;

-- 7. Clean up test data
SELECT 'Cleaning up test data...' as test_step;
DELETE FROM polls WHERE page_path = '/test-page' AND poll_index = 0;
