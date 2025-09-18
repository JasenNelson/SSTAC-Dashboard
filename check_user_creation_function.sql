-- Check if handle_new_user function exists and is working
-- Run this in Supabase SQL Editor

-- Check if function exists
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

-- Test the function manually (this should work)
-- Note: This will create a test user role entry
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
BEGIN
    -- Test inserting a user role
    INSERT INTO user_roles (user_id, role, created_at)
    VALUES (test_user_id, 'member', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Check if it was inserted
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = test_user_id) THEN
        RAISE NOTICE 'SUCCESS: User role insertion works';
        -- Clean up test data
        DELETE FROM user_roles WHERE user_id = test_user_id;
    ELSE
        RAISE NOTICE 'ERROR: User role insertion failed';
    END IF;
END $$;

-- Check current user_roles table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_roles'
ORDER BY ordinal_position;

-- Check if there are any recent users without roles
SELECT 
    au.id,
    au.email,
    au.created_at,
    ur.role,
    ur.created_at as role_created_at
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
AND ur.role IS NULL
ORDER BY au.created_at DESC
LIMIT 10;
