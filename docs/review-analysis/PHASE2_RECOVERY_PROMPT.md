# Phase 2 Recovery Prompt - Service Layer Recovery

## 🎯 Mission Statement

You are continuing the **modular, safe recovery strategy** for work that was rolled back on November 14, 2025. Phase 1 is **COMPLETE AND VERIFIED**. You are now implementing **Phase 2: Service Layer Recovery**.

The TWG review form is **LIVE AND IN USE** by real users, so all work must be done carefully with minimal risk to production users.

---

## ✅ Phase 1 Completion Status

**Phase 1 is COMPLETE and all deployments verified successful:**

1. ✅ **Phase 1.1: Admin Dynamic Rendering** - Complete
   - Commit: `3409374` - "fix: add force-dynamic to all admin pages"
   - All 9 admin pages updated with `export const dynamic = 'force-dynamic'`
   - Deployed and verified working

2. ✅ **Phase 1.2: Type Files** - Complete
   - Commit: `3e97d90` - "fix: add missing twgReviewTypes.ts file"
   - Type file added successfully
   - Deployed and verified working

3. ✅ **Phase 1.3: Context Files** - Complete
   - Commit: `b4ed694` - "feat: add AuthContext and AdminContext files"
   - Commit: `3b6b604` - "feat: integrate AuthContext and AdminContext in layout"
   - Contexts added and integrated in layout
   - TWG review form tested and verified working
   - Deployed and verified working

**Current Branch:** `chore/next-15-5-6-staging`  
**Latest Commit:** `0ac6931` (Phase 2.2)  
**Status:** Phase 1 and Phase 2 complete, Phase 3 paused (TWG review active)

---

## 📋 Context & Background

### **Rollback Situation:**
- **Rollback Date:** November 14, 2025
- **Rollback Reason:** 7 consecutive deployment failures
- **Rollback Target:** Commit `1a972b4` ("Adjust TWG review instructions styling")
- **Backup Branch:** `backup-before-rollback-2025-11-14` contains all 9 failed commits

### **Work Lost (All Preserved in Backup Branch):**
1. ❌ **Matrix graph logic extraction** - ~340 lines duplicate code eliminated (Nov 13, tested, rolled back Nov 14)
2. ❌ **WordCloudPoll component split** - 754 → 395 lines (47.6% reduction, Nov 13, tested, rolled back Nov 14)
3. ✅ **Global Context files** - `AuthContext.tsx`, `AdminContext.tsx` (RECOVERED in Phase 1.3)
4. ❌ **Header component split** - 5 subcomponents created, main component refactored (rolled back)
5. ❌ **PollResultsClient service layer** - `pollResultsService.ts` (created, rolled back) - **PHASE 2 TARGET**
6. ❌ **CSS refactoring** - 17 !important removed (5.2% reduction, rolled back)

### **Why Deployment Failed:**
- **Root Cause:** Commits made in wrong order - dependencies committed after dependents
- **Specific Issues:**
  - Components referencing new files were committed before those files existed
  - Missing files caused import errors in production builds
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

1. **RECOVERY_PROMPT.md** ⚠️ **CRITICAL** - Original recovery strategy and Phase 1 instructions
   - Location: `docs/review-analysis/RECOVERY_PROMPT.md`
   - Contains: Complete rollback details, Phase 1-4 recovery strategy, lessons learned

2. **ROLLBACK_SUMMARY.md** - Complete rollback details and recovery strategy
   - Location: `docs/review-analysis/ROLLBACK_SUMMARY.md`
   - Contains: Work lost, root cause analysis, Phase 1-4 recovery strategy

3. **AGENTS.md** - Core development principles and guidelines
   - Location: `docs/AGENTS.md`
   - Contains: Development principles, "If It Ain't Broke, Don't Fix It", component architecture

4. **NEXT_STEPS.md** - Current roadmap and priorities
   - Location: `docs/review-analysis/NEXT_STEPS.md`
   - Contains: Current status, next steps, rollback context

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
- **Safe to work on:** Admin panels, poll results, survey results, CEW polls, service layer files
- **Use caution with:** Header (used by TWG), contexts (already added in Phase 1.3)

---

## 🎯 Phase 2: Service Layer Recovery

### **Objective:** Re-implement service layer files that were rolled back, starting with the safest, most isolated changes.

### **Status:** ✅ **COMPLETE** - November 17, 2025

### **Why This Phase:**
- ✅ Service layer files are utilities/helpers - no direct UI impact
- ✅ Used by components but don't affect TWG review directly
- ✅ Can be added incrementally
- ✅ Lower risk than component refactoring

### **Phase 2 Completion Summary:**

**Phase 2.1: Poll Results Service Layer** ✅ COMPLETE
- Commit: `0726845` - "feat: add pollResultsService.ts service layer"
- File: `src/services/pollResultsService.ts` (785 lines)
- Status: Deployed and verified - November 17, 2025
- Verification: All admin pages loaded with no errors

**Phase 2.2: Matrix Graph Utilities** ✅ COMPLETE
- Commit: `0ac6931` - "feat: add matrix-graph-utils.ts utility file"
- File: `src/lib/matrix-graph-utils.ts` (260 lines)
- Status: Deployed and verified - November 17, 2025
- Verification: All admin pages loaded with no errors

**Total Recovery:**
- 2 service layer files recovered
- 1,045 lines of code restored
- Zero errors introduced
- All builds successful
- All deployments verified

### **Phase 2.1: Poll Results Service Layer**

**Goal:** Add `pollResultsService.ts` service layer file

**Why This First:**
- ✅ Service layer only - no UI changes
- ✅ Used by admin poll results page (not TWG review)
- ✅ Low risk addition
- ✅ Provides code organization improvements

**Approach:**
1. View file from backup branch:
   ```bash
   git show backup-before-rollback-2025-11-14:src/services/pollResultsService.ts
   ```
2. Review the file contents carefully
3. **CRITICAL:** Check dependencies:
   - Does it import anything that doesn't exist?
   - Does it reference files that were rolled back?
   - Verify all imports are available
4. Check if `src/services/` directory exists (create if needed)
5. Create the file in the project
6. Run `npm run build` to verify it compiles
7. **CRITICAL:** Verify no components are broken (check admin poll-results page)
8. Commit as single module: `feat: add pollResultsService.ts service layer`
9. Verify deployment succeeds before proceeding

**Verification Checklist:**
- [ ] Review file from backup branch
- [ ] Verify all dependencies exist
- [ ] Check if `src/services/` directory exists
- [ ] Run `npm run build` locally
- [ ] Verify build succeeds with no errors
- [ ] Verify no TypeScript errors
- [ ] Test admin poll-results page still works (if possible)
- [ ] Commit only after all checks pass
- [ ] Verify deployment succeeds before proceeding

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
   - Service layer files (utilities) - LOW RISK ✅ CURRENT PHASE
   - Admin pages (no TWG impact) - SAFEST ✅ COMPLETE
   - Type files (no runtime impact) - SAFE ✅ COMPLETE
   - Component refactoring - MEDIUM RISK (future phase)

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

## 🎯 Your First Task: Phase 2.1 - Poll Results Service Layer

**Start here:** Implement Phase 2.1 as described above.

**Steps:**
1. **Read key documentation files FIRST:**
   - Read `docs/review-analysis/RECOVERY_PROMPT.md` (complete context)
   - Read `docs/AGENTS.md` (development principles)
   - Read `docs/review-analysis/ROLLBACK_SUMMARY.md` (rollback details)

2. **Check backup branch for service layer files:**
   ```bash
   git ls-tree -r --name-only backup-before-rollback-2025-11-14 -- src/services/
   ```

3. **View the pollResultsService.ts file:**
   ```bash
   git show backup-before-rollback-2025-11-14:src/services/pollResultsService.ts
   ```

4. **Review dependencies:**
   - Check all imports
   - Verify all imported files exist
   - Check if any imports reference rolled-back files

5. **Create the file:**
   - Check if `src/services/` directory exists
   - Create the file with contents from backup branch
   - Verify syntax is correct

6. **Run build verification:**
   ```bash
   npm run build
   ```
   - **CRITICAL:** Build MUST succeed with no errors
   - Only warnings are acceptable

7. **Prepare commit:**
   - Review all files changed
   - Verify file is self-contained
   - Prepare commit message: `feat: add pollResultsService.ts service layer`

8. **WAIT FOR USER APPROVAL** before committing
   - Present list of files changed
   - Present build results
   - Present commit message
   - Wait for explicit approval

9. **After commit:**
   - Verify deployment succeeds (check Vercel dashboard)
   - Report results
   - **ONLY PROCEED** to next module after current module is deployed successfully

**Questions to Answer:**
- Does the service file exist in backup branch?
- What are its dependencies?
- Does the build succeed after adding the file?
- Are there any TypeScript errors?
- Is this ready to commit?

**Deliverable (After User Approval):**
- Commit completed
- Deployment status
- Verification that deployment succeeded
- Ready for next module confirmation

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
- `docs/review-analysis/RECOVERY_PROMPT.md` - Original recovery strategy (Phase 1)
- `docs/review-analysis/ROLLBACK_SUMMARY.md` - Complete rollback details
- `docs/AGENTS.md` - Development principles and guidelines
- `docs/review-analysis/NEXT_STEPS.md` - Current roadmap

**Backup Branch:**
- `backup-before-rollback-2025-11-14` - Contains all lost work

**Accessing Lost Work from Backup Branch:**
```bash
# View service layer files
git show backup-before-rollback-2025-11-14:src/services/pollResultsService.ts

# Check what files were in a directory
git ls-tree -r --name-only backup-before-rollback-2025-11-14 -- src/services/
```

**Current State:**
- Branch: `chore/next-15-5-6-staging`
- Latest Commit: `3b6b604` ("feat: integrate AuthContext and AdminContext in layout")
- Status: Phase 1 complete, Phase 2 ready to start

---

## ✅ Success Criteria

**Phase 2 Complete When:**
- ✅ Service layer files added
- ✅ Each module committed separately
- ✅ Each module verified with build
- ✅ Each module deployed successfully
- ✅ No regressions in existing functionality

**Before Proceeding to Phase 3:**
- ✅ Phase 2 complete and verified
- ✅ All deployments successful
- ✅ User approval to continue

---

## 🚀 Ready to Start

### **Your Immediate Task: Implement Phase 2.1 - Poll Results Service Layer**

**Mandatory Reading (Read These First):**
1. `docs/review-analysis/RECOVERY_PROMPT.md` - Complete context of rollback and recovery strategy
2. `docs/AGENTS.md` - Core development principles, especially "If It Ain't Broke, Don't Fix It"
3. `docs/review-analysis/ROLLBACK_SUMMARY.md` - Rollback details and recovery phases

**Implementation Steps:**
1. **Read documentation** (above files) - Understand context and principles
2. **Check backup branch** - List service layer files that exist
3. **View pollResultsService.ts** - Review file contents and dependencies
4. **Verify dependencies** - Check all imports exist
5. **Create file** - Add service layer file to project
6. **Verify build** - Run `npm run build` and verify success
7. **Prepare deliverable** - Format results for user approval
8. **WAIT FOR USER APPROVAL** - Do NOT commit until explicitly approved
9. **After approval** - Commit, verify deployment, report results

**Remember:**
- ✅ Small modules (one logical change per commit)
- ✅ Build verification (MANDATORY before commit)
- ✅ Safe-first approach (service layer doesn't affect TWG review)
- ✅ Protect TWG review (no changes affecting it in Phase 2)
- ✅ Wait for approval (never commit without explicit approval)
- ✅ Verify deployment (check success before proceeding)

**Success Criteria:**
- ✅ Service layer file added
- ✅ Build succeeds with no errors
- ✅ Commit approved and successful
- ✅ Deployment verified successful
- ✅ Ready for next module (with user confirmation)

---

**Status:** ✅ Phase 2 Complete - November 17, 2025  
**Last Updated:** November 17, 2025 (after Phase 2 completion)  
**Next Step:** Phase 3 paused - TWG review form is active, header changes deferred to avoid impact

---

## 📝 How to Use This Prompt

### **For This Chat (Phase 2.1):**
1. Copy the entire prompt above (starting from "## 🎯 Mission Statement")
2. Paste into a fresh AI chat
3. The AI will implement Phase 2.1 only
4. Wait for results and approval before proceeding

### **For Subsequent Modules:**
1. After Phase 2.1 completes successfully, create a new prompt for the next module
2. Reference this document: `docs/review-analysis/PHASE2_RECOVERY_PROMPT.md`
3. Use the same structure, but focus on the next module
4. Include:
   - Previous module completion confirmation
   - Current module objectives
   - Specific steps for that module
   - Same verification and approval requirements

### **Phase Progression:**
- **Phase 1:** Foundation (COMPLETE ✅)
  - Phase 1.1: Admin Dynamic Rendering ✅
  - Phase 1.2: Type Files ✅
  - Phase 1.3: Context Files ✅
- **Phase 2:** Service Layer (COMPLETE ✅)
  - Phase 2.1: Poll Results Service Layer ✅
  - Phase 2.2: Matrix Graph Utilities ✅
- **Phase 3:** Component Refactoring (PAUSED ⏸️)
  - **Status:** Deferred - TWG review form is active online
  - **Reason:** Header component changes affected TWG review previously
  - **Decision:** Wait until TWG review period ends before proceeding
  - **Includes:** WordCloud component split, Header component split, Matrix graph component updates
- **Phase 4:** CSS Refactoring (FUTURE)

**Only proceed to next module after:**
- ✅ Current module deployed successfully
- ✅ User confirmation to continue
- ✅ All verification checks passed

