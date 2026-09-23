/*
 * Semantic outline hierarchy for the Working Draft table of contents.
 *
 * The compiled paper structure (revised-paper-structure.ts) derives every
 * node's parent from the raw markdown heading depth, and its node ids hash that
 * ancestry, so it must stay exactly as authored. The canonical paper, however,
 * authors some headings at the wrong depth inside numbered chapters:
 *
 *   ## 7.0 Phase 2 Research Topics ...          (chapter, depth 2)
 *   ### 7.1 Bioavailability Adjustment          (depth 3, correct)
 *   # Matrix Options evidence and method boundary   (depth 1: resets the tree)
 *   ## Section 7.2 Bioaccumulation draft text        (depth 2: a 7.x at chapter depth)
 *   ### 7.5.1 Scope                             (no 7.5 heading exists)
 *   # Section 7.8: Input Parameter Inventory ...     (depth 1)
 *   # Policy-ready input categories - Phase 2 boundary (depth 1)
 *   ## 9.8 / ## 9.9                              (9.x at chapter depth)
 *
 * Read literally, 7.2 becomes a child of the evidence banner, 7.3-7.7 nest
 * under 7.2, and 7.8 and both banners become top-level sections. This module
 * derives the READER hierarchy (parent, level, children) that the outline, its
 * expanded state, keyboard order and deep-link ancestry all share. It never
 * changes ids, anchors, byte ranges or the raw `depth` that the section loader
 * groups by.
 *
 * Rules, applied in document order before the appendix boundary (headings at
 * and after "Technical Appendices Compendium" keep their authored parents):
 * 1. A chapter is a heading numbered `N.0`. It opens a chapter context that
 *    runs to the next chapter, to an unnumbered heading authored at exactly
 *    the chapter's depth (for example "## Master Scientific Bibliography"),
 *    or to the appendix boundary. A chapter
 *    (and such a closing heading) is parented to the nearest earlier heading
 *    outside every chapter context with a smaller depth -- the paper title.
 * 2. Inside a chapter, a numbered heading `N.a.b` is parented to the nearest
 *    earlier heading of the same chapter whose number is its longest proper
 *    prefix (`7.5.1` -> `7.5`, or the chapter `7.0` when no `7.5` exists).
 * 3. Inside a chapter, an unnumbered heading SHALLOWER than the chapter is a
 *    mis-levelled banner. It introduces what follows, so it becomes a sibling
 *    of the next numbered heading in the chapter; when no numbered heading
 *    follows in the chapter it closes the most recent section-level (`N.a`)
 *    heading and becomes its child.
 * 4. Any other unnumbered heading inside a chapter is parented to the nearest
 *    earlier chapter heading with a smaller authored depth.
 * Level is 1 for roots and parent level + 1 otherwise.
 */

export interface OutlineHierarchyInput {
  readonly id: string;
  readonly label: string;
  /** Authored markdown heading depth (1-6). */
  readonly depth: number;
  /** Authored (structural) parent id. */
  readonly parentId: string | null;
}

export interface OutlineHierarchyNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly level: number;
  readonly childIds: readonly string[];
}

export const APPENDIX_BOUNDARY_LABEL = 'Technical Appendices Compendium';

const SECTION_NUMBER = /^\s*(?:section\s+)?(\d{1,2}(?:\.\d{1,2})+)(?=$|[\s:])/i;

/** Dotted section number of a heading label ("7.8" for "Section 7.8: ..."), or null. */
export function outlineSectionNumber(label: string): readonly number[] | null {
  const match = SECTION_NUMBER.exec(label);
  return match ? match[1].split('.').map(Number) : null;
}

function isChapterNumber(parts: readonly number[]): boolean {
  return parts.length === 2 && parts[1] === 0;
}

/** Significant parts: a chapter `7.0` is the prefix `7`. */
function significant(parts: readonly number[]): readonly number[] {
  return isChapterNumber(parts) ? parts.slice(0, 1) : parts;
}

function isProperPrefix(prefix: readonly number[], of: readonly number[]): boolean {
  return prefix.length < of.length && prefix.every((part, index) => of[index] === part);
}

export function buildOutlineHierarchy(entries: readonly OutlineHierarchyInput[]): readonly OutlineHierarchyNode[] {
  const count = entries.length;
  const numbers = entries.map((entry) => outlineSectionNumber(entry.label));
  const parentIndex: number[] = new Array(count).fill(-1);
  const inChapter: boolean[] = new Array(count).fill(false);
  const indexById = new Map(entries.map((entry, index) => [entry.id, index]));
  const boundaryCandidate = entries.findIndex((entry) => entry.depth === 1 && entry.label === APPENDIX_BOUNDARY_LABEL);
  const boundary = boundaryCandidate < 0 ? count : boundaryCandidate;

  const outsideParent = (index: number): number => {
    for (let j = index - 1; j >= 0; j -= 1) {
      if (!inChapter[j] && entries[j].depth < entries[index].depth) return j;
    }
    return -1;
  };
  const prefixParent = (parts: readonly number[], chapterIndex: number, before: number): number => {
    const target = significant(parts);
    let best = chapterIndex;
    let bestLength = 1;
    for (let j = chapterIndex + 1; j < before; j += 1) {
      const candidate = numbers[j];
      if (!candidate) continue;
      const prefix = significant(candidate);
      if (prefix.length > bestLength && isProperPrefix(prefix, target)) {
        best = j;
        bestLength = prefix.length;
      }
    }
    return best;
  };

  let chapterIndex = -1;
  let chapterMajor = -1;
  for (let i = 0; i < count; i += 1) {
    const entry = entries[i];
    if (i >= boundary) {
      chapterIndex = -1;
      const raw = entry.parentId === null ? -1 : indexById.get(entry.parentId) ?? -1;
      parentIndex[i] = raw < i ? raw : -1;
      continue;
    }
    const parts = numbers[i];
    if (parts && isChapterNumber(parts)) {
      parentIndex[i] = outsideParent(i);
      chapterIndex = i;
      chapterMajor = parts[0];
      continue;
    }
    if (chapterIndex >= 0 && !parts && entry.depth === entries[chapterIndex].depth) {
      // An unnumbered heading at chapter depth closes the chapter (rule 1).
      chapterIndex = -1;
      parentIndex[i] = outsideParent(i);
      continue;
    }
    if (chapterIndex < 0) {
      const raw = entry.parentId === null ? -1 : indexById.get(entry.parentId) ?? -1;
      parentIndex[i] = raw < i ? raw : -1;
      continue;
    }
    inChapter[i] = true;
    if (parts && parts[0] === chapterMajor) {
      parentIndex[i] = prefixParent(parts, chapterIndex, i);
      continue;
    }
    if (!parts && entry.depth < entries[chapterIndex].depth) {
      let next = -1;
      for (let k = i + 1; k < boundary; k += 1) {
        const candidate = numbers[k];
        if (candidate && isChapterNumber(candidate)) break;
        if (!candidate && entries[k].depth === entries[chapterIndex].depth) break;
        if (candidate && candidate[0] === chapterMajor) {
          next = k;
          break;
        }
      }
      if (next >= 0) {
        parentIndex[i] = prefixParent(numbers[next]!, chapterIndex, i);
      } else {
        let section = chapterIndex;
        for (let j = i - 1; j > chapterIndex; j -= 1) {
          const candidate = numbers[j];
          if (candidate && candidate[0] === chapterMajor && candidate.length === 2) {
            section = j;
            break;
          }
        }
        parentIndex[i] = section;
      }
      continue;
    }
    let parent = chapterIndex;
    for (let j = i - 1; j > chapterIndex; j -= 1) {
      if (entries[j].depth < entry.depth) {
        parent = j;
        break;
      }
    }
    parentIndex[i] = parent;
  }

  const levels: number[] = new Array(count).fill(1);
  const children: string[][] = entries.map(() => []);
  for (let i = 0; i < count; i += 1) {
    const parent = parentIndex[i];
    if (parent >= 0) {
      levels[i] = levels[parent] + 1;
      children[parent].push(entries[i].id);
    }
  }
  return Object.freeze(entries.map((entry, i) => Object.freeze({
    id: entry.id,
    parentId: parentIndex[i] >= 0 ? entries[parentIndex[i]].id : null,
    level: levels[i],
    childIds: Object.freeze(children[i]),
  })));
}
