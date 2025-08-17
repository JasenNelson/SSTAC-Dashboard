-- Backup approach to fix user_roles access issues
-- Run this if the main fix doesn't work

-- Option 1: Temporarily disable RLS to test if that's the issue
-- WARNING: This removes security temporarily - only use for testing
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Test if you can now access the table
SELECT * FROM user_roles LIMIT 5;

-- If the above works, then RLS policies are the issue
-- Re-enable RLS and try the main fix script
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Option 2: Create a very permissive policy (for debugging only)
-- This allows any authenticated user to see all roles
DROP POLICY IF EXISTS "Debug: Allow all authenticated users" ON user_roles;
CREATE POLICY "Debug: Allow all authenticated users" ON user_roles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Option 3: Check if the table structure is correct
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_roles'
ORDER BY ordinal_position;

-- Option 4: Verify the data exists and is accessible
SELECT COUNT(*) as total_records FROM user_roles;
SELECT DISTINCT role FROM user_roles;

-- Option 5: Check if there are any triggers or constraints blocking access
SELECT 
    trigger_name,
    event_manipulation
FROM information_schema.triggers 
WHERE event_object_table = 'user_roles';
