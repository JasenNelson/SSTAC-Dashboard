-- Test the RLS policies for wordcloud_votes
-- This will help us verify that the policies are working correctly

-- Check current RLS policies on wordcloud_votes
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'wordcloud_votes'
ORDER BY policyname;

-- Check if RLS is enabled on wordcloud_votes
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'wordcloud_votes';

-- Test data to verify policies work
-- This simulates what the k6 test should be doing
INSERT INTO wordcloud_votes (poll_id, user_id, word)
SELECT 
  wp.id as poll_id,
  'CEW2025' as user_id,
  'test_word_' || wp.poll_index as word
FROM wordcloud_polls wp
WHERE wp.page_path = '/cew-polls/prioritization' 
  AND wp.poll_index = 12
LIMIT 1;

-- Check if the test insert worked
SELECT 
  wv.id,
  wv.poll_id,
  wv.user_id,
  wv.word,
  wp.page_path,
  wp.poll_index
FROM wordcloud_votes wv
JOIN wordcloud_polls wp ON wv.poll_id = wp.id
WHERE wv.user_id = 'CEW2025'
  AND wv.word LIKE 'test_word_%'
ORDER BY wv.created_at DESC
LIMIT 5;
