# Matrix Options Completion Status (2026-07-11)

## 0. CONTINUATION UPDATE (2026-07-11d)

Section 1's "Base SHA a5ac86a" and its PR list (#595-#603) are STALE as of this update. Current
truth, verified against `origin/main` on the `docs/mo-cleanup-map-report-2026-07-11` worktree:

- Base: `origin/main` is now at `a86414d` (the tip when this update was written).
- #595 through #606 are all MERGED (this supersedes the "#595-#603 SHIPPED, owner merges" framing
  in section 1 -- they have already been merged). This includes, beyond section 1's original list:
  #604 (chore: cap migration history), #605 (feat: audited DRA publication flow, admin-only,
  single-DRA, via `flip_dra_public`), and #606 (feat: matrix-map health cap/pagination readiness
  observability).
- Map cap: the RPC cap SQL from HITL item 1 (CAP_MIGRATION_OWNER_PACKET.md) has been APPLIED in
  production -- the cap is now 5000 (was 2500).
- DRA publication flow: BUILT (#605, addresses HITL item 2) -- admin-only, single-DRA, via
  `flip_dra_public`. As of this update, 0 DRAs have actually been published through the flow (574
  private / 0 public remains the live data state; the flow existing and DRAs being published are
  two different facts -- do not conflate them).
- Catalog / IRIS: US-EPA IRIS buildout remains COMPLETE per section 2 Goal 3 (0 true orphans; T24
  moot). No change since section 1.
- Inhalation: still scaffold-only. PR #610 (open) reserves the VF/PEF input fields fail-closed,
  pending the model decision (HITL item 3) -- this is scaffolding, not a working inhalation pathway.

Section 3 (HITL QUEUE) below remains the canonical open owner-decision queue; items 2 (DRA
publication) and part of item 1 (cap-apply) are now RESOLVED per this update -- see the section 3
item text for status where marked. Items not marked resolved below are still open. Newly-surfaced
items since section 3 was written are appended at the end of section 3.

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
1. CAP-SQL apply 2500->5000: RESOLVED 2026-07-11d -- SQL from CAP_MIGRATION_OWNER_PACKET.md has been
   APPLIED in production; the cap is now 5000. No further action.
2. Approve BUILDING the audited DRA publication flow: RESOLVED 2026-07-11d -- flow BUILT (#605,
   admin-only, single-DRA, via `flip_dra_public`, merged). Remaining is a data-state fact, not a
   decision: 0 DRAs have actually been published through the flow yet (574 private / 0 public).
3. Inhalation model decision (packet in #597): Name the VF/PEF anchor guidance (EPA J&E/RAGS Part F vs Health Canada vs BC) + pick option A dynamic / B user-supplied / C hardcoded (engineering recommendation = B first). Plus the T33 unit-basis (per-ug/m3 vs per-mg/m3, x1000) settle.
4. Catalog arbitration: 15 candidate-group conflicts + 20 supersede-or-reject + the 351 Protocol-28 verify-vs-primary sweep. Then owner runs promote-*.mjs --apply for approved rows (AI never applies).
5. RLS-bypass gap: dras_admin_all still permits an un-audited direct UPDATE dras SET public -- tighten now (follow-up migration/trigger) vs accept documented gap for v1.
6. SECURITY FLAG (out of MO core lane; surface only): api/graphs/prioritization-matrix GET is PUBLIC and returns authenticated users' raw user_id UUIDs + individual poll votes (CEW pseudonymized, authenticated NOT). Poll-system route -> strict POLLING_GATE + owner decision. Plus milestones GET has no in-route auth (RLS-only) -- hardening inconsistency.
7. Broader prior-session MO decisions still open (cross-ref docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md + the cumulative D1-D4 anchors in the 07-07 handoff): confirm cadmium/methylmercury current_defaults;
   D1 dioxin TEQ promote / D2 BaP anchor+ADAF / D3 PCB Option A.
   - RESOLVED 2026-07-11d (verified in code): `phenylmercuric_acetate` class -- wired as `organic` in
     `src/lib/matrix-options/substanceLibrary.ts` (see docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md
     item 2 for detail). No longer an open owner decision.
   - RESOLVED 2026-07-11d (verified in code): D4 BC PAH scheme remap -- `RPF_SCHEME_BY_AUTHORITY['bc-csr']
     = 'ccme-2010'` is ALREADY LIVE in `src/lib/matrix-options/cumulative.ts` (the code comment there
     cites "D4 remap, BC TG-7 2017"; `who-1998-pah` is retained only as inert `RPF_SCHEME_SCORING_BLOCKED`
     safety, unused by any authority mapping). No longer an open owner decision. D1-D3 remain open.
8. MEASUREMENT-LOAD GAP (T16 live finding): 88.6% of the 4494 loaded samples have zero attached measurements; only 503 samples carry sediment measurements. To put "significantly more sediment data" on the map, decide the measurement/undated-events load (~6742 measurements, prior HITL item T12) -- owner yes/no. Separately, waterbody_type is 93.55% empty (limits filtering) -- decide a source/derivation lane. The casing dupes (Marine 243/marine 25 -> Marine 268; Freshwater 8/freshwater 14 -> Freshwater 22) are a deterministic 33-row fix, but it is a DATA WRITE -> owner-run (proposed UPDATE SQL in docs/design/matrix-map/WATERBODY_TYPE_NORMALIZATION_2026_07_11.md, report T18).
9. NEW (2026-07-11d) -- authenticated non-admin peer-visibility scope: 37a (PR #608, open) closed the
   anonymous/public leak + cache-poisoning vectors on `api/graphs/prioritization-matrix` GET. A narrower
   question remains open (37b): should AUTHENTICATED non-admin users be able to see individual peer
   `user_id`s at all via that endpoint, or should peer identities be aggregated/redacted even for
   authenticated non-admin callers? Owner call; scope is narrower than 37a (auth is already required
   post-#608), the question is about the granularity of what an authenticated peer sees.
10. NEW (2026-07-11d) -- hitl-packets under-protection: `/api/hitl-packets/*` routes
    (`route.ts`, `[sessionId]/route.ts`, `[sessionId]/csv/route.ts`, `[sessionId]/md/route.ts`) are
    authed-only (any logged-in user passes `getAuthenticatedUser`) with no reviewer/admin role gate --
    confirmed by reading `src/app/api/hitl-packets/route.ts` (checks `user` is non-null, does not check
    role). Documented in the guard-role-model audit at `docs/design/MO_GUARD_ROLE_MODEL_AUDIT_2026_07_11.md`
    which is PENDING PR #609 (open, not yet on origin/main as of this update) -- reference it as pending
    PR #609 until merged. Owner call after verifying HITL-packet RLS/content sensitivity: leave
    authed-only vs add a reviewer/admin role gate.
11. NEW (2026-07-11d) -- Inhalation VF/PEF model decision (Option A dynamic / B user-supplied /
    C hardcoded) + T33 unit-basis (per-ug/m3 vs per-mg/m3, x1000) -- still owner-gated (duplicate of
    item 3 above; the input-field shell shipped in PR #610, open, fail-closed pending this decision).
    No functional inhalation pathway exists yet.

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
