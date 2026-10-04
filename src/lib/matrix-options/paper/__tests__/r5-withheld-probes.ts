import type { RevisedPaperStructure } from '../../revised-paper-structure';

/*
 * Test-only probes for a section a release artifact leaves out (Appendix L of
 * the current review draft).
 *
 * The artifact does not contain that section, and no text of it is in the
 * repository, so a probe can only ask whether the artifact NAMES it: by its
 * stable id, by an anchor line, or by a heading of that appendix. Every probe
 * returns a COUNT for the caller to compare with a number, so a failure shows
 * two numbers and never paper text. Each count is paired by the caller with the
 * same count for an appendix the artifact does contain, so a zero is a finding
 * and not a probe that cannot see.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** How many lines of `content` are the section-anchor line of `stableSectionId`. */
export function sectionAnchorLineCount(content: string, stableSectionId: string): number {
  const line = new RegExp(`^[ \\t]*<div[ \\t]+id="${escapeRegExp(stableSectionId)}"[ \\t]+class="section-anchor"[ \\t]*>[ \\t]*</div>[ \\t]*$`);
  return content.split('\n').filter((candidate) => line.test(candidate)).length;
}

/** True when a heading label opens with "Appendix <letter>" as a whole word (any spacing, any case). */
function namesAppendix(label: string, letter: string): boolean {
  return new RegExp(`^\\s*Appendix\\s+${escapeRegExp(letter)}(?![A-Za-z0-9])`, 'i').test(label);
}

/** How many compiled headings open with "Appendix <letter>". */
export function appendixHeadingCount(structure: Pick<RevisedPaperStructure, 'nodes'>, letter: string): number {
  return structure.nodes.filter((node) => namesAppendix(node.label, letter)).length;
}

/** How many raw lines are an ATX heading that opens with "Appendix <letter>" (a parser-independent second reading). */
export function appendixHeadingLineCount(content: string, letter: string): number {
  return content.split('\n').filter((line) => {
    const heading = /^ {0,3}#{1,6}[ \t]+(.*)$/.exec(line);
    return heading !== null && namesAppendix(heading[1], letter);
  }).length;
}

/** Every string anywhere inside `value` (object keys included), for surfaces that are plain data. */
export function allStrings(value: unknown, into: string[] = [], guard: Set<unknown> = new Set()): string[] {
  if (typeof value === 'string') into.push(value);
  else if (value && typeof value === 'object' && !guard.has(value)) {
    guard.add(value);
    if (Array.isArray(value)) for (const entry of value) allStrings(entry, into, guard);
    else for (const [key, entry] of Object.entries(value as Record<string, unknown>)) { into.push(key); allStrings(entry, into, guard); }
  }
  return into;
}

/** How many of `strings` are, or contain as a `#id` reference, the stable id. */
export function stableIdMentionCount(strings: readonly string[], stableSectionId: string): number {
  const reference = new RegExp(`#${escapeRegExp(stableSectionId)}(?![A-Za-z0-9_-])`);
  return strings.filter((value) => value === stableSectionId || reference.test(value)).length;
}
