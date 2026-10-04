import 'server-only';

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  getPaperRelease,
  paperReleaseIdentity,
  paperReleaseRelativePath,
  paperReleaseSidecarRelativePath,
  type PaperRelease,
  type PaperReleaseVersion,
} from './paper/releases';

/*
 * The DEFAULT release. Every REVISED_PAPER_* constant below names the
 * predecessor and is unchanged by the second release: the default landing route,
 * the review route and the persisted review manifest all still resolve to it.
 */
export const REVISED_PAPER_VERSION = '1.0.11-remediated-7-8-successor-20260918-D';
export const REVISED_PAPER_SHA256 =
  'feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337';
export const REVISED_PAPER_BYTES = 541959;
export const REVISED_PAPER_FILENAME =
  'BC_Matrix_Options_Paper_v1.0.11-remediated-7-8-successor-20260918-D.md';
export const REVISED_PAPER_SIDECAR_FILENAME = `${REVISED_PAPER_FILENAME}.sha256`;
export const REVISED_PAPER_RELATIVE_PATH =
  `candidate/paper/${REVISED_PAPER_FILENAME}`;
export const REVISED_PAPER_SIDECAR_RELATIVE_PATH =
  `candidate/paper/${REVISED_PAPER_SIDECAR_FILENAME}`;
export const REVISED_PAPER_RELEASE_IDENTITY =
  `matrix-options-paper:${REVISED_PAPER_VERSION}:${REVISED_PAPER_SHA256}`;
export const REVISED_PAPER_ROUTE =
  `/matrix-options/paper/v/${REVISED_PAPER_VERSION}`;
export const REVISED_PAPER_PERSISTENCE_STATE =
  'DISABLED_PENDING_LIVE_CONTRACT' as const;

/** `content` is the exact text of the release artifact; `sha256` and `bytes` are its identity. */
export interface RevisedPaperDescriptor {
  readonly content: string;
  readonly documentVersion: PaperReleaseVersion;
  readonly sha256: string;
  readonly bytes: number;
  readonly releaseIdentity: string;
  readonly persistenceState: typeof REVISED_PAPER_PERSISTENCE_STATE;
}

export class RevisedPaperUnavailableError extends Error {
  constructor() {
    super('The authenticated revised paper is unavailable.');
    this.name = 'RevisedPaperUnavailableError';
  }
}

function unavailable(): never {
  throw new RevisedPaperUnavailableError();
}

/**
 * The descriptor of a release for text that is ALREADY proven to be the release
 * artifact. The length and hash are checked again here, so a descriptor can
 * never carry text other than the bound bytes whoever calls this.
 */
export function describeAuthenticatedPaper(release: PaperRelease, content: string): RevisedPaperDescriptor {
  const bytes = Buffer.from(content, 'utf8');
  if (bytes.byteLength !== release.bytes) unavailable();
  if (createHash('sha256').update(bytes).digest('hex') !== release.sha256) unavailable();
  return Object.freeze({
    content,
    documentVersion: release.documentVersion,
    sha256: release.sha256,
    bytes: release.bytes,
    releaseIdentity: paperReleaseIdentity(release),
    persistenceState: REVISED_PAPER_PERSISTENCE_STATE,
  });
}

function decodeAndAuthenticate(
  release: PaperRelease,
  markdownBytes: Buffer,
  sidecarBytes: Buffer,
): RevisedPaperDescriptor {
  if (markdownBytes.byteLength !== release.bytes) unavailable();
  if (
    markdownBytes[0] === 0xef &&
    markdownBytes[1] === 0xbb &&
    markdownBytes[2] === 0xbf
  ) {
    unavailable();
  }

  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(markdownBytes);
  } catch {
    unavailable();
  }

  const expectedSidecar = Buffer.from(
    `${release.sha256}  ${release.filename}\n`,
    'ascii',
  );
  if (!sidecarBytes.equals(expectedSidecar)) unavailable();

  const computedSha256 = createHash('sha256')
    .update(markdownBytes)
    .digest('hex');
  if (computedSha256 !== release.sha256) unavailable();

  return describeAuthenticatedPaper(release, content);
}

/**
 * Loads one bound REPOSITORY release by its exact version. An absent or unknown
 * version fails closed before any file is read: there is no fallback to the
 * default. A private-storage release has no file here and no synchronous path:
 * it is unavailable from this loader and is read only through
 * ./paper/paper-request-loader.ts, with the reader's own session.
 */
export function loadRevisedPaper(
  documentVersion: string | undefined,
): RevisedPaperDescriptor {
  const release = getPaperRelease(documentVersion);
  if (!release) unavailable();
  const markdownRelativePath = paperReleaseRelativePath(release);
  const sidecarRelativePath = paperReleaseSidecarRelativePath(release);
  if (release.delivery !== 'repository' || !markdownRelativePath || !sidecarRelativePath) unavailable();

  try {
    return decodeAndAuthenticate(
      release,
      fs.readFileSync(path.join(process.cwd(), ...markdownRelativePath.split('/'))),
      fs.readFileSync(path.join(process.cwd(), ...sidecarRelativePath.split('/'))),
    );
  } catch {
    unavailable();
  }
}
