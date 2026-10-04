import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { PrivateReleaseUnavailableError, type PrivateReleaseObject } from '../private-release-assets';
import { getAcceptedFiguresContract } from '../accepted-figures';
import { localDirectorySource } from '../private-release-local-source';

/*
 * The local directory that stands in for the private bucket outside production,
 * on synthetic bytes in a temporary directory.
 *
 * Every refusal is shown beside a read that succeeds, and every refused path
 * names a file that EXISTS with the expected length where the path would lead,
 * so it is the rule under test that refuses it and not a missing file.
 */

const BYTES = Buffer.from('Synthetic local object\nSecond line\n', 'utf8');
const SHA256 = 'a'.repeat(64);
const VERSION_FOLDER = 'v0-synthetic';
const OBJECT: PrivateReleaseObject = { path: `${VERSION_FOLDER}/presentation.md`, bytes: BYTES.byteLength, sha256: SHA256, mediaType: 'text/markdown' };

let base = '';
let root = '';

const live = (): AbortSignal => new AbortController().signal;
const failureOf = (run: () => unknown): Promise<unknown> => Promise.resolve().then(run).then(() => 'resolved', (error: unknown) => error);

function expectRefused(error: unknown): void {
  expect(error).toBeInstanceOf(PrivateReleaseUnavailableError);
  expect((error as PrivateReleaseUnavailableError).code).toBe('LOCAL_SOURCE');
  expect((error as Error).message).toBe('The private paper release is unavailable.');
  // Constant: the error names no directory and no file.
  expect(`${String(error)}\n${JSON.stringify(error)}`.includes(path.basename(base))).toBe(false);
}

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-local-source-'));
  root = path.join(base, 'root');
  fs.mkdirSync(path.join(root, VERSION_FOLDER, 'figures'), { recursive: true });
  fs.mkdirSync(path.join(root, VERSION_FOLDER, 'folder.md'));
  fs.writeFileSync(path.join(root, VERSION_FOLDER, 'presentation.md'), BYTES);
  fs.writeFileSync(path.join(root, VERSION_FOLDER, 'figures', 'FIGS1.png'), BYTES);
  fs.writeFileSync(path.join(root, VERSION_FOLDER, 'longer.md'), Buffer.concat([BYTES, Buffer.from('more\n')]));
  fs.writeFileSync(path.join(root, VERSION_FOLDER, 'shorter.md'), BYTES.subarray(0, BYTES.byteLength - 1));
  // A file of the expected length OUTSIDE the directory, where a parent segment would lead.
  fs.writeFileSync(path.join(base, 'outside.md'), BYTES);
});

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('localDirectorySource', () => {
  it.skipIf(!process.env.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR)('returns the accepted FIGF2 fixture in a Buffer with its exact authenticated bytes', async () => {
    const fixtureRoot = process.env.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR;
    if (!fixtureRoot) throw new Error('The accepted private fixture is required for this regression.');
    const contract = getAcceptedFiguresContract('v0.9.91');
    const figure = contract?.assets.find((asset) => asset.file === 'FIGF2.png');
    if (!figure) throw new Error('The accepted FIGF2 contract entry is required for this regression.');
    const source = localDirectorySource(fixtureRoot);
    const result = await source.read({
      path: `v0.9.91/figures/${figure.file}`,
      bytes: figure.bytes,
      sha256: figure.sha256,
      mediaType: 'image/png',
    }, live());

    expect(Buffer.isBuffer(result.bytes)).toBe(true);
    expect(result.bytes.byteLength).toBe(figure.bytes);
    expect(createHash('sha256').update(result.bytes).digest('hex')).toBe(figure.sha256);
  });

  it('reads an allowlisted object: its exact bytes, reported under the declared media type', async () => {
    const source = localDirectorySource(root);
    const markdown = await source.read(OBJECT, live());
    expect(Buffer.from(markdown.bytes).equals(BYTES)).toBe(true);
    expect(markdown.mediaType).toBe('text/markdown');
    const figure = await source.read({ ...OBJECT, path: `${VERSION_FOLDER}/figures/FIGS1.png`, mediaType: 'image/png' }, live());
    expect(Buffer.from(figure.bytes).equals(BYTES)).toBe(true);
    expect(figure.mediaType).toBe('image/png');
  });

  it('refuses a directory that is not an absolute path', async () => {
    // The relative spelling of the same, existing directory (there is none across two drives).
    const relative = path.relative(process.cwd(), root);
    if (!path.isAbsolute(relative)) {
      expect(fs.existsSync(path.join(relative, VERSION_FOLDER, 'presentation.md'))).toBe(true);
      expectRefused(await failureOf(() => localDirectorySource(relative)));
    }
    expectRefused(await failureOf(() => localDirectorySource(path.join('relative', 'directory'))));
    expectRefused(await failureOf(() => localDirectorySource('.')));
    expectRefused(await failureOf(() => localDirectorySource('')));
    expect(typeof localDirectorySource(root).read).toBe('function');
  });

  it.each([
    ['a parent segment', '../outside.md'],
    ['a parent segment after a folder', `${VERSION_FOLDER}/../../outside.md`],
    ['a parent segment that stays inside', `${VERSION_FOLDER}/figures/../presentation.md`],
    ['a current-directory segment', `${VERSION_FOLDER}/./presentation.md`],
    ['an empty segment', `${VERSION_FOLDER}//presentation.md`],
    ['a leading slash', `/${VERSION_FOLDER}/presentation.md`],
    ['a trailing slash', `${VERSION_FOLDER}/presentation.md/`],
    ['an empty path', ''],
    ['a backslash', `${VERSION_FOLDER}\\presentation.md`],
    ['a backslash parent segment', `${VERSION_FOLDER}\\..\\..\\outside.md`],
    ['a colon', `${VERSION_FOLDER}/presentation.md:stream`],
    ['a drive segment', `C:/${VERSION_FOLDER}/presentation.md`],
  ])('refuses an object path with %s', async (_title, objectPath) => {
    const source = localDirectorySource(root);
    expectRefused(await failureOf(() => source.read({ ...OBJECT, path: objectPath }, live())));
    expect(Buffer.from((await source.read(OBJECT, live())).bytes).equals(BYTES)).toBe(true);
  });

  it('refuses a file whose size is not the declared length, longer or shorter', async () => {
    const source = localDirectorySource(root);
    expectRefused(await failureOf(() => source.read({ ...OBJECT, path: `${VERSION_FOLDER}/longer.md` }, live())));
    expectRefused(await failureOf(() => source.read({ ...OBJECT, path: `${VERSION_FOLDER}/shorter.md` }, live())));
    expectRefused(await failureOf(() => source.read({ ...OBJECT, bytes: OBJECT.bytes - 1 }, live())));
    expectRefused(await failureOf(() => source.read({ ...OBJECT, bytes: OBJECT.bytes + 1 }, live())));
    // The same files are read when the declared length is their own.
    expect((await source.read({ ...OBJECT, path: `${VERSION_FOLDER}/longer.md`, bytes: BYTES.byteLength + 5 }, live())).bytes.byteLength).toBe(BYTES.byteLength + 5);
    expect((await source.read({ ...OBJECT, path: `${VERSION_FOLDER}/shorter.md`, bytes: BYTES.byteLength - 1 }, live())).bytes.byteLength).toBe(BYTES.byteLength - 1);
  });

  it('refuses a file that is not there, and a folder in the place of a file', async () => {
    const source = localDirectorySource(root);
    expectRefused(await failureOf(() => source.read({ ...OBJECT, path: `${VERSION_FOLDER}/absent.md` }, live())));
    expectRefused(await failureOf(() => source.read({ ...OBJECT, path: `${VERSION_FOLDER}/folder.md` }, live())));
    expectRefused(await failureOf(() => localDirectorySource(path.join(base, 'no-such-root')).read(OBJECT, live())));
  });

  it('refuses a read whose signal is aborted', async () => {
    const source = localDirectorySource(root);
    expectRefused(await failureOf(() => source.read(OBJECT, AbortSignal.abort())));
    const controller = new AbortController();
    expect((await source.read(OBJECT, controller.signal)).bytes.byteLength).toBe(BYTES.byteLength);
    controller.abort();
    expectRefused(await failureOf(() => source.read(OBJECT, controller.signal)));
  });

  it.each([
    ['production', 'production'],
    ['staging', 'staging'],
    ['Development (another spelling)', 'Development'],
    ['an empty string', ''],
    ['unset', undefined],
  ])('refuses everything when NODE_ENV is %s', async (_title, mode) => {
    vi.stubEnv('NODE_ENV', mode);
    expect(process.env.NODE_ENV).toBe(mode);
    expectRefused(await failureOf(() => localDirectorySource(root)));
    expectRefused(await failureOf(() => localDirectorySource(root).read(OBJECT, live())));
    expectRefused(await failureOf(() => localDirectorySource(root).admits(OBJECT, live())));
  });

  it.each(['test', 'development'])('is a source when NODE_ENV is exactly %s', async (mode) => {
    vi.stubEnv('NODE_ENV', mode);
    const source = localDirectorySource(root);
    expect((await source.read(OBJECT, live())).bytes.byteLength).toBe(BYTES.byteLength);
    expect(await source.admits(OBJECT, live())).toBeUndefined();
  });
});

describe('localDirectorySource: admits', () => {
  it('admits an object that is there with the declared size, and returns nothing of it', async () => {
    const source = localDirectorySource(root);
    expect(await source.admits(OBJECT, live())).toBeUndefined();
    expect(await source.admits({ ...OBJECT, path: `${VERSION_FOLDER}/figures/FIGS1.png`, mediaType: 'image/png' }, live())).toBeUndefined();
  });

  it('refuses an object that is not there, a folder in its place, and a root that does not exist', async () => {
    const source = localDirectorySource(root);
    expectRefused(await failureOf(() => source.admits({ ...OBJECT, path: `${VERSION_FOLDER}/absent.md` }, live())));
    expectRefused(await failureOf(() => source.admits({ ...OBJECT, path: `${VERSION_FOLDER}/folder.md` }, live())));
    expectRefused(await failureOf(() => localDirectorySource(path.join(base, 'no-such-root')).admits(OBJECT, live())));
    expect(await source.admits(OBJECT, live())).toBeUndefined();
  });

  it('refuses a file whose size is not the declared length, longer or shorter', async () => {
    const source = localDirectorySource(root);
    expectRefused(await failureOf(() => source.admits({ ...OBJECT, path: `${VERSION_FOLDER}/longer.md` }, live())));
    expectRefused(await failureOf(() => source.admits({ ...OBJECT, path: `${VERSION_FOLDER}/shorter.md` }, live())));
    expectRefused(await failureOf(() => source.admits({ ...OBJECT, bytes: OBJECT.bytes - 1 }, live())));
    expectRefused(await failureOf(() => source.admits({ ...OBJECT, bytes: OBJECT.bytes + 1 }, live())));
    // The same files are admitted when the declared length is their own.
    expect(await source.admits({ ...OBJECT, path: `${VERSION_FOLDER}/longer.md`, bytes: BYTES.byteLength + 5 }, live())).toBeUndefined();
    expect(await source.admits({ ...OBJECT, path: `${VERSION_FOLDER}/shorter.md`, bytes: BYTES.byteLength - 1 }, live())).toBeUndefined();
  });

  it.each([
    ['a parent segment', '../outside.md'],
    ['a parent segment after a folder', `${VERSION_FOLDER}/../../outside.md`],
    ['a parent segment that stays inside', `${VERSION_FOLDER}/figures/../presentation.md`],
    ['a current-directory segment', `${VERSION_FOLDER}/./presentation.md`],
    ['an empty segment', `${VERSION_FOLDER}//presentation.md`],
    ['a leading slash', `/${VERSION_FOLDER}/presentation.md`],
    ['a trailing slash', `${VERSION_FOLDER}/presentation.md/`],
    ['an empty path', ''],
    ['a backslash', `${VERSION_FOLDER}\\presentation.md`],
    ['a backslash parent segment', `${VERSION_FOLDER}\\..\\..\\outside.md`],
    ['a colon', `${VERSION_FOLDER}/presentation.md:stream`],
    ['a drive segment', `C:/${VERSION_FOLDER}/presentation.md`],
  ])('refuses an object path with %s', async (_title, objectPath) => {
    const source = localDirectorySource(root);
    expectRefused(await failureOf(() => source.admits({ ...OBJECT, path: objectPath }, live())));
    expect(await source.admits(OBJECT, live())).toBeUndefined();
  });

  it('refuses when the signal is aborted', async () => {
    const source = localDirectorySource(root);
    expectRefused(await failureOf(() => source.admits(OBJECT, AbortSignal.abort())));
    const controller = new AbortController();
    expect(await source.admits(OBJECT, controller.signal)).toBeUndefined();
    controller.abort();
    expectRefused(await failureOf(() => source.admits(OBJECT, controller.signal)));
  });
});
