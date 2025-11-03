-- ============================================================================
-- MATRIX GRAPH DATA POINTS INVESTIGATION
-- ============================================================================
-- Purpose: Understand why matrix graphs show so few data points
-- Expected: Hundreds of paired votes from k6 test
-- Actual: Only 5-8 data points per graph
-- ============================================================================

-- ============================================================================
-- STEP 1: Count total votes in database
-- ============================================================================
SELECT 
  'Total Single-Choice Votes' as metric,
  COUNT(*) as count
FROM poll_votes;

-- ============================================================================
-- STEP 2: Count votes by page path (CEW vs Survey-Results)
-- ============================================================================
SELECT 
  p.page_path,
  COUNT(pv.id) as vote_count,
  COUNT(DISTINCT pv.user_id) as unique_users
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
GROUP BY p.page_path
ORDER BY vote_count DESC;

-- ============================================================================
-- STEP 3: Holistic Protection Questions - Vote Distribution
-- ============================================================================
-- Q1 (poll_index 0): Ecosystem Health - Direct Toxicity (Importance)
-- Q2 (poll_index 1): Ecosystem Health - Direct Toxicity (Feasibility)
-- Q3 (poll_index 2): Human Health - Direct Toxicity (Importance)
-- Q4 (poll_index 3): Human Health - Direct Toxicity (Feasibility)
-- Q5 (poll_index 4): Ecosystem Health - Food-Related (Importance)
-- Q6 (poll_index 5): Ecosystem Health - Food-Related (Feasibility)
-- Q7 (poll_index 6): Human Health - Food-Related (Importance)
-- Q8 (poll_index 7): Human Health - Food-Related (Feasibility)

SELECT 
  p.page_path,
  p.poll_index,
  LEFT(p.question, 80) as question_preview,
  COUNT(pv.id) as vote_count,
  COUNT(DISTINCT pv.user_id) as unique_users
FROM polls p
LEFT JOIN poll_votes pv ON p.id = pv.poll_id
WHERE p.page_path IN ('/cew-polls/holistic-protection', '/survey-results/holistic-protection')
  AND p.poll_index BETWEEN 0 AND 7
GROUP BY p.page_path, p.poll_index, p.question
ORDER BY p.page_path, p.poll_index;

-- ============================================================================
-- STEP 4: Check for paired votes (same user voted on both questions)
-- ============================================================================
-- Example: Q1 (importance) + Q2 (feasibility) pairs

-- Matrix 1: Ecosystem Health - Direct Toxicity (Q1 + Q2)
WITH ecosystem_direct_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    p.page_path
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (0, 1)
)
SELECT 
  'Ecosystem Health - Direct Toxicity (CEW)' as matrix_name,
  COUNT(DISTINCT user_id) as users_who_voted_on_either,
  COUNT(DISTINCT CASE WHEN poll_index = 0 THEN user_id END) as users_voted_importance,
  COUNT(DISTINCT CASE WHEN poll_index = 1 THEN user_id END) as users_voted_feasibility,
  (
    SELECT COUNT(DISTINCT v1.user_id)
    FROM ecosystem_direct_votes v1
    JOIN ecosystem_direct_votes v2 ON v1.user_id = v2.user_id
    WHERE v1.poll_index = 0 AND v2.poll_index = 1
  ) as users_with_paired_votes
FROM ecosystem_direct_votes;

-- Matrix 2: Human Health - Direct Toxicity (Q3 + Q4)
WITH human_direct_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    p.page_path
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (2, 3)
)
SELECT 
  'Human Health - Direct Toxicity (CEW)' as matrix_name,
  COUNT(DISTINCT user_id) as users_who_voted_on_either,
  COUNT(DISTINCT CASE WHEN poll_index = 2 THEN user_id END) as users_voted_importance,
  COUNT(DISTINCT CASE WHEN poll_index = 3 THEN user_id END) as users_voted_feasibility,
  (
    SELECT COUNT(DISTINCT v1.user_id)
    FROM human_direct_votes v1
    JOIN human_direct_votes v2 ON v1.user_id = v2.user_id
    WHERE v1.poll_index = 2 AND v2.poll_index = 3
  ) as users_with_paired_votes
FROM human_direct_votes;

-- Matrix 3: Ecosystem Health - Food-Related (Q5 + Q6)
WITH ecosystem_food_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    p.page_path
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (4, 5)
)
SELECT 
  'Ecosystem Health - Food-Related (CEW)' as matrix_name,
  COUNT(DISTINCT user_id) as users_who_voted_on_either,
  COUNT(DISTINCT CASE WHEN poll_index = 4 THEN user_id END) as users_voted_importance,
  COUNT(DISTINCT CASE WHEN poll_index = 5 THEN user_id END) as users_voted_feasibility,
  (
    SELECT COUNT(DISTINCT v1.user_id)
    FROM ecosystem_food_votes v1
    JOIN ecosystem_food_votes v2 ON v1.user_id = v2.user_id
    WHERE v1.poll_index = 4 AND v2.poll_index = 5
  ) as users_with_paired_votes
FROM ecosystem_food_votes;

-- Matrix 4: Human Health - Food-Related (Q7 + Q8)
WITH human_food_votes AS (
  SELECT 
    pv.user_id,
    p.poll_index,
    pv.option_index + 1 as score,
    p.page_path
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index IN (6, 7)
)
SELECT 
  'Human Health - Food-Related (CEW)' as matrix_name,
  COUNT(DISTINCT user_id) as users_who_voted_on_either,
  COUNT(DISTINCT CASE WHEN poll_index = 6 THEN user_id END) as users_voted_importance,
  COUNT(DISTINCT CASE WHEN poll_index = 7 THEN user_id END) as users_voted_feasibility,
  (
    SELECT COUNT(DISTINCT v1.user_id)
    FROM human_food_votes v1
    JOIN human_food_votes v2 ON v1.user_id = v2.user_id
    WHERE v1.poll_index = 6 AND v2.poll_index = 7
  ) as users_with_paired_votes
FROM human_food_votes;

-- ============================================================================
-- STEP 5: Check CEW user ID patterns from k6 test
-- ============================================================================
SELECT 
  CASE 
    WHEN pv.user_id LIKE 'CEW2025-%-%-%' THEN 'CEW2025 k6 test format'
    WHEN pv.user_id = 'CEW2025' THEN 'CEW2025 manual test'
    WHEN pv.user_id LIKE 'CEW2025_session_%' THEN 'CEW2025 old session format'
    ELSE 'Other'
  END as user_id_pattern,
  COUNT(DISTINCT pv.user_id) as unique_users,
  COUNT(*) as total_votes
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
GROUP BY 
  CASE 
    WHEN pv.user_id LIKE 'CEW2025-%-%-%' THEN 'CEW2025 k6 test format'
    WHEN pv.user_id = 'CEW2025' THEN 'CEW2025 manual test'
    WHEN pv.user_id LIKE 'CEW2025_session_%' THEN 'CEW2025 old session format'
    ELSE 'Other'
  END
ORDER BY total_votes DESC;

-- ============================================================================
-- STEP 6: Sample of actual user IDs and their votes
-- ============================================================================
SELECT 
  pv.user_id,
  p.poll_index,
  pv.option_index + 1 as score,
  pv.voted_at
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index BETWEEN 0 AND 7
  AND pv.user_id LIKE 'CEW2025-%-%-%'
ORDER BY pv.user_id, p.poll_index
LIMIT 50;

-- ============================================================================
-- STEP 7: Identify users with incomplete vote sets
-- ============================================================================
-- Users who should have 8 votes (Q1-Q8) but don't
WITH user_vote_counts AS (
  SELECT 
    pv.user_id,
    COUNT(DISTINCT p.poll_index) as questions_answered,
    ARRAY_AGG(DISTINCT p.poll_index ORDER BY p.poll_index) as answered_questions
  FROM poll_votes pv
  JOIN polls p ON pv.poll_id = p.id
  WHERE p.page_path = '/cew-polls/holistic-protection'
    AND p.poll_index BETWEEN 0 AND 7
    AND pv.user_id LIKE 'CEW2025-%-%-%'
  GROUP BY pv.user_id
)
SELECT 
  questions_answered,
  COUNT(*) as user_count,
  ARRAY_AGG(user_id ORDER BY user_id LIMIT 3) as sample_users
FROM user_vote_counts
GROUP BY questions_answered
ORDER BY questions_answered DESC;

-- ============================================================================
-- STEP 8: Check for duplicate votes (same user, same question, multiple votes)
-- ============================================================================
SELECT 
  pv.user_id,
  p.poll_index,
  COUNT(*) as vote_count,
  ARRAY_AGG(pv.option_index ORDER BY pv.voted_at) as vote_progression
FROM poll_votes pv
JOIN polls p ON pv.poll_id = p.id
WHERE p.page_path = '/cew-polls/holistic-protection'
  AND p.poll_index BETWEEN 0 AND 7
  AND pv.user_id LIKE 'CEW2025-%-%-%'
GROUP BY pv.user_id, p.poll_index
HAVING COUNT(*) > 1
ORDER BY vote_count DESC
LIMIT 20;

-- ============================================================================
-- SUMMARY: Expected vs Actual
-- ============================================================================
-- Expected from k6 test:
-- - ~100 unique CEW2025 users (format: CEW2025-{VU}-{iteration}-{random})
-- - Each user answers ALL 8 questions on holistic-protection page
-- - Result: ~800 total votes, 100 paired votes per matrix graph (4 graphs total)
--
-- Actual (from screenshots):
-- - Matrix graphs show only 5-8 individual data points
-- - Suggests only 5-8 users completed BOTH questions in each pair
--
-- Hypothesis to investigate:
-- 1. Did k6 test actually insert 800 votes? (Check STEP 1-2)
-- 2. Are votes distributed across all 8 questions? (Check STEP 3)
-- 3. Are users completing both questions in each pair? (Check STEP 4)
-- 4. Is there an issue with user ID format? (Check STEP 5-6)
-- 5. Are users abandoning mid-survey? (Check STEP 7)
-- 6. Are there duplicate/overwritten votes? (Check STEP 8)
-- ============================================================================

