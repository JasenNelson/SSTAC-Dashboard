-- MINIMAL FIX SCRIPT - Only run AFTER diagnostic queries confirm what's broken
-- This script only fixes what's actually needed

-- ============================================================================
-- OPTION 1: If function exists but trigger is missing
-- ============================================================================
-- Only run this if diagnostic shows function exists but trigger is missing

-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- OPTION 2: If function is missing or broken
-- ============================================================================
-- Only run this if diagnostic shows function is missing or not working

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS handle_new_user();

-- CREATE OR REPLACE FUNCTION handle_new_user()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     INSERT INTO user_roles (user_id, role, created_at)
--     VALUES (NEW.id, 'member', NOW())
--     ON CONFLICT (user_id, role) DO NOTHING;
--     RETURN NEW;
-- EXCEPTION
--     WHEN OTHERS THEN
--         RAISE WARNING 'Error creating user role for %: %', NEW.id, SQLERRM;
--         RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- OPTION 3: If users are missing roles (one-time fix)
-- ============================================================================
-- Only run this if diagnostic shows users without roles

-- INSERT INTO user_roles (user_id, role, created_at)
-- SELECT 
--     au.id,
--     'member',
--     NOW()
-- FROM auth.users au
-- LEFT JOIN user_roles ur ON au.id = ur.user_id
-- WHERE au.email_confirmed_at IS NOT NULL
-- AND ur.role IS NULL
-- ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================================
-- INSTRUCTIONS:
-- 1. Run diagnostic_queries.sql first
-- 2. Based on results, uncomment ONLY the needed option above
-- 3. Run the minimal fix
-- 4. Verify with diagnostic queries again
-- ============================================================================
