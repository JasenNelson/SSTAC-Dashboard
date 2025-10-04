-- Clean up duplicate votes for survey-results pages
-- Keep only the most recent vote for each (poll_id, user_id) pair for authenticated users

WITH ranked_votes AS (
    SELECT 
        pv.id,
        pv.poll_id,
        pv.user_id,
        pv.voted_at,
        p.poll_index,
        p.page_path,
        ROW_NUMBER() OVER (
            PARTITION BY pv.poll_id, pv.user_id 
            ORDER BY pv.voted_at DESC
        ) as rn
    FROM poll_votes pv
    JOIN polls p ON pv.poll_id = p.id
    WHERE p.page_path LIKE '/survey-results/%'
    AND pv.user_id NOT LIKE '%session_%' 
    AND pv.user_id NOT LIKE '%CEW%'
)
SELECT 
    'Votes to be deleted:' as action,
    COUNT(*) as count
FROM ranked_votes 
WHERE rn > 1

UNION ALL

SELECT 
    'Votes to be kept:' as action,
    COUNT(*) as count
FROM ranked_votes 
WHERE rn = 1

UNION ALL

SELECT 
    'Total votes before cleanup:' as action,
    COUNT(*) as count
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path LIKE '/survey-results/%'
AND pv.user_id NOT LIKE '%session_%' 
AND pv.user_id NOT LIKE '%CEW%';

-- Uncomment the DELETE statement below to actually perform the cleanup
-- DELETE FROM poll_votes 
-- WHERE id IN (
--     SELECT id 
--     FROM ranked_votes 
--     WHERE rn > 1
-- );
