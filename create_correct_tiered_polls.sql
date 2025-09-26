-- Create the correct 3 Tiered Framework polls in the database
-- These should match exactly what's in the UI pages

-- First, delete any existing Tiered Framework polls to start fresh
DELETE FROM poll_votes WHERE poll_id IN (SELECT id FROM polls WHERE page_path LIKE '%tiered-framework%');
DELETE FROM polls WHERE page_path LIKE '%tiered-framework%';

-- Insert the correct 3 Tiered Framework polls
-- Question 1: Single-choice poll
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/survey-results/tiered-framework',
  0,
  'What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  ARRAY[
    'It provides a formal structure for quantifying and communicating uncertainty in the final standard.',
    'It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.',
    'It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.',
    'It improves the technical defensibility by making all assumptions (priors, model structure) explicit',
    'Other'
  ],
  NOW(),
  NOW()
);

-- Question 2: Single-choice poll
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/survey-results/tiered-framework',
  1,
  'In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?',
  ARRAY[
    'A large number of sediment chemistry samples to better characterize spatial heterogeneity.',
    'High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.',
    'Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.',
    'Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.',
    'Other'
  ],
  NOW(),
  NOW()
);

-- Question 3: Single-choice poll
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/survey-results/tiered-framework',
  2,
  'What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  ARRAY[
    'Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely',
    'The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.',
    'The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.',
    'The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.',
    'Other'
  ],
  NOW(),
  NOW()
);

-- Also create the same polls for CEW pages
INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/cew-polls/tiered-framework',
  0,
  'What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  ARRAY[
    'It provides a formal structure for quantifying and communicating uncertainty in the final standard.',
    'It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.',
    'It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.',
    'It improves the technical defensibility by making all assumptions (priors, model structure) explicit',
    'Other'
  ],
  NOW(),
  NOW()
);

INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/cew-polls/tiered-framework',
  1,
  'In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?',
  ARRAY[
    'A large number of sediment chemistry samples to better characterize spatial heterogeneity.',
    'High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.',
    'Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.',
    'Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.',
    'Other'
  ],
  NOW(),
  NOW()
);

INSERT INTO polls (page_path, poll_index, question, options, created_at, updated_at)
VALUES (
  '/cew-polls/tiered-framework',
  2,
  'What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  ARRAY[
    'Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely',
    'The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.',
    'The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.',
    'The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.',
    'Other'
  ],
  NOW(),
  NOW()
);

-- Show the results
SELECT 'Created Tiered Framework polls:' as info;
SELECT page_path, poll_index, question FROM polls WHERE page_path LIKE '%tiered-framework%' ORDER BY page_path, poll_index;
