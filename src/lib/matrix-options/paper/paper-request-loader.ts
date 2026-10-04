import 'server-only';

import { describeAuthenticatedPaper } from '../revised-paper';
import { compileAuthenticatedRelease, loadRevisedPaperStructure, type RevisedPaperStructure } from '../revised-paper-structure';
import {
  copyVerifiedFigure,
  getVerifiedPrivateRelease,
  PrivateReleaseUnavailableError,
  requirePaperReader,
  type PaperReader,
  type PaperSessionClient,
  type VerifiedPrivateRelease,
} from './private-release-assets';
import { getPaperRelease, type PaperRelease } from './releases';

/*
 * How a page or a route gets a release's compiled structure and figure bytes
 * for ONE request.
 *
 * - A `repository` release (the default) is loaded exactly as before: the
 *   synchronous, process-cached loader, with no reader check added here. Its
 *   pages and routes keep the checks they already had.
 * - A `private-storage` release needs the request's signed-in, non-anonymous
 *   reader FIRST, on every call, warm or cold. Its bytes come only from
 *   ./private-release-assets.ts, already verified, and the structure is compiled
 *   from those bytes and kept only as long as they are.
 *
 * Callers handle two errors: PaperReaderDeniedError (no content for this
 * requester) and PrivateReleaseUnavailableError (the release cannot be shown to
 * anyone right now). Both are constant: neither carries content.
 */

type CompiledRelease = { readonly structure: RevisedPaperStructure } | { readonly failed: true };

/** One compile per verified load. The entry lives exactly as long as the verified bytes do. */
const compiledReleases = new WeakMap<VerifiedPrivateRelease, CompiledRelease>();

function compiledStructure(release: PaperRelease, assets: VerifiedPrivateRelease): RevisedPaperStructure {
  let compiled = compiledReleases.get(assets);
  if (!compiled) {
    try {
      compiled = { structure: compileAuthenticatedRelease(describeAuthenticatedPaper(release, assets.markdown)) };
    } catch {
      // Verified bytes that do not compile, or do not match their contracts, are a defect in
      // the release binding. No reader is shown a partly checked release.
      console.error('[matrix-options-paper] private release unavailable: STRUCTURE');
      compiled = { failed: true };
    }
    compiledReleases.set(assets, compiled);
  }
  if ('failed' in compiled) throw new PrivateReleaseUnavailableError('STRUCTURE');
  return compiled.structure;
}

function privateRelease(documentVersion: string): PaperRelease {
  const release = getPaperRelease(documentVersion);
  if (!release || release.delivery !== 'private-storage') throw new PrivateReleaseUnavailableError('NOT_A_PRIVATE_RELEASE');
  return release;
}

/** True when the version names a bound release whose bytes are read from private storage. */
export function isPrivatePaperRelease(documentVersion: string): boolean {
  return getPaperRelease(documentVersion)?.delivery === 'private-storage';
}

/** The structure of a private-storage release for a reader requirePaperReader has already issued. */
export async function loadPrivatePaperStructure(documentVersion: string, reader: PaperReader): Promise<RevisedPaperStructure> {
  const release = privateRelease(documentVersion);
  return compiledStructure(release, await getVerifiedPrivateRelease(reader, release));
}

/**
 * The verified bytes of one figure of a private-storage release, or null when
 * the release has no such figure file. The whole release must be showable: a
 * figure is never served from a release whose text does not pass its checks.
 */
export async function loadPrivatePaperFigure(documentVersion: string, assetFile: string, reader: PaperReader): Promise<Buffer | null> {
  const release = privateRelease(documentVersion);
  const assets = await getVerifiedPrivateRelease(reader, release);
  compiledStructure(release, assets);
  return copyVerifiedFigure(assets, assetFile);
}

/**
 * The structure of any bound release for this request. For a private-storage
 * release the reader check runs before anything else.
 */
export async function loadPaperStructureForRequest(documentVersion: string, supabase: PaperSessionClient): Promise<RevisedPaperStructure> {
  if (!isPrivatePaperRelease(documentVersion)) return loadRevisedPaperStructure(documentVersion);
  const reader = await requirePaperReader(supabase);
  return loadPrivatePaperStructure(documentVersion, reader);
}
