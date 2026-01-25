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