import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import type { NextRequest } from 'next/server';

const { getRateLimitHeadersMock, createAuthenticatedClientMock, getAuthenticatedUserMock, structureMock } = vi.hoisted(() => ({
  getRateLimitHeadersMock: vi.fn(async (): Promise<{ response: unknown; headers: Record<string, string> }> => ({ response: null, headers: { 'X-RateLimit-Limit': '200' } })),
  createAuthenticatedClientMock: vi.fn(async () => ({})),
  getAuthenticatedUserMock: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111' })),
  structureMock: vi.fn(),
}));

vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getRateLimitHeaders: getRateLimitHeadersMock }));
vi.mock('@/lib/supabase-auth', () => ({ createAuthenticatedClient: createAuthenticatedClientMock, getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('@/lib/matrix-options/revised-paper-structure', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
  return { ...actual, loadRevisedPaperStructure: structureMock };
});

import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { validatePaperSectionContract } from '@/lib/matrix-options/paper/section-window';
import { GET } from '../route';

const VERSION = '1.0.11-remediated-20260913';
const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

function synthetic(lines: readonly string[], anchorFor: (index: number) => string = (index) => `a-${index}`, sha = 'a'.repeat(64)): RevisedPaperStructure {
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
  return { content, nodes, manifest: { source: { version: VERSION, sha256: sha } } } as unknown as RevisedPaperStructure;
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
    const contract = validatePaperSectionContract(body, { documentVersion: VERSION, paperSha256: realSha, index: 0, anchor: realFirstAnchor, sectionCount: 16 });
    expect(contract.chunks.length).toBeGreaterThan(1);
    expect(contract.startByte).toBe(0);
    expect(contract.endByte).toBeLessThan(534101);
    expect(JSON.stringify(body)).not.toContain('"layout"');
    expect(getAuthenticatedUserMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['workspace flag off', () => { delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE; }],
    ['review navigation flag off', () => { delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION; }],
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
});
