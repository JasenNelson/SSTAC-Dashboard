import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import type { NextRequest } from 'next/server';

const { getRateLimitHeadersMock, createAuthenticatedClientMock, getAuthenticatedUserMock, getUserMock } = vi.hoisted(() => ({
  getRateLimitHeadersMock: vi.fn(async (): Promise<{ response: unknown; headers: Record<string, string> }> => ({ response: null, headers: { 'X-RateLimit-Limit': '200' } })),
  createAuthenticatedClientMock: vi.fn(),
  getAuthenticatedUserMock: vi.fn(async (): Promise<unknown> => ({ id: '11111111-1111-4111-8111-111111111111' })),
  getUserMock: vi.fn(),
}));

vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getRateLimitHeaders: getRateLimitHeadersMock }));
vi.mock('@/lib/supabase-auth', () => ({ createAuthenticatedClient: createAuthenticatedClientMock, getAuthenticatedUser: getAuthenticatedUserMock }));

import { describePrivate, readPrivatePresentation } from '@/lib/matrix-options/paper/__tests__/private-fixture';
import { resetPrivateReleaseCacheForTests } from '@/lib/matrix-options/paper/private-release-assets';
import { getPaperRelease, R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { getPaperSectionWindowModel, validatePaperSectionContract } from '@/lib/matrix-options/paper/section-window';
import type { PaperSectionGroup } from '@/lib/matrix-options/paper/section-window';
import { describeAuthenticatedPaper, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { compileAuthenticatedRelease, loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { GET } from '../route';

/*
 * The section route serves each bound release from that release's own
 * authenticated structure, on the REAL loaders (the sibling route.test.ts covers
 * the gate, the session rules and the failure paths with stand-ins).
 *
 * The predecessor's bytes are in the repository, so its suite always runs. R5 is
 * a private-storage release: its suite reads the private fixture through the
 * real boundary and is skipped by name where there is no fixture. That suite
 * asserts counts, ids and booleans only.
 */

const READER_ID = '11111111-1111-4111-8111-111111111111';
const r5Release = getPaperRelease(R5_PAPER_VERSION)!;
const r5Sha = r5Release.sha256;
const predecessorSha = getPaperRelease(REVISED_PAPER_VERSION)!.sha256;
const predecessorGroups = getPaperSectionWindowModel(loadRevisedPaperStructure(REVISED_PAPER_VERSION)).groups;
const ALLOWED = { data: { user: { id: READER_ID, is_anonymous: false } }, error: null };

function call(version: string, anchor: string, paperSha: string | null) {
  const query = paperSha === null ? '' : `?paper=${paperSha}`;
  const request = new Request(`https://example.test/api/matrix-options/paper/v/${encodeURIComponent(version)}/sections/${encodeURIComponent(anchor)}${query}`) as unknown as NextRequest;
  return GET(request, { params: Promise.resolve({ documentVersion: version, sectionAnchor: encodeURIComponent(anchor) }) });
}

/** Every string anywhere in a value. */
function allStrings(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  return (Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)).flatMap((entry) => allStrings(entry, seen));
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

describe('section route: the predecessor under its own identity', () => {
  it('has 17 top-level sections and its own paper hash', () => {
    expect(predecessorGroups).toHaveLength(17);
    expect(r5Sha).not.toBe(predecessorSha);
  });

  it('still serves the predecessor sections under the predecessor identity', async () => {
    for (const group of predecessorGroups) {
      const response = await call(REVISED_PAPER_VERSION, group.anchor, predecessorSha);
      expect(response.status).toBe(200);
      const contract = validatePaperSectionContract(await response.json(), { documentVersion: REVISED_PAPER_VERSION, paperSha256: predecessorSha, index: group.index, anchor: group.anchor, sectionCount: 17 });
      expect(contract.chunks.map((chunk) => chunk.markdown).join('\n')).not.toContain('MATRIX_FIGURE_PLACEMENT');
    }
    // Its session rule is the default one: the private reader check is never run for it.
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('refuses (409) the predecessor named with the other release paper hash', async () => {
    const response = await call(REVISED_PAPER_VERSION, predecessorGroups[0].anchor, r5Sha);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Paper release mismatch' });
  });

  it('refuses (409) R5 named with the predecessor paper hash, or with none, before anything is read', async () => {
    for (const hash of [predecessorSha, null]) {
      const response = await call(R5_PAPER_VERSION, predecessorGroups[0].anchor, hash);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'Paper release mismatch' });
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('returns 404 for a version that is not a bound release, whatever hash it names', async () => {
    for (const version of ['some-other-version', `${R5_PAPER_VERSION}x`, R5_PAPER_VERSION.toUpperCase(), 'v0.9.88-run106-r4-c1-c3-001', '']) {
      const response = await call(version, predecessorGroups[0].anchor, r5Sha);
      expect(response.status).toBe(404);
    }
  });
});

describePrivate('section route: R5 on the real private bytes, through the real boundary (private fixture)', () => {
  let r5Groups: readonly PaperSectionGroup[];

  beforeAll(() => {
    resetPrivateReleaseCacheForTests();
    // The expected sections, compiled here from the fixture by the same pure compile the loader ends in.
    r5Groups = getPaperSectionWindowModel(compileAuthenticatedRelease(describeAuthenticatedPaper(r5Release, readPrivatePresentation()))).groups;
  });

  afterAll(() => {
    resetPrivateReleaseCacheForTests();
  });

  it('has 98 top-level sections', () => {
    expect(r5Groups.length).toBe(98);
  });

  it('serves every R5 section as a contract bound to the R5 version and paper hash', async () => {
    let served = 0;
    let figureBlocks = 0;
    let rawSource = 0;
    let withheldIdMentions = 0;
    for (const group of r5Groups) {
      const response = await call(R5_PAPER_VERSION, group.anchor, r5Sha);
      if (response.status !== 200 || response.headers.get('Cache-Control') !== 'no-store') continue;
      const contract = validatePaperSectionContract(await response.json(), { documentVersion: R5_PAPER_VERSION, paperSha256: r5Sha, index: group.index, anchor: group.anchor, sectionCount: 98 });
      served += 1;
      for (const chunk of contract.chunks) {
        figureBlocks += chunk.markdown.split('MATRIX_FIGURE_PLACEMENT: ').length - 1;
        // No YAML front matter and no pandoc fence reaches the reader.
        if (/^:::/m.test(chunk.markdown) || /^(?:title|subtitle|author|date|lang): /m.test(chunk.markdown)) rawSource += 1;
      }
      withheldIdMentions += allStrings(contract).filter((value) => value.includes('app-l')).length;
    }
    expect(served).toBe(98);
    // All twenty placements are delivered, each once, across the section contracts.
    expect(figureBlocks).toBe(20);
    expect(rawSource).toBe(0);
    // The section the release withholds is named in no response.
    expect(withheldIdMentions).toBe(0);
    expect(consoleError).not.toHaveBeenCalled();
    // One user check per request, and the release was read once for all of them.
    expect(getUserMock).toHaveBeenCalledTimes(98);
    expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
  });

  it('answers 404 for the stable id of the withheld section and for an unknown anchor, and 200 for the last presented section', async () => {
    for (const anchor of ['app-l', 'not-a-section']) {
      const response = await call(R5_PAPER_VERSION, anchor, r5Sha);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    }
    expect((await call(R5_PAPER_VERSION, r5Groups[r5Groups.length - 1].anchor, r5Sha)).status).toBe(200);
    // The last section ends where the release ends: nothing lies past it.
    expect(r5Groups[r5Groups.length - 1].endByte).toBe(r5Release.bytes);
  });

  it('refuses (409) R5 named with the predecessor paper hash', async () => {
    const response = await call(R5_PAPER_VERSION, r5Groups[0].anchor, predecessorSha);
    expect(response.status).toBe(409);
    expect((await call(R5_PAPER_VERSION, r5Groups[0].anchor, null)).status).toBe(409);
  });

  it('never resolves a section of one release under the other release', async () => {
    const predecessorAnchors = new Set(predecessorGroups.map((group) => group.anchor));
    const r5Only = r5Groups.find((group) => !predecessorAnchors.has(group.anchor));
    expect(r5Only !== undefined).toBe(true);
    const response = await call(REVISED_PAPER_VERSION, r5Only!.anchor, predecessorSha);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it.each([
    ['no user', { data: { user: null }, error: null }],
    ['a user check that errored', { data: { user: { id: READER_ID, is_anonymous: false } }, error: new Error('session check failed') }],
    ['an anonymous user', { data: { user: { id: READER_ID, is_anonymous: true } }, error: null }],
    ['a user with no is_anonymous flag', { data: { user: { id: READER_ID } }, error: null }],
  ])('with the release already in memory, %s gets 401 from every section', async (_name, user) => {
    // Warm the real cache with an allowed reader.
    expect((await call(R5_PAPER_VERSION, r5Groups[0].anchor, r5Sha)).status).toBe(200);
    getUserMock.mockResolvedValue(user);
    let unauthorized = 0;
    for (const group of [r5Groups[0], r5Groups[1], r5Groups[r5Groups.length - 1]]) {
      const response = await call(R5_PAPER_VERSION, group.anchor, r5Sha);
      if (response.status === 401 && JSON.stringify(await response.json()) === JSON.stringify({ error: 'Unauthorized' }) && response.headers.get('Cache-Control') === 'no-store') unauthorized += 1;
    }
    expect(unauthorized).toBe(3);
    // Two-sided: the allowed reader is still served from the same cache.
    getUserMock.mockResolvedValue(ALLOWED);
    expect((await call(R5_PAPER_VERSION, r5Groups[0].anchor, r5Sha)).status).toBe(200);
  });
});
