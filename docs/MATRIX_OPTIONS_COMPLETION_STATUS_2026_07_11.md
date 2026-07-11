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

CLOSED: #579 (superseded by #580 durable skip-safe E2E).

## 2. STATUS BY GOAL

### Goal 1: Calculator + UI/UX
- DONE this run: 4 live calculators (HHDirectContact/HHFoodWeb/EcoDirectEqP/EcoFoodBSAF) all functional + fail-closed with robust blocked-render tests (T31 already covered -- no work needed). UI/UX polish (focus rings, blocked-state transparency, aria-hidden icons, label/unit consistency) shipped in #598. Cumulative TEQ/BaP-eq reducers exist (HEADLESS). Inhalation is scaffold-only.
- REMAINING (autonomous-continuable): More UI polish (U1 batch C interaction/microcopy + the P1-3 mobile side-panel gate), fail-closed audit sweep (T32).
- REMAINING (owner-gated): Inhalation model decision (T34), T33 unit-basis settle, A3b cumulative UI.

### Goal 2: Map Data
- DONE this run: cap-migration owner packet generated (#595), RPC-contract + spatial-oracle client-boundary coverage tested (#596).
- REMAINING (autonomous-continuable): Coordinate provenance QA (T16, needs Supabase read).
- REMAINING (owner-gated): CAP-SQL apply 2500->5000.

### Goal 3: Catalog
- DONE this run: Catalog coverage (T40, 425 substances) analyzed (rfd_oral 90.8%; sf_oral 15.8%; fcv_ug_per_L 1/425; bsaf 3/425; inhalation rfc/iur 0/425). 4 substances (Cr/Ni/Tl/V) fully empty; 17 zero human-health input. needs_review (T22) mapped: 393 rows (pv-p28-* 351, pv-iris-* 41, pv-hc-* 1). By input_key: oral RfD 280 / inhalation RfC 75 / inhalation IUR 22 / oral SF 15 / dioxin-TEQ TDI 1. Data integrity clean (0 missing source_id).
- REMAINING (autonomous-continuable): IRIS orphan staging (T24, no apply).
- REMAINING (owner-gated): Catalog arbitration (15 candidate-group conflicts, 20 supersede-or-reject, 351 Protocol-28 verify-vs-primary sweep). Owner runs promote-*.mjs --apply for approved rows.

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

## 4. PART-3 UNLOCK MAP
- cap-migration follow-through PR <- CAP-SQL applied
- inhalation formulas + UI <- (3) decided + T33
- A3b cumulative UI <- D1-D4 + Phase C verified
- publication build <- (2) approved
- catalog promotions <- (4) arbitrated

## 5. REMAINING AUTONOMOUS PART-1
- Coordinate provenance QA (T16, needs Supabase read)
- IRIS orphan staging (T24, no apply)
- Health observability (T05/T15)
- Marker/legend UX (T17)
- Middleware regression TESTS (T45, no middleware edit)
- More UI polish (U1 batch C interaction/microcopy + the P1-3 mobile side-panel gate)
- Fail-closed audit sweep (T32)
