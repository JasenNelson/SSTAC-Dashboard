# Stream D Merge Readiness Checklist
# Branch: feat/stream-d-catalog-agent-scaffold
# Authored: 2026-05-28 (worktree stream-a, read-only analysis)

---

## 1. Executive Summary

Stream D completed 12 commits on `feat/stream-d-catalog-agent-scaffold` and has reached
MERGE-READY-PENDING-SIGNOFF status. The branch tip is `58fa4df`. A `git merge-tree
--write-tree` dry-run against current `origin/main` (`f970064`) returned exit code 0 --
clean merge, no conflicts. The branch and main touched disjoint file sets throughout.

One gate caveat: commit `02dcc2d` (the final code commit, 1 ahead of the gate-GREEN
`e953df4`) added `.tsx` route files (`AdminDashboardClient.tsx`,
`catalog-staging-review/page.tsx`, `catalog-staging-review-rbac.spec.ts`). These were
committed after the e953df4 GREEN gates. Full gate re-run on `58fa4df` is required for
strict push-protocol compliance before merge. HITL items H3-H6 are pending but do NOT
block the PR merge.

---

## 2. Commit Roll-Up (12 commits, oldest first)

  27df8e6  Sub-task 2 -- Supabase exploratory SQL + HITL pause
  617f132  Sub-task 3 -- catalog_extraction_staging migration (HITL queue)
  6efb614  Sub-task 4 -- catalog-overnight scaffold (Docling+Ollama+psycopg harness)
  32db060  Sub-task 5 -- catalog/staging.ts helpers + RPC + tests
  9dc6f6d  Sub-task 6 -- CatalogStagingReview HITL approval pane
  e953df4  Sub-task 7 -- design doc + holistic codex fixes  [GATE-GREEN on this SHA]
  1dc17e5  Sub-task 8 session-end -- COMPLETED_GREEN summary
  b111fb6  HITL exploratory SQL OUTPUT in -- 3 catalog tables MISSING
  7658271  walk back "missing tables" claim to PENDING VERIFICATION
  3c0823c  missing-tables finding CONFIRMED via pg_class + UNION ALL
  58fa4df  migrations for the 3 missing catalog tables
  02dcc2d  mount CatalogStagingReview at /admin/catalog-staging-review  [BRANCH TIP]

Note on ordering: `1dc17e5` through `3c0823c` are doc-only updates to
STREAM_D_PROGRESS_2026_05_27.md, STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md, and
docs/STREAM_D_AUTONOMOUS_AGENT.md. Commits `58fa4df` and `02dcc2d` are substantive: 3
new SQL migrations and .tsx route mounting respectively.

---

## 3. Conflict Analysis vs Current origin/main

### Method

  git merge-tree --write-tree origin/main origin/feat/stream-d-catalog-agent-scaffold

Result: tree SHA `dc77b417d56f8a6e3488ff7687879de49d2770e3`, exit code 0.
CLEAN MERGE. No conflict markers.

### Why clean

Stream D changed (21 files total):
  supabase/migrations/20260527000004_catalog_extraction_staging.sql
  supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql
  supabase/migrations/20260527000006_catalog_sources.sql
  supabase/migrations/20260527000007_catalog_evidence_items.sql
  supabase/migrations/20260527000008_source_lead_triage.sql
  src/lib/catalog/staging.ts + __tests__/staging.test.ts
  src/components/matrix-options/CatalogStagingReview.tsx + __tests__/
  src/app/(dashboard)/admin/AdminDashboardClient.tsx  [NEW .tsx post-e953df4]
  src/app/(dashboard)/admin/catalog-staging-review/page.tsx  [NEW .tsx post-e953df4]
  e2e/catalog-staging-review-rbac.spec.ts  [NEW post-e953df4]
  scripts/catalog-overnight/ (4 files)
  docs/STREAM_D_AUTONOMOUS_AGENT.md
  STREAM_D_PROGRESS_2026_05_27.md
  STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md

origin/main 4-commit delta changed (15 files):
  matrix_research/content_drafts/The_Guide.md
  matrix_research/content_drafts/CaseStudy_BSAF.md
  matrix_research/content_drafts/CaseStudy_EqP_AVS.md
  matrix_research/content_drafts/Framework_HumanHealth.md
  docs/STREAM_B_ETL_REFRESH_DESIGN.md
  docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md
  AUTONOMOUS_SESSION_SUMMARY_2026_05_27.md
  OTHER_2026_TABS_ASSESSMENT_2026_05_27.md
  PHASE_3_TRANSITION_DRAFT_2026_05_28.md
  STREAM_D_HITL_OWNER_CHECKLIST_2026_05_28.md
  STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md  [OVERLAP -- see below]

One file overlaps: `STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md`.
Stream D updated this file heavily (b111fb6, 7658271, 3c0823c). origin/main commit
`be19812` also touched it (caveat additions by parent session). Despite the overlap the
merge-tree result is clean -- git resolved the 3-way merge without conflict. No manual
resolution required.

---

## 4. Gate Re-Confirmation Needed on 58fa4df

### What changed after the gate-GREEN SHA (e953df4)

  02dcc2d  +135 lines: AdminDashboardClient.tsx (nav entry), admin route page.tsx,
           catalog-staging-review-rbac.spec.ts (16-line e2e spec)
  58fa4df  +372 lines: 3 SQL migration files only (00006, 00007, 00008)
  3c0823c / 7658271 / b111fb6 / 1dc17e5: .md doc updates only

### Gate assessment

  Lint:         REQUIRED to re-run. Two .tsx files added in 02dcc2d. Low risk of new
                lint errors (they are small route + nav files), but strict push-protocol
                requires actual GREEN, not "probably fine."

  Unit tests:   REQUIRED to re-run. CatalogStagingReview was already tested; the new
                route page.tsx is a thin wrapper and 00006-00008 are SQL-only. Low risk
                of regression, but strict push-protocol requires actual GREEN.

  Build:        REQUIRED to re-run. AdminDashboardClient.tsx and the new route page.tsx
                are Next.js source files; a broken import or type error would surface
                here. Low risk, but required.

  E2E:          REQUIRED to re-run. catalog-staging-review-rbac.spec.ts is a new e2e
                spec that was added in 02dcc2d. It must pass (or be explicitly waivered
                by owner with documented rationale) before push.

### Acceptable shortcut (document if taken)

If owner wants to skip re-run: the only .ts/.tsx code change after e953df4 is
02dcc2d (small nav entry + thin route wrapper + 16-line e2e spec; no logic).
Owner may declare a documented waiver: "02dcc2d is navigation wiring only; e953df4
gates were GREEN on the substantive logic; I waive re-run on branch tip." This is
OWNER-INITIATED WAIVERED, which is acceptable under the push-protocol rule. It is NOT a
default -- it must be stated explicitly.

Recommendation: re-run all 4 gates. The branch is clean and the risk is low. Takes
under 5 minutes. Eliminates any ambiguity before merge.

---

## 5. HITL Pre-Merge Items

Per STREAM_D_HITL_OWNER_CHECKLIST_2026_05_28.md (on origin/main at be19812/a8bdde3).

  H1 -- Exploratory SQL OUTPUT populated          RESOLVED (b111fb6 + 3c0823c confirmed)
  H2 -- Apply migrations 00004 + 00005            CONFIRMED (per latest session update)
  H3 -- .venv setup + 16 pytest tests             PENDING -- does NOT block PR merge
  H4 -- run-scheduled.ps1 credential wrapper      PENDING -- does NOT block PR merge
  H5 -- Cadence + design-doc open questions       PENDING -- does NOT block PR merge
  H6 -- First real run (Zotero + Ollama live)     PENDING -- does NOT block PR merge

Missing-table migrations (00006, 00007, 00008) are authored in 58fa4df. Per
PHASE_3_TRANSITION_DRAFT_2026_05_28.md Section 4:
  Option A: apply now to Supabase Studio (unblocks full staging-row approve flow for
            evidence_item and source_lead proposed kinds immediately post-merge)
  Option B: defer until H6 first real run

Owner decision pending. Does NOT block the PR merge itself -- the migrations are in the
repo and will merge with the branch regardless of when they are applied to Supabase.

---

## 6. Merge Procedure

Run from the shared SSTAC-Dashboard checkout (C:\Projects\SSTAC-Dashboard).
WAIT until Stream D session has explicitly signed off before touching the shared tree.

```powershell
# Step 1: re-run gates on 58fa4df (strict compliance)
# Switch to Stream D branch on shared checkout
git -C C:/Projects/SSTAC-Dashboard checkout feat/stream-d-catalog-agent-scaffold

cd C:/Projects/SSTAC-Dashboard

npm run lint
.venv/Scripts/python.exe -m pytest scripts/catalog-overnight/tests/ -q  # python gate
npx vitest run --pool=forks --maxWorkers=1                                # unit gate
npm run build                                                             # build gate
npx playwright test e2e/catalog-staging-review-rbac.spec.ts              # e2e gate

# Step 2: open PR if not already open
gh pr create \
  --base main \
  --head feat/stream-d-catalog-agent-scaffold \
  --title "feat(catalog): Stream D catalog agent scaffold + HITL staging queue" \
  --draft

# Step 3: when gates GREEN and owner ready to merge
gh pr merge <PR_NUM> --merge --delete-branch
# Rationale for --merge over --squash: 12 commits have distinct semantic value
# (scaffold, migration, tests, design doc, codex fixes, missing-table SQL).
# Squash collapses them into one blob. --merge preserves the audit trail.
# Owner may prefer --squash for a cleaner main history; both are valid.
```

---

## 7. Post-Merge Tasks

In priority order:

  1. Missing-table migrations decision (Section 4 of PHASE_3_TRANSITION_DRAFT_2026_05_28.md).
     If Option A: paste 00006, 00007, 00008 into Supabase Studio SQL Editor in order.
     Verify with: SELECT table_name FROM information_schema.tables WHERE table_schema='public'
     AND table_name IN ('catalog_sources','catalog_evidence_items','source_lead_triage');

  2. The Guide Section 6 caveat update.
     Three workflows (source registration, source-locator entry, source-lead triage)
     carry a "Persistence status" caveat paragraph added in be19812 because the backing
     tables were missing at the time. Once migrations 00006-00008 are applied (if
     Option A), remove those caveat paragraphs and update the workflow language to
     unambiguous "shipped" framing. Single targeted edit to
     matrix_research/content_drafts/The_Guide.md; no other files affected.

  3. Stream A codex re-review queue entry.
     Commits 73176c5..526dfaa (Stream A The Guide work) have an open Opus-fallback
     review entry on the codex re-review queue. Codex CLI failed twice on network
     errors during that session; Opus subagent fallback was used per standing directive.
     Dispose: run codex CLI when available, or close with Opus-GREEN-documented rationale
     per owner directive. Non-blocking for Stream D merge.

  4. STREAM_D_AUTONOMOUS_12H_PROMPT template Sub-task 1 worktree rule update.
     The L0 CLAUDE.md 1.15 worktree rule should be reflected in the template. File is
     untracked on the shared tree. Defer until owner authorizes the edit; do NOT touch
     untracked files on the shared tree without owner approval.

---

## 8. Risk Assessment

  Merge conflict probability:        LOW
    merge-tree --write-tree returned exit 0. Only one file overlapped
    (STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md) and it resolved cleanly.

  Gate re-confirmation risk on 58fa4df:  LOW-MEDIUM
    02dcc2d added .tsx files after e953df4 GREEN. The files are thin wiring (nav entry +
    route wrapper + 16-line e2e spec). Risk of new lint/type errors is low, but the
    e2e spec is new and untested on 58fa4df tip. Cannot declare GREEN without running.

  Production impact of merge:        LOW
    CatalogStagingReview is wired to /admin/catalog-staging-review but is NOT linked
    from any public-facing route. AdminDashboardClient.tsx adds a nav entry visible
    only to admin role. The overnight script is inert until credentials are configured
    (H4). Migrations 00004+00005 are already applied; 00006-00008 are deferred.

  Missing-table migrations application risk:  LOW
    Migrations 00006-00008 are idempotent and codex-reviewed per 58fa4df commit message.
    TS row shapes (catalog_sources, catalog_evidence_items, source_lead_triage) were
    authored to match the SQL. Applying in order should be safe. Standard Supabase SQL
    Editor verification applies (paste output back to confirm row counts).

---

## 9. Quick-Action Summary

  [ ] Stream D session signed off (owner confirms window closed / session exited)
  [ ] Verify merge is still clean: git merge-tree --write-tree origin/main origin/feat/stream-d-catalog-agent-scaffold (expect exit 0)
  [ ] Re-run 4 gates on 58fa4df (lint + unit + build + e2e) OR declare owner waiver for 02dcc2d wiring-only commit
  [ ] gh pr merge <PR_NUM> --merge --delete-branch (or --squash per owner preference)
  [ ] Apply missing-table migrations 00006+00007+00008 if Option A chosen; remove The Guide caveat paragraphs once applied

---

*Authored 2026-05-28 from C:\Projects\SSTAC-Dashboard-worktree-stream-a (main).*
*Read-only analysis: no merges, no pushes, no branch operations performed.*
*Conflict check method: git merge-tree --write-tree origin/main origin/feat/stream-d-catalog-agent-scaffold -- exit code 0 (clean).*
