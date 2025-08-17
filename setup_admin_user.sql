-- Setup script for admin user management
-- Run this in your Supabase SQL editor

-- 1. Create the user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- 2. Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Only admins can insert/update/delete roles
CREATE POLICY "Admins can manage all roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Grant permissions
GRANT ALL ON user_roles TO authenticated;
GRANT USAGE ON SEQUENCE user_roles_id_seq TO authenticated;

-- 5. IMPORTANT: Add the current user as admin
-- Replace 'jasen.nelson@gmail.com' with your actual email if different
INSERT INTO user_roles (user_id, role) 
SELECT id, 'admin' 
FROM auth.users 
WHERE email = 'jasen.nelson@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Alternative: If you want to make the first user an admin, you can run:
-- INSERT INTO user_roles (user_id, role) 
-- SELECT id, 'admin' 
-- FROM auth.users 
-- LIMIT 1
-- ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Check existing users and roles
SELECT 
  u.email,
  ur.role,
  u.created_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at DESC;

-- 8. Verify admin user was created
SELECT 
  u.email,
  ur.role
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';
