# Prompt 29: Run Linting Checks

**Date:** November 2025  
**Context:** Verifying code quality before committing CEW and TWG Results pages.  
**Status:** Ready to execute after Prompt 28

---

## Context

Before committing the new CEW and TWG Results pages, we need to verify code quality by running linting checks. This ensures no lint warnings or errors were introduced in the new files.

---

## Task

### 1. Run Linting Check

Run the linting command:
```bash
npm run lint
```

### 2. Review Warnings and Errors

Review any warnings or errors that appear in the output.

### 3. Fix Issues in New Files

Fix any linting issues found in the following files (if they exist):

- `src/lib/chart_data.ts`
- `src/components/charts/ReportBarChart.tsx`
- `src/components/charts/ReportGroupedBarChart.tsx`
- `src/components/charts/ReportWordCloudChart.tsx`
- `src/app/(dashboard)/cew-results/page.tsx`
- `src/app/(dashboard)/twg-results/page.tsx`
- `src/components/charts/CEWMatrixChart.tsx` (if created)
- `src/components/header/menuConfig.ts`

---

## Critical Requirements

1. **NO new lint warnings or errors should be introduced**
   - All new files must pass linting
   - Any existing warnings in new files must be fixed

2. **Fix only issues in files we created/modified**
   - Do NOT fix lint issues in unrelated files
   - Follow "if it ain't broke" principle

3. **Use file-based tools when possible**
   - Prefer `read_lints` tool over running `npm run lint` in terminal
   - See `SAFE_CONTINUATION_AFTER_TESTS.md` for guidance on avoiding terminal command crashes

---

## Reference

See `docs/AGENTS.md` Section 9 for linting standards and best practices.

---

## Expected Result

- ✅ Linting passes with zero warnings/errors in new files
- ✅ All new code follows project linting standards
- ✅ No regressions introduced

---

## Next Steps

After linting passes, proceed to:
- **Prompt 30:** Run TypeScript Build Verification
- **Prompt 31:** Manual Testing Checklist
- **Prompt 32:** Git Commit Verification

---

## Notes

- If linting fails, fix all issues before proceeding
- Do not skip linting - it's critical for code quality
- Use `read_lints` tool to check specific files if needed

