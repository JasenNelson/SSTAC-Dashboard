import { describe, expect, it } from 'vitest';
import { SUBSTANCE_LIBRARY } from '../../substanceLibrary';
import {
  PARAMETER_VALUE_RECORDS,
  getParameterValueRecord,
  getSourceRecord,
} from '../catalog';
import {
  buildCalculatorEvidenceRequest,
  buildEvidenceLibraryView,
  buildProtocol28ReviewSummary,
  createEvidenceLibraryFilters,
  getParameterValueReviewDisposition,
  getSourceLeadReviewDisposition,
} from '../library';
import type { SourceRecord } from '../types';

describe('matrix options evidence library helpers', () => {
  it('builds the default view from repo-local catalog records', () => {
    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters());

    expect(view.totalCounts.sources).toBeGreaterThan(20);
    expect(view.totalCounts.values).toBeGreaterThan(20);
    expect(view.totalCounts.equations).toBe(5);
    expect(view.totalCounts.sourceLeads).toBe(4);
    expect(view.values.length).toBe(view.totalCounts.values);
    expect(view.equations.length).toBe(view.totalCounts.equations);
    // Catalog regenerated 2026-06-01 (class-1 collapse + class-3 dirty exclusion + IRIS EPA
    // data-integrity gate; IRIS coverage expanded to the snapshot-validated master-list set).
    // 2026-06-02 IRIS orphan expansion landed in batches: first +95 (new-input + ambiguous),
    // then new-substance orphans in batches of ~113 substances. All US EPA IRIS records carry
    // default_status=available_option, qa_status=needs_review; every value validated against the
    // EPA snapshot within 2%. This batch (new-substance B3, FINAL, pass d0c00017, +255 records)
    // closes the new-substance orphan backlog (recon remaining now 0) on top of B2 (d0c00016).
    // valueGroups counts UNIQUE candidate_group_id over the full view (HH-TRV +
    // parameter_values.json) -> 1599 groups, because multi-endpoint candidate families
    // intentionally share one group id. (2026-06-03: -1 from 1600 -- the asbestos IUR was a
    // singleton candidate_group, deleted as a non-convertible fiber-unit defect.)
    // 2026-06-09: +1 (1599 -> 1600) -- the 3 BC WLRS 2023 fish-ingestion-rate candidates
    // (subsistence/recreational/low-level) share ONE candidate_group_id
    // (human-health-food__generic__IR_food_kg_per_day__BC), so they add 1 slot, not 3.
    // 2026-06-09: -4 (1600 -> 1596) -- BC_provincial -> BC jurisdiction normalization. The
    // 355 P28 rows retag jurisdiction BC_provincial -> BC and their candidate_group_id suffix
    // __BC_provincial -> __BC; 4 of those normalized groups (arsenic_inorganic hh-food rfd+sf,
    // benzo_a_pyrene hh-direct+hh-food sf) MERGE into pre-existing identical-value __BC groups.
    // 2026-06-10: +1 (1596 -> 1597) -- US EPA IR_food general candidate (needs_review):
    // pv-epa-2000-ir-food-general-us adds candidate_group_id
    // human-health-food__generic__IR_food_kg_per_day__US_federal (new group, not shared).
    // 2026-06-11: +1 (1597 -> 1598) -- C-3 BC WLRS adult body weight (needs_review):
    // pv-wlrs-2023-bw-adult-bc adds candidate_group_id
    // human-health-food__generic__BW_kg__BC (new group, not shared).
    // 2026-06-11: +1 (1598 -> 1599) -- C-4 US EPA adult body weight (needs_review):
    // pv-epa-2000-bw-adult-us adds candidate_group_id
    // human-health-food__generic__BW_kg__US_federal (new group, not shared).
    // 2026-06-11: +3 (1599 -> 1602) -- Phase D HC PQRA v4.0 direct-contact exposure
    // factors (needs_review): three new candidate groups
    // human-health-direct__generic__{EF_days_per_year,ED_years,AT_cancer_years}__general
    // (EF and ED each hold two land-use variants that SHARE one group; AT holds one).
    // 2026-06-11: +2 (1602 -> 1604) -- Phase D follow-on HC PQRA v4.0 Appendix E
    // direct-contact receptor characteristics (needs_review): two new candidate groups
    // human-health-direct__generic__{BW_kg,IR_sed_mg_per_day}__general (BW holds 5 age-group
    // variants sharing one group; IR_sed holds 3 age/land-use variants sharing one).
    // 2026-06-12: +2 (1604 -> 1606) -- HC PQRA v4.0 Appendix E dermal receptor characteristics
    // (needs_review): two new candidate groups human-health-direct__generic__{SA_cm2,
    // AF_sed_mg_per_cm2}__general (SA holds 6 total-body age/worker variants; AF holds 2).
    // 2026-06-14: +1 (1606 -> 1607) -- ACFN community-specific food-web IR_food record
    // (pv-acfn-wqciu-2023-ir-food-community-specific) adds candidate_group_id
    // human-health-food__generic__IR_food_kg_per_day__general (new __general slot, NOT shared
    // with the BC / US_federal IR_food groups). Its BW seed reuses the existing BW_kg__BC group.
    // 2026-06-14: +0 (1607 -> 1607) -- TWN toddler subsistence records (IR + BW) both use
    // EXISTING BC candidate_group_ids (IR_food_kg_per_day__BC + BW_kg__BC); no new groups.
    // 2026-06-17: +74 (1607 -> 1681) -- eco-wiring Step 2 wires eco_values.json (96 needs_review
    // rows) into PARAMETER_VALUE_RECORDS: 45 unique eco-direct groups
    // (eco-direct-eqp__{substance}__fcv_ug_per_L__US_federal; the 6 multi-source substances --
    // diazinon/malathion/methoxychlor/endosulfan_alpha/endosulfan_beta/toxaphene -- each SHARE one
    // group across their ESB+NRWQC rows) + 29 unique eco-food groups
    // (eco-food-bsaf__{substance}__trv_eco_mg_per_kg_bw_day__Canada_federal; mammal+bird rows for a
    // substance SHARE one group) = 74 new groups.
    // 2026-06-19: +1 -- CCME chloroform eco-direct row (new group
    // eco-direct-eqp__chloroform__fcv_ug_per_L__Canada_federal) = 1682.
    // 2026-06-20c: +4 -- US EPA 2024 PFOA/PFOS hh-direct+hh-food RfD rows (4 new
    // __US_federal candidate groups) = 1686.
    // 2026-07-02: -1 (1686 -> 1685) -- current-default integrity fix deleted pv-bap-trv-eco
    // (benzo_a_pyrene eco-food TRV nulled in the library by #444); it was the sole member of the
    // unique eco-food-bsaf__benzo_a_pyrene__trv_eco_mg_per_kg_bw_day__general candidate group.
    // 2026-07-02b: -3 (1685 -> 1682) -- eco-statics correction DELETED 3 more fabricated-source
    // current_default scaffolds (pv-bap-fcv, pv-pcb-trv-eco, pv-mehg-trv-eco), each the sole member
    // of its own candidate group (eco-direct-eqp__benzo_a_pyrene__fcv_ug_per_L__general,
    // eco-food-bsaf__total_pcbs_aroclor_1254__trv_eco_mg_per_kg_bw_day__general,
    // eco-food-bsaf__methylmercury__trv_eco_mg_per_kg_bw_day__general). The companion promotion
    // (pv-pcb-fcv re-cited + approved) reuses its EXISTING candidate group, so it adds none.
    // 2026-07-03: +1 (1682 -> 1683) -- methylmercury eco-food wildlife TDIs wired dynamically
    // (CCME 2000, mammal 0.022 + bird 0.031 mg/kg-bw/day). Both rows share ONE new candidate group
    // eco-food-bsaf__methylmercury__trv_eco_mg_per_kg_bw_day__Canada_federal (distinct from the
    // deleted __general scaffold group), so they add +1 unique group (unchanged by the 2026-07-03
    // HITL promotion to approved -- promotion flips qa/evidence status, not the group count).
    expect(view.valueGroups).toHaveLength(1683);
    // approvedSourceBacked: was 1219; -1 (asbestos IUR deletion) = 1218.
    // (P28 rows use pending_source_locator, not approved_source_backed.)
    // 2026-06-09: +1 -- WLRS recreational fish-ingestion-rate (pv-wlrs-2023-ir-food-
    // recreational-bc) promoted to approved_source_backed (HITL, J. Nelson) = 1219.
    // 2026-06-10: +1 -- US EPA general-population fish-ingestion-rate (pv-epa-2000-ir-food-
    // general-us) promoted to approved_source_backed (C-nonBC, HITL, J. Nelson) = 1220.
    // 2026-06-12: +2 -- C-3/C-4 adult body weights promoted to approved_source_backed
    // (pv-wlrs-2023-bw-adult-bc + pv-epa-2000-bw-adult-us; HITL J. Nelson, inline-approved
    // --apply) = 1222.
    // 2026-06-12: +7 -- C-HH-direct HC PQRA v4.0 toddler receptor exposure factors promoted
    // to approved_source_backed (BW/IR_sed/EF/ED/AT_cancer/SA/AF; HITL J. Nelson, inline-
    // approved --apply via promote-hc-pqra-direct.mjs) = 1229.
    // 2026-06-12: +3 -- C-HH-direct 2nd receptor scenario (residential adult) adult-specific
    // seeds promoted to approved_source_backed (pv-hc-pqra-v4-2024-bw-adult-ca 70.7 kg +
    // ir-sed-general 20 mg/day + sa-total-adult 17640 cm2; primary-source + codex verified,
    // HITL J. Nelson inline-approved --apply via promote-hc-pqra-adult.mjs) = 1232.
    // 2026-06-13: +5 -- C-HH-direct 3rd receptor scenario (commercial/industrial worker)
    // worker-specific seeds promoted to approved_source_backed (ef-commercial 240 days/yr +
    // ed-commercial 35 yr + ir-sed-worker 100 mg/day + sa-total-worker 16640 cm2 +
    // af-sed-other-worker 0.1 mg/cm2; HITL J. Nelson inline-approved --apply via
    // promote-hc-pqra-worker.mjs) = 1237.
    // 2026-06-13: +1 -- Phase D food-web subsistence-fisher IR_food record promoted to
    // approved_source_backed (pv-wlrs-2023-ir-food-subsistence-bc, 0.22 kg/day; HITL
    // J. Nelson, BC WLRS 2023 Table 2 + TWN corroboration; promote-wlrs-subsistence.mjs
    // --apply) = 1238.
    // 2026-06-14: +1 -- Phase D food-web ACFN community-specific IR_food record promoted to
    // approved_source_backed (pv-acfn-wqciu-2023-ir-food-community-specific, 0.388 kg/day;
    // HITL J. Nelson, WQCIU 2023 primary verified; promote-acfn-foodweb.mjs --apply) = 1239.
    // 2026-06-14: +0 -- TWN toddler subsistence food-web records (IR + BW) added as needs_review /
    // pending_source_locator (uniform pre-promotion shape; catalog-invariant fix 2026-06-14) = 1239.
    // 2026-06-15: +2 -- TWN toddler subsistence IR + BW promoted out of pending to
    // approved_source_backed (HITL J. Nelson, inline-approved --apply via
    // promote-twn-foodweb-toddler.mjs; IR verified vs TWN BIWQO 2021 Table 1, p.11) = 1241.
    // 2026-06-19: +1 -- CCME chloroform eco-direct row promoted to approved_source_backed (Step-6 4B
    // CCME pilot; HITL J. Nelson inline-approved --apply via promote-eco-source.mjs; 1.8 ug/L verified
    // vs the CCME factsheet PDF) = 1242.
    // 2026-06-19: +96 -- the remaining 3 eco source batches promoted to approved_source_backed
    // (Step-6 4B: ESB 32 + FCSAP 45 + NRWQC 19; HITL J. Nelson inline-approved --apply via
    // promote-eco-source.mjs; all 96 machine-verified vs the pinned sources by an adversarial
    // verify+refute workflow). The entire eco catalog (97 rows) is now approved. = 1338.
    // 2026-06-20c: US EPA 2024 PFOA/PFOS rows are needs_review + pending_source_locator
    // (source verified in sources.json but rows un-promoted), so approvedSourceBacked is
    // unchanged; they count under pendingSourceLocator instead = 1338.
    // 2026-06-21: +11 -- owner-attested promotion of 17 rows; 11 move pending->approved_source_backed
    // (4 US EPA PFOA/PFOS + 6 HC PQRA lifestage + 1 WLRS low-level; the 6 IRIS carcinogen RfD rows
    // were already approved_source_backed so they do not add) = 1349.
    // 2026-07-02b: +1 -- eco-statics correction promoted pv-pcb-fcv (total_pcbs_aroclor_1254 eco-direct
    // FCV) from current_calculator_scaffold to approved_source_backed (re-cited to the real US EPA
    // NRWQC total-PCBs chronic criterion via promote-pcb-fcv-nrwqc.mjs) = 1350.
    // 2026-07-03: +2 (1350 -> 1352) -- methylmercury eco-food wildlife TDIs (mammal 0.022 + bird
    // 0.031) HITL-promoted to approved_source_backed (J. Nelson, promote-eco-source.mjs --apply).
    expect(view.audit.values.approvedSourceBacked).toBe(1352);
    // pendingSourceLocator: 355 P28 (soil + water/vapour) + 15 base/other pending = 370;
    // 2026-06-09: +3 BC WLRS fish-ingestion-rate candidates (needs_review/pending) = 373;
    // -1 -- WLRS recreational promoted out of pending (HITL, J. Nelson) = 372.
    // 2026-06-10: +1 US EPA IR_food general candidate (needs_review / pending_source_locator) = 373;
    // -1 -- US EPA general candidate promoted out of pending (C-nonBC, HITL, J. Nelson) = 372.
    // 2026-06-11: +1 -- C-3 BC WLRS adult body weight (pv-wlrs-2023-bw-adult-bc,
    // needs_review / pending_source_locator; promoted out later by owner --apply) = 373.
    // 2026-06-11: +1 -- C-4 US EPA adult body weight (pv-epa-2000-bw-adult-us,
    // needs_review / pending_source_locator; promoted out later by owner --apply) = 374.
    // 2026-06-11: +5 -- Phase D HC PQRA v4.0 direct-contact EF/ED/AT rows (5 records,
    // all needs_review / pending_source_locator) = 379.
    // 2026-06-11: +8 -- Phase D follow-on HC PQRA v4.0 Appendix E receptor characteristics
    // (5 BW_kg + 3 IR_sed_mg_per_day, all needs_review / pending_source_locator) = 387.
    // 2026-06-12: -2 -- C-3/C-4 adult body weights promoted out of pending (HITL J. Nelson,
    // inline-approved --apply) = 385.
    // 2026-06-12: +8 -- HC PQRA v4.0 Appendix E dermal receptor characteristics (6 SA_cm2 +
    // 2 AF_sed_mg_per_cm2, all needs_review / pending_source_locator) = 393.
    // 2026-06-12: -7 -- C-HH-direct HC PQRA v4.0 toddler receptor exposure factors promoted
    // out of pending (BW/IR_sed/EF/ED/AT_cancer/SA/AF; HITL J. Nelson, inline-approved
    // --apply via promote-hc-pqra-direct.mjs) = 386.
    // 2026-06-12: -3 -- C-HH-direct residential-adult scenario adult-specific seeds promoted
    // out of pending (bw-adult + ir-sed-general + sa-total-adult; HITL J. Nelson, inline-
    // approved --apply via promote-hc-pqra-adult.mjs) = 383.
    // 2026-06-13: -5 -- C-HH-direct commercial/industrial worker scenario 5 worker-specific
    // seeds promoted out of pending (ef-commercial + ed-commercial + ir-sed-worker +
    // sa-total-worker + af-sed-other-worker; HITL J. Nelson inline-approved --apply via
    // promote-hc-pqra-worker.mjs) = 378.
    // 2026-06-13: -1 -- subsistence-fisher IR_food promoted out of pending
    // (pv-wlrs-2023-ir-food-subsistence-bc; promote-wlrs-subsistence.mjs --apply) = 377.
    // 2026-06-14: +2 -- TWN toddler subsistence food-web records (IR + BW, both
    // needs_review / pending_source_locator; uniform pre-promotion shape; catalog-invariant
    // fix 2026-06-14 makes BW standard needs_review matching IR). = 379.
    // 2026-06-15: -2 -- TWN toddler subsistence IR + BW promoted out of pending (HITL J. Nelson,
    // inline-approved --apply via promote-twn-foodweb-toddler.mjs) = 377.
    // 2026-06-17: +96 -- eco-wiring Step 2: all 96 eco rows carry
    // evidence_support_status=pending_source_locator (needs_review eco candidates) = 473.
    // 2026-06-19: +1 -- CCME chloroform eco-direct row (needs_review / pending_source_locator) = 474.
    // 2026-06-19: -1 -- CCME chloroform promoted out of pending (Step-6 4B CCME pilot --apply) = 473.
    // 2026-06-19: -96 -- ESB 32 + FCSAP 45 + NRWQC 19 promoted out of pending (Step-6 4B --apply);
    // the entire eco catalog is now approved, so 0 eco rows remain pending. = 377.
    // 2026-06-20c: +4 -- US EPA 2024 PFOA/PFOS RfD rows (needs_review /
    // pending_source_locator; source verified, rows un-promoted) = 381.
    // 2026-06-21: -11 -- owner-attested promotion moves 11 rows out of pending (4 PFOA/PFOS +
    // 6 HC PQRA lifestage + 1 WLRS low-level) = 370.
    // 2026-06-22: -4 -- BC P28 source dedup deleted 4 exact-duplicate HH rows (pending) that were
    // twins of the verification-packet rows; the other 351 stay pending (re-keyed to v3.0). = 366.
    // 2026-07-02: -1 (366 -> 365) -- pv-bap-trv-eco (pending_source_locator) deleted by the
    // current-default integrity fix.
    // 2026-07-03: +2 then -2 (362 -> 364 -> 362) -- methylmercury eco-food wildlife TDIs wired
    // dynamically (CCME 2000; pv-eco-methylmercury-food-trveco-mammal-ccmetrg 0.022 + -bird-ccmetrg
    // 0.031). Generated needs_review (pending_source_locator, +2), then HITL-promoted to approved
    // (2026-07-03, J. Nelson, promote-eco-source.mjs --apply) which moved both to
    // approved_source_backed (-2). Net 0 on pendingSourceLocator; see approvedSourceBacked +2 above.
    // 2026-07-02b: -3 (365 -> 362) -- eco-statics correction DELETED 3 more fabricated-source
    // current_default scaffolds, all pending_source_locator (pv-bap-fcv, pv-pcb-trv-eco,
    // pv-mehg-trv-eco).
    expect(view.audit.values.pendingSourceLocator).toBe(362);
    // 2026-07-02b: -1 (65 -> 64) -- pv-pcb-fcv moved OUT of current_calculator_scaffold when promoted
    // to approved_source_backed (see approvedSourceBacked above).
    expect(view.audit.values.currentCalculatorScaffold).toBe(64);
    // 2026-07-02: -1 (57 -> 56) -- pv-bap-trv-eco (a current_default row) deleted by the
    // current-default integrity fix (nulled library field must have no current_default scaffold).
    // 2026-07-02b: -3 (56 -> 53) -- eco-statics correction DELETED 3 more current_default scaffolds
    // (pv-bap-fcv, pv-pcb-trv-eco, pv-mehg-trv-eco). pv-pcb-fcv's PROMOTION does not change this count
    // -- default_status stays current_default (unchanged); only qa/evidence status moved.
    // 2026-07-05: +2 (81 -> 83) -- IRIS chlorobenzene oral RfD promoted to current_default.
    expect(view.audit.values.currentDefaults).toBe(83);
    // availableOptions: was 1580; -1 (asbestos IUR deletion) = 1579. The ETBE IUR value
    // re-scale (8e-5 -> 8e-8 per ug/m3) does not change any count.
    // 2026-06-09: +3 BC WLRS fish-ingestion-rate candidates (available_option) = 1582.
    // 2026-06-10: +1 US EPA IR_food general candidate (available_option) = 1583.
    // 2026-06-11: +1 C-3 BC WLRS adult body weight (available_option) = 1584.
    // 2026-06-11: +1 C-4 US EPA adult body weight (available_option) = 1585.
    // 2026-06-11: +5 Phase D HC PQRA v4.0 direct-contact EF/ED/AT rows (available_option) = 1590.
    // 2026-06-11: +8 Phase D follow-on HC PQRA v4.0 Appendix E receptor characteristics
    // (5 BW_kg + 3 IR_sed_mg_per_day, available_option) = 1598.
    // 2026-06-12: +8 HC PQRA v4.0 Appendix E dermal receptor characteristics
    // (6 SA_cm2 + 2 AF_sed_mg_per_cm2, available_option) = 1606.
    // 2026-06-14: +1 ACFN community-specific food-web IR_food record (available_option) = 1607.
    // 2026-06-14: +2 TWN toddler subsistence food-web records (IR + BW, both available_option,
    // needs_review pre-promotion) = 1609.
    // 2026-06-17: +96 -- eco-wiring Step 2: all 96 eco rows carry default_status=available_option = 1705.
    // 2026-06-19: +1 -- CCME chloroform eco-direct row (available_option) = 1706.
    // 2026-06-20c: +4 -- US EPA 2024 PFOA/PFOS RfD rows (available_option) = 1710.
    // 2026-06-22: -4 -- BC P28 source dedup deleted 4 exact-duplicate available_option HH rows = 1706.
    // 2026-07-03: +2 (1706 -> 1708) -- methylmercury eco-food wildlife TDIs (CCME 2000; mammal 0.022
    // + bird 0.031), both default_status available_option.
    // 2026-07-05: -28 (1708 -> 1680) -- owner-approved current_default sweep across 18
    // substance/endpoint tuples: 36 human_health_trv_values.json rows flip available_option ->
    // current_default (the newly-picked HC/US EPA rows, each duplicated across 2 frame-scoped
    // records), offset by 8 parameter_values.json needs_review scaffold rows demoted
    // current_default -> available_option (the old current-calculator placeholders that no
    // longer hold the default once a real catalog row was promoted). Net -36 + 8 = -28. See the
    // matching +28 on currentDefaults above.
    // 2026-07-05: -4 (1680 -> 1676) -- 2 HC chlorobenzene rows demoted to not_default, 2 IRIS rows promoted to current_default.
    // 2026-07-06 CORRECTION: PR #513's chlorobenzene demotion (2026-07-05) was based on an unverified
    // theory ("1,2-DCB mis-attribution") that direct extraction of the real HC TRV v4.0 (2025) source
    // PDF disproved -- 0.43 mg/kgBW-day is chlorobenzene's genuine, correctly-derived HC Oral TDI (page
    // 25), never mis-filed. The 2 rows are restored to available_option (current_default is
    // deliberately left untouched pending owner sign-off -- see
    // docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md). +2 (1676 -> 1678); the IRIS
    // current_default promotion from 2026-07-05 is unaffected.
    expect(view.audit.values.availableOptions).toBe(1678);
    // 2026-07-06 CORRECTION: the 2 chlorobenzene rows leave not_default (see above). -2 (19 -> 17).
    expect(view.audit.values.notDefaults).toBe(17);
    expect(view.audit.equations.pendingReview).toBe(5);
    expect(view.audit.equations.pendingSourceLocator).toBe(2);
    expect(view.audit.equations.currentCalculatorScaffold).toBe(3);
    expect(view.audit.sourceLeads.equationLeads).toBe(10);
    expect(view.audit.sourceLeads.parameterValueLeads).toBe(9);
    expect(view.audit.sourceLeads.canonicalSourceLeads).toBe(22);
    expect(view.audit.sourceLeads.documentLeads).toBe(25);
  });

  it('filters values and equations by human-health pathway', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['human-health-direct'],
      }),
    );

    expect(view.values.length).toBeGreaterThan(0);
    expect(view.values.every((row) => row.record.pathway === 'human-health-direct')).toBe(true);
    expect(view.equations).toHaveLength(1);
    expect(view.equations[0].record.equation_id).toBe(
      'eq-human-health-direct-contact',
    );
    // sources order updated 2026-05-31: src-bc-protocol-28-2021-jan added by d0c00003 HH-direct records.
    // 2026-06-11: src-health-canada-pqra-v4-2024 added by the Phase D HC PQRA v4.0
    // direct-contact EF/ED/AT rows (needs_review); appears in source order after the
    // US EPA IRIS sources and before src-health-canada-trv-v4-2025.
    // 2026-06-20c: src-us-epa-pfoa-2024 + src-us-epa-pfos-2024 added by the Batch F US EPA
    // 2024 PFOA/PFOS hh-direct RfD rows (needs_review; split per-substance source records so
    // each links its own EPA assessment); both sort last in the HH-direct source list.
    // 2026-06-22: src-bc-protocol-28-2021-jan REMOVED -- BC P28 source dedup retired the mislabeled
    // id (HH-direct rows re-keyed to the canonical src-bc-protocol-28-v3-0-2024, which remains below).
    expect(view.sources.map((row) => row.record.source_id)).toEqual([
      'src-us-epa-iris-rfd-table-live',
      'src-us-epa-iris-chemical-details-live',
      'src-health-canada-pqra-v4-2024',
      'src-health-canada-trv-v4-2025',
      'src-bc-protocol-28-v3-0-2024',
      'src-us-epa-pfoa-2024',
      'src-us-epa-pfos-2024',
    ]);
  });

  it('filters by receptor and population scaffolds', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        receptorGroups: ['human'],
        populationGroups: ['screening adult'],
      }),
    );

    expect(view.values.length).toBeGreaterThan(0);
    expect(
      view.values.every(
        (row) =>
          row.receptorGroups.includes('human') &&
          row.populationGroups.includes('screening adult'),
      ),
    ).toBe(true);
  });

  it('filters equations through linked substance value records', () => {
    const matchingView = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['eco-direct-eqp'],
        substanceKeys: ['benzo_a_pyrene'],
      }),
    );
    const nonMatchingView = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['eco-direct-eqp'],
        substanceKeys: ['copper'],
      }),
    );

    expect(matchingView.equations.map((row) => row.record.equation_id)).toEqual([
      'eq-eco-direct-eqp-di-toro',
    ]);
    expect(nonMatchingView.equations).toHaveLength(0);
  });

  it('searches across source, value, and evidence text', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        search: 'Aroclor 1254 freshwater BSAF',
      }),
    );

    expect(
      view.values.some(
        (row) => row.record.parameter_value_id === 'pv-pcb-hh-food-bsaf',
      ),
    ).toBe(true);
  });

  it('builds exact calculator drill-in requests', () => {
    const rows = [
      {
        catalog_record:
          PARAMETER_VALUE_RECORDS.find(
            (record) => record.parameter_value_id === 'pv-pcb-hh-food-bsaf',
          ) ?? null,
        sources: [],
      },
    ];
    const request = buildCalculatorEvidenceRequest(
      'human-health-food',
      rows,
      ['eq-human-health-food-web'],
    );
    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters(request));

    expect(view.values.map((row) => row.record.parameter_value_id)).toEqual([
      'pv-pcb-hh-food-bsaf',
    ]);
    expect(request.candidateGroupIds).toEqual([
      'human-health-food__total_pcbs_aroclor_1254__bsaf_loc_freshwater__general',
    ]);
    expect(view.equations.map((row) => row.record.equation_id)).toEqual([
      'eq-human-health-food-web',
    ]);
    expect(view.sources).toHaveLength(0);
  });

  it('filters alternatives by pathway, substance, and input key across jurisdictions', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: ['arsenic_inorganic'],
        inputKeys: ['rfd_oral_mg_per_kg_bw_day'],
      }),
    );

    // values and valueGroups updated 2026-05-31: pv-p28-arsenic_inorganic-hh-food-rfd added by d0c00003.
    // 2026-06-22: pv-p28-arsenic_inorganic-hh-food-rfd REMOVED -- BC P28 source dedup deleted it as an
    // exact-duplicate twin of pv-p28-arsenic-hh-food-rfd (the verification-packet row kept on v3.0).
    expect(view.values.map((row) => row.record.parameter_value_id).sort()).toEqual([
      'pv-arsenic-hh-food-rfd',
      'pv-iris-arsenic-hh-food-rfd',
      'pv-p28-arsenic-hh-food-rfd',
    ]);
    // 2026-06-09: the __BC_provincial group merged into __BC after the
    // BC_provincial -> BC jurisdiction normalization (identical-value duplicate).
    expect(view.valueGroups.map((group) => group.groupId).sort()).toEqual([
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__BC',
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__US_federal',
      'human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__general',
    ]);
  });

  it('finds Health Canada and IRIS TRVs by extraction date', () => {
    const view = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        search: '2026-05-23',
        pathways: ['human-health-food'],
        substanceKeys: ['benzo_a_pyrene'],
        evidenceSupportStatuses: ['approved_source_backed'],
      }),
    );

    expect(view.values.map((row) => row.record.parameter_value_id).sort()).toEqual([
      'pv-hc-bap-hh-food-rfd-tdi',
      'pv-hc-bap-hh-food-sf',
      'pv-iris-bap-hh-food-rfd-immune',
      'pv-iris-bap-hh-food-rfd-neuro',
      'pv-iris-bap-hh-food-rfd-repro',
      'pv-iris-bap-hh-food-sf',
    ]);
    expect(
      view.values.every(
        (row) => row.record.evidence_support_status === 'approved_source_backed',
      ),
    ).toBe(true);
  });

  it('labels Phase 1 review dispositions without promoting defaults', () => {
    const healthCanada = PARAMETER_VALUE_RECORDS.find(
      (record) => record.parameter_value_id === 'pv-hc-bap-hh-food-rfd-tdi',
    );
    const protocol28 = PARAMETER_VALUE_RECORDS.find(
      (record) => record.parameter_value_id === 'pv-p28-arsenic-hh-food-rfd',
    );
    const erdcBsaf = PARAMETER_VALUE_RECORDS.find(
      (record) => record.parameter_value_id === 'pv-bap-bsaf-freshwater',
    );

    expect(healthCanada).toBeDefined();
    expect(protocol28).toBeDefined();
    expect(erdcBsaf).toBeDefined();

    const sourceRecordsFor = (sourceIds: string[]) =>
      sourceIds
        .map((sourceId) => getSourceRecord(sourceId))
        .filter((source): source is SourceRecord => Boolean(source));

    expect(
      getParameterValueReviewDisposition(
        healthCanada!,
        sourceRecordsFor(healthCanada!.source_ids),
      ),
    ).toMatchObject({
      label: 'Approved alternative',
      blocksCalculatorDefault: true,
    });
    expect(
      getParameterValueReviewDisposition(
        protocol28!,
        sourceRecordsFor(protocol28!.source_ids),
      ),
    ).toMatchObject({
      label: 'Needs original-source verification',
      blocksCalculatorDefault: true,
    });
    expect(
      getParameterValueReviewDisposition(
        erdcBsaf!,
        sourceRecordsFor(erdcBsaf!.source_ids),
      ),
    ).toMatchObject({
      label: 'Needs original-source verification',
      blocksCalculatorDefault: true,
    });

    const sourceLeads = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        search: 'WQCIU',
      }),
    ).sourceLeads;

    expect(sourceLeads.length).toBeGreaterThan(0);
    expect(getSourceLeadReviewDisposition(sourceLeads[0])).toMatchObject({
      label: 'Needs original-source verification',
      blocksCalculatorDefault: true,
    });
  });

  it('summarizes Protocol 28 as a blocked review queue', () => {
    const summary = buildProtocol28ReviewSummary();

    // candidateValueCount/blockedCandidateCount recomputed 2026-06-01:
    // 355 generated P28 records (soil + water/vapour, after class-1 collapse + 5 dirty exclusions)
    // + 6 other P28-aligned pending records = 361 human-health pending P28 records.
    // 2026-06-22: -4 -- BC P28 source dedup deleted 4 exact-duplicate HH twins (the other 351 re-keyed
    // to the canonical v3.0 id, still pending) so the P28 pending queue is 351 + 6 = 357.
    expect(summary).toMatchObject({
      candidateValueCount: 357,
      blockedCandidateCount: 357,
      currentDefaultCount: 0,
      sourceLeadSetCount: 1,
      canDriveCalculatorDefaults: false,
    });
    expect(summary.nextActions.length).toBeGreaterThan(0);
    expect(summary.nextActions.join(' ')).toMatch(
      /original government or regulatory source/i,
    );
  });

  it('keeps mixed calculator value and equation sources visible in drill-ins', () => {
    // pv-bap-fcv was DELETED 2026-07-02 (fabricated-source demotion -- see substanceLibrary.ts
    // benzo_a_pyrene notes). Use pv-pcb-logkow (a different eco-direct-eqp record, unaffected by the
    // correction) so this test still exercises two distinct value records mixed with an equation.
    const rows = ['pv-bap-logkow', 'pv-pcb-logkow'].map((parameterValueId) => ({
      catalog_record:
        PARAMETER_VALUE_RECORDS.find(
          (record) => record.parameter_value_id === parameterValueId,
        ) ?? null,
      sources:
        PARAMETER_VALUE_RECORDS.find(
          (record) => record.parameter_value_id === parameterValueId,
        )?.source_ids.flatMap((sourceId) => {
          const source = getSourceRecord(sourceId);
          return source ? [source] : [];
        }) ?? [],
    }));
    const request = buildCalculatorEvidenceRequest(
      'eco-direct-eqp',
      rows,
      ['eq-eco-direct-eqp-di-toro'],
    );
    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters(request));

    expect(view.values.map((row) => row.record.parameter_value_id).sort()).toEqual(
      ['pv-bap-logkow', 'pv-pcb-logkow'],
    );
    expect(view.equations.map((row) => row.record.equation_id)).toEqual([
      'eq-eco-direct-eqp-di-toro',
    ]);
    expect(view.sources.map((row) => row.record.source_id).sort()).toEqual([
      'src-us-epa-esb-tier2-nonionic-organics-2008',
      'src-us-epa-iris-aroclor-1254',
    ]);
  });

  it('keeps HH scaffolds as current-calculator needs-review records', () => {
    const hhRecords = PARAMETER_VALUE_RECORDS.filter(
      (record) =>
        record.pathway.startsWith('human-health') &&
        record.source_ids.includes('src-current-calculator-design-v1'),
    );

    expect(hhRecords.length).toBeGreaterThan(0);
    for (const record of hhRecords) {
      expect(record.qa_status, record.parameter_value_id).toBe('needs_review');
      expect(
        ['current_default', 'not_default', 'available_option'],
        record.parameter_value_id,
      ).toContain(record.default_status);
      expect(record.evidence_support_status, record.parameter_value_id).toBe(
        'current_calculator_scaffold',
      );
      expect(record.source_ids, record.parameter_value_id).toEqual([
        'src-current-calculator-design-v1',
      ]);
      expect(record.evidence_items.length, record.parameter_value_id).toBeGreaterThan(0);
      for (const evidence of record.evidence_items) {
        expect(evidence.extraction_method, evidence.evidence_id).toBe(
          'current_calculator_scaffold',
        );
        expect(evidence.locator_type, evidence.evidence_id).toBe(
          'current_calculator',
        );
        expect(evidence.qa_status, evidence.evidence_id).toBe('needs_review');
      }
    }
  });

  it('catalogs every current HH calculator default input as a review scaffold', () => {
    const inputKeysByPathway = {
      'human-health-direct': [
        'rfd_oral_mg_per_kg_bw_day',
        'sf_oral_per_mg_per_kg_bw_per_day',
        'abs_dermal',
        'ba_oral',
      ],
      'human-health-food': [
        'rfd_oral_mg_per_kg_bw_day',
        'sf_oral_per_mg_per_kg_bw_per_day',
        'bsaf_loc_freshwater',
        'ba_oral',
      ],
    } as const;

    const scaffoldSubstanceKeys = new Set(
      PARAMETER_VALUE_RECORDS.filter(
        (record) =>
          record.pathway.startsWith('human-health') &&
          record.source_ids.includes('src-current-calculator-design-v1'),
      ).map((record) => record.substance_key),
    );
    const scaffoldSubstances = SUBSTANCE_LIBRARY.filter((substance) =>
      scaffoldSubstanceKeys.has(substance.key),
    );

    expect(scaffoldSubstances.map((substance) => substance.key).sort()).toEqual([
      'arsenic_inorganic',
      'benzo_a_pyrene',
      'cadmium',
      'copper',
      'lead',
      'methylmercury',
      'total_pcbs_aroclor_1254',
      'zinc',
    ]);
    expect(scaffoldSubstanceKeys.has('benzene')).toBe(false);

    for (const substance of scaffoldSubstances) {
      for (const [pathway, inputKeys] of Object.entries(inputKeysByPathway)) {
        for (const inputKey of inputKeys) {
          const record = getParameterValueRecord(
            substance.key,
            pathway as keyof typeof inputKeysByPathway,
            inputKey,
          );

          expect(record, `${substance.key} ${pathway} ${inputKey}`).toBeDefined();
          expect(record?.qa_status).toBe('needs_review');
          expect(record?.source_ids).toEqual(['src-current-calculator-design-v1']);
          expect(record?.candidate_group_id).toBe(
            `${pathway}__${substance.key}__${inputKey}__general`,
          );
          expect(record?.evidence_support_status).toBe(
            'current_calculator_scaffold',
          );
          expect(record?.evidence_items[0]?.extraction_method).toBe(
            'current_calculator_scaffold',
          );
        }
      }
    }
  });
});

describe('buildEvidenceLibraryView live-merge of promoted records', () => {
  // Promoted (approved canonical) records are passed as extraRecords; they extend
  // ParameterValueRecord, so cloning a seed record and overriding the distinguishing
  // fields yields a valid fixture without restating every required field.
  const seed = PARAMETER_VALUE_RECORDS[0];

  function makeExtra(
    overrides: Partial<typeof seed> & { parameter_value_id: string },
  ): typeof seed {
    return { ...seed, ...overrides };
  }

  it('preserves baseline counts when extraRecords is empty (default path)', () => {
    const fromDefault = buildEvidenceLibraryView();
    const fromEmpty = buildEvidenceLibraryView(undefined, []);

    expect(fromEmpty.totalCounts.values).toBe(fromDefault.totalCounts.values);
    expect(fromEmpty.valueGroups).toHaveLength(fromDefault.valueGroups.length);
    expect(fromEmpty.audit.values.total).toBe(fromDefault.audit.values.total);
  });

  it('merges extra records into value rows and total counts', () => {
    const base = buildEvidenceLibraryView();
    const extra = makeExtra({
      parameter_value_id: 'pv-test-promoted-merge',
      substance_key: 'test_promoted_substance',
    });
    const view = buildEvidenceLibraryView(undefined, [extra]);

    expect(view.totalCounts.values).toBe(base.totalCounts.values + 1);
    expect(
      view.values.some(
        (row) => row.record.parameter_value_id === 'pv-test-promoted-merge',
      ),
    ).toBe(true);
  });

  it('dedups by parameter_value_id with promoted-wins on collision', () => {
    const base = buildEvidenceLibraryView();
    const collision = makeExtra({
      parameter_value_id: seed.parameter_value_id,
      value: 'PROMOTED_OVERRIDE',
    });
    const view = buildEvidenceLibraryView(undefined, [collision]);

    // Same id -> no new row added.
    expect(view.totalCounts.values).toBe(base.totalCounts.values);
    const row = view.values.find(
      (item) => item.record.parameter_value_id === seed.parameter_value_id,
    );
    // Promoted/extra record wins on collision.
    expect(row?.record.value).toBe('PROMOTED_OVERRIDE');
  });

  it('surfaces a promoted hh-toxicity-weighting pathway in the facet and rows', () => {
    const extra = makeExtra({
      parameter_value_id: 'pv-test-weighting',
      pathway: 'hh-toxicity-weighting',
    });
    const view = buildEvidenceLibraryView(undefined, [extra]);

    expect(
      view.facets.pathways.some(
        (option) => option.value === 'hh-toxicity-weighting',
      ),
    ).toBe(true);
    expect(
      view.values.some(
        (row) =>
          row.record.parameter_value_id === 'pv-test-weighting' &&
          row.record.pathway === 'hh-toxicity-weighting',
      ),
    ).toBe(true);
  });

  it('includes promoted rows in audit value counts', () => {
    const base = buildEvidenceLibraryView();
    const extra = makeExtra({
      parameter_value_id: 'pv-test-audit',
      evidence_support_status: 'approved_source_backed',
      default_status: 'available_option',
    });
    const view = buildEvidenceLibraryView(undefined, [extra]);

    expect(view.audit.values.total).toBe(base.audit.values.total + 1);
    expect(view.audit.values.approvedSourceBacked).toBe(
      base.audit.values.approvedSourceBacked + 1,
    );
    expect(view.audit.values.availableOptions).toBe(
      base.audit.values.availableOptions + 1,
    );
  });
});

describe('buildEvidenceLibraryView contextual facet counts', () => {
  const sumCounts = (options: { count: number }[]) =>
    options.reduce((total, option) => total + option.count, 0);

  it('narrows other facets to the active filter, but keeps the filtered dimension full', () => {
    const all = buildEvidenceLibraryView();
    const byPathway = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({ pathways: ['human-health-food'] }),
    );

    // The substances facet (its own dimension is NOT the active filter) now counts only the
    // records matching the active pathway filter -> fewer total than the unfiltered view.
    expect(sumCounts(byPathway.facets.substances)).toBeLessThan(
      sumCounts(all.facets.substances),
    );
    expect(byPathway.facets.substances.length).toBeGreaterThan(0);

    // The pathways facet clears its OWN selection, so every pathway option still appears
    // (so the user can switch pathways) -- same option set as unfiltered.
    expect(byPathway.facets.pathways.map((option) => option.value).sort()).toEqual(
      all.facets.pathways.map((option) => option.value).sort(),
    );
  });

  it('a facet count equals the result count when that option is then selected', () => {
    const byPathway = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({ pathways: ['human-health-food'] }),
    );
    const firstSubstance = byPathway.facets.substances[0];
    expect(firstSubstance).toBeDefined();

    // Selecting that substance on top of the pathway yields exactly the advertised count --
    // no "dropdown says N -> 0 results" mismatch.
    const combined = buildEvidenceLibraryView(
      createEvidenceLibraryFilters({
        pathways: ['human-health-food'],
        substanceKeys: [firstSubstance.value],
      }),
    );
    expect(combined.values.length).toBe(firstSubstance.count);
  });
});
