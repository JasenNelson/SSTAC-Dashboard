-- Clean up duplicate roles for jtrowell@ausenco.com
-- This script removes the 'member' role and keeps only the 'admin' role

-- First, check current roles for the user
SELECT 
    ur.user_id,
    au.email,
    ur.role,
    ur.created_at
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'jtrowell@ausenco.com'
ORDER BY ur.role;

-- Remove the 'member' role, keeping only 'admin'
DELETE FROM user_roles 
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'jtrowell@ausenco.com'
)
AND role = 'member';

-- Verify only admin role remains
SELECT 
    ur.user_id,
    au.email,
    ur.role,
    ur.created_at
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'jtrowell@ausenco.com'
ORDER BY ur.role;
