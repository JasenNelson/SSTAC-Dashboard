<!-- Generated 2026-07-13. Synthesis only -- no new analysis. Every fact below is copied/summarized
from the source docs named inline; nothing here was independently re-derived. Plain ASCII. -->

# Matrix Options -- Live Status (2026-07-13)

**This is the single entry-point status doc for Matrix Options.** Start here. It supersedes the
docs listed in section 5 as the first thing to read; those docs remain on disk as detail/evidence
references, not as competing entry points.

## 1. Current truth (as of 2026-07-13)

Catalog: **1779 rows** (parameter_values 106 + human_health_trv_values 1574 + eco_values 99) --
**468 needs_review / 83 current_default**. `origin/main` is at **df7db68** (merge of PR #620,
docs-only T32-applied source of truth). Two PRs are OPEN and pending owner merge: **#621** (Top-50
priority tasks doc, branch `docs/mo-top50-2026-07-13`) and **#622** (tonight's overnight
decision-support pack + coverage, branch `docs/mo-overnight-decision-support-2026-07-13`) --
neither has landed on `origin/main` yet, so anything sourced only from those branches (the Top-50
doc and the three 07-13 decision-support docs) is not yet on `main`. DRA publication baseline was
corrected THIS session (Top-50 doc, superseding the 07-11 completion-status "0 public / 574
private" claim): it is actually **3 public / 571 private** (a surveyed-coordinate pilot); IOCO
Shoreline (coordinate-safe, +6 samples) is queued as the 4th, pending owner approval + exact-call
codex review. Of the 07-12 owner-decision packet's 15 items, only **item 10 (T32 waterbody UPDATE)
has been applied**; everything else in that packet is still un-applied.

## 2. Lane status

| Lane | Status | Current pointer doc | Immediate next action |
|---|---|---|---|
| Catalog arbitration | OWNER-GATED | `MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md` sec A (+ null-risk audit for current_default sub-item) | Owner attests HC v4.0 p.42 locator for D1 dioxin-TEQ (cheapest, script-ready, 1 row) -- see queue item 1 below. |
| Matrix-map data / T31 | OWNER-GATED | `MATRIX_OPTIONS_T31_STEP1_REPORT_2026_07_12.md` sec 9 | Owner authorizes STEP-2 (+4178 undated events / +5752 measurements); STEP-1 is done, nothing applied yet -- two-gate sequence (authorize, then regenerate+codex-GREEN the exact artifacts, then a second approval of that exact reviewed operation). |
| DRA publication | OWNER-GATED / IN-PROGRESS | Top-50 doc (baseline correction) + `docs/design/matrix-map/DRA_EXPANSION_LOCATORS_AND_IOCO_PACKET_2026_07_12.md` | Baseline is 3 public / 571 private, not 0/574. Publish IOCO Shoreline (ea15e94a) as the 4th, pending owner approval + exact-operation codex review of the literal `flip_dra_public` call. |
| Inhalation | PARKED | `MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md` sec E + Top-50 doc Tier 7 | None -- owner-deprioritized below all completion-path lanes. When resumed: needs the VF/PEF model decision (Option A dynamic / B user-supplied / C hardcoded) + T33 unit-basis settle before any wiring. Input fields already reserved fail-closed (PR #610). |
| Cumulative UI (A3b) | OWNER-GATED (blocked) | `MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` HITL item 7 / Top-50 doc #15-16 | Blocked on D1 (dioxin-TEQ) + D2 (BaP anchor) + D3 (PCB Option A) rulings. Once resolved: register computeTEQ/computeBaPeq in equationDispatch + build the UI component. TEQ/BaP-eq math itself is complete and tested (headless). |
| Coordinate extraction | PARKED / DEFERRED | `docs/design/matrix-map/DRA_EXPANSION_LOCATORS_AND_IOCO_PACKET_2026_07_12.md` sec 2a + Top-50 doc Tier 4 | 4 centroid-only DRA source PDFs (Howe Sound / r-0074 / Lot C / Site 14764) are located. Next: AGY drafts the OCR/table-extraction harness, orchestrator runs it, the coordinate WRITE stays owner-gated and checkpoint-bound. |
| Security / RBAC | OWNER-GATED (2 real gaps) | `MATRIX_OPTIONS_SECURITY_RBAC_REVERIFY_2026_07_13.md` (reverified 07-13) | GAP 1 (`/api/hitl-packets/*` no reviewer/admin role gate): owner picks `ALLOWED_ROLES` (reuse admin/matrix_admin vs new `hitl_reviewer` role). GAP 2 (`prioritization-matrix` authenticated non-admin user_id leak): owner picks drop-vs-pseudonymize for the non-admin tier. Recommendation in the source doc: fix GAP 2 first (smaller blast radius, more sensitive). Neither is applied. |
| E2E | OWNER-GATED (optional) | Top-50 doc Tier 6 (#23-24) / `MATRIX_OPTIONS_T40_ADMIN_TIER_OWNER_GATE_2026_07_12.md` | Owner sets GH secrets `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` + repo var `E2E_AUTH_ENABLED=true` to turn on member-authenticated coverage. Admin-tier coverage additionally needs a new admin test user + storageState (none exists today). |
| Older 07-01 backlog | IN-PROGRESS (re-triaged 07-13) | `MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md` | Of the original ~43 items / ~170 sub-actions: **111 RESOLVED, 4 SUPERSEDED (now tracked in the 07-12 packet), 11 STILL-OPEN**. See queue items 15-16 below for the net-new still-open items not already in the 07-12 packet. |

## 3. Consolidated owner-decision queue

Dedup of the 07-12 packet's 15 items against tonight's (07-13) three decision-support docs. Items
1-8 are catalog (Lane A of the 07-12 packet); 9-10 are matrix-map data (Lane B); 11-12 are E2E
(Lane C); 13-14 are DRA/map (Lane D); 15 is inhalation (Lane E). Items 16-18 are net-new,
surfaced only by tonight's re-verification work and not present in the original 07-12 packet.

1. **D1 dioxin-TEQ** -- READY (unchanged). Owner attests HC v4.0 p.42 locator, then
   `promote-hc-dioxin-teq.mjs --apply` + the coupled tripwire edit, then tsc/lint/test:ci. Cheapest
   item in the whole queue (1 row, script ready).
2. **cadmium + methylmercury current_default** -- CONFIRM-ONLY (unchanged). HC-policy-preference
   over lower approved IRIS alternatives; no value at risk.
3. **41 IRIS needs_review alternates** -- per-group reject/retain/set-default ruling (8 substances,
   20 groups). Unchanged, still open.
4. **copper + sodium_ion Protocol-28 rows** -- rule among HC 0.426 (approved) / P28 0.09 /
   P28-water 0.141 for copper; base 34.3 vs water 21.2 for sodium_ion. Unchanged. Cross-ref: HITL
   retriage still-open item 1 (copper) points here.
5. **D3 PCB Option A** -- closes `total_pcbs_aroclor_1254` default + `pcbs_non_coplanar` alias +
   disposition of all needs_review PCB rows. Unchanged. Cross-ref: HITL retriage still-open items 3
   (PCB-family default) and 7 (pcbs_non_coplanar wiring, blocked on this) point here.
6. **D2 benzo_a_pyrene** -- anchor (IRIS 2.0 ADAF-adjusted vs HC 1.289) + ADAF scenario +
   disposition of needs_review BaP starter/P28 rows. Unchanged. Cross-ref: HITL retriage still-open
   item 2 points here.
7. **357 P28 verify-vs-primary sweep** (351 human_health_trv_values + 6 parameter_values.json,
   union count) -- per-value, against each row's PRIMARY cited source, not the Protocol-28
   compilation PDF. Unchanged, its own multi-session lane.
8. **Ambiguities to reconcile** -- the completion-status "15 conflicts" (verified union = 33
   substances / 62 groups / 157 rows) and the untraceable "20 supersede-or-reject" list. Unchanged.
9. **T31 STEP-2 apply** -- two-gate sequence (owner authorizes STEP-2; regenerate the 25-batch SQL
   + manifest and codex-review GREEN on the exact freshly-regenerated artifacts; owner approves that
   exact reviewed operation; then `apply_live_load.py`). STEP-1 already done. Unchanged.
10. **T32 waterbody UPDATE** -- **APPLIED 2026-07-13** (owner-approved). DONE. Postflight: Marine
    268, Freshwater 22, no lowercase dupes, 4204 unlabeled, total 4494 samples; codex-GREEN over 7
    rounds; exact id-keyed rollback on file. No further action.
11. **Enable authenticated E2E** (optional) -- GH secrets `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`
    (`sstac-e2e-reviewer`) + repo var `E2E_AUTH_ENABLED=true`. Unchanged.
12. **Admin-tier E2E** (optional follow-up) -- create an admin-role test user + storageState; no
    admin fixture exists today. Unchanged.
13. **Publish IOCO Shoreline** (ea15e94a) -- coordinate-safe (all 6 samples surveyed/high-tier);
    flip via `matrix_map.flip_dra_public` (admin JWT). Note: baseline is now known to be 3 public /
    571 private (corrected this session, not 0/574 as the 07-11 doc had it), so this would be the
    4th public DRA. Requires `/codex-review` GREEN on the exact `flip_dra_public` call + dra_id
    `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4` + explicit owner approval sentence. Unchanged, still not
    applied.
14. **Coordinate-extraction lane** (deferred) -- all 4 centroid-DRA source PDFs located (Howe Sound
    / r-0074 / Lot C / Site 14764). Separate owner-gated, checkpoint-bound follow-on lane: AGY
    drafts the extraction harness, orchestrator runs, write held. Unchanged.
15. **Inhalation** -- PARKED. Needs the owner's VF/PEF anchor decision + section-7 approval
    sentence before any wiring (input fields already reserved fail-closed, PR #610). Not started.
16. **NEW -- current_default null-risk audit (Top-50 item #14, resolved by tonight's audit):** the
    feared "systemic ~83-row gap" is confirmed a NON-issue for 66 of 68 nominally at-risk tuples
    (the resolver's exact-value-match + approved-row + jurisdiction-rank cascade already
    disambiguates them). **Only 2 real at-risk tuples remain**, both under the default frame:
    `endosulfan_alpha` and `endosulfan_beta` (eco-direct-eqp, fcv_ug_per_L = 0.056 ug/L, two
    same-jurisdiction US_federal EPA rows with no tiebreak). Recommended fix: set current_default
    on one of the two identical rows per tuple (owner-gated, editorial pick between equal-value EPA
    sources). Do NOT blanket-set current_default on the other 16 cross-jurisdiction ties -- that
    would regress frame-sensitivity (current_default is checked ahead of the jurisdiction-rank
    fallback, so pinning one source would freeze it even under a frame designed to prefer the
    other). Up to 18 same-value tuples remain exposed only under a frame that ranks neither
    Canada_federal nor US_federal (e.g. `bc-csr-sediment-numerical`) -- that residual is a
    frame-ranking design question, not a per-row data edit.
17. **NEW -- security gaps, both REAL, both owner-gated (reverified 2026-07-13):**
    - GAP 1: `/api/hitl-packets/*` (4 API routes + the dashboard page) is authenticated-only with
      NO reviewer/admin role check -- confirmed by direct read of all 5 files, HIGH confidence.
      Owner decision needed: which role gates it (reuse `admin`/`matrix_admin`, zero-new-schema, vs
      add a dedicated `hitl_reviewer` role, more correct long-term but needs a migration + role
      backfill). Owner must also confirm current legitimate HITL-packet users map onto whichever
      role is picked, or the fix locks out real reviewers.
    - GAP 2: `/api/graphs/prioritization-matrix` GET leaks raw `auth.users.id` UUIDs (truncated to
      8 chars but real) to any authenticated non-admin caller via the survey-results scatter
      tooltip -- confirmed as a deliberate PR #608-era scope decision, not an oversight, and
      confirmed as actually rendered in the UI (not just passed through unused). Distinct from the
      anonymous-leak fix PR #608 already shipped (that part is sound). Owner decision needed: drop
      `userId` for the authenticated-non-admin tier (three-tier split: public / authed-non-admin /
      admin) vs pseudonymize it (needs a check that the scatter-plot clustering logic doesn't
      require the raw value). Source doc recommends fixing GAP 2 first if forced to sequence
      (smaller, more contained blast radius; more sensitive exposure).
    Both gaps correspond to completion-status HITL queue items 9 and 10 (2026-07-11) and to Top-50
    doc items #20-21; tonight's doc is the reverification, not a new finding.
18. **NEW -- HITL 07-01 backlog, re-triaged: 11 still-open** (of the original ~43 items). Items
    already cross-referenced into the numbered list above (copper=4, D3 PCB=5, D2 BaP=6) are not
    repeated. The genuinely net-new / not-elsewhere-tracked still-open items are:
    - **pyridine abs_dermal**: VOC RAF (0.03) vs organic SVOC default (0.1) -- boundary case
      flagged in-file as awaiting review. Not in the 07-12 packet.
    - **PAH-class abs_dermal cohort**: should the 11 PAH entries at 0.13 match naphthalene's
      confirmed-correct 0.148 (HC TRV v4.0/v3.0 Table 5, Moody et al. 2007)? Not in the 07-12
      packet.
    - **benzo_a_pyrene oral RfD**: simplest item in the whole re-triage -- single concordant
      approved value (0.0003 mg/kg-bw/day, HC + IRIS agree), currently unwired (`rfd_oral` still
      null). No owner judgment needed; recommend wiring build-first.
    - **PHC family + lmw_pahs (6 keys: lmw_pahs, phc_f1-f4, total_phcs)**: whole-substance gap, no
      `substanceLibrary.ts` key exists despite approved catalog rows for at least 2 of the 6. Owner
      decision on whether/how to add given aggregate-fraction double-counting risk against
      individual PAH/PHC congeners already in the library.
    - **maneb classification/disclosure**: keep `organic` with a manganese-content disclosure note,
      or reclassify given the Mn-coordinated dithiocarbamate chemistry.
    - **benzene / tetrachloroethylene / trichloroethylene abs_dermal cross-reference note**:
      documentation-only, no value change -- add the inline VOC-RAF rationale cross-reference
      already present on formaldehyde's entry.
    (The 11-count also folds in the PHC/lmw_pahs 6-key group as a single re-triage line item; see
    the retriage doc's Group 3e for the itemized 6 keys.)

## 4. Not owner-gated (build-first, no decision needed)

Two items surfaced above are pure engineering with no owner judgment required and can be shipped
without further HITL input:
- `benzo_a_pyrene` oral RfD wiring (item 18, both approved sources concordant).
- `benzene` / `tetrachloroethylene` / `trichloroethylene` abs_dermal cross-reference note
  (item 18, documentation-only).

## 5. Superseded docs (entry-point status only -- content retained as detail/evidence)

This doc is now the entry point. The following remain on disk as detailed evidence/reference but
are NOT the status entry point going forward:
- `docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` -- superseded as entry point. Its DRA
  publication baseline (0 public / 574 private) is corrected by this doc (3 public / 571 private).
  Retained for its per-goal breakdown and dated T-item findings (T05, T15-T18, T22-T24, T31-T33,
  T39-T40, T44-T45).
- `docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md` -- superseded as entry point by
  `MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md`'s re-triage (111 resolved / 4 superseded / 11
  still-open). Retained as the original evidence trail for the still-open items.
- `docs/MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md` -- superseded as
  entry point for cross-lane priority; still the canonical pointer for exact SQL/script/paste-ready
  approval sentences per catalog item (queue items 1-15 above cite it by section).
- `docs/MATRIX_OPTIONS_TOP50_PRIORITY_TASKS_2026_07_13.md` -- superseded as entry point; still the
  canonical ranked 50-item backlog for items outside the completion-critical path (Tiers 9-11:
  verification gaps, Regulatory-Review/Engine-V2 items, hygiene/test-coverage items) that are not
  repeated in this doc.

---
*Synthesis doc. No catalog, code, or production data was modified in its production. Sourced
entirely from the docs named above; see each for full evidence and file/line citations.*
