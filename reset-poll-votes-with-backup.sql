-- Reset Poll Votes Script with Backup
-- This script will backup existing votes and then reset them to 0
-- Safer option for production testing

BEGIN;

-- Create backup tables (optional - for extra safety)
CREATE TABLE IF NOT EXISTS poll_votes_backup AS SELECT * FROM poll_votes;
CREATE TABLE IF NOT EXISTS ranking_votes_backup AS SELECT * FROM ranking_votes;

-- Add timestamp to backup tables
ALTER TABLE poll_votes_backup ADD COLUMN IF NOT EXISTS backup_created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE ranking_votes_backup ADD COLUMN IF NOT EXISTS backup_created_at TIMESTAMP DEFAULT NOW();

-- Clear all single-choice poll votes
DELETE FROM poll_votes;

-- Clear all ranking poll votes  
DELETE FROM ranking_votes;

COMMIT;

-- Verify the reset worked
SELECT 'Backup created with timestamp: ' || NOW() as status;
SELECT 'Single-choice poll votes after reset:' as check_type, COUNT(*) as vote_count FROM poll_votes
UNION ALL
SELECT 'Ranking poll votes after reset:' as check_type, COUNT(*) as vote_count FROM ranking_votes
UNION ALL
SELECT 'Poll results entries:' as check_type, COUNT(*) as vote_count FROM poll_results
UNION ALL
SELECT 'Ranking results entries:' as check_type, COUNT(*) as vote_count FROM ranking_results;

-- Show backup counts
SELECT 'Backup - Single-choice votes:' as check_type, COUNT(*) as backup_count FROM poll_votes_backup
UNION ALL
SELECT 'Backup - Ranking votes:' as check_type, COUNT(*) as backup_count FROM ranking_votes_backup;
