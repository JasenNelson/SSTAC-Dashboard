import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { copyVerifiedFigure, getVerifiedPrivateRelease, requirePaperReader, resetPrivateReleaseCacheForTests,
  type PaperSessionClient } from '../private-release-assets';
import { getPaperRelease } from '../releases';
import { loadPrivatePaperBundle } from '../paper-request-loader';

const root = process.env.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR;

describe('opted-in local three-object private release', () => {
  it.skipIf(!root)('verifies the actual manuscript, model and Appendix L without reading accepted flowchart PNGs', async () => {
    const modelPath = path.join(root!, 'v0.9.91', 'figures', 'native-figure-models.json');
    const modelBytes = readFileSync(modelPath);
    vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_DELIVERY', 'reviewed');
    vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_SHA256', createHash('sha256').update(modelBytes).digest('hex'));
    vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_BYTES', String(modelBytes.length));
    resetPrivateReleaseCacheForTests();
    const session = { auth: {
      getUser: async () => ({ data: { user: { id: 'synthetic-local-reader', is_anonymous: false } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: 'synthetic-local-session' } }, error: null }),
    } } as PaperSessionClient;
    const release = getPaperRelease('v0.9.91')!;
    const verified = await getVerifiedPrivateRelease(await requirePaperReader(session), release);
    expect(verified.nativeFigures?.models).toHaveLength(17);
    expect(verified.nativeFigures?.placements).toHaveLength(20);
    const bundle = await loadPrivatePaperBundle('v0.9.91', await requirePaperReader(session));
    expect(bundle.structure.manifest.source.sha256).toBe(release.sha256);
    expect(bundle.nativeFigures?.models).toHaveLength(17);
    expect(bundle.nativeFigures?.placements).toHaveLength(20);
    expect(verified.figureFiles).toEqual(['APPENDIX-L-SOURCE.png']);
    expect(copyVerifiedFigure(verified, 'APPENDIX-L-SOURCE.png')).not.toBeNull();
    expect(copyVerifiedFigure(verified, 'FIG6-1.png')).toBeNull();
    vi.unstubAllEnvs();
  });
});
