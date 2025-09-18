-- Fix user creation database issues
-- Run this in Supabase SQL Editor

-- First, check if the function exists and is working
SELECT 
    routine_name, 
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND trigger_name = 'on_auth_user_created';

-- Drop the trigger first (it depends on the function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop and recreate the function to ensure it's working
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert the new user into user_roles with 'member' role
    -- Use ON CONFLICT to prevent duplicate entries
    INSERT INTO user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'member', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log the operation (optional - for debugging)
    RAISE NOTICE 'New user created: % with member role', NEW.id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log any errors but don't fail the user creation
        RAISE WARNING 'Error creating user role for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Test the function manually using an existing user
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Get an existing user ID for testing
    SELECT id INTO test_user_id FROM auth.users WHERE email_confirmed_at IS NOT NULL LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Test inserting a user role (this should work with ON CONFLICT)
        INSERT INTO user_roles (user_id, role, created_at)
        VALUES (test_user_id, 'member', NOW())
        ON CONFLICT (user_id, role) DO NOTHING;
        
        -- Check if the user has a role (either existing or newly created)
        IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = test_user_id) THEN
            RAISE NOTICE 'SUCCESS: User role system is working for user %', test_user_id;
        ELSE
            RAISE NOTICE 'ERROR: User role insertion failed for user %', test_user_id;
        END IF;
    ELSE
        RAISE NOTICE 'WARNING: No confirmed users found to test with';
    END IF;
END $$;

-- Check for users without roles and assign them
INSERT INTO user_roles (user_id, role, created_at)
SELECT 
    au.id,
    'member',
    NOW()
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
AND ur.role IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the fix
SELECT 
    'Users without roles' as check_type,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
AND ur.role IS NULL

UNION ALL

SELECT 
    'Total users with roles',
    COUNT(*)
FROM user_roles;

-- Show recent user activity
SELECT 
    au.id,
    au.email,
    au.created_at,
    ur.role,
    ur.created_at as role_created_at,
    CASE WHEN ur.role IS NOT NULL THEN 'HAS ROLE' ELSE 'NO ROLE' END as status
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
ORDER BY au.created_at DESC
LIMIT 10;
