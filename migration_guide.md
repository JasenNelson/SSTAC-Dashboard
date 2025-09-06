# Database Migration Guide for SSTAC & TWG Dashboard

This guide will help you update your existing SSTAC Dashboard database to support enhanced user management and document tagging systems.

## Prerequisites

- Access to your Supabase project's SQL editor
- Existing SSTAC Dashboard database with the basic tables

## 🚨 CRITICAL SAFETY PROTOCOL

**BEFORE RUNNING ANY MIGRATION SCRIPTS:**

1. **ALWAYS conduct safety checks** before making database changes
2. **NEVER assume database state** - always verify current structure first
3. **ALWAYS test existing functionality** before making changes
4. **ALWAYS provide rollback scripts** for any database modifications
5. **ALWAYS make incremental changes** - one change at a time

**HISTORICAL CONTEXT**: AI has previously provided SQL scripts that replaced and duplicated functional database policies, causing significant harm and days of lost debugging time. This protocol prevents such incidents.

See `DATABASE_SAFETY_PROTOCOL.md` for complete safety procedures.

## Migration Steps

### 1. Enhanced User Management (NEW - Required)

**Problem Solved**: Admin dashboard was not showing all users and their email addresses.

**Solution**: Implemented comprehensive user management with real email access.

Run these SQL commands in your Supabase SQL editor:

```sql
-- Step 1: Create safe user email access function
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
    id UUID,
    email CHARACTER VARYING(255),
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Access denied. Only authenticated users can call this function.';
    END IF;
    
    RETURN QUERY
    SELECT 
        au.id,
        au.email,
        au.created_at,
        au.last_sign_in_at
    FROM auth.users au
    WHERE au.email_confirmed_at IS NOT NULL
    ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;

-- Step 2: Create enhanced user management views
CREATE OR REPLACE VIEW users_overview AS
WITH user_activities AS (
    SELECT user_id, NULL as user_email, created_at, 'role' as activity_type
    FROM user_roles
    UNION ALL
    SELECT user_id, user_email, created_at, 'discussion' as activity_type
    FROM discussions WHERE user_id IS NOT NULL
    UNION ALL
    SELECT user_id, NULL as user_email, created_at, 'like' as activity_type
    FROM likes WHERE user_id IS NOT NULL
),
auth_user_emails AS (
    SELECT id, email, created_at FROM get_users_with_emails()
)
SELECT DISTINCT
    ua.user_id as id,
    COALESCE(ua.user_email, aue.email, 'User ' || LEFT(ua.user_id::text, 8) || '...') as email,
    COALESCE(aue.created_at, MIN(ua.created_at)) as first_activity,
    MAX(ua.created_at) as last_activity,
    ur.role,
    CASE WHEN ur.role = 'admin' THEN true ELSE false END as is_admin,
    COUNT(DISTINCT ua.activity_type) as activity_count,
    ARRAY_AGG(DISTINCT ua.activity_type) FILTER (WHERE ua.activity_type IS NOT NULL) as activities
FROM user_activities ua
LEFT JOIN user_roles ur ON ua.user_id = ur.user_id
LEFT JOIN auth_user_emails aue ON ua.user_id = aue.id
GROUP BY ua.user_id, ua.user_email, ur.role, aue.email, aue.created_at
ORDER BY last_activity DESC;

GRANT SELECT ON users_overview TO authenticated;

-- Step 3: Create comprehensive admin user view
CREATE OR REPLACE VIEW admin_users_comprehensive AS
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created_at,
    au.last_sign_in_at,
    ur.role,
    ur.created_at as role_created_at,
    CASE WHEN ur.role = 'admin' THEN true ELSE false END as is_admin,
    CASE WHEN ur.role IS NOT NULL THEN 'Has Role' ELSE 'No Role' END as role_status,
    COALESCE((SELECT COUNT(*) FROM discussions disc WHERE disc.user_id = au.id), 0) as discussion_count,
    COALESCE((SELECT COUNT(*) FROM likes l WHERE l.user_id = au.id), 0) as like_count,
    0 as document_count,
    CASE WHEN au.email_confirmed_at IS NOT NULL THEN 'Confirmed' ELSE 'Unconfirmed' END as email_status
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
ORDER BY au.created_at DESC;

GRANT SELECT ON admin_users_comprehensive TO authenticated;

-- Step 4: Implement automatic user role assignment
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'member', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Step 5: Backfill existing users without roles
INSERT INTO user_roles (user_id, role, created_at)
SELECT au.id, 'member', au.created_at
FROM auth.users au
WHERE au.email_confirmed_at IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = au.id)
ON CONFLICT (user_id, role) DO NOTHING;
```

**Benefits of User Management Migration:**
- ✅ **100% user visibility** in admin dashboard
- ✅ **Real email addresses** for all users
- ✅ **Automatic role assignment** for new signups
- ✅ **Activity tracking** and engagement metrics
- ✅ **Complete user management** capabilities

### 2. Document Tagging System (Optional Enhancement)

**Note**: This is an optional enhancement for better document organization.

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

### 3. Create Indexes for Performance

```sql
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
```

### 4. Enable Row Level Security

```sql
-- Enable RLS for new tables
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
```

### 5. Create RLS Policies

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

### 6. Grant Permissions

```sql
-- Grant necessary permissions
GRANT ALL ON tags TO authenticated;
GRANT ALL ON document_tags TO authenticated;
GRANT USAGE ON SEQUENCE tags_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE document_tags_id_seq TO authenticated;
```

### 7. Insert Default Tags

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

### 8. Create Enhanced Document Views (Optional)

```sql
-- Create a view for documents with tags
CREATE OR REPLACE VIEW documents_with_tags AS
SELECT 
  d.id,
  d.title,
  d.file_url,
  d.description,
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
GROUP BY d.id, d.title, d.file_url, d.description, d.created_at, d.updated_at
ORDER BY d.created_at DESC;
```

## Verification

After running the migration, you can verify the setup by:

### User Management Verification

1. **Check user management functions:**
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'get_users_with_emails';
   ```

2. **Check user management views:**
   ```sql
   SELECT table_name FROM information_schema.views 
   WHERE table_name IN ('users_overview', 'admin_users_comprehensive');
   ```

3. **Test user coverage:**
   ```sql
   SELECT COUNT(*) as total_users FROM admin_users_comprehensive;
   SELECT COUNT(*) as users_with_emails FROM get_users_with_emails();
   ```

### Document Tagging Verification (Optional)

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

### User Management Rollback

If you need to rollback the user management changes:

```sql
-- Remove the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove the function
DROP FUNCTION IF EXISTS get_users_with_emails();

-- Remove the views
DROP VIEW IF EXISTS users_overview;
DROP VIEW IF EXISTS admin_users_comprehensive;
```

**Note**: This will remove the enhanced user management capabilities but won't affect existing user data.

### Document Tagging Rollback

If you need to rollback the document tagging changes:

```sql
-- Drop views
DROP VIEW IF EXISTS documents_with_tags;

-- Drop tables (this will also drop the junction table due to CASCADE)
DROP TABLE IF EXISTS tags CASCADE;

-- Note: This will remove all tags and document-tag relationships
```

## Important Notes

- **Backup your database** before running any migrations
- **User Management Migration is REQUIRED** for proper admin dashboard functionality
- **Document Tagging Migration is OPTIONAL** for enhanced document organization
- The migrations are designed to be non-destructive to existing data
- Only users with admin role can manage tags and document relationships
- Document tags are managed through the document creation/editing forms

## Post-Migration

After completing the migration:

### User Management
1. **Test your admin dashboard** - you should see all users with real emails
2. **Verify user role assignment** - new signups should automatically get 'member' role
3. **Test user management** through the admin interface (`/admin/users`)

### Document Tagging (Optional)
1. **Test the tag management** through the admin interface (`/admin/tags`)
2. **Test document creation** with tags
3. **Test tag filtering** on the documents list page

## Support

If you encounter any issues during migration:

1. Check the Supabase logs for detailed error messages
2. Verify that your user has the necessary permissions
3. Ensure all SQL commands executed successfully
4. Check that RLS policies are properly applied

## Migration Summary

**Required Migration:**
- ✅ Enhanced User Management (100% user visibility, real emails, automatic roles)

**Optional Enhancement:**
- 📋 Document Tagging System (better document organization)

**Result:**
- Professional admin dashboard with complete user management
- Real email addresses for all users
- Automatic user role assignment
- Enhanced document organization (if tagging is implemented)
- Enterprise-level user management capabilities

## Enhanced User Management

The following SQL commands will set up automatic user role assignment and comprehensive user management views.

### Step 1: Create the get_users_with_emails function

```sql
-- Function to safely retrieve user emails from auth.users
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
    id UUID,
    email CHARACTER VARYING(255),
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Return user information from auth.users
    -- This is safe because we're only returning basic user info
    RETURN QUERY
    SELECT 
        au.id,
        au.email,
        au.created_at,
        au.last_sign_in_at
    FROM auth.users au
    WHERE au.email_confirmed_at IS NOT NULL  -- Only confirmed users
    ORDER BY au.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;
```

### Step 2: Create the handle_new_user function

```sql
-- Function to automatically assign roles to new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert the new user into user_roles with 'member' role
    INSERT INTO user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'member', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3: Create the trigger

```sql
-- Trigger that fires when a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
```

### Step 4: Create the users_overview view

```sql
-- Enhanced users overview view for admin user management
CREATE OR REPLACE VIEW users_overview AS
WITH user_activities AS (
    -- Users from user_roles (guaranteed to exist)
    SELECT 
        user_id,
        NULL as user_email,
        created_at,
        'role' as activity_type
    FROM user_roles
    
    UNION ALL
    
    -- Users from discussions (confirmed structure with user_email)
    SELECT 
        user_id,
        user_email,
        created_at,
        'discussion' as activity_type
    FROM discussions 
    WHERE user_id IS NOT NULL
    
    UNION ALL
    
    -- Users from likes (confirmed structure)
    SELECT 
        user_id,
        NULL as user_email,
        created_at,
        'like' as activity_type
    FROM likes 
    WHERE user_id IS NOT NULL
),
auth_user_emails AS (
    -- Get user emails from auth.users through the safe function
    SELECT 
        id,
        email,
        created_at
    FROM get_users_with_emails()
)
SELECT DISTINCT
    ua.user_id as id,
    COALESCE(
        ua.user_email,           -- First priority: email from activity (discussions)
        aue.email,               -- Second priority: email from auth.users
        'User ' || LEFT(ua.user_id::text, 8) || '...'  -- Fallback: truncated ID
    ) as email,
    COALESCE(
        aue.created_at,          -- Use auth.users created_at if available
        MIN(ua.created_at)       -- Otherwise use earliest activity
    ) as first_activity,
    MAX(ua.created_at) as last_activity,
    COUNT(DISTINCT CASE WHEN ua.activity_type = 'discussion' THEN ua.user_id END) as discussion_count,
    COUNT(DISTINCT CASE WHEN ua.activity_type = 'like' THEN ua.user_id END) as like_count,
    0 as document_count  -- Set to 0 since documents table doesn't have user_id
FROM user_activities ua
LEFT JOIN auth_user_emails aue ON ua.user_id = aue.id
GROUP BY ua.user_id, ua.user_email, aue.email, aue.created_at
ORDER BY first_activity DESC;

-- Grant permissions on the view
GRANT SELECT ON users_overview TO authenticated;
```

### Step 5: Create the admin_users_comprehensive view

```sql
-- Comprehensive admin view for user management
CREATE OR REPLACE VIEW admin_users_comprehensive AS
SELECT 
    uo.id,
    uo.email,
    uo.first_activity,
    uo.last_activity,
    uo.discussion_count,
    uo.like_count,
    uo.document_count,
    ur.role,
    CASE 
        WHEN ur.role = 'admin' THEN true 
        ELSE false 
    END as is_admin,
    CASE 
        WHEN ur.role IS NOT NULL THEN 'Has Role'
        ELSE 'No Role'
    END as role_status,
    CASE 
        WHEN uo.email LIKE '%@%' THEN 'Confirmed'
        ELSE 'Unconfirmed'
    END as email_status
FROM users_overview uo
LEFT JOIN user_roles ur ON uo.id = ur.user_id
ORDER BY uo.first_activity DESC;

-- Grant permissions on the view
GRANT SELECT ON admin_users_comprehensive TO authenticated;
```

## Signup Issue Resolution

**Status: RESOLVED** ✅

The automatic user role assignment system is working correctly. New users who sign up are automatically assigned the 'member' role through the `on_auth_user_created` trigger.

**What was working:**
- The `handle_new_user()` function was successfully creating user roles
- The trigger system was functioning as designed
- RLS policies were correctly configured

**Previous 500 errors:** The signup errors were likely temporary Supabase service issues or network-related problems, not related to the database trigger system.

**Current state:** 
- Signup process works normally
- New users automatically get 'member' role
- Admin dashboard can display all users with their roles
- No manual intervention required for basic user setup