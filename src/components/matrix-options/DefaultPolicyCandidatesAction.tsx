'use client';

import React, { useMemo } from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  buildEvidenceLibraryView,
  createEvidenceLibraryFilters,
} from '@/lib/matrix-options/provenance/library';
import type {
  CalculatorReceipt,
  EvidenceLibraryFilterRequest,
  ProvenancePathway,
} from '@/lib/matrix-options/provenance/types';
import {
  getRegulatoryFrame,
  regulatoryFrameEvidenceFilter,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';
import { buildDefaultSelectionPolicyDecision } from '@/lib/matrix-options/defaultSelectionPolicy';

/**
 * Audit item P1 -- "Review candidate defaults" was reachable only from the right rail, and
 * the rail is gated to Stage 3 and collapsed (and `inert`) before that. The action is an
 * ACTION, not the reference DATA the gate exists to defer, so it was unreachable for most of
 * the user's time in the calculator.
 *
 * This component is rendered in BOTH the calculator body and the rail, so the action exists
 * in two places rather than being moved out of one. The gating of reference DATA is
 * unchanged -- only this button and its receipt are duplicated.
 *
 * The reviewed-at timestamp is deliberately NOT owned here. It is lifted to MatrixDashboard
 * and passed in, so the two instances always agree; keeping a `useState` per instance would
 * create two sources of truth for one fact, which is the exact defect class this codebase
 * hit repeatedly on 2026-08-15.
 */

export interface DefaultPolicyCandidatesActionProps {
  pathway: ProvenancePathway;
  pathwayLabel: string;
  substanceKey: string;
  substanceLabel: string;
  regulatoryFrameId: RegulatoryFrameId;
  /** Candidate input keys. Pass them in when the caller has already computed the
   *  evidence-library view (the rail does); otherwise use useDefaultPolicyCandidates. */
  candidateInputKeys: string[];
  reviewedAt: string | null;
  onReviewedAtChange: (timestamp: string) => void;
  onOpenEvidenceLibrary: (
    request: EvidenceLibraryFilterRequest,
    receipt?: CalculatorReceipt,
  ) => void;
  /** Distinguishes the two rendered instances for tests and for Playwright queries, which
   *  would otherwise be ambiguous now that the button exists twice. */
  surface: 'body' | 'rail';
  className?: string;
}

/**
 * Derives the candidate input keys for a (pathway, substance, frame) triple. Pure, and a
 * function of props only -- the calculator body needs the keys without rendering the whole
 * value-search panel.
 */
export function useDefaultPolicyCandidates({
  pathway,
  substanceKey,
  regulatoryFrameId,
}: {
  pathway: ProvenancePathway;
  substanceKey: string;
  regulatoryFrameId: RegulatoryFrameId;
}): string[] {
  const regulatoryFrameFilters = useMemo(
    () => regulatoryFrameEvidenceFilter(regulatoryFrameId),
    [regulatoryFrameId],
  );

  const library = useMemo(
    () =>
      buildEvidenceLibraryView(
        createEvidenceLibraryFilters({
          pathways: [pathway],
          substanceKeys: [substanceKey],
          ...regulatoryFrameFilters,
        }),
      ),
    [pathway, substanceKey, regulatoryFrameFilters],
  );

  return useMemo(() => {
    const seen = new Set<string>();
    const candidates = new Set<string>();

    for (const row of library.values) {
      const inputKey = row.record.input_key;
      if (seen.has(inputKey)) continue;
      seen.add(inputKey);

      const decision = buildDefaultSelectionPolicyDecision({
        frameId: regulatoryFrameId,
        pathway,
        substanceKey,
        inputKey,
      });

      if (
        decision.status === 'candidate_pending_approval' ||
        decision.status === 'manual_decision_required'
      ) {
        candidates.add(decision.request.inputKey);
      }
    }

    return Array.from(candidates);
  }, [library.values, pathway, regulatoryFrameId, substanceKey]);
}

export default function DefaultPolicyCandidatesAction({
  pathway,
  pathwayLabel,
  substanceKey,
  substanceLabel,
  regulatoryFrameId,
  candidateInputKeys,
  reviewedAt,
  onReviewedAtChange,
  onOpenEvidenceLibrary,
  surface,
  className,
}: DefaultPolicyCandidatesActionProps) {
  if (candidateInputKeys.length === 0) {
    return null;
  }

  const openDefaultPolicyCandidates = () => {
    onReviewedAtChange(new Date().toLocaleTimeString());
    onOpenEvidenceLibrary(
      {
        pathways: [pathway],
        substanceKeys: [substanceKey],
        inputKeys: candidateInputKeys,
        ...regulatoryFrameEvidenceFilter(regulatoryFrameId),
      },
      {
        pathwayLabel,
        substanceLabel,
        inputKeys: candidateInputKeys,
        frameLabel: getRegulatoryFrame(regulatoryFrameId).shortLabel,
      },
    );
  };

  return (
    <div
      className={cn('space-y-1', className)}
      data-testid={`calculator-candidate-defaults-${surface}`}
    >
      <button
        type="button"
        onClick={openDefaultPolicyCandidates}
        data-testid={`calculator-candidate-defaults-button-${surface}`}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-2 text-xs font-semibold text-sky-800 hover:border-sky-300 hover:bg-white dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:border-sky-600"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        {reviewedAt ? 'Re-review candidate defaults' : 'Review candidate defaults'}
      </button>
      {reviewedAt && (
        <p
          className="mt-1 text-[10px] text-slate-500 dark:text-slate-400"
          data-testid={`calculator-candidate-review-receipt-${surface}`}
        >
          <CheckCircle2
            className="mr-1 inline-block h-3 w-3 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          {candidateInputKeys.length} candidate{candidateInputKeys.length === 1 ? '' : 's'} opened
          for review at {reviewedAt}. No defaults changed.
        </p>
      )}
    </div>
  );
}
