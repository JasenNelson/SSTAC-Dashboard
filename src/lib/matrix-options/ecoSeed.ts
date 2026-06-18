// Eco-pathway SUBSTANCE-AWARE seed resolver (Path B core). Unlike the human-health frame defaults
// (frameDefaults.ts), which seed GENERIC exposure factors (substance_key='generic'), eco fcv/trv
// values are SUBSTANCE-SPECIFIC, so they cannot route through frameDefaults (resolveSeed rejects any
// non-generic cited record). This module reads the catalog directly for (substance, pathway, input),
// applies the SAME jurisdiction source-priority the default-selection policy uses, a deterministic
// within-jurisdiction source tie-break, and the PROVISIONAL eligibility gate (structural exclusions
// only -- needs_review eco rows are seedable build-first; owner directive 2026-06-17), then returns a
// single seed (or null). It NEVER promotes or mutates the catalog. Plain ASCII only.
import { getParameterValueRecordsForSubstance } from './provenance/catalog';
import { getSourceRecord } from './provenance/catalog';
import type { ParameterValueRecord } from './provenance/types';
import {
  getEcoProvisionalEligibility,
  getFrameJurisdictionRank,
} from './defaultSelectionPolicy';
import {
  getPathwayApplicability,
  type RegulatoryFrameId,
} from './regulatoryFrames';

export type EcoSeedPathway = 'eco-direct-eqp' | 'eco-food-bsaf';
export type EcoReceptor = 'mammal' | 'bird';

export interface EcoSeed {
  value: number;
  unit: string;
  parameterValueId: string;
  label: string;
  sourceShortLabel: string;
  // true while the cited record is not yet QA-approved + direct-source-verified (the build-first
  // needs_review state). The UI shows a "provisional -- not yet HITL-verified" badge when true. When
  // a Step-6 promotion flips the row to approved + direct_source_verified, this becomes false with no
  // calculator change.
  provisional: boolean;
}

// Deterministic within-jurisdiction source preference (lower = preferred). EPA ESB (tier-1 SCV/FCV
// compendium) ranks above EPA NRWQC (tier-2 live criteria) for the same eco-direct slot; FCSAP is the
// sole eco-food source. Sources not listed fall to the back (large rank) but still rank by id for
// determinism. Reused both here and by the resolver below.
const ECO_SOURCE_PREFERENCE: Record<string, number> = {
  'src-us-epa-esb-tier2-nonionic-organics-2008': 0,
  'src-fcsap-era-module7-wildlife-trv-2021': 0,
  'src-us-epa-nrwqc-aquatic-life-live': 1,
  'src-ccme-cwqg-aquatic-life': 2,
};

function sourcePreference(record: ParameterValueRecord): number {
  return record.source_ids.reduce(
    (best, id) => Math.min(best, ECO_SOURCE_PREFERENCE[id] ?? Number.MAX_SAFE_INTEGER),
    Number.MAX_SAFE_INTEGER,
  );
}

function sourceShortLabel(record: ParameterValueRecord): string {
  const id = record.source_ids[0];
  return getSourceRecord(id)?.short_citation ?? id ?? 'unknown source';
}

/**
 * Resolve the seed value for an eco calculator input from the catalog, frame-aware + source-priority +
 * provisional-gated. Returns null (the calculator falls back to its substanceLibrary value / stays
 * user-entered) when: the frame marks the pathway unsupported or reference-only; no catalog candidate
 * exists for the (substance, pathway, input[, receptor]); no candidate clears the provisional gate; or
 * the top rank is a tie that cannot be broken deterministically (withhold rather than guess).
 */
export function resolveEcoSeed(
  substanceKey: string,
  pathway: EcoSeedPathway,
  inputKey: string,
  frameId: RegulatoryFrameId,
  receptor?: EcoReceptor,
): EcoSeed | null {
  // Do NOT seed a frame/pathway that is unsupported or reference-only (the eligible statuses are
  // calculation_ready + needs_review). classifyCandidate already blocks 'unsupported'; 'reference_only'
  // is gated here.
  const applicability = getPathwayApplicability(frameId, pathway);
  if (
    applicability.status === 'unsupported' ||
    applicability.status === 'reference_only'
  ) {
    return null;
  }

  let candidates = getParameterValueRecordsForSubstance(
    substanceKey,
    pathway,
  ).filter((record) => record.input_key === inputKey);
  if (receptor) {
    candidates = candidates.filter((record) =>
      record.species_groups?.includes(receptor),
    );
  }

  const eligible = candidates.filter(
    (record) => getEcoProvisionalEligibility(frameId, pathway, record).eligible,
  );
  if (eligible.length === 0) return null;

  const ranked = eligible
    .map((record) => ({
      record,
      jurisdictionRank:
        getFrameJurisdictionRank(frameId, record) ?? Number.MAX_SAFE_INTEGER,
      sourcePref: sourcePreference(record),
    }))
    .sort((a, b) =>
      a.jurisdictionRank !== b.jurisdictionRank
        ? a.jurisdictionRank - b.jurisdictionRank
        : a.sourcePref - b.sourcePref,
    );

  const best = ranked[0];
  const tiedForBest = ranked.filter(
    (r) =>
      r.jurisdictionRank === best.jurisdictionRank &&
      r.sourcePref === best.sourcePref,
  );
  // Withhold rather than guess when the top rank is a genuine tie (same jurisdiction + same source
  // preference): a reviewer must pick. Mirrors the default-selection policy's multiple-top-ranked rule.
  if (tiedForBest.length !== 1) return null;

  const record = best.record;
  const numericValue =
    typeof record.value === 'number' ? record.value : Number(record.value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  const provisional = !(
    record.qa_status === 'approved' &&
    record.canonical_source_status === 'direct_source_verified'
  );

  return {
    value: numericValue,
    unit: record.unit,
    parameterValueId: record.parameter_value_id,
    label: record.display_name,
    sourceShortLabel: sourceShortLabel(record),
    provisional,
  };
}
