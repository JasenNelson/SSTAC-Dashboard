import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  loadRevisedPaper,
  REVISED_PAPER_BYTES,
  REVISED_PAPER_FILENAME,
  REVISED_PAPER_PERSISTENCE_STATE,
  REVISED_PAPER_RELATIVE_PATH,
  REVISED_PAPER_RELEASE_IDENTITY,
  REVISED_PAPER_SHA256,
  REVISED_PAPER_SIDECAR_FILENAME,
  REVISED_PAPER_SIDECAR_RELATIVE_PATH,
  REVISED_PAPER_VERSION,
  RevisedPaperUnavailableError,
} from '../revised-paper';

const expectedSidecar = Buffer.from(
  `${REVISED_PAPER_SHA256}  ${REVISED_PAPER_FILENAME}\n`,
  'ascii',
);

function mockFiles(markdown: Buffer, sidecar = expectedSidecar) {
  return vi.spyOn(fs, 'readFileSync').mockImplementation(((file: fs.PathOrFileDescriptor) => {
    const name = String(file);
    if (name.endsWith(REVISED_PAPER_FILENAME)) return markdown;
    if (name.endsWith(REVISED_PAPER_SIDECAR_FILENAME)) return sidecar;
    throw new Error('unexpected file');
  }) as typeof fs.readFileSync);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('revised paper loader', () => {
  it('pins the exact release and traced file constants', () => {
    expect(REVISED_PAPER_VERSION).toBe('1.0.11-remediated-20260913');
    expect(REVISED_PAPER_BYTES).toBe(534101);
    expect(REVISED_PAPER_SHA256).toBe(
      'bcc4e4b472d13d12506ece436edf4a4aa6a5bb9ff4724a5478573993183057bd',
    );
    expect(REVISED_PAPER_RELEASE_IDENTITY).toBe(
      `matrix-options-paper:${REVISED_PAPER_VERSION}:${REVISED_PAPER_SHA256}`,
    );
    expect(REVISED_PAPER_RELATIVE_PATH).toBe(
      `matrix_research/options_paper/${REVISED_PAPER_FILENAME}`,
    );
    expect(REVISED_PAPER_SIDECAR_RELATIVE_PATH).toBe(
      `matrix_research/options_paper/${REVISED_PAPER_SIDECAR_FILENAME}`,
    );
    expect(REVISED_PAPER_PERSISTENCE_STATE).toBe(
      'DISABLED_PENDING_LIVE_CONTRACT',
    );
  });

  it('fails closed before reading files for an absent or unknown version', () => {
    const readSpy = vi.spyOn(fs, 'readFileSync');
    expect(() => loadRevisedPaper(undefined)).toThrow(RevisedPaperUnavailableError);
    expect(() => loadRevisedPaper('slice-1a-fixture-v1')).toThrow(
      RevisedPaperUnavailableError,
    );
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('returns the same bounded non-secret error when either file is missing', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('private source path must not escape');
    });
    expect(() => loadRevisedPaper(REVISED_PAPER_VERSION)).toThrowError(
      'The authenticated revised paper is unavailable.',
    );
  });

  it('rejects a byte-length mismatch', () => {
    mockFiles(Buffer.from('not the authenticated paper', 'utf8'));
    expect(() => loadRevisedPaper(REVISED_PAPER_VERSION)).toThrow(
      RevisedPaperUnavailableError,
    );
  });

  it('rejects a UTF-8 BOM', () => {
    const bytes = Buffer.alloc(REVISED_PAPER_BYTES, 0x20);
    bytes.set([0xef, 0xbb, 0xbf], 0);
    mockFiles(bytes);
    expect(() => loadRevisedPaper(REVISED_PAPER_VERSION)).toThrow(
      RevisedPaperUnavailableError,
    );
  });

  it('rejects invalid UTF-8', () => {
    const bytes = Buffer.alloc(REVISED_PAPER_BYTES, 0x20);
    bytes.set([0xc3, 0x28], 0);
    mockFiles(bytes);
    expect(() => loadRevisedPaper(REVISED_PAPER_VERSION)).toThrow(
      RevisedPaperUnavailableError,
    );
  });

  it.each([
    Buffer.from(`${REVISED_PAPER_SHA256}  ${REVISED_PAPER_FILENAME}\r\n`, 'ascii'),
    Buffer.from(`${REVISED_PAPER_SHA256} ${REVISED_PAPER_FILENAME}\n`, 'ascii'),
    Buffer.from(`${REVISED_PAPER_SHA256.toUpperCase()}  ${REVISED_PAPER_FILENAME}\n`, 'ascii'),
    Buffer.from(`${REVISED_PAPER_SHA256}  wrong.md\n`, 'ascii'),
    Buffer.from(`${REVISED_PAPER_SHA256}  ${REVISED_PAPER_FILENAME}\nextra`, 'ascii'),
  ])('rejects malformed sidecar bytes', (sidecar) => {
    mockFiles(Buffer.alloc(REVISED_PAPER_BYTES, 0x20), sidecar);
    expect(() => loadRevisedPaper(REVISED_PAPER_VERSION)).toThrow(
      RevisedPaperUnavailableError,
    );
  });

  it('rejects a computed SHA-256 mismatch with no fallback', () => {
    mockFiles(Buffer.alloc(REVISED_PAPER_BYTES, 0x20));
    expect(() => loadRevisedPaper(REVISED_PAPER_VERSION)).toThrow(
      RevisedPaperUnavailableError,
    );
  });

  const authenticatedArtifactPath = path.join(
    process.cwd(),
    ...REVISED_PAPER_RELATIVE_PATH.split('/'),
  );
  const authenticatedSidecarPath = path.join(
    process.cwd(),
    ...REVISED_PAPER_SIDECAR_RELATIVE_PATH.split('/'),
  );
  it('requires, loads, and freezes the exact authenticated artifact', () => {
    expect(fs.existsSync(authenticatedArtifactPath)).toBe(true);
    expect(fs.existsSync(authenticatedSidecarPath)).toBe(true);

    const paper = loadRevisedPaper(REVISED_PAPER_VERSION);
    expect(Object.isFrozen(paper)).toBe(true);
    expect(Buffer.byteLength(paper.content, 'utf8')).toBe(REVISED_PAPER_BYTES);
    expect(paper).toMatchObject({
      documentVersion: REVISED_PAPER_VERSION,
      sha256: REVISED_PAPER_SHA256,
      bytes: REVISED_PAPER_BYTES,
      releaseIdentity: REVISED_PAPER_RELEASE_IDENTITY,
      persistenceState: REVISED_PAPER_PERSISTENCE_STATE,
    });
  });

  it('preserves ordered claim-local verification-open notices and excludes Appendix J', () => {
    const { content } = loadRevisedPaper(REVISED_PAPER_VERSION);
    const precedingSection = content.indexOf(
      '#### 4.3.1 The Schedule 3.1 Precedent for Soil',
    );
    const burrardNotice = content.indexOf(
      '> **[STATUS: SOURCE-GAP QUARANTINE - PRIMARY VERIFICATION OPEN]** Burrard Inlet',
      precedingSection,
    );
    const sectionStart = content.indexOf(
      '#### 4.4.3 What the current draft material actually supports',
    );
    const freshwaterNotice = content.indexOf(
      '> **[STATUS: SOURCE-GAP QUARANTINE - PRIMARY VERIFICATION OPEN]** Quantitative freshwater',
      burrardNotice + 1,
    );
    const candidateRecordNotice = content.indexOf(
      '> **[STATUS: QUARANTINED - PRIMARY VERIFICATION OPEN]** The quantitative records',
      freshwaterNotice + 1,
    );
    const nextSection = content.indexOf('#### 4.4.4 The applicability statement');

    expect(precedingSection).toBeGreaterThanOrEqual(0);
    expect(burrardNotice).toBeGreaterThan(precedingSection);
    expect(sectionStart).toBeGreaterThan(burrardNotice);
    expect(freshwaterNotice).toBeGreaterThan(sectionStart);
    expect(candidateRecordNotice).toBeGreaterThan(freshwaterNotice);
    expect(nextSection).toBeGreaterThan(candidateRecordNotice);
    expect(content).not.toMatch(/Appendix J/i);
  });
});
