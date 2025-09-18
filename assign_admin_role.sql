-- Assign admin role to jtrowell@ausenco.com
-- Run this in Supabase SQL Editor

-- First, check if the user exists
SELECT 
    id, 
    email, 
    created_at 
FROM auth.users 
WHERE email = 'jtrowell@ausenco.com';

-- Assign admin role
INSERT INTO user_roles (user_id, role, created_at)
SELECT 
    id, 
    'admin', 
    NOW()
FROM auth.users 
WHERE email = 'jtrowell@ausenco.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the role was assigned
SELECT 
    ur.user_id,
    au.email,
    ur.role,
    ur.created_at
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'jtrowell@ausenco.com';
