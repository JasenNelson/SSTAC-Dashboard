'use client';

/**
 * Zotero local API client.
 *
 * Queries the Zotero desktop application's local API at
 * http://localhost:23119/api/ when Zotero is running with
 * "Allow other applications on this computer to communicate
 * with Zotero" enabled in Settings -> Advanced.
 *
 * Local-only, read-only. Never writes to Zotero. Never sends
 * data to external services. Does not require an API key.
 *
 * Plain ASCII only (code point <= 127).
 */

const ZOTERO_LOCAL_API = 'http://localhost:23119/api';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ZoteroHealthStatus {
  available: boolean;
  userId: number | null;
  error: string | null;
}

export interface ZoteroItem {
  key: string;
  itemType: string;
  title: string;
  creators: Array<{
    firstName?: string;
    lastName?: string;
    name?: string;
    creatorType: string;
  }>;
  date: string | null;
  publicationTitle: string | null;
  publisher: string | null;
  DOI: string | null;
  url: string | null;
  abstractNote: string | null;
  collections: string[];
  tags: Array<{ tag: string }>;
  numChildren: number;
  attachments: ZoteroAttachment[];
}

export interface ZoteroAttachment {
  key: string;
  itemType: 'attachment';
  title: string;
  contentType: string | null;
  filename: string | null;
  url: string | null;
}

export interface ZoteroSearchResult {
  items: ZoteroItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch with an AbortController-based timeout. Returns null on any error
 * (network failure, timeout, non-2xx status, JSON parse failure).
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.warn(`[zotero] Non-OK response ${response.status} for ${url}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    // AbortError (timeout) and network errors both land here.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[zotero] Fetch error for ${url}: ${message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map a raw Zotero API item envelope to ZoteroItem.
 * The Zotero local API wraps data inside `response[n].data`.
 */
function mapItem(
  raw: Record<string, unknown>,
  attachments: ZoteroAttachment[],
): ZoteroItem {
  const data = (raw.data ?? {}) as Record<string, unknown>;
  const meta = (raw.meta ?? {}) as Record<string, unknown>;

  return {
    key: String(data.key ?? raw.key ?? ''),
    itemType: String(data.itemType ?? ''),
    title: String(data.title ?? ''),
    creators: Array.isArray(data.creators)
      ? (data.creators as Array<Record<string, unknown>>).map((c) => ({
          ...(c.firstName !== undefined ? { firstName: String(c.firstName) } : {}),
          ...(c.lastName !== undefined ? { lastName: String(c.lastName) } : {}),
          ...(c.name !== undefined ? { name: String(c.name) } : {}),
          creatorType: String(c.creatorType ?? ''),
        }))
      : [],
    date: data.date != null ? String(data.date) : null,
    publicationTitle:
      data.publicationTitle != null ? String(data.publicationTitle) : null,
    publisher: data.publisher != null ? String(data.publisher) : null,
    DOI: data.DOI != null ? String(data.DOI) : null,
    url: data.url != null ? String(data.url) : null,
    abstractNote:
      data.abstractNote != null ? String(data.abstractNote) : null,
    collections: Array.isArray(data.collections)
      ? (data.collections as unknown[]).map(String)
      : [],
    tags: Array.isArray(data.tags)
      ? (data.tags as Array<Record<string, unknown>>).map((t) => ({
          tag: String(t.tag ?? ''),
        }))
      : [],
    numChildren:
      typeof meta.numChildren === 'number' ? meta.numChildren : 0,
    attachments,
  };
}

/**
 * Map a raw Zotero attachment envelope to ZoteroAttachment.
 */
function mapAttachment(
  raw: Record<string, unknown>,
): ZoteroAttachment | null {
  const data = (raw.data ?? {}) as Record<string, unknown>;
  if (data.itemType !== 'attachment') return null;
  return {
    key: String(data.key ?? raw.key ?? ''),
    itemType: 'attachment',
    title: String(data.title ?? ''),
    contentType:
      data.contentType != null ? String(data.contentType) : null,
    filename: data.filename != null ? String(data.filename) : null,
    url: data.url != null ? String(data.url) : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the Zotero local API is reachable.
 *
 * Uses a 2-second timeout -- Zotero desktop is either running or it is not.
 * Returns { available: true, userId, error: null } on success.
 * Returns { available: false, userId: null, error: <message> } on failure.
 */
export async function checkZoteroHealth(): Promise<ZoteroHealthStatus> {
  const url = `${ZOTERO_LOCAL_API}/users/0`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return {
        available: false,
        userId: null,
        error: `Zotero local API returned status ${response.status}`,
      };
    }
    const data = (await response.json()) as Record<string, unknown>;
    const userId =
      typeof data.userID === 'number'
        ? data.userID
        : typeof data.id === 'number'
          ? data.id
          : null;
    return { available: true, userId, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      userId: null,
      error: `Zotero desktop may not be running: ${message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retrieve a single Zotero item by key.
 *
 * Also fetches child attachments when numChildren > 0.
 * Returns null on 404, network error, or any other failure.
 */
export async function getZoteroItemByKey(
  key: string,
): Promise<ZoteroItem | null> {
  const url = `${ZOTERO_LOCAL_API}/users/0/items/${encodeURIComponent(key)}`;
  const raw = await fetchWithTimeout(url, 10000);
  if (raw == null) return null;

  // The local API may return a single object or an array of one.
  const envelope = Array.isArray(raw)
    ? (raw[0] as Record<string, unknown> | undefined)
    : (raw as Record<string, unknown>);
  if (!envelope) return null;

  const meta = (envelope.meta ?? {}) as Record<string, unknown>;
  const numChildren =
    typeof meta.numChildren === 'number' ? meta.numChildren : 0;

  let attachments: ZoteroAttachment[] = [];
  if (numChildren > 0) {
    const childUrl = `${ZOTERO_LOCAL_API}/users/0/items/${encodeURIComponent(key)}/children`;
    const childRaw = await fetchWithTimeout(childUrl, 10000);
    if (Array.isArray(childRaw)) {
      attachments = (childRaw as Array<Record<string, unknown>>)
        .map(mapAttachment)
        .filter((a): a is ZoteroAttachment => a !== null);
    }
  }

  return mapItem(envelope, attachments);
}

/**
 * Search the Zotero library for items matching a DOI.
 *
 * Returns up to 5 matches. Returns an empty array on any error.
 */
export async function searchZoteroByDOI(
  doi: string,
): Promise<ZoteroItem[]> {
  const url =
    `${ZOTERO_LOCAL_API}/users/0/items` +
    `?q=${encodeURIComponent(doi)}&qmode=everything&itemType=-attachment&limit=5`;
  const raw = await fetchWithTimeout(url, 10000);
  if (!Array.isArray(raw)) return [];

  return (raw as Array<Record<string, unknown>>)
    .map((envelope) => mapItem(envelope, []))
    .filter((item) => item.key !== '');
}

/**
 * Search the Zotero library for items by title (and creator/year).
 *
 * Returns up to 10 matches. Returns an empty array on any error.
 */
export async function searchZoteroByTitle(
  title: string,
): Promise<ZoteroItem[]> {
  const url =
    `${ZOTERO_LOCAL_API}/users/0/items` +
    `?q=${encodeURIComponent(title)}&qmode=titleCreatorYear&itemType=-attachment&limit=10`;
  const raw = await fetchWithTimeout(url, 10000);
  if (!Array.isArray(raw)) return [];

  return (raw as Array<Record<string, unknown>>)
    .map((envelope) => mapItem(envelope, []))
    .filter((item) => item.key !== '');
}
