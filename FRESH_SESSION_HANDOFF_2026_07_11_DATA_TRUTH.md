# FRESH SESSION HANDOFF -- 2026-07-11 (DATA-TRUTH run)

Continuity anchor for the next session. Baseline: origin/main = 4506a4e at run start.
Plan executed: ~/.claude/plans/claude-mode-autonomous-multi-hour-glistening-tide.md
(DATA-TRUTH-FIRST 15h). Durable data-truth record: `docs/MATRIX_MAP_STATUS_2026_07_11.md`.

## What shipped / changed this run
- **Phase 0 (pre-authorized):** removed repo secrets E2E_TEST_EMAIL + E2E_TEST_PASSWORD
  (verified absent); closed PR #590 (R14 proof, no merge). #579 left OPEN with a close
  RECOMMENDATION only (superseded by #580 merged c275d72 + #590).
- **PR #591 (feat/matrix-map-health-reviewer-visibility-2026-07-11):** admin health-page
  "Reviewer effective visibility" indicator (derived visible-vs-hidden sample counts +
  0-public-DRA warning). Gates GREEN (lint 0 / test:ci 282 / build exit0 / e2e 120-93). codex
  GREEN (1 P3 fixed). CI: check status (`gh pr checks 591`).
- **STAGED, OWNER-GATED (NOT PR'd):** migration
  `supabase/migrations/20260711000001_matrix_map_fetch_samples_pagination.sql` -- raises the
  fetch RPC cap 2500->5000 (CREATE OR REPLACE, preserves owner/grants). codex GREEN. Lives
  untracked in the data-truth worktree. NO PR/apply until owner approves the SQL path
  (migration guard) -> owner applies via Supabase SQL Editor.

## Data-truth findings (raw SQL, verified 2026-07-11) -- see MATRIX_MAP_STATUS
- 574 DRAs all private, 0 grants -> 55 members see 0 samples; 4 admins see 2500 of 4486 (capped).
- 98.5% of points are BC-CSR upland centroids (medium tier), 1.5% surveyed; 4494 -> 187 distinct
  coords; one centroid = 476 stations. No coordinate corruption; honest provenance.
- ETL idempotent (0 dup keys); RLS/grants/audit applied; 8 orphan samples (79 measurements)
  invisible; undated (~6742) + junk (~3478) excluded pre-load. Backup schema matrix_map_backup
  _20260624 exists.

## Corrected plan assumptions (ground truth)
- T14 truncation banner + T19 tier-based provenance markers/legend ALREADY EXIST (no code needed).
- T16 spatial-oracle: SAFE (hidden aggregate is province-wide).
- T31 Phase C: `.tmp_pqra_v4.pdf` is NOT on disk -> hc-pqra-v3 cannot be vision-verified; owner
  must supply the HC PQRA v3 PDF.
- T36 inhalation: RfC inputs exist (188 rows), IUR has a per-ug vs per-mg unit mismatch, and NO
  sediment->air transport-model spec exists on origin/main -> stays a fail-closed STUB + scope
  packet (NO fabricated regulatory formula). Possible prior art on unmerged agy-mo-inhalation /
  mo-unit3-inhalation branches.
- T20 stats guard: NOT built autonomously -- excluding centroid rows would drop 98.5% of valid
  CHEMISTRY from stats (coordinate accuracy != measurement validity). Owner design question.
- T09 RBAC specs: authorable skip-safe but NOT authenticated-provable (secrets removed) until
  owner decides a standing gate (T08).

## OWNER-DECISION PACKET (present once) -- 9 items
1. Map publication scope + path (flip_dra_public needs admin JWT; SQL-Editor bulk bypasses audit).
2. Approve the 2500->5000 cap migration (SQL-Editor apply).
3. R14 standing auth-E2E gate model (default: none; secrets stay removed).
4. ETL: load undated (~6742)? attach/unhide 8 orphans? drop backup schema?
5. Phase C: supply HC PQRA v3 + EPA-2010-draft PDFs (or defer).
6. Pin the BC 5-PAH subset (unblocks who-1998-pah).
7. MO catalog needs_review (468 items) promote/hold decisions.
8. Inhalation: supply the exposure-model source (or surface unmerged-branch packet).
9. Worktree/scratch cleanup (49 worktrees; 33 merged, 14 stale) -- junction-safe removal.

## Next session start
Read docs/MATRIX_MAP_STATUS_2026_07_11.md + this handoff. The cap migration + owner packet are
the primary owner-gated next actions. All data mutation, DRA publication, catalog changes,
migration application, worktree deletion, and merges remain owner-gated.
Claude-token spend risk for next step: low. AGY delegation opportunity: yes (code units when unblocked).
