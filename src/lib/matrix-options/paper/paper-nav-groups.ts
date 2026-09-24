import { APPENDIX_BOUNDARY_LABEL } from './outline-hierarchy';

/*
 * Paper Navigation groups (presentation only).
 *
 * The reader outline (outline-hierarchy.ts) is regrouped for display into two
 * top-level groups: "Main Report" (everything before the appendix boundary)
 * and "Appendices" (the boundary heading and every appendix after it). Nothing
 * here changes an entry, an anchor, a heading or the paper bytes: it only
 * decides where an existing entry is SHOWN.
 *
 * - Exact "Master Table of Contents" entries are not shown (their children, if
 *   any, are lifted to the entry's place); the paper itself still contains the
 *   headings, relabelled in place by contents-heading.ts.
 * - Main Report: the document title is a single row and its chapters become the
 *   group's top-level rows, so the chapters are the collapsible units.
 * - Appendices: each "Appendix X: ..." heading is one collapsible row with a
 *   letter badge. A banner heading that introduces an appendix (the paper's
 *   "Matrix Options evidence and method boundary" before B, C and H) is shown
 *   inside that appendix, and any later root heading (an appendix's source
 *   note) stays inside the appendix it follows.
 */

/** The minimal outline shape the grouping needs (document order). */
export interface PaperNavSourceEntry {
  readonly id: string;
  readonly anchor: string;
  readonly label: string;
  readonly parentId: string | null;
  readonly childIds: readonly string[];
  readonly level: number;
}

export interface PaperNavNode<T extends PaperNavSourceEntry = PaperNavSourceEntry> {
  readonly entry: T;
  readonly children: readonly PaperNavNode<T>[];
  /** Appendix letter ("A".."Z") for an appendix row. */
  readonly badge?: string;
}

export type PaperNavGroupId = 'main-report' | 'appendices';

export interface PaperNavGroup<T extends PaperNavSourceEntry = PaperNavSourceEntry> {
  readonly id: PaperNavGroupId;
  readonly label: string;
  readonly nodes: readonly PaperNavNode<T>[];
}

export const PAPER_NAV_GROUP_LABELS: Readonly<Record<PaperNavGroupId, string>> = Object.freeze({
  'main-report': 'Main Report',
  appendices: 'Appendices',
});

/** The authored heading that is hidden from navigation and relabelled in the paper. */
export const CONTENTS_HEADING_LABEL = 'Master Table of Contents';

/** Exact match only (surrounding whitespace ignored): no other heading is affected. */
export function isContentsHeading(label: string | null): boolean {
  return label !== null && label.trim() === CONTENTS_HEADING_LABEL;
}

const APPENDIX_HEADING = /^Appendix\s+([A-Z])\s*:/;

/** The appendix letter of an "Appendix X: ..." heading, else null. */
export function appendixLetter(label: string): string | null {
  return APPENDIX_HEADING.exec(label.trim())?.[1] ?? null;
}

interface MutableNode<T extends PaperNavSourceEntry> {
  entry: T;
  children: MutableNode<T>[];
  badge?: string;
}

export function buildPaperNavGroups<T extends PaperNavSourceEntry>(outline: readonly T[]): readonly PaperNavGroup<T>[] {
  const byId = new Map(outline.map((entry) => [entry.id, entry]));
  const shownChildren = (entry: T, seen: Set<string>): T[] => entry.childIds.flatMap((childId) => {
    const child = byId.get(childId);
    if (!child || seen.has(child.id)) return [];
    seen.add(child.id);
    return isContentsHeading(child.label) ? shownChildren(child, seen) : [child];
  });
  const toNode = (entry: T, seen: Set<string>, badge?: string): MutableNode<T> => ({
    entry,
    children: shownChildren(entry, seen).map((child) => toNode(child, seen)),
    ...(badge ? { badge } : {}),
  });

  const seen = new Set<string>();
  const roots = outline.filter((entry) => entry.parentId === null || !byId.has(entry.parentId));
  // A root that is itself a contents heading contributes its children as roots.
  const shownRoots = roots.flatMap((root) => {
    seen.add(root.id);
    return isContentsHeading(root.label) ? shownChildren(root, seen) : [root];
  });
  const boundary = shownRoots.findIndex((entry) => entry.label.trim() === APPENDIX_BOUNDARY_LABEL);
  const mainRoots = boundary < 0 ? shownRoots : shownRoots.slice(0, boundary);
  const appendixRoots = boundary < 0 ? [] : shownRoots.slice(boundary);

  const main: MutableNode<T>[] = [];
  for (const root of mainRoots) {
    const children = shownChildren(root, seen);
    if (main.length === 0 && root.level <= 1 && children.length > 0) {
      // The document title: one row; its chapters are the group's rows.
      main.push({ entry: root, children: [] }, ...children.map((child) => toNode(child, seen)));
    } else {
      main.push({ entry: root, children: children.map((child) => toNode(child, seen)) });
    }
  }

  const appendices: MutableNode<T>[] = [];
  for (const root of appendixRoots) {
    const letter = appendixLetter(root.label);
    if (letter) {
      appendices.push(toNode(root, seen, letter));
      continue;
    }
    const children = shownChildren(root, seen);
    const introduced = root.label.trim() === APPENDIX_BOUNDARY_LABEL ? undefined : children.find((child) => appendixLetter(child.label) !== null);
    if (introduced) {
      // A banner introducing an appendix: the appendix leads, the banner stays reachable inside it.
      const banner: MutableNode<T> = { entry: root, children: children.filter((child) => child !== introduced).map((child) => toNode(child, seen)) };
      const node = toNode(introduced, seen, appendixLetter(introduced.label) ?? undefined);
      node.children.unshift(banner);
      appendices.push(node);
      continue;
    }
    const node: MutableNode<T> = { entry: root, children: children.map((child) => toNode(child, seen)) };
    const previous = appendices[appendices.length - 1];
    // After an appendix, a further root heading belongs to that appendix.
    if (previous && previous.badge) previous.children.push(node);
    else appendices.push(node);
  }

  return [
    { id: 'main-report', label: PAPER_NAV_GROUP_LABELS['main-report'], nodes: main },
    { id: 'appendices', label: PAPER_NAV_GROUP_LABELS.appendices, nodes: appendices },
  ];
}

/** Expansion key of a group disclosure. */
export function paperNavGroupKey(groupId: PaperNavGroupId): string {
  return `group:${groupId}`;
}

/**
 * The disclosures that must be open to show `anchor`: its group and every
 * presentation ancestor (outermost first). An anchor that is not shown (a
 * hidden contents heading) resolves through its nearest shown reader ancestor.
 * Unknown anchors need nothing.
 */
export function paperNavPath<T extends PaperNavSourceEntry>(groups: readonly PaperNavGroup<T>[], outline: readonly T[], anchor: string | null): readonly string[] {
  if (anchor === null) return [];
  const paths = new Map<string, readonly string[]>();
  const walk = (nodes: readonly PaperNavNode<T>[], trail: readonly string[]) => {
    for (const node of nodes) {
      if (!paths.has(node.entry.anchor)) paths.set(node.entry.anchor, trail);
      walk(node.children, [...trail, node.entry.id]);
    }
  };
  for (const group of groups) walk(group.nodes, [paperNavGroupKey(group.id)]);
  const direct = paths.get(anchor);
  if (direct) return direct;
  const byId = new Map(outline.map((entry) => [entry.id, entry]));
  let current = outline.find((entry) => entry.anchor === anchor);
  const guard = new Set<string>();
  while (current && current.parentId !== null && !guard.has(current.id)) {
    guard.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    const parentPath = paths.get(parent.anchor);
    if (parentPath) return [...parentPath, parent.id];
    current = parent;
  }
  return [];
}
