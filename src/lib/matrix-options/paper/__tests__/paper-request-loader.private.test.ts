import { createHash } from 'node:crypto';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getAcceptedFiguresContract } from '../accepted-figures';
import { loadPaperStructureForRequest, loadPrivatePaperFigure, loadPrivatePaperStructure } from '../paper-request-loader';
import { PaperReaderDeniedError, requirePaperReader, resetPrivateReleaseCacheForTests, type PaperReader, type PaperSessionClient } from '../private-release-assets';
import { getPaperRelease, paperReleaseIdentity, R5_PAPER_VERSION } from '../releases';
import { describePrivate, PRIVATE_FIXTURE_DIR_ENV, PRIVATE_FIXTURE_MODE_ENV } from './private-fixture';

/*
 * The request loader on the REAL private-storage release, with the private
 * fixture as the local source (the directory the fixture variable names is the
 * directory the non-production server reads). Nothing is replaced: the reader
 * check, the allowlist, the verification of every object and the compiler are
 * the product's own, on the bound bytes.
 *
 * Hashes, counts, ids and booleans only. The always-run counterpart, on
 * synthetic bytes, is paper-request-loader.test.ts.
 */

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function sessionClient(user: unknown): { readonly client: PaperSessionClient; readonly getSession: ReturnType<typeof vi.fn> } {
  // A session token is needed even where the fixture stands in for storage: the session is named before the source is chosen.
  const getSession = vi.fn(async () => ({ data: { session: { access_token: 'synthetic-session-token' } }, error: null }));
  return { client: { auth: { getUser: async () => ({ data: { user }, error: null }), getSession } } as unknown as PaperSessionClient, getSession };
}

const ALLOWED_USER = Object.freeze({ id: 'reader-user-1', is_anonymous: false });

describePrivate('request loader on the private fixture', () => {
  const fetchStub = vi.fn(async () => {
    throw new Error('storage is not read where the fixture stands in for it');
  });

  beforeEach(() => {
    resetPrivateReleaseCacheForTests();
    fetchStub.mockClear();
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the bound release for a signed-in reader: identity, byte coverage and node count', async () => {
    const release = getPaperRelease(R5_PAPER_VERSION);
    if (!release) throw new Error('The private-storage release is not bound.');
    const allowed = sessionClient(ALLOWED_USER);
    const structure = await loadPaperStructureForRequest(R5_PAPER_VERSION, allowed.client);
    expect(structure.releaseIdentity).toBe(paperReleaseIdentity(release));
    expect(structure.manifest.source).toEqual({ path: `presentation:${R5_PAPER_VERSION}`, version: R5_PAPER_VERSION, releaseIdentity: paperReleaseIdentity(release), bytes: release.bytes, sha256: release.sha256 });
    expect(structure.manifest.coverage).toEqual({ firstByte: 0, lastByteExclusive: release.bytes });
    expect(Buffer.byteLength(structure.content, 'utf8')).toBe(release.bytes);
    expect(sha(Buffer.from(structure.content, 'utf8'))).toBe(release.sha256);
    expect(structure.nodes).toHaveLength(340);
    expect(structure.manifest.counts.headings).toBe(340);
    expect(structure.nodes.filter((node) => node.depth === 1)).toHaveLength(98);
    // One compile per verified load, and storage was not needed. Each call looked the session up once, to name it.
    expect(await loadPaperStructureForRequest(R5_PAPER_VERSION, allowed.client)).toBe(structure);
    expect(fetchStub).not.toHaveBeenCalled();
    expect(allowed.getSession).toHaveBeenCalledTimes(2);
  }, 60_000);

  it('returns each of the 17 bound figures with its bound length and SHA-256', async () => {
    const contract = getAcceptedFiguresContract(R5_PAPER_VERSION);
    const reader = await requirePaperReader(sessionClient(ALLOWED_USER).client);
    const mismatched: string[] = [];
    for (const asset of contract?.assets ?? []) {
      const bytes = await loadPrivatePaperFigure(R5_PAPER_VERSION, asset.file, reader);
      if (!bytes || bytes.byteLength !== asset.bytes || sha(bytes) !== asset.sha256) mismatched.push(asset.id);
    }
    expect(contract?.assets).toHaveLength(17);
    expect(mismatched).toEqual([]);
    expect(await loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG0-0.png', reader)).toBeNull();
    expect(await loadPrivatePaperFigure(R5_PAPER_VERSION, 'presentation.md', reader)).toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
  }, 60_000);

  it.each([
    ['no user', null],
    ['an anonymous user', { id: 'reader-user-2', is_anonymous: true }],
    ['a user with no is_anonymous flag', { id: 'reader-user-2' }],
  ])('gives %s nothing, cold and warm', async (_title, user) => {
    const denied = sessionClient(user);
    const failure = (promise: Promise<unknown>): Promise<unknown> => promise.then(() => 'resolved', (error: unknown) => error);
    expect(await failure(loadPaperStructureForRequest(R5_PAPER_VERSION, denied.client))).toBeInstanceOf(PaperReaderDeniedError);
    const reader = await requirePaperReader(sessionClient(ALLOWED_USER).client);
    expect((await loadPrivatePaperStructure(R5_PAPER_VERSION, reader)).nodes).toHaveLength(340);
    expect(await failure(loadPaperStructureForRequest(R5_PAPER_VERSION, denied.client))).toBeInstanceOf(PaperReaderDeniedError);
    expect(await failure(loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG6-1.png', { userId: reader.userId } as unknown as PaperReader))).toBeInstanceOf(PaperReaderDeniedError);
    expect(fetchStub).not.toHaveBeenCalled();
  }, 60_000);
});

it('names the release the private suite loads', () => {
  expect(getPaperRelease(R5_PAPER_VERSION)?.delivery).toBe('private-storage');
});

describe('where the private suites run', () => {
  const DIRECTORY = path.resolve('a-synthetic-fixture-directory');

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // The helper decides once, when loaded: required mode authenticates before any suite runs.
  it.each([
    ['no directory and explicit skip', undefined, 'skip', null],
    ['a directory and explicit skip', DIRECTORY, 'skip', null],
    ['an unset local mode', DIRECTORY, undefined, 'MATRIX_PAPER_PRIVATE_FIXTURE must be required or skip for a local run'],
    ['required mode without a directory', undefined, 'required', 'MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR must be an absolute path in required mode'],
    ['required mode with a relative directory', 'relative/fixture', 'required', 'MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR must be an absolute path in required mode'],
    ['required mode with a nonexistent absolute directory', DIRECTORY, 'required', 'Required v0.9.91 presentation missing'],
  ])('%s', async (_title, directory, mode, expectedError) => {
    vi.resetModules();
    vi.stubEnv('GITHUB_ACTIONS', 'false');
    vi.stubEnv(PRIVATE_FIXTURE_DIR_ENV, directory);
    vi.stubEnv(PRIVATE_FIXTURE_MODE_ENV, mode);
    if (expectedError) {
      await expect(import('./private-fixture')).rejects.toThrow(expectedError);
    } else {
      const helper = await import('./private-fixture');
      expect(helper.privateFixtureAvailable).toBe(false);
      expect(helper.privateFixtureRequired).toBe(false);
    }
  });
});
