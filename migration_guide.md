# Database Migration Guide for Document Tagging

This guide will help you update your existing SSTAC Dashboard database to support the new document tagging system.

## Prerequisites

- Access to your Supabase project's SQL editor
- Existing SSTAC Dashboard database with the basic tables

## Migration Steps

### 1. Create New Tables

Run the following SQL commands in your Supabase SQL editor:

```sql
-- Create tags table for document categorization
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create document_tags junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS document_tags (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, tag_id)
);
```

### 2. Create Indexes

```sql
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
```

### 3. Enable Row Level Security

```sql
-- Enable RLS for new tables
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
```

### 4. Create RLS Policies

```sql
-- RLS Policies for tags table
-- Users can view all tags
CREATE POLICY "Users can view all tags" ON tags
  FOR SELECT USING (true);

-- Only admins can create/edit/delete tags
CREATE POLICY "Only admins can create tags" ON tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update tags" ON tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete tags" ON tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for document_tags table
-- Users can view all document tags
CREATE POLICY "Users can view all document tags" ON document_tags
  FOR SELECT USING (true);

-- Only admins can manage document tags
CREATE POLICY "Only admins can manage document tags" ON document_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### 5. Grant Permissions

```sql
-- Grant necessary permissions
GRANT ALL ON tags TO authenticated;
GRANT ALL ON document_tags TO authenticated;
GRANT USAGE ON SEQUENCE tags_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE document_tags_id_seq TO authenticated;
```

### 6. Insert Default Tags

```sql
-- Insert some default tags for common document categories
INSERT INTO tags (name, color) VALUES 
  ('Technical Specification', '#3B7280'),    -- Blue
  ('Meeting Minutes', '#10B981'),           -- Green
  ('Policy Document', '#F59E0B'),           -- Yellow
  ('Procedure Guide', '#8B5CF6'),           -- Purple
  ('Research Paper', '#EF4444'),            -- Red
  ('Standard Operating Procedure', '#06B6D4'), -- Cyan
  ('Training Material', '#84CC16'),         -- Lime
  ('Reference Document', '#F97316')         -- Orange
ON CONFLICT (name) DO NOTHING;
```

### 7. Create Views (Optional)

```sql
-- Create a view for documents with tags
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
```

## Verification

After running the migration, you can verify the setup by:

1. **Check tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('tags', 'document_tags');
   ```

2. **Check default tags:**
   ```sql
   SELECT * FROM tags ORDER BY name;
   ```

3. **Check RLS policies:**
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE tablename IN ('tags', 'document_tags');
   ```

## Rollback (if needed)

If you need to rollback the changes:

```sql
-- Drop views
DROP VIEW IF EXISTS documents_with_tags;

-- Drop tables (this will also drop the junction table due to CASCADE)
DROP TABLE IF EXISTS tags CASCADE;

-- Note: This will remove all tags and document-tag relationships
```

## Important Notes

- **Backup your database** before running any migrations
- The migration is designed to be non-destructive to existing data
- Default tags are provided but can be customized through the admin interface
- Only users with admin role can manage tags
- Document tags are managed through the document creation/editing forms

## Post-Migration

After completing the migration:

1. **Update your application code** to use the new tagging components
2. **Test the tag management** through the admin interface (`/admin/tags`)
3. **Test document creation** with tags
4. **Test tag filtering** on the documents list page

## Support

If you encounter any issues during migration:

1. Check the Supabase logs for detailed error messages
2. Verify that your user has the necessary permissions
3. Ensure all SQL commands executed successfully
4. Check that RLS policies are properly applied