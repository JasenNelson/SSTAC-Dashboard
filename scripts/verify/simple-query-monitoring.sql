-- ============================================================================
-- Simple Query Performance Monitoring
-- Purpose: Quick checks for Priority 2 monitoring (if pg_stat_statements unavailable)
-- Date: 2025-01-31
-- Safe: Read-only queries, no changes
-- ============================================================================

-- ============================================================================
-- 1. Cache Hit Rate for Result Tables
-- ============================================================================

SELECT 
    'Cache Hit Rate Monitoring' as check_type,
    relname as tablename,
    heap_blks_read as disk_reads,
    heap_blks_hit as cache_hits,
    CASE 
        WHEN (heap_blks_read + heap_blks_hit) > 0 
        THEN ROUND(100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit), 2)
        ELSE 100.0
    END as cache_hit_rate_percent,
    CASE 
        WHEN (heap_blks_read + heap_blks_hit) > 0 THEN
            CASE 
                WHEN 100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit) >= 99 THEN '✅ Excellent'
                WHEN 100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit) >= 95 THEN '✅ Good'
                WHEN 100.0 * heap_blks_hit / (heap_blks_read + heap_blks_hit) >= 90 THEN '🟡 Acceptable'
                ELSE '🔴 Low - Review Needed'
            END
        ELSE 'N/A - No Activity'
    END as status
FROM pg_statio_user_tables
WHERE schemaname = 'public'
AND relname IN ('poll_results', 'ranking_results', 'wordcloud_results')
ORDER BY relname;

-- ============================================================================
-- 2. Index Cache Hit Rate
-- ============================================================================

SELECT 
    'Index Cache Hit Rate' as check_type,
    relname as tablename,
    indexrelname as index_name,
    idx_blks_read as disk_reads,
    idx_blks_hit as cache_hits,
    CASE 
        WHEN (idx_blks_read + idx_blks_hit) > 0 
        THEN ROUND(100.0 * idx_blks_hit / (idx_blks_read + idx_blks_hit), 2)
        ELSE 100.0
    END as cache_hit_rate_percent
FROM pg_statio_user_indexes
WHERE schemaname = 'public'
AND relname IN ('poll_results', 'ranking_results', 'wordcloud_results')
AND (idx_blks_read + idx_blks_hit) > 0
ORDER BY relname, indexrelname;

-- ============================================================================
-- 3. Table Activity (Row Counts, Sizes)
-- ============================================================================

SELECT 
    'Table Activity' as check_type,
    relname as tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    pg_size_pretty(pg_total_relation_size('public.' || relname)) as total_size,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND relname IN ('poll_results', 'ranking_results', 'wordcloud_results')
ORDER BY relname;

-- ============================================================================
-- 4. Overall Database Cache Hit Rate
-- ============================================================================

SELECT 
    'Overall Database Cache' as metric,
    ROUND(
        100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0),
        2
    ) as cache_hit_rate_percent,
    CASE 
        WHEN ROUND(100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2) >= 99 THEN '✅ Excellent'
        WHEN ROUND(100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2) >= 95 THEN '✅ Good'
        WHEN ROUND(100.0 * SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0), 2) >= 90 THEN '🟡 Acceptable'
        ELSE '🔴 Low - Review Needed'
    END as status,
    SUM(heap_blks_hit) as total_cache_hits,
    SUM(heap_blks_read) as total_disk_reads
FROM pg_statio_user_tables
WHERE schemaname = 'public';

-- ============================================================================
-- 5. Index Usage Statistics
-- ============================================================================

SELECT 
    'Index Usage' as check_type,
    schemaname,
    relname as tablename,
    indexrelname as index_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN '⚠️ Unused'
        WHEN idx_scan < 10 THEN '🟡 Low Usage'
        ELSE '✅ Active'
    END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND relname IN ('poll_results', 'ranking_results', 'wordcloud_results')
ORDER BY relname, idx_scan DESC;

