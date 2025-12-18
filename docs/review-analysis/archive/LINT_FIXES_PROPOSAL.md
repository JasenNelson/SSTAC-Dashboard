# Linting Warnings Fix Proposal - PollResultsClient.tsx

**Date:** December 2025  
**File:** `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx`  
**Status:** Proposal - Ready for Review

---

## Identified Issues

### 1. `react-hooks/exhaustive-deps` Warning
**Location:** Line 123-125  
**Issue:** `useEffect` calls `fetchPollResults()` but it's not in the dependency array  
**Current Code:**
```typescript
useEffect(() => {
  fetchPollResults();
}, []);
```

**Analysis:** 
- The empty dependency array `[]` is intentional (run once on mount)
- However, ESLint warns because `fetchPollResults` is referenced but not listed
- `fetchPollResults` is defined as a regular function (not `useCallback`), so it's recreated on every render

**Proposed Fix:**
Wrap `fetchPollResults` in `useCallback` to stabilize the function reference:

```typescript
const fetchPollResults = useCallback(async () => {
  // ... existing function body ...
}, []); // Empty deps - function doesn't depend on any props/state

useEffect(() => {
  fetchPollResults();
}, [fetchPollResults]); // Now safe to include in deps
```

**Why This is Safe:**
- No business logic changes
- Function behavior remains identical
- Only stabilizes the function reference
- Prevents unnecessary re-renders if function is passed to child components

---

### 2. Potential `unused-vars` Warnings
**Location:** Various  
**Issue:** Unused variables in destructuring or function parameters

**Proposed Fix:**
Review and remove truly unused variables, or prefix with `_` if they're intentionally unused (e.g., error handlers that are logged but not used).

---

## Implementation Steps

1. **Import `useCallback`:**
   ```typescript
   import React, { useState, useEffect, useMemo, useCallback } from 'react';
   ```

2. **Wrap `fetchPollResults` in `useCallback`:**
   - Move function definition before the `useEffect` that uses it
   - Wrap with `useCallback` and empty dependency array
   - Update `useEffect` dependency array to include `fetchPollResults`

3. **Verify:**
   - Run `npm run lint` to confirm warnings are resolved
   - Test admin poll-results page functionality
   - Verify no regressions in high-traffic component

---

## Safety Considerations

✅ **No Business Logic Changes** - Only function reference stabilization  
✅ **Backward Compatible** - Function behavior unchanged  
✅ **Performance Neutral/Positive** - Prevents unnecessary re-renders  
✅ **Type Safe** - No TypeScript changes needed  

---

## Testing Checklist

- [ ] Admin poll-results page loads correctly
- [ ] Poll data fetches on mount
- [ ] Refresh button works
- [ ] Filter modes work correctly
- [ ] Matrix graphs display correctly
- [ ] No console errors
- [ ] Lint warnings resolved

---

**Note:** This is a high-traffic component. All changes must be tested thoroughly before deployment.
