# Prompt 32: Git Commit Verification (CRITICAL)

**Date:** November 2025  
**Context:** Verifying all files are committed (not just staged) before pushing. This is critical to prevent deployment failures.  
**Status:** Ready to execute after Prompt 31

---

## ⚠️ CRITICAL WARNING

**This is the #1 cause of deployment failures.** Vercel builds from committed code, NOT staged changes. If files are staged but not committed, they will NOT be included in the deployment build, causing build failures.

---

## Context

Before pushing to the repository, we must verify that ALL files are committed (not just staged). This is critical because:

1. Vercel builds from committed code, not staged changes
2. If a component imports files, those files MUST be committed
3. Staged but uncommitted files will cause deployment failures

---

## Task

### 1. Check Git Status

Run `git status` to check for staged but uncommitted files:
```bash
git status
```

### 2. Review Staged Files

If files are staged but not committed:
- Review which files are staged
- Verify they are all needed
- **COMMIT THEM** before proceeding

### 3. Verify All Files Are in Git History

Run `git log -1 --name-only` to see what's in the latest commit:
```bash
git log -1 --name-only
```

Ensure all new files are included:
- `src/lib/chart_data.ts`
- `src/components/charts/ReportBarChart.tsx`
- `src/components/charts/ReportGroupedBarChart.tsx`
- `src/components/charts/ReportWordCloudChart.tsx`
- `src/app/(dashboard)/cew-results/page.tsx`
- `src/app/(dashboard)/twg-results/page.tsx`
- `src/components/charts/CEWMatrixChart.tsx` (if created)
- `src/components/header/menuConfig.ts` (if modified)
- Any other new files created

---

## Critical Requirements

### From AGENTS.md Section 13:

1. **VERIFY ALL FILES ARE COMMITTED, NOT JUST STAGED**
   - This is the #1 cause of deployment failures
   - Vercel builds from committed code, NOT staged changes

2. **If a component imports files, those files MUST be committed**
   - Dependencies must be committed before dependents
   - Verify builds after each commit

3. **Run `git status` before pushing**
   - Check for "Changes to be committed" section
   - If present, commit those files first

4. **Run `git log -1 --name-only` to verify files are in the latest commit**
   - Verify all new files are included
   - Verify all modified files are included

---

## Prevention Checklist

Use this checklist before pushing:

```bash
# 1. Check for staged but uncommitted files
git status

# 2. If files are staged, verify they're needed
git diff --cached --stat

# 3. If files are needed, COMMIT THEM
git commit -m "Add CEW and TWG Results pages with interactive charts"

# 4. Verify commit includes all files
git log -1 --name-only

# 5. Only then push
git push
```

---

## RED FLAGS

**STOP and commit files if you see:**

1. **"Changes to be committed" in `git status`**
   - AND those files are imported by other files
   - STOP and commit them first

2. **Files in staging area that are dependencies**
   - If `page.tsx` imports `chart_data.ts`, both must be committed
   - Commit dependencies before dependents

3. **Any staged files before pushing**
   - Commit all staged files before pushing
   - Do not push with uncommitted staged files

---

## Expected Result

- ✅ `git status` shows "nothing to commit, working tree clean"
- ✅ All new files are in the latest commit (verified with `git log -1 --name-only`)
- ✅ All modified files are in the latest commit
- ✅ No staged but uncommitted files
- ✅ Ready to push

---

## Commit Message Template

If committing files, use a descriptive commit message:

```
Add CEW and TWG Results pages with interactive charts

- Add CEW Results page with G-1 through G-23 charts
- Add TWG Results page with J-1 through J-10 charts
- Add chart components: ReportBarChart, ReportGroupedBarChart, ReportWordCloudChart
- Add chart data utilities in chart_data.ts
- Update menu configuration for new pages
- Fix light mode background contrast (bg-gray-100)
```

---

## Next Steps

After verification passes:
1. Push to repository: `git push`
2. Monitor deployment on Vercel
3. Verify deployment succeeds
4. Test deployed pages

---

## Reference

- See `docs/AGENTS.md` Section 13 for complete prevention checklist
- See `docs/review-analysis/DEPLOYMENT_PREVENTION_SYSTEM.md` for deployment prevention system details
- See `docs/review-analysis/DEPLOYMENT_FAILURE_9_INVESTIGATION.md` for examples of deployment failures caused by uncommitted files

---

## Notes

- **DO NOT SKIP THIS STEP** - It's critical for preventing deployment failures
- Take time to verify - rushing here causes deployment failures
- If in doubt, commit files before pushing
- Always verify with `git log -1 --name-only` before pushing

