-- Fix Tiered Framework Database Issues
-- This script will clean up old polls and create the correct 3 Tiered Framework polls

-- Step 1: Check current state
SELECT 'BEFORE CLEANUP - Current Tiered Framework polls:' as info;
SELECT page_path, poll_index, LEFT(question, 80) as question_preview 
FROM polls 
WHERE page_path LIKE '%tiered-framework%' 
ORDER BY page_path, poll_index;

SELECT 'BEFORE CLEANUP - Current Tiered Framework ranking polls:' as info;
SELECT page_path, poll_index, LEFT(question, 80) as question_preview 
FROM ranking_polls 
WHERE page_path LIKE '%tiered-framework%' 
ORDER BY page_path, poll_index;

-- Step 2: Delete all existing Tiered Framework polls and votes
-- Delete votes first (foreign key constraints)
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

-- Delete polls
DELETE FROM polls WHERE page_path LIKE '%tiered-framework%';
DELETE FROM ranking_polls WHERE page_path LIKE '%tiered-framework%';
DELETE FROM wordcloud_polls WHERE page_path LIKE '%tiered-framework%';

-- Step 3: Create the correct 3 Tiered Framework polls
-- These match exactly what's in the UI pages and currentPollQuestions array

-- Survey Results - Question 1 (poll_index 0)
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/survey-results/tiered-framework',
  0,
  'What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  '["It provides a formal structure for quantifying and communicating uncertainty in the final standard.", "It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.", "It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.", "It improves the technical defensibility by making all assumptions (priors, model structure) explicit", "Other"]'::jsonb,
  NOW(),
  NOW()
);

-- Survey Results - Question 2 (poll_index 1)
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/survey-results/tiered-framework',
  1,
  'In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?',
  '["A large number of sediment chemistry samples to better characterize spatial heterogeneity.", "High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.", "Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.", "Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.", "Other"]'::jsonb,
  NOW(),
  NOW()
);

-- Survey Results - Question 3 (poll_index 2)
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/survey-results/tiered-framework',
  2,
  'What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  '["Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely", "The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.", "The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.", "The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.", "Other"]'::jsonb,
  NOW(),
  NOW()
);

-- CEW Polls - Question 1 (poll_index 0)
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/cew-polls/tiered-framework',
  0,
  'What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  '["It provides a formal structure for quantifying and communicating uncertainty in the final standard.", "It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.", "It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.", "It improves the technical defensibility by making all assumptions (priors, model structure) explicit", "Other"]'::jsonb,
  NOW(),
  NOW()
);

-- CEW Polls - Question 2 (poll_index 1)
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/cew-polls/tiered-framework',
  1,
  'In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?',
  '["A large number of sediment chemistry samples to better characterize spatial heterogeneity.", "High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.", "Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.", "Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.", "Other"]'::jsonb,
  NOW(),
  NOW()
);

-- CEW Polls - Question 3 (poll_index 2)
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/cew-polls/tiered-framework',
  2,
  'What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  '["Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely", "The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.", "The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.", "The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.", "Other"]'::jsonb,
  NOW(),
  NOW()
);

-- Step 4: Verify the results
SELECT 'AFTER CLEANUP - Tiered Framework polls:' as info;
SELECT page_path, poll_index, LEFT(question, 80) as question_preview 
FROM polls 
WHERE page_path LIKE '%tiered-framework%' 
ORDER BY page_path, poll_index;

SELECT 'AFTER CLEANUP - Tiered Framework ranking polls:' as info;
SELECT page_path, poll_index, LEFT(question, 80) as question_preview 
FROM ranking_polls 
WHERE page_path LIKE '%tiered-framework%' 
ORDER BY page_path, poll_index;

-- Step 5: Check that we have exactly 6 polls (3 survey + 3 CEW)
SELECT 'FINAL COUNT - Should be 6 polls total:' as info;
SELECT COUNT(*) as total_tiered_polls 
FROM polls 
WHERE page_path LIKE '%tiered-framework%';
