# Documentation Index (Canonical)

This file is the **single canonical entrypoint** for project documentation.

- **Docs manifest (authoritative)**: `docs/_meta/docs-manifest.json`
- **Facts policy (volatile metrics)**: Volatile metrics (test counts, grades, etc.) must live in the manifest under `facts`.

## How to use this repo’s docs (humans + AI)

1. Start here.
2. Use the manifest to determine which docs/sections are required for your change.
3. Do not trust “current” claims or metrics found elsewhere unless they are explicitly labeled historical and dated.

## Gate system (deterministic doc review)

To resolve which documentation must be reviewed for a given change, run:

- `npm run docs:gate -- --base origin/main --head HEAD`

This uses `docs/_meta/docs-manifest.json` to map changed code paths → required docs/sections, and fails if required headings drift.

If you don’t have `origin/main` locally (or you want to force a specific check), you can pass explicit files:

- `npm run docs:gate -- --files src/app/api/polls/submit/route.ts`

### API Gate (lightweight)
Triggered by any change under `src/app/api/**`.

**Required**:
- `docs/AGENTS.md`
- This index (`docs/INDEX.md`)

### Polling Gate (strict)
Triggered by poll-adjacent changes (poll APIs, poll UI, admin poll results, matrix graph polling endpoint).

**Critical rule**: The three poll systems are independent (single-choice, ranking, wordcloud). Any poll-adjacent change must review **all three systems**, every time.

**Required (authoritative poll docs)**:
- `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md`
- `docs/poll-system/SAFE_POLL_UPDATE_PROTOCOL.md`
- `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`
- `docs/poll-system/CEW_DATA_FLOW.md`

The exact required sections are enumerated in `docs/_meta/docs-manifest.json` under `bundles.POLLING_GATE.requires_sections`.

## Canonical documentation sets

### Core safety + operational rules (authoritative)
- `docs/AGENTS.md`

### Poll system (authoritative)
- `docs/poll-system/README.md`
- `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md`
- `docs/poll-system/SAFE_POLL_UPDATE_PROTOCOL.md`
- `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`
- `docs/poll-system/CEW_DATA_FLOW.md`

### System design (reference)
- `docs/system-design/README.md`
- `docs/system-design/MATRIX_GRAPH_VISUALIZATION.md`

### Testing (reference; avoid volatile counts)
- `docs/testing/README.md`

### Review-analysis (reference/historical mix)
- `docs/review-analysis/README.md`
- `docs/review-analysis/NEXT_STEPS.md`
- `docs/review-analysis/REVIEW_SUMMARY.md`
- `docs/review-analysis/archive/` (historical records)

### Operations (reference)
- `docs/operations/VERCEL_SETUP.md`
- `docs/operations/MONITORING_GUIDE.md`

### Developer Experience & Operations (Phase 5 - NEW)
**Critical documentation for development, deployment, and maintenance**
- `docs/DEVELOPER_QUICKSTART.md` - 30-minute onboarding guide for new developers
- `docs/API_REFERENCE.md` - Complete API documentation with examples for all 28 endpoints
- `docs/OPERATIONS_RUNBOOK.md` - Deployment procedures, incident response, monitoring checklist
- `docs/DATABASE_SCHEMA.md` - Database structure, relationships, query optimization, migration procedures
- `docs/ARCHITECTURE_DECISIONS.md` - 10 ADRs explaining why key technologies/patterns were chosen
- `docs/SECURITY_BEST_PRACTICES.md` - Secure coding guidelines, authentication, file uploads, dependency security
- `docs/PERFORMANCE_TUNING_GUIDE.md` - Core Web Vitals targets, bundle analysis, profiling tools, optimization
- `docs/TROUBLESHOOTING_GUIDE.md` - Common issues and fixes for development, production, tests

### Lessons & Patterns (reference; updated via /update-docs skill)
- `docs/LESSONS.md` - Reusable patterns, architectural decisions, and deployment insights

### A+ Grade Upgrade (reference; 20-week comprehensive upgrade plan)
- `UPGRADE_PLAN_A_GRADE.md` - Full 40-page plan for B+ → A+ upgrade
- `UPGRADE_QUICK_START.md` - 7-week accelerated track
- `EXECUTIVE_SUMMARY.md` - Business case and ROI analysis
- `ROADMAP.md` - Visual 20-week timeline
- `STATUS_REVIEW_2026-01-25.md` - Current state (A grade 93/100)
- `.github/PHASE_CHECKLIST.md` - Completion criteria for all 7 phases
- `.github/UPGRADE_TRACKING.md` - Weekly progress reports
- `IMPLEMENTATION_LOG.md` - Session-by-session tracking
- GitHub Project: https://github.com/users/JasenNelson/projects/2/views/1

### Multi-Project Coordination (reference)
- `MULTI_PROJECT_COORDINATION.md` - Unified coordination for three concurrent development projects:
  - **SSTAC Dashboard** (this project) - Phase 3 testing complete, Phase 4 optimization ready, Grade A (93/100)
  - **Regulatory-Review** - Tier 2 evaluation complete, 5,809 policies evaluated, results synced to Dashboard
  - **Database Cleanup** - Phase 1 planning, scope definition needed
  - Includes: data ownership rules, synchronization points, session resumption instructions, risk assessment

## Legacy index

- `docs/README.md` is a legacy index. It should not be treated as canonical.
