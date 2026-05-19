// Jurisdiction / regulatory-frame options for the matrix-options calculator
// shared global inputs. v1 carries a small starter set; future slices will
// wire jurisdiction-aware derivation logic (e.g., FCV / TRV selection by
// frame, applicability filters) onto these identifiers.
//
// Plan v3 section 4.3: default jurisdiction = 'bc-csr'.
//
// Plain ASCII only.

export type Jurisdiction = 'bc-csr' | 'federal-ccme' | 'site-specific';

// Tuple with literal types preserved -- same pattern as
// ALL_MATRIX_CATEGORIES_TUPLE, motivated by the same cursor-agent review
// finding. The exhaustiveness guards below depend on the literal tuple,
// not the widened ReadonlyArray export.
const ALL_JURISDICTIONS_TUPLE = [
  'bc-csr',
  'federal-ccme',
  'site-specific',
] as const satisfies readonly Jurisdiction[];

export const ALL_JURISDICTIONS: ReadonlyArray<Jurisdiction> =
  ALL_JURISDICTIONS_TUPLE;

export const DEFAULT_JURISDICTION: Jurisdiction = 'bc-csr';

export interface JurisdictionOption {
  id: Jurisdiction;
  label: string;
  description: string;
}

// Same tuple-with-literals pattern as ALL_JURISDICTIONS_TUPLE so the
// per-id exhaustiveness guard below catches a missing JurisdictionOption
// row (not just a missing string in the union). codex review on Commit 2
// (2026-05-19) caught that the prior `ReadonlyArray<JurisdictionOption>`
// export widened the inferred id type back to Jurisdiction, making the
// OptionsCoverAllJurisdictions check a tautology.
const JURISDICTION_OPTIONS_TUPLE = [
  {
    id: 'bc-csr',
    label: 'BC CSR (Contaminated Sites Regulation)',
    description:
      'BC Contaminated Sites Regulation; default matrix standards and ' +
      'screening levels.',
  },
  {
    id: 'federal-ccme',
    label: 'Federal CCME',
    description:
      'Canadian Council of Ministers of the Environment sediment quality ' +
      'guidelines (ISQG / PEL).',
  },
  {
    id: 'site-specific',
    label: 'Site-specific (HITL judgment)',
    description:
      'Site-specific derivation with HITL professional judgment overriding ' +
      'jurisdictional defaults; document rationale on the audit trail.',
  },
] as const satisfies readonly JurisdictionOption[];

export const JURISDICTION_OPTIONS: ReadonlyArray<JurisdictionOption> =
  JURISDICTION_OPTIONS_TUPLE;

export function isJurisdiction(value: unknown): value is Jurisdiction {
  return (
    typeof value === 'string' &&
    (ALL_JURISDICTIONS as readonly string[]).includes(value)
  );
}

// Compile-time exhaustiveness guards (cursor-agent review 2026-05-19 P2
// pattern fix): if a future Jurisdiction is added to the union and either
// the tuple or JURISDICTION_OPTIONS list is not updated to match, the
// Exclude<> resolves to the missing member(s) (not `never`), and the
// `true` assignment fails to compile.
type AllJurisdictionsExhaustive =
  Exclude<Jurisdiction, (typeof ALL_JURISDICTIONS_TUPLE)[number]> extends never
    ? true
    : false;
const _allJurisdictionsExhaustive: AllJurisdictionsExhaustive = true;
void _allJurisdictionsExhaustive;

type OptionsCoverAllJurisdictions =
  Exclude<Jurisdiction, (typeof JURISDICTION_OPTIONS_TUPLE)[number]['id']> extends never
    ? true
    : false;
const _optionsCoverAll: OptionsCoverAllJurisdictions = true;
void _optionsCoverAll;
