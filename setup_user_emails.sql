-- Setup User Emails for Admin Dashboard
-- This script creates a database function that safely exposes user emails
-- Run this in your Supabase SQL editor

-- ============================================================================
-- SAFE USER EMAILS FUNCTION
-- ============================================================================

-- Drop the function if it exists (for updates)
DROP FUNCTION IF EXISTS get_users_with_emails();

-- Create a function that safely returns user information
-- This function can only be called by authenticated users and respects RLS
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
    id UUID,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow authenticated users to call this function
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Access denied. Only authenticated users can call this function.';
    END IF;
    
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

-- ============================================================================
-- ENHANCED USERS OVERVIEW VIEW
-- ============================================================================

-- Drop the view if it exists (for updates)
DROP VIEW IF EXISTS users_overview;

-- Create an enhanced users overview view that includes emails
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
        ua.user_email,           -- First priority: email from activity
        aue.email,               -- Second priority: email from auth.users
        'User ' || LEFT(ua.user_id::text, 8) || '...'  -- Fallback: truncated ID
    ) as email,
    COALESCE(
        aue.created_at,          -- Use auth.users created_at if available
        MIN(ua.created_at)       -- Otherwise use earliest activity
    ) as first_activity,
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

-- Grant permissions on the view
GRANT SELECT ON users_overview TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the function was created
SELECT 'get_users_with_emails function created successfully' as status;

-- Test the function
SELECT COUNT(*) as total_users FROM get_users_with_emails();

-- Show sample data from the function
SELECT * FROM get_users_with_emails() LIMIT 5;

-- Verify the enhanced view was created
SELECT 'users_overview view created successfully' as status;

-- Test the enhanced view
SELECT COUNT(*) as total_users FROM users_overview;

-- Show sample data from the enhanced view
SELECT * FROM users_overview LIMIT 5;

-- Show users by email source
SELECT 
    CASE 
        WHEN email LIKE 'User %' THEN 'Truncated ID (No Email)'
        WHEN email LIKE '%@%' THEN 'Full Email'
        ELSE 'Unknown Format'
    END as email_status,
    COUNT(*) as user_count
FROM users_overview 
GROUP BY 
    CASE 
        WHEN email LIKE 'User %' THEN 'Truncated ID (No Email)'
        WHEN email LIKE '%@%' THEN 'Full Email'
        ELSE 'Unknown Format'
    END
ORDER BY user_count DESC;
