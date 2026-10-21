import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureSafeDirectory,
  inspectSafeFileTarget,
  verifyExistingDirectory,
} from './path-safety.mjs';

const EXPECTED_MANIFEST_SHA256 = '135e6bafc3c8aaf0907b5c41e32a6801ed6338790233c6db822981a2f2c5c526';
const EXPECTED_PACK_ID = 'bnrrm-casestudy-jermilova2025-mackenzie-hg';
const EXPECTED_ASSET_KEYS = [
  'pack',
  'runtime_model',
  'model_overview',
  'decisions',
  'provenance',
  'training_data',
  'basins_gsl',
  'basins_gbs',
  'advisory_lakes',
  'commercial_fisheries',
  'historic_mines',
  'large_mines',
  'hydro_facilities',
  'climate_stations',
  'thaw_slumps',
  'site_reports',
  'mineral_claims',
  'oil_gas_claims',
  'communities',
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const viewerRoot = path.resolve(scriptDir, '..');
const repositoryRoot = path.resolve(viewerRoot, '../..');
const manifestPath = path.join(viewerRoot, 'asset-manifest.json');
const manifestTarget = await inspectSafeFileTarget(viewerRoot, manifestPath);
if (!manifestTarget.exists) throw new Error('Viewer asset manifest is missing.');
const manifestBytes = await readFile(manifestTarget.path);
const manifestHash = createHash('sha256').update(manifestBytes).digest('hex');

if (manifestHash !== EXPECTED_MANIFEST_SHA256) {
  throw new Error(`Viewer asset manifest hash mismatch: ${manifestHash}`);
}

const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (
  manifest.pack_id !== EXPECTED_PACK_ID ||
  manifest.source_pack_dir !== `public/bn-rrm/packs/${EXPECTED_PACK_ID}` ||
  !Array.isArray(manifest.assets) ||
  manifest.assets.length !== EXPECTED_ASSET_KEYS.length
) {
  throw new Error('Viewer asset manifest has an unexpected pack or asset count.');
}

const actualKeys = manifest.assets.map((asset) => asset.key).sort();
const expectedKeys = [...EXPECTED_ASSET_KEYS].sort();
if (actualKeys.some((key, index) => key !== expectedKeys[index])) {
  throw new Error('Viewer asset manifest does not contain the exact approved asset keys.');
}

const sourceRoot = path.resolve(repositoryRoot, manifest.source_pack_dir);
const destinationRoot = path.join(viewerRoot, 'public', 'bn-rrm', 'packs', EXPECTED_PACK_ID);
const registryPath = path.join(viewerRoot, 'public', 'bn-rrm', 'pack-registry.json');
await verifyExistingDirectory(repositoryRoot, sourceRoot);
const sourceRootReal = await realpath(sourceRoot);
const packSourcePath = await inspectSafeFileTarget(sourceRoot, path.join(sourceRoot, 'pack.json'));
if (!packSourcePath.exists) throw new Error('Frozen source pack manifest is missing.');
const packSourceBytes = await readFile(packSourcePath.path);
const sourcePack = JSON.parse(packSourceBytes.toString('utf8'));
if (sourcePack.pack_id !== EXPECTED_PACK_ID || sourcePack.release_stage !== 'prototype') {
  throw new Error('Frozen source pack identity or stage is unexpected.');
}

const registry = {
  schema_version: '1.0',
  default_pack_id: EXPECTED_PACK_ID,
  packs: [
    {
      pack_id: EXPECTED_PACK_ID,
      display_name: sourcePack.display_name,
      scope_type: sourcePack.scope_type,
      release_stage: sourcePack.release_stage,
      is_default: true,
      path: `packs/${EXPECTED_PACK_ID}`,
    },
  ],
};

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const registryBytes = Buffer.from(`${JSON.stringify(registry, null, 2)}\n`, 'utf8');
const safeDestinationRoot = await ensureSafeDirectory(viewerRoot, destinationRoot);
const safeRegistryParent = await ensureSafeDirectory(viewerRoot, path.dirname(registryPath));
const safeRegistryPath = path.join(safeRegistryParent, path.basename(registryPath));
const existingRegistry = await inspectSafeFileTarget(viewerRoot, safeRegistryPath);
if (existingRegistry.exists) {
  const existing = await readFile(existingRegistry.path);
  if (!existing.equals(registryBytes)) {
    throw new Error('Existing viewer registry differs; refusing overwrite.');
  }
}

const assetPlans = [];
for (const asset of manifest.assets) {
  if (
    typeof asset.path !== 'string' ||
    asset.path.includes('\\') ||
    asset.path.includes(':') ||
    asset.path.startsWith('/') ||
    asset.path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe asset path for '${asset.key}'.`);
  }
  const sourcePath = path.resolve(sourceRoot, ...asset.path.split('/'));
  const destinationPath = path.resolve(destinationRoot, ...asset.path.split('/'));
  const sourceTarget = await inspectSafeFileTarget(sourceRootReal, sourcePath);
  if (!sourceTarget.exists) throw new Error(`Source asset '${asset.key}' is missing.`);
  const bytes = await readFile(sourceTarget.path);
  const actualHash = hash(bytes);
  if (bytes.length !== asset.bytes || actualHash !== asset.sha256) {
    throw new Error(`Source asset '${asset.key}' differs from its frozen manifest.`);
  }

  const safeParent = await ensureSafeDirectory(viewerRoot, path.dirname(destinationPath));
  const safeDestinationPath = path.join(safeParent, path.basename(destinationPath));
  const destinationTarget = await inspectSafeFileTarget(viewerRoot, safeDestinationPath);
  if (destinationTarget.exists) {
    const destinationBytes = await readFile(destinationTarget.path);
    if (destinationBytes.length !== bytes.length || hash(destinationBytes) !== actualHash) {
      throw new Error(`Existing destination asset '${asset.key}' differs; refusing overwrite.`);
    }
  }
  assetPlans.push({ asset, sourcePath: sourceTarget.path, destinationPath: safeDestinationPath, actualHash });
}

const expectedPaths = manifest.assets.map((asset) => asset.path).sort();

const copied = [];
for (const plan of assetPlans) {
  const safeParent = await ensureSafeDirectory(viewerRoot, path.dirname(plan.destinationPath));
  const safeDestinationPath = path.join(safeParent, path.basename(plan.destinationPath));
  const destinationTarget = await inspectSafeFileTarget(viewerRoot, safeDestinationPath);
  if (destinationTarget.exists) {
    const destinationBytes = await readFile(destinationTarget.path);
    if (destinationBytes.length !== plan.asset.bytes || hash(destinationBytes) !== plan.actualHash) {
      throw new Error(`Existing destination asset '${plan.asset.key}' changed after preflight.`);
    }
  } else {
    await copyFile(plan.sourcePath, safeDestinationPath, constants.COPYFILE_EXCL);
    const copiedTarget = await inspectSafeFileTarget(viewerRoot, safeDestinationPath);
    if (!copiedTarget.exists) throw new Error(`Copied destination asset '${plan.asset.key}' is missing.`);
  }
  copied.push({ key: plan.asset.key, bytes: plan.asset.bytes, sha256: plan.actualHash });
}

const registryParentForWrite = await ensureSafeDirectory(viewerRoot, path.dirname(registryPath));
const registryPathForWrite = path.join(registryParentForWrite, path.basename(registryPath));
const registryTargetForWrite = await inspectSafeFileTarget(viewerRoot, registryPathForWrite);
if (registryTargetForWrite.exists) {
  const currentBytes = await readFile(registryTargetForWrite.path);
  if (!currentBytes.equals(registryBytes)) {
    throw new Error('Viewer registry changed after preflight; refusing write.');
  }
} else {
  await writeFile(registryPathForWrite, registryBytes, { flag: 'wx' });
  const writtenRegistry = await inspectSafeFileTarget(viewerRoot, registryPathForWrite);
  if (!writtenRegistry.exists) throw new Error('Viewer registry was not written.');
}

async function inventoryDestination(root, prefix = '') {
  const found = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = prefix ? path.join(prefix, entry.name) : entry.name;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await verifyExistingDirectory(root, full);
      found.push(...(await inventoryDestination(full, relative)));
    } else if (entry.isFile()) {
      const target = await inspectSafeFileTarget(root, full);
      if (!target.exists) throw new Error(`Viewer asset disappeared during audit: ${full}`);
      found.push(relative.replaceAll(path.sep, '/'));
    } else {
      throw new Error(`Unsupported entry in viewer asset destination: ${full}`);
    }
  }
  return found;
}

const destinationPaths = (await inventoryDestination(safeDestinationRoot)).sort();
if (destinationPaths.length !== expectedPaths.length || destinationPaths.some((value, index) => value !== expectedPaths[index])) {
  throw new Error('Viewer pack destination contains files outside the exact allowlist.');
}

console.log(JSON.stringify({ status: 'PASS', pack_id: EXPECTED_PACK_ID, asset_count: copied.length, copied }, null, 2));
