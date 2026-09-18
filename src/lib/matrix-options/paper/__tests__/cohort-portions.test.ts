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

  it('fails closed when no locator has the strict grammar', () => {
    expect(() => deriveCohortPortions(synthetic(SYNTHETIC_PAPER), manifestWith(['4-pathway grid', 'Updated 2026-09-13']))).toThrow('Cohort has no paper section locators: categories');
  });
});
