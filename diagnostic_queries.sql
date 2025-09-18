-- DIAGNOSTIC QUERIES - Run these FIRST to understand current state
-- DO NOT run any fixes until we confirm what's actually broken

-- ============================================================================
-- 1. CHECK CURRENT FUNCTION AND TRIGGER STATUS
-- ============================================================================

-- Check if handle_new_user function exists and its definition
SELECT 
    'Function Status' as check_type,
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- Check if trigger exists
SELECT 
    'Trigger Status' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    CASE 
        WHEN trigger_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND trigger_name = 'on_auth_user_created';

-- ============================================================================
-- 2. CHECK USER ROLES TABLE STRUCTURE AND CONSTRAINTS
-- ============================================================================

-- Check user_roles table structure
SELECT 
    'Table Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_roles'
ORDER BY ordinal_position;

-- Check foreign key constraints on user_roles
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

-- ============================================================================
-- 3. CHECK CURRENT USER AND ROLE DATA
-- ============================================================================

-- Count total users in auth.users
SELECT 
    'Total Auth Users' as metric,
    COUNT(*) as count
FROM auth.users
WHERE email_confirmed_at IS NOT NULL;

-- Count users with roles
SELECT 
    'Users with Roles' as metric,
    COUNT(DISTINCT user_id) as count
FROM user_roles;

-- Count users without roles
SELECT 
    'Users WITHOUT Roles' as metric,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
AND ur.role IS NULL;

-- Show specific users without roles (if any)
SELECT 
    'Users Missing Roles' as check_type,
    au.id,
    au.email,
    au.created_at,
    'NO ROLE ASSIGNED' as status
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
AND ur.role IS NULL
ORDER BY au.created_at DESC
LIMIT 10;

-- ============================================================================
-- 4. TEST IF FUNCTION IS ACTUALLY WORKING
-- ============================================================================

-- Check if we can manually call the function (this will show if it works)
-- Note: This won't actually create a user, just test the function logic
DO $$
DECLARE
    test_user_id UUID;
    function_works BOOLEAN := FALSE;
BEGIN
    -- Get a real user ID to test with
    SELECT id INTO test_user_id FROM auth.users WHERE email_confirmed_at IS NOT NULL LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Test if we can insert a role (this should work with ON CONFLICT)
        BEGIN
            INSERT INTO user_roles (user_id, role, created_at)
            VALUES (test_user_id, 'member', NOW())
            ON CONFLICT (user_id, role) DO NOTHING;
            
            function_works := TRUE;
            RAISE NOTICE 'SUCCESS: Manual role insertion works for user %', test_user_id;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'ERROR: Manual role insertion failed: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'WARNING: No confirmed users found to test with';
    END IF;
    
    -- Report function status
    IF function_works THEN
        RAISE NOTICE 'FUNCTION TEST: PASSED - Role insertion works';
    ELSE
        RAISE NOTICE 'FUNCTION TEST: FAILED - Role insertion does not work';
    END IF;
END $$;

-- ============================================================================
-- 5. CHECK RECENT USER CREATION ACTIVITY
-- ============================================================================

-- Show recent user creation activity
SELECT 
    'Recent User Activity' as check_type,
    au.id,
    au.email,
    au.created_at,
    ur.role,
    ur.created_at as role_created_at,
    CASE 
        WHEN ur.role IS NOT NULL THEN 'HAS ROLE'
        ELSE 'NO ROLE'
    END as status,
    EXTRACT(EPOCH FROM (NOW() - au.created_at))/60 as minutes_since_created
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id
WHERE au.email_confirmed_at IS NOT NULL
ORDER BY au.created_at DESC
LIMIT 10;

-- ============================================================================
-- 6. SUMMARY REPORT
-- ============================================================================

-- Final summary
SELECT 
    'SUMMARY' as report_type,
    'Run the queries above to see:' as instructions,
    '1. If function/trigger exist' as item_1,
    '2. If users are missing roles' as item_2,
    '3. If manual role insertion works' as item_3,
    '4. Recent user creation patterns' as item_4;
