-- Clean up old Tiered Framework polls from database
-- This will remove all polls that don't match the current 3 questions

-- First, let's see what we have
SELECT 'Current polls in database:' as info;
SELECT page_path, poll_index, question FROM polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index;

SELECT 'Current ranking polls in database:' as info;
SELECT page_path, poll_index, question FROM ranking_polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index;

SELECT 'Current wordcloud polls in database:' as info;
SELECT page_path, poll_index, question FROM wordcloud_polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index;

-- Delete old polls that don't match the correct 3 questions
-- The correct questions should be:
-- 1. "What is the primary regulatory advantage of using a probabilistic framework..."
-- 2. "In developing a probabilistic framework for deriving site-specific sediment standards..."
-- 3. "What is the biggest practical hurdle to overcome when implementing a Bayesian framework..."

-- Delete polls that don't match these questions
DELETE FROM polls 
WHERE page_path LIKE '%tiered-framework%' 
AND question NOT LIKE '%primary regulatory advantage of using a probabilistic framework%'
AND question NOT LIKE '%data type is most critical for effectively narrowing the uncertainty%'
AND question NOT LIKE '%biggest practical hurdle to overcome when implementing a Bayesian framework%';

-- Delete ranking polls that don't match (there shouldn't be any for Tiered Framework)
DELETE FROM ranking_polls 
WHERE page_path LIKE '%tiered-framework%';

-- Delete wordcloud polls that don't match (there shouldn't be any for Tiered Framework)
DELETE FROM wordcloud_polls 
WHERE page_path LIKE '%tiered-framework%';

-- Also delete any votes for the deleted polls
DELETE FROM poll_votes 
WHERE poll_id IN (
  SELECT id FROM polls WHERE page_path LIKE '%tiered-framework%'
);

DELETE FROM ranking_votes 
WHERE ranking_poll_id IN (
  SELECT id FROM ranking_polls WHERE page_path LIKE '%tiered-framework%'
);

DELETE FROM wordcloud_votes 
WHERE poll_id IN (
  SELECT id FROM wordcloud_polls WHERE page_path LIKE '%tiered-framework%'
);

-- Show what's left
SELECT 'After cleanup - polls:' as info;
SELECT page_path, poll_index, question FROM polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index;

SELECT 'After cleanup - ranking polls:' as info;
SELECT page_path, poll_index, question FROM ranking_polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index;

SELECT 'After cleanup - wordcloud polls:' as info;
SELECT page_path, poll_index, question FROM wordcloud_polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index;
