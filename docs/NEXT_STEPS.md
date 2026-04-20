# Next Steps — Deferred Items

**Lifecycle:** REFERENCE (append-only deferred items; date every entry)
**Last reframed:** 2026-04-20

---

## How to use this file

This document is a **dated, append-only list of deferred items** — things identified during a past session that were scoped out, not shipped, or left for a later pass. It is not a status dashboard and it does not claim to describe the current state of the project.

- **Where current status lives:** `docs/INDEX.md` (narrative) and `docs/_meta/docs-manifest.json` `facts` (metrics).
- **Where recent commit history lives:** `git log` — authoritative.
- **Where audit findings live:** `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` (and successor audits).

Each deferred item must include: the date it was deferred, why it was deferred, and the source document / session that surfaced it. Do **not** add "ALL PHASES COMPLETE," "Final Grade," or production-ready framing to this file.

---

## Deferred items

### 2026-04-20 — From documentation audit (Phase 1a) and reference-doc pass (Phase 3b)

Items surfaced by `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` and the Phase 3b reference-doc survey that were not addressed in the April 2026 documentation pass. These are candidates for a future documentation or code session.

- **Code-side hardcoded Regulatory-Review paths.** `src/app/api/regulatory-review/projects/route.ts`, `.../projects/[id]/extract/route.ts`, `.../search/route.ts`, and `src/lib/regulatory-review/launch-evaluation.ts` embed workspace-relative paths (including a default that points at `C:/Projects/Regulatory-Review/engine`). Audit flagged these; remediation is a code change (likely env-var migration) rather than a documentation change and was kept out of the doc pass.
  - **Source:** audit §1.3 ("Dashboard-side hardcoded RR paths") and §1.7 P1/P2 list.
- **Regulatory-Review repo stale-path and internal-contradiction flags.** Audit enumerated stale `F:\` paths and internal contradictions inside RR's own docs (direct DB read vs. local DB copy claims, etc.). Dashboard-side docs no longer cite stale RR content, but the RR repo has not been updated.
  - **Source:** audit §1.4 cross-repo integration review. Out of scope for the dashboard repo.
- **`docs/README.md` legacy index.** `docs/INDEX.md` already flags `docs/README.md` as legacy. The audit did not decide whether to archive it or re-homogenize its content into INDEX. Decision deferred.
  - **Source:** audit §1.1 inventory and §1.7 P2 list.
- **Upgrade-plan / roadmap planning artifacts at repo root.** `UPGRADE_PLAN_A_GRADE.md`, `UPGRADE_QUICK_START.md`, `EXECUTIVE_SUMMARY.md`, `ROADMAP.md`, `STATUS_REVIEW_2026-01-25.md`, `IMPLEMENTATION_LOG.md`, `.github/PHASE_CHECKLIST.md`, `.github/UPGRADE_TRACKING.md` embed grades and phase-completion claims. They are preserved as historical planning artifacts per INDEX.md but have not been individually date-stamped or archived.
  - **Source:** audit §1.1 inventory. Out-of-scope for the 2026-04 pass.
- **`MONITORING_BASELINE.md` reference from `docs/AGENTS.md`.** `docs/AGENTS.md:55` references `docs/review-analysis/MONITORING_BASELINE.md`, but the file lives at `docs/review-analysis/archive/MONITORING_BASELINE.md`. Pre-existing broken link; not introduced by the 2026-04 pass. Safe to fix in a small follow-up PR.
  - **Source:** Phase 3a codex-review finding.
- **Pyramid-navigation implementation.** `docs/regulatory-review/PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md` describes a planned 3-tier pyramid navigation feature. The target files `pyramidHierarchy.ts` and `PyramidNavigation.tsx` do not exist in `src/`. Status of that work is unresolved — either not started, or the plan was superseded by something else.
  - **Source:** Phase 3b survey, 2026-04-20.
- **Submission-search performance.** `src/app/api/regulatory-review/submission-search/route.ts` does a full in-memory JSON scan of `assessments.evidence_found`. Acceptable for the current data size; the chat/search enhancement plan notes this becomes a problem past ~1K assessments and suggests a denormalized search table or SQLite FTS index in a later phase.
  - **Source:** `docs/regulatory-review/CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md` Phase B notes.
- **Deprecated `/api/regulatory-review/run-engine` route.** Returns HTTP 501 with a deprecation message redirecting to `projects/[id]/evaluate`. Not yet removed from the codebase. Safe to delete once no external callers remain.
  - **Source:** route inventory for `docs/API_REFERENCE.md` refresh.
- **`.env.example` comment-only drift.** `REG_REVIEW_EXTRACTIONS_PATH`, `REG_REVIEW_OUTPUT_PATH`, `REG_REVIEW_TEMP_UPLOAD_PATH` are commented in `.env.example` but are not read by any code in `src/` or `scripts/` (verified 2026-04-20). Either wire them up or remove them.
  - **Source:** `docs/ENVIRONMENT_REFERENCE.md` §"Variables in `.env.example` that are not currently consumed".

---

## How to add a new deferred item

Append under a new `### YYYY-MM-DD — Source/session` subheading. Each item should include:

1. A one-line title.
2. 1–3 sentences explaining what is deferred and why.
3. A **Source:** line identifying the document, audit, or session that surfaced the item.

Do not delete historical entries — they are the audit trail. When an item is resolved, move it under a `### Resolved` subheading in the same dated section with the resolving commit SHA or date, but leave the original description intact.
