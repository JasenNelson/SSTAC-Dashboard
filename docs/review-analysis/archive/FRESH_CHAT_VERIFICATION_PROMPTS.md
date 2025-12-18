# Fresh Chat Verification Prompts

Use these prompts in a new chat session to verify the working poll systems weren't affected by today's changes.

---

## Prompt 1: Verify All Three Poll Systems Are Working

```
I need to verify that all three poll systems are still working correctly after some database changes were made today. 

Please help me:
1. Check the RLS policies on all three vote tables (poll_votes, ranking_votes, wordcloud_votes)
2. Verify that single-choice polls, ranking polls, and wordcloud polls can all accept CEW submissions
3. Confirm that the policies match what's documented in docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md

Run these SQL queries to check the current state:

```sql
-- Check INSERT policies on all three vote tables
SELECT 
    tablename,
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies
WHERE tablename IN ('poll_votes', 'ranking_votes', 'wordcloud_votes')
AND cmd = 'INSERT'
ORDER BY tablename, policyname;
```

Then compare the results with what's documented. If anything looks wrong, let me know what needs to be fixed.
```

---

## Prompt 2: Verify No Constraints Were Accidentally Dropped

```
Today some check constraints were dropped to fix poll submission issues. I need to verify that:
1. Only the intended constraint was dropped (poll_votes_user_id_check)
2. No other constraints were accidentally removed
3. The ranking_votes and wordcloud_votes tables still have their necessary constraints

Please run this query to check all constraints on the three vote tables:

```sql
-- Check all constraints on vote tables
SELECT 
    rel.relname AS table_name,
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname IN ('poll_votes', 'ranking_votes', 'wordcloud_votes')
ORDER BY rel.relname, con.conname;
```

Compare with the expected constraints from database_schema.sql. Let me know if anything is missing or unexpected.
```

---

## Prompt 3: Verify Working Systems Weren't Modified

```
I need to verify that the working poll systems (single-choice and wordcloud) weren't accidentally modified during today's fixes.

Please:
1. Read docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md to understand how the three systems should work
2. Check the current RLS policies on poll_votes and wordcloud_votes
3. Verify they match what's documented
4. Confirm no policies were changed that shouldn't have been

Run this query:

```sql
-- Get all policies on the working systems
SELECT 
    tablename,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('poll_votes', 'wordcloud_votes')
ORDER BY tablename, cmd, policyname;
```

If any policies look different from what's expected, or if there are policies that shouldn't be there, let me know.
```

---

## Prompt 4: Comprehensive System Health Check

```
I need a comprehensive health check of all three poll systems after some database changes today.

Please:
1. Read docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md to understand the expected configuration
2. Check the current state of all three systems:
   - RLS policies on all 6 tables (polls, poll_votes, ranking_polls, ranking_votes, wordcloud_polls, wordcloud_votes)
   - Constraints on all vote tables
   - Indexes on all vote tables
3. Compare with what's documented
4. Identify any discrepancies or issues

Use this comprehensive query:

```sql
-- Complete system check
SELECT 
    'RLS Policies' as check_type,
    tablename,
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies
WHERE tablename IN ('polls', 'poll_votes', 'ranking_polls', 'ranking_votes', 'wordcloud_polls', 'wordcloud_votes')
UNION ALL
SELECT 
    'Constraints' as check_type,
    rel.relname as tablename,
    con.conname as policyname,
    CASE con.contype 
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
    END as cmd,
    NULL as roles,
    pg_get_constraintdef(con.oid) as with_check
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname IN ('poll_votes', 'ranking_votes', 'wordcloud_votes')
ORDER BY check_type, tablename, policyname;
```

Provide a summary of:
- What looks correct
- What might be wrong
- What needs to be fixed
```

---

## Prompt 5: Test Poll Submission Flow

```
I need to verify that all three poll types can accept CEW submissions. Based on docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md, CEW polls should:
1. Accept anonymous submissions with user_id format like "CEW2025_..." or "CEW2025_session_..."
2. Allow multiple submissions from the same CEW code
3. Not require authentication

Please check:
1. The RLS INSERT policies on all three vote tables
2. Whether they allow anonymous (anon/public) role inserts
3. Whether the WITH CHECK conditions would allow CEW user_ids

Run this query:

```sql
-- Check INSERT policies for CEW compatibility
SELECT 
    tablename,
    policyname,
    roles,
    with_check,
    CASE 
        WHEN roles::text LIKE '%anon%' OR roles::text LIKE '%public%' THEN 'Should allow CEW'
        ELSE 'Might block CEW'
    END as cew_compatibility,
    CASE
        WHEN with_check = 'true' OR with_check IS NULL THEN 'Allows all user_ids'
        WHEN with_check LIKE '%CEW%' OR with_check LIKE '%cew%' THEN 'Checks for CEW pattern'
        ELSE 'Might restrict CEW'
    END as user_id_check
FROM pg_policies
WHERE tablename IN ('poll_votes', 'ranking_votes', 'wordcloud_votes')
AND cmd = 'INSERT'
ORDER BY tablename;
```

Tell me if all three systems are configured to accept CEW submissions.
```

---

## Prompt 6: Rollback Assessment

```
Today some database changes were made to fix poll submission issues. I need to know:
1. What changes were made (based on docs/debugging/TODAYS_CHANGES_REVIEW.md)
2. Whether any of those changes affected the working systems
3. If rollback is needed, what SQL commands would restore the original state

Please:
1. Read docs/debugging/TODAYS_CHANGES_REVIEW.md
2. Check the current database state
3. Compare with what should be there (from database_schema.sql)
4. Identify what changed
5. Provide rollback SQL if needed (but don't run it yet)

Focus on:
- RLS policies that might have been changed
- Constraints that might have been dropped
- Any other modifications to the three poll systems
```

---

## Usage Instructions

1. **Copy one prompt at a time** into a fresh chat
2. **Wait for results** before moving to the next prompt
3. **Use Prompt 4** for a comprehensive check if you want everything at once
4. **Use Prompt 6** if you need to understand what changed and potentially rollback

These prompts are designed to be self-contained and provide all necessary context to a fresh AI assistant.

