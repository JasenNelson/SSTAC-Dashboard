import 'server-only';

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { describeAuthenticatedPaper } from '../revised-paper';
import { compileAuthenticatedRelease } from '../revised-paper-structure';
import { getAcceptedFiguresContract } from './accepted-figures';
import { getPaperRelease, PHASE2_R2_PAPER_VERSION } from './releases';

const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

export function isLocalR2PreviewRequest(headers: Pick<Headers, 'get'>): boolean {
  const host = headers.get('host') ?? '';
  const forwardedHost = headers.get('x-forwarded-host');
  return process.env.NODE_ENV === 'development'
    && process.env.MATRIX_R2_REVIEW_PREVIEW === '1'
    && LOCAL_HOST.test(host)
    && (!forwardedHost || forwardedHost === host);
}

function sourceRoot(): string {
  const value = process.env.MATRIX_R2_REVIEW_PREVIEW_SOURCE_ROOT;
  if (!value || !path.isAbsolute(value)) throw new Error('Local R2 preview source is unavailable.');
  return path.resolve(value);
}

function release() {
  const value = getPaperRelease(PHASE2_R2_PAPER_VERSION);
  if (!value || value.delivery !== 'private-storage') throw new Error('R2 release identity is unavailable.');
  return value;
}

export async function loadLocalR2PreviewStructure() {
  const file = path.join(sourceRoot(), 'deliverables', 'Matrix_Options_Paper_R2_draft.md');
  const bytes = await fs.readFile(file);
  const bound = release();
  if (bytes.byteLength !== bound.bytes || createHash('sha256').update(bytes).digest('hex') !== bound.sha256) {
    throw new Error('Local R2 preview paper identity mismatch.');
  }
  const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return compileAuthenticatedRelease(describeAuthenticatedPaper(bound, content));
}

export async function loadLocalR2PreviewFigure(file: string, expectedSha256: string): Promise<Buffer> {
  const contract = getAcceptedFiguresContract(PHASE2_R2_PAPER_VERSION);
  const asset = contract?.assets.find((candidate) => candidate.file === file && candidate.sha256 === expectedSha256);
  if (!asset || !/^[A-Za-z0-9_-]+\.png$/.test(file)) throw new Error('Unknown R2 preview figure.');
  const bytes = await fs.readFile(path.join(sourceRoot(), 'src', 'figures', file));
  if (bytes.byteLength !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
    throw new Error('Local R2 preview figure identity mismatch.');
  }
  return bytes;
}
