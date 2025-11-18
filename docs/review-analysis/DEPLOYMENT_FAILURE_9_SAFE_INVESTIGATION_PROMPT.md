# Deployment Failure #9 - SAFE Investigation Prompt

**Date:** November 17, 2025  
**Issue:** 9th consecutive Vercel deployment failure  
**Root Cause Pattern:** Same as November 14, 2025 - Missing committed files  
**Status:** 🔴 **CRITICAL** - Investigation needed  
**⚠️ CRITICAL WARNING:** Previous AI chats have crashed when using terminal commands. Use file-based tools instead.

---

## 🎯 Mission Statement

You are investigating the **9th consecutive Vercel deployment failure**. This follows the same pattern as the November 14, 2025 rollback where **7 consecutive deployments failed** due to uncommitted files. Your task is to identify all missing committed files that are referenced by committed code, commit them in the correct order, and ensure successful deployment.

**🚨 CRITICAL: NO TERMINAL COMMANDS FOR INVESTIGATION**
- **DO NOT use `run_terminal_cmd` tool AT ALL during investigation**
- **DO NOT run `git status`, `git log`, `git diff`, or ANY git commands for checking**
- **Previous chats crashed on:** `git status --short | Select-Object -First 10` - even that crashed!
- **ONLY use terminal for:** Final `git add`, `git commit`, and `git push` (after investigation complete)
- **Use ONLY file-based tools:** `read_file`, `list_dir`, `grep` (file tool), `read_lints`
- **This is Windows/PowerShell** - terminal commands are unstable in this environment

---

## 📋 Context & Background

### Previous Deployment Failures
- **November 14, 2025:** 7 consecutive deployment failures → rollback to commit `1a972b4`
- **Root Cause:** Files were modified/created but NOT committed before pushing
- **Specific Issue:** Components imported files that didn't exist in git (staged but not committed)
- **Prevention:** AGENTS.md Section 13 - Git Commit Verification Before Deployment

### Recent Commits (Fixed TWG Synthesis Issues)
- `d6f2e4d` - Exported `TWGReviewFormData` interface (Nov 17, 2025)
- `6db611a` - Imported `TWGReviewFormData` type (Nov 17, 2025)
- `ddb041f` - Header component refactoring (Nov 17, 2025)

### Current Issue
- **9th deployment failure** after fixing TWG synthesis TypeScript issues
- **Likely Cause:** Header component imports from `./header/` subdirectory, but those files may not be committed

---

## 🔍 SAFE Investigation Steps (Use File Tools, NOT Terminal)

### Step 1: Check Header Component Imports ⚠️ **CRITICAL**

**DO THIS FIRST - Use `read_file` tool:**
1. Read `src/components/Header.tsx` to see what it imports
2. Look for imports from `./header/` subdirectory

**Expected imports from Header.tsx:**
- `import { HeaderBrand } from './header/HeaderBrand';`
- `import { DesktopNavigation } from './header/DesktopNavigation';`
- `import { UserControls } from './header/UserControls';`
- `import { MobileNavigation } from './header/MobileNavigation';`
- `import { MENU_LINKS } from './header/menuConfig';`

**Files that MUST exist in git:**
- `src/components/header/HeaderBrand.tsx`
- `src/components/header/DesktopNavigation.tsx`
- `src/components/header/UserControls.tsx`
- `src/components/header/MobileNavigation.tsx`
- `src/components/header/menuConfig.ts`

### Step 2: Check Which Files Actually Exist (Use `list_dir` tool)

**DO THIS - Use `list_dir` tool:**
1. List directory: `src/components/header/`
2. Compare what exists locally vs what's committed

**From previous investigation (screenshots show):**
- `git ls-files` showed only 3 files:
  - `src/components/header/MobileNavigation.tsx` ✅
  - `src/components/header/UserControls.tsx` ✅
  - `src/components/header/menuConfig.ts` ✅
- **MISSING from git:**
  - `src/components/header/HeaderBrand.tsx` ❌
  - `src/components/header/DesktopNavigation.tsx` ❌

### Step 3: Verify Files Exist Locally (Use `read_file` tool)

**DO THIS - Use `read_file` tool for each file:**
1. Try to read `src/components/header/HeaderBrand.tsx`
2. Try to read `src/components/header/DesktopNavigation.tsx`
3. If files exist locally but aren't in git, they need to be committed

### Step 4: Determine Which Files Are Missing (Use File Tools Only)

**🚨 DO NOT USE TERMINAL - Use file-based comparison instead:**

**Method: Compare what exists vs what's needed:**
1. You already know from Step 1 what files Header.tsx imports (5 files)
2. You already know from Step 2 what files exist locally (use `list_dir`)
3. **From previous investigation:** Only 3 files are committed:
   - `MobileNavigation.tsx` ✅
   - `UserControls.tsx` ✅
   - `menuConfig.ts` ✅
4. **Missing from git (need to commit):**
   - `HeaderBrand.tsx` ❌
   - `DesktopNavigation.tsx` ❌

**You do NOT need git status to know this - file tools tell you everything!**

### Step 5: Check for Other Missing Dependencies (Use `grep` file tool)

**DO THIS - Use `grep` file tool (NOT terminal grep):**
1. Search for imports in `src/components/Header.tsx`
2. Search for other files that import from `./header/`
3. Check recent commits for new imports

---

## 🔧 Fix Steps (If Files Are Missing)

### If Header Subdirectory Files Are Missing:

**Step 1: Verify Files Exist Locally (Use `read_file` tool)**
- Read each file to ensure it's complete and correct
- Verify exports match imports in `Header.tsx`

**Step 2: Stage and Commit Missing Files**

**⚠️ ONLY use terminal for git add/commit - these are safe:**
```powershell
# Stage the missing files
git add "src/components/header/HeaderBrand.tsx"
git add "src/components/header/DesktopNavigation.tsx"

# Commit with descriptive message
git commit -m "fix: add missing Header subcomponent files (HeaderBrand, DesktopNavigation) - fixes deployment failure #9"
```

**Step 3: Verify Commit (DO NOT use git log - it crashes!)**

**Instead, verify by:**
1. Use `read_file` to check that files still exist after commit
2. Trust that `git commit` succeeded if it returned success
3. **DO NOT run `git log` or `git status` - they crash the chat!**

**Step 4: Final Verification (File-based only)**
- Use `read_file` to verify all 5 header files exist
- Use `list_dir` to confirm all files are present
- **DO NOT run `git status` - it will crash!**

**Step 5: Push (ONLY after verification)**
```powershell
git push origin chore/next-15-5-6-staging
```

---

## ✅ Prevention Checklist (AGENTS.md Section 13)

**Before pushing ANY commits:**

1. ✅ **Check for staged but uncommitted files:**
   - Use `read_file` to check `src/components/Header.tsx` imports
   - Use `list_dir` to verify all imported files exist
   - **DO NOT use `git status` - it crashes!**

2. ✅ **Verify all imports resolve:**
   - All imported files must be in git history
   - Check relative imports especially
   - Use file tools to verify file existence

3. ✅ **Commit dependencies first:**
   - If `Header.tsx` imports from `./header/`, commit `header/` files BEFORE `Header.tsx`
   - Or commit them together if they're independent

4. ✅ **Verify commits before pushing:**
   - Use `read_file` to verify files exist after commit
   - Use `list_dir` to confirm all files are present
   - **DO NOT use `git log` - it crashes!**

5. ✅ **NEVER push with uncommitted imported files:**
   - Vercel builds from committed code, NOT staged changes
   - Local builds can pass even if files aren't committed (files exist locally)
   - Vercel builds fail with "Cannot find module" errors

---

## 🚨 CRITICAL WARNINGS - READ CAREFULLY

1. **NEVER commit dependencies after dependents** - Always commit files in order
2. **ALWAYS verify files are committed (not just staged)** - This caused all previous failures
3. **🚨 DO NOT USE TERMINAL FOR INVESTIGATION** - Previous chats crashed on `git status --short | Select-Object -First 10`
4. **ONLY use terminal for:** `git add`, `git commit`, `git push` (final steps only)
5. **AVOID `npm run build`** - Use `read_lints` tool instead to prevent connection issues
6. **VERIFY WITH FILE TOOLS** - Use `read_file` and `list_dir` to verify, NOT `git status`
7. **If `git commit` succeeds, trust it** - Don't verify with `git log` (it crashes!)

---

## 📊 Expected Resolution

**After fixing missing files:**
1. All header subdirectory files committed (all 5 files)
2. All imports resolve correctly
3. Build succeeds on Vercel
4. Deployment completes successfully

**Verification (use file tools ONLY):**
- Use `list_dir` to verify all files exist
- Use `read_file` to verify file contents
- **DO NOT use `git status` - it crashes the chat!**

---

## 🎯 Your Task (Prioritize File Tools)

1. **Investigate (Use file tools):**
   - Read `src/components/Header.tsx` to see imports
   - List `src/components/header/` directory
   - Read each imported file to verify it exists

2. **Identify (Use file tools):**
   - Compare imports vs files that exist
   - Find all missing files that are imported by committed code

3. **Fix (Use terminal only for git add/commit):**
   - Stage missing files
   - Commit with descriptive message
   - Verify commit includes all files

4. **Verify (Use file tools ONLY):**
   - Use `read_file` to verify all 5 header files exist
   - Use `list_dir` to confirm directory contents
   - **DO NOT use `git status` - it crashes!**

5. **Prevent:** Follow AGENTS.md Section 13 checklist to prevent future failures

**Success Criteria:**
- ✅ All imported files are committed (all 5 header files)
- ✅ All commits are in correct order (dependencies first)
- ✅ Git status shows branch is clean or only documentation changes remain
- ✅ Deployment succeeds on Vercel

---

## 📚 References

- **AGENTS.md Section 13** - Git Commit Verification Before Deployment (CRITICAL)
- **ROLLBACK_SUMMARY.md** - Previous deployment failure analysis
- **WORDCLOUD_COMMIT_DEPLOYMENT_INVESTIGATION.md** - Similar issue investigation
- **DEPLOYMENT_FAILURE_9_INVESTIGATION.md** - Previous investigation attempt (chat crashed)

---

## 🔧 Tool Usage Priority

**PREFERRED (Safe, won't crash):**
1. `read_file` - Read file contents
2. `list_dir` - List directory contents
3. `grep` (file tool) - Search for patterns in files
4. `read_lints` - Check for linting issues
5. `glob_file_search` - Find files by pattern

**ONLY FOR FINAL STEPS (After investigation complete):**
- `run_terminal_cmd` - ONLY for `git add`, `git commit`, `git push`
- **DO NOT use for verification** - trust that commands succeeded

**🚨 NEVER USE (Will crash chat):**
- ❌ `git status` (even `--short` crashes!)
- ❌ `git log` (even `-1` crashes!)
- ❌ `git diff` (crashes!)
- ❌ `git show` (crashes!)
- ❌ `git ls-files` (crashes!)
- ❌ `npm run build` (use `read_lints` instead)
- ❌ **ANY git command for checking/verification** - use file tools instead!

---

---

## 🎯 MANDATORY WORKFLOW (Follow Exactly)

**Phase 1: Investigation (FILE TOOLS ONLY - NO TERMINAL)**
1. Use `read_file` to read `src/components/Header.tsx` (lines 1-15 to see imports)
2. Use `list_dir` to list `src/components/header/` directory
3. Compare: 5 files needed (from imports) vs files that exist locally
4. Identify missing files: Based on previous investigation, `HeaderBrand.tsx` and `DesktopNavigation.tsx` are likely missing

**Phase 2: Verification (FILE TOOLS ONLY - NO TERMINAL)**
1. Use `read_file` to read `src/components/header/HeaderBrand.tsx` (verify it exists locally)
2. Use `read_file` to read `src/components/header/DesktopNavigation.tsx` (verify it exists locally)
3. If both files exist locally but aren't committed, proceed to Phase 3

**Phase 3: Fix (TERMINAL ONLY FOR GIT COMMANDS)**
1. Use `run_terminal_cmd` to run: `git add "src/components/header/HeaderBrand.tsx"`
2. Use `run_terminal_cmd` to run: `git add "src/components/header/DesktopNavigation.tsx"`
3. Use `run_terminal_cmd` to run: `git commit -m "fix: add missing Header subcomponent files (HeaderBrand, DesktopNavigation) - fixes deployment failure #9"`
4. Use `run_terminal_cmd` to run: `git push origin chore/next-15-5-6-staging`

**Phase 4: Final Verification (FILE TOOLS ONLY - NO TERMINAL)**
1. Use `read_file` to verify all 5 header files still exist
2. Use `list_dir` to confirm directory contents
3. **DO NOT run `git status` or `git log` - they crash!**

---

**Status:** Ready for safe investigation  
**Last Updated:** November 17, 2025 (Updated after crash on `git status`)  
**Next Step:** Start with Phase 1 - Use `read_file` to check `src/components/Header.tsx` imports, then `list_dir` to check `src/components/header/` directory

