import 'server-only';

import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { findAcceptedFigureBlocks, getAcceptedFiguresContract } from './accepted-figures';
import { authenticateAcceptedFigures } from './accepted-figures-server';
import { validateNativeFigureSet, type NativeFigureSet } from './native-figures';
import { getPaperRelease } from './releases';

export class NativeFigureCandidateUnavailableError extends Error {
  constructor() {
    super('The private native figure candidate is unavailable.');
    this.name = 'NativeFigureCandidateUnavailableError';
  }
}

/** Match every model caption to the already authenticated manuscript placement. */
export function assertNativeCaptionBindings(set: NativeFigureSet, captions: readonly { readonly figureId: string; readonly caption: string }[]): void {
  if (set.placements.length !== captions.length ||
      set.placements.some((placement, index) =>
        placement.figureId !== captions[index]?.figureId || placement.caption !== captions[index]?.caption)) {
    throw new NativeFigureCandidateUnavailableError();
  }
}

/** Local candidate only. A production reader needs a separately reviewed private delivery contract. */
export async function loadLocalNativeFigureCandidate(releaseIdentity: string, directory: string): Promise<NativeFigureSet> {
  if ((process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') ||
      process.env.MATRIX_OPTIONS_NATIVE_FIGURE_CANDIDATE !== 'local' ||
      typeof directory !== 'string' || !path.isAbsolute(directory)) throw new NativeFigureCandidateUnavailableError();
  const contract = getAcceptedFiguresContract(releaseIdentity);
  const release = getPaperRelease(releaseIdentity);
  if (!contract || !release || release.sha256 !== contract.paperSha256) throw new NativeFigureCandidateUnavailableError();
  const root = path.resolve(directory);
  const target = path.join(root, releaseIdentity, 'figures', 'native-figure-models.json');
  const manuscript = path.join(root, releaseIdentity, 'presentation.md');
  if (!target.startsWith(`${root}${path.sep}`)) throw new NativeFigureCandidateUnavailableError();
  try {
    const resolved = await realpath(target);
    const resolvedManuscript = await realpath(manuscript);
    if (resolved !== target || resolvedManuscript !== manuscript) throw new NativeFigureCandidateUnavailableError();
    const info = await stat(target);
    const manuscriptInfo = await stat(manuscript);
    if (!info.isFile() || info.size < 2 || info.size > 1_048_576) throw new NativeFigureCandidateUnavailableError();
    if (!manuscriptInfo.isFile() || manuscriptInfo.size !== release.bytes) throw new NativeFigureCandidateUnavailableError();
    const bytes = await readFile(target);
    const manuscriptBytes = await readFile(manuscript);
    if (bytes.length !== info.size || bytes.includes(13) || bytes.some((byte) => byte > 127) ||
        bytes[bytes.length - 1] !== 10) throw new NativeFigureCandidateUnavailableError();
    if (manuscriptBytes.length !== manuscriptInfo.size ||
        createHash('sha256').update(manuscriptBytes).digest('hex') !== release.sha256) throw new NativeFigureCandidateUnavailableError();
    const manuscriptText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(manuscriptBytes);
    if (manuscriptText.includes('\r') || manuscriptBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw new NativeFigureCandidateUnavailableError();
    authenticateAcceptedFigures({ content: manuscriptText, manifest: { source: { version: releaseIdentity, sha256: release.sha256 } } });
    const set = validateNativeFigureSet(JSON.parse(bytes.toString('ascii')) as unknown, contract);
    assertNativeCaptionBindings(set, findAcceptedFigureBlocks(manuscriptText.split('\n')).map((block) => ({
      figureId: block.figureId, caption: block.content?.caption ?? '',
    })));
    return set;
  } catch {
    throw new NativeFigureCandidateUnavailableError();
  }
}
