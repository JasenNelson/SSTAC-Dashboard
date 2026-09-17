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
  parseDetailQuery,
  parseAtlasQuery,
  parseWorkspaceMode,
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

  it('parses Working Draft as the default mode and publication as its alias', () => {
    expect(parseWorkspaceMode(undefined)).toBe('working-draft');
    expect(parseWorkspaceMode('working-draft')).toBe('working-draft');
    expect(parseWorkspaceMode('publication')).toBe('working-draft');
    expect(parseWorkspaceMode(['publication'])).toBe('working-draft');
    expect(parseWorkspaceMode('my-review')).toBe('my-review');
    expect(() => parseWorkspaceMode('Publication')).toThrow(/INVALID_LENS/);
    expect(() => parseWorkspaceMode(['my-review', 'working-draft'])).toThrow(/REPEATED_PARAMETER/);
  });

  it('resets inherited detail pages only when q is absent', () => {
    expect(parseDetailQuery({ page: '2' }, 'all')).toEqual({
      lens: 'all',
      q: '',
      page: 1,
    });
    expect(parseDetailQuery({ q: 'broad', page: '2' }, 'all')).toEqual({
      lens: 'all',
      q: 'broad',
      page: 2,
    });
    expect(() => parseDetailQuery({ page: ['1', '2'] }, 'all')).toThrow(/REPEATED_PARAMETER/);
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

  it('routes compiler objects to their canonical detail URLs', () => {
    const structure = loadRevisedPaperStructure();
    expect(structure.objects.length).toBeGreaterThan(0);
    for (const object of structure.objects) {
      const rows = createAtlasWindow(structure, { lens: 'objects', q: object.label, page: 1 }).rows;
      const row = rows.find((candidate) => candidate.id === object.id);
      expect(row?.href).toContain(`/nodes/${encodeURIComponent(object.id)}`);
    }
  });

  it('keeps real long-label detail pages unfiltered unless q is explicit', () => {
    const structure = loadRevisedPaperStructure();
    const tables = structure.objects.filter((object) => object.domain === 'object.table');
    const longestNode = structure.nodes.reduce((longest, node) => node.label.length > longest.label.length ? node : longest, structure.nodes[0]);
    const longestQuestion = structure.questions.reduce((longest, question) => question.label.length > longest.label.length ? question : longest, structure.questions[0]);
    expect(tables).toHaveLength(45);
    expect(longestNode.label.length).toBeGreaterThan(80);
    expect(longestQuestion.label.length).toBeGreaterThan(80);

    const unfiltered = createWorkspaceModel(structure, parseDetailQuery({ page: '2' }, 'objects'), 'working-draft', {
      id: tables[0].id,
      domain: tables[0].domain,
      label: tables[0].label,
      startByte: tables[0].startByte,
      endByte: tables[0].endByte,
      ownerNodeId: tables[0].ownerNodeId,
    });
    expect(unfiltered.atlas.query).toEqual({ lens: 'objects', q: '', page: 1 });
    expect(unfiltered.requestedDetail?.id).toBe(tables[0].id);

    const explicit = createWorkspaceModel(structure, parseDetailQuery({ q: '|', page: '2' }, 'objects'), 'working-draft');
    expect(explicit.atlas.query).toEqual({ lens: 'objects', q: '|', page: 2 });
    expect(() => createWorkspaceModel(structure, parseDetailQuery({ q: 'not-a-real-label', page: '2' }, 'objects'))).toThrow(/PAGE_OUT_OF_RANGE/);
    expect(() => parseDetailQuery({ q: ['table', 'question'] }, 'objects')).toThrow(/REPEATED_PARAMETER/);
    expect(() => parseDetailQuery({ lens: ['objects', 'all'] }, 'objects')).toThrow(/REPEATED_PARAMETER/);
  });

  it('maps authenticated source anchors to canonical routes while preserving query state', () => {
    const structure = loadRevisedPaperStructure();
    const model = createWorkspaceModel(structure, { lens: 'all', q: 'section', page: 1 }, 'my-review');
    const sourceAnchorIds = [...structure.content.matchAll(/\(#((?:sec|app)-[^)]+)\)/g)].map((match) => match[1]);
    expect(sourceAnchorIds).toHaveLength(130);
    expect(new Set(sourceAnchorIds).size).toBe(130);
    const markerIds = new Set([...structure.content.matchAll(/<div id="((?:sec|app)-[^"]+)" class="section-anchor"><\/div>/g)].map((match) => match[1]));
    expect(sourceAnchorIds.filter((anchor) => !markerIds.has(anchor))).toEqual([
      'sec-7-1', 'sec-7-2', 'sec-7-3', 'sec-7-4', 'sec-7-5', 'sec-7-6', 'sec-7-7', 'sec-7-8',
      'sec-8-0', 'sec-9-9-1', 'sec-9-9-2', 'sec-9-9-3', 'sec-9-9-4', 'sec-13-0', 'sec-15-5', 'sec-15-6',
    ]);
    expect(sourceAnchorIds.filter((anchor) => !model.internalLinkMap[anchor])).toEqual([]);
    const anchoredNodes = structure.nodes.filter((node) => node.anchor);
    expect(Object.keys(model.internalLinkMap).length).toBeGreaterThanOrEqual(anchoredNodes.length);
    const expectedNodeForLabel = (label: string) => {
      const node = structure.nodes.find((candidate) => candidate.label === label);
      expect(node, `authenticated fixture node: ${label}`).toBeDefined();
      return node!;
    };
    const expectedHref = (anchor: string, label: string) => {
      const node = expectedNodeForLabel(label);
      expect(model.internalLinkMap[anchor]).toBe(
        `/matrix-options/paper/publication/v/${encodeURIComponent(structure.manifest.source.version)}/nodes/${encodeURIComponent(node.id)}?mode=my-review&lens=all&page=1&q=section`,
      );
    };
    // These source-contract labels independently bind same-section, cross-section,
    // and the non-heading 7.8 alias to their canonical compiler identities.
    expectedHref('sec-7-1', '7.1 Bioavailability Adjustment');
    expectedHref('sec-7-2', 'Section 7.2 Bioaccumulation draft text');
    expectedHref('sec-7-3', '7.3 Substance Classification');
    expectedHref('sec-7-4', '7.4 Substance Prioritization');
    expectedHref('sec-7-5', '7.5.1 Scope');
    expectedHref('sec-7-6', '7.6 Generic Standards Adoption Procedure');
    expectedHref('sec-7-7', '7.7 BC Aquatic Database');
    expectedHref('sec-7-8', 'Policy-ready input categories - Phase 2 boundary');
    expectedHref('sec-8-0', '8.0 Evaluation Criteria');
    expectedHref('sec-9-9-1', '9.9.1 The four options');
    expectedHref('sec-9-9-2', '9.9.2 What the options actually differ on');
    expectedHref('sec-9-9-3', '9.9.3 The exposure terms, and where they come from');
    expectedHref('sec-9-9-4', '9.9.4 What the Technical Working Group is asked to decide');
    expectedHref('sec-13-0', '13.0 Phase 2 Workstreams, Schedule, and the Status of This Draft');
    expectedHref('sec-15-5', '15.5 Governing input evidence gaps');
    expectedHref('sec-15-6', '15.6 There is no British Columbia protocol for sediment background concentrations');
    expect(model.internalLinkMap[anchoredNodes[0].anchor]).toContain(`/nodes/${encodeURIComponent(anchoredNodes[0].id)}`);
    expect(model.internalLinkMap[anchoredNodes[0].anchor]).toContain('mode=my-review');
    expect(model.internalLinkMap[anchoredNodes[0].anchor]).toContain('q=section');
    const finalNode = anchoredNodes[anchoredNodes.length - 1];
    expect(model.internalLinkMap[finalNode.anchor]).toContain(`/nodes/${encodeURIComponent(finalNode.id)}`);
    expect(model.internalLinkMap[finalNode.anchor]).not.toBe(model.internalLinkMap[anchoredNodes[0].anchor]);
  });

  it('pins only at the deterministic 45rem threshold', () => {
    expect(isPinEligible(719.84, 16, 0)).toBe(false);
    expect(isPinEligible(720, 16, 0)).toBe(true);
    expect(isPinEligible(960, 16, 1)).toBe(true);
    expect(isPinEligible(960, 16, 1.01)).toBe(false);
    expect(isPinEligible(Number.NaN, 16, 0)).toBe(false);
  });
});
