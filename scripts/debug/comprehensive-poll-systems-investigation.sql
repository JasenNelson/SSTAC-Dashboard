-- ============================================================================
-- COMPREHENSIVE INVESTIGATION: Three Separate Poll Systems
-- ============================================================================
-- DO NOT MODIFY ANYTHING - This is for investigation only
-- Run these queries to understand the actual state of all three systems

-- ============================================================================
-- 1. TABLE STRUCTURE INVESTIGATION
-- ============================================================================

-- Check all poll-related tables and their columns
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('polls', 'poll_votes', 'ranking_polls', 'ranking_votes', 'wordcloud_polls', 'wordcloud_votes')
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- 2. RLS STATUS INVESTIGATION
-- ============================================================================

-- Check if RLS is enabled on each table
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('polls', 'poll_votes', 'ranking_polls', 'ranking_votes', 'wordcloud_polls', 'wordcloud_votes')
ORDER BY tablename;

-- ============================================================================
-- 3. RLS POLICIES INVESTIGATION - SINGLE-CHOICE POLLS SYSTEM
-- ============================================================================

-- All policies on polls table (single-choice polls)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'polls'
ORDER BY cmd, policyname;

-- All policies on poll_votes table (single-choice votes)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'poll_votes'
ORDER BY cmd, policyname;

-- ============================================================================
-- 4. RLS POLICIES INVESTIGATION - RANKING POLLS SYSTEM
-- ============================================================================

-- All policies on ranking_polls table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'ranking_polls'
ORDER BY cmd, policyname;

-- All policies on ranking_votes table (ranking votes)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'ranking_votes'
ORDER BY cmd, policyname;

-- ============================================================================
-- 5. RLS POLICIES INVESTIGATION - WORDCLOUD POLLS SYSTEM
-- ============================================================================

-- All policies on wordcloud_polls table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'wordcloud_polls'
ORDER BY cmd, policyname;

-- All policies on wordcloud_votes table (wordcloud votes)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'wordcloud_votes'
ORDER BY cmd, policyname;

-- ============================================================================
-- 6. CONSTRAINTS INVESTIGATION - ALL THREE SYSTEMS
-- ============================================================================

-- Check constraints on poll_votes (single-choice)
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'poll_votes'
ORDER BY con.conname;

-- Check constraints on ranking_votes
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'ranking_votes'
ORDER BY con.conname;

-- Check constraints on wordcloud_votes
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'wordcloud_votes'
ORDER BY con.conname;

-- ============================================================================
-- 7. INDEXES INVESTIGATION - ALL THREE SYSTEMS
-- ============================================================================

-- Indexes on poll_votes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'poll_votes'
ORDER BY indexname;

-- Indexes on ranking_votes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'ranking_votes'
ORDER BY indexname;

-- Indexes on wordcloud_votes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'wordcloud_votes'
ORDER BY indexname;

-- ============================================================================
-- 8. FOREIGN KEY RELATIONSHIPS
-- ============================================================================

-- Foreign keys for poll_votes
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'poll_votes';

-- Foreign keys for ranking_votes
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'ranking_votes';

-- Foreign keys for wordcloud_votes
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'wordcloud_votes';

-- ============================================================================
-- 9. SAMPLE DATA INVESTIGATION - Check user_id formats
-- ============================================================================

-- Sample user_ids from poll_votes (single-choice - working)
SELECT DISTINCT 
    LEFT(user_id, 50) as user_id_sample,
    COUNT(*) as vote_count
FROM poll_votes
GROUP BY LEFT(user_id, 50)
ORDER BY vote_count DESC
LIMIT 10;

-- Sample user_ids from ranking_votes
SELECT DISTINCT 
    LEFT(user_id, 50) as user_id_sample,
    COUNT(*) as vote_count
FROM ranking_votes
GROUP BY LEFT(user_id, 50)
ORDER BY vote_count DESC
LIMIT 10;

-- Sample user_ids from wordcloud_votes (working)
SELECT DISTINCT 
    LEFT(user_id, 50) as user_id_sample,
    COUNT(*) as vote_count
FROM wordcloud_votes
GROUP BY LEFT(user_id, 50)
ORDER BY vote_count DESC
LIMIT 10;

-- ============================================================================
-- 10. COMPARISON: INSERT POLICIES ACROSS ALL THREE SYSTEMS
-- ============================================================================

-- Compare INSERT policies for all three vote tables
SELECT 
    'poll_votes' as table_name,
    policyname,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'poll_votes' AND cmd = 'INSERT'

UNION ALL

SELECT 
    'ranking_votes' as table_name,
    policyname,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'ranking_votes' AND cmd = 'INSERT'

UNION ALL

SELECT 
    'wordcloud_votes' as table_name,
    policyname,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'wordcloud_votes' AND cmd = 'INSERT'

ORDER BY table_name, policyname;

