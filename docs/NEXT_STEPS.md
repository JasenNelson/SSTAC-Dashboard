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

### 2026-07-06 -- MO provenance guards shipped; owner-gated lanes re-grounded

Session shipped PRs #522/#523/#524/#525 (two detection-only provenance guards + zinc/mn tension flags
+ handoff). Re-grounded the three owner-gated lanes from the 2026-07-01/07-05 planning docs against the
current catalog and found them ~90% already executed. Genuinely-open items are captured as an owner
decision packet: `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`. Deferred (owner decisions):
- **Lane 2 HC TRV v4.0 re-verification -- RESOLVED 2026-07-06.** Owner supplied the canonical HC 2025
  PDF (`G:\My Drive\SABCS - Sediment Project\References\HC 2025 - Toxicological Reference Values TRV.pdf`).
  Re-extraction is byte-identical to the committed table (0 drift) and the crosscheck found 0 value
  errors across 111 HC rows (107 MATCH / 0 MISMATCH / 4 AMBIGUOUS: 1 benign + the 3 already-flagged
  population/value tensions). See `docs/MATRIX_OPTIONS_HC_V4_REVERIFICATION_LEDGER_2026_07_06.md`.
  Residual (small, non-blocking): parameterize the extractor's hardcoded `pdf_path`; stamp the PDF
  locator into HC rows' evidence items in a later owner-attested pass.
- **`dichlorobenzene_1_2` current_default** is IRIS-1989 0.09 but the recency rule wants HC-2025 0.43 --
  a real inconsistency awaiting an owner newer-vs-more-protective call.
- **PCB policy** (`total_pcbs_aroclor_1254` default + `pcbs_non_coplanar` wiring) and
  **`phenylmercuric_acetate`** ContaminantClass -- policy decisions, not build gaps.
- Confirm-after-fact: cadmium 0.0008 + methylmercury 0.0002 current_defaults (applied despite a hold
  flag; picks defensible). benzo_a_pyrene remains HELD.
- **Future catalog source to ingest (owner-flagged 2026-07-06):** `2026 Ontario MECP TRVs.zip` at
  `G:\My Drive\SABCS - Sediment Project\References\2026 Ontario MECP TRVs.zip` -- add Ontario MECP TRVs
  + other parameters to the catalog in a later lane (per-source provenance, needs_review-then-promote,
  same discipline as HC/EPA). Not started.

### 2026-07-04 -- From the MO current_default / provenance-guard lane

Surfaced during the current_default selection + provenance-guard session (PRs #512-#515; #516 closed
unmerged). See docs/LESSONS.md 2026-07-04 entry and the session handoff (#515).

- **HC v4.0 (2025) catalog-wide re-confirmation -- CORRECTED and COMPLETED 2026-07-06.** The original
  framing here (HC values extracted from a now-dead canada.ca page, unverifiable) was WRONG: the real
  source PDF (`C:\Users\jasen\Downloads\HC 2025 - Toxicological Reference Values TRV.pdf`) still exists
  and was the actual source of the original May 2026 extraction. Worse: #513's chlorobenzene "fix,"
  cited here as evidence the mis-file class was real, turned out to be based on an unverified theory --
  direct PDF verification (2026-07-06, confirmed independently twice) shows chlorobenzene's 0.43 Oral
  TDI was never actually wrong. A row-level, type-and-qualifier-aware catalog-wide cross-check of all
  111 HC-v4.0-sourced rows against the real PDF is now COMPLETE -- see
  `docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md`: **zero confirmed catalog errors found**
  beyond chlorobenzene (already corrected). 6 rows remain AMBIGUOUS (genuine source-document
  population/exposure-scenario variants the catalog doesn't yet disambiguate -- zinc age-stratified UL,
  methylmercury/vinyl_chloride population variants, one benign manganese extractor quirk); none require
  a catalog edit. #513's chlorobenzene review_notes/qa_status are corrected; any `current_default`
  change is deferred to owner sign-off per the no-default-promotion rule.
- **Owner-gated value decisions still open:** benzo_a_pyrene (HELD), phenylmercuric_acetate (organomercury),
  PCBs (overlap w/ total_pcbs_aroclor_1254), and ~22 jurisdiction-conflict current_default picks. These
  need owner judgment (source priority / receptor), not autonomous promotion.
- **1,2-DCB is NOT quarantined.** #516's quarantine was wrong (based on superseded HC 2010); do not
  re-open a 1,2-DCB quarantine without a CURRENT (v4.0) source justification.
- **Manifest vitest fact -- RESOLVED via PR #517 (2026-07-05b).** facts.testing.vitest_test_count is now
  5080 on main, with the prior 5019 snapshot correctly moved to facts_history. No action needed.

### 2026-06-02 -- From the engine_v2 S4 Tier-explainer neutralization pass

Deferred during the memo Tier-explainer neutralization (the pass that reworded the
`src/lib/engine-v2/memo_builder.ts` Tier explainers so no memo claims tier-scaled AI
authority, and made the memo cache regenerate on a generator-version bump). See
`docs/engine_v2_frontend_s4_read_side_handoff_2026_06_02.md`.

- **Legacy memo column-header wording ("AI Suggestion" / "AI Flag") leans determination-voice.**
  For legacy 0.0.1 memos the builder still prints the column headers "AI Suggestion" (Tier 1)
  and "AI Flag" (Tier 2); the 0.1.0 evidence-status path already uses the neutral "AI Evidence
  Signal" header. Relabelling the legacy headers (for example to "AI signal (legacy)") is a
  small, separable cleanup that was deliberately scoped out of the neutralization pass -- that
  pass corrected the explainer prose across both schema versions but left the legacy data-shape
  headers untouched to avoid changing the legacy render path.
  - **Source:** Tier-explainer redesign memo (`engine_v2/docs/MEMO_TIER_EXPLAINER_REDESIGN_2026_06_02.md`) section 4.2; 2026-06-02 S4 lane.

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
