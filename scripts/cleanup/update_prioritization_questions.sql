-- Update Prioritization Polling Questions
-- Phase 1: Database Updates
-- This script updates the question text for prioritization polls

-- ============================================================================
-- BACKUP EXISTING DATA (for safety)
-- ============================================================================
CREATE TABLE IF NOT EXISTS polls_backup_prioritization AS 
SELECT * FROM polls WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization');

CREATE TABLE IF NOT EXISTS ranking_polls_backup_prioritization AS 
SELECT * FROM ranking_polls WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization');

CREATE TABLE IF NOT EXISTS wordcloud_polls_backup_prioritization AS 
SELECT * FROM wordcloud_polls WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization');

-- ============================================================================
-- UPDATE POLLS TABLE (Questions 1-2: Single-Choice)
-- ============================================================================

-- Update Question 1 (poll_index 0): Importance
UPDATE polls 
SET question = 'Rank the importance of incorporating bioavailability adjustments into sediment standards. (1 = very important to 5 = not important)'
WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization') 
AND poll_index = 0;

-- Update Question 2 (poll_index 1): Feasibility  
UPDATE polls 
SET question = 'Rank the feasibility of incorporating bioavailability adjustments into sediment standards. (1 = easily achievable to 5 = not feasible)'
WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization') 
AND poll_index = 1;

-- ============================================================================
-- UPDATE RANKING_POLLS TABLE (Questions 3-4: Ranking)
-- ============================================================================

-- Update Question 3 (poll_index 2): Matrix Standards
UPDATE ranking_polls 
SET question = 'To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve utility of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.'
WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization') 
AND poll_index = 2;

-- Update Question 4 (poll_index 3): Holistic Management
UPDATE ranking_polls 
SET question = 'Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)'
WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization') 
AND poll_index = 3;

-- ============================================================================
-- UPDATE WORDCLOUD_POLLS TABLE (Question 5: Wordcloud)
-- ============================================================================

-- Update Question 5 (poll_index 4): Greatest Constraint
UPDATE wordcloud_polls 
SET question = 'Overall, what is the greatest constraint to advancing holistic sediment protection in BC?'
WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization') 
AND poll_index = 4;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify polls table updates
SELECT 'POLLS TABLE UPDATES:' as verification;
SELECT page_path, poll_index, question 
FROM polls 
WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization') 
ORDER BY page_path, poll_index;

-- Verify ranking_polls table updates  
SELECT 'RANKING_POLLS TABLE UPDATES:' as verification;
SELECT page_path, poll_index, question 
FROM ranking_polls 
WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization') 
ORDER BY page_path, poll_index;

-- Verify wordcloud_polls table updates
SELECT 'WORDCLOUD_POLLS TABLE UPDATES:' as verification;
SELECT page_path, poll_index, question 
FROM wordcloud_polls 
WHERE page_path IN ('/survey-results/prioritization', '/cew-polls/prioritization') 
ORDER BY page_path, poll_index;
