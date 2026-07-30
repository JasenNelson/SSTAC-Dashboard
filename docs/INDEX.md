# Documentation Index (Canonical)

This file is the **single canonical entrypoint** for project documentation.

- **Docs manifest (authoritative)**: `docs/_meta/docs-manifest.json`
- **Facts policy (volatile metrics)**: Volatile metrics (test counts, grades, etc.) must live in the manifest under `facts` (live/current) or `facts_history` (frozen session-closeout snapshots). Only `facts` is canonical truth; `facts_history` is read-only history and must not be cited as "current".

## How to use this repo's docs (humans + AI)

1. Start here.
2. Use the manifest to determine which docs/sections are required for your change.
3. Do not trust "current" claims or metrics found elsewhere unless they are explicitly labeled historical and dated.
4. CODE questions: consult the KB wiki indexes first (`wiki\03_Indexes\` in the MAIN checkout;
   untracked pilot output, read-only from worktrees via the absolute path) before repo-wide
   searches. Operations: `docs/WIKI_KB_OPERATIONS_2026_07.md`.

## Gate system (deterministic doc review)

To resolve which documentation must be reviewed for a given change, run:

- `npm run docs:gate -- --base origin/main --head HEAD`

This uses `docs/_meta/docs-manifest.json` to map changed code paths -> required docs/sections, and fails if required headings drift.

If you don't have `origin/main` locally (or you want to force a specific check), you can pass explicit files:

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
- `docs/GATE_MODE_SOP.md` -- gate-discipline authority (Gate Mode; full six-gate push suite lint/typecheck/test:ci/monitored build/e2e/docs gate; commit/push/merge protocols). Cited by CLAUDE.md.

### Documentation archive policy (authoritative)
- `docs/ARCHIVE_POLICY.md`
- Archive location: `docs/archive/YYYY-MM-DD_<topic>/`

### Poll system (authoritative)
- `docs/poll-system/README.md`
- `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md`
- `docs/poll-system/SAFE_POLL_UPDATE_PROTOCOL.md`
- `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`
- `docs/poll-system/CEW_DATA_FLOW.md`

### System design (reference)
- `docs/system-design/README.md`
- `docs/system-design/MATRIX_GRAPH_VISUALIZATION.md`

### Matrix Map and Option C (authoritative design + open owner decisions)
Added 2026-07-26 during documentation recovery: this lane was the active flagship
workstream yet had no route from this index, and none of its authorities were
registered in `docs/_meta/docs-manifest.json`. Changes under
`src/app/(dashboard)/matrix-map/**`, `src/app/(dashboard)/admin/matrix-map/**`,
`src/app/api/matrix-map/**`, `src/lib/matrix-map/**`, `docs/design/matrix-map/**`,
or `scripts/matrix-map/validation/**` now activate `MATRIX_MAP_GATE`.
- `docs/design/matrix-map/PLAN_V3_4_2.md` - LOCKED v1 scope (PR-MAP-0..7, effort
  table, risks). Authority for whether PR-MAP-6, PR-MAP-7, and the mobile summary
  remain mandatory v1 scope. That scope question is an OPEN owner decision.
- `docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md` - Option C
  architecture authority, including the aggregate-oracle hazard. Architecture
  authority only; it is NOT an implementation-status page.
- `docs/MATRIX_MAP_OPTION_C_OWNER_DECISION_PACKET_2026-07-20.md` - the two OPEN
  owner sub-decisions: publication semantics (shape a vs shape b) and the
  `matrix_map.samples.public` disposition.
- `docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md` - OWNER-RUN
  pre-apply procedure: exact reviewed SQL bytes and SHA-256, the mandatory
  replay-and-GREEN gate, read-only preflight and postflight, and the visibility
  invariant. It documents a procedure and authorizes nothing; the live apply
  remains an OPEN owner decision.
- `docs/design/matrix-map/OPTION_C_CANDIDATE_LIFECYCLE_WORKPLAN_2026_07_25.md` -
  REFERENCE. Early technical design for candidate create/refresh.
  **SUPERSEDED IN PART by F2 (PR #756, merged `e8daa2b8`): it predates the
  7-argument `upsert_site_aggregate_candidate`, the `UE412` pre-commit identity
  check, and the live-preview RPC, none of which it mentions.** Read it for the
  lifecycle intent (locking, authorization, audit), not for the current RPC
  signature or identity contract, which live in the pinned SQL and the runbook.

### F2 cluster-identity program (2026-07-29/30)
- F2 (PR #756) is MERGED as `e8daa2b8`; the follow-on cookie-adapter hotfix
  (PR #758) is MERGED as `79e9353d` and deployed.
- **The Option C SQL remains UNAPPLIED and D2 remains BLOCKED**, pending an owner
  decision and an outstanding authenticated production retest. Do not describe D2
  as complete or authorized.
- Root continuity anchor:
  `FRESH_SESSION_HANDOFF_2026_07_30_F2_MERGED_HOTFIX_MERGED_D2_BLOCKED.md`.
- Reusable auth lesson from the hotfix: `docs/LESSONS.md` (2026-07-30, guarded
  `getAll`/`setAll` Supabase cookie adapters in Server Components).

### Status snapshots (reference; dated, not current state)
Treat every file below as a claim list tied to its date, never as live status.
- `docs/SSTAC_TOP50_RECONCILED_2026_07_20.md` - supersedes the July 11-13 status docs.
- `docs/TOP50_CONTINUATION_STATUS_2026-07-21.md`
- `docs/TOP50_CONTINUATION_STATUS_2026-07-22.md` - records the safe-autonomous
  queue as EMPTY as of that date; every remaining row is owner-gated, blocked,
  parked, or done.

### Testing (reference; avoid volatile counts)
- `docs/testing/README.md`

### Review-analysis (reference/historical mix)
- `docs/review-analysis/README.md`
- `docs/review-analysis/NEXT_STEPS.md`
- `docs/review-analysis/REVIEW_SUMMARY.md`
- `docs/review-analysis/HOW_TO_CONDUCT_GRADE_ANALYSIS.md` - Methodology for the weighted-category grade analysis. Current grades live in manifest `facts.grades` (subject to Batch B hygiene); this doc describes how the analysis is run, not the current score.
- `docs/review-analysis/archive/` (historical records)

### Operations (reference)
- `docs/operations/VERCEL_SETUP.md`
- `docs/operations/MONITORING_GUIDE.md`
- `docs/operations/MIDDLEWARE_GUIDE.md` - `src/middleware.ts` request flow, security headers, "Auth session missing" silencing rationale, and refresh-token redirect path

### Environment (reference)
- `docs/ENVIRONMENT_REFERENCE.md` - Per-variable reference for every env var read by `src/` and `scripts/`: required-or-not, read-by file:line, default, effect, sensitivity

### Debugging (reference)
- `docs/debugging/PRE_COMMIT_CHECKLIST.md` - Lightweight pre-commit checklist for incident/debug work. Complements the full verification process under `docs/review-analysis/archive/CODE_CHANGE_VERIFICATION_PROCESS.md`.

### BN-RRM (reference)
- `docs/bn-rrm/README.md` - Dashboard-side BN-RRM feature: pack model, dual `runtime_schema_version` contract (`canonical-20node-v1` / `generic-bn-rrm-v1`), artifact contract under `public/bn-rrm/packs/`, read-only-pack rule, RR boundary

### Developer Experience & Operations (Phase 5 - NEW)
**Critical documentation for development, deployment, and maintenance**
- `docs/DEVELOPER_QUICKSTART.md` - 30-minute onboarding guide for new developers
- `docs/API_REFERENCE.md` - REST API endpoint reference. Endpoint count and per-route freshness are tracked through the audit (`docs/_meta/DOCUMENTATION_AUDIT_2026-04.md`) rather than hardcoded here.
- `docs/OPERATIONS_RUNBOOK.md` - Deployment procedures, incident response, monitoring checklist
- `docs/DATABASE_SCHEMA.md` - Database structure, relationships, query optimization, migration procedures
- `docs/ARCHITECTURE_DECISIONS.md` - 10 ADRs explaining why key technologies/patterns were chosen
- `docs/SECURITY_BEST_PRACTICES.md` - Secure coding guidelines, authentication, file uploads, dependency security
- `docs/PERFORMANCE_TUNING_GUIDE.md` - Core Web Vitals targets, bundle analysis, profiling tools, optimization
- `docs/TROUBLESHOOTING_GUIDE.md` - Common issues and fixes for development, production, tests

### Lessons & Patterns (reference; updated via /update-docs skill)
- `docs/LESSONS.md` - Reusable patterns, architectural decisions, and deployment insights

### Grade upgrade plan (reference; multi-week roadmap, treat as historical unless re-verified)
The repo-root upgrade-plan files were authored mid-roadmap and embed grades, week counts, and "current state" claims. They are kept as historical planning artifacts; do not cite their grades or progress numbers as current truth without re-verifying against the manifest `facts` and the latest audit.

- `UPGRADE_PLAN_A_GRADE.md` - Full multi-phase upgrade plan (planning artifact)
- `UPGRADE_QUICK_START.md` - Accelerated track (planning artifact)
- `EXECUTIVE_SUMMARY.md` - Business case and ROI analysis (planning artifact)
- `ROADMAP.md` - Visual timeline (planning artifact)
- `STATUS_REVIEW_2026-01-25.md` - Dated status snapshot from 2026-01-25; do not treat as current
- `.github/PHASE_CHECKLIST.md` - Completion criteria per phase (planning artifact)
- `.github/UPGRADE_TRACKING.md` - Weekly progress reports (historical)
- `IMPLEMENTATION_LOG.md` - Session-by-session tracking (historical)
- GitHub Project: https://github.com/users/JasenNelson/projects/2/views/1


### Regulatory Review UX (SSTAC)
**Regulatory Review UX doc hygiene:**
- Store all Regulatory Review UX docs under `docs/regulatory-review/`
- Archive snapshots under `docs/regulatory-review/archive/` only after running `npm run docs:archive:investigate`
- Avoid adding ad-hoc docs at repo root to prevent drift

- `docs/regulatory-review/REGULATORY_REVIEW_UX_PROPOSAL.md` - UX proposal and workflow specifications
- `docs/regulatory-review/REGULATORY_REVIEW_MOCKUPS.md` - ASCII mockups and UX behavior examples
- `docs/regulatory-review/REGULATORY_REVIEW_UX_PROPOSAL_REVIEW.md` - Review notes and validation checklist (historical)
- `docs/regulatory-review/REGULATORY_REVIEW_UX_PROPOSAL_CORRECTIONS_APPLIED.md` - Corrections log (historical)
- `docs/regulatory-review/LOCAL_ENGINE_ROUTING_PLAN.md` - Local-engine gating plan v3.1.1 (2026-02-19). Design artifact behind the current `requireAdmin()`/`requireLocalEngine()` guards and `/regulatory-review/:path*` middleware matcher.
- `docs/regulatory-review/CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md` - Chat+search assistant plan v1.1 (2026-02-21). Phase A routes are implemented under `src/app/api/regulatory-review/assistant/`; Phase B items remain deferred per `docs/NEXT_STEPS.md`.
- `docs/regulatory-review/PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md` - Pyramid-navigation implementation proposal. Status unresolved -- target files not in `src/` as of 2026-04-20; tracked in `docs/NEXT_STEPS.md`.
- `docs/regulatory-review/CODEX_REVIEW_PROMPT.md` - One-shot Codex review prompt for the Local-Engine Routing Plan (historical).
- Archived pre-correction copies live under `docs/regulatory-review/archive/`

### Agent operations (authoritative)
- `docs/AGY_USAGE.md` - Canonical SSTAC-specific AGY CLI runbook: mode
  selection, file-backed autonomous workplans, supervised multi-hour launch,
  Codex review loops, failure prevention, and acceptance.
- `SSTAC_AI_PIPELINE.md` - Authoritative multi-AI role split and operational flow
  for mission control, AGY, Codex, OpenCode, and the owner. Read with
  `docs/AGY_USAGE.md` before an AGY launch.

### Agentic OS (reference)
- `docs/agentic_os_ai_subscriptions_panel_handoff_2026_05_16.md` - Feature handoff for the `/admin/agentic-os/subscriptions` panel + IA refactor (shared layout + sidebar + page-level auth-guard helper). REFERENCE-tier: not a current-status source.

### Multi-Project Coordination (reference)
- `MULTI_PROJECT_COORDINATION.md` - Unified coordination for the SSTAC Dashboard, Regulatory-Review, and Database Cleanup workstreams. Phase/status claims inside that file are snapshots; check commit date and re-verify against current code before citing. Structural content (data ownership rules, synchronization points, session resumption instructions, risk assessment) remains the useful contribution.
- Archived snapshots: `docs/archive/2026-01-27_multi-project-coordination/`

### Documentation audits (reference)
- `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` - 2026-04 documentation audit (Phase 1a deliverable). Inventory, gate-coverage matrix, gap register, cross-repo integration review, manifest fact provenance check, path canonicalization, and prioritized P0/P1/P2 fixes that drive subsequent doc updates. Not a current-status source.
- `docs/_meta/DOCUMENTATION_ARCHIVE_LIFECYCLE_AUDIT_2026-04.md` - 2026-04 archive/lifecycle audit. Classifies repo markdown by lifecycle state (ACTIVE / REFERENCE / HISTORICAL-IN-PLACE / ARCHIVE-CANDIDATE / REVIEW-NEEDED), flags stale current-status claims (including inside manifest `facts`), proposes batched archive remediation, and records the policy/tooling changes applied alongside it. Not a current-status source.

### Redirects and deferred items (reference)
- `docs/PROJECT_STATUS.md` - Redirect to INDEX (narrative) + manifest `facts` (metrics), with a bounded historical snapshot of 2025 development phases. Not a current-state dashboard.
- `docs/NEXT_STEPS.md` - Dated, append-only list of deferred items surfaced by past sessions. Not a status dashboard.

### Local Claude tooling (reference; outside docs/)
- `.claude/README.md` - Navigation for `.claude/skills/` (safe-exit, update-docs), `/update-docs` invocation guidance, gate-failure remediation pointer, authority hierarchy. Not part of the gate system.

## Legacy index

- `docs/README.md` is a legacy index. It should not be treated as canonical.
