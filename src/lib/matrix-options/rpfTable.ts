// rpfTable.ts
// Relative Potency Factor (RPF) reference tables for carcinogenic PAHs, keyed by SCHEME.
// RPF weights each PAH's carcinogenic potency relative to benzo[a]pyrene (RPF 1.0 = index) so a
// BaP-equivalent concentration can be summed: BaP_eq = sum(C_i * RPF_i). HUMAN-HEALTH-CARCINOGENIC
// ONLY (eco PAH toxicity uses FCSAP LMW/HMW group surrogates, not RPF).
//
// Schemes (a framework selects one via RPF_SCHEME_BY_AUTHORITY in cumulative.ts):
//   nisbet-1992    -- Nisbet & LaGoy (1992) TEFs. qa: verified (A2 checked vs the original;
//                     Regul. Toxicol. Pharmacol. 16:290-300). NOTE benzo[j]fluoranthene 0.1 is a
//                     later compiler assignment (not in Nisbet's original list).
//   hc-pqra-v3     -- Health Canada PQRA v3 (Table 2 "recommended" = CCME-2010 values; Table 3
//                     "provisional"). qa: needs_review (HC PQRA v3 primary Table 2/3 not fully read).
//   epa-2010-draft -- US EPA 2010 draft RPFs (EPA/635/R-08/012A). WHOLE SCHEME is provisional/non-
//                     final: SAB-reviewed 2011, never finalized, formally SUSPENDED 2019. qa:
//                     needs_review. 4 rows were A2-corroborated via a SECONDARY compilation (MN Dept
//                     of Health citing the draft, NOT the primary EPA PDF): benz[a]anthracene 0.2,
//                     chrysene 0.1, cyclopenta[c,d]pyrene 0.4, dibenzo[a,l]pyrene 30. The other 6
//                     (BbF 0.8, BjF 0.3, BkF 0.03, DahA 10, IcdP 0.07, BghiP 0.009) are UNCONFIRMED
//                     (primary-PDF read pending, deid 194584). Do NOT cite as current EPA policy.
//   ccme-2010      -- CCME 2010 Canadian Soil Quality Guidelines carcinogenic-PAH PEFs (8-PAH set,
//                     adapted from WHO/IPCS 1998). qa: verified (A2 checked). HC adopts these as
//                     "recommended".
//   who-1998-pah   -- BC CSR PAH scheme (WHO-1998 lineage; shares CCME-2010 PEF VALUES). qa:
//                     needs_review. *** KNOWN GAP: BC's regulatory scheme is a RESTRICTED 5-PAH
//                     SUBSET, but the exact 5 PAHs are framework-A2 (NOT yet verified). This column
//                     mirrors the CCME carcinogenic-PAH values as a placeholder; using it as-is may
//                     OVER-SUM BC BaP-eq (it does not yet exclude the non-BC-5 PAHs). A3a must treat
//                     who-1998-pah as needs_review + not-yet-scoring until the subset is pinned. ***
//
// A PAH cell is one of: a numeric RPF ('value'); 'excluded' (non-carcinogenic -- deliberately not in
// the scheme's carcinogenic set; contributes 0 with an informational warning); or 'not-defined' (the
// scheme does not list this PAH -- the reducer fails closed with a warning, never assumes 0).
//
// Sources: SPEC docs/MATRIX_OPTIONS_CUMULATIVE_EFFECTS_IMPLEMENTATION_SPEC_2026_07_06.md Section 3
// (nisbet-1992 / hc-pqra-v3 / epa-2010-draft columns) + A2 verification results (corrections +
// ccme-2010). Plain ASCII only.
//
// NOTE: epa-1993 RPFs are NOT a scheme here -- no authority doc supplies epa-1993 RPF numbers (it
// appears only as a BaP slope factor). Add it only when it has verified data.

export const RPF_SCHEMES = [
  'nisbet-1992',
  'hc-pqra-v3',
  'epa-2010-draft',
  'ccme-2010',
  'who-1998-pah',
] as const;

export type RpfScheme = (typeof RPF_SCHEMES)[number];

export type RpfQa = 'verified' | 'needs_review';

export type RpfCellKind = 'value' | 'excluded' | 'not-defined';

export interface RpfCell {
  kind: RpfCellKind;
  // present only when kind === 'value'
  rpf?: number;
}

export interface RpfRow {
  pahKey: string;
  name: string;
  cas: string;
  rpf: Record<RpfScheme, RpfCell>;
}

export const RPF_SCHEME_QA: Record<RpfScheme, RpfQa> = {
  'nisbet-1992': 'verified',
  'hc-pqra-v3': 'needs_review',
  'epa-2010-draft': 'needs_review',
  'ccme-2010': 'verified',
  'who-1998-pah': 'needs_review',
};

export const RPF_SCHEME_SOURCE: Record<RpfScheme, string> = {
  'nisbet-1992': 'Nisbet & LaGoy 1992 (Regul. Toxicol. Pharmacol. 16:290-300)',
  'hc-pqra-v3': 'Health Canada PQRA v3 (Table 2 recommended / Table 3 provisional)',
  'epa-2010-draft': 'US EPA 2010 draft (EPA/635/R-08/012A); SUSPENDED 2019; provisional',
  'ccme-2010': 'CCME 2010 CSQG carcinogenic-PAH PEFs (from WHO/IPCS 1998)',
  'who-1998-pah': 'BC CSR PAH scheme (WHO-1998 lineage); BC 5-PAH subset UNVERIFIED (framework-A2)',
};

// Scheme-level advisories surfaced to the reducer / UI (beyond the per-cell warnings).
export const RPF_SCHEME_NOTES: Partial<Record<RpfScheme, string>> = {
  'epa-2010-draft':
    'EPA 2010 draft is SUSPENDED (2019) and non-final; treat all values as provisional. 6 of 10 ' +
    'carcinogenic-PAH RPFs are unconfirmed pending a primary-PDF read.',
  'who-1998-pah':
    'BC 5-PAH subset membership is UNVERIFIED (framework-A2 pending). Values mirror the CCME-2010 ' +
    'lineage as a placeholder and may OVER-SUM until the non-BC-5 PAHs are excluded. Not for scoring yet.',
};

// Compact source rows. Column order: nisbet-1992, hc-pqra-v3, epa-2010-draft, ccme-2010, who-1998-pah.
// A value is a number (RPF), 'excl' (excluded / non-carcinogenic), or 'nd' (not defined in scheme).
type RawCell = number | 'excl' | 'nd';
interface RawRow {
  key: string;
  name: string;
  cas: string;
  cells: [RawCell, RawCell, RawCell, RawCell, RawCell];
}

const RAW_ROWS: readonly RawRow[] = [
  // Low-MW / non-carcinogenic PAHs: Nisbet assigns a nominal 0.001; the HH schemes EXCLUDE them.
  { key: 'naphthalene', name: 'Naphthalene', cas: '91-20-3', cells: [0.001, 'excl', 'excl', 'excl', 'excl'] },
  { key: 'acenaphthylene', name: 'Acenaphthylene', cas: '208-96-8', cells: [0.001, 'excl', 'excl', 'excl', 'excl'] },
  { key: 'acenaphthene', name: 'Acenaphthene', cas: '83-32-9', cells: [0.001, 'excl', 'excl', 'excl', 'excl'] },
  { key: 'fluorene', name: 'Fluorene', cas: '86-73-7', cells: [0.001, 'excl', 'excl', 'excl', 'excl'] },
  { key: 'phenanthrene', name: 'Phenanthrene', cas: '85-01-8', cells: [0.001, 0.001, 'excl', 'excl', 'excl'] },
  { key: 'anthracene', name: 'Anthracene', cas: '120-12-7', cells: [0.01, 'excl', 'excl', 'excl', 'excl'] }, // A2: nisbet 0.01 (not 0.001)
  { key: 'fluoranthene', name: 'Fluoranthene', cas: '206-44-0', cells: [0.001, 'excl', 'excl', 'excl', 'excl'] },
  { key: 'pyrene', name: 'Pyrene', cas: '129-00-0', cells: [0.001, 'excl', 'excl', 'excl', 'excl'] },
  // Carcinogenic PAHs. who-1998-pah placeholder = CCME lineage (see KNOWN GAP above).
  { key: 'benz_a_anthracene', name: 'Benz[a]anthracene', cas: '56-55-3', cells: [0.1, 0.1, 0.2, 0.1, 0.1] },
  { key: 'chrysene', name: 'Chrysene', cas: '218-01-9', cells: [0.01, 0.01, 0.1, 0.01, 0.01] },
  { key: 'benzo_b_fluoranthene', name: 'Benzo[b]fluoranthene', cas: '205-99-2', cells: [0.1, 0.1, 0.8, 0.1, 0.1] },
  { key: 'benzo_j_fluoranthene', name: 'Benzo[j]fluoranthene', cas: '205-82-3', cells: [0.1, 0.1, 0.3, 0.1, 0.1] }, // nisbet 0.1 compiler-assigned
  { key: 'benzo_k_fluoranthene', name: 'Benzo[k]fluoranthene', cas: '207-08-9', cells: [0.1, 0.1, 0.03, 0.1, 0.1] },
  { key: 'benzo_a_pyrene', name: 'Benzo[a]pyrene', cas: '50-32-8', cells: [1.0, 1.0, 1.0, 1.0, 1.0] }, // index
  { key: 'dibenz_ah_anthracene', name: 'Dibenz[a,h]anthracene', cas: '53-70-3', cells: [5.0, 1.0, 10, 1.0, 1.0] },
  { key: 'indeno_123cd_pyrene', name: 'Indeno[1,2,3-cd]pyrene', cas: '193-39-5', cells: [0.1, 0.1, 0.07, 0.1, 0.1] },
  { key: 'benzo_ghi_perylene', name: 'Benzo[g,h,i]perylene', cas: '191-24-2', cells: [0.01, 0.01, 0.009, 0.01, 0.01] },
  // Dibenzopyrenes: Nisbet + HC provisional + EPA-2010 list them; CCME/BC do not (nd).
  { key: 'dibenzo_ae_pyrene', name: 'Dibenzo[a,e]pyrene', cas: '192-65-4', cells: [1.0, 1.0, 0.4, 'nd', 'nd'] },
  { key: 'dibenzo_ah_pyrene', name: 'Dibenzo[a,h]pyrene', cas: '189-64-0', cells: [10, 10, 0.9, 'nd', 'nd'] },
  { key: 'dibenzo_ai_pyrene', name: 'Dibenzo[a,i]pyrene', cas: '189-55-9', cells: [10, 10, 0.6, 'nd', 'nd'] },
  { key: 'dibenzo_al_pyrene', name: 'Dibenzo[a,l]pyrene', cas: '191-30-0', cells: [10, 10, 30, 'nd', 'nd'] },
  // Scheme-specific singletons.
  { key: '5_methylchrysene', name: '5-Methylchrysene', cas: '3697-24-3', cells: ['nd', 1.0, 'nd', 'nd', 'nd'] },
  { key: 'cyclopenta_cd_pyrene', name: 'Cyclopenta[c,d]pyrene', cas: '27208-37-3', cells: ['nd', 'nd', 0.4, 'nd', 'nd'] },
];

function toCell(raw: RawCell): RpfCell {
  if (raw === 'excl') return { kind: 'excluded' };
  if (raw === 'nd') return { kind: 'not-defined' };
  return { kind: 'value', rpf: raw };
}

function buildRow(raw: RawRow): RpfRow {
  const rpf = {} as Record<RpfScheme, RpfCell>;
  RPF_SCHEMES.forEach((scheme, i) => {
    rpf[scheme] = toCell(raw.cells[i]);
  });
  return { pahKey: raw.key, name: raw.name, cas: raw.cas, rpf };
}

export const RPF_TABLE: readonly RpfRow[] = RAW_ROWS.map(buildRow);

const RPF_BY_KEY: ReadonlyMap<string, RpfRow> = new Map(
  RPF_TABLE.map((r) => [r.pahKey, r]),
);

export interface RpfLookup {
  rpf: number | null;
  kind: RpfCellKind | null;
  qa: RpfQa | null;
  warning: string | null;
}

/**
 * Look up a PAH's RPF for a given scheme. Never throws and never silently returns 0:
 * - unknown PAH key or unknown scheme  -> { rpf: null, kind: null } + warning (fail closed).
 * - kind 'excluded'                    -> { rpf: 0 } + informational warning (deliberately not summed).
 * - kind 'not-defined'                 -> { rpf: null } + warning (scheme does not list it; do not
 *                                         coerce to 0).
 * - kind 'value'                       -> { rpf } + a needs_review warning when the scheme is not
 *                                         verified.
 */
export function lookupRpf(pahKey: string, scheme: RpfScheme): RpfLookup {
  const row = RPF_BY_KEY.get(pahKey);
  if (!row) {
    return { rpf: null, kind: null, qa: null, warning: `Unknown PAH key "${pahKey}"; no RPF applied.` };
  }
  const cell = row.rpf[scheme];
  if (!cell) {
    return { rpf: null, kind: null, qa: null, warning: `Unknown RPF scheme "${scheme}" for PAH "${pahKey}".` };
  }
  const qa = RPF_SCHEME_QA[scheme];
  if (cell.kind === 'excluded') {
    return {
      rpf: 0,
      kind: 'excluded',
      qa,
      warning: `PAH "${pahKey}" is excluded (non-carcinogenic) under ${scheme}; contributes 0.`,
    };
  }
  if (cell.kind === 'not-defined') {
    return {
      rpf: null,
      kind: 'not-defined',
      qa,
      warning: `PAH "${pahKey}" has no RPF defined under ${scheme}; component not scored (fail-closed).`,
    };
  }
  return {
    rpf: cell.rpf ?? null,
    kind: 'value',
    qa,
    warning:
      qa === 'needs_review'
        ? `RPF for "${pahKey}" under ${scheme} is needs_review (provisional).`
        : null,
  };
}
