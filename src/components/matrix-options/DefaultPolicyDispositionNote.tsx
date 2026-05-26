'use client';

import { cn } from '@/utils/cn';
import type {
  DefaultSelectionCandidate,
  DefaultSelectionCandidateDisposition,
  DefaultSelectionDecisionStatus,
  DefaultSelectionPolicyDecision,
} from '@/lib/matrix-options/defaultSelectionPolicy';

function policyTone(disposition: DefaultSelectionCandidateDisposition): string {
  if (disposition === 'eligible_pending_approval') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
  }
  if (disposition === 'active_current_default') {
    return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200';
  }
  if (disposition === 'blocked_not_default') {
    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
}

function decisionTone(status: DefaultSelectionDecisionStatus): string {
  if (status === 'candidate_pending_approval') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
  }
  if (status === 'keep_current_default_no_eligible_candidate') {
    return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
}

function policyLabel(
  candidate: DefaultSelectionCandidate,
  decision: DefaultSelectionPolicyDecision,
): string {
  if (candidate.disposition === 'active_current_default') {
    return 'Current default retained';
  }
  if (
    decision.recommendedCandidate?.record.parameter_value_id ===
    candidate.record.parameter_value_id
  ) {
    return 'Recommended candidate: approval required';
  }
  if (candidate.disposition === 'eligible_pending_approval') {
    return 'Eligible alternative: approval required';
  }
  if (candidate.disposition === 'blocked_policy_compilation') {
    return 'Blocked: policy compilation';
  }
  if (candidate.disposition === 'blocked_reference_mining') {
    return 'Blocked: reference mining';
  }
  if (candidate.disposition === 'blocked_needs_direct_source') {
    return 'Blocked: direct source check';
  }
  if (candidate.disposition === 'blocked_needs_qa') {
    return 'Blocked: QA/currentness';
  }
  if (candidate.disposition === 'blocked_current_scaffold') {
    return 'Blocked: calculator scaffold';
  }
  if (candidate.disposition === 'blocked_frame_jurisdiction') {
    return 'Blocked: outside selected frame';
  }
  if (candidate.disposition === 'blocked_range_or_formula') {
    return 'Blocked: range or formula';
  }
  if (candidate.disposition === 'blocked_pathway_unsupported') {
    return 'Blocked: unsupported pathway';
  }
  return 'Not a default candidate';
}

function policyDetail(
  candidate: DefaultSelectionCandidate,
  decision: DefaultSelectionPolicyDecision,
): string {
  if (
    decision.recommendedCandidate?.record.parameter_value_id ===
    candidate.record.parameter_value_id
  ) {
    return 'Read-only recommendation only; no default or QA status changes are made.';
  }
  if (candidate.disposition === 'active_current_default') {
    return 'The calculator keeps this current default until an approved change is applied.';
  }
  return candidate.rationale;
}

function decisionLabel(status: DefaultSelectionDecisionStatus): string {
  if (status === 'candidate_pending_approval') {
    return 'Default policy: candidate pending approval';
  }
  if (status === 'manual_decision_required') {
    return 'Default policy: manual decision required';
  }
  if (status === 'pathway_unsupported') {
    return 'Default policy: unsupported pathway';
  }
  return 'Default policy: keep current default';
}

export function DefaultPolicyDecisionSummaryNote({
  decision,
  compact = false,
  className,
  testId,
}: {
  decision: DefaultSelectionPolicyDecision;
  compact?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border',
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-2 text-xs',
        decisionTone(decision.status),
        className,
      )}
      data-testid={testId}
    >
      <div className="font-semibold">{decisionLabel(decision.status)}</div>
      {!compact && <div className="mt-0.5 leading-relaxed">{decision.rationale}</div>}
    </div>
  );
}

export default function DefaultPolicyDispositionNote({
  candidate,
  decision,
  compact = false,
  className,
  testId,
}: {
  candidate: DefaultSelectionCandidate;
  decision: DefaultSelectionPolicyDecision;
  compact?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border',
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-2 text-xs leading-relaxed',
        policyTone(candidate.disposition),
        className,
      )}
      data-testid={testId}
    >
      <div className="font-semibold">{policyLabel(candidate, decision)}</div>
      {!compact && <div className="mt-0.5">{policyDetail(candidate, decision)}</div>}
    </div>
  );
}
