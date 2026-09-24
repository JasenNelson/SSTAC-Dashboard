import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import {
  buildPaperUrlContext,
  getPaperDocumentModel,
  getPaperNavOutline,
  PaperDocument,
  resolveLegacySectionAnchor,
  resolveSectionAnchor,
} from '../PaperDocument';

const version = '1.0.11-remediated-7-8-successor-20260918-D';

function syntheticStructure(withPreamble = true): RevisedPaperStructure {
  const content = [
    ...(withPreamble ? ['Preamble text before headings.', ''] : []),
    '# 1 Introduction',
    '',
    'Intro body with [scope link](#sec-1-1), [methods link](#methods) and [raw link](#missing-anchor).',
    '',
    '<div id="sec-1-1" class="section-anchor"></div>',
    '## 1.1 Scope',
    '',
    'Scope body $x^2$ and a [legacy link](#legacy-methods).',
    '',
    '<div id="legacy-methods" class="section-anchor"></div>',
    '# 2 Methods',
    '',
    'Methods body.',
    '',
  ].join('\n');
  const headings = [
    { label: '1 Introduction', depth: 1, anchor: 'intro', marker: '# 1 Introduction', parent: null },
    { label: '1.1 Scope', depth: 2, anchor: 'scope', marker: '## 1.1 Scope', parent: 'node:intro' },
    { label: '2 Methods', depth: 1, anchor: 'methods', marker: '# 2 Methods', parent: null },
  ];
  const nodes = headings.map((heading) => {
    const startByte = content.indexOf(heading.marker);
    return { id: `node:${heading.anchor}`, domain: 'node' as const, kind: 'heading' as const, depth: heading.depth, label: heading.label, parentId: heading.parent, ancestorIds: heading.parent ? [heading.parent] : [], tokenEndByte: startByte + heading.marker.length, anchor: heading.anchor, startByte, endByte: startByte + heading.marker.length };
  });
  const placements = nodes.map((node) => ({ id: node.id, domain: 'node' as const, lens: 'all' as const, label: node.label, reason: 'section', triggers: [], startByte: node.startByte, endByte: node.endByte }));
  return {
    releaseIdentity: 'release',
    content,
    lines: [],
    nodes,
    objects: [],
    questions: [],
    questionContainerIds: [],
    lenses: { all: placements, core: [], appendices: [], evidence: [], objects: [], questions: [] },
    manifest: { source: { version } },
  } as unknown as RevisedPaperStructure;
}

describe('PaperDocument', () => {
  it('renders every chunk in order as focusable, labelled sections with a preamble first', () => {
    const structure = syntheticStructure();
    const { container } = render(<PaperDocument model={getPaperDocumentModel(structure)} />);
    const article = screen.getByTestId('paper-document');
    const allSections = Array.from(article.querySelectorAll(':scope > section'));
    expect(allSections).toHaveLength(4);
    expect(allSections[0]).toHaveAttribute('data-paper-preamble');
    expect(allSections[0]).not.toHaveAttribute('id');
    expect(allSections[0]).toHaveTextContent('Preamble text before headings.');
    const headingSections = Array.from(container.querySelectorAll('section[data-paper-chunk]'));
    expect(headingSections.map((section) => section.id)).toEqual(['intro', 'scope', 'methods']);
    for (const [index, section] of headingSections.entries()) {
      expect(section).toHaveAttribute('tabindex', '-1');
      const labelId = section.getAttribute('aria-labelledby') ?? '';
      expect(document.getElementById(labelId)).toHaveTextContent(['1 Introduction', '1.1 Scope', '2 Methods'][index]);
      // M1R2 S1: content-visibility/contain-intrinsic-size are gone (their skipped
      // -content height estimates made depth-1 jumps land short); scroll margin
      // below lg now follows the measured sticky header height.
      expect(section.className).not.toContain('content-visibility');
      expect(section.className).not.toContain('contain-intrinsic-size');
      expect(section.className).toContain('scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)]');
      expect(section.className).toContain('lg:scroll-mt-4');
    }
    // M1-09: named groups, not region landmarks; paper headings demoted one level so no h1 is rendered.
    expect(screen.getByRole('group', { name: '1.1 Scope' })).toBe(document.getElementById('scope'));
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    for (const section of headingSections) expect(section).toHaveAttribute('role', 'group');
    expect(within(document.getElementById('scope') as HTMLElement).getByRole('heading', { level: 3 })).toHaveTextContent('1.1 Scope');
    expect(within(document.getElementById('intro') as HTMLElement).getByRole('heading', { level: 2 })).toHaveTextContent('1 Introduction');
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(document.getElementById('scope')?.querySelector('.katex')).not.toBeNull();
    expect(container.querySelector('#sec-1-1')).toBeNull();
    expect(container.textContent).not.toContain('section-anchor');
  });

  it('rewrites legacy and section anchors to in-page links and leaves unknown anchors untouched', () => {
    const structure = syntheticStructure();
    const model = getPaperDocumentModel(structure);
    // legacy-methods is outside the sec-/app- heuristic, so only buildLegacyAnchorMap can resolve it.
    // M1-04: in-page references carry the canonical Working Draft section query, never a bare #hash.
    const href = (anchor: string) => `?mode=working-draft&section=${anchor}`;
    expect(model.linkMap).toEqual({ intro: href('intro'), scope: href('scope'), methods: href('methods'), 'sec-1-1': href('scope'), 'legacy-methods': href('methods') });
    render(<PaperDocument model={model} />);
    expect(screen.getByRole('link', { name: 'legacy link' })).toHaveAttribute('href', href('methods'));
    expect(screen.getByRole('link', { name: 'scope link' })).toHaveAttribute('href', href('scope'));
    expect(screen.getByRole('link', { name: 'methods link' })).toHaveAttribute('href', href('methods'));
    expect(screen.getByRole('link', { name: 'raw link' })).toHaveAttribute('href', '#missing-anchor');
  });

  it('M1-07: resolves a legacy section id to a heading anchor, its legacy div mapping, or nothing', () => {
    const structure = syntheticStructure();
    expect(resolveLegacySectionAnchor(structure, 'scope')).toBe('scope');
    expect(resolveLegacySectionAnchor(structure, 'sec-1-1')).toBe('scope');
    expect(resolveLegacySectionAnchor(structure, 'legacy-methods')).toBe('methods');
    expect(resolveLegacySectionAnchor(structure, 'sec%2D1%2D1')).toBe('scope');
    expect(resolveLegacySectionAnchor(structure, '%E0%A4%A')).toBeNull();
    expect(resolveLegacySectionAnchor(structure, 'unknown-section')).toBeNull();
    expect(resolveLegacySectionAnchor(structure, '__proto__')).toBeNull();
    expect(resolveLegacySectionAnchor(structure, 'constructor')).toBeNull();
  });

  it('caches derived models per structure and keeps nav outline entries free of byte ranges', () => {
    const structure = syntheticStructure(false);
    expect(getPaperDocumentModel(structure)).toBe(getPaperDocumentModel(structure));
    expect(getPaperDocumentModel(structure)).not.toBe(getPaperDocumentModel(syntheticStructure(false)));
    const outline = getPaperNavOutline(structure);
    expect(getPaperNavOutline(structure)).toBe(outline);
    expect(outline.map((entry) => Object.keys(entry).sort())).toEqual(Array(3).fill(['anchor', 'childIds', 'depth', 'id', 'label', 'level', 'parentId']));
    expect(outline[0].childIds).toEqual(['node:scope']);
    expect(getPaperDocumentModel(structure).chunks[0].startByte).toBe(0);
  });

  it('resolves child-route identities to a heading anchor or the containing chunk', () => {
    const structure = syntheticStructure();
    const scope = structure.nodes[1];
    const methods = structure.nodes[2];
    expect(resolveSectionAnchor(structure, 'node:scope', 0)).toBe('scope');
    expect(resolveSectionAnchor(structure, null, methods.startByte + 3)).toBe('methods');
    expect(resolveSectionAnchor(structure, 'node:unknown', scope.startByte + 1)).toBe('scope');
    expect(resolveSectionAnchor(structure, null, 0)).toBeNull();
  });

  it('builds URL context from heading anchors and the reviewer-guide cohort bindings', () => {
    const context = buildPaperUrlContext(syntheticStructure());
    expect([...context.anchors]).toEqual(['intro', 'scope', 'methods']);
    expect(context.cohortIds.size).toBe(5);
    expect(context.questionCohort.size).toBe(12);
    expect(context.questionCohort.get(`rpq:${version}:q01`)).toBe('categories');
  });
});
