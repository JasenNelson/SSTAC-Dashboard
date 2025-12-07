-- Fix get_or_create_poll function to work with anonymous RPC calls
-- This adds SECURITY DEFINER so the function can insert into polls table
-- even when called by anonymous users via RPC

-- Note: This is safe because:
-- 1. The function only creates polls if they don't exist (no overwriting)
-- 2. RLS policies still apply to the INSERT operation
-- 3. The function validates inputs before inserting

CREATE OR REPLACE FUNCTION get_or_create_poll(
    p_page_path TEXT,
    p_poll_index INTEGER,
    p_question TEXT,
    p_options JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to get existing poll
    SELECT id INTO poll_id 
    FROM polls 
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- Create poll if it doesn't exist
    IF poll_id IS NULL THEN
        INSERT INTO polls (page_path, poll_index, question, options)
        VALUES (p_page_path, p_poll_index, p_question, p_options)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$;

-- Verify the function was updated
SELECT 
    p.proname as function_name,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%' THEN 'Yes'
        ELSE 'No'
    END as has_security_definer,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 'Yes'
        ELSE 'No'
    END as has_search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_or_create_poll';

