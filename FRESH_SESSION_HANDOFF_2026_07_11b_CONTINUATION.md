# FRESH SESSION HANDOFF -- 2026-07-11b (DATA-TRUTH continuation)

Continues FRESH_SESSION_HANDOFF_2026_07_11_DATA_TRUTH.md (merged via #592). Baseline at write:
origin/main = 27f2d35 (after merging #592 + #591), main CI GREEN.
Durable data-truth record: docs/MATRIX_MAP_STATUS_2026_07_11.md.

## Landed this continuation
- **Merged (owner-authorized):** #592 (docs: MATRIX_MAP_STATUS + handoff) -> a4974df; #591
  (health-page reviewer-visibility indicator) -> main tip 27f2d35. Post-merge main CI run
  29151948047 = SUCCESS.
- **PR #593 (feat/matrix-map-honest-coordinate-provenance-2026-07-11):** honest coordinate-
  provenance labeling. New module src/lib/matrix-map/coordinate-provenance.ts (extracts the tier
  dash/label maps + adds honest captions) + 5 unit tests + MatrixMap popup caption + legend
  footnote. Gates GREEN (lint 0 / test:ci 283 / build exit0 / e2e 120-93). codex grind GREEN
  (zero findings). CI: see `gh pr checks 593`. Owner merges.

## Owner-gated, prepared (NO writes performed)
- **Cap migration apply packet:** CAP_MIGRATION_OWNER_PACKET.md (session scratch) -- exact
  CREATE-OR-REPLACE SQL raising fetch_samples_with_hidden_summary cap 2500->5000, pre/post-apply
  verification SQL, risk, rollback. Migration file staged (untracked) in the OLD worktree
  data-truth-2026-07-11 (md5 e296ac628323eaa6ee593045e112ed51). codex GREEN. Apply via Supabase
  SQL Editor after owner approval; then open the migration PR (migration guard).
- **RBAC E2E design packet:** RBAC_E2E_DESIGN_PACKET.md -- rewrite is skip-safe but NOT
  authenticated-provable until a standing-gate model + a non-admin member fixture exist (secrets
  removed). Do not merge an unproven RBAC rewrite.
- **9-item owner-decision packet:** OWNER_DECISION_PACKET.md (publication, cap apply, standing
  gate, ETL undated/orphan/backup, Phase C source PDFs, BC 5-PAH pin, catalog needs_review,
  inhalation source, worktree cleanup).

## Still owner-gated / blocked (unchanged)
- Publication (flip_dra_public needs admin JWT, not SQL Editor). Phase C hc-pqra-v3
  (.tmp_pqra_v4.pdf absent). Inhalation T36 (no transport-model spec -> stays stub). Catalog
  needs_review 468 items. Worktree cleanup (now more worktrees -- data-truth-2026-07-11 +
  data-truth-cont-2026-07-11 added this run; junction-safe removal only).

## State
Secrets: E2E_TEST_EMAIL/PASSWORD absent (only NEXT_PUBLIC_SUPABASE_*). #579 OPEN (close-rec
only); #590 CLOSED. Zero Supabase writes this run (read-only diagnostics only).
Claude-token spend risk for next step: low (remainder owner-gated). AGY delegation opportunity:
yes (RBAC specs + inhalation scaffolding when source lands; AGY drafted #591 + #593 this run).

## Next session
Owner decisions in OWNER_DECISION_PACKET + CAP_MIGRATION_OWNER_PACKET are the gating next actions.
Merge #593 (after CI green). Then owner-gated MO/Phase-C/inhalation once source material supplied.
