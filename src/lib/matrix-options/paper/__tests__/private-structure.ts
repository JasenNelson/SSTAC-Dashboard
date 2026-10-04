import { describeAuthenticatedPaper } from '../../revised-paper';
import type { RevisedPaperDescriptor } from '../../revised-paper';
import { compileAuthenticatedRelease } from '../../revised-paper-structure';
import type { RevisedPaperStructure } from '../../revised-paper-structure';
import { getPaperRelease, R5_PAPER_VERSION } from '../releases';
import type { PaperRelease } from '../releases';
import { readPrivatePresentation } from './private-fixture';

/*
 * The private-storage release, compiled from the private fixture exactly as the
 * request loader compiles it from storage: the verified text is described
 * against the release entry and passed through compileAuthenticatedRelease.
 *
 * Call these INSIDE a test or a hook of a `describePrivate` suite, never at the
 * top of a file or of a describe block: a skipped suite's body still runs when
 * tests are collected, and there is no fixture to read where it is skipped.
 * The rules of private-fixture.ts apply to everything returned here.
 */

export function privateR5Release(): PaperRelease {
  const release = getPaperRelease(R5_PAPER_VERSION);
  if (!release) throw new Error('The private-storage release is not bound.');
  return release;
}

let descriptor: RevisedPaperDescriptor | null = null;
let structure: RevisedPaperStructure | null = null;

/** The authenticated descriptor of the fixture's presentation (read once per test file). */
export function privateR5Descriptor(): RevisedPaperDescriptor {
  descriptor ??= describeAuthenticatedPaper(privateR5Release(), readPrivatePresentation());
  return descriptor;
}

/** The compiled, fully checked structure of the fixture's presentation (compiled once per test file). */
export function privateR5Structure(): RevisedPaperStructure {
  structure ??= compileAuthenticatedRelease(privateR5Descriptor());
  return structure;
}
