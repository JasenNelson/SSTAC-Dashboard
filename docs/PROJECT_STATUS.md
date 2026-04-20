# Project Status — SSTAC & TWG Dashboard

**Lifecycle:** REFERENCE (redirect + bounded historical notes)
**Last reframed:** 2026-04-20

---

## Where current status lives

This document is no longer a current-state dashboard. It is a **redirect and a bounded historical snapshot**.

| If you want to know... | Read this instead |
|---|---|
| Current documentation entrypoint and the narrative summary of where the project is today | `docs/INDEX.md` |
| Volatile metrics (test counts, endpoint counts, audit dates) | `docs/_meta/docs-manifest.json` → `facts` |
| Most recent documentation audit findings and prioritized fixes | `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` |
| Deployment, monitoring, and incident-response procedures | `docs/OPERATIONS_RUNBOOK.md` |
| API surface (endpoints, auth, request/response shapes) | `docs/API_REFERENCE.md` |
| Middleware request flow and auth silencing | `docs/operations/MIDDLEWARE_GUIDE.md` |
| Environment variables actually read by the code | `docs/ENVIRONMENT_REFERENCE.md` |
| Recent commits, branches, and who-changed-what | `git log` — authoritative |

**Do not add grades, "production ready" claims, rolling test counts, or phase-completion percentages to this file.** Those are either volatile (belong in manifest `facts`, with provenance) or narrative (belong in `docs/INDEX.md`).

---

## Historical notes (snapshot)

These notes describe earlier phases of the dashboard's development. They are preserved here for orientation; claim dates are preserved verbatim from when the entries were originally written and should **not** be treated as current truth without re-verification against the code or `git log`.

### 2025 development phases (historical narrative)

Between roughly mid-2025 and early 2026, the dashboard went through several development phases focused on:

- **Phase 1 (mid-2025):** Core dashboard, polling systems (single-choice, ranking, wordcloud), admin tooling.
- **Phase 2 (late 2025):** Matrix graphs, survey-results pages (CEW, TWG), chart component library.
- **Phase 3 (Nov 2025):** Validation & security — centralized Zod schemas for non-poll APIs (tags, announcements, milestones, documents, discussions); rate limiting (in-memory fallback + optional Upstash Redis); CSRF protections.
- **Phase 4 (late 2025 – early 2026):** Regulatory Review integration — local-engine gating, admin middleware matcher expansion, SQLite-with-fallback pattern for serverless deployment, Supabase auth hardening.
- **Phase 5 (early 2026):** Developer-experience documentation set — `DEVELOPER_QUICKSTART.md`, `API_REFERENCE.md`, `OPERATIONS_RUNBOOK.md`, `DATABASE_SCHEMA.md`, `ARCHITECTURE_DECISIONS.md`, `SECURITY_BEST_PRACTICES.md`, `PERFORMANCE_TUNING_GUIDE.md`, `TROUBLESHOOTING_GUIDE.md`.
- **Phase 6 (Feb 2026):** Local engine routing plan + chat/search assistant groundwork (design captured in `docs/regulatory-review/LOCAL_ENGINE_ROUTING_PLAN.md` and `docs/regulatory-review/CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md`; assistant routes now live under `src/app/api/regulatory-review/assistant/`).
- **Phase 7 (early 2026):** BN-RRM frontend (`src/components/bn-rrm/`, `src/data/bn-rrm/`, `public/bn-rrm/packs/`) — Jermilova benchmark pack, spatial overlays, conceptual tiers.

### Specific snapshots preserved (dated)

- **2025-11-17:** TypeScript `any` cleanup in safe, non-poll areas (`TWGSynthesisClient.tsx`, `CEWStatsClient.tsx`, `poll-export-utils.ts`). Commit `d285cbd` at the time of writing.
- **2025-11-18:** CEW and TWG results pages recovered from commit `74aa226` and deployed (`7d96435`, `ee30235`, `a1268b2`, `ff779ac`). Pages: `/cew-results`, `/twg-results`.
- **2025-12-07:** Next.js security bump to 15.4.8 (CVE-2025-66478). Test mocks updated for Supabase client API changes. CI green at the time of writing.
- **2026-02-19:** `docs/regulatory-review/LOCAL_ENGINE_ROUTING_PLAN.md` v3.1.1 finalized — env-var gating, `requireAdmin()` + `requireLocalEngine()` guards, UnderConstruction component pattern, `/regulatory-review/:path*` middleware matcher.
- **2026-02-21:** `docs/regulatory-review/CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md` v1.1 finalized — Phase A assistant architecture; routes subsequently implemented under `src/app/api/regulatory-review/assistant/`.
- **2026-04-20:** Documentation audit `DOCUMENTATION_AUDIT_2026-04.md` completed; Phase 3b reference-doc cleanup reframed this file.

### Related historical artifacts

- `docs/review-analysis/archive/MONITORING_BASELINE.md` — 2025 database-performance baseline (archived).
- Planning artifacts at repo root (`UPGRADE_PLAN_A_GRADE.md`, `UPGRADE_QUICK_START.md`, `EXECUTIVE_SUMMARY.md`, `ROADMAP.md`, `STATUS_REVIEW_2026-01-25.md`, `IMPLEMENTATION_LOG.md`) — preserved as historical planning documents per `docs/INDEX.md`. Grades and "current state" claims inside those files are **not** current truth.

---

## How to update this file

- **Adding a new historical snapshot:** append a dated bullet under "Specific snapshots preserved (dated)". Include commit SHA and the date the claim was written. Do not re-characterize older entries.
- **Anything time-sensitive or volatile:** route it to `docs/_meta/docs-manifest.json` `facts` (with a provenance comment noting the command/session that derived it), not here.
- **Anything narrative about current state:** route it to `docs/INDEX.md`.
