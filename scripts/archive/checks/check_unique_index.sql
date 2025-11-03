-- Check if the partial unique index exists on poll_votes table
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'poll_votes' 
AND indexname = 'unique_authenticated_poll_vote';

-- Check all indexes on poll_votes table
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'poll_votes';
