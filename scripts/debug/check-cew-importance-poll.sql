-- Check if there's a CEW importance poll for holistic-protection poll_index 0
SELECT 
  p.id,
  p.page_path,
  p.poll_index,
  LEFT(p.question, 100) as question_preview,
  COUNT(pv.id) as vote_count
FROM polls p 
LEFT JOIN poll_votes pv ON p.id = pv.poll_id 
WHERE p.page_path = '/cew-polls/holistic-protection' 
  AND p.poll_index = 0
GROUP BY p.id, p.page_path, p.poll_index, p.question;

-- Check if your vote was submitted to this CEW importance poll
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
