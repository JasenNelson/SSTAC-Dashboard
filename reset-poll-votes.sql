-- Reset Poll Votes Script
-- This script will reset all poll votes to 0 for testing purposes
-- Run this in your Supabase SQL Editor before the event

-- WARNING: This will delete ALL poll votes from the database
-- Make sure you're connected to the correct database (production vs development)

BEGIN;

-- Clear all single-choice poll votes
DELETE FROM poll_votes;

-- Clear all ranking poll votes  
DELETE FROM ranking_votes;

-- Reset any cached results (these will regenerate automatically)
-- Note: poll_results and ranking_results are views, so they'll update automatically

-- Optional: Reset any user sessions or cached data
-- DELETE FROM user_sessions WHERE session_type = 'cew_poll';

COMMIT;

-- Verify the reset worked
SELECT 'Single-choice poll votes after reset:' as check_type, COUNT(*) as vote_count FROM poll_votes
UNION ALL
SELECT 'Ranking poll votes after reset:' as check_type, COUNT(*) as vote_count FROM ranking_votes
UNION ALL
SELECT 'Poll results entries:' as check_type, COUNT(*) as vote_count FROM poll_results
UNION ALL
SELECT 'Ranking results entries:' as check_type, COUNT(*) as vote_count FROM ranking_results;
