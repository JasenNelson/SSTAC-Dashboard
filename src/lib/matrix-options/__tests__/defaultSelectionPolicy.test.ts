import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SELECTION_READ_ONLY_INVARIANTS,
  buildDefaultSelectionPolicyDecision,
  getFrameSeedCandidateEligibility,
  isUnitBlocked,
  type DefaultSelectionPolicyDecision,
} from '../defaultSelectionPolicy';
import { PARAMETER_VALUE_RECORDS } from '../provenance/catalog';

function candidate(
  decision: DefaultSelectionPolicyDecision,
  parameterValueId: string,
) {
  const match = decision.candidates.find(
    (item) => item.record.parameter_value_id === parameterValueId,
  );
  expect(match, parameterValueId).toBeDefined();
  return match!;
}

function statusSnapshot(parameterValueIds: string[]) {
  return parameterValueIds.map((parameterValueId) => {
    const record = PARAMETER_VALUE_RECORDS.find(
      (item) => item.parameter_value_id === parameterValueId,
    );
    expect(record, parameterValueId).toBeDefined();
    return {
      parameter_value_id: parameterValueId,
      default_status: record!.default_status,
      evidence_support_status: record!.evidence_support_status,
      qa_status: record!.qa_status,
      canonical_source_status: record!.canonical_source_status ?? null,
    };
  });
}

describe('matrix options default selection policy', () => {
  it('prefers Health Canada direct-source candidates in the BC frame without promoting them', () => {
    const decision = buildDefaultSelectionPolicyDecision({
      frameId: 'bc-protocol1-v5-dra',
      pathway: 'human-health-food',
      substanceKey: 'benzo_a_pyrene',
      inputKey: 'sf_oral_per_mg_per_kg_bw_per_day',
    });

    expect(decision.status).toBe('candidate_pending_approval');
    expect(decision.readOnlyInvariants).toEqual(
      DEFAULT_SELECTION_READ_ONLY_INVARIANTS,
    );
    expect(decision.activeCurrentDefault?.record.parameter_value_id).toBe(
      'pv-bap-hh-food-slope',
    );
    expect(decision.recommendedCandidate?.record.parameter_value_id).toBe(
      'pv-hc-bap-hh-food-sf',
    );
    expect(decision.recommendedCandidate?.record.default_status).toBe(
      'available_option',
    );
    expect(decision.rationale).toMatch(/remains read-only/i);

    const healthCanada = candidate(decision, 'pv-hc-bap-hh-food-sf');
    const iris = candidate(decision, 'pv-iris-bap-hh-food-sf');
    const protocol28 = candidate(decision, 'pv-p28-bap-hh-food-slope');

    expect(healthCanada.disposition).toBe('eligible_pending_approval');
    expect(iris.disposition).toBe('eligible_pending_approval');
    expect(healthCanada.hierarchyRank).toBeLessThan(iris.hierarchyRank!);
    expect(protocol28.disposition).toBe('blocked_policy_compilation');
    expect(protocol28.canBecomeDefaultWithApproval).toBe(false);
  });

  it('uses the verified IRIS zinc value rather than the matching Protocol 28 lead in the US frame', () => {
    const decision = buildDefaultSelectionPolicyDecision({
      frameId: 'us-epa-usace-sediment',
      pathway: 'human-health-food',
      substanceKey: 'zinc',
      inputKey: 'rfd_oral_mg_per_kg_bw_day',
    });

    expect(decision.status).toBe('candidate_pending_approval');
    expect(decision.activeCurrentDefault?.record.parameter_value_id).toBe(
      'pv-zinc-hh-food-rfd',
    );
    expect(decision.recommendedCandidate?.record.parameter_value_id).toBe(
      'pv-iris-zinc-hh-food-rfd',
    );
    expect(decision.recommendedCandidate?.record.value).toBe(0.3);
    expect(decision.recommendedCandidate?.record.default_status).toBe(
      'available_option',
    );

    const protocol28 = candidate(decision, 'pv-p28-zinc-hh-food-rfd');
    const healthCanada = candidate(decision, 'pv-hc-zinc-hh-food-ul-adult');

    expect(protocol28.record.value).toBe(0.3);
    expect(protocol28.disposition).toBe('blocked_policy_compilation');
    expect(protocol28.canBecomeDefaultWithApproval).toBe(false);
    expect(healthCanada.disposition).toBe('blocked_frame_jurisdiction');
  });

  it('requires a manual decision when a frame has multiple top-ranked direct-source values', () => {
    const decision = buildDefaultSelectionPolicyDecision({
      frameId: 'us-epa-usace-sediment',
      pathway: 'human-health-food',
      substanceKey: 'benzo_a_pyrene',
      inputKey: 'rfd_oral_mg_per_kg_bw_day',
    });

    expect(decision.status).toBe('manual_decision_required');
    expect(decision.recommendedCandidate).toBeNull();
    expect(decision.rationale).toMatch(/Multiple top-ranked/i);
    expect(
      decision.eligibleCandidates
        .map((item) => item.record.parameter_value_id)
        .sort(),
    ).toEqual([
      'pv-iris-bap-hh-food-rfd-immune',
      'pv-iris-bap-hh-food-rfd-neuro',
      'pv-iris-bap-hh-food-rfd-repro',
    ]);
    expect(candidate(decision, 'pv-hc-bap-hh-food-rfd-tdi').disposition).toBe(
      'blocked_frame_jurisdiction',
    );
    expect(candidate(decision, 'pv-bap-hh-food-rfd').disposition).toBe(
      'blocked_not_default',
    );
  });

  it('does not mutate catalog default, evidence, QA, or canonical-source status', () => {
    const watchedIds = [
      'pv-pcb-hh-food-rfd',
      'pv-p28-pcb-hh-food-rfd',
      'pv-hc-pcb-hh-food-rfd-nondioxin',
      'pv-iris-pcb-hh-food-rfd-aroclor1254',
    ];
    const before = statusSnapshot(watchedIds);

    const decision = buildDefaultSelectionPolicyDecision({
      frameId: 'bc-protocol1-v5-dra',
      pathway: 'human-health-food',
      substanceKey: 'total_pcbs_aroclor_1254',
      inputKey: 'rfd_oral_mg_per_kg_bw_day',
    });

    expect(decision.readOnlyInvariants).toEqual({
      mutatesCatalog: false,
      promotesDefault: false,
      promotesQa: false,
    });
    expect(decision.recommendedCandidate?.record.parameter_value_id).toBe(
      'pv-hc-pcb-hh-food-rfd-nondioxin',
    );
    expect(statusSnapshot(watchedIds)).toEqual(before);
  });

  it('exposes a unit-consistency assessment and does not block a comparable slot (A1 guard)', () => {
    const decision = buildDefaultSelectionPolicyDecision({
      frameId: 'bc-protocol1-v5-dra',
      pathway: 'human-health-food',
      substanceKey: 'total_pcbs_aroclor_1254',
      inputKey: 'rfd_oral_mg_per_kg_bw_day',
    });

    // contract: the field is always present
    expect(decision.unitConsistency).toBeDefined();
    expect(Array.isArray(decision.unitConsistency.units)).toBe(true);
    // this real slot's eligible candidates share a comparable dose base, so the
    // A1 guard must NOT withhold the recommendation it would otherwise emit.
    expect(decision.unitConsistency.comparable).toBe(true);
    expect(decision.recommendedCandidate).not.toBeNull();
    expect(decision.rationale).not.toMatch(/A1 unit guard/);
  });

  it('isUnitBlocked withholds only a multi-candidate, non-comparable recommendation (A1)', () => {
    // fail-closed branch: would-be recommendation + >=2 eligible + not comparable
    expect(isUnitBlocked(true, 2, false)).toBe(true);
    expect(isUnitBlocked(true, 3, false)).toBe(true);
    // never blocks: single candidate (nothing to compare)
    expect(isUnitBlocked(true, 1, false)).toBe(false);
    // never blocks: comparable slot
    expect(isUnitBlocked(true, 2, true)).toBe(false);
    // never blocks: no recommendation to withhold
    expect(isUnitBlocked(false, 2, false)).toBe(false);
  });

  it('DSP-1: getFrameSeedCandidateEligibility returns eligible + eligible_pending_approval for pv-hc-bap-hh-food-sf', () => {
    const record = PARAMETER_VALUE_RECORDS.find(
      (r) => r.parameter_value_id === 'pv-hc-bap-hh-food-sf',
    );
    expect(record).toBeDefined();
    const result = getFrameSeedCandidateEligibility(
      'bc-protocol1-v5-dra',
      'human-health-food',
      record!,
    );
    expect(result.eligible).toBe(true);
    expect(result.disposition).toBe('eligible_pending_approval');
  });

  it('DSP-2: getFrameSeedCandidateEligibility returns not eligible + blocked_policy_compilation for pv-p28-bap-hh-food-slope', () => {
    const record = PARAMETER_VALUE_RECORDS.find(
      (r) => r.parameter_value_id === 'pv-p28-bap-hh-food-slope',
    );
    expect(record).toBeDefined();
    const result = getFrameSeedCandidateEligibility(
      'bc-protocol1-v5-dra',
      'human-health-food',
      record!,
    );
    expect(result.eligible).toBe(false);
    expect(result.disposition).toBe('blocked_policy_compilation');
  });

  it('DSP-3: buildDefaultSelectionPolicyDecision returns pathway_unsupported for bc-csr-sediment-numerical + eco-food-bsaf', () => {
    // eco-food-bsaf is marked unsupported in the bc-csr-sediment-numerical frame.
    const decision = buildDefaultSelectionPolicyDecision({
      frameId: 'bc-csr-sediment-numerical',
      pathway: 'eco-food-bsaf',
      substanceKey: 'benzo_a_pyrene',
      inputKey: 'BSAF_loc_freshwater',
    });
    expect(decision.status).toBe('pathway_unsupported');
  });

  it('DSP-4: buildDefaultSelectionPolicyDecision returns keep_current_default_no_eligible_candidate when zero eligible candidates exist', () => {
    // ccme-sediment-quality + eco-direct-eqp + benzo_a_pyrene + logKow has no
    // eligible (approved, direct-source) candidates -- confirmed by probe script.
    const decision = buildDefaultSelectionPolicyDecision({
      frameId: 'ccme-sediment-quality',
      pathway: 'eco-direct-eqp',
      substanceKey: 'benzo_a_pyrene',
      inputKey: 'logKow',
    });
    expect(decision.status).toBe('keep_current_default_no_eligible_candidate');
  });

  // Candidate 3: buildDefaultSelectionPolicyDecision end-to-end unit-blocked path.
  // The BW_kg slot in bc-protocol1-v5-dra / human-health-food / generic is the ONLY
  // real catalog slot that fires unitBlocked===true (two competing body-weight candidates,
  // both in 'kg', which normalizeToBase returns null for -> allNormalizable=false ->
  // comparable=false -> unitBlocked=true with 2 eligible candidates).
  // This integration wiring (recommendedCandidate===null, status=manual_decision_required,
  // rationale matches /A1 unit guard/) is never driven by any existing test.
  it('Candidate 3: BW_kg slot fires the A1 unit-blocked path -- recommendation suppressed', () => {
    const decision = buildDefaultSelectionPolicyDecision({
      frameId: 'bc-protocol1-v5-dra',
      pathway: 'human-health-food',
      substanceKey: 'generic',
      inputKey: 'BW_kg',
    });

    // The A1 guard must have fired: recommendedCandidate suppressed.
    expect(decision.recommendedCandidate).toBeNull();
    expect(decision.status).toBe('manual_decision_required');
    // At least 2 eligible candidates must be present (two body-weight rows).
    expect(decision.eligibleCandidates.length).toBeGreaterThanOrEqual(2);
    // unitConsistency must report non-comparable (the reason the guard fires).
    expect(decision.unitConsistency.comparable).toBe(false);
    // Rationale must name the A1 guard so a reviewer can identify why no pick was made.
    expect(decision.rationale).toMatch(/A1 unit guard/);
  });
});
