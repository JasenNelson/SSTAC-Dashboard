<!-- Generated 2026-07-13. Synthesis only -- no new analysis. Every fact below is copied/summarized
from the source docs named inline; nothing here was independently re-derived. Plain ASCII. -->

# Matrix Options -- Live Status (2026-07-13)

**This is the single entry-point status doc for Matrix Options.** Start here. It supersedes the
docs listed in section 5 as the first thing to read; those docs remain on disk as detail/evidence
references, not as competing entry points.

## 1. Current truth (as of 2026-07-13, updated later same day)

Catalog: **1780 rows** (approved-ish baseline, D1 promoted 1 row). `origin/main` is at **e425369** (post D1 #627 merge).

SHIPPED/MERGED since the last update:
- **D1 dioxin-TEQ** APPLIED + MERGED (#627).
- **T31 STEP-2** APPLIED to live matrix_map (deltas +4178 sample_events / +5752 measurements / 0 samples; MCP-verified; report in `.tmp/mo-nextrun-2026-07-12/liveload_apply_closeout.md`).

Three PRs are OPEN and pending owner merge:
- **#628** security hardening (hitl-packets admin gate incl. pages + csv/md routes; prioritization-matrix server-secret HMAC pseudonymization + fail-closed; escapeCSV formula-injection guard x3 modules; codex GREEN).
- **#629** DRA coord-extraction harness DRAFT (no write).
- **#630** DL-PCB card copy reflects approved dioxin TDI.

DRA publication baseline is **3 public / 571 private** (a surveyed-coordinate pilot); IOCO Shoreline (coordinate-safe, +6 samples) is queued as the 4th, pending owner execution via app (admin JWT).

## 2. Lane status

| Lane | Status | Current pointer doc | Immediate next action |
|---|---|---|---|
| Catalog arbitration | OWNER-GATED | `MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md` sec A | D1 dioxin-TEQ is SHIPPED/MERGED (#627). Benzo_a_pyrene RfD wire + endosulfan default (separate small catalog batch) await owner approval. Remaining: D2/D3/IRIS/copper/P28 arbitration. |
| Matrix-map data / T31 | APPLIED/DONE | `.tmp/mo-nextrun-2026-07-12/liveload_apply_closeout.md` | STEP-2 is applied (+4178 sample_events / +5752 measurements / 0 samples). Done. |
| DRA publication | OWNER-GATED | Top-50 doc + `docs/design/matrix-map/DRA_EXPANSION_LOCATORS_AND_IOCO_PACKET_2026_07_12.md` | Publish IOCO Shoreline (dra ea15e94a) reviewed GREEN + preflight done, awaiting owner execution via app (admin JWT). Baseline is 3 public / 571 private. |
| Inhalation | PARKED | `MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md` sec E + Top-50 doc Tier 7 | None -- owner-deprioritized below all completion-path lanes. When resumed: needs the VF/PEF model decision (Option A dynamic / B user-supplied / C hardcoded) + T33 unit-basis settle before any wiring. Input fields already reserved fail-closed (PR #610). |
| Cumulative UI (A3b) | OWNER-GATED (blocked) | `MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` HITL item 7 / Top-50 doc #15-16 | Blocked on D2 (BaP anchor) and D3 (PCB Option A) rulings (D1 is resolved). Once resolved: register computeTEQ/computeBaPeq in equationDispatch + build the UI component. |
| Coordinate extraction | OPEN PR / DRAFT | `docs/design/matrix-map/DRA_EXPANSION_LOCATORS_AND_IOCO_PACKET_2026_07_12.md` sec 2a + Top-50 doc Tier 4 | PR #629 is open (DRA coord-extraction harness DRAFT, no write). Extraction RUN remains owner-gated. |
| Security / RBAC | OPEN PR / OWNER-GATED | `MATRIX_OPTIONS_SECURITY_RBAC_REVERIFY_2026_07_13.md` | PR #628 is open for owner merge (security hardening: hitl-packets admin gate incl. pages + csv/md routes; prioritization-matrix server-secret HMAC pseudonymization + fail-closed; escapeCSV formula-injection guard x3 modules; codex GREEN). |
| E2E | MEMBER-TIER ACTIVE; ADMIN-TIER OWNER-GATED | Top-50 doc Tier 6 / `MATRIX_OPTIONS_T40_ADMIN_TIER_OWNER_GATE_2026_07_12.md` | T40 member-tier setup is complete: repo secrets `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` and repo variable `E2E_AUTH_ENABLED=true` verified 2026-07-14; `.env.local` also has member credential key names. Remaining gate is admin-tier only (`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` not verified present). #40 route removal remains a product decision. |
| Older 07-01 backlog | IN-PROGRESS | `MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md` | Of the original ~43 items: 111 RESOLVED, 4 SUPERSEDED, 11 STILL-OPEN. PR #630 is open (DL-PCB card copy reflects approved dioxin TDI) awaiting owner merge. |

## 3. Consolidated owner-decision queue

Dedup of the 07-12 packet's 15 items against tonight's (07-13) three decision-support docs. Items
1-8 are catalog (Lane A of the 07-12 packet); 9-10 are matrix-map data (Lane B); 11-12 are E2E
(Lane C); 13-14 are DRA/map (Lane D); 15 is inhalation (Lane E). Items 16-18 are net-new,
surfaced only by tonight's re-verification work and not present in the original 07-12 packet.

1. **D1 dioxin-TEQ** -- **APPLIED + MERGED 2026-07-13 in PR #627**. Postflight: Baseline catalog promoted 1 row (from 1779 to 1780 approved rows). DONE.
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
9. **T31 STEP-2 apply** -- **APPLIED 2026-07-13** (deltas +4178 sample_events / +5752 measurements / 0 samples; MCP-verified; report in `.tmp/mo-nextrun-2026-07-12/liveload_apply_closeout.md`). DONE.
10. **T32 waterbody UPDATE** -- **APPLIED 2026-07-13** (owner-approved). DONE. Postflight: Marine
    268, Freshwater 22, no lowercase dupes, 4204 unlabeled, total 4494 samples; codex-GREEN over 7
    rounds; exact id-keyed rollback on file. No further action.
11. **Authenticated E2E member tier is active** -- GH secrets `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`
    (`sstac-e2e-reviewer`) + repo var `E2E_AUTH_ENABLED=true` verified 2026-07-14. Do not ask the
    owner to set these again without first checking live key presence. Remaining T40 gate is
    admin-tier positive coverage (`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`).
12. **Admin-tier E2E** (optional follow-up) -- create an admin-role test user + storageState; no
    admin fixture exists today. Unchanged.
13. **Publish IOCO Shoreline** (ea15e94a) -- coordinate-safe (all 6 samples surveyed/high-tier);
    flip via `matrix_map.flip_dra_public` (admin JWT). Note: baseline is now known to be 3 public /
    571 private (corrected this session, not 0/574 as the 07-11 doc had it), so this would be the
    4th public DRA. Requires `/codex-review` GREEN on the exact `flip_dra_public` call + dra_id
    `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4` + explicit owner approval sentence. Unchanged, still not
    applied.
14. **Coordinate-extraction lane** (deferred) -- all 4 centroid-DRA source PDFs located (Howe Sound
    / r-0074 / Lot C / Site 14764). PR #629 is open (DRA coord-extraction harness DRAFT, no write).
    Extraction RUN remains owner-gated.
15. **Inhalation** -- PARKED. Needs the owner's VF/PEF anchor decision + section-7 approval
    sentence before any wiring (input fields already reserved fail-closed, PR #610). Not started.
16. **NEW -- current_default null-risk audit (Top-50 item #14, resolved by tonight's audit):** the
    feared "systemic ~83-row gap" is confirmed a NON-issue for 66 of 68 nominally at-risk tuples
    (the resolver's exact-value-match + approved-row + jurisdiction-rank cascade already
    disambiguates them). **Only 2 real at-risk tuples remain**, both under the default frame:
    `endosulfan_alpha` and `endosulfan_beta` (eco-direct-eqp, fcv_ug_per_L = 0.056 ug/L, two
    same-jurisdiction US_federal EPA rows with no tiebreak). Recommended fix: set current_default
    on one of the two identical rows per tuple. Prepared in a separate small catalog batch awaiting owner approval (along with benzo_a_pyrene RfD wire). Do NOT blanket-set current_default on the other 16 cross-jurisdiction ties -- that
    would regress frame-sensitivity (current_default is checked ahead of the jurisdiction-rank
    fallback, so pinning one source would freeze it even under a frame designed to prefer the
    other). Up to 18 same-value tuples remain exposed only under a frame that ranks neither
    Canada_federal nor US_federal -- that residual is a frame-ranking design question, not a per-row data edit.
17. **NEW -- security gaps (PR #628 OPEN):**
    - GAP 1: `/api/hitl-packets/*` (4 API routes + the dashboard page) is authenticated-only with
      NO reviewer/admin role check.
    - GAP 2: `/api/graphs/prioritization-matrix` GET leaks raw `auth.users.id` UUIDs (truncated to
      8 chars but real) to any authenticated non-admin caller via the survey-results scatter
      tooltip.
    Both gaps are addressed in **OPEN PR #628** (hitl-packets admin gate incl. pages + csv/md routes;
    prioritization-matrix server-secret HMAC pseudonymization + fail-closed; escapeCSV formula-injection
    guard x3 modules; codex GREEN) awaiting owner merge.
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
      null). Prepared in the separate small catalog batch awaiting owner approval.
    - **PHC family + lmw_pahs (6 keys: lmw_pahs, phc_f1-f4, total_phcs)**: whole-substance gap, no
      `substanceLibrary.ts` key exists despite approved catalog rows for at least 2 of the 6. Owner
      decision on whether/how to add given aggregate-fraction double-counting risk against
      individual PAH/PHC congeners already in the library.
    - **maneb classification/disclosure**: keep `organic` with a manganese-content disclosure note,
      or reclassify given the Mn-coordinated dithiocarbamate chemistry.
    - **benzene / tetrachloroethylene / trichloroethylene abs_dermal cross-reference note**:
      documentation-only, no value change -- add the inline VOC-RAF rationale cross-reference
      already present on formaldehyde's entry.
    - **DL-PCB card copy**: reflects approved dioxin TDI. Addressed in **OPEN PR #630** awaiting owner merge.

## 4. Not owner-gated (build-first, no decision needed)

One item surfaced above is pure engineering with no owner judgment required and can be shipped
without further HITL input:
- `benzene` / `tetrachloroethylene` / `trichloroethylene` abs_dermal cross-reference note
  (item 18, documentation-only).

(Note: `benzo_a_pyrene` oral RfD wiring has been packaged with the endosulfan default in a small catalog batch and is now awaiting owner approval/execution).

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
