-- Update Tiered Framework Questions with 12 New Questions from CEW_Poll_Questions.txt
-- This script replaces all existing tiered framework questions with the new set

-- ============================================================================
-- CLEANUP EXISTING TIERED FRAMEWORK POLLS
-- ============================================================================

-- Remove existing votes for tiered framework polls
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

-- Remove existing tiered framework polls
DELETE FROM polls WHERE page_path LIKE '%tiered-framework%';
DELETE FROM ranking_polls WHERE page_path LIKE '%tiered-framework%';
DELETE FROM wordcloud_polls WHERE page_path LIKE '%tiered-framework%';

-- ============================================================================
-- INSERT NEW TIERED FRAMEWORK QUESTIONS
-- ============================================================================

-- Question 1: Single-choice poll
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/survey-results/tiered-framework', 0, 'What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?', '["It provides a formal structure for quantifying and communicating uncertainty in the final standard.", "It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.", "It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.", "It improves the technical defensibility by making all assumptions (priors, model structure) explicit", "Other"]'),
('/cew-polls/tiered-framework', 0, 'What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?', '["It provides a formal structure for quantifying and communicating uncertainty in the final standard.", "It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.", "It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.", "It improves the technical defensibility by making all assumptions (priors, model structure) explicit", "Other"]');

-- Question 2: Single-choice poll
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/survey-results/tiered-framework', 1, 'In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?', '["A large number of sediment chemistry samples to better characterize spatial heterogeneity.", "High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.", "Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.", "Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.", "Other"]'),
('/cew-polls/tiered-framework', 1, 'In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?', '["A large number of sediment chemistry samples to better characterize spatial heterogeneity.", "High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.", "Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.", "Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.", "Other"]');

-- Question 3: Single-choice poll
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/survey-results/tiered-framework', 2, 'What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?', '["Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely", "The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.", "The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.", "The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.", "Other"]'),
('/cew-polls/tiered-framework', 2, 'What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?', '["Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely", "The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.", "The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.", "The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.", "Other"]');

-- Questions 4-11: Ranking polls
INSERT INTO ranking_polls (page_path, poll_index, question, options) VALUES
-- Question 4
('/survey-results/tiered-framework', 3, 'Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)', '["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/cew-polls/tiered-framework', 3, 'Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)', '["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),

-- Question 5
('/survey-results/tiered-framework', 4, 'Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)', '["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/cew-polls/tiered-framework', 4, 'Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)', '["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),

-- Question 6
('/survey-results/tiered-framework', 5, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = very important to 5 = not important)', '["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/cew-polls/tiered-framework', 5, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = very important to 5 = not important)', '["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),

-- Question 7
('/survey-results/tiered-framework', 6, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = easily achievable to 5 = not feasible)', '["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/cew-polls/tiered-framework', 6, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = easily achievable to 5 = not feasible)', '["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),

-- Question 8
('/survey-results/tiered-framework', 7, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = very important to 5 = not important)', '["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/cew-polls/tiered-framework', 7, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = very important to 5 = not important)', '["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),

-- Question 9
('/survey-results/tiered-framework', 8, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = easily achievable to 5 = not feasible)', '["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/cew-polls/tiered-framework', 8, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = easily achievable to 5 = not feasible)', '["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),

-- Question 10
('/survey-results/tiered-framework', 9, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = very important to 5 = not important)', '["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/cew-polls/tiered-framework', 9, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = very important to 5 = not important)', '["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),

-- Question 11
('/survey-results/tiered-framework', 10, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = easily achievable to 5 = not feasible)', '["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/cew-polls/tiered-framework', 10, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = easily achievable to 5 = not feasible)', '["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]');

-- Question 12: Wordcloud poll
INSERT INTO wordcloud_polls (page_path, poll_index, question, max_words, word_limit) VALUES
('/survey-results/tiered-framework', 11, 'Overall, what is the greatest barrier to advancing holistic sediment protection in BC?', 3, 20),
('/cew-polls/tiered-framework', 11, 'Overall, what is the greatest barrier to advancing holistic sediment protection in BC?', 3, 20);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify polls were created
SELECT 'Single-choice polls' as poll_type, COUNT(*) as count 
FROM polls WHERE page_path LIKE '%tiered-framework%'
UNION ALL
SELECT 'Ranking polls' as poll_type, COUNT(*) as count 
FROM ranking_polls WHERE page_path LIKE '%tiered-framework%'
UNION ALL
SELECT 'Wordcloud polls' as poll_type, COUNT(*) as count 
FROM wordcloud_polls WHERE page_path LIKE '%tiered-framework%';

-- Show all new questions
SELECT 'Single-choice' as type, poll_index, question FROM polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index
UNION ALL
SELECT 'Ranking' as type, poll_index, question FROM ranking_polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index
UNION ALL
SELECT 'Wordcloud' as type, poll_index, question FROM wordcloud_polls WHERE page_path LIKE '%tiered-framework%' ORDER BY poll_index
ORDER BY type, poll_index;
