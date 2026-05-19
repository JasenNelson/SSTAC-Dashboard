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
    sources:
      'US EPA IRIS B[a]P (2017 reassessment); ERDC BSAF DB; ' +
      'Indigenous-Consumption-Pacific-NW Section 4.3',
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
    // placeholder. HITL overrides per congener mixture.
    fcv_ug_per_L: 0.014,
    sources: 'US EPA IRIS Aroclor 1254; BSAF-Translation Section 4',
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
    sources:
      'Health Canada HHRA 2023; Indigenous-Consumption-Pacific-NW ' +
      'Section 5; BSAF-Translation Section 7',
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
    sources:
      'Health Canada HHRA 2023; ANZG; Bioavailability TOC-AVS Section 5',
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
    sources: 'US EPA IRIS Cu; ANZG',
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
    sources: 'US EPA IRIS Cd',
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
    sources: 'US EPA IRIS Zn',
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
    sources: 'US EPA IRIS iAs; ANZG; ACFN-WQCIU',
    notes:
      'AVS/SEM framework does NOT apply to arsenic (not a divalent ' +
      'transition metal in the Cd-Cu-Pb-Ni-Zn family). Use bulk-sediment ' +
      'path with bioaccessibility correction.',
  },
] as const satisfies readonly SubstanceEntry[];

export type SubstanceKey = (typeof SUBSTANCE_LIBRARY)[number]['key'];

export function findSubstance(key: string): SubstanceEntry | undefined {
  return SUBSTANCE_LIBRARY.find((s) => s.key === key);
}
