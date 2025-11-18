# Recovery Strategy Prompt - Modular Approach

**Date:** November 14, 2025  
**Purpose:** Prompt for fresh AI chat to implement modular recovery strategy  
**Context:** Post-rollback recovery of Sprint 4 & 6 work lost on Nov 14, 2025

---

## 🎯 Mission Statement

You are tasked with helping implement a **modular, safe recovery strategy** for work that was rolled back on November 14, 2025. The TWG review form is **LIVE AND IN USE** by real users, so all work must be done carefully with minimal risk to production users.

---

## 📋 Context & Background

### **Rollback Situation:**
- **Rollback Date:** November 14, 2025
- **Rollback Reason:** 7 consecutive deployment failures
- **Rollback Target:** Commit `1a972b4` ("Adjust TWG review instructions styling") - **MATCHES PRODUCTION**
- **Rollback Status:** ✅ Complete - Successfully deployed and stable
- **Backup Branch:** `backup-before-rollback-2025-11-14` contains all 9 failed commits

### **Work Lost (All Preserved in Backup Branch):**
1. ❌ **Matrix graph logic extraction** - ~340 lines duplicate code eliminated (Nov 13, tested, rolled back Nov 14)
2. ❌ **WordCloudPoll component split** - 754 → 395 lines (47.6% reduction, Nov 13, tested, rolled back Nov 14)
3. ❌ **Global Context files** - `AuthContext.tsx`, `AdminContext.tsx` (created, rolled back)
4. ❌ **Header component split** - 5 subcomponents created, main component refactored (rolled back)
5. ❌ **PollResultsClient service layer** - `pollResultsService.ts` (created, rolled back)
6. ❌ **CSS refactoring** - 17 !important removed (5.2% reduction, rolled back)

### **Why Deployment Failed:**
- **Root Cause:** Commits made in wrong order - dependencies committed after dependents
- **Specific Issues:**
  - Components referencing new files were committed before those files existed
  - Missing files caused import errors in production builds
  - Partial fixes (some admin pages, not all) caused inconsistencies
  - Not running `npm run build` before each commit
  - Not verifying builds after each step

### **Critical Constraint:**
- ⚠️ **TWG Review Form is LIVE** - Real users are actively using it
- **Must minimize risk** - Any changes affecting TWG review must be:
  - Carefully tested
  - Committed in small, safe modules
  - Verified with builds before committing
  - Applied to non-critical components first

---

## 📚 Key Documentation Files

**Read these files FIRST before starting any work:**

1. **ROLLBACK_SUMMARY.md** ⚠️ **CRITICAL** - Complete rollback details and recovery strategy
   - Location: `docs/review-analysis/ROLLBACK_SUMMARY.md`
   - Contains: Work lost, root cause analysis, Phase 1-4 recovery strategy, lessons learned

2. **AGENTS.md** - Core development principles and guidelines
   - Location: `docs/AGENTS.md`
   - Contains: Development principles, "If It Ain't Broke, Don't Fix It", component architecture

3. **NEXT_STEPS.md** - Current roadmap and priorities
   - Location: `docs/review-analysis/NEXT_STEPS.md`
   - Contains: Current status, next steps, rollback context

4. **A_MINUS_ACHIEVEMENT_PLAN.md** - Achievement plan with rollback impact
   - Location: `docs/review-analysis/A_MINUS_ACHIEVEMENT_PLAN.md`
   - Contains: Sprint 4 & 6 work items, rollback status, recovery phases

5. **CURRENT_STATUS.md** - Current project status
   - Location: `docs/review-analysis/CURRENT_STATUS.md`
   - Contains: Sprint completion status, current grade, rollback details

6. **ROLLBACK_VERIFICATION_CHECKLIST.md** - Verification steps
   - Location: `docs/review-analysis/ROLLBACK_VERIFICATION_CHECKLIST.md`
   - Contains: Verification checklist before each commit

7. **CODE_CHANGE_VERIFICATION_PROCESS.md** - Verification process
   - Location: `docs/review-analysis/CODE_CHANGE_VERIFICATION_PROCESS.md`
   - Contains: Standard verification process for changes

---

## ✅ Core Principles (From AGENTS.md)

### **"If It Ain't Broke, Don't Fix It" (CRITICAL)**
- **NEVER optimize working systems** without explicit request
- **ALWAYS verify the problem exists** before implementing solutions
- **TRUST user feedback** about when things were working

### **"First, Do No Harm"**
- **TEST changes in isolation** before applying broadly
- **UNDERSTAND dependencies** before modifying core functions
- **HAVE rollback plans** ready for any changes

### **TWG Review Form Protection**
- **TWG review form is LIVE** - treat as production-critical
- **Minimize changes** to TWG review components
- **Test thoroughly** before deploying any TWG review changes
- **Safe to work on:** Admin panels, poll results, survey results, CEW polls
- **Use caution with:** Header (used by TWG), contexts (used by TWG)

---

## 🎯 Recovery Strategy - Phase 1: Foundation First

### **Objective:** Re-implement foundational work that was rolled back, starting with the safest, most isolated changes.

### **Phase 1.1: Admin Dynamic Rendering (SAFEST - No TWG Impact)**

**Goal:** Add `export const dynamic = 'force-dynamic'` to ALL admin pages

**Why This First:**
- ✅ No component changes - just configuration
- ✅ No user-facing changes
- ✅ Fixes Next.js 15 caching issues
- ✅ Admin pages only - doesn't affect TWG review
- ✅ Low risk, high value

**Approach:**
1. Identify all admin page files (see ROLLBACK_SUMMARY.md for list)
2. Add `export const dynamic = 'force-dynamic'` to each
3. Run `npm run build` to verify
4. Commit as single module: `fix: add force-dynamic to all admin pages`
5. Verify deployment succeeds

**Files to Update:**
- `src/app/(dashboard)/admin/page.tsx`
- `src/app/(dashboard)/admin/announcements/page.tsx`
- `src/app/(dashboard)/admin/cew-stats/page.tsx`
- `src/app/(dashboard)/admin/milestones/page.tsx`
- `src/app/(dashboard)/admin/poll-results/page.tsx`
- `src/app/(dashboard)/admin/reset-votes/page.tsx`
- `src/app/(dashboard)/admin/tags/page.tsx`
- `src/app/(dashboard)/admin/twg-synthesis/page.tsx`
- `src/app/(dashboard)/admin/users/page.tsx`

**Verification Checklist:**
- [ ] Run `npm run build` locally
- [ ] Verify build succeeds with no errors
- [ ] Check all admin pages listed above have the export
- [ ] Verify no TypeScript errors
- [ ] Test locally if possible (admin pages)
- [ ] Commit only after all checks pass
- [ ] Verify deployment succeeds before proceeding

---

### **Phase 1.2: Type Files (SAFE - Minimal Impact)**

**Goal:** Add missing type file that was rolled back

**Why This Second:**
- ✅ Type definitions only - no runtime code
- ✅ TWG review already works without it (current state)
- ✅ Low risk addition
- ✅ Provides type safety improvements

**Approach:**
1. View file from backup branch:
   ```bash
   git show backup-before-rollback-2025-11-14:src/app/(dashboard)/twg/review/twgReviewTypes.ts
   ```
2. Review the file contents - verify it's just type definitions (no runtime code)
3. Verify it's safe to add (doesn't break current functionality)
   - Check if any imports reference files that don't exist yet
   - Verify it's self-contained
4. Create the file in the project
5. Run `npm run build` to verify it compiles
6. **CRITICAL:** Verify TWG review form still works (it should, since it's just types)
7. Commit as single module: `fix: add missing twgReviewTypes.ts file`
8. Verify deployment succeeds before proceeding

**Verification Checklist:**
- [ ] Review file from backup branch
- [ ] Verify file doesn't break current TWG review (it's just types)
- [ ] Run `npm run build` locally
- [ ] Verify build succeeds with no errors
- [ ] Verify no TypeScript errors
- [ ] Test TWG review form still works (if possible)
- [ ] Commit only after all checks pass
- [ ] Verify deployment succeeds before proceeding

---

### **Phase 1.3: Context Files (CAUTION - Affects TWG Review)**

**Goal:** Re-implement `AuthContext.tsx` and `AdminContext.tsx`

**Why This Third:**
- ⚠️ **CAUTION:** These affect TWG review (via layout.tsx)
- ✅ But TWG review currently works without them (we're adding them back)
- ✅ Foundation for other components
- ⚠️ Must test TWG review after adding

**Approach - TWO SEPARATE COMMITS:**

**Module 1: Add Context Files Only**
1. View files from backup branch:
   ```bash
   git show backup-before-rollback-2025-11-14:src/contexts/AuthContext.tsx
   git show backup-before-rollback-2025-11-14:src/contexts/AdminContext.tsx
   ```
2. Review both files carefully
3. **CRITICAL:** Check dependencies:
   - Does `AuthContext.tsx` import anything that doesn't exist? (check `@/components/supabase-client`)
   - Does `AdminContext.tsx` import `AuthContext`? (OK, as long as we add both together)
   - Does `AdminContext.tsx` import `@/lib/admin-utils`? (verify this exists)
4. Create both files in `src/contexts/` directory
5. Run `npm run build` to verify files compile (they won't be used yet)
6. Verify build succeeds with no errors
7. Commit as module 1: `feat: add AuthContext and AdminContext files`
8. Verify deployment succeeds

**Module 2: Integrate Contexts in Layout**
9. **AFTER Module 1 deploys successfully:** Update `src/app/layout.tsx`
10. View layout from backup branch to see how it was integrated:
    ```bash
    git show backup-before-rollback-2025-11-14:src/app/layout.tsx
    ```
11. Update current `src/app/layout.tsx` to add contexts (wrap children with providers)
12. Run `npm run build` again
13. **CRITICAL:** Test TWG review form works:
    - Form loads correctly
    - Form submission works
    - Navigation works
    - No console errors
14. Commit as module 2: `feat: integrate AuthContext and AdminContext in layout`
15. Verify deployment succeeds

**Verification Checklist (Before Each Commit):**
- [ ] Review files from backup branch
- [ ] Verify files are self-contained (no external dependencies not yet committed)
- [ ] Run `npm run build` locally
- [ ] Verify build succeeds with no errors
- [ ] Verify no TypeScript errors
- [ ] **CRITICAL:** Test TWG review form works (if adding to layout)
- [ ] Commit only after all checks pass
- [ ] Verify deployment succeeds before proceeding

**TWG Review Testing:**
- Test form loads correctly
- Test form submission works
- Test navigation works
- Verify no console errors
- Verify no visual regressions

---

## 📋 Module Implementation Rules

### **CRITICAL: Modular Approach Requirements**

1. **One Module Per Commit**
   - Each module must be:
     - Self-contained (all dependencies included)
     - Buildable independently
     - Testable independently
     - Deployable independently

2. **Commit Order (Dependencies First)**
   - **NEVER commit a file that imports another file before that file exists**
   - Example: Don't commit `layout.tsx` using `AuthContext` before committing `AuthContext.tsx`
   - Always commit dependencies before dependents

3. **Build Verification (MANDATORY)**
   - **ALWAYS run `npm run build` before committing**
   - **NEVER commit if build fails**
   - **NEVER commit if TypeScript errors exist**
   - Verify each module builds successfully in isolation

4. **TWG Review Protection**
   - **ALWAYS test TWG review form after changes affecting it**
   - Changes to layout.tsx, Header.tsx, or contexts affect TWG review
   - Test form loads, submits, and navigates correctly
   - Verify no console errors
   - If TWG review breaks, ROLLBACK that commit immediately

5. **Safe Modules First**
   - Admin pages (no TWG impact) - SAFEST
   - Type files (no runtime impact) - SAFE
   - Service layer files (utilities) - LOW RISK
   - Component refactoring - MEDIUM RISK (test TWG if affects it)

6. **Verification Steps (Repeat for Each Module)**
   ```
   1. Review file/change from backup branch or create new
   2. Verify no missing dependencies
   3. Run `npm run build` locally
   4. Verify build succeeds (no errors)
   5. Check for TypeScript errors
   6. If affects TWG: Test TWG review form works
   7. If admin only: Test admin pages work
   8. Commit with descriptive message
   9. Wait for deployment to succeed
   10. Verify deployment succeeded before proceeding
   ```

---

## 🎯 Your First Task: Phase 1.1 - Admin Dynamic Rendering

**Start here:** Implement Phase 1.1 as described above.

**Steps:**
1. **Read key documentation files FIRST:**
   - Read `docs/review-analysis/ROLLBACK_SUMMARY.md` (complete context)
   - Read `docs/AGENTS.md` (development principles)
   - Read `docs/review-analysis/CODE_CHANGE_VERIFICATION_PROCESS.md` (verification steps)

2. **Identify all admin page files:**
   - List all files in `src/app/(dashboard)/admin/` directory
   - Check which ones are page files (have `page.tsx`)

3. **Verify what's needed:**
   - Check backup branch to see what was added:
     ```bash
     git show backup-before-rollback-2025-11-14:src/app/(dashboard)/admin/page.tsx | grep "export const dynamic"
     ```

4. **Add exports to each admin page:**
   - Add `export const dynamic = 'force-dynamic';` at top of each file
   - Verify syntax is correct

5. **Run build verification:**
   ```bash
   npm run build
   ```
   - **CRITICAL:** Build MUST succeed with no errors
   - Only warnings are acceptable

6. **Prepare commit:**
   - Review all files changed
   - Verify all admin pages have the export
   - Prepare commit message: `fix: add force-dynamic to all admin pages`

7. **WAIT FOR USER APPROVAL** before committing
   - Present list of files changed
   - Present build results
   - Present commit message
   - Wait for explicit approval

8. **After commit:**
   - Verify deployment succeeds (check Vercel dashboard)
   - Report results
   - **ONLY PROCEED** to Phase 1.2 after Phase 1.1 is deployed successfully

**Questions to Answer:**
- Which admin page files need the export?
- Does the build succeed after adding exports?
- Are there any TypeScript errors?
- Is this ready to commit?

**Deliverable (After User Approval):**
- Commit completed
- Deployment status
- Verification that deployment succeeded
- Ready for Phase 1.2 confirmation

---

## ⚠️ Critical Warnings

1. **NEVER commit if build fails** - This is what caused the original failures
2. **NEVER commit dependencies after dependents** - Always commit files in order
3. **ALWAYS verify builds** - Run `npm run build` before every commit
4. **PROTECT TWG REVIEW** - Test thoroughly if changes affect it
5. **SMALL MODULES** - One logical change per commit
6. **VERIFY DEPLOYMENT** - Wait for deployment success before next module

---

## 📚 References

**Primary Documents:**
- `docs/review-analysis/ROLLBACK_SUMMARY.md` - Complete rollback details
- `docs/AGENTS.md` - Development principles and guidelines
- `docs/review-analysis/NEXT_STEPS.md` - Current roadmap
- `docs/review-analysis/A_MINUS_ACHIEVEMENT_PLAN.md` - Achievement plan
- `docs/review-analysis/CURRENT_STATUS.md` - Current status
- `docs/review-analysis/ROLLBACK_VERIFICATION_CHECKLIST.md` - Verification steps

**Backup Branch:**
- `backup-before-rollback-2025-11-14` - Contains all lost work

**Accessing Lost Work from Backup Branch:**
```bash
# View context files
git show backup-before-rollback-2025-11-14:src/contexts/AuthContext.tsx
git show backup-before-rollback-2025-11-14:src/contexts/AdminContext.tsx

# View service layer files
git show backup-before-rollback-2025-11-14:src/services/pollResultsService.ts
git show backup-before-rollback-2025-11-14:src/lib/matrix-graph-utils.ts

# View component files
git show backup-before-rollback-2025-11-14:src/components/dashboard/wordcloud/WordCloudTypes.ts
git show backup-before-rollback-2025-11-14:src/components/header/DesktopNavigation.tsx

# View type files
git show backup-before-rollback-2025-11-14:src/app/(dashboard)/twg/review/twgReviewTypes.ts

# Check what files were in a directory
git ls-tree -r --name-only backup-before-rollback-2025-11-14 -- src/contexts/
git ls-tree -r --name-only backup-before-rollback-2025-11-14 -- src/components/dashboard/wordcloud/
git ls-tree -r --name-only backup-before-rollback-2025-11-14 -- src/components/header/
```

**Current State:**
- Branch: `chore/next-15-5-6-staging`
- Commit: `1a972b4` ("Adjust TWG review instructions styling")
- Status: Stable, deployed, matches production

---

## ✅ Success Criteria

**Phase 1 Complete When:**
- ✅ All admin pages have `force-dynamic` export
- ✅ Type files added (if safe)
- ✅ Context files added and integrated (if safe, with TWG testing)
- ✅ Each module committed separately
- ✅ Each module verified with build
- ✅ Each module deployed successfully
- ✅ TWG review form still works (if contexts added)

**Before Proceeding to Phase 2:**
- ✅ Phase 1 complete and verified
- ✅ All deployments successful
- ✅ User approval to continue

---

## 🚀 Ready to Start

### **Your Immediate Task: Implement Phase 1.1 - Admin Dynamic Rendering**

**Mandatory Reading (Read These First):**
1. `docs/review-analysis/ROLLBACK_SUMMARY.md` - Complete context of rollback and recovery strategy
2. `docs/AGENTS.md` - Core development principles, especially "If It Ain't Broke, Don't Fix It"
3. `docs/review-analysis/CODE_CHANGE_VERIFICATION_PROCESS.md` - Verification process and checklist
4. `docs/review-analysis/ROLLBACK_VERIFICATION_CHECKLIST.md` - Verification steps from rollback

**Implementation Steps:**
1. **Read documentation** (above files) - Understand context and principles
2. **Identify admin page files** - List all `page.tsx` files in `src/app/(dashboard)/admin/`
3. **Check backup branch** - Verify what was added (optional, for reference)
4. **Add exports** - Add `export const dynamic = 'force-dynamic';` to each file
5. **Verify build** - Run `npm run build` and verify success
6. **Prepare deliverable** - Format results as shown above
7. **WAIT FOR USER APPROVAL** - Do NOT commit until explicitly approved
8. **After approval** - Commit, verify deployment, report results

**Remember:**
- ✅ Small modules (one logical change per commit)
- ✅ Build verification (MANDATORY before commit)
- ✅ Safe-first approach (admin pages don't affect TWG review)
- ✅ Protect TWG review (no changes affecting it in Phase 1.1)
- ✅ Wait for approval (never commit without explicit approval)
- ✅ Verify deployment (check success before proceeding)

**Success Criteria:**
- ✅ All admin pages have `export const dynamic = 'force-dynamic'`
- ✅ Build succeeds with no errors
- ✅ Commit approved and successful
- ✅ Deployment verified successful
- ✅ Ready for Phase 1.2 (with user confirmation)

---

**Status:** Ready for Phase 1.1 implementation  
**Last Updated:** November 14, 2025  
**Next Step:** User will wait for Phase 1.1 completion before proceeding to Phase 1.2

---

## 📝 How to Use This Prompt

### **For This First Chat (Phase 1.1):**
1. Copy the entire prompt above (starting from "## 🎯 Mission Statement")
2. Paste into a fresh AI chat
3. The AI will implement Phase 1.1 only
4. Wait for results and approval before proceeding

### **For Subsequent Chats (Phase 1.2, 1.3, etc.):**
1. After Phase 1.1 completes successfully, create a new prompt for Phase 1.2
2. Reference this document: `docs/review-analysis/RECOVERY_PROMPT.md`
3. Use the same structure, but focus on the next phase
4. Include:
   - Previous phase completion confirmation
   - Current phase objectives
   - Specific steps for that phase
   - Same verification and approval requirements

### **Example Next Prompt (Phase 1.2):**
```
You are continuing the modular recovery strategy from RECOVERY_PROMPT.md.

**Previous Phase Status:**
- ✅ Phase 1.1 Complete: Admin dynamic rendering added and deployed successfully

**Current Task: Phase 1.2 - Add Type Files**

[Include Phase 1.2 section from RECOVERY_PROMPT.md]
```

### **Phase Progression:**
- **Phase 1.1:** Admin Dynamic Rendering (SAFEST - No TWG impact)
- **Phase 1.2:** Type Files (SAFE - Minimal impact)
- **Phase 1.3:** Context Files (CAUTION - Affects TWG, two modules)
- **Phase 2:** Service Layer (LOW RISK)
- **Phase 3:** Component Refactoring (MEDIUM RISK)
- **Phase 4:** CSS Refactoring (After core stable)

**Only proceed to next phase after:**
- ✅ Current phase deployed successfully
- ✅ User confirmation to continue
- ✅ All verification checks passed

