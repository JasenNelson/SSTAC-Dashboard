// pathways.ts
// Canonical pathway vocabularies + runtime guards for the Matrix-Options catalog.
// Plain ASCII only.
//
// Two distinct concepts share the "pathway" field name but are NOT the same thing:
//
//   ProvenancePathway       -- the 5 CALCULATOR derivation pathways. These drive
//                              equation dispatch (equationDispatch.ts), frame
//                              applicability (regulatoryFrames.ts), and the
//                              default-selection policy (defaultSelectionPolicy.ts).
//                              Only these may be assigned to a calculator default.
//
//   CatalogEvidencePathway  -- the 6 CATALOG evidence categories emitted by the
//                              canonical extraction registry. They classify multi-source
//                              evidence rows (toxicity reference values, TEF/RPF
//                              weighting modifiers, exposure parameters, eco-soil TRVs,
//                              Eco-SSL screening levels, reference/background
//                              concentrations). They have NO equation, NO frame
//                              applicability, and NEVER drive a calculator default.
//
//   CatalogPathway          -- the union. This is the type of a catalog record's
//                              `pathway` field, because a record may carry either a
//                              calculator pathway or an evidence category.
//
// The split keeps the calculator type surface (equation generics, applicability Records,
// default-selection policy, pathway pickers) narrow to the 5, while catalog rendering and
// filtering surfaces accept all of them. Guard with isProvenancePathway() before passing a
// catalog record's pathway into any calculator-only API.

export const PROVENANCE_PATHWAYS = [
  'eco-direct-eqp',
  'eco-food-bsaf',
  'background-adjustment',
  'human-health-direct',
  'human-health-food',
] as const;

export type ProvenancePathway = (typeof PROVENANCE_PATHWAYS)[number];

export const CATALOG_EVIDENCE_PATHWAYS = [
  'hh-toxicity-value',
  'hh-toxicity-weighting',
  'hh-exposure-parameter',
  'eco-soil',
  'eco-soil-screening',
  'reference-background',
] as const;

export type CatalogEvidencePathway = (typeof CATALOG_EVIDENCE_PATHWAYS)[number];

export type CatalogPathway = ProvenancePathway | CatalogEvidencePathway;

export const CATALOG_PATHWAYS = [
  ...PROVENANCE_PATHWAYS,
  ...CATALOG_EVIDENCE_PATHWAYS,
] as const;

const PROVENANCE_PATHWAY_SET: ReadonlySet<string> = new Set(PROVENANCE_PATHWAYS);
const CATALOG_EVIDENCE_PATHWAY_SET: ReadonlySet<string> = new Set(
  CATALOG_EVIDENCE_PATHWAYS,
);

/**
 * Runtime guard: is this value one of the 5 calculator derivation pathways?
 * Use this before passing a catalog record's `pathway` into any calculator-only API
 * (getEquation, getPathwayApplicability, buildDefaultSelectionPolicyDecision,
 * promotedCandidatesStore.updatePathway) so an evidence category cannot leak in.
 */
export function isProvenancePathway(value: unknown): value is ProvenancePathway {
  return typeof value === 'string' && PROVENANCE_PATHWAY_SET.has(value);
}

/** Runtime guard: is this value one of the 6 catalog evidence categories? */
export function isCatalogEvidencePathway(
  value: unknown,
): value is CatalogEvidencePathway {
  return typeof value === 'string' && CATALOG_EVIDENCE_PATHWAY_SET.has(value);
}

/** Runtime guard: is this value any known catalog pathway (calculator or evidence)? */
export function isCatalogPathway(value: unknown): value is CatalogPathway {
  return isProvenancePathway(value) || isCatalogEvidencePathway(value);
}

// ---------------------------------------------------------------------------
// Value role (R4): selectable value vs toxicity-weighting modifier.
//
// TEF/RPF rows live on the hh-toxicity-weighting pathway. They are NOT selectable as a
// toxicity reference value -- they MODIFY one (e.g. a PAH potency relative to benzo[a]pyrene).
// Surfacing this distinction stops a reviewer from mistaking a weighting factor for a TRV.
//
// The role is DERIVED from the pathway (no separate data field). A substance that is BOTH a
// selectable TRV and a weighting modifier (e.g. fluoranthene) is represented by having one
// record on hh-toxicity-value AND one on hh-toxicity-weighting -- each record carries a single
// role. (If a stored, per-record role is ever needed, replace this derivation; see the R4
// owner-decision brief.)
// ---------------------------------------------------------------------------

export type CatalogValueRole = 'toxicity-weighting-modifier' | 'selectable-value';

export function catalogValueRole(pathway: CatalogPathway): CatalogValueRole {
  return pathway === 'hh-toxicity-weighting'
    ? 'toxicity-weighting-modifier'
    : 'selectable-value';
}
