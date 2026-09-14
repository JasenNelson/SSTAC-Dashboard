import 'server-only';

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const REVISED_PAPER_VERSION = '1.0.11-remediated-20260913';
export const REVISED_PAPER_SHA256 =
  'bcc4e4b472d13d12506ece436edf4a4aa6a5bb9ff4724a5478573993183057bd';
export const REVISED_PAPER_BYTES = 534101;
export const REVISED_PAPER_FILENAME =
  'BC_Matrix_Options_Paper_v1.0.11-remediated-20260913.md';
export const REVISED_PAPER_SIDECAR_FILENAME = `${REVISED_PAPER_FILENAME}.sha256`;
export const REVISED_PAPER_RELATIVE_PATH =
  `matrix_research/options_paper/${REVISED_PAPER_FILENAME}`;
export const REVISED_PAPER_SIDECAR_RELATIVE_PATH =
  `matrix_research/options_paper/${REVISED_PAPER_SIDECAR_FILENAME}`;
export const REVISED_PAPER_RELEASE_IDENTITY =
  `matrix-options-paper:${REVISED_PAPER_VERSION}:${REVISED_PAPER_SHA256}`;
export const REVISED_PAPER_ROUTE =
  `/matrix-options/paper/v/${REVISED_PAPER_VERSION}`;
export const REVISED_PAPER_PERSISTENCE_STATE =
  'DISABLED_PENDING_LIVE_CONTRACT' as const;

export interface RevisedPaperDescriptor {
  readonly content: string;
  readonly documentVersion: typeof REVISED_PAPER_VERSION;
  readonly sha256: typeof REVISED_PAPER_SHA256;
  readonly bytes: typeof REVISED_PAPER_BYTES;
  readonly releaseIdentity: typeof REVISED_PAPER_RELEASE_IDENTITY;
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

function decodeAndAuthenticate(
  markdownBytes: Buffer,
  sidecarBytes: Buffer,
): RevisedPaperDescriptor {
  if (markdownBytes.byteLength !== REVISED_PAPER_BYTES) unavailable();
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
    `${REVISED_PAPER_SHA256}  ${REVISED_PAPER_FILENAME}\n`,
    'ascii',
  );
  if (!sidecarBytes.equals(expectedSidecar)) unavailable();

  const computedSha256 = createHash('sha256')
    .update(markdownBytes)
    .digest('hex');
  if (computedSha256 !== REVISED_PAPER_SHA256) unavailable();

  return Object.freeze({
    content,
    documentVersion: REVISED_PAPER_VERSION,
    sha256: REVISED_PAPER_SHA256,
    bytes: REVISED_PAPER_BYTES,
    releaseIdentity: REVISED_PAPER_RELEASE_IDENTITY,
    persistenceState: REVISED_PAPER_PERSISTENCE_STATE,
  });
}

export function loadRevisedPaper(
  documentVersion: string | undefined,
): RevisedPaperDescriptor {
  if (documentVersion !== REVISED_PAPER_VERSION) unavailable();

  try {
    const markdownPath = path.join(
      process.cwd(),
      ...REVISED_PAPER_RELATIVE_PATH.split('/'),
    );
    const sidecarPath = path.join(
      process.cwd(),
      ...REVISED_PAPER_SIDECAR_RELATIVE_PATH.split('/'),
    );
    return decodeAndAuthenticate(
      fs.readFileSync(markdownPath),
      fs.readFileSync(sidecarPath),
    );
  } catch {
    unavailable();
  }
}
