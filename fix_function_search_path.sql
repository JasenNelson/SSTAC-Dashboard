-- Fix Function Search Path Security Warnings
-- Date: 2025-01-31
-- Purpose: Fix search_path security warnings for non-poll database functions
-- 
-- ⚠️ POLL-SAFE APPROACH: Only fixing non-poll functions
-- Poll functions (submit_poll_vote, get_or_create_poll, etc.) are NOT modified
-- to avoid disrupting active poll functionality

-- ============================================================================
-- SAFE TO FIX: Non-Poll Functions (4 functions)
-- ============================================================================

-- 1. Fix handle_new_user() function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Insert the new user into user_roles with 'member' role
    INSERT INTO user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'member', NOW())
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- 2. Fix update_updated_at_column() function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 3. Fix get_users_with_emails() function
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
    id UUID,
    email CHARACTER VARYING(255),
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Only allow authenticated users to call this function
    IF auth.role() != 'authenticated' THEN
        RAISE EXCEPTION 'Access denied. Only authenticated users can call this function.';
    END IF;
    
    -- Return user information from auth.users
    -- This is safe because we're only returning basic user info
    RETURN QUERY
    SELECT 
        au.id,
        au.email::CHARACTER VARYING(255),
        au.created_at,
        au.last_sign_in_at
    FROM auth.users au
    WHERE au.email_confirmed_at IS NOT NULL  -- Only confirmed users
    ORDER BY au.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (preserve existing permissions)
GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;

-- 4. Fix update_reply_updated_at() function (if it exists)
-- Note: This function might not exist in current schema, check first
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'update_reply_updated_at' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        EXECUTE '
        CREATE OR REPLACE FUNCTION update_reply_updated_at()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SET search_path = public, pg_temp
        AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify functions have search_path set
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) LIKE '%SET search_path%' as has_search_path_set
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'handle_new_user',
    'update_updated_at_column',
    'get_users_with_emails',
    'update_reply_updated_at'
)
ORDER BY p.proname;

-- ============================================================================
-- NOT FIXED: Poll Functions (Intentionally Left Unchanged)
-- ============================================================================
-- The following poll-related functions are NOT modified to avoid disrupting
-- active poll functionality. These will be fixed during a maintenance window:
--
-- - submit_poll_vote()
-- - submit_ranking_votes()
-- - submit_wordcloud_vote()
-- - get_poll_results()
-- - get_or_create_poll()
-- - get_or_create_ranking_poll()
-- - get_or_create_wordcloud_poll_fixed()
-- - get_wordcloud_word_counts()
--
-- These functions will show security warnings until they can be safely updated.

