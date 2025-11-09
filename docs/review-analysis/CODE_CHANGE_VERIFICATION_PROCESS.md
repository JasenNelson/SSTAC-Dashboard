# Code Change Verification Process

**Purpose:** Ensure code changes don't impact features and functions they relate to  
**Status:** Active Process  
**Last Updated:** 2025-11-06

---

## 🎯 Overview

This process provides a systematic approach to verify that code changes don't break existing functionality. It includes automated checks, manual testing procedures, and feature-specific verification checklists.

---

## 📋 Pre-Change Checklist

Before making any code changes:

- [ ] **Identify affected features** - List all features/functions that use the code being changed
- [ ] **Review dependencies** - Check what other code depends on the files being modified
- [ ] **Check exclusion list** - Verify changes don't touch poll-related files
- [ ] **Create test plan** - Document how you'll verify the changes work
- [ ] **Backup current state** - Ensure you can rollback if needed

---

## 🔍 Automated Verification Steps

### 1. **Build Verification**
```bash
npm run build
```
**Expected:** Build succeeds with no errors  
**Action if fails:** Fix build errors before proceeding

### 2. **Linting Check**
```bash
npm run lint
```
**Expected:** No new linting errors introduced  
**Action if fails:** Fix linting issues or document why they're acceptable

### 3. **Type Checking**
```bash
npx tsc --noEmit
```
**Expected:** No TypeScript errors  
**Action if fails:** Fix type errors

### 4. **Unit Tests**
```bash
npm run test:unit
```
**Expected:** All existing tests pass (122 tests)  
**Action if fails:** Fix broken tests or update tests if behavior intentionally changed

### 5. **E2E Tests**
```bash
npm run test:e2e
```
**Expected:** All E2E tests pass  
**Action if fails:** Investigate and fix E2E test failures

---

## 🧪 Manual Testing Procedures

### **Step 1: Identify Affected Features**

For each file changed, identify related features:

#### **Admin Pages** (`src/app/(dashboard)/admin/*`)
- [ ] Admin dashboard loads correctly
- [ ] Admin badge appears for admin users
- [ ] Admin badge persists after operations
- [ ] User management functions work
- [ ] Tag management functions work
- [ ] Announcement management functions work
- [ ] Milestone management functions work
- [ ] Navigation between admin pages works

#### **TWG Pages** (`src/app/(dashboard)/twg/*`)
- [ ] Discussion forum loads and displays discussions
- [ ] Users can create new discussions
- [ ] Users can reply to discussions
- [ ] Like functionality works
- [ ] Document list displays correctly
- [ ] Document upload works
- [ ] Document edit works
- [ ] Document view works
- [ ] TWG Review page loads correctly

#### **Dashboard Pages** (`src/app/(dashboard)/dashboard/*`)
- [ ] Main dashboard loads
- [ ] Announcements display correctly
- [ ] Navigation works
- [ ] Theme switching works (dark/light mode)

#### **API Routes** (`src/app/api/*`)
- [ ] API endpoints respond correctly
- [ ] Authentication works
- [ ] Authorization checks work
- [ ] Rate limiting works (if applicable)
- [ ] Input validation works
- [ ] Error handling works

#### **Components** (`src/components/*`)
- [ ] Component renders correctly
- [ ] Component props work as expected
- [ ] Component state management works
- [ ] Component interactions work
- [ ] Component styling is correct

#### **Utilities** (`src/lib/*`)
- [ ] Utility functions work correctly
- [ ] Utility functions handle edge cases
- [ ] Utility functions return expected types
- [ ] Utility functions are used correctly by callers

---

### **Step 2: Feature-Specific Testing**

#### **Admin Features Testing**

**User Management:**
1. Navigate to `/admin/users`
2. Verify user list displays
3. Verify user emails are visible
4. Test role promotion (member → admin)
5. Test role demotion (admin → member)
6. Verify admin badge appears/disappears correctly

**Tag Management:**
1. Navigate to `/admin/tags`
2. Create a new tag
3. Edit an existing tag
4. Delete a tag
5. Verify tags appear in document tagging

**Announcement Management:**
1. Navigate to `/admin/announcements`
2. Create a new announcement
3. Edit an existing announcement
4. Delete an announcement
5. Verify announcements appear on dashboard
6. Test priority levels (low, medium, high)
7. Test active/inactive status

**Milestone Management:**
1. Navigate to `/admin/milestones`
2. Create a new milestone
3. Edit an existing milestone
4. Delete a milestone
5. Test status changes (pending, in_progress, completed, delayed)
6. Test priority levels

#### **TWG Features Testing**

**Discussion Forum:**
1. Navigate to `/twg/discussions`
2. View discussion list
3. Create a new discussion
4. Reply to a discussion
5. Like/unlike discussions and replies
6. Verify user attribution works
7. Test pagination (if applicable)

**Document Management:**
1. Navigate to `/twg/documents`
2. View document list
3. Upload a new document
4. Edit an existing document
5. View document details
6. Test document tagging
7. Verify file URLs work

**TWG Review:**
1. Navigate to `/twg/review`
2. Verify page loads for authenticated users
3. Test form submissions
4. Verify file uploads work

#### **Authentication & Authorization Testing**

**Authentication:**
1. Test login with valid credentials
2. Test login with invalid credentials
3. Test logout functionality
4. Test session persistence
5. Test redirect after login

**Authorization:**
1. Test admin-only pages (require admin role)
2. Test authenticated-only pages (require login)
3. Test unauthorized access attempts
4. Verify proper error messages

---

### **Step 3: Regression Testing**

**Critical Paths to Test:**
1. **User Journey - Admin:**
   - Login → Admin Dashboard → User Management → Create/Edit/Delete → Verify changes persist

2. **User Journey - Member:**
   - Login → Dashboard → Discussions → Create Discussion → Reply → Like

3. **User Journey - Document Management:**
   - Login → Documents → Upload → Edit → View → Tag

4. **User Journey - TWG Review:**
   - Login → TWG Review → Submit Form → Verify submission

---

## 🚫 Critical Exclusions - Never Test These During Poll-Safe Work

**DO NOT test these areas** (to avoid impacting active polling):
- ❌ Poll components (PollWithResults, RankingPoll, WordCloudPoll)
- ❌ Poll API routes (`/api/polls/*`, `/api/ranking-polls/*`, `/api/wordcloud-polls/*`)
- ❌ Survey-results pages (`/survey-results/*`)
- ❌ CEW poll pages (`/cew-polls/*`)
- ❌ Admin poll results pages (`/admin/poll-results`)
- ❌ Matrix graph API routes (`/api/graphs/prioritization-matrix`)

**Note:** These areas are excluded to ensure poll functionality remains untouched during active polling periods.

---

## 📊 Change Impact Matrix

Use this matrix to identify what needs testing based on what you changed:

| Changed Area | Test These Features |
|:------------|:-------------------|
| `src/app/(dashboard)/admin/*` | All admin management features, admin badge persistence |
| `src/app/(dashboard)/twg/discussions/*` | Discussion forum, likes, replies |
| `src/app/(dashboard)/twg/documents/*` | Document management, upload, edit, view |
| `src/app/(dashboard)/twg/review/*` | TWG Review form, submissions |
| `src/app/api/admin/*` | Admin API endpoints, authentication, authorization |
| `src/app/api/discussions/*` | Discussion API endpoints |
| `src/app/api/documents/*` | Document API endpoints |
| `src/components/dashboard/*` | Component rendering, interactions, styling |
| `src/lib/*` | Utility functions, validation, logging |
| `src/middleware.ts` | Authentication, authorization, redirects |
| `src/lib/validation-schemas.ts` | All API endpoints using validation |
| `src/lib/logger.ts` | All operations using logging |
| `src/lib/rate-limit.ts` | All API endpoints with rate limiting |

---

## ✅ Post-Change Verification Checklist

After making changes:

- [ ] **Build succeeds** - `npm run build` completes without errors
- [ ] **Linting passes** - No new linting errors
- [ ] **Type checking passes** - No TypeScript errors
- [ ] **Unit tests pass** - All 122 tests pass
- [ ] **E2E tests pass** - All E2E tests pass
- [ ] **Manual testing complete** - All affected features tested
- [ ] **No poll impact** - Verified no poll-related files touched
- [ ] **Documentation updated** - Updated relevant docs if needed
- [ ] **Code review** - Changes reviewed for correctness

---

## 🔄 Continuous Verification

### **During Development:**
- Run build after significant changes
- Run tests frequently
- Test affected features as you develop

### **Before Committing:**
- Run full test suite
- Verify build succeeds
- Test critical affected features manually

### **After Committing:**
- Monitor CI/CD pipeline
- Check for any test failures
- Verify deployment succeeds

---

## 📝 Testing Log Template

Use this template to document your testing:

```markdown
## Change Summary
**Date:** YYYY-MM-DD
**Files Changed:** 
- file1.ts
- file2.tsx

**Features Affected:**
- Feature 1
- Feature 2

## Testing Performed

### Automated Tests
- [ ] Build: ✅ Pass / ❌ Fail
- [ ] Linting: ✅ Pass / ❌ Fail
- [ ] Type Check: ✅ Pass / ❌ Fail
- [ ] Unit Tests: ✅ Pass / ❌ Fail (X/X tests)
- [ ] E2E Tests: ✅ Pass / ❌ Fail

### Manual Testing
- [ ] Feature 1: ✅ Pass / ❌ Fail
  - Test case 1: ✅
  - Test case 2: ✅
- [ ] Feature 2: ✅ Pass / ❌ Fail
  - Test case 1: ✅
  - Test case 2: ✅

### Issues Found
- Issue 1: Description and resolution
- Issue 2: Description and resolution

### Verification
- [ ] No poll-related files touched
- [ ] All affected features work correctly
- [ ] No regressions introduced
```

---

## 🎯 Quick Reference: Common Change Types

### **Code Cleanup (Removal Only)**
- ✅ Low risk - removal only
- ✅ Test: Build, linting, affected features
- ⏱️ Time: 15-30 minutes

### **Bug Fixes**
- ⚠️ Medium risk - logic changes
- ✅ Test: Build, all tests, affected features, regression testing
- ⏱️ Time: 30-60 minutes

### **New Features**
- ⚠️ Medium-High risk - new code
- ✅ Test: Build, all tests, new feature, integration with existing features
- ⏱️ Time: 60-120 minutes

### **Refactoring**
- ⚠️ High risk - structural changes
- ✅ Test: Build, all tests, all affected features, comprehensive regression testing
- ⏱️ Time: 120+ minutes

---

## 🚨 Red Flags - Stop and Review

If you encounter any of these, **stop and review** before proceeding:

1. **Build failures** - Don't commit broken builds
2. **Test failures** - Investigate why tests are failing
3. **Type errors** - Fix type issues before proceeding
4. **Poll-related files touched** - Verify this was intentional
5. **Unexpected behavior** - Test thoroughly before committing
6. **Breaking changes** - Document and communicate breaking changes

---

## 🐛 Troubleshooting Verification Scripts

### **Common Issues**

#### **PowerShell Script Errors**
If the PowerShell script (`verify-code-changes.ps1`) fails to detect command failures:

**Problem:** Exit codes from npm/npx commands may not be captured correctly.

**Solution:** The script has been updated to:
- Properly check `$LASTEXITCODE` after command execution
- Fall back to checking output for error patterns if exit code is unavailable
- Display error output when commands fail

#### **Bash Script Errors**
If the bash script (`verify-code-changes.sh`) exits immediately:

**Problem:** `set -e` can cause premature exits.

**Solution:** The script has been updated to:
- Remove `set -e` to allow proper error checking
- Use proper exit code checking with `if command; then` pattern
- Track failures and report summary at the end

#### **Dev Server Cache Issues**
If you encounter Turbopack cache corruption errors:

**Error:** `Cannot find module './build/chunks/[turbopack]_runtime.js'`

**Solution:**
```powershell
# Stop the dev server (Ctrl+C)
Remove-Item -Recurse -Force .next
npm run dev
```

This is a Next.js/Turbopack build cache issue, not related to code changes.

---

## 📚 Related Documentation

- **Poll-Safe Improvements:** `docs/review-analysis/POLL_SAFE_IMPROVEMENTS.md`
- **Exclusion List:** `docs/review-analysis/POLL_SAFE_IMPROVEMENTS.md` → Critical Exclusions
- **Testing Infrastructure:** `docs/testing/README.md`
- **Development Guidelines:** `docs/AGENTS.md`
- **Recent Verification:** `docs/review-analysis/CODE_CLEANUP_VERIFICATION.md` - November 6, 2025 code cleanup verification (✅ Complete)

---

## 🔄 Process Improvement

This process should be updated based on:
- New features added
- New testing tools introduced
- Lessons learned from issues
- Changes to project structure

**Review Frequency:** Monthly or after significant changes

---

**Last Updated:** 2025-11-06  
**Next Review:** 2025-12-06

**Recent Verification:** November 6, 2025 - Code cleanup changes verified (4 files, 12 console.log statements removed). All features tested and working correctly. See `CODE_CLEANUP_VERIFICATION.md` for details.

