import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortPortion } from '@/lib/matrix-options/paper/cohort-portions';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

import { CohortReviewNav } from '../CohortReviewNav';

const cohortManifest = getCohortManifest();
const reviewerGuide = getReviewerGuideContract();
const categories = cohortManifest.cohorts.find((cohort) => cohort.id === 'categories');
if (!categories) throw new Error('fixture: categories cohort missing');

function portionFor(cohortId: string, overrides: Partial<CohortPortion> = {}): CohortPortion {
  return {
    id: `${cohortId}:portion`,
    cohortId: cohortId as CohortPortion['cohortId'],
    name: cohortId,
    status: 'available',
    sectionNumber: '4.1',
    sourceLocator: 'Section 4.1',
    sourceNodeId: `node:${cohortId}`,
    sectionLabel: `${cohortId} label`,
    startByte: 0,
    endByte: 10,
    text: '# heading\n\nbody',
    sectionAnchor: `anchor-${cohortId}`,
    ...overrides,
  };
}

function renderNav(overrides: Partial<Parameters<typeof CohortReviewNav>[0]> = {}) {
  const onSelectCohort = vi.fn();
  const onSelectPortion = vi.fn();
  const onSelectQuestion = vi.fn();
  render(
    <CohortReviewNav
      cohortManifest={cohortManifest}
      cohortPortions={cohortManifest.cohorts.map((cohort) => portionFor(cohort.id))}
      reviewerGuide={reviewerGuide}
      selectedCohortId="categories"
      expandedCohortId="categories"
      selectedPortionId="categories:portion"
      activeQuestionNumber={1}
      onSelectCohort={onSelectCohort}
      onSelectPortion={onSelectPortion}
      onSelectQuestion={onSelectQuestion}
      {...overrides}
    />,
  );
  return { onSelectCohort, onSelectPortion, onSelectQuestion };
}

describe('CohortReviewNav', () => {
  it('M2: renders exactly 5 collapsible cohort disclosures with aria-expanded and aria-controls', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'Review cohorts' });
    const buttons = within(nav).getAllByRole('button', { name: /questions$/ });
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button).toHaveAttribute('aria-expanded');
      expect(button).toHaveAttribute('aria-controls');
    }
  });

  it('M2: an expanded cohort lists both its authenticated portions and its review questions', () => {
    renderNav();
    const disclosure = document.getElementById('cohort-categories-portions');
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute('hidden');
    const questionButtons = within(disclosure as HTMLElement).getAllByRole('button', { name: /^Question \d+:/ });
    expect(questionButtons).toHaveLength(categories.questionNumbers.length);
    expect(questionButtons[0]).toHaveTextContent(`Question ${categories.questionNumbers[0]}`);
    expect(within(disclosure as HTMLElement).getByRole('button', { name: /categories label/ })).toBeInTheDocument();
  });

  it('M2: a collapsed cohort disclosure is hidden and lists nothing visible', () => {
    renderNav({ expandedCohortId: null });
    expect(document.getElementById('cohort-categories-portions')).toHaveAttribute('hidden');
  });

  it('M2: the active question carries aria-current and others do not', () => {
    renderNav({ activeQuestionNumber: categories.questionNumbers[0] });
    const active = screen.getByRole('button', { name: `Question ${categories.questionNumbers[0]}: ${reviewerGuide.questions.find((q) => q.number === categories.questionNumbers[0])?.heading}` });
    expect(active).toHaveAttribute('aria-current', 'true');
    const other = screen.getByRole('button', { name: `Question ${categories.questionNumbers[1]}: ${reviewerGuide.questions.find((q) => q.number === categories.questionNumbers[1])?.heading}` });
    expect(other).not.toHaveAttribute('aria-current');
  });

  it('M2: clicking a question button calls onSelectQuestion with its cohort id and number, never a reveal request', () => {
    const { onSelectQuestion } = renderNav();
    const number = categories.questionNumbers[1];
    const question = reviewerGuide.questions.find((q) => q.number === number);
    fireEvent.click(screen.getByRole('button', { name: `Question ${number}: ${question?.heading}` }));
    expect(onSelectQuestion).toHaveBeenCalledWith('categories', number);
  });

  it('M2: question buttons are plain <button> elements -- never select, checkbox, radio or label (gesture-grouping safety)', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'Review cohorts' });
    expect(within(nav).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(nav).queryAllByRole('radio')).toHaveLength(0);
    expect(within(nav).queryAllByRole('combobox')).toHaveLength(0);
    expect(nav.querySelectorAll('label')).toHaveLength(0);
  });

  it('M2: preserves the existing portion list behavior (aria-pressed, unavailable label)', () => {
    const unavailable = portionFor('pathway-grid', { status: 'unavailable', sectionAnchor: undefined });
    renderNav({ expandedCohortId: 'pathway-grid', cohortPortions: [portionFor('categories'), unavailable] });
    const button = screen.getByRole('button', { name: `${unavailable.sectionLabel}, unavailable` });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('M2: an empty portion list still shows the truthful "no portion" message alongside its questions', () => {
    renderNav({ expandedCohortId: 'exposure-assumptions', cohortPortions: [portionFor('categories')] });
    const disclosure = document.getElementById('cohort-exposure-assumptions-portions');
    expect(disclosure).toHaveTextContent('No authenticated paper portion is available for this cohort.');
    expect(within(disclosure as HTMLElement).getAllByRole('button', { name: /^Question \d+:/ }).length).toBeGreaterThan(0);
  });
});
