# Matrix Options -- Lane 1 Catalog Arbitration: Owner Decision Packet (2026-07-12)

This is a PREP-ONLY decision aid. The AI dry-ran the options, and the owner --applies the decisions (or provides inline attestation per feedback_inline_approval_is_the_attestation_not_ps_commands). The AI never edits the catalog JSON directly. Every item below is an owner STOP requiring explicit review and approval.

SCOPE CORRECTION (post-codex, 2026-07-12): this packet is verified against the FULL catalog union that composes PARAMETER_VALUE_RECORDS in src/lib/matrix-options/provenance/catalog.ts -- parameter_values.json + human_health_trv_values.json + eco_values.json (1779 rows total). The #618 arbitration preflight and the first draft of this packet read ONLY human_health_trv_values.json (1574 rows) and therefore UNDERCOUNTED: P28 needs_review is 357 (not 351; +6 in parameter_values.json), and the PCB (item 4), benzo_a_pyrene (item 5), and copper (item 7) families each have needs_review STARTER rows in parameter_values.json -- several of them current_default -- that the HH-only view missed. Those items are corrected below.

## 1. Item 1 -- D1 dioxin-like TEQ oral TDI (1 row, script ready)
- STATE: pv-hc-dioxin-like-teq-hh-direct-oral-tdi, value 2.3e-09 mg TEQ/kg-bw/day, qa_status needs_review, canonical_source_status needs_direct_source_check, default_status available_option. Source src-health-canada-trv-v4-2025 is already direct_source_verified (source step no-ops) and HAS a durable locator (url + Zotero key SSESKHQW), so --apply needs no extra flags. Dry-run confirmed: VALUE PROMOTE, SOURCE SKIP, no file written.
- DECISION NEEDED: owner attests the p.42 HC TRV v4.0 locator against the primary source, then promotes. The TDI is HC's OWN "PROVISIONAL" regulatory designation (keep that qualifier in the evidence; never present as a firm standard).
- OPTIONS / DATA: single value; no competing candidate for this exact key. After --apply, the coupled tripwire edit in D1_TRIPWIRE_SCRATCH_PATCH.md lands in the SAME commit, then tsc/lint/test:ci.
- AI RECOMMENDATION: Ready to promote as-is; provisional qualifier preserved. Run dry-run then --apply.
- owner --apply required: YES
- PASTE-READY APPROVAL SENTENCE: "I have reviewed the HC TRV v4.0 p.42 locator for pv-hc-dioxin-like-teq-hh-direct-oral-tdi (2.3e-09 mg TEQ/kg-bw/day, PROVISIONAL TDI) and approve running promote-hc-dioxin-teq.mjs --reviewer 'J. Nelson' --date 2026-07-12 --apply, followed in the same commit by the coupled sanctionedPromotionIds tripwire edit and tsc/lint/test:ci."

## 2. Item 2 -- 4a IRIS canonicals: NO ACTION (verified no-op)
- STATE: the 20 canonical IDs targeted by the 3 promote-iris-*-dupe-cg-canonical.mjs scripts are ALREADY approved/direct_source_verified and their allowlists already imported in catalog.test.ts.
- DECISION NEEDED: none. Recorded so no cycle is wasted re-running them.
- OPTIONS / DATA: n/a.
- AI RECOMMENDATION: do NOT re-run these scripts (no-op).
- owner --apply required: NO
- PASTE-READY APPROVAL SENTENCE: (none -- informational)

## 3. Item 3 -- 41 IRIS needs_review ALTERNATES (per-group disposition)
- STATE: 41 pv-iris-* needs_review alternate rows across 8 substances / 20 candidate_group_id groups (1,1,1-trichloroethane; 1,2,3-/1,2,4-/1,3,5-trimethylbenzene; RDX; PFBA; PFDA; PFHxA). Each sits in a group whose canonical is already approved.
- DECISION NEEDED: per group, dispose each alternate as reject-as-superseded / retain-as-citable-alternate / select-as-current_default.
- OPTIONS / DATA:
| candidate_group_id | needs_review alternate id | value | unit | approved canonical(s) in same group (id=value) |
|---|---|---|---|---|
| human-health-direct__1_1_1_trichloroethane__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_1_1_trichloroethane-hh-direct-rfc | 7 | mg/m3 | pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-2=5 |
| human-health-direct__1_1_1_trichloroethane__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-3 | 9 | mg/m3 | pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-2=5 |
| human-health-direct__1_1_1_trichloroethane__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-4 | 6 | mg/m3 | pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-2=5 |
| human-health-direct__1_1_1_trichloroethane__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-1_1_1_trichloroethane-hh-direct-rfd | 7 | mg/kg-bw/day | pv-iris-1_1_1_trichloroethane-hh-direct-rfd-thane-oral-rfd-2=2 |
| human-health-direct__1_2_3_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_2_3_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2 | 0.2 | mg/m3 | pv-iris-1_2_3_trimethylbenzene-hh-direct-rfc=0.06 |
| human-health-direct__1_2_3_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-1_2_3_trimethylbenzene-hh-direct-rfd | 0.04 | mg/kg-bw/day | pv-iris-1_2_3_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2=0.01 |
| human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc | 0.2 | mg/m3 | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4=0.06 |
| human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2 | 4 | mg/m3 | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4=0.06 |
| human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-3 | 3 | mg/m3 | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4=0.06 |
| human-health-direct__1_2_4_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-5 | 0.08 | mg/m3 | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4=0.06 |
| human-health-direct__1_2_4_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2 | 0.04 | mg/kg-bw/day | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfd=0.01 |
| human-health-direct__1_3_5_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2 | 4 | mg/m3 | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc=0.06 |
| human-health-direct__1_3_5_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-3 | 0.4 | mg/m3 | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc=0.06 |
| human-health-direct__1_3_5_trimethylbenzene__rfc_inhalation_mg_per_m3__US_federal | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4 | 0.2 | mg/m3 | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc=0.06 |
| human-health-direct__1_3_5_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2 | 0.04 | mg/kg-bw/day | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfd=0.01 |
| human-health-direct__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd | 0.01 | mg/kg-bw/day | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd-e-rdx-oral-rfd-3=0.004 |
| human-health-direct__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd-e-rdx-oral-rfd-2 | 0.0008 | mg/kg-bw/day | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd-e-rdx-oral-rfd-3=0.004 |
| human-health-direct__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd | 0.01 | mg/kg-bw/day | pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd--pfba-oral-rfd-3=0.001 |
| human-health-direct__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd--pfba-oral-rfd-2 | 0.006 | mg/kg-bw/day | pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd--pfba-oral-rfd-3=0.001 |
| human-health-direct__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-2 | 6e-7 | mg/kg-bw/day | pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd=2e-9 |
| human-health-direct__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-3 | 0.000003 | mg/kg-bw/day | pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd=2e-9 |
| human-health-direct__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-4 | 0.000001 | mg/kg-bw/day | pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd=2e-9 |
| human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd | 0.001 | mg/kg-bw/day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-3=0.0005 |
| human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-2 | 0.0008 | mg/kg-bw/day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-3=0.0005 |
| human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-4 | 0.005 | mg/kg-bw/day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-3=0.0005 |
| human-health-direct__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-5 | 0.0004 | mg/kg-bw/day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-3=0.0005 |
| human-health-food__1_1_1_trichloroethane__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-1_1_1_trichloroethane-hh-food-rfd | 7 | mg/kg-bw/day | pv-iris-1_1_1_trichloroethane-hh-food-rfd-thane-oral-rfd-2=2 |
| human-health-food__1_2_3_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-1_2_3_trimethylbenzene-hh-food-rfd | 0.04 | mg/kg-bw/day | pv-iris-1_2_3_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2=0.01 |
| human-health-food__1_2_4_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-1_2_4_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2 | 0.04 | mg/kg-bw/day | pv-iris-1_2_4_trimethylbenzene-hh-food-rfd=0.01 |
| human-health-food__1_3_5_trimethylbenzene__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-1_3_5_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2 | 0.04 | mg/kg-bw/day | pv-iris-1_3_5_trimethylbenzene-hh-food-rfd=0.01 |
| human-health-food__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd | 0.01 | mg/kg-bw/day | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd-e-rdx-oral-rfd-3=0.004 |
| human-health-food__hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd-e-rdx-oral-rfd-2 | 0.0008 | mg/kg-bw/day | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd-e-rdx-oral-rfd-3=0.004 |
| human-health-food__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd | 0.01 | mg/kg-bw/day | pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd--pfba-oral-rfd-3=0.001 |
| human-health-food__perfluorobutanoic_acid_pfba__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd--pfba-oral-rfd-2 | 0.006 | mg/kg-bw/day | pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd--pfba-oral-rfd-3=0.001 |
| human-health-food__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-2 | 6e-7 | mg/kg-bw/day | pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd=2e-9 |
| human-health-food__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-3 | 0.000003 | mg/kg-bw/day | pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd=2e-9 |
| human-health-food__perfluorodecanoic_acid_pfda__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-4 | 0.000001 | mg/kg-bw/day | pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd=2e-9 |
| human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd | 0.001 | mg/kg-bw/day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-3=0.0005 |
| human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-2 | 0.0008 | mg/kg-bw/day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-3=0.0005 |
| human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-4 | 0.005 | mg/kg-bw/day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-3=0.0005 |
| human-health-food__perfluorohexanoic_acid_pfhxa__rfd_oral_mg_per_kg_bw_day__US_federal | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-5 | 0.0004 | mg/kg-bw/day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-3=0.0005 |
- AI RECOMMENDATION: owner primary-source/policy judgment (legitimately different IRIS endpoints/scenarios); AI does not pick a value. No promote script exists yet; author one once the owner rules.
- owner --apply required: YES (per-group ruling, then AI authors + dry-runs a disposition script)
- PASTE-READY APPROVAL SENTENCE: "For the 41 IRIS needs_review alternates, my per-group disposition is: <fill in per group: reject / retain-as-alternate / set-as-default>. Author the disposition script and dry-run it; I will --apply."

## 4. Item 4 -- D3 PCB Option A ruling
- STATE (CORRECTED vs #618 preflight, which read only human_health_trv_values.json): across the full 3-file catalog union the PCB/Aroclor family is LARGER and has CONFLICTING current_defaults. In parameter_values.json the total_pcbs_aroclor_1254 STARTER set carries ~9 rows that are BOTH default_status=current_default AND qa_status=needs_review -- incl pv-pcb-hh-direct-rfd (0.00002), pv-pcb-hh-direct-slope (2), pv-pcb-hh-food-rfd (0.00002), pv-pcb-hh-food-slope (2), pv-pcb-hh-food-bsaf, pv-pcb-hh-*-ba-oral, pv-pcb-hh-direct-abs-dermal, pv-pcb-logkow, pv-pcb-bsaf-freshwater -- plus pv-p28-pcb-hh-food-rfd (0.00013, needs_review, available_option). In human_health_trv_values.json the HC/IRIS rows (1e-05 / 2e-05) are approved but available_option, and the 2 pv-p28-polychlorinated_biphenyls_total_pcbs-* (0.00013) are needs_review. So the family has approved-but-not-default HC/IRIS values COMPETING with needs_review starter values that ARE the current_default -- the Option A ruling must reconcile these, not just pick between HC 1e-05 and IRIS 2e-05.
- DECISION NEEDED: rule Option A (recommended) vs B vs C from MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md. That single ruling closes: (a) total_pcbs_aroclor_1254 current_default across BOTH the starter set and the HC/IRIS rows (resolve the conflicting current_default starter rows vs the approved-but-available HC 1e-05 / IRIS 2e-05), (b) pcbs_non_coplanar alias, (c) disposition of ALL needs_review PCB rows -- the 2 pv-p28-polychlorinated_biphenyls_total_pcbs-*, pv-p28-pcb-hh-food-rfd, AND the ~9 needs_review current_default starter rows.
- OPTIONS / DATA:
| parameter_value_id | substance_key | pathway | input_key | value | unit | qa_status | source |
|---|---|---|---|---|---|---|---|
| pv-hc-pcb-hh-direct-rfd-nondioxin | total_pcbs_aroclor_1254 | direct | rfd_oral | 1e-05 | mg/kg-bw/day | approved | HC TRV v4.0 |
| pv-hc-pcb-hh-food-rfd-nondioxin | total_pcbs_aroclor_1254 | food | rfd_oral | 1e-05 | mg/kg-bw/day | approved | HC TRV v4.0 |
| pv-iris-pcb-hh-direct-rfd-aroclor1254 | total_pcbs_aroclor_1254 | direct | rfd_oral | 2e-05 | mg/kg-bw/day | approved | IRIS |
| pv-iris-pcb-hh-food-rfd-aroclor1254 | total_pcbs_aroclor_1254 | food | rfd_oral | 2e-05 | mg/kg-bw/day | approved | IRIS |
| pv-p28-polychlorinated_biphenyls_total_pcbs-hh-direct-rfd | polychlorinated_biphenyls_total_pcbs | direct | rfd_oral | 0.00013 | mg/kg-bw/day | needs_review | BC Protocol 28 |
| pv-p28-polychlorinated_biphenyls_total_pcbs-hh-food-rfd | polychlorinated_biphenyls_total_pcbs | food | rfd_oral | 0.00013 | mg/kg-bw/day | needs_review | BC Protocol 28 |
| pv-hc-pcbs_non_coplanar-hh-direct-rfd | pcbs_non_coplanar | direct | rfd_oral | 1e-05 | mg/kg-bw/day | approved | HC TRV v4.0 |
| pv-hc-pcbs_non_coplanar-hh-food-rfd | pcbs_non_coplanar | food | rfd_oral | 1e-05 | mg/kg-bw/day | approved | HC TRV v4.0 |
| pv-iris-aroclor_1016-hh-direct-rfd | aroclor_1016 | direct | rfd_oral | 7e-05 | mg/kg-bw/day | approved | IRIS (distinct Aroclor, out of scope of merge) |
| pv-iris-aroclor_1016-hh-food-rfd | aroclor_1016 | food | rfd_oral | 7e-05 | mg/kg-bw/day | approved | IRIS |
| pv-iris-polychlorinated_biphenyls_pcbs-hh-direct-iur | polychlorinated_biphenyls_pcbs | direct | unit_risk_inhalation | 0.0001 | per ug/m3 | approved | IRIS (generic; SF-source only) |
| pv-iris-polychlorinated_biphenyls_pcbs-hh-direct-sf | polychlorinated_biphenyls_pcbs | direct | sf_oral | 2 | per mg/kg-bw/day | approved | IRIS |
| pv-iris-polychlorinated_biphenyls_pcbs-hh-food-sf | polychlorinated_biphenyls_pcbs | food | sf_oral | 2 | per mg/kg-bw/day | approved | IRIS |
- AI RECOMMENDATION: Option A (keep total_pcbs_aroclor_1254 canonical; alias polychlorinated_biphenyls_total_pcbs; Total-PCBs-as-default, congener-specific as explicit alternatives never additive) -- per the consolidation doc; owner rules.
- owner --apply required: YES
- PASTE-READY APPROVAL SENTENCE: "I rule PCB Option <A/B/C>. Author + dry-run the resulting promote/ alias/current_default script; I will --apply."

## 5. Item 5 -- D2 benzo_a_pyrene anchor + ADAF
- STATE (CORRECTED vs #618 preflight): the 17 HC/IRIS rows in human_health_trv_values.json are indeed all approved (available_option), BUT the full 3-file union ALSO carries needs_review benzo_a_pyrene rows that require disposition, so D2 is NOT purely current_default tagging: in parameter_values.json the BaP STARTER set has needs_review rows incl pv-bap-hh-direct-slope (sf_oral 2, current_default), pv-bap-hh-food-slope (sf_oral 2, current_default), pv-bap-hh-direct-rfd / pv-bap-hh-food-rfd ("not provided by current calculator", not_default), pv-bap-logkow, pv-bap-*-abs-dermal/ba-oral/bsaf; plus pv-p28-bap-hh-direct-slope and pv-p28-bap-hh-food-slope (sf_oral 7.3, needs_review, available_option). So the current_default sf_oral for BaP is presently a needs_review starter value of 2, competing with HC 1.289 / IRIS 2.0 (approved) and the P28 7.3 -- the D2 decision must both pick the anchor AND dispose the needs_review starter + P28 slope rows.
- DECISION NEEDED: pick the current_default anchor for sf_oral (HC 1.289 vs IRIS lifetime-2.0 vs a newly-authored IRIS adult-1.0 row) and for rfd_oral (HC 0.0003 vs IRIS neuro 0.0003 / repro 0.0004 / immune 0.002) and rfc/iur; tag EPA sf_oral scenario so 1.0 vs 2.0 are not conflated. Feeds cumulative PAH ADAF -- do NOT double-apply ADAFs if anchoring on 2.0.
- OPTIONS / DATA:
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
| pv-iris-bap-hh-direct-sf | direct | sf_oral | 2 | per mg/kg-bw/day | IRIS |
| pv-iris-bap-hh-food-sf | food | sf_oral | 2 | per mg/kg-bw/day | IRIS |
| pv-iris-benzo_a_pyrene-hh-direct-iur | direct | unit_risk_inhalation | 0.001 | per ug/m3 | IRIS |
| pv-iris-benzo_a_pyrene-hh-direct-rfc | direct | rfc_inhalation | 3e-06 | mg/m3 | IRIS |
| pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2 | direct | rfc_inhalation | 2e-06 | mg/m3 | IRIS |
- AI RECOMMENDATION: owner primary-source judgment (different endpoints/scenarios); AI does not pick.
- owner --apply required: YES
- PASTE-READY APPROVAL SENTENCE: "For benzo_a_pyrene I select current_default: sf_oral=<value/scenario>, rfd_oral=<value/endpoint>, rfc=<value>, iur=<value>; ADAF handling=<note>. Author + dry-run the current_default script; I will --apply."

## 6. Item 6 -- cadmium + methylmercury current_default CONFIRM (HC policy preference, NOT most-protective)
- STATE: cadmium 0.0008; methylmercury 0.0002 sensitive-population; both HC v4.0, already current_default. IMPORTANT (union correction): these are NOT the most-protective values available -- the catalog holds LOWER approved alternatives (available_option): cadmium IRIS water 0.0005 (and IRIS food 0.001); methylmercury IRIS 0.0001 (and HC adult 0.00047). So confirming these current_defaults is an HC-POLICY-PREFERENCE call (Protocol-1 HC-default hierarchy), NOT a most-protective selection.
- DECISION NEEDED: confirm the HC-policy-preference current_defaults over the lower approved IRIS alternatives (explicit policy sign-off, not a most-protective auto-pick).
- OPTIONS / DATA:
| id | substance | input_key | value | unit | source_ids |
|---|---|---|---|---|---|
| pv-hc-mehg-hh-direct-rfd-sensitive | methylmercury | rfd_oral_mg_per_kg_bw_day | 0.0002 | mg/kg-bw/day | src-health-canada-trv-v4-2025 |
| pv-hc-mehg-hh-food-rfd-sensitive | methylmercury | rfd_oral_mg_per_kg_bw_day | 0.0002 | mg/kg-bw/day | src-health-canada-trv-v4-2025 |
| pv-hc-cadmium-hh-direct-rfd-tdi | cadmium | rfd_oral_mg_per_kg_bw_day | 0.0008 | mg/kg-bw/day | src-health-canada-trv-v4-2025 |
| pv-hc-cadmium-hh-food-rfd-tdi | cadmium | rfd_oral_mg_per_kg_bw_day | 0.0008 | mg/kg-bw/day | src-health-canada-trv-v4-2025 |
- AI RECOMMENDATION: confirm as an HC-policy-preference decision (not most-protective); owner explicitly affirms preferring HC over the lower approved IRIS values.
- owner --apply required: CONFIRM-ONLY
- PASTE-READY APPROVAL SENTENCE: "I confirm the HC current_default selections for cadmium (0.0008) and methylmercury (0.0002, sensitive population) as an HC-policy-preference over the lower approved IRIS alternatives (cadmium IRIS-water 0.0005; methylmercury IRIS 0.0001); no change needed."

## 7. Item 7 -- copper + sodium_ion Protocol-28 rows (open policy call)
- STATE: (P28 rows, human_health_trv_values.json) copper base 0.09 vs water-route 0.141; sodium_ion base 34.3 vs water-route 21.2; 8 rows needs_review, no script, previously undocumented. ADDITIONALLY (union correction) copper rfd has THREE distinct competing values across the union: (i) 0.426 present as BOTH a needs_review current_default STARTER (parameter_values.json: pv-copper-hh-direct-rfd / pv-copper-hh-food-rfd) AND an already-APPROVED HC row (human_health_trv_values.json: pv-hc-copper-hh-direct-rfd-tdi / pv-hc-copper-hh-food-rfd-tdi, available_option) -- i.e. the effective current_default 0.426 has an approved HC backing that could simply be adopted as canonical; (ii) P28 base 0.09; (iii) P28 water-route 0.141 (both needs_review, available_option). The ruling should reconcile all three -- most cleanly by promoting the approved HC 0.426 to current_default and disposing the P28 0.09/0.141 + the needs_review starter. (sodium_ion has no HC/starter rows -- only the P28 base 34.3 / water-route 21.2.)
- DECISION NEEDED: for copper, rule among the approved HC 0.426, the P28 base 0.09, and the P28 water-route 0.141 -- which becomes current_default, and dispose the rest (incl clearing the needs_review starter); for sodium_ion, rule P28 base 34.3 vs water-route 21.2 and whether to promote or leave needs_review.
- OPTIONS / DATA:
| id | substance | input_key | value | unit | qa_status |
|---|---|---|---|---|---|
| pv-p28-copper-hh-direct-rfd | copper | rfd_oral_mg_per_kg_bw_day | 0.09 | mg/kg-bw/day | needs_review |
| pv-p28-copper-hh-food-rfd | copper | rfd_oral_mg_per_kg_bw_day | 0.09 | mg/kg-bw/day | needs_review |
| pv-p28-sodium_ion-hh-direct-rfd | sodium_ion | rfd_oral_mg_per_kg_bw_day | 34.3 | mg/kg-bw/day | needs_review |
| pv-p28-sodium_ion-hh-food-rfd | sodium_ion | rfd_oral_mg_per_kg_bw_day | 34.3 | mg/kg-bw/day | needs_review |
| pv-p28-copper-hh-direct-rfd-copper-rfd-water | copper | rfd_oral_mg_per_kg_bw_day | 0.141 | mg/kg-bw/day | needs_review |
| pv-p28-copper-hh-food-rfd-copper-rfd-water | copper | rfd_oral_mg_per_kg_bw_day | 0.141 | mg/kg-bw/day | needs_review |
| pv-p28-sodium_ion-hh-direct-rfd-um-ion-rfd-water | sodium_ion | rfd_oral_mg_per_kg_bw_day | 21.2 | mg/kg-bw/day | needs_review |
| pv-p28-sodium_ion-hh-food-rfd-um-ion-rfd-water | sodium_ion | rfd_oral_mg_per_kg_bw_day | 21.2 | mg/kg-bw/day | needs_review |
- AI RECOMMENDATION: owner policy call (route-variant choice); AI does not pick. Author a script once ruled.
- owner --apply required: YES
- PASTE-READY APPROVAL SENTENCE: "For copper and sodium_ion Protocol-28 rows my ruling is: <base vs water-route, promote vs leave>. Author + dry-run the script; I will --apply."

## 8. Item 8 -- Ambiguities to reconcile (surface, do not resolve)
- STATE: two documentation ambiguities for owner reconciliation: (a) completion-status doc says "15 candidate-group conflicts" but the verified multi-row candidate_group_id conflict inventory over the FULL 3-file union is 33 substances / 62 groups / 157 rows (the human_health_trv_values-only view undercounts this at 13 substances / 31 groups / 85 rows), and the needs_review IRIS-alternate subset is 8 substances / 20 groups / 41 rows. The "15" matches none of these; owner reconciles which count is operative. (b) completion-status item 4 references an "20 supersede-or-reject" list that is not traceable to a specific row set in the current catalog; owner clarifies what the 20 refers to (it does NOT map to the already-applied 4a canonicals, which are a no-op). (c) ROOT CAUSE of both the count drift and the item 4/5/7 corrections: the completion-status/preflight inventory was built from human_health_trv_values.json alone, while the live calculator loads the 3-file union (1779 rows); ALL arbitration counts should be re-derived from the union, not from the HH file. This packet does so.
- DECISION NEEDED: Reconcile counts and clarify the "20 supersede-or-reject" list reference.
- OPTIONS / DATA: n/a
- AI RECOMMENDATION: treat the FULL-UNION 33 substances / 62 groups / 157 rows (and the 8-substance / 41-row IRIS needs_review subset) as the operative inventory unless the owner says otherwise; do NOT use the HH-only 13/31/85 undercount.
- owner --apply required: NO (reconciliation)
- PASTE-READY APPROVAL SENTENCE: "Operative arbitration inventory = <the verified counts / or your correction>; the '20 supersede-or-reject' refers to <clarification>."
