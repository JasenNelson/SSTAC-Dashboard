# Prompt 31: Manual Testing Checklist

**Date:** November 2025  
**Context:** Manual testing of both CEW and TWG Results pages before committing.  
**Status:** Ready to execute after Prompt 30

---

## Context

Before committing, we need to manually test both pages to ensure all functionality works correctly, all charts display properly, and the UI is responsive and accessible.

---

## Task

Test the following on both `/cew-results` and `/twg-results` pages.

---

## Testing Checklist

### CEW Results Page (`/cew-results`)

#### Basic Functionality
- [ ] Page loads without errors
- [ ] All sections display correctly
- [ ] No console errors in browser

#### Charts Display
- [ ] All charts (G-1 through G-18) display correctly
- [ ] Matrix charts (G-19-23) display correctly (if data available)
- [ ] Charts are interactive (if applicable)
- [ ] Chart data is accurate

#### Visual Design
- [ ] Light mode: Page background is light gray (`bg-gray-100`), containers are white (visible contrast)
- [ ] Dark mode: Page background is dark (`bg-gray-900`), containers are grey (good contrast)
- [ ] Text is readable in both themes
- [ ] Colors are consistent and accessible

#### Components
- [ ] Metrics section displays correctly
- [ ] All sections are properly formatted
- [ ] Spacing and layout are correct

#### Navigation
- [ ] Navigation works from header menu
- [ ] "CEW Session Results" link appears in menu
- [ ] Link navigates to correct page

#### Responsive Design
- [ ] Mobile view works correctly
- [ ] Tablet view works correctly
- [ ] Desktop view works correctly
- [ ] Charts are responsive and readable on all screen sizes

---

### TWG Results Page (`/twg-results`)

#### Basic Functionality
- [ ] Page loads without errors
- [ ] All sections display correctly
- [ ] No console errors in browser

#### Charts Display
- [ ] All charts (J-1 through J-10) display correctly
- [ ] J-2 grouped bar chart displays correctly
- [ ] Charts are interactive (if applicable)
- [ ] Chart data is accurate

#### Visual Design
- [ ] Light mode: Page background is light gray (`bg-gray-100`), containers are white (visible contrast)
- [ ] Dark mode: Page background is dark (`bg-gray-900`), containers are grey (good contrast)
- [ ] Text is readable in both themes
- [ ] Colors are consistent and accessible

#### Content Structure
- [ ] Section 1.0 is consolidated (one container, compressed content)
- [ ] Section 2.1 is compressed (concise)
- [ ] All sections are properly formatted

#### Navigation
- [ ] Navigation works from header menu
- [ ] "TWG Results" link appears in menu (not "TWG Review Results")
- [ ] Link navigates to correct page

#### Responsive Design
- [ ] Mobile view works correctly
- [ ] Tablet view works correctly
- [ ] Desktop view works correctly
- [ ] Charts are responsive and readable on all screen sizes

---

### Navigation

- [ ] "CEW Session Results" link appears in menu
- [ ] "TWG Results" link appears in menu (not "TWG Review Results")
- [ ] Both links navigate to correct pages
- [ ] Menu items are in correct order

---

### General

- [ ] Authentication redirects work (unauthenticated users redirected to login)
- [ ] No broken imports or missing files
- [ ] All images/charts load correctly
- [ ] No 404 errors in network tab
- [ ] Page performance is acceptable

---

## Critical Requirements

1. **Test in both light and dark modes**
   - Verify contrast is good in both themes
   - Verify text is readable in both themes

2. **Test on different screen sizes**
   - Mobile (320px - 768px)
   - Tablet (768px - 1024px)
   - Desktop (1024px+)

3. **Verify all functionality works**
   - All charts display
   - All navigation works
   - All sections render correctly

4. **Document any issues found**
   - Note any bugs or issues
   - Note any visual inconsistencies
   - Note any performance issues

---

## Expected Result

- ✅ All checklist items pass
- ✅ No console errors
- ✅ All charts display correctly
- ✅ UI is responsive and accessible
- ✅ Both themes work correctly

---

## Next Steps

After manual testing passes, proceed to:
- **Prompt 32:** Git Commit Verification (CRITICAL)

---

## Notes

- Take screenshots if issues are found
- Document any issues in detail
- Do not proceed to commit if critical issues are found
- Fix any issues before proceeding to Prompt 32

