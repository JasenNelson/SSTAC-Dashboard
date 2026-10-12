/* Validate governed, checkout-local launcher inputs before any local service starts. */
/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const expectedPaths = [
  'v0.9.91/presentation.md',
  'v0.9.91/figures/native-figure-models.json',
  'v0.9.91/appendix_l_media/image1.png',
];
const hex64 = /^[a-f0-9]{64}$/i;
const providerKey = /(?:password|secret|token|api[_-]?key|service[_-]?role|database[_-]?url|supabase.*key)/i;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function absoluteExisting(value, kind, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    throw new Error(`NATIVE_${label}_INVALID_ROOT`);
  }
  let resolved;
  try { resolved = fs.realpathSync.native(value); } catch { throw new Error(`NATIVE_${label}_MISSING`); }
  const stat = fs.statSync(resolved);
  if ((kind === 'file' && !stat.isFile()) || (kind === 'directory' && !stat.isDirectory())) {
    throw new Error(`NATIVE_${label}_WRONG_TYPE`);
  }
  return resolved;
}

function rejectCredentialKeys(value) {
  if (Array.isArray(value)) return value.forEach(rejectCredentialKeys);
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (providerKey.test(key)) throw new Error('NATIVE_PROVIDER_CREDENTIAL_REJECTED');
    rejectCredentialKeys(entry);
  }
}

function exactKeys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      required.some((key) => !Object.hasOwn(value, key)) ||
      Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new Error('NATIVE_CONFIG_SHAPE_MISMATCH');
  }
}

function validatedOutputRoot(repo, config) {
  const local = path.join(repo, '.tmp', 'native-local-e2e');
  const proposed = config.evidenceRoot || path.join(local, 'R9');
  if (typeof proposed !== 'string' || !path.isAbsolute(proposed) || proposed.split(/[\\/]/).includes('..')) {
    throw new Error('NATIVE_EVIDENCE_INVALID_ROOT');
  }
  const parent = absoluteExisting(path.dirname(proposed), 'directory', 'EVIDENCE_PARENT');
  const approved = config.evidenceRoot
    ? config.allowedOutputRoots.map((root) => {
      const resolved = absoluteExisting(root, 'directory', 'OUTPUT_ALLOWLIST');
      if (resolved === path.parse(resolved).root) throw new Error('NATIVE_OUTPUT_ALLOWLIST_TOO_BROAD');
      return resolved;
    })
    : [absoluteExisting(local, 'directory', 'LOCAL_OUTPUT')];
  if (!approved.some((root) => inside(root, parent))) throw new Error('NATIVE_EVIDENCE_OUTSIDE_PERMITTED_ROOT');
  if (fs.existsSync(proposed)) {
    const existing = absoluteExisting(proposed, 'directory', 'EVIDENCE');
    if (!approved.some((root) => inside(root, existing))) throw new Error('NATIVE_EVIDENCE_OUTSIDE_PERMITTED_ROOT');
    return existing;
  }
  return proposed;
}

function loadNativeInputs(repoPath, argv) {
  const repo = absoluteExisting(repoPath, 'directory', 'REPO');
  if (argv.length !== 4 || argv[0] !== '--config' || argv[2] !== '--config-sha256' || !hex64.test(argv[3])) {
    throw new Error('NATIVE_CONFIG_REQUIRED');
  }
  const configPath = absoluteExisting(argv[1], 'file', 'CONFIG');
  const local = absoluteExisting(path.join(repo, '.tmp', 'native-local-e2e'), 'directory', 'LOCAL_CONFIG');
  if (!inside(local, configPath)) throw new Error('NATIVE_CONFIG_OUTSIDE_CHECKOUT');
  const configBytes = fs.readFileSync(configPath);
  if (sha256(configBytes) !== argv[3].toLowerCase()) throw new Error('NATIVE_CONFIG_HASH_MISMATCH');
  const config = JSON.parse(configBytes.toString('utf8'));
  rejectCredentialKeys(config);
  exactKeys(config, ['schema', 'repoRoot', 'corpusRoot', 'candidateManifestPath',
    'candidateManifestSha256', 'allowedInputRoots'], ['evidenceRoot', 'allowedOutputRoots']);
  if (config.schema !== 'matrix-v0991-native-local-launcher-v1' ||
      absoluteExisting(config.repoRoot, 'directory', 'CONFIG_REPO') !== repo ||
      !hex64.test(config.candidateManifestSha256) ||
      !Array.isArray(config.allowedInputRoots) || config.allowedInputRoots.length < 1 ||
      config.allowedInputRoots.length > 4 ||
      (Object.hasOwn(config, 'evidenceRoot') && !config.evidenceRoot) ||
      (!config.evidenceRoot && Object.hasOwn(config, 'allowedOutputRoots')) ||
      (config.evidenceRoot && (!Array.isArray(config.allowedOutputRoots) ||
        config.allowedOutputRoots.length < 1 || config.allowedOutputRoots.length > 4))) {
    throw new Error('NATIVE_CONFIG_SHAPE_MISMATCH');
  }
  const allowed = config.allowedInputRoots.map((root) => {
    const resolved = absoluteExisting(root, 'directory', 'INPUT_ALLOWLIST');
    if (resolved === path.parse(resolved).root) throw new Error('NATIVE_INPUT_ALLOWLIST_TOO_BROAD');
    return resolved;
  });
  const root = absoluteExisting(config.corpusRoot, 'directory', 'CORPUS');
  const manifestPath = absoluteExisting(config.candidateManifestPath, 'file', 'MANIFEST');
  if (!allowed.some((approved) => inside(approved, root)) ||
      !allowed.some((approved) => inside(approved, manifestPath))) {
    throw new Error('NATIVE_INPUT_OUTSIDE_PERMITTED_ROOT');
  }
  const manifestBytes = fs.readFileSync(manifestPath);
  if (sha256(manifestBytes) !== config.candidateManifestSha256.toLowerCase()) {
    throw new Error('NATIVE_LOCAL_MANIFEST_HASH_MISMATCH');
  }
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  rejectCredentialKeys(manifest);
  if (manifest.schema !== 'pr812-v0991-native-storage-proposal-v1' ||
      manifest.objectCount !== 3 || !Array.isArray(manifest.objects) || manifest.objects.length !== 3 ||
      expectedPaths.some((key, index) => manifest.objects[index].objectPath !== key)) {
    throw new Error('NATIVE_LOCAL_MANIFEST_SHAPE_MISMATCH');
  }
  let total = 0;
  for (const entry of manifest.objects) {
    if (!hex64.test(entry.sha256) || !Number.isInteger(entry.bytes) || entry.bytes < 1) {
      throw new Error('NATIVE_LOCAL_MANIFEST_SHAPE_MISMATCH');
    }
    const source = absoluteExisting(path.join(root, ...entry.objectPath.split('/')), 'file', 'SOURCE');
    const statedSource = absoluteExisting(entry.sourcePath, 'file', 'SOURCE_PATH');
    if (!inside(root, source) || source !== statedSource) throw new Error('NATIVE_LOCAL_SOURCE_PATH_MISMATCH');
    const bytes = fs.readFileSync(source);
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256.toLowerCase()) {
      throw new Error('NATIVE_LOCAL_SOURCE_HASH_MISMATCH');
    }
    total += bytes.length;
  }
  if (total !== manifest.totalBytes) throw new Error('NATIVE_LOCAL_TOTAL_MISMATCH');
  const evidenceRoot = validatedOutputRoot(repo, config);
  fs.mkdirSync(evidenceRoot, { recursive: true });
  return { root, model: manifest.objects[1], evidenceRoot, configPath, manifestPath };
}

module.exports = { loadNativeInputs, inside };
