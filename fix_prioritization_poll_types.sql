-- CORRECTION: Fix Prioritization Poll Types
-- The first 10 questions should be single-choice polls, not ranking polls
-- Only questions 11 and 12 should be ranking polls
-- Question 13 should be wordcloud

-- First, let's see what we currently have
SELECT 'CURRENT PRIORITIZATION POLLS' as status;
SELECT 'RANKING POLLS' as type, page_path, poll_index, question FROM ranking_polls WHERE page_path LIKE '%prioritization%' ORDER BY poll_index;
SELECT 'WORDCLOUD POLLS' as type, page_path, poll_index, question FROM wordcloud_polls WHERE page_path LIKE '%prioritization%' ORDER BY poll_index;

-- Remove existing prioritization polls
DELETE FROM poll_votes WHERE poll_id IN (
    SELECT id FROM polls WHERE page_path LIKE '%prioritization%'
);
DELETE FROM ranking_votes WHERE ranking_poll_id IN (
    SELECT id FROM ranking_polls WHERE page_path LIKE '%prioritization%'
);
DELETE FROM wordcloud_votes WHERE poll_id IN (
    SELECT id FROM wordcloud_polls WHERE page_path LIKE '%prioritization%'
);

DELETE FROM polls WHERE page_path LIKE '%prioritization%';
DELETE FROM ranking_polls WHERE page_path LIKE '%prioritization%';
DELETE FROM wordcloud_polls WHERE page_path LIKE '%prioritization%';

-- Insert CORRECT Prioritization Questions
-- Questions 1-10: Single-Choice Polls (not ranking)

-- Question 1: Importance of Tier 2 framework
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 0, 'Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/survey-results/prioritization', 0, 'Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]');

-- Question 2: Feasibility of Tier 2 framework
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 1, 'Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/survey-results/prioritization', 1, 'Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]');

-- Question 3: Importance of ecosystem health direct toxicity
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 2, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/survey-results/prioritization', 2, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]');

-- Question 4: Feasibility of ecosystem health direct toxicity
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 3, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/survey-results/prioritization', 3, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]');

-- Question 5: Importance of human health direct toxicity
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 4, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/survey-results/prioritization', 4, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]');

-- Question 6: Feasibility of human health direct toxicity
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 5, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/survey-results/prioritization', 5, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]');

-- Question 7: Importance of ecosystem health food-related toxicity
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 6, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/survey-results/prioritization', 6, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]');

-- Question 8: Feasibility of ecosystem health food-related toxicity
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 7, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/survey-results/prioritization', 7, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]');

-- Question 9: Importance of human health food-related toxicity
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 8, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from food-related toxicity. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]'),
('/survey-results/prioritization', 8, 'Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from food-related toxicity. (1 = very important to 5 = not important)', 
'["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"]');

-- Question 10: Feasibility of human health food-related toxicity
INSERT INTO polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 9, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from food-related toxicity. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]'),
('/survey-results/prioritization', 9, 'Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from food-related toxicity. (1 = easily achievable to 5 = not feasible)', 
'["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"]');

-- Questions 11-12: Ranking Polls (actual ranking with multiple options)

-- Question 11: Focus actions for matrix standards development
INSERT INTO ranking_polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 10, 'To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve development of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.', 
'["Developing the technical approach to define what \"direct toxicity\" and \"food pathway toxicity\" mean for the framework.", "Determining what approach ENV should take to develop human health standards, given there are other agencies working on like standards.", "Developing the technical approach to address how matrix standards would be applied in a spatial context (e.g., over what spatial areas, for what depths, etc.).", "Determining if environmental sensitivity should be factored into matrix standards for ecological health."]'),
('/survey-results/prioritization', 10, 'To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve development of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.', 
'["Developing the technical approach to define what \"direct toxicity\" and \"food pathway toxicity\" mean for the framework.", "Determining what approach ENV should take to develop human health standards, given there are other agencies working on like standards.", "Developing the technical approach to address how matrix standards would be applied in a spatial context (e.g., over what spatial areas, for what depths, etc.).", "Determining if environmental sensitivity should be factored into matrix standards for ecological health."]');

-- Question 12: Focus areas for holistic sediment management
INSERT INTO ranking_polls (page_path, poll_index, question, options) VALUES
('/cew-polls/prioritization', 11, 'Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)', 
'["Selecting and using models and other tools to help develop Site-Specific Sediment Standards (Tier 2) for ecological health (these would include, for example, acid volatile sulphides/simultaneously extractable metals (AVS/SEM), equilibrium partitioning (EqP), target lipid model)", "Selecting and using approaches to develop Sediment Standards for contaminants with an analogue (e.g., quantitative structure-activity relationship (QSAR))", "Developing guidance and/or framework to use site-specific toxicity testing to evaluate the risks of mixtures to ecological receptors.", "Developing models and/or approaches to derive mixture-specific sediment standards for ecological receptors (e.g., for water quality, there are biotic ligand models for metals mixtures)."]'),
('/survey-results/prioritization', 11, 'Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)', 
'["Selecting and using models and other tools to help develop Site-Specific Sediment Standards (Tier 2) for ecological health (these would include, for example, acid volatile sulphides/simultaneously extractable metals (AVS/SEM), equilibrium partitioning (EqP), target lipid model)", "Selecting and using approaches to develop Sediment Standards for contaminants with an analogue (e.g., quantitative structure-activity relationship (QSAR))", "Developing guidance and/or framework to use site-specific toxicity testing to evaluate the risks of mixtures to ecological receptors.", "Developing models and/or approaches to derive mixture-specific sediment standards for ecological receptors (e.g., for water quality, there are biotic ligand models for metals mixtures)."]');

-- Question 13: Wordcloud Poll
INSERT INTO wordcloud_polls (page_path, poll_index, question, max_words, word_limit) VALUES
('/cew-polls/prioritization', 12, 'Overall, what is the greatest barrier to advancing holistic sediment protection in BC?', 3, 20),
('/survey-results/prioritization', 12, 'Overall, what is the greatest barrier to advancing holistic sediment protection in BC?', 3, 20);

-- Verification queries
SELECT 'AFTER CORRECTION - PRIORITIZATION SINGLE-CHOICE POLLS' as status;
SELECT page_path, poll_index, question FROM polls WHERE page_path LIKE '%prioritization%' ORDER BY poll_index;

SELECT 'AFTER CORRECTION - PRIORITIZATION RANKING POLLS' as status;
SELECT page_path, poll_index, question FROM ranking_polls WHERE page_path LIKE '%prioritization%' ORDER BY poll_index;

SELECT 'AFTER CORRECTION - PRIORITIZATION WORDCLOUD POLLS' as status;
SELECT page_path, poll_index, question FROM wordcloud_polls WHERE page_path LIKE '%prioritization%' ORDER BY poll_index;
