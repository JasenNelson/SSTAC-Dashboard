-- Check poll indices for matrix graph questions
SELECT 
    id,
    page_path,
    poll_index,
    LEFT(question, 50) as question_preview
FROM polls 
WHERE page_path LIKE '%holistic-protection%' 
   OR page_path LIKE '%prioritization%'
ORDER BY page_path, poll_index;

-- Check recent votes to see what poll indices are being used
SELECT 
    p.page_path,
    p.poll_index,
    pv.user_id,
    pv.option_index,
    pv.voted_at
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE pv.voted_at > NOW() - INTERVAL '2 hours'
ORDER BY pv.voted_at DESC
LIMIT 20;

-- Check poll_results view to see what's available
SELECT 
    page_path,
    poll_index,
    COUNT(*) as vote_count
FROM poll_results
WHERE page_path LIKE '%holistic-protection%' 
   OR page_path LIKE '%prioritization%'
GROUP BY page_path, poll_index
ORDER BY page_path, poll_index;
