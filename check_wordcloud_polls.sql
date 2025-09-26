-- Check what wordcloud polls actually exist in the database
SELECT page_path, poll_index, question, max_words, word_limit 
FROM wordcloud_polls 
WHERE page_path LIKE '%prioritization%' 
ORDER BY page_path, poll_index;

-- Check if there are any wordcloud polls at all
SELECT COUNT(*) as total_wordcloud_polls FROM wordcloud_polls;

-- Check wordcloud polls by page
SELECT page_path, COUNT(*) as poll_count 
FROM wordcloud_polls 
GROUP BY page_path 
ORDER BY page_path;
