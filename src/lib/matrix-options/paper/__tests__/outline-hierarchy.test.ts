import { describe, expect, it } from 'vitest';

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { buildOutlineHierarchy, outlineSectionNumber } from '../outline-hierarchy';
import type { OutlineHierarchyInput } from '../outline-hierarchy';

type ParentView = ReadonlyMap<string, string | null>;

/** label -> parent label, from any (id, parentId) list over the structure's nodes. */
function parentLabels(nodes: readonly OutlineHierarchyInput[], parents: readonly { readonly id: string; readonly parentId: string | null }[]): ParentView {
  const labelById = new Map(nodes.map((node) => [node.id, node.label]));
  const view = new Map<string, string | null>();
  for (const entry of parents) {
    const label = labelById.get(entry.id)!;
    if (!view.has(label)) view.set(label, entry.parentId === null ? null : labelById.get(entry.parentId)!);
  }
  return view;
}

const CHAPTER_7 = '7.0 Phase 2 Research Topics Supporting the Matrix Options Paper';
const SECTION_7_8 = 'Section 7.8: Input Parameter Inventory and Selection Options';
const TITLE = 'Matrix Sediment Standards Options Paper';

/** The reader hierarchy the owner specified for section 7 (and the chapters after it). */
const EXPECTED_PARENTS: ReadonlyArray<readonly [string, string | null]> = [
  ['7.1 Bioavailability Adjustment', CHAPTER_7],
  ['Matrix Options evidence and method boundary', CHAPTER_7],
  ['Section 7.2 Bioaccumulation draft text', CHAPTER_7],
  ['7.3 Substance Classification', CHAPTER_7],
  ['7.5.1 Scope', CHAPTER_7],
  ['7.7 BC Aquatic Database', CHAPTER_7],
  [SECTION_7_8, CHAPTER_7],
  ['7.8.1 Inventory, provenance and status discipline', SECTION_7_8],
  ['7.8.2 Source submission and primary verification', SECTION_7_8],
  ['Policy-ready input categories - Phase 2 boundary', SECTION_7_8],
  ['8.0 Evaluation Criteria', TITLE],
  ['9.8 Pathway 4 options for province-wide applicability', '9.0 Technical Options Analysis'],
  ['Master Scientific Bibliography', TITLE],
];

function mismatches(view: ParentView): string[] {
  return EXPECTED_PARENTS.flatMap(([label, parent]) => (view.get(label) === parent ? [] : [`${label}: expected ${parent}, got ${view.get(label)}`]));
}

describe('buildOutlineHierarchy on the authenticated release', () => {
  const structure = loadRevisedPaperStructure();
  const hierarchy = buildOutlineHierarchy(structure.nodes);

  it('nests 7.2, 7.8, 7.8.1, 7.8.2 and both boundary headings under section 7', () => {
    expect(mismatches(parentLabels(structure.nodes, hierarchy))).toEqual([]);
  });

  it('two-sided: the authored (raw-depth) hierarchy fails the same expectations', () => {
    const raw = mismatches(parentLabels(structure.nodes, structure.nodes));
    expect(raw).toContain(`${SECTION_7_8}: expected ${CHAPTER_7}, got null`);
    expect(raw).toContain(`Section 7.2 Bioaccumulation draft text: expected ${CHAPTER_7}, got Matrix Options evidence and method boundary`);
    expect(raw).toContain('Policy-ready input categories - Phase 2 boundary: expected Section 7.8: Input Parameter Inventory and Selection Options, got null');
    expect(raw).toContain(`8.0 Evaluation Criteria: expected ${TITLE}, got Policy-ready input categories - Phase 2 boundary`);
  });

  it('keeps ids, order and the appendix tree; only reader parents change', () => {
    expect(hierarchy.map((entry) => entry.id)).toEqual(structure.nodes.map((node) => node.id));
    const boundary = structure.nodes.findIndex((node) => node.depth === 1 && node.label === 'Technical Appendices Compendium');
    for (let index = boundary; index < structure.nodes.length; index += 1) {
      expect(hierarchy[index].parentId).toBe(structure.nodes[index].parentId);
    }
    const changed = hierarchy.filter((entry, index) => entry.parentId !== structure.nodes[index].parentId).length;
    expect(changed).toBe(26);
  });

  it('assigns levels from the reader parent and lists children in document order', () => {
    const byLabel = new Map(structure.nodes.map((node, index) => [node.label, hierarchy[index]]));
    expect(byLabel.get(TITLE)?.level).toBe(1);
    expect(byLabel.get(CHAPTER_7)?.level).toBe(2);
    expect(byLabel.get(SECTION_7_8)?.level).toBe(3);
    expect(byLabel.get('7.8.1 Inventory, provenance and status discipline')?.level).toBe(4);
    expect(byLabel.get('Policy-ready input categories - Phase 2 boundary')?.level).toBe(4);
    const idByLabel = new Map(structure.nodes.map((node) => [node.label, node.id]));
    expect(byLabel.get(SECTION_7_8)?.childIds).toEqual([
      idByLabel.get('7.8.1 Inventory, provenance and status discipline'),
      idByLabel.get('7.8.2 Source submission and primary verification'),
      idByLabel.get('Policy-ready input categories - Phase 2 boundary'),
    ]);
    for (const entry of hierarchy) {
      if (entry.parentId === null) continue;
      expect(hierarchy.findIndex((candidate) => candidate.id === entry.parentId)).toBeLessThan(hierarchy.indexOf(entry));
    }
  });
});

describe('buildOutlineHierarchy rules (synthetic)', () => {
  const node = (id: string, label: string, depth: number, parentId: string | null): OutlineHierarchyInput => ({ id, label, depth, parentId });

  it('places a banner that closes a chapter under the last section-level heading', () => {
    const entries = [
      node('t', 'Title', 1, null),
      node('c', '3.0 Chapter', 2, 't'),
      node('s', '3.1 Section', 3, 'c'),
      node('b', 'Closing banner', 1, null),
      node('n', '4.0 Next', 2, 'b'),
    ];
    expect(buildOutlineHierarchy(entries).map((entry) => entry.parentId)).toEqual([null, 't', 'c', 's', 't']);
  });

  it('parents an orphan numbered heading to its chapter when its numbered parent is absent', () => {
    const entries = [node('t', 'Title', 1, null), node('c', '5.0 Chapter', 2, 't'), node('a', '5.1 A', 3, 'c'), node('x', '5.3.1 Orphan', 3, 'c')];
    expect(buildOutlineHierarchy(entries).map((entry) => entry.parentId)).toEqual([null, 't', 'c', 'c']);
  });

  it('parses only dotted section numbers', () => {
    expect(outlineSectionNumber('Section 7.8: Input')).toEqual([7, 8]);
    expect(outlineSectionNumber('7.0 Chapter')).toEqual([7, 0]);
    expect(outlineSectionNumber('12 Months of work')).toBeNull();
    expect(outlineSectionNumber('(a) US EPA')).toBeNull();
  });
});
