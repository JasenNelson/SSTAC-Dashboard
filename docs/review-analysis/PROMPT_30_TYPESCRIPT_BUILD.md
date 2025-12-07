# Prompt 30: Run TypeScript Build Verification

**Date:** November 2025  
**Context:** Verifying TypeScript compilation succeeds before committing CEW and TWG Results pages.  
**Status:** Ready to execute after Prompt 29

---

## Context

Before committing, we need to verify that TypeScript compilation succeeds. This ensures all types are correct and there are no type errors in the new code.

---

## Task

### 1. Run Production Build

Run the production build command:
```bash
npm run build
```

### 2. Check for TypeScript Errors

Review the build output for any TypeScript errors or warnings.

### 3. Fix Type Errors

If any TypeScript errors are found in the new files, fix them:
- `src/lib/chart_data.ts`
- `src/components/charts/ReportBarChart.tsx`
- `src/components/charts/ReportGroupedBarChart.tsx`
- `src/components/charts/ReportWordCloudChart.tsx`
- `src/app/(dashboard)/cew-results/page.tsx`
- `src/app/(dashboard)/twg-results/page.tsx`
- `src/components/charts/CEWMatrixChart.tsx` (if created)

### 4. Verify Build Completes Successfully

Ensure the build completes with exit code 0 (success).

---

## Critical Requirements

1. **Build must succeed with exit code 0**
   - No TypeScript compilation errors allowed
   - Build must complete successfully

2. **Fix any TypeScript errors in files we created/modified**
   - Only fix errors in new/modified files
   - Do not introduce `any` types as a workaround

3. **Ensure all imports are correct**
   - Verify all imports resolve correctly
   - Check for missing type definitions

4. **Do NOT introduce `any` types**
   - Use proper TypeScript types
   - Use `unknown` if type is truly unknown, then narrow it

---

## Expected Result

- ✅ Build completes successfully (exit code 0)
- ✅ No TypeScript errors in new files
- ✅ All types are properly defined
- ✅ All imports resolve correctly

---

## Notes

- If build produces warnings, they should be addressed
- Only proceed if build succeeds
- Use `read_lints` tool to check TypeScript errors in specific files if needed
- See `SAFE_CONTINUATION_AFTER_TESTS.md` for guidance on avoiding terminal command crashes

---

## Next Steps

After build succeeds, proceed to:
- **Prompt 31:** Manual Testing Checklist
- **Prompt 32:** Git Commit Verification

---

## Reference

- See `docs/AGENTS.md` for TypeScript standards
- See `SAFE_CONTINUATION_AFTER_TESTS.md` for safe command execution guidance

