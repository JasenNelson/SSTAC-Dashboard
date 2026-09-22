import type { CohortId, CohortManifest } from '../cohort-contract';
import type { RevisedPaperNode, RevisedPaperStructure } from '../revised-paper-structure';
import { sourceRangeText } from '../revised-paper-review';

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

function resolveCohortSectionNodes(nodes: readonly PortionNode[], cohort: CohortManifest['cohorts'][number]): readonly ResolvedCohortSection[] {
  const appendixBoundaries = nodes.reduce<number[]>((indexes, node, index) => {
    if (node.depth === 1 && node.label === 'Technical Appendices Compendium') indexes.push(index);
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
    if (exact.length === 1) return { sectionNumber, sourceLocator, nodes: exact };
    const children = matches
      .filter((node) => sectionNumberFromHeading(node.label)?.startsWith(`${sectionNumber}.`) && node.parentId === matches[0]?.parentId)
      .sort((a, b) => a.startByte - b.startByte);
    const childNumbers = children.map((node) => sectionNumberFromHeading(node.label)?.slice(sectionNumber.length + 1));
    const consecutive = children.length > 0 && childNumbers.every((value, index) => value === String(index + 1));
    return consecutive ? { sectionNumber, sourceLocator, nodes: children } : { sectionNumber, sourceLocator, nodes: [] };
  });
}

export function deriveCohortPortions(structure: Pick<RevisedPaperStructure, 'content' | 'nodes'>, manifest: CohortManifest): readonly CohortPortion[] {
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
    const text = sourceRangeText(structure.content, first.startByte, last.endByte);
    if (!text.trim()) throw new Error(`Authenticated paper section is empty: ${cohort.id}/${resolved.sectionNumber}`);
    return {
      id: `${cohort.id}:${resolved.sectionNumber}`,
      cohortId: cohort.id,
      name: cohort.name,
      status: 'available',
      sectionNumber: resolved.sectionNumber,
      sourceLocator: resolved.sourceLocator,
      sourceNodeId: resolved.nodes.length === 1 ? first.id : `${first.id}..${last.id}`,
      sectionLabel: resolved.nodes.length === 1 ? first.label : `Section ${resolved.sectionNumber} (${sectionNumberFromHeading(first.label)}-${sectionNumberFromHeading(last.label)})`,
      startByte: first.startByte,
      endByte: last.endByte,
      text,
      sectionAnchor: first.anchor,
    };
  }));
  if (portions.length === 0) throw new Error('Cohort manifest resolved no authenticated paper sections');
  return portions;
}
