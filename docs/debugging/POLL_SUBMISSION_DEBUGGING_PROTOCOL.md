# Poll Submission Debugging Protocol

## Purpose
This protocol provides a systematic approach to debugging poll submission failures across the three separate poll systems (single-choice, ranking, wordcloud) without making assumptions or unnecessary changes.

## Critical Principle
**NEVER assume the three poll systems work the same way. They are separate systems with potentially different configurations.**

---

## Step 1: Identify the Failing System

Determine which poll type is failing:
- **Single-choice polls** → `poll_votes` table
- **Ranking polls** → `ranking_votes` table  
- **Wordcloud polls** → `wordcloud_votes` table

---

## Step 2: Check Server Console for Exact Error

Look for the error message in the server console. Common errors:

### Error Type A: Check Constraint Violation
```
new row for relation "X_votes" violates check constraint "X_votes_user_id_check"
```
**Solution**: Drop the check constraint (see Step 3A)

### Error Type B: RLS Policy Violation
```
new row violates row-level security policy for table "X_votes"
```
**Solution**: Check and fix RLS policies (see Step 3B)

### Error Type C: Other Errors
Investigate based on specific error message.

---

## Step 3A: Fix Check Constraint Issues

If you see a check constraint violation:

```sql
-- 1. Identify which table has the constraint
-- Check constraint name from error message

-- 2. Drop the constraint (it blocks CEW user_ids)
ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_user_id_check;
ALTER TABLE ranking_votes DROP CONSTRAINT IF EXISTS ranking_votes_user_id_check;
ALTER TABLE wordcloud_votes DROP CONSTRAINT IF EXISTS wordcloud_votes_user_id_check;
```

**Note**: Only drop constraints on the table that's failing. Don't drop constraints on working tables.

---

## Step 3B: Fix RLS Policy Issues

If you see an RLS policy violation:

### Step 3B.1: Check Current INSERT Policies

```sql
-- Replace 'X_votes' with the failing table name
SELECT 
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies
WHERE tablename = 'ranking_votes'  -- Change to poll_votes or wordcloud_votes
AND cmd = 'INSERT'
ORDER BY policyname;
```

### Step 3B.2: Compare with Working System

Check what the working poll system uses:

```sql
-- Check poll_votes (single-choice - usually works)
SELECT policyname, cmd, roles, with_check
FROM pg_policies
WHERE tablename = 'poll_votes' AND cmd = 'INSERT';

-- Check wordcloud_votes (usually works)
SELECT policyname, cmd, roles, with_check
FROM pg_policies
WHERE tablename = 'wordcloud_votes' AND cmd = 'INSERT';
```

### Step 3B.3: Fix the Policy

If the failing system has different roles than the working system:

```sql
-- Example: If ranking_votes has {anon,authenticated} but wordcloud has {public}
-- Change ranking_votes to match working system

DROP POLICY IF EXISTS "Anyone can vote in ranking polls" ON ranking_votes;
CREATE POLICY "Anyone can vote in ranking polls"
ON ranking_votes
FOR INSERT
TO public
WITH CHECK (true);
```

**Key Points**:
- Use `TO public` (like wordcloud) not `TO anon,authenticated`
- Use `WITH CHECK (true)` to allow all inserts
- Only modify the failing table, not working ones

---

## Step 4: Check for Case Sensitivity Issues

CEW user_ids should be uppercase. Check the generated user_id in server console:

```
[Ranking Poll Submit] CEW page, using unique userId: cew2025_...
```

If lowercase, the issue might be:
1. User entered lowercase code → normalize to uppercase in API
2. RLS policy uses case-sensitive pattern → use `ILIKE` instead of `LIKE`

**Quick Fix**: Ensure user enters uppercase code or normalize in API code.

---

## Step 5: Verify the Fix

1. Try submitting a poll of the failing type
2. Check server console for success message
3. Verify vote appears in database:

```sql
-- Check if vote was inserted
SELECT * FROM ranking_votes  -- or poll_votes or wordcloud_votes
ORDER BY voted_at DESC
LIMIT 5;
```

---

## Common Mistakes to Avoid

### ❌ DON'T:
1. **Modify working systems** - Only fix the failing system
2. **Drop constraints on all tables** - Only the failing table
3. **Change multiple policies at once** - Fix one at a time
4. **Assume all systems are the same** - They're separate systems
5. **Add extensive logging** - Not needed for simple constraint/RLS issues
6. **Modify database functions** - Usually not the issue
7. **Change API code** - Usually a database configuration issue

### ✅ DO:
1. **Check exact error message first** - Tells you what's wrong
2. **Compare with working system** - See what's different
3. **Make minimal changes** - Drop constraint or fix one policy
4. **Test immediately** - Verify fix works before moving on
5. **Only touch the failing system** - Don't modify working ones

---

## Investigation Checklist

When debugging poll submission failures:

- [ ] Identified which poll system is failing (single-choice/ranking/wordcloud)
- [ ] Checked server console for exact error message
- [ ] Identified error type (constraint/RLS/other)
- [ ] Checked constraints on failing table only
- [ ] Checked RLS policies on failing table only
- [ ] Compared with working system policies
- [ ] Made minimal fix (drop constraint OR fix one policy)
- [ ] Tested the fix immediately
- [ ] Verified vote appears in database
- [ ] Did NOT modify working systems
- [ ] Did NOT add unnecessary code changes

---

## Quick Reference: What Actually Fixed Issues Today

### Issue 1: Check Constraint Blocking CEW User IDs
**Error**: `violates check constraint "poll_votes_user_id_check"`
**Fix**: `ALTER TABLE poll_votes DROP CONSTRAINT IF EXISTS poll_votes_user_id_check;`
**Result**: Single-choice polls worked

### Issue 2: RLS Policy Not Allowing Anonymous Inserts
**Error**: `violates row-level security policy for table "ranking_votes"`
**Fix**: Changed policy role from `{anon,authenticated}` to `{public}` (or ensured it was `{public}`)
**Result**: Ranking polls worked

### Issue 3: Case Sensitivity
**Problem**: User entered lowercase `cew2025` instead of `CEW2025`
**Fix**: User re-entered with uppercase code
**Result**: Worked after case fix

---

## Summary

**The actual fixes were simple:**
1. Drop one check constraint
2. Ensure RLS policy uses `{public}` role
3. Use uppercase CEW code

**Everything else (logging, function changes, multiple SQL scripts) was unnecessary.**

