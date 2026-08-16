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
 * The receipt is deliberately NOT owned here. It is lifted to MatrixDashboard and passed in,
 * so the two instances always agree; keeping a `useState` per instance would create two
 * sources of truth for one fact, which is the exact defect class this codebase hit repeatedly
 * on 2026-08-15.
 *
 * The receipt carries its own CONTEXT (substance, pathway, frame) and the input keys that were
 * actually opened, not just a timestamp. That is load-bearing, and it is the fix for a defect
 * this very lift introduced: when the state lived in CalculatorValueSearchPanel it was
 * destroyed whenever that panel unmounted, so leaving the Calculator tab silently cleared it.
 * MatrixDashboard stays mounted for the whole page, so a bare timestamp would survive a
 * substance change and then be rendered against the NEW substance's freshly-recomputed
 * candidate count -- claiming "N candidates opened for review at 10:04" for a substance whose
 * candidates were never opened. Matching the stored context against the current props is what
 * makes the claim true rather than merely plausible.
 */

export interface CandidateReviewReceipt {
  timestamp: string;
  substanceKey: string;
  pathway: ProvenancePathway;
  regulatoryFrameId: RegulatoryFrameId;
  /** The keys actually opened. Rendered from THIS, never from the live candidate list. */
  inputKeys: string[];
}

export interface DefaultPolicyCandidatesActionProps {
  pathway: ProvenancePathway;
  pathwayLabel: string;
  substanceKey: string;
  substanceLabel: string;
  regulatoryFrameId: RegulatoryFrameId;
  /** Candidate input keys. Pass them in when the caller has already computed the
   *  evidence-library view (the rail does); otherwise use useDefaultPolicyCandidates. */
  candidateInputKeys: string[];
  receipt: CandidateReviewReceipt | null;
  onReviewed: (receipt: CandidateReviewReceipt) => void;
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
  enabled = true,
}: {
  pathway: ProvenancePathway;
  substanceKey: string;
  regulatoryFrameId: RegulatoryFrameId;
  /**
   * When false the derivation is skipped and an empty list is returned. The hook must still
   * be CALLED unconditionally (rules of hooks), so the gate lives inside the useMemo rather
   * than at the call site. buildEvidenceLibraryView maps over ~1783 parameter-value records
   * and recomputes roughly seventeen facets; measured at about 40ms. Without this flag the
   * calculator's candidate derivation would run on the Interactive Map and every other tab,
   * and during SSR, for a value only the Calculator branch ever reads.
   */
  enabled?: boolean;
}): string[] {
  const regulatoryFrameFilters = useMemo(
    () => regulatoryFrameEvidenceFilter(regulatoryFrameId),
    [regulatoryFrameId],
  );

  const library = useMemo(
    () =>
      enabled
        ? buildEvidenceLibraryView(
            createEvidenceLibraryFilters({
              pathways: [pathway],
              substanceKeys: [substanceKey],
              ...regulatoryFrameFilters,
            }),
          )
        : null,
    [enabled, pathway, substanceKey, regulatoryFrameFilters],
  );

  return useMemo(() => {
    if (!library) return [];
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
  }, [library, pathway, regulatoryFrameId, substanceKey]);
}

export default function DefaultPolicyCandidatesAction({
  pathway,
  pathwayLabel,
  substanceKey,
  substanceLabel,
  regulatoryFrameId,
  candidateInputKeys,
  receipt,
  onReviewed,
  onOpenEvidenceLibrary,
  surface,
  className,
}: DefaultPolicyCandidatesActionProps) {
  if (candidateInputKeys.length === 0) {
    return null;
  }

  // Show the receipt ONLY while it still describes what is on screen. A receipt left over
  // from another substance, pathway or regulatory frame is a false statement about work the
  // user did not do, so it is dropped rather than re-interpreted.
  const receiptApplies =
    receipt !== null &&
    receipt.substanceKey === substanceKey &&
    receipt.pathway === pathway &&
    receipt.regulatoryFrameId === regulatoryFrameId;

  const openDefaultPolicyCandidates = () => {
    onReviewed({
      timestamp: new Date().toLocaleTimeString(),
      substanceKey,
      pathway,
      regulatoryFrameId,
      inputKeys: candidateInputKeys,
    });
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
        {receiptApplies ? 'Re-review candidate defaults' : 'Review candidate defaults'}
      </button>
      {receiptApplies && receipt && (
        <p
          className="mt-1 text-[10px] text-slate-500 dark:text-slate-400"
          data-testid={`calculator-candidate-review-receipt-${surface}`}
        >
          <CheckCircle2
            className="mr-1 inline-block h-3 w-3 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          {/* Count comes from the receipt's OWN recorded keys, not from the live candidate
              list, so the number can never drift away from what was actually opened. */}
          {receipt.inputKeys.length} candidate{receipt.inputKeys.length === 1 ? '' : 's'} opened
          for review at {receipt.timestamp}. No defaults changed.
        </p>
      )}
    </div>
  );
}
