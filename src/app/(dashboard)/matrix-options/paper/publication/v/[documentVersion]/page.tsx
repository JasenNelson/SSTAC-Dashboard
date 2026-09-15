import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_ROUTE, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import type { RevisedPaperNode } from '@/lib/matrix-options/revised-paper-structure';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { authenticateReviewerGuideAgainstPaper, getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { createWorkspaceModel, parseAtlasQuery, parseWorkspaceMode, ReviewQueryError, sourceRangeText } from '@/lib/matrix-options/revised-paper-review';
import type { CohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortPortion } from '@/components/matrix-options/paper/RevisedPaperWorkspace';

function normalizeSectionNumber(value: string): string {
  return value.replace(/\.0$/, '');
}

function sectionNumbersFromLocator(locator: string): readonly string[] {
  if (/Reviewer's Guide/i.test(locator)) return [];
  return [...locator.matchAll(/\b\d+(?:\.\d+)+\b|\b\d{1,2}\b/g)].map((match) => normalizeSectionNumber(match[0]));
}

function sectionNumberFromHeading(label: string): string | undefined {
  const match = label.match(/^\s*(\d+(?:\.\d+)*)(?:\s|[.:]|$)/);
  return match ? normalizeSectionNumber(match[1]) : undefined;
}

interface ResolvedCohortSection {
  readonly sectionNumber: string;
  readonly sourceLocator: string;
  readonly nodes: readonly RevisedPaperNode[];
}

function resolveCohortSectionNodes(nodes: readonly RevisedPaperNode[], cohort: CohortManifest['cohorts'][number]): readonly ResolvedCohortSection[] {
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
    const sourceLocator = cohort.sourceLocators.find((locator) => !/Reviewer's Guide/i.test(locator) && sectionNumbersFromLocator(locator).includes(sectionNumber)) ?? `Section ${sectionNumber}`;
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

function deriveCohortPortions(structure: { readonly content: string; readonly nodes: readonly RevisedPaperNode[] }, manifest: CohortManifest): readonly CohortPortion[] {
  const portions = manifest.cohorts.flatMap((cohort) => resolveCohortSectionNodes(structure.nodes, cohort).map((resolved) => {
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
      sectionLabel: resolved.nodes.length === 1 ? first.label : `Section ${resolved.sectionNumber} (${sectionNumberFromHeading(first.label)}-${sectionNumberFromHeading(last.label)})`,
      startByte: first.startByte,
      endByte: last.endByte,
      text,
    };
  }));
  if (portions.length === 0) throw new Error('Cohort manifest resolved no authenticated paper sections');
  return portions;
}

export default async function PublicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string }>;
  searchParams: Promise<{ mode?: string | string[]; lens?: string | string[]; q?: string | string[]; page?: string | string[] }>;
}) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION);
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(REVISED_PAPER_ROUTE);
  const { documentVersion } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();
  try {
    const query = await searchParams;
    const structure = loadRevisedPaperStructure();
    let cohortPortions: readonly CohortPortion[];
    try {
      const reviewerGuide = getReviewerGuideContract();
      await authenticateReviewerGuideAgainstPaper(reviewerGuide, structure.content);
      const cohortManifest = getCohortManifest();
      if (cohortManifest.releaseIdentity !== REVISED_PAPER_VERSION || structure.manifest.source.version !== REVISED_PAPER_VERSION || cohortManifest.cohorts.length !== 5) throw new Error('Cohort contract release mismatch');
      cohortPortions = deriveCohortPortions(structure, cohortManifest);
    } catch {
      notFound();
    }
    const model = createWorkspaceModel(structure, parseAtlasQuery(query), parseWorkspaceMode(query.mode ?? 'publication'));
    const { RevisedPaperWorkspace } = await import('@/components/matrix-options/paper/RevisedPaperWorkspace');
    return <RevisedPaperWorkspace model={model} cohortPortions={cohortPortions!} />;
  } catch (error) {
    if (error instanceof ReviewQueryError) notFound();
    throw error;
  }
}
