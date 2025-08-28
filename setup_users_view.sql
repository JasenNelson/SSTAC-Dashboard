-- Setup Users Overview View for Admin Dashboard
-- This script creates a view that safely exposes user information for admin management
-- Run this in your Supabase SQL editor

-- ============================================================================
-- USERS OVERVIEW VIEW
-- ============================================================================

-- Drop the view if it exists (for updates)
DROP VIEW IF EXISTS users_overview;

-- Create the users overview view
CREATE VIEW users_overview AS
WITH user_activities AS (
    -- Users from documents
    SELECT 
        user_id,
        user_email,
        created_at,
        'document' as activity_type
    FROM documents 
    WHERE user_id IS NOT NULL
    
    UNION ALL
    
    -- Users from discussions
    SELECT 
        user_id,
        user_email,
        created_at,
        'discussion' as activity_type
    FROM discussions 
    WHERE user_id IS NOT NULL
    
    UNION ALL
    
    -- Users from likes
    SELECT 
        user_id,
        NULL as user_email,
        created_at,
        'like' as activity_type
    FROM likes 
    WHERE user_id IS NOT NULL
    
    UNION ALL
    
    -- Users from user_roles (explicitly managed users)
    SELECT 
        user_id,
        NULL as user_email,
        created_at,
        'role' as activity_type
    FROM user_roles
)
SELECT DISTINCT
    ua.user_id as id,
    COALESCE(
        ua.user_email,
        'User ' || LEFT(ua.user_id::text, 8) || '...'
    ) as email,
    MIN(ua.created_at) as first_activity,
    MAX(ua.created_at) as last_activity,
    ur.role,
    CASE WHEN ur.role = 'admin' THEN true ELSE false END as is_admin,
    COUNT(DISTINCT ua.activity_type) as activity_count,
    ARRAY_AGG(DISTINCT ua.activity_type) FILTER (WHERE ua.activity_type IS NOT NULL) as activities
FROM user_activities ua
LEFT JOIN user_roles ur ON ua.user_id = ur.user_id
GROUP BY ua.user_id, ua.user_email, ur.role
ORDER BY last_activity DESC;

-- Grant permissions on the view
GRANT SELECT ON users_overview TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the view was created
SELECT 'users_overview view created successfully' as status;

-- Test the view
SELECT COUNT(*) as total_users FROM users_overview;

-- Show sample data
SELECT * FROM users_overview LIMIT 5;

-- Show users by role
SELECT 
    CASE 
        WHEN role = 'admin' THEN 'Admin Users'
        WHEN role IS NULL THEN 'Regular Users'
        ELSE 'Other Roles'
    END as user_category,
    COUNT(*) as user_count
FROM users_overview 
GROUP BY role
ORDER BY 
    CASE 
        WHEN role = 'admin' THEN 1
        WHEN role IS NULL THEN 2
        ELSE 3
    END;
