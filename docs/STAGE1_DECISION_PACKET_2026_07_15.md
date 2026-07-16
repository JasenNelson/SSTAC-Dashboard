> AUTHORITY NOTE: This packet is the PRE-RULING decision-support surface (AGY-drafted; "Owner ruling"
> blanks). The AUTHORITATIVE final rulings + orchestrator corrections live in
> `STAGE1_DECISION_LOG_2026_07_15.md` -- where this packet differs, the LOG governs. Known correction:
> section 9 (copper) exact-write is a PRODUCTION-WRITE (promote + dispose), NOT "confirm-only" as the
> AGY draft first stated. Every data-mutating item requires a SEPARATE exact-operation approval.

## 1. Cadmium + methylmercury current_default confirm (base row #9)
- Source: MATRIX_OPTIONS_CATALOG_ARBITRATION_PREFLIGHT_2026_07_12.md section 4c
- Context: The current defaults for cadmium and methylmercury were already set following a Health Canada policy preference over lower approved IRIS alternatives. This is a confirm-after-the-fact item that blocks the final clearance of these items from the HITL queue.
- Current state: cadmium current_default is 0.0008; methylmercury current_default is 0.0002.
- Options:
  - A) Confirm existing defaults -- clears the queue with no value change.
  - B) Reject defaults -- requires picking alternative rows for default status.
- Suggested lean (ADVISORY): Option A -- the defaults are already set to the most protective and sensitive-population values per HC policy preference.
- Exact write it would authorize (if accepted): confirm-only, no value change
- Owner ruling: __________

## 2. IOCO Shoreline publish policy (base row #7)
- Source: MATRIX_MAP_IOCO_PUBLISH_INVESTIGATION_2026_07_14.md section 1
- Context: The IOCO Shoreline DRA needs to be published (made public) in the database. A previous attempt silently failed because it was run outside the app, triggering a fail-closed RPC guard. Publishing this is gated because it mutates production visibility.
- Current state: public=false (6 samples, 34 member-visible samples unchanged).
- Options:
  - A) Publish via in-app UI -- uses the correct admin JWT to bypass the RPC guard.
  - B) Do not publish -- IOCO Shoreline remains hidden.
- Suggested lean (ADVISORY): Option A -- all coordinates are safe/high-tier, and this completes the requested DRA expansion.
- Exact write it would authorize (if accepted): matrix_map.dras + ea15e94a-b093-4cb4-bd4d-80ab9eae16d4 + public false -> true. PRODUCTION-WRITE
- Owner ruling: __________

## 3. IOCO in-app admin-JWT publish-retry blocker (base row #8)
- Source: MATRIX_MAP_IOCO_PUBLISH_INVESTIGATION_2026_07_14.md section 2
- Context: The `/api/matrix-map/admin/publish` route returned an optimistic success without verifying the DB write, masking silent RPC failures. A PR exists to add a read-only post-write read-back to the route, surfacing explicit errors. This blocks reliable retries of the IOCO publish.
- Current state: The route returned `{ ok: true, public: <submitted> }` and never read the DB back.
- Options:
  - A) Approve/Merge the PR -- hardens the UI to explicitly verify the DB write and surface rejections.
  - B) Reject the PR -- leaves the UI vulnerable to silent non-persist masking.
- Suggested lean (ADVISORY): Option A -- prevents silent failure confusion by verifying the actual DB state after the write.
- Exact write it would authorize (if accepted): app action: merge PR adding DB read-back to /api/matrix-map/admin/publish
- Owner ruling: __________

## 4. D2 benzo_a_pyrene anchor-source ruling (base row #12)
- Source: MATRIX_OPTIONS_CATALOG_FOLLOWUP_DECISIONS_2026_07_13d.md section C2
- Context: The choice of oral slope factor anchor between HC 1.289 and EPA 2.0 dictates the required methodology. HC 1.289 is adult-based and requires manual ADAF weighting for children, whereas EPA 2.0 already has standard lifetime ADAFs baked in. This choice is gated because mixing them risks up to 10x underestimation or double-counting.
- Current state: EPA 2.0 is the active default cancer slope factor (`pv-bap-hh-direct-slope` tagged `adaf_stage:embedded_do_not_reapply`).
- Options:
  - A) Keep EPA 2.0 as anchor -- applies standard lifetime risk without requiring runtime age-bin math.
  - B) Switch to HC 1.289 as anchor -- requires fully wiring `computeBaPeq` to apply ADAF.
  - C) Switch to a new IRIS 1.0 (adult-only) row -- requires similar ADAF wiring as HC.
- Suggested lean (ADVISORY): Option A -- keeps the calculator safe from early-life underestimation until the manual ADAF application path is fully implemented and verified.
- Exact write it would authorize (if accepted): confirm-only, no value change
- Owner ruling: __________

## 5. D3 PCB Option A/B/C ruling (base row #13)
- Source: MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md section 5
- Context: The catalog has two overlapping "Total PCBs" keys (`total_pcbs_aroclor_1254` and `polychlorinated_biphenyls_total_pcbs`), creating ambiguity. The ruling dictates which key becomes canonical and what happens to the other's catalog records. This is gated because it determines library structure and requires migrating protective-sensitive eco FCV rows.
- Current state: Both library rows exist; `total_pcbs_aroclor_1254` holds the full HH toxicity and verified FCV, while `polychlorinated_biphenyls_total_pcbs` is an eco-direct stub.
- Options:
  - A) Option A -- make `total_pcbs_aroclor_1254` canonical and deprecate/alias the plain row.
  - B) Option B -- keep both but formally scope them with cross-referencing notes.
  - C) Option C -- make the plain row canonical and demote the fully wired Aroclor row.
- Suggested lean (ADVISORY): Option A -- provides a single source of truth and retains the verified FCV and HH toxicity, eliminating ambiguity.
- Exact write it would authorize (if accepted): substanceLibrary.ts + human_health_trv_values.json + eco_values.json + deprecate polychlorinated_biphenyls_total_pcbs and migrate rows to total_pcbs_aroclor_1254. PRODUCTION-WRITE
- Owner ruling: __________

## 6. PCB re-key site-congener QP protectiveness check (base row #15)
- Source: MATRIX_OPTIONS_CATALOG_FOLLOWUP_DECISIONS_2026_07_13d.md section C1
- Context: Migrating the deprecated PCB alias's catalog rows to the canonical Aroclor 1254 key applies a 0.014 ug/L water FCV with a high logKow 6.5. In EqP models, this yields a less-stringent sediment benchmark, requiring a QP to verify protectiveness against the site congener profile. This blocks the actual data migration of the Option A decision.
- Current state: The catalog-row value-migration/re-keying remains a SEPARATE deferred packet; the site-specific QP check result is UNVERIFIED -- not found in MATRIX_OPTIONS_CATALOG_FOLLOWUP_DECISIONS_2026_07_13d.md.
- Options:
  - A) Approve migration -- confirms the EqP benchmark is sufficiently protective for the site.
  - B) Reject/Hold migration -- alias rows must coexist until the QP check is complete.
- Suggested lean (ADVISORY): Option B -- the migration is explicitly noted as protective-sensitive and must wait for a dedicated QP sign-off packet.
- Exact write it would authorize (if accepted): human_health_trv_values.json + eco_values.json + re-key eco FCV and HH RfD rows from polychlorinated_biphenyls_total_pcbs to total_pcbs_aroclor_1254. PRODUCTION-WRITE
- Owner ruling: __________

## 7. ADAF multi-bin {ageBin,exposureFraction}[] exposure-weighting API methodology (base row #16)
- Source: MATRIX_OPTIONS_ADAF_BAP_EXPLAINER_2026_07_07.md section 6
- Context: The current `computeBaPeq` implementation applies a single ADAF scalar for the given `ageYears`, rather than the standard methodology which performs exposure-duration-weighting across multiple age bins (0-<2, 2-<16, 16+) for a full lifetime scenario. This limits the API's ability to handle multi-bin durations internally.
- Current state: `computeBaPeq` applies ADAF as a single scalar per call, tied to one `opts.ageYears` value.
- Options:
  - A) Expand API to accept `{ageBin, exposureFraction}[]` -- implements standard lifetime multi-bin weighting internally.
  - B) Retain current single-bin API -- caller remains responsible for duration-weighting.
- Suggested lean (ADVISORY): Option A -- centralizing the complex duration-weighting math in the calculator reduces the risk of errors by callers.
- Exact write it would authorize (if accepted): app action: code edit to computeBaPeq and BaPeqOptions in cumulative.ts to accept an array of age bin fractions.
- Owner ruling: __________

## 8. IRIS 41 needs_review alternates per-group disposition (base row #17)
- Source: MATRIX_OPTIONS_CATALOG_ARBITRATION_PREFLIGHT_2026_07_12.md section 4a
- Context: After promoting 20 canonical IRIS rows, 41 alternate IRIS rows across 8 substances remain as `needs_review` in candidate groups. A disposition decision is required to either reject them as superseded or retain them as citable alternates. This blocks clearing the catalog HITL queue.
- Current state: 41 `pv-iris-*` alternate rows are still `needs_review` awaiting disposition.
- Options:
  - A) Reject as superseded -- removes clutter, leaving only the primary canonicals.
  - B) Retain as available_option -- keeps them citable for specific scenarios.
- Suggested lean (ADVISORY): Option A -- the canonicals have already been verified as the primary chronic values; retaining alternates risks confusion.
- Exact write it would authorize (if accepted): human_health_trv_values.json + 41 pv-iris-* alternate rows + qa_status needs_review -> rejected. PRODUCTION-WRITE
- Owner ruling: __________

## 9. Copper Protocol-28 route-split rows disposition (base row #18)
- Source: MATRIX_OPTIONS_CATALOG_ARBITRATION_PREFLIGHT_2026_07_12.md section 4c
- Context: Copper has conflicting oral RfD values: HC 0.426 vs BC Protocol 28's route-split variants (base 0.09 and water 0.141). A ruling is needed to select the appropriate default or confirm the existing one. It is gated to resolve the needs_review items.
- Current state: HC 0.426 is an APPROVED HC row but currently `available_option` (NOT current_default); the library presently WIRES 0.04 (unsupportable, no valid source); P28 0.09 and P28-water 0.141 are both `needs_review`. So adopting HC 0.426 as the default is a value/status CHANGE, NOT a confirm. (Corrects the AGY draft, which mis-stated this as confirm-only.)
- Options:
  - A) Promote HC 0.426 to current_default -- the approved Health Canada value; disposes the P28 rows + the unsupportable 0.04 starter.
  - B) Promote P28 0.09 as default.
  - C) Promote P28-water 0.141 as default.
- Suggested lean (ADVISORY): Option A -- HC 0.426 is approved and matches the HC-default hierarchy; avoids route-specific tuple constraints.
- Exact write it would authorize (if accepted): PRODUCTION-WRITE -- promote pv-hc-copper-* to current_default (0.426) + dispose/reject P28 0.09/0.141 + the needs_review 0.04 starter. SEPARATE exact-operation approval required.
- Owner ruling: __________

## 10. Catalog-count ambiguity reconciliation (base row #19)
- Source: MATRIX_OPTIONS_CATALOG_ARBITRATION_PREFLIGHT_2026_07_12.md section 0 and 6
- Context: Status docs cited "15 candidate-group conflicts" and a "20 supersede-or-reject" list, but the live catalog verification found 13 substances/31 groups/85 rows and no trace of the 20 items. This blocks arbitration of those items until the scope is clarified.
- Current state: 13 substances / 31 groups / 85 rows verified for candidate-group conflicts. The "20 supersede-or-reject" list is UNVERIFIED -- not found in MATRIX_OPTIONS_CATALOG_ARBITRATION_PREFLIGHT_2026_07_12.md.
- Options:
  - A) Adopt the live-verified count (13 subs/31 groups) and block the untraceable 20 until clarified.
  - B) Guess at the scope of the 20 items.
- Suggested lean (ADVISORY): Option A -- the live catalog read (1574 rows) is ground truth; the untraceable count should not be actioned until the owner clarifies it.
- Exact write it would authorize (if accepted): confirm-only, no value change
- Owner ruling: __________

How to use this packet:
The owner rules each section inline. The orchestrator (Claude) will verify every load-bearing number against the cited source before any write. Every PRODUCTION-WRITE row is a SEPARATE exact-operation approval (never bundled).
