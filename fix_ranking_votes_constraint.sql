-- Fix Ranking Votes Constraint for CEW Polls
-- Remove the unique constraint that prevents multiple votes per CEW code

-- Check current constraints on ranking_votes table
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'ranking_votes'::regclass;

-- Remove the problematic constraint
ALTER TABLE ranking_votes DROP CONSTRAINT IF EXISTS ranking_votes_ranking_poll_id_user_id_option_index_key;

-- Verify constraint is removed
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'ranking_votes'::regclass;
