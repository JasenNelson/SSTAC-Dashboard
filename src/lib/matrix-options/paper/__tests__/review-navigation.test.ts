import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getPaperNavOutline } from '@/components/matrix-options/paper/PaperDocument';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { buildReviewNavigation, portionMatchesQuestion, questionCitations, questionTitle } from '../review-navigation';

describe('shared review navigation model on the authenticated release', () => {
  const outline = getPaperNavOutline(loadRevisedPaperStructure());
  const model = buildReviewNavigation(getCohortManifest(), getReviewerGuideContract(), outline);
  const anchorOf = (label: string) => outline.find((entry) => entry.label === label)!.anchor;

  it('groups all 12 questions under the paper topics, Question 8 under Inputs and evidence', () => {
    expect(model.topics.map((topic) => topic.name)).toEqual(['Categories', 'Pathway and grid', 'Exposure assumptions', 'Inputs and evidence', 'Methods and water type']);
    expect(model.questions).toHaveLength(12);
    expect(model.topicForQuestion(8)?.name).toBe('Inputs and evidence');
    expect(model.topics.find((topic) => topic.id === 'inputs-evidence')?.questions.map((question) => question.number)).toEqual([8, 9, 12]);
  });

  it('section 7.8 and its subsections surface Question 8 (most specific citation), not Question 6', () => {
    for (const label of [
      'Section 7.8: Input Parameter Inventory and Selection Options',
      '7.8.1 Inventory, provenance and status discipline',
      'Policy-ready input categories - Phase 2 boundary',
    ]) {
      expect(model.questionForAnchor(anchorOf(label))?.number).toBe(8);
    }
    // Two-sided: 7.8 is also cited by Question 6 (Exposure assumptions); a
    // first-topic-wins mapping would have picked it.
    expect(model.questionsForAnchor(anchorOf('Section 7.8: Input Parameter Inventory and Selection Options')).map((question) => question.number)).toEqual([8, 9, 6, 7, 12]);
  });

  it('maps other sections to their citing questions and leaves uncited sections unmapped', () => {
    expect(model.questionForAnchor(anchorOf('4.1 Part 1: Matrix Numerical Sediment Standards & Four Proposed Sediment Uses'))?.number).toBe(1);
    expect(model.questionForAnchor(anchorOf('7.5.1 Scope'))?.number).toBe(6);
    expect(model.questionForAnchor(anchorOf('7.7 BC Aquatic Database'))?.number).toBe(12);
    expect(model.questionForAnchor(anchorOf('6.2 Ecological Health, Food-Pathway Exposure (Pathway 4)'))?.number).toBe(4);
    expect(model.questionForAnchor(anchorOf('4.4.2 The structure the in-force schedule already uses'))?.number).toBe(11);
    expect(model.questionForAnchor(anchorOf('8.0 Evaluation Criteria'))).toBeUndefined();
    expect(model.questionForAnchor('no-such-anchor')).toBeUndefined();
  });

  it('opens each question at its most specific cited section', () => {
    expect(model.anchorForQuestion(8)).toBe(anchorOf('Section 7.8: Input Parameter Inventory and Selection Options'));
    expect(model.anchorForQuestion(6)).toBe(anchorOf('7.5.1 Scope'));
    expect(model.anchorForQuestion(11)).toBe(anchorOf('4.4.2 The structure the in-force schedule already uses'));
    for (const question of model.questions) expect(model.anchorForQuestion(question.number)).toBeTruthy();
  });

  it('parses heading citations and titles', () => {
    expect(questionCitations('On data (Sections 7.7 and 7.8)')).toEqual([[7, 7], [7, 8]]);
    expect(questionCitations('On receptors and pathways (Sections 4.1 and 6.0)')).toEqual([[4, 1], [6]]);
    expect(questionCitations('On water type')).toEqual([]);
    expect(questionTitle('On input parameter selection (Section 7.8)')).toBe('On input parameter selection');
    expect(portionMatchesQuestion('7.8', model.questions.find((question) => question.number === 8)!)).toBe(true);
    expect(portionMatchesQuestion('7.7', model.questions.find((question) => question.number === 8)!)).toBe(false);
  });

  // (f) Two-sided: a wrong ranking (e.g. first-topic-wins, as note 32-33 above
  // already guards for the anchor path) would put a different question first
  // here; a missing bogus-input guard would throw or return something other
  // than an empty array instead of failing closed.
  it('(f) questionsForSection ranks directly from a section number string, and fails closed on a non-numeric one', () => {
    expect(model.questionsForSection('7.8').map((question) => question.number)).toEqual([8, 9, 6, 7, 12]);
    expect(model.questionsForSection('bogus')).toEqual([]);
  });
});
