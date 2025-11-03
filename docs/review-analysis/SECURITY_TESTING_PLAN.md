# Security Testing Plan for Non-Poll APIs

**Status:** 📋 **PLANNING DOCUMENT**  
**Last Updated:** 2025-01-31  
**Scope:** Admin and user management APIs (excludes all poll-related APIs)

---

## 🎯 Objective

Implement comprehensive security testing following OWASP Top 10 guidelines for non-poll admin and user management APIs. This ensures robust security without impacting active poll participation functionality.

---

## 🚫 Excluded APIs (Poll-Safe Approach)

**NEVER test these APIs** - they are actively used for poll participation:
- ❌ `/api/polls/**` (submit, results)
- ❌ `/api/ranking-polls/**` (submit, results)
- ❌ `/api/wordcloud-polls/**` (submit, results)
- ❌ `/api/graphs/prioritization-matrix/**`
- ❌ All survey-results and CEW poll pages

---

## ✅ Included APIs for Testing

### **Admin User Management APIs**
- `src/app/(dashboard)/admin/users/actions.ts`
  - `getUsers()` - User listing
  - `toggleAdminRole()` - Role management
  - `addUserRole()` - Role assignment

### **Admin Content Management APIs**
- `src/app/(dashboard)/admin/tags/actions.ts`
  - `createTag()` - Tag creation
  - `updateTag()` - Tag updates
  - `deleteTag()` - Tag deletion

- `src/app/(dashboard)/admin/announcements/actions.ts`
  - Announcement CRUD operations

- `src/app/(dashboard)/admin/milestones/actions.ts`
  - Milestone CRUD operations

### **Document Management APIs**
- `src/app/(dashboard)/twg/documents/actions.ts`
  - `addDocument()` - Document creation
  - Document management operations

### **Discussion Forum APIs**
- Discussion creation and management
- Reply management
- Like functionality

---

## 🔒 OWASP Top 10 Security Testing Checklist

### **A01:2021 – Broken Access Control**

**Test Cases:**
- [ ] Verify non-admin users cannot access admin APIs
- [ ] Verify users cannot modify other users' roles
- [ ] Verify users cannot access admin-only endpoints
- [ ] Test direct URL access to admin pages without authentication
- [ ] Test role escalation attempts
- [ ] Verify session timeout and re-authentication requirements

**Implementation:**
- Test `getUsers()` with non-admin user
- Test `toggleAdminRole()` with non-admin user
- Test admin actions without authentication
- Verify redirects to `/login` and `/dashboard` work correctly

---

### **A02:2021 – Cryptographic Failures**

**Test Cases:**
- [ ] Verify sensitive data is not logged in plain text
- [ ] Verify passwords are never exposed
- [ ] Verify API keys are not exposed in responses
- [ ] Check for hardcoded secrets in code

**Implementation:**
- Review server actions for console.log statements with sensitive data
- Verify environment variables are not exposed
- Check for accidental credential exposure in error messages

---

### **A03:2021 – Injection**

**Test Cases:**
- [ ] SQL injection in user inputs (names, emails, descriptions)
- [ ] XSS in form inputs
- [ ] Command injection (if applicable)
- [ ] Test special characters and SQL escape sequences

**Implementation:**
```typescript
// Test cases for injection
const injectionTests = [
  "'; DROP TABLE users; --",
  "<script>alert('XSS')</script>",
  "'; INSERT INTO user_roles VALUES ('attacker', 'admin'); --",
  "1' OR '1'='1",
];
```

**Files to Test:**
- Tag name inputs
- Announcement content
- Milestone descriptions
- Document titles/descriptions
- User email inputs

---

### **A04:2021 – Insecure Design**

**Test Cases:**
- [ ] Verify authentication is required for all admin operations
- [ ] Verify role checks happen server-side, not client-side
- [ ] Verify CSRF protection is in place
- [ ] Check for predictable user IDs or tokens

**Implementation:**
- Review server actions for client-side role checks
- Verify all admin operations use server actions
- Check for UUID usage (not sequential IDs)

---

### **A05:2021 – Security Misconfiguration**

**Test Cases:**
- [ ] Verify error messages don't expose system information
- [ ] Verify debug mode is disabled in production
- [ ] Check CORS configuration
- [ ] Verify security headers are set
- [ ] Check for default credentials

**Implementation:**
- Review error handling in server actions
- Verify `NODE_ENV` checks for development-only features
- Check middleware for security headers

---

### **A06:2021 – Vulnerable and Outdated Components**

**Test Cases:**
- [ ] Run `npm audit` to check for known vulnerabilities
- [ ] Verify dependencies are up to date
- [ ] Check for known security advisories

**Implementation:**
- Already completed: `npm audit` found 1 moderate vulnerability in Next.js 15.4.6
- Document decision on Next.js update (minor version update requires review)

---

### **A07:2021 – Identification and Authentication Failures**

**Test Cases:**
- [ ] Test session fixation
- [ ] Test session hijacking
- [ ] Verify password requirements (if applicable)
- [ ] Test account enumeration
- [ ] Verify rate limiting on authentication endpoints

**Implementation:**
- Review authentication flow in middleware
- Test session management
- Verify Supabase auth is properly configured

---

### **A08:2021 – Software and Data Integrity Failures**

**Test Cases:**
- [ ] Verify package integrity (package-lock.json)
- [ ] Check for unsigned dependencies
- [ ] Verify CI/CD pipeline security

**Implementation:**
- Review package.json and package-lock.json
- Verify dependency sources

---

### **A09:2021 – Security Logging and Monitoring Failures**

**Test Cases:**
- [ ] Verify security events are logged
- [ ] Check for audit trails on admin actions
- [ ] Verify error logging doesn't expose sensitive data

**Implementation:**
- Review error handling in server actions
- Check for structured logging
- Verify Sentry integration (already implemented)

---

### **A10:2021 – Server-Side Request Forgery (SSRF)**

**Test Cases:**
- [ ] Test file URL inputs for SSRF
- [ ] Verify external URL validation
- [ ] Check for internal network access

**Implementation:**
- Test `addDocument()` with malicious file URLs
- Verify URL validation for document uploads

---

## 🧪 Test Implementation Strategy

### **Phase 1: Manual Testing** (Immediate)
1. Manual security testing of admin APIs
2. Document findings
3. Create test cases based on findings

### **Phase 2: Automated Testing** (Future)
1. Create automated security test suite
2. Integrate into CI/CD pipeline
3. Run tests on every deployment

---

## 📋 Test Execution Checklist

### **Before Testing:**
- [ ] Set up test environment
- [ ] Create test admin user
- [ ] Create test non-admin user
- [ ] Document current security measures

### **During Testing:**
- [ ] Execute OWASP Top 10 test cases
- [ ] Document all findings
- [ ] Prioritize vulnerabilities (Critical, High, Medium, Low)
- [ ] Test fixes before deployment

### **After Testing:**
- [ ] Create security report
- [ ] Document remediation actions
- [ ] Update security documentation
- [ ] Schedule follow-up testing

---

## 🎯 Priority Test Areas

### **High Priority:**
1. **Authentication & Authorization** (A01, A04)
   - Admin role checks
   - Access control validation

2. **Input Validation** (A03)
   - SQL injection prevention
   - XSS prevention
   - Input sanitization

3. **Error Handling** (A05, A09)
   - Error message sanitization
   - Information disclosure prevention

### **Medium Priority:**
4. **Session Management** (A07)
   - Session security
   - Authentication failures

5. **Dependency Security** (A06)
   - npm audit results
   - Known vulnerabilities

### **Low Priority:**
6. **Logging & Monitoring** (A09)
   - Security event logging
   - Audit trails

---

## 📊 Expected Outcomes

### **Security Improvements:**
- ✅ Comprehensive security testing of admin APIs
- ✅ Identification of potential vulnerabilities
- ✅ Remediation plan for found issues
- ✅ Security best practices documentation

### **Code Quality Improvements:**
- ✅ Better error handling
- ✅ Improved input validation
- ✅ Enhanced security logging

---

## 🔄 Maintenance

### **Regular Security Testing:**
- Monthly security review
- Quarterly comprehensive testing
- Annual penetration testing (optional)

### **Continuous Monitoring:**
- npm audit on dependency updates
- Security advisory monitoring
- Regular dependency updates

---

## 📝 Notes

- **Poll-Safe Approach:** All testing excludes poll APIs to prevent impact on active users
- **Server Actions:** Testing focuses on Next.js server actions which handle authentication
- **Supabase RLS:** Database security is handled by Row Level Security policies
- **Existing Security:** Current implementation includes authentication, role checks, and RLS

---

## ✅ Next Steps

1. **Create Test Environment**
   - Set up test database
   - Create test users
   - Configure test credentials

2. **Begin Manual Testing**
   - Start with high-priority areas
   - Document findings
   - Create test cases

3. **Implement Fixes**
   - Address critical issues immediately
   - Plan medium/low priority fixes
   - Update documentation

---

**This plan provides a comprehensive security testing framework while maintaining the poll-safe approach to avoid impacting active poll participation.**

