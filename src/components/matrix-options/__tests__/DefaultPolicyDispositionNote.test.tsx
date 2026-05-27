import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DefaultPolicyDispositionNote, {
  DefaultPolicyDecisionSummaryNote,
} from '../DefaultPolicyDispositionNote';
import type {
  DefaultSelectionCandidate,
  DefaultSelectionPolicyDecision,
} from '@/lib/matrix-options/defaultSelectionPolicy';
import { DEFAULT_SELECTION_READ_ONLY_INVARIANTS } from '@/lib/matrix-options/defaultSelectionPolicy';
import type { ParameterValueRecord } from '@/lib/matrix-options/provenance/types';

function makeRecord(
  overrides: Partial<ParameterValueRecord> = {},
): ParameterValueRecord {
  return {
    parameter_value_id: 'pv-test-001',
    substance_key: 'benzo_a_pyrene',
    pathway: 'eco-direct-eqp',
    input_key: 'fcv_ug_per_L',
    display_name: 'Test FCV',
    value: 0.014,
    unit: 'ug/L',
    value_type: 'single_value',
    candidate_group_id: 'cg-test',
    default_status: 'available_option',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'approved',
    source_ids: [],
    equation_ids: [],
    jurisdiction: 'US_federal',
    applicability: 'Test applicability',
    uncertainty: null,
    evidence_items: [],
    review_notes: '',
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<DefaultSelectionCandidate> = {},
): DefaultSelectionCandidate {
  return {
    record: makeRecord(),
    sources: [],
    sourceRoles: [],
    hierarchyRank: 0,
    disposition: 'eligible_pending_approval',
    canBecomeDefaultWithApproval: true,
    rationale: 'Test rationale for this candidate.',
    ...overrides,
  };
}

function makeDecision(
  overrides: Partial<DefaultSelectionPolicyDecision> = {},
): DefaultSelectionPolicyDecision {
  return {
    request: {
      frameId: 'bc-protocol1-v5-dra',
      pathway: 'eco-direct-eqp',
      substanceKey: 'benzo_a_pyrene',
      inputKey: 'fcv_ug_per_L',
    },
    status: 'candidate_pending_approval',
    activeCurrentDefault: null,
    recommendedCandidate: null,
    eligibleCandidates: [],
    blockedCandidates: [],
    candidates: [],
    readOnlyInvariants: DEFAULT_SELECTION_READ_ONLY_INVARIANTS,
    rationale: 'Decision rationale text.',
    ...overrides,
  };
}

describe('DefaultPolicyDispositionNote', () => {
  describe('disposition labels', () => {
    it('shows "Recommended candidate: approval required" when candidate is the recommended one', () => {
      const record = makeRecord({ parameter_value_id: 'pv-recommended' });
      const candidate = makeCandidate({
        record,
        disposition: 'eligible_pending_approval',
      });
      const decision = makeDecision({
        recommendedCandidate: candidate,
      });

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(
        screen.getByText('Recommended candidate: approval required'),
      ).toBeInTheDocument();
    });

    it('shows "Eligible alternative: approval required" for eligible but non-recommended candidate', () => {
      const recommendedRecord = makeRecord({ parameter_value_id: 'pv-other' });
      const recommendedCandidate = makeCandidate({ record: recommendedRecord });
      const candidate = makeCandidate({
        record: makeRecord({ parameter_value_id: 'pv-alt' }),
        disposition: 'eligible_pending_approval',
      });
      const decision = makeDecision({
        recommendedCandidate,
      });

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(
        screen.getByText('Eligible alternative: approval required'),
      ).toBeInTheDocument();
    });

    it('shows "Blocked: policy compilation" for blocked_policy_compilation', () => {
      const candidate = makeCandidate({
        disposition: 'blocked_policy_compilation',
        canBecomeDefaultWithApproval: false,
        rationale: 'Policy compilations are source-mining aids.',
      });
      const decision = makeDecision();

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(
        screen.getByText('Blocked: policy compilation'),
      ).toBeInTheDocument();
    });

    it('shows "Blocked: outside selected frame" for blocked_frame_jurisdiction', () => {
      const candidate = makeCandidate({
        disposition: 'blocked_frame_jurisdiction',
        canBecomeDefaultWithApproval: false,
        rationale: 'Outside frame jurisdiction.',
      });
      const decision = makeDecision();

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(
        screen.getByText('Blocked: outside selected frame'),
      ).toBeInTheDocument();
    });

    it('shows "Current default retained" for active_current_default', () => {
      const candidate = makeCandidate({
        disposition: 'active_current_default',
        canBecomeDefaultWithApproval: false,
        rationale: 'This is the current default.',
      });
      const decision = makeDecision({
        activeCurrentDefault: candidate,
      });

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(
        screen.getByText('Current default retained'),
      ).toBeInTheDocument();
    });

    it('shows "Not a default candidate" for blocked_not_default', () => {
      const candidate = makeCandidate({
        disposition: 'blocked_not_default',
        canBecomeDefaultWithApproval: false,
        rationale: 'Not a default candidate.',
      });
      const decision = makeDecision();

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(
        screen.getByText('Not a default candidate'),
      ).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('hides detail text when compact=true', () => {
      const candidate = makeCandidate({
        disposition: 'blocked_policy_compilation',
        canBecomeDefaultWithApproval: false,
        rationale: 'Policy compilations are source-mining aids.',
      });
      const decision = makeDecision();

      render(
        <DefaultPolicyDispositionNote
          candidate={candidate}
          decision={decision}
          compact={true}
        />,
      );

      expect(
        screen.getByText('Blocked: policy compilation'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Policy compilations are source-mining aids.'),
      ).not.toBeInTheDocument();
    });

    it('shows detail text when compact=false (default)', () => {
      const candidate = makeCandidate({
        disposition: 'blocked_policy_compilation',
        canBecomeDefaultWithApproval: false,
        rationale: 'Policy compilations are source-mining aids.',
      });
      const decision = makeDecision();

      render(
        <DefaultPolicyDispositionNote
          candidate={candidate}
          decision={decision}
          compact={false}
        />,
      );

      expect(
        screen.getByText('Policy compilations are source-mining aids.'),
      ).toBeInTheDocument();
    });

    it('shows rationale for active_current_default in non-compact mode', () => {
      const candidate = makeCandidate({
        disposition: 'active_current_default',
        canBecomeDefaultWithApproval: false,
        rationale: 'Current default rationale text.',
      });
      const decision = makeDecision({ activeCurrentDefault: candidate });

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(
        screen.getByText(
          'The calculator keeps this current default until an approved change is applied.',
        ),
      ).toBeInTheDocument();
    });

    it('shows read-only note for recommended candidate in non-compact mode', () => {
      const record = makeRecord({ parameter_value_id: 'pv-rec' });
      const candidate = makeCandidate({ record, disposition: 'eligible_pending_approval' });
      const decision = makeDecision({ recommendedCandidate: candidate });

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(
        screen.getByText(
          'Read-only recommendation only; no default or QA status changes are made.',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('no promotion language', () => {
    it('does not render "Promote" text', () => {
      const candidate = makeCandidate({ disposition: 'eligible_pending_approval' });
      const decision = makeDecision({ recommendedCandidate: candidate });

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(screen.queryByText(/Promote/)).not.toBeInTheDocument();
    });

    it('does not render "Set as default" text', () => {
      const candidate = makeCandidate({ disposition: 'eligible_pending_approval' });
      const decision = makeDecision({ recommendedCandidate: candidate });

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(screen.queryByText(/Set as default/)).not.toBeInTheDocument();
    });

    it('does not render "Approve default" text', () => {
      const candidate = makeCandidate({ disposition: 'eligible_pending_approval' });
      const decision = makeDecision({ recommendedCandidate: candidate });

      render(
        <DefaultPolicyDispositionNote candidate={candidate} decision={decision} />,
      );

      expect(screen.queryByText(/Approve default/)).not.toBeInTheDocument();
    });
  });

  describe('testId prop', () => {
    it('applies testId as data-testid', () => {
      const candidate = makeCandidate({ disposition: 'eligible_pending_approval' });
      const decision = makeDecision({ recommendedCandidate: candidate });

      render(
        <DefaultPolicyDispositionNote
          candidate={candidate}
          decision={decision}
          testId="test-disposition-note"
        />,
      );

      expect(
        screen.getByTestId('test-disposition-note'),
      ).toBeInTheDocument();
    });
  });
});

describe('DefaultPolicyDecisionSummaryNote', () => {
  describe('decision status labels', () => {
    it('shows "Default policy: candidate pending approval"', () => {
      const decision = makeDecision({ status: 'candidate_pending_approval' });

      render(<DefaultPolicyDecisionSummaryNote decision={decision} />);

      expect(
        screen.getByText('Default policy: candidate pending approval'),
      ).toBeInTheDocument();
    });

    it('shows "Default policy: manual decision required"', () => {
      const decision = makeDecision({
        status: 'manual_decision_required',
        rationale:
          'Multiple top-ranked candidates exist; reviewer must choose.',
      });

      render(<DefaultPolicyDecisionSummaryNote decision={decision} />);

      expect(
        screen.getByText('Default policy: manual decision required'),
      ).toBeInTheDocument();
    });

    it('shows "Default policy: unsupported pathway"', () => {
      const decision = makeDecision({
        status: 'pathway_unsupported',
        rationale: 'The selected frame marks this pathway unsupported.',
      });

      render(<DefaultPolicyDecisionSummaryNote decision={decision} />);

      expect(
        screen.getByText('Default policy: unsupported pathway'),
      ).toBeInTheDocument();
    });

    it('shows "Default policy: keep current default" for keep_current_default_no_eligible_candidate', () => {
      const decision = makeDecision({
        status: 'keep_current_default_no_eligible_candidate',
        rationale: 'No approved direct-source candidate is eligible.',
      });

      render(<DefaultPolicyDecisionSummaryNote decision={decision} />);

      expect(
        screen.getByText('Default policy: keep current default'),
      ).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('hides rationale text when compact=true', () => {
      const decision = makeDecision({
        status: 'candidate_pending_approval',
        rationale: 'This is the decision rationale detail text.',
      });

      render(
        <DefaultPolicyDecisionSummaryNote decision={decision} compact={true} />,
      );

      expect(
        screen.getByText('Default policy: candidate pending approval'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('This is the decision rationale detail text.'),
      ).not.toBeInTheDocument();
    });

    it('shows rationale text when compact=false (default)', () => {
      const decision = makeDecision({
        status: 'candidate_pending_approval',
        rationale: 'This is the decision rationale detail text.',
      });

      render(
        <DefaultPolicyDecisionSummaryNote decision={decision} compact={false} />,
      );

      expect(
        screen.getByText('This is the decision rationale detail text.'),
      ).toBeInTheDocument();
    });
  });

  describe('no promotion language', () => {
    it('does not render "Promote" text', () => {
      const decision = makeDecision({ status: 'candidate_pending_approval' });

      render(<DefaultPolicyDecisionSummaryNote decision={decision} />);

      expect(screen.queryByText(/Promote/)).not.toBeInTheDocument();
    });

    it('does not render "Set as default" text', () => {
      const decision = makeDecision({ status: 'candidate_pending_approval' });

      render(<DefaultPolicyDecisionSummaryNote decision={decision} />);

      expect(screen.queryByText(/Set as default/)).not.toBeInTheDocument();
    });

    it('does not render "Approve default" text', () => {
      const decision = makeDecision({ status: 'candidate_pending_approval' });

      render(<DefaultPolicyDecisionSummaryNote decision={decision} />);

      expect(screen.queryByText(/Approve default/)).not.toBeInTheDocument();
    });
  });

  describe('testId prop', () => {
    it('applies testId as data-testid', () => {
      const decision = makeDecision({ status: 'manual_decision_required' });

      render(
        <DefaultPolicyDecisionSummaryNote
          decision={decision}
          testId="test-summary-note"
        />,
      );

      expect(screen.getByTestId('test-summary-note')).toBeInTheDocument();
    });
  });
});
