import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import type { NextRequest } from 'next/server';

const { getRateLimitHeadersMock, createAuthenticatedClientMock, getAuthenticatedUserMock, structureMock, privateStructureMock, getUserMock } = vi.hoisted(() => ({
  getRateLimitHeadersMock: vi.fn(async (): Promise<{ response: unknown; headers: Record<string, string> }> => ({ response: null, headers: { 'X-RateLimit-Limit': '200' } })),
  createAuthenticatedClientMock: vi.fn(async (): Promise<unknown> => ({})),
  getAuthenticatedUserMock: vi.fn(async (): Promise<unknown> => ({ id: '11111111-1111-4111-8111-111111111111' })),
  structureMock: vi.fn(),
  privateStructureMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getRateLimitHeaders: getRateLimitHeadersMock }));
vi.mock('@/lib/supabase-auth', () => ({ createAuthenticatedClient: createAuthenticatedClientMock, getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('@/lib/matrix-options/revised-paper-structure', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
  return { ...actual, loadRevisedPaperStructure: structureMock };
});
// The private release's bytes are not in the repository. Its loader is replaced here; the reader
// check in front of it (requirePaperReader) is the real one.
vi.mock('@/lib/matrix-options/paper/paper-request-loader', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
  return { ...actual, loadPrivatePaperStructure: privateStructureMock };
});

import { PaperReaderDeniedError, PrivateReleaseUnavailableError } from '@/lib/matrix-options/paper/private-release-assets';
import { getPaperRelease, R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { validatePaperSectionContract } from '@/lib/matrix-options/paper/section-window';
import { GET } from '../route';

const VERSION = '1.0.11-remediated-7-8-successor-20260918-D';
const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

function synthetic(lines: readonly string[], anchorFor: (index: number) => string = (index) => `a-${index}`, sha = 'a'.repeat(64), version: string = VERSION): RevisedPaperStructure {
  const content = lines.join('\n');
  const nodes: Record<string, unknown>[] = [];
  let offset = 0;
  lines.forEach((line, index) => {
    const match = /^(#{1,6}) (.+)$/.exec(line);
    if (match) {
      const startByte = byteLength(content.slice(0, offset));
      nodes.push({ id: `node:${index}`, domain: 'node', kind: 'heading', depth: match[1].length, label: match[2], parentId: null, ancestorIds: [], tokenEndByte: startByte + byteLength(line), anchor: anchorFor(index), startByte, endByte: startByte + byteLength(line) });
    }
    offset += line.length + 1;
  });
  return { content, nodes, manifest: { source: { version, sha256: sha } } } as unknown as RevisedPaperStructure;
}

function call(anchor: string, query = '', version = VERSION) {
  const request = new Request(`https://example.test/api/matrix-options/paper/v/${version}/sections/${anchor}${query}`) as unknown as NextRequest;
  return GET(request, { params: Promise.resolve({ documentVersion: version, sectionAnchor: anchor }) });
}

let consoleError: MockInstance<typeof console.error>;
let realStructure: RevisedPaperStructure;
let realSha: string;
let realFirstAnchor: string;
let realDepthTwoAnchor: string;

describe('GET /api/matrix-options/paper/v/[documentVersion]/sections/[sectionAnchor]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // The module under test is mocked, so the real release comes from importActual.
    const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
    realStructure = actual.loadRevisedPaperStructure();
    realSha = realStructure.manifest.source.sha256;
    realFirstAnchor = realStructure.nodes.find((node) => node.depth === 1)?.anchor ?? '';
    realDepthTwoAnchor = realStructure.nodes.find((node) => node.depth === 2)?.anchor ?? '';
    structureMock.mockReturnValue(realStructure as never);
    getRateLimitHeadersMock.mockResolvedValue({ response: null, headers: { 'X-RateLimit-Limit': '200' } });
    getAuthenticatedUserMock.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('serves one authenticated section as a no-store JSON contract the client accepts', async () => {
    const response = await call(realFirstAnchor, `?paper=${realSha}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await response.json();
    const contract = validatePaperSectionContract(body, { documentVersion: VERSION, paperSha256: realSha, index: 0, anchor: realFirstAnchor, sectionCount: 17 });
    expect(contract.chunks.length).toBeGreaterThan(1);
    expect(contract.startByte).toBe(0);
    expect(contract.endByte).toBeLessThan(541959);
    expect(JSON.stringify(body)).not.toContain('"layout"');
    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['workspace flag off', () => { process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'false'; }],
    ['review navigation flag off', () => { process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'false'; }],
  ])('returns 404 with %s and never loads the paper or the session', async (_name, disable) => {
    disable();
    const response = await call(realFirstAnchor, `?paper=${realSha}`);
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(createAuthenticatedClientMock).not.toHaveBeenCalled();
    expect(structureMock).not.toHaveBeenCalled();
  });

  it('returns 401 without an authenticated user and never loads the paper', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null as never);
    const response = await call(realFirstAnchor, `?paper=${realSha}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getRateLimitHeadersMock).not.toHaveBeenCalled();
    expect(structureMock).not.toHaveBeenCalled();
  });

  it('returns the rate limiter 429 (no-store) after authentication', async () => {
    const limited = new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    getRateLimitHeadersMock.mockResolvedValue({ response: limited as never, headers: {} });
    const response = await call(realFirstAnchor, `?paper=${realSha}`);
    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getRateLimitHeadersMock).toHaveBeenCalledWith(expect.anything(), '11111111-1111-4111-8111-111111111111', expect.objectContaining({ max: 200 }));
    expect(structureMock).not.toHaveBeenCalled();
  });

  it('returns 404 for another document version', async () => {
    const response = await call(realFirstAnchor, `?paper=${realSha}`, 'some-other-version');
    expect(response.status).toBe(404);
    expect(structureMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing paper parameter', ''],
    ['a stale paper SHA-256', `?paper=${'b'.repeat(64)}`],
  ])('returns 409 for %s', async (_name, query) => {
    const response = await call(realFirstAnchor, query);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Paper release mismatch' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    ['an unknown anchor', () => 'not-a-real-anchor'],
    ['a depth-2 anchor', () => realDepthTwoAnchor],
  ])('returns 404 for %s', async (_name, anchorOf) => {
    const response = await call(anchorOf(), `?paper=${realSha}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('resolves a percent-encoded section anchor', async () => {
    const structure = synthetic(['# One two', 'body', '# Second', 'more'], (index) => (index === 0 ? 'one two' : `a-${index}`));
    structureMock.mockReturnValue(structure as never);
    const response = await call('one%20two', `?paper=${'a'.repeat(64)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).anchor).toBe('one two');
  });

  it('fails closed with a logged reason code when the section window cannot be derived', async () => {
    structureMock.mockReturnValue(synthetic(['## Only a deep heading', 'body']) as never);
    const response = await call('a-0', `?paper=${'a'.repeat(64)}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expect(consoleError).toHaveBeenCalledWith('[matrix-options-paper] section route unavailable: PAPER_SECTION_UNAVAILABLE');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('depth-1');
  });

  it('rethrows unexpected errors instead of converting them to a 404', async () => {
    structureMock.mockImplementation(() => { throw new TypeError('structure is not a function'); });
    await expect(call(realFirstAnchor, `?paper=${realSha}`)).rejects.toThrow(TypeError);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('rethrows an unexpected error raised while building the section contract', async () => {
    // A programming defect inside the guarded block (nodes is not iterable) must not
    // be laundered into a 404 by the expected-failure classifier.
    structureMock.mockReturnValue({ ...synthetic(['# One', 'body']), nodes: {} } as never);
    await expect(call('a-0', `?paper=${'a'.repeat(64)}`)).rejects.toThrow(TypeError);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([
    ['an anonymous session', { id: '22222222-2222-4222-8222-222222222222', is_anonymous: true }],
    ['a session with no is_anonymous flag', { id: '22222222-2222-4222-8222-222222222222' }],
  ])('default release: still serves any signed-in session (%s), and never consults the private reader rule', async (_name, user) => {
    getAuthenticatedUserMock.mockResolvedValue(user);
    const response = await call(realFirstAnchor, `?paper=${realSha}`);
    expect(response.status).toBe(200);
    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).not.toHaveBeenCalled();
    expect(privateStructureMock).not.toHaveBeenCalled();
  });
});

describe('GET sections of a private-storage release: the reader guard, its order and its failures', () => {
  const READER_ID = '33333333-3333-4333-8333-333333333333';
  const release = getPaperRelease(R5_PAPER_VERSION)!;
  const ALLOWED = { data: { user: { id: READER_ID, is_anonymous: false } }, error: null };
  const DENIED: readonly (readonly [string, unknown])[] = [
    ['no user', { data: { user: null }, error: null }],
    ['a user check that errored', { data: { user: { id: READER_ID, is_anonymous: false } }, error: new Error('session check failed') }],
    ['an anonymous user', { data: { user: { id: READER_ID, is_anonymous: true } }, error: null }],
    ['a user with no is_anonymous flag', { data: { user: { id: READER_ID } }, error: null }],
  ];
  // Stands in for the verified release: the same identity (version and bound hash), synthetic text.
  const structure = synthetic(['# One', 'body one', '# Two', 'body two'], (index) => `p-${index}`, release.sha256, R5_PAPER_VERSION);
  const good = `?paper=${release.sha256}`;
  const privateCall = (anchor: string, query: string) => call(anchor, query, R5_PAPER_VERSION);

  beforeEach(() => {
    vi.clearAllMocks();
    getRateLimitHeadersMock.mockResolvedValue({ response: null, headers: { 'X-RateLimit-Limit': '200' } });
    getUserMock.mockResolvedValue(ALLOWED);
    createAuthenticatedClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
    privateStructureMock.mockResolvedValue(structure);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  });

  afterEach(() => {
    consoleError.mockRestore();
    createAuthenticatedClientMock.mockResolvedValue({});
  });

  it('binds what these tests rely on: the release is private storage', () => {
    expect(release.delivery).toBe('private-storage');
    expect(release.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('serves a section to a signed-in, non-anonymous reader: one user check, and the loader gets the reader that check issued', async () => {
    const response = await privateCall('p-0', good);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
    const contract = validatePaperSectionContract(await response.json(), { documentVersion: R5_PAPER_VERSION, paperSha256: release.sha256, index: 0, anchor: 'p-0', sectionCount: 2 });
    expect(contract.chunks.length).toBeGreaterThan(0);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(getRateLimitHeadersMock).toHaveBeenCalledWith(expect.anything(), READER_ID, expect.objectContaining({ max: 200 }));
    expect(privateStructureMock).toHaveBeenCalledTimes(1);
    expect(privateStructureMock.mock.calls[0][0]).toBe(R5_PAPER_VERSION);
    expect(privateStructureMock.mock.calls[0][1]).toMatchObject({ userId: READER_ID });
    // The repository loader is never asked for a private release.
    expect(structureMock).not.toHaveBeenCalled();
  });

  it.each(DENIED)('%s: 401, and neither the rate limiter nor the loader is reached', async (_name, user) => {
    getUserMock.mockResolvedValue(user);
    const response = await privateCall('p-0', good);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getRateLimitHeadersMock).not.toHaveBeenCalled();
    expect(privateStructureMock).not.toHaveBeenCalled();
    expect(structureMock).not.toHaveBeenCalled();
  });

  it('a user check that throws is a 401 too', async () => {
    getUserMock.mockRejectedValue(new Error('network'));
    const response = await privateCall('p-0', good);
    expect(response.status).toBe(401);
    expect(privateStructureMock).not.toHaveBeenCalled();
  });

  it.each(DENIED)('after an allowed reader has been served, %s is still 401: the guard runs on every request, before anything cached could answer', async (_name, user) => {
    expect((await privateCall('p-0', good)).status).toBe(200);
    expect(privateStructureMock).toHaveBeenCalledTimes(1);
    getUserMock.mockResolvedValue(user);
    for (const anchor of ['p-0', 'p-2']) {
      const response = await privateCall(anchor, good);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    }
    expect(privateStructureMock).toHaveBeenCalledTimes(1);
    // Two-sided: the allowed reader is served again.
    getUserMock.mockResolvedValue(ALLOWED);
    expect((await privateCall('p-2', good)).status).toBe(200);
  });

  it('a session-less request with a wrong paper hash is 401, not 409: the session is decided first', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await privateCall('p-0', `?paper=${'b'.repeat(64)}`);
    expect(response.status).toBe(401);
  });

  it.each([
    ['a missing paper parameter', ''],
    ['a stale paper SHA-256', `?paper=${'b'.repeat(64)}`],
    ['the default release paper SHA-256', `?paper=${getPaperRelease(VERSION)!.sha256}`],
    ['the bound hash in upper case', `?paper=${release.sha256.toUpperCase()}`],
  ])('returns 409 for %s BEFORE any load: the hash is compared with the bound hash of the release entry', async (_name, query) => {
    const response = await privateCall('p-0', query);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Paper release mismatch' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(privateStructureMock).not.toHaveBeenCalled();
    expect(structureMock).not.toHaveBeenCalled();
  });

  it('returns the rate limiter 429 after the reader check and before any load', async () => {
    const limited = new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    getRateLimitHeadersMock.mockResolvedValue({ response: limited as never, headers: {} });
    const response = await privateCall('p-0', good);
    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(privateStructureMock).not.toHaveBeenCalled();
  });

  it.each(['SESSION', 'STATUS', 'SHA256', 'DEADLINE', 'STRUCTURE'] as const)('a release that is unavailable (%s) is a constant 503, no-store, with no detail', async (code) => {
    privateStructureMock.mockRejectedValue(new PrivateReleaseUnavailableError(code));
    const response = await privateCall('p-0', good);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Paper release unavailable', code: 'PRIVATE_RELEASE_UNAVAILABLE' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('a loader that refuses the reader is a 401, and an unexpected error is rethrown', async () => {
    privateStructureMock.mockRejectedValue(new PaperReaderDeniedError());
    const denied = await privateCall('p-0', good);
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ error: 'Unauthorized' });
    privateStructureMock.mockRejectedValue(new TypeError('assets is not iterable'));
    await expect(privateCall('p-0', good)).rejects.toThrow(TypeError);
  });

  it('keeps the checks that follow the load: an unknown anchor is 404, a structure under another hash is 409', async () => {
    const unknown = await privateCall('not-a-section', good);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'Not found' });
    privateStructureMock.mockResolvedValue(synthetic(['# One', 'body'], (index) => `p-${index}`, 'c'.repeat(64), R5_PAPER_VERSION));
    expect((await privateCall('p-0', good)).status).toBe(409);
  });

  it.each([
    ['workspace flag off', () => { process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'false'; }],
    ['review navigation flag off', () => { process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'false'; }],
  ])('returns 404 with %s before any session client', async (_name, disable) => {
    disable();
    const response = await privateCall('p-0', good);
    expect(response.status).toBe(404);
    expect(createAuthenticatedClientMock).not.toHaveBeenCalled();
    expect(privateStructureMock).not.toHaveBeenCalled();
  });
});
