import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { findAcceptedFigureBlocks, getAcceptedFiguresContract, splitAcceptedFigureCaption } from '../accepted-figures';
import { sha256Object } from '../contracts';
import figuresContractJson from '../contracts/accepted-figures-v0.9.88-r4-presentation-001.json';
import cohortsContractJson from '../contracts/cohorts-v0.9.88-r4-presentation-001.json';
import receiptJson from '../contracts/private-release-receipt-v0.9.88-r4-presentation-001.json';
import guideContractJson from '../contracts/reviewer-guide-v0.9.88-r4-presentation-001.json';
import { getDefaultPaperRelease, getPaperRelease, paperReleaseRelativePath, R5_PAPER_VERSION, V0991_PAPER_VERSION, type PaperRelease } from '../releases';
import { getReviewManifest } from '../review-manifest';
import { resolveReviewerGuide } from '../reviewer-guide-server';
import { describePrivate, PRIVATE_FIXTURE_DIR_ENV, readPrivatePresentation } from './private-fixture';
import { privateR5Structure } from './private-structure';

/*
 * What keeps the private release private in a PUBLIC repository.
 *
 * - No commit-eligible file is a private artifact: not by path, and not by
 *   content (the size and SHA-256 of each of the 20 private files).
 * - The private paths are ignored by git.
 * - The paper code names no service-role credential, names the bucket in one
 *   file, and reads the local-source variable in one file.
 * - A suite that reads the private fixture has no snapshot assertion.
 * - The committed hash-only receipt equals what the release entry and the
 *   contracts compute to, so neither changes unnoticed.
 * - LOCAL guard (where the fixture is): no text of the release that is not
 *   already published occurs in anything that can still leave this machine:
 *   an unpublished commit, the index, or the working tree.
 *
 * Every scanner is shown, on synthetic input, to find what it looks for. A
 * failure names a source, a path and a needle INDEX and length, never the needle.
 */

const ROOT = process.cwd();
const sha = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const git = (args: readonly string[], input?: string): Buffer => execFileSync('git', [...args], { cwd: ROOT, input, maxBuffer: 1 << 30, stdio: ['pipe', 'pipe', 'pipe'] });
const repoPath = (file: string): string => path.join(ROOT, ...file.split('/'));

function r5Release(): PaperRelease {
  const release = getPaperRelease(R5_PAPER_VERSION);
  if (!release || !release.provenance) throw new Error('The private-storage release is not bound.');
  return release;
}

const SOURCE_VERSION = r5Release().provenance?.sourceVersion ?? '';
const SOURCE_NAME = `BC_Matrix_Options_Paper_${SOURCE_VERSION}.md`;
// Assembled, so a scan of the paper code for these strings does not find this file.
const BUCKET = ['matrix-paper', 'review', 'assets'].join('-');
const CREDENTIAL_NEEDLES = [['service', 'role'].join('_'), ['supabase', 'service'].join('_')];
const SNAPSHOT_ASSERTION = new RegExp(`to(?:Match|ThrowErrorMatching)(?:Inline|File)?${'Snap'}${'shot'}`);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-hygiene-'));
afterAll(() => {
  fs.rmSync(temporary, { recursive: true, force: true });
});

/** Every file git would let a commit carry: tracked, or untracked and not ignored. */
function commitEligibleFiles(): string[] {
  return git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString('utf8').split('\0').filter((file) => file !== '');
}

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

const relative = (file: string): string => path.relative(ROOT, file).split(path.sep).join('/');
const isTestFile = (file: string): boolean => /(^|\/)__tests__\//.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.startsWith('src/test/');

interface Pin {
  readonly label: string;
  readonly bytes: number;
  readonly sha256: string;
}

/** The size and hash of each private file: the source, its hash sidecar, the presentation and the 17 figures. */
function privatePins(): Pin[] {
  const release = r5Release();
  const provenance = release.provenance;
  if (!provenance) throw new Error('The private-storage release has no provenance.');
  const sidecar = Buffer.from(`${provenance.sourceSha256}  ${SOURCE_NAME}\n`, 'ascii');
  return [
    { label: 'source', bytes: provenance.sourceBytes, sha256: provenance.sourceSha256 },
    { label: 'source-sidecar', bytes: sidecar.byteLength, sha256: sha(sidecar) },
    { label: 'presentation', bytes: release.bytes, sha256: release.sha256 },
    ...(getAcceptedFiguresContract(R5_PAPER_VERSION)?.assets ?? []).map((asset) => ({ label: `figure:${asset.id}`, bytes: asset.bytes, sha256: asset.sha256 })),
  ];
}

/** The files whose size AND SHA-256 are a pin's. Only a file of a pinned size is hashed. */
function pinnedFiles(files: readonly string[], pins: readonly Pin[]): { file: string; label: string }[] {
  const bySize = new Map<number, Pin[]>();
  for (const pin of pins) bySize.set(pin.bytes, [...(bySize.get(pin.bytes) ?? []), pin]);
  const hits: { file: string; label: string }[] = [];
  for (const file of files) {
    let size: number;
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile()) continue;
      size = stat.size;
    } catch {
      continue;
    }
    const candidates = bySize.get(size);
    if (!candidates) continue;
    const digest = sha(fs.readFileSync(file));
    for (const pin of candidates) if (pin.sha256 === digest) hits.push({ file, label: pin.label });
  }
  return hits;
}

/** Why a repository path names a private artifact, or null. */
function privatePathReason(file: string): string | null {
  if (file.includes(`BC_Matrix_Options_Paper_${SOURCE_VERSION}`)) return 'source file name';
  if (file.startsWith('candidate/paper/assets/')) return 'candidate assets folder';
  if (/(^|\/)presentation\.md$/.test(file)) return 'presentation object';
  if (file.split('/').slice(0, -1).some((segment) => [R5_PAPER_VERSION, SOURCE_VERSION, V0991_PAPER_VERSION].includes(segment))) return 'version folder';
  if (file.startsWith('.tmp/matrix-paper-private/')) return 'private fixture folder';
  // A paper or asset file named after either private version, wherever it lies. The contracts and the
  // receipt that carry the version in their names are JSON, and are shown to hold hashes only below.
  const name = file.slice(file.lastIndexOf('/') + 1);
  if ([R5_PAPER_VERSION, SOURCE_VERSION, V0991_PAPER_VERSION].some((version) => name.includes(version)) && /\.(?:md|sha256|png)$/i.test(name)) return 'private version in a paper or asset file name';
  // The candidate paper folder holds the default release's two files and nothing else.
  const defaultPath = paperReleaseRelativePath(getDefaultPaperRelease());
  if (file.startsWith('candidate/paper/') && file !== defaultPath && file !== `${defaultPath}.sha256`) return 'candidate paper folder';
  return null;
}

describe('commit-eligible inventory', () => {
  it('holds no path that names a private artifact', () => {
    const files = commitEligibleFiles();
    expect(files.length).toBeGreaterThan(1000);
    expect(files.map((file) => [file, privatePathReason(file)]).filter(([, reason]) => reason !== null)).toEqual([]);
  }, 30_000);

  it('positive control: the path rule names each private path, and no path of the default release', () => {
    const named = [
      `candidate/paper/${SOURCE_NAME}`,
      `candidate/paper/${SOURCE_NAME}.sha256`,
      `candidate/paper/assets/${SOURCE_VERSION}/FIG6-1.png`,
      'candidate/paper/assets/other/file.png',
      `public/${R5_PAPER_VERSION}/presentation.md`,
      'presentation.md',
      `fixtures/${R5_PAPER_VERSION}/figures/FIG6-1.png`,
      '.tmp/matrix-paper-private/x',
      `docs/notes-${R5_PAPER_VERSION}.md`,
      `public/images/FIG6-1-${SOURCE_VERSION}.PNG`,
      `src/test/${R5_PAPER_VERSION}.sha256`,
      'candidate/paper/another-draft.md',
      'candidate/paper/BC_Matrix_Options_Paper_v9.9.9.md.sha256',
      'candidate/paper/notes/readme.txt',
    ];
    expect(named.map(privatePathReason)).toEqual([
      'source file name', 'source file name', 'candidate assets folder', 'candidate assets folder', 'presentation object', 'presentation object', 'version folder', 'private fixture folder',
      'private version in a paper or asset file name', 'private version in a paper or asset file name', 'private version in a paper or asset file name',
      'candidate paper folder', 'candidate paper folder', 'candidate paper folder',
    ]);
    const defaultPath = paperReleaseRelativePath(getDefaultPaperRelease()) ?? '';
    const contracts = 'src/lib/matrix-options/paper/contracts';
    const allowed = [
      defaultPath,
      `${defaultPath}.sha256`,
      // The contracts and the receipt carry the version in their names: JSON, hash-only by the receipt and contract tests.
      `${contracts}/accepted-figures-${R5_PAPER_VERSION}.json`,
      `${contracts}/reviewer-guide-${R5_PAPER_VERSION}.json`,
      `${contracts}/cohorts-${R5_PAPER_VERSION}.json`,
      `${contracts}/private-release-receipt-${R5_PAPER_VERSION}.json`,
      'docs/presentation.md.txt',
      'src/lib/matrix-options/paper/releases.ts',
      'candidate/README.md',
      'docs/candidate/paper/notes.md',
    ];
    expect(defaultPath).toMatch(/^candidate\/paper\/.+\.md$/);
    expect(allowed.map(privatePathReason)).toEqual(allowed.map(() => null));
  });

  it('holds no file with the size and SHA-256 of a private file', () => {
    const pins = privatePins();
    expect(pins).toHaveLength(20);
    expect(new Set(pins.map((pin) => pin.sha256)).size).toBe(20);
    expect(pinnedFiles(commitEligibleFiles().map(repoPath), pins)).toEqual([]);
  }, 60_000);

  it('pins the source sidecar as the text the hash-sidecar convention gives it', () => {
    const sidecar = privatePins().find((pin) => pin.label === 'source-sidecar');
    expect(sidecar).toEqual({ label: 'source-sidecar', bytes: 121, sha256: '00e85f6a3cf9db42bc89a6d6b8c0cab538b2c6769da7aa7cb0519168e519a43c' });
  });

  it('positive control: the content matcher finds a file by size and hash, and only then', () => {
    const content = Buffer.from('synthetic pinned content, not a private file\n', 'utf8');
    const sameSize = Buffer.from(content);
    sameSize[0] ^= 0x01;
    const pinned = path.join(temporary, 'pinned.bin');
    const other = path.join(temporary, 'same-size.bin');
    const longer = path.join(temporary, 'longer.bin');
    fs.writeFileSync(pinned, content);
    fs.writeFileSync(other, sameSize);
    fs.writeFileSync(longer, Buffer.concat([content, content]));
    const pins: Pin[] = [...privatePins(), { label: 'synthetic', bytes: content.byteLength, sha256: sha(content) }];
    expect(pinnedFiles([pinned, other, longer, path.join(temporary, 'absent.bin')], pins)).toEqual([{ file: pinned, label: 'synthetic' }]);
    // Without the synthetic pin the same files are clean.
    expect(pinnedFiles([pinned, other, longer], privatePins())).toEqual([]);
  });
});

describe('ignored paths', () => {
  const ignored = (file: string): boolean => {
    try {
      git(['check-ignore', '-q', '--', file]);
      return true;
    } catch (error) {
      if ((error as { status?: number }).status === 1) return false;
      throw error;
    }
  };

  it('ignores the private source, its sidecar, its assets and the private fixture, and not the default release', () => {
    expect([
      `candidate/paper/${SOURCE_NAME}`,
      `candidate/paper/${SOURCE_NAME}.sha256`,
      `candidate/paper/assets/${SOURCE_VERSION}/FIG6-1.png`,
      `candidate/paper/${V0991_PAPER_VERSION}/presentation.md`,
      `candidate/paper/${V0991_PAPER_VERSION}/figures/FIGA2.png`,
      `candidate/paper/${V0991_PAPER_VERSION}/appendix_l_media/image1.png`,
      '.tmp/matrix-paper-private/x',
      `.tmp/matrix-paper-private/${R5_PAPER_VERSION}/presentation.md`,
    ].map(ignored)).toEqual([true, true, true, true, true, true, true, true]);
    const defaultPath = paperReleaseRelativePath(getDefaultPaperRelease()) ?? '';
    expect(defaultPath).toMatch(/^candidate\/paper\/.+\.md$/);
    expect([defaultPath, `${defaultPath}.sha256`, 'src/lib/matrix-options/paper/releases.ts'].map(ignored)).toEqual([false, false, false]);
  }, 30_000);
});

describe('the paper code', () => {
  const paperFiles = (): string[] => [
    ...walk(repoPath('src/lib/matrix-options/paper')),
    ...fs.readdirSync(repoPath('src/lib/matrix-options')).filter((name) => /^revised-paper.*\.ts$/.test(name)).map((name) => path.join(repoPath('src/lib/matrix-options'), name)),
    repoPath('src/lib/matrix-options/reviewer-guide.ts'),
    ...walk(repoPath('src/app/api/matrix-options/paper')),
    ...walk(repoPath('src/app/(dashboard)/matrix-options/paper')),
    ...walk(repoPath('src/components/matrix-options/paper')),
    repoPath('e2e/matrix-options-paper.spec.ts'),
  ];
  const namesServiceRole = (text: string): boolean => CREDENTIAL_NEEDLES.some((needle) => text.toLowerCase().includes(needle));
  const read = (file: string): string => fs.readFileSync(file, 'latin1');

  it('names no service-role credential', () => {
    const files = paperFiles();
    expect(files.length).toBeGreaterThan(150);
    expect(files.filter((file) => fs.existsSync(file)).filter((file) => namesServiceRole(read(file))).map(relative)).toEqual([]);
    expect(fs.existsSync(repoPath('e2e/matrix-options-paper.spec.ts'))).toBe(true);
  });

  it('positive control: the service-role scan sees each spelling', () => {
    const upper = CREDENTIAL_NEEDLES.map((needle) => needle.toUpperCase());
    expect([`const key = process.env.${upper[1]}_KEY;`, `role: '${CREDENTIAL_NEEDLES[0]}'`, `createClient(url, ${upper[0]}_KEY)`, ['Service', 'Role'].join('_')].map(namesServiceRole)).toEqual([true, true, true, true]);
    expect(['const service = role;', 'a publishable key', 'supabase.auth.getUser()'].map(namesServiceRole)).toEqual([false, false, false]);
  });

  it('names the bucket in exactly one file under src, and reads the local-source variable in exactly one product file', () => {
    const files = walk(repoPath('src'));
    expect(files.length).toBeGreaterThan(1000);
    const boundary = 'src/lib/matrix-options/paper/private-release-assets.ts';
    expect(files.filter((file) => read(file).includes(BUCKET)).map(relative)).toEqual([boundary]);
    const product = files.filter((file) => !isTestFile(relative(file)));
    expect(product.filter((file) => read(file).includes(PRIVATE_FIXTURE_DIR_ENV)).map(relative)).toEqual([boundary]);
    expect(read(repoPath(boundary))).toContain(`process.env.${PRIVATE_FIXTURE_DIR_ENV}`);
    // The helper that names the variable for the tests is a test file, and is seen as one.
    expect(isTestFile('src/lib/matrix-options/paper/__tests__/private-fixture.ts')).toBe(true);
    expect([boundary, 'src/lib/matrix-options/paper/releases.ts', 'src/app/api/matrix-options/paper/reviews/route.ts'].map(isTestFile)).toEqual([false, false, false]);
  }, 30_000);

  it('has no snapshot assertion in a suite that reads the private fixture', () => {
    const readsFixture = (text: string): boolean => /private-(?:fixture|structure)['"]/.test(text) || /\bdescribePrivate\b/.test(text);
    const suites = walk(repoPath('src')).filter((file) => isTestFile(relative(file)) && /\.[cm]?[jt]sx?$/.test(file)).filter((file) => readsFixture(read(file)));
    // This file, the helpers and the suites of the other private tests are all found.
    expect(suites.map(relative)).toEqual(expect.arrayContaining([
      'src/lib/matrix-options/paper/__tests__/private-release-hygiene.test.ts',
      'src/lib/matrix-options/paper/__tests__/private-structure.ts',
      'src/lib/matrix-options/paper/__tests__/paper-request-loader.private.test.ts',
      'src/lib/matrix-options/paper/__tests__/private-fixture.guard.test.ts',
    ]));
    expect(suites.length).toBeGreaterThan(8);
    expect(suites.filter((file) => SNAPSHOT_ASSERTION.test(read(file))).map(relative)).toEqual([]);
    // Positive control.
    const assertion = (name: string): string => `expect(value).${name}${'Snap'}${'shot'}();`;
    expect(['toMatch', 'toMatchInline', 'toMatchFile', 'toThrowErrorMatching', 'toThrowErrorMatchingInline'].map((name) => SNAPSHOT_ASSERTION.test(assertion(name)))).toEqual([true, true, true, true, true]);
    expect(SNAPSHOT_ASSERTION.test('expect(value).toMatchObject({}); expect(value).toMatch(/x/);')).toBe(false);
    expect(readsFixture("import { describePrivate } from './private-fixture';")).toBe(true);
    expect(readsFixture("import { describe } from 'vitest';")).toBe(false);
  }, 30_000);

  it('keeps every storage locator out of the release table', () => {
    const locators = (text: string): string[] => [
      [BUCKET, text.includes(BUCKET)] as const,
      ['figures folder', text.includes('figures/')] as const,
      ['presentation object', text.includes('presentation.md')] as const,
      ['image file', /\.png\b/.test(text)] as const,
      ['storage address', /storage\/v1|object\/authenticated|\/storage\//.test(text)] as const,
      ['version folder', text.includes(`${R5_PAPER_VERSION}/`) || text.includes(`${SOURCE_VERSION}/`)] as const,
      ['source file name', text.includes(`BC_Matrix_Options_Paper_${SOURCE_VERSION}`)] as const,
      ['private fixture folder', text.includes('matrix-paper-private')] as const,
    ].filter(([, found]) => found).map(([name]) => name);
    expect(locators(read(repoPath('src/lib/matrix-options/paper/releases.ts')))).toEqual([]);
    // Positive control: the boundary module, which does build object paths, and one line per rule.
    expect(locators(read(repoPath('src/lib/matrix-options/paper/private-release-assets.ts')))).toEqual(expect.arrayContaining([BUCKET, 'figures folder', 'presentation object', 'storage address']));
    expect(locators(`${R5_PAPER_VERSION}/figures/FIG6-1.png`)).toEqual(['figures folder', 'image file', 'version folder']);
    expect(locators(`candidate/paper/${SOURCE_NAME}`)).toEqual(['source file name']);
    expect(locators('.tmp/matrix-paper-private')).toEqual(['private fixture folder']);
  });
});

/** The committed hash-only receipt, computed from the release entry and the contract files. */
function computeReceipt(release: PaperRelease, contracts: { readonly guide: unknown; readonly cohorts: unknown; readonly figures: typeof figuresContractJson }, reviewManifestSha256: string): unknown {
  const provenance = release.provenance;
  if (!provenance) throw new Error('The private-storage release has no provenance.');
  const guide = contracts.guide as { questions: unknown[] };
  const cohorts = contracts.cohorts as { cohorts: unknown[] };
  const objects = [
    { path: `${release.documentVersion}/presentation.md`, bytes: release.bytes, sha256: release.sha256 },
    ...contracts.figures.assets.map((asset) => ({ path: `${release.documentVersion}/figures/${asset.file}`, bytes: asset.bytes, sha256: asset.sha256 })),
  ].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return {
    schemaVersion: 'matrix-paper-private-release-receipt-v1',
    documentVersion: release.documentVersion,
    presentation: { bytes: release.bytes, sha256: release.sha256 },
    provenance: { sourceVersion: provenance.sourceVersion, sourceBytes: provenance.sourceBytes, sourceSha256: provenance.sourceSha256, sourceManifestSha256: provenance.sourceManifestSha256 },
    contracts: { reviewerGuide: sha256Object(contracts.guide), cohorts: sha256Object(contracts.cohorts), acceptedFigures: sha256Object(contracts.figures) },
    reviewManifestSha256,
    counts: { questions: guide.questions.length, cohorts: cohorts.cohorts.length, figureAssets: contracts.figures.assets.length, figurePlacements: contracts.figures.placements.length, objects: objects.length },
    // One line per allowlisted object, sorted by path: `<path>\t<bytes>\t<sha256>\n`.
    objectSetSha256: sha(Buffer.from(objects.map((object) => `${object.path}\t${object.bytes}\t${object.sha256}\n`).join(''), 'utf8')),
  };
}

describe('committed hash-only receipt of the private release', () => {
  const contracts = { guide: guideContractJson, cohorts: cohortsContractJson, figures: figuresContractJson };
  const computed = (): unknown => computeReceipt(r5Release(), contracts, getReviewManifest(R5_PAPER_VERSION).sha256);

  it('equals what the release entry and the three contracts compute to', () => {
    expect(receiptJson).toEqual(computed());
    expect(receiptJson.counts).toEqual({ questions: 12, cohorts: 5, figureAssets: 17, figurePlacements: 20, objects: 18 });
  });

  it('holds hashes, counts and version names only', () => {
    const strings: string[] = [];
    const collect = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(receiptJson);
    const allowed = new Set(['matrix-paper-private-release-receipt-v1', R5_PAPER_VERSION, SOURCE_VERSION]);
    expect(strings.filter((value) => !/^[0-9a-f]{64}$/.test(value) && !allowed.has(value))).toEqual([]);
    expect(strings.filter((value) => /^[0-9a-f]{64}$/.test(value))).toHaveLength(8);
  });

  it('two-sided: a change to the release entry or to any contract no longer equals the receipt', () => {
    const release = r5Release();
    const manifest = getReviewManifest(R5_PAPER_VERSION).sha256;
    const changed: readonly unknown[] = [
      computeReceipt({ ...release, bytes: release.bytes + 1 }, contracts, manifest),
      computeReceipt({ ...release, sha256: release.sha256.replace(/^./, (first) => (first === '0' ? '1' : '0')) }, contracts, manifest),
      computeReceipt({ ...release, provenance: release.provenance ? { ...release.provenance, sourceBytes: release.provenance.sourceBytes + 1 } : null }, contracts, manifest),
      computeReceipt(release, { ...contracts, guide: { ...guideContractJson, questions: guideContractJson.questions.slice(1) } }, manifest),
      computeReceipt(release, { ...contracts, guide: { ...guideContractJson, questions: guideContractJson.questions.map((question, index) => (index === 0 ? { ...question, textSha256: '0'.repeat(64) } : question)) } }, manifest),
      computeReceipt(release, { ...contracts, cohorts: { ...cohortsContractJson, status: 'CHANGED' } }, manifest),
      computeReceipt(release, { ...contracts, figures: { ...figuresContractJson, assets: figuresContractJson.assets.map((asset, index) => (index === 0 ? { ...asset, bytes: asset.bytes + 1 } : asset)) } }, manifest),
      computeReceipt(release, { ...contracts, figures: { ...figuresContractJson, placements: figuresContractJson.placements.map((placement, index) => (index === 0 ? { ...placement, textSha256: '0'.repeat(64) } : placement)) } }, manifest),
      computeReceipt(release, contracts, '0'.repeat(64)),
    ];
    for (const receipt of changed) expect(receipt).not.toEqual(receiptJson);
    expect(computed()).toEqual(receiptJson);
  });
});

/*
 * LOCAL guard (decision A14).
 *
 * Needles are derived from the private fixture at run time and exist only in
 * memory. "Public" means PUBLISHED: present in a text file of the published
 * base, the nearest ancestor of HEAD that a ref of the public remote contains.
 * A needle that is public is dropped.
 *
 * The scan set is everything that can still leave this machine:
 *   (a) commit blobs: every blob a push of HEAD would send, that is the blobs
 *       reachable from HEAD and from no ref of the public remote. This is every
 *       unpublished commit, including content a later commit removed;
 *   (b) index: every staged blob that is neither in (a) nor in the published
 *       base, whatever the working tree holds now;
 *   (c) working tree: every commit-eligible file that differs from the published
 *       base, and every untracked file git does not ignore.
 * (a) and (b) are read from the object store by object id, (c) from disk.
 * No remaining needle may be a substring of anything in the scan set.
 *
 * Limit: text shorter than the bounds below (a line under 40 characters that is not a heading,
 * a bold-only line or a table row; a heading or bold line under 12; a table row under 30) is
 * not looked for, and neither is text that was re-worded, re-wrapped or re-spaced.
 */

const NEEDLE_MIN_CHARS = 4;
const LINE_MIN_CHARS = 40;
const PIECE_MIN_CHARS = 60;
const HEADING_MIN_CHARS = 12;
const TABLE_ROW_MIN_CHARS = 30;
/** A Markdown heading line: its text is what follows the `#` marks. */
const HEADING_LINE = /^ {0,3}#{1,6}[ \t]+(.*?)[ \t#]*$/;
/** A line that is one bold run and nothing else (a run-in heading): its text is what the marks enclose. */
const BOLD_ONLY_LINE = /^\s*\*\*(.+)\*\*\s*$/;
/** Size limit for the text of the published base only: leaving a large public file out can only keep a needle. */
const BASE_TEXT_MAX_BYTES = 2_000_000;
/**
 * The remote whose refs count as published. The public repository is the remote
 * named `origin`; what was pushed only to another remote (a private mirror, a
 * local path) is NOT public and is scanned like any local commit.
 */
const PUBLIC_REMOTE = 'origin';
/** Sentence ends, and the characters that quoting, escaping or rendering changes. */
const PIECE_BREAK = /(?<=[.!?;:])\s+|["'`\\<>&|*_[\]()]/;
const NO_PUBLIC_BASE = 'Local guard: no published base. HEAD has no ancestor on any ref of the public remote, so nothing can be called public.';
const NOTHING_SCANNED = 'Local guard: something is unpublished or uncommitted and nothing was scanned.';
const UNSCANNED_WHERE_TEXT_IS_EXPECTED = 'Local guard: content that could not be read as text is under the paper code or tests, or is named as a text file';

/** Needles of a presentation: lines of 40+ characters, headings and bold-only lines of 12+, table rows of 30+, sentence-sized pieces, figure text and guide text. */
function deriveNeedles(presentation: string, guideText: readonly string[]): string[] {
  const needles = new Set<string>();
  const add = (text: string, minimum: number): void => {
    const value = text.trim();
    if (value.length >= minimum && /[A-Za-z]{3}/.test(value)) needles.add(value);
  };
  const lines = presentation.split('\n');
  for (const line of lines) {
    add(line, LINE_MIN_CHARS);
    const heading = HEADING_LINE.exec(line);
    if (heading) add(heading[1], HEADING_MIN_CHARS);
    const bold = BOLD_ONLY_LINE.exec(line);
    if (bold) add(bold[1], HEADING_MIN_CHARS);
    if (line.trimStart().startsWith('|')) add(line, TABLE_ROW_MIN_CHARS);
    if (line.trim().length < PIECE_MIN_CHARS) continue;
    for (const piece of line.split(PIECE_BREAK)) add(piece ?? '', PIECE_MIN_CHARS);
  }
  for (const block of findAcceptedFigureBlocks(lines)) {
    if (!block.content) continue;
    add(block.content.caption, NEEDLE_MIN_CHARS);
    add(splitAcceptedFigureCaption({ figureId: block.figureId, caption: block.content.caption }).text, NEEDLE_MIN_CHARS);
    add(block.content.status, NEEDLE_MIN_CHARS);
    add(block.content.alt, NEEDLE_MIN_CHARS);
  }
  for (const text of guideText) add(text, NEEDLE_MIN_CHARS);
  return [...needles];
}

/** Binary by its first bytes: a NUL among the first 8000. */
const isBinary = (bytes: Buffer): boolean => bytes.subarray(0, 8000).includes(0);

/** The text of a file: UTF-8, so a needle with any character matches; latin1 only when the bytes are not UTF-8. */
function decodeText(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return bytes.toString('latin1');
  }
}

/** Git in the repository at `root`. No GIT_* variable of this process is passed on, so `root` alone decides the repository. */
function gitAt(root: string, args: readonly string[], input?: string): Buffer {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'))) as NodeJS.ProcessEnv;
  return execFileSync('git', [...args], { cwd: root, input, env, maxBuffer: 1 << 30, stdio: ['pipe', 'pipe', 'pipe'] });
}

const gitText = (root: string, args: readonly string[]): string => gitAt(root, args).toString('utf8').trim();
const gitLines = (root: string, args: readonly string[]): string[] => gitAt(root, args).toString('utf8').split('\n').filter((line) => line !== '');
const gitList = (root: string, args: readonly string[]): string[] => gitAt(root, args).toString('utf8').split('\0').filter((entry) => entry !== '');

interface PublicBase {
  /** The published commit everything is compared with. */
  readonly commit: string;
  readonly head: string;
  /** Commits of HEAD that are not published (0 when HEAD itself is). */
  readonly ahead: number;
}

/**
 * The nearest ancestor of HEAD that any ref of the public remote contains, or
 * null when there is none. `git rev-list --boundary HEAD --not --remotes=<remote>`
 * lists the commits of HEAD that no such ref contains, and the published commits
 * they were built on; of those, the one with the fewest commits up to HEAD.
 */
function publicBase(root: string): PublicBase | null {
  const head = gitText(root, ['rev-parse', 'HEAD']);
  if (gitText(root, ['for-each-ref', '--count=1', '--format=%(objectname)', `refs/remotes/${PUBLIC_REMOTE}`]) === '') return null;
  const listed = gitLines(root, ['rev-list', '--boundary', 'HEAD', '--not', `--remotes=${PUBLIC_REMOTE}`]);
  if (listed.length === 0) return { commit: head, head, ahead: 0 };
  let nearest: PublicBase | null = null;
  for (const commit of listed.filter((line) => line.startsWith('-')).map((line) => line.slice(1))) {
    const ahead = Number(gitText(root, ['rev-list', '--count', `${commit}..HEAD`]));
    if (!nearest || ahead < nearest.ahead) nearest = { commit, head, ahead };
  }
  return nearest;
}

/** The same base by its definition: the merge-base of HEAD with each ref of the public remote, nearest to HEAD. */
function publicBaseByMergeBases(root: string): PublicBase | null {
  const head = gitText(root, ['rev-parse', 'HEAD']);
  let nearest: PublicBase | null = null;
  for (const ref of gitLines(root, ['for-each-ref', '--format=%(objectname)', `refs/remotes/${PUBLIC_REMOTE}`])) {
    let commit: string;
    try {
      commit = gitText(root, ['merge-base', 'HEAD', ref]);
    } catch {
      continue;
    }
    const ahead = Number(gitText(root, ['rev-list', '--count', `${commit}..HEAD`]));
    if (!nearest || ahead < nearest.ahead) nearest = { commit, head, ahead };
  }
  return nearest;
}

interface BlobRef {
  readonly id: string;
  readonly path: string;
}

/** The content of each object id, read with one `git cat-file --batch`. */
function readBlobs(root: string, ids: readonly string[]): Map<string, Buffer> {
  const blobs = new Map<string, Buffer>();
  if (ids.length === 0) return blobs;
  const output = gitAt(root, ['cat-file', '--batch'], `${ids.join('\n')}\n`);
  let offset = 0;
  for (const id of ids) {
    const lineEnd = output.indexOf(0x0a, offset);
    if (lineEnd < 0) break;
    const header = output.toString('latin1', offset, lineEnd);
    offset = lineEnd + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    blobs.set(id, output.subarray(offset, offset + size));
    offset += size + 1;
  }
  return blobs;
}

/** Every blob of one commit's tree, with its size. */
function treeBlobs(root: string, commit: string): (BlobRef & { readonly size: number })[] {
  const blobs: (BlobRef & { readonly size: number })[] = [];
  for (const entry of gitList(root, ['ls-tree', '-r', '-z', '-l', commit])) {
    const parsed = /^\d+ (\w+) ([0-9a-f]+) +(\d+|-)\t([\s\S]*)$/.exec(entry);
    if (parsed && parsed[1] === 'blob') blobs.push({ id: parsed[2], path: parsed[4], size: Number(parsed[3]) });
  }
  return blobs;
}

/** Every text file of one commit, as one text, read from the object store (never from the working tree), and the ids of all its blobs. */
function commitCorpus(root: string, commit: string): { readonly text: string; readonly files: number; readonly blobIds: ReadonlySet<string> } {
  const blobs = treeBlobs(root, commit);
  const parts: string[] = [];
  for (const bytes of readBlobs(root, [...new Set(blobs.filter((blob) => blob.size <= BASE_TEXT_MAX_BYTES).map((blob) => blob.id))]).values()) {
    if (!isBinary(bytes)) parts.push(decodeText(bytes));
  }
  return { text: parts.join('\n'), files: parts.length, blobIds: new Set(blobs.map((blob) => blob.id)) };
}

/** (a) Every blob a push of HEAD would send: reachable from HEAD and from no ref of the public remote. */
function unpublishedBlobs(root: string): BlobRef[] {
  const objects = gitAt(root, ['rev-list', '--objects', 'HEAD', '--not', `--remotes=${PUBLIC_REMOTE}`]).toString('utf8').split('\n').filter((line) => line !== '').map((line) => {
    const cut = line.indexOf(' ');
    return cut < 0 ? { id: line, path: '' } : { id: line.slice(0, cut), path: line.slice(cut + 1) };
  });
  if (objects.length === 0) return [];
  const types = gitAt(root, ['cat-file', '--batch-check'], `${objects.map((object) => object.id).join('\n')}\n`).toString('utf8').split('\n');
  return objects.filter((_, index) => types[index]?.split(' ')[1] === 'blob');
}

/** Every blob the index holds (what `git commit` would record), gitlinks left out. */
function indexBlobs(root: string): BlobRef[] {
  const blobs: BlobRef[] = [];
  for (const entry of gitList(root, ['ls-files', '-s', '-z'])) {
    const parsed = /^(\d+) ([0-9a-f]+) \d\t([\s\S]*)$/.exec(entry);
    if (parsed && parsed[1] !== '160000') blobs.push({ id: parsed[2], path: parsed[3] });
  }
  return blobs;
}

/** (c) Commit-eligible files that differ from a commit: tracked files changed in the working tree (deletions left out), and untracked files git does not ignore. */
function filesDifferingFrom(root: string, commit: string): string[] {
  const tracked = gitList(root, ['diff', '--name-only', '-z', '--no-renames', '--diff-filter=d', commit]);
  const untracked = gitList(root, ['ls-files', '-z', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...untracked])].sort();
}

type SourceKind = 'commit blob' | 'index' | 'working tree';
const SOURCE_KINDS: readonly SourceKind[] = ['commit blob', 'index', 'working tree'];

interface ScanItem {
  readonly source: SourceKind;
  readonly path: string;
  readonly bytes: Buffer;
}

interface NeedleHit {
  readonly source: SourceKind;
  readonly path: string;
  readonly needle: number;
  readonly length: number;
}

const WINDOW_CHARS = 12;
const FILTER_MASK = (1 << 22) - 1;

function windowHash(source: string, start: number): number {
  let hash = 0;
  for (let offset = 0; offset < WINDOW_CHARS; offset += 1) hash = (Math.imul(hash, 31) + source.charCodeAt(start + offset)) | 0;
  return hash;
}

/**
 * A matcher for many needles at once: the indexes of the needles that are a
 * substring of a text. One pass over the text with a rolling hash of
 * WINDOW_CHARS characters; a window whose hash is a needle's opening is compared
 * in full. A needle shorter than the window is looked for directly.
 */
function needleMatcher(needles: readonly string[]): (text: string) => Set<number> {
  const filter = new Uint8Array(FILTER_MASK + 1);
  const openings = new Map<number, number[]>();
  const short: number[] = [];
  needles.forEach((needle, index) => {
    if (needle.length < WINDOW_CHARS) {
      short.push(index);
      return;
    }
    const hash = windowHash(needle, 0);
    filter[hash & FILTER_MASK] = 1;
    openings.set(hash, [...(openings.get(hash) ?? []), index]);
  });
  let leaving = 1;
  for (let power = 0; power < WINDOW_CHARS; power += 1) leaving = Math.imul(leaving, 31);
  return (text) => {
    const present = new Set<number>();
    for (const index of short) if (text.includes(needles[index])) present.add(index);
    let hash = 0;
    for (let position = 0; position < text.length; position += 1) {
      hash = (Math.imul(hash, 31) + text.charCodeAt(position)) | 0;
      if (position >= WINDOW_CHARS) hash = (hash - Math.imul(leaving, text.charCodeAt(position - WINDOW_CHARS))) | 0;
      if (position < WINDOW_CHARS - 1 || filter[hash & FILTER_MASK] === 0) continue;
      const candidates = openings.get(hash);
      if (!candidates) continue;
      const start = position - WINDOW_CHARS + 1;
      for (const index of candidates) if (!present.has(index) && text.startsWith(needles[index], start)) present.add(index);
    }
    return present;
  };
}

interface ScanOutcome {
  /** Where a needle is a substring: source kind, path, the needle's index and length. Never the needle. */
  readonly hits: NeedleHit[];
  readonly scanned: number;
  /** What was not read as text (binary by its first bytes). Text is scanned whatever its size. */
  readonly skipped: { readonly source: SourceKind; readonly path: string }[];
}

/** Scans every item that is text, of any size, and names what it skipped. */
function scanItems(items: readonly ScanItem[], needles: readonly string[]): ScanOutcome {
  const present = needleMatcher(needles);
  const outcome: ScanOutcome = { hits: [], scanned: 0, skipped: [] };
  let scanned = 0;
  for (const item of items) {
    if (isBinary(item.bytes)) {
      outcome.skipped.push({ source: item.source, path: item.path });
      continue;
    }
    scanned += 1;
    for (const index of [...present(decodeText(item.bytes))].sort((left, right) => left - right)) outcome.hits.push({ source: item.source, path: item.path, needle: index, length: needles[index].length });
  }
  return { ...outcome, scanned };
}

/** The files at `paths` (relative to `root`) as working-tree items; a path that cannot be read is left out. */
function workingTreeItems(root: string, paths: readonly string[]): ScanItem[] {
  const items: ScanItem[] = [];
  for (const file of paths) {
    try {
      items.push({ source: 'working tree', path: file, bytes: fs.readFileSync(path.join(root, ...file.split('/'))) });
    } catch {
      // Not a readable file (removed since it was listed, or a directory): nothing to scan.
    }
  }
  return items;
}

const PAPER_PATHS = ['src/lib/matrix-options/', 'src/app/(dashboard)/matrix-options/paper/', 'src/app/api/matrix-options/paper/', 'src/components/matrix-options/paper/', 'candidate/', 'e2e/'] as const;
const TEXT_FILE_NAME = /\.(?:[cm]?[jt]sx?|json|md|mdx|txt|html?|css|ya?ml|csv|tsv|sql|ps1|py|sh|svg|xml)$/i;
/** Content that is skipped as binary must not sit where the paper's text could: under the paper code or tests, or in a file named as text. */
const textIsExpectedAt = (file: string): boolean => PAPER_PATHS.some((prefix) => file.startsWith(prefix)) || isTestFile(file) || TEXT_FILE_NAME.test(file);

interface GuardResult {
  readonly base: PublicBase;
  /** The commit whose blobs count as public: the published base, unless a test names another. */
  readonly comparedWith: string;
  readonly corpusFiles: number;
  readonly derived: number;
  /** The needles that are not public: what was looked for. */
  readonly needles: readonly string[];
  /** The scan set by source: paths of (a), (b) and (c). */
  readonly commitBlobs: readonly string[];
  readonly indexBlobs: readonly string[];
  readonly workingFiles: readonly string[];
  readonly scanned: number;
  readonly skipped: ScanOutcome['skipped'];
  readonly hits: readonly NeedleHit[];
}

/**
 * The guard on one repository. It fails with a constant message when there is no
 * published base; when something is unpublished or uncommitted and nothing was
 * scanned; and when skipped (binary) content sits where text is expected.
 * `options` exist for the guard's own proofs: `comparedWith` names another
 * commit as the public one, and `sources` limits the scan set, to show what a
 * narrower guard would have looked at.
 */
function leakGuard(root: string, derived: readonly string[], options: { readonly comparedWith?: string; readonly sources?: readonly SourceKind[] } = {}): GuardResult {
  const base = publicBase(root);
  if (!base) throw new Error(NO_PUBLIC_BASE);
  const commit = options.comparedWith ?? base.commit;
  const sources = options.sources ?? SOURCE_KINDS;
  const corpus = commitCorpus(root, commit);
  const isPublic = needleMatcher(derived)(corpus.text);
  const needles = derived.filter((_, index) => !isPublic.has(index));

  const pushed = sources.includes('commit blob') ? unpublishedBlobs(root) : [];
  const pushedIds = new Set(pushed.map((blob) => blob.id));
  const staged = sources.includes('index') ? indexBlobs(root).filter((blob) => !pushedIds.has(blob.id) && !corpus.blobIds.has(blob.id)) : [];
  const working = sources.includes('working tree') ? filesDifferingFrom(root, commit) : [];
  const content = readBlobs(root, [...new Set([...pushed, ...staged].map((blob) => blob.id))]);
  const fromStore = (source: SourceKind, blobs: readonly BlobRef[]): ScanItem[] => blobs.flatMap((blob) => {
    const bytes = content.get(blob.id);
    return bytes ? [{ source, path: blob.path, bytes }] : [];
  });
  const outcome = scanItems([...fromStore('commit blob', pushed), ...fromStore('index', staged), ...workingTreeItems(root, working)], needles);

  const whole = options.comparedWith === undefined && options.sources === undefined;
  const dirty = gitAt(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).byteLength > 0;
  if (whole && (base.ahead > 0 || dirty) && outcome.scanned === 0) throw new Error(NOTHING_SCANNED);
  const misplaced = outcome.skipped.filter((item) => textIsExpectedAt(item.path));
  if (whole && misplaced.length > 0) throw new Error(`${UNSCANNED_WHERE_TEXT_IS_EXPECTED}: ${misplaced.map((item) => `${item.source} ${item.path}`).join(', ')}`);
  return {
    base,
    comparedWith: commit,
    corpusFiles: corpus.files,
    derived: derived.length,
    needles,
    commitBlobs: pushed.map((blob) => blob.path),
    indexBlobs: staged.map((blob) => blob.path),
    workingFiles: working,
    scanned: outcome.scanned,
    skipped: outcome.skipped,
    hits: outcome.hits,
  };
}

/**
 * A throwaway repository in the temporary directory, for the guard's own proof.
 * Nothing here touches the repository under test: every command runs with `root`
 * as its directory and without this process's GIT_* variables, and the first
 * thing checked is that git resolves `root` to the new repository itself.
 */
function throwawayRepository(name: string): {
  readonly root: string;
  readonly write: (file: string, content: string | Buffer) => void;
  readonly stage: (...files: string[]) => void;
  readonly commit: (message: string, add: readonly string[]) => string;
  readonly publish: (ref: string, commit: string) => void;
} {
  const root = path.join(temporary, name);
  fs.mkdirSync(root);
  gitAt(root, ['init', '-q', '-b', 'main']);
  const same = (left: string, right: string): boolean => path.resolve(fs.realpathSync.native(left)).toLowerCase() === path.resolve(fs.realpathSync.native(right)).toLowerCase();
  if (!same(gitText(root, ['rev-parse', '--show-toplevel']), root)) throw new Error('The throwaway repository is not the repository git resolves to.');
  const identity = ['-c', 'user.name=Local Guard Test', '-c', 'user.email=local-guard@example.test', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', `core.hooksPath=${path.join(root, '.git', 'no-hooks')}`];
  const write = (file: string, content: string | Buffer): void => {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  const stage = (...files: string[]): void => {
    gitAt(root, [...identity, 'add', '--', ...files]);
  };
  return {
    root,
    write,
    stage,
    commit: (message, add) => {
      if (add.length > 0) stage(...add);
      gitAt(root, [...identity, 'commit', '-q', '-m', message]);
      return gitText(root, ['rev-parse', 'HEAD']);
    },
    publish: (ref, commit) => {
      gitAt(root, ['update-ref', `refs/remotes/${ref}`, commit]);
    },
  };
}

describe('local guard: scanner controls', () => {
  /** Files of the temporary directory as scan items. */
  const temporaryItems = (...names: string[]): ScanItem[] => workingTreeItems(temporary, names);

  it('positive control: finds a planted needle by index and length, and nothing in a clean file', () => {
    const needles = ['a synthetic needle that no published file holds 7c1e', 'another synthetic needle 55aa'];
    fs.writeFileSync(path.join(temporary, 'planted.ts'), `const text = '${needles[1]}';\n`);
    fs.writeFileSync(path.join(temporary, 'clean.ts'), "const text = 'nothing private';\n");
    fs.writeFileSync(path.join(temporary, 'binary.bin'), Buffer.concat([Buffer.from([0x00, 0x01]), Buffer.from(needles[0])]));
    expect(scanItems(temporaryItems('planted.ts', 'clean.ts', 'binary.bin', 'absent.ts'), needles)).toEqual({
      hits: [{ source: 'working tree', path: 'planted.ts', needle: 1, length: needles[1].length }],
      scanned: 2,
      skipped: [{ source: 'working tree', path: 'binary.bin' }],
    });
    expect(scanItems(temporaryItems('clean.ts'), needles)).toEqual({ hits: [], scanned: 1, skipped: [] });
  });

  it('positive control: text is scanned whatever its size, and what is skipped as binary is named', () => {
    const needle = 'a synthetic needle at the end of a very large text file 9a8b';
    const large = Buffer.concat([Buffer.alloc(BASE_TEXT_MAX_BYTES + 1000, 'filler text, line after line. '), Buffer.from(`\n${needle}\n`)]);
    expect(large.byteLength).toBeGreaterThan(BASE_TEXT_MAX_BYTES);
    const outcome = scanItems([{ source: 'commit blob', path: 'docs/dump.json', bytes: large }, { source: 'index', path: 'public/image.png', bytes: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]), Buffer.from(needle)]) }], [needle]);
    expect(outcome).toEqual({ hits: [{ source: 'commit blob', path: 'docs/dump.json', needle: 0, length: needle.length }], scanned: 1, skipped: [{ source: 'index', path: 'public/image.png' }] });
    // Where skipped content is a failure: under the paper code or tests, or in a file named as text.
    expect(['src/lib/matrix-options/paper/x.bin', 'src/components/matrix-options/paper/figure.png', 'e2e/shot.png', 'candidate/paper/x.pdf', 'src/app/x.test.tsx', 'docs/notes.md', 'scripts/dump.json'].map(textIsExpectedAt)).toEqual([true, true, true, true, true, true, true]);
    expect(['public/image.png', 'docs/figure.jpg', 'src/app/favicon.ico', 'scripts/archive.zip'].map(textIsExpectedAt)).toEqual([false, false, false, false]);
  });

  it('positive control: a needle with characters beyond ASCII is found in a UTF-8 file, and a file that is not UTF-8 is still read', () => {
    // Built from code points: an em dash, an e with an acute accent and a CJK character.
    const beyondAscii = `a synthetic needle with a dash ${String.fromCharCode(0x2014)} an accent ${String.fromCharCode(0xe9)} and ${String.fromCharCode(0x4e2d)} in it`;
    const shortBeyondAscii = `caf${String.fromCharCode(0xe9)} 9d`;
    const ascii = 'a synthetic needle in plain ASCII 31c7';
    const needles = [beyondAscii, shortBeyondAscii, ascii];
    fs.writeFileSync(path.join(temporary, 'utf8.ts'), Buffer.from(`const text = '${beyondAscii}'; // ${shortBeyondAscii}\n`, 'utf8'));
    // One byte 0xE9 on its own is not UTF-8: the file falls back to latin1 and its ASCII text is still matched.
    fs.writeFileSync(path.join(temporary, 'latin1.ts'), Buffer.concat([Buffer.from("const text = 'caf"), Buffer.from([0xe9]), Buffer.from(` 9d ${ascii}';\n`)]));
    expect(scanItems(temporaryItems('utf8.ts'), needles).hits.map((hit) => hit.needle)).toEqual([0, 1]);
    expect(scanItems(temporaryItems('latin1.ts'), needles).hits.map((hit) => hit.needle)).toEqual([1, 2]);
    // The same UTF-8 bytes read as latin1 hold neither needle: this is what decoding as UTF-8 is for.
    const bytes = fs.readFileSync(path.join(temporary, 'utf8.ts'));
    const asLatin1 = bytes.toString('latin1');
    expect([asLatin1.includes(beyondAscii), asLatin1.includes(shortBeyondAscii)]).toEqual([false, false]);
    expect(decodeText(bytes).includes(beyondAscii)).toBe(true);
  });

  it('positive control: derives lines of 40+ characters, headings, bold-only lines, table rows, sentence-sized pieces, figure text and guide text as needles', () => {
    const long = 'A synthetic sentence that is long enough to be a needle on its own, with a clause. And a second synthetic sentence that is also long enough to be a piece.';
    const medium = 'A synthetic heading of forty characters.';
    const presentation = [
      'Short line.',
      'A line of thirty-nine characters, here.',
      medium,
      `   ${medium} padded   `,
      '|----------------------------------------|----------------------------------------|',
      '### A synthetic heading ###',
      '## Too short',
      '**A bold-only line**',
      '**Tiny bold**',
      'A line with **a bold run inside** it.',
      '| a table row | with cells | 30 |',
      '| a short | table row |',
      long,
      '<!-- MATRIX_FIGURE_PLACEMENT: 1-1 -->', '', '[]{#fig-1-1}Figure 1-1. A synthetic caption.', '', '**Status: SYNTHETIC_STATUS**', '', '![A synthetic description.](assets/FIG1-1.png)',
    ].join('\n');
    expect(medium).toHaveLength(40);
    const needles = deriveNeedles(presentation, ['A synthetic guide heading', 'A synthetic guide prompt?']);
    expect([...needles].sort()).toEqual([
      long,
      'And a second synthetic sentence that is also long enough to be a piece.',
      'A synthetic sentence that is long enough to be a needle on its own, with a clause.',
      medium,
      `${medium} padded`,
      'A synthetic heading',
      'A bold-only line',
      'Status: SYNTHETIC_STATUS',
      '| a table row | with cells | 30 |',
      '[]{#fig-1-1}Figure 1-1. A synthetic caption.',
      '![A synthetic description.](assets/FIG1-1.png)',
      'Figure 1-1. A synthetic caption.',
      'A synthetic caption.',
      'SYNTHETIC_STATUS',
      'A synthetic description.',
      'A synthetic guide heading',
      'A synthetic guide prompt?',
    ].sort());
    expect('A synthetic heading'.length >= 12 && 'Too short'.length < 12 && 'Tiny bold'.length < 12).toBe(true);
    expect(['| a table row | with cells | 30 |'.length, '| a short | table row |'.length]).toEqual([33, 23]);
    expect(needles.includes('Short line.') || needles.includes('A line of thirty-nine characters, here.')).toBe(false);
  });

  it('positive control: the matcher agrees with a plain substring search, wherever a needle sits', () => {
    const filler = Array.from({ length: 400 }, (_, index) => `filler line number ${index} of a synthetic corpus`).join(' / ');
    const needles = [
      'needle at the very start of the text',
      'needle at the very end of the text',
      'needle in the middle of the text',
      'needle in the middle of the text, with a longer tail',
      'needle that is absent from the text',
      'needle in the middle of the tex!',
      'tiny',
      'gone',
      'filler line number 399 of a synthetic corpus',
      'filler line number 400 of a synthetic corpus',
    ];
    const text = [needles[0], filler, `${needles[3]} and tiny words`, filler, needles[1]].join(' / ');
    const expected = needles.map((needle, index) => (text.includes(needle) ? index : -1)).filter((index) => index >= 0);
    expect(expected).toEqual([0, 1, 2, 3, 6, 8]);
    expect([...needleMatcher(needles)(text)].sort((left, right) => left - right)).toEqual(expected);
    expect([...needleMatcher(needles)('')]).toEqual([]);
    expect([...needleMatcher([])(text)]).toEqual([]);
  });
});

describe('local guard: the scan set is what can leave the machine (throwaway repositories)', () => {
  const PUBLIC = 'a synthetic sentence that the published base already holds 0a1b';
  const PLANTED = 'a synthetic sentence that only a local commit holds 2c3d';
  const SECOND = 'a synthetic sentence that only the working tree holds 4e5f';
  const DERIVED = [PUBLIC, PLANTED, SECOND];
  const WORKING_TREE_ONLY = { sources: ['working tree'] } as const;
  const located = (result: GuardResult): string[] => result.hits.map((hit) => `${hit.source}|${hit.path}|${hit.needle}`);

  /** A repository with one published commit on the public remote. */
  function publishedRepository(name: string): ReturnType<typeof throwawayRepository> & { readonly published: string } {
    const repository = throwawayRepository(name);
    repository.write('docs/public.md', `${PUBLIC}\n`);
    repository.write('src/kept.ts', 'export const kept = 1;\n');
    const published = repository.commit('published base', ['docs/public.md', 'src/kept.ts']);
    repository.publish(`${PUBLIC_REMOTE}/main`, published);
    return { ...repository, published };
  }

  it('(1) finds a needle that one local commit added and the next local commit removed; the working tree alone does not hold it', () => {
    const repository = publishedRepository('added-then-removed');
    repository.write('src/leak.test.ts', `it('quotes the release', () => expect(text).toBe('${PLANTED}'));\n`);
    repository.commit('local commit 1 adds the sentence', ['src/leak.test.ts']);
    repository.write('src/leak.test.ts', "it('quotes nothing', () => expect(text).toBe('clean'));\n");
    const head = repository.commit('local commit 2 removes it', ['src/leak.test.ts']);

    const result = leakGuard(repository.root, DERIVED);
    expect(result.base).toEqual({ commit: repository.published, head, ahead: 2 });
    expect(result.needles).toEqual([PLANTED, SECOND]);
    // Both versions of the file are in what a push sends; the first one holds the sentence.
    expect(result.commitBlobs).toEqual(['src/leak.test.ts', 'src/leak.test.ts']);
    expect(result.indexBlobs).toEqual([]);
    expect(result.workingFiles).toEqual(['src/leak.test.ts']);
    expect(located(result)).toEqual(['commit blob|src/leak.test.ts|0']);
    expect(result.hits[0].length).toBe(PLANTED.length);
    expect(result.scanned).toBe(3);

    // The same functions on the working tree only: the file is read, it is clean, nothing is found.
    const workingTreeOnly = leakGuard(repository.root, DERIVED, WORKING_TREE_ONLY);
    expect([workingTreeOnly.workingFiles, workingTreeOnly.scanned, located(workingTreeOnly)]).toEqual([['src/leak.test.ts'], 1, []]);
  }, 60_000);

  it('(2) finds a needle that is staged in the index while the working tree no longer holds it, or no longer has the file', () => {
    const repository = publishedRepository('staged');
    // Staged with the sentence, then edited in the working tree to remove it (not staged again).
    repository.write('src/kept.ts', `export const kept = '${PLANTED}';\n`);
    repository.stage('src/kept.ts');
    repository.write('src/kept.ts', 'export const kept = 2;\n');
    // A new file staged with the sentence, then deleted from the working tree.
    repository.write('src/new.spec.ts', `const text = '${PLANTED}';\n`);
    repository.stage('src/new.spec.ts');
    fs.rmSync(path.join(repository.root, 'src', 'new.spec.ts'));

    const result = leakGuard(repository.root, DERIVED);
    expect(result.base.ahead).toBe(0);
    expect(result.commitBlobs).toEqual([]);
    expect(result.indexBlobs).toEqual(['src/kept.ts', 'src/new.spec.ts']);
    expect(result.workingFiles).toEqual(['src/kept.ts']);
    expect(located(result)).toEqual(['index|src/kept.ts|0', 'index|src/new.spec.ts|0']);

    const workingTreeOnly = leakGuard(repository.root, DERIVED, WORKING_TREE_ONLY);
    expect([workingTreeOnly.workingFiles, workingTreeOnly.scanned, located(workingTreeOnly)]).toEqual([['src/kept.ts'], 1, []]);
  }, 60_000);

  it('(3) finds a needle that only the working tree holds: a changed tracked file and an untracked file, not a deleted, ignored or binary one', () => {
    const repository = throwawayRepository('working-tree');
    repository.write('docs/public.md', `${PUBLIC}\n`);
    repository.write('docs/removed.md', 'A file the working tree deletes.\n');
    repository.write('src/kept.ts', 'export const kept = 1;\n');
    repository.write('.gitignore', 'ignored/\n');
    const published = repository.commit('published head', ['docs/public.md', 'docs/removed.md', 'src/kept.ts', '.gitignore']);
    repository.publish(`${PUBLIC_REMOTE}/feature`, published);

    repository.write('src/kept.ts', `export const kept = '${PLANTED}';\n`);
    repository.write('src/new.spec.ts', `const text = '${SECOND}';\n`);
    repository.write('ignored/private.md', `${PLANTED}\n`);
    repository.write('public/blob.bin', Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(PLANTED)]));
    fs.rmSync(path.join(repository.root, 'docs', 'removed.md'));
    const result = leakGuard(repository.root, DERIVED);
    expect(result.base).toEqual({ commit: published, head: published, ahead: 0 });
    expect([result.commitBlobs, result.indexBlobs]).toEqual([[], []]);
    expect(result.workingFiles).toEqual(['public/blob.bin', 'src/kept.ts', 'src/new.spec.ts']);
    expect(result.scanned).toBe(2);
    expect(result.skipped).toEqual([{ source: 'working tree', path: 'public/blob.bin' }]);
    expect(located(result)).toEqual(['working tree|src/kept.ts|0', 'working tree|src/new.spec.ts|1']);
  }, 60_000);

  it('(4) allows an empty scan when everything is published and the tree is clean', () => {
    const repository = publishedRepository('published-and-clean');
    const result = leakGuard(repository.root, DERIVED);
    expect(result.base).toEqual({ commit: repository.published, head: repository.published, ahead: 0 });
    expect([result.commitBlobs, result.indexBlobs, result.workingFiles, result.scanned, result.skipped, result.hits]).toEqual([[], [], [], 0, [], []]);
  }, 60_000);

  it('finds a needle a local commit added and still holds, in the commit and in the working tree; a comparison with HEAD on the working tree looks at nothing', () => {
    const repository = publishedRepository('local-commit');
    repository.write('src/leak.test.ts', `it('quotes the release', () => expect(text).toBe('${PLANTED}'));\n`);
    const local = repository.commit('local commit, not pushed', ['src/leak.test.ts']);
    const result = leakGuard(repository.root, DERIVED);
    expect(result.base).toEqual({ commit: repository.published, head: local, ahead: 1 });
    expect(located(result)).toEqual(['commit blob|src/leak.test.ts|0', 'working tree|src/leak.test.ts|0']);
    // HEAD as the baseline and the working tree as the scan set: no candidate, and the sentence counts as public.
    const againstHead = leakGuard(repository.root, DERIVED, { comparedWith: local, sources: ['working tree'] });
    expect([againstHead.workingFiles, againstHead.scanned, located(againstHead), againstHead.needles]).toEqual([[], 0, [], [SECOND]]);
  }, 60_000);

  it('reads what is public from the published commit, never from the working tree', () => {
    const repository = publishedRepository('corpus-source');
    repository.write('docs/public.md', `${PUBLIC}\n${PLANTED}\n`);
    const corpus = commitCorpus(repository.root, repository.published);
    expect([corpus.text.includes(PUBLIC), corpus.text.includes(PLANTED), corpus.files, corpus.blobIds.size]).toEqual([true, false, 2, 2]);
    const result = leakGuard(repository.root, DERIVED);
    expect(result.needles).toEqual([PLANTED, SECOND]);
    expect(located(result)).toEqual(['working tree|docs/public.md|0']);
  }, 60_000);

  it('takes the nearest published ancestor among several refs of the public remote; a ref of another remote publishes nothing', () => {
    const repository = throwawayRepository('several-refs');
    repository.write('a.md', 'first\n');
    const first = repository.commit('first', ['a.md']);
    repository.write('b.md', `${PUBLIC}\n`);
    const second = repository.commit('second', ['b.md']);
    repository.write('c.md', `${PLANTED}\n`);
    repository.commit('third, local', ['c.md']);
    repository.write('d.md', `${SECOND}\n`);
    const fourth = repository.commit('fourth, local', ['d.md']);
    // Pushed only to a remote that is not the public one: nothing is public yet.
    repository.publish('mirror/main', fourth);
    expect(publicBase(repository.root)).toBeNull();
    expect(() => leakGuard(repository.root, DERIVED)).toThrow(NO_PUBLIC_BASE);
    repository.publish(`${PUBLIC_REMOTE}/main`, first);
    expect(publicBase(repository.root)).toEqual({ commit: first, head: fourth, ahead: 3 });
    // A pull-request branch already pushed up to the second commit: that is the nearest public ancestor.
    repository.publish(`${PUBLIC_REMOTE}/feature`, second);
    expect(publicBase(repository.root)).toEqual({ commit: second, head: fourth, ahead: 2 });
    expect(publicBaseByMergeBases(repository.root)).toEqual(publicBase(repository.root));
    const result = leakGuard(repository.root, DERIVED);
    expect(result.commitBlobs).toEqual(['c.md', 'd.md']);
    expect(located(result)).toEqual(['commit blob|c.md|0', 'commit blob|d.md|1', 'working tree|c.md|0', 'working tree|d.md|1']);
    // A ref of the public remote on a commit that is not an ancestor of HEAD publishes only the history they share.
    gitAt(repository.root, ['checkout', '-q', '-b', 'side', second]);
    repository.write('e.md', 'side\n');
    const side = repository.commit('side, pushed', ['e.md']);
    gitAt(repository.root, ['checkout', '-q', 'main']);
    repository.publish(`${PUBLIC_REMOTE}/side`, side);
    expect(publicBase(repository.root)).toEqual({ commit: second, head: fourth, ahead: 2 });
    expect(publicBaseByMergeBases(repository.root)).toEqual(publicBase(repository.root));
    // Everything pushed to the public remote: HEAD is its own base and nothing is left to send.
    repository.publish(`${PUBLIC_REMOTE}/feature`, fourth);
    expect(publicBase(repository.root)).toEqual({ commit: fourth, head: fourth, ahead: 0 });
    expect(publicBaseByMergeBases(repository.root)).toEqual(publicBase(repository.root));
    expect(unpublishedBlobs(repository.root)).toEqual([]);
  }, 60_000);

  it('fails with a constant message: no ref of the public remote; nothing scanned; unreadable content where text is expected', () => {
    const unpublished = throwawayRepository('no-remote');
    unpublished.write('a.md', `${PLANTED}\n`);
    unpublished.commit('never pushed', ['a.md']);
    expect(publicBase(unpublished.root)).toBeNull();
    expect(publicBaseByMergeBases(unpublished.root)).toBeNull();
    expect(() => leakGuard(unpublished.root, DERIVED)).toThrow(NO_PUBLIC_BASE);

    const blind = publishedRepository('nothing-to-scan');
    blind.write('public/blob.bin', Buffer.from([0, 1, 2, 3]));
    blind.commit('a local commit that adds only a binary file', ['public/blob.bin']);
    expect(() => leakGuard(blind.root, DERIVED)).toThrow(NOTHING_SCANNED);
    // With a text file beside it there is something to scan, and the skip is reported, not hidden.
    blind.write('note.md', 'a note\n');
    const scanned = leakGuard(blind.root, DERIVED);
    expect([scanned.scanned, scanned.skipped]).toEqual([1, [{ source: 'commit blob', path: 'public/blob.bin' }, { source: 'working tree', path: 'public/blob.bin' }]]);
    // The same binary content under the paper tests, or named as text, is a failure.
    blind.write('src/lib/matrix-options/paper/__tests__/fixture.bin', Buffer.from([0, 1, 2, 3]));
    expect(() => leakGuard(blind.root, DERIVED)).toThrow(UNSCANNED_WHERE_TEXT_IS_EXPECTED);
    fs.rmSync(path.join(blind.root, 'src'), { recursive: true });
    blind.write('docs/dump.json', Buffer.concat([Buffer.from([0]), Buffer.from(PLANTED)]));
    expect(() => leakGuard(blind.root, DERIVED)).toThrow(`${UNSCANNED_WHERE_TEXT_IS_EXPECTED}: working tree docs/dump.json`);
  }, 60_000);
});

describePrivate('local guard: no text of the private release in anything that can leave the machine', () => {
  it('finds no needle that is not already published in an unpublished commit, the index or the working tree', () => {
    const structure = privateR5Structure();
    const guideText = resolveReviewerGuide(structure).questions.flatMap((question) => [question.heading, question.prompt]);
    const derived = deriveNeedles(readPrivatePresentation(), guideText);
    expect(derived.length).toBeGreaterThan(1000);

    // Fails by itself when there is no published base, when nothing was scanned although something
    // is unpublished or uncommitted, and when skipped content sits where text is expected.
    const result = leakGuard(ROOT, derived);
    expect(result.corpusFiles).toBeGreaterThan(1000);
    // The release differs from what is public: something is left to look for.
    expect(result.needles.length).toBeGreaterThan(100);
    expect(result.needles.length).toBeLessThan(derived.length);
    expect(result.hits).toEqual([]);
    // In memory only: the same matcher sees real needles when they are there, at any index.
    const sampled = [0, Math.floor(result.needles.length / 2), result.needles.length - 1];
    const matched = needleMatcher(result.needles)(sampled.map((index) => `const text = '${result.needles[index]}';`).join(' '));
    expect(sampled.every((index) => matched.has(index))).toBe(true);
  }, 120_000);
});
