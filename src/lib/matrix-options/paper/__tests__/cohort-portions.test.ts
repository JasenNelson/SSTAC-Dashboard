import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getCohortManifest, type CohortManifest } from '../../cohort-contract';
import { loadRevisedPaperStructure, type RevisedPaperNode } from '../../revised-paper-structure';
import { sourceRangeText } from '../../revised-paper-review';
import {
  deriveCohortPortions,
  sectionNumberFromHeading,
  sectionNumbersFromLocator,
  type CohortPortion,
} from '../cohort-portions';
import { stripStandaloneSectionAnchorLines } from '../full-document';
import { presentWithheldSections, shownWithheldEntryCount } from '../withheld-sections';

/*
 * REFERENCE: verbatim copy of the pre-refactor algorithm from
 * src/app/(dashboard)/matrix-options/paper/publication/v/[documentVersion]/page.tsx
 * at HEAD 3520aa3e (normalizeSectionNumber .. deriveCohortPortions), used only
 * to prove the library preserves results for the real paper.
 */
function refNormalizeSectionNumber(value: string): string {
  return value.replace(/\.0$/, '');
}

function refSectionNumbersFromLocator(locator: string): readonly string[] {
  if (/Reviewer's Guide/i.test(locator)) return [];
  return [...locator.matchAll(/\b\d+(?:\.\d+)+\b|\b\d{1,2}\b/g)].map((match) => refNormalizeSectionNumber(match[0]));
}

function refSectionNumberFromHeading(label: string): string | undefined {
  const match = label.match(/^\s*(\d+(?:\.\d+)*)(?:\s|[.:]|$)/);
  return match ? refNormalizeSectionNumber(match[1]) : undefined;
}

interface RefResolvedCohortSection {
  readonly sectionNumber: string;
  readonly sourceLocator: string;
  readonly nodes: readonly RevisedPaperNode[];
}

function refResolveCohortSectionNodes(nodes: readonly RevisedPaperNode[], cohort: CohortManifest['cohorts'][number]): readonly RefResolvedCohortSection[] {
  const appendixBoundaries = nodes.reduce<number[]>((indexes, node, index) => {
    if (node.depth === 1 && node.label === 'Technical Appendices Compendium') indexes.push(index);
    return indexes;
  }, []);
  if (appendixBoundaries.length !== 1) throw new Error(`Expected exactly one authenticated appendix boundary; found ${appendixBoundaries.length}`);
  const appendixBoundary = appendixBoundaries[0];
  const canonicalNodes = nodes.slice(0, appendixBoundary).filter((node) => node.kind === 'heading');
  const requestedNumbers = [...new Set(cohort.sourceLocators.flatMap(refSectionNumbersFromLocator))];
  if (requestedNumbers.length === 0) throw new Error(`Cohort has no paper section locators: ${cohort.id}`);
  return requestedNumbers.map((sectionNumber) => {
    const sourceLocator = cohort.sourceLocators.find((locator) => !/Reviewer's Guide/i.test(locator) && refSectionNumbersFromLocator(locator).includes(sectionNumber)) ?? `Section ${sectionNumber}`;
    const matches = canonicalNodes.filter((node) => {
      const headingNumber = refSectionNumberFromHeading(node.label);
      return headingNumber === sectionNumber || headingNumber?.startsWith(`${sectionNumber}.`);
    });
    const exact = matches.filter((node) => refSectionNumberFromHeading(node.label) === sectionNumber);
    if (exact.length > 1) throw new Error(`Ambiguous canonical paper heading for ${cohort.id} section ${sectionNumber}`);
    if (exact.length === 1) return { sectionNumber, sourceLocator, nodes: exact };
    const children = matches
      .filter((node) => refSectionNumberFromHeading(node.label)?.startsWith(`${sectionNumber}.`) && node.parentId === matches[0]?.parentId)
      .sort((a, b) => a.startByte - b.startByte);
    const childNumbers = children.map((node) => refSectionNumberFromHeading(node.label)?.slice(sectionNumber.length + 1));
    const consecutive = children.length > 0 && childNumbers.every((value, index) => value === String(index + 1));
    return consecutive ? { sectionNumber, sourceLocator, nodes: children } : { sectionNumber, sourceLocator, nodes: [] };
  });
}

function refDeriveCohortPortions(structure: { readonly content: string; readonly nodes: readonly RevisedPaperNode[] }, manifest: CohortManifest): readonly Omit<CohortPortion, 'sectionAnchor'>[] {
  const portions = manifest.cohorts.flatMap((cohort) => refResolveCohortSectionNodes(structure.nodes, cohort).map((resolved) => {
    if (resolved.nodes.length === 0) return { id: `${cohort.id}:section-${resolved.sectionNumber}`, cohortId: cohort.id, name: cohort.name, status: 'unavailable' as const, sectionNumber: resolved.sectionNumber, sourceLocator: resolved.sourceLocator, sectionLabel: `Section ${resolved.sectionNumber}` };
    const first = resolved.nodes[0];
    const last = resolved.nodes.at(-1) ?? first;
    const text = sourceRangeText(structure.content, first.startByte, last.endByte);
    if (!text.trim()) throw new Error(`Authenticated paper section is empty: ${cohort.id}/${resolved.sectionNumber}`);
    return {
      id: `${cohort.id}:${resolved.sectionNumber}`,
      cohortId: cohort.id,
      name: cohort.name,
      status: 'available' as const,
      sectionNumber: resolved.sectionNumber,
      sourceLocator: resolved.sourceLocator,
      sourceNodeId: resolved.nodes.length === 1 ? first.id : `${first.id}..${last.id}`,
      sectionLabel: resolved.nodes.length === 1 ? first.label : `Section ${resolved.sectionNumber} (${refSectionNumberFromHeading(first.label)}-${refSectionNumberFromHeading(last.label)})`,
      startByte: first.startByte,
      endByte: last.endByte,
      text,
    };
  }));
  if (portions.length === 0) throw new Error('Cohort manifest resolved no authenticated paper sections');
  return portions;
}

function withoutAnchor(portion: CohortPortion): Omit<CohortPortion, 'sectionAnchor'> {
  const { sectionAnchor: _sectionAnchor, ...rest } = portion;
  return rest;
}

function synthetic(content: string): { readonly content: string; readonly nodes: readonly RevisedPaperNode[] } {
  const lines = content.split('\n');
  const headings: { depth: number; label: string; startByte: number }[] = [];
  let offset = 0;
  for (const line of lines) {
    const match = /^(#{1,6}) (.*)$/.exec(line);
    if (match) headings.push({ depth: match[1].length, label: match[2], startByte: offset });
    offset += Buffer.byteLength(line, 'utf8') + 1;
  }
  const total = Buffer.byteLength(content, 'utf8');
  const nodes: RevisedPaperNode[] = [];
  const stack: number[] = [];
  headings.forEach((heading, index) => {
    while (stack.length > 0 && nodes[stack[stack.length - 1]].depth >= heading.depth) stack.pop();
    const parentIndex = stack.length > 0 ? stack[stack.length - 1] : -1;
    const later = headings.slice(index + 1).find((candidate) => candidate.depth <= heading.depth);
    nodes.push({
      id: `node:${index}`,
      domain: 'node',
      kind: 'heading',
      depth: heading.depth,
      label: heading.label,
      parentId: parentIndex < 0 ? null : nodes[parentIndex].id,
      ancestorIds: [],
      tokenEndByte: heading.startByte,
      anchor: `anchor-${index}`,
      startByte: heading.startByte,
      endByte: later ? later.startByte : total,
    });
    stack.push(index);
  });
  return { content, nodes };
}

function manifestWith(sourceLocators: readonly string[]): CohortManifest {
  return {
    schemaVersion: 'matrix-paper-cohorts-v1',
    releaseIdentity: '1.0.11-remediated-7-8-successor-20260918-D',
    status: 'PROPOSED_PENDING_OWNER_QP_APPROVAL',
    cohorts: [{
      id: 'categories',
      name: 'Categories',
      questionNumbers: [1],
      sourceLocators,
      guideEvidenceRanges: [[1, 2]],
      purpose: 'p',
      packageContents: ['c'],
      limitations: 'l',
    }],
  };
}

const SYNTHETIC_PAPER = [
  '# Front',
  '## 4.1 Categories',
  'alpha',
  '## 4.1.x Draft notes',
  'beta',
  '## 2017 Restructuring',
  'gamma',
  '## 1.0% TOC subset',
  'delta',
  '## 13 Thirteen',
  'epsilon',
  '## 9 Nine',
  'zeta',
  '## 7.0 Parent',
  '### 7.5.1 Scope',
  'eta',
  '### 7.5.2 Evidence',
  'theta',
  '# Technical Appendices Compendium',
  '## 4.2 Appendix copy',
  'iota',
  '',
].join('\n');

describe('cohort portions against the real authenticated paper', () => {
  const structure = loadRevisedPaperStructure();
  const manifest = getCohortManifest();
  const portions = deriveCohortPortions(structure, manifest);

  it('preserves the pre-refactor page derivation exactly for all five cohorts', () => {
    const reference = refDeriveCohortPortions(structure, manifest);
    expect(portions.map(withoutAnchor)).toEqual(reference);
    expect(portions).toHaveLength(14);
    expect(new Set(portions.map((portion) => portion.cohortId))).toEqual(new Set(manifest.cohorts.map((cohort) => cohort.id)));
    expect(portions.map((portion) => [portion.id, portion.status, portion.startByte ?? null, portion.endByte ?? null])).toEqual(
      reference.map((portion) => [portion.id, portion.status, portion.startByte ?? null, portion.endByte ?? null]),
    );
  });

  it('adds sectionAnchor = the first resolved heading anchor for available portions only', () => {
    for (const portion of portions) {
      if (portion.status === 'unavailable') {
        expect(portion.sectionAnchor).toBeUndefined();
        continue;
      }
      const firstNode = structure.nodes.find((node) => node.startByte === portion.startByte);
      expect(firstNode).toBeDefined();
      expect(portion.sectionAnchor).toBe(firstNode?.anchor);
      expect(portion.sourceNodeId?.startsWith(firstNode?.id ?? '-')).toBe(true);
    }
    expect(portions.filter((portion) => portion.status === 'available').length).toBeGreaterThan(0);
  });

  it('uses only heading labels or section-number labels (no invented content claims)', () => {
    const headingLabels = new Set(structure.nodes.map((node) => node.label));
    for (const portion of portions) {
      const label = portion.sectionLabel ?? '';
      expect(headingLabels.has(label) || /^Section \d+(?:\.\d+)*(?: \(\d+(?:\.\d+)*-\d+(?:\.\d+)*\))?$/.test(label)).toBe(true);
    }
  });
});

describe('cohort portions strict section-number parsing (F-08)', () => {
  it('parses only exact "Section(s) N" locator grammar', () => {
    expect(sectionNumbersFromLocator('Section 4.1')).toEqual(['4.1']);
    expect(sectionNumbersFromLocator('Section 6.0')).toEqual(['6']);
    expect(sectionNumbersFromLocator('Section 15')).toEqual(['15']);
    expect(sectionNumbersFromLocator('Sections 4.1 and 6.0')).toEqual(['4.1', '6']);
    expect(sectionNumbersFromLocator('Sections 4.1, 9 and 13')).toEqual(['4.1', '9', '13']);
    expect(sectionNumbersFromLocator('Sections 7.7 & 7.8')).toEqual(['7.7', '7.8']);
    expect(sectionNumbersFromLocator("Reviewer's Guide lines 181-190")).toEqual([]);
    expect(sectionNumbersFromLocator('Updated 2026-09-13')).toEqual([]);
    expect(sectionNumbersFromLocator('Section 4.1 dated 2026-09-13')).toEqual([]);
    expect(sectionNumbersFromLocator('4-pathway grid')).toEqual([]);
    expect(sectionNumbersFromLocator('Section 2017')).toEqual([]);
    expect(sectionNumbersFromLocator('Section 4.1a')).toEqual([]);
    expect(sectionNumbersFromLocator('Subsection 4.1')).toEqual([]);
  });

  it('reads heading numbers only from an exact leading numeric token', () => {
    expect(sectionNumberFromHeading('4.1 Part 1: Matrix')).toBe('4.1');
    expect(sectionNumberFromHeading('6.0 Proposed Matrix Standards Framework')).toBe('6');
    expect(sectionNumberFromHeading('4.1. Dotted')).toBe('4.1');
    expect(sectionNumberFromHeading('4.1: Colon')).toBe('4.1');
    expect(sectionNumberFromHeading('15')).toBe('15');
    expect(sectionNumberFromHeading('4.1.x Draft notes')).toBeUndefined();
    expect(sectionNumberFromHeading('2017 Restructuring')).toBeUndefined();
    expect(sectionNumberFromHeading('1.0% TOC subset')).toBeUndefined();
    expect(sectionNumberFromHeading('Part 4.1')).toBeUndefined();
  });

  it('ignores numbers inside dates and free text in locators', () => {
    const portions = deriveCohortPortions(synthetic(SYNTHETIC_PAPER), manifestWith(['Section 4.1', 'Updated 2026-09-13', "Reviewer's Guide lines 181-190"]));
    expect(portions.map((portion) => [portion.id, portion.status, portion.sectionLabel])).toEqual([['categories:4.1', 'available', '4.1 Categories']]);
    expect(portions[0].sectionAnchor).toBe('anchor-1');
  });

  it('does not treat "4.1.x" or "1.0%" headings as sections 4.1 or 1', () => {
    const portions = deriveCohortPortions(synthetic(SYNTHETIC_PAPER), manifestWith(['Sections 4.1 and 1']));
    expect(portions.map((portion) => [portion.id, portion.status, portion.sectionLabel])).toEqual([
      ['categories:4.1', 'available', '4.1 Categories'],
      ['categories:section-1', 'unavailable', 'Section 1'],
    ]);
    expect(portions[1]).not.toHaveProperty('sectionAnchor');
    expect(portions[0].text).toBe('## 4.1 Categories\nalpha\n');
  });

  it('keeps consecutive-children aggregation and appendix exclusion', () => {
    const portions = deriveCohortPortions(synthetic(SYNTHETIC_PAPER), manifestWith(['Section 7.5', 'Section 4.2', 'Section 13']));
    expect(portions.map((portion) => [portion.id, portion.status, portion.sectionLabel, portion.sourceNodeId ?? null])).toEqual([
      ['categories:7.5', 'available', 'Section 7.5 (7.5.1-7.5.2)', 'node:8..node:9'],
      ['categories:section-4.2', 'unavailable', 'Section 4.2', null],
      ['categories:13', 'available', '13 Thirteen', 'node:5'],
    ]);
    expect(portions[0].sectionAnchor).toBe('anchor-8');
  });

  // Two-sided: without the inactive-link presentation in deriveCohortPortions the portion keeps
  // `[the appendix](#app-l)`, a link into a section the release does not present.
  it('shows a simple link to an inactive target as its text in a portion, and leaves every other link alone', () => {
    const paper = SYNTHETIC_PAPER.replace('epsilon', 'see [the appendix](#app-l) and [nine](#sec-9)');
    expect(paper).not.toBe(SYNTHETIC_PAPER);
    const withheld = deriveCohortPortions({ ...synthetic(paper), presentation: { frontMatter: false, inactiveLinkTargets: ['app-l'] } }, manifestWith(['Section 13']));
    expect(withheld.map((portion) => portion.text)).toEqual(['## 13 Thirteen\nsee the appendix and [nine](#sec-9)\n']);
    // Control: a release with no inactive target keeps the link exactly as authored.
    const whole = deriveCohortPortions(synthetic(paper), manifestWith(['Section 13']));
    expect(whole.map((portion) => portion.text)).toEqual(['## 13 Thirteen\nsee [the appendix](#app-l) and [nine](#sec-9)\n']);
  });

  // Two-sided: without the withheld-section presentation in deriveCohortPortions the portion keeps
  // both entries, and without the refusal an entry that cannot be removed would be shown.
  it('My Review shows no list entry for a withheld appendix: an entry is removed whole, and one that cannot be removed refuses the portion', () => {
    const presentation = { frontMatter: false, inactiveLinkTargets: ['app-l'] };
    const listed = SYNTHETIC_PAPER.replace('epsilon', 'epsilon\n\n- [Appendix K: A kept part](#app-k)\n- [Appendix L: A synthetic title](#app-l)\n\n- **Appendix L** holds a synthetic title');
    expect(listed).not.toBe(SYNTHETIC_PAPER);
    const withheld = deriveCohortPortions({ ...synthetic(listed), presentation }, manifestWith(['Section 13']));
    expect(withheld.map((portion) => portion.text)).toEqual(['## 13 Thirteen\nepsilon\n\n- [Appendix K: A kept part](#app-k)\n\n']);
    // Control: a release that withholds nothing keeps both entries exactly as authored.
    const whole = deriveCohortPortions(synthetic(listed), manifestWith(['Section 13']));
    expect(whole.map((portion) => portion.text)).toEqual(['## 13 Thirteen\nepsilon\n\n- [Appendix K: A kept part](#app-k)\n- [Appendix L: A synthetic title](#app-l)\n\n- **Appendix L** holds a synthetic title\n']);
    // An entry is one node of the parsed text and goes whole: a second line, a further paragraph after a
    // blank line, a quoted paragraph, an entry under it (tab-indented too). Nothing of it is left in the portion.
    for (const entry of [
      '- **Appendix L** holds a synthetic title\n  that runs on to a second line',
      '- **Appendix L** holds a synthetic title\n\n  A second paragraph of the same entry.',
      '- [Appendix L: A synthetic title](#app-l)\n\n  - An entry under it',
      '- Appendix L: A synthetic title\n\n  >A quoted paragraph of the same entry.',
      `- Appendix L: A synthetic title\n${String.fromCharCode(9)}- An entry under it`,
    ]) {
      const paper = SYNTHETIC_PAPER.replace('epsilon', `epsilon\n\n${entry}`);
      expect(deriveCohortPortions({ ...synthetic(paper), presentation }, manifestWith(['Section 13'])).map((portion) => portion.text)).toEqual(['## 13 Thirteen\nepsilon\n\n']);
      // Control: a release that withholds nothing shows the entry whole.
      expect(deriveCohortPortions(synthetic(paper), manifestWith(['Section 13'])).map((portion) => portion.text)).toEqual([`## 13 Thirteen\nepsilon\n\n${entry}\n`]);
    }
    // A near match is another designation and stays.
    const near = SYNTHETIC_PAPER.replace('epsilon', 'epsilon\n\n- Appendix L_1: A kept part\n- Appendix L-1: A kept part\n- Appendix LA: A kept part');
    expect(deriveCohortPortions({ ...synthetic(near), presentation }, manifestWith(['Section 13'])).map((portion) => portion.text)).toEqual(['## 13 Thirteen\nepsilon\n\n- Appendix L_1: A kept part\n- Appendix L-1: A kept part\n- Appendix LA: A kept part\n']);
    // My Review strips the standalone section-anchor lines before it draws a portion. A line of raw HTML
    // directly above a list hides the list from the parser, so the portion is presented and counted on the
    // text WITHOUT those lines (the order the Working Draft uses): the entry under the anchor line goes,
    // whether it is a link to the withheld section or names the appendix, and the item beside it stays.
    for (const entry of ['- [A linked title](#app-l)', '- Appendix L: A synthetic title', '- [Appendix L: A synthetic title](#app-l)']) {
      const under = SYNTHETIC_PAPER.replace('epsilon', `<div id="sec-13-1" class="section-anchor"></div>\n${entry}\n- Kept item`);
      const [portion] = deriveCohortPortions({ ...synthetic(under), presentation }, manifestWith(['Section 13']));
      expect(portion.text).toBe('## 13 Thirteen\n- Kept item\n');
      // What My Review does to the text afterwards changes nothing any more: no anchor line is left in it.
      expect(stripStandaloneSectionAnchorLines(portion.text ?? '')).toBe(portion.text);
      expect(shownWithheldEntryCount(portion.text ?? '', ['app-l'])).toBe(0);
      // The other side: presented WITH the anchor line (the order before this rule) the same range is
      // either refused or keeps the entry as plain text, which the count cannot see once the line is stripped.
      const withAnchorLine = presentWithheldSections(`## 13 Thirteen\n<div id="sec-13-1" class="section-anchor"></div>\n${entry}\n- Kept item\n`, ['app-l']);
      expect(withAnchorLine.includes('- Kept item') && (withAnchorLine.includes('A linked title') || withAnchorLine.includes('A synthetic title'))).toBe(true);
      // Control: a release that withholds nothing keeps the exact text of its byte range, anchor line included.
      expect(deriveCohortPortions(synthetic(under), manifestWith(['Section 13'])).map((whole) => whole.text)).toEqual([`## 13 Thirteen\n<div id="sec-13-1" class="section-anchor"></div>\n${entry}\n- Kept item\n`]);
    }
    // An entry that cannot be removed without changing what is kept refuses the portion too: here the
    // numbered list would stop being a list once its first item is gone.
    const interrupts = SYNTHETIC_PAPER.replace('epsilon', 'Kept lead-in line\n1. Appendix L: A synthetic title\n2. Kept two');
    expect(() => deriveCohortPortions({ ...synthetic(interrupts), presentation }, manifestWith(['Section 13']))).toThrow('Authenticated paper section lists a withheld appendix: categories/13');
    expect(() => deriveCohortPortions(synthetic(interrupts), manifestWith(['Section 13']))).not.toThrow();
    // An entry that cannot be removed (a table header row, raw HTML) refuses the portion: it is not shown.
    for (const stuck of ['| Appendix L | A synthetic title |\n|---|---|\n| Appendix K | A kept part |', '<ul>\n<li>Appendix L: A synthetic title</li>\n</ul>']) {
      const paper = SYNTHETIC_PAPER.replace('epsilon', `epsilon\n\n${stuck}`);
      expect(() => deriveCohortPortions({ ...synthetic(paper), presentation }, manifestWith(['Section 13']))).toThrow('Authenticated paper section lists a withheld appendix: categories/13');
      expect(() => deriveCohortPortions(synthetic(paper), manifestWith(['Section 13']))).not.toThrow();
    }
  });

  it('fails closed when no locator has the strict grammar', () => {
    expect(() => deriveCohortPortions(synthetic(SYNTHETIC_PAPER), manifestWith(['4-pathway grid', 'Updated 2026-09-13']))).toThrow('Cohort has no paper section locators: categories');
  });
});
