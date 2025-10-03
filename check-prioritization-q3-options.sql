-- Check Question 3 options in prioritization ranking polls
-- Question 3 should be poll_index 2 (0-based indexing)

SELECT 
    poll_index,
    question,
    options,
    created_at
FROM ranking_polls 
WHERE page_path LIKE '%prioritization%' 
  AND poll_index = 2
ORDER BY created_at DESC;

-- Also check if there are any other ranking polls with similar question text
SELECT 
    poll_index,
    question,
    options,
    created_at
FROM ranking_polls 
WHERE page_path LIKE '%prioritization%' 
  AND question LIKE '%matrix standards%'
ORDER BY created_at DESC;
