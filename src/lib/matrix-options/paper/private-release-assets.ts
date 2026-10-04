import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import { getAcceptedFiguresContract } from './accepted-figures';
import { appendixLSourceMediaContract } from './accepted-source-media';
import { paperReleaseIdentity, type PaperRelease } from './releases';

/*
 * The one server boundary for a `private-storage` release (./releases.ts).
 *
 * A private release's Markdown and figures are not in the repository. They are
 * read from a private storage bucket with the signed-in reader's OWN session,
 * and nothing is parsed or returned until every byte has been verified against
 * the release entry and the figures contract.
 *
 * Rules, all fail closed:
 * 1. requirePaperReader runs FIRST on every path, cached or not: a request with
 *    no user, an anonymous user, or a user check that errored gets nothing. It
 *    is the "signed in, not anonymous" part of the storage read policy. The
 *    policy itself decides too: every reader is admitted by storage under the
 *    reader's own session before being given anything (getVerifiedPrivateRelease),
 *    so a policy that later admits fewer readers is honoured without a change here.
 * 2. Only the allowlisted objects of the release are ever requested: one
 *    Markdown object and the figures contract's asset files. No listing, no
 *    signed URL, no name from a client.
 * 3. Each object is read with a deadline and a byte cap equal to its declared
 *    length, and the body is cancelled on every exit. It is then verified:
 *    exact length, SHA-256, media type, and content form (UTF-8 text with no
 *    BOM and no CR; or a PNG of the declared dimensions).
 * 4. Verified assets are kept in process memory for a short fixed time
 *    (PRIVATE_RELEASE_CACHE_TTL_MS), and so is each reader's admission by
 *    storage. After that time the assets are read again under the current
 *    reader's session, and the new read takes the entry's place at once; a failed
 *    re-read is "unavailable", never stale content.
 *
 * Errors carry a constant code and message. Nothing from an object, a storage
 * response body or a credential is ever put in an error or a log line.
 *
 * The bucket and object names live here and nowhere else in the code.
 */

const PRIVATE_RELEASE_BUCKET = 'matrix-paper-review-assets';

/**
 * The "signed in, not anonymous" condition as the bucket's read policies state
 * it in SQL (they also name the bucket, the object names and the one storage
 * operation this module uses). requirePaperReader is that condition on the
 * application side: a token whose `is_anonymous` claim is anything but `false`
 * reads nothing.
 */
export const PAPER_READER_POLICY_PREDICATE = "COALESCE((auth.jwt() -> 'is_anonymous') = to_jsonb(false), false)";

/** Verified assets are reused for this long, then read and verified again. */
export const PRIVATE_RELEASE_CACHE_TTL_MS = 10 * 60 * 1000;
const OBJECT_DEADLINE_MS = 15_000;
const RELEASE_DEADLINE_MS = 45_000;
/** No allowlisted object may be declared larger than the bucket's own file size limit. */
const MAX_OBJECT_BYTES = 1_048_576;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class PaperReaderDeniedError extends Error {
  readonly code = 'PAPER_READER_DENIED' as const;
  constructor() {
    super('A signed-in, non-anonymous reader is required.');
    this.name = 'PaperReaderDeniedError';
  }
}

export type PrivateReleaseFailureCode =
  | 'NOT_A_PRIVATE_RELEASE'
  | 'CONFIGURATION'
  | 'SESSION'
  | 'TRANSPORT'
  | 'STATUS'
  | 'MEDIA_TYPE'
  | 'LENGTH'
  | 'SHA256'
  | 'ENCODING'
  | 'IMAGE_FORM'
  | 'DEADLINE'
  | 'LOCAL_SOURCE'
  | 'STRUCTURE'
  | 'BUSY';

export class PrivateReleaseUnavailableError extends Error {
  constructor(readonly code: PrivateReleaseFailureCode) {
    super('The private paper release is unavailable.');
    this.name = 'PrivateReleaseUnavailableError';
  }
}

function unavailable(code: PrivateReleaseFailureCode): never {
  throw new PrivateReleaseUnavailableError(code);
}

declare const paperReaderBrand: unique symbol;
/** Proof that requirePaperReader ran for this request. Only that function makes one. */
export interface PaperReader {
  readonly userId: string;
  readonly [paperReaderBrand]: true;
}

/**
 * Every reader this module issued, with the session client it was checked on. A
 * value that merely looks like a reader (a cast, a copy) is not in here and is
 * denied, and a read can only use the client the reader was checked on.
 */
const issuedReaders = new WeakMap<PaperReader, PaperSessionClient>();

/** The part of a Supabase server client this boundary uses. */
export interface PaperSessionClient {
  readonly auth: {
    getUser(): Promise<{ data: { user: { id: string; is_anonymous?: boolean } | null }; error: unknown }>;
    getSession(): Promise<{ data: { session: { access_token: string } | null }; error: unknown }>;
  };
}

/**
 * The signed-in, non-anonymous reader of this request, or a thrown
 * PaperReaderDeniedError. `is_anonymous` must be exactly `false`: a missing
 * flag is a denial, as it is in the storage policy.
 */
export async function requirePaperReader(supabase: PaperSessionClient): Promise<PaperReader> {
  let user: { id: string; is_anonymous?: boolean } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch {
    user = null;
  }
  if (!user || typeof user.id !== 'string' || user.id === '' || user.is_anonymous !== false) throw new PaperReaderDeniedError();
  const reader = Object.freeze({ userId: user.id }) as PaperReader;
  issuedReaders.set(reader, supabase);
  return reader;
}

type PrivateMediaType = 'text/markdown' | 'image/png';

/** One allowlisted object: where it is, and exactly what its bytes must be. */
export interface PrivateReleaseObject {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly mediaType: PrivateMediaType;
}

interface PrivateFigureObject extends PrivateReleaseObject {
  readonly file: string;
  readonly width: number;
  readonly height: number;
}

interface PrivateReleaseCatalog {
  readonly markdown: PrivateReleaseObject;
  readonly figures: readonly PrivateFigureObject[];
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const FIGURE_FILE = /^[A-Za-z0-9-]+\.png$/;

function declaredSize(bytes: number): number {
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_OBJECT_BYTES) unavailable('CONFIGURATION');
  return bytes;
}

/** The allowlist of a private release: derived from its entry and its figures contract, nothing else. */
function privateReleaseCatalog(release: PaperRelease): PrivateReleaseCatalog {
  if (release.delivery !== 'private-storage') unavailable('NOT_A_PRIVATE_RELEASE');
  if (!SHA256_HEX.test(release.sha256)) unavailable('CONFIGURATION');
  const prefix = release.documentVersion;
  const markdown: PrivateReleaseObject = { path: `${prefix}/presentation.md`, bytes: declaredSize(release.bytes), sha256: release.sha256, mediaType: 'text/markdown' };
  const contract = release.acceptedFigures ? getAcceptedFiguresContract(release.documentVersion) : null;
  if (release.acceptedFigures && !contract) unavailable('CONFIGURATION');
  const figures = (contract?.assets ?? []).map((asset): PrivateFigureObject => {
    if (!FIGURE_FILE.test(asset.file) || !SHA256_HEX.test(asset.sha256)) unavailable('CONFIGURATION');
    return { file: asset.file, path: `${prefix}/figures/${asset.file}`, bytes: declaredSize(asset.bytes), sha256: asset.sha256, mediaType: 'image/png', width: asset.width, height: asset.height };
  });
  const sourceMedia = release.documentVersion === 'v0.9.91' ? appendixLSourceMediaContract() : null;
  if (sourceMedia && (!FIGURE_FILE.test(sourceMedia.file) || !SHA256_HEX.test(sourceMedia.sha256))) unavailable('CONFIGURATION');
  if (sourceMedia) figures.push({
    file: sourceMedia.file,
    path: `${prefix}/${sourceMedia.sourceMediaPath}`,
    bytes: declaredSize(sourceMedia.bytes),
    sha256: sourceMedia.sha256,
    mediaType: 'image/png',
    width: sourceMedia.width,
    height: sourceMedia.height,
  });
  if (new Set(figures.map((figure) => figure.file)).size !== figures.length) unavailable('CONFIGURATION');
  return { markdown, figures };
}

/**
 * Where the objects of a private release come from, for ONE reader's session.
 * - `read`: the bytes of one allowlisted object, or a throw. Never more than `object.bytes` bytes.
 * - `admits`: resolves when the source itself lets THIS reader read that object, and throws
 *   otherwise. It returns no content.
 */
export interface PrivateAssetSource {
  read(object: PrivateReleaseObject, signal: AbortSignal): Promise<{ readonly bytes: Uint8Array; readonly mediaType: string | null }>;
  admits(object: PrivateReleaseObject, signal: AbortSignal): Promise<void>;
}

function mediaTypeOf(headerValue: string | null): string | null {
  if (headerValue === null) return null;
  return headerValue.split(';')[0].trim().toLowerCase() || null;
}

/**
 * One GET of one object from the private bucket with the session token it is given:
 * the request the bucket's read policy admits, and the only one this module makes.
 * `firstByteOnly` asks for the first byte alone (a Range request of the same kind).
 * The token is never looked up here: the caller read it once and every request of that
 * call carries that one token.
 */
async function requestStorageObject(accessToken: string, object: PrivateReleaseObject, signal: AbortSignal, firstByteOnly: boolean): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !publishableKey) unavailable('CONFIGURATION');
  const url = `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/authenticated/${PRIVATE_RELEASE_BUCKET}/${object.path.split('/').map(encodeURIComponent).join('/')}`;
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, apikey: publishableKey, 'Accept-Encoding': 'identity', ...(firstByteOnly ? { Range: 'bytes=0-0' } : {}) },
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
  } catch {
    unavailable(signal.aborted ? 'DEADLINE' : 'TRANSPORT');
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The body is already closed or errored: nothing is left open.
  }
}

/**
 * Reads from the private bucket with ONE session token. The response body is
 * consumed through a counting reader that stops at the declared length and is
 * cancelled on every exit, so an oversized or stalled object is never buffered.
 */
function storageSource(accessToken: string): PrivateAssetSource {
  return {
    async admits(object, signal) {
      // Storage's own answer for this token: 206 (or 200 where a range is not honoured)
      // means its read policy admits this session for this object. Nothing of the body is
      // read. A denied read and a missing object both answer "not found".
      const response = await requestStorageObject(accessToken, object, signal, true);
      await cancelResponseBody(response);
      if (response.status !== 206 && response.status !== 200) unavailable('STATUS');
    },
    async read(object, signal) {
      const response = await requestStorageObject(accessToken, object, signal, false);
      const body = response.body;
      const cancelBody = () => cancelResponseBody(response);
      // A denied read and a missing object both answer "not found"; one code covers every non-200.
      if (response.status !== 200 || !body) {
        await cancelBody();
        unavailable('STATUS');
      }
      const encoding = (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase();
      const declaredLength = response.headers.get('content-length');
      if (encoding === 'identity' && declaredLength !== null && declaredLength !== String(object.bytes)) {
        await cancelBody();
        unavailable('LENGTH');
      }
      const reader = body.getReader();
      const collected = new Uint8Array(object.bytes);
      let received = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (received + value.byteLength > object.bytes) unavailable('LENGTH');
          collected.set(value, received);
          received += value.byteLength;
        }
      } catch (error) {
        if (error instanceof PrivateReleaseUnavailableError) throw error;
        unavailable(signal.aborted ? 'DEADLINE' : 'TRANSPORT');
      } finally {
        try {
          await reader.cancel();
        } catch {
          // Already closed.
        }
      }
      if (received !== object.bytes) unavailable('LENGTH');
      return { bytes: collected, mediaType: mediaTypeOf(response.headers.get('content-type')) };
    },
  };
}

/**
 * In a development or test process, and only when the variable names a
 * directory, a local directory may stand in for the bucket so browser tests can
 * run before storage is provisioned. The reader check, the allowlist and the
 * whole verification are unchanged; only where the bytes come from differs. In
 * any other process (a production build, or one that states no mode) this
 * branch does not exist.
 */
async function chooseSource(accessToken: string): Promise<PrivateAssetSource> {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const directory = process.env.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR;
    if (directory) {
      const { localDirectorySource } = await import('./private-release-local-source');
      return localDirectorySource(directory);
    }
  }
  return storageSource(accessToken);
}

/**
 * The same bytes in memory nothing else uses. Never from Node's shared buffer pool: a small
 * pooled copy would share its ArrayBuffer with unrelated buffers, so giving that ArrayBuffer
 * away (as a response body may) would take theirs with it.
 */
function ownCopy(bytes: Uint8Array): Buffer {
  const copy = Buffer.allocUnsafeSlow(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function verifyObject(object: PrivateReleaseObject, bytes: Uint8Array, mediaType: string | null): Buffer {
  if (mediaType !== object.mediaType) unavailable('MEDIA_TYPE');
  if (bytes.byteLength !== object.bytes) unavailable('LENGTH');
  // A copy of its own: what is proven below is what is kept, whatever later happens to the
  // buffer the source handed over.
  const buffer = ownCopy(bytes);
  const digest = createHash('sha256').update(buffer).digest();
  if (!timingSafeEqual(digest, Buffer.from(object.sha256, 'hex'))) unavailable('SHA256');
  return buffer;
}

function decodeMarkdown(buffer: Buffer): string {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) unavailable('ENCODING');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch {
    unavailable('ENCODING');
  }
  if (text.includes('\r')) unavailable('ENCODING');
  return text;
}

function verifyPng(figure: PrivateFigureObject, buffer: Buffer): void {
  if (buffer.byteLength < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE) || buffer.toString('ascii', 12, 16) !== 'IHDR') unavailable('IMAGE_FORM');
  if (buffer.readUInt32BE(16) !== figure.width || buffer.readUInt32BE(20) !== figure.height) unavailable('IMAGE_FORM');
}

/**
 * One verified private release. The figure BYTES are not on this object: they are
 * kept where nothing but copyVerifiedFigure can reach them (below), so no caller,
 * and no renderer that inspects or transfers the values a page awaits, can change
 * or take the verified bytes.
 */
export interface VerifiedPrivateRelease {
  readonly documentVersion: string;
  readonly releaseIdentity: string;
  /** The exact Markdown text (verified length, hash, encoding). */
  readonly markdown: string;
  /** The asset file names whose verified bytes are held, in contract order. */
  readonly figureFiles: readonly string[];
}

/** The verified figure bytes of each verified release, by asset file name. Never handed out: copied. */
const verifiedFigureBytes = new WeakMap<VerifiedPrivateRelease, ReadonlyMap<string, Buffer>>();

/**
 * A fresh copy of one verified figure's bytes, or null when the release holds no
 * such file. A copy each time: the response that sends it may transfer or detach
 * its buffer, and the verified bytes must stay whole for the next request.
 */
export function copyVerifiedFigure(release: VerifiedPrivateRelease, file: string): Buffer | null {
  const held = verifiedFigureBytes.get(release)?.get(file);
  if (!held) return null;
  if (held.byteLength === 0) unavailable('LENGTH');
  return ownCopy(held);
}

/**
 * `work`, or a DEADLINE failure as soon as `signal` aborts. A source hands its signal to
 * everything that takes one, but a step that takes none (reading the session) could otherwise
 * leave a read, and every request waiting on it, pending for ever.
 */
function settledBy<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new PrivateReleaseUnavailableError('DEADLINE'));
    if (signal.aborted) {
      // The work is abandoned; its own failure, if any, has nowhere to go.
      work.catch(() => undefined);
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * Reads one object, proves it, and hands the proven bytes to `keep`. The bytes are a
 * private copy made in the same synchronous step as the proof, and they are given to
 * `keep` instead of being returned: nothing this function resolves with holds them.
 */
async function readVerified(source: PrivateAssetSource, object: PrivateReleaseObject, releaseSignal: AbortSignal, keep: (verified: Buffer) => void): Promise<void> {
  const signal = AbortSignal.any([releaseSignal, AbortSignal.timeout(OBJECT_DEADLINE_MS)]);
  let result: { readonly bytes: Uint8Array; readonly mediaType: string | null };
  try {
    result = await settledBy(source.read(object, signal), signal);
  } catch (error) {
    if (error instanceof PrivateReleaseUnavailableError) throw error;
    unavailable(signal.aborted ? 'DEADLINE' : 'TRANSPORT');
  }
  keep(verifyObject(object, result.bytes, result.mediaType));
}

async function coldLoad(release: PaperRelease, accessToken: string): Promise<VerifiedPrivateRelease> {
  const catalog = privateReleaseCatalog(release);
  const source = await chooseSource(accessToken);
  // One failure ends the whole load: the first object that cannot be read or verified aborts
  // every read still in flight, so no response body is left open behind a failed load.
  const firstFailure = new AbortController();
  const releaseSignal = AbortSignal.any([firstFailure.signal, AbortSignal.timeout(RELEASE_DEADLINE_MS)]);
  try {
    // The Markdown first: when it cannot be read or verified, no figure is requested.
    let markdown: string | null = null;
    await readVerified(source, catalog.markdown, releaseSignal, (verified) => {
      markdown = decodeMarkdown(verified);
    });
    if (markdown === null) unavailable('ENCODING');
    const figuresToRead = catalog.figures;
    const figures = new Map<string, Buffer>();
    await Promise.all(figuresToRead.map((figure) => readVerified(source, figure, releaseSignal, (verified) => {
      verifyPng(figure, verified);
      figures.set(figure.file, verified);
    })));
    const verifiedRelease: VerifiedPrivateRelease = Object.freeze({
      documentVersion: release.documentVersion,
      releaseIdentity: paperReleaseIdentity(release),
      markdown,
      figureFiles: Object.freeze(figuresToRead.map((figure) => figure.file)),
    });
    verifiedFigureBytes.set(verifiedRelease, figures);
    return verifiedRelease;
  } catch (error) {
    firstFailure.abort();
    throw error;
  }
}

interface CacheEntry {
  readonly expiresAt: number;
  readonly assets: Promise<VerifiedPrivateRelease>;
  /** The session (by fingerprint) that is reading, or read, every object of this entry. */
  readonly loadedBy: string;
}

const verifiedReleases = new Map<string, CacheEntry>();

/**
 * The reader's CURRENT session token, looked up ONCE per call. The token is only forwarded
 * to storage, which verifies it; the reader was already validated by requirePaperReader.
 */
async function readSessionToken(supabase: PaperSessionClient): Promise<string> {
  let accessToken: string | undefined;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error) accessToken = data.session?.access_token;
  } catch {
    accessToken = undefined;
  }
  if (!accessToken) unavailable('SESSION');
  return accessToken;
}

/**
 * A name for one session token that reveals nothing of it (its SHA-256). Admissions are
 * kept per session, not per user: a new sign-in, or a token that was replaced, is a session
 * the source has not yet answered for.
 */
function sessionFingerprint(accessToken: string): string {
  return createHash('sha256').update(accessToken, 'utf8').digest('hex');
}

/**
 * Sessions the SOURCE itself has admitted, and until when: `<release identity>` + line
 * feed + `<session fingerprint>` -> expiry. Verified bytes are the same for every reader,
 * so they are shared; the right to be given them is not. A session that did not load the
 * release must first be admitted by the source under that session's own token.
 */
const admittedReaders = new Map<string, number>();
const admissionsInFlight = new Map<string, Promise<void>>();
/** Far above the number of readers; reaching it only forgets the oldest admissions early. */
const MAX_ADMITTED_READERS = 4096;
/** Sessions whose admission may be waiting on storage at one time, in all and for one reader. */
const MAX_ADMISSIONS_IN_FLIGHT = 64;
const MAX_ADMISSIONS_IN_FLIGHT_PER_READER = 2;
/** How many admissions each reader (user id) has waiting: one reader's sessions cannot fill the whole allowance. */
const admissionsInFlightByReader = new Map<string, number>();

function rememberAdmission(admission: string): void {
  // Insertion order is age order: re-inserting moves a reader to the newest end.
  admittedReaders.delete(admission);
  admittedReaders.set(admission, Date.now() + PRIVATE_RELEASE_CACHE_TTL_MS);
  for (const oldest of admittedReaders.keys()) {
    if (admittedReaders.size <= MAX_ADMITTED_READERS) break;
    admittedReaders.delete(oldest);
  }
}

function logUnavailable(error: unknown): PrivateReleaseUnavailableError {
  if (error instanceof PrivateReleaseUnavailableError) {
    console.error(`[matrix-options-paper] private release unavailable: ${error.code}`);
    return error;
  }
  console.error('[matrix-options-paper] private release unavailable: UNEXPECTED');
  return new PrivateReleaseUnavailableError('TRANSPORT');
}

/** Resolves once the source has admitted this session, under the very token that names it, for this release. */
function sourceAdmission(admission: string, release: PaperRelease, accessToken: string, readerId: string): Promise<void> {
  const until = admittedReaders.get(admission);
  if (until !== undefined && until > Date.now()) return Promise.resolve();
  admittedReaders.delete(admission);
  const inFlight = admissionsInFlight.get(admission);
  if (inFlight) return inFlight;
  // Each admission holds one storage request open for up to the object deadline. Past either
  // limit a reader is told to come back, instead of this process opening ever more requests;
  // the per-reader limit keeps one account's sessions from taking the whole allowance.
  const waitingForReader = admissionsInFlightByReader.get(readerId) ?? 0;
  if (admissionsInFlight.size >= MAX_ADMISSIONS_IN_FLIGHT || waitingForReader >= MAX_ADMISSIONS_IN_FLIGHT_PER_READER) {
    return Promise.reject(logUnavailable(new PrivateReleaseUnavailableError('BUSY')));
  }
  const asked: Promise<void> = (async () => {
    const catalog = privateReleaseCatalog(release);
    const source = await chooseSource(accessToken);
    const signal = AbortSignal.timeout(OBJECT_DEADLINE_MS);
    await settledBy(source.admits(catalog.markdown, signal), signal);
    rememberAdmission(admission);
  })().catch((error: unknown) => {
    throw logUnavailable(error);
  }).finally(() => {
    if (admissionsInFlight.get(admission) === asked) {
      admissionsInFlight.delete(admission);
      const left = (admissionsInFlightByReader.get(readerId) ?? 1) - 1;
      if (left > 0) admissionsInFlightByReader.set(readerId, left);
      else admissionsInFlightByReader.delete(readerId);
    }
  });
  admissionsInFlight.set(admission, asked);
  admissionsInFlightByReader.set(readerId, waitingForReader + 1);
  return asked;
}

/**
 * The verified assets of a private release for THIS reader's request. The
 * `reader` must be one requirePaperReader issued, so no caller can reach the
 * cache or the storage without the reader check having run.
 *
 * Every SESSION is admitted by the source under its own token before being
 * given anything: the session that loads the release is admitted by that load;
 * any other session (another reader, or the same reader signed in again), by the
 * source's answer to a first-byte request of the Markdown object with that
 * session's token. An admission is remembered for the cache time, per session,
 * and is asked again after it.
 */
export function getVerifiedPrivateRelease(reader: PaperReader, release: PaperRelease): Promise<VerifiedPrivateRelease> {
  const supabase = issuedReaders.get(reader);
  if (!supabase) return Promise.reject(new PaperReaderDeniedError());
  if (release.delivery !== 'private-storage') return Promise.reject(new PrivateReleaseUnavailableError('NOT_A_PRIVATE_RELEASE'));
  return admittedRelease(release, supabase, reader.userId);
}

async function admittedRelease(release: PaperRelease, supabase: PaperSessionClient, readerId: string): Promise<VerifiedPrivateRelease> {
  // ONE token for the whole call: the session is named by it, and every storage request of
  // this call (a cold load, or an admission) carries it. A token the client refreshes in the
  // meantime is a later call's business, so the session recorded as the loader is always the
  // session storage actually answered.
  let accessToken: string;
  try {
    const signal = AbortSignal.timeout(OBJECT_DEADLINE_MS);
    accessToken = await settledBy(readSessionToken(supabase), signal);
  } catch (error) {
    throw logUnavailable(error);
  }
  const session = sessionFingerprint(accessToken);
  const key = paperReleaseIdentity(release);
  const entry = verifiedReleases.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    const held = entry.assets;
    // The same session's own load (finished or still running) is that session's admission.
    if (entry.loadedBy !== session) await sourceAdmission(`${key}\n${session}`, release, accessToken, readerId);
    return held;
  }
  // Absent or expired: the new load takes the entry's place at once (below), so an expired
  // entry is never read again, and a failed re-read removes itself and leaves nothing behind.
  const assets: Promise<VerifiedPrivateRelease> = coldLoad(release, accessToken).catch((error: unknown) => {
    if (verifiedReleases.get(key)?.assets === assets) verifiedReleases.delete(key);
    throw logUnavailable(error);
  });
  // This session's own token reads every object: that is the source's admission of it.
  verifiedReleases.set(key, { expiresAt: Date.now() + PRIVATE_RELEASE_CACHE_TTL_MS, assets, loadedBy: session });
  return assets;
}

/** Test seam only: forget every verified release and every admission. */
export function resetPrivateReleaseCacheForTests(): void {
  verifiedReleases.clear();
  admittedReaders.clear();
  admissionsInFlight.clear();
  admissionsInFlightByReader.clear();
}
