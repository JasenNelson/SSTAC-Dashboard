-- Recreate user_roles table from scratch
-- Run this in your Supabase SQL editor

-- First, check if the table exists
SELECT 
    table_name, 
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_roles';

-- Drop the table if it exists (to start fresh)
DROP TABLE IF EXISTS user_roles CASCADE;

-- Create the user_roles table
CREATE TABLE user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create simple, safe RLS policies
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow all authenticated users to manage roles" ON user_roles
    FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Insert your admin user (replace with your actual UUID)
INSERT INTO user_roles (user_id, role) VALUES 
('23e1cb9f-5eb9-4463-9421-fbb3134a68d1', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the table was created
SELECT 
    table_name, 
    table_type,
    row_security
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_roles';

-- Verify the data was inserted
SELECT * FROM user_roles;

-- Verify RLS policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_roles';

-- Test the table access
SELECT COUNT(*) as total_records FROM user_roles;
SELECT COUNT(*) as admin_users FROM user_roles WHERE role = 'admin';
