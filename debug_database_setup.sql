-- Debug Database Setup for TWG Review Access Issues
-- Run this in Supabase SQL Editor to check if everything is set up correctly

-- Check if user_roles table exists and has data
SELECT 'user_roles table check' as check_type;
SELECT COUNT(*) as total_users FROM user_roles;
SELECT role, COUNT(*) as count FROM user_roles GROUP BY role;

-- Check if review_submissions table exists
SELECT 'review_submissions table check' as check_type;
SELECT COUNT(*) as total_submissions FROM review_submissions;

-- Check if the handle_new_user function exists
SELECT 'handle_new_user function check' as check_type;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- Check if the trigger exists
SELECT 'on_auth_user_created trigger check' as check_type;
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check RLS policies on review_submissions
SELECT 'review_submissions RLS policies check' as check_type;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'review_submissions';

-- Check if there are any users without roles
SELECT 'users without roles check' as check_type;
SELECT 
    au.id,
    au.email,
    au.created_at,
    ur.role
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE ur.user_id IS NULL
ORDER BY au.created_at DESC
LIMIT 10;

-- Check recent user registrations and their role assignments
SELECT 'recent user registrations check' as check_type;
SELECT 
    au.id,
    au.email,
    au.created_at,
    ur.role,
    ur.created_at as role_created_at
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
ORDER BY au.created_at DESC
LIMIT 10;
