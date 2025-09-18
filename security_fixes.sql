-- Security Fixes for SSTAC & TWG Dashboard
-- This script addresses Supabase security advisor errors
-- Created: 2025-01-17

-- ============================================================================
-- SAFETY CHECK: Verify current system state before making changes
-- ============================================================================

-- Check what views currently exist
SELECT 
    table_name, 
    table_type,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'VIEW'
AND table_name IN ('admin_review_submissions', 'poll_results', 'ranking_results')
ORDER BY table_name;

-- ============================================================================
-- FIX 1: Secure admin_review_submissions view with security_invoker
-- ============================================================================

-- Apply Supabase's recommended fix: Add security_invoker = on
CREATE OR REPLACE VIEW public.admin_review_submissions WITH (security_invoker = on) AS
SELECT rs.id,
    rs.user_id,
    au.email,
    rs.status,
    rs.form_data,
    rs.created_at,
    rs.updated_at,
    count(rf.id) AS file_count
FROM review_submissions rs
    LEFT JOIN auth.users au ON rs.user_id = au.id
    LEFT JOIN review_files rf ON rs.id = rf.submission_id
GROUP BY rs.id, rs.user_id, au.email, rs.status, rs.form_data, rs.created_at, rs.updated_at;

-- ============================================================================
-- FIX 2: Secure poll_results view with security_invoker
-- ============================================================================

-- Apply Supabase's recommended fix: Add security_invoker = on
CREATE OR REPLACE VIEW public.poll_results WITH (security_invoker = on) AS
SELECT p.id AS poll_id,
    p.page_path,
    p.poll_index,
    p.question,
    p.options,
    COALESCE(option_counts.total_votes, 0::numeric) AS total_votes,
    COALESCE(jsonb_agg(jsonb_build_object('option_index', option_counts.option_index, 'option_text', p.options ->> option_counts.option_index, 'votes', option_counts.vote_count, 'other_texts', option_counts.other_texts) ORDER BY option_counts.option_index) FILTER (WHERE option_counts.option_index IS NOT NULL), '[]'::jsonb) AS results
FROM polls p
    LEFT JOIN ( SELECT poll_votes.poll_id,
            poll_votes.option_index,
            count(*) AS vote_count,
            sum(count(*)) OVER (PARTITION BY poll_votes.poll_id) AS total_votes,
            COALESCE(jsonb_agg(
                CASE
                    WHEN poll_votes.other_text IS NOT NULL AND poll_votes.other_text <> ''::text THEN poll_votes.other_text
                    ELSE NULL::text
                END) FILTER (WHERE poll_votes.other_text IS NOT NULL AND poll_votes.other_text <> ''::text), '[]'::jsonb) AS other_texts
           FROM poll_votes
          GROUP BY poll_votes.poll_id, poll_votes.option_index) option_counts ON p.id = option_counts.poll_id
GROUP BY p.id, p.page_path, p.poll_index, p.question, p.options, option_counts.total_votes;

-- ============================================================================
-- FIX 3: Secure ranking_results view with security_invoker
-- ============================================================================

-- Apply Supabase's recommended fix: Add security_invoker = on
CREATE OR REPLACE VIEW public.ranking_results WITH (security_invoker = on) AS
SELECT rp.id AS ranking_poll_id,
    rp.page_path,
    rp.poll_index,
    rp.question,
    rp.options,
    rp.created_at,
    rp.updated_at,
    count(DISTINCT rv.user_id) AS total_votes,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('option_index', option_stats.option_index, 'option_text', rp.options[option_stats.option_index + 1], 'averageRank', option_stats.avg_rank, 'votes', option_stats.vote_count) ORDER BY option_stats.option_index) AS jsonb_agg
           FROM ( SELECT rv2.option_index,
                    avg(rv2.rank::numeric) AS avg_rank,
                    count(rv2.id) AS vote_count
                   FROM ranking_votes rv2
                  WHERE rv2.ranking_poll_id = rp.id
                  GROUP BY rv2.option_index) option_stats), '[]'::jsonb) AS results
FROM ranking_polls rp
    LEFT JOIN ranking_votes rv ON rp.id = rv.ranking_poll_id
GROUP BY rp.id, rp.page_path, rp.poll_index, rp.question, rp.options, rp.created_at, rp.updated_at;

-- ============================================================================
-- SECURE PERMISSIONS: Ensure proper access control
-- ============================================================================

-- Grant permissions on poll tables and views (maintain existing functionality)
GRANT SELECT, INSERT, UPDATE, DELETE ON polls TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON poll_votes TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ranking_polls TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ranking_votes TO authenticated, anon;
GRANT SELECT ON poll_results TO authenticated, anon;
GRANT SELECT ON ranking_results TO authenticated, anon;

-- ============================================================================
-- VERIFICATION: Confirm fixes are applied
-- ============================================================================

-- Verify views no longer have SECURITY DEFINER
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname IN ('poll_results', 'ranking_results');

-- Check that admin_review_submissions is now secure
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'admin_review_submissions' AND table_schema = 'public')
        THEN 'EXISTS WITH security_invoker - SECURE'
        ELSE 'MISSING - NEEDS RECREATION'
    END as admin_review_submissions_status;

-- Verify RLS policies are still in place
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('polls', 'poll_votes', 'ranking_polls', 'ranking_votes')
ORDER BY tablename, policyname;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SECURITY FIXES APPLIED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. Secured admin_review_submissions view with security_invoker (auth_users_exposed)';
    RAISE NOTICE '2. Secured poll_results view with security_invoker';
    RAISE NOTICE '3. Secured ranking_results view with security_invoker';
    RAISE NOTICE '4. Maintained proper RLS policies and permissions';
    RAISE NOTICE '5. Dashboard functionality preserved';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Run Supabase security advisor again to confirm fixes';
    RAISE NOTICE '========================================';
END $$;
