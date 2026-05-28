import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkZoteroHealth,
  getZoteroItemByKey,
  searchZoteroByDOI,
  searchZoteroByTitle,
  type ZoteroHealthStatus,
  type ZoteroItem,
} from '../client';

// ---------------------------------------------------------------------------
// Helpers to build minimal Zotero API response envelopes
// ---------------------------------------------------------------------------

function makeItemEnvelope(overrides?: {
  key?: string;
  data?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    key: overrides?.key ?? 'TESTKEY1',
    data: {
      key: overrides?.key ?? 'TESTKEY1',
      itemType: 'journalArticle',
      title: 'Test Title',
      creators: [
        { firstName: 'Jane', lastName: 'Doe', creatorType: 'author' },
      ],
      date: '2024',
      publicationTitle: 'Test Journal',
      publisher: null,
      DOI: '10.1234/test',
      url: null,
      abstractNote: 'Abstract text.',
      collections: ['COLL1'],
      tags: [{ tag: 'sediment' }],
      ...(overrides?.data ?? {}),
    },
    meta: {
      numChildren: 0,
      ...(overrides?.meta ?? {}),
    },
  };
}

function makeAttachmentEnvelope(key: string): Record<string, unknown> {
  return {
    key,
    data: {
      key,
      itemType: 'attachment',
      title: 'Full Text PDF',
      contentType: 'application/pdf',
      filename: 'test.pdf',
      url: null,
    },
    meta: {},
  };
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(global, 'fetch');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// checkZoteroHealth
// ---------------------------------------------------------------------------

describe('checkZoteroHealth', () => {
  it('returns available: true with userId when Zotero responds 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse({ userID: 42 }),
    );

    const result: ZoteroHealthStatus = await checkZoteroHealth();

    expect(result.available).toBe(true);
    expect(result.userId).toBe(42);
    expect(result.error).toBeNull();
  });

  it('extracts userId from id field when userID is absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse({ id: 7 }),
    );

    const result = await checkZoteroHealth();

    expect(result.available).toBe(true);
    expect(result.userId).toBe(7);
  });

  it('returns available: false with error message on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new Error('Failed to fetch'),
    );

    const result = await checkZoteroHealth();

    expect(result.available).toBe(false);
    expect(result.userId).toBeNull();
    expect(result.error).toMatch(/Failed to fetch/);
  });

  it('returns available: false with error message on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse({}, 503));

    const result = await checkZoteroHealth();

    expect(result.available).toBe(false);
    expect(result.userId).toBeNull();
    expect(result.error).toMatch(/503/);
  });

  it('returns available: false when fetch is aborted (simulated timeout)', async () => {
    const abortError = new DOMException('The user aborted a request.', 'AbortError');
    vi.mocked(fetch).mockRejectedValueOnce(abortError);

    const result = await checkZoteroHealth();

    expect(result.available).toBe(false);
    expect(result.userId).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getZoteroItemByKey
// ---------------------------------------------------------------------------

describe('getZoteroItemByKey', () => {
  it('returns a mapped ZoteroItem on success (array envelope)', async () => {
    const envelope = makeItemEnvelope({ key: 'ABCD1234' });
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse([envelope]),
    );

    const item: ZoteroItem | null = await getZoteroItemByKey('ABCD1234');

    expect(item).not.toBeNull();
    expect(item!.key).toBe('ABCD1234');
    expect(item!.itemType).toBe('journalArticle');
    expect(item!.title).toBe('Test Title');
    expect(item!.creators).toHaveLength(1);
    expect(item!.creators[0].lastName).toBe('Doe');
    expect(item!.date).toBe('2024');
    expect(item!.publicationTitle).toBe('Test Journal');
    expect(item!.DOI).toBe('10.1234/test');
    expect(item!.collections).toEqual(['COLL1']);
    expect(item!.tags).toEqual([{ tag: 'sediment' }]);
    expect(item!.numChildren).toBe(0);
    expect(item!.attachments).toEqual([]);
  });

  it('returns a mapped ZoteroItem on success (single object envelope)', async () => {
    const envelope = makeItemEnvelope({ key: 'WXYZ5678' });
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(envelope),
    );

    const item = await getZoteroItemByKey('WXYZ5678');

    expect(item).not.toBeNull();
    expect(item!.key).toBe('WXYZ5678');
  });

  it('fetches child attachments when numChildren > 0', async () => {
    const envelope = makeItemEnvelope({
      key: 'PARENT01',
      meta: { numChildren: 1 },
    });
    const childEnvelope = makeAttachmentEnvelope('CHILD001');

    // First fetch: the item; second fetch: its children
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockFetchResponse([envelope]))
      .mockResolvedValueOnce(mockFetchResponse([childEnvelope]));

    const item = await getZoteroItemByKey('PARENT01');

    expect(item).not.toBeNull();
    expect(item!.numChildren).toBe(1);
    expect(item!.attachments).toHaveLength(1);
    expect(item!.attachments[0].key).toBe('CHILD001');
    expect(item!.attachments[0].itemType).toBe('attachment');
    expect(item!.attachments[0].filename).toBe('test.pdf');
  });

  it('returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse({}, 404));

    const item = await getZoteroItemByKey('MISSING1');

    expect(item).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));

    const item = await getZoteroItemByKey('NETFAIL1');

    expect(item).toBeNull();
  });

  it('returns null when response is an empty array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse([]));

    const item = await getZoteroItemByKey('EMPTY001');

    expect(item).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// searchZoteroByDOI
// ---------------------------------------------------------------------------

describe('searchZoteroByDOI', () => {
  it('returns mapped items when the search returns results', async () => {
    const envelopes = [
      makeItemEnvelope({ key: 'DOI00001' }),
      makeItemEnvelope({ key: 'DOI00002' }),
    ];
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(envelopes));

    const results = await searchZoteroByDOI('10.1234/test');

    expect(results).toHaveLength(2);
    expect(results[0].key).toBe('DOI00001');
    expect(results[1].key).toBe('DOI00002');
  });

  it('encodes the DOI in the query string', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse([]));

    await searchZoteroByDOI('10.1234/test doi');

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent('10.1234/test doi'));
    expect(calledUrl).toContain('qmode=everything');
    expect(calledUrl).toContain('itemType=-attachment');
  });

  it('returns an empty array when search returns no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse([]));

    const results = await searchZoteroByDOI('10.9999/notfound');

    expect(results).toEqual([]);
  });

  it('returns an empty array on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network down'));

    const results = await searchZoteroByDOI('10.1234/test');

    expect(results).toEqual([]);
  });

  it('returns an empty array on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse({}, 500));

    const results = await searchZoteroByDOI('10.1234/test');

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// searchZoteroByTitle
// ---------------------------------------------------------------------------

describe('searchZoteroByTitle', () => {
  it('returns mapped items when the search returns results', async () => {
    const envelopes = [makeItemEnvelope({ key: 'TITLE001' })];
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(envelopes));

    const results = await searchZoteroByTitle('Sediment Risk Assessment');

    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('TITLE001');
  });

  it('encodes the title and uses titleCreatorYear qmode', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse([]));

    await searchZoteroByTitle('Risk & Hazard');

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent('Risk & Hazard'));
    expect(calledUrl).toContain('qmode=titleCreatorYear');
    expect(calledUrl).toContain('limit=10');
  });

  it('returns an empty array when no results found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse([]));

    const results = await searchZoteroByTitle('Nonexistent Title XYZ');

    expect(results).toEqual([]);
  });

  it('returns an empty array on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'));

    const results = await searchZoteroByTitle('Some Title');

    expect(results).toEqual([]);
  });

  it('returns an empty array on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse({}, 503));

    const results = await searchZoteroByTitle('Some Title');

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases -- null/absent fields in item data
// ---------------------------------------------------------------------------

describe('ZoteroItem field mapping edge cases', () => {
  it('maps null optional fields correctly', async () => {
    const envelope = makeItemEnvelope({
      data: {
        key: 'NULLFLDS',
        itemType: 'book',
        title: 'A Book',
        creators: [],
        date: null,
        publicationTitle: null,
        publisher: null,
        DOI: null,
        url: null,
        abstractNote: null,
        collections: [],
        tags: [],
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse([envelope]));

    const item = await getZoteroItemByKey('NULLFLDS');

    expect(item).not.toBeNull();
    expect(item!.date).toBeNull();
    expect(item!.publicationTitle).toBeNull();
    expect(item!.publisher).toBeNull();
    expect(item!.DOI).toBeNull();
    expect(item!.url).toBeNull();
    expect(item!.abstractNote).toBeNull();
    expect(item!.collections).toEqual([]);
    expect(item!.tags).toEqual([]);
    expect(item!.creators).toEqual([]);
  });

  it('filters out non-attachment children from the attachments list', async () => {
    const envelope = makeItemEnvelope({
      key: 'MIXKIDS1',
      meta: { numChildren: 2 },
    });
    const noteChild = {
      key: 'NOTE0001',
      data: { key: 'NOTE0001', itemType: 'note', title: 'A note' },
      meta: {},
    };
    const attachChild = makeAttachmentEnvelope('ATCH0001');

    vi.mocked(fetch)
      .mockResolvedValueOnce(mockFetchResponse([envelope]))
      .mockResolvedValueOnce(mockFetchResponse([noteChild, attachChild]));

    const item = await getZoteroItemByKey('MIXKIDS1');

    expect(item!.attachments).toHaveLength(1);
    expect(item!.attachments[0].key).toBe('ATCH0001');
  });
});
