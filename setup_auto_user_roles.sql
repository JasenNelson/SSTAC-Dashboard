-- Setup Automatic User Role Creation
-- This script creates triggers that automatically add users to user_roles when they sign up
-- Run this in your Supabase SQL editor AFTER running setup_user_emails.sql

-- ============================================================================
-- AUTOMATIC USER ROLE CREATION
-- ============================================================================

-- Create a function that will be called when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert the new user into user_roles with 'user' role
    INSERT INTO user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'user', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger that fires when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- BACKFILL EXISTING USERS
-- ============================================================================

-- Add existing users who don't have roles yet
INSERT INTO user_roles (user_id, role, created_at)
SELECT 
    au.id,
    'user',
    au.created_at
FROM auth.users au
WHERE au.email_confirmed_at IS NOT NULL  -- Only confirmed users
AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = au.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================================
-- ENHANCED USER MANAGEMENT VIEW
-- ============================================================================

-- Create a comprehensive user management view
CREATE OR REPLACE VIEW admin_users_comprehensive AS
SELECT 
    au.id,
    au.email,
    au.created_at as auth_created_at,
    au.last_sign_in_at,
    ur.role,
    ur.created_at as role_created_at,
    CASE WHEN ur.role = 'admin' THEN true ELSE false END as is_admin,
    CASE 
        WHEN ur.role IS NOT NULL THEN 'Has Role'
        ELSE 'No Role'
    END as role_status,
    COALESCE(
        (SELECT COUNT(*) FROM documents d WHERE d.user_id = au.id),
        0
    ) as document_count,
    COALESCE(
        (SELECT COUNT(*) FROM discussions disc WHERE disc.user_id = au.id),
        0
    ) as discussion_count,
    COALESCE(
        (SELECT COUNT(*) FROM likes l WHERE l.user_id = au.id),
        0
    ) as like_count,
    CASE 
        WHEN au.email_confirmed_at IS NOT NULL THEN 'Confirmed'
        ELSE 'Unconfirmed'
    END as email_status
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL  -- Only show confirmed users
ORDER BY au.created_at DESC;

-- Grant permissions on the view
GRANT SELECT ON admin_users_comprehensive TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the trigger was created
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check how many users now have roles
SELECT 
    'Users with roles' as category,
    COUNT(*) as count
FROM user_roles
UNION ALL
SELECT 
    'Total confirmed users' as category,
    COUNT(*) as count
FROM auth.users 
WHERE email_confirmed_at IS NOT NULL;

-- Test the comprehensive view
SELECT COUNT(*) as total_users FROM admin_users_comprehensive;

-- Show sample data from the comprehensive view
SELECT 
    email,
    role,
    is_admin,
    role_status,
    document_count,
    discussion_count,
    like_count,
    email_status
FROM admin_users_comprehensive 
LIMIT 10;

-- Show users by role
SELECT 
    COALESCE(role, 'No Role') as user_role,
    COUNT(*) as user_count
FROM admin_users_comprehensive 
GROUP BY role
ORDER BY 
    CASE 
        WHEN role = 'admin' THEN 1
        WHEN role = 'user' THEN 2
        ELSE 3
    END;
