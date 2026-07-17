// Shared types for the matrix-options calculator vertical slice (v1).
// See .tmp_calculator_design_v1.md section 6 ("Pure-TS function signatures").
// Plain ASCII only.

export type ContaminantClass =
  | 'organic'
  | 'organic-PAH'
  | 'organic-halogenated'
  | 'divalent-metal'
  | 'methyl-Hg'
  | 'metalloid'
  | 'inorganic';

export type Ecosystem = 'freshwater' | 'estuarine' | 'coastal-marine';

export type Pathway = 'tier0' | 'eco-direct' | 'eco-food' | 'hh-direct' | 'hh-food';

// ---------------------------------------------------------------------------
// Tier 0 UTL pre-screen
// ---------------------------------------------------------------------------

export interface Utl9595Result {
  mean: number;
  sd: number;
  n: number;
  K: number;
  utl: number;
  // Non-fatal advisories from lookupK9595 (e.g., n outside tabulated range
  // and K was clamped). Empty array when the K factor came from a tabulated
  // row or a between-row linear interpolation. Callers MUST surface these
  // to qualify the verdict as screening-only when non-empty.
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Eco-Direct EqP (non-ionic organics path)
// ---------------------------------------------------------------------------

export interface EcoDirectEqPInput {
  Cs_mg_per_kg: number;
  foc: number;
  logKow: number;
  fcv_ug_per_L: number;
  // Optional escape hatch for woodwaste / black-carbon sites with bulk TOC
  // measurements > 0.30. Without this flag the calculator rejects TOC > 0.30
  // per design doc section 8.6.
  acknowledgeBlackCarbon?: boolean;
}

export interface EcoDirectEqPResult {
  // Intermediate quantities so the UI can display the chain of reasoning.
  logKoc: number;
  Koc_L_per_kg_OC: number;
  ESBoc_mg_per_kg_OC: number;
  // Final sediment standard, bulk-sediment basis. May be a finite diagnostic
  // value even when blocked === true; do NOT quote it as a regulatory
  // benchmark in the blocked case.
  sedS: number;
  // Verdict: PASS if Cs_mg_per_kg <= sedS, FAIL otherwise. Null when Cs is
  // not supplied (benchmark-only mode) OR when blocked === true.
  verdict: 'PASS' | 'FAIL' | null;
  warnings: string[];
  // True when an input violated a hard validity constraint from the design
  // doc (foc outside the EqP validity window 0.002-0.10, OR negative
  // Cs_mg_per_kg). When true, the verdict is suppressed and the UI must
  // present the sedS value (if any) as diagnostic-only. Codex P2 finding
  // 2026-05-18: input validation must be enforced, not just warned about.
  blocked: boolean;
}

// ---------------------------------------------------------------------------
// Eco-Direct AVS / SEM divalent-metals path
// ---------------------------------------------------------------------------

export interface AvsSemInput {
  semSum_umol_per_g: number;
  avs_umol_per_g: number;
}

export interface AvsSemResult {
  deltaSEMminusAVS: number;
  nonToxic: boolean;
}

// ---------------------------------------------------------------------------
// Eco-Food BSAF path (slice 2)
// ---------------------------------------------------------------------------

export interface EcoFoodBSAFInput {
  // Wildlife / fish TRV in mg/kg-bw/day. Strictly positive.
  TRV_eco_mg_per_kg_bw_day: number;
  // Receptor body weight in kg. Strictly positive.
  BW_eco_kg: number;
  // Receptor daily ingestion rate in kg-wet-tissue/day. Strictly positive.
  IR_eco_kg_per_day: number;
  // Lipid + OC normalized BSAF from the substance library (freshwater
  // baseline). Strictly positive. For MeHg this is treated as the
  // protein-normalized BSAF and the lipid normalization step is skipped
  // (see design doc section 2.2 "Methylmercury exception").
  BSAF_loc_freshwater: number;
  // Tissue lipid fraction (unitless mass fraction). Typical 0.01 - 0.15.
  // Outside that range emits a screening-only warning.
  fLipid: number;
  // Sediment fraction organic carbon (unitless). EqP validity window
  // 0.002 - 0.10 enforced; outside that window sets blocked = true.
  foc: number;
  // Site-use fraction (unitless). 1.0 for resident species, 0.2 for
  // anadromous salmonids (per design doc section 8.4). Outside [0.05, 1.0]
  // emits a screening-only warning.
  Fsite: number;
  // Ecosystem selector. Drives the M_eco multiplier; only applies > 1 for
  // PAH-class contaminants in coastal-marine systems per design doc 8.2.
  ecosystem: Ecosystem;
  // Contaminant class. Drives:
  //  (a) MeHg protein-normalized BSAF branch, and
  //  (b) coastal-marine M_eco = 15 multiplier eligibility (PAHs only).
  contaminantClass: ContaminantClass;
  // Protein fraction for the MeHg path. Defaults to 0.18 (fish muscle)
  // when omitted on a MeHg substance. Ignored on non-MeHg substances.
  fProtein?: number;
  // Black-carbon override flag mirroring the EcoDirect EqP pattern. When
  // omitted and foc > 0.30 the function throws. With the flag set the
  // function still computes but emits warnings + blocked = true.
  acknowledgeBlackCarbon?: boolean;
}

export interface EcoFoodBSAFResult {
  // Ecosystem multiplier actually applied (1, 5, or 15 -- see design doc
  // section 2.2 / 8.2). Surfaced so the UI can show the chain of reasoning.
  M_eco: number;
  // Effective BSAF after lipid/OC normalization (or pass-through for MeHg)
  // and the ecosystem multiplier. Dimensionless.
  BSAF_effective: number;
  // Final sediment standard for the Eco-Food pathway, mg/kg dry. Always
  // computed for diagnostic display; suppress quoting it as a regulatory
  // benchmark when blocked === true.
  sedS: number;
  warnings: string[];
  // True when an input violated a hard validity constraint from the design
  // doc (foc outside the EqP validity window 0.002-0.10 OR foc > 0.30 with
  // the black-carbon override). Verdict / output quoting MUST be suppressed
  // by the caller in this case; the numeric value is diagnostic-only.
  blocked: boolean;
}

// ---------------------------------------------------------------------------
// Human Health Direct Contact path
// ---------------------------------------------------------------------------

// Row #23 (top-50): 'dl-pcb-teq' added as a third possible governing driver. The dl-PCB
// TEQ oral TDI is a non-cancer-shaped endpoint (same math as the mass-based non-cancer RfD,
// different TRV) that is MIN-selected alongside 'non-cancer' and 'cancer' -- never summed
// with them (see pickHumanHealthEndpoint3Way in derivations.ts). Backward-compatible: when
// no dl-PCB TEQ candidate is supplied, driver is still only 'non-cancer' | 'cancer'.
export type HumanHealthRiskDriver = 'non-cancer' | 'cancer' | 'dl-pcb-teq';

export interface HumanHealthDirectContactInput {
  rfd_oral_mg_per_kg_bw_day: number | null;
  sf_oral_per_mg_per_kg_bw_per_day: number | null;
  // Optional dioxin-like-PCB TEQ oral TDI candidate (mg TEQ/kg-bw/day; see dlPcbTeqTdi.ts).
  // When supplied (non-null), it is added as a THIRD candidate to the MIN-selection
  // alongside rfd_oral_mg_per_kg_bw_day and sf_oral_per_mg_per_kg_bw_per_day -- never
  // summed with either. Null/omitted for every substance except total PCBs. Optional so
  // every pre-existing caller (every non-PCB substance) is byte-for-byte unaffected.
  dlPcbTeq_mg_per_kg_bw_day?: number | null;
  targetRisk: number;
  hazardQuotient: number;
  BW_kg: number;
  ED_years: number;
  EF_days_per_year: number;
  AT_cancer_years: number;
  IR_sed_mg_per_day: number;
  SA_cm2: number;
  AF_sed_mg_per_cm2: number;
  abs_dermal: number;
  ba_oral: number;
}

export interface HumanHealthDirectContactResult {
  sedS: number;
  driver: HumanHealthRiskDriver;
  nonCancerSedS: number | null;
  cancerSedS: number | null;
  // Sediment standard implied by the dl-PCB TEQ candidate alone (same non-cancer-shaped
  // math as nonCancerSedS, different TRV). Null when dlPcbTeq_mg_per_kg_bw_day was not
  // supplied/null. MIN-selected against nonCancerSedS/cancerSedS, never summed with them.
  dlPcbTeqSedS: number | null;
  contactRate_mg_per_day: number;
  ingestionRateAdjusted_mg_per_day: number;
  dermalRateAdjusted_mg_per_day: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Human Health Food Web path
// ---------------------------------------------------------------------------

export interface HumanHealthFoodWebInput {
  rfd_oral_mg_per_kg_bw_day: number | null;
  sf_oral_per_mg_per_kg_bw_per_day: number | null;
  targetRisk: number;
  hazardQuotient: number;
  BW_kg: number;
  IR_food_kg_per_day: number;
  ba_oral: number;
  BSAF_loc_freshwater: number;
  fLipid: number;
  foc: number;
  ecosystem: Ecosystem;
  contaminantClass: ContaminantClass;
  fProtein?: number;
}

export interface HumanHealthFoodWebResult {
  sedS: number;
  driver: HumanHealthRiskDriver;
  nonCancerTissue_mg_per_kg: number | null;
  cancerTissue_mg_per_kg: number | null;
  tissueTarget_mg_per_kg: number;
  M_eco: number;
  BSAF_effective: number;
  warnings: string[];
  blocked: boolean;
}

// ---------------------------------------------------------------------------
// Substance library entry shape
// ---------------------------------------------------------------------------

export interface SubstanceEntry {
  readonly key: string;
  readonly displayName: string;
  readonly contaminantClass: ContaminantClass;
  readonly logKow: number | null;
  readonly rfd_oral_mg_per_kg_bw_per_day: number | null;
  readonly sf_oral_per_mg_per_kg_bw_per_day: number | null;
  readonly bsaf_loc_freshwater: number | null;
  readonly abs_dermal: number;
  readonly ba_oral: number;
  // Default FCV / water-only chronic value for the EqP path. ug/L. Null when
  // the substance is metals / not partitioning. HITL may override.
  readonly fcv_ug_per_L: number | null;
  // Wildlife / fish TRV for the Eco-Food BSAF path. mg/kg-bw/day. Null
  // when no defensible eco-TRV is available (HITL must supply one before
  // running the Eco-Food pathway).
  readonly trv_eco_mg_per_kg_bw_day: number | null;
  // Inhalation Reference Concentration (non-cancer). mg/m3.
  readonly rfc_inhalation_mg_per_m3: number | null;
  // Inhalation Unit Risk (cancer). (mg/m3)^-1.
  readonly iur_inhalation_per_mg_per_m3: number | null;
  readonly sources: string;
  readonly notes?: string;
}
