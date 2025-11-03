-- ============================================================================
-- CHECK PRIORITIZATION QUESTION OPTIONS
-- ============================================================================
-- Purpose: Verify that prioritization questions have all 5 options like holistic questions
-- ============================================================================

-- Check prioritization questions and their options
SELECT 
  p.page_path,
  p.poll_index,
  LEFT(p.question, 80) as question_preview,
  p.options,
  jsonb_array_length(p.options) as option_count,
  COUNT(pv.id) as total_votes
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path IN ('/cew-polls/prioritization', '/survey-results/prioritization')
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options
ORDER BY p.page_path, p.poll_index;

-- Check if there are any votes for prioritization questions
SELECT 
  p.page_path,
  p.poll_index,
  LEFT(p.question, 60) as question_preview,
  COUNT(pv.id) as vote_count,
  COUNT(DISTINCT pv.user_id) as unique_users
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path IN ('/cew-polls/prioritization', '/survey-results/prioritization')
GROUP BY p.page_path, p.poll_index, p.question
ORDER BY p.page_path, p.poll_index;

-- Check ranking polls for prioritization
SELECT 
  rp.page_path,
  rp.poll_index,
  LEFT(rp.question, 60) as question_preview,
  rp.options,
  jsonb_array_length(rp.options) as option_count,
  COUNT(rv.id) as total_votes
FROM ranking_polls rp
LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id
WHERE rp.page_path IN ('/cew-polls/prioritization', '/survey-results/prioritization')
GROUP BY rp.id, rp.page_path, rp.poll_index, rp.question, rp.options
ORDER BY rp.page_path, rp.poll_index;

-- Check wordcloud polls for prioritization
SELECT 
  wp.page_path,
  wp.poll_index,
  LEFT(wp.question, 60) as question_preview,
  wp.max_words,
  COUNT(wv.id) as total_votes
FROM wordcloud_polls wp
LEFT JOIN wordcloud_votes wv ON wp.id = wv.wordcloud_poll_id
WHERE wp.page_path IN ('/cew-polls/prioritization', '/survey-results/prioritization')
GROUP BY wp.id, wp.page_path, wp.poll_index, wp.question, wp.max_words
ORDER BY wp.page_path, wp.poll_index;
