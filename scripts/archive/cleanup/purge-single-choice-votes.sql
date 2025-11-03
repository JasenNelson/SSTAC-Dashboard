-- Purge all single-choice poll votes to start fresh testing
-- This will clear all votes from poll_votes table

-- First, let's see what we're deleting
SELECT 
  'BEFORE DELETE - Vote count by poll' as status,
  p.poll_index,
  p.question,
  COUNT(pv.id) as vote_count
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path LIKE '/cew-polls/holistic-protection'
GROUP BY p.id, p.poll_index, p.question
ORDER BY p.poll_index;

-- Delete all single-choice poll votes
DELETE FROM poll_votes;

-- Verify deletion
SELECT 
  'AFTER DELETE - Vote count by poll' as status,
  p.poll_index,
  p.question,
  COUNT(pv.id) as vote_count
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path LIKE '/cew-polls/holistic-protection'
GROUP BY p.id, p.poll_index, p.question
ORDER BY p.poll_index;

-- Show total votes remaining (should be 0)
SELECT COUNT(*) as remaining_votes FROM poll_votes;
