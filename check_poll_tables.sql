-- Check if poll results tables exist and have data
-- Run this in Supabase SQL Editor to diagnose poll-results page issues

-- Check if poll_results table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'poll_results') 
        THEN 'poll_results table exists'
        ELSE 'poll_results table does not exist'
    END as poll_results_status;

-- Check if ranking_results table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ranking_results') 
        THEN 'ranking_results table exists'
        ELSE 'ranking_results table does not exist'
    END as ranking_results_status;

-- If tables exist, check for data
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'poll_results') 
        THEN (SELECT COUNT(*)::text FROM poll_results)
        ELSE 'N/A'
    END as poll_results_count;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ranking_results') 
        THEN (SELECT COUNT(*)::text FROM ranking_results)
        ELSE 'N/A'
    END as ranking_results_count;

-- Check if these are views instead of tables
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'poll_results') 
        THEN 'poll_results is a VIEW'
        ELSE 'poll_results is not a view'
    END as poll_results_view_status;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'ranking_results') 
        THEN 'ranking_results is a VIEW'
        ELSE 'ranking_results is not a view'
    END as ranking_results_view_status;
