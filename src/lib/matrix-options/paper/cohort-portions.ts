import type { CohortId, CohortManifest } from '../cohort-contract';
import type { RevisedPaperNode, RevisedPaperStructure } from '../revised-paper-structure';
import { sourceRangeText } from '../revised-paper-review';
import { stripStandaloneSectionAnchorLines } from './full-document';
import { presentWithheldSections, shownWithheldEntryCount } from './withheld-sections';

/*
 * Cohort paper portions: resolves each cohort's paper section locators to
 * authenticated heading nodes before the Technical Appendices Compendium and
 * returns exact UTF-8 byte ranges (the structure's unit) plus their text.
 *
 * Moved from the publication page (resolveCohortSectionNodes /
 * deriveCohortPortions) with results preserved for the real paper, plus
 * sectionAnchor and strict section-number parsing (F-08):
 * - a locator yields numbers only when the WHOLE locator has the form
 *   "Section N" or "Sections N, N and N" (separators: comma, "and", "&"),
 *   each N an exact numeric section token (1-2 digits per dotted part);
 *   anything else (dates, words containing digits, free text) yields none;
 * - Reviewer's Guide locators are ignored, as before;
 * - a heading has a section number only when its label starts with an exact
 *   numeric token followed by whitespace, end of label, ". " or ":".
 * Labels and messages describe only resolved section numbers and ranges.
 */

export interface CohortPortion {
  readonly id: string;
  readonly cohortId: CohortId;
  readonly name: string;
  readonly status: 'available' | 'unavailable';
  readonly sectionNumber: string;
  readonly sourceLocator: string;
  readonly sourceNodeId?: string;
  readonly sectionLabel?: string;
  readonly startByte?: number;
  readonly endByte?: number;
  readonly text?: string;
  readonly sectionAnchor?: string;
}

type PortionNode = Pick<RevisedPaperNode, 'id' | 'depth' | 'label' | 'parentId' | 'kind' | 'startByte' | 'endByte' | 'anchor'>;

const REVIEWERS_GUIDE_LOCATOR = /Reviewer's Guide/i;
const APPENDIX_BOUNDARY_LABELS = new Set(['Technical Appendices Compendium', 'Technical Appendices']);
const SECTION_NUMBER_TOKEN = /^\d{1,2}(?:\.\d{1,2})*$/;
const SECTION_LOCATOR = /^Sections?[ \t]+(\S(?:.*\S)?)$/;
const SECTION_LIST_SEPARATOR = /[ \t]*,[ \t]*(?:and[ \t]+)?|[ \t]+and[ \t]+|[ \t]*&[ \t]*/;
const HEADING_SECTION_NUMBER = /^\s*(\d{1,2}(?:\.\d{1,2})*)(?:\.?(?:\s|$)|:)/;

function normalizeSectionNumber(value: string): string {
  return value.replace(/\.0$/, '');
}

export function sectionNumbersFromLocator(locator: string): readonly string[] {
  if (REVIEWERS_GUIDE_LOCATOR.test(locator)) return [];
  const match = SECTION_LOCATOR.exec(locator.trim());
  if (!match) return [];
  const tokens = match[1].split(SECTION_LIST_SEPARATOR);
  if (tokens.length === 0 || tokens.some((token) => !SECTION_NUMBER_TOKEN.test(token))) return [];
  return tokens.map(normalizeSectionNumber);
}

export function sectionNumberFromHeading(label: string): string | undefined {
  const match = HEADING_SECTION_NUMBER.exec(label);
  return match ? normalizeSectionNumber(match[1]) : undefined;
}

interface ResolvedCohortSection {
  readonly sectionNumber: string;
  readonly sourceLocator: string;
  readonly nodes: readonly PortionNode[];
}

/**
 * The numbered subsections of `section` that are authored at the SAME heading
 * level as the section itself and follow it without a gap ("7.5" followed by
 * "7.5.1", "7.5.2", "7.5.3" as siblings, as the R5 draft authors them).
 *
 * A heading's range ends at the next heading of equal or shallower depth, so
 * such subsections are not inside the section's own range and a portion made
 * of the section node alone would stop at its lead-in. Subsections authored
 * one level deeper are already inside the section's range and are skipped
 * here; a section with none of either kind is returned as it always was.
 *
 * Known limit: collection stops at the first same-level heading that is not a
 * numbered subsection of this section, so an unnumbered same-level heading
 * between two numbered subsections would end the portion early. Neither bound
 * paper has that shape; the portion ranges of both are pinned by test.
 */
function sameLevelSubsections(canonicalNodes: readonly PortionNode[], section: PortionNode, sectionNumber: string): readonly PortionNode[] {
  const subsections: PortionNode[] = [];
  let coveredUntil = section.endByte;
  for (let index = canonicalNodes.indexOf(section) + 1; index < canonicalNodes.length; index += 1) {
    const candidate = canonicalNodes[index];
    // Inside the section itself, or inside a subsection already taken.
    if (candidate.startByte < coveredUntil) continue;
    const number = sectionNumberFromHeading(candidate.label);
    if (candidate.depth !== section.depth || candidate.parentId !== section.parentId || !number?.startsWith(`${sectionNumber}.`)) break;
    subsections.push(candidate);
    coveredUntil = candidate.endByte;
  }
  return subsections;
}

function resolveCohortSectionNodes(nodes: readonly PortionNode[], cohort: CohortManifest['cohorts'][number]): readonly ResolvedCohortSection[] {
  const appendixBoundaries = nodes.reduce<number[]>((indexes, node, index) => {
    if (node.depth === 1 && APPENDIX_BOUNDARY_LABELS.has(node.label)) indexes.push(index);
    return indexes;
  }, []);
  if (appendixBoundaries.length !== 1) throw new Error(`Expected exactly one authenticated appendix boundary; found ${appendixBoundaries.length}`);
  const appendixBoundary = appendixBoundaries[0];
  const canonicalNodes = nodes.slice(0, appendixBoundary).filter((node) => node.kind === 'heading');
  const requestedNumbers = [...new Set(cohort.sourceLocators.flatMap(sectionNumbersFromLocator))];
  if (requestedNumbers.length === 0) throw new Error(`Cohort has no paper section locators: ${cohort.id}`);
  return requestedNumbers.map((sectionNumber) => {
    const sourceLocator = cohort.sourceLocators.find((locator) => sectionNumbersFromLocator(locator).includes(sectionNumber)) ?? `Section ${sectionNumber}`;
    const matches = canonicalNodes.filter((node) => {
      const headingNumber = sectionNumberFromHeading(node.label);
      return headingNumber === sectionNumber || headingNumber?.startsWith(`${sectionNumber}.`);
    });
    const exact = matches.filter((node) => sectionNumberFromHeading(node.label) === sectionNumber);
    if (exact.length > 1) throw new Error(`Ambiguous canonical paper heading for ${cohort.id} section ${sectionNumber}`);
    if (exact.length === 1) return { sectionNumber, sourceLocator, nodes: [exact[0], ...sameLevelSubsections(canonicalNodes, exact[0], sectionNumber)] };
    const children = matches
      .filter((node) => sectionNumberFromHeading(node.label)?.startsWith(`${sectionNumber}.`) && node.parentId === matches[0]?.parentId)
      .sort((a, b) => a.startByte - b.startByte);
    const childNumbers = children.map((node) => sectionNumberFromHeading(node.label)?.slice(sectionNumber.length + 1));
    const consecutive = children.length > 0 && childNumbers.every((value, index) => value === String(index + 1));
    return consecutive ? { sectionNumber, sourceLocator, nodes: children } : { sectionNumber, sourceLocator, nodes: [] };
  });
}

export function deriveCohortPortions(structure: Pick<RevisedPaperStructure, 'content' | 'nodes' | 'presentation'>, manifest: CohortManifest): readonly CohortPortion[] {
  const portions = manifest.cohorts.flatMap((cohort) => resolveCohortSectionNodes(structure.nodes, cohort).map((resolved): CohortPortion => {
    if (resolved.nodes.length === 0) {
      return {
        id: `${cohort.id}:section-${resolved.sectionNumber}`,
        cohortId: cohort.id,
        name: cohort.name,
        status: 'unavailable',
        sectionNumber: resolved.sectionNumber,
        sourceLocator: resolved.sourceLocator,
        sectionLabel: `Section ${resolved.sectionNumber}`,
      };
    }
    const first = resolved.nodes[0];
    const last = resolved.nodes.at(-1) ?? first;
    const range = sourceRangeText(structure.content, first.startByte, last.endByte);
    const withheldIds = structure.presentation?.inactiveLinkTargets;
    // A withheld section is presented here as in the Working Draft, and IN THE SAME ORDER: the
    // standalone section-anchor lines go first, then the entries for the withheld section, then
    // the count. My Review strips those anchor lines before it draws a portion, and a line of raw
    // HTML directly above a list hides the list from the parser; presenting and counting the text
    // WITH the anchor lines would judge text the reader is not handed. A release that withholds
    // nothing keeps its portion as the exact text of its byte range.
    const text = withheldIds && withheldIds.length > 0 ? presentWithheldSections(stripStandaloneSectionAnchorLines(range), withheldIds) : range;
    if (!text.trim()) throw new Error(`Authenticated paper section is empty: ${cohort.id}/${resolved.sectionNumber}`);
    if (shownWithheldEntryCount(text, withheldIds) > 0) throw new Error(`Authenticated paper section lists a withheld appendix: ${cohort.id}/${resolved.sectionNumber}`);
    return {
      id: `${cohort.id}:${resolved.sectionNumber}`,
      cohortId: cohort.id,
      name: cohort.name,
      status: 'available',
      sectionNumber: resolved.sectionNumber,
      sourceLocator: resolved.sourceLocator,
      sourceNodeId: resolved.nodes.length === 1 ? first.id : `${first.id}..${last.id}`,
      // A section heading followed by its same-level subsections is named by its own heading;
      // a run of subsections with no section heading keeps the "Section N (first-last)" form.
      sectionLabel: resolved.nodes.length === 1 || sectionNumberFromHeading(first.label) === resolved.sectionNumber ? first.label : `Section ${resolved.sectionNumber} (${sectionNumberFromHeading(first.label)}-${sectionNumberFromHeading(last.label)})`,
      startByte: first.startByte,
      endByte: last.endByte,
      text,
      sectionAnchor: first.anchor,
    };
  }));
  if (portions.length === 0) throw new Error('Cohort manifest resolved no authenticated paper sections');
  return portions;
}
