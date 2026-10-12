import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const table = vi.hoisted(() => ({
  admitted: 0,
  read: 0,
  deny: false,
  bytes: Buffer.from('synthetic v0.9.91 paper\n', 'utf8'),
}));

vi.mock('../accepted-source-media', () => ({
  appendixLSourceMediaContract: () => null,
}));

vi.mock('../private-release-table-source', () => ({
  privateReleaseTableSource: () => ({
    async admits() {
      table.admitted++;
      if (table.deny) throw new Error('synthetic RLS denial');
    },
    async read() {
      table.read++;
      return { bytes: table.bytes, mediaType: 'text/markdown' };
    },
  }),
}));

import {
  getVerifiedPrivateRelease,
  requirePaperReader,
  resetPrivateReleaseCacheForTests,
  type PaperSessionClient,
} from '../private-release-assets';
import { PAPER_RELEASES, type PaperRelease } from '../releases';

const candidate = PAPER_RELEASES.find((release) => release.documentVersion === 'v0.9.91') as PaperRelease;
const syntheticRelease: PaperRelease = {
  ...candidate,
  acceptedFigures: false,
  bytes: table.bytes.length,
  sha256: createHash('sha256').update(table.bytes).digest('hex'),
};

function session(isAnonymous: boolean): PaperSessionClient {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'synthetic-user', is_anonymous: isAnonymous } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: 'synthetic-session' } }, error: null }),
    },
  };
}

beforeEach(() => {
  resetPrivateReleaseCacheForTests();
  table.admitted = 0;
  table.read = 0;
  table.deny = false;
  vi.stubEnv('MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR', '');
});

describe('v0.9.91 table-backed verified-byte cache', () => {
  it('asks RLS again on a warm cache and refuses changed policy without returning cached bytes', async () => {
    const client = session(false);
    const first = await requirePaperReader(client);
    expect((await getVerifiedPrivateRelease(first, syntheticRelease)).markdown).toBe(table.bytes.toString('utf8'));
    expect([table.admitted, table.read]).toEqual([1, 1]);

    const second = await requirePaperReader(client);
    expect((await getVerifiedPrivateRelease(second, syntheticRelease)).markdown).toBe(table.bytes.toString('utf8'));
    expect([table.admitted, table.read]).toEqual([2, 1]);

    table.deny = true;
    const third = await requirePaperReader(client);
    await expect(getVerifiedPrivateRelease(third, syntheticRelease)).rejects.toMatchObject({
      message: 'The private paper release is unavailable.',
    });
    expect([table.admitted, table.read]).toEqual([3, 1]);
  });

  it('rejects anonymous Auth users before any table query', async () => {
    await expect(requirePaperReader(session(true))).rejects.toMatchObject({ code: 'PAPER_READER_DENIED' });
    expect([table.admitted, table.read]).toEqual([0, 0]);
  });
});
