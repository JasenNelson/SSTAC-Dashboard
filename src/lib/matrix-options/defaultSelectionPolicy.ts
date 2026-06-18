import {
  PARAMETER_VALUE_RECORDS,
  getSourceRecord,
} from './provenance/catalog';
import type {
  CalculatorSourceRole,
  CanonicalSourceStatus,
  ParameterValueRecord,
  ProvenancePathway,
  SourceRecord,
} from './provenance/types';
import {
  getPathwayApplicability,
  getRegulatoryFrame,
  type CatalogJurisdiction,
  type RegulatoryFrameId,
} from './regulatoryFrames';
import {
  assessSlotUnitConsistency,
  type SlotUnitConsistency,
} from './unitNormalization';

export type DefaultSelectionCandidateDisposition =
  | 'active_current_default'
  | 'eligible_pending_approval'
  | 'blocked_frame_jurisdiction'
  | 'blocked_policy_compilation'
  | 'blocked_reference_mining'
  | 'blocked_needs_direct_source'
  | 'blocked_needs_qa'
  | 'blocked_current_scaffold'
  | 'blocked_not_default'
  | 'blocked_range_or_formula'
  | 'blocked_pathway_unsupported';

export type DefaultSelectionDecisionStatus =
  | 'candidate_pending_approval'
  | 'manual_decision_required'
  | 'keep_current_default_no_eligible_candidate'
  | 'pathway_unsupported';

export interface DefaultSelectionPolicyRequest {
  frameId: RegulatoryFrameId;
  pathway: ProvenancePathway;
  substanceKey: string;
  inputKey: string;
}

export interface DefaultSelectionCandidate {
  record: ParameterValueRecord;
  sources: SourceRecord[];
  sourceRoles: string[];
  hierarchyRank: number | null;
  disposition: DefaultSelectionCandidateDisposition;
  canBecomeDefaultWithApproval: boolean;
  rationale: string;
}

export interface DefaultSelectionPolicyDecision {
  request: DefaultSelectionPolicyRequest;
  status: DefaultSelectionDecisionStatus;
  activeCurrentDefault: DefaultSelectionCandidate | null;
  recommendedCandidate: DefaultSelectionCandidate | null;
  eligibleCandidates: DefaultSelectionCandidate[];
  blockedCandidates: DefaultSelectionCandidate[];
  candidates: DefaultSelectionCandidate[];
  // A1 unit guard: whether the eligible candidates in this slot are numerically
  // comparable (all units recognized + share one base). When comparable=false and
  // more than one eligible candidate exists, the recommendation is withheld
  // (status forced to manual_decision_required) so no pick is emitted across
  // incommensurate units (e.g. mg/m3 vs ug/m3, or reciprocal IUR bases).
  unitConsistency: SlotUnitConsistency;
  readOnlyInvariants: {
    mutatesCatalog: false;
    promotesDefault: false;
    promotesQa: false;
  };
  rationale: string;
}

const SOURCE_PRIORITY_BY_FRAME: Record<
  RegulatoryFrameId,
  readonly CatalogJurisdiction[]
> = {
  'bc-protocol1-v5-dra': [
    'BC',
    'Canada_federal',
    'US_federal',
    'general',
  ],
  'bc-csr-sediment-numerical': ['BC', 'general'],
  'canada-fcsap-aquatic': ['Canada_federal', 'general'],
  'ccme-sediment-quality': ['Canada_federal', 'general'],
  'us-epa-usace-sediment': ['US_federal', 'general'],
  'site-specific': ['BC', 'Canada_federal', 'US_federal', 'general'],
};

export const DEFAULT_SELECTION_READ_ONLY_INVARIANTS = {
  mutatesCatalog: false,
  promotesDefault: false,
  promotesQa: false,
} as const;

function sourceRole(source: SourceRecord): CalculatorSourceRole {
  return source.calculator_source_role ?? 'canonical_candidate';
}

function sourcesForRecord(record: ParameterValueRecord): SourceRecord[] {
  return record.source_ids
    .map((sourceId) => getSourceRecord(sourceId))
    .filter((source): source is SourceRecord => source !== undefined);
}

function sourceRolesForRecord(
  record: ParameterValueRecord,
  sources: SourceRecord[],
): string[] {
  return Array.from(
    new Set([
      ...sources.map(sourceRole),
      ...(record.source_relationships?.map((relationship) => relationship.role) ??
        []),
    ]),
  ).sort((a, b) => a.localeCompare(b));
}

function hierarchyRank(
  frameId: RegulatoryFrameId,
  record: ParameterValueRecord,
): number | null {
  const priorities = SOURCE_PRIORITY_BY_FRAME[frameId];
  const index = priorities.indexOf(record.jurisdiction as CatalogJurisdiction);
  return index === -1 ? null : index;
}

function isJurisdictionEligible(
  frameId: RegulatoryFrameId,
  record: ParameterValueRecord,
): boolean {
  return getRegulatoryFrame(frameId).eligibleCatalogJurisdictions.includes(
    record.jurisdiction as CatalogJurisdiction,
  );
}

function isDirectCurrentSource(source: SourceRecord): boolean {
  return (
    source.file_storage !== 'repo_metadata_only' &&
    sourceRole(source) === 'canonical_candidate' &&
    source.currentness_status === 'current' &&
    source.canonical_source_status === 'direct_source_verified'
  );
}

function hasDirectSourceVerifiedStatus(record: ParameterValueRecord): boolean {
  return record.canonical_source_status === 'direct_source_verified';
}

function blocksForCanonicalStatus(status: CanonicalSourceStatus | undefined) {
  return (
    status === 'needs_direct_source_check' ||
    status === 'needs_exact_source_locator'
  );
}

function classifyCandidate(
  request: DefaultSelectionPolicyRequest,
  record: ParameterValueRecord,
): DefaultSelectionCandidate {
  const sources = sourcesForRecord(record);
  const sourceRoles = sourceRolesForRecord(record, sources);
  const rank = hierarchyRank(request.frameId, record);
  const pathwayApplicability = getPathwayApplicability(
    request.frameId,
    request.pathway,
  );

  let disposition: DefaultSelectionCandidateDisposition;
  let rationale: string;

  if (pathwayApplicability.status === 'unsupported') {
    disposition = 'blocked_pathway_unsupported';
    rationale = 'The selected regulatory frame marks this pathway unsupported.';
  } else if (record.default_status === 'current_default') {
    disposition = 'active_current_default';
    rationale =
      'This is the currently wired calculator value; policy review does not promote or demote it.';
  } else if (sourceRoles.includes('policy_compilation')) {
    disposition = 'blocked_policy_compilation';
    rationale =
      'Policy compilations such as Protocol 28 are source-mining aids, not calculation-driving sources.';
  } else if (sourceRoles.includes('reference_mining')) {
    disposition = 'blocked_reference_mining';
    rationale =
      'Reference-mining records must be replaced by original source records before default review.';
  } else if (!isJurisdictionEligible(request.frameId, record)) {
    disposition = 'blocked_frame_jurisdiction';
    rationale =
      'The selected regulatory frame does not include this catalog jurisdiction.';
  } else if (record.default_status === 'not_default') {
    disposition = 'blocked_not_default';
    rationale =
      'This record is cataloged for review but is not a default candidate.';
  } else if (record.value_type !== 'single_value') {
    disposition = 'blocked_range_or_formula';
    rationale =
      'Ranges and formula defaults require a separate scalar-value decision before default review.';
  } else if (
    record.evidence_support_status === 'current_calculator_scaffold'
  ) {
    disposition = 'blocked_current_scaffold';
    rationale =
      'Current calculator scaffolds document existing behavior but are not approved source evidence.';
  } else if (
    record.evidence_support_status !== 'approved_source_backed' ||
    blocksForCanonicalStatus(record.canonical_source_status)
  ) {
    disposition = 'blocked_needs_direct_source';
    rationale =
      'The original source, exact locator, currentness, and applicability checks are not complete.';
  } else if (
    record.qa_status !== 'approved' ||
    !hasDirectSourceVerifiedStatus(record) ||
    !sources.some(isDirectCurrentSource)
  ) {
    disposition = 'blocked_needs_qa';
    rationale =
      'Direct-source evidence must be QA-approved and current before default review.';
  } else {
    disposition = 'eligible_pending_approval';
    rationale =
      'Direct-source evidence is approved for review, but activating it as a default still requires owner or delegated approval.';
  }

  return {
    record,
    sources,
    sourceRoles,
    hierarchyRank: rank,
    disposition,
    canBecomeDefaultWithApproval: disposition === 'eligible_pending_approval',
    rationale,
  };
}

/**
 * Per-record default-candidate eligibility for the frame-default SEED layer
 * (frameDefaults.ts). Reuses the canonical classifyCandidate gate so the seed path
 * cannot drift from the default-selection policy: it applies the SAME blocks
 * (jurisdiction, policy-compilation / reference-mining source roles, not_default,
 * non-single_value, current-calculator scaffold, non-source-backed / unverified
 * canonical, missing QA / direct-current source). A record is seed-eligible only at
 * disposition 'eligible_pending_approval' (fully source-backed, source-verified,
 * QA-approved, scalar, non-excluded, jurisdiction-eligible). The owner's act of
 * authoring the FRAME_DEFAULT_PROFILES row is the activation step. Read-only.
 */
export function getFrameSeedCandidateEligibility(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  record: ParameterValueRecord,
): {
  eligible: boolean;
  disposition: DefaultSelectionCandidateDisposition;
  rationale: string;
} {
  const candidate = classifyCandidate(
    {
      frameId,
      pathway,
      substanceKey: record.substance_key,
      inputKey: record.input_key,
    },
    record,
  );
  return {
    eligible: candidate.canBecomeDefaultWithApproval,
    disposition: candidate.disposition,
    rationale: candidate.rationale,
  };
}

/**
 * Provisional-seed eligibility for the ECO pathways (Path B; eco seed resolver in ecoSeed.ts).
 * Eco fcv/trv rows are needs_review candidates that are deliberately seeded BEFORE source
 * verification (build-first; owner directive 2026-06-17, badged "provisional" in the UI). This
 * reuses classifyCandidate so it enforces EVERY STRUCTURAL exclusion (pathway unsupported,
 * policy-compilation / reference-mining source roles, frame jurisdiction, not_default,
 * non-single_value, current-calculator scaffold) but BYPASSES ONLY the qa-approval +
 * direct-source-verification checks: a record blocked solely for 'needs_direct_source' or
 * 'needs_qa' (i.e. it cleared every structural gate, only verification is outstanding) is
 * provisional-eligible. A fully approved+verified record (eligible_pending_approval) is also
 * eligible. Read-only; never promotes, never mutates qa_status.
 */
export function getEcoProvisionalEligibility(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
  record: ParameterValueRecord,
): {
  eligible: boolean;
  disposition: DefaultSelectionCandidateDisposition;
  rationale: string;
} {
  const candidate = classifyCandidate(
    {
      frameId,
      pathway,
      substanceKey: record.substance_key,
      inputKey: record.input_key,
    },
    record,
  );
  const structurallyClear =
    candidate.disposition === 'eligible_pending_approval' ||
    candidate.disposition === 'blocked_needs_direct_source' ||
    candidate.disposition === 'blocked_needs_qa';
  // Structural clearance is necessary but NOT sufficient: classifyCandidate collapses several
  // distinct states into blocked_needs_direct_source / blocked_needs_qa. Admit ONLY rows whose value
  // is a real extracted source value that is merely pending verification/approval. Exclude:
  //  - superseded qa rows (the value was REPLACED -- must never seed, even provisionally);
  //  - non-source-backed evidence states (reference_mining_lead, user_entered_or_derived, and the
  //    current_calculator_scaffold which is also structurally blocked) -- those are not "pending QA".
  // (codex 5.5-xhigh P1: the disposition whitelist alone was too broad.)
  const qaAdmissible =
    record.qa_status === 'needs_review' || record.qa_status === 'approved';
  const evidenceAdmissible =
    record.evidence_support_status === 'pending_source_locator' ||
    record.evidence_support_status === 'approved_source_backed';
  const eligible = structurallyClear && qaAdmissible && evidenceAdmissible;
  return {
    eligible,
    disposition: candidate.disposition,
    rationale: candidate.rationale,
  };
}

/**
 * Frame jurisdiction rank for a record (lower = higher priority) per SOURCE_PRIORITY_BY_FRAME;
 * null when the record's jurisdiction is not eligible for the frame. Exported so the eco seed
 * resolver ranks candidates the same way the default-selection policy does.
 */
export function getFrameJurisdictionRank(
  frameId: RegulatoryFrameId,
  record: ParameterValueRecord,
): number | null {
  return hierarchyRank(frameId, record);
}

function compareCandidates(
  left: DefaultSelectionCandidate,
  right: DefaultSelectionCandidate,
): number {
  const leftActive = left.disposition === 'active_current_default' ? 0 : 1;
  const rightActive = right.disposition === 'active_current_default' ? 0 : 1;
  if (leftActive !== rightActive) return leftActive - rightActive;

  const leftEligible = left.canBecomeDefaultWithApproval ? 0 : 1;
  const rightEligible = right.canBecomeDefaultWithApproval ? 0 : 1;
  if (leftEligible !== rightEligible) return leftEligible - rightEligible;

  const rankDelta =
    (left.hierarchyRank ?? Number.MAX_SAFE_INTEGER) -
    (right.hierarchyRank ?? Number.MAX_SAFE_INTEGER);
  if (rankDelta !== 0) return rankDelta;

  return left.record.parameter_value_id.localeCompare(
    right.record.parameter_value_id,
  );
}

function decisionRationale(
  status: DefaultSelectionDecisionStatus,
  recommendedCandidate: DefaultSelectionCandidate | null,
): string {
  if (status === 'pathway_unsupported') {
    return 'The selected regulatory frame marks this pathway unsupported, so no default candidate is selected.';
  }
  if (status === 'candidate_pending_approval' && recommendedCandidate) {
    return `${recommendedCandidate.record.parameter_value_id} is the highest-ranked approved direct-source candidate, but it remains read-only until approved as a default.`;
  }
  if (status === 'manual_decision_required') {
    return 'Multiple top-ranked approved direct-source candidates exist; a reviewer must choose the applicable value before any default promotion.';
  }
  return 'No approved direct-source candidate is eligible for this frame and slot; keep the current calculator behavior.';
}

/**
 * A1 fail-closed predicate: withhold the auto-recommendation when a recommendation
 * would otherwise be emitted, more than one eligible candidate competes, and the slot's
 * units are not provably comparable. A single eligible candidate (nothing to compare) and
 * comparable multi-unit slots are never blocked.
 */
export function isUnitBlocked(
  hasRecommendation: boolean,
  eligibleCount: number,
  unitsComparable: boolean,
): boolean {
  return hasRecommendation && eligibleCount >= 2 && !unitsComparable;
}

export function buildDefaultSelectionPolicyDecision(
  request: DefaultSelectionPolicyRequest,
): DefaultSelectionPolicyDecision {
  const pathwayApplicability = getPathwayApplicability(
    request.frameId,
    request.pathway,
  );
  const candidates = PARAMETER_VALUE_RECORDS.filter(
    (record) =>
      record.substance_key === request.substanceKey &&
      record.pathway === request.pathway &&
      record.input_key === request.inputKey,
  )
    .map((record) => classifyCandidate(request, record))
    .sort(compareCandidates);

  const activeCurrentDefault =
    candidates.find(
      (candidate) => candidate.disposition === 'active_current_default',
    ) ?? null;
  const eligibleCandidates = candidates.filter(
    (candidate) => candidate.canBecomeDefaultWithApproval,
  );
  const blockedCandidates = candidates.filter(
    (candidate) => !candidate.canBecomeDefaultWithApproval,
  );
  const topRank = Math.min(
    ...eligibleCandidates.map(
      (candidate) => candidate.hierarchyRank ?? Number.MAX_SAFE_INTEGER,
    ),
  );
  const topEligibleCandidates = eligibleCandidates.filter(
    (candidate) =>
      (candidate.hierarchyRank ?? Number.MAX_SAFE_INTEGER) === topRank,
  );
  const unitConsistency = assessSlotUnitConsistency(
    eligibleCandidates.map((candidate) => ({
      value: candidate.record.value,
      unit: candidate.record.unit,
      input_key: candidate.record.input_key,
    })),
  );

  const initialRecommended =
    topEligibleCandidates.length === 1 ? topEligibleCandidates[0] : null;
  // A1 fail-closed guard: when more than one eligible candidate competes but their
  // units are not provably comparable (unrecognized unit, or mixed base such as
  // mg/m3 vs a reciprocal IUR), withhold the auto-recommendation so no pick is
  // emitted across incommensurate units. A single eligible candidate has nothing to
  // compare and is unaffected; comparable multi-unit slots (e.g. mg/m3 + ug/m3 that
  // normalize to one base) are unaffected.
  const unitBlocked = isUnitBlocked(
    initialRecommended !== null,
    eligibleCandidates.length,
    unitConsistency.comparable,
  );
  const recommendedCandidate = unitBlocked ? null : initialRecommended;

  const status: DefaultSelectionDecisionStatus =
    pathwayApplicability.status === 'unsupported'
      ? 'pathway_unsupported'
      : recommendedCandidate
        ? 'candidate_pending_approval'
        : topEligibleCandidates.length > 1 || unitBlocked
          ? 'manual_decision_required'
          : 'keep_current_default_no_eligible_candidate';

  return {
    request,
    status,
    activeCurrentDefault,
    recommendedCandidate,
    eligibleCandidates,
    blockedCandidates,
    candidates,
    unitConsistency,
    readOnlyInvariants: DEFAULT_SELECTION_READ_ONLY_INVARIANTS,
    rationale: unitBlocked
      ? `Eligible candidates for this slot use units that are not provably comparable (${unitConsistency.units.join(', ')}); a reviewer must reconcile units before any default is recommended. (A1 unit guard)`
      : decisionRationale(status, recommendedCandidate),
  };
}
