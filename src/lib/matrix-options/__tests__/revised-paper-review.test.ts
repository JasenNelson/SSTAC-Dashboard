import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadRevisedPaperStructure } from '../revised-paper-structure';
import {
  ATLAS_PAGE_SIZE,
  createAssignedForTest,
  createAtlasWindow,
  createLedgerSummary,
  createNoAssignmentForTest,
  createWorkspaceModel,
  getProductionAssignment,
  isPinEligible,
  parseAtlasQuery,
  releaseNoteKey,
  REVIEW_DISPOSITIONS,
  REVIEW_NONTERMINAL_CATEGORIES,
  ReviewQueryError,
} from '../revised-paper-review';

describe('revised paper review contracts', () => {
  it('keeps the production assignment adapter unavailable and truthful', () => {
    expect(getProductionAssignment()).toEqual({
      state: 'ASSIGNMENT_UNAVAILABLE',
      reasonCode: 'LIVE_ASSIGNMENT_SOURCE_NOT_AUTHORIZED',
    });
    expect(createNoAssignmentForTest()).toEqual({
      state: 'NO_ASSIGNMENT',
      reasonCode: 'AUTHORITATIVE_EMPTY',
    });
    expect(createAssignedForTest('assignment-1', 'Assigned packet')).toEqual({
      state: 'ASSIGNED',
      assignmentId: 'assignment-1',
      title: 'Assigned packet',
    });
  });

  it('validates canonical scalar lens, q, and page parameters', () => {
    expect(parseAtlasQuery({})).toEqual({ lens: 'all', q: '', page: 1 });
    expect(parseAtlasQuery({ lens: 'questions', q: '  Question  ', page: '2' })).toEqual({
      lens: 'questions',
      q: 'Question',
      page: 2,
    });
    expect(() => parseAtlasQuery({ lens: ['all', 'objects'] })).toThrow(ReviewQueryError);
    expect(() => parseAtlasQuery({ q: ['a', 'b'] })).toThrow(ReviewQueryError);
    expect(() => parseAtlasQuery({ lens: 'bad' })).toThrow(/INVALID_LENS/);
    expect(() => parseAtlasQuery({ page: '01' })).toThrow(/INVALID_PAGE/);
    expect(() => parseAtlasQuery({ page: '0' })).toThrow(/INVALID_PAGE/);
    expect(() => parseAtlasQuery({ q: 'a'.repeat(161) })).toThrow(/QUERY_TOO_LONG/);
  });

  it('bounds server atlas windows to 40 rows and never changes source labels', () => {
    const structure = loadRevisedPaperStructure();
    const first = createAtlasWindow(structure, { lens: 'all', q: '', page: 1 });
    expect(first.rows).toHaveLength(ATLAS_PAGE_SIZE);
    expect(first.totalMatches).toBe(structure.nodes.length);
    expect(first.totalPages).toBe(Math.ceil(structure.nodes.length / ATLAS_PAGE_SIZE));
    expect(first.rows[0].label).toBe(structure.nodes[0].label);
    expect(first.rows[0].href).toContain('/matrix-options/paper/publication/v/');
    const last = createAtlasWindow(structure, { lens: 'all', q: '', page: first.totalPages });
    expect(last.rows.length).toBeLessThanOrEqual(ATLAS_PAGE_SIZE);
    expect(() => createAtlasWindow(structure, { lens: 'all', q: '', page: first.totalPages + 1 }))
      .toThrow(/PAGE_OUT_OF_RANGE/);
  });

  it('derives packet, trust, and separate seven-category ledgers from compiler output', () => {
    const structure = loadRevisedPaperStructure();
    const model = createWorkspaceModel(structure);
    expect(REVIEW_DISPOSITIONS).toEqual([
      'FEEDBACK_SUBMITTED',
      'NO_FEEDBACK_CONFIRMED',
      'DEFERRED_WITH_REASON',
      'ESCALATED_WITH_REASON',
    ]);
    expect(model.assignment.state).toBe('ASSIGNMENT_UNAVAILABLE');
    expect(model.questionPacket.length).toBe(structure.questions.length);
    expect(model.readerContext.neighborhood.length).toBeLessThanOrEqual(5);
    expect(model.readerContext.selectedId).toBe(model.atlas.rows[0]?.id);
    expect(model.trust).toEqual({
      artifactAuthentication: 'EXACT_BYTES_VERIFIED',
      provenance: 'REPOSITORY_ARTIFACT',
      humanReview: 'NONE_RECORDED',
      humanReviewDate: null,
      mappingConfidence: 'EXACT_SOURCE_RANGE',
      staleness: 'CURRENT_EXACT_RELEASE',
    });
    expect(Object.keys(model.ledgers.dispositions)).toEqual(REVIEW_DISPOSITIONS);
    expect(Object.keys(model.ledgers.nonterminal)).toEqual(REVIEW_NONTERMINAL_CATEGORIES);
    expect(Object.values(model.ledgers.dispositions).some((count) => count > 0)).toBe(false);
    expect(Object.values(model.ledgers.nonterminal).reduce((a, b) => a + b, 0)).toBe(structure.questions.length);
    expect(model).not.toHaveProperty('nodes');
    expect(model).not.toHaveProperty('objects');
  });

  it('keeps no-assignment separate from unavailable ledgers and binds notes to release', () => {
    const none = createLedgerSummary(createNoAssignmentForTest(), 9);
    const assigned = createLedgerSummary(createAssignedForTest('a', 'A'), 9);
    expect(none.nonterminal).toEqual({ UNASSIGNED: 9, NOT_STARTED: 0, UNAVAILABLE: 0 });
    expect(assigned.nonterminal).toEqual({ UNASSIGNED: 0, NOT_STARTED: 9, UNAVAILABLE: 0 });
    expect(releaseNoteKey('release-a', 'node-a')).toBe('matrix-paper-v16:notes:release-a:node-a');
    expect(releaseNoteKey('release-b', 'node-a')).not.toBe(releaseNoteKey('release-a', 'node-a'));
  });

  it('pins only at the deterministic 45rem threshold', () => {
    expect(isPinEligible(719.84, 16, 0)).toBe(false);
    expect(isPinEligible(720, 16, 0)).toBe(true);
    expect(isPinEligible(960, 16, 1)).toBe(true);
    expect(isPinEligible(960, 16, 1.01)).toBe(false);
    expect(isPinEligible(Number.NaN, 16, 0)).toBe(false);
  });
});
