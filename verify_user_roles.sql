-- Verify user_roles table structure and RLS policies
-- Run this in your Supabase SQL editor to diagnose the 406 error

-- 1. Check if the table exists
SELECT 
    table_name, 
    table_type,
    row_security
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_roles';

-- 2. Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_roles'
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_roles';

-- 4. Check if RLS is enabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_roles';

-- 5. Test basic query (replace with actual user ID)
-- SELECT * FROM user_roles LIMIT 5;

-- 6. Check for any constraints
SELECT 
    conname,
    contype,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'user_roles'::regclass;

-- 7. Verify the table has data
SELECT COUNT(*) as total_rows FROM user_roles;

-- 8. Check for any triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'user_roles';
