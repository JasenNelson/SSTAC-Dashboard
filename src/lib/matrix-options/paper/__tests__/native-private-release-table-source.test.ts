import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { nativePrivateReleaseTableSource } from '../native-private-release-table-source';
import type { PaperSessionClient, PrivateReleaseObject } from '../private-release-assets';

const BYTES = Buffer.from('{"synthetic":true}\n');
const OBJECT: PrivateReleaseObject = {
  path: 'v0.9.91/figures/native-figure-models.json', bytes: BYTES.length,
  sha256: createHash('sha256').update(BYTES).digest('hex'), mediaType: 'application/json',
};

function row() {
  return { asset_path: OBJECT.path, document_version: 'v0.9.91', byte_length: OBJECT.bytes,
    sha256: OBJECT.sha256, mime_type: OBJECT.mediaType, payload: `\\x${BYTES.toString('hex')}` };
}

function clientFor(data: unknown, error: unknown = null) {
  const calls: { table: string; columns: string; path: string; limit: number }[] = [];
  const client = {
    from(table: string) { return { select(columns: string) { return { eq(_field: string, assetPath: string) {
      return { limit(limit: number) { return { abortSignal(_signal: AbortSignal) {
        calls.push({ table, columns, path: assetPath, limit });
        return Promise.resolve({ data, error });
      } }; } };
    } }; } }; },
  } as unknown as PaperSessionClient;
  return { client, calls };
}

describe('native private table source', () => {
  it('rechecks exact metadata on every signed-in admission', async () => {
    const { client, calls } = clientFor([row()]);
    const source = nativePrivateReleaseTableSource(client);
    await source.admits(OBJECT, new AbortController().signal);
    await source.admits(OBJECT, new AbortController().signal);
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.table === 'matrix_paper_private_assets_v0991_native_v1' &&
      call.path === OBJECT.path && call.limit === 2 &&
      call.columns === 'asset_path,document_version,byte_length,sha256,mime_type')).toBe(true);
  });

  it('returns exact verified wire bytes and refuses absent, duplicate or changed rows', async () => {
    const source = nativePrivateReleaseTableSource(clientFor([row()]).client);
    expect(Buffer.from((await source.read(OBJECT, new AbortController().signal)).bytes)).toEqual(BYTES);
    for (const [data, code] of [
      [[], 'STATUS'],
      [[row(), row()], 'STATUS'],
      [[{ ...row(), sha256: '0'.repeat(64) }], 'STRUCTURE'],
      [[{ ...row(), mime_type: 'text/plain' }], 'STRUCTURE'],
    ] as const) {
      const candidate = nativePrivateReleaseTableSource(clientFor(data).client);
      await expect(candidate.admits(OBJECT, new AbortController().signal)).rejects.toMatchObject({ code });
      await expect(candidate.read(OBJECT, new AbortController().signal)).rejects.toMatchObject({ code });
    }
  });

  it('fails closed on a database error and pre-aborted signal', async () => {
    const failed = nativePrivateReleaseTableSource(clientFor([row()], { message: 'synthetic error' }).client);
    await expect(failed.admits(OBJECT, new AbortController().signal)).rejects.toMatchObject({ code: 'STATUS' });
    const controller = new AbortController();
    controller.abort();
    await expect(failed.read(OBJECT, controller.signal)).rejects.toMatchObject({ code: 'DEADLINE' });
  });
});
