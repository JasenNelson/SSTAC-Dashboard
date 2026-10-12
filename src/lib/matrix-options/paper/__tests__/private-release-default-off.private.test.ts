import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const observed = vi.hoisted(() => ({ reads: [] as string[], admissions: [] as string[] }));
vi.mock('../private-release-local-source', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../private-release-local-source')>();
  return { localDirectorySource(directory: string) {
    const source = actual.localDirectorySource(directory);
    return {
      async admits(object: Parameters<typeof source.admits>[0], signal: AbortSignal) {
        observed.admissions.push(object.path);
        if (object.path.endsWith('native-figure-models.json')) throw new Error('NATIVE_MODEL_READ_IN_DEFAULT_OFF');
        return source.admits(object, signal);
      },
      async read(object: Parameters<typeof source.read>[0], signal: AbortSignal) {
        observed.reads.push(object.path);
        if (object.path.endsWith('native-figure-models.json')) throw new Error('NATIVE_MODEL_READ_IN_DEFAULT_OFF');
        return source.read(object, signal);
      },
    };
  } };
});

import { getAcceptedFiguresContract } from '../accepted-figures';
import { getVerifiedPrivateRelease, requirePaperReader, resetPrivateReleaseCacheForTests, type PaperSessionClient } from '../private-release-assets';
import { getPaperRelease, V0991_PAPER_VERSION } from '../releases';
import { describePrivateV0991, privateFixtureDirectory } from './private-fixture';

const client: PaperSessionClient = { auth: {
  getUser: async () => ({ data: { user: { id: 'synthetic-reader', is_anonymous: false } }, error: null }),
  getSession: async () => ({ data: { session: { access_token: 'synthetic-session' } }, error: null }),
} };

describePrivateV0991('actual v0.9.91 prior catalog with native delivery disabled', () => {
  it.each([undefined, '', 'review', 'reviewedd'])(
    'retains all accepted flowchart PNGs and Appendix L with flag %s', async (flag) => {
      const root = privateFixtureDirectory();
      expect(root).toBeTruthy();
      vi.stubEnv('MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR', root!);
      vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_DELIVERY', flag);
      observed.reads = [];
      observed.admissions = [];
      resetPrivateReleaseCacheForTests();
      const release = getPaperRelease(V0991_PAPER_VERSION)!;
      expect(release.acceptedFigures).toBe(true);
      const contract = getAcceptedFiguresContract(V0991_PAPER_VERSION)!;
      expect(contract.assets).toHaveLength(17);
      const verified = await getVerifiedPrivateRelease(await requirePaperReader(client), release);
      expect(verified.nativeFigures).toBeUndefined();
      expect(verified.figureFiles).toEqual([...contract.assets.map((asset) => asset.file), 'APPENDIX-L-SOURCE.png']);
      expect(observed.reads).toHaveLength(19);
      expect(observed.reads.some((path) => path.endsWith('native-figure-models.json'))).toBe(false);
      expect(observed.admissions.some((path) => path.endsWith('native-figure-models.json'))).toBe(false);
      vi.unstubAllEnvs();
    },
  );
});
