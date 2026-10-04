import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getAcceptedFiguresContract } from '../accepted-figures';
import { appendixLSourceMediaContract, appendixLSourceMediaMarkdownLine } from '../accepted-source-media';
import { getPaperRelease, R5_PAPER_VERSION, V0991_PAPER_VERSION } from '../releases';
import { assertPrivateFixtureModeContract, privateFixtureModeForLeg } from '../../../../../scripts/verify/matrix-paper-e2e-fixture-mode.mjs';
import {
  privateFigurePath,
  privateFixtureAvailable,
  privateFixtureDirectory,
  privateFixtureRequired,
  privatePresentationPath,
  privateV0991FixtureAvailable,
  privateV0991SourceMediaPath,
  resolvePrivateFixtureState,
  PRIVATE_FIXTURE_DIR_ENV,
} from './private-fixture';

/*
 * The public tests below use only synthetic bytes in memory. Required mode
 * validates the real v0.9.91 source and Appendix L image at helper import,
 * before describe.skipIf can classify the private suite. Never print bytes.
 */

function fileIdentity(file: string): { readonly bytes: number; readonly sha256: string } | null {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    return null;
  }
  return { bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
}

const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

function syntheticFixture() {
  const root = path.resolve('synthetic-private-fixture-does-not-exist');
  const source = Buffer.from([
    ...Array.from({ length: 5075 }, (_, index) => `Synthetic line ${index + 1}`),
    appendixLSourceMediaMarkdownLine(),
  ].join('\n'), 'utf8');
  const image = Buffer.alloc(24);
  image.writeUInt32BE(4, 16);
  image.writeUInt32BE(3, 20);
  const release = { ...getPaperRelease(V0991_PAPER_VERSION)!, bytes: source.byteLength, sha256: sha(source) };
  const sourceMedia = { ...appendixLSourceMediaContract(), bytes: image.byteLength, sha256: sha(image), width: 4, height: 3 };
  const sourcePath = path.join(root, V0991_PAPER_VERSION, 'presentation.md');
  const imagePath = path.join(root, V0991_PAPER_VERSION, sourceMedia.sourceMediaPath);
  const files = new Map([[sourcePath, source], [imagePath, image]]);
  const options = {
    githubActions: false,
    mode: 'required',
    root,
    read: (file: string) => files.get(file) ?? null,
    release,
    sourceMedia,
  };
  return { options, files, source, image, sourcePath, imagePath };
}

describe('private fixture guard', () => {
  it('skips the private suites only by an explicit decision', () => {
    expect(privateFixtureModeForLeg('flags-off')).toBe('skip');
    expect(privateFixtureModeForLeg('authenticated-v16')).toBe('skip');
    expect(privateFixtureModeForLeg('appendix-l-inclusion-only')).toBe('required');
    expect(() => assertPrivateFixtureModeContract({ mode: undefined, githubActions: false, fixturePresent: false, authenticatedProjectEnabled: false })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE must be');
    expect(assertPrivateFixtureModeContract({ mode: 'skip', githubActions: false, fixturePresent: true, authenticatedProjectEnabled: false })).toBe(false);
    expect(assertPrivateFixtureModeContract({ mode: 'required', githubActions: false, fixturePresent: true, authenticatedProjectEnabled: true })).toBe(true);
    expect(() => assertPrivateFixtureModeContract({ mode: 'required', githubActions: false, fixturePresent: false, authenticatedProjectEnabled: true })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE=required, but the private release journeys cannot run');
    expect(() => assertPrivateFixtureModeContract({ mode: 'required', githubActions: false, fixturePresent: true, authenticatedProjectEnabled: false })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE=required, but the authenticated project');
  });

  it('GitHub Actions skip performs no private read, even if a root is supplied', () => {
    let reads = 0;
    const result = resolvePrivateFixtureState({
      githubActions: true,
      mode: 'skip',
      root: path.resolve('private-root-never-opened'),
      read: () => { reads += 1; throw new Error('private read attempted'); },
    });
    expect(result).toEqual({ mode: 'skip', root: null, r5Available: false, v0991Available: false });
    expect(reads).toBe(0);
    expect(() => resolvePrivateFixtureState({ githubActions: true, mode: 'required', root: undefined })).toThrow('GitHub Actions private fixture mode must be skip');
  });

  it('local skip is explicit and performs no private read', () => {
    let reads = 0;
    const result = resolvePrivateFixtureState({ githubActions: false, mode: 'skip', root: path.resolve('unused'), read: () => { reads += 1; return null; } });
    expect(result).toEqual({ mode: 'skip', root: null, r5Available: false, v0991Available: false });
    expect(reads).toBe(0);
  });

  it('rejects unset or unknown local mode and required mode without an absolute root', () => {
    for (const mode of [undefined, '', 'unknown']) {
      expect(() => resolvePrivateFixtureState({ githubActions: false, mode, root: undefined })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE must be required or skip');
    }
    expect(() => resolvePrivateFixtureState({ githubActions: false, mode: 'required', root: undefined })).toThrow('must be an absolute path');
    expect(() => resolvePrivateFixtureState({ githubActions: false, mode: 'required', root: 'relative-root' })).toThrow('must be an absolute path');
  });

  it('accepts a v0.9.91-only required root without enabling legacy R5 suites', () => {
    const fixture = syntheticFixture();
    expect(resolvePrivateFixtureState(fixture.options)).toEqual({ mode: 'required', root: fixture.options.root, r5Available: false, v0991Available: true });
    fixture.files.set(path.join(fixture.options.root, R5_PAPER_VERSION, 'presentation.md'), Buffer.from('Synthetic R5'));
    expect(resolvePrivateFixtureState(fixture.options).r5Available).toBe(true);
  });

  it('refuses required mode when v0.9.91 is absent, even if R5 is present', () => {
    const fixture = syntheticFixture();
    fixture.files.delete(fixture.sourcePath);
    fixture.files.set(path.join(fixture.options.root, R5_PAPER_VERSION, 'presentation.md'), Buffer.from('Synthetic R5'));
    expect(() => resolvePrivateFixtureState(fixture.options)).toThrow('Required v0.9.91 presentation missing');
  });

  it('refuses source mutation, Appendix L marker mutation, and image mutation', () => {
    const fixture = syntheticFixture();
    const changedSource = Buffer.from(fixture.source);
    changedSource[0] = changedSource[0] === 0x58 ? 0x59 : 0x58;
    fixture.files.set(fixture.sourcePath, changedSource);
    expect(() => resolvePrivateFixtureState(fixture.options)).toThrow('presentation identity mismatch');

    fixture.files.set(fixture.sourcePath, Buffer.from(fixture.source.toString('utf8').replace('APPENDIX_L_SOURCE_MEDIA', 'APPENDIX_L_SOURCE_MEDIX')));
    expect(() => resolvePrivateFixtureState(fixture.options)).toThrow('Appendix L marker mismatch');

    fixture.files.set(fixture.sourcePath, fixture.source);
    const changedImage = Buffer.from(fixture.image);
    changedImage[0] ^= 1;
    fixture.files.set(fixture.imagePath, changedImage);
    expect(() => resolvePrivateFixtureState(fixture.options)).toThrow('Appendix L image identity mismatch');
  });

  it('has an absolute fixture root wherever one is required', () => {
    if (!privateFixtureRequired) return;
    expect(process.env[PRIVATE_FIXTURE_DIR_ENV] ?? '', `${PRIVATE_FIXTURE_DIR_ENV} must be set when the fixture is required`).not.toBe('');
    expect(privateFixtureDirectory(), `${PRIVATE_FIXTURE_DIR_ENV} must be an absolute path`).not.toBeNull();
    expect(privateV0991FixtureAvailable).toBe(true);
  });

  it.skipIf(!privateFixtureAvailable)('holds exactly the bound R5 presentation and every bound figure', () => {
    const release = getPaperRelease(R5_PAPER_VERSION);
    expect(release?.delivery).toBe('private-storage');
    expect(fileIdentity(privatePresentationPath())).toEqual({ bytes: release?.bytes, sha256: release?.sha256 });
    const contract = getAcceptedFiguresContract(R5_PAPER_VERSION);
    expect(contract).not.toBeNull();
    const mismatched = (contract?.assets ?? []).filter((asset) => {
      const identity = fileIdentity(privateFigurePath(asset.file));
      return !identity || identity.bytes !== asset.bytes || identity.sha256 !== asset.sha256;
    }).map((asset) => asset.id);
    expect(mismatched).toEqual([]);
    expect(contract?.assets.length).toBe(17);
  });

  it.skipIf(!privateV0991FixtureAvailable)('holds the bound v0.9.91 presentation and Appendix L source image', () => {
    const release = getPaperRelease(V0991_PAPER_VERSION)!;
    const sourceMedia = appendixLSourceMediaContract();
    expect(fileIdentity(privatePresentationPath(V0991_PAPER_VERSION))).toEqual({ bytes: release.bytes, sha256: release.sha256 });
    expect(fileIdentity(privateV0991SourceMediaPath())).toEqual({ bytes: sourceMedia.bytes, sha256: sourceMedia.sha256 });
  });
});
