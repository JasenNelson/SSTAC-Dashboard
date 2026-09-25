import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// MathRenderer is replaced here so the structural checks on the full
// 534,101-byte release stay fast. The unmocked markdown/KaTeX render of every
// chunk (notice count, katex errors, raw markers) is asserted separately in
// PaperDocumentRealRender.test.tsx.
vi.mock('@/components/MathRenderer', () => ({
  default: ({ content, internalLinkMap }: { content: string; internalLinkMap?: Readonly<Record<string, string>> }) => (
    <div data-testid="markdown" data-length={content.length} data-link-map={internalLinkMap ? 'yes' : 'no'} />
  ),
}));

import { paperInlineSegments } from '@/lib/matrix-options/paper/derived-figures';
import { buildLegacyAnchorMap } from '@/lib/matrix-options/paper/full-document';
import { workingDraftSectionHref } from '@/lib/matrix-options/paper/url-state';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { buildPaperUrlContext, getPaperDocumentModel, getPaperNavOutline, PaperDocument } from '../PaperDocument';

describe('PaperDocument on the authenticated release', () => {
  const structure = loadRevisedPaperStructure();
  const model = getPaperDocumentModel(structure);

  it('renders all 341 headings in order through the Technical Appendices Compendium to the last heading', () => {
    const { container } = render(<PaperDocument model={model} />);
    const sections = Array.from(container.querySelectorAll('section[data-paper-chunk]'));
    expect(structure.nodes).toHaveLength(341);
    expect(sections).toHaveLength(341);
    expect(sections.map((section) => section.id)).toEqual(structure.nodes.map((node) => node.anchor));
    expect(container.querySelectorAll('section[data-paper-preamble]')).toHaveLength(0);
    const labelOf = (section: Element) => document.getElementById(section.getAttribute('aria-labelledby') ?? '')?.textContent;
    expect(labelOf(sections[sections.length - 1])).toBe(structure.nodes[structure.nodes.length - 1].label);
    expect(sections.filter((section) => labelOf(section) === 'Technical Appendices Compendium')).toHaveLength(1);
    expect(structure.nodes.some((node) => /^Appendix J\b/i.test(node.label))).toBe(false);
    // Every section's prose goes through the markdown renderer with the link map. A
    // section that holds a figure renders its prose in more than one segment (before
    // and after the figure), so the total follows the figure splitter exactly. The inline
    // stakeholder paper never applies derived figures (owner decision 2026-09-24), so the
    // expected count is computed from the same inline-only segmenter PaperText itself uses.
    const expectedMarkdown = model.chunks.reduce((sum, chunk) => sum + paperInlineSegments(chunk.markdown).filter((segment) => segment.kind === 'markdown').length, 0);
    expect(expectedMarkdown).toBeGreaterThan(341);
    expect(container.querySelectorAll('[data-testid="markdown"][data-link-map="yes"]')).toHaveLength(expectedMarkdown);
    expect(container.querySelectorAll('[data-testid="markdown"][data-link-map="no"]')).toHaveLength(0);
    for (const section of sections) expect(section.querySelector('[data-testid="markdown"][data-link-map="yes"]'), section.id).not.toBeNull();
    expect(container.querySelectorAll('figure[data-paper-figure]')).toHaveLength(12);
    // Derived (PX-1..PX-4) figures are figure-lab only; none render inline.
    expect(container.querySelectorAll('figure[data-derived-figure]')).toHaveLength(0);
    expect(container.querySelectorAll('figure[data-binding="unbound"]')).toHaveLength(0);
    // M1-09: sections are named groups, never 341 region landmarks.
    expect(container.querySelectorAll('section[data-paper-chunk][role="group"]')).toHaveLength(341);
    expect(screen.queryAllByRole('region')).toHaveLength(0);
  });

  it('tiles the successor paper bytes with no gap or overlap', () => {
    expect(model.chunks[0].startByte).toBe(0);
    expect(model.chunks[model.chunks.length - 1].endByte).toBe(541959);
    for (let index = 1; index < model.chunks.length; index += 1) {
      expect(model.chunks[index].startByte).toBe(model.chunks[index - 1].endByte);
    }
  });

  it('resolves every legacy and hand-authored section reference to an in-page heading anchor', () => {
    const anchors = new Set(structure.nodes.map((node) => node.anchor));
    for (const href of Object.values(model.linkMap)) {
      const section = new URLSearchParams(href.slice(1)).get('section') ?? '';
      expect(href).toBe(workingDraftSectionHref(section));
      expect(anchors.has(section)).toBe(true);
    }
    const legacy = buildLegacyAnchorMap(structure);
    expect(Object.keys(legacy)).toHaveLength(117);
    for (const [id, anchor] of Object.entries(legacy)) expect(model.linkMap[id]).toBe(workingDraftSectionHref(anchor));
    const referenced = [...new Set([...structure.content.matchAll(/\]\(#([^)\s]+)\)/g)].map((match) => match[1]))];
    const sectionReferences = referenced.filter((id) => /^(?:sec|app)-/.test(id) || anchors.has(id));
    expect(sectionReferences.length).toBeGreaterThan(0);
    expect(sectionReferences.filter((id) => !model.linkMap[id])).toEqual([]);
  });

  it('exposes a 341-entry outline and URL context for the release', () => {
    expect(getPaperNavOutline(structure)).toHaveLength(341);
    const context = buildPaperUrlContext(structure);
    expect(context.anchors.size).toBe(341);
    expect(context.questionCohort.size).toBe(12);
    expect(context.cohortIds.size).toBe(5);
  });
});
