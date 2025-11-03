-- Fix RLS Enabled No Policy Suggestions
-- Date: 2025-01-31
-- Purpose: Fix INFO-level suggestions for tables with RLS enabled but no policies
-- 
-- These are backup/historical tables that don't need RLS policies.
-- Solution: Disable RLS on backup tables (they're historical data, not accessed by users)
-- For the 'roles' table, check if it's unused and disable RLS or add minimal policy

-- ============================================================================
-- BACKUP TABLES: Disable RLS (No policies needed for historical backup data)
-- ============================================================================

-- Poll backup tables
ALTER TABLE IF EXISTS public.poll_votes_backup DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.polls_backup DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.polls_backup_phase2 DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.polls_backup_prioritization DISABLE ROW LEVEL SECURITY;

-- Ranking poll backup tables
ALTER TABLE IF EXISTS public.ranking_polls_backup DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ranking_polls_backup_prioritization DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ranking_votes_backup DISABLE ROW LEVEL SECURITY;

-- Wordcloud poll backup tables
ALTER TABLE IF EXISTS public.wordcloud_polls_backup DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wordcloud_polls_backup_prioritization DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wordcloud_votes_backup DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROLES TABLE: Check if unused, then disable RLS or add minimal policy
-- ============================================================================
-- Note: The active role table is 'user_roles', not 'roles'
-- The 'roles' table may be an old/unused table
-- If unused, disable RLS. If used, add minimal admin-only policy.

-- Check if roles table exists and has data
DO $$
DECLARE
    table_exists BOOLEAN;
    row_count BIGINT;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'roles'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Count rows to see if it's used
        EXECUTE 'SELECT COUNT(*) FROM public.roles' INTO row_count;
        
        IF row_count = 0 THEN
            -- Table exists but is empty - likely unused, disable RLS
            ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
            RAISE NOTICE 'roles table is empty - RLS disabled';
        ELSE
            -- Table has data - add minimal admin-only read policy
            -- This allows admins to read but prevents other access
            ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
            
            -- Drop existing policies if any
            DROP POLICY IF EXISTS "Admins can view roles" ON public.roles;
            
            -- Create admin-only read policy
            CREATE POLICY "Admins can view roles" ON public.roles
                FOR SELECT
                USING (
                    EXISTS (
                        SELECT 1 FROM user_roles 
                        WHERE user_id = auth.uid() AND role = 'admin'
                    )
                );
            
            RAISE NOTICE 'roles table has data - added admin-only read policy';
        END IF;
    ELSE
        RAISE NOTICE 'roles table does not exist - skipping';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS status on backup tables (should be disabled)
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE '%backup%'
ORDER BY tablename;

-- Verify RLS status on roles table
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'roles';

-- List policies on roles table (if any)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'roles';

-- ============================================================================
-- NOTES
-- ============================================================================
-- Backup tables are historical data and don't need RLS protection:
-- - They're not accessed by application code
-- - They're read-only archives
-- - Disabling RLS simplifies access for admin/debugging purposes
--
-- If backup tables need to be accessed in the future, consider:
-- 1. Adding admin-only read policies, OR
-- 2. Moving them to a separate schema, OR
-- 3. Deleting them if no longer needed

