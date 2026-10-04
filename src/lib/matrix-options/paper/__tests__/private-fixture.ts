import fs from 'node:fs';
import path from 'node:path';

import { describe } from 'vitest';

import { R5_PAPER_VERSION } from '../releases';

/*
 * The private fixture: a local copy of the private-storage release's objects,
 * laid out exactly as they are named in storage:
 *
 *   <dir>/<documentVersion>/presentation.md
 *   <dir>/<documentVersion>/figures/<ID>.png
 *
 * The bytes are NOT in the repository and never will be, so a suite that needs
 * them runs only where the fixture exists (a developer machine, the local
 * gate) and is skipped everywhere else, by name.
 *
 * One variable locates it, one says what a run without it means:
 * - MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR: absolute path of <dir>. The same
 *   variable points the non-production server at the fixture
 *   (../private-release-assets.ts), so the tests and the browser read one copy.
 * - MATRIX_PAPER_PRIVATE_FIXTURE: `required` or `skip`. With `required` (a gate
 *   run on a machine that holds the fixture) a missing or incomplete fixture
 *   FAILS instead of skipping. With `skip` the private suites are skipped
 *   knowingly. With neither, outside hosted CI, the guard test fails: a run is
 *   never green by default having skipped every suite that reads the real
 *   release (private-fixture.guard.test.ts).
 *
 * Rules for every suite that uses this helper:
 * - assert hashes, counts, ids and booleans only. Never put text read from the
 *   fixture in an assertion message, a snapshot, a log line or a test title;
 * - never write anything derived from the fixture to a file.
 */

export const PRIVATE_FIXTURE_DIR_ENV = 'MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR';
export const PRIVATE_FIXTURE_MODE_ENV = 'MATRIX_PAPER_PRIVATE_FIXTURE';
/** The two decisions a run outside hosted CI can state. */
export const PRIVATE_FIXTURE_MODES: readonly string[] = Object.freeze(['required', 'skip']);

/** The fixture directory, or null when the variable is unset or not an absolute path. */
export function privateFixtureDirectory(): string | null {
  const directory = process.env[PRIVATE_FIXTURE_DIR_ENV];
  return directory && path.isAbsolute(directory) ? directory : null;
}

export const privateFixtureRequired = process.env[PRIVATE_FIXTURE_MODE_ENV] === 'required';
/** A fixture is used only when one is located AND the run did not say `skip`. */
export const privateFixtureAvailable = privateFixtureDirectory() !== null && process.env[PRIVATE_FIXTURE_MODE_ENV] !== 'skip';

/** `describe` for a suite that needs the private bytes: skipped, by name, where there is no fixture. */
export const describePrivate = describe.skipIf(!privateFixtureAvailable);

function fixturePath(...segments: string[]): string {
  const directory = privateFixtureDirectory();
  if (!directory) throw new Error('The private fixture is not available.');
  return path.join(directory, R5_PAPER_VERSION, ...segments);
}

export function privatePresentationPath(): string {
  return fixturePath('presentation.md');
}

export function privateFigurePath(file: string): string {
  return fixturePath('figures', file);
}

/** The exact bytes of the presentation Markdown. */
export function readPrivatePresentationBytes(): Buffer {
  return fs.readFileSync(privatePresentationPath());
}

/** The presentation Markdown as text (fatal UTF-8 decode). */
export function readPrivatePresentation(): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readPrivatePresentationBytes());
}

export function readPrivateFigure(file: string): Buffer {
  return fs.readFileSync(privateFigurePath(file));
}
