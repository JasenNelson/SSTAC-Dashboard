-- Check if user_roles table actually exists and its structure
-- Run this to verify the real state

-- 1. Check if user_roles table exists
SELECT 
    'Table Exists Check' as check_type,
    table_name,
    table_type,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'user_roles'
ORDER BY table_schema;

-- 2. Check table structure if it exists
SELECT 
    'Table Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'user_roles'
ORDER BY ordinal_position;

-- 3. Check if we can query the table
SELECT 
    'Table Query Test' as check_type,
    COUNT(*) as row_count
FROM user_roles;

-- 4. Check RLS status
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_roles';

-- 5. Check permissions
SELECT 
    'Permissions' as check_type,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'user_roles'
AND grantee = 'authenticated';

-- 6. Check if there are any constraints
SELECT 
    'Constraints' as check_type,
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'user_roles';

-- 7. Check foreign key constraints specifically
SELECT 
    'Foreign Keys' as check_type,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'user_roles';
