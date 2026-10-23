import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditBundleMarkers,
  authenticatePinnedApiRouteSources,
  NEXT_API_ROUTE_SOURCE_PINS,
} from './audit-export-core.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const viewerRoot = path.resolve(scriptDir, '..');
const repositoryRoot = path.resolve(viewerRoot, '../..');
const exportRoot = path.join(viewerRoot, 'out');
const assetManifest = JSON.parse(await readFile(path.join(viewerRoot, 'asset-manifest.json'), 'utf8'));
const packRoot = path.join(exportRoot, 'bn-rrm', 'packs', assetManifest.pack_id);
const outputRoot = path.join(exportRoot, 'bn-rrm');

const expectedPackFiles = assetManifest.assets.map((asset) => asset.path.replaceAll('/', path.sep)).sort();
const expectedRegistryPath = 'pack-registry.json';
const expectedOutput = [expectedRegistryPath, ...expectedPackFiles.map((file) => path.join('packs', assetManifest.pack_id, file))]
  .map((value) => value.replaceAll(path.sep, '/'))
  .sort();

async function filesUnder(root, prefix = '') {
  const results = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = prefix ? path.join(prefix, entry.name) : entry.name;
    const full = path.join(root, entry.name);
    const info = await lstat(full);
    if (info.isSymbolicLink()) throw new Error(`Unexpected symlink in export: ${full}`);
    if (entry.isDirectory()) results.push(...(await filesUnder(full, relative)));
    else if (entry.isFile()) results.push(relative.replaceAll(path.sep, '/'));
    else throw new Error(`Unexpected export entry: ${full}`);
  }
  return results;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const actualOutput = (await filesUnder(outputRoot)).sort();
const t2PackPassed = actualOutput.length === expectedOutput.length && actualOutput.every((value, index) => value === expectedOutput[index]);

// The whole export, not only out/bn-rrm: every other file must be framework output under
// _next/ or a route artifact of the viewer's single page ('/') or Next's built-in
// 404/not-found pages. A new debug route or public file fails closed here.
const ROUTE_ARTIFACTS = [
  /^index\.(html|txt)$/,
  /^404\.html$/,
  /^404\/index\.(html|txt)$/,
  /^_not-found(\.(html|txt)|\/index\.(html|txt))$/,
];
// Framework output is allowed only as scripts, styles (both scanned below) and binary images
// and fonts: a source map, SVG or any other text type under _next/ would carry text the
// bundle audit does not scan.
const FRAMEWORK_FILE = /^_next\/.+\.(js|css|png|woff2?)$/;
const unexpectedExportFiles = (await filesUnder(exportRoot))
  .filter((file) => !FRAMEWORK_FILE.test(file) && !file.startsWith('bn-rrm/'))
  .filter((file) => !ROUTE_ARTIFACTS.some((pattern) => pattern.test(file)))
  .sort();
const t2Passed = t2PackPassed && unexpectedExportFiles.length === 0;
const assetResults = [];
for (const asset of assetManifest.assets) {
  const bytes = await readFile(path.join(packRoot, ...asset.path.split('/')));
  assetResults.push({
    key: asset.key,
    path: asset.path,
    bytes: bytes.length,
    sha256: sha256(bytes),
    pass: bytes.length === asset.bytes && sha256(bytes) === asset.sha256,
  });
}
const t1Passed = assetResults.every((asset) => asset.pass);

// Every other pack id in the authenticated app's full registry is forbidden in the bundle.
const fullRegistry = JSON.parse(await readFile(path.join(repositoryRoot, 'public', 'bn-rrm', 'pack-registry.json'), 'utf8'));
const otherPackIds = (fullRegistry.packs ?? [])
  .map((entry) => entry.pack_id)
  .filter((id) => id !== assetManifest.pack_id);
if (!otherPackIds.length) throw new Error('Full pack registry lists no other packs; the other-pack check would be vacuous.');

// '/api/' is forbidden everywhere except one narrow, proven case: Next's own
// isAPIRoute helper, authenticated against pinned Next source bytes.
const apiSourceRecords = [];
for (const pin of NEXT_API_ROUTE_SOURCE_PINS) {
  const bytes = await readFile(path.join(repositoryRoot, ...pin.path.split('/')));
  apiSourceRecords.push({ path: pin.path, kind: pin.kind, bytes, bytes_count: bytes.length, sha256: sha256(bytes) });
}
const apiInputFiles = apiSourceRecords.map((record) => ({ path: record.path, bytes: record.bytes_count, sha256: record.sha256 }));
const apiSourceAuthentication = authenticatePinnedApiRouteSources(apiSourceRecords, apiInputFiles);

const checkedBundleFiles = [];
const bundleFiles = [];
async function auditBundles(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await auditBundles(full);
    } else if (entry.isFile() && /\.(js|mjs|css|html|json|txt)$/i.test(entry.name)) {
      checkedBundleFiles.push(full);
      bundleFiles.push({ relativePath: path.relative(exportRoot, full).replaceAll(path.sep, '/'), bytes: await readFile(full) });
    }
  }
}

await auditBundles(exportRoot);
const foundMarkers = auditBundleMarkers(bundleFiles, apiSourceAuthentication.authenticated, otherPackIds);
const t3Passed = foundMarkers.length === 0;
const report = {
  t1_asset_hashes: t1Passed ? 'PASS' : 'FAIL',
  t2_exact_allowlist: t2Passed ? 'PASS' : 'FAIL',
  t2_actual_files: actualOutput,
  t2_expected_files: expectedOutput,
  t2_unexpected_export_files: unexpectedExportFiles,
  t3_bundle_leakage: t3Passed ? 'PASS' : 'FAIL',
  t3_checked_files: checkedBundleFiles.length,
  t3_findings: foundMarkers,
  t3_api_source_provenance: apiSourceAuthentication.results,
  t1_assets: assetResults,
};
console.log(JSON.stringify(report, null, 2));
if (!t1Passed || !t2Passed || !t3Passed) process.exitCode = 1;
