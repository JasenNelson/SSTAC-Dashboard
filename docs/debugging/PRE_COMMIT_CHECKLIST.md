# Pre-Commit Checklist - Poll System Fixes

## Files Changed Today

### Code Changes (Reverted to Minimal)
- ✅ `src/app/api/polls/submit/route.ts` - Reverted unnecessary logging
- ✅ `src/components/PollWithResults.tsx` - Reverted enhanced error display  
- ✅ `src/components/CEWCodeInput.tsx` - Re-opened polling (restored input form)

### Documentation Created
- ✅ `docs/debugging/POLL_SUBMISSION_DEBUGGING_PROTOCOL.md` - Debugging guide
- ✅ `docs/debugging/TODAYS_CHANGES_REVIEW.md` - Review of changes
- ✅ `docs/debugging/FRESH_CHAT_VERIFICATION_PROMPTS.md` - Verification prompts
- ✅ `docs/debugging/VERIFICATION_RESULTS_ANALYSIS.md` - Analysis results
- ✅ `docs/debugging/CODE_CHANGES_ANALYSIS.md` - Code change analysis

### Diagnostic Scripts (Optional - Can exclude from commit)
- `scripts/debug/comprehensive-poll-systems-investigation.sql`
- `scripts/debug/test-get-or-create-poll.sql`
- `scripts/debug/check-poll-votes-constraints.sql`
- `scripts/debug/fix-get-or-create-poll-security.sql`
- `scripts/debug/fix-poll-votes-user-id-constraint.sql`
- `scripts/debug/fix-all-poll-vote-constraints.sql`

---

## Testing Checklist

### 1. Manual Testing - Single-Choice Polls
- [ ] Navigate to `/cew-polls/tiered-framework`
- [ ] Enter CEW code (e.g., `CEW2025`)
- [ ] Submit a single-choice poll response
- [ ] Verify submission succeeds
- [ ] Check that vote appears in results

### 2. Manual Testing - Ranking Polls
- [ ] Navigate to `/cew-polls/prioritization`
- [ ] Enter CEW code (e.g., `CEW2025`)
- [ ] Submit a ranking poll response
- [ ] Verify submission succeeds
- [ ] Check that rankings appear in results

### 3. Manual Testing - Wordcloud Polls
- [ ] Navigate to `/cew-polls/prioritization` (Question 5)
- [ ] Enter CEW code (e.g., `CEW2025`)
- [ ] Submit a wordcloud response
- [ ] Verify submission succeeds
- [ ] Check that words appear in results

### 4. Code Quality Checks
- [ ] Run `npm run lint` - Should pass
- [ ] Run `npm run build` - Should compile without errors
- [ ] Check TypeScript errors - Should be none

---

## Lint Check Commands

```bash
# Check all files
npm run lint

# Check specific files
npm run lint -- src/app/api/polls/submit/route.ts
npm run lint -- src/components/PollWithResults.tsx
npm run lint -- src/components/CEWCodeInput.tsx
```

---

## Build Check

```bash
# Test production build
npm run build
```

---

## Git Commit Strategy

### Option 1: Minimal Commit (Recommended)
Only commit the essential changes:

```bash
# Stage only the code changes
git add src/app/api/polls/submit/route.ts
git add src/components/PollWithResults.tsx
git add src/components/CEWCodeInput.tsx

# Stage debugging documentation (useful for future)
git add docs/debugging/

# Commit
git commit -m "Fix CEW poll submissions - remove blocking constraints and fix RLS policies

- Re-opened CEW polling by restoring CEWCodeInput form
- Removed unnecessary error logging (matches codebase cleanup standards)
- Database fixes applied separately:
  - Dropped poll_votes_user_id_check constraint
  - Fixed ranking_votes RLS policy to use {public} role
- Added debugging documentation for future reference"
```

### Option 2: Include Diagnostic Scripts
If you want to keep the diagnostic SQL scripts:

```bash
git add scripts/debug/
```

### Option 3: Exclude Documentation
If you don't want to commit the debugging docs yet:

```bash
# Only commit code changes
git add src/app/api/polls/submit/route.ts
git add src/components/PollWithResults.tsx
git add src/components/CEWCodeInput.tsx
```

---

## What NOT to Commit

- ❌ Other modified docs files (AGENTS.md, PROJECT_STATUS.md, etc.) - Review separately
- ❌ Untracked review-analysis files - Review separately
- ❌ Diagnostic SQL scripts - Optional, can exclude

---

## Verification Before Commit

1. ✅ All three poll types work (single-choice, ranking, wordcloud)
2. ✅ No linting errors
3. ✅ Build succeeds
4. ✅ Code changes are minimal (logging removed)
5. ✅ Database fixes already applied (not in this commit)

---

## Commit Message Template

```
Fix CEW poll submissions - remove blocking constraints and fix RLS policies

- Re-opened CEW polling by restoring CEWCodeInput form
- Removed unnecessary error logging to match codebase cleanup standards
- Database fixes (applied separately):
  - Dropped poll_votes_user_id_check constraint blocking CEW user IDs
  - Fixed ranking_votes RLS policy to use {public} role for anonymous access

All three poll systems (single-choice, ranking, wordcloud) now accept CEW submissions.

Added debugging documentation for future troubleshooting.
```

