import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// INERT DATA, not an executable module. The private print-package catalog is a
// plain JSON contract, imported through the bundler exactly like the sibling
// cohort and reviewer-guide contracts. This is structural, not stylistic: while
// the catalog was a .ts module it was imported BEFORE its authenticator and its
// top-level code could rewrite the realm intrinsics the authenticator is built
// from, so no authenticator written in that realm could be proven correct. JSON
// cannot carry getters, Proxies, overridden methods or prototype changes, so an
// edit to this data can only change VALUES - which is precisely what the pinned
// payload digest detects.
import printPackagesCatalog from './contracts/print-packages-v1.json';
import {
  authenticatePrintPackageCatalogPayload,
  EXPECTED_CATALOG_PROVENANCE_LABEL,
} from './print-packages-catalog-authentication';
import type { PrivateCatalogDocument } from './print-packages-catalog-contract';


import {
  DOWNLOAD_MANIFEST_SCHEMA,
  DOWNLOAD_MANIFEST_STATUS,
  DOWNLOAD_VALIDATION_STATE,
  type DownloadManifestPackage,
  type DownloadPackageKind,
  type ServerDownloadManifest,
  type VerifiedDownloadManifest,
  validateDownloadManifest,
} from '@/lib/matrix-options/paper/download-manifest';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import {
  authenticateReviewerGuideAgainstPaper,
  getReviewerGuideContract,
  REVIEW_GUIDE_RELEASE_IDENTITY,
} from '@/lib/matrix-options/reviewer-guide';
import { getReviewManifest, type ReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { loadRevisedPaper, REVISED_PAPER_RELEASE_IDENTITY, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';

export const DOWNLOAD_API_PREFIX = '/api/matrix-options/paper/downloads';
export const PRINT_PACKAGE_ARTIFACTS_STATE = 'UNAVAILABLE_MISSING_AUTHENTICATED_ARTIFACTS' as const;
export const PRINT_PACKAGE_ARTIFACT_DEPENDENCY = 'authenticated-pdf-docx-bytes-and-private-catalog-locator' as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const STABLE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const DOCUMENT_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(pdf|docx)$/;
const QUESTION_ID_PREFIX = `rpq:${REVIEW_GUIDE_RELEASE_IDENTITY}:q`;
const PRIVATE_LOCATOR_PATTERN = /^private-print-package:[a-z0-9][a-z0-9._:-]*$/;
const CATALOG_PATH_PREFIX = 'private-packages/';
export const PRIVATE_PACKAGE_BUCKET = 'matrix-twg-packages' as const;
const MAX_PRIVATE_PACKAGE_BYTES = 5 * 1024 * 1024;
/** Bucket-relative storage path: one cohort segment, then one file segment. */
const STORAGE_PATH_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*\.(pdf|docx)$/;

export type { PrivateCatalogEntry, PrivateCatalogDocument } from './print-packages-catalog-contract';

export interface TrustedDownloadContext {
  readonly documentVersion: string;
  readonly manifestSha256: string;
  readonly paperSha256: string;
  readonly releaseIdentity: string;
  readonly paperReleaseIdentity: string;
  readonly cohortQuestionIds: Readonly<Record<string, readonly string[]>>;
  readonly reviewManifest: ReviewManifest;
}

export interface PrintPackageArtifact {
  readonly packageId: string;
  readonly kind: DownloadPackageKind;
  readonly label: string;
  readonly fileName: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly order: number;
  readonly cohortId: string;
  readonly documentVersion: string;
  readonly manifestSha256: string;
  /** Catalog-owned opaque locator. It is never joined with user input. */
  readonly serverAssetLocator: string;
  /**
   * Storage object path taken from the AUTHENTICATED catalog payload, relative
   * to the `matrix-twg-packages` bucket root. It is carried on the artifact so
   * that the streaming boundary never has to re-read the imported catalog data
   * after authentication. It is server-internal and is never projected into the
   * public download manifest.
   */
  readonly storagePath: string;
}

export interface DownloadRequestBinding {
  readonly documentVersion: string;
  readonly manifestSha256: string;
  readonly cohortId: string;
  readonly questionId?: string;
}

export class DownloadBoundaryError extends Error {
  readonly status: 400 | 404 | 409 | 503;
  readonly code: string;

  constructor(code: string, message: string, status: 400 | 404 | 409 | 503) {
    super(message);
    this.name = 'DownloadBoundaryError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Server-side log for download-boundary events.
 *
 * The boundary previously logged NOTHING, so the two events this whole change
 * exists to detect - a catalog payload that fails authentication, and served
 * bytes that fail their integrity check - were reported only to the end user's
 * browser, and every storage failure (bucket missing, object missing, RLS
 * denied, expired token, network) collapsed into one undiagnosable 503.
 *
 * Non-sensitive by construction: a code, a package id and a bucket-relative
 * path. No credential, no signed URL, no user identifier, no file content.
 */
function logBoundaryEvent(code: string, detail: Record<string, string | number | undefined>): void {
  const fields = Object.entries(detail)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  console.error(`[matrix-options-paper][download-boundary] ${code}${fields ? ` ${fields}` : ''}`);
}

function boundaryFailure(code: string, message: string, status: 400 | 404 | 409 | 503): never {
  throw new DownloadBoundaryError(code, message, status);
}

function isSha256(value: string): boolean {
  return SHA256_PATTERN.test(value);
}

function isStableId(value: string): boolean {
  return STABLE_ID_PATTERN.test(value);
}

function isAuthenticatedQuestionId(value: string): boolean {
  return value.startsWith(QUESTION_ID_PREFIX) && /^\d{2}$/.test(value.slice(QUESTION_ID_PREFIX.length));
}

function rawQueryValues(url: URL, key: string): readonly string[] {
  const rawSearch = url.search.startsWith('?') ? url.search.slice(1) : '';
  return rawSearch
    .split('&')
    .filter((part) => part.split('=', 1)[0] === key)
    .map((part) => part.slice(key.length + 1));
}

function queryValue(url: URL, key: string, required: boolean): string | undefined {
  const values = url.searchParams.getAll(key);
  const rawValues = rawQueryValues(url, key);
  if (values.length !== rawValues.length) boundaryFailure('UNSAFE_QUERY_ENCODING', `Encoded ${key} is not accepted.`, 400);
  if (values.length > 1) boundaryFailure('REPEATED_QUERY_PARAMETER', `Repeated ${key} is not accepted.`, 400);
  if (values.length === 0 || values[0] === undefined || values[0] === '') {
    if (required) boundaryFailure('MISSING_QUERY_PARAMETER', `Missing ${key}.`, 400);
    return undefined;
  }
  const rawValue = rawValues[0];
  if (rawValue === undefined || rawValue.includes('%') || rawValue.includes('/') || rawValue.includes('\\') || rawValue.includes('..')) {
    boundaryFailure('UNSAFE_QUERY_ENCODING', `Encoded or traversal-shaped ${key} is not accepted.`, 400);
  }
  return values[0];
}

export function validateOpaquePackageId(packageId: string): string {
  if (!packageId || packageId.includes('%') || packageId.includes('/') || packageId.includes('\\') || packageId.includes('..') || !isStableId(packageId)) {
    boundaryFailure('UNSAFE_PACKAGE_ID', 'Opaque package ID is invalid.', 400);
  }
  return packageId;
}

export function parseDownloadRequestBinding(url: URL): DownloadRequestBinding {
  const documentVersion = queryValue(url, 'documentVersion', true);
  const manifestSha256 = queryValue(url, 'manifestSha256', true);
  const cohortId = queryValue(url, 'cohortId', true);
  const questionId = queryValue(url, 'questionId', false);
  if (!documentVersion || !manifestSha256 || !cohortId) boundaryFailure('MISSING_QUERY_PARAMETER', 'Release and cohort binding is required.', 400);
  if (!DOCUMENT_VERSION_PATTERN.test(documentVersion)) boundaryFailure('UNSAFE_DOCUMENT_VERSION', 'Document version is not a safe release segment.', 400);
  if (!isSha256(manifestSha256)) boundaryFailure('UNSAFE_MANIFEST_HASH', 'Manifest hash is not a lowercase SHA-256.', 400);
  if (!isStableId(cohortId)) boundaryFailure('UNSAFE_COHORT', 'Cohort is not a safe release segment.', 400);
  if (questionId !== undefined && !isAuthenticatedQuestionId(questionId)) boundaryFailure('UNSAFE_QUESTION', 'Question is not a trusted release question ID.', 400);
  return { documentVersion, manifestSha256, cohortId, ...(questionId ? { questionId } : {}) };
}

export function validateTrustedCohortQuestion(
  binding: Pick<DownloadRequestBinding, 'cohortId' | 'questionId'>,
  context: Pick<TrustedDownloadContext, 'cohortQuestionIds'>,
): void {
  // hasOwnProperty, not a bare lookup: `cohortId` is caller-supplied and matches
  // STABLE_ID_PATTERN for inherited Object.prototype keys such as `constructor`,
  // which would otherwise skip this 409 and reach a TypeError further down.
  // Matches the sibling checks in validateCatalogArtifact/validateCompleteCatalog.
  const questionIds = Object.prototype.hasOwnProperty.call(context.cohortQuestionIds, binding.cohortId)
    ? context.cohortQuestionIds[binding.cohortId]
    : undefined;
  if (!Array.isArray(questionIds)) boundaryFailure('UNKNOWN_COHORT', 'Cohort is not in the trusted release.', 409);
  if (binding.questionId !== undefined && !questionIds.includes(binding.questionId)) boundaryFailure('COHORT_QUESTION_MISMATCH', 'Question is not a member of the cohort.', 409);
}

function releaseContextFrom(
  paper: ReturnType<typeof loadRevisedPaper>,
  reviewManifest: ReviewManifest,
): TrustedDownloadContext {
  if (
    paper.releaseIdentity !== REVISED_PAPER_RELEASE_IDENTITY ||
    paper.documentVersion !== reviewManifest.documentVersion ||
    paper.sha256 !== reviewManifest.paperSha256
  ) {
    boundaryFailure('RELEASE_IDENTITY_MISMATCH', 'Request is not bound to the trusted paper release.', 409);
  }
  return {
    documentVersion: reviewManifest.documentVersion,
    manifestSha256: reviewManifest.sha256,
    paperSha256: paper.sha256,
    releaseIdentity: `matrix-options-paper-${reviewManifest.documentVersion}-${paper.sha256}`,
    paperReleaseIdentity: paper.releaseIdentity,
    cohortQuestionIds: reviewManifest.cohortQuestionIds,
    reviewManifest,
  };
}

export async function loadTrustedDownloadReleaseContext(): Promise<TrustedDownloadContext> {
  try {
    const paper = loadRevisedPaper(REVISED_PAPER_VERSION);
    await authenticateReviewerGuideAgainstPaper(getReviewerGuideContract(), paper.content);
    const cohorts = getCohortManifest();
    const reviewManifest = getReviewManifest();
    const context = releaseContextFrom(paper, reviewManifest);
    for (const cohort of cohorts.cohorts) {
      if (!Array.isArray(context.cohortQuestionIds[cohort.id])) boundaryFailure('COHORT_MANIFEST_MISMATCH', 'Trusted cohort membership is incomplete.', 503);
    }
    return context;
  } catch (error) {
    if (error instanceof DownloadBoundaryError) throw error;
    boundaryFailure('TRUSTED_RELEASE_UNAVAILABLE', 'The authenticated paper, guide, cohort, or review manifest is unavailable.', 503);
  }
}

export async function loadTrustedDownloadContext(binding: DownloadRequestBinding): Promise<TrustedDownloadContext> {
  const context = await loadTrustedDownloadReleaseContext();
  if (context.documentVersion !== binding.documentVersion || context.manifestSha256 !== binding.manifestSha256) {
    boundaryFailure('RELEASE_IDENTITY_MISMATCH', 'Request is not bound to the trusted paper release.', 409);
  }
  validateTrustedCohortQuestion(binding, context);
  return context;
}

function validateCatalogArtifact(artifact: PrintPackageArtifact, context: TrustedDownloadContext, cohortId?: string): void {
  // `isStableId`, not `validateOpaquePackageId`: this is a CATALOG-side defect,
  // so it must fail as a 503 like every sibling branch here. The old call could
  // only ever return truthy or throw its own 400, mislabelling a bad catalog as
  // a bad client request.
  if (
    !isStableId(artifact.packageId) ||
    artifact.packageId.includes('..') ||
    !['PDF', 'DOCX'].includes(artifact.kind) ||
    typeof artifact.label !== 'string' ||
    !artifact.label.trim() ||
    /[\r\n\u0000-\u001f\u007f]/.test(artifact.label) ||
    !FILE_NAME_PATTERN.test(artifact.fileName) ||
    !isSha256(artifact.sha256) ||
    !Number.isSafeInteger(artifact.byteLength) ||
    artifact.byteLength <= 0 ||
    !Number.isSafeInteger(artifact.order) ||
    artifact.order < 0 ||
    !isStableId(artifact.cohortId) ||
    !isSha256(artifact.manifestSha256) ||
    !PRIVATE_LOCATOR_PATTERN.test(artifact.serverAssetLocator) ||
    !STORAGE_PATH_PATTERN.test(artifact.storagePath) ||
    artifact.storagePath.includes('..') ||
    !artifact.storagePath.startsWith(`${artifact.cohortId}/`) ||
    !artifact.storagePath.endsWith(`/${artifact.fileName}`) ||
    // Bind the filename extension to the declared kind. The manifest path gets
    // this from validateDownloadManifest, but the STREAMING path never calls
    // that, and it is the streaming path that chooses the Content-Type. Without
    // this, a catalog declaring kind PDF with a .docx filename would be served
    // as application/pdf.
    !artifact.fileName.toLowerCase().endsWith(artifact.kind === 'PDF' ? '.pdf' : '.docx')
  ) {
    boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog entry is invalid.', 503);
  }
  if (artifact.documentVersion !== context.documentVersion || artifact.manifestSha256 !== context.manifestSha256 || (cohortId !== undefined && artifact.cohortId !== cohortId)) {
    boundaryFailure('CATALOG_RELEASE_MISMATCH', 'Print package catalog entry is not bound to the trusted release.', 409);
  }
  if (!Object.prototype.hasOwnProperty.call(context.cohortQuestionIds, artifact.cohortId)) boundaryFailure('CATALOG_COHORT_MISMATCH', 'Print package catalog cohort is not trusted.', 409);
}

function validateCompleteCatalog(artifacts: readonly PrintPackageArtifact[], context: TrustedDownloadContext, cohortId?: string): readonly PrintPackageArtifact[] {
  const byCohort = new Map<string, PrintPackageArtifact[]>();
  for (const artifact of artifacts) {
    let group = byCohort.get(artifact.cohortId);
    if (!group) {
      group = [];
      byCohort.set(artifact.cohortId, group);
    }
    group.push(artifact);
  }

  if (cohortId !== undefined && !byCohort.has(cohortId)) {
    boundaryFailure('PRINT_PACKAGE_ARTIFACTS_INCOMPLETE', 'Exactly one authenticated PDF and one DOCX artifact are required.', 503);
  }

  const trustedCohorts = Object.keys(context.cohortQuestionIds);
  if (cohortId === undefined && byCohort.size !== trustedCohorts.length) {
    boundaryFailure('PRINT_PACKAGE_ARTIFACTS_INCOMPLETE', 'Catalog must contain packages for all trusted cohorts.', 503);
  }

  const ids = new Set<string>();
  for (const [groupCohortId, group] of byCohort) {
    if (!Object.prototype.hasOwnProperty.call(context.cohortQuestionIds, groupCohortId)) boundaryFailure('CATALOG_COHORT_MISMATCH', 'Print package catalog cohort is not trusted.', 409);
    const kinds = new Set<DownloadPackageKind>();
    const orders = new Set<number>();
    for (const artifact of group) {
      validateCatalogArtifact(artifact, context, cohortId);
      if (ids.has(artifact.packageId)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog contains duplicate package IDs.', 503);
      if (kinds.has(artifact.kind)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog contains duplicate package kinds.', 503);
      if (orders.has(artifact.order)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog contains duplicate package orders.', 503);
      ids.add(artifact.packageId);
      kinds.add(artifact.kind);
      orders.add(artifact.order);
    }
    if (!kinds.has('PDF') || !kinds.has('DOCX')) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog must contain PDF and DOCX.', 503);
  }
  return artifacts;
}

export async function loadAuthenticatedPrintPackageCatalog(
  context: TrustedDownloadContext,
  cohortId?: string,
): Promise<readonly PrintPackageArtifact[] | null> {
  try {
    // Read the imported binding HERE, once per call, rather than aliasing it to a
    // module-level const. The alias would freeze whatever the binding resolved to at
    // import time, which also made the value unobservable to test substitution.
    const catalog = printPackagesCatalog as PrivateCatalogDocument;

    // STEP 1 - CONTENT AUTHENTICATION, before anything reads the artifact list.
    // Hashes the actual imported catalog payload (provenance identity plus every
    // artifact security field, with the self-declared digest excluded) and
    // compares it to a digest pinned independently in trusted server code. This
    // is what makes a substituted path, hash, byte length, cohort identity or
    // package identity fail closed. It runs before the metadata comparison below
    // because that comparison cannot authenticate content.
    // Translated into a DownloadBoundaryError with its own code so the outer
    // catch cannot flatten it into the generic "artifacts unavailable" 503 and
    // hide the reason the catalog was rejected.
    //
    // READ-ONCE DISCIPLINE (defence in depth): authentication returns the frozen
    // SNAPSHOT of the values it hashed, and everything below consumes ONLY that
    // snapshot; the raw `catalog` object is never read again. The PRIMARY control
    // is that the catalog is inert JSON and cannot define a getter or Proxy at
    // all (see the import comment at the top of this file). This discipline is
    // retained because it costs nothing and would still hold if the data source
    // ever regained the ability to execute.
    let authenticated;
    try {
      authenticated = authenticatePrintPackageCatalogPayload(catalog);
    } catch (authenticationError) {
      logBoundaryEvent('PRIVATE_CATALOG_PAYLOAD_AUTHENTICATION_FAILED', {
        reason: authenticationError instanceof Error ? authenticationError.message : 'unknown',
      });
      boundaryFailure(
        'PRIVATE_CATALOG_PAYLOAD_AUTHENTICATION_FAILED',
        'Private package catalog payload does not match the pinned release digest.',
        503,
      );
    }

    // STEP 2 - RELEASE BINDING. Ties the (now authenticated) catalog to the
    // trusted paper/review release for THIS request. `sourceCatalogSha256` is
    // still checked here, but only as a provenance label: it is self-declared by
    // the catalog, so on its own it authenticates nothing. Step 1 is what
    // authenticates the content.
    if (
      authenticated.schema !== 'matrix-twg-private-preview-package-catalog-v1' ||
      authenticated.status !== 'NON_CANONICAL_PREVIEW' ||
      authenticated.sourceRelease !== context.documentVersion ||
      authenticated.sourcePaperSha256 !== context.paperSha256 ||
      authenticated.sourceCatalogSha256 !== EXPECTED_CATALOG_PROVENANCE_LABEL ||
      authenticated.sourceReviewManifestSha256 !== context.manifestSha256
    ) {
      boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package catalog metadata does not match trusted context.', 503);
    }
    // CURRENTLY UNREACHABLE BY DESIGN, and retained deliberately.
    // The pinned payload digest covers a catalog of ten artifacts, so an empty
    // artifact list now fails content authentication in STEP 1 above and never
    // reaches this line. The `null` -> "pending" contract is kept because it is
    // the honest representation of a legitimately empty, re-pinned catalog, and
    // because the page and panel still consume that contract. Do NOT treat
    // reaching this branch as a normal "not yet provisioned" state: with the
    // current pin it would mean authentication was bypassed.
    if (authenticated.artifacts.length === 0) return null;
    const allArtifacts: PrintPackageArtifact[] = [];
    for (const entry of authenticated.artifacts) {
      if (!isStableId(entry.packageId) || !isStableId(entry.cohortId)) {
        boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package catalog entry is invalid.', 503);
      }
      if (!entry.path.startsWith(CATALOG_PATH_PREFIX) || entry.path.includes('..') || entry.path.includes('\\')) {
        boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package catalog path is invalid.', 503);
      }
      const artifact: PrintPackageArtifact = {
        storagePath: entry.path.slice(CATALOG_PATH_PREFIX.length),
        packageId: entry.packageId,
        kind: entry.kind,
        label: entry.label,
        fileName: entry.fileName,
        sha256: entry.sha256.toLowerCase(),
        byteLength: entry.byteLength,
        order: entry.order,
        cohortId: entry.cohortId,
        documentVersion: context.documentVersion,
        manifestSha256: context.manifestSha256,
        serverAssetLocator: `private-print-package:${entry.packageId}`,
      };
      validateCatalogArtifact(artifact, context, undefined);
      allArtifacts.push(artifact);
    }
    const validatedCompleteCatalog = validateCompleteCatalog(allArtifacts, context, undefined);

    if (cohortId === undefined) return validatedCompleteCatalog;
    const entries = validatedCompleteCatalog.filter((entry) => entry.cohortId === cohortId);
    if (entries.length === 0) boundaryFailure('PRINT_PACKAGE_ARTIFACTS_INCOMPLETE', 'Exactly one authenticated PDF and one DOCX artifact are required.', 503);
    return entries;
  } catch (error) {
    if (error instanceof DownloadBoundaryError) throw error;
    boundaryFailure('PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE', 'Authenticated print-package artifacts are unavailable.', 503);
  }
}

export function buildValidatedDownloadManifest(
  artifacts: readonly PrintPackageArtifact[],
  context: TrustedDownloadContext,
  cohortId: string,
): ServerDownloadManifest {
  const completeCatalog = validateCompleteCatalog(artifacts, context, cohortId);
  const packages: readonly DownloadManifestPackage[] = completeCatalog.map((artifact) => {
    return {
      packageId: artifact.packageId,
      kind: artifact.kind,
      label: artifact.label.trim(),
      fileName: artifact.fileName,
      path: `opaque/${artifact.packageId}`,
      href: `${DOWNLOAD_API_PREFIX}/${artifact.packageId}`,
      sha256: artifact.sha256,
      byteLength: artifact.byteLength,
      documentVersion: context.documentVersion,
      manifestSha256: context.manifestSha256,
      order: artifact.order,
    };
  });
  try {
    return validateDownloadManifest(
      {
        schemaVersion: DOWNLOAD_MANIFEST_SCHEMA,
        validationState: DOWNLOAD_VALIDATION_STATE,
        status: DOWNLOAD_MANIFEST_STATUS,
        releaseIdentity: context.releaseIdentity,
        documentVersion: context.documentVersion,
        manifestSha256: context.manifestSha256,
        packages,
      },
      { documentVersion: context.documentVersion, manifestSha256: context.manifestSha256, releaseIdentity: context.releaseIdentity },
    );
  } catch {
    boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog failed manifest validation.', 503);
  }
}

export function selectOpaquePackageArtifact(
  artifacts: readonly PrintPackageArtifact[] | null,
  packageId: string,
  context: TrustedDownloadContext,
  ): PrintPackageArtifact {
  const id = validateOpaquePackageId(packageId);
  if (!artifacts) boundaryFailure('PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE', 'Authenticated print-package artifacts are unavailable.', 503);
  const validated = validateCompleteCatalog(artifacts, context);
  const artifact = validated.find((entry) => entry.packageId === id);
  if (!artifact) boundaryFailure('ARTIFACT_NOT_FOUND', 'Opaque package ID is not in the authenticated catalog.', 404);
  return artifact;
}

export function contentDispositionForCatalog(artifact: PrintPackageArtifact): string {
  if (!FILE_NAME_PATTERN.test(artifact.fileName)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Catalog filename is invalid.', 503);
  return `attachment; filename="${artifact.fileName}"`;
}

export async function streamAuthenticatedPrintPackageArtifact(
  artifact: PrintPackageArtifact,
  supabase: SupabaseClient
): Promise<NextResponse> {
  validateOpaquePackageId(artifact.packageId);
  if (!PRIVATE_LOCATOR_PATTERN.test(artifact.serverAssetLocator)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package locator is invalid.', 503);
  if (artifact.serverAssetLocator !== `private-print-package:${artifact.packageId}`) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package locator does not match the package ID.', 503);

  // The storage path travels ON the artifact, which was produced only by
  // `loadAuthenticatedPrintPackageCatalog` after the catalog payload passed
  // content authentication. This boundary therefore never re-reads the raw
  // catalog module, so there is no post-authentication read of unauthenticated
  // data. The shape checks below are defence in depth, not the trust source.
  const storagePath = artifact.storagePath;
  if (!STORAGE_PATH_PATTERN.test(storagePath) || storagePath.includes('..') || storagePath.includes('\\')) {
    boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package storage path is invalid.', 503);
  }
  if (!storagePath.startsWith(`${artifact.cohortId}/`) || !storagePath.endsWith(`/${artifact.fileName}`)) {
    boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package storage path is not bound to the artifact cohort and filename.', 503);
  }

  const { data, error } = await supabase.storage.from(PRIVATE_PACKAGE_BUCKET).download(storagePath);

  if (error || !data) {
    // The storage error was previously discarded, which made a missing bucket
    // indistinguishable from a missing object, an RLS denial or a network fault.
    logBoundaryEvent('PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE', {
      packageId: artifact.packageId,
      bucket: PRIVATE_PACKAGE_BUCKET,
      storagePath,
      storageError: error?.message ?? 'no data returned',
    });
    boundaryFailure('PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE', 'Authenticated print-package artifacts are unavailable in storage.', 503);
  }

  // NOTE ON WHAT THIS CEILING DOES AND DOES NOT DO: the object has already been
  // fetched by the time this runs, so this check does NOT bound memory. Bounding
  // the transfer requires a `file_size_limit` on the bucket itself.
  // AS OF 2026-09-20 THE BUCKET DOES NOT EXIST YET, so no such limit is in force;
  // provisioning is expected to set it to the same 5 MiB. Until then this check
  // is the only ceiling, and it is a post-hoc one. Do not read this comment as a
  // statement that the server-side limit is already configured.
  if (data.size > MAX_PRIVATE_PACKAGE_BYTES) {
    boundaryFailure('PRIVATE_PACKAGE_INTEGRITY_MISMATCH', 'Private package exceeds maximum allowed size.', 503);
  }

  // Reject on the REPORTED size before materializing the bytes. The
  // authenticated artifact states an exact byteLength, so any other size is
  // already a mismatch and there is no reason to buffer it first. The
  // post-buffer length check below stays as the authoritative one, since
  // `data.size` is reported by the storage client rather than measured here.
  if (data.size !== artifact.byteLength) {
    boundaryFailure('PRIVATE_PACKAGE_INTEGRITY_MISMATCH', 'Private package bytes do not match the authenticated artifact length.', 503);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length !== artifact.byteLength) {
    boundaryFailure('PRIVATE_PACKAGE_INTEGRITY_MISMATCH', 'Private package bytes do not match the authenticated artifact length.', 503);
  }

  const hash = createHash('sha256');
  hash.update(buffer);
  const digest = hash.digest('hex');

  // `artifact.sha256` came from the authenticated catalog payload, so a single
  // comparison against it is the real integrity check. An earlier version also
  // compared against a freshly re-read catalog entry, which added no assurance
  // because that re-read value was itself unauthenticated.
  const expectedDigest = Buffer.from(artifact.sha256.toLowerCase(), 'hex');
  const actualDigest = Buffer.from(digest, 'hex');
  if (expectedDigest.length !== actualDigest.length || !timingSafeEqual(actualDigest, expectedDigest)) {
    // A security event: stored bytes disagree with the authenticated catalog.
    logBoundaryEvent('PRIVATE_PACKAGE_INTEGRITY_MISMATCH', {
      packageId: artifact.packageId,
      storagePath,
      expectedSha256: artifact.sha256.toLowerCase(),
      actualSha256: digest,
      byteLength: buffer.length,
    });
    boundaryFailure('PRIVATE_PACKAGE_INTEGRITY_MISMATCH', 'Private package bytes do not match the authenticated artifact hash.', 503);
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': artifact.kind === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Length': artifact.byteLength.toString(),
      'Content-Disposition': contentDispositionForCatalog(artifact),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export type DownloadManifestMapLoadState =
  | { readonly status: 'pending'; readonly manifests: null }
  | { readonly status: 'ready'; readonly manifests: Readonly<Record<string, VerifiedDownloadManifest>> };

export async function loadDownloadManifestMapState(
  documentVersion: string,
  manifestSha256: string
): Promise<DownloadManifestMapLoadState> {
  const context = await loadTrustedDownloadReleaseContext();
  if (context.documentVersion !== documentVersion || context.manifestSha256 !== manifestSha256) {
    boundaryFailure('RELEASE_IDENTITY_MISMATCH', 'Request is not bound to the trusted paper release.', 409);
  }
  const catalog = await loadAuthenticatedPrintPackageCatalog(context);
  if (!catalog) return { status: 'pending', manifests: null };
  const map: Record<string, VerifiedDownloadManifest> = {};
  for (const cohortId of Object.keys(context.cohortQuestionIds)) {
    const cohortArtifacts = catalog.filter(artifact => artifact.cohortId === cohortId);
    map[cohortId] = buildValidatedDownloadManifest(cohortArtifacts, context, cohortId);
  }
  return { status: 'ready', manifests: map };
}
