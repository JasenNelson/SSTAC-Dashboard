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
    sf_oral_per_mg_per_kg_bw_per_day: 1.0,
    bsaf_loc_freshwater: 0.5,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    // US EPA Tier II SCV for B[a]P narcosis, used as the EqP FCV anchor in
    // design doc section 7 Anchor Case A.
    fcv_ug_per_L: 0.014,
    // US EPA Eco-SSL plant ingestion surrogate (NOAEL-derived). v1 starter
    // value; HITL override expected for an avian/mammalian receptor.
    trv_eco_mg_per_kg_bw_day: 0.0025,
    sources:
      'US EPA IRIS B[a]P (2017 reassessment); ERDC BSAF DB; ' +
      'Indigenous-Consumption-Pacific-NW Section 4.3; ' +
      'US EPA Eco-SSL for PAH (TRV)',
    notes:
      'Coastal-marine bivalve scenarios: multiply freshwater BSAF by 15 ' +
      '(passive PAH accumulation; lack of hepatic CYP1A). See design ' +
      'doc section 8.2.',
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
    // PCB FCV (chronic AWQC) is substance-specific; use a screening
    // starter value. HITL overrides per congener mixture.
    fcv_ug_per_L: 0.014,
    // US EPA Eco-SSL mammalian wildlife TRV (Aroclor 1254 oral chronic
    // NOAEL-derived). Used for the Eco-Food BSAF pathway.
    trv_eco_mg_per_kg_bw_day: 0.00012,
    sources:
      'US EPA IRIS Aroclor 1254; BSAF-Translation Section 4; ' +
      'US EPA Eco-SSL mammalian wildlife TRV (PCBs)',
    notes:
      'Do not apply coastal PAH multiplier; PCBs biomagnify rather than ' +
      'passively accumulate.',
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
    // CCME wildlife TRV for MeHg (chronic mammalian piscivore reference);
    // used directly with the protein-normalized BSAF path in the Eco-Food
    // derivation.
    trv_eco_mg_per_kg_bw_day: 0.000064,
    sources:
      'Health Canada HHRA 2023; Indigenous-Consumption-Pacific-NW ' +
      'Section 5; BSAF-Translation Section 7; CCME wildlife TRV (MeHg)',
    notes:
      'MeHg binds covalently to protein thiols. Use protein-normalized ' +
      'BSAF path (f_protein default 0.18 fish muscle). Do not ' +
      'lipid-normalize. EqP path is invalid for MeHg.',
  },
  {
    key: 'lead',
    displayName: 'Lead',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3.5e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 0.50,
    fcv_ug_per_L: null,
    // US EPA Eco-SSL avian TRV for Pb (NOAEL-derived). The eco-food
    // pathway for Pb has limited BSAF support in v1 (bsaf_loc_freshwater
    // is null) so the UI will filter Pb out of the Eco-Food dropdown; we
    // still record the TRV for future HITL workflows.
    trv_eco_mg_per_kg_bw_day: 0.0080,
    sources:
      'Health Canada HHRA 2023; ANZG; Bioavailability TOC-AVS Section 5; ' +
      'US EPA Eco-SSL avian TRV (Pb)',
    notes: 'Use AVS/SEM path for ecological direct-contact derivation.',
  },
  {
    key: 'copper',
    displayName: 'Copper',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 4.0e-2,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.001,
    ba_oral: 0.50,
    fcv_ug_per_L: null,
    // US EPA Eco-SSL avian TRV for Cu.
    trv_eco_mg_per_kg_bw_day: 7.0,
    sources: 'US EPA IRIS Cu; ANZG; US EPA Eco-SSL avian TRV (Cu)',
    notes: 'Use AVS/SEM path for ecological direct-contact derivation.',
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
    // US EPA Eco-SSL avian TRV for Cd.
    trv_eco_mg_per_kg_bw_day: 0.0014,
    sources: 'US EPA IRIS Cd; US EPA Eco-SSL avian TRV (Cd)',
    notes:
      'Drinking-water RfD (5.0e-4) available for water-pathway scenarios; ' +
      'default here is the dietary value (1.0e-3).',
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
    // US EPA Eco-SSL avian TRV for Zn.
    trv_eco_mg_per_kg_bw_day: 14.0,
    sources: 'US EPA IRIS Zn; US EPA Eco-SSL avian TRV (Zn)',
    notes: 'Use AVS/SEM path for ecological direct-contact derivation.',
  },
  {
    key: 'arsenic_inorganic',
    displayName: 'Arsenic (inorganic)',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 3.0e-4,
    sf_oral_per_mg_per_kg_bw_per_day: 1.5,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 0.60,
    fcv_ug_per_L: null,
    // US EPA Eco-SSL avian TRV for inorganic As.
    trv_eco_mg_per_kg_bw_day: 0.043,
    sources:
      'US EPA IRIS iAs; ANZG; ACFN-WQCIU; US EPA Eco-SSL avian TRV (iAs)',
    notes:
      'AVS/SEM framework does NOT apply to arsenic (not a divalent ' +
      'transition metal in the Cd-Cu-Pb-Ni-Zn family). Use bulk-sediment ' +
      'path with bioaccessibility correction.',
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
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS RfD table; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health TRV candidates are available in References & Values. ' +
      'Calculator defaults remain unset until owner-approved selection rules land.',
  },
  {
    key: 'benzene',
    displayName: 'Benzene',
    contaminantClass: 'organic',
    logKow: 2.13,
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
    key: 'beryllium',
    displayName: 'Beryllium',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health oral and inhalation TRV candidates are available in ' +
      'References & Values; ecological defaults are pending.',
  },
  {
    key: 'chromium_trivalent',
    displayName: 'Chromium, trivalent',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS RfD table; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health TRV candidates are available in References & Values. ' +
      'Speciation matters; do not merge with hexavalent chromium.',
  },
  {
    key: 'chromium_hexavalent',
    displayName: 'Chromium, hexavalent',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health RfD, RfC, oral slope factor, and inhalation unit risk ' +
      'candidates are available in References & Values. Speciation matters.',
  },
  {
    key: 'naphthalene',
    displayName: 'Naphthalene',
    contaminantClass: 'organic-PAH',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.148,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health RfD and RfC candidates are available in References & Values. ' +
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
    abs_dermal: 1.0,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF',
    notes:
      'Human-health RfD, RfC, oral slope factor, and inhalation unit risk ' +
      'candidates are available in References & Values.',
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
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Nickel (total), CAS 7440-02-0, PubChem CID 935 (EC 231-111-4). ' +
      'Eco-food TRV seeded from the eco catalog (FCSAP ERA Module 7).',
    notes:
      'Eco-food selectability. logKow not applicable (inorganic metal; metal ' +
      'partitioning uses empirical BSAF, not Kow). Eco-Food BSAF is user-supplied ' +
      'or catalog-seeded; abs_dermal/ba_oral are inert HH defaults.',
  },
  {
    key: 'selenium',
    displayName: 'Selenium',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Selenium (total), CAS 7782-49-2, PubChem CID 6326970 ' +
      '(US EPA IRIS CASRN 7782-49-2). Eco-food TRV seeded from the eco catalog.',
    notes:
      'Eco-food selectability. logKow not applicable (metalloid; Se bioaccumulation ' +
      'driven by trophic transfer/BSAF). HH fields null; abs_dermal/ba_oral inert.',
  },
  {
    key: 'toluene',
    displayName: 'Toluene',
    contaminantClass: 'organic',
    logKow: 2.73,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Toluene (methylbenzene), CAS 108-88-3, PubChem CID 1140. ' +
      'logKow 2.73 (Hansch/Leo/Hoekman 1995, via HSDB/PubChem; corroborated ' +
      'ATSDR, ECHA 2.73 at pH7/20C). Eco FCV/TRV seeded from the eco catalog.',
    notes:
      'Eco-direct + eco-food selectability. logKow 2.73 is load-bearing for ' +
      'eco-direct EqP. HH fields null; abs_dermal/ba_oral inert HH defaults.',
  },
  {
    key: 'ethylbenzene',
    displayName: 'Ethylbenzene',
    contaminantClass: 'organic',
    logKow: 3.15,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Ethylbenzene, CAS 100-41-4, PubChem CID 7500. logKow 3.15 ' +
      '(Hansch/Leo/Hoekman 1995, p.43; ECHA experimental 3.15; HSDB/EPI Suite). ' +
      'Eco FCV/TRV seeded from the eco catalog.',
    notes:
      'Eco-direct + eco-food selectability. logKow 3.15 load-bearing for ' +
      'eco-direct EqP. HH fields null; abs_dermal/ba_oral inert HH defaults.',
  },
  {
    key: 'pyrene',
    displayName: 'Pyrene',
    contaminantClass: 'organic-PAH',
    logKow: 4.88,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.13,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Pyrene (4-ring parent PAH), CAS 129-00-0, PubChem CID 31423 ' +
      '(EPA CompTox DTXSID3024289). logKow 4.88 (Hansch/Leo/Hoekman 1995, p.137, ' +
      'via HSDB). Eco-food TRV seeded from the eco catalog.',
    notes:
      'Eco-food selectability (logKow not seeded for its eco-food pathway). ' +
      'CAVEAT: if eco-direct EqP is later activated for pyrene, prefer the EPA ' +
      'PAH ESB logKow (~5.18) for EqP consistency; 4.88 is the PubChem/HSDB ' +
      'experimental value. HH fields null; abs_dermal/ba_oral inert.',
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
      'Eco-food TRV seeded from the eco catalog.',
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
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: p,p-DDT (4,4-DDT; the p,p isomer, CAS 50-29-3, PubChem CID 3036; ' +
      'US EPA IRIS CASRN 50-29-3) -- NOT o,p-DDT (789-02-6) nor technical mixture. ' +
      'logKow 6.91 (Hansch/Leo/Hoekman 1995, p.118; HMDB 6.91). Eco FCV from catalog.',
    notes:
      'Eco-direct selectability. Isomer-specific (p,p). logKow 6.91 load-bearing for ' +
      'eco-direct EqP. HH fields null; abs_dermal/ba_oral inert HH defaults.',
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
      'Tox Review; alt ~6.16 disclosed). Eco FCV from catalog.',
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
    sources: 'Identity: alpha-Hexachlorocyclohexane (alpha-HCH), CAS 319-84-6. ATSDR (Agency for Toxic Substances and Disease Registry), Toxicological Profile for Hexachlorocyclohexane (HCH), Chapter 4 Chemical and Physical Information, Table 4-1 (Chemical Identity) and Table 4-2 (Physical and Chemical Propert...',
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
    sources: 'Identity: Azinphos-methyl, CAS 86-50-0. PubChem Compound CID 2268 (Azinphos-Methyl), LogP heading via PUG-View REST API: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2268/JSON?heading=LogP -- log Kow = 2.75, sourced from Hansch, C., Leo, A., Hoekman, D. Exploring QSAR - Hydrophobi...',
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
    sources: 'Identity: Biphenyl, CAS 92-52-4. PubChem CID 7095 (Biphenyl), Computed/Experimental Properties and LogP section, citing Hansch C., Leo A., Hoekman D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, ACS, p.97 (via HSDB); log Kow = 4.01. Identity (CAS 92-52-4, IUPAC 1,1\'-biph...',
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
    sources: 'Identity: Bromoform, CAS 75-25-2. PubChem CID 5558 (Bromoform), LogP heading, citing HSDB (Chemicals Inspection and Testing Institute, CSCL Japan 1992) log Kow = 2.40 and ILO-WHO ICSC 0108 = 2.38: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/5558/JSON?heading=LogP . Identity/CAS c...',
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
    sources: 'Identity: 4-Bromophenyl phenyl ether, CAS 101-55-3. PubChem CID 7565 (4-Bromodiphenyl Ether; 1-bromo-4-phenoxybenzene; CAS 101-55-3): https://pubchem.ncbi.nlm.nih.gov/compound/7565 -- computed XLogP3 = 4.4, MolecularFormula C12H9BrO, SMILES C1=CC=C(C=C1)OC2=CC=C(C=C2)Br. US EPA CompTox Chemicals ...',
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
    sources: 'Identity: Butyl benzyl phthalate (BBP), CAS 85-68-7. PubChem CID 2347 (Butyl benzyl phthalate), https://pubchem.ncbi.nlm.nih.gov/compound/2347 -- CAS 85-68-7; molecular formula C19H20O4. Log Kow = 4.73 from Ellington JJ, Floyd TL, Octanol/water partition coefficients for eight phthalate esters, E...',
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
    sources: 'Identity: Carbaryl, CAS 63-25-2. PubChem CID 6129 (Carbaryl), LogP heading via PUG-View REST API (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/6129/JSON?heading=LogP), citing Hansch, Leo & Hoekman, Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical S...',
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
    sources: 'Identity: Carbon tetrachloride, CAS 56-23-5. CAS, identity, and structure: PubChem CID 5566 (Carbon Tetrachloride), IUPAC name tetrachloromethane, https://pubchem.ncbi.nlm.nih.gov/compound/Carbon-Tetrachloride. log Kow = 2.64 (EPA 1984): ATSDR Toxicological Profile for Carbon Tetrachloride, Poten...',
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
    sources: 'Identity: Chlorpyrifos, CAS 2921-88-2. PubChem CID 2730 (Chlorpyrifos), LogP heading via PUG-View REST, citing HSDB / Sangster LOGKOW Database (log Kow = 4.96); EPA CompTox Chemicals Dashboard DTXSID4020458; CAS 2921-88-2. Corroborating: ILO-WHO International Chemical Safety Cards and HMDB (log K...',
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
    sources: 'Identity: Demeton (technical, O+S isomer mixture), CAS 8065-48-3. PPDB: Pesticide Properties DataBase, AERU, University of Hertfordshire -- Demeton (Ref: ENT 17295), CAS 8065-48-3: https://sitem.herts.ac.uk/aeru/ppdb/en/Reports/1537.htm (Log P 3.21 at pH 7, 20 C, quality V3; Pow 1.62 x 10^3 calcu...',
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
    sources: 'Identity: Diazinon, CAS 333-41-5. PubChem Compound CID 3017 (Diazinon), US NIH National Library of Medicine. LogP heading: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/3017/JSON?heading=LogP -- log Kow = 3.81 (Hansch C., Leo A., Hoekman D., Exploring QSAR, ACS 1995, p.106; peer re...',
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
    sources: 'Identity: Dibutyl phthalate (DBP), CAS 84-74-2. PubChem Compound Summary for CID 3026, Dibutyl Phthalate, U.S. National Library of Medicine / National Center for Biotechnology Information (https://pubchem.ncbi.nlm.nih.gov/compound/3026). CAS Registry Number 84-74-2. Log Kow = 4.50 from PubChem Oc...',
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
    sources: 'Identity: 1,2-Dichlorobenzene (o-dichlorobenzene), CAS 95-50-1. PubChem CID 7239 (https://pubchem.ncbi.nlm.nih.gov/compound/7239) experimental LogP heading, citing Hansch, C., Leo, A., Hoekman, D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, ACS, p. 17 (log Kow = 3.43, p...',
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
    sources: 'Identity: 1,3-Dichlorobenzene, CAS 541-73-1. CAS and identity: Wikipedia, 1,3-Dichlorobenzene (https://en.wikipedia.org/wiki/1,3-Dichlorobenzene); PubChem CID 10943 (https://pubchem.ncbi.nlm.nih.gov/compound/10943). LogP: PubChem PUG-View LogP heading for CID 10943 (https://pubchem.ncbi.nlm.nih.g...',
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
    sources: 'Identity: 1,4-Dichlorobenzene, CAS 106-46-7. PubChem CID 4685 (1,4-Dichlorobenzene), Compound Summary and LogP record, https://pubchem.ncbi.nlm.nih.gov/compound/4685 ; PubChem PUG-View LogP heading, https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/4685/JSON?heading=LogP (experimental ...',
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
    sources: 'Identity: Diethyl phthalate (DEP), CAS 84-66-2. PubChem CID 6781 (LogP record: Hansch, Leo & Hoekman 1995 via HSDB; ILO-WHO ICSC Card 0258), https://pubchem.ncbi.nlm.nih.gov/compound/6781 ; PubChem REST identity (IUPAC name diethyl benzene-1,2-dicarboxylate, CAS 84-66-2); US EPA EPI Suite KOWWIN ...',
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
    sources: 'Identity: Endosulfan (technical, mixed isomers), CAS 115-29-7. PubChem CID 3224 (Endosulfan), Experimental Properties - LogP, citing Hazardous Substances Data Bank (HSDB) and Hansch, C., Leo, A., Hoekman, D., Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Societ...',
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
    sources: 'Identity: alpha-Endosulfan, CAS 959-98-8. CAS and identity confirmed via PubChem (alpha-Endosulfan, CID 12309460, C9H6Cl6O3S; https://pubchem.ncbi.nlm.nih.gov/compound/alpha-Endosulfan), NIST Chemistry WebBook (ID C959988; https://webbook.nist.gov/cgi/cbook.cgi?ID=C959988), LGC Standards and Sigm...',
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
    sources: 'Identity: beta-Endosulfan, CAS 33213-65-9. ATSDR (2015), Toxicological Profile for Endosulfan, Chapter 4 Chemical and Physical Information, Table 4-3 (Chemical Identity of beta-Endosulfan, CAS 33213-65-9) and Table 4-7 (Physical and Chemical Properties of beta-Endosulfan: Log Kow 3.62, citing HSD...',
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
    sources: 'Identity: Heptachlor, CAS 76-44-8. PubChem Compound Summary, Heptachlor, CID 3589 (https://pubchem.ncbi.nlm.nih.gov/compound/Heptachlor) for CAS 76-44-8, IUPAC name, and log Kow = 6.10 (HSDB; Simpson CD et al., Bull Environ Contam Toxicol 55:149-53, 1995); secondary ICSC 0743 range 5.27/5.44. CAS...',
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
    sources: 'Identity: Heptachlor epoxide, CAS 1024-57-3. ATSDR (2022) Toxicological Profile for Heptachlor and Heptachlor Epoxide, NCBI Bookshelf NBK598049 (Environmental Fate sec. 6.3.1), citing Mackay 1982: log Kow = 5.40. Identity/CAS confirmed via PubChem (CID 15559699, Heptachlor epoxide, C10H5Cl7O; htt...',
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
    sources: 'Identity: Lindane (gamma-hexachlorocyclohexane), CAS 58-89-9. CAS and identity: ATSDR/U.S. EPA ToxFAQs factsheet \'Hexachlorocyclohexane, gamma\' (CAS 58-89-9; lindane), https://archive.epa.gov/epawaste/hazard/wastemin/web/pdf/hexagama.pdf ; PubChem CID 727 \'Lindane\', https://pubchem.ncbi.nlm.nih.g...',
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
    sources: 'Identity: Hexachloroethane, CAS 67-72-1. PubChem CID 6214 (LogP heading, REST pug_view) citing Hansch, Leo & Hoekman, Exploring QSAR (ACS 1995) via HSDB: log Kow = 4.14; PubChem REST property API for IUPAC name/SMILES/formula (1,1,1,2,2,2-hexachloroethane, C2Cl6); ATSDR Toxicological Profile for ...',
    notes: 'Eco selectability. logKow 4.14 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'malathion',
    displayName: 'Malathion',
    contaminantClass: 'organic',
    logKow: 2.75,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Malathion, CAS 121-75-5. NPIC (National Pesticide Information Center, Oregon State University / US EPA), Malathion Technical Fact Sheet, http://npic.orst.edu/factsheets/archive/malatech.html (CAS 121-75-5; log Kow 2.75, range 2.36-2.89). CAS corroborated by PubChem CID 4004 (https://pub...',
    notes: 'Eco selectability. logKow 2.75 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'methoxychlor',
    displayName: 'Methoxychlor',
    contaminantClass: 'organic-halogenated',
    logKow: 5.08,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Methoxychlor, CAS 72-43-5. PubChem CID 4115 (Methoxychlor), LogP heading via PUG-View: https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/4115/JSON?heading=LogP (experimental log Kow 5.08, source HSDB / Hansch, Leo & Hoekman 1995; ILO-WHO ICSC 4.68/5.08). PubChem identity/CAS:...',
    notes: 'Eco selectability. logKow 5.08 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'mirex',
    displayName: 'Mirex',
    contaminantClass: 'organic-halogenated',
    logKow: 5.28,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Mirex, CAS 2385-85-5. PubChem CID 16945 (Mirex), LogP heading via PUG-View REST (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/16945/JSON?heading=LogP), citing HSDB / Veith GD et al., J. Fish. Res. Bd. Can. 36(9):1040-1048 (1979). CAS 2385-85-5 corroborated by PubChem com...',
    notes: 'Eco selectability. logKow 5.28 (eco-direct EqP input). logKow 5.28 = ATSDR (Niimi 1991); PubChem/HSDB lists 6.89 (Veith 1979) -- large spread (~40x), flagged for review. HH fields null; abs_dermal/ba_oral inert defaults.',
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
    sources: 'Identity: Nonylphenol, CAS 84852-15-3. PubChem CID 67296 (Nonylphenol mixture), LogP record sourced from Hazardous Substances Data Bank (HSDB, Ref No. 22) citing Hansch, C., Leo, A., Hoekman, D. (1995) Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, American Chemical Society, p. 1...',
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
    sources: 'Identity: Parathion, CAS 56-38-2. PubChem CID 991 (Parathion), https://pubchem.ncbi.nlm.nih.gov/compound/991 -- LogP heading via PubChem REST PUG-View. Primary log Kow source: Hansch C, Leo A, Hoekman D, Exploring QSAR - Hydrophobic, Electronic, and Steric Constants, ACS (1995), p. 76 (cited by H...',
    notes: 'Eco selectability. logKow 3.83 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'pentachlorobenzene_1_2_3_4_5',
    displayName: 'Pentachlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: 5.18,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Pentachlorobenzene, CAS 608-93-5. CAS and identity: PubChem Compound CID 11855 (Pentachlorobenzene), CAS 608-93-5, https://pubchem.ncbi.nlm.nih.gov/compound/608-93-5 . log Kow = 5.18: PubChem PUG-View LogP heading for CID 11855 (Hazardous Substances Data Bank, citing Hansch C., Leo A., ...',
    notes: 'Eco selectability. logKow 5.18 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'tetrachloroethane_1_1_2_2',
    displayName: '1,1,2,2-Tetrachloroethane',
    contaminantClass: 'organic-halogenated',
    logKow: 2.39,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: 1,1,2,2-Tetrachloroethane, CAS 79-34-5. PubChem Compound CID 6591 (1,1,2,2-tetrachloroethane), LogP heading, experimental log Kow = 2.39 citing Hansch, Leo & Hoekman (1995), Exploring QSAR, ACS, p. 4; corroborated by ILO-WHO ICSC. Identity (CAS 79-34-5, SMILES, IUPAC name) verified via ...',
    notes: 'Eco selectability. logKow 2.39 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
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
    sources: 'Identity: Thallium, CAS 7440-28-0. Identity and CAS: American Elements, "Thallium Metal | High Purity 99%-99.9999% | CAS 7440-28-0" (https://www.americanelements.com/thallium-metal-7440-28-0), confirming elemental thallium Tl, atomic number 81, atomic weight 204.38, CAS 7440-28-0. PubChem CID 535...',
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
    sources: 'Identity: Toxaphene, CAS 8001-35-2. PubChem CID 5284469 (Toxaphene), LogP heading via PUG-View REST (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/5284469/JSON?heading=LogP), citing Hazardous Substances Data Bank (HSDB) and Fisk AT et al., Chemosphere 39:2549-2562 (1999), median lo...',
    notes: 'Eco selectability. logKow 5.9 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'trichlorobenzene_1_2_4',
    displayName: '1,2,4-Trichlorobenzene',
    contaminantClass: 'organic-halogenated',
    logKow: 4.02,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: 1,2,4-Trichlorobenzene, CAS 120-82-1. PubChem CID 13 (1,2,4-Trichlorobenzene, CAS 120-82-1), LogP heading via PUG-View REST API (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/13/JSON?heading=LogP), citing HSDB / Hansch, Leo & Hoekman, Exploring QSAR (ACS, 1995) for log Ko...',
    notes: 'Eco selectability. logKow 4.02 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
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
    sources: 'Identity: 1,1,1-Trichloroethane, CAS 71-55-6. PubChem CID 6278 (1,1,1-Trichloroethane), pug_view CAS and LogP headings, https://pubchem.ncbi.nlm.nih.gov/compound/6278 ; LogP source: Hansch C, Leo A, Hoekman D. Exploring QSAR - Hydrophobic, Electronic, and Steric Constants. Washington, DC: America...',
    notes: 'Eco selectability. logKow 2.49 (eco-direct EqP input). HH fields null; abs_dermal/ba_oral inert defaults.',
  },
  {
    key: 'uranium',
    displayName: 'Uranium',
    contaminantClass: 'metalloid',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources: 'Identity: Uranium, CAS 7440-61-1. PubChem Compound Summary for CID 23989, Uranium, U.S. National Library of Medicine (https://pubchem.ncbi.nlm.nih.gov/compound/23989; PUG-REST property query confirming molecular formula U and IUPAC name \'uranium\'). U.S. EPA Integrated Risk Information System (IRI...',
    notes: 'Eco selectability. logKow n/a (metal). Classed metalloid (not divalent-metal): uranyl, not a true M2+; avoids the divalent-metals AVS/SEM path. HH fields null; abs_dermal/ba_oral inert defaults.',
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
    sources: 'Identity: Vanadium, CAS 7440-62-2. PubChem Compound CID 23990 (Vanadium, V), https://pubchem.ncbi.nlm.nih.gov/compound/23990 (record title \'Vanadium | V\'). CAS 7440-62-2 corroborated by Sigma-Aldrich product 262935/774065 (https://www.sigmaaldrich.com/US/en/product/aldrich/262935), Spectrum Chemi...',
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
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.1,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Xylenes. Eco-direct FCV basis = m-xylene (CAS 108-38-3, PubChem ' +
      'CID 7929); eco-food TRV = total xylenes group (CAS 1330-20-7). logKow 2.75 ' +
      'is the EPA ESB-internal value for m-xylene (EPA/600/R-02/016 Table 3-1), ' +
      'chosen for EqP consistency with the ESB SCV that seeds the eco-direct FCV ' +
      '(owner-attested 2026-06-19); the modern Hansch/PubChem m-xylene value is ' +
      '3.20. Eco FCV/TRV seeded from the eco catalog.',
    notes:
      'Eco-direct + eco-food selectability. logKow 2.75 is load-bearing for ' +
      'eco-direct EqP and is deliberately the EPA ESB-internal m-xylene Kow (not ' +
      'the Hansch 3.20) so the sediment screen reproduces the EPA ESB EqP ' +
      'derivation (the pyrene-note ESB-consistency principle). HH fields null; ' +
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
      'Eco-direct FCV 0.014 ug/L from EPA NRWQC. Eco-direct only -- no eco-food ' +
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
    abs_dermal: 0.1,
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
      'chromium_hexavalent. HH fields null; abs_dermal/ba_oral inert.',
  },
  {
    key: 'mercury_inorganic',
    displayName: 'Mercury, inorganic',
    contaminantClass: 'divalent-metal',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: null,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'Identity: Mercury, inorganic (divalent Hg(II)), CAS 7439-97-6, PubChem CID ' +
      '23931 (the elemental-mercury record matching CAS 7439-97-6, the ATSDR/EPA ' +
      'regulatory CASRN for inorganic mercury). logKow n/a (inorganic metal ion). ' +
      'Eco-food TRV seeded from the eco catalog (FCSAP ERA Module 7).',
    notes:
      'Eco-food selectability (inorganic Hg(II) only). logKow null: Kow not ' +
      'applicable to ionic metals. contaminantClass divalent-metal (Hg2+ is a ' +
      'divalent cation); distinct from the methyl-Hg class used by the ' +
      'methylmercury entry -- inorganic Hg and MeHg differ in trophic transfer. ' +
      'HH fields null; abs_dermal/ba_oral inert.',
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
      'experimental 1.97). Eco-direct FCV 1.8 ug/L from CCME (interim CWQG ' +
      'freshwater aquatic-life guideline, 1992) seeded from the eco catalog -- ' +
      'NOT EPA NRWQC (EPA has no chloroform aquatic-life CCC).',
    notes:
      'Eco-direct selectability. logKow 1.97 is load-bearing for eco-direct EqP. ' +
      'FCV 1.8 ug/L = CCME interim CWQG (LOEC 18 ug/L spring-peeper teratogenesis ' +
      'x 0.1 safety factor; CCME 1992). Attribute to CCME only. HH fields null; ' +
      'abs_dermal/ba_oral inert HH defaults (organic-halogenated class).',
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
      'Human-health pathways only; seeded build-first from the needs_review row ' +
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
      'Human-health pathways only; seeded build-first from the needs_review row ' +
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
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'BC Protocol 28 (Jan 2021) + US EPA IRIS oral RfD 0.3 mg/kg-bw/day (CAS 108-95-2).',
    notes:
      'Human-health pathways only; seeded build-first from the needs_review row ' +
      'pv-p28-phenol-hh-direct-rfd / pv-iris-phenol-... (value 0.3, agree). logKow not ' +
      'in catalog -> eco-direct EqP unavailable; no eco value -> Eco-Food filtered. ' +
      'abs_dermal/ba_oral are organic class defaults pending HITL.',
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
      'not in catalog -> eco pathways filtered. abs_dermal/ba_oral are organic class ' +
      'defaults pending HITL.',
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
      'not in catalog -> eco pathways filtered. abs_dermal/ba_oral are organic class ' +
      'defaults pending HITL.',
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
      'pv-p28-hexachlorobenzene-hh-direct-rfd (0.0008, agree). Both rows remain ' +
      'needs_review in the catalog. logKow/eco not in catalog -> eco filtered. ' +
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
      'pv-iris-pentachlorophenol-hh-direct-rfd (0.005). Both rows remain needs_review ' +
      'in the catalog. logKow/eco not in catalog -> eco filtered. abs_dermal/ba_oral ' +
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
      'US EPA IRIS oral slope factor 0.1 per mg/kg-bw/day (carcinogen) + non-cancer ' +
      'oral RfD 0.03 mg/kg-bw/day (CAS 123-91-1).',
    notes:
      'Human-health pathways only; both endpoints seeded build-first so the calculator ' +
      'can select the more conservative of cancer (SF) vs non-cancer (RfD). SF from ' +
      'pv-iris-1_4_dioxane-hh-direct-sf (0.1); RfD from pv-iris-1_4_dioxane-hh-direct-rfd ' +
      '(0.03). Both rows remain needs_review in the catalog. 1,4-dioxane is a cyclic ' +
      'ether (organic, not halogenated). logKow/eco not in catalog -> eco filtered. ' +
      'abs_dermal/ba_oral are organic class defaults pending HITL.',
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
      '-food-rfd (3.0e-5). Both rows remain needs_review. logKow not in catalog -> ' +
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
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
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
      'Human-health pathways only; SF seeded build-first from the needs_review row ' +
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
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
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
      'US EPA IRIS oral slope factor 9.5 x 10-4 (0.00095) per mg/kg-bw/day ' +
      '(carcinogen) + non-cancer oral RfD 2 x 10-1 mg/kg-bw/day (CAS 78-59-1).',
    notes:
      'Human-health pathways only; both endpoints seeded build-first so the calculator ' +
      'can select the more conservative of cancer (SF) vs non-cancer (RfD). SF from ' +
      'pv-iris-isophorone-hh-direct-sf / -food-sf (9.5e-4); RfD from ' +
      'pv-iris-isophorone-hh-direct-rfd / -food-rfd (0.2). Both rows remain needs_review. ' +
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
      'abs_dermal/ba_oral are organic class defaults pending HITL.',
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
      'pathways filtered. abs_dermal/ba_oral are organic class defaults pending HITL.',
  },
  {
    key: 'bisphenol_a',
    displayName: 'Bisphenol A',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.05,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 5 x 10-2 mg/kg-bw/day (CAS 80-05-7).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-iris-bisphenol_a-hh-direct-rfd / -food-rfd (value 0.05). logKow not in catalog ' +
      '-> eco pathways filtered. abs_dermal/ba_oral are organic class defaults pending HITL.',
  },
  {
    key: 'nitrobenzene',
    displayName: 'Nitrobenzene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 2.0e-3,
    sf_oral_per_mg_per_kg_bw_per_day: null,
    bsaf_loc_freshwater: null,
    abs_dermal: 0.03,
    ba_oral: 1.0,
    fcv_ug_per_L: null,
    trv_eco_mg_per_kg_bw_day: null,
    sources:
      'US EPA IRIS oral RfD 2 x 10-3 mg/kg-bw/day (CAS 98-95-3).',
    notes:
      'Human-health pathways only; RfD seeded build-first from the needs_review row ' +
      'pv-iris-nitrobenzene-hh-direct-rfd / -food-rfd (value 0.002; an inhalation RfC + ' +
      'IUR also exist but are not sediment-pathway inputs). logKow not in catalog -> eco ' +
      'pathways filtered. abs_dermal/ba_oral are organic class defaults pending HITL.',
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
      '-> eco pathways filtered. abs_dermal/ba_oral are organic class defaults pending HITL.',
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
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
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
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
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
      'US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF (abs_dermal 0.03)',
    notes:
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
      'logKow/eco fields null -> Eco pathways filtered. abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE).',
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
      'HH-only build-first wiring; oral RfD/SF candidates approved in References & Values. ' +
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
    key: '2_4_dinitrotoluene',
    displayName: '2,4-Dinitrotoluene',
    contaminantClass: 'organic',
    logKow: null,
    rfd_oral_mg_per_kg_bw_per_day: 0.002,
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
] as const satisfies readonly SubstanceEntry[];

export type SubstanceKey = (typeof SUBSTANCE_LIBRARY)[number]['key'];

export function findSubstance(key: string): SubstanceEntry | undefined {
  return SUBSTANCE_LIBRARY.find((s) => s.key === key);
}
