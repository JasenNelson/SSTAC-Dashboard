import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * The server boundary of a private-storage release, on SYNTHETIC bytes.
 *
 * Nothing here reads the private fixture. A synthetic release entry (the bound
 * version, with the length and hash of bytes written for the test) is handed to
 * the real getVerifiedPrivateRelease, and `fetch` is a stub that answers like the
 * storage API. The figures contract is the only part of the catalog replaced:
 * getAcceptedFiguresContract answers a synthetic asset list. Every check under
 * test (reader, allowlist, request shape, counting reader, length, hash, media
 * type, content form, deadlines, cache) is the product's own.
 *
 * Each refusal sits beside an input that is accepted, so a test cannot pass
 * because everything is refused.
 */
const synthetic = vi.hoisted(() => ({
  /** What getAcceptedFiguresContract answers: an asset list, nothing, or an error to throw. */
  figures: null as { assets: { id: string; file: string; sha256: string; bytes: number; width: number; height: number; placementIds: string[] }[] } | Error | null,
  /** A patch of the private-storage release entry, as getPaperRelease answers it. */
  release: null as Record<string, unknown> | null,
  structure: { synthetic: 'structure' },
}));

vi.mock('../accepted-figures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../accepted-figures')>();
  return {
    ...actual,
    getAcceptedFiguresContract: () => {
      if (synthetic.figures instanceof Error) throw synthetic.figures;
      return synthetic.figures;
    },
  };
});
vi.mock('../releases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../releases')>();
  return {
    ...actual,
    getPaperRelease: (documentVersion: string | undefined | null) => {
      const release = actual.getPaperRelease(documentVersion);
      return release && synthetic.release && release.documentVersion === actual.R5_PAPER_VERSION ? { ...release, ...synthetic.release } : release;
    },
  };
});
// The request loader is used here only to show that the reader check comes first; what it
// compiles is tested in paper-request-loader.test.ts.
vi.mock('../../revised-paper-structure', () => ({
  compileAuthenticatedRelease: vi.fn(() => synthetic.structure),
  loadRevisedPaperStructure: vi.fn(() => {
    throw new Error('the repository loader is not used for a private-storage release');
  }),
}));

import { compileAuthenticatedRelease } from '../../revised-paper-structure';
import { loadPaperStructureForRequest, loadPrivatePaperStructure } from '../paper-request-loader';
import {
  copyVerifiedFigure,
  getVerifiedPrivateRelease,
  PAPER_READER_POLICY_PREDICATE,
  PaperReaderDeniedError,
  PRIVATE_RELEASE_CACHE_TTL_MS,
  PrivateReleaseUnavailableError,
  requirePaperReader,
  resetPrivateReleaseCacheForTests,
  type PaperReader,
  type PaperSessionClient,
  type PrivateReleaseFailureCode,
} from '../private-release-assets';
import { DEFAULT_PAPER_VERSION, PAPER_RELEASES, paperReleaseIdentity, R5_PAPER_VERSION, type PaperRelease } from '../releases';
import { PRIVATE_FIXTURE_DIR_ENV } from './private-fixture';

const VERSION = R5_PAPER_VERSION;
const BASE_URL = 'https://storage-host-marker.example.test';
const PUBLISHABLE_KEY = 'publishable-key-marker-51d0';
const TOKEN = 'session-token-marker-3f9a71';
const OTHER_TOKEN = 'other-session-token-marker-b77c2';
const BODY_MARKER = 'response-body-marker-c41d';
const OBJECT_MARKER = 'object-bytes-marker-8e2b';
const MARKERS = [TOKEN, OTHER_TOKEN, BODY_MARKER, OBJECT_MARKER, PUBLISHABLE_KEY, 'storage-host-marker'] as const;
// The bucket is named in ONE product file. It is assembled here so this file is not a second one.
const BUCKET = ['matrix-paper', 'review', 'assets'].join('-');
const UNAVAILABLE_MESSAGE = 'The private paper release is unavailable.';
const LOG_LINE = /^\[matrix-options-paper\] private release unavailable: [A-Z0-9_]+$/;
const logLine = (code: string): string => `[matrix-options-paper] private release unavailable: ${code}`;
const OBJECT_DEADLINE_MS = 15_000;
const RELEASE_DEADLINE_MS = 45_000;
const CHUNK_BYTES = 64;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const MARKDOWN = Buffer.from(Array.from({ length: 24 }, (_, index) => `Synthetic line ${index + 1} ${OBJECT_MARKER}\n`).join(''), 'utf8');
const MARKDOWN_PATH = `${VERSION}/presentation.md`;
const figurePath = (file: string): string => `${VERSION}/figures/${file}`;

/** The smallest bytes the PNG check reads: signature, IHDR chunk type, width and height. */
function png(width: number, height: number, fill: number): Buffer {
  const buffer = Buffer.alloc(96, fill);
  PNG_SIGNATURE.copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

interface SyntheticFigure {
  readonly file: string;
  readonly bytes: Buffer;
  /** The size the contract declares (the size in the bytes, unless a test says otherwise). */
  readonly width: number;
  readonly height: number;
}

const FIGURES: readonly SyntheticFigure[] = [
  { file: 'FIGS1.png', bytes: png(40, 30, 0x41), width: 40, height: 30 },
  { file: 'FIGS2.png', bytes: png(41, 31, 0x42), width: 41, height: 31 },
  { file: 'FIGS3.png', bytes: png(42, 32, 0x43), width: 42, height: 32 },
];

const R5_ENTRY = PAPER_RELEASES.find((release) => release.documentVersion === VERSION) as PaperRelease;

/** A private-storage release entry that binds `markdown` and has no figures. */
function markdownRelease(markdown: Uint8Array = MARKDOWN, patch: Partial<PaperRelease> = {}): PaperRelease {
  return { ...R5_ENTRY, bytes: markdown.byteLength, sha256: sha(markdown), acceptedFigures: false, ...patch };
}

/** A private-storage release entry that binds `markdown` and the given figures (through the stand-in contract). */
function figureRelease(figures: readonly SyntheticFigure[] = FIGURES, markdown: Uint8Array = MARKDOWN): PaperRelease {
  synthetic.figures = {
    assets: figures.map((figure, index) => ({ id: figure.file.replace(/\.png$/, ''), file: figure.file, sha256: sha(figure.bytes), bytes: figure.bytes.byteLength, width: figure.width, height: figure.height, placementIds: [`S-${index + 1}`] })),
  };
  return markdownRelease(markdown, { acceptedFigures: true });
}

interface ObjectPlan {
  /** The body, cut into CHUNK_BYTES pieces. `chunks` gives the pieces themselves. */
  readonly bytes?: Uint8Array;
  readonly chunks?: readonly Uint8Array[];
  readonly status?: number;
  /** Replaces the default headers (the object's media type and the length of the body). */
  readonly headers?: Readonly<Record<string, string>>;
  readonly noBody?: boolean;
  readonly fetchRejects?: unknown;
  /**
   * `fetch`: no answer until the request is aborted. `body`: after its chunks, the body never ends.
   * `fetch-deaf`: no answer at all, and the abort is ignored (a transport that does not honour its signal).
   */
  readonly stall?: 'fetch' | 'body' | 'fetch-deaf';
  /** After its chunks, the body errors. */
  readonly bodyFails?: boolean;
  /** Answer after this many milliseconds of (fake) time. */
  readonly delayMs?: number;
  /**
   * What a first-byte request (`Range: bytes=0-0`) is answered with. Without it, an object that
   * answers a full read with 200 answers 206 with its first byte, and any other plan answers as it
   * does a full read.
   */
  readonly firstByte?: ObjectPlan;
  /** Called with a function that lets this request be answered; until it is called the request stays open. */
  readonly gate?: (open: () => void) => void;
}

interface StorageCall {
  readonly url: string;
  readonly objectPath: string;
  readonly init: RequestInit | undefined;
  /** True for a first-byte request, false for a full read. */
  readonly firstByte: boolean;
  pulls: number;
  pulledBytes: number;
  opened: boolean;
  cancelled: boolean;
  closed: boolean;
  errored: boolean;
}

interface StorageStub {
  readonly calls: StorageCall[];
  readonly paths: () => string[];
}

function chunked(bytes: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) chunks.push(bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.byteLength)));
  return chunks;
}

const storageCalls: StorageCall[] = [];

/** How an object answers a first-byte request: as planned, or 206 with one byte where a full read would be a 200 with a body. */
function firstBytePlan(whole: ObjectPlan): ObjectPlan {
  if (whole.firstByte) return whole.firstByte;
  const answersWithBody = (whole.status ?? 200) === 200 && !whole.noBody && whole.fetchRejects === undefined && whole.stall === undefined && !whole.bodyFails;
  if (!answersWithBody) return whole;
  const bytes = whole.bytes ?? Buffer.concat((whole.chunks ?? []).map((chunk) => Buffer.from(chunk)));
  return { status: 206, bytes: bytes.subarray(0, 1), delayMs: whole.delayMs, headers: { 'content-type': 'text/markdown', 'content-range': `bytes 0-0/${bytes.byteLength}`, 'content-length': '1' } };
}
const aborted = (): DOMException => new DOMException('This operation was aborted', 'AbortError');

/**
 * `fetch`, answering like the storage API for the given objects: anything else
 * is "not found". Every body is a stream that counts what is pulled from it and
 * records whether it was cancelled, drained or errored. An aborted request
 * rejects, and errors its body, as `fetch` does.
 */
function stubStorage(objects: Readonly<Record<string, ObjectPlan>>): StorageStub {
  const calls: StorageCall[] = [];
  const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const marker = `/${BUCKET}/`;
    const objectPath = url.includes(marker) ? decodeURIComponent(url.slice(url.indexOf(marker) + marker.length)) : url;
    const firstByte = (init?.headers as Record<string, string> | undefined)?.Range === 'bytes=0-0';
    const call: StorageCall = { url, objectPath, init, firstByte, pulls: 0, pulledBytes: 0, opened: false, cancelled: false, closed: false, errored: false };
    calls.push(call);
    storageCalls.push(call);
    const signal = init?.signal ?? null;
    const whole: ObjectPlan = objects[objectPath] ?? { status: 404, bytes: Buffer.from(`{"error":"not_found","message":"${BODY_MARKER}"}`), headers: { 'content-type': 'application/json' } };
    const plan = firstByte ? firstBytePlan(whole) : whole;
    if (signal?.aborted) throw aborted();
    if (plan.fetchRejects !== undefined) throw plan.fetchRejects;
    if (plan.stall === 'fetch-deaf') return new Promise<Response>(() => {});
    if (plan.stall === 'fetch') {
      return new Promise<Response>((_, reject) => {
        signal?.addEventListener('abort', () => reject(aborted()));
      });
    }
    if (plan.gate) {
      await new Promise<void>((resolve, reject) => {
        plan.gate?.(resolve);
        signal?.addEventListener('abort', () => reject(aborted()));
      });
    }
    if (plan.delayMs !== undefined) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, plan.delayMs);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(aborted());
        });
      });
    }
    const chunks = plan.chunks ?? chunked(plan.bytes ?? new Uint8Array(0));
    const headers = plan.headers ?? {
      'content-type': objectPath.endsWith('.md') ? 'text/markdown' : 'image/png',
      'content-length': String(chunks.reduce((total, chunk) => total + chunk.byteLength, 0)),
    };
    const status = plan.status ?? 200;
    if (plan.noBody) return new Response(null, { status, headers });
    let next = 0;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        signal?.addEventListener('abort', () => {
          if (call.closed || call.cancelled || call.errored) return;
          call.errored = true;
          controller.error(aborted());
        });
      },
      pull(controller) {
        call.pulls += 1;
        if (next < chunks.length) {
          const chunk = chunks[next];
          next += 1;
          call.pulledBytes += chunk.byteLength;
          controller.enqueue(chunk);
          return undefined;
        }
        if (plan.stall === 'body') return new Promise<void>(() => {});
        if (plan.bodyFails) {
          call.errored = true;
          controller.error(new TypeError(`terminated ${BODY_MARKER}`));
          return undefined;
        }
        call.closed = true;
        controller.close();
        return undefined;
      },
      cancel() {
        call.cancelled = true;
      },
    }, { highWaterMark: 0 });
    call.opened = true;
    return new Response(stream, { status, headers });
  };
  vi.stubGlobal('fetch', vi.fn(stub));
  return { calls, paths: () => calls.map((call) => call.objectPath) };
}

/** The objects of a release, each answering with its own bytes. */
function healthyObjects(figures: readonly SyntheticFigure[] = [], markdown: Uint8Array = MARKDOWN): Record<string, ObjectPlan> {
  return Object.fromEntries([[MARKDOWN_PATH, { bytes: markdown }], ...figures.map((figure) => [figurePath(figure.file), { bytes: figure.bytes }] as const)]);
}

const ALLOWED_USER = Object.freeze({ id: 'reader-user-1', is_anonymous: false });
/** A second signed-in reader, with a session and a token of their own. */
const OTHER_USER = Object.freeze({ id: 'reader-user-other', is_anonymous: false });
const otherClient = (options: Parameters<typeof sessionClient>[0] = {}): TestClient => sessionClient({ user: OTHER_USER, token: OTHER_TOKEN, ...options });

interface TestClient {
  readonly client: PaperSessionClient;
  readonly getUser: MockInstance;
  readonly getSession: MockInstance;
}

function sessionClient(options: { readonly user?: unknown; readonly token?: string; readonly getUser?: () => Promise<unknown>; readonly getSession?: () => Promise<unknown> } = {}): TestClient {
  const user = 'user' in options ? options.user : ALLOWED_USER;
  const getUser = vi.fn(options.getUser ?? (async () => ({ data: { user }, error: null })));
  const getSession = vi.fn(options.getSession ?? (async () => ({ data: { session: { access_token: options.token ?? TOKEN } }, error: null })));
  return { client: { auth: { getUser, getSession } } as unknown as PaperSessionClient, getUser, getSession };
}

const allowedReader = (): Promise<PaperReader> => requirePaperReader(sessionClient().client);
const failureOf = (promise: Promise<unknown>): Promise<unknown> => promise.then(() => 'resolved', (error: unknown) => error);

function expectNoLeak(error: unknown): void {
  const shown = [String(error), error instanceof Error ? error.message : '', error instanceof Error ? error.stack ?? '' : '', JSON.stringify(error), String((error as { cause?: unknown }).cause ?? '')].join('\n');
  for (const marker of MARKERS) expect(shown.includes(marker)).toBe(false);
}

function expectUnavailable(error: unknown, code: PrivateReleaseFailureCode): void {
  expect(error).toBeInstanceOf(PrivateReleaseUnavailableError);
  expect((error as PrivateReleaseUnavailableError).code).toBe(code);
  expect((error as Error).message).toBe(UNAVAILABLE_MESSAGE);
  expectNoLeak(error);
}

let errorLog: MockInstance;
const loggedLines = (): unknown[] => errorLog.mock.calls.map((args) => args[0]);

/**
 * The load fails with `code`, twice: the second attempt reads storage again, so
 * neither the failure nor anything read before it was kept.
 */
async function expectFailsClosed(release: PaperRelease, storage: StorageStub, code: PrivateReleaseFailureCode, fetchesPerAttempt: number): Promise<void> {
  const reader = await allowedReader();
  expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), code);
  expect(storage.calls).toHaveLength(fetchesPerAttempt);
  expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), code);
  expect(storage.calls).toHaveLength(2 * fetchesPerAttempt);
  expect(loggedLines()).toEqual([logLine(code), logLine(code)]);
}

/** AbortSignal.timeout on the (fake) clock, with every signal it made, so a deadline can be reached or fired by hand. */
function controllableDeadlines(): { ms: number; controller: AbortController }[] {
  const made: { ms: number; controller: AbortController }[] = [];
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
    const controller = new AbortController();
    made.push({ ms, controller });
    setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
    return controller.signal;
  });
  return made;
}

beforeEach(() => {
  resetPrivateReleaseCacheForTests();
  synthetic.figures = null;
  synthetic.release = null;
  storageCalls.length = 0;
  vi.mocked(compileAuthenticatedRelease).mockClear();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', BASE_URL);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', PUBLISHABLE_KEY);
  // Where the private fixture is configured it would stand in for storage; these tests read the stub.
  vi.stubEnv(PRIVATE_FIXTURE_DIR_ENV, '');
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  try {
    // No exit leaves a response body open: each one was cancelled, drained or errored by an abort.
    expect(storageCalls.filter((call) => call.opened && !(call.cancelled || call.closed || call.errored)).map((call) => call.objectPath)).toEqual([]);
    // Every log line is the constant line with a code: no token, address, body or object bytes.
    for (const args of errorLog.mock.calls) {
      expect(args).toHaveLength(1);
      expect(String(args[0])).toMatch(LOG_LINE);
    }
  } finally {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

describe('requirePaperReader', () => {
  it.each([
    ['no user', { user: null }],
    ['a user check that answers an error, even with a user', { getUser: async () => ({ data: { user: ALLOWED_USER }, error: new Error(`denied ${TOKEN}`) }) }],
    ['a user check that throws', { getUser: async () => { throw new Error(`network ${TOKEN}`); } }],
    ['an anonymous user', { user: { id: 'reader-user-2', is_anonymous: true } }],
    ['a user with no is_anonymous flag', { user: { id: 'reader-user-2' } }],
    ['a user whose is_anonymous flag is null', { user: { id: 'reader-user-2', is_anonymous: null } }],
    ['a user whose is_anonymous flag is the text "false"', { user: { id: 'reader-user-2', is_anonymous: 'false' } }],
    ['a user with an empty id', { user: { id: '', is_anonymous: false } }],
    ['a user whose id is not text', { user: { id: 7, is_anonymous: false } }],
  ])('denies %s', async (_title, options) => {
    const { client, getUser } = sessionClient(options);
    const error = await failureOf(requirePaperReader(client));
    expect(error).toBeInstanceOf(PaperReaderDeniedError);
    expect((error as PaperReaderDeniedError).code).toBe('PAPER_READER_DENIED');
    expect((error as Error).message).toBe('A signed-in, non-anonymous reader is required.');
    expectNoLeak(error);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('issues a reader for a signed-in user whose is_anonymous flag is exactly false', async () => {
    const { client, getUser, getSession } = sessionClient();
    const reader = await requirePaperReader(client);
    expect(reader).toEqual({ userId: ALLOWED_USER.id });
    expect(Object.isFrozen(reader)).toBe(true);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('states the same rule as the storage read policy', () => {
    expect(PAPER_READER_POLICY_PREDICATE).toBe("COALESCE((auth.jwt() -> 'is_anonymous') = to_jsonb(false), false)");
  });
});

describe('getVerifiedPrivateRelease: who may read', () => {
  it('denies a value that only looks like a reader, cold and warm, and reads nothing for it', async () => {
    const storage = stubStorage(healthyObjects());
    const release = markdownRelease();
    const reader = await allowedReader();
    const forged = [{ userId: ALLOWED_USER.id }, { ...reader }, Object.freeze({ userId: reader.userId })] as unknown as PaperReader[];
    for (const value of forged) expect(await failureOf(getVerifiedPrivateRelease(value, release))).toBeInstanceOf(PaperReaderDeniedError);
    expect(storage.calls).toHaveLength(0);
    // Warm: the verified bytes are in memory, and a forged reader still gets none of them.
    expect((await getVerifiedPrivateRelease(reader, release)).markdown).toBe(MARKDOWN.toString('utf8'));
    expect(storage.calls).toHaveLength(1);
    for (const value of forged) expect(await failureOf(getVerifiedPrivateRelease(value, release))).toBeInstanceOf(PaperReaderDeniedError);
    expect(storage.calls).toHaveLength(1);
    expect(loggedLines()).toEqual([]);
  });

  it('reads with the session of the client the reader was checked on', async () => {
    stubStorage(healthyObjects());
    const checked = sessionClient();
    const other = sessionClient();
    const reader = await requirePaperReader(checked.client);
    await getVerifiedPrivateRelease(reader, markdownRelease());
    // One session lookup for the whole call: the token it returns names the session and goes with the request.
    expect(checked.getSession).toHaveBeenCalledTimes(1);
    expect(other.getSession).not.toHaveBeenCalled();
    // The warm read looks the session up once, to know whose call it is: no request, no second user check.
    await getVerifiedPrivateRelease(reader, markdownRelease());
    expect(checked.getSession).toHaveBeenCalledTimes(2);
    expect(checked.getUser).toHaveBeenCalledTimes(1);
  });

  it('answers a repository release as not private, without a read', async () => {
    const storage = stubStorage(healthyObjects());
    const repository = PAPER_RELEASES.find((release) => release.documentVersion === DEFAULT_PAPER_VERSION) as PaperRelease;
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), repository)), 'NOT_A_PRIVATE_RELEASE');
    expect(storage.calls).toHaveLength(0);
    expect((await getVerifiedPrivateRelease(await allowedReader(), markdownRelease())).documentVersion).toBe(VERSION);
  });
});

describe('getVerifiedPrivateRelease: what is requested', () => {
  it('requests each object with the reader token, the publishable key, identity encoding, no redirect and no cache', async () => {
    const storage = stubStorage(healthyObjects(FIGURES));
    await getVerifiedPrivateRelease(await allowedReader(), figureRelease());
    expect(storage.calls.map((call) => call.url)).toEqual([
      `${BASE_URL}/storage/v1/object/authenticated/${BUCKET}/${VERSION}/presentation.md`,
      ...FIGURES.map((figure) => `${BASE_URL}/storage/v1/object/authenticated/${BUCKET}/${VERSION}/figures/${figure.file}`),
    ]);
    for (const call of storage.calls) {
      expect(call.init?.method).toBe('GET');
      // Exactly these headers: no conditional and no range header.
      expect(call.init?.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, apikey: PUBLISHABLE_KEY, 'Accept-Encoding': 'identity' });
      expect(call.init?.redirect).toBe('error');
      expect(call.init?.cache).toBe('no-store');
      expect(call.init?.signal).toBeInstanceOf(AbortSignal);
      expect(call.init?.body).toBeUndefined();
    }
  });

  it('requests only the allowlisted objects, each once, the Markdown first, and returns their verified bytes', async () => {
    const extra = { [`${VERSION}/other.md`]: { bytes: MARKDOWN }, [figurePath('FIGS9.png')]: { bytes: FIGURES[0].bytes } };
    const storage = stubStorage({ ...healthyObjects(FIGURES), ...extra });
    const release = figureRelease();
    const assets = await getVerifiedPrivateRelease(await allowedReader(), release);
    expect(storage.paths()[0]).toBe(MARKDOWN_PATH);
    expect([...storage.paths()].sort()).toEqual([MARKDOWN_PATH, ...FIGURES.map((figure) => figurePath(figure.file))].sort());
    expect(assets.documentVersion).toBe(VERSION);
    expect(assets.releaseIdentity).toBe(paperReleaseIdentity(release));
    expect(assets.markdown).toBe(MARKDOWN.toString('utf8'));
    expect(assets.figureFiles).toEqual(FIGURES.map((figure) => figure.file));
    for (const figure of FIGURES) expect(copyVerifiedFigure(assets, figure.file)?.equals(figure.bytes)).toBe(true);
    expect(Object.isFrozen(assets)).toBe(true);
    expect(loggedLines()).toEqual([]);
  });

  it('keeps the verified figure bytes out of reach: the release holds no bytes, and every figure is handed out as a fresh copy', async () => {
    stubStorage(healthyObjects(FIGURES));
    const assets = await getVerifiedPrivateRelease(await allowedReader(), figureRelease());
    // Nothing a renderer could inspect or transfer: no typed array and no map of bytes on the value a page awaits.
    const reachable = (value: unknown): unknown[] => (value !== null && typeof value === 'object' ? [value, ...Object.values(value as object).flatMap(reachable)] : [value]);
    expect(reachable(assets).some((value) => ArrayBuffer.isView(value) || value instanceof ArrayBuffer || value instanceof Map)).toBe(false);
    expect(Object.keys(assets).sort()).toEqual(['documentVersion', 'figureFiles', 'markdown', 'releaseIdentity']);
    const file = FIGURES[0].file;
    const first = copyVerifiedFigure(assets, file);
    const second = copyVerifiedFigure(assets, file);
    expect(first).not.toBeNull();
    expect(first).not.toBe(second);
    expect(first?.buffer).not.toBe(second?.buffer);
    // A consumer that overwrites its copy, or gives its buffer away (as a response body may), changes nothing kept.
    first?.fill(0);
    structuredClone(second?.buffer, { transfer: [second?.buffer as ArrayBuffer] });
    expect(second?.byteLength).toBe(0);
    expect(copyVerifiedFigure(assets, file)?.equals(FIGURES[0].bytes)).toBe(true);
    // Only bound file names, and only for a release this module verified.
    expect(copyVerifiedFigure(assets, 'FIGS9.png')).toBeNull();
    expect(copyVerifiedFigure({ ...assets }, file)).toBeNull();
  });


  it('requests no figure when the Markdown cannot be read, and every figure when it can', async () => {
    const failing = stubStorage({ ...healthyObjects(FIGURES), [MARKDOWN_PATH]: { status: 500, bytes: Buffer.from(BODY_MARKER), headers: { 'content-type': 'text/plain' } } });
    const release = figureRelease();
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), release)), 'STATUS');
    expect(failing.paths()).toEqual([MARKDOWN_PATH]);
    const healthy = stubStorage(healthyObjects(FIGURES));
    await getVerifiedPrivateRelease(await allowedReader(), release);
    expect(healthy.calls).toHaveLength(1 + FIGURES.length);
  });

  it('builds the address from the configured storage address whatever slashes end it', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `${BASE_URL}//`);
    const storage = stubStorage(healthyObjects());
    await getVerifiedPrivateRelease(await allowedReader(), markdownRelease());
    expect(storage.calls[0].url).toBe(`${BASE_URL}/storage/v1/object/authenticated/${BUCKET}/${MARKDOWN_PATH}`);
  });
});

describe('getVerifiedPrivateRelease: fails closed, and keeps nothing', () => {
  it.each(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])('CONFIGURATION: %s is not set', async (name) => {
    const storage = stubStorage(healthyObjects());
    const release = markdownRelease();
    const reader = await allowedReader();
    vi.stubEnv(name, '');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'CONFIGURATION');
    expect(storage.calls).toHaveLength(0);
    // Nothing was kept: with the value set, the next call reads storage and succeeds.
    vi.stubEnv(name, name === 'NEXT_PUBLIC_SUPABASE_URL' ? BASE_URL : PUBLISHABLE_KEY);
    expect((await getVerifiedPrivateRelease(reader, release)).markdown).toBe(MARKDOWN.toString('utf8'));
    expect(storage.calls).toHaveLength(1);
    expect(loggedLines()).toEqual([logLine('CONFIGURATION')]);
  });

  it.each([
    ['a hash that is not 64 lowercase hex characters', () => markdownRelease(MARKDOWN, { sha256: sha(MARKDOWN).toUpperCase() })],
    ['a declared length of zero', () => markdownRelease(MARKDOWN, { bytes: 0 })],
    ['a declared length that is not a whole number', () => markdownRelease(MARKDOWN, { bytes: MARKDOWN.byteLength + 0.5 })],
    ['a declared length above the bucket file size limit', () => markdownRelease(MARKDOWN, { bytes: 1_048_577 })],
    ['a release with figures and no figures contract', () => markdownRelease(MARKDOWN, { acceptedFigures: true })],
    ['a figure file name that is a path', () => figureRelease([{ ...FIGURES[0], file: '../FIGS1.png' }])],
    ['a figure listed twice', () => figureRelease([FIGURES[0], FIGURES[0]])],
  ])('CONFIGURATION: %s is refused before any read', async (_title, makeRelease) => {
    const storage = stubStorage(healthyObjects(FIGURES));
    const reader = await allowedReader();
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, makeRelease())), 'CONFIGURATION');
    expect(storage.calls).toHaveLength(0);
    expect((await getVerifiedPrivateRelease(reader, figureRelease())).figureFiles.length).toBe(FIGURES.length);
    expect(storage.calls).toHaveLength(1 + FIGURES.length);
  });

  it('CONFIGURATION: accepts a declared length at the bucket file size limit', async () => {
    const atLimit = Buffer.alloc(1_048_576, 0x61);
    const storage = stubStorage(healthyObjects([], atLimit));
    expect((await getVerifiedPrivateRelease(await allowedReader(), markdownRelease(atLimit))).markdown).toHaveLength(1_048_576);
    expect(storage.calls).toHaveLength(1);
  });

  it.each([
    ['no session', async () => ({ data: { session: null }, error: null })],
    ['a session lookup that answers an error, even with a session', async () => ({ data: { session: { access_token: TOKEN } }, error: new Error(`refresh ${TOKEN}`) })],
    ['a session lookup that throws', async () => { throw new Error(`cookies ${TOKEN}`); }],
    ['an empty token', async () => ({ data: { session: { access_token: '' } }, error: null })],
  ])('SESSION: %s', async (_title, getSession) => {
    const storage = stubStorage(healthyObjects());
    const release = markdownRelease();
    const denied = sessionClient({ getSession });
    const reader = await requirePaperReader(denied.client);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'SESSION');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'SESSION');
    expect(denied.getSession).toHaveBeenCalledTimes(2);
    expect(storage.calls).toHaveLength(0);
    // A reader with a session reads storage: the refusals above left nothing behind.
    expect((await getVerifiedPrivateRelease(await allowedReader(), release)).markdown).toBe(MARKDOWN.toString('utf8'));
    expect(storage.calls).toHaveLength(1);
  });

  it('TRANSPORT: the request fails', async () => {
    const storage = stubStorage({ [MARKDOWN_PATH]: { fetchRejects: new TypeError(`fetch failed ${BASE_URL} ${TOKEN}`) } });
    await expectFailsClosed(markdownRelease(), storage, 'TRANSPORT', 1);
  });

  it('TRANSPORT: the body fails part way', async () => {
    const storage = stubStorage({ [MARKDOWN_PATH]: { chunks: chunked(MARKDOWN).slice(0, 2), bodyFails: true, headers: { 'content-type': 'text/markdown' } } });
    await expectFailsClosed(markdownRelease(), storage, 'TRANSPORT', 1);
    expect(storage.calls.every((call) => call.errored && call.pulls === 3)).toBe(true);
  });

  it.each([206, 400, 403, 404, 500])('STATUS: the Markdown answers %i, and its body is cancelled unread', async (status) => {
    const storage = stubStorage({ [MARKDOWN_PATH]: { status, bytes: Buffer.from(`{"message":"${BODY_MARKER}"}`), headers: { 'content-type': 'application/json' } } });
    await expectFailsClosed(markdownRelease(), storage, 'STATUS', 1);
    expect(storage.calls.map((call) => [call.cancelled, call.pulls])).toEqual([[true, 0], [true, 0]]);
  });

  it('STATUS: a 200 with the exact bytes is refused only when another status is put on it', async () => {
    const storage = stubStorage({ [MARKDOWN_PATH]: { status: 206, bytes: MARKDOWN } });
    const release = markdownRelease();
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), release)), 'STATUS');
    expect(storage.calls[0].cancelled).toBe(true);
    stubStorage({ [MARKDOWN_PATH]: { status: 200, bytes: MARKDOWN } });
    expect((await getVerifiedPrivateRelease(await allowedReader(), release)).markdown).toBe(MARKDOWN.toString('utf8'));
  });

  it('STATUS: a 200 with no body, and an object that is not there', async () => {
    const empty = stubStorage({ [MARKDOWN_PATH]: { noBody: true, headers: { 'content-type': 'text/markdown' } } });
    await expectFailsClosed(markdownRelease(), empty, 'STATUS', 1);
    errorLog.mockClear();
    const missing = stubStorage({ ...healthyObjects(FIGURES.slice(0, 2)) });
    await expectFailsClosed(figureRelease(), missing, 'STATUS', 1 + FIGURES.length);
  });

  it.each([
    ['text/html on the Markdown', MARKDOWN_PATH, { 'content-type': 'text/html' }],
    ['no media type on the Markdown', MARKDOWN_PATH, {}],
    ['image/png on the Markdown', MARKDOWN_PATH, { 'content-type': 'image/png' }],
    ['text/markdown on a figure', figurePath(FIGURES[1].file), { 'content-type': 'text/markdown' }],
    ['image/jpeg on a figure', figurePath(FIGURES[1].file), { 'content-type': 'image/jpeg' }],
    ['no media type on a figure', figurePath(FIGURES[1].file), {}],
  ])('MEDIA_TYPE: %s', async (_title, objectPath, headers) => {
    const objects = healthyObjects(FIGURES);
    const storage = stubStorage({ ...objects, [objectPath]: { ...objects[objectPath], headers } });
    await expectFailsClosed(figureRelease(), storage, 'MEDIA_TYPE', objectPath === MARKDOWN_PATH ? 1 : 1 + FIGURES.length);
  });

  it.each(['text/markdown', 'text/markdown; charset=utf-8', 'TEXT/Markdown ;charset=UTF-8'])('MEDIA_TYPE: accepts %s on the Markdown, with or without a parameter', async (type) => {
    stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, headers: { 'content-type': type } } });
    expect((await getVerifiedPrivateRelease(await allowedReader(), markdownRelease())).markdown).toBe(MARKDOWN.toString('utf8'));
  });

  it.each([MARKDOWN.byteLength + 1, MARKDOWN.byteLength - 1, 0])('LENGTH: an identity response that declares %i bytes is refused before its body is read', async (declared) => {
    const storage = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, headers: { 'content-type': 'text/markdown', 'content-length': String(declared) } } });
    await expectFailsClosed(markdownRelease(), storage, 'LENGTH', 1);
    expect(storage.calls.map((call) => [call.cancelled, call.pulls])).toEqual([[true, 0], [true, 0]]);
  });

  it('LENGTH: a response that declares the expected length, or none, is read', async () => {
    const accepted: readonly Record<string, string>[] = [{ 'content-type': 'text/markdown', 'content-length': String(MARKDOWN.byteLength) }, { 'content-type': 'text/markdown' }];
    for (const headers of accepted) {
      resetPrivateReleaseCacheForTests();
      const storage = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, headers } });
      expect((await getVerifiedPrivateRelease(await allowedReader(), markdownRelease())).markdown).toBe(MARKDOWN.toString('utf8'));
      expect(storage.calls[0].closed).toBe(true);
    }
  });

  it('LENGTH: a body shorter than declared by the release', async () => {
    const storage = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN.subarray(0, MARKDOWN.byteLength - 1), headers: { 'content-type': 'text/markdown' } } });
    await expectFailsClosed(markdownRelease(), storage, 'LENGTH', 1);
    expect(storage.calls.every((call) => call.closed)).toBe(true);
  });

  it('LENGTH: a body longer than expected is cut at the first chunk past the expected length and cancelled', async () => {
    const expectedChunks = chunked(MARKDOWN);
    const extra = Array.from({ length: 200 }, () => Buffer.alloc(CHUNK_BYTES, 0x62));
    const storage = stubStorage({ [MARKDOWN_PATH]: { chunks: [...expectedChunks, ...extra], headers: { 'content-type': 'text/markdown' } } });
    await expectFailsClosed(markdownRelease(), storage, 'LENGTH', 1);
    for (const call of storage.calls) {
      expect(call.cancelled).toBe(true);
      expect(call.pulls).toBe(expectedChunks.length + 1);
      expect(call.pulledBytes).toBeLessThanOrEqual(MARKDOWN.byteLength + CHUNK_BYTES);
    }
    // One byte too many is enough, and the exact length is accepted.
    const oneMore = stubStorage({ [MARKDOWN_PATH]: { chunks: [...expectedChunks, Buffer.from([0x0a])], headers: { 'content-type': 'text/markdown' } } });
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), markdownRelease())), 'LENGTH');
    expect(oneMore.calls[0].cancelled).toBe(true);
    stubStorage({ [MARKDOWN_PATH]: { chunks: expectedChunks, headers: { 'content-type': 'text/markdown' } } });
    expect((await getVerifiedPrivateRelease(await allowedReader(), markdownRelease())).markdown).toBe(MARKDOWN.toString('utf8'));
  });

  it('SHA256: bytes of the expected length that are not the bound bytes', async () => {
    const altered = Buffer.from(MARKDOWN);
    altered[10] ^= 0x01;
    const storage = stubStorage({ [MARKDOWN_PATH]: { bytes: altered } });
    await expectFailsClosed(markdownRelease(), storage, 'SHA256', 1);
    errorLog.mockClear();
    const swapped = stubStorage({ ...healthyObjects(FIGURES), [figurePath(FIGURES[2].file)]: { bytes: png(42, 32, 0x44) } });
    await expectFailsClosed(figureRelease(), swapped, 'SHA256', 1 + FIGURES.length);
  });

  it.each([
    ['a byte order mark', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), MARKDOWN])],
    ['a carriage return', Buffer.from('Synthetic line one\r\nSynthetic line two\n', 'utf8')],
    ['a lone carriage return', Buffer.from('Synthetic line one\rSynthetic line two\n', 'utf8')],
    ['bytes that are not UTF-8', Buffer.concat([MARKDOWN, Buffer.from([0xc3, 0x28, 0x0a])])],
  ])('ENCODING: Markdown with %s is refused although its hash is the bound hash', async (_title, bytes) => {
    const storage = stubStorage(healthyObjects([], bytes));
    await expectFailsClosed(markdownRelease(bytes), storage, 'ENCODING', 1);
  });

  it('ENCODING: accepts UTF-8 text with line feeds only, beyond ASCII', async () => {
    const text = Buffer.from(`Synthetic text ${String.fromCharCode(0xe9, 0x4e2d)}\n`, 'utf8');
    stubStorage(healthyObjects([], text));
    expect((await getVerifiedPrivateRelease(await allowedReader(), markdownRelease(text))).markdown).toBe(text.toString('utf8'));
  });

  it.each([
    ['a wrong signature', (() => { const bytes = png(40, 30, 0x41); bytes[0] = 0x88; return { ...FIGURES[0], bytes }; })()],
    ['a first chunk that is not IHDR', (() => { const bytes = png(40, 30, 0x41); bytes.write('IDAT', 12, 'ascii'); return { ...FIGURES[0], bytes }; })()],
    ['fewer bytes than a PNG header', { ...FIGURES[0], bytes: png(40, 30, 0x41).subarray(0, 23) }],
    ['another width', { ...FIGURES[0], width: 41 }],
    ['another height', { ...FIGURES[0], height: 31 }],
  ])('IMAGE_FORM: a figure with %s is refused although its hash is the bound hash', async (_title, figure) => {
    const figures = [figure, FIGURES[1]];
    const storage = stubStorage(healthyObjects(figures));
    await expectFailsClosed(figureRelease(figures), storage, 'IMAGE_FORM', 1 + figures.length);
  });

  it('IMAGE_FORM: accepts a figure whose header carries the declared size', async () => {
    const storage = stubStorage(healthyObjects([FIGURES[0]]));
    expect((await getVerifiedPrivateRelease(await allowedReader(), figureRelease([FIGURES[0]]))).figureFiles.length).toBe(1);
    expect(storage.calls.every((call) => call.closed)).toBe(true);
  });

  it('aborts every read still in flight when one figure fails', async () => {
    const objects = healthyObjects(FIGURES);
    const stalled: ObjectPlan = { chunks: chunked(FIGURES[0].bytes).slice(0, 1), stall: 'body', headers: { 'content-type': 'image/png' } };
    const storage = stubStorage({
      ...objects,
      [figurePath(FIGURES[0].file)]: stalled,
      [figurePath(FIGURES[1].file)]: { status: 500, bytes: Buffer.from(BODY_MARKER), headers: { 'content-type': 'text/plain' } },
      [figurePath(FIGURES[2].file)]: stalled,
    });
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), figureRelease())), 'STATUS');
    const inFlight = storage.calls.filter((call) => call.objectPath === figurePath(FIGURES[0].file) || call.objectPath === figurePath(FIGURES[2].file));
    expect(inFlight).toHaveLength(2);
    for (const call of inFlight) {
      expect(call.init?.signal?.aborted).toBe(true);
      expect(call.errored).toBe(true);
    }
    expect(loggedLines()).toEqual([logLine('STATUS')]);
  });
});

describe('getVerifiedPrivateRelease: deadlines', () => {
  it('DEADLINE: a request that is not answered within the object deadline is aborted', async () => {
    vi.useFakeTimers();
    const deadlines = controllableDeadlines();
    const storage = stubStorage({ [MARKDOWN_PATH]: { stall: 'fetch' } });
    const outcome = vi.fn();
    void failureOf(getVerifiedPrivateRelease(await allowedReader(), markdownRelease())).then(outcome);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(outcome).not.toHaveBeenCalled();
    expect(storage.calls[0].init?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toHaveBeenCalledTimes(1);
    expectUnavailable(outcome.mock.calls[0][0], 'DEADLINE');
    expect(storage.calls[0].init?.signal?.aborted).toBe(true);
    // One deadline for the session lookup, one release deadline for the load, one object deadline for its one object.
    expect(deadlines.map((deadline) => deadline.ms)).toEqual([OBJECT_DEADLINE_MS, RELEASE_DEADLINE_MS, OBJECT_DEADLINE_MS]);
    expect(loggedLines()).toEqual([logLine('DEADLINE')]);
  });

  it('DEADLINE: a session lookup that never settles ends at the object deadline, before any request, and is not kept', async () => {
    vi.useFakeTimers();
    controllableDeadlines();
    const storage = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, headers: { 'content-type': 'text/markdown' } } });
    const release = markdownRelease();
    const hung = sessionClient({ getSession: () => new Promise(() => undefined) });
    const outcome = vi.fn();
    void failureOf(getVerifiedPrivateRelease(await requirePaperReader(hung.client), release)).then(outcome);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(outcome).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toHaveBeenCalledTimes(1);
    expectUnavailable(outcome.mock.calls[0][0], 'DEADLINE');
    expect(hung.getSession).toHaveBeenCalledTimes(1);
    expect(storage.calls).toHaveLength(0);
    expect(loggedLines()).toEqual([logLine('DEADLINE')]);
    // The failed load left nothing behind: the next reader, with a session that answers, is served.
    expect((await getVerifiedPrivateRelease(await allowedReader(), release)).markdown.length).toBeGreaterThan(0);
    expect(storage.calls).toHaveLength(1);
  });

  it('DEADLINE: a body that stops arriving is aborted at the object deadline, and nothing of it is kept', async () => {
    vi.useFakeTimers();
    controllableDeadlines();
    const storage = stubStorage({ [MARKDOWN_PATH]: { chunks: chunked(MARKDOWN).slice(0, 3), stall: 'body', headers: { 'content-type': 'text/markdown' } } });
    const release = markdownRelease();
    const reader = await allowedReader();
    const outcome = vi.fn();
    void failureOf(getVerifiedPrivateRelease(reader, release)).then(outcome);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(outcome).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expectUnavailable(outcome.mock.calls[0][0], 'DEADLINE');
    expect(storage.calls[0].errored).toBe(true);
    // The next call reads again, and an answer in time is accepted.
    const healthy = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, delayMs: OBJECT_DEADLINE_MS - 1 } });
    const loaded = vi.fn();
    void getVerifiedPrivateRelease(reader, release).then(loaded);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(loaded).toHaveBeenCalledTimes(1);
    expect(loaded.mock.calls[0][0].markdown).toBe(MARKDOWN.toString('utf8'));
    expect(healthy.calls).toHaveLength(1);
  });

  it('DEADLINE: each object has its own deadline, and the release deadline covers every read of the load', async () => {
    vi.useFakeTimers();
    const deadlines = controllableDeadlines();
    const objects = healthyObjects(FIGURES);
    const storage = stubStorage({ ...objects, [MARKDOWN_PATH]: { bytes: MARKDOWN, delayMs: 10_000 }, [figurePath(FIGURES[1].file)]: { stall: 'fetch' } });
    const outcome = vi.fn();
    void failureOf(getVerifiedPrivateRelease(await allowedReader(), figureRelease())).then(outcome);
    // The Markdown answers at 10 s. The figures are then requested, with fresh object deadlines.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(storage.calls).toHaveLength(1 + FIGURES.length);
    expect(deadlines.map((deadline) => deadline.ms)).toEqual([OBJECT_DEADLINE_MS, RELEASE_DEADLINE_MS, OBJECT_DEADLINE_MS, ...FIGURES.map(() => OBJECT_DEADLINE_MS)]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(outcome).not.toHaveBeenCalled();
    // The release deadline fires: the read still in flight is aborted although its own deadline has not passed.
    const stalledCall = storage.calls.find((call) => call.objectPath === figurePath(FIGURES[1].file)) as StorageCall;
    expect(stalledCall.init?.signal?.aborted).toBe(false);
    expect(deadlines[1].ms).toBe(RELEASE_DEADLINE_MS);
    deadlines[1].controller.abort(new DOMException('The operation timed out.', 'TimeoutError'));
    await vi.advanceTimersByTimeAsync(0);
    expect(stalledCall.init?.signal?.aborted).toBe(true);
    expectUnavailable(outcome.mock.calls[0][0], 'DEADLINE');
  });
});

describe('getVerifiedPrivateRelease: a response the transport decoded (decision A17)', () => {
  const encoded = (bytes: Uint8Array, declared: number): ObjectPlan => ({ bytes, headers: { 'content-type': 'text/markdown', 'content-encoding': 'gzip', 'content-length': String(declared) } });

  it('accepts a gzip-labelled response whose decoded body is exact, whatever length it declares', async () => {
    const storage = stubStorage({ [MARKDOWN_PATH]: encoded(MARKDOWN, 311) });
    expect((await getVerifiedPrivateRelease(await allowedReader(), markdownRelease())).markdown).toBe(MARKDOWN.toString('utf8'));
    expect(storage.calls[0].closed).toBe(true);
    expect(loggedLines()).toEqual([]);
  });

  it('refuses a gzip-labelled response whose decoded body is too long, at the first chunk past the expected length', async () => {
    const tooLong = Buffer.concat([MARKDOWN, Buffer.alloc(50 * CHUNK_BYTES, 0x63)]);
    const storage = stubStorage({ [MARKDOWN_PATH]: encoded(tooLong, 311) });
    await expectFailsClosed(markdownRelease(), storage, 'LENGTH', 1);
    for (const call of storage.calls) {
      expect(call.cancelled).toBe(true);
      expect(call.pulls).toBe(Math.floor(MARKDOWN.byteLength / CHUNK_BYTES) + 1);
    }
  });

  it('refuses a gzip-labelled response whose decoded body is not the bound bytes, and the same declared length on an identity response', async () => {
    const altered = Buffer.from(MARKDOWN);
    altered[0] ^= 0x01;
    expectUnavailable(await failureOf((stubStorage({ [MARKDOWN_PATH]: encoded(altered, 311) }), getVerifiedPrivateRelease(await allowedReader(), markdownRelease()))), 'SHA256');
    const identity = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, headers: { 'content-type': 'text/markdown', 'content-encoding': 'identity', 'content-length': '311' } } });
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), markdownRelease())), 'LENGTH');
    expect(identity.calls[0].pulls).toBe(0);
  });
});

describe('getVerifiedPrivateRelease: the cache', () => {
  it('answers a second call inside the cache time from memory', async () => {
    const storage = stubStorage(healthyObjects(FIGURES));
    const release = figureRelease();
    const first = await getVerifiedPrivateRelease(await allowedReader(), release);
    const second = await getVerifiedPrivateRelease(await allowedReader(), release);
    expect(second).toBe(first);
    expect(storage.calls).toHaveLength(1 + FIGURES.length);
  });

  it('shares one load between concurrent cold calls: each object is requested once', async () => {
    const storage = stubStorage(healthyObjects(FIGURES));
    const release = figureRelease();
    const first = sessionClient();
    const second = sessionClient();
    const readers = [await requirePaperReader(first.client), await requirePaperReader(second.client), await requirePaperReader(first.client)];
    const loaded = await Promise.all(readers.map((reader) => getVerifiedPrivateRelease(reader, release)));
    expect(loaded[1]).toBe(loaded[0]);
    expect(loaded[2]).toBe(loaded[0]);
    expect([...storage.paths()].sort()).toEqual([MARKDOWN_PATH, ...FIGURES.map((figure) => figurePath(figure.file))].sort());
    // Two clients with one token are one session. Each call looked its session up once, and the
    // load, with all its object requests, ran on the one token of the call that started it.
    expect(first.getSession).toHaveBeenCalledTimes(2);
    expect(second.getSession).toHaveBeenCalledTimes(1);
  });

  it('shares a failing load between concurrent callers and then forgets it', async () => {
    const failing = stubStorage({ [MARKDOWN_PATH]: { status: 403, bytes: Buffer.from(BODY_MARKER), headers: { 'content-type': 'text/plain' } } });
    const release = markdownRelease();
    const reader = await allowedReader();
    const failures = await Promise.all([failureOf(getVerifiedPrivateRelease(reader, release)), failureOf(getVerifiedPrivateRelease(reader, release))]);
    for (const failure of failures) expectUnavailable(failure, 'STATUS');
    expect(failing.calls).toHaveLength(1);
    expect(loggedLines()).toEqual([logLine('STATUS')]);
    const healthy = stubStorage(healthyObjects());
    expect((await getVerifiedPrivateRelease(reader, release)).markdown).toBe(MARKDOWN.toString('utf8'));
    expect(healthy.calls).toHaveLength(1);
  });

  it('keys the cache on the release identity: another bound hash is another load', async () => {
    const other = Buffer.from('Another synthetic text\n', 'utf8');
    stubStorage(healthyObjects());
    const first = await getVerifiedPrivateRelease(await allowedReader(), markdownRelease());
    const storage = stubStorage(healthyObjects([], other));
    const second = await getVerifiedPrivateRelease(await allowedReader(), markdownRelease(other));
    expect(storage.calls).toHaveLength(1);
    expect([first.markdown, second.markdown]).toEqual([MARKDOWN.toString('utf8'), other.toString('utf8')]);
  });

  it('drops an entry when the cache time has passed and reads it again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const storage = stubStorage(healthyObjects());
    const release = markdownRelease();
    const reader = await allowedReader();
    const first = await getVerifiedPrivateRelease(reader, release);
    vi.setSystemTime(Date.now() + PRIVATE_RELEASE_CACHE_TTL_MS - 1);
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(first);
    expect(storage.calls).toHaveLength(1);
    vi.setSystemTime(Date.now() + 1);
    const reloaded = await getVerifiedPrivateRelease(reader, release);
    expect(storage.calls).toHaveLength(2);
    expect(reloaded).not.toBe(first);
    expect(reloaded.markdown).toBe(first.markdown);
    // The reloaded entry has a cache time of its own.
    vi.setSystemTime(Date.now() + PRIVATE_RELEASE_CACHE_TTL_MS - 1);
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(reloaded);
    expect(storage.calls).toHaveLength(2);
  });

  it('never answers from an expired entry when the reload fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    stubStorage(healthyObjects());
    const release = markdownRelease();
    const reader = await allowedReader();
    const first = await getVerifiedPrivateRelease(reader, release);
    vi.setSystemTime(Date.now() + PRIVATE_RELEASE_CACHE_TTL_MS);
    const failing = stubStorage({ [MARKDOWN_PATH]: { status: 404, bytes: Buffer.from(BODY_MARKER), headers: { 'content-type': 'text/plain' } } });
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'STATUS');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'STATUS');
    expect(failing.calls).toHaveLength(2);
    const healthy = stubStorage(healthyObjects());
    const reloaded = await getVerifiedPrivateRelease(reader, release);
    expect(healthy.calls).toHaveLength(1);
    expect(reloaded).not.toBe(first);
  });
});

describe('getVerifiedPrivateRelease: every reader is admitted by storage under their own session', () => {
  const firstByteCalls = (storage: StorageStub): StorageCall[] => storage.calls.filter((call) => call.firstByte);
  const refusal = (status: number): ObjectPlan => ({ status, bytes: Buffer.from(`{"message":"${BODY_MARKER} ${OTHER_TOKEN}"}`), headers: { 'content-type': 'application/json' } });
  /** A warm release, loaded by the first reader's own session. */
  async function warm(objects: Record<string, ObjectPlan>, release: PaperRelease): Promise<{ storage: StorageStub; held: Awaited<ReturnType<typeof getVerifiedPrivateRelease>>; first: PaperReader }> {
    const storage = stubStorage(objects);
    const first = await allowedReader();
    const held = await getVerifiedPrivateRelease(first, release);
    return { storage, held, first };
  }

  it('asks storage once, with the second reader\'s own token, for the first byte of the Markdown, then serves the same verified release', async () => {
    const release = figureRelease();
    const { storage, held, first } = await warm(healthyObjects(FIGURES), release);
    expect(storage.calls).toHaveLength(1 + FIGURES.length);
    expect(firstByteCalls(storage)).toHaveLength(0);

    const other = otherClient();
    const reader = await requirePaperReader(other.client);
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(held);
    expect(storage.calls).toHaveLength(1 + FIGURES.length + 1);
    const asked = storage.calls[storage.calls.length - 1];
    expect(asked.firstByte).toBe(true);
    expect(asked.url).toBe(`${BASE_URL}/storage/v1/object/authenticated/${BUCKET}/${MARKDOWN_PATH}`);
    expect(asked.init?.method).toBe('GET');
    // The second reader's own token, never the token of the reader whose session loaded the release.
    expect(asked.init?.headers).toEqual({ Authorization: `Bearer ${OTHER_TOKEN}`, apikey: PUBLISHABLE_KEY, 'Accept-Encoding': 'identity', Range: 'bytes=0-0' });
    expect(asked.init?.redirect).toBe('error');
    expect(asked.init?.cache).toBe('no-store');
    expect(asked.init?.signal).toBeInstanceOf(AbortSignal);
    // One session lookup: the token that names the session is the token the request carried.
    expect(other.getSession).toHaveBeenCalledTimes(1);
    // Every full read carried the first reader's token and no range.
    for (const call of storage.calls.filter((entry) => !entry.firstByte)) expect(call.init?.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, apikey: PUBLISHABLE_KEY, 'Accept-Encoding': 'identity' });

    // Within the cache time the admission is remembered: no request, for either reader.
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(held);
    expect(await getVerifiedPrivateRelease(await requirePaperReader(other.client), release)).toBe(held);
    expect(await getVerifiedPrivateRelease(first, release)).toBe(held);
    expect(storage.calls).toHaveLength(1 + FIGURES.length + 1);
    // One lookup per call to name the session, and no request.
    expect(other.getSession).toHaveBeenCalledTimes(3);
    expect(loggedLines()).toEqual([]);
  });

  it.each([400, 403, 404, 416, 500])('gives a reader storage refuses (%i) nothing of the release in memory, asks again each time, and still serves the first reader', async (status) => {
    const release = markdownRelease();
    const { storage, held, first } = await warm({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: refusal(status) } }, release);
    const other = otherClient();
    const reader = await requirePaperReader(other.client);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'STATUS');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'STATUS');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await requirePaperReader(other.client), release)), 'STATUS');
    // A refusal is not remembered: each call asked storage again, and each refusal body was cancelled unread.
    expect(firstByteCalls(storage)).toHaveLength(3);
    expect(firstByteCalls(storage).map((call) => [call.cancelled, call.pulls, call.pulledBytes])).toEqual([[true, 0, 0], [true, 0, 0], [true, 0, 0]]);
    // One lookup per call.
    expect(other.getSession).toHaveBeenCalledTimes(3);
    expect(loggedLines()).toEqual([logLine('STATUS'), logLine('STATUS'), logLine('STATUS')]);
    // The release is in memory all along, and the reader whose session loaded it is served from it.
    expect(await getVerifiedPrivateRelease(first, release)).toBe(held);
    expect(storage.calls).toHaveLength(1 + 3);
    // Once storage admits the second reader, the same call is served.
    const admitting = stubStorage(healthyObjects());
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(held);
    expect(admitting.calls.map((call) => call.firstByte)).toEqual([true]);
  });

  it.each([
    ['206 with the first byte', undefined],
    ['206 with no body', { status: 206, noBody: true, headers: { 'content-type': 'text/markdown' } }],
    ['200 with the whole object (a range that was not honoured)', { status: 200, bytes: MARKDOWN }],
  ] as const)('accepts %s as an admission and cancels the body unread', async (_title, firstByte) => {
    const release = markdownRelease();
    const { storage, held } = await warm({ [MARKDOWN_PATH]: { bytes: MARKDOWN, ...(firstByte ? { firstByte } : {}) } }, release);
    expect(await getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)).toBe(held);
    const asked = firstByteCalls(storage);
    expect(asked).toHaveLength(1);
    // Nothing of the answer is read or kept: the stream was cancelled before a single pull.
    if (asked[0].opened) expect([asked[0].cancelled, asked[0].pulls, asked[0].pulledBytes]).toEqual([true, 0, 0]);
    expect(asked[0].opened).toBe(firstByte === undefined || !('noBody' in firstByte));
    expect(loggedLines()).toEqual([]);
  });

  it('asks again when the admission is older than the cache time, and not before', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const release = markdownRelease();
    const { storage, first } = await warm(healthyObjects(), release);
    vi.setSystemTime(Date.now() + 1);
    const reader = await requirePaperReader(otherClient().client);
    await getVerifiedPrivateRelease(reader, release);
    expect(firstByteCalls(storage)).toHaveLength(1);
    // At the release's cache time the first reader's session reads it again; the second reader's
    // admission is one millisecond younger and still holds.
    vi.setSystemTime(Date.now() + PRIVATE_RELEASE_CACHE_TTL_MS - 1);
    const reloaded = await getVerifiedPrivateRelease(first, release);
    expect(storage.calls.filter((call) => !call.firstByte)).toHaveLength(2);
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(reloaded);
    expect(firstByteCalls(storage)).toHaveLength(1);
    // One millisecond later the admission has expired: storage is asked again, once, and the answer is remembered anew.
    vi.setSystemTime(Date.now() + 1);
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(reloaded);
    expect(firstByteCalls(storage)).toHaveLength(2);
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(reloaded);
    vi.setSystemTime(Date.now() + PRIVATE_RELEASE_CACHE_TTL_MS - 2);
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(reloaded);
    expect(firstByteCalls(storage)).toHaveLength(2);
    expect(storage.calls.filter((call) => !call.firstByte)).toHaveLength(2);
  });

  it('never serves an expired admission when storage now refuses the reader', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const release = markdownRelease();
    const { held, first } = await warm(healthyObjects(), release);
    vi.setSystemTime(Date.now() + 1);
    const reader = await requirePaperReader(otherClient().client);
    expect(await getVerifiedPrivateRelease(reader, release)).toBe(held);
    vi.setSystemTime(Date.now() + PRIVATE_RELEASE_CACHE_TTL_MS - 1);
    const reloaded = await getVerifiedPrivateRelease(first, release);
    vi.setSystemTime(Date.now() + 1);
    const refusing = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: refusal(403) } });
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'STATUS');
    expect(refusing.calls.map((call) => call.firstByte)).toEqual([true]);
    expect(await getVerifiedPrivateRelease(first, release)).toBe(reloaded);
  });

  it('shares one first-byte request between concurrent calls of the same reader, and asks nothing of the reader that is loading', async () => {
    const release = figureRelease();
    const { storage, held } = await warm(healthyObjects(FIGURES), release);
    const other = otherClient();
    const readers = [await requirePaperReader(other.client), await requirePaperReader(other.client), await requirePaperReader(otherClient().client)];
    const served = await Promise.all(readers.map((reader) => getVerifiedPrivateRelease(reader, release)));
    expect(served.every((assets) => assets === held)).toBe(true);
    expect(firstByteCalls(storage)).toHaveLength(1);

    // Cold: two concurrent calls of the same session (one token) are one load and no first-byte request.
    resetPrivateReleaseCacheForTests();
    const cold = stubStorage(healthyObjects(FIGURES));
    const sameUser = [await allowedReader(), await allowedReader()];
    const loaded = await Promise.all(sameUser.map((reader) => getVerifiedPrivateRelease(reader, release)));
    expect(loaded[1]).toBe(loaded[0]);
    expect(cold.calls.map((call) => call.firstByte)).toEqual([false, ...FIGURES.map(() => false)]);
  });

  it('admits another reader who arrives while the first reader is still loading with one first-byte request of their own', async () => {
    const release = figureRelease();
    const storage = stubStorage(healthyObjects(FIGURES));
    const loading = getVerifiedPrivateRelease(await allowedReader(), release);
    const arriving = getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release);
    const [held, served] = await Promise.all([loading, arriving]);
    expect(served).toBe(held);
    expect(storage.calls.filter((call) => !call.firstByte)).toHaveLength(1 + FIGURES.length);
    expect(firstByteCalls(storage).map((call) => (call.init?.headers as Record<string, string>).Authorization)).toEqual([`Bearer ${OTHER_TOKEN}`]);
  });

  it('gives a reader storage refuses nothing of a release that is still loading, and the load is not disturbed', async () => {
    const release = markdownRelease();
    const storage = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: refusal(403) } });
    const first = await allowedReader();
    const loading = getVerifiedPrivateRelease(first, release);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)), 'STATUS');
    expect((await loading).markdown).toBe(MARKDOWN.toString('utf8'));
    expect(storage.calls.map((call) => call.firstByte).sort()).toEqual([false, true]);
  });

  it('DEADLINE: a first-byte request that is not answered ends at the object deadline and is not remembered', async () => {
    vi.useFakeTimers();
    const release = markdownRelease();
    const { held } = await warm(healthyObjects(), release);
    const deadlines = controllableDeadlines();
    const hung = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: { stall: 'fetch' } } });
    const reader = await requirePaperReader(otherClient().client);
    const outcome = vi.fn();
    void failureOf(getVerifiedPrivateRelease(reader, release)).then(outcome);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(outcome).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expectUnavailable(outcome.mock.calls[0][0], 'DEADLINE');
    // One deadline for the session lookup and one for the first-byte request.
    expect(deadlines.map((deadline) => deadline.ms)).toEqual([OBJECT_DEADLINE_MS, OBJECT_DEADLINE_MS]);
    expect(hung.calls.map((call) => [call.firstByte, call.init?.signal?.aborted])).toEqual([[true, true]]);
    expect(loggedLines()).toEqual([logLine('DEADLINE')]);
    // Not remembered either way: the next call asks again, and an answer in time is accepted.
    const answering = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, delayMs: OBJECT_DEADLINE_MS - 1 } });
    const served = vi.fn();
    void getVerifiedPrivateRelease(reader, release).then(served);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(served.mock.calls[0][0]).toBe(held);
    expect(answering.calls.map((call) => call.firstByte)).toEqual([true]);
  });

  it('DEADLINE: a transport that neither answers nor honours its abort still ends the call at the object deadline, for a read and for a first-byte request', async () => {
    vi.useFakeTimers();
    controllableDeadlines();
    const release = markdownRelease();
    // A read: the request is made, is never answered, and does not reject when it is aborted.
    const deafRead = stubStorage({ [MARKDOWN_PATH]: { stall: 'fetch-deaf' } });
    const readOutcome = vi.fn();
    void failureOf(getVerifiedPrivateRelease(await allowedReader(), release)).then(readOutcome);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(readOutcome).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expectUnavailable(readOutcome.mock.calls[0]?.[0], 'DEADLINE');
    expect(deafRead.calls.map((call) => [call.firstByte, call.init?.signal?.aborted])).toEqual([[false, true]]);
    // A first-byte request, the same way: the release is in memory, and this reader gets none of it.
    const { held, first } = await warm(healthyObjects(), release);
    const deafAdmission = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: { stall: 'fetch-deaf' } } });
    const admissionOutcome = vi.fn();
    void failureOf(getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)).then(admissionOutcome);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(admissionOutcome).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expectUnavailable(admissionOutcome.mock.calls[0]?.[0], 'DEADLINE');
    expect(deafAdmission.calls.map((call) => [call.firstByte, call.init?.signal?.aborted])).toEqual([[true, true]]);
    expect(loggedLines()).toEqual([logLine('DEADLINE'), logLine('DEADLINE')]);
    // Nothing was kept of either: the loading reader is served, and the other is asked again.
    expect(await getVerifiedPrivateRelease(first, release)).toBe(held);
    const answering = stubStorage(healthyObjects());
    expect(await getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)).toBe(held);
    expect(answering.calls.map((call) => call.firstByte)).toEqual([true]);
  });

  it('DEADLINE: a second reader whose session lookup never settles is refused at the object deadline, before any request', async () => {
    vi.useFakeTimers();
    const release = markdownRelease();
    const { storage, held } = await warm(healthyObjects(), release);
    const deadlines = controllableDeadlines();
    const stuck = otherClient({ getSession: () => new Promise(() => {}) });
    const outcome = vi.fn();
    void failureOf(getVerifiedPrivateRelease(await requirePaperReader(stuck.client), release)).then(outcome);
    await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS - 1);
    expect(outcome).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expectUnavailable(outcome.mock.calls[0][0], 'DEADLINE');
    expect(firstByteCalls(storage)).toHaveLength(0);
    // The lookup that hung was the one that names the session: one lookup, one deadline, one log line.
    expect(stuck.getSession).toHaveBeenCalledTimes(1);
    expect(deadlines.map((deadline) => deadline.ms)).toEqual([OBJECT_DEADLINE_MS]);
    expect(loggedLines()).toEqual([logLine('DEADLINE')]);
    // The same user with a session that answers is asked and admitted: the failure left nothing behind.
    expect(await getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)).toBe(held);
    expect(firstByteCalls(storage)).toHaveLength(1);
  });

  it.each([
    ['SESSION: no session', 'SESSION', { getSession: async () => ({ data: { session: null }, error: null }) }, {}, 0],
    ['SESSION: a session lookup that throws', 'SESSION', { getSession: async () => { throw new Error(`cookies ${OTHER_TOKEN}`); } }, {}, 0],
    ['TRANSPORT: the request fails', 'TRANSPORT', {}, { fetchRejects: new TypeError(`fetch failed ${BASE_URL} ${OTHER_TOKEN}`) }, 1],
  ] as const)('%s on the first-byte request: nothing is served, nothing is remembered', async (_title, code, clientOptions, firstByte, requestsPerAttempt) => {
    const release = markdownRelease();
    const { storage, held, first } = await warm({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte } }, release);
    const failing = otherClient(clientOptions);
    const reader = await requirePaperReader(failing.client);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), code);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), code);
    // One lookup per attempt, whether it fails at the lookup or at the request that carries its token.
    expect(failing.getSession).toHaveBeenCalledTimes(2);
    expect(firstByteCalls(storage)).toHaveLength(2 * requestsPerAttempt);
    expect(loggedLines()).toEqual([logLine(code), logLine(code)]);
    expect(await getVerifiedPrivateRelease(first, release)).toBe(held);
    // The same user, with a working session against a storage that answers, is admitted.
    stubStorage(healthyObjects());
    expect(await getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)).toBe(held);
  });

  it('CONFIGURATION: a missing storage address refuses the second reader although the release is in memory', async () => {
    const release = markdownRelease();
    const { storage, held, first } = await warm(healthyObjects(), release);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)), 'CONFIGURATION');
    expect(firstByteCalls(storage)).toHaveLength(0);
    expect(await getVerifiedPrivateRelease(first, release)).toBe(held);
  });

  it('keeps an admission for one reader and one release: a third reader, and another release, are asked on their own', async () => {
    const release = markdownRelease();
    const { held } = await warm(healthyObjects(), release);
    const admitted = await requirePaperReader(otherClient().client);
    expect(await getVerifiedPrivateRelease(admitted, release)).toBe(held);
    // Storage now refuses everyone: the admitted reader is still served, a third reader is not.
    const refusing = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: refusal(403) } });
    const third = await requirePaperReader(sessionClient({ user: { id: 'reader-user-third', is_anonymous: false }, token: `${OTHER_TOKEN}-third` }).client);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(third, release)), 'STATUS');
    expect(await getVerifiedPrivateRelease(admitted, release)).toBe(held);
    expect(refusing.calls.map((call) => call.firstByte)).toEqual([true]);
    // The admission was for that release: for another one the same reader is asked again.
    const otherText = Buffer.from('Another synthetic text\n', 'utf8');
    const otherRelease = markdownRelease(otherText);
    const second = stubStorage(healthyObjects([], otherText));
    await getVerifiedPrivateRelease(await allowedReader(), otherRelease);
    await getVerifiedPrivateRelease(admitted, otherRelease);
    expect(second.calls.map((call) => call.firstByte)).toEqual([false, true]);
  });

  it('asks a new session of the SAME user for an admission of its own, and gives a refused session nothing although the user\'s other sessions are admitted', async () => {
    const release = markdownRelease();
    const { storage, held, first } = await warm(healthyObjects(), release);
    const authorizations = (stub: StorageStub): string[] => firstByteCalls(stub).map((call) => (call.init?.headers as Record<string, string>).Authorization);
    // The same user id, signed in again: another token, so a session storage has not answered for.
    const renewed = sessionClient({ token: OTHER_TOKEN });
    const renewedReader = await requirePaperReader(renewed.client);
    expect(renewedReader.userId).toBe(first.userId);
    expect(await getVerifiedPrivateRelease(renewedReader, release)).toBe(held);
    expect(authorizations(storage)).toEqual([`Bearer ${OTHER_TOKEN}`]);
    expect(await getVerifiedPrivateRelease(renewedReader, release)).toBe(held);
    expect(firstByteCalls(storage)).toHaveLength(1);

    // A third token of that user, which storage refuses: nothing of the release, twice, with a
    // request each time, although the same user's two other sessions are admitted and warm.
    const refusing = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: refusal(403) } });
    const revoked = await requirePaperReader(sessionClient({ token: `${OTHER_TOKEN}-revoked` }).client);
    expect(revoked.userId).toBe(first.userId);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(revoked, release)), 'STATUS');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(revoked, release)), 'STATUS');
    expect(authorizations(refusing)).toEqual([`Bearer ${OTHER_TOKEN}-revoked`, `Bearer ${OTHER_TOKEN}-revoked`]);
    expect(await getVerifiedPrivateRelease(first, release)).toBe(held);
    expect(await getVerifiedPrivateRelease(renewedReader, release)).toBe(held);
    expect(refusing.calls).toHaveLength(2);
    expect(loggedLines()).toEqual([logLine('STATUS'), logLine('STATUS')]);
  });

  it('treats the same token on another client object as the same session: no request', async () => {
    const release = markdownRelease();
    const { storage, held } = await warm(healthyObjects(), release);
    // The loading session, seen through a second client object (another request of the same sign-in).
    const again = sessionClient();
    expect(await getVerifiedPrivateRelease(await requirePaperReader(again.client), release)).toBe(held);
    expect(storage.calls).toHaveLength(1);
    expect(again.getSession).toHaveBeenCalledTimes(1);
    // An admitted session likewise: admitted once, then recognised on any client that carries its token.
    expect(await getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)).toBe(held);
    expect(firstByteCalls(storage)).toHaveLength(1);
    const sameSession = otherClient();
    expect(await getVerifiedPrivateRelease(await requirePaperReader(sameSession.client), release)).toBe(held);
    expect(firstByteCalls(storage)).toHaveLength(1);
    expect(sameSession.getSession).toHaveBeenCalledTimes(1);
  });

  it('never shows a session token or its fingerprint: not in an error, a log line or the release it returns', async () => {
    const fingerprintOf = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');
    const secrets = [TOKEN, OTHER_TOKEN, fingerprintOf(TOKEN), fingerprintOf(OTHER_TOKEN)];
    const quiet = (['log', 'info', 'warn', 'debug'] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    const release = markdownRelease();
    const { held } = await warm({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: refusal(403) } }, release);
    const failures = [
      await failureOf(getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)),
      await failureOf(getVerifiedPrivateRelease(await requirePaperReader(otherClient({ getSession: async () => ({ data: { session: null }, error: null }) }).client), release)),
      await failureOf(getVerifiedPrivateRelease({ userId: fingerprintOf(OTHER_TOKEN) } as unknown as PaperReader, release)),
    ];
    expect(failures.map((failure) => (failure as { code?: string }).code)).toEqual(['STATUS', 'SESSION', 'PAPER_READER_DENIED']);
    const shown = [
      ...failures.flatMap((failure) => [String(failure), (failure as Error).message, (failure as Error).stack ?? '', JSON.stringify(failure), JSON.stringify(Object.getOwnPropertyNames(failure as object).map((name) => String((failure as Record<string, unknown>)[name]))), String((failure as { cause?: unknown }).cause ?? '')]),
      JSON.stringify(held),
      JSON.stringify(Object.keys(held)),
      ...[errorLog, ...quiet].flatMap((spy) => spy.mock.calls.flat().map(String)),
    ].join('\n');
    for (const secret of secrets) expect(shown.includes(secret)).toBe(false);
    // Positive control for the search itself: the same text with a fingerprint in it is seen.
    expect(`${shown}\n${fingerprintOf(OTHER_TOKEN)}`.includes(secrets[3])).toBe(true);
    expect(loggedLines()).toEqual([logLine('STATUS'), logLine('SESSION')]);
    expect(quiet.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  describe('the session token is read once for the whole call', () => {
    /** A session lookup that answers with `token` the first time and then does `afterwards`: a session that changes while a call runs. */
    const lookups = (token: string, afterwards: () => Promise<unknown>): (() => Promise<unknown>) => {
      let calls = 0;
      return () => {
        calls += 1;
        return calls === 1 ? Promise.resolve({ data: { session: { access_token: token } }, error: null }) : afterwards();
      };
    };
    /** The token the client would answer with after a refresh. Storage is never to see it in a call that began before. */
    const REFRESHED = `${OTHER_TOKEN}-refreshed`;
    const refreshed = async (): Promise<unknown> => ({ data: { session: { access_token: REFRESHED } }, error: null });
    const never = (): Promise<unknown> => new Promise(() => {});
    const noSession = async (): Promise<unknown> => ({ data: { session: null }, error: null });
    const throwing = async (): Promise<unknown> => {
      throw new Error(`cookies ${OTHER_TOKEN}`);
    };
    const authorizations = (calls: readonly StorageCall[]): string[] => calls.map((call) => (call.init?.headers as Record<string, string>).Authorization);

    it('a cold load sends the token that names the session on every request, although the client would answer with a refreshed token by then', async () => {
      const storage = stubStorage(healthyObjects(FIGURES));
      const release = figureRelease();
      const refreshing = sessionClient({ getSession: lookups(TOKEN, refreshed) });
      const held = await getVerifiedPrivateRelease(await requirePaperReader(refreshing.client), release);
      expect(refreshing.getSession).toHaveBeenCalledTimes(1);
      expect(storage.calls).toHaveLength(1 + FIGURES.length);
      expect(authorizations(storage.calls)).toEqual(storage.calls.map(() => `Bearer ${TOKEN}`));
      // The recorded loader is the session storage answered: the first token is served with no request ...
      expect(await getVerifiedPrivateRelease(await allowedReader(), release)).toBe(held);
      expect(storage.calls).toHaveLength(1 + FIGURES.length);
      // ... and the refreshed token is a session storage has not answered for: it is asked, under its own token.
      expect(await getVerifiedPrivateRelease(await requirePaperReader(sessionClient({ token: REFRESHED }).client), release)).toBe(held);
      expect(authorizations(firstByteCalls(storage))).toEqual([`Bearer ${REFRESHED}`]);
      expect(loggedLines()).toEqual([]);
    });

    it('an admission is asked with the token that names the session, and is remembered for that token only', async () => {
      const release = markdownRelease();
      const { storage, held } = await warm(healthyObjects(), release);
      const refreshing = otherClient({ getSession: lookups(OTHER_TOKEN, refreshed) });
      expect(await getVerifiedPrivateRelease(await requirePaperReader(refreshing.client), release)).toBe(held);
      expect(refreshing.getSession).toHaveBeenCalledTimes(1);
      expect(authorizations(firstByteCalls(storage))).toEqual([`Bearer ${OTHER_TOKEN}`]);
      // The admission is recorded for the token storage was asked with: that session is recognised, with no request ...
      expect(await getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), release)).toBe(held);
      expect(firstByteCalls(storage)).toHaveLength(1);
      // ... and the refreshed token was never admitted: it is asked on its own, and a refusal gives it nothing.
      const refusing = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: refusal(403) } });
      expectUnavailable(await failureOf(getVerifiedPrivateRelease(await requirePaperReader(otherClient({ token: REFRESHED }).client), release)), 'STATUS');
      expect(authorizations(firstByteCalls(refusing))).toEqual([`Bearer ${REFRESHED}`]);
      expect(loggedLines()).toEqual([logLine('STATUS')]);
    });

    it.each([
      ['never settles', never],
      ['answers with no session', noSession],
      ['throws', throwing],
    ] as const)('a second lookup that %s is never made: a cold load and an admission both complete on the first token', async (_title, afterwards) => {
      const storage = stubStorage(healthyObjects(FIGURES));
      const release = figureRelease();
      const loading = sessionClient({ getSession: lookups(TOKEN, afterwards) });
      const held = await getVerifiedPrivateRelease(await requirePaperReader(loading.client), release);
      expect(loading.getSession).toHaveBeenCalledTimes(1);
      expect(storage.calls).toHaveLength(1 + FIGURES.length);
      const admitted = otherClient({ getSession: lookups(OTHER_TOKEN, afterwards) });
      expect(await getVerifiedPrivateRelease(await requirePaperReader(admitted.client), release)).toBe(held);
      expect(admitted.getSession).toHaveBeenCalledTimes(1);
      expect(authorizations(firstByteCalls(storage))).toEqual([`Bearer ${OTHER_TOKEN}`]);
      expect(loggedLines()).toEqual([]);
    });
  });

  it('still denies a value that only looks like another reader before any request', async () => {
    const release = markdownRelease();
    const { storage } = await warm(healthyObjects(), release);
    const issued = await requirePaperReader(otherClient().client);
    for (const forged of [{ userId: OTHER_USER.id }, { ...issued }, { userId: ALLOWED_USER.id }] as unknown as PaperReader[]) {
      expect(await failureOf(getVerifiedPrivateRelease(forged, release))).toBeInstanceOf(PaperReaderDeniedError);
    }
    expect(storage.calls).toHaveLength(1);
    expect(loggedLines()).toEqual([]);
  });

  it.each([204, 304])('refuses a reader storage answers with %i: only 206 and 200 admit', async (status) => {
    const release = markdownRelease();
    const { storage, held, first } = await warm({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: { status, noBody: true, headers: { 'content-type': 'text/markdown' } } } }, release);
    const reader = await requirePaperReader(otherClient().client);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'STATUS');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), 'STATUS');
    expect(firstByteCalls(storage)).toHaveLength(2);
    expect(loggedLines()).toEqual([logLine('STATUS'), logLine('STATUS')]);
    expect(await getVerifiedPrivateRelease(first, release)).toBe(held);
  });

  it('BUSY: holds a bounded number of first-byte requests open; a new reader past it is told at once, with no request, and is not remembered', async () => {
    // The limit is not exported (MAX_ADMISSIONS_IN_FLIGHT in the boundary). This is its value.
    const LIMIT = 64;
    const release = markdownRelease();
    // Every first-byte request stays unanswered until the test opens it.
    const gates: (() => void)[] = [];
    const pending: ObjectPlan = { status: 206, bytes: MARKDOWN.subarray(0, 1), headers: { 'content-type': 'text/markdown' }, gate: (open) => gates.push(open) };
    const { storage, held } = await warm({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: pending } }, release);
    const clientOf = (index: number): TestClient => sessionClient({ user: { id: `waiting-reader-${index}`, is_anonymous: false }, token: `${OTHER_TOKEN}-${index}` });
    const asked = async (count: number): Promise<void> => {
      await vi.waitFor(() => expect(firstByteCalls(storage)).toHaveLength(count));
    };
    /** Lets what is already settled run, without waiting for anything that is held open. */
    const settled = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

    const waiting: Promise<unknown>[] = [];
    for (let index = 1; index <= LIMIT; index += 1) waiting.push(getVerifiedPrivateRelease(await requirePaperReader(clientOf(index).client), release));
    await asked(LIMIT);

    // One reader more: refused at once, after the one lookup that names the session and before any request.
    const refused = clientOf(LIMIT + 1);
    const refusedReader = await requirePaperReader(refused.client);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(refusedReader, release)), 'BUSY');
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(refusedReader, release)), 'BUSY');
    expect(refused.getSession).toHaveBeenCalledTimes(2);
    expect(firstByteCalls(storage)).toHaveLength(LIMIT);
    expect(loggedLines()).toEqual([logLine('BUSY'), logLine('BUSY')]);

    // A reader whose own admission is already in flight shares it: no refusal and no request.
    const sharing = getVerifiedPrivateRelease(await requirePaperReader(clientOf(10).client), release);
    const sharedOutcome = vi.fn();
    void sharing.then(sharedOutcome, sharedOutcome);
    await settled();
    expect(sharedOutcome).not.toHaveBeenCalled();
    expect(firstByteCalls(storage)).toHaveLength(LIMIT);

    // One admission completes: there is room for one new reader, who is asked and admitted.
    gates[0]();
    expect(await waiting[0]).toBe(held);
    const next = getVerifiedPrivateRelease(await requirePaperReader(clientOf(LIMIT + 2).client), release);
    await asked(LIMIT + 1);
    // Full again: the reader refused before is still refused, and still without a request.
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(refusedReader, release)), 'BUSY');
    expect(firstByteCalls(storage)).toHaveLength(LIMIT + 1);
    gates[LIMIT]();
    expect(await next).toBe(held);

    // BUSY was not remembered: with room again the refused reader is asked, and admitted.
    const later = getVerifiedPrivateRelease(refusedReader, release);
    await asked(LIMIT + 2);
    gates[LIMIT + 1]();
    expect(await later).toBe(held);
    // Three refused calls and the admitted call: one lookup each.
    expect(refused.getSession).toHaveBeenCalledTimes(4);

    // Every request still open is answered: each waiting reader is served, the sharing one too.
    for (const open of gates) open();
    expect((await Promise.all([...waiting, sharing])).every((assets) => assets === held)).toBe(true);
    expect(firstByteCalls(storage)).toHaveLength(LIMIT + 2);
    expect(loggedLines()).toEqual([logLine('BUSY'), logLine('BUSY'), logLine('BUSY')]);
  }, 30_000);

  describe('one account cannot take the whole allowance of waiting admissions', () => {
    // The limit is not exported (MAX_ADMISSIONS_IN_FLIGHT_PER_READER in the boundary). This is its value.
    const PER_READER = 2;
    const CROWDING_USER = Object.freeze({ id: 'crowding-reader', is_anonymous: false });
    let sessions = 0;
    /** A new session (a token never used before) of one user. */
    const sessionOf = (user: { id: string; is_anonymous: boolean }, options: Parameters<typeof sessionClient>[0] = {}): TestClient => {
      sessions += 1;
      return sessionClient({ user, token: `${OTHER_TOKEN}-${user.id}-${sessions}`, ...options });
    };
    const callOf = async (client: TestClient, release: PaperRelease): Promise<unknown> => getVerifiedPrivateRelease(await requirePaperReader(client.client), release);
    /** Storage whose first-byte requests stay open until the test answers them. */
    const gated = (): { readonly storage: StorageStub; readonly gates: (() => void)[] } => {
      const gates: (() => void)[] = [];
      const pending: ObjectPlan = { status: 206, bytes: MARKDOWN.subarray(0, 1), headers: { 'content-type': 'text/markdown' }, gate: (open) => gates.push(open) };
      return { storage: stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: pending } }), gates };
    };
    /** Lets what is already settled run, without waiting for anything that is held open. */
    const settled = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

    /**
     * The user's whole allowance is free: two fresh sessions are both asked and wait, a third is
     * told BUSY at once, and both waiting sessions are served when storage answers.
     */
    async function expectWholeAllowance(user: { id: string; is_anonymous: boolean }, release: PaperRelease, held: unknown): Promise<void> {
      const { storage, gates } = gated();
      const waiting = [callOf(sessionOf(user), release), callOf(sessionOf(user), release)];
      await vi.waitFor(() => expect(firstByteCalls(storage)).toHaveLength(PER_READER));
      expectUnavailable(await failureOf(callOf(sessionOf(user), release)), 'BUSY');
      expect(firstByteCalls(storage)).toHaveLength(PER_READER);
      for (const open of gates) open();
      expect(await Promise.all(waiting)).toEqual([held, held]);
    }

    it('BUSY: a third session of one user is told at once while two of that user\'s sessions wait; another user is still asked and served', async () => {
      const release = markdownRelease();
      const { held } = await warm(healthyObjects(), release);
      const { storage, gates } = gated();
      const first = sessionOf(CROWDING_USER);
      const waiting = [callOf(first, release), callOf(sessionOf(CROWDING_USER), release)];
      await vi.waitFor(() => expect(firstByteCalls(storage)).toHaveLength(2));

      // A third session of that user: refused at once, twice, with one lookup each and no request.
      const third = sessionOf(CROWDING_USER);
      expectUnavailable(await failureOf(callOf(third, release)), 'BUSY');
      expectUnavailable(await failureOf(callOf(third, release)), 'BUSY');
      expect(third.getSession).toHaveBeenCalledTimes(2);
      expect(firstByteCalls(storage)).toHaveLength(2);
      expect(loggedLines()).toEqual([logLine('BUSY'), logLine('BUSY')]);

      // Another user is not held up by them: asked at once, and served when storage answers.
      const bystander = callOf(sessionOf({ id: 'bystander-reader', is_anonymous: false }), release);
      await vi.waitFor(() => expect(firstByteCalls(storage)).toHaveLength(3));
      gates[2]();
      expect(await bystander).toBe(held);

      // A waiting session calling again shares its own request: neither refused nor asked again.
      const sharing = callOf(first, release);
      const sharedOutcome = vi.fn();
      void sharing.then(sharedOutcome, sharedOutcome);
      await settled();
      expect(sharedOutcome).not.toHaveBeenCalled();
      expect(firstByteCalls(storage)).toHaveLength(3);

      // One of the two is answered: now the third session can be asked, and a fourth cannot.
      gates[0]();
      expect(await waiting[0]).toBe(held);
      expect(await sharing).toBe(held);
      const admittedThird = callOf(third, release);
      await vi.waitFor(() => expect(firstByteCalls(storage)).toHaveLength(4));
      expectUnavailable(await failureOf(callOf(sessionOf(CROWDING_USER), release)), 'BUSY');
      expect(firstByteCalls(storage)).toHaveLength(4);
      for (const open of gates) open();
      expect(await Promise.all([waiting[1], admittedThird])).toEqual([held, held]);
      expect(loggedLines()).toEqual([logLine('BUSY'), logLine('BUSY'), logLine('BUSY')]);
    }, 30_000);

    it('gives the allowance back however an admission ends: admitted, refused, failed in transport, or never asked for want of a token', async () => {
      const release = markdownRelease();
      const { held } = await warm(healthyObjects(), release);
      await expectWholeAllowance(CROWDING_USER, release, held);

      // Two at once, each refused by storage.
      stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: refusal(403) } });
      for (const failure of await Promise.all([failureOf(callOf(sessionOf(CROWDING_USER), release)), failureOf(callOf(sessionOf(CROWDING_USER), release))])) expectUnavailable(failure, 'STATUS');
      await expectWholeAllowance(CROWDING_USER, release, held);

      // Two at once, each failing in transport.
      stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: { fetchRejects: new TypeError(`fetch failed ${OTHER_TOKEN}`) } } });
      for (const failure of await Promise.all([failureOf(callOf(sessionOf(CROWDING_USER), release)), failureOf(callOf(sessionOf(CROWDING_USER), release))])) expectUnavailable(failure, 'TRANSPORT');
      await expectWholeAllowance(CROWDING_USER, release, held);

      // Two at once, each with no token: they end at the one lookup, before any request, and take nothing.
      const unasked = stubStorage(healthyObjects());
      const lost = [1, 2].map(() => sessionOf(CROWDING_USER, { getSession: async () => ({ data: { session: null }, error: null }) }));
      for (const failure of await Promise.all(lost.map((client) => failureOf(callOf(client, release))))) expectUnavailable(failure, 'SESSION');
      expect(unasked.calls).toHaveLength(0);
      await expectWholeAllowance(CROWDING_USER, release, held);

      // Calls refused with BUSY took nothing either: three more refusals, and the allowance is still whole.
      const { storage, gates } = gated();
      const waiting = [callOf(sessionOf(CROWDING_USER), release), callOf(sessionOf(CROWDING_USER), release)];
      await vi.waitFor(() => expect(firstByteCalls(storage)).toHaveLength(PER_READER));
      for (let attempt = 0; attempt < 3; attempt += 1) expectUnavailable(await failureOf(callOf(sessionOf(CROWDING_USER), release)), 'BUSY');
      for (const open of gates) open();
      expect(await Promise.all(waiting)).toEqual([held, held]);
      await expectWholeAllowance(CROWDING_USER, release, held);
    }, 30_000);

    it('gives the allowance back when both waiting admissions end at the deadline', async () => {
      vi.useFakeTimers();
      const release = markdownRelease();
      const { held } = await warm(healthyObjects(), release);
      controllableDeadlines();
      // Two requests that are never answered.
      const hung = stubStorage({ [MARKDOWN_PATH]: { bytes: MARKDOWN, firstByte: { stall: 'fetch' } } });
      const outcomes = [vi.fn(), vi.fn()];
      void failureOf(callOf(sessionOf(CROWDING_USER), release)).then(outcomes[0]);
      void failureOf(callOf(sessionOf(CROWDING_USER), release)).then(outcomes[1]);
      await vi.advanceTimersByTimeAsync(0);
      // While both wait the user's allowance is used up.
      expectUnavailable(await failureOf(callOf(sessionOf(CROWDING_USER), release)), 'BUSY');
      await vi.advanceTimersByTimeAsync(OBJECT_DEADLINE_MS);
      for (const outcome of outcomes) expectUnavailable(outcome.mock.calls[0][0], 'DEADLINE');
      expect(firstByteCalls(hung)).toHaveLength(2);
      expect(loggedLines()).toEqual([logLine('BUSY'), logLine('DEADLINE'), logLine('DEADLINE')]);

      // Both ended: two fresh sessions are asked again, a third is refused, and both are served.
      const answering = stubStorage(healthyObjects());
      const served = [vi.fn(), vi.fn()];
      void callOf(sessionOf(CROWDING_USER), release).then(served[0]);
      void callOf(sessionOf(CROWDING_USER), release).then(served[1]);
      await vi.advanceTimersByTimeAsync(0);
      expect(served.map((outcome) => outcome.mock.calls[0]?.[0])).toEqual([held, held]);
      expect(firstByteCalls(answering)).toHaveLength(2);
    });
  });

  it('keeps a bounded number of admissions: past the limit the oldest reader is asked again, a recent one is not', async () => {
    // The limit is not exported (MAX_ADMITTED_READERS in the boundary). This is its value: the test
    // shows that exactly this many admissions are kept, so a changed limit fails here and is seen.
    const LIMIT = 4096;
    const release = markdownRelease();
    const { storage, held } = await warm(healthyObjects(), release);
    const readerOf = (index: number): Promise<PaperReader> => requirePaperReader(sessionClient({ user: { id: `bounded-reader-${index}`, is_anonymous: false }, token: `${OTHER_TOKEN}-${index}` }).client);
    for (let index = 1; index <= LIMIT; index += 1) await getVerifiedPrivateRelease(await readerOf(index), release);
    expect(firstByteCalls(storage)).toHaveLength(LIMIT);
    // Exactly at the limit nothing was forgotten: the oldest reader is not asked again.
    expect(await getVerifiedPrivateRelease(await readerOf(1), release)).toBe(held);
    expect(firstByteCalls(storage)).toHaveLength(LIMIT);
    // One more reader: the oldest admission is forgotten, and only that one.
    await getVerifiedPrivateRelease(await readerOf(LIMIT + 1), release);
    expect(firstByteCalls(storage)).toHaveLength(LIMIT + 1);
    await getVerifiedPrivateRelease(await readerOf(1), release);
    expect(firstByteCalls(storage)).toHaveLength(LIMIT + 2);
    for (const index of [3, LIMIT, LIMIT + 1, 1]) await getVerifiedPrivateRelease(await readerOf(index), release);
    expect(firstByteCalls(storage)).toHaveLength(LIMIT + 2);
    // Asking the first reader again took the place of the then-oldest one, the second.
    await getVerifiedPrivateRelease(await readerOf(2), release);
    expect(firstByteCalls(storage)).toHaveLength(LIMIT + 3);
  }, 60_000);
});

describe('the reader check on a warm cache', () => {
  const DENIED: readonly (readonly [string, Parameters<typeof sessionClient>[0]])[] = [
    ['no user', { user: null }],
    ['an anonymous user', { user: { id: 'reader-user-2', is_anonymous: true } }],
    ['a user with no is_anonymous flag', { user: { id: 'reader-user-2' } }],
    ['a user check that throws', { getUser: async () => { throw new Error('network'); } }],
  ];

  it.each(DENIED)('denies %s although the verified release is in memory', async (_title, options) => {
    const storage = stubStorage(healthyObjects());
    synthetic.release = { bytes: MARKDOWN.byteLength, sha256: sha(MARKDOWN), acceptedFigures: false };
    // Warm, through the request loader, with an allowed reader.
    const allowed = sessionClient();
    expect(await loadPaperStructureForRequest(VERSION, allowed.client)).toBe(synthetic.structure);
    expect(storage.calls).toHaveLength(1);
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(1);

    const denied = sessionClient(options);
    expect(await failureOf(loadPaperStructureForRequest(VERSION, denied.client))).toBeInstanceOf(PaperReaderDeniedError);
    // The order a route uses: the reader check, then the load with the reader it issued.
    expect(await failureOf(requirePaperReader(denied.client).then((reader) => loadPrivatePaperStructure(VERSION, reader)))).toBeInstanceOf(PaperReaderDeniedError);
    expect(await failureOf(loadPrivatePaperStructure(VERSION, { userId: ALLOWED_USER.id } as unknown as PaperReader))).toBeInstanceOf(PaperReaderDeniedError);
    expect(denied.getUser).toHaveBeenCalledTimes(2);
    expect(denied.getSession).not.toHaveBeenCalled();
    expect(storage.calls).toHaveLength(1);

    // An allowed reader is still served from memory, after its own check.
    expect(await loadPaperStructureForRequest(VERSION, allowed.client)).toBe(synthetic.structure);
    expect(await requirePaperReader(allowed.client).then((reader) => loadPrivatePaperStructure(VERSION, reader))).toBe(synthetic.structure);
    expect(allowed.getUser).toHaveBeenCalledTimes(3);
    expect(storage.calls).toHaveLength(1);
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(1);
  });
});

describe('nothing of a credential, an address or an object reaches an error or a log line', () => {
  it('logs one constant line per failed load and nothing for a refused reader', async () => {
    const release = markdownRelease();
    const reader = await allowedReader();
    const altered = Buffer.from(MARKDOWN);
    altered[3] ^= 0x01;
    const plans: readonly (readonly [PrivateReleaseFailureCode, ObjectPlan])[] = [
      ['TRANSPORT', { fetchRejects: new TypeError(`getaddrinfo ENOTFOUND ${BASE_URL} Bearer ${TOKEN}`) }],
      ['STATUS', { status: 403, bytes: Buffer.from(`{"message":"${BODY_MARKER} ${TOKEN}"}`), headers: { 'content-type': 'application/json' } }],
      ['MEDIA_TYPE', { bytes: MARKDOWN, headers: { 'content-type': `text/html; note=${BODY_MARKER}` } }],
      ['LENGTH', { bytes: Buffer.concat([MARKDOWN, Buffer.from(BODY_MARKER)]), headers: { 'content-type': 'text/markdown' } }],
      ['SHA256', { bytes: altered }],
    ];
    for (const [code, plan] of plans) {
      stubStorage({ [MARKDOWN_PATH]: plan });
      expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, release)), code);
    }
    expect(loggedLines()).toEqual(plans.map(([code]) => logLine(code)));
    errorLog.mockClear();
    expect(await failureOf(getVerifiedPrivateRelease({ userId: TOKEN } as unknown as PaperReader, release))).toBeInstanceOf(PaperReaderDeniedError);
    expect(loggedLines()).toEqual([]);
    for (const args of errorLog.mock.calls) for (const marker of MARKERS) expect(String(args[0]).includes(marker)).toBe(false);
  });

  it('reports an unexpected error as unavailable, with a constant line', async () => {
    const storage = stubStorage(healthyObjects());
    synthetic.figures = new Error(`contract ${OBJECT_MARKER} ${TOKEN}`);
    const reader = await allowedReader();
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(reader, markdownRelease(MARKDOWN, { acceptedFigures: true }))), 'TRANSPORT');
    expect(loggedLines()).toEqual([logLine('UNEXPECTED')]);
    expect(storage.calls).toHaveLength(0);
    synthetic.figures = null;
    expect((await getVerifiedPrivateRelease(reader, markdownRelease())).markdown).toBe(MARKDOWN.toString('utf8'));
  });
});

describe('the local directory stands in for storage in a development or test process only', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-private-assets-'));
  const write = (objectPath: string, bytes: Uint8Array): void => {
    const file = path.join(directory, ...objectPath.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  };
  const LOCAL_MARKDOWN = Buffer.from('Synthetic local text\nSecond line\n', 'utf8');
  const STORED_MARKDOWN = Buffer.from('Synthetic store text\nSecond line\n', 'utf8');

  beforeEach(() => {
    write(MARKDOWN_PATH, LOCAL_MARKDOWN);
    for (const figure of FIGURES) write(figurePath(figure.file), figure.bytes);
  });
  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each(['test', 'development'])('NODE_ENV=%s, with the directory set: reads the directory and never calls fetch', async (mode) => {
    vi.stubEnv(PRIVATE_FIXTURE_DIR_ENV, directory);
    vi.stubEnv('NODE_ENV', mode);
    const storage = stubStorage(healthyObjects(FIGURES, STORED_MARKDOWN));
    const local = sessionClient();
    const assets = await getVerifiedPrivateRelease(await requirePaperReader(local.client), figureRelease(FIGURES, LOCAL_MARKDOWN));
    expect(assets.markdown).toBe(LOCAL_MARKDOWN.toString('utf8'));
    expect(assets.figureFiles.length).toBe(FIGURES.length);
    expect(storage.calls).toHaveLength(0);
    // The session is named before the source is chosen: one lookup, and none for a request.
    expect(local.getSession).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['production', 'production'],
    ['staging', 'staging'],
    ['Test (another spelling)', 'Test'],
    ['an empty string', ''],
    ['unset', undefined],
  ])('NODE_ENV %s, with the directory set: reads storage and ignores the directory', async (_title, mode) => {
    vi.stubEnv(PRIVATE_FIXTURE_DIR_ENV, directory);
    vi.stubEnv('NODE_ENV', mode);
    expect(process.env.NODE_ENV).toBe(mode);
    const storage = stubStorage(healthyObjects(FIGURES, STORED_MARKDOWN));
    // The release binds what storage holds; the directory holds other bytes of the same length.
    expect(LOCAL_MARKDOWN.byteLength).toBe(STORED_MARKDOWN.byteLength);
    const assets = await getVerifiedPrivateRelease(await allowedReader(), figureRelease(FIGURES, STORED_MARKDOWN));
    expect(assets.markdown).toBe(STORED_MARKDOWN.toString('utf8'));
    expect(storage.calls).toHaveLength(1 + FIGURES.length);
    // A second reader is admitted by storage, not by the directory.
    await getVerifiedPrivateRelease(await requirePaperReader(otherClient().client), figureRelease(FIGURES, STORED_MARKDOWN));
    expect(storage.calls.map((call) => call.firstByte)).toEqual([false, ...FIGURES.map(() => false), true]);
    // The bytes of the directory are not what such a process answers with.
    resetPrivateReleaseCacheForTests();
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), figureRelease(FIGURES, LOCAL_MARKDOWN))), 'SHA256');
  });

  it('needs a session token even with the directory set: the session is named before the source is chosen', async () => {
    vi.stubEnv(PRIVATE_FIXTURE_DIR_ENV, directory);
    const storage = stubStorage({});
    const release = markdownRelease(LOCAL_MARKDOWN);
    const tokenless = sessionClient({ getSession: async () => ({ data: { session: null }, error: null }) });
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await requirePaperReader(tokenless.client), release)), 'SESSION');
    expect(tokenless.getSession).toHaveBeenCalledTimes(1);
    expect(loggedLines()).toEqual([logLine('SESSION')]);
    // The same directory serves a client that carries a token, and no request is made either way.
    expect((await getVerifiedPrivateRelease(await allowedReader(), release)).markdown).toBe(LOCAL_MARKDOWN.toString('utf8'));
    expect(storage.calls).toHaveLength(0);
  });

  it('verifies local bytes exactly as stored bytes: hash, length, content form and the reader', async () => {
    vi.stubEnv(PRIVATE_FIXTURE_DIR_ENV, directory);
    const storage = stubStorage({});
    const altered = Buffer.from(LOCAL_MARKDOWN);
    altered[4] ^= 0x01;
    write(MARKDOWN_PATH, altered);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), markdownRelease(LOCAL_MARKDOWN))), 'SHA256');
    write(MARKDOWN_PATH, Buffer.concat([LOCAL_MARKDOWN, Buffer.from('\n')]));
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), markdownRelease(LOCAL_MARKDOWN))), 'LOCAL_SOURCE');
    const withCarriageReturn = Buffer.from('Synthetic local text\r\n', 'utf8');
    write(MARKDOWN_PATH, withCarriageReturn);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), markdownRelease(withCarriageReturn))), 'ENCODING');
    write(MARKDOWN_PATH, LOCAL_MARKDOWN);
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await allowedReader(), figureRelease([{ ...FIGURES[0], width: 99 }], LOCAL_MARKDOWN))), 'IMAGE_FORM');
    expect(await failureOf(getVerifiedPrivateRelease({ userId: ALLOWED_USER.id } as unknown as PaperReader, markdownRelease(LOCAL_MARKDOWN)))).toBeInstanceOf(PaperReaderDeniedError);
    expect((await getVerifiedPrivateRelease(await allowedReader(), markdownRelease(LOCAL_MARKDOWN))).markdown).toBe(LOCAL_MARKDOWN.toString('utf8'));
    expect(storage.calls).toHaveLength(0);
  });

  it('admits a second reader through the directory: the Markdown must be there, whole, and no request is made', async () => {
    vi.stubEnv(PRIVATE_FIXTURE_DIR_ENV, directory);
    const storage = stubStorage({});
    const release = markdownRelease(LOCAL_MARKDOWN);
    const first = await allowedReader();
    const held = await getVerifiedPrivateRelease(first, release);
    // The directory no longer holds the object whole: the second reader is refused, the first is still served.
    write(MARKDOWN_PATH, LOCAL_MARKDOWN.subarray(0, LOCAL_MARKDOWN.byteLength - 1));
    const other = otherClient();
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await requirePaperReader(other.client), release)), 'LOCAL_SOURCE');
    fs.rmSync(path.join(directory, ...MARKDOWN_PATH.split('/')));
    expectUnavailable(await failureOf(getVerifiedPrivateRelease(await requirePaperReader(other.client), release)), 'LOCAL_SOURCE');
    expect(await getVerifiedPrivateRelease(first, release)).toBe(held);
    expect(loggedLines()).toEqual([logLine('LOCAL_SOURCE'), logLine('LOCAL_SOURCE')]);
    // With the object back, the same reader is admitted and served.
    write(MARKDOWN_PATH, LOCAL_MARKDOWN);
    expect(await getVerifiedPrivateRelease(await requirePaperReader(other.client), release)).toBe(held);
    expect(storage.calls).toHaveLength(0);
    // Three calls, one lookup each to name the session; the directory needs no token.
    expect(other.getSession).toHaveBeenCalledTimes(3);
  });
});
