# Prompts 29–30: Linting + TypeScript Build Verification

**Date:** November 2025  
**Context:** Verifying code quality before committing CEW and TWG Results pages.  
**Status:** Historical prompt bundle (kept for repeatable process).

---

## Context

Before committing, we need to verify:

- **Linting** passes (no new warnings/errors introduced)
- **TypeScript compilation / production build** succeeds

---

## Task

### 1) Run linting

```bash
npm run lint
```

- Review any warnings/errors in the output.
- Fix lint issues **only** in files you created/modified for the change.

Common files for this historical change:

- `src/lib/chart_data.ts`
- `src/components/charts/ReportBarChart.tsx`
- `src/components/charts/ReportGroupedBarChart.tsx`
- `src/components/charts/ReportWordCloudChart.tsx`
- `src/app/(dashboard)/cew-results/page.tsx`
- `src/app/(dashboard)/twg-results/page.tsx`
- `src/components/charts/CEWMatrixChart.tsx` (if created)
- `src/components/header/menuConfig.ts`

### 2) Run production build (TypeScript verification)

```bash
npm run build
```

- Review the build output for any TypeScript errors/warnings.
- Fix type errors **only** in files you created/modified.
- Do **not** introduce `any` as a workaround (use real types; use `unknown` only when necessary and narrow).

---

## Critical requirements

1. **No new lint warnings/errors introduced**
   - New/modified files must pass linting

2. **Build must succeed (exit code 0)**
   - No TypeScript compilation errors

3. **Fix only what you touched**
   - Follow the “if it ain’t broke, don’t fix it” principle

---

## Expected result

- ✅ `npm run lint` passes with zero warnings/errors in new/modified files
- ✅ `npm run build` completes successfully (exit code 0)
- ✅ No regressions introduced

---

## Reference

- `docs/AGENTS.md` (linting + TypeScript build safety)
- `docs/review-analysis/CODE_CHANGE_VERIFICATION_PROCESS.md` (broader verification checklist)

---

## Next steps (historical sequence)

After lint/build verification, proceed to:

- **Prompt 31:** Manual Testing Checklist
- **Prompt 32:** Git Commit Verification
