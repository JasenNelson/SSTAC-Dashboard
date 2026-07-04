// Starter substance library for the matrix-options calculator (v1).
// See design doc section 5 for the source table + per-row citations.
// All defaults are starting points the HITL can override. Every row is
// cited; if you change a number you MUST update the sources field too.
// Plain ASCII only.

import type { SubstanceEntry } from './types';

// `as const` so the keys land as literal types in callers' dropdowns.
export const SUBSTANCE_LIBRARY = [
  {
    key: 'benzo_a_pyrene',
    displayName: 'Benzo[a]pyrene',
    contaminantClass: 'organic-PAH',
    logKow: 6.13,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 2.0,
    bsaf_loc_freshwater: 0.5,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    // fcv_ug_per_L nulled 2026-07-02 (see notes below): the prior 0.014 cited EPA ESB Tier-2 as its
    // source, but B[a]P is not covered by that document (PAHs are handled separately); the value was
    // copy-pasted from the PCB NRWQC criterion. No verified BaP aquatic-life FCV exists in the catalog.
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS B[a]P oral SF 2.0 per mg/kg-bw/day, ADAF-adjusted lifetime default (2017 reassessment), src-us-epa-iris-chemical-details-live (pv-iris-bap-hh-direct-sf); a non-ADAF adult-only IRIS alternate (1.0) and an HC alternate (1.289) also exist; ERDC BSAF DB; ' +
      'Indigenous-Consumption-Pacific-NW Section 4.3',
    notes:
      'Coastal-marine bivalve scenarios: multiply freshwater BSAF by 15 ' +
      '(passive PAH accumulation; lack of hepatic CYP1A). See design ' +
      'doc section 8.2. SF corrected 1.0 -> 2.0 (IRIS 2017 ADAF-adjusted default); static eco TRV removed ' +
      '(stale Eco-SSL; this was a LIVE defect because bsaf_loc_freshwater is non-null -- the wrong static ' +
      'value was silently driving eco-food output; nulling forces the dynamic catalog resolver / explicit ' +
      'HITL receptor choice). fcv_ug_per_L nulled 2026-07-02: cited EPA ESB Tier-2 nonionic-organics ' +
      '(2008), but benzo[a]pyrene is not in that document (PAHs are handled separately); 0.014 was ' +
      'copy-pasted from the PCB NRWQC value. No verified BaP aquatic-life FCV exists in the catalog.',
  },
  {
    key: 'total_pcbs_aroclor_1254',
    displayName: 'Total PCBs (Aroclor 1254)',
    contaminantClass: 'organic-halogenated',
    logKow: 6.50,
    rfd_oral_mg_per_kg_bw_per_day: 2.0e-5,
    sf_oral_per_mg_per_kg_bw_per_day: 2.0,
    bsaf_loc_freshwater: 2.0,
    abs_dermal: 0.14,
    ba_oral: 1.0,
    // PCB FCV (chronic AWQC) 0.014 ug/L is VERIFIED 2026-07-02 against the real US EPA NRWQC
    // total-PCBs chronic criterion (CCC), which explicitly covers the sum of all congener / isomer /
    // homolog / Aroclor analyses -- see src-us-epa-nrwqc-aquatic-life-live and the promoted catalog
    // row pv-pcb-fcv (approved_source_backed). HITL still overrides per site congener mixture.
    fcv_ug_per_L: 0.014,
    // trv_eco_mg_per_kg_bw_day nulled 2026-07-02 (see notes below): the prior 0.00012 cited a
    // "US EPA Eco-SSL mammalian wildlife TRV (PCBs)" that does not exist as an EPA Eco-SSL document;
    // the value is unverifiable and has been removed.
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS Aroclor 1254 oral RfD (CASRN 11097-69-1, src-us-epa-iris-rfd-table-live); ' +
      'oral SF borrowed from the generic US EPA IRIS PCBs entry (CASRN 1336-36-3, ' +
      '"high risk and persistence" tier, src-us-epa-iris-chemical-details-live) -- IRIS has not ' +
      'assessed Aroclor 1254 carcinogenicity under its own CASRN; BSAF-Translation Section 4; ' +
      'FCV: US EPA National Recommended Water Quality Criteria - Aquatic Life Criteria Table, ' +
      'total-PCBs chronic (CCC), src-us-epa-nrwqc-aquatic-life-live (verified 2026-07-02, ' +
      'pv-pcb-fcv).',
    notes:
      'Do not apply coastal PAH multiplier; PCBs biomagnify rather than ' +
      'passively accumulate. abs_dermal 0.14 = EPA RAGS Part E Exhibit 3-4 chemical-specific ' +
      'value for PCBs/Aroclor (not the 0.1 organic-halogenated default). trv_eco_mg_per_kg_bw_day ' +
      'nulled 2026-07-02: cited a "US EPA Eco-SSL mammalian wildlife TRV (PCBs)" but no EPA Eco-SSL ' +
      'document exists for PCBs; value unverifiable. Duplicate-PCB-key consolidation with the ' +
      'separate polychlorinated_biphenyls_total_pcbs key (which already carries an approved NRWQC ' +
      'FCV row for the same value) is a deferred HITL item -- do not merge or delete either entry.',
  },
  {
    key: 'methylmercury',
    displayName: 'Methylmercury',
    contaminantClass: 'methyl-Hg',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1.0e-4,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: 15,
    abs_dermal: 0.001,
    ba_oral: 0.55,
    fcv_ug_per_L: null,
    // trv_eco_mg_per_kg_bw_day nulled 2026-07-02 (see notes below): the prior 0.000064 cited a CCME
    // MeHg wildlife TRV, but CCME's actual published values are 22 (mammal) / 31 (avian) ug/kg-bw/day
    // or a 33 ug/kg tissue guideline -- none equals 64; the value does not match the cited source.
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada HHRA 2023; Indigenous-Consumption-Pacific-NW ' +
      'Section 5; BSAF-Translation Section 7',
    notes:
      'MeHg binds covalently to protein thiols. Use protein-normalized ' +
      'BSAF path (f_protein default 0.18 fish muscle). Do not ' +
      'lipid-normalize. EqP path is invalid for MeHg. trv_eco_mg_per_kg_bw_day nulled 2026-07-02: ' +
      'cited a CCME MeHg wildlife TRV, but CCME\'s actual values are 22 (mammal) / 31 (avian) ' +
      'ug/kg-bw/day or a 33 ug/kg tissue guideline -- none equals the prior 0.000064 mg/kg-bw/day ' +
      '(64 ug/kg-bw/day); value does not match the source.',
  },
  {
    key: 'lead',
    displayName: 'Lead',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 5.0e-4,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 0.50,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada TRV v4.0 (2025) provisional risk-specific dose 5.0e-4 mg/kg-bw/day (IEUBK/blood-lead-based, NOT a classic NOAEL/UF RfD), src-health-canada-trv-v4-2025 (pv-hc-lead-hh-direct-risk-dose); ANZG; Bioavailability TOC-AVS Section 5',
    notes: 'Use AVS/SEM path for ecological direct-contact derivation. note the RfD is HC\'s provisional risk-specific dose (corrected from a prior untraceable 0.0035); static eco TRV removed (stale Eco-SSL; dynamic catalog resolver supplies it).',
  },
  {
    key: 'copper',
    displayName: 'Copper',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.426,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 0.50,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Health Canada TRV v4.0 (2025) oral TDI 0.426 mg/kg-bw/day, src-health-canada-trv-v4-2025 (pv-hc-copper-hh-direct-rfd-tdi); ANZG',
    notes: 'Use AVS/SEM path for ecological direct-contact derivation. the oral RfD is the approved HC TDI (corrected from a prior unsupported 0.04 that cited a non-existent IRIS copper row); the static eco TRV was removed (stale legacy Eco-SSL value not in the catalog; the eco-food calc resolves the catalog value dynamically).',
  },
  {
    key: 'cadmium',
    displayName: 'Cadmium',
    contaminantClass: 'divalent-metal',
    logKow: null,
    // Dietary value (1.0e-3); drinking-water value (5.0e-4) available if HITL
    // overrides for water-pathway exposures.
    rfd_oral_mg_per_kg_bw_per_day: 1.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 0.50,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS Cd',
    notes:
      'Drinking-water RfD (5.0e-4) available for water-pathway scenarios; ' +
      'default here is the dietary value (1.0e-3). static eco TRV removed ' +
      '(stale Eco-SSL not in catalog; dynamic resolver supplies it).',
  },
  {
    key: 'zinc',
    displayName: 'Zinc',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3.0e-1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 0.50,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS Zn',
    notes: 'Use AVS/SEM path for ecological direct-contact derivation. static eco TRV removed (stale Eco-SSL not in catalog; dynamic resolver supplies it).',
  },
  {
    key: 'arsenic_inorganic',
    displayName: 'Arsenic (inorganic)',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 6.0e-5,
    sf_oral_per_mg_per_kg_bw_per_day: 32,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 0.60,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 6e-5 mg/kg-bw/day + oral slope factor 32 per ' +
      'mg/kg-bw/day (Inorganic Arsenic, IRIS Toxicological Review FINAL Jan 2025; ' +
      'src-us-epa-iris-rfd-table-live / src-us-epa-iris-chemical-details-live; ' +
      'pv-iris-arsenic-hh-direct-rfd / pv-iris-arsenic-hh-direct-sf). Supersedes ' +
      'the 1991/1998 IRIS values (RfD 3e-4, SF 1.5). BC Protocol 28 alternative ' +
      '(RfD 3e-4, SF 1.5) remains available as a needs_review option in the ' +
      'catalog. ANZG; ACFN-WQCIU.',
    notes:
      'AVS/SEM framework does NOT apply to arsenic (not a divalent ' +
      'transition metal in the Cd-Cu-Pb-Ni-Zn family). Use bulk-sediment ' +
      'path with bioaccessibility correction. static eco TRV removed ' +
      '(stale Eco-SSL not in catalog; dynamic resolver supplies it). ' +
      'RfD/SF updated to the IRIS 2025 inorganic-arsenic assessment (FINAL Jan ' +
      '2025): RfD 3e-4 -> 6e-5 (~5x tighter) and SF 1.5 -> 32 (~21x more potent), ' +
      'superseding the 1991/1998 IRIS values. abs_dermal (0.03, metalloid class) ' +
      'and ba_oral (0.60) are unchanged.',
  },
  {
    key: 'antimony',
    displayName: 'Antimony',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 6.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'BC Protocol 28 (Jan 2021) oral RfD 0.006 mg/kg-bw/day (CAS 7440-36-0)',
    notes:
      'Human-health pathways only (no eco TRV in catalog; Eco-Food is filtered ' +
      'out). RfD seeded build-first from the BC Protocol 28 needs_review row ' +
      '(pv-p28-antimony-hh-direct-rfd / -food-rfd, value 0.006). Dermal RAF is ' +
      'the metalloid (As-analogue) class default and ba_oral is the conservative ' +
      '1.0 (no relative-bioavailability reduction), pending substance-specific ' +
      'HITL review.',
  },
  {
    key: 'cobalt',
    displayName: 'Cobalt',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3.0e-4,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'BC Protocol 28 (Jan 2021) oral RfD 0.0003 mg/kg-bw/day (CAS 7440-48-4)',
    notes:
      'Human-health pathways only (no eco TRV in catalog; Eco-Food is filtered ' +
      'out). RfD seeded build-first from the BC Protocol 28 needs_review row ' +
      '(pv-p28-cobalt-hh-direct-rfd / -food-rfd, value 0.0003). Dermal RAF is ' +
      'the divalent-metal class default; ba_oral is the conservative 1.0, ' +
      'pending substance-specific HITL review.',
  },
  {
    key: 'manganese',
    displayName: 'Manganese',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1.4e-1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'BC Protocol 28 (Jan 2021) oral RfD 0.14 mg/kg-bw/day (CAS 7439-96-5)',
    notes:
      'Human-health pathways only (no eco TRV in catalog; Eco-Food is filtered ' +
      'out). RfD seeded build-first from the BC Protocol 28 needs_review row ' +
      '(pv-p28-manganese-hh-direct-rfd / -food-rfd, value 0.14); Health Canada ' +
      'TRV v4.0 and US EPA IRIS alternatives also exist in the catalog. Dermal ' +
      'RAF is the divalent-metal class default; ba_oral is the conservative 1.0, ' +
      'pending substance-specific HITL review.',
  },
  {
    key: 'silver',
    displayName: 'Silver',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 5.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'BC Protocol 28 (Jan 2021) oral RfD 0.005 mg/kg-bw/day (CAS 7440-22-4)',
    notes:
      'Human-health pathways only (no eco TRV in catalog; Eco-Food is filtered ' +
      'out). RfD seeded build-first from the BC Protocol 28 needs_review row ' +
      '(pv-p28-silver-hh-direct-rfd / -food-rfd, value 0.005). NOTE silver is ' +
      'monovalent (Ag+); contaminantClass divalent-metal is the catalog bucket ' +
      'for non-metalloid metals (descriptive only, does not affect the RfD ' +
      'calc). Dermal RAF is the metal class default; ba_oral is the conservative ' +
      '1.0, pending substance-specific HITL review.',
  },
  {
    key: 'tin',
    displayName: 'Tin',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 6.0e-1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'BC Protocol 28 (Jan 2021) oral RfD 0.6 mg/kg-bw/day (CAS 7440-31-5)',
    notes:
      'Human-health pathways only (no eco TRV in catalog; Eco-Food is filtered ' +
      'out). RfD seeded build-first from the BC Protocol 28 needs_review row ' +
      '(pv-p28-tin-hh-direct-rfd / -food-rfd, value 0.6). Tin is a ' +
      'post-transition metal (Sn2+/Sn4+); contaminantClass divalent-metal is ' +
      'the catalog non-metalloid-metal bucket (descriptive only). Dermal RAF is ' +
      'the metal class default; ba_oral is the conservative 1.0, pending ' +
      'substance-specific HITL review.',
  },
  {
    key: 'barium',
    displayName: 'Barium',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS RfD table; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health TRV candidates are available in References & Values. ' +
      'Calculator defaults remain unset until owner-approved selection rules land. ' +
      'abs_dermal 0.001 = divalent-metal class default (no chemical-specific ' +
      'soil ABSd). Corrected from 0.1. Dormant.',
  },
  {
    key: 'benzene',
    displayName: 'Benzene',
    contaminantClass: 'organic',
    logKow: 2.13,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: 0.083,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + Health Canada TRV v4.0 oral SF 0.083 per mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025); Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Oral RfD/SF wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). ' +
      'Human-health RfC and inhalation unit risk ' +
      'candidates are available in References & Values.',
  },
  {
    key: 'beryllium',
    displayName: 'Beryllium',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value; BOTH src-us-epa-iris-rfd-table-live and src-health-canada-trv-v4-2025 approve the identical value -- concordant IRIS/HC, so the displayed default follows the active regulatory frame per BC Protocol 1 v5.0 s4.4: Health Canada under BC/Canada/default frames, US EPA IRIS under US frames); Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Oral RfD wired build-first from the approved catalog row(s) (qa_status=approved); previously null (dormant per the 2026-07-02 Cluster E abs_dermal correction). Value is concordant across US EPA IRIS and Health Canada (both approve 0.002); the displayed default follows the active regulatory frame per BC Protocol 1 v5.0 s4.4 (Health Canada under BC/Canada/default frames, US EPA IRIS under US frames). No oral slope factor candidate exists in the catalog (sf_oral remains null); inhalation RfC and inhalation unit risk candidates are available in References & Values but are out of scope for this wiring pass. abs_dermal 0.001 = divalent-metal class default (no chemical-specific soil ABSd), corrected from 0.1 -- unchanged by this wiring.',
  },
  {
    key: 'chromium_trivalent',
    displayName: 'Chromium, trivalent',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS RfD table; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health TRV candidates are available in References & Values. ' +
      'Speciation matters; do not merge with hexavalent chromium. ' +
      'abs_dermal 0.001 = divalent-metal class default (RAGS gives no ' +
      'Cr-specific soil ABSd; Cr(III) skin penetration ~1-4%). Corrected ' +
      'from 0.1. Dormant.',
  },
  {
    key: 'chromium_hexavalent',
    displayName: 'Chromium, hexavalent',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0022,
    sf_oral_per_mg_per_kg_bw_per_day: 0.27,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada TRV v4.0 oral RfD 0.0022 mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025; the US EPA IRIS oral RfD candidate is a RANGE, 0.0007 to 0.07 mg/kg-bw/day, and is excluded as non-single-value) + US EPA IRIS oral SF 0.27 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live); Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Oral RfD/SF wired build-first from the approved catalog row(s) (qa_status=approved); ' +
      'previously null (dormant per the 2026-07-02 Cluster E abs_dermal correction). RfD is ' +
      'sourced from HC TRV v4.0 (single value); the US EPA IRIS oral RfD candidate is a ' +
      'RANGE (0.0007-0.07 mg/kg-bw/day) and is excluded per the recon (non-single-value). SF ' +
      'is sourced from US EPA IRIS (sole candidate; HC does not carry an oral SF row for ' +
      'Cr(VI)). Human-health RfC and inhalation unit risk candidates are a US-vs-Canada ' +
      'jurisdiction_conflict and remain deferred to References & Values -- out of scope for ' +
      'this wiring pass. Speciation matters; do not merge with trivalent chromium. Cr(VI) ' +
      'dermal sensitization/potency is a hazard concern for endpoint/speciation policy, NOT ' +
      'the absorption-fraction field (codex 2026-07-02); do not encode it as an inflated ' +
      'ABSd. abs_dermal 0.001 = divalent-metal class default; unchanged by this wiring.',
  },
  {
    key: 'naphthalene',
    displayName: 'Naphthalene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.148,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, BOTH src-us-epa-iris-rfd-table-live and src-health-canada-trv-v4-2025 approve the identical value); Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Oral RfD wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). ' +
      'Human-health RfC candidate is available in References & Values. ' +
      'EqP/BSAF defaults are pending source-backed ecological values.',
  },
  {
    key: 'tetrachloroethylene',
    displayName: 'Tetrachloroethylene',
    contaminantClass: 'organic-halogenated',
    logKow: 3.4,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health RfD, RfC, oral slope factor, and inhalation unit risk ' +
      'candidates are available in References & Values.',
  },
  {
    key: 'trichloroethylene',
    displayName: 'Trichloroethylene',
    contaminantClass: 'organic-halogenated',
    logKow: 2.71,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health RfD, RfC, oral slope factor, and inhalation unit risk ' +
      'candidates are available in References & Values.',
  },
  {
    key: 'vinyl_chloride',
    displayName: 'Vinyl chloride',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health RfD, RfC, oral slope factor, and inhalation unit risk ' +
      'candidates are available in References & Values. ' +
      'abs_dermal 0.03 = VOC-consistent default (vinyl chloride is a gas, bp -13 C; ' +
      'EPA RAGS Part E gives no soil ABSd for VOCs and routes them via inhalation; ' +
      '0.03 = HC VOC RAFDerm / matches sibling VOCs TCE/PCE). Corrected from an ' +
      'unsupported 1.0 (data-entry defect). Dormant: no wired RfD/SF.',
  },
  {
    key: 'chlorobenzene',
    displayName: 'Chlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: 2.86,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS RfD table; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health oral RfD candidate is available in References & Values. ' +
      'Additional calculator defaults are pending owner-approved selection rules.',
  },
  // ---------------------------------------------------------------------------
  // Eco-registry pilot batch (2026-06-19). Added for ECO-pathway selectability
  // (eco values are seeded from the eco catalog; the library is the fallback).
  // logKow is the load-bearing field for eco-direct EqP organics; null for
  // metals/metalloids. HH fields (rfd/sf) are null -> HH pathways do not
  // compute until HITL supplies them; abs_dermal/ba_oral are RAGS Part E class
  // defaults (inert for these eco-only substances). Identity (CAS) + logKow
  // gathered + adversarially verified (workflow wf_3c7fd7aa-025, 2026-06-19).
  // ---------------------------------------------------------------------------
  {
    key: 'nickel',
    displayName: 'Nickel',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Nickel (total), CAS 7440-02-0, PubChem CID 935 (EC 231-111-4). ' +
      'Eco-food TRV seeded from the eco catalog (FCSAP ERA Module 7).',
    notes:
      'Eco-food selectability. logKow not applicable (inorganic metal; metal ' +
      'partitioning uses empirical BSAF, not Kow). Eco-Food BSAF is user-supplied ' +
      'or catalog-seeded; abs_dermal/ba_oral are inert HH defaults. ' +
      'abs_dermal 0.001 = divalent-metal class default (Ni dermal SENSITIZATION ' +
      'is a hazard, not an absorption fraction; RAGS gives no Ni soil ABSd). ' +
      'Corrected from 0.03. Dormant.',
  },
  {
    key: 'selenium',
    displayName: 'Selenium',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live; a BC Protocol 28 v3.0 candidate agrees in value (0.005) but is pending_source_locator/needs_review and is not cited as the wiring source). Identity: Selenium (total), CAS 7782-49-2, PubChem CID 6326970 (US EPA IRIS CASRN 7782-49-2). Eco-food TRV seeded from the eco catalog.',
    notes:
      'Oral RfD wired build-first from the approved catalog row (qa_status=approved); previously null. No oral slope factor candidate exists in the catalog. Eco-food selectability. logKow not applicable (metalloid; Se bioaccumulation driven by trophic transfer/BSAF). abs_dermal 0.03 = metalloid class default; unchanged by this wiring.',
  },
  {
    key: 'toluene',
    displayName: 'Toluene',
    contaminantClass: 'organic',
    logKow: 2.73,
    rfd_oral_mg_per_kg_bw_per_day: 0.0097,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada FCSAP TRV v4.0 (2021) oral TDI 0.0097 mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025; HC 2014b drinking-water tech doc, Seeber 2004/2005 occupational NOAEL, PBPK oral-equivalent, UF 10; live-verified 2026-07-04). Seeded as the BC Protocol 1 v5.0 s4.4 Health Canada default; the US EPA IRIS value 0.08 mg/kg-bw/day (NTP 1990) remains available as a candidate option. PubChem CID 1140. ' +
      'Identity: Toluene (methylbenzene), CAS 108-88-3, PubChem CID 1140. ' +
      'logKow 2.73 (Hansch/Leo/Hoekman 1995, via HSDB/PubChem; corroborated ' +
      'ATSDR, ECHA 2.73 at pH7/20C). Eco FCV/TRV seeded from the eco catalog.',
    notes:
      'Oral RfD wired build-first from the approved HC catalog row (qa_status=approved), HC-default per BC Protocol 1 v5.0 s4.4. ' +
      'Eco-direct + eco-food selectability. logKow 2.73 is load-bearing for ' +
      'eco-direct EqP. HH sf_oral null (rfd now wired); abs_dermal/ba_oral inert HH defaults.',
  },
  {
    key: 'ethylbenzene',
    displayName: 'Ethylbenzene',
    contaminantClass: 'organic',
    logKow: 3.15,
    rfd_oral_mg_per_kg_bw_per_day: 0.022,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada FCSAP TRV v4.0 (2021) oral TDI 0.022 mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025; HC 2014b, NTP 1999 chronic inhalation route-to-route PBPK, UF 25; live-verified 2026-07-04). Seeded as the BC Protocol 1 v5.0 s4.4 Health Canada default; the US EPA IRIS value 0.1 mg/kg-bw/day (Wolf 1956) remains available as a candidate option. PubChem CID 7500. ' +
      'Identity: Ethylbenzene, CAS 100-41-4, PubChem CID 7500. logKow 3.15 ' +
      '(Hansch/Leo/Hoekman 1995, p.43; ECHA experimental 3.15; HSDB/EPI Suite). ' +
      'Eco FCV/TRV seeded from the eco catalog.',
    notes:
      'Oral RfD wired build-first from the approved HC catalog row (qa_status=approved), HC-default per BC Protocol 1 v5.0 s4.4. ' +
      'Eco-direct + eco-food selectability. logKow 3.15 load-bearing for ' +
      'eco-direct EqP. HH sf_oral null (rfd now wired); abs_dermal/ba_oral inert HH defaults.',
  },
  {
    key: 'pyrene',
    displayName: 'Pyrene',
    contaminantClass: 'organic-PAH',
    logKow: 4.88,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, BOTH src-health-canada-trv-v4-2025 and src-us-epa-iris-rfd-table-live approve the identical value); Identity: Pyrene (4-ring parent PAH), CAS 129-00-0, PubChem CID 31423 ' +
      '(EPA CompTox DTXSID3024289). logKow 4.88 (Hansch/Leo/Hoekman 1995, p.137, ' +
      'via HSDB). Eco-food TRV is resolved dynamically from the eco catalog at runtime; trv_eco_mg_per_kg_bw_day static field is intentionally null.',
    notes:
      'Oral RfD wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). ' +
      'Eco-food selectability (logKow not seeded for its eco-food pathway; trv_eco_mg_per_kg_bw_day is resolved dynamically from the eco catalog at runtime, not held statically). ' +
      'CAVEAT: if eco-direct EqP is later activated for pyrene, prefer the EPA ' +
      'PAH ESB logKow (~5.18) for EqP consistency; 4.88 is the PubChem/HSDB ' +
      'experimental value. Oral RfD is wired (0.03); sf_oral_per_mg_per_kg_bw_per_day remains null (no catalog SF candidate). abs_dermal/ba_oral are the HH direct-contact defaults, active for the wired oral RfD pathway.',
  },
  {
    key: 'benz_a_anthracene',
    displayName: 'Benzo[a]anthracene',
    contaminantClass: 'organic-PAH',
    logKow: 5.76,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Benz[a]anthracene (= benzo[a]anthracene/tetraphene), CAS 56-55-3, ' +
      'PubChem CID 5954. logKow 5.76 (HSDB, Wang et al. 1986; ICSC 0385 lists 5.61). ' +
      'Eco-food TRV is resolved dynamically from the eco catalog at runtime; trv_eco_mg_per_kg_bw_day static field is intentionally null.',
    notes:
      'Eco-food selectability. logKow 5.76 is a single-study high-end value (range ' +
      '5.18-5.92); not seeded for eco-food. HH fields null; abs_dermal/ba_oral inert.',
  },
  {
    key: 'anthracene',
    displayName: 'Anthracene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) oral RfD 0.3 mg/kg-bw/day (also US EPA IRIS). ' +
      'Non-carcinogenic PAH.',
    notes:
      'Human-health pathways only, seeded build-first from the needs_review catalog ' +
      'row pv-p28-anthracene-hh-direct-rfd / -food-rfd (value 0.3). logKow not in ' +
      'catalog -> eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered out. ' +
      'abs_dermal/ba_oral are organic-PAH class defaults pending HITL.',
  },
  {
    key: 'fluoranthene',
    displayName: 'Fluoranthene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.04,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) oral RfD 0.04 mg/kg-bw/day (also US EPA IRIS). ' +
      'Non-carcinogenic PAH.',
    notes:
      'Human-health pathways only, seeded build-first from the needs_review catalog ' +
      'row pv-p28-fluoranthene-hh-direct-rfd / -food-rfd (value 0.04). logKow not in ' +
      'catalog -> eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered out. ' +
      'abs_dermal/ba_oral are organic-PAH class defaults pending HITL.',
  },
  {
    key: 'phenanthrene',
    displayName: 'Phenanthrene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.04,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) oral RfD 0.04 mg/kg-bw/day. Non-carcinogenic PAH ' +
      '(EPA IRIS lists no oral RfD; the BC P28 surrogate value is used).',
    notes:
      'Human-health pathways only, seeded build-first from the needs_review catalog ' +
      'row pv-p28-phenanthrene-hh-direct-rfd / -food-rfd (value 0.04). logKow not in ' +
      'catalog -> eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered out. ' +
      'abs_dermal/ba_oral are organic-PAH class defaults pending HITL.',
  },
  {
    key: 'acenaphthene',
    displayName: 'Acenaphthene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.06,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.06 mg/kg-bw/day. Non-carcinogenic PAH.',
    notes:
      'Human-health pathways only, seeded build-first from the needs_review catalog ' +
      'row pv-iris-acenaphthene-hh-direct-rfd / -food-rfd (value 0.06). logKow not in ' +
      'catalog -> eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered out. ' +
      'abs_dermal/ba_oral are organic-PAH class defaults pending HITL.',
  },
  {
    key: 'fluorene',
    displayName: 'Fluorene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.04,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.04 mg/kg-bw/day. Non-carcinogenic PAH.',
    notes:
      'Human-health pathways only, seeded build-first from the needs_review catalog ' +
      'row pv-iris-fluorene-hh-direct-rfd / -food-rfd (value 0.04). logKow not in ' +
      'catalog -> eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered out. ' +
      'abs_dermal/ba_oral are organic-PAH class defaults pending HITL.',
  },
  {
    key: 'dibenzo_a_h_anthracene',
    displayName: 'Dibenzo[a,h]anthracene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 7.3,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) oral slope factor 7.3 per mg/kg-bw/day. ' +
      'Carcinogenic PAH (uses a cancer slope factor, not an RfD).',
    notes:
      'Human-health pathways only, seeded build-first from the needs_review catalog ' +
      'row pv-p28-dibenzo_a_h_anthracene-hh-direct-sf / -food-sf (sf 7.3). ' +
      'Carcinogen: sf_oral set, rfd_oral null (cf. benzo_a_pyrene). logKow not in ' +
      'catalog -> eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered out. ' +
      'abs_dermal/ba_oral are organic-PAH class defaults pending HITL.',
  },
  {
    key: 'dieldrin',
    displayName: 'Dieldrin',
    contaminantClass: 'organic-halogenated',
    logKow: 5.37,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Dieldrin (single organochlorine cyclodiene, epoxide of aldrin), ' +
      'CAS 60-57-1, PubChem CID 969491. logKow 5.37 = EPA ESB EqP anchor ' +
      '(Karickhoff & Long 1995; EPA-600-R-02-010 Table 2-1); experimental ' +
      'measured 5.40 (de Bruijn et al. 1989) is within 0.03. Eco FCV from catalog.',
    notes:
      'Eco-direct selectability. logKow 5.37 chosen as the EPA-ESB EqP anchor for ' +
      'sediment-benchmark consistency (vs 5.40 PubChem/HSDB; negligible delta). ' +
      'HH fields null; abs_dermal/ba_oral inert HH defaults.',
  },
  {
    key: 'p_p_dichlorodiphenyltrichloroethane_ddt',
    displayName: 'DDT (p,p-)',
    contaminantClass: 'organic-halogenated',
    logKow: 6.91,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: 0.34,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.34 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live); Identity: p,p-DDT (4,4-DDT; the p,p isomer, CAS 50-29-3, PubChem CID 3036; ' +
      'US EPA IRIS CASRN 50-29-3) -- NOT o,p-DDT (789-02-6) nor technical mixture. ' +
      'logKow 6.91 (Hansch/Leo/Hoekman 1995, p.118; HMDB 6.91). Eco FCV is resolved dynamically from the eco catalog at runtime; fcv_ug_per_L static field is intentionally null.',
    notes:
      'Oral RfD/SF wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). ' +
      'Eco-direct selectability. Isomer-specific (p,p). logKow 6.91 load-bearing for eco-direct EqP; ' +
      'fcv_ug_per_L is resolved dynamically from the eco catalog at runtime, not held statically. ' +
      'Oral RfD (0.0005) and oral SF (0.34) are wired; abs_dermal/ba_oral are the HH direct-contact defaults, active for the wired oral RfD/SF pathways.',
  },
  {
    key: 'dibenzofuran',
    displayName: 'Dibenzofuran',
    contaminantClass: 'organic',
    logKow: 4.12,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Dibenzofuran (unsubstituted parent O-heterocyclic aromatic), ' +
      'CAS 132-64-9, PubChem CID 568 -- NOT a polychlorinated dibenzofuran (PCDF). ' +
      'logKow 4.12 (Hansch/Leo/Hoekman 1995, p.96, via HSDB). Eco FCV from catalog.',
    notes:
      'Eco-direct selectability. Parent dibenzofuran, distinct from dioxin-like PCDFs. ' +
      'logKow 4.12 load-bearing for eco-direct EqP. HH fields null; abs/ba inert.',
  },
  {
    key: 'chlordane_technical',
    displayName: 'Chlordane (technical)',
    contaminantClass: 'organic-halogenated',
    logKow: 5.54,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Chlordane (TECHNICAL MIXTURE), CAS 12789-03-6 (US EPA IRIS ' +
      'DTXSID5023954) -- the mixture CAS, NOT general 57-74-9 nor cis/trans ' +
      'congeners (5103-71-9 / 5103-74-2). logKow 5.54 (ATSDR 1994, via EPA IRIS ' +
      'Tox Review; alt ~6.16 disclosed). Eco FCV is resolved dynamically from the eco catalog at runtime; fcv_ug_per_L static field is intentionally null.',
    notes:
      'Eco-direct selectability. Technical-mixture identity. logKow 5.54 is the ' +
      'conservative regulatory value (ATSDR/IRIS; 6.16 alt exists). HH fields null; ' +
      'abs_dermal/ba_oral inert HH defaults.',
  },
  // ---------------------------------------------------------------------------
  // Eco-registry fan-out batch (2026-06-19). 36 substances added for ECO-pathway
  // selectability (eco values seeded from the eco catalog; library = fallback +
  // logKow). HH fields null; abs_dermal/ba_oral are RAGS Part E class defaults
  // (inert). Identity (CAS) + logKow adversarially verified (workflows
  // wf_edfb111e-20a + wf_fcf14287-4d3). Metals: logKow n/a. See per-entry notes.
  // ---------------------------------------------------------------------------
  {
    key: 'alpha_hexachlorocyclohexane_alpha_hch',
    displayName: 'alpha-Hexachlorocyclohexane (alpha-HCH)',
    contaminantClass: 'organic-halogenated',
    logKow: 3.8,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: alpha-Hexachlorocyclohexane (alpha-HCH), CAS 319-84-6. ATSDR Toxicological Profile for Hexachlorocyclohexane (HCH), Chapter 4, Table 4-1 (Chemical Identity) and Table 4-2 (Physical and Chemical Properties): log Kow = 3.8, footnote citing Hansch, C., Leo, A. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society; https://www.atsdr.cdc.gov/toxprofiles/tp43.pdf (PubChem CID 727 resolves to this CAS but carries no PUG-View LogP heading, so ATSDR is the correct primary source).',
    notes: 'Eco selectability. logKow 3.8 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'azinphos_methyl',
    displayName: 'Azinphos-methyl',
    contaminantClass: 'organic',
    logKow: 2.75,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Azinphos-methyl, CAS 86-50-0. PubChem Compound CID 2268, LogP heading via PUG-View REST API: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2268/JSON?heading=LogP -- log Kow = 2.75, sourced from Hansch, C., Leo, A., Hoekman, D. Exploring QSAR (1995), ACS, p. 72; corroborated by ILO-WHO ICSC #0826 (log Kow = 2.75).',
    notes: 'Eco selectability. logKow 2.75 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'biphenyl',
    displayName: 'Biphenyl',
    contaminantClass: 'organic',
    logKow: 4.01,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Biphenyl, CAS 92-52-4. PubChem CID 7095, LogP section citing Hansch C., Leo A., Hoekman D. (1995) Exploring QSAR, ACS, p.97 (via HSDB); log Kow = 4.01. IUPAC 1,1\'-biphenyl; value confirmed via PubChem PUG-View LogP heading: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/7095/JSON?heading=LogP.',
    notes: 'Eco selectability. logKow 4.01 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'bromoform',
    displayName: 'Bromoform',
    contaminantClass: 'organic-halogenated',
    logKow: 2.4,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Bromoform, CAS 75-25-2. PubChem CID 5558, LogP heading citing HSDB (Chemicals Inspection and Testing Institute, CSCL Japan 1992) log Kow = 2.40 and ILO-WHO ICSC 0108 = 2.38: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/5558/JSON?heading=LogP . Identity/CAS confirmed against PubChem CID 5558 (CAS RN 75-25-2).',
    notes: 'Eco selectability. logKow 2.4 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'bromophenyl_phenyl_ether_4',
    displayName: '4-Bromophenyl phenyl ether',
    contaminantClass: 'organic-halogenated',
    logKow: 4.4,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: 4-Bromophenyl phenyl ether, CAS 101-55-3. PubChem CID 7565 (1-bromo-4-phenoxybenzene): https://pubchem.ncbi.nlm.nih.gov/compound/7565 -- computed XLogP3 = 4.4, formula C12H9BrO. US EPA CompTox (DTXSID8023927, CASRN 101-55-3) corroborates identity; no experimental log Kow is reported in PubChem PUG-View, so log Kow = 4.4 is the PubChem-computed XLogP3 (Cheng et al., J. Chem. Inf. Model. 2007, 47(6), 2140-2148).',
    notes: 'Eco selectability. logKow 4.4 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'butyl_benzyl_phthalate_bbp',
    displayName: 'Butyl benzyl phthalate (BBP)',
    contaminantClass: 'organic',
    logKow: 4.73,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Butyl benzyl phthalate (BBP), CAS 85-68-7. PubChem CID 2347: https://pubchem.ncbi.nlm.nih.gov/compound/2347 -- formula C19H20O4. Log Kow = 4.73 from Ellington JJ, Floyd TL, Octanol/water partition coefficients for eight phthalate esters, EPA/600/S-96/006 (1996), USEPA National Exposure Research Laboratory, as cited in HSDB via PubChem PUG-View LogP heading: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2347/JSON?heading=LogP ; corroborated by ILO-WHO ICSC #0834 (log Kow = 4.77).',
    notes: 'Eco selectability. logKow 4.73 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'carbaryl',
    displayName: 'Carbaryl',
    contaminantClass: 'organic',
    logKow: 2.36,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Carbaryl, CAS 63-25-2. PubChem CID 6129, LogP heading via PUG-View (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/6129/JSON?heading=LogP), citing Hansch, Leo & Hoekman, Exploring QSAR, ACS 1995, p. 98 (log Kow = 2.36, peer reviewed, experimental); ILO-WHO ICSC 0121 reports 1.59 (not used).',
    notes: 'Eco selectability. logKow 2.36 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'carbon_tetrachloride',
    displayName: 'Carbon tetrachloride',
    contaminantClass: 'organic-halogenated',
    logKow: 2.64,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Carbon tetrachloride, CAS 56-23-5. PubChem CID 5943 (Carbon Tetrachloride) [corrects a CID error in the prior truncated text, which cited CID 5566 = Trifluoperazine], IUPAC tetrachloromethane, https://pubchem.ncbi.nlm.nih.gov/compound/Carbon-Tetrachloride. log Kow = 2.64 (EPA 1984): ATSDR Toxicological Profile for Carbon Tetrachloride (2005), Section 6.3.1, citing EPA Health Assessment Document for Carbon Tetrachloride, EPA600882001F (1984). Note: PubChem/HSDB experimental log Kow (Hansch/Leo/Hoekman 1995) is 2.83; the 2.64 used here matches ATSDR/EPA 1984 and ILO-WHO ICSC 0024.',
    notes: 'Eco selectability. logKow 2.64 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'chlorpyrifos',
    displayName: 'Chlorpyrifos',
    contaminantClass: 'organic-halogenated',
    logKow: 4.96,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Chlorpyrifos, CAS 2921-88-2. PubChem CID 2730, LogP heading via PUG-View (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2730/JSON?heading=LogP), citing HSDB / Sangster LOGKOW Database (log Kow = 4.96, peer reviewed); EPA CompTox DTXSID4020458; corroborated by ILO-WHO ICSC and HMDB (both 4.96).',
    notes: 'Eco selectability. logKow 4.96 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'demeton',
    displayName: 'Demeton (technical, O+S isomer mixture)',
    contaminantClass: 'organic',
    logKow: 3.21,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Demeton (technical, O+S isomer mixture), CAS 8065-48-3. PPDB: Pesticide Properties DataBase, AERU, University of Hertfordshire -- Demeton (Ref: ENT 17295): https://sitem.herts.ac.uk/aeru/ppdb/en/Reports/1537.htm (Log P 3.21 at pH 7, 20 C, quality V3 [unverified data of known source], calculated from ChemID/ChemSpider/PubChem; Pow 1.62 x 10^3 calculated at pH 7, 20 C).',
    notes: 'Eco selectability. logKow 3.21 (eco-direct EqP input). logKow 3.21 is single-source (AERU PPDB, quality V3 calculated); plausible but not independently corroborated -- upgrade when a stronger source is found. HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'diazinon',
    displayName: 'Diazinon',
    contaminantClass: 'organic',
    logKow: 3.81,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Diazinon, CAS 333-41-5. PubChem CID 3017, LogP heading: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/3017/JSON?heading=LogP -- log Kow = 3.81 (Hansch C., Leo A., Hoekman D., Exploring QSAR, ACS 1995, p.106; peer reviewed, HSDB, experimental); HMDB0032943 = 3.81; ILO-WHO ICSC 0137 reports 3.11 (not used).',
    notes: 'Eco selectability. logKow 3.81 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'dibutyl_phthalate_dbp',
    displayName: 'Dibutyl phthalate (DBP)',
    contaminantClass: 'organic',
    logKow: 4.5,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Dibutyl phthalate (DBP), CAS 84-74-2. PubChem CID 3026 (https://pubchem.ncbi.nlm.nih.gov/compound/3026), CAS 84-74-2. Log Kow = 4.50 from PubChem LogP heading citing HSDB: Ellington JJ, Floyd TL, Octanol/water partition coefficients for eight phthalate esters, EPA/600/S-96/006 (1996), USEPA National Exposure Research Lab (peer reviewed, experimental); HMDB = 4.50; ILO-WHO ICSC reports 4.72 (not used).',
    notes: 'Eco selectability. logKow 4.5 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'dichlorobenzene_1_2',
    displayName: '1,2-Dichlorobenzene (o-dichlorobenzene)',
    contaminantClass: 'organic-halogenated',
    logKow: 3.43,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: 1,2-Dichlorobenzene (o-dichlorobenzene), CAS 95-50-1. PubChem CID 7239 (https://pubchem.ncbi.nlm.nih.gov/compound/7239; CAS confirmed via PubChem CAS heading, https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/7239/JSON?heading=CAS). Experimental LogP heading (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/7239/JSON?heading=LogP), citing Hansch, C., Leo, A., Hoekman, D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society (log Kow = 3.43, experimental, peer-reviewed). Secondary, non-conflicting value 3.38 per ILO-WHO International Chemical Safety Cards (ICSC); not used (Hansch/ACS value retained as primary).',
    notes: 'Eco selectability. logKow 3.43 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'dichlorobenzene_1_3',
    displayName: '1,3-Dichlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: 3.53,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: 1,3-Dichlorobenzene, CAS 541-73-1. CAS and identity: Wikipedia, 1,3-Dichlorobenzene (https://en.wikipedia.org/wiki/1,3-Dichlorobenzene); PubChem CID 10943 (https://pubchem.ncbi.nlm.nih.gov/compound/10943; CAS confirmed via PubChem CAS heading, https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/10943/JSON?heading=CAS). LogP: PubChem PUG-View LogP heading for CID 10943 (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/10943/JSON?heading=LogP), citing Hansch, C., Leo, A., Hoekman, D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society (log Kow = 3.53, experimental). Concordant value 3.53 also per ILO-WHO International Chemical Safety Cards (ICSC).',
    notes: 'Eco selectability. logKow 3.53 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'dichlorobenzene_1_4',
    displayName: '1,4-Dichlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: 3.44,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: 1,4-Dichlorobenzene, CAS 106-46-7. PubChem CID 4685 (1,4-Dichlorobenzene), Compound Summary and LogP record, https://pubchem.ncbi.nlm.nih.gov/compound/4685 (CAS confirmed via PubChem CAS heading, https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/4685/JSON?heading=CAS). PubChem PUG-View LogP heading, https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/4685/JSON?heading=LogP, citing Hansch, C., Leo, A., Hoekman, D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society, via Hazardous Substances Data Bank (HSDB) (log Kow = 3.44, experimental). Concordant value 3.44 also per Human Metabolome Database (HMDB); secondary, lower value 3.37 per ILO-WHO ICSC, not used (Hansch/HSDB value retained as primary).',
    notes: 'Eco selectability. logKow 3.44 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'diethyl_phthalate_dep',
    displayName: 'Diethyl phthalate (DEP)',
    contaminantClass: 'organic',
    logKow: 2.47,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Diethyl phthalate (DEP), CAS 84-66-2. PubChem CID 6781, https://pubchem.ncbi.nlm.nih.gov/compound/6781 (CAS confirmed via PubChem CAS heading, https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/6781/JSON?heading=CAS; IUPAC name diethyl benzene-1,2-dicarboxylate). LogP heading (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/6781/JSON?heading=LogP), citing Hansch, C., Leo, A., Hoekman, D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society, p. 101, via Hazardous Substances Data Bank (HSDB) (log Kow = 2.47, experimental, peer-reviewed). Concordant value 2.47 also per ILO-WHO International Chemical Safety Cards (ICSC).',
    notes: 'Eco selectability. logKow 2.47 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'endosulfan',
    displayName: 'Endosulfan (technical, mixed isomers)',
    contaminantClass: 'organic-halogenated',
    logKow: 3.83,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Endosulfan (technical, mixed isomers), CAS 115-29-7. PubChem CID 3224 (Endosulfan), https://pubchem.ncbi.nlm.nih.gov/compound/3224 (CAS confirmed via PubChem CAS heading, https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/3224/JSON?heading=CAS). Experimental Properties - LogP heading (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/3224/JSON?heading=LogP), citing Hazardous Substances Data Bank (HSDB) and Hansch, C., Leo, A., Hoekman, D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society: this heading reports log Kow = 3.83 (alpha-isomer) and log Kow = 3.62 (beta-isomer) -- i.e. PubChem\'s own technical/mixed-isomer CID 3224 record carries isomer-specific values, not one single technical-mixture number. The library\'s 3.83 for this "technical, mixed isomers" row is therefore the alpha-isomer literature value, not a distinct technical-blend measurement; this is consistent with (and explains) the existing notes-field flag "logKow flagged disputed across sources; value is defensible/representative." Secondary, concordant value 3.55/3.62 per ILO-WHO International Chemical Safety Cards (ICSC) for Endosulfan (Mixed Isomers).',
    notes: 'Eco selectability. logKow 3.83 (eco-direct EqP input). logKow flagged disputed across sources; value is defensible/representative. HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'endosulfan_alpha',
    displayName: 'alpha-Endosulfan',
    contaminantClass: 'organic-halogenated',
    logKow: 4.74,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: alpha-Endosulfan, CAS 959-98-8. CAS and identity confirmed via PubChem CID 12309460 (alpha-Endosulfan, C9H6Cl6O3S; https://pubchem.ncbi.nlm.nih.gov/compound/alpha-Endosulfan; CAS heading https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/12309460/JSON?heading=CAS) and NIST Chemistry WebBook (ID C959988; https://webbook.nist.gov/cgi/cbook.cgi?ID=C959988) -- NEITHER of these two records carries an experimental LogP/log Kow heading for this CAS/CID (PubChem CID 12309460 LogP heading query returns no data; NIST WebBook lists only mass spectrum, IR, phase-change, and GC data, no Kow). The verified log Kow = 4.74 value traces to Shen, L., Wania, F. (2005) "Compilation, Evaluation, and Selection of Physical-Chemical Property Data for Organochlorine Pesticides," Journal of Chemical & Engineering Data, 50(3), 742-768, DOI 10.1021/je049693f (internally-thermodynamically-consistency-adjusted literature review; reports log Kow = 4.74 for alpha-endosulfan and 4.78 for beta-endosulfan). Independently corroborated by the University of Hertfordshire PPDB (Pesticide Properties DataBase) record for alpha-endosulfan (log P = 4.74; https://sitem.herts.ac.uk/aeru/ppdb/en/Reports/1661.htm), sourced there from manufacturer safety data sheets (PPDB reliability code E3: unverified data of known source). LGC Standards and Sigma-Aldrich analytical-standard product pages corroborate identity/CAS only, not the logKow value itself.',
    notes: 'Eco selectability. logKow 4.74 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'endosulfan_beta',
    displayName: 'beta-Endosulfan',
    contaminantClass: 'organic-halogenated',
    logKow: 3.62,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: beta-Endosulfan, CAS 33213-65-9. ATSDR (2015), Toxicological Profile for Endosulfan (NCBI Bookshelf NBK592006), Chapter 4 Chemical and Physical Information, Table 4-3 (Chemical Identity of beta-Endosulfan, CAS 33213-65-9, C9H6Cl6O3S) and Table 4-7 (Physical and Chemical Properties of beta-Endosulfan: Log Kow = 3.62, citing HSDB 2010). Identity corroborated via NIST Chemistry WebBook (ID C33213659, beta-Endosulfan, CAS 33213-65-9; https://webbook.nist.gov/cgi/cbook.cgi?ID=C33213659). Note: PubChem CID 12309460 (returned by name/CAS lookup for "beta-Endosulfan" and "33213-65-9") is actually the alpha-Endosulfan primary record (CAS 959-98-8) with 33213-65-9 listed only as a cross-referenced synonym -- do not cite this CID as a distinct beta-Endosulfan identity source. Value verified: log Kow 3.62 (experimental, HSDB 2010) matches the wired logKow field.',
    notes: 'Eco selectability. logKow 3.62 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'heptachlor',
    displayName: 'Heptachlor',
    contaminantClass: 'organic-halogenated',
    logKow: 5.44,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Heptachlor, CAS 76-44-8. PubChem Compound Summary, Heptachlor, CID 3589 (https://pubchem.ncbi.nlm.nih.gov/compound/3589; confirmed C10H5Cl7, matches CAS 76-44-8) for IUPAC name and log Kow = 6.10 (experimental; HSDB, citing Simpson CD et al., Bull Environ Contam Toxicol 55:149-53, 1995, PMID 7663085). Secondary source: ILO-WHO International Chemical Safety Card ICSC 0743 (CAS 76-44-8; https://chemicalsafety.ilo.org/dyn/icsc/showcard.display?p_lang=en&p_card_id=0743), log Pow range 5.27-5.44. Wired logKow = 5.44 uses the ICSC upper-range/regulatory value (EqP-apt), not the PubChem/HSDB 6.10 value; see notes field.',
    notes: 'Eco selectability. logKow 5.44 (eco-direct EqP input). logKow 5.44 = ATSDR regulatory value (EqP-apt); PubChem/HSDB lists 6.10. HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'heptachlor_epoxide',
    displayName: 'Heptachlor epoxide',
    contaminantClass: 'organic-halogenated',
    logKow: 5.4,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Heptachlor epoxide, CAS 1024-57-3. ATSDR (2022), Toxicological Profile for Heptachlor and Heptachlor Epoxide, NCBI Bookshelf NBK598049 (Potential for Human Exposure, sec. 6.3.1 Environmental Fate): log Kow = 5.40, citing Mackay 1982. Identity/CAS confirmed via PubChem (CID 15559699, Heptachlor epoxide, C10H5Cl7O; https://pubchem.ncbi.nlm.nih.gov/compound/15559699), which independently lists log Kow = 5.40 citing HSDB (Garten CT Jr, Trabalka JR; Environ Sci Technol 17:590-5, 1983). Both primary citations converge on the same value; wired logKow = 5.4 matches.',
    notes: 'Eco selectability. logKow 5.4 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'hexachlorocyclohexane_gamma',
    displayName: 'Lindane (gamma-hexachlorocyclohexane)',
    contaminantClass: 'organic-halogenated',
    logKow: 3.5,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Lindane (gamma-hexachlorocyclohexane), CAS 58-89-9. CAS and identity: ATSDR/U.S. EPA ToxFAQs factsheet "Hexachlorocyclohexane, gamma" (CAS 58-89-9; lindane), https://archive.epa.gov/epawaste/hazard/wastemin/web/pdf/hexagama.pdf ; PubChem CID 727 "Lindane" (https://pubchem.ncbi.nlm.nih.gov/compound/727) corroborates CAS 58-89-9 but its own computed value is XLogP3 = 3.8, not the wired 3.5. Value source: PPDB (Pesticide Properties DataBase, AERU, University of Hertfordshire), Lindane report (https://sitem.herts.ac.uk/aeru/ppdb/en/Reports/370.htm): log P = 3.50, citing EU regulatory/evaluation data (EC/EFSA RAR, DAR and Conclusion dossiers; EMA Annex III PIC DGD) -- this is the value that matches the wired logKow field. Note: a newer 2024 ATSDR HCH Toxicological Profile (NCBI Bookshelf) reports gamma-HCH log Kow = 3.72, a different regulatory estimate not used here.',
    notes: 'Eco selectability. logKow 3.5 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'hexachloroethane',
    displayName: 'Hexachloroethane',
    contaminantClass: 'organic-halogenated',
    logKow: 4.14,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Hexachloroethane, CAS 67-72-1. PubChem CID 6214 (LogP heading, REST pug_view; https://pubchem.ncbi.nlm.nih.gov/compound/6214) citing Hansch, Leo & Hoekman, Exploring QSAR - Hydrophobic, Electronic, and Steric Constants (ACS 1995, p.3, ref #37) via HSDB: log Kow = 4.14. Confirmed compound identity: C2Cl6, IUPAC 1,1,1,2,2,2-hexachloroethane, matches CAS 67-72-1. Secondary value on the same PubChem record: LogP = 3.9 (ILO-WHO ICSC, ref #39) -- not used; 4.14 (HSDB/Hansch) matches the wired logKow field. ATSDR Toxicological Profile for Hexachloroethane provides CAS/identity corroboration for the regulatory-toxicology framing of this substance.',
    notes: 'Eco selectability. logKow 4.14 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'malathion',
    displayName: 'Malathion',
    contaminantClass: 'organic',
    logKow: 2.75,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live); Identity: Malathion, CAS 121-75-5. NPIC (National Pesticide Information Center, Oregon State University / US EPA), Malathion Technical Fact Sheet, http://npic.orst.edu/factsheets/archive/malatech.html (CAS 121-75-5; Octanol-Water Partition Coefficient log Kow: 2.75, range 2.36-2.89, refs 5-6). CAS corroborated by PubChem CID 4004 (https://pubchem.ncbi.nlm.nih.gov/compound/4004; C10H19O6PS2), which independently lists log Kow = 2.36 (Hansch, Leo, Hoekman 1995, via HSDB), 2 (HMDB), and 2.89 (ICSC) -- consistent with the NPIC range. Wired logKow = 2.75 matches the NPIC fact sheet\'s primary cited value.',
    notes: 'Oral RfD wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). Eco selectability. logKow 2.75 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'methoxychlor',
    displayName: 'Methoxychlor',
    contaminantClass: 'organic-halogenated',
    logKow: 5.08,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live); Identity: Methoxychlor, CAS 72-43-5. PubChem CID 4115 (Methoxychlor), LogP heading via PUG-View: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/4115/JSON?heading=LogP -- experimental log Kow = 5.08, cited to Hazardous Substances Data Bank (HSDB Ref No. 28), citing Hansch C., Leo A., Hoekman D., Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society (1995), p. 139; secondary value 4.68/5.08 per ILO-WHO International Chemical Safety Cards (ICSC, Ref No. 32). CAS 72-43-5 and identity confirmed at https://pubchem.ncbi.nlm.nih.gov/compound/4115 (PubChem CID 4115 = Methoxychlor, C16H15Cl3O2).',
    notes: 'Oral RfD wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). Eco selectability. logKow 5.08 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'mirex',
    displayName: 'Mirex',
    contaminantClass: 'organic-halogenated',
    logKow: 5.28,
    rfd_oral_mg_per_kg_bw_per_day: 0.0002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live); Identity: Mirex, CAS 2385-85-5. WIRED logKow = 5.28: ATSDR Toxicological Profile for Mirex and Chlordecone (2020), Table 4-2 Physical and Chemical Properties, log Kow = 5.28, footnote citing Niimi 1991 (https://www.ncbi.nlm.nih.gov/books/NBK590723/table/ch4.tab2/). ALTERNATE candidate logKow = 6.89: PubChem CID 16945 (Mirex), LogP heading via PUG-View REST (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/16945/JSON?heading=LogP), sourced from Hazardous Substances Data Bank (HSDB), citing Veith GD et al., J. Fish. Res. Bd. Can. 36(9):1040-1048 (1979). The two values diverge by ~2.6 log units (~40x in linear Kow); flagged for review; wired value uses the lower ATSDR/Niimi 1991 figure. CAS 2385-85-5 and identity (C10Cl12) confirmed via https://pubchem.ncbi.nlm.nih.gov/compound/Mirex (PubChem CID 16945).',
    notes: 'Oral RfD wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). Eco selectability. logKow 5.28 (eco-direct EqP input). logKow 5.28 = ATSDR (Niimi 1991); PubChem/HSDB lists 6.89 (Veith 1979) -- large spread (~40x), flagged for review. HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'nonylphenol',
    displayName: 'Nonylphenol',
    contaminantClass: 'organic',
    logKow: 5.71,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Nonylphenol, CAS 84852-15-3. PubChem CID 67296 (Nonylphenol, C15H24O), LogP heading via PUG-View: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/67296/JSON?heading=LogP -- log Kow = 5.71 (average of 3 isomers), sourced from Hazardous Substances Data Bank (HSDB) citing Hansch, C., Leo, A., Hoekman, D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society, p. 137. Value flagged disputed: technical nonylphenol (CAS 84852-15-3) is a mixture of ring/chain isomers; 5.71 is a representative isomer-average, not a single-compound measurement. CAS and identity confirmed via https://pubchem.ncbi.nlm.nih.gov/compound/Nonylphenol (PubChem CID 67296).',
    notes: 'Eco selectability. logKow 5.71 (eco-direct EqP input). logKow flagged disputed (technical nonylphenol is an isomer mixture); value is representative. HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'parathion',
    displayName: 'Parathion',
    contaminantClass: 'organic',
    logKow: 3.83,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Parathion, CAS 56-38-2. PubChem CID 991 (Parathion, C10H14NO5PS), LogP heading via PUG-View REST: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/991/JSON?heading=LogP -- log Kow = 3.83, sourced from Hazardous Substances Data Bank (HSDB) citing Hansch C, Leo A, Hoekman D, Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, ACS (1995), p. 76; corroborated by Human Metabolome Database (HMDB, LogP = 3.83) and ILO-WHO International Chemical Safety Cards (ICSC, LogP = 3.8). CAS 56-38-2 and identity confirmed via https://pubchem.ncbi.nlm.nih.gov/compound/Parathion (PubChem CID 991).',
    notes: 'Eco selectability. logKow 3.83 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'pentachlorobenzene_1_2_3_4_5',
    displayName: 'Pentachlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: 5.18,
    rfd_oral_mg_per_kg_bw_per_day: 0.0008,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0008 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live); Identity: Pentachlorobenzene, CAS 608-93-5. CAS and identity: PubChem Compound CID 11855 (Pentachlorobenzene, C6HCl5), CAS 608-93-5, https://pubchem.ncbi.nlm.nih.gov/compound/608-93-5. log Kow = 5.18: PubChem PUG-View LogP heading for CID 11855 (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/11855/JSON?heading=LogP), sourced from Hazardous Substances Data Bank (HSDB), citing Hansch C., Leo A., Hoekman D., Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, ACS (1995), p. 16; secondary range 5.03/5.63 per ILO-WHO International Chemical Safety Cards (ICSC).',
    notes: 'Oral RfD wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). Eco selectability. logKow 5.18 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'tetrachloroethane_1_1_2_2',
    displayName: '1,1,2,2-Tetrachloroethane',
    contaminantClass: 'organic-halogenated',
    logKow: 2.39,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: 0.2,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.2 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live); Identity: 1,1,2,2-Tetrachloroethane, CAS 79-34-5. PubChem Compound CID 6591 (1,1,2,2-tetrachloroethane), LogP heading via PUG-View: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/6591/JSON?heading=LogP -- experimental log Kow = 2.39, sourced from Hazardous Substances Data Bank (HSDB), citing Hansch, Leo & Hoekman (1995), Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, ACS, p. 4; corroborated by ILO-WHO International Chemical Safety Cards (ICSC, value 2.39). Identity (CAS 79-34-5, molecular formula C2H2Cl4) verified via https://pubchem.ncbi.nlm.nih.gov/compound/6591 (PubChem CID 6591).',
    notes: 'Oral RfD/SF wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). Eco selectability. logKow 2.39 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'thallium',
    displayName: 'Thallium',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Thallium, CAS 7440-28-0. Identity and CAS: American Elements, "Thallium Metal | High Purity 99%-99.9999% | CAS 7440-28-0" (https://www.americanelements.com/thallium-metal-7440-28-0), confirming elemental thallium Tl, atomic number 81, atomic weight 204.38, CAS 7440-28-0. PubChem CID 5359464 (Thallium, Tl), https://pubchem.ncbi.nlm.nih.gov/compound/5359464 (element record title \'Thallium | Tl\'), corroborating CAS 7440-28-0. No logKow applicable (elemental metal); no US EPA IRIS oral RfD or slope factor is posted for thallium metal -- HH fields left null accordingly.',
    notes: 'Eco selectability. logKow n/a (metal). Classed metalloid (not divalent-metal): Tl is not a true M2+; avoids the divalent-metals AVS/SEM path. HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'toxaphene',
    displayName: 'Toxaphene',
    contaminantClass: 'organic-halogenated',
    logKow: 5.9,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Toxaphene, CAS 8001-35-2. PubChem CID 5284469 (Toxaphene), LogP heading via PUG-View REST (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/5284469/JSON?heading=LogP), citing Hazardous Substances Data Bank (HSDB) and Fisk AT et al., Chemosphere 39:2549-2562 (1999), median log Kow = 5.90.',
    notes: 'Eco selectability. logKow 5.9 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'trichlorobenzene_1_2_4',
    displayName: '1,2,4-Trichlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: 4.02,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live); Identity: 1,2,4-Trichlorobenzene, CAS 120-82-1. PubChem CID 13 (1,2,4-Trichlorobenzene, CAS 120-82-1), LogP heading via PUG-View REST API (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/13/JSON?heading=LogP), citing HSDB / Hansch, Leo & Hoekman, Exploring QSAR (ACS, 1995), p. 16, log Kow = 4.02 (a secondary ILO-WHO ICSC value of 3.98 is also on record for the same compound).',
    notes: 'Oral RfD wired build-first from the approved catalog row(s) (qa_status=approved); previously null (coverage gap surfaced by the 2026-07 QA audit). Eco selectability. logKow 4.02 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'trichloroethane_1_1_1',
    displayName: '1,1,1-Trichloroethane',
    contaminantClass: 'organic-halogenated',
    logKow: 2.49,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: 1,1,1-Trichloroethane, CAS 71-55-6. PubChem CID 6278 (1,1,1-Trichloroethane), pug_view CAS and LogP headings, https://pubchem.ncbi.nlm.nih.gov/compound/6278 ; LogP source: Hansch C, Leo A, Hoekman D. Exploring QSAR - Hydrophobic, Electronic, and Steric Constants. Washington, DC: American Chemical Society, 1995, p. 4, log Kow = 2.49 (corroborated by Human Metabolome Database HMDB0041791 and ILO-WHO ICSC Card No. 0079).',
    notes: 'Eco selectability. logKow 2.49 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'uranium',
    displayName: 'Uranium',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0006,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada TRV v4.0 oral RfD 0.0006 mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025); a BC Protocol 28 v3.0 candidate exists at a different value (0.003 mg/kg-bw/day, pending_source_locator/needs_review) and is not cited as the wiring source -- no US EPA IRIS oral RfD candidate exists for uranium. Identity: Uranium, CAS 7440-61-1, PubChem CID 23989.',
    notes:
      'Oral RfD wired build-first from the approved catalog row (qa_status=approved); ' +
      'previously null. No oral slope factor candidate exists in the catalog. Eco ' +
      'selectability. logKow n/a (metal). Classed metalloid (not divalent-metal): uranyl, ' +
      'not a true M2+; avoids the divalent-metals AVS/SEM path. abs_dermal 0.03 = ' +
      'metalloid class default; unchanged by this wiring.',
  },
  {
    key: 'vanadium',
    displayName: 'Vanadium',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Vanadium, CAS 7440-62-2. PubChem Compound CID 23990 (Vanadium, V), https://pubchem.ncbi.nlm.nih.gov/compound/23990 (record title \'Vanadium | V\'). CAS 7440-62-2 corroborated by Sigma-Aldrich product 262935 (Vanadium powder, -325 mesh, 99.5% trace metals basis, CAS 7440-62-2, https://www.sigmaaldrich.com/US/en/product/aldrich/262935) and product 774065 (Vanadium powder, -100 mesh, 99.9% trace metals basis, CAS 7440-62-2, https://www.sigmaaldrich.com/US/en/product/aldrich/774065). No logKow applicable (elemental metal); no oral RfD/SF wired -- HH fields left null accordingly.',
    notes: 'Eco selectability. logKow n/a (metal). Classed metalloid (not divalent-metal): vanadate, not a true M2+; avoids the divalent-metals AVS/SEM path. HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  // ---------------------------------------------------------------------------
  // Eco-registry reconciliation batch (PR B, 2026-06-19). The 4 owner-judgment
  // keys -- all NEW library entries (NOT reconciled onto existing keys). Identity
  // + logKow gathered then adversarially refuted; the 2 eco-direct organics carry
  // a verified load-bearing logKow. xylene_m is collapsed to `xylenes` in the eco
  // staging (intra-eco alias) so the eco-direct FCV joins this entry.
  // ---------------------------------------------------------------------------
  {
    key: 'xylenes',
    displayName: 'Xylenes',
    contaminantClass: 'organic',
    logKow: 2.75,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada FCSAP TRV v4.0 (2021) oral TDI 0.013 mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025; HC 2014b, Korsak 1994 subchronic inhalation PBPK oral-equivalent, UF 75, neurotoxicity; live-verified 2026-07-04). Seeded as the BC Protocol 1 v5.0 s4.4 Health Canada default; the US EPA IRIS value 0.2 mg/kg-bw/day (NTP 1986) remains available as a candidate option. PubChem CID 1330 (mixed-isomer representative). ' +
      'Identity: Xylenes. Eco-direct FCV basis = m-xylene (CAS 108-38-3, PubChem ' +
      'CID 7929); eco-food TRV = total xylenes group (CAS 1330-20-7). logKow 2.75 ' +
      'is the EPA ESB-internal value for m-xylene (EPA/600/R-02/016 Table 3-1), ' +
      'chosen for EqP consistency with the ESB SCV that seeds the eco-direct FCV ' +
      '(owner-attested 2026-06-19); the modern Hansch/PubChem m-xylene value is ' +
      '3.20. Eco FCV/TRV seeded from the eco catalog.',
    notes:
      'Oral RfD wired build-first from the approved HC catalog row (qa_status=approved), HC-default per BC Protocol 1 v5.0 s4.4. ' +
      'Eco-direct + eco-food selectability. logKow 2.75 is load-bearing for ' +
      'eco-direct EqP and is deliberately the EPA ESB-internal m-xylene Kow (not ' +
      'the Hansch 3.20) so the sediment screen reproduces the EPA ESB EqP ' +
      'derivation (the pyrene-note ESB-consistency principle). HH sf_oral null (rfd now wired); ' +
      'abs_dermal/ba_oral inert HH defaults (organic class).',
  },
  {
    key: 'polychlorinated_biphenyls_total_pcbs',
    displayName: 'Total PCBs',
    contaminantClass: 'organic-halogenated',
    logKow: 6.5,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Total PCBs (polychlorinated biphenyl mixture; EPA NRWQC ' +
      'total-PCBs criterion substance; the mixture has no single CAS). logKow 6.5 ' +
      '= Aroclor 1254 representative (ATSDR Tox Profile for PCBs, Table 4-3, ' +
      'citing Hansch and Leo 1985). Distinct from total_pcbs_aroclor_1254. ' +
      'Eco-direct FCV is resolved dynamically from the eco catalog at runtime (EPA NRWQC-sourced; currently resolves to 0.014 ug/L, but fcv_ug_per_L is intentionally null in this static row). Eco-direct only -- no eco-food ' +
      'TRV row exists in the eco catalog for this key.',
    notes:
      'Eco-direct-only selectability (no eco-food TRV seeded). logKow 6.5 ' +
      '(Aroclor 1254 basis) is load-bearing for EqP. CAVEAT: PCBs are a congener ' +
      'MIXTURE (congener logKow ~4.5-8.2) and the NRWQC FCV spans multiple ' +
      'Aroclors incl. lower-chlorinated/lower-Kow. Because the EqP sediment screen ' +
      'is sedS = FCV * Koc(logKow) * foc (Koc rises with logKow), pairing the FCV ' +
      'with the high 6.5 yields a HIGHER, LESS-stringent sediment benchmark than a ' +
      'lower-Kow representative would -- it is NOT over-protective; verify the site ' +
      'congener/Aroclor profile before relying on it. Do not merge with ' +
      'total_pcbs_aroclor_1254. HH fields null; abs_dermal/ba_oral inert ' +
      '(organic-halogenated class).',
  },
  {
    key: 'chromium',
    displayName: 'Chromium',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Chromium (generic/total, unspeciated), CAS 7440-47-3, PubChem ' +
      'CID 23976 (record title \'Chromium | Cr\'). logKow n/a (inorganic metal). ' +
      'Eco-food TRV seeded from the eco catalog (FCSAP ERA Module 7).',
    notes:
      'Eco-food selectability (generic total-Cr). logKow null: metal partitioning ' +
      'uses empirical BSAF/AVS-SEM, not Kow. contaminantClass divalent-metal is ' +
      'the library convention for chromium (matches chromium_trivalent/hexavalent; ' +
      'the enum has no plain-metal bucket and generic Cr is unspeciated -- Cr-VI ' +
      'is not truly divalent). Distinct from chromium_trivalent + ' +
      'chromium_hexavalent. HH fields null; abs_dermal/ba_oral inert. ' +
      'abs_dermal 0.001 = divalent-metal class default; unspeciated Cr should ' +
      'be speciated (or screened as Cr(VI)) rather than carry a Cr(VI)-motivated ' +
      'dermal fraction. Corrected from 0.1. Dormant.',
  },
  {
    key: 'mercury_inorganic',
    displayName: 'Mercury, inorganic',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada TRV v4.0 oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025; no US EPA IRIS oral RfD candidate exists for mercury_inorganic). Identity: Mercury, inorganic (divalent Hg(II)), CAS 7439-97-6, PubChem CID ' +
      '23931 (the elemental-mercury record matching CAS 7439-97-6, the ATSDR/EPA ' +
      'regulatory CASRN for inorganic mercury). logKow n/a (inorganic metal ion). ' +
      'Eco-food TRV seeded from the eco catalog (FCSAP ERA Module 7).',
    notes:
      'Oral RfD wired build-first from the approved catalog row (qa_status=approved); ' +
      'previously null (dormant per the 2026-07-02 Cluster E abs_dermal correction). No ' +
      'oral slope factor candidate exists in the catalog (sf_oral remains null). Eco-food ' +
      'selectability (inorganic Hg(II) only). logKow null: Kow not applicable to ionic ' +
      'metals. contaminantClass divalent-metal (Hg2+ is a divalent cation); distinct from ' +
      'the methyl-Hg class used by the methylmercury entry -- inorganic Hg and MeHg differ ' +
      'in trophic transfer. abs_dermal 0.001 = divalent-metal class default (no RAGS ' +
      'inorganic-Hg soil ABSd); unchanged by this wiring.',
  },
  {
    key: 'chloroform',
    displayName: 'Chloroform',
    contaminantClass: 'organic-halogenated',
    logKow: 1.97,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Chloroform (trichloromethane), CAS 67-66-3, PubChem CID 6212. ' +
      'logKow 1.97 (CCME factsheet "low Kow (1.97)"; corroborated PubChem/HSDB ' +
      'experimental 1.97). Eco-direct FCV is resolved dynamically from the eco ' +
      'catalog at runtime (CCME interim CWQG freshwater aquatic-life guideline, ' +
      '1992; NOT EPA NRWQC -- EPA has no chloroform aquatic-life CCC); ' +
      'fcv_ug_per_L static field is intentionally null.',
    notes:
      'Eco-direct selectability. logKow 1.97 is load-bearing for eco-direct EqP. ' +
      'Eco-direct FCV is resolved dynamically from the eco catalog at runtime ' +
      '(CCME interim CWQG basis: LOEC 18 ug/L spring-peeper teratogenesis x 0.1 ' +
      'safety factor; CCME 1992; currently resolves to 1.8 ug/L, but ' +
      'fcv_ug_per_L is intentionally null in this static row). Attribute to CCME ' +
      'only. HH fields null; abs_dermal/ba_oral inert HH defaults (organic-halogenated class).',
  },
  {
    key: 'aluminum',
    displayName: 'Aluminum',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1.0,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'BC Protocol 28 (Jan 2021) oral RfD 1.0 mg/kg-bw/day (CAS 7429-90-5).',
    notes:
      'Human-health pathways only; seeded build-first from the needs_review row ' +
      'pv-p28-aluminum-hh-direct-rfd / -food-rfd (value 1.0). Aluminum is trivalent ' +
      '(Al3+); contaminantClass divalent-metal is the catalog non-metalloid-metal ' +
      'bucket (descriptive only). No eco value in catalog -> eco pathways filtered. ' +
      'abs_dermal/ba_oral are metal class defaults pending HITL.',
  },
  {
    key: 'boron',
    displayName: 'Boron',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) + US EPA IRIS oral RfD 0.2 mg/kg-bw/day (CAS 7440-42-8).',
    notes:
      'Human-health pathways only; seeded build-first from the needs_review row ' +
      'pv-p28-boron-hh-direct-rfd / pv-iris-boron-... (value 0.2, agree). Boron is a ' +
      'metalloid. No eco value in catalog -> eco pathways filtered. abs_dermal/ba_oral ' +
      'are metalloid class defaults pending HITL.',
  },
  {
    key: 'molybdenum',
    displayName: 'Molybdenum',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (CAS 7439-98-7).',
    notes:
      'Human-health pathways only; seeded build-first from the (now qa_status=approved) row ' +
      'pv-iris-molybdenum-hh-direct-rfd / -food-rfd (value 0.005). Molybdenum is ' +
      'multivalent; contaminantClass divalent-metal is the catalog non-metalloid-metal ' +
      'bucket (descriptive). No eco value in catalog -> eco pathways filtered. ' +
      'abs_dermal/ba_oral are metal class defaults pending HITL.',
  },
  {
    key: 'strontium',
    displayName: 'Strontium',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.6,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.6 mg/kg-bw/day (CAS 7440-24-6).',
    notes:
      'Human-health pathways only; seeded build-first from the (now qa_status=approved) row ' +
      'pv-iris-strontium-hh-direct-rfd / -food-rfd (value 0.6). Strontium is divalent ' +
      '(Sr2+). No eco value in catalog -> eco pathways filtered. abs_dermal/ba_oral ' +
      'are metal class defaults pending HITL.',
  },
  {
    key: 'phenol',
    displayName: 'Phenol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) + US EPA IRIS oral RfD 0.3 mg/kg-bw/day (CAS 108-95-2).',
    notes:
      'Human-health pathways only; seeded build-first from the needs_review row ' +
      'pv-p28-phenol-hh-direct-rfd / pv-iris-phenol-... (value 0.3, agree). logKow not ' +
      'in catalog -> eco-direct EqP unavailable; no eco value -> Eco-Food filtered. ' +
      'abs_dermal 0.1 = organic-class SVOC default (EPA RAGS Part E); prior 0.03 was ' +
      'mislabeled as the class default (the true organic default is 0.1).',
  },
  {
    key: 'styrene',
    displayName: 'Styrene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) + US EPA IRIS oral RfD 0.2 mg/kg-bw/day (CAS 100-42-5).',
    notes:
      'Human-health pathways only; seeded build-first from the needs_review row ' +
      'pv-p28-styrene-hh-direct-rfd / pv-iris-styrene-... (value 0.2, agree; an ' +
      'inhalation RfC 1 mg/m3 also exists but is not a sediment-pathway input). logKow ' +
      'not in catalog -> eco pathways filtered. abs_dermal 0.03 = HC TRV v4.0 Table 5 VOC ' +
      'RAFDerm default (0.03, MECP 2011); styrene is a confirmed VOC (bp 145 C) -- EPA ' +
      'RAGS Part E has no ABS_d for VOCs (routes them via inhalation).',
  },
  {
    key: 'acetone',
    displayName: 'Acetone',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.9,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) + US EPA IRIS oral RfD 0.9 mg/kg-bw/day (CAS 67-64-1).',
    notes:
      'Human-health pathways only; seeded build-first from the needs_review row ' +
      'pv-p28-acetone-hh-direct-rfd / pv-iris-acetone-... (value 0.9, agree). logKow ' +
      'not in catalog -> eco pathways filtered. abs_dermal 0.03 = HC TRV v4.0 Table 5 VOC ' +
      'RAFDerm default (0.03, MECP 2011); acetone is a VOC (bp 56 C).',
  },
  {
    key: 'hexachlorobenzene',
    displayName: 'Hexachlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 8.0e-4,
    sf_oral_per_mg_per_kg_bw_per_day: 1.6,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 1.6 per mg/kg-bw/day (carcinogen) + non-cancer ' +
      'oral RfD 0.0008 mg/kg-bw/day (CAS 118-74-1). BC Protocol 28 lists SF 0.83.',
    notes:
      'Human-health pathways only; both endpoints seeded build-first so the calculator ' +
      'can select the more conservative of cancer (SF) vs non-cancer (RfD). SF from ' +
      'pv-iris-hexachlorobenzene-hh-direct-sf (1.6, the more conservative of the two ' +
      'catalog SFs; BC P28 = 0.83); RfD from pv-iris-hexachlorobenzene-hh-direct-rfd / ' +
      'pv-p28-hexachlorobenzene-hh-direct-rfd (0.0008, agree). The IRIS SF and IRIS RfD rows are now ' +
      'qa_status=approved; the co-cited BC P28 RfD duplicate (pv-p28-hexachlorobenzene-hh-direct-rfd, same value) remains needs_review. ' +
      'logKow/eco not in catalog -> eco filtered. ' +
      'abs_dermal/ba_oral are organic-halogenated class defaults pending HITL.',
  },
  {
    key: 'pentachlorophenol',
    displayName: 'Pentachlorophenol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 5.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: 0.4,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) + US EPA IRIS oral slope factor 0.4 per mg/kg-bw/day ' +
      '(carcinogen) + non-cancer oral RfD 0.005 mg/kg-bw/day (CAS 87-86-5).',
    notes:
      'Human-health pathways only; both endpoints seeded build-first so the calculator ' +
      'can select the more conservative of cancer (SF) vs non-cancer (RfD). SF from ' +
      'pv-iris-pentachlorophenol-hh-direct-sf (0.4, P28+IRIS agree); RfD from ' +
      'pv-iris-pentachlorophenol-hh-direct-rfd (0.005). Both rows are now qa_status=approved ' +
      'in the catalog (promoted 2026-06). logKow/eco not in catalog -> eco filtered. abs_dermal/ba_oral ' +
      'are organic-halogenated class defaults pending HITL.',
  },
  {
    key: '1_4_dioxane',
    displayName: '1,4-Dioxane',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3.0e-2,
    sf_oral_per_mg_per_kg_bw_per_day: 0.1,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 0.1 per mg/kg-bw/day (carcinogen; approved catalog value, src-us-epa-iris-chemical-details-live) + non-cancer oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) (CAS 123-91-1).',
    notes:
      'Human-health pathways only; both endpoints seeded build-first so the calculator ' +
      'can select the more conservative of cancer (SF) vs non-cancer (RfD). SF from ' +
      'pv-iris-1_4_dioxane-hh-direct-sf (0.1); RfD from pv-iris-1_4_dioxane-hh-direct-rfd ' +
      '(0.03). Both rows are now qa_status=approved in the catalog (promoted 2026-06). 1,4-dioxane is a cyclic ' +
      'ether (organic, not halogenated). logKow/eco not in catalog -> eco filtered. ' +
      'abs_dermal 0.03 = HC TRV v4.0 Table 5 VOC RAFDerm default (0.03, MECP 2011); ' +
      '1,4-dioxane is a VOC (bp 101 C).',
  },
  // ---------------------------------------------------------------------------
  // Catalog WIRE batch -- PFAS + HH-only sweep (2026-06-20). 13 substances added
  // for HH selectability (build-first; values seeded verbatim from the catalog
  // needs_review rows in human_health_trv_values.json). logKow/eco fields null ->
  // eco pathways filtered out (HH only). abs_dermal/ba_oral are RAGS Part E class
  // defaults (organic 0.03, organic-halogenated 0.1, organic-PAH 0.13); ba_oral
  // the conservative 1.0. PFOA/PFOS use the US EPA 2024 RfD (owner precedence over
  // Protocol 28); the remaining 11 are US EPA IRIS oral RfD/SF. Carcinogens
  // (aldrin, hexachlorobutadiene, acrylonitrile) carry sf_oral with rfd null;
  // aldrin + isophorone carry both endpoints so the calculator picks the more
  // conservative (derivations.pickHumanHealthEndpoint).
  // ---------------------------------------------------------------------------
  {
    key: 'perfluoroctanoic_acid_pfoa',
    displayName: 'Perfluorooctanoic acid (PFOA)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3.0e-8,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA 2024 final human health toxicity assessment for PFOA (EPA ' +
      '815-R-24-006, April 2024) overall chronic oral RfD 3 x 10-8 mg/kg-bw/day ' +
      '(CAS 335-67-1). Primary US federal source (precedence over BC Protocol 28 ' +
      '2.0e-5; owner-decided 2026-06-20).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-direct-rfd / -food-rfd (value ' +
      '3.0e-8). Reuses the existing (misspelled) catalog key perfluoroctanoic_acid_pfoa. ' +
      'PFOA is IARC Group 1; this RfD is the noncancer oral reference dose (EPA did ' +
      'not adopt an oral SF here). logKow/eco not in catalog -> eco filtered. ' +
      'abs_dermal/ba_oral are organic-halogenated class defaults pending HITL.',
  },
  {
    key: 'perfluorooctane_sulfonate',
    displayName: 'Perfluorooctane sulfonate (PFOS)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1.0e-7,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA 2024 final human health toxicity assessment for PFOS (EPA ' +
      '815-R-24-007, April 2024) overall chronic oral RfD 1 x 10-7 mg/kg-bw/day ' +
      '(CAS 1763-23-1). Primary US federal source (precedence over BC Protocol 28 ' +
      '3.0e-5; owner-decided 2026-06-20).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-us-epa-2024-perfluorooctane_sulfonate-hh-direct-rfd / -food-rfd (value ' +
      '1.0e-7). Reuses the existing catalog key perfluorooctane_sulfonate. PFOS is ' +
      'IARC Group 2B; this RfD is the noncancer oral reference dose. logKow/eco not ' +
      'in catalog -> eco filtered. abs_dermal/ba_oral are organic-halogenated class ' +
      'defaults pending HITL.',
  },
  {
    key: 'aldrin',
    displayName: 'Aldrin',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3.0e-5,
    sf_oral_per_mg_per_kg_bw_per_day: 17,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 1.7 x 10 1 (17) per mg/kg-bw/day (carcinogen) ' +
      '+ non-cancer oral RfD 3 x 10-5 mg/kg-bw/day (organochlorine; CAS 309-00-2).',
    notes:
      'Human-health pathways only; both endpoints seeded build-first so the calculator ' +
      'can select the more conservative of cancer (SF) vs non-cancer (RfD). SF from ' +
      'pv-iris-aldrin-hh-direct-sf / -food-sf (17); RfD from pv-iris-aldrin-hh-direct-rfd / ' +
      '-food-rfd (3.0e-5). Both rows (all four related IRIS direct/food rows) are now qa_status=approved. logKow not in catalog -> ' +
      'eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered. abs_dermal/ba_oral ' +
      'are organic-halogenated class defaults pending HITL.',
  },
  {
    key: 'endrin',
    displayName: 'Endrin',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3.0e-4,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 3 x 10-4 mg/kg-bw/day (organochlorine; CAS 72-20-8).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the (now qa_status=approved) row ' +
      'pv-iris-endrin-hh-direct-rfd / -food-rfd (value 3.0e-4). logKow not in catalog ' +
      '-> eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered. abs_dermal/ba_oral ' +
      'are organic-halogenated class defaults pending HITL.',
  },
  {
    key: 'hexachlorobutadiene',
    displayName: 'Hexachlorobutadiene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.078,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 7.8 x 10-2 (0.078) per mg/kg-bw/day ' +
      '(carcinogen; CAS 87-68-3).',
    notes:
      'Human-health pathways only; SF seeded build-first from the (now qa_status=approved) row ' +
      'pv-iris-hexachlorobutadiene-hh-direct-sf / -food-sf (value 0.078). Carcinogen: ' +
      'sf_oral set, rfd_oral null. logKow not in catalog -> eco-direct EqP unavailable; ' +
      'no eco TRV -> Eco-Food filtered. abs_dermal/ba_oral are organic-halogenated ' +
      'class defaults pending HITL.',
  },
  {
    key: 'hexachlorocyclopentadiene',
    displayName: 'Hexachlorocyclopentadiene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 6.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 6 x 10-3 mg/kg-bw/day (HCCPD; CAS 77-47-4).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the (now qa_status=approved) row ' +
      'pv-iris-hexachlorocyclopentadiene-hh-direct-rfd / -food-rfd (value 0.006). logKow ' +
      'not in catalog -> eco-direct EqP unavailable; no eco TRV -> Eco-Food filtered. ' +
      'abs_dermal/ba_oral are organic-halogenated class defaults pending HITL.',
  },
  {
    key: 'isophorone',
    displayName: 'Isophorone',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: 9.5e-4,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 9.5 x 10-4 (0.00095) per mg/kg-bw/day (carcinogen; approved catalog value, src-us-epa-iris-chemical-details-live) + non-cancer oral RfD 2 x 10-1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) (CAS 78-59-1).',
    notes:
      'Human-health pathways only; both endpoints seeded build-first so the calculator ' +
      'can select the more conservative of cancer (SF) vs non-cancer (RfD). SF from ' +
      'pv-iris-isophorone-hh-direct-sf / -food-sf (9.5e-4); RfD from ' +
      'pv-iris-isophorone-hh-direct-rfd / -food-rfd (0.2). Both rows are now qa_status=approved. ' +
      'logKow not in catalog -> eco pathways filtered. abs_dermal/ba_oral are organic ' +
      'class defaults pending HITL.',
  },
  {
    key: 'acrylonitrile',
    displayName: 'Acrylonitrile',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.54,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 5.4 x 10-1 (0.54) per mg/kg-bw/day ' +
      '(carcinogen; CAS 107-13-1).',
    notes:
      'Human-health pathways only; SF seeded build-first from the needs_review row ' +
      'pv-iris-acrylonitrile-hh-direct-sf / -food-sf (value 0.54). Carcinogen: sf_oral ' +
      'set, rfd_oral null. logKow not in catalog -> eco pathways filtered. ' +
      'abs_dermal 0.03 = HC TRV v4.0 Table 5 VOC RAFDerm default (0.03, MECP 2011); ' +
      'acrylonitrile is a VOC (bp 77 C).',
  },
  {
    key: 'carbon_disulfide',
    displayName: 'Carbon disulfide',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 1 x 10-1 mg/kg-bw/day (CAS 75-15-0).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-iris-carbon_disulfide-hh-direct-rfd / -food-rfd (value 0.1; an inhalation RfC ' +
      'also exists but is not a sediment-pathway input). logKow not in catalog -> eco ' +
      'pathways filtered. abs_dermal 0.03 = HC TRV v4.0 Table 5 VOC RAFDerm default ' +
      '(0.03, MECP 2011); carbon disulfide is a VOC (bp 46 C).',
  },
  {
    key: 'bisphenol_a',
    displayName: 'Bisphenol A',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 5 x 10-2 mg/kg-bw/day (CAS 80-05-7).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-iris-bisphenol_a-hh-direct-rfd / -food-rfd (value 0.05). logKow not in catalog ' +
      '-> eco pathways filtered. abs_dermal 0.1 = organic-class SVOC default (EPA RAGS ' +
      'Part E); BPA is a non-volatile solid (mp ~158 C), not a VOC; prior 0.03 was mislabeled.',
  },
  {
    key: 'nitrobenzene',
    displayName: 'Nitrobenzene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 2.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 2 x 10-3 mg/kg-bw/day (CAS 98-95-3).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-iris-nitrobenzene-hh-direct-rfd / -food-rfd (value 0.002; an inhalation RfC + ' +
      'IUR also exist but are not sediment-pathway inputs). logKow not in catalog -> eco ' +
      'pathways filtered. abs_dermal 0.1 = organic-class SVOC default (EPA RAGS Part E); ' +
      'semivolatile, not a VOC; prior 0.03 was mislabeled.',
  },
  {
    key: 'pyridine',
    displayName: 'Pyridine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 1 x 10-3 mg/kg-bw/day (CAS 110-86-1).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-iris-pyridine-hh-direct-rfd / -food-rfd (value 0.001). logKow not in catalog ' +
      '-> eco pathways filtered. abs_dermal 0.03 = HC TRV v4.0 Table 5 VOC RAFDerm ' +
      'default (0.03, MECP 2011). Boundary case: volatile (bp 115 C) but Method ' +
      '8270-classified; 0.03 kept as the VOC default pending a dedicated review.',
  },
  {
    key: '2_methylnaphthalene',
    displayName: '2-Methylnaphthalene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 4.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 4 x 10-3 mg/kg-bw/day (2-methylnaphthalene; CAS 91-57-6).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-iris-2_methylnaphthalene-hh-direct-rfd / -food-rfd (value 0.004). Library key ' +
      'matches the catalog substance_key 2_methylnaphthalene exactly so provenance ' +
      'resolves to these US EPA IRIS rows (a separate BC-jurisdiction methylnaphthalene_2 ' +
      'catalog row exists under a different key and is not seeded here). organic-PAH; ' +
      'logKow not in catalog -> eco-direct EqP unavailable; no eco TRV -> Eco-Food ' +
      'filtered. abs_dermal/ba_oral are organic-PAH class defaults pending HITL.',
  },
  {
    key: 'dichloromethane',
    displayName: 'Dichloromethane (methylene chloride)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.014,
    sf_oral_per_mg_per_kg_bw_per_day: 0.002,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada TRVs v4.0 approved oral RfD 0.014 + oral SF 0.002 (the rows the wired values match; US EPA IRIS lists different values 0.006/0.0033, not used); Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: 'dichloroethylene_1_1',
    displayName: '1,1-Dichloroethylene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada TRVs v4.0 approved oral RfD 0.003 (the row the wired value matches; US EPA IRIS lists a different value 0.05, not used); Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: '1_2_dichloroethane',
    displayName: '1,2-Dichloroethane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.091,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: 'trichloroethane_1_1_2',
    displayName: '1,1,2-Trichloroethane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: 0.057,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: 'tetrachloroethane_1_1_1_2',
    displayName: '1,1,1,2-Tetrachloroethane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: 0.026,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: 'bis_2_ethylhexyl_phthalate_dehp',
    displayName: 'Di(2-ethylhexyl) phthalate (DEHP)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: 0.014,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.014 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live) (CAS 117-81-7); EPA RAGS Part E soil SVOC default dermal absorption (abs_dermal 0.1)',
    notes:
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal 0.1 = organic-class SVOC ' +
      'default (EPA RAGS Part E). DEHP is a non-volatile SVOC (bp ~384 C), NOT a VOC; the ' +
      'prior 0.03 VOC-RAF label was a copy-paste error (2026-07-02 source verification).',
  },
  {
    key: '2_4_6_trinitrotoluene_tnt',
    displayName: '2,4,6-Trinitrotoluene (TNT)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: 0.03,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.03 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live) (CAS 118-96-7); EPA RAGS Part E supplemental soil ABS_d for TNT (abs_dermal 0.03, Reifenrath et al. 2002)',
    notes:
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal 0.03 = chemical-specific ' +
      'EPA soil ABS_d for TNT (3.2%; EPA RAGS Part E supplemental ABS_d table, Reifenrath ' +
      'et al. 2002), NOT a generic VOC RAF.',
  },
  {
    key: 'formaldehyde',
    displayName: 'Formaldehyde',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: '1_2_3_trimethylbenzene',
    displayName: '1,2,3-Trimethylbenzene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: '1_2_4_trimethylbenzene',
    displayName: '1,2,4-Trimethylbenzene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: '1_3_5_trimethylbenzene',
    displayName: '1,3,5-Trimethylbenzene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: 'bromobenzene',
    displayName: 'Bromobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: 'isopropylbenzene',
    displayName: 'Cumene (isopropylbenzene)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: 'chlorotoluene_2',
    displayName: 'o-Chlorotoluene (2-chlorotoluene)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
  },
  {
    key: '1_2_4_5_tetrachlorobenzene',
    displayName: '1,2,4,5-Tetrachlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; EPA RAGS Part E soil SVOC default dermal absorption (abs_dermal 0.1)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal 0.1 = organic-halogenated ' +
      'SVOC default (EPA RAGS Part E); persistent low-volatility SVOC (bp ~246 C), no ' +
      'chemical-specific ABS_d; prior 0.03 VOC-RAF label was wrong.',
  },
  {
    key: '2_4_dinitrotoluene',
    displayName: '2,4-Dinitrotoluene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS toxicity values; EPA RAGS Part E soil SVOC default dermal absorption (abs_dermal 0.1)',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal 0.1 = organic-class SVOC ' +
      'default (EPA RAGS Part E); 2,4-DNT is a semivolatile nitroaromatic, not a VOC (prior ' +
      '0.03 VOC-RAF label was wrong).',
  },
  {
    key: '2_4_dichlorophenoxyacetic_acid_2_4_d',
    displayName: '2,4-Dichlorophenoxyacetic acid (2,4-D)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; chlorophenoxy herbicide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF.',
  },
  {
    key: '4_2_4_dichlorophenoxy_butyric_acid_2_4_db',
    displayName: '4-(2,4-Dichlorophenoxy)butyric acid (2,4-DB)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.008,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.008 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; chlorophenoxy herbicide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF.',
  },
  {
    key: '2_4_5_trichlorophenoxyacetic_acid_2_4_5_t',
    displayName: '2,4,5-Trichlorophenoxyacetic acid (2,4,5-T)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; chlorophenoxy herbicide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF.',
  },
  {
    key: '2_2_4_5_trichlorophenoxy_propionic_acid_2_4_5_tp',
    displayName: '2-(2,4,5-Trichlorophenoxy)propionic acid (2,4,5-TP / Silvex)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.008,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.008 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; chlorophenoxy herbicide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF.',
  },
  {
    key: '2_methyl_4_chlorophenoxyacetic_acid_mcpa',
    displayName: '2-Methyl-4-chlorophenoxyacetic acid (MCPA)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; chlorophenoxy herbicide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF.',
  },
  {
    key: '4_2_methyl_4_chlorophenoxy_butyric_acid_mcpb',
    displayName: '4-(2-Methyl-4-chlorophenoxy)butyric acid (MCPB)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; chlorophenoxy herbicide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF.',
  },
  {
    key: '2_2_methyl_4_chlorophenoxy_propionic_acid_mcpp',
    displayName: '2-(2-Methyl-4-chlorophenoxy)propionic acid (MCPP / Mecoprop)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; chlorophenoxy herbicide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF.',
  },
  {
    key: '1_3_5_trinitrobenzene',
    displayName: '1,3,5-Trinitrobenzene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog values, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; nitroaromatic/energetic; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '4_6_dinitro_o_cyclohexyl_phenol',
    displayName: '4,6-Dinitro-o-cyclohexylphenol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog values, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; nitroaromatic/energetic; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dinitrophenol_2_4',
    displayName: '2,4-Dinitrophenol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog values, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; nitroaromatic/energetic; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx',
    displayName: 'Hexahydro-1,3,5-trinitro-1,3,5-triazine (RDX)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: 0.08,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral SF 0.08 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; nitroaromatic/energetic; oral RfD/SF candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'm_dinitrobenzene',
    displayName: 'm-Dinitrobenzene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0001 mg/kg-bw/day (approved catalog values, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; nitroaromatic/energetic; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'nitroguanidine',
    displayName: 'Nitroguanidine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog values, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; nitroaromatic/energetic; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'octahydro_1_3_5_7_tetranitro_1_3_5_7_tetrazocine_hmx',
    displayName: 'Octahydro-1,3,5,7-tetranitro-1,3,5,7-tetrazocine (HMX)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog values, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; nitroaromatic/energetic; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '2_2_3_3_4_4_5_5_6_6_decabromodiphenyl_ether_bde_209',
    displayName: 'Decabromodiphenyl ether (BDE-209)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.007,
    sf_oral_per_mg_per_kg_bw_per_day: 0.0007,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.007 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral SF 0.0007 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; PBDE flame retardant; oral RfD/SF candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '2_2_4_4_5_5_hexabromodiphenyl_ether_bde_153',
    displayName: 'Hexabromodiphenyl ether (BDE-153)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; PBDE flame retardant; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '2_2_4_4_5_pentabromodiphenyl_ether_bde_99',
    displayName: 'Pentabromodiphenyl ether (BDE-99)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; PBDE flame retardant; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '2_2_4_4_tetrabromodiphenyl_ether_bde_47',
    displayName: 'Tetrabromodiphenyl ether (BDE-47)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; PBDE flame retardant; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'octabromodiphenyl_ether',
    displayName: 'Octabromodiphenyl ether',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; PBDE flame retardant; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'pentabromodiphenyl_ether',
    displayName: 'Pentabromodiphenyl ether',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; PBDE flame retardant; oral RfD candidate(s) approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'aldicarb',
    displayName: 'Aldicarb',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; carbamate pesticide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'aldicarb_sulfone',
    displayName: 'Aldicarb sulfone',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; carbamate pesticide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'carbofuran',
    displayName: 'Carbofuran',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; carbamate pesticide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methomyl',
    displayName: 'Methomyl',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; carbamate pesticide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'oxamyl',
    displayName: 'Oxamyl',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; carbamate pesticide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 's_ethyl_dipropylthiocarbamate_eptc',
    displayName: 'S-Ethyl dipropylthiocarbamate (EPTC)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; carbamate pesticide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'sodium_diethyldithiocarbamate',
    displayName: 'Sodium diethyldithiocarbamate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; carbamate pesticide; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'atrazine',
    displayName: 'Atrazine',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.035,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.035 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'simazine',
    displayName: 'Simazine',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'propazine',
    displayName: 'Propazine',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'diuron',
    displayName: 'Diuron',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'linuron',
    displayName: 'Linuron',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chlorophenol_2',
    displayName: '2-Chlorophenol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dichlorophenol_2_4',
    displayName: '2,4-Dichlorophenol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'trichlorophenol_2_4_5',
    displayName: '2,4,5-Trichlorophenol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'tetrachlorophenol_2_3_4_6',
    displayName: '2,3,4,6-Tetrachlorophenol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'hexazinone',
    displayName: 'Hexazinone',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.033,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.033 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'metribuzin',
    displayName: 'Metribuzin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'prometon',
    displayName: 'Prometon',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.015,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.015 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'tebuthiuron',
    displayName: 'Tebuthiuron',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.07,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.07 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethylene_glycol',
    displayName: 'Ethylene glycol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethylene_glycol_monobutyl_ether_egbe_2_butoxyethanol',
    displayName: 'Ethylene glycol monobutyl ether (EGBE / 2-butoxyethanol)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'butylphthalyl_butylglycolate_bpbg',
    displayName: 'Butylphthalyl butylglycolate (BPBG)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethylphthalyl_ethylglycolate_epeg',
    displayName: 'Ethylphthalyl ethylglycolate (EPEG)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 3 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'sethoxydim',
    displayName: 'Sethoxydim',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.09,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.09 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). No approved oral SF. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  // ---------------------------------------------------------------------------
  // Batch L organophosphate pesticides (2026-07-01). 22 substances added for
  // HH-pathway selectability (build-first; values seeded verbatim from approved
  // catalog rows in human_health_trv_values.json, qa_status=approved). logKow/eco
  // fields null -> eco pathways filtered out (HH only). abs_dermal/ba_oral are
  // RAGS Part E class defaults (organic 0.1, organic-halogenated 0.1; both this
  // batch use 0.1). dichlorvos is the one dual-endpoint entry: RfD from
  // src-us-epa-iris-rfd-table-live, SF from src-us-epa-iris-chemical-details-live.
  // ---------------------------------------------------------------------------
  {
    key: 'acephate',
    displayName: 'Acephate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dimethoate',
    displayName: 'Dimethoate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'disulfoton',
    displayName: 'Disulfoton',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.00004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethion',
    displayName: 'Ethion',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethyl_p_nitrophenyl_phenylphosphorothioate_epn',
    displayName: 'Ethyl p-nitrophenyl phenylphosphorothioate (EPN)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.00001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'fenamiphos',
    displayName: 'Fenamiphos',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.00025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'fonofos',
    displayName: 'Fonofos',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'glyphosate',
    displayName: 'Glyphosate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'isopropyl_methyl_phosphonic_acid_impa',
    displayName: 'Isopropyl methyl phosphonic acid (IMPA)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'diisopropyl_methylphosphonate_dimp',
    displayName: 'Diisopropyl methylphosphonate (DIMP)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.08,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.08 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'merphos',
    displayName: 'Merphos',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.00003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'merphos_oxide',
    displayName: 'Merphos oxide',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.00003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methamidophos',
    displayName: 'Methamidophos',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.00005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methidathion',
    displayName: 'Methidathion',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methyl_parathion',
    displayName: 'Methyl parathion',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.00025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'phosmet',
    displayName: 'Phosmet',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'pirimiphos_methyl',
    displayName: 'Pirimiphos-methyl',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'quinalphos',
    displayName: 'Quinalphos',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'tetraethyldithiopyrophosphate',
    displayName: 'Tetraethyldithiopyrophosphate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'naled',
    displayName: 'Naled',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'tetrachlorovinphos',
    displayName: 'Tetrachlorovinphos',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dichlorvos',
    displayName: 'Dichlorvos',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: 0.29,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live). US EPA IRIS oral slope factor 0.29 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes: 'HH-only build-first wiring; organophosphate pesticide; oral RfD and oral slope factor (SF) candidates approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '1_2_4_tribromobenzene',
    displayName: '1,2,4-Tribromobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '1_4_dibromobenzene',
    displayName: '1,4-Dibromobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '1_4_dithiane',
    displayName: '1,4-Dithiane',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '2_3_7_8_tetrachlorodibenzo_p_dioxin',
    displayName: '2,3,7,8-Tetrachlorodibenzo-p-dioxin (TCDD)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 7e-10,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 7e-10 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '2_3_dichloropropanol',
    displayName: '2,3-Dichloropropanol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'acetochlor',
    displayName: 'Acetochlor',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'acetophenone',
    displayName: 'Acetophenone',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'acifluorfen_sodium',
    displayName: 'Acifluorfen, sodium',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'acrolein',
    displayName: 'Acrolein',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'acrylamide',
    displayName: 'Acrylamide',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: 0.83,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live). US EPA IRIS oral slope factor 0.83 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes: 'Oral RfD and oral slope factor (SF) candidates both approved in catalog (from different source_ids -- see sources field). HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'acrylic_acid',
    displayName: 'Acrylic acid',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.5,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.5 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'alachlor',
    displayName: 'Alachlor',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'allyl_alcohol',
    displayName: 'Allyl alcohol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'benzaldehyde',
    displayName: 'Benzaldehyde',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'benzidine',
    displayName: 'Benzidine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: 230,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live). US EPA IRIS oral slope factor 230 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes: 'Oral RfD and oral slope factor (SF) candidates both approved in catalog (from different source_ids -- see sources field). HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'benzoic_acid',
    displayName: 'Benzoic acid',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 4,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 4 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'beta_chloronaphthalene',
    displayName: 'beta-Chloronaphthalene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.08,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.08 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'bis_2_chloro_1_methylethyl_ether',
    displayName: 'Bis(2-chloro-1-methylethyl) ether',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.04,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.04 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'bromodichloromethane',
    displayName: 'Bromodichloromethane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: 0.062,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live). US EPA IRIS oral slope factor 0.062 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes: 'Oral RfD and oral slope factor (SF) candidates both approved in catalog (from different source_ids -- see sources field). HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'bromomethane',
    displayName: 'Bromomethane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0014,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0014 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '1_1_1_trichloroethane',
    displayName: '1,1,1-Trichloroethane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: '2_hexanone',
    displayName: '2-Hexanone',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'alar',
    displayName: 'Alar (Daminozide)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.15,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.15 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ally',
    displayName: 'Ally (Metsulfuron-methyl)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.25,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.25 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'amdro',
    displayName: 'Amdro (Hydramethylnon)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ametryn',
    displayName: 'Ametryn',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.009,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.009 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'amitraz',
    displayName: 'Amitraz',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'apollo',
    displayName: 'Apollo (Clofentezine)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'aroclor_1016',
    displayName: 'Aroclor 1016 (PCB Mixture)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00007,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.00007 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'assure',
    displayName: 'Assure (Quizalofop-P-ethyl)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.009,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.009 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'asulam',
    displayName: 'Asulam',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'avermectin_b1',
    displayName: 'Avermectin B1 (Abamectin)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'baygon',
    displayName: 'Baygon (Propoxur)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'bayleton',
    displayName: 'Bayleton (Triadimefon)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'baythroid',
    displayName: 'Baythroid (Cyfluthrin)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'benefin',
    displayName: 'Benefin (Benfluralin)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.3 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'bentazon_basagran',
    displayName: 'Bentazon (Basagran)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'bidrin',
    displayName: 'Bidrin (Dicrotophos)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.0001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'biphenthrin',
    displayName: 'Bifenthrin',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.015,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.015 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'bromoxynil',
    displayName: 'Bromoxynil',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes: 'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'bromoxynil_octanoate',
    displayName: 'Bromoxynil Octanoate',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'butylate',
    displayName: 'Butylate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'caprolactam',
    displayName: 'Caprolactam',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.5,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.5 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'captafol',
    displayName: 'Captafol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'captan',
    displayName: 'Captan',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.13,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.13 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'carbosulfan',
    displayName: 'Carbosulfan',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'carboxin',
    displayName: 'Carboxin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chloral_hydrate',
    displayName: 'Chloral Hydrate',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chloramben',
    displayName: 'Chloramben',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.015,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.015 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chlordecone_kepone',
    displayName: 'Chlordecone (Kepone)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: 10,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral SF 10 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chlorimuron_ethyl',
    displayName: 'Chlorimuron-ethyl',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chlorobenzilate',
    displayName: 'Chlorobenzilate',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chlorothalonil',
    displayName: 'Chlorothalonil',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.015,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.015 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chlorpropham',
    displayName: 'Chlorpropham',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'chlorsulfuron',
    displayName: 'Chlorsulfuron',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'cis_1_2_dichloroethylene',
    displayName: 'cis-1,2-Dichloroethylene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'cyclohexanone',
    displayName: 'Cyclohexanone',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 5,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 5 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'cyclohexylamine',
    displayName: 'Cyclohexylamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'cyhalothrin_karate',
    displayName: 'Cyhalothrin (Karate)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'cypermethrin',
    displayName: 'Cypermethrin',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'cyromazine',
    displayName: 'Cyromazine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0075,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0075 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dacthal',
    displayName: 'Dacthal (DCPA)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dalapon_sodium_salt',
    displayName: 'Dalapon, Sodium Salt',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'danitol',
    displayName: 'Danitol (Fenpropathrin)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'di_2_ethylhexyl_adipate',
    displayName: 'Di(2-ethylhexyl) Adipate (DEHA)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.6,
    sf_oral_per_mg_per_kg_bw_per_day: 0.0012,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.6 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral SF 0.0012 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dibromochloromethane',
    displayName: 'Dibromochloromethane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: 0.084,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral SF 0.084 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dibromoethane_1_2',
    displayName: '1,2-Dibromoethane (Ethylene Dibromide, EDB)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.009,
    sf_oral_per_mg_per_kg_bw_per_day: 2,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.009 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral SF 2 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dicamba',
    displayName: 'Dicamba',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dichloroacetic_acid',
    displayName: 'Dichloroacetic Acid',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: 0.05,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral SF 0.05 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dichlorodifluoromethane',
    displayName: 'Dichlorodifluoromethane (CFC-12)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dichloroethylene_1_2_trans',
    displayName: 'trans-1,2-Dichloroethylene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dichloropropene_1_3_cis_trans',
    displayName: '1,3-Dichloropropene (cis/trans)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: 0.1,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral SF 0.1 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'diethyl_ether',
    displayName: 'Diethyl Ether (Ethyl Ether)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'difenzoquat',
    displayName: 'Difenzoquat',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.08,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.08 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'diflubenzuron',
    displayName: 'Diflubenzuron',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dimethipin',
    displayName: 'Dimethipin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dimethyl_terephthalate_dmt',
    displayName: 'Dimethyl Terephthalate (DMT)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dimethylaniline_n_n_dma',
    displayName: 'N,N-Dimethylaniline',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dimethylphenol_2_4',
    displayName: '2,4-Dimethylphenol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dimethylphenol_2_6',
    displayName: '2,6-Dimethylphenol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0006,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0006 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dimethylphenol_3_4',
    displayName: '3,4-Dimethylphenol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dinoseb',
    displayName: 'Dinoseb',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'benomyl',
    displayName: 'Benomyl',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'diphenamid',
    displayName: 'Diphenamid',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'diphenylamine',
    displayName: 'Diphenylamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'diquat',
    displayName: 'Diquat',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0022,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0022 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'dodine',
    displayName: 'Dodine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'endothall',
    displayName: 'Endothall',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'epichlorohydrin',
    displayName: 'Epichlorohydrin',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.0099,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 0.0099 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral SF candidate approved in catalog (qa_status=approved); no oral RfD row in the catalog for this substance (rfd left null). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethephon',
    displayName: 'Ethephon',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethyl_acetate',
    displayName: 'Ethyl Acetate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.9,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.9 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethyl_tertiary_butyl_ether_etbe',
    displayName: 'Ethyl Tertiary Butyl Ether (ETBE)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'ethylene_thiourea_etu',
    displayName: 'Ethylene Thiourea (ETU)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00008,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.00008 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'express',
    displayName: 'Express (Tribenuron-Methyl)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.008,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.008 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'fluometuron',
    displayName: 'Fluometuron',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'fluridone',
    displayName: 'Fluridone',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.08,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.08 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'flurprimidol',
    displayName: 'Flurprimidol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'flutolanil',
    displayName: 'Flutolanil',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.06,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.06 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'fluvalinate',
    displayName: 'Fluvalinate',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'folpet',
    displayName: 'Folpet',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'fosetyl_al',
    displayName: 'Fosetyl-Al',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 3 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'furan',
    displayName: 'Furan',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'furfural',
    displayName: 'Furfural',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'furmecyclox',
    displayName: 'Furmecyclox',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.03,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 0.03 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral SF candidate approved in catalog (qa_status=approved); no oral RfD row in the catalog for this substance (rfd left null). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'glufosinate_ammonium',
    displayName: 'Glufosinate-ammonium',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'glycidaldehyde',
    displayName: 'Glycidaldehyde',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'haloxyfop_methyl',
    displayName: 'Haloxyfop-methyl',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.00005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'harmony',
    displayName: 'Harmony (Thifensulfuron-Methyl)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'hexabromobenzene',
    displayName: 'Hexabromobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'hexachlorodibenzo_p_dioxin_hxcdd_mixture_of_1_2_3_6_7_8_hxcdd_and_1_2_3_7_8_9_hxcdd',
    displayName: 'Hexachlorodibenzo-p-dioxin (HxCDD Mixture)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 6200,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 6200 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live; mixture of 1,2,3,6,7,8-HxCDD and 1,2,3,7,8,9-HxCDD).',
    notes:
      'HH-only build-first wiring; oral SF candidate approved in catalog (qa_status=approved); no oral RfD row in the catalog for this substance (rfd left null). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'hexachlorophene',
    displayName: 'Hexachlorophene',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'imazalil',
    displayName: 'Imazalil',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'imazaquin',
    displayName: 'Imazaquin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.25,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.25 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'iprodione',
    displayName: 'Iprodione',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.04,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.04 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'isobutyl_alcohol',
    displayName: 'Isobutyl Alcohol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.3 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'isopropalin',
    displayName: 'Isopropalin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.015,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.015 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'isoxaben',
    displayName: 'Isoxaben',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'lactofen',
    displayName: 'Lactofen',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'londax',
    displayName: 'Londax (Bensulfuron-Methyl)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'm_phenylenediamine',
    displayName: 'm-Phenylenediamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.006,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.006 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'maleic_anhydride',
    displayName: 'Maleic Anhydride',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'maleic_hydrazide',
    displayName: 'Maleic Hydrazide',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.5,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.5 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'maneb',
    displayName: 'Maneb',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'mepiquat_chloride',
    displayName: 'Mepiquat Chloride',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'metalaxyl',
    displayName: 'Metalaxyl',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.06,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.06 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methacrylonitrile',
    displayName: 'Methacrylonitrile',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methanol',
    displayName: 'Methanol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methyl_ethyl_ketone_mek',
    displayName: 'Methyl Ethyl Ketone (MEK)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.6,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.6 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methyl_methacrylate',
    displayName: 'Methyl Methacrylate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1.4,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 1.4 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methylnaphthalene_2',
    displayName: '2-Methylnaphthalene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada TRV v4.0 oral TDI/RfD 0.004 mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal uses the organic-PAH class default (0.13, matching every other organic-PAH entry in this library) rather than the generic organic default, since this is the same 2-methylnaphthalene chemical already wired under the key 2_methylnaphthalene (Batch D, US EPA IRIS-sourced); this Health Canada TRV v4.0-sourced catalog row was deferred at Batch D and is seeded here as a separate jurisdiction-specific entry, per the 2_methylnaphthalene note.',
  },
  {
    key: 'methylphenol_2',
    displayName: '2-Methylphenol (o-Cresol)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'methylphenol_3',
    displayName: '3-Methylphenol (m-Cresol)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'metolachlor',
    displayName: 'Metolachlor',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.15,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.15 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'molinate',
    displayName: 'Molinate',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_butanol',
    displayName: 'n-Butanol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_hexane',
    displayName: 'n-Hexane',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada TRV v4.0 oral TDI/RfD 0.1 mg/kg-bw/day (approved catalog value, src-health-canada-trv-v4-2025).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_nitroso_di_n_butylamine',
    displayName: 'N-Nitroso-di-n-butylamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 5.4,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 5.4 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_nitroso_n_methylethylamine',
    displayName: 'N-Nitroso-N-methylethylamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 22,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 22 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_nitrosodi_n_propylamine',
    displayName: 'N-Nitrosodi-n-propylamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 7,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 7 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_nitrosodiethanolamine',
    displayName: 'N-Nitrosodiethanolamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 2.8,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 2.8 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_nitrosodiethylamine',
    displayName: 'N-Nitrosodiethylamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 150,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 150 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_nitrosodimethylamine',
    displayName: 'N-Nitrosodimethylamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 51,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 51 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  // ---------------------------------------------------------------------------
  // Catalog WIRE batch -- misc organics (Batch T, 2026-07-01). 20 substances
  // continuing alphabetically after Batch S (n_nitrosodimethylamine). HH-only;
  // logKow/eco fields null -> eco pathways filtered. abs_dermal/ba_oral are
  // RAGS Part E class defaults (organic 0.1, organic-halogenated 0.1); ba_oral
  // the conservative 1.0. paraquat + nustar retain their Cl/F counterpart
  // atoms out of the core class call the same way mepiquat_chloride (Batch S)
  // did: quaternary-ammonium counterion chlorides classed organic, covalently
  // bonded ring/chain halogens classed organic-halogenated. nustar = flusilazole
  // trade name (CAS 85509-19-9; bis(4-fluorophenyl) triazole fungicide).
  // ---------------------------------------------------------------------------
  {
    key: 'n_nitrosodiphenylamine',
    displayName: 'N-Nitrosodiphenylamine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.0049,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 0.0049 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'n_nitrosopyrrolidine',
    displayName: 'N-Nitrosopyrrolidine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 2.1,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 2.1 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. Catalog also carries an inhalation unit risk (0.00061 per ug/m3, same source) not represented in this HH-only schema. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'napropamide',
    displayName: 'Napropamide',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'norflurazon',
    displayName: 'Norflurazon',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.04,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.04 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Pyridazinone herbicide bearing a ring chlorine + trifluoromethyl group -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'nustar',
    displayName: 'NuStar (Flusilazole)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0007,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0007 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live; CASRN 85509-19-9).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). "NuStar" is the trade name for flusilazole, a bis(4-fluorophenyl) triazole fungicide -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'oryzalin',
    displayName: 'Oryzalin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Dinitroaniline sulfonamide herbicide, no ring halogens -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'oxadiazon',
    displayName: 'Oxadiazon',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Dichlorophenyl oxadiazolone herbicide -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'oxyfluorfen',
    displayName: 'Oxyfluorfen',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Chloro-trifluoromethyl diphenyl ether herbicide -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'p_chloroaniline',
    displayName: 'p-Chloroaniline',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'p_p_dichlorodiphenyl_dichloroethane_ddd',
    displayName: "p,p'-DDD (Dichlorodiphenyl Dichloroethane)",
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.24,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      "US EPA IRIS oral slope factor 0.24 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).",
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. Organochlorine DDT metabolite -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'p_p_dichlorodiphenyldichloroethylene_dde',
    displayName: "p,p'-DDE (Dichlorodiphenyldichloroethylene)",
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.34,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      "US EPA IRIS oral slope factor 0.34 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).",
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD. Organochlorine DDT metabolite -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'paclobutrazol',
    displayName: 'Paclobutrazol',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Chlorophenyl triazole plant growth regulator -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'paraquat',
    displayName: 'Paraquat',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0045,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0045 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Bipyridinium herbicide cation (commercial dichloride salt); the chloride is a counterion, not a ring/chain halogen -> organic, consistent with mepiquat_chloride (Batch S). abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'pendimethalin',
    displayName: 'Pendimethalin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.04,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.04 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Dinitroaniline herbicide, no ring halogens -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'pentachloronitrobenzene_pcnb',
    displayName: 'Pentachloronitrobenzene (PCNB)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'perfluorobutanoic_acid_pfba',
    displayName: 'Perfluorobutanoic acid (PFBA)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). PFAS carboxylic acid -> organic-halogenated (consistent with PFOA/PFOS, Batch D). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'perfluorodecanoic_acid_pfda',
    displayName: 'Perfluorodecanoic acid (PFDA)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 2.0e-9,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 2 x 10-9 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live). EPA gives no single overall RfD, but both chronic non-cancer endpoints converge on 2e-9 (owner-confirmed 2026-06-23).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). PFAS carboxylic acid -> organic-halogenated (consistent with PFOA/PFOS, Batch D). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'perfluorohexanoic_acid_pfhxa',
    displayName: 'Perfluorohexanoic acid (PFHxA)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). PFAS carboxylic acid -> organic-halogenated (consistent with PFOA/PFOS, Batch D). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'permethrin_cis_trans',
    displayName: 'Permethrin (cis/trans)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Dichlorovinyl cyclopropanecarboxylate pyrethroid -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'phenmedipham',
    displayName: 'Phenmedipham',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.25,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.25 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Bis-carbamate herbicide, no ring halogens -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'phthalic_anhydride',
    displayName: 'Phthalic Anhydride',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Phthalic anhydride (C8H4O3), no ring/chain halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'picloram',
    displayName: 'Picloram',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.07,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.07 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Picloram (4-amino-3,5,6-trichloropicolinic acid), chlorinated pyridine herbicide with ring chlorines -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'prochloraz',
    displayName: 'Prochloraz',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.009,
    sf_oral_per_mg_per_kg_bw_per_day: 0.15,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.009 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.15 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; both oral RfD and oral slope factor candidates approved in catalog (qa_status=approved), sourced from two different catalog rows (RfD from the rfd-table source, SF from the chemical-details source). Prochloraz is a chlorinated-phenyl imidazole fungicide -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'prometryn',
    displayName: 'Prometryn',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Triazine herbicide with S-methylthio + isopropylamino substituents, no ring/chain halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'pronamide',
    displayName: 'Pronamide',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.075,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.075 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Pronamide (3,5-dichloro-N-(1,1-dimethyl-2-propynyl)benzamide), ring dichloro -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'propachlor',
    displayName: 'Propachlor',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Chloroacetanilide herbicide (2-chloro-N-isopropylacetanilide), chain chlorine on the chloroacetyl group -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'propanil',
    displayName: 'Propanil',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Propanil (3,4-dichloropropionanilide), ring dichloro -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'propargite',
    displayName: 'Propargite',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Organosulfite miticide, no ring/chain halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'propargyl_alcohol',
    displayName: 'Propargyl Alcohol',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Propargyl alcohol (2-propyn-1-ol), simple organic alcohol, no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'propham',
    displayName: 'Propham',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Carbamate herbicide (isopropyl carbanilate), no ring/chain halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'propiconazole',
    displayName: 'Propiconazole',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Triazole fungicide with a 2,4-dichlorophenyl group, ring dichloro -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'propylene_oxide',
    displayName: 'Propylene Oxide',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 0.24,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 0.24 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD in the clean catalog set. Propylene oxide (epoxide), no halogen -> organic. Catalog also carries inhalation RfC/unit-risk rows (rfc_inh, iur_inh) which are NOT wired here -- this library is HH oral/dermal only. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'pursuit',
    displayName: 'Pursuit (Imazethapyr)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.25,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.25 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Pursuit is the trade name for imazethapyr, an imidazolinone herbicide, no ring/chain halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'pydrin',
    displayName: 'Pydrin (Fenvalerate)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Pydrin is the trade name for fenvalerate, a pyrethroid insecticide with a ring chlorine (4-chlorophenyl group) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'quinoline',
    displayName: 'Quinoline',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: 3,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral slope factor 3 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; oral slope factor candidate approved in catalog (qa_status=approved). No approved oral RfD in the clean catalog set. Quinoline is an aza-arene (N-heterocyclic fused-ring aromatic) -- structurally PAH-like but contains nitrogen, not a true polycyclic aromatic hydrocarbon, so the organic-PAH class and its abs_dermal 0.13 precedent do NOT apply here; classified organic with the standard 0.1 default, no halogen. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'resmethrin',
    displayName: 'Resmethrin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Pyrethroid insecticide with a furan-methyl ester group, no ring/chain halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'rotenone',
    displayName: 'Rotenone',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Natural organic insecticide (rotenoid), no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'savey',
    displayName: 'Savey (Hexythiazox)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Savey is the trade name for hexythiazox, a thiazolidine acaricide with a ring chlorine (4-chlorophenyl group) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'sodium_fluoroacetate',
    displayName: 'Sodium Fluoroacetate',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.00002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). CLASS CALL: sodium fluoroacetate (CH2FCOONa, "Compound 1080") is a salt, but this is the structural OPPOSITE of the paraquat case -- paraquat is classified organic because its chloride is an IONIC COUNTERION to an organic cation. Here the fluorine is COVALENTLY BONDED to the organic carbon backbone (the fluoroacetate anion, CH2F-COO-) and sodium is the counterion instead. Because the C-F bond is intrinsic to the organic moiety (same reasoning as metolachlor/norflurazon being organic-halogenated for their ring/chain halogens), this is classified organic-halogenated, not organic. Orchestrator-resolved class-uncertain call, 2026-07-01 (Batch U). abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'strychnine',
    displayName: 'Strychnine',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Natural organic alkaloid, no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'systhane',
    displayName: 'Systhane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Systhane is the trade name for myclobutanil, a triazole fungicide bearing a 4-chlorophenyl group (ring chlorine) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'terbacil',
    displayName: 'Terbacil',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Terbacil is a chloro-substituted uracil herbicide (ring chlorine) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'terbutryn',
    displayName: 'Terbutryn',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Terbutryn is a methylthio-triazine herbicide with no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'tert_butyl_alcohol_tba',
    displayName: 'tert-Butyl Alcohol (tBA)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.4,
    sf_oral_per_mg_per_kg_bw_per_day: 0.0005,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.4 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.0005 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; both oral RfD and oral slope factor candidates approved in catalog (qa_status=approved), sourced from two different catalog rows (RfD from the rfd-table source, SF from the chemical-details source). tert-Butyl alcohol (tBA) is a simple aliphatic alcohol, no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'tetrahydrofuran',
    displayName: 'Tetrahydrofuran',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.9,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.9 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Tetrahydrofuran is a cyclic ether, no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'thiobencarb',
    displayName: 'Thiobencarb',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Thiobencarb is a thiocarbamate herbicide with a 4-chlorobenzyl group (ring chlorine) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'thiophanate_methyl',
    displayName: 'Thiophanate-methyl',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.08,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.08 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Thiophanate-methyl is a thiourea/benzimidazole-precursor fungicide with no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'thiram',
    displayName: 'Thiram',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Thiram is a metal-free dimethyldithiocarbamate (tetramethylthiuram disulfide), no halogen and no metal -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'tralomethrin',
    displayName: 'Tralomethrin',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0075,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0075 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Tralomethrin is a pyrethroid bearing a tetrabromo (dibromovinyl) substituent -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'triallate',
    displayName: 'Triallate',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.013,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.013 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Triallate is a thiocarbamate herbicide with a trichloroallyl group (chain chlorine) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'triasulfuron',
    displayName: 'Triasulfuron',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.01,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.01 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Triasulfuron is a sulfonylurea herbicide bearing a 2-chloroethoxy substituent (chain chlorine) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'trichloro_1_2_2_trifluoroethane_1_1_2',
    displayName: '1,1,2-Trichloro-1,2,2-trifluoroethane (CFC-113)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 30,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 30 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). CFC-113 (1,1,2-trichloro-1,2,2-trifluoroethane) has covalent C-Cl and C-F bonds -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'trichloroacetic_acid',
    displayName: 'Trichloroacetic Acid',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: 0.07,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.07 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; both oral RfD and oral slope factor candidates approved in catalog (qa_status=approved), sourced from two different catalog rows (RfD from the rfd-table source, SF from the chemical-details source). Trichloroacetic acid has three covalent C-Cl bonds -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'trichlorofluoromethane',
    displayName: 'Trichlorofluoromethane (CFC-11)',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.3 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). CFC-11 (trichlorofluoromethane) has covalent C-Cl and C-F bonds -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'trichloropropane_1_1_2',
    displayName: '1,1,2-Trichloropropane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). 1,1,2-Trichloropropane has covalent C-Cl bonds -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'trichloropropane_1_2_3',
    displayName: '1,2,3-Trichloropropane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: 0.5,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.5 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; both oral RfD and oral slope factor candidates approved in catalog (qa_status=approved), sourced from two different catalog rows (RfD from the rfd-table source, SF from the chemical-details source). 1,2,3-Trichloropropane has three covalent C-Cl bonds -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'tridiphane',
    displayName: 'Tridiphane',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Tridiphane is a dichlorophenyl oxirane herbicide (ring chlorines) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'trifluralin',
    displayName: 'Trifluralin',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0075,
    sf_oral_per_mg_per_kg_bw_per_day: 0.0077,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0075 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.0077 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; both oral RfD and oral slope factor candidates approved in catalog (qa_status=approved), sourced from two different catalog rows (RfD from the rfd-table source, SF from the chemical-details source). Trifluralin is a dinitroaniline herbicide bearing a trifluoromethyl group (covalent C-F) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'vernam',
    displayName: 'Vernam (Vernolate)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Vernam is the trade name for vernolate, a thiocarbamate herbicide with no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'vinclozolin',
    displayName: 'Vinclozolin',
    contaminantClass: 'organic-halogenated',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.025,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.025 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Vinclozolin is a dichlorophenyl oxazolidinedione fungicide (ring chlorines) -> organic-halogenated. abs_dermal is the conservative organic-halogenated default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'warfarin',
    displayName: 'Warfarin',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Warfarin is a coumarin anticoagulant with no halogen -> organic. abs_dermal is the conservative organic default (0.1), not a verified chemical-specific HC Table 5 RAF.',
  },
  {
    key: 'aluminum_phosphide',
    displayName: 'Aluminum Phosphide',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'ammonium_sulfamate',
    displayName: 'Ammonium Sulfamate',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.2 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'bromate',
    displayName: 'Bromate',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: 0.7,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live) + oral slope factor 0.7 per mg/kg-bw/day (approved catalog value, src-us-epa-iris-chemical-details-live).',
    notes:
      'HH-only build-first wiring; both oral RfD and oral slope factor candidates approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'chlorine',
    displayName: 'Chlorine',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'chlorine_cyanide',
    displayName: 'Chlorine Cyanide (Cyanogen Chloride)',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.05 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'chlorine_dioxide',
    displayName: 'Chlorine Dioxide',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'chlorite_sodium_salt',
    displayName: 'Chlorite (Sodium Salt)',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.03,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.03 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'cyanogen',
    displayName: 'Cyanogen',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.001 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'cyanogen_bromide',
    displayName: 'Cyanogen Bromide',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.09,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.09 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'fluorine_soluble_fluoride',
    displayName: 'Fluorine (Soluble Fluoride)',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.06,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.06 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'monochloramine',
    displayName: 'Monochloramine',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'nitrate',
    displayName: 'Nitrate',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 1.6,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 1.6 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'nitrite',
    displayName: 'Nitrite',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.1,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.1 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'perchlorate_clo4_and_perchlorate_salts',
    displayName: 'Perchlorate (ClO4 and Perchlorate Salts)',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0007,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0007 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'phosphine',
    displayName: 'Phosphine',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'sodium_azide',
    displayName: 'Sodium Azide',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.004,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.004 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'white_phosphorus',
    displayName: 'White Phosphorus',
    contaminantClass: 'inorganic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.00002,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.00002 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live).',
    notes:
      'HH-only build-first wiring; oral RfD candidate approved in catalog (qa_status=approved). Inorganic substance (cyanide/oxyanion/reactive-gas/elemental) -> contaminantClass inorganic (new descriptive non-organic/non-metal-cation class; behaves as M_eco=1 + standard dermal in derivations). abs_dermal 0.1 is a CONSERVATIVE PLACEHOLDER default, NOT a verified chemical-specific HC Table 5 RAF -- flagged for HITL refinement.',
  },
  {
    key: 'vanadium_pentoxide',
    displayName: 'Vanadium pentoxide',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.009,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.009 mg/kg-bw/day (approved catalog value, ' +
      'src-us-epa-iris-rfd-table-live). Identity: Vanadium pentoxide (V2O5), ' +
      'CAS 1314-62-1, PubChem CID 14814 (V2O5; EPA IRIS CASRN 1314-62-1, DTXSID2023806); distinct from the elemental vanadium entry (key: vanadium). No ' +
      'Health Canada TRV v4.0 candidate exists for vanadium_pentoxide.',
    notes:
      'NEW library entry (no prior key; wireable_new in the wire-candidates recon). ' +
      'Oral RfD wired build-first from the approved catalog row (qa_status=approved); ' +
      'no oral slope factor candidate exists in the catalog. contaminantClass metalloid ' +
      'follows the elemental-vanadium sibling precedent (key: vanadium) -- ' +
      'vanadate/vanadyl speciation, not a true M2+, avoids the divalent-metals AVS/SEM ' +
      'path. abs_dermal 0.03 = metalloid class default (no chemical-specific soil ABSd). ' +
      'logKow n/a (metal oxide); eco fields left null pending eco-catalog seeding -- ' +
      'HH-only entry today.',
  },
  {
    key: 'mercuric_chloride_hgcl2',
    displayName: 'Mercuric chloride (HgCl2)',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live; ' +
      'IRIS "Mercuric chloride (HgCl2)", CASRN 7487-94-7, autoimmune/renal, UF 1000; live-verified 2026-07-04). ' +
      'Identity: Mercuric chloride, CAS 7487-94-7, PubChem CID 24085. Distinct salt entry from the elemental ' +
      'mercury_inorganic key (same 0.0003 value, but a distinct CAS-specific substance).',
    notes:
      'NEW own-key entry (D3 metal-salt, wired as its own key rather than backfilling mercury_inorganic). ' +
      'Oral RfD wired build-first from the single approved catalog row (qa_status=approved). No oral slope ' +
      'factor candidate exists. contaminantClass divalent-metal (Hg2+ salt); abs_dermal 0.001 = divalent-metal ' +
      'class default. logKow n/a (ionic metal salt); eco fields null (HH-only entry).',
  },
  {
    key: 'selenious_acid',
    displayName: 'Selenious acid',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.005,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.005 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live; ' +
      'IRIS selenium/selenious acid, clinical selenosis, UF 3; live-verified 2026-07-04). Identity: Selenious ' +
      'acid, CAS 7783-00-8, PubChem CID 1091. Distinct salt entry from the elemental selenium key (same 0.005 ' +
      'value; selenium compounds share the IRIS selenosis basis).',
    notes:
      'NEW own-key entry (D3 metal-salt). Oral RfD wired build-first from the single approved catalog row ' +
      '(qa_status=approved). No oral slope factor candidate exists. contaminantClass metalloid (Se oxyanion); ' +
      'abs_dermal 0.03 = metalloid class default. logKow n/a; eco fields null (HH-only entry).',
  },
  {
    key: 'uranium_soluble_salts',
    displayName: 'Uranium, soluble salts',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live; ' +
      'IRIS "Uranium, soluble salts", nephrotoxicity, UF 1000; live-verified 2026-07-04). Identity: Uranium ' +
      'soluble salts; the IRIS class entry carries NO own CASRN (critical study used uranyl nitrate ' +
      'hexahydrate) -- CAS 7440-61-1 (elemental U) / PubChem CID 23989 used as the proxy identifier. Distinct ' +
      'from the elemental uranium key (which carries HC 0.0006; this soluble-salts entry is the higher/' +
      'less-stringent IRIS 0.003 for the soluble salt form).',
    notes:
      'NEW own-key entry (D3 metal-salt; own key rather than backfilling uranium, whose wired HC value 0.0006 ' +
      'differs from this IRIS soluble-salts 0.003). Oral RfD wired build-first from the single approved catalog ' +
      'row (qa_status=approved). No oral slope factor candidate. contaminantClass metalloid (uranyl, not a true ' +
      'M2+); abs_dermal 0.03 = metalloid class default. logKow n/a; eco fields null (HH-only entry).',
  },
  {
    key: 'nickel_soluble_salts',
    displayName: 'Nickel, soluble salts',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.02,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.02 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live; ' +
      'IRIS "Nickel, soluble salts", Ambrose 1976 rat feeding, decreased body/organ weight, UF 300; ' +
      'live-verified 2026-07-04). Identity: Nickel soluble salts, CAS 7440-02-0, PubChem CID 935. Distinct salt ' +
      'entry from the elemental nickel key.',
    notes:
      'NEW own-key entry (D3 metal-salt). Oral RfD wired build-first from the single approved catalog row ' +
      '(qa_status=approved). No oral slope factor candidate. contaminantClass divalent-metal (Ni2+); abs_dermal ' +
      '0.001 = divalent-metal class default (Ni dermal sensitization is a hazard, not an absorption fraction). ' +
      'logKow n/a; eco fields null (HH-only entry).',
  },
  {
    key: 'nickel_sulfate',
    displayName: 'Nickel sulfate',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.012,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Health Canada FCSAP TRV v4.0 (2021) oral TDI 0.012 mg/kg-bw/day (approved catalog value, ' +
      'src-health-canada-trv-v4-2025; epidemiological, dermal toxicity/eczema in Ni-sensitive subjects, ' +
      'LOAEL 12 ug Ni/kg-bw/day, CCME 2015 / WHO 2007 / Nielsen 1999; live-verified against the HC v4.0 PDF ' +
      '2026-07-04). Identity: Nickel sulfate, CAS 7786-81-4, PubChem CID 24586. Distinct salt entry from the ' +
      'elemental nickel key.',
    notes:
      'NEW own-key entry (D3 metal-salt). Oral RfD wired build-first from the single approved catalog row ' +
      '(qa_status=approved). No oral slope factor candidate. contaminantClass divalent-metal (Ni2+); abs_dermal ' +
      '0.001 = divalent-metal class default. logKow n/a; eco fields null (HH-only entry).',
  },
  {
    key: 'tetraethyl_lead',
    displayName: 'Tetraethyl lead',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0000001,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 1e-7 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live; ' +
      'IRIS "Tetraethyl lead", CASRN 78-00-2, Schepers 1964, UF 10000; the unusually low 1e-7 value is real ' +
      'and live-verified 2026-07-04). Identity: Tetraethyl lead, CAS 78-00-2, PubChem CID 6511. ORGANOMETALLIC ' +
      '(Pb-C bonds): contaminantClass organic is a pragmatic bucket (no organometallic class exists in the ' +
      'closed ContaminantClass union) -- do NOT reuse the elemental lead (divalent-metal) entry.',
    notes:
      'NEW own-key entry (D4 organometallic). Oral RfD wired build-first from the single approved catalog row ' +
      '(qa_status=approved). No oral slope factor candidate. contaminantClass organic is a pragmatic bucket for ' +
      'this Pb-C organometallic (no organometallic/organolead class exists); NOT elemental lead. abs_dermal 0.1 ' +
      '= organic class default (no chemical-specific soil ABSd; note tetraethyl lead is in reality highly ' +
      'dermally-absorbed/volatile -- flagged for a future chemical-specific ABSd). logKow n/a here (HH-oral ' +
      'only; no eco pathway wired). eco fields null (HH-only entry).',
  },
  {
    key: 'tributyltin_oxide_tbto',
    displayName: 'Tributyltin oxide (TBTO)',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.0003,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 0.0003 mg/kg-bw/day (approved catalog value, src-us-epa-iris-rfd-table-live; ' +
      'IRIS "Tributyltin oxide (TBTO)", CASRN 56-35-9, Vos 1990 immunotoxicity, BMD10, UF 100; live-verified ' +
      '2026-07-04). Identity: Bis(tributyltin) oxide, CAS 56-35-9, PubChem CID 16682746. ORGANOMETALLIC ' +
      '(Sn-C bonds): contaminantClass organic is a pragmatic bucket (no organometallic/organotin class exists) ' +
      '-- do NOT reuse the elemental tin (divalent-metal) entry.',
    notes:
      'NEW own-key entry (D4 organometallic). Oral RfD wired build-first from the single approved catalog row ' +
      '(qa_status=approved). No oral slope factor candidate. contaminantClass organic is a pragmatic bucket for ' +
      'this Sn-C organotin (no organotin class exists); NOT elemental tin. abs_dermal 0.1 = organic class ' +
      'default. logKow n/a here (HH-oral only; no eco pathway wired). eco fields null (HH-only entry).',
  },
] as const satisfies readonly SubstanceEntry[];

export type SubstanceKey = (typeof SUBSTANCE_LIBRARY)[number]['key'];

export function findSubstance(key: string): SubstanceEntry | undefined {
  return SUBSTANCE_LIBRARY.find((s) => s.key === key);
}
