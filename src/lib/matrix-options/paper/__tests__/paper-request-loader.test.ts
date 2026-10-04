import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * The request loader, on a SYNTHETIC private-storage release.
 *
 * The synthetic artifact, its figures contract and its hash-form guide stand in
 * for the bound release exactly as in r5-synthetic-release.test.ts, and two
 * synthetic PNGs stand in for its figures. `fetch` answers with those bytes.
 * The reader check, the storage boundary, the verification and the compiler are
 * the product's own; the compiler is only wrapped so its calls can be counted.
 *
 * The same loader on the real release runs in paper-request-loader.private.test.ts,
 * where the private fixture is.
 */
const synthetic = await vi.hoisted(async () => {
  const { createHash } = await import('node:crypto');
  const sha = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
  const VERSION = 'v0.9.88-r4-presentation-001';
  const anchor = (id: string): string => `<div id="${id}" class="section-anchor"></div>`;
  const png = (width: number, height: number, fill: number): Buffer => {
    const buffer = Buffer.alloc(64, fill);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
    buffer.writeUInt32BE(13, 8);
    buffer.write('IHDR', 12, 'ascii');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
  };
  const HEADING = 'On a synthetic topic';
  const QUESTIONS = Array.from({ length: 12 }, (_, index) => `Synthetic question number ${index + 1}?`);
  const FIGURES = [
    { figureId: '1-1', assetId: 'FIG1-1', sectionAnchor: 'sec-2', caption: 'Figure 1-1. A first synthetic caption.', status: 'SYNTHETIC_ONE', alt: 'A first synthetic description.', bytes: png(40, 30, 0x41), width: 40, height: 30 },
    { figureId: 'A-1', assetId: 'FIGA1', sectionAnchor: 'app-a', caption: 'Figure A-1. A second synthetic caption.', status: 'SYNTHETIC_TWO', alt: 'A second synthetic description.', bytes: png(41, 31, 0x42), width: 41, height: 31 },
  ];
  const block = (figure: (typeof FIGURES)[number]): string[] => [`<!-- MATRIX_FIGURE_PLACEMENT: ${figure.figureId} -->`, '', `[]{#fig-${figure.figureId.toLowerCase()}}${figure.caption}`, '', `**Status: ${figure.status}**`, '', `![${figure.alt}](assets/${figure.assetId}.png)`];
  const lines: readonly string[] = [
    '# Synthetic paper', '', anchor('sec-1'), '', '## 1 Reviewer guide', '', `**${HEADING}**`, '',
    ...QUESTIONS.map((question, index) => `${index + 1}. ${question}`), '',
    anchor('sec-2'), '', '## 2 Figures', '',
    ...block(FIGURES[0]), '',
    anchor('sec-appendices'), '', '# Technical Appendices Compendium', '', anchor('app-a'), '', '## Appendix A: A kept part', '',
    ...block(FIGURES[1]), '',
    'Text.', '',
  ];
  const lineOf = (text: string): number => lines.indexOf(text) + 1;
  const content = lines.join('\n');
  const guideContract = {
    schemaVersion: 'matrix-paper-reviewer-guide-v1',
    releaseIdentity: VERSION,
    sourcePath: `presentation:${VERSION}`,
    predecessorReleaseIdentity: '1.0.11-remediated-7-8-successor-20260918-D',
    questions: QUESTIONS.map((question, index) => ({
      number: index + 1,
      id: `rpq:${VERSION}:q${String(index + 1).padStart(2, '0')}`,
      sourceLines: [lineOf(`${index + 1}. ${question}`), lineOf(`${index + 1}. ${question}`)],
      textSha256: sha(`${HEADING}\n${question}`),
      sectionAnchors: ['sec-1'],
      predecessorEquivalence: 'MATERIALLY_CHANGED_NO_AUTOMATIC_RESPONSE_CARRY_FORWARD',
      predecessorQuestionId: null,
    })),
  };
  const figuresContract = {
    schemaVersion: 'matrix-paper-accepted-figures-v1',
    releaseIdentity: VERSION,
    paperSha256: sha(content),
    sources: { candidateManifestSha256: 'a'.repeat(64), placementRegistrySha256: 'b'.repeat(64), interfaceOverlaySha256: 'c'.repeat(64) },
    assets: FIGURES.map((figure) => ({ id: figure.assetId, file: `${figure.assetId}.png`, sha256: sha(figure.bytes), bytes: figure.bytes.byteLength, width: figure.width, height: figure.height, placementIds: [figure.figureId] })),
    placements: FIGURES.map((figure) => ({ figureId: figure.figureId, assetId: figure.assetId, textSha256: sha(`${figure.caption}\n${figure.status}\n${figure.alt}`), sectionAnchor: figure.sectionAnchor, anchorSource: 'registry', role: 'primary', markerLine: lineOf(`<!-- MATRIX_FIGURE_PLACEMENT: ${figure.figureId} -->`) })),
  };
  return { sha, VERSION, QUESTIONS, FIGURES, lines, content, guideContract, figuresContract, patch: {} as Record<string, unknown> };
});

vi.mock('../contracts/accepted-figures-v0.9.88-r4-presentation-001.json', () => ({ default: synthetic.figuresContract }));
vi.mock('../contracts/reviewer-guide-v0.9.88-r4-presentation-001.json', () => ({ default: synthetic.guideContract }));
vi.mock('../releases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../releases')>();
  return {
    ...actual,
    getPaperRelease: (documentVersion: string | undefined | null) => {
      const release = actual.getPaperRelease(documentVersion);
      return release && release.documentVersion === synthetic.VERSION ? { ...release, ...synthetic.patch } : release;
    },
  };
});
vi.mock('../../revised-paper-structure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../revised-paper-structure')>();
  return { ...actual, compileAuthenticatedRelease: vi.fn(actual.compileAuthenticatedRelease), loadRevisedPaperStructure: vi.fn(actual.loadRevisedPaperStructure) };
});

import { RevisedPaperUnavailableError } from '../../revised-paper';
import { compileAuthenticatedRelease, loadRevisedPaperStructure, type RevisedPaperStructure } from '../../revised-paper-structure';
import { isPrivatePaperRelease, loadPaperStructureForRequest, loadPrivatePaperFigure, loadPrivatePaperStructure } from '../paper-request-loader';
import {
  PaperReaderDeniedError,
  PrivateReleaseUnavailableError,
  requirePaperReader,
  resetPrivateReleaseCacheForTests,
  type PaperReader,
  type PaperSessionClient,
  type PrivateReleaseFailureCode,
} from '../private-release-assets';
import { DEFAULT_PAPER_VERSION, R5_PAPER_VERSION } from '../releases';
import { PRIVATE_FIXTURE_DIR_ENV } from './private-fixture';

const { sha, VERSION, QUESTIONS, FIGURES, lines: LINES, content: CONTENT } = synthetic;
const BOUND_PAPER_SHA256 = synthetic.figuresContract.paperSha256;
const STRUCTURE_LOG = '[matrix-options-paper] private release unavailable: STRUCTURE';
const ALLOWED_USER = Object.freeze({ id: 'reader-user-1', is_anonymous: false });

/** Binds `content` as the release artifact: the table names its length and hash, and the figures contract its hash. */
function bind(content: string): void {
  synthetic.patch = { bytes: Buffer.byteLength(content, 'utf8'), sha256: sha(content), frontMatter: false, headingDepthShift: 0, acceptedFigures: true, contentsHeadingDisplay: null, withheld: { stableSectionId: 'app-l', notice: 'n' } };
  synthetic.figuresContract.paperSha256 = sha(content);
}

/** The synthetic artifact with question 3 reworded: verified bytes whose guide does not resolve. */
const REWORDED = LINES.map((line) => (line === `3. ${QUESTIONS[2]}` ? '3. Synthetic question number 3, reworded?' : line)).join('\n');

interface StorageStub {
  readonly fetch: MockInstance;
  readonly paths: () => string[];
}

/** `fetch`, answering with `content` as the Markdown and the synthetic PNGs as the figures. */
function stubStorage(content: string): StorageStub {
  const objects = new Map<string, { bytes: Buffer; type: string }>([
    [`${VERSION}/presentation.md`, { bytes: Buffer.from(content, 'utf8'), type: 'text/markdown' }],
    ...FIGURES.map((figure) => [`${VERSION}/figures/${figure.assetId}.png`, { bytes: figure.bytes, type: 'image/png' }] as const),
  ]);
  const paths: string[] = [];
  const fetchStub = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    const objectPath = url.slice(url.indexOf(`/${VERSION}/`) + 1);
    paths.push(objectPath);
    const object = objects.get(objectPath);
    if (!object) return new Response('{}', { status: 404 });
    return new Response(new Uint8Array(object.bytes), { status: 200, headers: { 'content-type': object.type, 'content-length': String(object.bytes.byteLength) } });
  });
  vi.stubGlobal('fetch', fetchStub);
  return { fetch: fetchStub, paths: () => paths };
}

interface TestClient {
  readonly client: PaperSessionClient;
  readonly getUser: MockInstance;
  readonly getSession: MockInstance;
}

function sessionClient(user: unknown = ALLOWED_USER): TestClient {
  const getUser = vi.fn(async () => ({ data: { user }, error: null }));
  const getSession = vi.fn(async () => ({ data: { session: { access_token: 'synthetic-token' } }, error: null }));
  return { client: { auth: { getUser, getSession } } as unknown as PaperSessionClient, getUser, getSession };
}

const failureOf = (promise: Promise<unknown>): Promise<unknown> => promise.then(() => 'resolved', (error: unknown) => error);

function expectUnavailable(error: unknown, code: PrivateReleaseFailureCode): void {
  expect(error).toBeInstanceOf(PrivateReleaseUnavailableError);
  expect((error as PrivateReleaseUnavailableError).code).toBe(code);
  expect((error as Error).message).toBe('The private paper release is unavailable.');
}

let errorLog: MockInstance;

beforeEach(() => {
  resetPrivateReleaseCacheForTests();
  bind(CONTENT);
  vi.mocked(compileAuthenticatedRelease).mockClear();
  vi.mocked(loadRevisedPaperStructure).mockClear();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'publishable-key');
  // Where the private fixture is configured it would stand in for storage; these tests read the stub.
  vi.stubEnv(PRIVATE_FIXTURE_DIR_ENV, '');
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  synthetic.patch = {};
  synthetic.figuresContract.paperSha256 = BOUND_PAPER_SHA256;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('loadPaperStructureForRequest: a repository release', () => {
  it('goes to the synchronous loader, with no reader check and no read of storage', async () => {
    const storage = stubStorage(CONTENT);
    const structure = { synthetic: 'repository structure' } as unknown as RevisedPaperStructure;
    vi.mocked(loadRevisedPaperStructure).mockReturnValueOnce(structure).mockReturnValueOnce(structure);
    // Any session, even one a private release would deny: the default release's pages keep the checks they had.
    for (const user of [null, { id: 'reader-user-2', is_anonymous: true }]) {
      const { client, getUser, getSession } = sessionClient(user);
      expect(await loadPaperStructureForRequest(DEFAULT_PAPER_VERSION, client)).toBe(structure);
      expect(getUser).not.toHaveBeenCalled();
      expect(getSession).not.toHaveBeenCalled();
    }
    expect(vi.mocked(loadRevisedPaperStructure).mock.calls).toEqual([[DEFAULT_PAPER_VERSION], [DEFAULT_PAPER_VERSION]]);
    expect(compileAuthenticatedRelease).not.toHaveBeenCalled();
    expect(storage.fetch).not.toHaveBeenCalled();
    expect(isPrivatePaperRelease(DEFAULT_PAPER_VERSION)).toBe(false);
  });

  it('answers an unknown version with the synchronous loader\'s unavailable error, with no reader check', async () => {
    const storage = stubStorage(CONTENT);
    for (const version of ['no-such-version', '', `${R5_PAPER_VERSION}x`]) {
      const { client, getUser } = sessionClient();
      expect(isPrivatePaperRelease(version)).toBe(false);
      expect(await failureOf(loadPaperStructureForRequest(version, client))).toBeInstanceOf(RevisedPaperUnavailableError);
      expect(getUser).not.toHaveBeenCalled();
    }
    expect(storage.fetch).not.toHaveBeenCalled();
  });

  it('is not a private release for the private loaders', async () => {
    const storage = stubStorage(CONTENT);
    const reader = await requirePaperReader(sessionClient().client);
    for (const version of [DEFAULT_PAPER_VERSION, 'no-such-version']) {
      expectUnavailable(await failureOf(loadPrivatePaperStructure(version, reader)), 'NOT_A_PRIVATE_RELEASE');
      expectUnavailable(await failureOf(loadPrivatePaperFigure(version, 'FIG1-1.png', reader)), 'NOT_A_PRIVATE_RELEASE');
    }
    expect(storage.fetch).not.toHaveBeenCalled();
    expect(loadRevisedPaperStructure).not.toHaveBeenCalled();
  });
});

describe('loadPaperStructureForRequest: a private-storage release', () => {
  it('is recognised by its delivery', () => {
    expect(VERSION).toBe(R5_PAPER_VERSION);
    expect(isPrivatePaperRelease(R5_PAPER_VERSION)).toBe(true);
  });

  it.each([
    ['no user', null],
    ['an anonymous user', { id: 'reader-user-2', is_anonymous: true }],
    ['a user with no is_anonymous flag', { id: 'reader-user-2' }],
  ])('denies %s before any byte is read', async (_title, user) => {
    const storage = stubStorage(CONTENT);
    const { client, getUser, getSession } = sessionClient(user);
    expect(await failureOf(loadPaperStructureForRequest(R5_PAPER_VERSION, client))).toBeInstanceOf(PaperReaderDeniedError);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
    expect(storage.fetch).not.toHaveBeenCalled();
    expect(compileAuthenticatedRelease).not.toHaveBeenCalled();
    expect(loadRevisedPaperStructure).not.toHaveBeenCalled();
    // The same request with an allowed reader reads every object and compiles.
    await loadPaperStructureForRequest(R5_PAPER_VERSION, sessionClient().client);
    expect(storage.fetch).toHaveBeenCalledTimes(1 + FIGURES.length);
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(1);
  });

  it('compiles the verified bytes once, and checks the reader on every call', async () => {
    const storage = stubStorage(CONTENT);
    const allowed = sessionClient();
    const structure = await loadPaperStructureForRequest(R5_PAPER_VERSION, allowed.client);
    expect(structure.releaseIdentity).toBe(`matrix-options-paper:${VERSION}:${sha(CONTENT)}`);
    expect(structure.content).toBe(CONTENT);
    expect(structure.manifest.source).toMatchObject({ path: `presentation:${VERSION}`, version: VERSION, sha256: sha(CONTENT), bytes: Buffer.byteLength(CONTENT, 'utf8') });
    expect(structure.manifest.coverage).toEqual({ firstByte: 0, lastByteExclusive: Buffer.byteLength(CONTENT, 'utf8') });
    expect(storage.paths()[0]).toBe(`${VERSION}/presentation.md`);
    expect(await loadPaperStructureForRequest(R5_PAPER_VERSION, allowed.client)).toBe(structure);
    const reader = await requirePaperReader(allowed.client);
    expect(await loadPrivatePaperStructure(R5_PAPER_VERSION, reader)).toBe(structure);
    expect(allowed.getUser).toHaveBeenCalledTimes(3);
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(1);
    expect(storage.fetch).toHaveBeenCalledTimes(1 + FIGURES.length);
    expect(loadRevisedPaperStructure).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    // Warm: a denied reader still gets nothing.
    const denied = sessionClient({ id: 'reader-user-2', is_anonymous: true });
    expect(await failureOf(loadPaperStructureForRequest(R5_PAPER_VERSION, denied.client))).toBeInstanceOf(PaperReaderDeniedError);
    expect(await failureOf(loadPrivatePaperStructure(R5_PAPER_VERSION, { ...reader }))).toBeInstanceOf(PaperReaderDeniedError);
  });

  it('compiles again when the verified bytes are read again', async () => {
    stubStorage(CONTENT);
    const allowed = sessionClient();
    const first = await loadPaperStructureForRequest(R5_PAPER_VERSION, allowed.client);
    resetPrivateReleaseCacheForTests();
    const second = await loadPaperStructureForRequest(R5_PAPER_VERSION, allowed.client);
    expect(second).not.toBe(first);
    expect(second.releaseIdentity).toBe(first.releaseIdentity);
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(2);
  });
});

describe('loadPrivatePaperStructure: verified bytes that do not compile', () => {
  it('makes the release unavailable (STRUCTURE), with one compile attempt for that verified load', async () => {
    bind(REWORDED);
    const storage = stubStorage(REWORDED);
    const allowed = sessionClient();
    const reader = await requirePaperReader(allowed.client);
    expectUnavailable(await failureOf(loadPrivatePaperStructure(R5_PAPER_VERSION, reader)), 'STRUCTURE');
    expectUnavailable(await failureOf(loadPaperStructureForRequest(R5_PAPER_VERSION, allowed.client)), 'STRUCTURE');
    expectUnavailable(await failureOf(loadPrivatePaperStructure(R5_PAPER_VERSION, reader)), 'STRUCTURE');
    // The bytes were verified and are kept: they were read once, compiled once, and the one failure logged once.
    expect(storage.fetch).toHaveBeenCalledTimes(1 + FIGURES.length);
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(1);
    expect(vi.mocked(compileAuthenticatedRelease).mock.results[0].type).toBe('throw');
    expect(errorLog.mock.calls).toEqual([[STRUCTURE_LOG]]);
    // The failure belongs to that verified load only: a new load compiles again.
    resetPrivateReleaseCacheForTests();
    expectUnavailable(await failureOf(loadPrivatePaperStructure(R5_PAPER_VERSION, reader)), 'STRUCTURE');
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(2);
  });

  it('two-sided: the same flow on the matching text compiles', async () => {
    stubStorage(CONTENT);
    const reader = await requirePaperReader(sessionClient().client);
    expect((await loadPrivatePaperStructure(R5_PAPER_VERSION, reader)).content).toBe(CONTENT);
    expect(vi.mocked(compileAuthenticatedRelease).mock.results[0].type).toBe('return');
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('carries nothing of the compiler\'s reason, which names a question, in the error or the log', async () => {
    bind(REWORDED);
    stubStorage(REWORDED);
    const reader = await requirePaperReader(sessionClient().client);
    const error = await failureOf(loadPrivatePaperStructure(R5_PAPER_VERSION, reader));
    const reason = vi.mocked(compileAuthenticatedRelease).mock.results[0].value as Error;
    expect(reason.message).toContain('text SHA-256 3');
    expect(`${String(error)}\n${JSON.stringify(error)}\n${String((error as { cause?: unknown }).cause ?? '')}`).not.toContain('SHA-256 3');
    expect(errorLog.mock.calls).toEqual([[STRUCTURE_LOG]]);
  });
});

describe('loadPrivatePaperFigure', () => {
  it('returns the verified bytes of a bound figure, and null for a file the release does not have', async () => {
    const storage = stubStorage(CONTENT);
    const reader = await requirePaperReader(sessionClient().client);
    for (const figure of FIGURES) {
      const bytes = await loadPrivatePaperFigure(R5_PAPER_VERSION, `${figure.assetId}.png`, reader);
      expect(bytes?.equals(figure.bytes)).toBe(true);
    }
    for (const file of ['FIG9-9.png', 'presentation.md', '', 'fig1-1.png', '../figures/FIG1-1.png', `${VERSION}/figures/FIG1-1.png`]) {
      expect(await loadPrivatePaperFigure(R5_PAPER_VERSION, file, reader)).toBeNull();
    }
    // Only the allowlisted objects were ever requested, once each: a file name from a caller reaches no request.
    expect([...storage.paths()].sort()).toEqual([`${VERSION}/presentation.md`, ...FIGURES.map((figure) => `${VERSION}/figures/${figure.assetId}.png`)].sort());
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(1);
  });

  it('returns nothing from a release whose structure failed, although its figure bytes verified', async () => {
    bind(REWORDED);
    const storage = stubStorage(REWORDED);
    const reader = await requirePaperReader(sessionClient().client);
    expectUnavailable(await failureOf(loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG1-1.png', reader)), 'STRUCTURE');
    expectUnavailable(await failureOf(loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG9-9.png', reader)), 'STRUCTURE');
    expect(storage.fetch).toHaveBeenCalledTimes(1 + FIGURES.length);
    expect(compileAuthenticatedRelease).toHaveBeenCalledTimes(1);
    // Two-sided: the same figure is served when the text compiles.
    resetPrivateReleaseCacheForTests();
    bind(CONTENT);
    stubStorage(CONTENT);
    expect((await loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG1-1.png', reader))?.equals(FIGURES[0].bytes)).toBe(true);
  });

  it('denies a value that only looks like a reader, cold and warm', async () => {
    const storage = stubStorage(CONTENT);
    const reader = await requirePaperReader(sessionClient().client);
    const forged = { userId: reader.userId } as unknown as PaperReader;
    expect(await failureOf(loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG1-1.png', forged))).toBeInstanceOf(PaperReaderDeniedError);
    expect(storage.fetch).not.toHaveBeenCalled();
    expect((await loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG1-1.png', reader))?.byteLength).toBe(FIGURES[0].bytes.byteLength);
    expect(await failureOf(loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG1-1.png', forged))).toBeInstanceOf(PaperReaderDeniedError);
  });

  it('is unavailable when a figure\'s bytes are not the bound bytes, and then so is the structure', async () => {
    stubStorage(CONTENT);
    synthetic.figuresContract.assets[1].sha256 = 'e'.repeat(64);
    try {
      const allowed = sessionClient();
      const reader = await requirePaperReader(allowed.client);
      expectUnavailable(await failureOf(loadPrivatePaperFigure(R5_PAPER_VERSION, 'FIG1-1.png', reader)), 'SHA256');
      expectUnavailable(await failureOf(loadPaperStructureForRequest(R5_PAPER_VERSION, allowed.client)), 'SHA256');
      expect(compileAuthenticatedRelease).not.toHaveBeenCalled();
    } finally {
      synthetic.figuresContract.assets[1].sha256 = sha(FIGURES[1].bytes);
    }
  });
});
