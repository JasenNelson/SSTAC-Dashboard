# GitHub Issues Generation Template

This file contains templates and instructions for creating GitHub issues for the A+ upgrade project.

## Automated Issue Creation Script

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated with `project` and `read:project` scopes
- Repository context: `JasenNelson/SSTAC-Dashboard`

```bash
#!/bin/bash
# Create all GitHub issues for A+ upgrade

REPO="JasenNelson/SSTAC-Dashboard"

# Phase 0: Infrastructure
gh issue create --repo $REPO \
  --title "Phase 0.1: Create GitHub Project Board" \
  --body "Create GitHub project for upgrade tracking with columns: Backlog, Ready, In Progress, In Review, Testing, Complete, Blocked" \
  --label "phase-0-infrastructure" \
  --milestone "Phase 0: Infrastructure Setup"

gh issue create --repo $REPO \
  --title "Phase 0.2: Generate GitHub Issues" \
  --body "Create 100+ issues for all 7 phases with proper labeling and dependencies" \
  --label "phase-0-infrastructure" \
  --milestone "Phase 0: Infrastructure Setup"

gh issue create --repo $REPO \
  --title "Phase 0.3: Create Tracking Documentation" \
  --body "Create UPGRADE_TRACKING.md and PHASE_CHECKLIST.md for progress tracking" \
  --label "phase-0-infrastructure" \
  --milestone "Phase 0: Infrastructure Setup"

gh issue create --repo $REPO \
  --title "Phase 0.4: Create Visual Roadmap" \
  --body "Create ROADMAP.md with 20-week timeline and visual progress indicators" \
  --label "phase-0-infrastructure" \
  --milestone "Phase 0: Infrastructure Setup"

gh issue create --repo $REPO \
  --title "Phase 0.5: Security Prioritization Setup" \
  --body "Mark security issues as CRITICAL, set up security milestone" \
  --label "phase-0-infrastructure,security-critical" \
  --milestone "Phase 0: Infrastructure Setup"

# Phase 1: Architecture & Type Safety
gh issue create --repo $REPO \
  --title "Phase 1.1: Create Type Safety Foundation" \
  --body "Create src/types/index.ts with all API response types and interfaces" \
  --label "phase-1-architecture" \
  --assignee "JasenNelson" \
  --milestone "Phase 1: Architecture & Type Safety"

gh issue create --repo $REPO \
  --title "Phase 1.2: Generate Supabase Types" \
  --body "Run: npx supabase gen types typescript --local > src/types/database.ts" \
  --label "phase-1-architecture" \
  --milestone "Phase 1: Architecture & Type Safety"

gh issue create --repo $REPO \
  --title "Phase 1.3: Create API Client Layer" \
  --body "Create centralized API client in src/lib/api/ (polls, matrix, reviews)" \
  --label "phase-1-architecture" \
  --milestone "Phase 1: Architecture & Type Safety"

gh issue create --repo $REPO \
  --title "Phase 1.4: Replace any Types" \
  --body "Remove all \`any\` types from components and utilities" \
  --label "phase-1-architecture" \
  --milestone "Phase 1: Architecture & Type Safety"

gh issue create --repo $REPO \
  --title "Phase 1.5: Split PollResultsClient" \
  --body "Break 398-line component into 5 smaller focused components" \
  --label "phase-1-architecture" \
  --milestone "Phase 1: Architecture & Type Safety"

gh issue create --repo $REPO \
  --title "Phase 1.6: Create Data Access Abstraction" \
  --body "Create src/lib/db/queries.ts for all database operations" \
  --label "phase-1-architecture" \
  --milestone "Phase 1: Architecture & Type Safety"

# Phase 2: Security Hardening
gh issue create --repo $REPO \
  --title "Phase 2.1: Fix Critical Vulnerabilities" \
  --body "Fix: localStorage admin bypass, missing auth on public endpoints, tar package" \
  --label "phase-2-security,security-critical" \
  --priority "high" \
  --milestone "Phase 2: Security Hardening"

gh issue create --repo $REPO \
  --title "Phase 2.2: Add Security Headers" \
  --body "Add CSP, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection headers" \
  --label "phase-2-security" \
  --milestone "Phase 2: Security Hardening"

gh issue create --repo $REPO \
  --title "Phase 2.3: File Upload Validation" \
  --body "Implement file type and size validation in upload endpoints" \
  --label "phase-2-security" \
  --milestone "Phase 2: Security Hardening"

gh issue create --repo $REPO \
  --title "Phase 2.4: Redis Rate Limiting" \
  --body "Migrate from in-memory to Upstash Redis for rate limiting" \
  --label "phase-2-security" \
  --milestone "Phase 2: Security Hardening"

gh issue create --repo $REPO \
  --title "Phase 2.5: Fix User ID Generation" \
  --body "Replace timestamp-based ID generation with cryptographic random bytes" \
  --label "phase-2-security" \
  --milestone "Phase 2: Security Hardening"

gh issue create --repo $REPO \
  --title "Phase 2.6: Add Antivirus Scanning" \
  --body "Optional: Integrate ClamAV or Yara for file scanning" \
  --label "phase-2-security" \
  --milestone "Phase 2: Security Hardening"

# Phase 3: Comprehensive Testing
gh issue create --repo $REPO \
  --title "Phase 3: Comprehensive Testing" \
  --body "Add unit, integration, E2E tests to achieve 80%+ coverage" \
  --label "phase-3-testing" \
  --milestone "Phase 3: Comprehensive Testing"

# Phase 4: Performance Optimization
gh issue create --repo $REPO \
  --title "Phase 4: Performance Optimization" \
  --body "Reduce bundle to <400kb, achieve Lighthouse 90+" \
  --label "phase-4-performance" \
  --milestone "Phase 4: Performance Optimization"

# Phase 5: Documentation
gh issue create --repo $REPO \
  --title "Phase 5: Documentation & Knowledge" \
  --body "Create API docs, architecture docs, deployment guides" \
  --label "phase-5-documentation" \
  --milestone "Phase 5: Documentation & Knowledge"

# Phase 6: DevOps
gh issue create --repo $REPO \
  --title "Phase 6: DevOps & Monitoring" \
  --body "Set up monitoring dashboards, alerting, logging" \
  --label "phase-6-devops" \
  --milestone "Phase 6: DevOps & Monitoring"

# Phase 7: Validation
gh issue create --repo $REPO \
  --title "Phase 7: Final Validation" \
  --body "Final audit, UAT, grade verification to A+" \
  --label "phase-7-validation" \
  --milestone "Phase 7: Final Validation"

echo "✅ GitHub issues created successfully"
```

## Manual Issue Creation (If GitHub CLI unavailable)

Go to: https://github.com/JasenNelson/SSTAC-Dashboard/issues/new

### Phase 0 Issues

#### Issue 0.1: Create GitHub Project Board
```
Title: Phase 0.1: Create GitHub Project Board

Description:
Create GitHub project for upgrade tracking with the following columns:
- Backlog
- Ready
- In Progress
- In Review
- Testing
- Complete
- Blocked

Labels: phase-0-infrastructure
Milestone: Phase 0: Infrastructure Setup
Assignee: [Self]
Estimated Time: 30 min
```

#### Issue 0.2: Generate GitHub Issues
```
Title: Phase 0.2: Generate GitHub Issues

Description:
Create 100+ issues for all 7 phases with:
- Proper phase labels
- Estimated hours
- Success criteria
- Related files
- Dependencies

Labels: phase-0-infrastructure
Milestone: Phase 0: Infrastructure Setup
Assignee: [Self]
Estimated Time: 1 hour
```

### Phase 1 Issues

#### Issue 1.1: Create Type Safety Foundation
```
Title: Phase 1.1: Create Type Safety Foundation

Description:
Create src/types/index.ts with interfaces for:
- PollResult
- MatrixData
- ReviewSubmission
- Assessment
- VoteData
- UserRole
- All API response types

Success Criteria:
- [ ] No `unknown` types
- [ ] All interfaces exported
- [ ] Database schema matched

Labels: phase-1-architecture
Milestone: Phase 1: Architecture & Type Safety
Estimated Time: 8 hours
```

#### Issue 1.2: Generate Supabase Types
```
Title: Phase 1.2: Generate Supabase Types

Description:
Run: npx supabase gen types typescript --local > src/types/database.ts

Success Criteria:
- [ ] Types generated
- [ ] Verified against database
- [ ] Committed to repo

Labels: phase-1-architecture
Milestone: Phase 1: Architecture & Type Safety
Estimated Time: 2 hours
```

#### Issue 1.3: Create API Client Layer
```
Title: Phase 1.3: Create API Client Layer

Description:
Create centralized typed API client in src/lib/api/:
- src/lib/api/client.ts (Supabase wrapper)
- src/lib/api/polls.ts (Poll endpoints)
- src/lib/api/matrix.ts (Matrix graph endpoints)
- src/lib/api/reviews.ts (Review endpoints)
- src/lib/api/index.ts (Barrel export)

Success Criteria:
- [ ] All endpoints typed
- [ ] Error handling implemented
- [ ] No direct Supabase imports in components

Labels: phase-1-architecture
Milestone: Phase 1: Architecture & Type Safety
Estimated Time: 12 hours
```

### Phase 2 Issues (CRITICAL)

#### Issue 2.1: Fix Critical Vulnerabilities
```
Title: Phase 2.1: Fix Critical Vulnerabilities 🔴 CRITICAL

Description:
Fix these 3 critical vulnerabilities:

1. Remove localStorage admin bypass
   - File: src/lib/admin-utils.ts
   - Remove fallback on lines 80, 148

2. Add auth to public endpoints
   - File: src/app/api/announcements/route.ts
   - Add getAuthenticatedUser() check

3. Update npm tar package
   - Run: npm audit fix
   - Ensure tar >= 7.6.0

Success Criteria:
- [ ] npm audit shows 0 HIGH/CRITICAL
- [ ] localStorage admin bypass removed
- [ ] Public endpoints secured
- [ ] All tests passing

Labels: phase-2-security, security-critical
Milestone: Phase 2: Security Hardening
Estimated Time: 8 hours
Priority: CRITICAL
```

#### Issue 2.2: Add Security Headers
```
Title: Phase 2.2: Add Security Headers Middleware

Description:
Add 6 security headers to src/middleware.ts:
- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

Success Criteria:
- [ ] All 6 headers present
- [ ] curl -I shows all headers
- [ ] Tested in dev and staging

Labels: phase-2-security
Milestone: Phase 2: Security Hardening
Estimated Time: 3 hours
```

## Issue Labels Reference

```
phase-0-infrastructure    Phase 0 work
phase-1-architecture      Phase 1: Architecture & Type Safety
phase-2-security          Phase 2: Security Hardening
phase-3-testing           Phase 3: Comprehensive Testing
phase-4-performance       Phase 4: Performance Optimization
phase-5-documentation     Phase 5: Documentation & Knowledge
phase-6-devops            Phase 6: DevOps & Monitoring
phase-7-validation        Phase 7: Final Validation

security-critical         Blocks other work or directly impacts security
type-safety              Type system improvements
testing                  Test coverage and test quality
performance              Performance improvements
documentation            Documentation work
refactoring              Code restructuring
bug-fix                  Bug fixes
infrastructure           Infrastructure or DevOps work
```

## Milestone Setup

Create these milestones:

1. **Phase 0: Infrastructure Setup** (Week 0)
2. **Phase 1: Architecture & Type Safety** (Weeks 1-4)
3. **Phase 2: Security Hardening** (Weeks 5-6) - PRIORITY
4. **Phase 3: Comprehensive Testing** (Weeks 7-12)
5. **Phase 4: Performance Optimization** (Weeks 13-15)
6. **Phase 5: Documentation & Knowledge** (Weeks 16-18)
7. **Phase 6: DevOps & Monitoring** (Week 19)
8. **Phase 7: Final Validation** (Week 20)

---

## Issue Workflow

```
Backlog → Ready → In Progress → In Review → Testing → Complete
                    ↓
                   Blocked (if needed)
```

### Backlog
- New issues, not yet prioritized

### Ready
- Prioritized and ready to start
- Blocked issues resolved

### In Progress
- Currently being worked on
- Assignee actively developing

### In Review
- Code written, awaiting review
- PR created and linked

### Testing
- Code merged, in QA testing
- UAT or integration verification

### Complete
- Issue closed, work verified
- Metrics updated

### Blocked
- Cannot proceed
- Document blocker in issue comment
- Link to blocking issue

---

## Creating Issues from Pull Requests

After completing work on a phase, the PR should reference related issues:

```
Closes #123, #124, #125

## Phase Completion Checklist
- [x] All tasks completed
- [x] Tests passing
- [x] Code reviewed
- [x] Metrics verified

See PHASE_CHECKLIST.md for full validation.
```

---

**Last Updated:** 2026-01-24
**Status:** Template ready for use
