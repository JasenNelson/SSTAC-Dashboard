-- Check current vote counts in all poll systems
-- This will help us understand what votes exist and what the k6 tests should be creating

-- Check single-choice polls
SELECT 
  'Single-choice polls' as poll_type,
  page_path,
  poll_index,
  question,
  COUNT(pv.id) as vote_count
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
GROUP BY p.id, page_path, poll_index, question
ORDER BY page_path, poll_index;

-- Check ranking polls  
SELECT 
  'Ranking polls' as poll_type,
  page_path,
  poll_index,
  question,
  COUNT(DISTINCT rv.user_id) as unique_participants
FROM ranking_polls rp
LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id
GROUP BY rp.id, page_path, poll_index, question
ORDER BY page_path, poll_index;

-- Check wordcloud polls
SELECT 
  'Wordcloud polls' as poll_type,
  page_path,
  poll_index,
  question,
  COUNT(DISTINCT wv.user_id) as unique_participants,
  COUNT(wv.id) as total_words
FROM wordcloud_polls wp
LEFT JOIN wordcloud_votes wv ON wp.id = wv.poll_id
GROUP BY wp.id, page_path, poll_index, question
ORDER BY page_path, poll_index;

-- Check if polls exist for all expected questions
SELECT 
  'Missing polls check' as check_type,
  expected.page_path,
  expected.poll_index,
  expected.question
FROM (
  -- Prioritization questions (0-12)
  SELECT '/cew-polls/prioritization' as page_path, 0 as poll_index, 'Question 1' as question
  UNION ALL SELECT '/cew-polls/prioritization', 1, 'Question 2'
  UNION ALL SELECT '/cew-polls/prioritization', 2, 'Question 3'
  UNION ALL SELECT '/cew-polls/prioritization', 3, 'Question 4'
  UNION ALL SELECT '/cew-polls/prioritization', 4, 'Question 5'
  UNION ALL SELECT '/cew-polls/prioritization', 5, 'Question 6'
  UNION ALL SELECT '/cew-polls/prioritization', 6, 'Question 7'
  UNION ALL SELECT '/cew-polls/prioritization', 7, 'Question 8'
  UNION ALL SELECT '/cew-polls/prioritization', 8, 'Question 9'
  UNION ALL SELECT '/cew-polls/prioritization', 9, 'Question 10'
  UNION ALL SELECT '/cew-polls/prioritization', 10, 'Question 11'
  UNION ALL SELECT '/cew-polls/prioritization', 11, 'Question 12'
  UNION ALL SELECT '/cew-polls/prioritization', 12, 'Question 13 (Wordcloud)'
  
  -- Holistic protection questions (0-2)
  UNION ALL SELECT '/cew-polls/holistic-protection', 0, 'Question 1'
  UNION ALL SELECT '/cew-polls/holistic-protection', 1, 'Question 2'
  UNION ALL SELECT '/cew-polls/holistic-protection', 2, 'Question 3'
  
  -- Tiered framework questions (0-2)
  UNION ALL SELECT '/cew-polls/tiered-framework', 0, 'Question 1'
  UNION ALL SELECT '/cew-polls/tiered-framework', 1, 'Question 2'
  UNION ALL SELECT '/cew-polls/tiered-framework', 2, 'Question 3 (Wordcloud)'
) expected
LEFT JOIN (
  SELECT p.page_path, p.poll_index FROM polls p
  UNION ALL
  SELECT rp.page_path, rp.poll_index FROM ranking_polls rp
  UNION ALL
  SELECT wp.page_path, wp.poll_index FROM wordcloud_polls wp
) actual ON expected.page_path = actual.page_path AND expected.poll_index = actual.poll_index
WHERE actual.page_path IS NULL
ORDER BY expected.page_path, expected.poll_index;
