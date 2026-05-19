// Shared types for the matrix-options calculator vertical slice (v1).
// See .tmp_calculator_design_v1.md section 6 ("Pure-TS function signatures").
// Plain ASCII only.

export type ContaminantClass =
  | 'organic'
  | 'organic-PAH'
  | 'organic-halogenated'
  | 'divalent-metal'
  | 'methyl-Hg'
  | 'metalloid';

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
  readonly sources: string;
  readonly notes?: string;
}
