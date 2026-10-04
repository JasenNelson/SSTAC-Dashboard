import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe } from 'vitest';

import { describeAuthenticatedPaper } from '../../revised-paper';
import { appendixLSourceMediaContract, assertAppendixLSourceMedia, type AppendixLSourceMediaContract } from '../accepted-source-media';
import { getPaperRelease, R5_PAPER_VERSION, V0991_PAPER_VERSION, type PaperRelease } from '../releases';

/*
 * Private release bytes stay outside Git. A required local run authenticates
 * v0.9.91 before any private suite is classified as runnable. Hosted GitHub
 * Actions explicitly skips private suites without inspecting a private path.
 * R5 suites run only when their own fixture is also present under the root.
 * Never log, snapshot or write content read through this helper.
 */

export const PRIVATE_FIXTURE_DIR_ENV = 'MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR';
export const PRIVATE_FIXTURE_MODE_ENV = 'MATRIX_PAPER_PRIVATE_FIXTURE';
export const PRIVATE_FIXTURE_MODES: readonly string[] = Object.freeze(['required', 'skip']);

type FixtureReader = (file: string) => Buffer | null;

interface FixtureOptions {
  readonly githubActions: boolean;
  readonly mode: string | undefined;
  readonly root: string | undefined;
  readonly read?: FixtureReader;
  /** Synthetic bindings are injected only by the guard's negative tests. */
  readonly release?: PaperRelease;
  readonly sourceMedia?: AppendixLSourceMediaContract;
}

interface FixtureState {
  readonly mode: 'required' | 'skip';
  readonly root: string | null;
  readonly r5Available: boolean;
  readonly v0991Available: boolean;
}

function readIfPresent(file: string): Buffer | null {
  try {
    return fs.readFileSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Classify first, then authenticate required bytes; CI skip performs no read. */
export function resolvePrivateFixtureState(options: FixtureOptions): FixtureState {
  const { githubActions, mode, root } = options;
  if (githubActions) {
    if (mode !== 'skip') throw new Error('GitHub Actions private fixture mode must be skip');
    return { mode: 'skip', root: null, r5Available: false, v0991Available: false };
  }
  if (mode === 'skip') return { mode: 'skip', root: null, r5Available: false, v0991Available: false };
  if (mode !== 'required') throw new Error('MATRIX_PAPER_PRIVATE_FIXTURE must be required or skip for a local run');
  if (!root || !path.isAbsolute(root)) throw new Error('MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR must be an absolute path in required mode');

  const read = options.read ?? readIfPresent;
  const release = options.release ?? getPaperRelease(V0991_PAPER_VERSION);
  const sourceMedia = options.sourceMedia ?? appendixLSourceMediaContract();
  if (!release || release.documentVersion !== V0991_PAPER_VERSION) throw new Error('v0.9.91 release binding unavailable');

  const sourceBytes = read(path.join(root, V0991_PAPER_VERSION, 'presentation.md'));
  if (!sourceBytes) throw new Error('Required v0.9.91 presentation missing');
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(sourceBytes);
  } catch {
    throw new Error('Required v0.9.91 presentation is not UTF-8');
  }
  try {
    assertAppendixLSourceMedia(source);
  } catch {
    throw new Error('Required v0.9.91 Appendix L marker mismatch');
  }
  try {
    describeAuthenticatedPaper(release, source);
  } catch {
    throw new Error('Required v0.9.91 presentation identity mismatch');
  }

  const imageBytes = read(path.join(root, V0991_PAPER_VERSION, sourceMedia.sourceMediaPath));
  if (!imageBytes) throw new Error('Required v0.9.91 Appendix L image missing');
  if (imageBytes.byteLength !== sourceMedia.bytes
    || createHash('sha256').update(imageBytes).digest('hex') !== sourceMedia.sha256
    || imageBytes.byteLength < 24
    || imageBytes.readUInt32BE(16) !== sourceMedia.width
    || imageBytes.readUInt32BE(20) !== sourceMedia.height) {
    throw new Error('Required v0.9.91 Appendix L image identity mismatch');
  }

  const r5Available = read(path.join(root, R5_PAPER_VERSION, 'presentation.md')) !== null;
  return { mode: 'required', root, r5Available, v0991Available: true };
}

const githubActions = process.env.GITHUB_ACTIONS === 'true';
const mode = process.env[PRIVATE_FIXTURE_MODE_ENV];
const state = resolvePrivateFixtureState({
  githubActions,
  mode,
  root: !githubActions && mode === 'required' ? process.env[PRIVATE_FIXTURE_DIR_ENV] : undefined,
});

export const privateFixtureRequired = state.mode === 'required';
export const privateFixtureAvailable = state.r5Available;
export const privateV0991FixtureAvailable = state.v0991Available;
export const describePrivate = describe.skipIf(!privateFixtureAvailable);
export const describePrivateV0991 = describe.skipIf(!privateV0991FixtureAvailable);

export function privateFixtureDirectory(): string | null {
  return state.root;
}

function fixturePath(version: typeof R5_PAPER_VERSION | typeof V0991_PAPER_VERSION, ...segments: string[]): string {
  if (!state.root) throw new Error('The private fixture is not available.');
  return path.join(state.root, version, ...segments);
}

export function privatePresentationPath(version: typeof R5_PAPER_VERSION | typeof V0991_PAPER_VERSION = R5_PAPER_VERSION): string {
  return fixturePath(version, 'presentation.md');
}

export function privateFigurePath(file: string): string {
  return fixturePath(R5_PAPER_VERSION, 'figures', file);
}

export function privateV0991SourceMediaPath(): string {
  return fixturePath(V0991_PAPER_VERSION, appendixLSourceMediaContract().sourceMediaPath);
}

export function readPrivatePresentationBytes(version: typeof R5_PAPER_VERSION | typeof V0991_PAPER_VERSION = R5_PAPER_VERSION): Buffer {
  return fs.readFileSync(privatePresentationPath(version));
}

export function readPrivatePresentation(version: typeof R5_PAPER_VERSION | typeof V0991_PAPER_VERSION = R5_PAPER_VERSION): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readPrivatePresentationBytes(version));
}

export function readPrivateFigure(file: string): Buffer {
  return fs.readFileSync(privateFigurePath(file));
}
