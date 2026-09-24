import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { appendixLetter, buildPaperNavGroups, CONTENTS_HEADING_LABEL, isContentsHeading, paperNavGroupKey, paperNavPath } from '../paper-nav-groups';
import type { PaperNavNode, PaperNavSourceEntry } from '../paper-nav-groups';
import { APPENDIX_BOUNDARY_LABEL } from '../outline-hierarchy';
import { getPaperNavOutline } from '@/components/matrix-options/paper/PaperDocument';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';

function entry(id: string, label: string, parentId: string | null, childIds: string[], level: number): PaperNavSourceEntry {
  return { id, anchor: `a-${id}`, label, parentId, childIds, level };
}

// A small paper with the real shapes: title root with chapters (one a contents
// heading), the boundary, an appendix root, a banner-introduced appendix and a
// trailing source note.
const synthetic: PaperNavSourceEntry[] = [
  entry('t', 'Paper Title', null, ['toc', 'c1', 'c2'], 1),
  entry('toc', CONTENTS_HEADING_LABEL, 't', [], 2),
  entry('c1', '1.0 Intro', 't', ['c11'], 2),
  entry('c11', '1.1 Detail', 'c1', [], 3),
  entry('c2', '2.0 Methods', 't', [], 2),
  entry('b', APPENDIX_BOUNDARY_LABEL, null, ['bs'], 1),
  entry('bs', 'Compendium subtitle', 'b', [], 2),
  entry('aa', 'Appendix A: First', null, ['aatoc', 'aa1'], 1),
  entry('aatoc', CONTENTS_HEADING_LABEL, 'aa', [], 2),
  entry('aa1', 'A.1 Part', 'aa', [], 2),
  entry('ban', 'Matrix Options evidence and method boundary', null, ['ab'], 1),
  entry('ab', 'Appendix B: Second', 'ban', ['ab1'], 2),
  entry('ab1', 'B.1 Part', 'ab', [], 3),
  entry('src', 'SOURCE: a source note', null, ['src1'], 1),
  entry('src1', 'Resource note', 'src', [], 2),
];

const labels = (nodes: readonly PaperNavNode[]) => nodes.map((node) => node.entry.label);
const allLabels = (nodes: readonly PaperNavNode[]): string[] => nodes.flatMap((node) => [node.entry.label, ...allLabels(node.children)]);

describe('buildPaperNavGroups (synthetic)', () => {
  const [main, appendices] = buildPaperNavGroups(synthetic);

  it('makes exactly two presentation groups, Main Report then Appendices', () => {
    expect(main.label).toBe('Main Report');
    expect(appendices.label).toBe('Appendices');
  });

  it('Main Report: the title is one row and its chapters are the collapsible top-level rows', () => {
    expect(labels(main.nodes)).toEqual(['Paper Title', '1.0 Intro', '2.0 Methods']);
    expect(main.nodes[0].children).toHaveLength(0);
    expect(labels(main.nodes[1].children)).toEqual(['1.1 Detail']);
  });

  it('never shows an exact "Master Table of Contents" entry, in either group', () => {
    const shown = [...allLabels(main.nodes), ...allLabels(appendices.nodes)];
    expect(shown).not.toContain(CONTENTS_HEADING_LABEL);
    // Two-sided: every other entry is still shown.
    expect(shown).toEqual(expect.arrayContaining(['1.1 Detail', 'A.1 Part', 'B.1 Part', 'Resource note', 'Compendium subtitle']));
  });

  it('Appendices: the boundary, then one lettered row per appendix; a banner lives inside the appendix it introduces; a trailing note stays in its appendix', () => {
    expect(labels(appendices.nodes)).toEqual([APPENDIX_BOUNDARY_LABEL, 'Appendix A: First', 'Appendix B: Second']);
    expect(appendices.nodes.map((node) => node.badge ?? null)).toEqual([null, 'A', 'B']);
    const b = appendices.nodes[2];
    expect(labels(b.children)).toEqual(['Matrix Options evidence and method boundary', 'B.1 Part', 'SOURCE: a source note']);
  });

  it('paths open only the group and the necessary ancestors', () => {
    const groups = buildPaperNavGroups(synthetic);
    expect(paperNavPath(groups, synthetic, 'a-c11')).toEqual([paperNavGroupKey('main-report'), 'c1']);
    expect(paperNavPath(groups, synthetic, 'a-c1')).toEqual([paperNavGroupKey('main-report')]);
    expect(paperNavPath(groups, synthetic, 'a-ab1')).toEqual([paperNavGroupKey('appendices'), 'ab']);
    // A hidden contents heading resolves through its shown parent.
    expect(paperNavPath(groups, synthetic, 'a-aatoc')).toEqual([paperNavGroupKey('appendices'), 'aa']);
    expect(paperNavPath(groups, synthetic, 'unknown')).toEqual([]);
    expect(paperNavPath(groups, synthetic, null)).toEqual([]);
  });

  it('exact matching only: a near-miss label is still shown', () => {
    expect(isContentsHeading('Master Table of Contents')).toBe(true);
    expect(isContentsHeading('  Master Table of Contents ')).toBe(true);
    expect(isContentsHeading('Master Table of Contents (draft)')).toBe(false);
    expect(isContentsHeading('Table of Contents')).toBe(false);
    expect(appendixLetter('Appendix H: Policy-ready input parameter compendium')).toBe('H');
    expect(appendixLetter('Appendices overview')).toBeNull();
  });
});

describe('buildPaperNavGroups on the authenticated release', () => {
  const outline = getPaperNavOutline(loadRevisedPaperStructure());
  const [main, appendices] = buildPaperNavGroups(outline);

  it('Main Report holds the report chapters and no appendix; Appendices holds every lettered appendix with its real title', () => {
    expect(labels(main.nodes)).toEqual(expect.arrayContaining(['1.0 Executive Summary', '7.0 Phase 2 Research Topics Supporting the Matrix Options Paper', '19.0 Conclusions and Next Steps']));
    expect(allLabels(main.nodes).some((label) => /^Appendix [A-Z]:/.test(label))).toBe(false);
    const lettered = appendices.nodes.filter((node) => node.badge);
    expect(lettered.map((node) => node.badge)).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']));
    for (const node of lettered) expect(node.entry.label.startsWith(`Appendix ${node.badge}:`)).toBe(true);
  });

  it('shows none of the paper\'s exact "Master Table of Contents" entries (old behavior listed them)', () => {
    expect(outline.filter((item) => isContentsHeading(item.label)).length).toBeGreaterThanOrEqual(2);
    expect([...allLabels(main.nodes), ...allLabels(appendices.nodes)]).not.toContain(CONTENTS_HEADING_LABEL);
  });

  it('keeps every other outline entry reachable exactly once', () => {
    const shown = [...allLabels(main.nodes), ...allLabels(appendices.nodes)];
    expect(shown).toHaveLength(outline.filter((item) => !isContentsHeading(item.label)).length);
  });

  it('a section 7.8 deep link opens Main Report and 7.0 only (not Appendices)', () => {
    const s78 = outline.find((item) => item.label === 'Section 7.8: Input Parameter Inventory and Selection Options')!;
    const chapter7 = outline.find((item) => item.label === '7.0 Phase 2 Research Topics Supporting the Matrix Options Paper')!;
    const path = paperNavPath(buildPaperNavGroups(outline), outline, s78.anchor);
    expect(path).toEqual([paperNavGroupKey('main-report'), chapter7.id]);
  });
});
