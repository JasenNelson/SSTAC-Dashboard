# Documentation Archive / Lifecycle Audit — 2026-04

**Date drafted:** 2026-04-20
**Audit lifecycle:** REFERENCE
**Scope:** `docs/**`, repo-root `*.md`, `.github/**/*.md`, and `docs/_meta/docs-manifest.json`.
**Out of scope:** Running any archive move. Editing manifest `facts`. Changes to `docs/poll-system/**` (strict governance).

**Source-of-truth rule:** every finding cites a source (file path, command, or manifest key). Claims sourced only from historical content are flagged and deferred.

**Relationship to the 2026-04 documentation audit:** this audit is a direct follow-up to `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` (Phase 1a). Phase 1a inventoried and gap-registered the docs. This audit classifies them by lifecycle and proposes batched archive remediation. They are intended to be read together.

---

## 1. System as-is

- `docs/INDEX.md` is the canonical entrypoint.
- `docs/_meta/docs-manifest.json` is the authoritative manifest for `documents[]`, `facts`, `section_catalog`, and `bundles`.
- `docs/ARCHIVE_POLICY.md` governs archiving; pre-update scope was limited to `docs/**`.
- `scripts/verify/docs-archive-investigation.mjs` builds a link graph, reports broken links, duplication clusters, and TF-IDF unique terms. Pre-update scope was limited to a single `--root`.
- The 2026-04 audit (`DOCUMENTATION_AUDIT_2026-04.md`) and the Phase 3b reference-doc cleanup (commit `1bc463f`) have already reframed `docs/PROJECT_STATUS.md`, `docs/NEXT_STEPS.md`, and registered the regulatory-review plans. The policy/tooling direction here is consistent with that work.

## 2. Manifest integrity — PASS

| Check | Result |
|---|---|
| JSON parse | OK |
| `documents[]` entries | 78 |
| Duplicate `id`s | 0 |
| Duplicate `path`s | 0 |
| Registered paths missing on disk | 0 |
| Lifecycle counts | AUTHORITATIVE 8 · REFERENCE 24 · HISTORICAL 46 |

Source: `node` script parsing the manifest (2026-04-20).

## 3. Investigation-gate results (docs-only, as-of policy scope) — PASS

| Metric | Value |
|---|---|
| Markdown files scanned under `docs/` | 121 |
| Broken links | 0 |
| Duplication clusters (≥0.45 Jaccard) | 3 |
| Top inbound hub | `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md` (3) |

Source: `npm run docs:archive:investigate` (2026-04-20).

Duplication clusters are all intentional:
- `docs/archive/2026-01-27_multi-project-coordination/` v1.0–v1.3 — archived version chain.
- `docs/regulatory-review/{REGULATORY_REVIEW_MOCKUPS,REGULATORY_REVIEW_UX_PROPOSAL}.md` each paired with their `archive/*_PRE_CORRECTIONS.md` sibling.

## 4. Inventory vs. registration

| Location | Files | Registered in manifest | Linked from INDEX |
|---|---|---|---|
| `docs/**/*.md` | 121 | 76 | ~30 enumerated plus archive folders mentioned as groups |
| Repo root `*.md` | 9 | 0 | 6 (upgrade-plan group + `MULTI_PROJECT_COORDINATION.md`) |
| `.github/**/*.md` | 7 | 0 | 2 (`PHASE_CHECKLIST.md`, `UPGRADE_TRACKING.md`) |

**45 files under `docs/` are unregistered in `documents[]`.** Breakdown:

- **7 are linked from INDEX** (directory README indexes + `NEXT_STEPS.md` + `REVIEW_SUMMARY.md` under review-analysis) — safe; need manifest entries only.
- **4 are live but unregistered and carry stale grade/phase claims:** `docs/PERFORMANCE_TESTING.md`, `docs/PHASE3_TESTING_REPORT.md`, `docs/SECURITY_TESTING.md`, `docs/QUICK_START_TEMPLATES.md`.
- **2 debugging guides:** `docs/debugging/PRE_COMMIT_CHECKLIST.md` (active) + `docs/debugging/COMMIT_PREPARATION.md` (9-line stub pointing at the checklist — merge candidate).
- **3 reference docs:** `docs/review-analysis/HOW_TO_CONDUCT_GRADE_ANALYSIS.md`, `docs/testing/K6_COMPREHENSIVE_TESTING_PLAN.md`, `docs/system-design/DEBUGGING_LESSONS_LEARNED.md`.
- **~30 under `docs/review-analysis/archive/**`** are historical files never registered; parallel to already-registered siblings.

Source: repo walk + manifest parse (2026-04-20).

## 5. Stale "current status" claims

These contradict `docs/INDEX.md`, `docs/PROJECT_STATUS.md`, `docs/NEXT_STEPS.md`, and the 2026-04 audit.

| File | Stale claim | Risk |
|---|---|---|
| `STATUS_REVIEW_2026-01-25.md` (root) | "Current Grade: A (93/100)" / "Target: A+" | HIGH |
| `IMPLEMENTATION_LOG.md` (root) | Session-by-session "Complete" status | MED |
| `docs/PHASE3_TESTING_REPORT.md` | "Grade Impact: A-(92) → A(93)" | HIGH |
| `docs/SECURITY_TESTING.md` | "Current Security Grade: A (93/100)" | HIGH |
| `docs/PERFORMANCE_TESTING.md` | "Grade: A (93/100) \| Updated: 2026-01-25" | HIGH |
| `docs/QUICK_START_TEMPLATES.md` | Templates cite "Phase 3 completed" | MED |
| `docs/system-design/DEBUGGING_LESSONS_LEARNED.md` | "Document Version: January 26, 2025" vs. 2026 content | LOW |
| **Manifest `facts.current_session`** | `project_status: DELIVERED`, `all_phases_complete: true`, `final_grade: 97.5/100 (A++++)`, `production_status: READY` | **HIGH** |
| **Manifest `facts.phase7_final_validation`** | "COMPLETE — project ready for production" | HIGH |
| **Manifest `facts.phase6_devops_monitoring`** | "grade_after: 98-100/100 (A+++)" | HIGH |
| **Manifest `facts.phase5_documentation_knowledge`** | "grade_after: 96-98/100 (A++)" | HIGH |
| **Manifest `facts.phase4_performance_optimization`** | "grade_achieved: A+ threshold" | HIGH |
| **Manifest `facts.grades.current_grade`** | `A (90%)`, last_verified 2026-01-25 | HIGH |

The manifest `facts` section is the single biggest integrity problem: it is simultaneously the authoritative store for current truth *and* contains celebratory "A++++ / production-ready / all-phases-complete" snapshots from a single day in January. Every other current-status claim in the repo has been reframed; `facts` itself was not.

Manifest facts hygiene is held back from this audit's remediation set because it changes the shape of `manifest.facts`, which is consumed by `scripts/verify/update-manifest-facts.mjs` and by downstream tooling. It requires its own small plan.

## 6. Root-level and `.github/` docs — out of pre-update policy scope

`docs/ARCHIVE_POLICY.md` Scope (pre-update): *"Applies to markdown documents under `docs/`."* That left these uncovered:

- **Root (9):** `README.md`, `CONTRIBUTING.md`, `MULTI_PROJECT_COORDINATION.md`, `EXECUTIVE_SUMMARY.md`, `ROADMAP.md`, `UPGRADE_PLAN_A_GRADE.md`, `UPGRADE_QUICK_START.md`, `STATUS_REVIEW_2026-01-25.md`, `IMPLEMENTATION_LOG.md`.
- **`.github/` (7):** `GITHUB_ISSUES_TEMPLATE.md`, `LOG_AGGREGATION_SETUP.md`, `METRICS_DASHBOARD_SETUP.md`, `MONITORING_SETUP.md`, `PHASE_6_VALIDATION.md`, `PHASE_CHECKLIST.md`, `UPGRADE_TRACKING.md`.

INDEX already flags the upgrade-plan group and `.github/PHASE_*` as "treat as historical unless re-verified." `NEXT_STEPS.md` 2026-04-20 explicitly defers the archive decision for these. The ARCHIVE_POLICY update in this session expands scope to cover them.

## 7. Lifecycle classification

Using the expanded lifecycle states defined in the updated `docs/ARCHIVE_POLICY.md`:

### ACTIVE (gate-bearing / load-bearing; registered AUTHORITATIVE)
- `docs/INDEX.md`, `docs/_meta/docs-manifest.json`
- `docs/AGENTS.md`, `docs/ARCHIVE_POLICY.md`
- `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md`
- `docs/poll-system/SAFE_POLL_UPDATE_PROTOCOL.md`
- `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`
- `docs/poll-system/CEW_DATA_FLOW.md`

### REFERENCE (supporting context; safe to update)
- All Phase 5 developer-experience docs (`DEVELOPER_QUICKSTART.md`, `API_REFERENCE.md`, `OPERATIONS_RUNBOOK.md`, `DATABASE_SCHEMA.md`, `ARCHITECTURE_DECISIONS.md`, `SECURITY_BEST_PRACTICES.md`, `PERFORMANCE_TUNING_GUIDE.md`, `TROUBLESHOOTING_GUIDE.md`).
- Operations: `VERCEL_SETUP.md`, `MONITORING_GUIDE.md`, `MIDDLEWARE_GUIDE.md`.
- `docs/ENVIRONMENT_REFERENCE.md`, `docs/LESSONS.md`, `docs/bn-rrm/README.md`.
- Regulatory-review active plans: `LOCAL_ENGINE_ROUTING_PLAN.md`, `CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md`, `REGULATORY_REVIEW_UX_PROPOSAL.md`, `REGULATORY_REVIEW_MOCKUPS.md`.
- `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md`, this audit.
- Directory READMEs that serve as navigation indexes: `docs/poll-system/README.md`, `docs/system-design/README.md`, `docs/testing/README.md`, `docs/review-analysis/README.md`.
- Root-level: `README.md`, `CONTRIBUTING.md`, `MULTI_PROJECT_COORDINATION.md`.

### HISTORICAL-IN-PLACE (dated, banner required; do not move yet)
- `docs/PROJECT_STATUS.md` — already reframed, already banners.
- `docs/NEXT_STEPS.md` — already reframed, already banners.
- Root upgrade-planning set (`UPGRADE_PLAN_A_GRADE.md`, `UPGRADE_QUICK_START.md`, `EXECUTIVE_SUMMARY.md`, `ROADMAP.md`, `STATUS_REVIEW_2026-01-25.md`, `IMPLEMENTATION_LOG.md`).
- `.github/PHASE_CHECKLIST.md`, `.github/UPGRADE_TRACKING.md`, `.github/PHASE_6_VALIDATION.md`.
- `docs/regulatory-review/REGULATORY_REVIEW_UX_PROPOSAL_REVIEW.md`, `REGULATORY_REVIEW_UX_PROPOSAL_CORRECTIONS_APPLIED.md`, `CODEX_REVIEW_PROMPT.md`, `PHASE1_PYRAMID_NAVIGATION_IMPLEMENTATION.md`.
- `docs/system-design/DEBUGGING_LESSONS_LEARNED.md` — Jan-2025 content retained as debugging retrospective.

These docs need stale-current-status banners per the updated policy. `PROJECT_STATUS.md` and `NEXT_STEPS.md` are canonical examples.

### ARCHIVE-CANDIDATE (move after replacement is verified)
- `docs/PHASE3_TESTING_REPORT.md` — session report; replacement = `docs/LESSONS.md` + `docs/SECURITY_BEST_PRACTICES.md`.
- `docs/SECURITY_TESTING.md` — embeds stale grade; replacement = `docs/SECURITY_BEST_PRACTICES.md`.
- `docs/PERFORMANCE_TESTING.md` — embeds stale grade; replacement = `docs/PERFORMANCE_TUNING_GUIDE.md`.
- `docs/QUICK_START_TEMPLATES.md` — replacement = `docs/DEVELOPER_QUICKSTART.md`.
- `docs/debugging/COMMIT_PREPARATION.md` — 9-line stub; merge and delete (archive-equivalent).
- Much of `docs/review-analysis/archive/**` that is already historical — not moved, but needs manifest registration.

### REVIEW-NEEDED (cannot classify without subject-matter read)
- `docs/testing/K6_COMPREHENSIVE_TESTING_PLAN.md` — plan document; may still be actionable or fully superseded by `k6/` scripts and `docs/review-analysis/archive/K6_TEST_COVERAGE_ANALYSIS.md`.
- `docs/review-analysis/HOW_TO_CONDUCT_GRADE_ANALYSIS.md` — useful methodology or tied to the stale grade narrative?
- `docs/debugging/PRE_COMMIT_CHECKLIST.md` — active checklist or superseded by manifest gate?
- Several `.github/*_SETUP.md` (`LOG_AGGREGATION_SETUP.md`, `METRICS_DASHBOARD_SETUP.md`, `MONITORING_SETUP.md`) — aspirational Phase 6 docs or current ops reference?

## 8. Proposed archive batches (for future sessions — NOT executed here)

All batches gated by `/codex-review` and explicit approval.

### Batch D — Registration-only cleanup of `docs/review-analysis/archive/**`
No file moves. Add manifest entries (`lifecycle: HISTORICAL`) for the ~30 unregistered historical files. Lowest risk.

### Batch E — Orphan reference registration
No file moves. Register `docs/debugging/PRE_COMMIT_CHECKLIST.md`, `docs/review-analysis/HOW_TO_CONDUCT_GRADE_ANALYSIS.md`, `docs/testing/K6_COMPREHENSIVE_TESTING_PLAN.md`, `docs/system-design/DEBUGGING_LESSONS_LEARNED.md` with correct lifecycle. Merge `docs/debugging/COMMIT_PREPARATION.md` into `PRE_COMMIT_CHECKLIST.md`, then delete the stub.

### Batch A — "Phase 3 session reports" (4 files)
Move to `docs/archive/2026-MM-DD_phase3-session-reports/`:
- `docs/PHASE3_TESTING_REPORT.md`
- `docs/SECURITY_TESTING.md`
- `docs/PERFORMANCE_TESTING.md`
- `docs/QUICK_START_TEMPLATES.md`

Add folder README with replacement citations (already exist). Register each in manifest as HISTORICAL.

### Batch B — Manifest facts hygiene (HELD)
Requires a separate plan. Inspect every consumer of `manifest.facts`:
- `scripts/verify/update-manifest-facts.mjs` (writes `facts.testing.*`)
- `scripts/verify/docs-gate.mjs`
- any skills or docs that reference `facts.*`

Goal: move stale phase/session facts into a `facts_history` sibling (or tag them `status: HISTORICAL_SNAPSHOT`) without breaking the updater. Not part of this policy pass.

### Batch C — Root upgrade-planning set (HELD)
Sensitive because INDEX.md explicitly references the files. Either (1) keep in place with reinforced stale-status banners (recommended), or (2) move to `docs/archive/2026-MM-DD_root-upgrade-planning/` and update INDEX's "Grade upgrade plan" section to link into the archive. Decide during Batch C's plan.

## 9. Policy updates applied in this session

See `docs/ARCHIVE_POLICY.md`:

1. Scope expanded to cover root-level markdown and `.github/**/*.md` (archived under the same `docs/archive/` tree; origin recorded in each archive README).
2. Five lifecycle states defined: `ACTIVE`, `REFERENCE`, `HISTORICAL-IN-PLACE`, `ARCHIVE-CANDIDATE`, `REVIEW-NEEDED`. Mapped to the manifest's three-value `lifecycle` enum.
3. Source/replacement proof required before any archive move.
4. Manifest + INDEX updates required in the same change as any archive move.
5. Stale-current-status banner template required for `HISTORICAL-IN-PLACE` docs.
6. Small-batch rule: archive moves happen in named batches of typically ≤ 6 files, never broad sweeps.
7. `npm run docs:archive:investigate:all` added as the wide-scope gate (docs + root + `.github/`).

## 10. Tooling updates applied in this session

See `scripts/verify/docs-archive-investigation.mjs`:

- `--root <dir>` is now repeatable.
- `--include-root-md` added to also scan repo-root-level `*.md` (non-recursive).
- `package.json` adds `docs:archive:investigate:all` (and `:all:json`) that runs the script over `docs/`, `.github/`, and repo-root markdown.

Narrow (`docs/**` only) behavior is preserved under the existing `docs:archive:investigate` script — required for the existing gate semantics.

## 11. What this audit does **not** do

- Does not move any files.
- Does not modify `manifest.facts` (Batch B is held pending its own plan).
- Does not resolve `REVIEW-NEEDED` classifications (§7).
- Does not update `docs/AGENTS.md:55` `MONITORING_BASELINE.md` broken-path reference — tracked in `docs/NEXT_STEPS.md` 2026-04-20.

## 12. Next step

Run `/codex-review` on the policy + tooling diff produced alongside this audit. No archive batch starts until that review lands and the session owner approves.
