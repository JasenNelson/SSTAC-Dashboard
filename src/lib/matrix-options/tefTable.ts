// tefTable.ts
// Toxic Equivalency Factor (TEF) reference tables for the 29 dioxin-like congeners
// (7 PCDD + 10 PCDF + 4 non-ortho PCB + 8 mono-ortho PCB), keyed by TEF EDITION.
//
// Editions (a framework selects one via resolveTefEdition in cumulative.ts):
//   who-2005            -- WHO 2005 mammalian (Van den Berg et al. 2006). Statutory standard for
//                          most frameworks (BC/EPA/Ontario human-health). qa: needs_review (no
//                          primary-source verification artifact yet; framework-A2 follow-up).
//   who-1998-mammal     -- WHO 1998 mammalian (van den Berg et al. 1998). qa: needs_review.
//   who-1998-avian      -- WHO 1998 avian. Required by CCME/FCSAP eco (bird receptor). needs_review.
//   who-1998-fish       -- WHO 1998 fish. Required by CCME/FCSAP eco (fish receptor). needs_review.
//   who-2022-devito-2024-- WHO 2022 / DeVito et al. 2024. Used by HC TRV v4.0 (2025) human-health.
//                          qa: VERIFIED -- transcribed + confirmed cell-by-cell against the HC v4.0
//                          PDF Table 4 (pp. 54-55) via
//                          scripts/matrix-options/hc_trv_v4_table4_devito_tef_extract.py ->
//                          data/hc_trv_v4_table4_devito_tef_extracted.json (2026-07-06).
//
// CENSORED VALUES: SPEC Section 2 lists some WHO-1998 avian/fish cells as "less-than" bounds
// (e.g. "<0.001"). A censored cell is stored as { factor: x, bound: 'upper' } so a downstream
// reducer treats the resulting TEQ as a CONSERVATIVE UPPER estimate rather than an exact value.
// Exact cells are { factor: x, bound: 'exact' }.
//
// TEF/RPF rows are toxicity-WEIGHTING modifiers, not selectable TRVs (see provenance/pathways.ts
// hh-toxicity-weighting). This table is a standalone reference dataset; it is NOT wired into the
// ProvenancePathway union or equation dispatch.
//
// Sources: SPEC docs/MATRIX_OPTIONS_CUMULATIVE_EFFECTS_IMPLEMENTATION_SPEC_2026_07_06.md Section 2
// (WHO-2005 / WHO-1998 columns) + HC TRV v4.0 Table 4 (DeVito-2024 column). Plain ASCII only.

export const TEF_EDITIONS = [
  'who-2005',
  'who-1998-mammal',
  'who-1998-avian',
  'who-1998-fish',
  'who-2022-devito-2024',
] as const;

export type TefEdition = (typeof TEF_EDITIONS)[number];

export type FactorBound = 'exact' | 'upper';

export type TefQa = 'verified' | 'needs_review';

export type CongenerSection =
  | 'pcdd'
  | 'pcdf'
  | 'pcb-non-ortho'
  | 'pcb-mono-ortho';

export interface TefCell {
  factor: number;
  // 'upper' means the source reported a censored "<x" bound; the TEF is at most `factor`.
  bound: FactorBound;
}

export interface TefRow {
  congenerId: string;
  name: string;
  cas: string;
  section: CongenerSection;
  tef: Record<TefEdition, TefCell>;
}

// Per-edition QA trust level + provenance. Only the HC DeVito-2024 column is primary-source
// verified this session; the WHO columns stay needs_review pending a primary WHO verification
// artifact (framework-A2 follow-up). Usable build-first, honestly flagged.
export const TEF_EDITION_QA: Record<TefEdition, TefQa> = {
  'who-2005': 'needs_review',
  'who-1998-mammal': 'needs_review',
  'who-1998-avian': 'needs_review',
  'who-1998-fish': 'needs_review',
  'who-2022-devito-2024': 'verified',
};

export const TEF_EDITION_SOURCE: Record<TefEdition, string> = {
  'who-2005': 'WHO 2005 (Van den Berg et al. 2006)',
  'who-1998-mammal': 'WHO/IPCS 1998 (mammalian)',
  'who-1998-avian': 'WHO/IPCS 1998 (avian)',
  'who-1998-fish': 'WHO/IPCS 1998 (fish)',
  'who-2022-devito-2024': 'HC TRV v4.0 (2025) Table 4 (DeVito et al. 2024 / WHO 2022)',
};

// Compact source rows. Column order: who-2005, who-1998-mammal, who-1998-avian, who-1998-fish,
// who-2022-devito-2024. A value is either a number (exact) or a "<x" string (censored upper bound).
// One row per congener; eyeball against SPEC Section 2 (WHO columns) + the DeVito JSON (last column).
type RawCell = number | string;
interface RawRow {
  id: string;
  name: string;
  cas: string;
  section: CongenerSection;
  cells: [RawCell, RawCell, RawCell, RawCell, RawCell]; // in TEF_EDITIONS order
}

const RAW_ROWS: readonly RawRow[] = [
  // --- PCDDs (7) ---
  { id: '2378-tcdd', name: '2,3,7,8-TCDD', cas: '1746-01-6', section: 'pcdd', cells: [1.0, 1.0, 1.0, 1.0, 1.0] },
  { id: '12378-pecdd', name: '1,2,3,7,8-PeCDD', cas: '40321-76-4', section: 'pcdd', cells: [1.0, 1.0, 1.0, 1.0, 0.4] },
  { id: '123478-hxcdd', name: '1,2,3,4,7,8-HxCDD', cas: '39227-28-6', section: 'pcdd', cells: [0.1, 0.1, 0.05, 0.5, 0.09] },
  { id: '123678-hxcdd', name: '1,2,3,6,7,8-HxCDD', cas: '57653-85-7', section: 'pcdd', cells: [0.1, 0.1, 0.01, 0.01, 0.07] },
  { id: '123789-hxcdd', name: '1,2,3,7,8,9-HxCDD', cas: '19408-74-3', section: 'pcdd', cells: [0.1, 0.1, 0.1, 0.01, 0.05] },
  { id: '1234678-hpcdd', name: '1,2,3,4,6,7,8-HpCDD', cas: '35822-46-9', section: 'pcdd', cells: [0.01, 0.01, '<0.001', 0.001, 0.05] },
  { id: 'ocdd', name: 'OCDD', cas: '3268-87-9', section: 'pcdd', cells: [0.0003, 0.0001, '<0.0001', '<0.0001', 0.001] },
  // --- PCDFs (10) ---
  { id: '2378-tcdf', name: '2,3,7,8-TCDF', cas: '51207-31-9', section: 'pcdf', cells: [0.1, 0.1, 1.0, 0.05, 0.07] },
  { id: '12378-pecdf', name: '1,2,3,7,8-PeCDF', cas: '57117-41-6', section: 'pcdf', cells: [0.03, 0.05, 0.1, 0.05, 0.01] },
  { id: '23478-pecdf', name: '2,3,4,7,8-PeCDF', cas: '57117-31-4', section: 'pcdf', cells: [0.3, 0.5, 1.0, 0.5, 0.1] },
  { id: '123478-hxcdf', name: '1,2,3,4,7,8-HxCDF', cas: '70648-26-9', section: 'pcdf', cells: [0.1, 0.1, 0.1, 0.1, 0.3] },
  { id: '123678-hxcdf', name: '1,2,3,6,7,8-HxCDF', cas: '57117-44-9', section: 'pcdf', cells: [0.1, 0.1, 0.1, 0.1, 0.09] },
  { id: '123789-hxcdf', name: '1,2,3,7,8,9-HxCDF', cas: '72918-21-9', section: 'pcdf', cells: [0.1, 0.1, 0.1, 0.1, 0.2] },
  { id: '234678-hxcdf', name: '2,3,4,6,7,8-HxCDF', cas: '60851-34-5', section: 'pcdf', cells: [0.1, 0.1, 0.1, 0.1, 0.1] },
  { id: '1234678-hpcdf', name: '1,2,3,4,6,7,8-HpCDF', cas: '67562-39-4', section: 'pcdf', cells: [0.01, 0.01, 0.01, 0.01, 0.02] },
  { id: '1234789-hpcdf', name: '1,2,3,4,7,8,9-HpCDF', cas: '55673-89-7', section: 'pcdf', cells: [0.01, 0.01, 0.01, 0.01, 0.1] },
  { id: 'ocdf', name: 'OCDF', cas: '39001-02-0', section: 'pcdf', cells: [0.0003, 0.0001, '<0.0001', '<0.0001', 0.002] },
  // --- non-ortho PCBs (4) ---
  { id: 'pcb-77', name: 'PCB 77', cas: '32598-13-3', section: 'pcb-non-ortho', cells: [0.0001, 0.0001, 0.05, 0.0001, 0.0003] },
  { id: 'pcb-81', name: 'PCB 81', cas: '70362-50-4', section: 'pcb-non-ortho', cells: [0.0003, 0.0001, 0.1, 0.0005, 0.006] },
  { id: 'pcb-126', name: 'PCB 126', cas: '57465-28-8', section: 'pcb-non-ortho', cells: [0.1, 0.1, 0.1, 0.005, 0.05] },
  { id: 'pcb-169', name: 'PCB 169', cas: '32774-16-6', section: 'pcb-non-ortho', cells: [0.03, 0.01, 0.001, 0.00005, 0.005] },
  // --- mono-ortho PCBs (8) ---
  { id: 'pcb-105', name: 'PCB 105', cas: '32598-14-4', section: 'pcb-mono-ortho', cells: [0.00003, 0.0001, 0.0001, '<0.000005', 0.00003] },
  { id: 'pcb-114', name: 'PCB 114', cas: '74472-37-0', section: 'pcb-mono-ortho', cells: [0.00003, 0.0005, 0.0001, '<0.000005', 0.00003] },
  { id: 'pcb-118', name: 'PCB 118', cas: '31508-00-6', section: 'pcb-mono-ortho', cells: [0.00003, 0.0001, 0.00001, '<0.000005', 0.00003] },
  { id: 'pcb-123', name: 'PCB 123', cas: '65510-44-3', section: 'pcb-mono-ortho', cells: [0.00003, 0.0001, 0.00001, '<0.000005', 0.00003] },
  { id: 'pcb-156', name: 'PCB 156', cas: '38380-08-4', section: 'pcb-mono-ortho', cells: [0.00003, 0.0005, 0.0001, '<0.000005', 0.00003] },
  { id: 'pcb-157', name: 'PCB 157', cas: '69782-90-7', section: 'pcb-mono-ortho', cells: [0.00003, 0.0005, 0.0001, '<0.000005', 0.00003] },
  { id: 'pcb-167', name: 'PCB 167', cas: '52663-72-6', section: 'pcb-mono-ortho', cells: [0.00003, 0.00001, 0.00001, '<0.000005', 0.00003] },
  { id: 'pcb-189', name: 'PCB 189', cas: '39635-31-9', section: 'pcb-mono-ortho', cells: [0.00003, 0.0001, 0.00001, '<0.000005', 0.00003] },
];

function toCell(raw: RawCell): TefCell {
  if (typeof raw === 'number') {
    return { factor: raw, bound: 'exact' };
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) {
    return { factor: Number(trimmed.slice(1)), bound: 'upper' };
  }
  return { factor: Number(trimmed), bound: 'exact' };
}

function buildRow(raw: RawRow): TefRow {
  const tef = {} as Record<TefEdition, TefCell>;
  TEF_EDITIONS.forEach((edition, i) => {
    tef[edition] = toCell(raw.cells[i]);
  });
  return {
    congenerId: raw.id,
    name: raw.name,
    cas: raw.cas,
    section: raw.section,
    tef,
  };
}

export const TEF_TABLE: readonly TefRow[] = RAW_ROWS.map(buildRow);

const TEF_BY_ID: ReadonlyMap<string, TefRow> = new Map(
  TEF_TABLE.map((r) => [r.congenerId, r]),
);

export interface TefLookup {
  factor: number | null;
  bound: FactorBound | null;
  qa: TefQa | null;
  warning: string | null;
}

/**
 * Look up a congener's TEF for a given edition. Never throws and never silently returns 0:
 * an unknown congener id or an unknown edition yields { factor: null, ... } + a warning so the
 * caller (reducer) can surface it rather than dropping the component. A censored source value is
 * returned as bound = 'upper' so the caller can flag the TEQ as a conservative upper estimate.
 */
export function lookupTef(congenerId: string, edition: TefEdition): TefLookup {
  const row = TEF_BY_ID.get(congenerId);
  if (!row) {
    return {
      factor: null,
      bound: null,
      qa: null,
      warning: `Unknown congener id "${congenerId}"; no TEF applied.`,
    };
  }
  const cell = row.tef[edition];
  if (!cell) {
    return {
      factor: null,
      bound: null,
      qa: null,
      warning: `Unknown TEF edition "${edition}" for congener "${congenerId}".`,
    };
  }
  return {
    factor: cell.factor,
    bound: cell.bound,
    qa: TEF_EDITION_QA[edition],
    warning:
      cell.bound === 'upper'
        ? `Congener "${congenerId}" TEF is a censored upper bound (<${cell.factor}) under ${edition}; contribution is an upper estimate.`
        : null,
  };
}
