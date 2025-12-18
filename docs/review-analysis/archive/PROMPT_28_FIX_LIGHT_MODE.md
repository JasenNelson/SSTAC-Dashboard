# Prompt 28: Fix Light Mode Background Contrast (Final Fix)

**Date:** November 2025  
**Context:** Fixing light mode background contrast issue on both CEW and TWG Results pages.  
**Status:** Ready to execute

---

## Context

The light mode page background needs better contrast with white containers. Currently using `bg-gray-50` which is too light and doesn't provide visible contrast.

---

## Task

### 1. Update CEW Results Page

**File:** `src/app/(dashboard)/cew-results/page.tsx`

**Change:**
- Find line ~40: `<div className="min-h-screen bg-gray-50 dark:bg-gray-900">`
- Change to: `<div className="min-h-screen bg-gray-100 dark:bg-gray-900">`

### 2. Update TWG Results Page

**File:** `src/app/(dashboard)/twg-results/page.tsx`

**Change:**
- Find line ~37: `<div className="min-h-screen bg-gray-50 dark:bg-gray-900">`
- Change to: `<div className="min-h-screen bg-gray-100 dark:bg-gray-900">`

---

## Expected Result

- Light mode page background is now `bg-gray-100` (visible light gray)
- White containers (`bg-white`) now have visible contrast against the page background
- Dark mode remains unchanged (`dark:bg-gray-900`)
- Both pages have consistent styling

---

## Verification

After making changes:
1. Test in light mode - verify page background is light gray
2. Test in dark mode - verify page background is dark
3. Verify white containers are visible against light gray background
4. Check both `/cew-results` and `/twg-results` pages

---

## Next Steps

After this fix is complete, proceed to:
- **Prompt 29:** Run Linting Checks
- **Prompt 30:** Run TypeScript Build Verification
- **Prompt 31:** Manual Testing Checklist
- **Prompt 32:** Git Commit Verification

