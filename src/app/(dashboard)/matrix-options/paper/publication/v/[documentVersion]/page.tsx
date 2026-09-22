import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_ROUTE, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { authenticateReviewerGuideAgainstPaper, getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { getProductionAssignment } from '@/lib/matrix-options/revised-paper-review';
import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { deriveCohortPortions } from '@/lib/matrix-options/paper/cohort-portions';
import type { CohortPortion } from '@/lib/matrix-options/paper/cohort-portions';
import { paperWorkspaceHref, parsePaperUrlState } from '@/lib/matrix-options/paper/url-state';
import type { PaperSearchParams, PaperUrlContext } from '@/lib/matrix-options/paper/url-state';
import {
  getPaperSectionWindowModel,
  owningSectionIndex,
  PAPER_SECTION_WINDOW_FAILURE_PREFIX,
  paperSectionIdentity,
  summarizePaperSections,
} from '@/lib/matrix-options/paper/section-window';
import type { PaperSectionWindowData } from '@/components/matrix-options/paper/PaperSectionWindow';
import {
  buildPaperUrlContext,
  getPaperDocumentModel,
  getPaperNavOutline,
  PaperDocument,
} from '@/components/matrix-options/paper/PaperDocument';
import type { PaperDocumentModel } from '@/components/matrix-options/paper/PaperDocument';
// The page consumes ONLY the manifest-map loader. It deliberately does not import
// the catalog/context/manifest primitives: catalog authentication and release
// binding belong to the server trust boundary, and importing them here would
// suggest the page performs validation it does not perform.
import { loadDownloadManifestMapState } from '@/lib/matrix-options/paper/download-manifest-server';

/** Non-sensitive reason codes logged before an expected fail-closed 404 (F-04). */
type PaperRouteFailureReason =
  | 'URL_CONTEXT_UNAVAILABLE'
  | 'GUIDE_AUTHENTICATION_FAILED'
  | 'COHORT_RELEASE_MISMATCH'
  | 'COHORT_PORTIONS_UNAVAILABLE'
  | 'PAPER_DOCUMENT_UNAVAILABLE';

class PaperRouteFailure extends Error {
  readonly reason: PaperRouteFailureReason;

  constructor(reason: PaperRouteFailureReason) {
    super(reason);
    this.name = 'PaperRouteFailure';
    this.reason = reason;
  }
}

function failClosed(reason: PaperRouteFailureReason): never {
  console.error(`[matrix-options-paper] publication route unavailable: ${reason}`);
  notFound();
}

/*
 * M1-05: only the known contract and validation failures become a reason-coded
 * 404. Each prefix is the message of a plain `Error` thrown by a validator or
 * derivation this route calls. Any other error (a TypeError, RangeError, other
 * Error subclass, or an unrecognised message) is a programming or environment
 * defect and is rethrown so it surfaces instead of hiding behind a 404.
 */
const CONTRACT_FAILURE_PREFIXES = ['Invalid reviewer guide contract: ', 'Invalid cohort contract: '] as const;
const COHORT_PORTION_FAILURE_PREFIXES = [
  'Expected exactly one authenticated appendix boundary',
  'Cohort has no paper section locators: ',
  'Ambiguous canonical paper heading for ',
  'Authenticated paper section is empty: ',
  'Cohort manifest resolved no authenticated paper sections',
] as const;
const DOCUMENT_FAILURE_PREFIXES = [
  'Paper full-document model unavailable: ',
  PAPER_SECTION_WINDOW_FAILURE_PREFIX,
  'Compiler node missing canonical placement',
  'Compiler question missing canonical placement',
  'Compiler object missing canonical placement',
] as const;

function isExpectedPaperFailure(error: unknown, prefixes: readonly string[]): boolean {
  return error instanceof Error
    && Object.getPrototypeOf(error) === Error.prototype
    && prefixes.some((prefix) => error.message.startsWith(prefix));
}

// One authentication per cached structure object: loadRevisedPaperStructure
// returns a process-cached, byte/SHA-verified structure, so the guide hash and
// the cohort portion derivation are not repeated on every request (F-04).
// Failures are not cached.
const authenticatedPortionsCache = new WeakMap<object, Promise<readonly CohortPortion[]>>();

function authenticatedCohortPortions(structure: RevisedPaperStructure): Promise<readonly CohortPortion[]> {
  const cached = authenticatedPortionsCache.get(structure);
  if (cached) return cached;
  const pending = (async () => {
    try {
      await authenticateReviewerGuideAgainstPaper(getReviewerGuideContract(), structure.content);
    } catch (error) {
      if (isExpectedPaperFailure(error, CONTRACT_FAILURE_PREFIXES)) throw new PaperRouteFailure('GUIDE_AUTHENTICATION_FAILED');
      throw error;
    }
    let cohortManifest: ReturnType<typeof getCohortManifest>;
    try {
      cohortManifest = getCohortManifest();
    } catch (error) {
      if (isExpectedPaperFailure(error, CONTRACT_FAILURE_PREFIXES)) throw new PaperRouteFailure('COHORT_RELEASE_MISMATCH');
      throw error;
    }
    if (cohortManifest.releaseIdentity !== REVISED_PAPER_VERSION || structure.manifest.source.version !== REVISED_PAPER_VERSION || cohortManifest.cohorts.length !== 5) {
      throw new PaperRouteFailure('COHORT_RELEASE_MISMATCH');
    }
    try {
      return deriveCohortPortions(structure, cohortManifest);
    } catch (error) {
      if (isExpectedPaperFailure(error, COHORT_PORTION_FAILURE_PREFIXES)) throw new PaperRouteFailure('COHORT_PORTIONS_UNAVAILABLE');
      throw error;
    }
  })();
  authenticatedPortionsCache.set(structure, pending);
  pending.catch(() => authenticatedPortionsCache.delete(structure));
  return pending;
}

export const dynamic = 'force-dynamic';

export default async function PublicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string }>;
  searchParams?: Promise<PaperSearchParams>;
}) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION);
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(REVISED_PAPER_ROUTE);
  const { documentVersion } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();
  const query = (await searchParams) ?? {};
  const structure = loadRevisedPaperStructure();

  let context: PaperUrlContext;
  try {
    context = buildPaperUrlContext(structure);
  } catch (error) {
    if (isExpectedPaperFailure(error, CONTRACT_FAILURE_PREFIXES)) failClosed('URL_CONTEXT_UNAVAILABLE');
    throw error;
  }
  const { state, canonical } = parsePaperUrlState(query, context);
  // Aliases, missing mode, unknown or repeated values: 307 to the canonical URL.
  if (!canonical) redirect(paperWorkspaceHref(documentVersion, state));

  let cohortPortions: readonly CohortPortion[];
  try {
    cohortPortions = await authenticatedCohortPortions(structure);
  } catch (error) {
    if (error instanceof PaperRouteFailure) failClosed(error.reason);
    throw error;
  }

  const assignment = getProductionAssignment();
  const workspaceKey = `${state.mode}:${state.cohort ?? ''}:${state.q ?? ''}`;
  const reviewManifestSha256 = getReviewManifest().sha256;

  const { createClientForPagePath } = await import('@/lib/supabase-auth');
  const { supabase } = await createClientForPagePath('/matrix-options/paper/publication');
  const { data: { user } } = await supabase.auth.getUser();
  const isAnonymous = user?.is_anonymous ?? true;

  // DELIBERATE, TESTED BEHAVIOUR: a download-boundary failure propagates and
  // fails the page, rather than degrading the download panel to pending. See
  // the regression test "passes pending through the full publication page and
  // rethrows boundary failures" - `pending` and `failed` are distinguished on
  // purpose so a genuine transport/authentication failure cannot be silently
  // rendered as "not yet provisioned".
  // A reviewer argued this should degrade instead, so that catalog
  // authentication failing cannot take the whole publication workspace down.
  // That is a real trade-off, but reversing it would mean rewriting the
  // regression test that encodes the current intent, so it is an OWNER decision
  // and is recorded in the handoff rather than changed here.
  const downloadState = isAnonymous ? null : await loadDownloadManifestMapState(documentVersion, reviewManifestSha256);
  const downloadManifests = downloadState?.status === 'ready' ? downloadState.manifests : null;

  const { RevisedPaperWorkspace } = await import('@/components/matrix-options/paper/RevisedPaperWorkspace');
  if (state.mode === 'my-review') {
    return <RevisedPaperWorkspace key={workspaceKey} documentVersion={documentVersion} reviewManifestSha256={reviewManifestSha256} urlState={state} assignment={assignment} cohortPortions={cohortPortions} downloadManifests={downloadManifests} />;
  }

  // S1 incremental section window: only the initial (or deep-linked) depth-1
  // section is server-rendered. Every other section ships as an ordered
  // placeholder descriptor (label and size only, no markdown and no byte
  // offsets) and is fetched from the guarded per-section route on demand.
  let documentModel: PaperDocumentModel;
  let sectionWindow: PaperSectionWindowData;
  try {
    const fullModel = getPaperDocumentModel(structure);
    const { chunks, groups } = getPaperSectionWindowModel(structure);
    const identity = paperSectionIdentity(structure, documentVersion);
    const initialIndex = (state.section === null ? null : owningSectionIndex(groups, state.section)) ?? 0;
    const initialGroup = groups[initialIndex];
    documentModel = { chunks: chunks.slice(initialGroup.chunkStart, initialGroup.chunkEnd), linkMap: fullModel.linkMap };
    sectionWindow = {
      paperSha256: identity.paperSha256,
      initialIndex,
      sections: summarizePaperSections(groups),
      linkMap: fullModel.linkMap,
    };
  } catch (error) {
    if (isExpectedPaperFailure(error, DOCUMENT_FAILURE_PREFIXES)) failClosed('PAPER_DOCUMENT_UNAVAILABLE');
    throw error;
  }
  return (
    <RevisedPaperWorkspace key={workspaceKey} documentVersion={documentVersion} reviewManifestSha256={reviewManifestSha256} urlState={state} assignment={assignment} outline={getPaperNavOutline(structure)} sectionWindow={sectionWindow} downloadManifests={downloadManifests}>
      <PaperDocument model={documentModel} layout="chunks" />
    </RevisedPaperWorkspace>
  );
}
