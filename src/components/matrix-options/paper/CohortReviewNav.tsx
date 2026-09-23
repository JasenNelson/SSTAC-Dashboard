'use client';

import type { CohortId, CohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortPortion } from '@/lib/matrix-options/paper/cohort-portions';
import type { ReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

/*
 * M2 left rail: 5 collapsible cohorts, each listing its authenticated paper
 * portions AND its review questions (PLAN-R4 3.B.1). Extracted from M1's
 * inline CohortNav (RevisedPaperWorkspace.tsx), which listed portions only.
 * The disclosure mechanics (button aria-expanded/aria-controls, the hidden
 * content div, the portion list and its aria-pressed/empty state) are kept
 * byte-identical in shape so the existing M1 regression coverage of them still
 * holds; only the question list under each disclosure is new.
 *
 * Selecting a question here is a plain <button> click, never a <select>,
 * checkbox, radio or <label> gesture -- so it can never trigger the
 * gesture-grouping self-abandon risk recorded against scroll-authority.ts
 * (RUN_STATE.md F8; M2_GAP_INVENTORY.md section E). It never requests a panel
 * reveal itself; it only calls onSelectQuestion, exactly like the existing
 * portion buttons call onSelectPortion.
 */
export interface CohortReviewNavProps {
  readonly cohortManifest: CohortManifest;
  readonly cohortPortions: readonly CohortPortion[];
  readonly reviewerGuide: ReviewerGuideContract;
  readonly selectedCohortId: CohortId;
  readonly expandedCohortId: CohortId | null;
  readonly selectedPortionId?: string;
  readonly activeQuestionNumber?: number;
  readonly onSelectCohort: (cohortId: CohortId) => void;
  readonly onSelectPortion: (portionId: string) => void;
  readonly onSelectQuestion: (cohortId: CohortId, questionNumber: number) => void;
}

export function CohortReviewNav({
  cohortManifest,
  cohortPortions,
  reviewerGuide,
  selectedCohortId,
  expandedCohortId,
  selectedPortionId,
  activeQuestionNumber,
  onSelectCohort,
  onSelectPortion,
  onSelectQuestion,
}: CohortReviewNavProps) {
  return (
    <nav aria-label="Review topics">
      <ul className="space-y-2">
        {cohortManifest.cohorts.map((cohort) => {
          const selected = selectedCohortId === cohort.id;
          const expanded = expandedCohortId === cohort.id;
          const portions = cohortPortions.filter((portion) => portion.cohortId === cohort.id);
          const questions = reviewerGuide.questions.filter((question) => cohort.questionNumbers.includes(question.number));
          const portionsId = `cohort-${cohort.id}-portions`;
          return (
            <li key={cohort.id} className="rounded-md border border-[var(--db-border)] bg-[var(--db-surface)]">
              <button
                type="button"
                aria-label={`${cohort.name}, ${cohort.questionNumbers.length} questions`}
                aria-expanded={expanded}
                aria-controls={portionsId}
                onClick={() => onSelectCohort(cohort.id)}
                className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] ${selected ? 'bg-[var(--db-accent-tint)] font-semibold text-[var(--db-text-primary)]' : 'font-medium text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)]'}`}
              >
                <span className="min-w-0 break-words">{cohort.name}</span>
                <span className="shrink-0 text-xs font-normal text-[var(--db-text-secondary)]">{cohort.questionNumbers.length} questions</span>
              </button>
              <div id={portionsId} hidden={!expanded} className="border-t border-[var(--db-border)] p-2">
                <p className="px-2 pb-1 text-xs font-medium text-[var(--db-text-secondary)]">Paper sections</p>
                {portions.length > 0 ? (
                  <ul className="space-y-1">
                    {portions.map((portion) => (
                      <li key={portion.id}>
                        <button
                          type="button"
                          aria-label={`${portion.sectionLabel ?? `Section ${portion.sectionNumber}`}${portion.status === 'unavailable' ? ', unavailable' : ''}`}
                          aria-pressed={selectedPortionId === portion.id}
                          onClick={() => onSelectPortion(portion.id)}
                          className={`min-h-[44px] w-full rounded-md px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] ${selectedPortionId === portion.id ? 'bg-[var(--db-depth-2)] font-semibold text-[var(--db-text-primary)]' : 'text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)]'}`}
                        >
                          <span className="block break-words">{portion.sectionLabel ?? `Section ${portion.sectionNumber}`}</span>
                          <span className="mt-0.5 block text-xs text-[var(--db-text-secondary)]">{portion.status === 'unavailable' ? 'Not part of this draft' : portion.sourceLocator}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-2 pb-2 text-sm text-[var(--db-text-secondary)]">No paper section is linked to this topic yet.</p>
                )}
                <p className="mt-3 px-2 pb-1 text-xs font-medium text-[var(--db-text-secondary)]">Review questions</p>
                <ul className="space-y-1">
                  {questions.map((question) => {
                    const active = activeQuestionNumber === question.number;
                    return (
                      <li key={question.id}>
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => onSelectQuestion(cohort.id, question.number)}
                          className={`min-h-[44px] w-full rounded-md px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] ${active ? 'bg-[var(--db-accent-tint)] font-semibold text-[var(--db-text-primary)]' : 'text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)]'}`}
                        >
                          <span className="block break-words">Question {question.number}: {question.heading}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
