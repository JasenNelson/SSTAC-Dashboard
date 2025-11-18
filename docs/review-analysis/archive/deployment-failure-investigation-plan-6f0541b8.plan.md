<!-- 6f0541b8-571e-4f6b-96f4-91f237cde67d c7d0dc8c-ac04-46fb-adbd-cf02bbe73b73 -->
# Deployment Failure Investigation Plan

## Problem Summary

**Pattern Identified:** Sprint 6 refactoring work (Nov 13) created new files that are imported by modified components, but the new files are uncommitted. This matches the pattern from Failures #1-3 where missing dependencies caused build failures.

**Key Finding:** `WordCloudPoll.tsx` was modified to import from `./wordcloud/` directory, but all 5 files in that directory are untracked (not committed to git).

## Investigation Steps

### Phase 1: Identify All Missing Dependencies

**Step 1.1: Verify Uncommitted Sprint 6 Files**

- Check git status for all untracked files in `src/components/dashboard/wordcloud/`
- Expected: 5 files (WordCloudTypes.ts, WordCloudErrorBoundary.tsx, SafeWordCloud.tsx, WordCloudInputSection.tsx, WordCloudResultsSection.tsx)
- Verify: `git ls-files --others --exclude-standard src/components/dashboard/wordcloud/`

**Step 1.2: Find All Import Dependencies**

- Search for all imports of wordcloud files: `grep -r "from.*wordcloud" src/`
- Search for all imports of matrix-graph-utils: `grep -r "from.*matrix-graph-utils" src/`
- Verify matrix-graph-utils.ts is committed: `git ls-files src/lib/matrix-graph-utils.ts`
- Document all files that import uncommitted files

**Step 1.3: Check Modified Files That Import New Files**

- Review `src/components/dashboard/WordCloudPoll.tsx` - verify it imports wordcloud files
- Review `src/components/graphs/PrioritizationMatrixGraph.tsx` - verify it imports matrix-graph-utils
- Review `src/components/graphs/AdvancedPrioritizationMatrixGraph.tsx` - verify it imports matrix-graph-utils
- Document which committed/modified files depend on uncommitted files

**Step 1.4: Identify Other Potential Missing Files**

- Check if any other Sprint 6 work created new files that are imported
- Review update log for Nov 13 to identify all new files created
- Cross-reference with git status to find untracked files

### Phase 2: Verify Build Failure Root Cause

**Step 2.1: Attempt Local Build**

- Run: `npm run build`
- Capture full error output
- Identify specific module resolution errors
- Expected error: "Cannot find module './wordcloud/WordCloudInputSection'" or similar

**Step 2.2: Verify TypeScript Compilation**

- Run: `npx tsc --noEmit`
- Check for type errors related to missing modules
- Document all compilation errors

**Step 2.3: Check Import Paths**

- Verify all import paths in WordCloudPoll.tsx are correct
- Verify all import paths in matrix graph components are correct
- Ensure relative paths match actual file locations

### Phase 3: Comprehensive Dependency Audit

**Step 3.1: Create Dependency Map**

- For each uncommitted file, list all files that import it
- For each modified file, list all files it imports
- Create a dependency graph showing:
- Committed files → Uncommitted files (PROBLEM)
- Uncommitted files → Other files (need to check)

**Step 3.2: Verify File Structure**

- Confirm wordcloud directory structure matches imports
- Confirm all exported types/functions exist
- Verify no circular dependencies

**Step 3.3: Check for Other Uncommitted Dependencies**

- Review all 70+ modified files for new imports
- Check if any other new files were created but not committed
- Verify no other missing dependencies exist

### Phase 4: Test Strategy Before Committing

**Step 4.1: Local Build Test**

- Stage all wordcloud files: `git add src/components/dashboard/wordcloud/`
- Run: `npm run build`
- Verify build succeeds locally
- If build fails, fix issues before committing

**Step 4.2: Lint Check**

- Run: `npm run lint`
- Fix any lint errors in new files
- Ensure all files pass linting

**Step 4.3: Type Check**

- Run: `npx tsc --noEmit`
- Fix any TypeScript errors
- Ensure type safety

**Step 4.4: Manual Smoke Test** ✅ COMPLETE

- Start dev server: `npm run dev`
- Test WordCloudPoll component functionality
- Test matrix graph components
- Verify no runtime errors
- **Status:** ✅ Manual testing completed - no runtime errors found

### Phase 5: Safe Commit Strategy

**Step 5.1: Group Related Files**

- Group 1: All wordcloud files (5 files) + WordCloudPoll.tsx modification
- Group 2: matrix-graph-utils.ts (already committed, verify)
- Group 3: Matrix graph component modifications (verify committed)
- Group 4: CSS refactoring (paused, do not commit yet)

**Step 5.2: Commit Strategy** ✅ COMPLETE

- Commit 1: Add all wordcloud files first (foundation) ✅
  - Commit: `375c1e0` - 5 files changed, 448 insertions(+)
- Commit 2: Commit WordCloudPoll.tsx modification (uses wordcloud files) ✅
  - Commit: `41b3919` - 1 file changed, 98 insertions(+), 391 deletions(-)
- Verify: Each commit should build successfully ✅
- Do NOT commit CSS changes until deployment is stable

**Step 5.3: Verification After Each Commit** ✅ COMPLETE

- After each commit, verify: `git status` shows expected files ✅
- Run: `npm run build` to ensure build still works ✅
  - Build successful: ✓ Linting, ✓ Type checking, ✓ Static pages (49/49)
  - No errors, only expected warnings (Supabase dependency)
- Check: No missing dependencies remain ✅

### Phase 6: Prevent Future Issues

**Step 6.1: Create Pre-Commit Checklist**

- Before committing files that add imports:

1. Find all new imports: `git diff --cached | grep "import.*from"`
2. Verify each imported file exists: `git ls-files <path>`
3. If file is untracked, add it: `git add <path>`
4. Run build: `npm run build`
5. Run lint: `npm run lint`

**Step 6.2: Document Dependency Check Process**

- Update DEPLOYMENT_FIX_SUMMARY.md with new findings
- Add wordcloud files to the list of files that caused issues
- Document the pattern: Sprint 6 work → uncommitted files → build failure

**Step 6.3: Review Other Uncommitted Changes**

- Review the 70+ modified files
- Identify which are safe to commit (Sprint 6 work)
- Identify which should remain uncommitted (CSS refactoring - paused)
- Create plan for committing safe changes separately

## Expected Findings

1. **Root Cause:** 5 wordcloud files are untracked but imported by committed WordCloudPoll.tsx
2. **Build Error:** Module resolution failure for wordcloud imports
3. **Solution:** Commit all wordcloud files before WordCloudPoll.tsx modification
4. **Pattern:** Same as Failures #1-3 - incomplete dependency tracking

## Success Criteria

- ✅ All missing dependencies identified and documented
- ✅ Local build succeeds before committing
- ✅ All related files committed together in logical groups
  - Commit `375c1e0`: 5 wordcloud files (448 lines)
  - Commit `41b3919`: WordCloudPoll.tsx refactor (98 insertions, 391 deletions)
- ✅ Build verification successful after commits
- ⏳ Deployment succeeds after fixes (pending push and Vercel verification)
- ✅ Process documented to prevent future occurrences

## Files to Investigate

**Uncommitted Files (Sprint 6):**

- `src/components/dashboard/wordcloud/WordCloudTypes.ts`
- `src/components/dashboard/wordcloud/WordCloudErrorBoundary.tsx`
- `src/components/dashboard/wordcloud/SafeWordCloud.tsx`
- `src/components/dashboard/wordcloud/WordCloudInputSection.tsx`
- `src/components/dashboard/wordcloud/WordCloudResultsSection.tsx`

**Modified Files That Import Them:**

- `src/components/dashboard/WordCloudPoll.tsx` (imports wordcloud files)
- `src/components/graphs/PrioritizationMatrixGraph.tsx` (imports matrix-graph-utils - verify committed)
- `src/components/graphs/AdvancedPrioritizationMatrixGraph.tsx` (imports matrix-graph-utils - verify committed)

**Already Committed (Verify):**

- `src/lib/matrix-graph-utils.ts` (committed in 2b801d8)
- `src/services/pollResultsService.ts` (committed in 2b801d8)

## Risk Assessment

**Low Risk:**

- Committing wordcloud files (they're complete, just untracked)
- Local build testing (non-destructive)

**Medium Risk:**

- Committing WordCloudPoll.tsx modification (needs wordcloud files committed first)
- Multiple commits needed (but can test between commits)

**High Risk:**

- Committing CSS changes (paused, should wait)
- Committing all 70+ modified files at once (could introduce other issues)

## Notes

- CSS refactoring changes in `globals.css` should remain uncommitted until deployment is stable
- Follow the same pattern as previous fixes: commit dependencies before dependents
- Test locally before each commit to avoid chain failures
- Document findings in DEPLOYMENT_FIX_SUMMARY.md

### To-dos

- [x] Identify all uncommitted Sprint 6 files and verify which files import them
- [x] Run local build to capture exact error messages and verify root cause
- [x] Create comprehensive dependency map showing committed files importing uncommitted files
- [x] Test build locally after staging wordcloud files to verify fix
- [x] Document findings and create safe commit strategy with verification steps
- [x] Update DEPLOYMENT_FIX_SUMMARY.md with new findings and prevention process
- [x] Complete manual smoke testing (Step 4.4)
- [x] Execute Phase 5 commit strategy (commit wordcloud files, then WordCloudPoll.tsx)
- [x] Verify build succeeds after commits
- [ ] **NEXT:** Push commits and verify Vercel deployment succeeds