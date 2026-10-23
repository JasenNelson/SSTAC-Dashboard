// Publishes the audited viewer export to the root app's public/Jermilova/ as an exact,
// committed mirror, and verifies it. The root deployment serves that mirror at /Jermilova
// (src/lib/jermilova-public/route-config.ts); nothing else ships the viewer.
//
// This is a short-running filesystem tool. It never builds and never supervises processes
// (its only child process is the bounded export audit): the export is built by the viewer's own
// `npm run build` (run it through the repository's monitored build caller), which calls this
// script around the build:
//
//   node scripts/publish-root-mirror.mjs --begin-build    record the viewer-source fingerprint
//   node scripts/publish-root-mirror.mjs --end-build      run the export audit between two snapshots
//                                                         of out/, require the same fingerprint, and
//                                                         write the receipt for exactly the audited bytes
//
// and then, by hand:
//
//   node scripts/publish-root-mirror.mjs --write          receipt == current source and exact export
//                                                         bytes; then out/ -> ../../public/Jermilova/
//                                                         (target must be absent) and published-mirror.json
//   node scripts/publish-root-mirror.mjs --check          committed mirror == published-mirror.json
//   node scripts/publish-root-mirror.mjs --check-export   runs the export audit, then fresh out/ ==
//                                                         published-mirror.json (only meaningful on the
//                                                         publishing node_modules layout)
//
// Every mode refuses symlinks and non-regular files, and compares the exact file set, byte
// length and SHA-256. --write publishes mirror + manifest as one transaction with rollback.
// Republish after an intended viewer or pinned src/ change: move the old public/Jermilova/
// outside public/ (it is generated output), build, --write, review the diff, commit.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const viewerRoot = path.resolve(scriptDir, '..');
export const repositoryRoot = path.resolve(viewerRoot, '../..');
export const exportRoot = path.join(viewerRoot, 'out');
export const mirrorRoot = path.join(repositoryRoot, 'public', 'Jermilova');
export const mirrorManifestPath = path.join(viewerRoot, 'published-mirror.json');
// Staging for --write lives in the viewer package (gitignored), never under public/.
const stagingRoot = path.join(viewerRoot, '.publish-staging');
// The build's receipt (gitignored): the fingerprint the build started from and, once the
// audit passed, the exact export it produced.
export const exportReceiptPath = path.join(viewerRoot, '.export-receipt.json');
const RECEIPT_SCHEMA = 'jermilova-export-receipt-v1';
export const MIRROR_SCHEMA = 'jermilova-public-mirror-v1';
export const MIRROR_BASE_PATH = '/Jermilova';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Every regular file under root as { path, bytes, sha256 }, sorted by '/'-joined path.
export function listTree(root) {
  const files = [];
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const info = lstatSync(full);
      if (info.isSymbolicLink()) throw new Error(`Symlink not allowed: ${full}`);
      if (info.isDirectory()) walk(full, relative);
      else if (info.isFile()) {
        const bytes = readFileSync(full);
        files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
      } else throw new Error(`Unexpected entry: ${full}`);
    }
  };
  const rootInfo = lstatSync(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error(`Not a real directory: ${root}`);
  walk(root, '');
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function readMirrorManifest() {
  const manifest = JSON.parse(readFileSync(mirrorManifestPath, 'utf8'));
  if (manifest.schema !== MIRROR_SCHEMA || manifest.base_path !== MIRROR_BASE_PATH || !Array.isArray(manifest.files)) {
    throw new Error('published-mirror.json has an unexpected schema or base path.');
  }
  return manifest;
}

// SHA-256 (base64, CSP source form) of every inline <script> body in a page, in order.
// The root route's CSP allows exactly these instead of 'unsafe-inline'.
export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => `sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}`,
  );
}

// Differences between a listed tree and the manifest: missing, extra, changed paths, plus
// the manifest's own consistency (unique paths, file count, total bytes).
export function compareToManifest(files, manifest) {
  const expected = new Map(manifest.files.map((file) => [file.path, file]));
  const actual = new Map(files.map((file) => [file.path, file]));
  const missing = [...expected.keys()].filter((key) => !actual.has(key));
  const extra = [...actual.keys()].filter((key) => !expected.has(key));
  const changed = [...expected.keys()].filter((key) => {
    const file = actual.get(key);
    return file && (file.bytes !== expected.get(key).bytes || file.sha256 !== expected.get(key).sha256);
  });
  const countOk =
    expected.size === manifest.files.length &&
    manifest.file_count === manifest.files.length &&
    files.length === manifest.files.length &&
    manifest.total_bytes === manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  return { ok: countOk && !missing.length && !extra.length && !changed.length, missing, extra, changed, countOk };
}

function runAudit() {
  // The audit is one short process (no children); a plain bounded spawnSync is enough.
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'audit-export.mjs')], { cwd: viewerRoot, encoding: 'utf8', timeout: 120_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Export audit failed (${result.error ? result.error.code || result.error.message : `exit ${result.status}`}); refusing to publish.`);
  const report = JSON.parse(result.stdout);
  if (report.t1_asset_hashes !== 'PASS' || report.t2_exact_allowlist !== 'PASS' || report.t3_bundle_leakage !== 'PASS') {
    throw new Error('Export audit did not pass T1/T2/T3; refusing to publish.');
  }
}

function pathEntryExists(target) {
  try {
    lstatSync(target);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

// Fingerprint of the viewer's own build inputs (the package's source, config, data and the
// src-closure pin), recorded at publish time. The required root test recomputes it, so a
// viewer change merged without a republish fails required CI. Line endings are normalised
// (CRLF -> LF) so Windows and Linux checkouts agree. Root src/ changes are covered by the
// src-closure pin in the viewer CI job, not here.
// scripts/ is included whole: it produces public/ (prepare-assets and its helpers) and holds
// every check and audit the publish relies on, so any tooling change also needs a republish.
const VIEWER_SOURCE_DIRS = ['app', 'components', 'forked', 'lib', 'public', 'scripts'];
const VIEWER_SOURCE_FILES = ['next.config.ts', 'package.json', 'tsconfig.json', 'postcss.config.mjs', 'viewer-capabilities.ts', 'asset-manifest.json', 'claim-register.json', 'src-closure.json'];

export function viewerSourceInputs() {
  const entries = [...VIEWER_SOURCE_FILES];
  for (const directory of VIEWER_SOURCE_DIRS) {
    for (const file of listTree(path.join(viewerRoot, directory))) {
      const relative = `${directory}/${file.path}`;
      // Only lib/*.test.ts(x) is left out; app/globals.css keeps exactly those out of
      // Tailwind's scan, so every scanned file is fingerprinted.
      if (/^lib\/[^/]+\.test\.tsx?$/.test(relative)) continue;
      entries.push(relative);
    }
  }
  return entries.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function viewerSourceFingerprint() {
  const entries = viewerSourceInputs();
  const digest = createHash('sha256');
  for (const relative of entries) {
    const raw = readFileSync(path.join(viewerRoot, ...relative.split('/')));
    const normalized = Buffer.from(raw.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    digest.update(`${relative}\t${sha256(normalized)}\n`);
  }
  return { sha256: digest.digest('hex'), file_count: entries.length };
}

// The exact export file list, reduced to one digest (paths, byte lengths, SHA-256).
function exportDigest(files) {
  return { file_count: files.length, total_bytes: files.reduce((sum, file) => sum + file.bytes, 0), sha256: sha256(JSON.stringify(files)) };
}

function sameDigest(a, b) {
  return Boolean(a && b) && a.sha256 === b.sha256 && a.file_count === b.file_count && a.total_bytes === b.total_bytes;
}

// --begin-build: called by `npm run build` after prepare-assets (which writes public/), before
// the checks and `next build`. Replaces any previous receipt.
function beginBuild() {
  rmSync(exportReceiptPath, { force: true });
  const viewerSource = viewerSourceFingerprint();
  writeFileSync(exportReceiptPath, `${JSON.stringify({ schema: RECEIPT_SCHEMA, stage: 'building', viewer_source: viewerSource, started_at: new Date().toISOString() }, null, 2)}\n`);
  return { mode: 'begin-build', ok: true, viewer_source: viewerSource };
}

// The export audit, run on out/ between two snapshots: returns the digest of exactly the bytes
// the audit read, or throws if the audit failed or out/ changed while it ran.
function auditedExportDigest() {
  const before = publishedExportFiles();
  runAudit();
  const after = publishedExportFiles();
  if (!sameDigest(exportDigest(after), exportDigest(before))) throw new Error('out/ changed while it was being audited.');
  return { files: after, digest: exportDigest(after) };
}

// --end-build: the last step of `npm run build` (after `next build`). It runs the export audit
// itself, so the receipt binds the inputs to exactly the bytes the audit read; the inputs must
// be unchanged since --begin-build.
function endBuild() {
  const receipt = readReceipt();
  if (receipt.stage !== 'building') throw new Error('No build in progress (run the viewer build, which starts with --begin-build).');
  const viewerSource = viewerSourceFingerprint();
  if (receipt.viewer_source.sha256 !== viewerSource.sha256 || receipt.viewer_source.file_count !== viewerSource.file_count) {
    rmSync(exportReceiptPath, { force: true });
    throw new Error('Viewer inputs changed while the export was being built; the receipt was removed. Rebuild.');
  }
  let exported;
  try {
    exported = auditedExportDigest().digest;
  } catch (error) {
    rmSync(exportReceiptPath, { force: true });
    throw new Error(`${error instanceof Error ? error.message : String(error)} The receipt was removed. Rebuild.`);
  }
  writeFileSync(exportReceiptPath, `${JSON.stringify({ ...receipt, stage: 'audited', export: exported, audited_at: new Date().toISOString() }, null, 2)}\n`);
  return { mode: 'end-build', ok: true, viewer_source: viewerSource, export: exported };
}

function readReceipt() {
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(exportReceiptPath, 'utf8'));
  } catch {
    throw new Error(`No readable export receipt at ${exportReceiptPath}; run the viewer build first.`);
  }
  if (receipt.schema !== RECEIPT_SCHEMA || !receipt.viewer_source) throw new Error('The export receipt has an unexpected schema.');
  return receipt;
}

function write() {
  const temporaryManifest = `${mirrorManifestPath}.tmp`;
  // lstat, not existsSync: a dangling link at any of these paths counts as present.
  if (pathEntryExists(mirrorRoot)) throw new Error(`Target already exists (move the previous mirror aside first): ${mirrorRoot}`);
  if (pathEntryExists(stagingRoot)) throw new Error(`Staging directory already exists (a previous --write failed?): ${stagingRoot}`);
  if (pathEntryExists(temporaryManifest)) throw new Error(`Temporary manifest already exists (a previous --write failed?): ${temporaryManifest}`);
  // Only an export the viewer build audited, from exactly the current viewer inputs, is
  // published: the receipt must match both, and the staged copy is verified against the same
  // file list.
  const receipt = readReceipt();
  if (receipt.stage !== 'audited') throw new Error('The last viewer build did not finish its audit; rebuild before publishing.');
  const viewerSource = viewerSourceFingerprint();
  if (receipt.viewer_source.sha256 !== viewerSource.sha256 || receipt.viewer_source.file_count !== viewerSource.file_count) {
    throw new Error('The viewer inputs changed since the export was built; rebuild before publishing.');
  }
  const files = publishedExportFiles();
  if (!sameDigest(exportDigest(files), receipt.export)) throw new Error('out/ differs from the export the build audited; rebuild before publishing.');
  const manifest = {
    schema: MIRROR_SCHEMA,
    base_path: MIRROR_BASE_PATH,
    mount: 'public/Jermilova',
    file_count: files.length,
    total_bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    index_inline_script_sha256: inlineScriptHashes(readFileSync(path.join(exportRoot, 'index.html'), 'utf8')),
    viewer_source: viewerSource,
    files,
  };
  // One transaction: stage the mirror, write the new manifest to a temporary file, promote
  // both, and verify the promoted pair. Any failure restores the previous manifest and moves a
  // promoted mirror back out of public/ (the previous mirror was moved aside by the operator).
  const previousManifest = pathEntryExists(mirrorManifestPath) ? readFileSync(mirrorManifestPath) : null;
  let temporaryAttempted = false;
  let mirrorPromoted = false;
  let manifestReplaced = false;
  try {
    for (const file of files) {
      const target = path.join(stagingRoot, ...file.path.split('/'));
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(path.join(exportRoot, ...file.path.split('/')), target);
    }
    const staged = compareToManifest(listTree(stagingRoot), manifest);
    if (!staged.ok) throw new Error(`Staged mirror verification failed: ${JSON.stringify(staged)}`);
    temporaryAttempted = true;
    writeFileSync(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    // Re-check right before promotion: on POSIX a rename onto an empty directory would succeed
    // silently, and the recorded fingerprint must still describe the current inputs.
    if (pathEntryExists(mirrorRoot)) throw new Error(`Target appeared during the publish: ${mirrorRoot}`);
    const viewerSourceNow = viewerSourceFingerprint();
    if (viewerSourceNow.sha256 !== viewerSource.sha256 || viewerSourceNow.file_count !== viewerSource.file_count) {
      throw new Error('The viewer inputs changed during the publish; refusing to promote.');
    }
    renameSync(stagingRoot, mirrorRoot);
    mirrorPromoted = true;
    renameSync(temporaryManifest, mirrorManifestPath);
    manifestReplaced = true;
    const promoted = compareToManifest(listTree(mirrorRoot), readMirrorManifest());
    if (!promoted.ok) throw new Error(`Mirror verification failed after promotion: ${JSON.stringify(promoted)}`);
  } catch (error) {
    // Each rollback step runs on its own; any rollback failure is reported with the original.
    const rollbackErrors = [];
    const attempt = (step) => {
      try {
        step();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    };
    if (manifestReplaced) {
      attempt(() => (previousManifest ? writeFileSync(mirrorManifestPath, previousManifest) : rmSync(mirrorManifestPath, { force: true })));
    }
    if (mirrorPromoted) attempt(() => renameSync(mirrorRoot, stagingRoot));
    attempt(() => {
      if (pathEntryExists(stagingRoot) && !pathEntryExists(mirrorRoot)) rmSync(stagingRoot, { recursive: true, force: true });
    });
    // The temporary path was verified absent before this run, so anything there is ours.
    attempt(() => {
      if (temporaryAttempted && pathEntryExists(temporaryManifest)) rmSync(temporaryManifest, { force: true });
    });
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], 'Publish failed and rollback was incomplete; inspect public/Jermilova, published-mirror.json and the staging directory.');
    }
    throw error;
  }
  return { mode: 'write', ok: true, file_count: files.length, total_bytes: manifest.total_bytes, viewer_source: manifest.viewer_source };
}

// The export's files that are published. The Next 404 pages are left out: the root app answers
// unknown paths with its own not-found page, so they would only be extra anonymous pages whose
// inline scripts the mount CSP (hashed from index.html) does not allow. index.html is then the
// only published HTML page.
const UNPUBLISHED_EXPORT_FILE = /^404(\.html$|\/)/;
export function publishedExportFiles() {
  return listTree(exportRoot).filter((file) => !UNPUBLISHED_EXPORT_FILE.test(file.path));
}

function check(root, mode) {
  const result = compareToManifest(listTree(root), readMirrorManifest());
  return { mode, ...result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const mode = process.argv[2];
  try {
    let report;
    if (mode === '--write') report = write();
    else if (mode === '--check') report = check(mirrorRoot, 'check');
    else if (mode === '--check-export') {
      // A fresh export is accepted only if it also passes the export audit, and only if the
      // bytes the audit read are the bytes compared.
      const { files } = auditedExportDigest();
      report = { mode: 'check-export', ...compareToManifest(files, readMirrorManifest()) };
    }
    else if (mode === '--begin-build') report = beginBuild();
    else if (mode === '--end-build') report = endBuild();
    else throw new Error('Usage: publish-root-mirror.mjs --begin-build | --end-build | --write | --check | --check-export');
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
