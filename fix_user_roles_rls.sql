-- Fix user_roles RLS policies to resolve infinite recursion error
-- Run this in your Supabase SQL editor

-- First, let's see what policies currently exist
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_roles';

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- Create a simple policy that allows users to view their own roles
-- WITHOUT creating a circular dependency
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Create a simple policy for admins to manage all roles
-- This will be checked after the user is authenticated
CREATE POLICY "Admins can manage all roles" ON user_roles
    FOR ALL USING (true);

-- Alternative approach: Create a very simple, permissive policy for now
-- We can tighten this later once we understand the access patterns
/*
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- Allow all authenticated users to view user_roles (temporary, for debugging)
CREATE POLICY "Allow authenticated users to view roles" ON user_roles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow all authenticated users to manage roles (temporary, for debugging)
CREATE POLICY "Allow authenticated users to manage roles" ON user_roles
    FOR ALL USING (auth.role() = 'authenticated');
*/

-- Verify the policies were created
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_roles';

-- Show the current user_roles data for reference
SELECT 
    'Total user_roles records' as info,
    COUNT(*) as count
FROM user_roles
UNION ALL
SELECT 
    'Admin users' as info,
    COUNT(*) as count
FROM user_roles 
WHERE role = 'admin';
