-- Test get_or_create_poll function
-- Run this in Supabase SQL Editor to diagnose the issue

-- Test 1: Check if function exists and its definition
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_or_create_poll';

-- Test 2: Try calling the function directly (simulating what the API does)
-- Replace with actual values from your tiered-framework page
SELECT get_or_create_poll(
    '/cew-polls/tiered-framework'::TEXT,
    0::INTEGER,
    'What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?'::TEXT,
    '["It provides a formal structure for quantifying and communicating uncertainty in the final standard.", "It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.", "It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.", "It improves the technical defensibility by making all assumptions (priors, model structure) explicit", "Other"]'::JSONB
) as poll_id;

-- Test 3: Check if poll was created
SELECT * FROM polls 
WHERE page_path = '/cew-polls/tiered-framework' 
AND poll_index = 0;

-- Test 4: Check RLS policies on polls table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'polls'
ORDER BY policyname;

