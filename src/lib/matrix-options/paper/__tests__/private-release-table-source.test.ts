import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createHash } from 'node:crypto';
import { privateReleaseTableSource } from '../private-release-table-source';
import { PrivateReleaseUnavailableError, type PaperSessionClient, type PrivateReleaseObject } from '../private-release-assets';

const BYTES = Buffer.from('synthetic table payload\n', 'utf8');
const OBJECT: PrivateReleaseObject = {
  path: 'v0.9.91/presentation.md',
  bytes: BYTES.length,
  sha256: createHash('sha256').update(BYTES).digest('hex'),
  mediaType: 'text/markdown',
};

function clientFor(data: unknown, error: unknown = null) {
  const calls: { table: string; columns: string; column: string; path: string; limit: number; signal: AbortSignal }[] = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'synthetic-user', is_anonymous: false } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: 'synthetic-token' } }, error: null }),
    },
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, path: string) {
              return {
                limit(limit: number) {
                  return {
                    abortSignal(signal: AbortSignal) {
                      calls.push({ table, columns, column, path, limit, signal });
                      return Promise.resolve({ data, error });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client: client as PaperSessionClient, calls };
}

function row(payload: unknown = `\\x${BYTES.toString('hex')}`) {
  return {
    asset_path: OBJECT.path,
    document_version: 'v0.9.91',
    byte_length: OBJECT.bytes,
    sha256: OBJECT.sha256,
    mime_type: OBJECT.mediaType,
    payload,
  };
}

async function fails(work: Promise<unknown>, code: string): Promise<void> {
  await expect(work).rejects.toMatchObject({ code, message: 'The private paper release is unavailable.' });
}

describe('v0.9.91 request-bound table source', () => {
  it('makes a new exact-key RLS admission query on every request', async () => {
    const { client, calls } = clientFor([{ asset_path: OBJECT.path }]);
    const source = privateReleaseTableSource(client);
    await source.admits(OBJECT, new AbortController().signal);
    await source.admits(OBJECT, new AbortController().signal);
    expect(calls).toHaveLength(2);
    expect(calls.map(({ table, columns, column, path, limit }) => ({ table, columns, column, path, limit }))).toEqual(
      Array.from({ length: 2 }, () => ({
        table: 'matrix_paper_private_assets_v0991',
        columns: 'asset_path',
        column: 'asset_path',
        path: OBJECT.path,
        limit: 2,
      })),
    );
  });

  it('reads only the exact row and strict bytea wire form', async () => {
    const { client, calls } = clientFor([row()]);
    const result = await privateReleaseTableSource(client).read(OBJECT, new AbortController().signal);
    expect(Buffer.from(result.bytes)).toEqual(BYTES);
    expect(result.mediaType).toBe('text/markdown');
    expect(calls[0].columns).toBe('asset_path,document_version,byte_length,sha256,mime_type,payload');
  });

  it.each<[string, unknown, string, unknown?]>([
    ['missing row', [], 'STATUS'],
    ['duplicate rows', [row(), row()], 'STATUS'],
    ['database refusal', [row()], 'STATUS', { message: 'private error' }],
    ['wrong metadata', [{ ...row(), sha256: '0'.repeat(64) }], 'STRUCTURE'],
    ['wrong path', [{ ...row(), asset_path: 'v0.9.91/other.md' }], 'STRUCTURE'],
    ['base64 wire data', [row(BYTES.toString('base64'))], 'STRUCTURE'],
    ['truncated hex', [row(`\\x${BYTES.toString('hex').slice(0, -2)}`)], 'LENGTH'],
    ['nonhex data', [row(`\\x${'z'.repeat(BYTES.length * 2)}`)], 'STRUCTURE'],
  ])('rejects %s without returning bytes', async (_name, data, code, error) => {
    const { client } = clientFor(data, error);
    await fails(privateReleaseTableSource(client).read(OBJECT, new AbortController().signal), code);
  });

  it('rejects a pre-aborted request and an out-of-release path', async () => {
    const { client, calls } = clientFor([row()]);
    const source = privateReleaseTableSource(client);
    const controller = new AbortController();
    controller.abort();
    await fails(source.read(OBJECT, controller.signal), 'DEADLINE');
    await fails(source.admits({ ...OBJECT, path: 'v0.9.90/presentation.md' }, new AbortController().signal), 'CONFIGURATION');
    expect(calls).toHaveLength(0);
  });

  it('uses only constant unavailable errors', async () => {
    const { client } = clientFor([]);
    const error = await sourceFailure(privateReleaseTableSource(client).read(OBJECT, new AbortController().signal));
    expect(error).toBeInstanceOf(PrivateReleaseUnavailableError);
    expect(error.message).not.toContain(OBJECT.path);
  });
});

async function sourceFailure(work: Promise<unknown>): Promise<Error> {
  try {
    await work;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected rejection');
}
