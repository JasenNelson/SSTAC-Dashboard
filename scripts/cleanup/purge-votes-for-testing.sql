-- Purge all votes for testing the new histogram design
-- This will clear all vote data so we can test with fresh, lower vote counts

-- Clear single-choice poll votes
DELETE FROM poll_votes;

-- Clear ranking poll votes  
DELETE FROM ranking_votes;

-- Clear wordcloud poll votes
DELETE FROM wordcloud_votes;

-- Verify the purge worked
SELECT 'Single-choice votes remaining:' as vote_type, COUNT(*) as count FROM poll_votes
UNION ALL
SELECT 'Ranking votes remaining:' as vote_type, COUNT(*) as count FROM ranking_votes  
UNION ALL
SELECT 'Wordcloud votes remaining:' as vote_type, COUNT(*) as count FROM wordcloud_votes;

-- Show current poll structure (should still exist)
SELECT 'Polls table count:' as table_name, COUNT(*) as count FROM polls
UNION ALL
SELECT 'Ranking polls table count:' as table_name, COUNT(*) as count FROM ranking_polls
UNION ALL  
SELECT 'Wordcloud polls table count:' as table_name, COUNT(*) as count FROM wordcloud_polls;
