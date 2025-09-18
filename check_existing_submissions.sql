-- Check for existing TWG review submissions
-- Run this to see if there are any existing submissions that need to be migrated

-- Check if review_submissions table exists and has data
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'review_submissions') 
        THEN 'Table exists'
        ELSE 'Table does not exist'
    END as table_status;

-- If table exists, check for data
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'review_submissions') 
        THEN (SELECT COUNT(*)::text FROM review_submissions)
        ELSE 'N/A'
    END as submission_count;

-- Check if admin_review_submissions view exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'admin_review_submissions') 
        THEN 'View exists'
        ELSE 'View does not exist'
    END as view_status;

-- Check for any existing data in related tables that might contain review data
SELECT 'documents' as source, COUNT(*) as count FROM documents WHERE title ILIKE '%review%' OR content ILIKE '%review%'
UNION ALL
SELECT 'discussions' as source, COUNT(*) as count FROM discussions WHERE title ILIKE '%review%' OR content ILIKE '%review%'
UNION ALL
SELECT 'announcements' as source, COUNT(*) as count FROM announcements WHERE title ILIKE '%review%' OR content ILIKE '%review%';
