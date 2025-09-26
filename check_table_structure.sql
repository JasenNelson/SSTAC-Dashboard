-- Check the actual column names in the vote tables
-- This will help us understand the correct foreign key column names

-- Check wordcloud_votes table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'wordcloud_votes' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check ranking_votes table structure  
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ranking_votes' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check poll_votes table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'poll_votes' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
