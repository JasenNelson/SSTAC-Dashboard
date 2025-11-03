-- ============================================================================
-- Create Missing Composite Indexes on Result Tables
-- Purpose: Add composite indexes (page_path, poll_index) for query performance
-- Date: 2025-01-31
-- Related: QUERY_PERFORMANCE_ANALYSIS.md, INDEX_VERIFICATION_RESULTS.md
-- ============================================================================

-- Note: These indexes use IF NOT EXISTS to be safe if run multiple times
-- They will improve performance for filtered queries on these tables

-- ============================================================================
-- Poll Results Index
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_poll_results_page_poll 
ON poll_results(page_path, poll_index);

COMMENT ON INDEX idx_poll_results_page_poll IS 
'Composite index on (page_path, poll_index) for optimizing filtered queries';

-- ============================================================================
-- Ranking Results Index
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ranking_results_page_poll 
ON ranking_results(page_path, poll_index);

COMMENT ON INDEX idx_ranking_results_page_poll IS 
'Composite index on (page_path, poll_index) for optimizing filtered queries';

-- ============================================================================
-- Wordcloud Results Index
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_wordcloud_results_page_poll 
ON wordcloud_results(page_path, poll_index);

COMMENT ON INDEX idx_wordcloud_results_page_poll IS 
'Composite index on (page_path, poll_index) for optimizing filtered queries';

-- ============================================================================
-- Verification: Check that indexes were created
-- ============================================================================
SELECT 
    tablename,
    indexname,
    indexdef,
    CASE 
        WHEN indexdef LIKE '%page_path%' AND indexdef LIKE '%poll_index%' 
        THEN '✅ Composite index created'
        ELSE '⚠️ Check index definition'
    END as verification_status
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('poll_results', 'ranking_results', 'wordcloud_results')
AND indexname IN (
    'idx_poll_results_page_poll',
    'idx_ranking_results_page_poll',
    'idx_wordcloud_results_page_poll'
)
ORDER BY tablename;

