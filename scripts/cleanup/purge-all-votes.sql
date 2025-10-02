-- Purge all votes from the database
-- This will clear all poll votes, ranking votes, and wordcloud votes
-- Use this to test with fresh data after fixing user ID generation

-- Delete all poll votes
DELETE FROM poll_votes;

-- Delete all ranking votes  
DELETE FROM ranking_votes;

-- Delete all wordcloud votes
DELETE FROM wordcloud_votes;

-- Reset any auto-increment counters if needed
-- (PostgreSQL doesn't need this, but included for completeness)

-- Verify the cleanup
SELECT 'Poll votes remaining:' as table_name, COUNT(*) as count FROM poll_votes
UNION ALL
SELECT 'Ranking votes remaining:', COUNT(*) FROM ranking_votes  
UNION ALL
SELECT 'Wordcloud votes remaining:', COUNT(*) FROM wordcloud_votes;