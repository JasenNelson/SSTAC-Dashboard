# Matrix Options Completion Status (2026-07-11)

## 1. Purpose + Date + Base SHA + Shipped PRs
Purpose: Single canonical status of the 15h Matrix Options completion push -- what shipped, what remains
(autonomous-continuable vs owner-gated), and the consolidated HITL owner-decision queue.
Date: 2026-07-11
Base SHA: origin/main a5ac86a

PRs SHIPPED (all OPEN, owner merges after CI green):
- #595 docs: cap-migration owner packet (docs/design/matrix-map/CAP_MIGRATION_OWNER_PACKET.md + MAP_ACCESS_DIAGNOSIS.md + MAP_CAP_PAGINATION_SPEC.md). Raises RPC cap 2500->5000; OWNER applies SQL.
- #596 test: matrix-map RPC-contract + spatial-oracle client-boundary coverage (fetch-samples-server.test.ts).
- #597 docs: two owner-decision design packets -- inhalation model (T34) + DRA publication path (T01).
- #598 feat: Matrix Options calculator UI/UX polish (display-only: focus rings, blocked-state transparency, aria-hidden icons, label/unit consistency). 405/405 component tests, full gate GREEN.
- #599 docs: THIS status doc + consolidated HITL queue + fresh handoff; also absorbed T16 coordinate QA + T18 waterbody normalization + T23 IRIS recon (data-truth docs).
- #600 feat: matrix-map "Surveyed only" filter toggle + province provenance chip (T17). Full gate GREEN; codex-hardened over 3 rounds (a build-breaker + a selection-interaction bug caught + fixed).
- #601 feat: matrix-map health "Data freshness" section (T05/T15) -- snapshot version (MAX samples.updated_at) + last-ETL (service_role_audit). Full gate GREEN.
- #602 feat: calculator interaction + a11y polish (U1 batch C: reset placement + explicit label, radiogroup arrow-key nav, provisional-badge aria-describedby). STACKED on #598; full gate GREEN; codex-hardened.
- #603 test: middleware regression guards (T45) -- protected-route matcher + unauthenticated-redirect + security headers. Test-only; middleware.ts untouched. test:ci + codex GREEN.

CLOSED: #579 (superseded by #580 durable skip-safe E2E).

## 2. STATUS BY GOAL

### Goal 1: Calculator + UI/UX
- DONE this run: 4 live calculators (HHDirectContact/HHFoodWeb/EcoDirectEqP/EcoFoodBSAF) all functional + fail-closed with robust blocked-render tests (T31 already covered -- no work needed). UI/UX polish (focus rings, blocked-state transparency, aria-hidden icons, label/unit consistency) shipped in #598. Cumulative TEQ/BaP-eq reducers exist (HEADLESS). Inhalation is scaffold-only.
- REMAINING (autonomous-continuable): More UI polish (U1 batch C interaction/microcopy + the P1-3 mobile side-panel gate), fail-closed audit sweep (T32).
- REMAINING (owner-gated): Inhalation model decision (T34), T33 unit-basis settle, A3b cumulative UI.

### Goal 2: Map Data
- DONE this run: cap-migration owner packet generated (#595), RPC-contract + spatial-oracle client-boundary coverage tested (#596), coordinate/sediment provenance QA on LIVE data (T16 -> docs/design/matrix-map/COORDINATE_PROVENANCE_QA_2026_07_11.md).
- T16 LIVE FINDINGS (2026-07-11): 4494 samples / 574 DRAs, 100% have lat/lng; 98.49% are BC-CSR CENTROIDS (only 1.51% surveyed); of 503 sediment-bearing samples, 92% are centroid. waterbody_type is 93.55% empty with casing dupes (Marine 243 vs marine 25; Freshwater 8 vs freshwater 14). 88.6% of samples (3982/4494) have ZERO attached measurements in the current load. 0 public / 574 private DRAs + 0 grants -> 0 samples visible to any non-admin (root cause of the empty member map).
- REMAINING (autonomous-continuable): waterbody_type casing normalization report (T18); health observability (T05/T15); marker UX (T17).
- REMAINING (owner-gated): CAP-SQL apply 2500->5000; MEASUREMENT-LOAD GAP -- 88.6% of samples have no measurements (relates to the undated-events ~6742-measurement load decision, HITL item 8); waterbody_type source/derivation to fix the 93.55%-empty filter limitation.

### Goal 3: Catalog
- DONE this run: Catalog coverage (T40, 425 substances) analyzed (rfd_oral 90.8%; sf_oral 15.8%; fcv_ug_per_L 1/425; bsaf 3/425; inhalation rfc/iur 0/425). 4 substances (Cr/Ni/Tl/V) fully empty; 17 zero human-health input. needs_review (T22) mapped: 393 rows (pv-p28-* 351, pv-iris-* 41, pv-hc-* 1). By input_key: oral RfD 280 / inhalation RfC 75 / inhalation IUR 22 / oral SF 15 / dioxin-TEQ TDI 1. Data integrity clean (0 missing source_id).
- DONE this run (added): US-EPA IRIS buildout is COMPLETE (T23 -> docs/MATRIX_OPTIONS_IRIS_ORPHAN_RECON_2026_07_11.md): 0 true orphans; source Chemicals_Details.xlsx already fully absorbed by a prior ~1020-row load; 1107 IRIS records (1066 approved / 41 needs_review, all intentional dupe-group alternates). T24 (IRIS staging) is therefore MOOT -- nothing to stage.
- REMAINING (autonomous-continuable): none for IRIS (complete). Catalog buildout now = owner judgment.
- REMAINING (owner-gated): Catalog arbitration (15 candidate-group conflicts incl. the 41 IRIS dupe-group canonical choices, 20 supersede-or-reject, 351 Protocol-28 verify-vs-primary sweep). Owner runs promote-*.mjs --apply for approved rows.

### Goal 4: RBAC/Docs
- DONE this run: Guard audit (T44) completed: 71 API routes; 42 requireAdmin; 47/71 admin-equivalent; 7 public; secrets only NEXT_PUBLIC_SUPABASE_* (E2E_TEST_* absent -> skip-safe e2e baseline 120 pass/93 skip holds). Two owner-decision design packets drafted (#597).
- REMAINING (autonomous-continuable): Health observability (T05/T15), middleware regression TESTS (T45, no middleware edit).
- REMAINING (owner-gated): Approve BUILDING the audited DRA publication flow, RLS-bypass gap decision, strict POLLING_GATE + owner decision for api/graphs/prioritization-matrix.

## 3. HITL QUEUE
1. CAP-SQL apply 2500->5000: Owner pastes CAP_MIGRATION_OWNER_PACKET.md SQL in Supabase SQL Editor (agent SQL writes forbidden). Pre/post verify queries are in the packet.
2. Approve BUILDING the audited DRA publication flow: Design in #597; needs a strategic /codex-review + the owner to insert a matrix_admin user_roles row; v1 = single-DRA, no bulk.
3. Inhalation model decision (packet in #597): Name the VF/PEF anchor guidance (EPA J&E/RAGS Part F vs Health Canada vs BC) + pick option A dynamic / B user-supplied / C hardcoded (engineering recommendation = B first). Plus the T33 unit-basis (per-ug/m3 vs per-mg/m3, x1000) settle.
4. Catalog arbitration: 15 candidate-group conflicts + 20 supersede-or-reject + the 351 Protocol-28 verify-vs-primary sweep. Then owner runs promote-*.mjs --apply for approved rows (AI never applies).
5. RLS-bypass gap: dras_admin_all still permits an un-audited direct UPDATE dras SET public -- tighten now (follow-up migration/trigger) vs accept documented gap for v1.
6. SECURITY FLAG (out of MO core lane; surface only): api/graphs/prioritization-matrix GET is PUBLIC and returns authenticated users' raw user_id UUIDs + individual poll votes (CEW pseudonymized, authenticated NOT). Poll-system route -> strict POLLING_GATE + owner decision. Plus milestones GET has no in-route auth (RLS-only) -- hardening inconsistency.
7. Broader prior-session MO decisions still open (cross-ref docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md + the cumulative D1-D4 anchors in the 07-07 handoff): phenylmercuric_acetate class; confirm cadmium/methylmercury current_defaults; D1 dioxin TEQ promote / D2 BaP anchor+ADAF / D3 PCB Option A / D4 BC scheme remap.
8. MEASUREMENT-LOAD GAP (T16 live finding): 88.6% of the 4494 loaded samples have zero attached measurements; only 503 samples carry sediment measurements. To put "significantly more sediment data" on the map, decide the measurement/undated-events load (~6742 measurements, prior HITL item T12) -- owner yes/no. Separately, waterbody_type is 93.55% empty (limits filtering) -- decide a source/derivation lane. The casing dupes (Marine 243/marine 25 -> Marine 268; Freshwater 8/freshwater 14 -> Freshwater 22) are a deterministic 33-row fix, but it is a DATA WRITE -> owner-run (proposed UPDATE SQL in docs/design/matrix-map/WATERBODY_TYPE_NORMALIZATION_2026_07_11.md, report T18).

## 4. PART-3 UNLOCK MAP
- cap-migration follow-through PR <- CAP-SQL applied
- inhalation formulas + UI <- (3) decided + T33
- A3b cumulative UI <- D1-D4 + Phase C verified
- publication build <- (2) approved
- catalog promotions <- (4) arbitrated

## 5. REMAINING AUTONOMOUS PART-1
DONE this run: T16 coordinate QA (#599), T17 marker UX (#600), T05/T15 health obs (#601), T18 waterbody
report (#599), T23 IRIS recon (#599). T24 IRIS staging is MOOT (0 orphans).

DONE (added): U1 batch C interaction/a11y (#602, stacked on #598); middleware regression tests (T45, #603).

The clean non-HITL autonomous lane is now EXHAUSTED. Only these remain, both non-actionable autonomously:
- Fail-closed audit sweep (T32): effectively already covered -- all 4 calculators have robust
  blocked-render tests (confirmed in T31); a formal sweep would add ~0 tests. Skipped as no-yield.
- Calculator cross-check vs a PRIMARY worked example (T39): needs an owner-provided worked example
  (input->output) from HC/EPA methodology to verify against; none in-repo; will not fabricate one.
- P1-3 mobile side-panel gate (MatrixDashboard.tsx isToolMode): a larger responsive-shell change; left
  for a focused pass with a manual mobile smoke test (deferred, not blocked).
- #602 must be retargeted to main once #598 merges (stacked-PR housekeeping).
