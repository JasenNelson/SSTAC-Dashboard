import { createHash } from 'node:crypto';
import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { getAcceptedFiguresContract } from '../accepted-figures';
import { getPaperRelease, R5_PAPER_VERSION } from '../releases';
import { assertPrivateFixtureModeContract, privateFixtureModeForLeg } from '../../../../../scripts/verify/matrix-paper-e2e-fixture-mode.mjs';
import {
  privateFigurePath,
  privateFixtureAvailable,
  privateFixtureDirectory,
  privateFixtureRequired,
  privatePresentationPath,
  PRIVATE_FIXTURE_DIR_ENV,
} from './private-fixture';

/*
 * The private-fixture suites skip where there is no fixture. This guard makes
 * that skip honest:
 * - where the fixture is REQUIRED (the local gate), a missing fixture fails;
 * - wherever a fixture is given, it must be complete and exact, so a suite can
 *   never pass against partial or altered bytes.
 * Sizes and hashes only: nothing read from the fixture is printed.
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

describe('private fixture guard', () => {
  it('skips the private suites only by an explicit decision', () => {
    // Exercise the same pure contract the E2E guard uses. The ordinary unit runner has no E2E
    // wrapper leg, so it must not depend on ambient process.env to describe its own mode.
    expect(privateFixtureModeForLeg('flags-off')).toBe('skip');
    expect(privateFixtureModeForLeg('authenticated-v16')).toBe('skip');
    expect(privateFixtureModeForLeg('appendix-l-inclusion-only')).toBe('required');
    expect(() => assertPrivateFixtureModeContract({ mode: undefined, githubActions: false, fixturePresent: false, authenticatedProjectEnabled: false })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE must be');
    expect(assertPrivateFixtureModeContract({ mode: 'skip', githubActions: false, fixturePresent: true, authenticatedProjectEnabled: false })).toBe(false);
    expect(assertPrivateFixtureModeContract({ mode: 'required', githubActions: false, fixturePresent: true, authenticatedProjectEnabled: true })).toBe(true);
    expect(() => assertPrivateFixtureModeContract({ mode: 'required', githubActions: false, fixturePresent: false, authenticatedProjectEnabled: true })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE=required, but the private release journeys cannot run');
    expect(() => assertPrivateFixtureModeContract({ mode: 'required', githubActions: false, fixturePresent: true, authenticatedProjectEnabled: false })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE=required, but the authenticated project');
  });

  it('has a fixture wherever one is required', () => {
    if (!privateFixtureRequired) return;
    expect(process.env[PRIVATE_FIXTURE_DIR_ENV] ?? '', `${PRIVATE_FIXTURE_DIR_ENV} must be set when the fixture is required`).not.toBe('');
    expect(privateFixtureDirectory(), `${PRIVATE_FIXTURE_DIR_ENV} must be an absolute path`).not.toBeNull();
  });

  it.skipIf(!privateFixtureAvailable)('holds exactly the bound presentation and every bound figure', () => {
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
});
