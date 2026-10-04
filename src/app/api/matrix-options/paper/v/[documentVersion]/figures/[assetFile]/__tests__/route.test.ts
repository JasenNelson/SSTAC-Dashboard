import { createHash } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import type { NextRequest } from 'next/server';

const { getRateLimitHeadersMock, createAuthenticatedClientMock, getAuthenticatedUserMock, getUserMock, figureSpy } = vi.hoisted(() => ({
  getRateLimitHeadersMock: vi.fn(async (): Promise<{ response: unknown; headers: Record<string, string> }> => ({ response: null, headers: { 'X-RateLimit-Limit': '200' } })),
  createAuthenticatedClientMock: vi.fn(),
  getAuthenticatedUserMock: vi.fn(async (): Promise<unknown> => ({ id: '11111111-1111-4111-8111-111111111111' })),
  getUserMock: vi.fn(),
  figureSpy: vi.fn(),
}));

vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getRateLimitHeaders: getRateLimitHeadersMock }));
vi.mock('@/lib/supabase-auth', () => ({ createAuthenticatedClient: createAuthenticatedClientMock, getAuthenticatedUser: getAuthenticatedUserMock }));
// The real figure loader behind a spy. The always-run suites stand bytes or a failure in for
// it (the private bytes are not in the repository); the private-fixture suite lets it run.
vi.mock('@/lib/matrix-options/paper/paper-request-loader', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
  figureSpy.mockImplementation(actual.loadPrivatePaperFigure);
  return { ...actual, loadPrivatePaperFigure: figureSpy };
});

import { describePrivate } from '@/lib/matrix-options/paper/__tests__/private-fixture';
import { acceptedFigureAssetHref, getAcceptedFiguresContract } from '@/lib/matrix-options/paper/accepted-figures';
import { PaperReaderDeniedError, PrivateReleaseUnavailableError, resetPrivateReleaseCacheForTests } from '@/lib/matrix-options/paper/private-release-assets';
import { getPaperRelease, R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { GET } from '../route';

/*
 * The figures of a private-storage release are served only to a signed-in,
 * non-anonymous reader, and only as bytes the private release boundary verified.
 *
 * - Always-run suites: the guard and its order, the identity checks that happen
 *   before any read, the response headers, and every failure, with stand-in bytes
 *   where the loader would return some.
 * - Private-fixture suite: every bound asset through the real boundary, compared
 *   by length and SHA-256 with the contract.
 */

const READER_ID = '11111111-1111-4111-8111-111111111111';
const contract = getAcceptedFiguresContract(R5_PAPER_VERSION)!;
const first = contract.assets[0];
const second = contract.assets[1];
const ALLOWED = { data: { user: { id: READER_ID, is_anonymous: false } }, error: null };
const DENIED: readonly (readonly [string, unknown])[] = [
  ['no user', { data: { user: null }, error: null }],
  ['a user check that errored', { data: { user: { id: READER_ID, is_anonymous: false } }, error: new Error('session check failed') }],
  ['an anonymous user', { data: { user: { id: READER_ID, is_anonymous: true } }, error: null }],
  ['a user with no is_anonymous flag', { data: { user: { id: READER_ID } }, error: null }],
];
/** Stand-in bytes: the route sends what the boundary hands it, so any bytes show the plumbing. */
const STAND_IN = Buffer.from('stand-in figure bytes, not a real image');

function call(file: string, query: string, version: string = R5_PAPER_VERSION, headers: Record<string, string> = {}) {
  const request = new Request(`https://example.test/api/matrix-options/paper/v/${encodeURIComponent(version)}/figures/${file}${query}`, { headers }) as unknown as NextRequest;
  return GET(request, { params: Promise.resolve({ documentVersion: version, assetFile: file }) });
}

/** The request headers of a plain request and of one that presents the asset's own validator. */
function withAndWithoutValidator(sha256: string): readonly Record<string, string>[] {
  return [{}, { 'If-None-Match': `"${sha256}"` }];
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  getRateLimitHeadersMock.mockResolvedValue({ response: null, headers: { 'X-RateLimit-Limit': '200' } });
  getAuthenticatedUserMock.mockResolvedValue({ id: READER_ID });
  getUserMock.mockResolvedValue(ALLOWED);
  // A synthetic session token: the boundary admits each session by its token; real storage is never reached here.
  createAuthenticatedClientMock.mockImplementation(async () => ({ auth: { getUser: getUserMock, getSession: async () => ({ data: { session: { access_token: 'synthetic-session-token-for-tests' } }, error: null }) } }));
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
  process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('GET /api/matrix-options/paper/v/[documentVersion]/figures/[assetFile]', () => {
  beforeEach(() => {
    figureSpy.mockResolvedValue(STAND_IN);
  });

  it('binds what these tests rely on: seventeen assets of a private-storage release', () => {
    expect(contract.assets).toHaveLength(17);
    expect(contract.releaseIdentity).toBe(R5_PAPER_VERSION);
    expect(getPaperRelease(R5_PAPER_VERSION)?.delivery).toBe('private-storage');
  });

  it('serves each bound asset as the bytes the boundary returned, cached privately and revalidated on every use', async () => {
    for (const asset of contract.assets) {
      const response = await call(asset.file, `?sha256=${asset.sha256}`);
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer()).equals(STAND_IN)).toBe(true);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('Content-Length')).toBe(String(STAND_IN.byteLength));
      expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
      expect(response.headers.get('ETag')).toBe(`"${asset.sha256}"`);
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Content-Disposition')).toBe(`inline; filename="${asset.file}"`);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
    }
    // One user check per request, by the reader rule; the default-rule check is never used here.
    expect(getUserMock).toHaveBeenCalledTimes(17);
    expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(figureSpy).toHaveBeenCalledTimes(17);
    for (const [index, asset] of contract.assets.entries()) {
      expect(figureSpy.mock.calls[index][0]).toBe(R5_PAPER_VERSION);
      expect(figureSpy.mock.calls[index][1]).toBe(asset.file);
      // The loader is handed the reader the guard issued for this request.
      expect(figureSpy.mock.calls[index][2]).toMatchObject({ userId: READER_ID });
    }
    expect(getRateLimitHeadersMock).toHaveBeenCalledWith(expect.anything(), READER_ID, expect.objectContaining({ max: 200 }));
  });

  it('is the address the reader builds for a bound figure', async () => {
    const href = acceptedFigureAssetHref({ releaseIdentity: R5_PAPER_VERSION, asset: first });
    expect(href).toBe(`/api/matrix-options/paper/v/${R5_PAPER_VERSION}/figures/${first.file}?sha256=${first.sha256}`);
    const url = new URL(href, 'https://example.test');
    const response = await call(url.pathname.split('/').pop() as string, url.search);
    expect(response.status).toBe(200);
  });

  it.each([
    ['workspace flag off', () => { process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'false'; }],
    ['review navigation flag off', () => { process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'false'; }],
  ])('returns 404 with %s and never reads the session or a figure', async (_name, disable) => {
    disable();
    const response = await call(first.file, `?sha256=${first.sha256}`);
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(createAuthenticatedClientMock).not.toHaveBeenCalled();
    expect(figureSpy).not.toHaveBeenCalled();
  });

  it.each(DENIED)('%s: 401, and neither the rate limiter nor the loader is reached', async (_name, user) => {
    getUserMock.mockResolvedValue(user);
    const response = await call(first.file, `?sha256=${first.sha256}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getRateLimitHeadersMock).not.toHaveBeenCalled();
    expect(figureSpy).not.toHaveBeenCalled();
  });

  it('a user check that throws is a 401 too', async () => {
    getUserMock.mockRejectedValue(new Error('network'));
    expect((await call(first.file, `?sha256=${first.sha256}`)).status).toBe(401);
    expect(figureSpy).not.toHaveBeenCalled();
  });

  it.each(DENIED)('after an allowed reader has been served, %s is still 401, with or without a validator: the guard runs before anything cached could answer', async (_name, user) => {
    expect((await call(first.file, `?sha256=${first.sha256}`)).status).toBe(200);
    expect(figureSpy).toHaveBeenCalledTimes(1);
    getUserMock.mockResolvedValue(user);
    for (const headers of withAndWithoutValidator(first.sha256)) {
      const response = await call(first.file, `?sha256=${first.sha256}`, R5_PAPER_VERSION, headers);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    }
    expect(figureSpy).toHaveBeenCalledTimes(1);
    // Two-sided: the allowed reader is served again.
    getUserMock.mockResolvedValue(ALLOWED);
    expect((await call(first.file, `?sha256=${first.sha256}`)).status).toBe(200);
  });

  it('a session-less request with a wrong asset hash is 401, not 409: the session is decided first', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    expect((await call(first.file, `?sha256=${'b'.repeat(64)}`)).status).toBe(401);
  });

  it('returns the rate limiter 429 (no-store) after the reader check and never reads a figure', async () => {
    const limited = new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    getRateLimitHeadersMock.mockResolvedValue({ response: limited as never, headers: {} });
    const response = await call(first.file, `?sha256=${first.sha256}`);
    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(figureSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['the predecessor release, which has no accepted figures', REVISED_PAPER_VERSION],
    ['an unknown release', 'some-other-version'],
  ])('returns 404 for %s, under the default session rule', async (_name, version) => {
    const response = await call(first.file, `?sha256=${first.sha256}`, version);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(figureSpy).not.toHaveBeenCalled();
    // The reader rule belongs to the private release only.
    expect(getUserMock).not.toHaveBeenCalled();
    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an unbound file name', 'FIG9-9.png'],
    ['a bound name in another case', first.file.toLowerCase()],
    ['a bound name without its extension', first.id],
    ['a parent-directory traversal', '..%2F..%2F..%2Fpackage.json'],
    ['a backslash traversal', '..%5C..%5Cpackage.json'],
    ['a bound name with a trailing NUL', `${first.file}%00`],
    ['a bound name inside a sub-path', `x%2F${first.file}`],
    ['the Markdown object of the release', 'presentation.md'],
    ['malformed percent-encoding', '%E0%A4%A'],
  ])('returns 404 for %s and never asks for a figure', async (_name, file) => {
    const response = await call(file, `?sha256=${first.sha256}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(figureSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing sha256', ''],
    ['a stale sha256', `?sha256=${'b'.repeat(64)}`],
    ['the sha256 of a different bound asset', `?sha256=${second.sha256}`],
    ['an upper-case sha256', `?sha256=${first.sha256.toUpperCase()}`],
  ])('returns 409 for %s BEFORE any load: the hash is compared with the hash bound in the contract', async (_name, query) => {
    const response = await call(first.file, query);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Figure release mismatch' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(figureSpy).not.toHaveBeenCalled();
  });

  it('answers a matching If-None-Match with 304 and no body, only after the release was loaded and verified again', async () => {
    const response = await call(first.file, `?sha256=${first.sha256}`, R5_PAPER_VERSION, { 'If-None-Match': `"${first.sha256}"` });
    expect(response.status).toBe(304);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
    expect(response.headers.get('ETag')).toBe(`"${first.sha256}"`);
    expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(figureSpy).toHaveBeenCalledTimes(1);
    // Two-sided: another validator gets the bytes.
    const full = await call(first.file, `?sha256=${first.sha256}`, R5_PAPER_VERSION, { 'If-None-Match': `"${second.sha256}"` });
    expect(full.status).toBe(200);
  });

  it('returns 404 when the verified release holds no such figure', async () => {
    figureSpy.mockResolvedValue(null);
    const response = await call(first.file, `?sha256=${first.sha256}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(['SESSION', 'STATUS', 'LENGTH', 'SHA256', 'IMAGE_FORM', 'DEADLINE', 'STRUCTURE'] as const)('a release that is unavailable (%s) is a constant 503, no-store, and never a 304', async (code) => {
    figureSpy.mockRejectedValue(new PrivateReleaseUnavailableError(code));
    for (const headers of withAndWithoutValidator(first.sha256)) {
      const response = await call(first.file, `?sha256=${first.sha256}`, R5_PAPER_VERSION, headers);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'Paper release unavailable', code: 'PRIVATE_RELEASE_UNAVAILABLE' });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('ETag')).toBeNull();
    }
  });

  it('a loader that refuses the reader is a 401, and an unexpected error is rethrown', async () => {
    figureSpy.mockRejectedValue(new PaperReaderDeniedError());
    const denied = await call(first.file, `?sha256=${first.sha256}`);
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ error: 'Unauthorized' });
    figureSpy.mockRejectedValue(new TypeError('bytes is not a function'));
    await expect(call(first.file, `?sha256=${first.sha256}`)).rejects.toThrow(TypeError);
  });
});

describePrivate('figures of R5 on the real private bytes, through the real boundary (private fixture)', () => {
  beforeAll(() => {
    resetPrivateReleaseCacheForTests();
  });

  afterAll(() => {
    resetPrivateReleaseCacheForTests();
  });

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
    figureSpy.mockImplementation(actual.loadPrivatePaperFigure);
  });

  it('serves every accepted asset as its exact bound PNG bytes', async () => {
    let exact = 0;
    for (const asset of contract.assets) {
      const response = await call(asset.file, `?sha256=${asset.sha256}`);
      if (response.status !== 200) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      const same = bytes.byteLength === asset.bytes
        && createHash('sha256').update(bytes).digest('hex') === asset.sha256
        && response.headers.get('Content-Length') === String(asset.bytes)
        && response.headers.get('Content-Type') === 'image/png'
        && response.headers.get('ETag') === `"${asset.sha256}"`
        // The PNG's own header carries the bound pixel size.
        && bytes.readUInt32BE(16) === asset.width && bytes.readUInt32BE(20) === asset.height;
      if (same) exact += 1;
    }
    expect(exact).toBe(17);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('answers a matching If-None-Match with 304 and no body', async () => {
    const response = await call(first.file, `?sha256=${first.sha256}`, R5_PAPER_VERSION, { 'If-None-Match': `"${first.sha256}"` });
    expect(response.status).toBe(304);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it.each(DENIED)('with the release already in memory, %s gets 401 and no byte', async (_name, user) => {
    // Warm the real cache with an allowed reader.
    expect((await call(first.file, `?sha256=${first.sha256}`)).status).toBe(200);
    getUserMock.mockResolvedValue(user);
    let unauthorized = 0;
    for (const asset of [first, second, contract.assets[contract.assets.length - 1]]) {
      for (const headers of withAndWithoutValidator(asset.sha256)) {
        const response = await call(asset.file, `?sha256=${asset.sha256}`, R5_PAPER_VERSION, headers);
        if (response.status === 401 && JSON.stringify(await response.json()) === JSON.stringify({ error: 'Unauthorized' }) && response.headers.get('Cache-Control') === 'no-store') unauthorized += 1;
      }
    }
    expect(unauthorized).toBe(6);
    // Two-sided: the allowed reader is still served from the same cache.
    getUserMock.mockResolvedValue(ALLOWED);
    expect((await call(first.file, `?sha256=${first.sha256}`)).status).toBe(200);
  });
});
