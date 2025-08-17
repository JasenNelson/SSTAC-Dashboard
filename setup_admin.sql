-- Setup Admin User Script
-- Run this in your Supabase SQL editor after creating the user_roles table

-- First, make sure you have a user account created through Supabase Auth
-- Then, replace 'your-email@example.com' with the actual email of the user you want to make admin

-- Option 1: Insert admin role for a specific user (replace with actual email)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Option 2: If you know the user's UUID, you can use this instead:
-- INSERT INTO user_roles (user_id, role)
-- VALUES ('your-user-uuid-here', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Option 3: Make the first user in the system an admin (use with caution)
-- INSERT INTO user_roles (user_id, role)
-- SELECT id, 'admin'
-- FROM auth.users
-- ORDER BY created_at ASC
-- LIMIT 1
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the admin user was created
SELECT 
  u.email,
  ur.role,
  ur.created_at
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE ur.role = 'admin';
