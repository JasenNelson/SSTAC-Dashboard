import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getCohortManifest } from '../../cohort-contract';
import { authenticateReviewerGuideAgainstPaper, getReviewerGuideBinding, getReviewerGuideContract, resolveReviewerGuideAgainstLines } from '../../reviewer-guide';
import type { ReviewerGuideBinding } from '../../reviewer-guide';
import { loadRevisedPaper, REVISED_PAPER_VERSION } from '../../revised-paper';
import { createWorkspaceModel } from '../../revised-paper-review';
import { loadRevisedPaperStructure } from '../../revised-paper-structure';
import type { RevisedPaperNode, RevisedPaperStructure } from '../../revised-paper-structure';
import { deriveCohortPortions } from '../cohort-portions';
import { presentContentsHeadingFirstLine } from '../contents-heading';
import { assertWithheldNavigation, buildLegacyAnchorMap, buildPandocAnchorMap, buildPaperChunks, sectionAnchorSet, standaloneSectionAnchorIds } from '../full-document';
import { getPaperRelease, PAPER_WITHHELD_NOTICE_ID, R5_PAPER_VERSION } from '../releases';
import { resolveReviewerGuide } from '../reviewer-guide-server';
import { buildPaperSectionContract, getPaperSectionWindowModel, paperSectionIdentity, summarizePaperSections } from '../section-window';
import { inactiveLinkAudit, maskFrontMatter } from '../source-presentation';
import { presentWithheldSections, shownWithheldEntryCount, withheldEntryCounts } from '../withheld-sections';
import { buildPaperLinkMap, getPaperNavOutline, getPaperStableSectionIds } from '@/components/matrix-options/paper/PaperDocument';

import { describePrivate } from './private-fixture';
import { privateR5Structure } from './private-structure';
import { allStrings, appendixHeadingCount, appendixHeadingLineCount, sectionAnchorLineCount, stableIdMentionCount } from './r5-withheld-probes';

/*
 * Interim release rule: Appendix L of the current review draft is under revision and
 * is not part of the release. The release ARTIFACT does not contain it: the bound bytes
 * end before that appendix (releases.ts `withheld` and `provenance`), so nothing is cut
 * at run time and nothing downstream can hold it.
 *
 * No text of that appendix, and no text of the artifact, appears in this file. The
 * suites that read the artifact (the private fixture) compare COUNTS and booleans, each
 * paired with the same count for Appendix K, which the artifact does contain, so a zero
 * is a finding and not a blind probe. Every rule those suites rely on is also shown on
 * synthetic text, which runs everywhere.
 */

const ARTIFACT_BYTES = 562836;
const NOTICE = 'Appendix L is under revision and is not included in this presentation.';
const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const r5Release = getPaperRelease(R5_PAPER_VERSION)!;
const defaultRelease = getPaperRelease(REVISED_PAPER_VERSION)!;

describe('release contract: the section left out and the contents label are release entries', () => {
  it('binds the stable id and the notice for R5, and nothing for the default release', () => {
    expect(r5Release.withheld).toEqual({ stableSectionId: 'app-l', notice: NOTICE });
    expect(r5Release.contentsHeadingDisplay).toBe('Table of Contents');
    expect(defaultRelease.withheld).toBeNull();
    expect(defaultRelease.contentsHeadingDisplay).toBeNull();
    expect(r5Release).toMatchObject({ activation: 'SELECTABLE_NON_DEFAULT', delivery: 'private-storage', bytes: ARTIFACT_BYTES, sha256: 'c215b125757bbc0294f6ea904f7e4236a39d8912c137f226bb6148cced804c84' });
    expect(defaultRelease.activation).toBe('DEFAULT');
  });

  it('carries no offset, no hash of a part and no fallback target: the artifact is whole, and a link to the section lands on the notice', () => {
    expect(Object.keys(r5Release.withheld!).sort()).toEqual(['notice', 'stableSectionId']);
    expect(PAPER_WITHHELD_NOTICE_ID).toBe('paper-withheld-notice');
    // The artifact is a prefix of its source, named by hash only; the two are different files.
    expect(r5Release.provenance).toMatchObject({ derivation: 'source-prefix', sourceBytes: 588609 });
    expect(r5Release.bytes).toBeLessThan(r5Release.provenance!.sourceBytes);
  });
});

/** A minimal structure for the pure helpers: one node per ATX heading line of `content`. */
function syntheticStructure(content: string, presentation?: RevisedPaperStructure['presentation']): Pick<RevisedPaperStructure, 'content' | 'nodes' | 'presentation'> {
  const headings = Array.from(content.matchAll(/^(#{1,6})[ \t]+([^\n]*?)[ \t#]*$/gm));
  const seen = new Map<string, number>();
  const nodes = headings.map((match, index): RevisedPaperNode => {
    const label = match[2];
    const base = label.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const startByte = match.index ?? 0;
    return { id: `node:${index}`, domain: 'node', kind: 'heading', depth: match[1].length, label, parentId: null, ancestorIds: [], tokenEndByte: startByte + match[0].length + 1, anchor: count === 0 ? base : `${base}-${count}`, startByte, endByte: index + 1 < headings.length ? headings[index + 1].index ?? content.length : content.length };
  });
  return { content, nodes, ...(presentation ? { presentation } : {}) };
}

describe('probes: each one sees what it is asked about (synthetic text)', () => {
  const KEPT = '# Paper\n\nText.\n\n<div id="app-k" class="section-anchor"></div>\n\n## Appendix K: A kept part\n\nText.\n';
  const LEFT_OUT = '<div id="app-l" class="section-anchor"></div>\n\n## Appendix L: A part the artifact must not hold\n\nTail.\n';

  it('counts nothing of an absent appendix and something of a present one', () => {
    expect(sectionAnchorLineCount(KEPT, 'app-l')).toBe(0);
    expect(sectionAnchorLineCount(KEPT, 'app-k')).toBe(1);
    expect(appendixHeadingCount(syntheticStructure(KEPT), 'L')).toBe(0);
    expect(appendixHeadingCount(syntheticStructure(KEPT), 'K')).toBe(1);
    expect(appendixHeadingLineCount(KEPT, 'L')).toBe(0);
    expect(appendixHeadingLineCount(KEPT, 'K')).toBe(1);
  });

  it('fails closed: an artifact that held the anchor line or the heading would be counted', () => {
    const leaked = `${KEPT}\n${LEFT_OUT}`;
    expect(sectionAnchorLineCount(leaked, 'app-l')).toBe(1);
    expect(appendixHeadingCount(syntheticStructure(leaked), 'L')).toBe(1);
    expect(appendixHeadingLineCount(leaked, 'L')).toBe(1);
    // The heading alone, with no anchor line, is still counted, however it is spaced or cased.
    for (const heading of ['## Appendix L: Title', '### Appendix  L', '## APPENDIX L - Title', '# Appendix\tL: Title']) {
      const content = `${KEPT}\n${heading}\n\nTail.\n`;
      expect(appendixHeadingCount(syntheticStructure(content), 'L')).toBe(1);
      expect(appendixHeadingLineCount(content, 'L')).toBe(1);
    }
    // Not counted: another appendix whose name merely starts with the letter, and prose.
    expect(appendixHeadingLineCount(`${KEPT}\n## Appendix LA: Other\n\nSee Appendix L.\n`, 'L')).toBe(0);
  });

  it('counts a stable id as a whole value or as a `#id` reference, never as part of a longer id', () => {
    expect(stableIdMentionCount(['app-l', 'see #app-l here', '[a](#app-l)', 'app-la', '#app-l-1', 'plain'], 'app-l')).toBe(3);
    expect(allStrings({ 'app-l': ['x', { nested: 'app-l' }] })).toEqual(['app-l', 'x', 'nested', 'app-l']);
  });
});

describe('assertWithheldNavigation: the stable id names nothing in the artifact (synthetic text)', () => {
  const BASE = '# Paper\n\nText.\n\n<div id="sec-appendices" class="section-anchor"></div>\n\n# Appendices\n\nText.\n';
  const entry = { stableSectionId: 'app-l' };
  const failure = (reason: string) => `Paper full-document model unavailable: ${reason}`;

  it('baseline: an id that is absent passes', () => {
    expect(() => assertWithheldNavigation(syntheticStructure(BASE), entry)).not.toThrow();
  });

  it('refuses a stable id that is a heading anchor of the text', () => {
    expect(() => assertWithheldNavigation(syntheticStructure(`${BASE}\n# app-l\n\nText.\n`), entry)).toThrow(failure('the withheld stable id is a heading anchor of the presented text'));
  });

  it('refuses a stable id that has an anchor line in the text, even one the legacy map cannot place', () => {
    // Prose sits between the anchor line and the next heading and the id is not numeric, so
    // the legacy map drops it; the anchor-line rule still reads it.
    const content = `${BASE}\n<div id="app-l" class="section-anchor"></div>\n\nSome prose first.\n\n# Later\n\nText.\n`;
    const structure = syntheticStructure(content);
    expect(Object.keys(buildLegacyAnchorMap(structure))).not.toContain('app-l');
    expect(standaloneSectionAnchorIds(content)).toContain('app-l');
    expect(() => assertWithheldNavigation(structure, entry)).toThrow(failure('the withheld stable id has an anchor line in the presented text'));
  });

  it('refuses a stable id that is a span id of the text', () => {
    expect(() => assertWithheldNavigation(syntheticStructure(`${BASE}\n[]{#app-l}A caption.\n`), entry)).toThrow(failure('the withheld stable id is a span id of the presented text'));
  });
});

describePrivate('the artifact does not contain the section it leaves out (private fixture)', () => {
  it('holds no anchor line for the stable id and no heading of that appendix; Appendix K has both', () => {
    const structure = privateR5Structure();
    expect(sectionAnchorLineCount(structure.content, 'app-l')).toBe(0);
    expect(standaloneSectionAnchorIds(structure.content).filter((id) => id === 'app-l')).toHaveLength(0);
    expect(appendixHeadingCount(structure, 'L')).toBe(0);
    expect(appendixHeadingLineCount(structure.content, 'L')).toBe(0);
    // Controls: the same probes find the last appendix the artifact does contain.
    expect(sectionAnchorLineCount(structure.content, 'app-k')).toBe(1);
    expect(appendixHeadingCount(structure, 'K')).toBeGreaterThan(0);
    expect(appendixHeadingLineCount(structure.content, 'K')).toBeGreaterThan(0);
  });

  it('passes assertWithheldNavigation for the bound entry, and fails it for an appendix the artifact contains', () => {
    const structure = privateR5Structure();
    expect(() => assertWithheldNavigation(structure, r5Release.withheld!)).not.toThrow();
    expect(() => assertWithheldNavigation(structure, { stableSectionId: 'app-k' })).toThrow('Paper full-document model unavailable: the withheld stable id has an anchor line in the presented text');
    expect(buildLegacyAnchorMap(structure)['sec-appendices']).toBe('technical-appendices-compendium');
  });

  it('chunks, section contracts and section summaries: none names the stable id', () => {
    const structure = privateR5Structure();
    const { chunks, groups } = getPaperSectionWindowModel(structure);
    const identity = paperSectionIdentity(structure, R5_PAPER_VERSION);
    const contracts = groups.map((group) => buildPaperSectionContract(structure, groups, group.index, identity));
    const summaries = summarizePaperSections(groups);
    // What a reader is sent carries no mention at all.
    for (const surface of [chunks, contracts, summaries]) expect(stableIdMentionCount(allStrings(surface), 'app-l')).toBe(0);
    // Control: the same count over Appendix K is positive on each surface that carries text.
    expect(stableIdMentionCount(allStrings(chunks), 'app-k')).toBeGreaterThan(0);
    expect(stableIdMentionCount(allStrings(contracts), 'app-k')).toBeGreaterThan(0);
    expect(groups).toHaveLength(98);
  });

  it('outline, link map, anchors, legacy ids and stable ids: none names the stable id', () => {
    const structure = privateR5Structure();
    const outline = getPaperNavOutline(structure);
    const linkMap = buildPaperLinkMap(structure);
    const legacy = buildLegacyAnchorMap(structure);
    const stable = getPaperStableSectionIds(structure);
    const anchors = [...sectionAnchorSet(structure)];
    const strings = allStrings({ outline, linkMap, legacy, stable, anchors, pandoc: buildPandocAnchorMap(structure) });
    expect(strings.filter((value) => value === 'app-l')).toHaveLength(0);
    expect(outline.filter((entry) => /^\s*Appendix\s+L(?![A-Za-z0-9])/i.test(entry.label))).toHaveLength(0);
    expect(outline.filter((entry) => /^\s*Appendix\s+K(?![A-Za-z0-9])/i.test(entry.label)).length).toBeGreaterThan(0);
    // Positive controls: every other appendix is still a stable section of this release.
    for (const id of ['sec-appendices', 'app-a', 'app-b', 'app-c', 'app-d', 'app-e', 'app-f', 'app-g', 'app-h', 'app-i', 'app-k']) {
      expect(Object.keys(legacy)).toContain(id);
      expect(Object.keys(linkMap)).toContain(id);
      expect(Object.values(stable)).toContain(id);
    }
  });

  it('My Review portions: none carries a reference to the stable id', () => {
    const portions = deriveCohortPortions(privateR5Structure(), getCohortManifest(R5_PAPER_VERSION));
    expect(portions).toHaveLength(14);
    expect(stableIdMentionCount(allStrings(portions), 'app-l')).toBe(0);
    expect(portions.filter((portion) => portion.status === 'available' && (portion.text ?? '').length > 0)).toHaveLength(14);
  });
});

describe('the default release still has its own Appendix L under the same stable id', () => {
  it('keeps the id in its legacy map and its link map', () => {
    const structure = loadRevisedPaperStructure(REVISED_PAPER_VERSION);
    expect(Object.keys(buildLegacyAnchorMap(structure))).toContain('app-l');
    expect(Object.prototype.hasOwnProperty.call(buildPaperLinkMap(structure), 'app-l')).toBe(true);
    expect(sectionAnchorLineCount(structure.content, 'app-l')).toBe(1);
    expect(appendixHeadingCount(structure, 'L')).toBeGreaterThan(0);
  });
});

describe('links into the withheld section', () => {
  // The rules for entries and links (which node is an entry, that it is removed whole, what the builders refuse)
  // are shown on synthetic text in withheld-sections.test.ts; the line-based rules those cases were first
  // written against no longer exist.
  it('inactiveLinkAudit counts literal references and simple links separately', () => {
    expect(inactiveLinkAudit('[a](#app-x) and [b](#app-x)', 'app-x')).toEqual({ tokens: 2, links: 2 });
    expect(inactiveLinkAudit('[a](#app-x "t")', 'app-x')).toEqual({ tokens: 1, links: 0 });
    expect(inactiveLinkAudit('![a](#app-x)', 'app-x')).toEqual({ tokens: 1, links: 0 });
    expect(inactiveLinkAudit('see #app-x here', 'app-x')).toEqual({ tokens: 1, links: 0 });
    expect(inactiveLinkAudit('[a](#app-xy) [b](#app-x-1) [c](#app-x_2)', 'app-x')).toEqual({ tokens: 0, links: 0 });
    expect(inactiveLinkAudit('no reference', 'app-x')).toEqual({ tokens: 0, links: 0 });
  });
});

describePrivate('links into the withheld section (private fixture)', () => {
  // Every assertion in this suite compares a count or a boolean: a failure prints numbers, never text.
  type Shown = readonly { readonly markdown: string }[];
  const count = (list: Shown, test: (markdown: string) => boolean): number => list.filter((chunk) => test(chunk.markdown)).length;
  const lineCount = (list: Shown, test: (line: string) => boolean): number => list.reduce((total, chunk) => total + chunk.markdown.split('\n').filter(test).length, 0);
  // Entries are counted as the parser reads them (withheld-sections.ts), on each chunk and on what the renderer is handed.
  const entryCount = (list: Shown, id: string): number => list.reduce((total, chunk) => total + withheldEntryCounts(chunk.markdown, [id]).total, 0);
  const shownEntryCount = (list: Shown, id: string): number => list.reduce((total, chunk) => total + shownWithheldEntryCount(chunk.markdown, [id]), 0);
  const build = () => {
    const structure = privateR5Structure();
    return {
      structure,
      chunks: buildPaperChunks(structure),
      // The same text built WITHOUT the withheld-section rule: the control for every zero below.
      withoutRule: buildPaperChunks({ content: structure.content, nodes: structure.nodes, presentation: { frontMatter: true } }),
    };
  };
  // Both builds parse the whole paper and nothing below changes them: they are made once for the suite.
  let built: ReturnType<typeof build> | undefined;
  const builds = () => (built ??= build());
  // These tests parse every chunk of the paper more than once; under coverage that is slow.
  const WHOLE_PAPER_TIMEOUT_MS = 180_000;

  it('the artifact names the withheld appendix in two list entries (its contents line, and one line of a list of the appendices), and what is shown has neither', { timeout: WHOLE_PAPER_TIMEOUT_MS }, () => {
    const { structure, chunks, withoutRule } = builds();
    // Control: the SOURCE carries one reference to the stable id, a simple link ...
    expect(inactiveLinkAudit(structure.content, 'app-l')).toEqual({ tokens: 1, links: 1 });
    // ... and, as the parser reads the whole text, exactly two entries: two list items that open with the
    // designation, one of them nothing but that link. No table row, no raw HTML, nothing that cannot be removed.
    expect(withheldEntryCounts(maskFrontMatter(structure.content), ['app-l'])).toEqual({ namingItems: 2, linkItems: 1, tableRows: 0, html: 0, footnotes: 0, unremovable: 0, total: 2 });
    // The same two are found chunk by chunk, in two chunks, before the rule is applied.
    const totals = withoutRule.map((chunk) => withheldEntryCounts(chunk.markdown, ['app-l']).total);
    const holders = totals.map((_, position) => position).filter((position) => totals[position] > 0);
    expect(holders.length).toBe(2);
    expect(totals.reduce((sum, total) => sum + total, 0)).toBe(2);
    // The count the builders use (whole chunk and each piece of prose) sees them in those two chunks too.
    expect(shownEntryCount(holders.map((position) => withoutRule[position]), 'app-l')).toBeGreaterThanOrEqual(2);

    // Each chunk that held an entry is shown without exactly ONE line; every other line is as it was.
    const removed: string[] = [];
    for (const position of holders) {
      const before = withoutRule[position].markdown.split('\n');
      const after = chunks[position].markdown.split('\n');
      expect(after.length).toBe(before.length - 1);
      // (The first line may be a contents heading, which the display label rewrites.)
      const gone = before.findIndex((line, index) => index > 0 && line !== after[index]);
      expect(gone > 0).toBe(true);
      removed.push(before[gone]);
      expect(before.filter((_, index) => index !== gone).slice(1).every((line, offset) => line === after[offset + 1])).toBe(true);
    }
    expect(removed.filter((line) => line.includes('](#app-l)')).length).toBe(1);
    const entryLine = removed.find((line) => line.includes('](#app-l)')) ?? '';
    const listedLine = removed.find((line) => !line.includes('](#app-l)')) ?? '';
    // The contents entry's own words (the appendix's designation and title, as the contents list has them).
    const entryText = /\[([^[\]]*)\]\(#app-l\)/.exec(entryLine)?.[1] ?? '';
    expect(entryText.length > 0).toBe(true);
    expect(listedLine.length > 0).toBe(true);
    // Neither line is shown at all: nothing of it is left, not even as plain text.
    expect(presentWithheldSections(`${entryLine}\n`, ['app-l']) === '').toBe(true);
    expect(presentWithheldSections(`${listedLine}\n`, ['app-l']) === '').toBe(true);

    const holdsRemovedLine = (markdown: string): boolean => markdown.split('\n').some((line) => removed.includes(line));
    // What is shown: no reference, no line with the entry's words, neither line, no entry for the appendix
    // in any chunk nor in any piece of prose the renderer is handed.
    expect(count(chunks, (markdown) => markdown.includes('#app-l'))).toBe(0);
    expect(count(chunks, (markdown) => markdown.includes(entryText))).toBe(0);
    expect(count(chunks, holdsRemovedLine)).toBe(0);
    // (shownWithheldEntryCount counts the whole chunk first, then each piece of prose: zero means both are zero.)
    expect(shownEntryCount(chunks, 'app-l')).toBe(0);
    // Control: built WITHOUT the rule, one chunk carries the link and the entry's words, and two chunks a removed line.
    expect(count(withoutRule, (markdown) => markdown.includes('](#app-l)'))).toBe(1);
    expect(count(withoutRule, (markdown) => markdown.includes(entryText))).toBe(1);
    expect(count(withoutRule, holdsRemovedLine)).toBe(2);
    // Control: the same probe finds the entries of an appendix the artifact contains, in what is shown.
    expect(chunks.some((chunk) => withheldEntryCounts(chunk.markdown, ['app-k']).total > 0)).toBe(true);
    // Control: under the rule this release had first (the link shown as its text, nothing removed),
    // the contents entry's words WERE on the page as a list entry: this is what the removal takes away.
    const asTextOnly = entryLine.replace(/\[([^[\]]*)\]\(#app-l\)/, '$1');
    expect(asTextOnly.includes(entryText)).toBe(true);
    expect(withheldEntryCounts(`${asTextOnly}\n`, ['app-l']).namingItems).toBe(1);

    // Nothing else differs between the two builds: the four contents headings (one of those chunks
    // holds the contents entry) and the chunk that holds the other entry.
    expect(chunks.filter((chunk, position) => chunk.markdown !== withoutRule[position].markdown).length).toBe(5);
    expect(chunks.length).toBe(withoutRule.length);
  });

  it('no line of what is shown gives the withheld appendix a title: what is left are three sentences that mention it by its letter', { timeout: WHOLE_PAPER_TIMEOUT_MS }, () => {
    const { structure, chunks, withoutRule } = builds();
    const titleForm = (letter: string) => (line: string): boolean => new RegExp(`Appendix\\s+${letter}\\s*:`, 'i').test(line);
    const mention = (letter: string) => (line: string): boolean => new RegExp(`Appendix\\s+${letter}(?![A-Za-z0-9])`, 'i').test(line);
    // "Appendix L:" is the form a title follows. Shown: none. Without the rule: the one contents entry.
    expect(lineCount(chunks, titleForm('L'))).toBe(0);
    expect(lineCount(withoutRule, titleForm('L'))).toBe(1);
    // Control: the same probe finds the titled lines of an appendix the artifact contains.
    expect(lineCount(chunks, titleForm('K'))).toBeGreaterThan(0);
    // Every line that mentions the appendix at all: five in the artifact, three in what is shown.
    expect(lineCount(withoutRule, mention('L'))).toBe(5);
    expect(lineCount(chunks, mention('L'))).toBe(3);
    // The three that are shown are sentences: no list entry, heading or table row, and none of them
    // carries the title the contents entry gives the appendix.
    const entryLine = structure.content.split('\n').find((line) => line.includes('](#app-l)')) ?? '';
    const title = (/\[([^[\]]*)\]\(#app-l\)/.exec(entryLine)?.[1] ?? '').replace(/^Appendix\s+L\s*:\s*/i, '').toLowerCase();
    expect(title.length > 0 && !/^appendix/.test(title)).toBe(true);
    const shownMentions = chunks.flatMap((chunk) => chunk.markdown.split('\n')).filter(mention('L'));
    expect(shownMentions.filter((line) => /^[ \t]*(?:>[ \t]*)*(?:[-*+]|[0-9]{1,9}[.)])[ \t]+/.test(line) || /^#{1,6}\s/.test(line) || /^\s*\|/.test(line)).length).toBe(0);
    expect(shownMentions.filter((line) => line.toLowerCase().includes(title)).length).toBe(0);
    // Control: without the rule, two of the five lines carry that title next to the appendix's letter.
    expect(withoutRule.flatMap((chunk) => chunk.markdown.split('\n')).filter(mention('L')).filter((line) => line.toLowerCase().includes(title)).length).toBe(2);
  });

  it('My Review portions are cut from the same text under the same rule: no entry for the withheld appendix, and no title form', () => {
    const portions = deriveCohortPortions(privateR5Structure(), getCohortManifest(R5_PAPER_VERSION)).map((portion) => ({ markdown: portion.text ?? '' }));
    expect(portions.length).toBe(14);
    expect(entryCount(portions, 'app-l')).toBe(0);
    expect(shownEntryCount(portions, 'app-l')).toBe(0);
    expect(lineCount(portions, (line) => /Appendix\s+L\s*:/i.test(line))).toBe(0);
    expect(count(portions, (markdown) => markdown.includes('#app-l'))).toBe(0);
  });

  it('the link map has no entry for the withheld id, although the heuristic would invent one', () => {
    const structure = privateR5Structure();
    // Control: the unfiltered heuristic map DOES carry the id (the artifact has no anchor line
    // for it, so a target is guessed for the one reference). This is what the reader map removes.
    const heuristic = createWorkspaceModel(structure, { lens: 'all', q: '', page: 1 }, 'working-draft').internalLinkMap;
    expect(Object.prototype.hasOwnProperty.call(heuristic, 'app-l')).toBe(true);
    const linkMap = buildPaperLinkMap(structure);
    expect(Object.prototype.hasOwnProperty.call(linkMap, 'app-l')).toBe(false);
    // Every other in-page link of the contents section still resolves.
    const contents = buildPaperChunks(structure).find((chunk) => chunk.anchor === 'master-table-of-contents')!;
    const targets = Array.from(contents.markdown.matchAll(/\]\(#([A-Za-z0-9_-]+)\)/g), (match) => match[1]);
    expect(targets.length).toBeGreaterThan(50);
    expect(targets.filter((target) => !Object.prototype.hasOwnProperty.call(linkMap, target))).toHaveLength(0);
  });
});

describe('contents heading: shown as the release display label, exactly', () => {
  it('presentContentsHeadingFirstLine rewrites only an exact first line', () => {
    expect(presentContentsHeadingFirstLine('## Master Table of Contents\n\n1. [Intro](#intro)\n', 'Table of Contents')).toBe('## Table of Contents\n\n1. [Intro](#intro)\n');
    expect(presentContentsHeadingFirstLine('### Master Table of Contents  \nText', 'Table of Contents')).toBe('### Table of Contents\nText');
    expect(presentContentsHeadingFirstLine('## Master Table of Contents', 'Table of Contents')).toBe('## Table of Contents');
    for (const untouched of ['## Master Table of Contents of something\n', '## The Master Table of Contents\n', 'Master Table of Contents\n', '## Master Table of Contents ##\n', 'Intro\n\n## Master Table of Contents\n', '####### Master Table of Contents\n']) {
      expect(presentContentsHeadingFirstLine(untouched, 'Table of Contents')).toBeNull();
    }
  });

  it('default release: no display label, so every chunk label is its node label and the source heading is left for the region relabel', () => {
    const structure = loadRevisedPaperStructure(REVISED_PAPER_VERSION);
    const chunks = buildPaperChunks(structure);
    const headingChunks = chunks.filter((chunk) => chunk.nodeId !== null);
    expect(headingChunks.map((chunk) => chunk.label)).toEqual(structure.nodes.map((node) => node.label));
    expect(headingChunks.filter((chunk) => chunk.label === 'Master Table of Contents').length).toBeGreaterThanOrEqual(2);
    expect(chunks.filter((chunk) => chunk.label === 'Table of Contents')).toHaveLength(0);
  });

  it('fails the build when a contents-heading node cannot be shown under the display label', () => {
    // The node label is the exact heading, but its line carries closing hashes, so the
    // first-line rule does not apply. Leaving it would let the other relabel layer run.
    const content = '# Paper\n\nText.\n\n## Master Table of Contents ##\n\n1. Item\n';
    expect(() => buildPaperChunks(syntheticStructure(content, { frontMatter: false, contentsHeadingDisplay: 'Table of Contents' }))).toThrow('Paper full-document model unavailable: a contents heading was not shown under its display label');
    // Two-sided: the same text builds when the release names no display label, and an
    // exact line builds with one.
    expect(buildPaperChunks(syntheticStructure(content)).map((chunk) => chunk.label)).toEqual(['Paper', 'Master Table of Contents']);
    expect(buildPaperChunks(syntheticStructure('# Paper\n\nText.\n\n## Master Table of Contents\n\n1. Item\n', { frontMatter: false, contentsHeadingDisplay: 'Table of Contents' })).map((chunk) => chunk.label)).toEqual(['Paper', 'Table of Contents']);
  });

  it('fails the build when a display label would make a chunk longer than its source range', () => {
    // The client checks each section against its byte range; a longer display label must stop
    // the build here, not surface as a section the reader cannot load.
    const content = '# Paper\n\nText.\n\n## Master Table of Contents\n\n1. Item\n';
    expect(() => buildPaperChunks(syntheticStructure(content, { frontMatter: false, contentsHeadingDisplay: 'Table of Contents of this draft of the paper' }))).toThrow('Paper full-document model unavailable: presented chunk exceeds its source range');
    // Two-sided: a label no longer than the authored heading builds.
    expect(buildPaperChunks(syntheticStructure(content, { frontMatter: false, contentsHeadingDisplay: 'Table of Contents' })).map((chunk) => chunk.label)).toEqual(['Paper', 'Table of Contents']);
  });

  it('refuses a display label that is not one line of plain words (it could add a line or markup of its own)', () => {
    const content = '# Paper\n\nText.\n\n## Master Table of Contents\n\n1. Item\n';
    for (const contentsHeadingDisplay of ['X\n# Injected', 'X\r\nY', '', ' ', ' Contents', 'Contents ', '*Contents*', 'Contents <b>', '[Contents](#x)', '# Contents']) {
      expect(() => buildPaperChunks(syntheticStructure(content, { frontMatter: false, contentsHeadingDisplay }))).toThrow('Paper full-document model unavailable: the contents display label is not one line of plain words');
    }
    // The label is refused even when the paper has no contents heading for it to be written into.
    expect(() => buildPaperChunks(syntheticStructure('# Paper\n\nText.\n', { frontMatter: false, contentsHeadingDisplay: 'X\n# Injected' }))).toThrow('the contents display label is not one line of plain words');
    // Two-sided: plain words build, and the bound label is such a label.
    expect(buildPaperChunks(syntheticStructure(content, { frontMatter: false, contentsHeadingDisplay: 'Contents' })).map((chunk) => chunk.label)).toEqual(['Paper', 'Contents']);
    expect(r5Release.contentsHeadingDisplay).toBe('Table of Contents');
  });

  it('leaves a matching line alone when it is not the first line of a contents-heading chunk', () => {
    const content = '# Paper\n\nText.\n\n## Master Table of Contents\n\nSee below.\n\n## Other section\n\nQuoted:\n\n## Master Table of Contents of something else\n';
    const chunks = buildPaperChunks(syntheticStructure(content, { frontMatter: false, contentsHeadingDisplay: 'Table of Contents' }));
    expect(chunks.map((chunk) => chunk.label)).toEqual(['Paper', 'Table of Contents', 'Other section', 'Master Table of Contents of something else']);
    expect(chunks[3].markdown).toBe('## Master Table of Contents of something else\n');
  });
});

describePrivate('contents heading (private fixture)', () => {
  const CONTENTS_ANCHORS = ['master-table-of-contents', 'master-table-of-contents-1', 'master-table-of-contents-2', 'master-table-of-contents-3'];

  it('exactly four chunks change, each by its first line losing "Master " and by its label; nothing else moves', () => {
    const structure = privateR5Structure();
    const shown = buildPaperChunks(structure);
    const plain = buildPaperChunks({ content: structure.content, nodes: structure.nodes, presentation: { frontMatter: true, inactiveLinkTargets: ['app-l'] } });
    expect(shown).toHaveLength(plain.length);
    const changed = shown.map((chunk, index) => ({ chunk, before: plain[index] })).filter(({ chunk, before }) => chunk.markdown !== before.markdown || chunk.label !== before.label);
    expect(changed.map(({ chunk }) => chunk.anchor)).toEqual(CONTENTS_ANCHORS);
    for (const { chunk, before } of changed) {
      expect(before.label === 'Master Table of Contents').toBe(true);
      expect(chunk.label === 'Table of Contents').toBe(true);
      const [firstBefore, ...restBefore] = before.markdown.split('\n');
      const [firstShown, ...restShown] = chunk.markdown.split('\n');
      expect(firstBefore === '## Master Table of Contents').toBe(true);
      expect(firstShown === '## Table of Contents').toBe(true);
      expect(restShown.length).toBe(restBefore.length);
      expect(restShown.every((line, index) => line === restBefore[index])).toBe(true);
      expect([chunk.id, chunk.nodeId, chunk.anchor, chunk.depth, chunk.startByte, chunk.endByte]).toEqual([before.id, before.nodeId, before.anchor, before.depth, before.startByte, before.endByte]);
    }
    // The source phrase is on no shown surface; without the rule it is on four.
    const occurrences = (chunks: readonly { readonly markdown: string; readonly label: string | null }[]) => chunks.filter((chunk) => chunk.markdown.includes('Master Table of Contents') || chunk.label === 'Master Table of Contents').length;
    expect(occurrences(shown)).toBe(0);
    expect(occurrences(plain)).toBe(4);
    // Identity is untouched: node labels and anchors are as authored.
    expect(structure.nodes.filter((node) => node.label === 'Master Table of Contents').map((node) => node.anchor)).toEqual(CONTENTS_ANCHORS);
  });

  it('the section summaries (the labels of sections not loaded yet) show the display label', () => {
    const summaries = summarizePaperSections(getPaperSectionWindowModel(privateR5Structure()).groups);
    expect(summaries.filter((summary) => summary.label === 'Table of Contents').map((summary) => summary.anchor)).toEqual(CONTENTS_ANCHORS);
    expect(summaries.filter((summary) => summary.label.includes('Master Table of Contents'))).toHaveLength(0);
  });
});

/*
 * A hash-form guide (reviewer-guide.ts) is resolved against the lines of its paper. The
 * rules that keep a question from being anchored to, or reading a line of, something the
 * artifact does not contain are shown here on a small synthetic guide; the bound guide is
 * resolved against the real artifact in the private suite below.
 */
describe('reviewer guide: resolved against the artifact only (synthetic text)', () => {
  const LINES = ['# Paper', '', '<div id="sec-one" class="section-anchor"></div>', '', '**On a topic**', '', '1. A first synthetic question?', '2. A second synthetic', '   question on two lines?', '', '<div id="app-k" class="section-anchor"></div>', ''];
  const hashOf = (heading: string, prompt: string) => sha(`${heading}\n${prompt}`);
  const binding = (patch: (questions: Record<string, unknown>[]) => void = () => {}): ReviewerGuideBinding => {
    const questions: Record<string, unknown>[] = [
      { number: 1, id: 'q1', sourceLines: [7, 7], textSha256: hashOf('On a topic', 'A first synthetic question?'), sectionAnchors: ['sec-one'] },
      { number: 2, id: 'q2', sourceLines: [8, 9], textSha256: hashOf('On a topic', 'A second synthetic question on two lines?'), sectionAnchors: ['sec-one', 'app-k'] },
    ];
    patch(questions);
    return { schemaVersion: 'matrix-paper-reviewer-guide-v1', releaseIdentity: R5_PAPER_VERSION, sourcePath: 'synthetic', questions } as unknown as ReviewerGuideBinding;
  };

  it('baseline: resolves each question to the heading and prompt its lines carry', () => {
    const resolved = resolveReviewerGuideAgainstLines(binding(), LINES, sha);
    expect(resolved.questions.map((question) => [question.number, question.heading, question.prompt])).toEqual([[1, 'On a topic', 'A first synthetic question?'], [2, 'On a topic', 'A second synthetic question on two lines?']]);
    expect(resolved.questions.some((question) => 'textSha256' in question)).toBe(false);
    expect(resolved.questions[1].sectionAnchors).toEqual(['sec-one', 'app-k']);
  });

  it('refuses a question anchored to a section the text does not carry, and accepts the same question anchored to one it does', () => {
    expect(() => resolveReviewerGuideAgainstLines(binding((questions) => { questions[0].sectionAnchors = ['app-l']; }), LINES, sha)).toThrow('Invalid reviewer guide contract: section anchor source 1');
    expect(() => resolveReviewerGuideAgainstLines(binding((questions) => { questions[0].sectionAnchors = ['app-k']; }), LINES, sha)).not.toThrow();
  });

  it('refuses a question whose source lines lie past the end of the text', () => {
    expect(() => resolveReviewerGuideAgainstLines(binding((questions) => { questions[1].sourceLines = [LINES.length + 1, LINES.length + 2]; }), LINES, sha)).toThrow('Invalid reviewer guide contract: source range 2');
    expect(() => resolveReviewerGuideAgainstLines(binding((questions) => { questions[1].sourceLines = [9, 8]; }), LINES, sha)).toThrow('Invalid reviewer guide contract: source range 2');
  });

  it('refuses a question whose lines, or whose heading, do not hash to what is bound', () => {
    expect(() => resolveReviewerGuideAgainstLines(binding((questions) => { questions[1].sourceLines = [8, 8]; }), LINES, sha)).toThrow('Invalid reviewer guide contract: text SHA-256 2');
    expect(() => resolveReviewerGuideAgainstLines(binding((questions) => { questions[0].textSha256 = hashOf('On another topic', 'A first synthetic question?'); }), LINES, sha)).toThrow('Invalid reviewer guide contract: text SHA-256 1');
    expect(() => resolveReviewerGuideAgainstLines(binding(), LINES.map((line) => (line === '1. A first synthetic question?' ? '1. A first synthetic question.' : line)), sha)).toThrow('Invalid reviewer guide contract: text SHA-256 1');
    // No bold heading line above the question at all.
    expect(() => resolveReviewerGuideAgainstLines(binding(), LINES.map((line) => (line === '**On a topic**' ? 'On a topic' : line)), sha)).toThrow('Invalid reviewer guide contract: heading source 1');
  });
});

describePrivate('reviewer guide: resolved against the artifact only (private fixture)', () => {
  const lines = () => privateR5Structure().content.split('\n');
  const withQuestion = (number: number, patch: Record<string, unknown>): ReviewerGuideBinding => {
    const guide = getReviewerGuideBinding(R5_PAPER_VERSION);
    return { ...guide, questions: guide.questions.map((question) => (question.number === number ? { ...question, ...patch } : question)) } as ReviewerGuideBinding;
  };
  const failure = (guide: ReviewerGuideBinding, source: readonly string[]): string => {
    try {
      resolveReviewerGuideAgainstLines(guide, source, sha);
      return 'resolved';
    } catch (error) {
      return error instanceof Error ? error.message : 'unknown';
    }
  };

  it('resolves the bound guide against the artifact: twelve questions, each with text that hashes to its binding', () => {
    const resolved = resolveReviewerGuide(privateR5Structure());
    const bound = getReviewerGuideBinding(R5_PAPER_VERSION);
    expect(resolved.questions).toHaveLength(12);
    expect(resolved.questions.map((question) => sha(`${question.heading}\n${question.prompt}`))).toEqual(bound.questions.map((question) => question.textSha256));
    expect(resolved.questions.filter((question) => question.heading.length === 0 || question.prompt.length === 0)).toHaveLength(0);
    expect(failure(bound, lines())).toBe('resolved');
  });

  it('refuses a question anchored to the withheld section, and accepts the same question anchored to an appendix the artifact contains', () => {
    expect(failure(withQuestion(1, { sectionAnchors: ['app-l'] }), lines())).toBe('Invalid reviewer guide contract: section anchor source 1');
    expect(failure(withQuestion(1, { sectionAnchors: ['app-k'] }), lines())).toBe('resolved');
  });

  it('refuses a question whose source lines lie past the artifact', () => {
    const count = lines().length;
    expect(failure(withQuestion(12, { sourceLines: [count + 1, count + 2] }), lines())).toBe('Invalid reviewer guide contract: source range 12');
  });
});

describe('reviewer guide: the default release is authenticated against its whole file', () => {
  it('accepts the exact file and refuses it one character short', async () => {
    const predecessor = loadRevisedPaper(REVISED_PAPER_VERSION);
    await expect(authenticateReviewerGuideAgainstPaper(getReviewerGuideContract(), predecessor.content)).resolves.toBeUndefined();
    await expect(authenticateReviewerGuideAgainstPaper(getReviewerGuideContract(), predecessor.content.slice(0, -1))).rejects.toThrow('Invalid reviewer guide contract: paper byte length');
  });
});
