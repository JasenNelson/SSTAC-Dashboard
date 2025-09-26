-- Check what polls actually exist in the database
-- This will help us understand if the polls are properly created

-- Check all polls across all tables
SELECT 'polls' as table_name, page_path, poll_index, question, created_at
FROM polls
UNION ALL
SELECT 'ranking_polls' as table_name, page_path, poll_index, question, created_at  
FROM ranking_polls
UNION ALL
SELECT 'wordcloud_polls' as table_name, page_path, poll_index, question, created_at
FROM wordcloud_polls
ORDER BY page_path, poll_index;

-- Count polls by page
SELECT 
  page_path,
  COUNT(*) as total_polls,
  SUM(CASE WHEN table_name = 'polls' THEN 1 ELSE 0 END) as single_choice,
  SUM(CASE WHEN table_name = 'ranking_polls' THEN 1 ELSE 0 END) as ranking,
  SUM(CASE WHEN table_name = 'wordcloud_polls' THEN 1 ELSE 0 END) as wordcloud
FROM (
  SELECT 'polls' as table_name, page_path FROM polls
  UNION ALL
  SELECT 'ranking_polls' as table_name, page_path FROM ranking_polls  
  UNION ALL
  SELECT 'wordcloud_polls' as table_name, page_path FROM wordcloud_polls
) all_polls
GROUP BY page_path
ORDER BY page_path;
