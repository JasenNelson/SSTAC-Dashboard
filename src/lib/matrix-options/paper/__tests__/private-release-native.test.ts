import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fixture = vi.hoisted(() => {
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(1, 16);
  png.writeUInt32BE(1, 20);
  return {
    markdown: Buffer.from('synthetic manuscript\n'),
    modelBytes: Buffer.from('{"synthetic":true}\n'),
    png,
    model: { placements: [{ figureId: '1-1', caption: 'Figure 1-1. Synthetic.' }] },
    captions: [{ figureId: '1-1', content: { caption: 'Figure 1-1. Synthetic.' } }],
    admissions: [] as string[],
    reads: [] as string[],
    denied: '' as string,
    missing: '' as string,
  };
});

vi.mock('../accepted-figures', () => ({
  getAcceptedFiguresContract: () => null,
  findAcceptedFigureBlocks: () => fixture.captions,
}));
vi.mock('../accepted-figures-server', () => ({
  authenticateAcceptedFigures: () => ({ releaseIdentity: 'v0.9.91' }),
}));
vi.mock('../native-figures', () => ({
  validateNativeFigureSet: () => fixture.model,
}));
vi.mock('../accepted-source-media', () => ({
  appendixLSourceMediaContract: () => ({
    file: 'APPENDIX-L-SOURCE.png', sourceMediaPath: 'appendix_l_media/image1.png',
    bytes: fixture.png.length, sha256: createHash('sha256').update(fixture.png).digest('hex'),
    width: 1, height: 1,
  }),
}));
vi.mock('../native-private-release-table-source', () => ({
  nativePrivateReleaseTableSource: () => ({
    async admits(object: { path: string }) {
      fixture.admissions.push(object.path);
      if (fixture.denied === object.path) throw new Error('synthetic denial');
    },
    async read(object: { path: string; mediaType: string }) {
      fixture.reads.push(object.path);
      if (fixture.missing === object.path) throw new Error('synthetic missing row');
      const bytes = object.path.endsWith('presentation.md') ? fixture.markdown
        : object.path.endsWith('native-figure-models.json') ? fixture.modelBytes : fixture.png;
      return { bytes, mediaType: object.mediaType };
    },
  }),
}));
vi.mock('../private-release-table-source', () => ({
  privateReleaseTableSource: () => ({
    async admits(object: { path: string }) { fixture.admissions.push(object.path); },
    async read(object: { path: string; mediaType: string }) {
      fixture.reads.push(object.path);
      return { bytes: object.path.endsWith('presentation.md') ? fixture.markdown : fixture.png,
        mediaType: object.mediaType };
    },
  }),
}));

import {
  copyVerifiedFigure,
  getVerifiedPrivateRelease,
  nativeDeliveryPrepared,
  requirePaperReader,
  resetPrivateReleaseCacheForTests,
  type PaperSessionClient,
} from '../private-release-assets';
import { PAPER_RELEASES, R5_PAPER_VERSION, type PaperRelease } from '../releases';

const base = PAPER_RELEASES.find((release) => release.documentVersion === 'v0.9.91') as PaperRelease;
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const release: PaperRelease = { ...base, acceptedFigures: false,
  bytes: fixture.markdown.length, sha256: hash(fixture.markdown) };
const modelPath = 'v0.9.91/figures/native-figure-models.json';
const appendixPath = 'v0.9.91/appendix_l_media/image1.png';

function client(anonymous = false): PaperSessionClient {
  return { auth: {
    getUser: async () => ({ data: { user: { id: 'synthetic-user', is_anonymous: anonymous } }, error: null }),
    getSession: async () => ({ data: { session: { access_token: 'synthetic-session' } }, error: null }),
  } };
}

beforeEach(() => {
  resetPrivateReleaseCacheForTests();
  fixture.admissions = [];
  fixture.reads = [];
  fixture.denied = '';
  fixture.missing = '';
  fixture.model = { placements: [{ figureId: '1-1', caption: 'Figure 1-1. Synthetic.' }] };
  vi.stubEnv('MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR', '');
  vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_DELIVERY', 'reviewed');
  vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_SHA256', hash(fixture.modelBytes));
  vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_BYTES', String(fixture.modelBytes.length));
});

describe('prepared three-object native release', () => {
  it.each([undefined, '', 'review', 'Reviewed', 'reviewedd'])(
    'keeps the prior catalog when the native flag is absent or not exact (%s)', async (flag) => {
      vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_DELIVERY', flag);
      expect(nativeDeliveryPrepared(release)).toBe(false);
      const verified = await getVerifiedPrivateRelease(await requirePaperReader(client()), release);
      expect(verified.nativeFigures).toBeUndefined();
      expect(verified.figureFiles).toEqual(['APPENDIX-L-SOURCE.png']);
      expect(fixture.reads).not.toContain(modelPath);
    },
  );

  it('selects native mode only for exact version and reviewed metadata, and fails closed on wrong hash or size', async () => {
    expect(nativeDeliveryPrepared({ ...release, documentVersion: R5_PAPER_VERSION })).toBe(false);
    expect(nativeDeliveryPrepared(release)).toBe(true);
    vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_SHA256', 'a'.repeat(64));
    await expect(getVerifiedPrivateRelease(await requirePaperReader(client()), release)).rejects.toMatchObject({ code: 'SHA256' });
    resetPrivateReleaseCacheForTests();
    vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_SHA256', hash(fixture.modelBytes));
    vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_BYTES', String(fixture.modelBytes.length + 1));
    await expect(getVerifiedPrivateRelease(await requirePaperReader(client()), release)).rejects.toMatchObject({ code: 'LENGTH' });
    vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_BYTES', undefined);
    expect(() => nativeDeliveryPrepared(release)).toThrow();
    vi.stubEnv('MATRIX_OPTIONS_PAPER_NATIVE_MODEL_BYTES', '01');
    expect(() => nativeDeliveryPrepared(release)).toThrow();
  });

  it('verifies only manuscript, model and Appendix L and re-admits all three on a cache hit', async () => {
    const session = client();
    const first = await getVerifiedPrivateRelease(await requirePaperReader(session), release);
    expect(first.nativeFigures?.placements).toHaveLength(1);
    expect(first.figureFiles).toEqual(['APPENDIX-L-SOURCE.png']);
    expect(copyVerifiedFigure(first, 'FIG6-1.png')).toBeNull();
    expect(fixture.reads).toEqual(['v0.9.91/presentation.md', modelPath, appendixPath]);
    expect(fixture.admissions).toHaveLength(3);
    await getVerifiedPrivateRelease(await requirePaperReader(session), release);
    expect(fixture.reads).toHaveLength(3);
    expect(fixture.admissions).toHaveLength(6);
    fixture.denied = appendixPath;
    await expect(getVerifiedPrivateRelease(await requirePaperReader(session), release)).rejects.toMatchObject({ code: 'TRANSPORT' });
  });

  it('refuses a missing model and a single caption drift before returning the release', async () => {
    fixture.missing = modelPath;
    await expect(getVerifiedPrivateRelease(await requirePaperReader(client()), release)).rejects.toMatchObject({ code: 'TRANSPORT' });
    resetPrivateReleaseCacheForTests();
    fixture.missing = '';
    fixture.model = { placements: [{ figureId: '1-1', caption: 'Figure 1-1. Changed.' }] };
    await expect(getVerifiedPrivateRelease(await requirePaperReader(client()), release)).rejects.toMatchObject({ code: 'STRUCTURE' });
  });

  it('rejects anonymous users before querying the table', async () => {
    await expect(requirePaperReader(client(true))).rejects.toMatchObject({ code: 'PAPER_READER_DENIED' });
    expect(fixture.reads).toHaveLength(0);
  });
});
