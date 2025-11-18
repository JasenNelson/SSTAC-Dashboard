# Rollback Plan - If Deployment Continues to Fail

**Date:** November 14, 2025  
**Last Successful Deployment:** November 11, 2025  
**Current Status:** ✅ **ROLLBACK EXECUTED** - Successfully rolled back to commit `1a972b4`  
**Rollback Target:** Commit `1a972b4` ("Adjust TWG review instructions styling") - **MATCHES PRODUCTION**  
**Rollback Completion:** November 14, 2025 - Rollback complete and deployed successfully

---

## Commits Since Last Successful Deployment

All commits after 2025-11-11 that need to be preserved or reverted:

### Commits from 2025-11-11 (Same day as last successful deployment)
- `297bbd4` - Polish TWG review light-mode styling
- `1a972b4` - Adjust TWG review instructions styling

### Commits from 2025-11-13 (First day of failures)
- `bb4dd1e` - fix: update TWG review form layout and navigation
- `26df1c6` - fix: add missing context files for header navigation (Failure #1)
- `eeec0bb` - fix: add missing twgReviewTypes.ts file (Failure #2)
- `2b801d8` - fix: add missing service and utility files required by committed components (Failure #3)
- `5dc80cd` - fix: remove invalid user prop from TWGReviewClient (Failure #4)
- `75bb6df` - fix: resolve deployment build errors (Failure #5)

### Commits from 2025-11-14 (Today)
- `375c1e0` - feat: add wordcloud component refactoring (Failure #6 - part 1)
- `41b3919` - refactor: update WordCloudPoll to use new subcomponents (Failure #6 - part 2)
- `9c523ca` - fix: add force-dynamic to all admin pages (Failure #7)

---

## Rollback Strategy

### Option 1: Hard Reset to Last Successful Commit

**Target Commit:** `60a32df` - "Refine TWG mobile navigation with phase accordions"

**Command:**
```bash
# Create a backup branch first
git branch backup-before-rollback-$(date +%Y%m%d)

# Reset to last successful commit
git reset --hard 60a32df

# Force push (WARNING: This rewrites history)
git push --force origin chore/next-15-5-6-staging
```

**Pros:**
- Clean slate - back to known working state
- No failed commits in history

**Cons:**
- Loses all work from Nov 11-14
- Need to redo work more carefully

---

### Option 2: Revert Commits in Reverse Order (Recommended)

**Target:** Revert all commits after `60a32df` but preserve them in history

**Commands:**
```bash
# Revert commits in reverse chronological order
git revert --no-commit 9c523ca  # Failure #7
git revert --no-commit 41b3919  # Failure #6 part 2
git revert --no-commit 375c1e0  # Failure #6 part 1
git revert --no-commit 75bb6df  # Failure #5
git revert --no-commit 5dc80cd  # Failure #4
git revert --no-commit 2b801d8  # Failure #3
git revert --no-commit eeec0bb  # Failure #2
git revert --no-commit 26df1c6  # Failure #1
git revert --no-commit bb4dd1e  # TWG review form changes
git revert --no-commit 1a972b4  # TWG review instructions
git revert --no-commit 297bbd4  # TWG review styling

# Commit the revert
git commit -m "revert: rollback to last successful deployment (2025-11-11)

Reverting all commits after 60a32df due to 7 consecutive deployment failures.
Will redo work more systematically with proper testing."

# Push
git push origin chore/next-15-5-6-staging
```

**Pros:**
- Preserves history
- Can cherry-pick specific commits later
- Safer for collaboration

**Cons:**
- More complex
- History shows failed attempts

---

## Work to Preserve/Redo After Rollback

### Critical Work (Must Redo)
1. **WordCloud Component Refactoring** (commits `375c1e0`, `41b3919`)
   - 5 new wordcloud subcomponents
   - WordCloudPoll.tsx refactoring
   - **Status:** Complete and tested locally, but needs proper commit strategy

2. **Matrix Graph Utils** (from commit `2b801d8`)
   - `src/lib/matrix-graph-utils.ts` - Shared logic extraction
   - **Status:** Complete and working

3. **Poll Results Service** (from commit `2b801d8`)
   - `src/services/pollResultsService.ts` - Service layer
   - **Status:** Complete and working

### Fixes That Need to Be Applied Systematically
1. **Admin Page Dynamic Rendering** (commit `9c523ca`)
   - All admin pages need `export const dynamic = 'force-dynamic'`
   - **Status:** Fix is correct, but should be applied BEFORE other changes

2. **Missing Context Files** (commit `26df1c6`)
   - `src/contexts/AuthContext.tsx`
   - `src/contexts/AdminContext.tsx`
   - **Status:** Files are correct, but commit order was wrong

3. **Missing Type Files** (commit `eeec0bb`)
   - `src/app/(dashboard)/twg/review/twgReviewTypes.ts`
   - **Status:** File is correct, but commit order was wrong

### TWG Review Form Changes (Can Redo Later)
- Commits `bb4dd1e`, `1a972b4`, `297bbd4`
- **Status:** Not critical for deployment, can be redone after deployment is stable

---

## Recommended Approach After Rollback

### Phase 1: Foundation First (Do This First)
1. **Add `export const dynamic = 'force-dynamic'` to ALL admin pages**
   - Do this FIRST before any other changes
   - Verify build succeeds
   - Commit and deploy

2. **Add missing context files**
   - `src/contexts/AuthContext.tsx`
   - `src/contexts/AdminContext.tsx`
   - Verify build succeeds
   - Commit and deploy

3. **Add missing type files**
   - `src/app/(dashboard)/twg/review/twgReviewTypes.ts`
   - Verify build succeeds
   - Commit and deploy

### Phase 2: Service Layer (Do This Second)
4. **Add service and utility files**
   - `src/services/pollResultsService.ts`
   - `src/lib/matrix-graph-utils.ts`
   - Verify build succeeds
   - Commit and deploy

### Phase 3: Component Refactoring (Do This Last)
5. **WordCloud component refactoring**
   - Add all 5 wordcloud files FIRST
   - Then modify WordCloudPoll.tsx
   - Verify build succeeds
   - Commit and deploy

### Phase 4: Other Fixes (Do After Deployment is Stable)
6. **TWG Review form changes**
   - Can be done after deployment is stable
   - Not critical for deployment

---

## Verification Checklist Before Each Commit

Before committing ANY change:
- [ ] Run `npm run build` locally
- [ ] Verify build succeeds with no errors
- [ ] Check for any missing dependencies
- [ ] Verify all imports resolve correctly
- [ ] Check that all new files are tracked by git
- [ ] Verify no TypeScript errors
- [ ] Test locally if possible

---

## Decision Point

**If Failure #7 fix (commit `9c523ca`) succeeds:**
- ❌ **DID NOT SUCCEED** - Rollback executed instead

**If Failure #7 fix fails:**
- ✅ **ROLLBACK EXECUTED** - Successfully rolled back to `1a972b4`
- ✅ **Fresh Start** - Starting fresh with systematic approach
- ✅ **Recovery Strategy** - Documented in `ROLLBACK_SUMMARY.md`
- ✅ **Lessons Learned** - Documented in rollback summary

**Rollback Results:**
- ✅ Backup branch created and pushed to remote
- ✅ Local and remote branches reset to `1a972b4`
- ✅ Deployment successful - matches production
- ✅ All failed commits preserved in backup branch

---

## Key Lessons Learned

1. **Always fix ALL instances of a problem, not just one**
   - Failure #5 fixed only one admin page
   - Should have fixed all admin pages at once

2. **Test build after each commit**
   - Don't batch multiple fixes
   - Verify each fix works before moving on

3. **Commit dependencies before dependents**
   - New files must be committed before files that import them
   - Verify imports resolve before committing

4. **Apply foundational fixes first**
   - Admin page dynamic rendering should have been done first
   - Then add new files and components

---

**Status:** ✅ **ROLLBACK EXECUTED** - Successfully completed November 14, 2025  
**Rollback Summary:** See `ROLLBACK_SUMMARY.md` for complete details of work lost and recovery strategy  
**Backup Branch:** `backup-before-rollback-2025-11-14` contains all 9 failed commits  
**Last Updated:** November 14, 2025 (Rollback Complete)

