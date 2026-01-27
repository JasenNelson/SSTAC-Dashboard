# Multi-Project Coordination: SSTAC Dashboard + Regulatory Review + Database Cleanup

**Version:** 1.0
**Created:** January 25, 2026
**Purpose:** Unified session continuity for three concurrent development initiatives

---

## Executive Summary

Three development projects are running concurrently with shared database and frontend:

| Project | Status | Phase | Next Action |
|---------|--------|-------|-------------|
| **SSTAC Dashboard** | Phase 2 COMPLETE | Security Hardening | Verify Vercel, begin Phase 3 |
| **Regulatory-Review** | Tier 2 COMPLETE | Frontend Sync Done | Human review of AI statuses |
| **Database Cleanup** | Planning | Phase 1 Design | Define scope for deletion |

---

## Task 1: SSTAC Dashboard Upgrading

### Status: Phase 2 COMPLETE ✅
- **Grade:** A (90/100)
- **Branch:** `docs/archive-and-lint-fix`
- **Tests:** 246/246 passing (0 failures)
- **CI/CD:** All gates passing (Lint, TypeScript, Tests, Build)
- **Checkpoint:** `F:\sstac-dashboard\.claude\SESSION_CHECKPOINT_2026-01-25-PHASE2-COMPLETE.md`

### Phase 2 Accomplishments
✅ Task 2.1: Fix 3 critical vulnerabilities
- Removed localStorage admin bypass
- Added auth to `/api/announcements`
- Updated tar package (0 HIGH/CRITICAL vulnerabilities now)

✅ Task 2.2: Add 6 security headers
- Content-Security-Policy
- X-Content-Type-Options, X-Frame-Options
- X-XSS-Protection, Referrer-Policy
- Permissions-Policy

✅ Task 2.3: File upload validation
- Type: PDF/DOCX/TXT only
- Size: 10MB max
- Extension validation

✅ Task 2.4: Redis-based rate limiting
- Production: Upstash Redis
- Development: In-memory fallback
- Multi-instance support

✅ Task 2.5: CEW user ID cryptography
- Format: `crypto.randomBytes(16).toString('hex')`
- Unguessable timestamp-proof IDs

### Next Steps: Phase 3 (Comprehensive Testing)
1. Verify Vercel deployment is stable
2. Monitor security headers in production
3. Check rate limiting metrics
4. Expand test coverage (150+ tests)
5. Add integration tests

**Blocker:** None - awaiting Vercel deployment verification

---

## Task 2: Regulatory-Review Development

### Status: Tier 2 COMPLETE ✅
- **Version:** 129.0
- **Architecture:** v2.0 (Direct API, Ralph Loop IPC deprecated)
- **Policies Evaluated:** 5,979 across 355 batch files
- **Semantic Matches:** 5,825 loaded
- **Evaluation Records:** 5,810 synced to dashboard

### Recent Work
**Tier 2 Simulation (External Prompts):**
- Gates 10 & 11 FAILED due to Ralph Loop bottleneck
- Pivoted to Claude Opus AI with external prompts
- Direct API approach: 24x faster (5 min vs 2+ hours)
- All policies evaluated, results in database

**Frontend Sync:**
- Development DB synced: `SSTAC-Dashboard/server/regulatory-review.db`
- Production DB synced: `SSTAC-Dashboard/dist/server/regulatory-review.db`
- Sync script: `engine/scripts/sync_tier2_to_dashboard.py`

### Key Architecture Decision
**Why External Prompts:** The Tier 2 simulation uses Claude Opus AI with prompts EXTERNAL to the engine because:
1. File-based IPC (Ralph Loop) created bottleneck blocking Gates 10 & 11
2. Direct API validation: ~24x performance improvement
3. Opus 4.5: 24% PASS rate, best calibration for policy matching

### Next Steps
1. Human review of AI-proposed PASS/FAIL/NOT_FOUND/ESCALATE statuses
2. Continue Protocol semantic upgrade (9.3% complete)
3. Optionally refactor evaluation runner to use API client

**Blockers:** None - all data synced and ready for review

---

## Task 3: Database Cleanup

### Status: Phase 1 PLANNING
- **Database:** `F:\Regulatory-Review\engine\data\rraa_v3_2.db`
- **Total Policies:** 14,614 (6,036 + 8,578 standards)
- **Scope:** Delete non-policy items (not yet defined)

### Context
Database cleanup runs concurrently because:
1. Tier 2 results now in database - must preserve these
2. Phase 1 defines what's "non-policy"
3. Phase 2 refines metadata on remaining items

### Phase 1: Needs Scope Definition
**User must specify:** What constitutes "non-policy items"?
- Orphaned records without associations?
- Test/sample data from development?
- Superseded metadata versions?
- Temporary processing artifacts?

### Next Steps
1. **BLOCKED on scope definition** - User approval needed
2. Create database backup before any deletions
3. Identify and protect Tier 2 evaluation data
4. Execute deletions with rollback procedure documented

---

## Data Ownership & Synchronization

### Database Architecture

```
Regulatory-Review Engine (Source)          SSTAC Dashboard (Display)
    │                                              │
    ├── rraa_v3_2.db (Primary)                   │
    │    ├── policies (14,614)                   │
    │    ├── semantic_matches (5,825) ◄──────────┤── PROTECTED (Tier 2)
    │    └── evaluation_records (5,810) ◄────────┤── PROTECTED (Tier 2)
    │                                             │
    └── sync_tier2_to_dashboard.py ─────────────►├── regulatory-review.db
                                                 │   (dev + prod copies)
                                                 │
Database Cleanup (Operations)  ────────────────►└── MUST NOT DELETE Tier 2 data
```

### Data Ownership Rules

| Table | Owner | Read By | Write Rules |
|-------|-------|---------|-------------|
| policies | Regulatory-Review | Dashboard, Cleanup | Only Reg-Review writes |
| semantic_matches | Regulatory-Review | Dashboard | Tier 2 results only |
| evaluation_records | Regulatory-Review | Dashboard | Tier 2 results only |
| regulatory-review.db (dev) | Dashboard | Dashboard | Synced from engine DB |
| regulatory-review.db (prod) | Dashboard | Dashboard | Synced from engine DB |

---

## Critical Coordination Points

### 1. Vercel Deployment Verification
**Dashboard Phase 2 → Phase 3 blocker**
```bash
# Check deployment
curl -I https://sstac-dashboard.vercel.app/

# Verify security headers present
# - Content-Security-Policy
# - X-Frame-Options
# - X-Content-Type-Options
```

### 2. Frontend Display of Tier 2 Results
**Regulatory-Review Tier 2 → Human Review blocker**
- Dashboard must display all 5,825 semantic_matches
- Dashboard must show PASS/FAIL/NOT_FOUND/ESCALATE statuses
- Sync script must run successfully

### 3. Database Cleanup Timing
**All projects depend on data integrity**
- Cannot proceed with cleanup until scope defined
- Must create backup before any deletions
- Must explicitly protect Tier 2 evaluation data

---

## Session Resumption Instructions

### For Next Claude Session

**1. Ask User: Which task to work on?**
```
User choices:
(A) Dashboard Phase 3 - Verify Vercel, expand testing
(B) Regulatory-Review - Review AI-proposed statuses
(C) Database Cleanup - Define scope for Phase 1
(D) Continue all three
```

**2. Load Appropriate Handoff**
- Dashboard: `F:\sstac-dashboard\.claude\SESSION_CHECKPOINT_2026-01-25-PHASE2-COMPLETE.md`
- Reg-Review: `F:\Regulatory-Review\engine\docs\active\development\DEV_MANAGER_HANDOFF.md`
- Cleanup: Ask user for scope clarification

**3. Verify State**
```bash
# Dashboard
cd F:\sstac-dashboard && git status && npm test

# Regulatory-Review
cd F:\Regulatory-Review && git status
# Check DEV_PLAN.md version (should be 3.22)
```

**4. Confirm Work Direction**
Use AskUserQuestion before starting implementation on any task.

---

## Risk & Dependency Map

### What Could Block Progress

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Vercel deployment fails | Dashboard Phase 3 blocked | Manual testing fallback available |
| Frontend can't display Tier 2 results | Human review blocked | Data is in DB; alternative display possible |
| Cleanup scope undefined | Phase 1 blocked | Define with user first |
| Cleanup accidentally deletes Tier 2 data | CRITICAL | Explicitly protect semantic_matches/evaluation_records |

### Dependencies Between Tasks

1. **Dashboard → Regulatory-Review**: Displays evaluation results (depends on sync)
2. **Regulatory-Review → Dashboard**: Data sync provides frontend content
3. **Cleanup → Both**: Must preserve all active data from both projects

---

## Quick Reference: File Locations

### SSTAC Dashboard
```
F:\sstac-dashboard\
├── MULTI_PROJECT_COORDINATION.md (this file)
├── NEXT_STEPS.md (Phase 2 → 3 transition)
├── docs\
│   ├── INDEX.md (canonical)
│   ├── LESSONS.md (patterns from Phase 1-2)
│   └── _meta\docs-manifest.json (grade tracking)
└── .claude\
    └── SESSION_CHECKPOINT_2026-01-25-PHASE2-COMPLETE.md
```

### Regulatory-Review
```
F:\Regulatory-Review\
├── engine\
│   ├── MASTER_PRD_v4.md (product requirements)
│   ├── docs\
│   │   ├── active\development\
│   │   │   ├── DEV_MANAGER_HANDOFF.md (v129.0)
│   │   │   ├── DEV_PLAN.md (v3.22)
│   │   │   └── ENGINE_SPECS.md (v1.7)
│   │   ├── LESSONS_LEARNED.md (261KB incident history)
│   │   └── archive\2026-01\ (versioned docs)
│   ├── data\
│   │   └── rraa_v3_2.db (14,614 policies + Tier 2 results)
│   └── scripts\
│       └── sync_tier2_to_dashboard.py
```

---

## Archive Before Editing

Following Regulatory-Review best practices:
```bash
# Before modifying this file
copy "MULTI_PROJECT_COORDINATION.md" "archive\MULTI_PROJECT_COORDINATION_v1.0_ARCHIVED.md"

# Then edit and increment version
# MULTI_PROJECT_COORDINATION_v1.1.md
```

---

## Summary

**Three concurrent initiatives, one integrated workflow:**

1. **SSTAC Dashboard**: A grade achieved, Phase 2 complete, Phase 3 testing ready
2. **Regulatory-Review**: Tier 2 complete, 5,979 policies evaluated, results synced
3. **Database Cleanup**: Scope definition pending, then safe deletion with Tier 2 protection

**Key Principle:** Regulatory-Review owns database writes. Dashboard reads. Cleanup must preserve evaluation data.

**Next Session:** Ask user which task to focus on, then load appropriate handoff documents.

---

**Coordination Document Version:** 1.0
**Created:** January 25, 2026
**Last Updated:** January 25, 2026
**Status:** READY FOR NEXT SESSION
