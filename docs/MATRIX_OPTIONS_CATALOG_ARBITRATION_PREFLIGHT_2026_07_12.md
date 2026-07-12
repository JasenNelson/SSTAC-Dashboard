# Catalog Arbitration Preflight Packet (2026-07-12)

Status: READ-ONLY inventory. No catalog value was mutated to produce this packet. No promote-*.mjs
script was run with --apply. This document is a decision aid only.

Base: origin/main tip `589deaf8b2993d7926fa54a3c2739352441f27ef` (read via `git show origin/main:<path>`,
repo root `C:/Projects/sstac-dashboard`).

Sources read:
- `matrix_research/reference_catalog/human_health_trv_values.json` (1574 rows, parsed with a read-only
  python script; no in-place edits).
- `matrix_research/reference_catalog/sources.json` (fetched; not deep-parsed for this packet).
- `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`
- `docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` (section 3 HITL queue, canonical open-decision
  list)
- `FRESH_SESSION_HANDOFF_2026_07_07_CUMULATIVE_LANE_SHIPPED.md`
- `docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md`
- `docs/MATRIX_OPTIONS_CUMULATIVE_A4_ATTESTATION_PACKETS_2026_07_06.md`
- `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`
- `scripts/matrix-options/promote-*.mjs` (`git ls-tree -r origin/main --name-only | grep promote-`
  returns 23 promote scripts on main; header/docstring read for the subset relevant to the
  arbitration items in this packet -- D1's `promote-hc-dioxin-teq.mjs`, section 4a's 3
  IRIS-dupe-cg scripts, and section 3's `promote-pcb-fcv-nrwqc.mjs` -- not all 23 line-by-line)

Rule restated: AI dry-runs promote-*.mjs (node script --reviewer "..." --date ... with NO --apply
flag) and shows before/after. OWNER runs the same command WITH --apply (or gives explicit inline
approval for AI to run --apply on the owner's behalf per
`feedback_inline_approval_is_the_attestation_not_ps_commands.md`). AI never mutates
`human_health_trv_values.json`, `eco_values.json`, or any `src/data/` catalog file directly.

---

## 0. Whole-catalog row-count ground truth

Total rows in `human_health_trv_values.json`: **1574**

By `qa_status`:
| qa_status | count |
|---|---|
| approved | 1181 |
| needs_review | 393 |

By `input_key` x `qa_status`:
| input_key | approved | needs_review | total |
|---|---|---|---|
| rfd_oral_mg_per_kg_bw_day | 820 | 280 | 1100 |
| sf_oral_per_mg_per_kg_bw_per_day | 176 | 15 | 191 |
| rfc_inhalation_mg_per_m3 | 113 | 75 | 188 |
| unit_risk_inhalation_per_ug_m3 | 72 | 22 | 94 |
| oral_tdi_teq_mg_per_kg_bw_day | 0 | 1 | 1 |

`needs_review` (393) decomposes by `parameter_value_id` prefix as:
- `pv-p28-*` (BC Protocol 28 robot-extracted): **351**
- `pv-iris-*` (US EPA IRIS dupe-candidate-group alternates): **41**
- `pv-hc-*` (Health Canada TRV v4.0): **1** (the D1 dioxin-like-TEQ row, see section 2)

This matches `docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` section 2 Goal 3 verbatim
("needs_review (T22) mapped: 393 rows (pv-p28-* 351, pv-iris-* 41, pv-hc-* 1)"). Independently
re-verified against the live JSON for this packet, not taken on faith from the doc.

`default_status`: 38 rows are `current_default`; 1536 are `available_option`. None of the D1/D2/D3
substances (dioxin_like_teq, benzo_a_pyrene, total_pcbs_aroclor_1254, pcbs_non_coplanar,
polychlorinated_biphenyls_total_pcbs, polychlorinated_biphenyls_pcbs) has a `current_default` row --
all are still pending owner default-selection.

Candidate-group conflict ground truth (multi-row `candidate_group_id` groups, i.e. >1 pv-id competing
for the same substance+pathway+input+jurisdiction slot):
- **31 candidate_group_id groups** hold >1 row, totaling **85 rows**, across **13 distinct
  substance_key**: `1_1_1_trichloroethane`, `1_2_3_trimethylbenzene`, `1_2_4_trimethylbenzene`,
  `1_3_5_trimethylbenzene`, `benzo_a_pyrene`, `cadmium`, `copper`,
  `hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx` (RDX), `methylmercury`,
  `perfluorobutanoic_acid_pfba`, `perfluorodecanoic_acid_pfda`, `perfluorohexanoic_acid_pfhxa`,
  `sodium_ion`.
- All **41** `needs_review` `pv-iris-*` rows sit inside one of these multi-candidate groups (verified:
  0 standalone needs_review IRIS rows) -- confirming completion-status doc's framing that the 41 are
  "intentional dupe-group alternates," not orphans.
- The prompt's brief says "15 candidate-group conflicts (incl. the 41 IRIS dupe-group canonical
  choices)". The AI-verified figure is **13 distinct substances / 31 groups / 85 rows**. The "15" in
  the completion-status doc does not exactly match either the group count (31) or the substance count
  (13) found here -- flagged as AMBIGUOUS (see section 6). Recommend the owner treat 13
  substances / 31 groups as the operative inventory; if "15" refers to a different unit of count
  (e.g. groups minus already-resolved ones, or a slightly stale count from an earlier catalog state),
  it should be reconciled against this packet, not re-derived from memory.

---

## 1. D1 remainder -- dioxin-like TEQ oral TDI (Health Canada TRV v4.0)

Already shipped per prior audit (per `docs/MATRIX_OPTIONS_CUMULATIVE_A4_ATTESTATION_PACKETS_2026_07_06.md`
and the cumulative-lane memory anchor): `resolveDlPcbTeqTdi`, `DL_PCB_TEQ_SUBSTANCE_KEY`, and
`HHDirectContact` integration exist in code. NOT re-verified line-by-line in this read-only pass
(out of scope -- catalog-focused); if the owner wants code-level re-confirmation, that is a separate,
narrow grep, not part of this arbitration packet.

**What remains: exactly 1 catalog row.**

| field | value |
|---|---|
| parameter_value_id | `pv-hc-dioxin-like-teq-hh-direct-oral-tdi` |
| substance_key | `dioxin_like_teq` |
| input_key | `oral_tdi_teq_mg_per_kg_bw_day` |
| value | 2.3e-09 mg TEQ/kgBW-day |
| qa_status | **needs_review** (NOT promoted) |
| canonical_source_status | `needs_direct_source_check` |
| evidence_support_status | `approved_source_backed` |
| source | `src-health-canada-trv-v4-2025` |
| locator | "HC TRV v4.0 (2025), PDF p.42 / printed p.38, TRV summary table; Oral TDI (provisional); study basis Faqi and Chahoud 1998 (WHO 2002b); TEQ via DeVito et al. 2024 TEFs, Table 4." |
| uncertainty flag | "TDI is PROVISIONAL." |
| extracted | 2026-07-07 by codex |

Direct answer to the brief's question: the row DOES already carry an HC v4.0 p.42 locator (extracted
2026-07-07) but is **still needs_review**, not promoted to approved. This is a genuine remainder, not
a stale/absent state.

**A promotion script already exists and is ready to dry-run today:**
`scripts/matrix-options/promote-hc-dioxin-teq.mjs` -- targets EXACTLY this 1 `pv-hc-*` record. Its
header states the SOURCE (`src-health-canada-trv-v4-2025`) is expected already
`direct_source_verified` (so the source-promotion step should no-op) and that `default_status` is
never touched (stays `available_option`). It also documents a REQUIRED coupled follow-up: after
`--apply`, add `HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS` to the `sanctionedPromotionIds` set in
`src/lib/matrix-options/provenance/__tests__/catalog.test.ts`, then run `tsc --noEmit`, `lint`,
`test:ci` -- doing this edit BEFORE `--apply` would break the set-equality tripwire.

A competing/corroborating BC Protocol 28 candidate exists in the same substance family but a
DIFFERENT substance_key (`polychlorinated_dioxins_and_furans_total_pcdds_and_pcdfs`, not
`dioxin_like_teq`): `pv-p28-polychlorinated_dioxins_and_furans_total_pcdds_and_pcdfs-hh-direct-rfd`
and its `-hh-food-` twin, both needs_review, both value 2.3e-09 mg/kg-bw/day (same numeric value,
different key/pathway framing -- not a direct duplicate of the D1 row, likely both trace to the same
underlying HC-derived number via different documents). Not touched by `promote-hc-dioxin-teq.mjs`.

**Recommended next action:** owner reviews the p.42 locator against the primary HC TRV v4.0 PDF
(provisional-TDI caveat noted), then either runs `promote-hc-dioxin-teq.mjs --apply` directly or gives
inline approval for AI to run it. AI dry-run first (no `--apply`) to show before/after.
**owner --apply required: YES** (value promotion; provisional-TDI language warrants explicit
owner sign-off, not a mechanical rubber stamp).

---

## 2. D2 -- benzo_a_pyrene anchor + ADAF treatment

**Current catalog state: all 17 benzo_a_pyrene rows are qa_status=approved.** None is HELD at the
qa_status/promotion level -- the HELD status is specifically about `current_default` selection, and
that hold is intentional and confirmed-correct per `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`
("HELD -- correctly untouched (1)").

| parameter_value_id | pathway | input_key | value | unit | source |
|---|---|---|---|---|---|
| pv-hc-bap-hh-direct-rfd-tdi | direct | rfd_oral | 0.0003 | mg/kg-bw/day | HC TRV v4.0 |
| pv-hc-bap-hh-food-rfd-tdi | food | rfd_oral | 0.0003 | mg/kg-bw/day | HC TRV v4.0 |
| pv-hc-bap-hh-direct-sf | direct | sf_oral | 1.289 | per mg/kg-bw/day | HC TRV v4.0 |
| pv-hc-bap-hh-food-sf | food | sf_oral | 1.289 | per mg/kg-bw/day | HC TRV v4.0 |
| pv-hc-benzo_a_pyrene-hh-direct-rfc | direct | rfc_inhalation | 2e-06 | mg/m3 | HC TRV v4.0 |
| pv-hc-benzo_a_pyrene-hh-direct-iur | direct | unit_risk_inhalation | 0.0006 | per ug/m3 | HC TRV v4.0 |
| pv-iris-bap-hh-direct-rfd-neuro | direct | rfd_oral | 0.0003 | mg/kg-bw/day | IRIS (neuro endpoint) |
| pv-iris-bap-hh-food-rfd-neuro | food | rfd_oral | 0.0003 | mg/kg-bw/day | IRIS (neuro endpoint) |
| pv-iris-bap-hh-direct-rfd-repro | direct | rfd_oral | 0.0004 | mg/kg-bw/day | IRIS (repro endpoint) |
| pv-iris-bap-hh-food-rfd-repro | food | rfd_oral | 0.0004 | mg/kg-bw/day | IRIS (repro endpoint) |
| pv-iris-bap-hh-direct-rfd-immune | direct | rfd_oral | 0.002 | mg/kg-bw/day | IRIS (immune endpoint) |
| pv-iris-bap-hh-food-rfd-immune | food | rfd_oral | 0.002 | mg/kg-bw/day | IRIS (immune endpoint) |
| pv-iris-bap-hh-direct-sf | direct | sf_oral | **2** | per mg/kg-bw/day | IRIS -- LIFETIME slope factor, ADAFs baked in |
| pv-iris-bap-hh-food-sf | food | sf_oral | 2 | per mg/kg-bw/day | IRIS |
| pv-iris-benzo_a_pyrene-hh-direct-iur | direct | unit_risk_inhalation | 0.001 | per ug/m3 | IRIS |
| pv-iris-benzo_a_pyrene-hh-direct-rfc | direct | rfc_inhalation | 3e-06 | mg/m3 | IRIS |
| pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2 | direct | rfc_inhalation | 2e-06 | mg/m3 | IRIS |

Per `MATRIX_OPTIONS_A2_VERIFICATION_RESULTS_2026_07_06.md` (referenced, not re-fetched -- cited by
`OWNER_DECISIONS_0706.md`): the oral-SF "discrepancy" between HC 1.289 and IRIS 2.0 is NOT a data
error. IRIS's catalog `2.0` figure is the current IRIS **lifetime** slope factor with ADAFs already
baked in; IRIS separately lists `1.0` (adult-only, not currently in the catalog as its own row). HC
v4.0 = `1.289`. Per the memory anchor (`dashboard_mo_cumulative_effects_lane_2026_07_06.md`), PR #538
already primary-verified the HC ADAF position (1.289 = adult-base-rate-plus-ADAF-applied-on-top,
vs. EPA's 2.0 = baked-in). No promote script exists yet for benzo_a_pyrene (it is a
`current_default`-selection + scenario-tagging decision, not a qa_status promotion -- every row is
already approved).

**What remains (2 sub-decisions, per OWNER_DECISIONS_0706.md, still open as of this packet):**
1. Which value becomes `current_default` for sf_oral (HC 1.289 vs an EPA scenario) and for the other
   input_keys (rfd_oral has 3 competing IRIS endpoint values -- neuro 0.0003 / repro 0.0004 /
   immune 0.002 -- plus HC's single 0.0003; rfc_inhalation has HC 2e-6 vs IRIS 3e-6/2e-6; unit_risk has
   HC 0.0006 vs IRIS 0.001).
2. Tag each EPA sf_oral row with its scenario (adult-only 1.0 vs lifetime-with-ADAF 2.0) so the two
   IRIS numbers are not conflated -- currently the catalog only carries the 2.0 lifetime figure as a
   named row; if the adult-only 1.0 figure is to be added as its own citable option, that is a NEW ROW
   (catalog addition), not a promotion of an existing needs_review row.

**Recommended next action:** owner picks the anchor (HC 1.289 vs IRIS lifetime-2.0 vs a
newly-authored IRIS adult-1.0 row) and the endpoint for rfd_oral/rfc/iur; this also directly feeds the
cumulative-PAH ADAF handling (do not double-apply ADAFs if anchoring on the 2.0 figure). This is
**owner primary-source judgment**, not an AI-dry-runnable mechanical step, because it requires
picking among legitimately different toxicological endpoints/scenarios, not verifying one number
against one source.
**owner --apply required: YES** (default-selection policy call; no script exists to dry-run yet --
authoring one is straightforward once the owner's pick is known).

---

## 3. D3 -- PCB Option A / pcbs_non_coplanar / total_pcbs_aroclor_1254

Per `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`, Option A is the RECOMMENDED
(not yet owner-ruled) choice: keep `total_pcbs_aroclor_1254` canonical, reduce
`polychlorinated_biphenyls_total_pcbs` to an alias/deprecation pointer, and adopt a
"Total-PCBs-as-default, Aroclor/congener-specific as explicit alternatives, never additive" congener
policy that also resolves `pcbs_non_coplanar`.

Current catalog rows (13 total across the PCB/Aroclor family):

| parameter_value_id | substance_key | pathway | input_key | value | unit | qa_status | source |
|---|---|---|---|---|---|---|---|
| pv-hc-pcb-hh-direct-rfd-nondioxin | total_pcbs_aroclor_1254 | direct | rfd_oral | 1e-05 | mg/kg-bw/day | approved | HC TRV v4.0 |
| pv-hc-pcb-hh-food-rfd-nondioxin | total_pcbs_aroclor_1254 | food | rfd_oral | 1e-05 | mg/kg-bw/day | approved | HC TRV v4.0 |
| pv-iris-pcb-hh-direct-rfd-aroclor1254 | total_pcbs_aroclor_1254 | direct | rfd_oral | 2e-05 | mg/kg-bw/day | approved | IRIS |
| pv-iris-pcb-hh-food-rfd-aroclor1254 | total_pcbs_aroclor_1254 | food | rfd_oral | 2e-05 | mg/kg-bw/day | approved | IRIS |
| pv-p28-polychlorinated_biphenyls_total_pcbs-hh-direct-rfd | polychlorinated_biphenyls_total_pcbs | direct | rfd_oral | 0.00013 | mg/kg-bw/day | **needs_review** | BC Protocol 28 |
| pv-p28-polychlorinated_biphenyls_total_pcbs-hh-food-rfd | polychlorinated_biphenyls_total_pcbs | food | rfd_oral | 0.00013 | mg/kg-bw/day | **needs_review** | BC Protocol 28 |
| pv-hc-pcbs_non_coplanar-hh-direct-rfd | pcbs_non_coplanar | direct | rfd_oral | 1e-05 | mg/kg-bw/day | approved | HC TRV v4.0 |
| pv-hc-pcbs_non_coplanar-hh-food-rfd | pcbs_non_coplanar | food | rfd_oral | 1e-05 | mg/kg-bw/day | approved | HC TRV v4.0 |
| pv-iris-aroclor_1016-hh-direct-rfd | aroclor_1016 | direct | rfd_oral | 7e-05 | mg/kg-bw/day | approved | IRIS (distinct Aroclor, out of scope of merge) |
| pv-iris-aroclor_1016-hh-food-rfd | aroclor_1016 | food | rfd_oral | 7e-05 | mg/kg-bw/day | approved | IRIS |
| pv-iris-polychlorinated_biphenyls_pcbs-hh-direct-iur | polychlorinated_biphenyls_pcbs | direct | unit_risk_inhalation | 0.0001 | per ug/m3 | approved | IRIS (generic; SF-source only) |
| pv-iris-polychlorinated_biphenyls_pcbs-hh-direct-sf | polychlorinated_biphenyls_pcbs | direct | sf_oral | 2 | per mg/kg-bw/day | approved | IRIS |
| pv-iris-polychlorinated_biphenyls_pcbs-hh-food-sf | polychlorinated_biphenyls_pcbs | food | sf_oral | 2 | per mg/kg-bw/day | approved | IRIS |

The only genuinely-needs-review PCB rows are the 2
`pv-p28-polychlorinated_biphenyls_total_pcbs-*` rows (BC Protocol 28, value 0.00013). No
`current_default` is set anywhere in the PCB family. `total_pcbs_aroclor_1254` has 2 competing
approved rfd_oral candidates (HC 1e-05 vs IRIS 2e-05) awaiting the default pick, which per
`docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md` Lane 3 item 2 is "correctly pending on the
PCB-policy decision." `promote-pcb-fcv-nrwqc.mjs` exists but is a DIFFERENT, already-narrower item
(eco-direct FCV citation repair for `total_pcbs_aroclor_1254`, value unchanged at 0.014 ug/L,
provenance-only) -- not a substitute for the Option A ruling.

**Recommended next action:** owner rules on Option A (recommended) vs B vs C from the consolidation
doc. That single ruling closes: (a) `total_pcbs_aroclor_1254` current_default pick (HC 1e-05 vs IRIS
2e-05), (b) `pcbs_non_coplanar` wiring/alias treatment, (c) whether to promote or reject the 2
needs_review `polychlorinated_biphenyls_total_pcbs` Protocol-28 rows. No promote script exists yet;
one is mechanical to author once the ruling is known (AI authors + dry-runs; owner --apply).
**owner --apply required: YES** (policy ruling + downstream promotion/rejection of needs_review
rows).

---

## 4. Candidate-group conflicts (13 substances / 31 groups / 85 rows)

Split by what tooling already exists (verified from promote-*.mjs headers on origin/main):

### 4a. IRIS dupe-cg canonicals -- ALREADY APPLIED (no action); real remaining work = 41 needs_review alternates
**CORRECTION (verified against the live catalog 2026-07-12, superseding an earlier draft that listed
4a as "owner --apply required"):** the 20 canonical IDs targeted by the three promote scripts below
are ALREADY `qa_status=approved` + `canonical_source_status=direct_source_verified` in the current
`human_health_trv_values.json` (all 20 confirmed present + approved), and
`src/lib/matrix-options/provenance/__tests__/catalog.test.ts` ALREADY imports their allowlists
(`IRIS_DUPE_CG_CANONICAL_VALUE_IDS` / `IRIS_PFAS_DUPE_CG_CANONICAL_VALUE_IDS` /
`IRIS_PFDA_DUPE_CG_CANONICAL_VALUE_IDS`, lines 31-33 + 691-693). The promotions these scripts perform
have therefore already landed. Re-running them today is a no-op; there is NO pending owner --apply
action for the canonical promotions. Do NOT send the next session to dry-run/apply these -- that
chases a no-op.

**What ACTUALLY remains in these 8 candidate groups = 41 `pv-iris-* needs_review` ALTERNATES** (the
losing/alternate rows in each dupe group, still `needs_review`, awaiting a disposition decision --
reject-as-superseded OR retain-as-citable-alternate OR select-as-current_default). Live count by
substance: `1_1_1_trichloroethane` 5, `1_2_3_trimethylbenzene` 3, `1_2_4_trimethylbenzene` 6,
`1_3_5_trimethylbenzene` 5, RDX 4, PFBA 4, PFDA 6, PFHxA 8 (total 41). These are the owner-attention
items in this bucket, NOT the already-applied canonicals. No script exists for the alternate
disposition; it is a per-group reject/retain/default call once the owner rules on the congener/endpoint
policy.

The three scripts (retained here for provenance of the ALREADY-APPLIED canonicals, not as pending
actions):
`scripts/matrix-options/promote-iris-dupe-cg-canonical.mjs` -- 14 rows: the trimethylbenzene isomers
(1,2,3- / 1,2,4- / 1,3,5-, both rfc_inhalation and rfd_oral direct+food groups) + 1,1,1-trichloroethane
(rfc_inhalation + rfd_oral direct+food) + RDX (rfd_oral direct+food). Per-row EPA IRIS URL + chronic
value verified 2026-06-22 (2 independent blind passes cited in the script header) against the live
IRIS source, recorded in `scripts/matrix-options/data/iris-dupe-cg-canonical-2026-06-22.json`.

`scripts/matrix-options/promote-iris-pfas-dupe-cg-canonical.mjs` -- 4 rows: PFBA (rfd_oral 1e-3
mg/kg-day, direct+food) + PFHxA (rfd_oral 5e-4 mg/kg-day, direct+food). EPA-designated PRIMARY chronic
RfD, verified 2026-06-22.

`scripts/matrix-options/promote-iris-pfda-dupe-cg-canonical.mjs` -- 2 rows: PFDA (rfd_oral 2e-9
mg/kg-bw/day, direct+food). Owner-picked chronic endpoint value, verified 2026-06-23.

Each script is idempotent, fails closed, and does NOT touch `default_status` (stays
`available_option`). Each requires a coupled `sanctionedPromotionIds` test-tripwire edit AFTER
--apply (documented in-header) plus `tsc --noEmit` / `lint` / `test:ci`.

### 4b. Folded into D2 (not yet scriptable) (1 substance, 8 rows)
`benzo_a_pyrene` (rfd_oral direct+food x3 endpoints, rfc_inhalation direct x2) -- see section 2. No
promote script exists; needs the anchor/scenario decision first.

### 4c. Different flavor -- HC/Protocol-28 splits, not IRIS dupes (4 substances)
- `cadmium` (HC v4.0: `cadmium-hh-direct-rfd-food` vs `-water` route split) -- current_default
  (0.0008) already set per Lane 3 "confirm-after-the-fact" item in OWNER_DECISIONS_0706.md; owner
  confirmation still pending, low urgency.
- `methylmercury` (HC v4.0: sensitive-population vs adult split) -- current_default (0.0002,
  most-protective sensitive-population value) already set; same confirm-after-the-fact status.
- `copper`, `sodium_ion` (BC Protocol 28: rfd vs rfd-water-route variant, both needs_review) -- not
  addressed in any decision doc read for this packet; no promote script found. Flagged as a genuinely
  open, previously-undocumented item (see section 6).

**owner --apply required:** 4a canonicals = NO -- ALREADY APPLIED (approved/direct_source_verified;
test allowlists already imported), re-running is a no-op. The remaining 4a work is the 41
`needs_review` alternate rows, which need a per-group reject/retain/default disposition decision
(owner policy call, no script yet), NOT a canonical promotion. 4b = YES, folded into D2. 4c =
cadmium/methylmercury: confirmation only (no value at risk); copper/sodium_ion: YES, undecided policy
call.

---

## 5. Protocol-28 verify-vs-primary sweep (351 rows)

All 351 `pv-p28-*` rows are `qa_status=needs_review`, sourced from `src-bc-protocol-28-v3-0-2024`
(robot-extracted; per multiple review_notes: "Read-only library value; verify against the live source
before any default-selection").

By input_key:
| input_key | count |
|---|---|
| rfd_oral_mg_per_kg_bw_day | 250 |
| rfc_inhalation_mg_per_m3 | 64 |
| unit_risk_inhalation_per_ug_m3 | 22 |
| sf_oral_per_mg_per_kg_bw_per_day | 15 |
| **total** | **351** |

These require **vision-first primary-source verification** against the BC Protocol 28 PDF (per L0
`feedback_pdf_vision_first.md` -- no poppler/text-extraction-only shortcuts) before any promotion. This
is the largest single bucket in the queue and is explicitly NOT AI-dry-runnable as a batch: each row's
extracted value_text must be checked against the primary PDF page/table, one at a time or in
small verified batches, the same way the IRIS 680-row batch was verified against the EPA
"Chemicals_Details" Excel snapshot before `promote-iris-rfd-batch.mjs` could exist. No Protocol-28
equivalent promote script exists yet on main -- none should be authored until a primary-source
verification pass (owner-directed, vision-first) produces a verified subset, mirroring the IRIS
precedent.

**owner --apply required: YES, and the verification itself needs owner/HITL involvement** (this is
the "AI finds and verifies values, NOT HITL" mandate in tension with the vision-first PDF requirement
-- AI can search/attempt extraction, but the primary verification loop for 351 rows is a substantial,
not-yet-scoped lane, distinct from the other items in this packet which already have a verified basis).

---

## 6. Ambiguous / could not fully resolve

1. **"20 supersede-or-reject" items** -- referenced ONLY as a bare count in
   `docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` (lines 66 and 80: "Catalog arbitration (15
   candidate-group conflicts ... 20 supersede-or-reject, 351 Protocol-28 ...)"). A repo-wide
   `git grep -i "supersede-or-reject"` across origin/main markdown found NO other occurrence and no
   itemized list anywhere in the docs read for this packet (`MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md`,
   `MATRIX_OPTIONS_CUMULATIVE_A4_ATTESTATION_PACKETS_2026_07_06.md`,
   `MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`, the 07-07 handoff). This figure could not be
   traced to a concrete row list from any source read. RECOMMEND the owner or the session that wrote
   the 07-11 completion-status doc clarify what the 20 items are before they can be arbitrated; do not
   assume it duplicates the 13-substance/31-group candidate-conflict set above (the doc lists them as
   separate line items).
2. **"15 candidate-group conflicts"** -- the AI-verified figure from the live catalog is 13 distinct
   substances / 31 `candidate_group_id` groups / 85 rows (see section 0 and section 4). Close to but
   not exactly "15" or "31" -- flagged for reconciliation, not silently corrected.
3. **`copper` / `sodium_ion` needs_review pairs** (section 4c) -- surfaced by this packet's direct
   catalog read but not mentioned in any of the 5 decision docs read. May be a previously-unsurfaced
   gap, or may be intentionally low-priority (BC Protocol 28 route-split variants of already-approved
   metals). Recommend a brief owner glance, not urgent triage.
4. **D1 code-level integration** (resolveDlPcbTeqTdi / HHDirectContact wiring) was taken on the
   memory anchor's word, not re-verified line-by-line in this pass -- catalog-focused packet, not a
   code audit. If the owner wants that re-confirmed, it is a separate narrow grep.

---

## 7. Recommended arbitration order (cleanest first)

1. **D1 dioxin-like TEQ TDI** (section 1) -- 1 row, script already exists
   (`promote-hc-dioxin-teq.mjs`), locator already pinned to HC v4.0 p.42. Owner reviews the
   provisional-TDI caveat against the primary PDF, then dry-run -> --apply. Lowest row-count, fully
   scripted, single clean decision.
2. **Section 4a IRIS dupe-cg alternates** (8 substances) -- the 20 CANONICALS are ALREADY APPLIED
   (no action; see section 4a correction). The remaining work is a per-group disposition of the 41
   `needs_review` ALTERNATE rows (reject-as-superseded / retain-as-alternate / select-as-default),
   which is an owner policy call, not a canonical promotion. No script exists for the alternate
   disposition. Lower mechanical certainty than previously framed; do after the clearly-scripted D1.
3. **cadmium / methylmercury current_default confirmation** (section 4c) -- no value at risk, pure
   confirm-or-redirect. Fast.
4. **D3 PCB Option A ruling** (section 3) -- one policy decision (Option A recommended) closes 3
   sub-items (total_pcbs_aroclor_1254 default, pcbs_non_coplanar wiring, 2 needs_review Protocol-28
   PCB rows). No script yet; author is mechanical once the ruling lands.
5. **D2 benzo_a_pyrene anchor + ADAF scenario tagging** (section 2) -- requires picking among 3 IRIS
   rfd_oral endpoints + an sf_oral anchor + possibly authoring a new adult-only-1.0 row. Higher
   judgment load; feeds cumulative-PAH ADAF handling downstream, so worth doing before any cumulative
   A3b UI work resumes.
6. **copper / sodium_ion needs_review pairs** (section 4c) -- undocumented gap; low urgency, brief
   owner glance then treat like any other 2-candidate BC Protocol 28 pick.
7. **"20 supersede-or-reject"** (section 6) -- BLOCKED until the item list is located or
   re-derived; do not guess at scope.
8. **351 Protocol-28 verify-vs-primary sweep** (section 5) -- largest, most labor-intensive, requires
   vision-first PDF verification per row/batch; treat as its own multi-session lane, not a single
   arbitration pass. Do last, or run in parallel as a separate long-running lane once items 1-6 are
   clear.

## 8. AI-dry-runnable vs owner-primary-source-judgment

**AI-dry-runnable now (script exists, verification basis already documented):**
- D1 (`promote-hc-dioxin-teq.mjs`)
- (Section 4a canonicals are NOT listed here -- they are ALREADY APPLIED, not a pending dry-run; the
  remaining 4a alternate-disposition is an owner policy call with no script.)

**AI can author a dry-run script once the owner's policy pick is known (no primary-source
verification burden beyond what already exists in the catalog rows):**
- D3 PCB Option A (once ruled)
- cadmium/methylmercury confirmation (trivial, may not even need a script -- it is a confirm, not a
  change)

**Owner primary-source judgment required before any script can be written (genuine toxicological /
policy choice among legitimate alternatives, not a verification-against-one-source task):**
- D2 benzo_a_pyrene anchor + ADAF scenario
- copper / sodium_ion (once surfaced, still a BC-Protocol-28-vs-alternative pick)
- 351 Protocol-28 sweep (vision-first primary verification, large lane)
- "20 supersede-or-reject" (undiscoverable scope; needs owner/prior-session clarification first)

---

*Packet authored 2026-07-12 as a read-only preflight inventory. No catalog value, qa_status,
default_status, or default-policy library row was mutated in producing this document. Plain ASCII
only.*
