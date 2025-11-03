-- ============================================================================
-- Verify Indexes on Result Tables
-- Purpose: Check if recommended indexes exist for query performance optimization
-- Date: 2025-01-31
-- Related: QUERY_PERFORMANCE_ANALYSIS.md
-- ============================================================================

-- Check all indexes on poll_results table
SELECT 
    'poll_results' as table_name,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'poll_results'
ORDER BY indexname;

-- Check all indexes on ranking_results table
SELECT 
    'ranking_results' as table_name,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'ranking_results'
ORDER BY indexname;

-- Check all indexes on wordcloud_results table
SELECT 
    'wordcloud_results' as table_name,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'wordcloud_results'
ORDER BY indexname;

-- ============================================================================
-- Check for Recommended Composite Indexes
-- ============================================================================

-- Check if composite index exists on poll_results (page_path, poll_index)
SELECT 
    'poll_results' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'poll_results'
            AND indexdef LIKE '%page_path%'
            AND indexdef LIKE '%poll_index%'
        ) THEN '✅ Composite index exists'
        ELSE '❌ Composite index MISSING'
    END as composite_index_status;

-- Check if composite index exists on ranking_results (page_path, poll_index)
SELECT 
    'ranking_results' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'ranking_results'
            AND indexdef LIKE '%page_path%'
            AND indexdef LIKE '%poll_index%'
        ) THEN '✅ Composite index exists'
        ELSE '❌ Composite index MISSING'
    END as composite_index_status;

-- Check if composite index exists on wordcloud_results (page_path, poll_index)
SELECT 
    'wordcloud_results' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename = 'wordcloud_results'
            AND indexdef LIKE '%page_path%'
            AND indexdef LIKE '%poll_index%'
        ) THEN '✅ Composite index exists'
        ELSE '❌ Composite index MISSING'
    END as composite_index_status;

-- ============================================================================
-- Detailed Index Analysis
-- ============================================================================

-- Find indexes that include page_path or poll_index
SELECT 
    tablename,
    indexname,
    indexdef,
    CASE 
        WHEN indexdef LIKE '%page_path%' AND indexdef LIKE '%poll_index%' 
        THEN '✅ Composite (page_path, poll_index)'
        WHEN indexdef LIKE '%page_path%' 
        THEN '⚠️ Single column (page_path only)'
        WHEN indexdef LIKE '%poll_index%' 
        THEN '⚠️ Single column (poll_index only)'
        ELSE 'Other columns'
    END as index_type
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('poll_results', 'ranking_results', 'wordcloud_results')
AND (indexdef LIKE '%page_path%' OR indexdef LIKE '%poll_index%')
ORDER BY tablename, indexname;

-- ============================================================================
-- Table Statistics for Context
-- ============================================================================

-- Get table sizes and row counts
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
    (SELECT reltuples::bigint 
     FROM pg_class 
     WHERE oid = (schemaname||'.'||tablename)::regclass) as estimated_rows
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('poll_results', 'ranking_results', 'wordcloud_results')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- Index Usage Statistics (if available)
-- ============================================================================

-- Check index usage statistics from pg_stat_user_indexes
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND relname IN ('poll_results', 'ranking_results', 'wordcloud_results')
ORDER BY relname, idx_scan DESC;

