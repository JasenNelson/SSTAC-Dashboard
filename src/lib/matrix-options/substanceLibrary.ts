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
      'candidates are available in References & Values.',
  },
  {
    key: 'trichloroethylene',
    displayName: 'Trichloroethylene',
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
    logKow: null,
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
] as const satisfies readonly SubstanceEntry[];

export type SubstanceKey = (typeof SUBSTANCE_LIBRARY)[number]['key'];

export function findSubstance(key: string): SubstanceEntry | undefined {
  return SUBSTANCE_LIBRARY.find((s) => s.key === key);
}
