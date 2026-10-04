import type { JSX } from 'react';
import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_ROUTE } from '@/lib/matrix-options/revised-paper';
import { getPaperRelease } from '@/lib/matrix-options/paper/releases';
import type { PaperReleaseVersion } from '@/lib/matrix-options/paper/releases';
import { getReviewLineage, reviewLineageView } from '@/lib/matrix-options/paper/review-lineage';
import type { ReviewLineageView } from '@/lib/matrix-options/paper/review-lineage';
import { sectionRegion } from '@/lib/matrix-options/paper/contents-heading';
import type { PaperRegion } from '@/lib/matrix-options/paper/contents-heading';
import { APPENDIX_BOUNDARY_LABEL } from '@/lib/matrix-options/paper/outline-hierarchy';
import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { ReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { resolveReviewerGuide, REVIEWER_GUIDE_FAILURE_PREFIX } from '@/lib/matrix-options/paper/reviewer-guide-server';
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
  getPaperStableSectionIds,
  PaperDocument,
} from '@/components/matrix-options/paper/PaperDocument';
import type { PaperDocumentModel } from '@/components/matrix-options/paper/PaperDocument';
import { PrivateReleaseSessionGate } from '@/components/matrix-options/paper/PrivateReleaseSessionGate';
// The page consumes ONLY the manifest-map loader. It deliberately does not import
// the catalog/context/manifest primitives: catalog authentication and release
// binding belong to the server trust boundary, and importing them here would
// suggest the page performs validation it does not perform.
import { loadDownloadManifestMapState } from '@/lib/matrix-options/paper/download-manifest-server';
import { loadPaperStructureForPage } from '@/app/(dashboard)/matrix-options/paper/request-structure';

/** Non-sensitive reason codes logged before an expected fail-closed 404 (F-04). */
type PaperRouteFailureReason =
  | 'URL_CONTEXT_UNAVAILABLE'
  | 'GUIDE_AUTHENTICATION_FAILED'
  | 'COHORT_RELEASE_MISMATCH'
  | 'COHORT_PORTIONS_UNAVAILABLE'
  | 'REVIEW_LINEAGE_UNAVAILABLE'
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
/** The guide resolver reports every mismatch between a guide and its paper under its own prefix. */
const GUIDE_FAILURE_PREFIXES = [REVIEWER_GUIDE_FAILURE_PREFIX, ...CONTRACT_FAILURE_PREFIXES] as const;
const LINEAGE_FAILURE_PREFIXES = ['Invalid review lineage: ', ...CONTRACT_FAILURE_PREFIXES] as const;
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

/** What the workspace needs from a release's review contracts, proven against that release's text. */
interface AuthenticatedReview {
  /** The guide with its question text: stored text for a repository release, text derived from the release for a private one. */
  readonly guide: ReviewerGuideContract;
  readonly cohortPortions: readonly CohortPortion[];
}

// One authentication per structure object. A loaded structure is byte/SHA-verified
// and reused across requests (for the process by the repository loader, for as
// long as the verified bytes are kept by the private one), so the guide check and
// the cohort portion derivation are not repeated on every request (F-04).
// Failures are not cached.
const authenticatedReviewCache = new WeakMap<object, Promise<AuthenticatedReview>>();

function authenticatedReview(structure: RevisedPaperStructure, documentVersion: PaperReleaseVersion): Promise<AuthenticatedReview> {
  const cached = authenticatedReviewCache.get(structure);
  if (cached) return cached;
  const pending = (async () => {
    // The guide and cohorts are the requested release's own contracts, and the
    // guide is authenticated against that release's exact bytes. Its question
    // text is the result of that check: nothing reads guide text any other way.
    let guide: ReviewerGuideContract;
    try {
      guide = resolveReviewerGuide(structure);
    } catch (error) {
      if (isExpectedPaperFailure(error, GUIDE_FAILURE_PREFIXES)) throw new PaperRouteFailure('GUIDE_AUTHENTICATION_FAILED');
      throw error;
    }
    let cohortManifest: ReturnType<typeof getCohortManifest>;
    try {
      cohortManifest = getCohortManifest(documentVersion);
    } catch (error) {
      if (isExpectedPaperFailure(error, CONTRACT_FAILURE_PREFIXES)) throw new PaperRouteFailure('COHORT_RELEASE_MISMATCH');
      throw error;
    }
    if (cohortManifest.releaseIdentity !== documentVersion || structure.manifest.source.version !== documentVersion || cohortManifest.cohorts.length !== 5) {
      throw new PaperRouteFailure('COHORT_RELEASE_MISMATCH');
    }
    try {
      return { guide, cohortPortions: deriveCohortPortions(structure, cohortManifest) };
    } catch (error) {
      if (isExpectedPaperFailure(error, COHORT_PORTION_FAILURE_PREFIXES)) throw new PaperRouteFailure('COHORT_PORTIONS_UNAVAILABLE');
      throw error;
    }
  })();
  authenticatedReviewCache.set(structure, pending);
  pending.catch(() => authenticatedReviewCache.delete(structure));
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
  const { documentVersion: requestedVersion } = await params;
  // Only a bound release is served. The default stays the default: this route
  // never substitutes one release for another, it serves the one the URL names.
  const release = getPaperRelease(requestedVersion);
  if (!release) notFound();
  const documentVersion = release.documentVersion;
  const query = (await searchParams) ?? {};
  // A private-storage release is read with this request's own session, and only for
  // a signed-in, non-anonymous reader (request-structure.ts): anyone else gets
  // notFound(), and a release that cannot be read right now reaches error.tsx.
  const { structure, supabase, servedTo } = await loadPaperStructureForPage(documentVersion);
  let context: PaperUrlContext;
  try {
    context = buildPaperUrlContext(structure, documentVersion);
  } catch (error) {
    if (isExpectedPaperFailure(error, CONTRACT_FAILURE_PREFIXES)) failClosed('URL_CONTEXT_UNAVAILABLE');
    throw error;
  }
  const { state, canonical } = parsePaperUrlState(query, context);
  // Aliases, missing mode, unknown or repeated values: 307 to the canonical URL.
  if (!canonical) redirect(paperWorkspaceHref(documentVersion, state));

  let guide: ReviewerGuideContract;
  let cohortPortions: readonly CohortPortion[];
  try {
    ({ guide, cohortPortions } = await authenticatedReview(structure, documentVersion));
  } catch (error) {
    if (error instanceof PaperRouteFailure) failClosed(error.reason);
    throw error;
  }

  const assignment = getProductionAssignment();
  const workspaceKey = `${state.mode}:${state.cohort ?? ''}:${state.q ?? ''}`;
  // Each release has its own review manifest: responses are read and written
  // under the exact release on screen.
  const reviewManifestSha256 = getReviewManifest(documentVersion).sha256;
  // A successor release shows the reader's answers to the predecessor as
  // read-only reference for questions whose text is identical. The predecessor's
  // rows are read under ITS manifest and are never copied or re-keyed.
  let reviewLineage: ReviewLineageView | undefined;
  try {
    const lineage = getReviewLineage(documentVersion);
    if (lineage) reviewLineage = reviewLineageView(lineage, getReviewManifest(lineage.predecessorVersion).sha256);
  } catch (error) {
    if (isExpectedPaperFailure(error, LINEAGE_FAILURE_PREFIXES)) failClosed('REVIEW_LINEAGE_UNAVAILABLE');
    throw error;
  }
  // The reader's place is carried across drafts by stable section id.
  const stableSectionIds = getPaperStableSectionIds(structure);

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
  // Print packages exist for the default release only (the download catalog is
  // bound to its review manifest). Another release has none provisioned, so
  // neither the session nor the boundary is consulted for it and the panel shows
  // its pending state. An anonymous session gets no manifests.
  let downloadState: Awaited<ReturnType<typeof loadDownloadManifestMapState>> | null = null;
  if (release.activation === 'DEFAULT') {
    const { data: { user } } = await supabase.auth.getUser();
    const isAnonymous = user?.is_anonymous ?? true;
    if (!isAnonymous) downloadState = await loadDownloadManifestMapState(documentVersion, reviewManifestSha256);
  }
  const downloadManifests = downloadState?.status === 'ready' ? downloadState.manifests : null;
  const workspaceModule = await import('@/components/matrix-options/paper/RevisedPaperWorkspace');
  const { RevisedPaperWorkspace } = workspaceModule;
  // Everything a private-storage release renders (the workspace, with its guide and its first
  // section) goes inside the client session gate, bound to the reader this load was authorized
  // for: a page the browser kept is shown again only while the browser still holds THAT
  // reader's session (PrivateReleaseSessionGate.tsx). A missing id is passed as it is and the
  // gate shows nothing. A repository release is returned as it is: no gate, no id.
  const gated = (workspace: JSX.Element): JSX.Element => (release.delivery === 'private-storage' ? <PrivateReleaseSessionGate servedTo={servedTo ?? ''}>{workspace}</PrivateReleaseSessionGate> : workspace);
  if (state.mode === 'my-review') {
    return gated(<RevisedPaperWorkspace key={workspaceKey} documentVersion={documentVersion} guide={guide} reviewManifestSha256={reviewManifestSha256} urlState={state} assignment={assignment} cohortPortions={cohortPortions} downloadManifests={downloadManifests} reviewLineage={reviewLineage} stableSectionIds={stableSectionIds} />);
  }

  // S1 incremental section window: only the initial (or deep-linked) depth-1
  // section is server-rendered. Every other section ships as an ordered
  // placeholder descriptor (label and size only, no markdown and no byte
  // offsets) and is fetched from the guarded per-section route on demand.
  let documentModel: PaperDocumentModel;
  let sectionWindow: PaperSectionWindowData;
  let initialRegion: PaperRegion = 'main';
  try {
    const fullModel = getPaperDocumentModel(structure);
    const { chunks, groups } = getPaperSectionWindowModel(structure);
    const identity = paperSectionIdentity(structure, documentVersion);
    const initialIndex = (state.section === null ? null : owningSectionIndex(groups, state.section)) ?? 0;
    const initialGroup = groups[initialIndex];
    initialRegion = sectionRegion(groups.map((group) => group.label), initialIndex, APPENDIX_BOUNDARY_LABEL);
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
  return gated(
    <RevisedPaperWorkspace key={workspaceKey} documentVersion={documentVersion} guide={guide} reviewManifestSha256={reviewManifestSha256} urlState={state} assignment={assignment} outline={getPaperNavOutline(structure)} sectionWindow={sectionWindow} downloadManifests={downloadManifests} reviewLineage={reviewLineage} stableSectionIds={stableSectionIds}>
      <PaperDocument model={documentModel} layout="chunks" region={initialRegion} />
    </RevisedPaperWorkspace>,
  );
}
