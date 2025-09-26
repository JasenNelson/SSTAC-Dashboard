-- Complete Setup for Wordcloud Polls and Updated Tiered Framework Questions
-- This script creates the wordcloud database schema and updates all tiered framework questions

-- ============================================================================
-- CREATE WORDCLOUD DATABASE SCHEMA
-- ============================================================================

-- Create wordcloud_polls table
CREATE TABLE IF NOT EXISTS public.wordcloud_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_path TEXT NOT NULL,
  poll_index INT NOT NULL,
  question TEXT NOT NULL,
  max_words INT DEFAULT 3,
  word_limit INT DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (page_path, poll_index)
);

-- Create wordcloud_votes table
CREATE TABLE IF NOT EXISTS public.wordcloud_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES public.wordcloud_polls(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Can be UUID for authenticated users or 'CEW2025' for conference
  word TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (poll_id, user_id, word) -- A user can only submit a specific word once per poll
);

-- Create wordcloud_results view
CREATE OR REPLACE VIEW public.wordcloud_results WITH (security_invoker = on) AS
SELECT
  wp.id AS poll_id,
  wp.page_path,
  wp.poll_index,
  wp.question,
  wp.max_words,
  wp.word_limit,
  wv.word,
  COUNT(wv.word) AS frequency,
  COUNT(DISTINCT wv.user_id) AS total_votes -- Number of unique participants
FROM
  public.wordcloud_polls wp
JOIN
  public.wordcloud_votes wv ON wp.id = wv.poll_id
GROUP BY
  wp.id, wp.page_path, wp.poll_index, wp.question, wp.max_words, wp.word_limit, wv.word
ORDER BY
  wp.page_path, wp.poll_index, COUNT(wv.word) DESC;

-- Enable Row Level Security (RLS) for wordcloud_polls
ALTER TABLE public.wordcloud_polls ENABLE ROW LEVEL SECURITY;

-- Policy for wordcloud_polls: All authenticated users can read
DROP POLICY IF EXISTS "Authenticated users can read wordcloud_polls" ON public.wordcloud_polls;
CREATE POLICY "Authenticated users can read wordcloud_polls"
ON public.wordcloud_polls FOR SELECT
TO authenticated
USING (true);

-- Policy for wordcloud_polls: Service role can manage
DROP POLICY IF EXISTS "Service role can manage wordcloud_polls" ON public.wordcloud_polls;
CREATE POLICY "Service role can manage wordcloud_polls"
ON public.wordcloud_polls FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- Enable Row Level Security (RLS) for wordcloud_votes
ALTER TABLE public.wordcloud_votes ENABLE ROW LEVEL SECURITY;

-- Policy for wordcloud_votes: Authenticated users can insert/read their own votes
DROP POLICY IF EXISTS "Authenticated users can manage their own wordcloud_votes" ON public.wordcloud_votes;
CREATE POLICY "Authenticated users can manage their own wordcloud_votes"
ON public.wordcloud_votes FOR ALL
TO authenticated
USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Policy for wordcloud_votes: CEW users can insert/read their own votes (using 'CEW2025' as user_id)
DROP POLICY IF EXISTS "CEW users can manage their own wordcloud_votes" ON public.wordcloud_votes;
CREATE POLICY "CEW users can manage their own wordcloud_votes"
ON public.wordcloud_votes FOR ALL
TO anon
USING (user_id = 'CEW2025') WITH CHECK (user_id = 'CEW2025');

-- Policy for wordcloud_votes: Service role can manage
DROP POLICY IF EXISTS "Service role can manage wordcloud_votes" ON public.wordcloud_votes;
CREATE POLICY "Service role can manage wordcloud_votes"
ON public.wordcloud_votes FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- Helper function to get or create a wordcloud poll
CREATE OR REPLACE FUNCTION public.get_or_create_wordcloud_poll(
  p_page_path TEXT,
  p_poll_index INT,
  p_question TEXT,
  p_max_words INT DEFAULT 3,
  p_word_limit INT DEFAULT 20
)
RETURNS public.wordcloud_polls
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_poll public.wordcloud_polls;
BEGIN
  SELECT * INTO v_poll
  FROM public.wordcloud_polls
  WHERE page_path = p_page_path AND poll_index = p_poll_index;

  IF v_poll IS NULL THEN
    INSERT INTO public.wordcloud_polls (page_path, poll_index, question, max_words, word_limit)
    VALUES (p_page_path, p_poll_index, p_question, p_max_words, p_word_limit)
    RETURNING * INTO v_poll;
  END IF;

  RETURN v_poll;
END;
$$;

-- Function to get word counts for wordcloud results
CREATE OR REPLACE FUNCTION public.get_word_counts(
  p_page_path TEXT,
  p_poll_index INT
)
RETURNS TABLE (
  poll_id UUID,
  page_path TEXT,
  poll_index INT,
  question TEXT,
  word TEXT,
  frequency BIGINT,
  total_votes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wr.poll_id,
    wr.page_path,
    wr.poll_index,
    wr.question,
    wr.word,
    wr.frequency,
    wr.total_votes
  FROM public.wordcloud_results wr
  WHERE wr.page_path = p_page_path AND wr.poll_index = p_poll_index;
END;
$$;

-- Function to submit wordcloud votes
CREATE OR REPLACE FUNCTION public.submit_wordcloud_vote(
  p_page_path TEXT,
  p_poll_index INT,
  p_user_id TEXT,
  p_words TEXT[]
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_poll_id UUID;
  word_item TEXT;
BEGIN
  -- Get or create the poll
  SELECT id INTO v_poll_id
  FROM public.wordcloud_polls
  WHERE page_path = p_page_path AND poll_index = p_poll_index;

  IF v_poll_id IS NULL THEN
    RETURN 'Poll not found';
  END IF;

  -- Delete existing votes for this user and poll
  DELETE FROM public.wordcloud_votes
  WHERE poll_id = v_poll_id AND user_id = p_user_id;

  -- Insert new votes
  FOREACH word_item IN ARRAY p_words
  LOOP
    INSERT INTO public.wordcloud_votes (poll_id, user_id, word)
    VALUES (v_poll_id, p_user_id, LOWER(TRIM(word_item)))
    ON CONFLICT (poll_id, user_id, word) DO NOTHING;
  END LOOP;

  RETURN 'Success';
END;
$$;

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
SELECT 'Single-choice' as type, poll_index, question FROM polls WHERE page_path LIKE '%tiered-framework%'
UNION ALL
SELECT 'Ranking' as type, poll_index, question FROM ranking_polls WHERE page_path LIKE '%tiered-framework%'
UNION ALL
SELECT 'Wordcloud' as type, poll_index, question FROM wordcloud_polls WHERE page_path LIKE '%tiered-framework%'
ORDER BY type, poll_index;
