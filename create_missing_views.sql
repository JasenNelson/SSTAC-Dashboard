-- Create missing views for SSTAC Dashboard
-- Run this in your Supabase SQL editor

-- Create the discussion_stats view
CREATE OR REPLACE VIEW discussion_stats AS
SELECT 
  d.id,
  d.title,
  d.user_email as author,
  d.created_at,
  d.updated_at,
  COUNT(r.id) as reply_count,
  MAX(r.created_at) as last_reply_at
FROM discussions d
LEFT JOIN discussion_replies r ON d.id = r.discussion_id
GROUP BY d.id, d.title, d.user_email, d.created_at, d.updated_at
ORDER BY d.created_at DESC;

-- Create the documents_with_tags view
CREATE OR REPLACE VIEW documents_with_tags AS
SELECT 
  d.id,
  d.title,
  d.file_url,
  d.description,
  d.user_id,
  d.user_email,
  d.created_at,
  d.updated_at,
  COALESCE(
    ARRAY_AGG(
      CASE WHEN dt.tag_id IS NOT NULL THEN 
        json_build_object(
          'id', t.id,
          'name', t.name,
          'color', t.color
        )
      END
    ) FILTER (WHERE dt.tag_id IS NOT NULL),
    '{}'::json[]
  ) as tags
FROM documents d
LEFT JOIN document_tags dt ON d.id = dt.document_id
LEFT JOIN tags t ON dt.tag_id = t.id
GROUP BY d.id, d.title, d.file_url, d.description, d.user_id, d.user_email, d.created_at, d.updated_at
ORDER BY d.created_at DESC;

-- Grant permissions on the views
GRANT SELECT ON discussion_stats TO authenticated;
GRANT SELECT ON documents_with_tags TO authenticated;

-- Verify the views were created
SELECT 'discussion_stats view created successfully' as status;
SELECT 'documents_with_tags view created successfully' as status;
