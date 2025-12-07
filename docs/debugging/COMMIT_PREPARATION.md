# Commit Preparation Guide

## Quick Summary

**What Actually Fixed the Issue:**
1. Database: Dropped `poll_votes_user_id_check` constraint
2. Database: Fixed `ranking_votes` RLS policy to use `{public}` role
3. Code: Re-opened polling by restoring `CEWCodeInput` form

**Code Changes Made:**
- `src/app/api/polls/submit/route.ts` - Removed unnecessary logging (reverted)
- `src/components/PollWithResults.tsx` - Removed enhanced error display (reverted)
- `src/components/CEWCodeInput.tsx` - Restored input form (re-opened polling)

---

## Testing Steps

### 1. Quick Manual Test
```bash
# Start dev server if not running
npm run dev
```

Then test in browser:
- [ ] `/cew-polls/tiered-framework` - Submit single-choice poll
- [ ] `/cew-polls/prioritization` - Submit ranking poll (Question 3 or 4)
- [ ] `/cew-polls/prioritization` - Submit wordcloud poll (Question 5)

### 2. Lint Check
```bash
npm run lint
```
Expected: No errors

### 3. Build Check
```bash
npm run build
```
Expected: Build succeeds

---

## Files to Commit

### Essential Code Changes (Must Commit)
```bash
git add src/app/api/polls/submit/route.ts
git add src/components/CEWCodeInput.tsx
git add src/components/PollWithResults.tsx
```

### Documentation (Recommended - Useful for Future)
```bash
git add docs/debugging/
```

### Optional - Diagnostic Scripts
```bash
# Only if you want to keep them
git add scripts/debug/
```

### DO NOT Commit (Review Separately)
- `docs/AGENTS.md` (modified - review separately)
- `docs/PROJECT_STATUS.md` (modified - review separately)
- Other modified docs in `review-analysis/`
- Untracked files in `review-analysis/`

---

## Commit Message

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

---

## Verification Commands

```bash
# Check what will be committed
git diff --cached

# Verify no unexpected changes
git status

# Test build
npm run build

# Test linting
npm run lint
```

