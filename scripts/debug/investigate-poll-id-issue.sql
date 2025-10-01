-- Investigate Poll ID Issue for Matrix Graph Individual Data Points
-- This query will help understand why the matrix API can't find the submitted votes

-- 1. Check what poll your vote was submitted to
SELECT 
  p.id,
  p.page_path,
  p.poll_index,
  LEFT(p.question, 100) as question_preview,
  COUNT(pv.id) as vote_count
FROM polls p 
LEFT JOIN poll_votes pv ON p.id = pv.poll_id 
WHERE p.id = '77585641-9cf8-4443-8847-08df7d2a4041'
GROUP BY p.id, p.page_path, p.poll_index, p.question;

-- 2. Check all polls for holistic-protection pages
SELECT 
  p.id,
  p.page_path,
  p.poll_index,
  LEFT(p.question, 100) as question_preview,
  COUNT(pv.id) as vote_count
FROM polls p 
LEFT JOIN poll_votes pv ON p.id = pv.poll_id 
WHERE p.page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
GROUP BY p.id, p.page_path, p.poll_index, p.question
ORDER BY p.page_path, p.poll_index;

-- 3. Check what votes exist for your user_id
SELECT 
  pv.user_id,
  pv.poll_id,
  p.page_path,
  p.poll_index,
  pv.option_index,
  pv.voted_at
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.user_id = 'CEW2025_session_1759271021789_2pm8w2'
ORDER BY pv.voted_at;

-- 4. Check the specific poll IDs the matrix API is looking for
SELECT 
  p.id,
  p.page_path,
  p.poll_index,
  LEFT(p.question, 100) as question_preview,
  COUNT(pv.id) as vote_count
FROM polls p 
LEFT JOIN poll_votes pv ON p.id = pv.poll_id 
WHERE p.id IN (
  'b06d4e95-5561-4d4e-bcdf-0eb46218d0e3',  -- Matrix API importance poll ID
  'fb1d9b68-3163-4b4c-822b-f0ff7e7d2385'   -- Matrix API feasibility poll ID
)
GROUP BY p.id, p.page_path, p.poll_index, p.question;
