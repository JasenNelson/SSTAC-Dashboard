-- ============================================================================
-- Monitor Query Performance (Advanced)
-- Purpose: Track query performance metrics for Priority 2 monitoring
-- Date: 2025-01-31
-- Related: QUERY_PERFORMANCE_ANALYSIS.md
-- Safe: Read-only queries, no changes to database
-- 
-- ⚠️ NOTE: This script requires pg_stat_statements extension
-- If pg_stat_statements is not available, use simple-query-monitoring.sql instead
-- ============================================================================

-- Check if pg_stat_statements extension is available
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
    ) THEN
        RAISE NOTICE '⚠️ pg_stat_statements extension not available.';
        RAISE NOTICE 'Use scripts/verify/simple-query-monitoring.sql instead.';
        RAISE EXCEPTION 'Extension pg_stat_statements required';
    END IF;
END $$;

-- ============================================================================
-- 1. Dashboard Query Performance (Supabase Internal)
-- ============================================================================

-- Check for slow dashboard/internal queries
-- Note: This requires pg_stat_statements extension (Supabase may have different access)
SELECT 
    'Dashboard/System Queries' as category,
    COUNT(*)::int as query_count,
    ROUND(AVG(mean_exec_time)::numeric, 2) as avg_mean_time_ms,
    ROUND(MAX(mean_exec_time)::numeric, 2) as max_mean_time_ms,
    ROUND(MIN(mean_exec_time)::numeric, 2) as min_mean_time_ms,
    SUM(calls)::bigint as total_calls
FROM pg_stat_statements
WHERE query LIKE '%pg_proc%'
   OR query LIKE '%pg_class%'
   OR query LIKE '%information_schema%'
   OR query LIKE '%pg_namespace%'
LIMIT 10;

-- ============================================================================
-- 2. Result Table Query Performance
-- ============================================================================

-- Poll Results query performance
SELECT 
    'poll_results' as table_name,
    COUNT(*)::int as query_count,
    ROUND(AVG(mean_exec_time)::numeric, 2) as avg_mean_time_ms,
    ROUND(MAX(mean_exec_time)::numeric, 2) as max_mean_time_ms,
    SUM(calls)::bigint as total_calls,
    ROUND(SUM(total_exec_time)::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query LIKE '%poll_results%';

-- Ranking Results query performance
SELECT 
    'ranking_results' as table_name,
    COUNT(*)::int as query_count,
    ROUND(AVG(mean_exec_time)::numeric, 2) as avg_mean_time_ms,
    ROUND(MAX(mean_exec_time)::numeric, 2) as max_mean_time_ms,
    SUM(calls)::bigint as total_calls,
    ROUND(SUM(total_exec_time)::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query LIKE '%ranking_results%';

-- Wordcloud Results query performance
SELECT 
    'wordcloud_results' as table_name,
    COUNT(*)::int as query_count,
    ROUND(AVG(mean_exec_time)::numeric, 2) as avg_mean_time_ms,
    ROUND(MAX(mean_exec_time)::numeric, 2) as max_mean_time_ms,
    SUM(calls)::bigint as total_calls,
    ROUND(SUM(total_exec_time)::numeric, 2) as total_time_ms
FROM pg_stat_statements
WHERE query LIKE '%wordcloud_results%';

-- ============================================================================
-- 3. Max Time Spikes Detection
-- ============================================================================

-- Find queries with high max execution times (potential spikes)
SELECT 
    LEFT(query, 100) as query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) as mean_ms,
    ROUND(max_exec_time::numeric, 2) as max_ms,
    ROUND((max_exec_time - mean_exec_time)::numeric, 2) as spike_ms,
    CASE 
        WHEN max_exec_time > mean_exec_time * 5 THEN '⚠️ HIGH SPIKE'
        WHEN max_exec_time > mean_exec_time * 2 THEN '🟡 MEDIUM SPIKE'
        ELSE '✅ Normal'
    END as spike_status
FROM pg_stat_statements
WHERE query LIKE '%poll_results%'
   OR query LIKE '%ranking_results%'
   OR query LIKE '%wordcloud_results%'
ORDER BY (max_exec_time - mean_exec_time) DESC
LIMIT 10;

-- ============================================================================
-- 4. Cache Hit Rate Monitoring
-- ============================================================================

-- Table-level cache statistics
SELECT 
    schemaname,
    relname as tablename,
    heap_blks_read as disk_reads,
    heap_blks_hit as cache_hits,
    CASE 
        WHEN (heap_blks_read + heap_blks_hit) > 0 
        THEN ROUND(100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit), 2)
        ELSE 0
    END as cache_hit_rate_percent,
    CASE 
        WHEN (heap_blks_read + heap_blks_hit) > 0 
        THEN CASE 
            WHEN 100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit) >= 99 THEN '✅ Excellent'
            WHEN 100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit) >= 95 THEN '✅ Good'
            WHEN 100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit) >= 90 THEN '🟡 Acceptable'
            ELSE '🔴 Low'
        END
        ELSE 'N/A'
    END as cache_status
FROM pg_statio_user_tables
WHERE schemaname = 'public'
AND relname IN ('poll_results', 'ranking_results', 'wordcloud_results', 'poll_votes', 'ranking_votes', 'wordcloud_votes')
ORDER BY cache_hit_rate_percent ASC;

-- Index cache statistics
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as index_name,
    idx_blks_read as disk_reads,
    idx_blks_hit as cache_hits,
    CASE 
        WHEN (idx_blks_read + idx_blks_hit) > 0 
        THEN ROUND(100.0 * idx_blks_hit / (idx_blks_read + idx_blks_hit), 2)
        ELSE 0
    END as cache_hit_rate_percent
FROM pg_statio_user_indexes
WHERE schemaname = 'public'
AND relname IN ('poll_results', 'ranking_results', 'wordcloud_results')
AND (idx_blks_read + idx_blks_hit) > 0
ORDER BY cache_hit_rate_percent ASC;

-- ============================================================================
-- 5. Overall Database Cache Hit Rate
-- ============================================================================

-- Database-wide cache hit rate
SELECT 
    'Database Cache' as metric,
    ROUND(
        100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0),
        2
    ) as cache_hit_rate_percent,
    SUM(heap_blks_hit) as total_cache_hits,
    SUM(heap_blks_read) as total_disk_reads
FROM pg_statio_user_tables
WHERE schemaname = 'public';

-- ============================================================================
-- 6. Recent Query Activity Summary
-- ============================================================================

-- Summary of most active queries (top 10 by calls)
WITH total_time AS (
    SELECT SUM(total_exec_time)::numeric as grand_total
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat%'
)
SELECT 
    LEFT(query, 80) as query_preview,
    calls::bigint,
    ROUND(mean_exec_time::numeric, 2) as avg_ms,
    ROUND(max_exec_time::numeric, 2) as max_ms,
    ROUND(total_exec_time::numeric, 2) as total_time_ms,
    ROUND(100.0 * total_exec_time::numeric / NULLIF((SELECT grand_total FROM total_time), 0), 2)::numeric as pct_total_time
FROM pg_stat_statements
CROSS JOIN total_time
WHERE query NOT LIKE '%pg_stat%'  -- Exclude monitoring queries
ORDER BY calls DESC
LIMIT 10;

