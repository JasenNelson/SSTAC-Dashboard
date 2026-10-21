import assetManifestJson from '../asset-manifest.json';
import claimRegisterJson from '../claim-register.json';
import { dagForwardInference } from '@/lib/bn-rrm/bn-inference';
import { createGenericNetwork } from '@/lib/bn-rrm/trained-network';
import { validatePackSchema, type PackManifest } from '@/lib/bn-rrm/pack-types';
import type { NetworkModel } from '@/types/bn-rrm/network';
import { JERMILOVA_VIEWER_CAPABILITIES } from '../viewer-capabilities';
import { validateJermilovaRuntime } from './validateJermilovaRuntime';

interface AssetRecord {
  role: string;
  key: string;
  path: string;
  sha256: string;
  bytes: number;
}

interface ViewerAssetManifest {
  pack_id: string;
  source_pack_dir: string;
  assets: AssetRecord[];
}

interface RegistryEntry {
  pack_id: string;
  path: string;
  is_default: boolean;
}

interface ViewerRegistry {
  schema_version: string;
  default_pack_id: string;
  packs: RegistryEntry[];
}

export interface LoadedJermilovaPack {
  pack: PackManifest;
  model: NetworkModel;
  baseline: Record<string, Record<string, number>>;
  artifacts: Record<string, unknown>;
  artifactHashes: Record<string, string>;
  claims: VerifiedClaim[];
}

const assetManifest = assetManifestJson as ViewerAssetManifest;

export interface VerifiedClaim {
  id: string;
  group: string;
  label: string;
  approved_text: string | number | string[];
}

export interface TrainingDataset {
  display_name: string;
  fish_count: number;
  water_count: number;
  fish_columns: string[];
  water_columns: string[];
  fish_cases: Array<Record<string, string | number | null>>;
  water_cases: Array<Record<string, string | number | null>>;
}

export interface JermilovaTrainingData {
  models: {
    GSL: TrainingDataset;
    GBS: TrainingDataset;
  };
}

function getAsset(key: string): AssetRecord {
  const matches = assetManifest.assets.filter((asset) => asset.key === key);
  if (matches.length !== 1) {
    throw new Error(`Asset manifest must define exactly one '${key}' asset.`);
  }
  return matches[0];
}

async function readJsonResponse(
  fetcher: typeof fetch,
  url: string,
): Promise<unknown> {
  const response = await fetcher(url, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Unable to load approved pack resource (${response.status}).`);
  }
  return response.json();
}

async function readVerifiedJson(
  fetcher: typeof fetch,
  url: string,
  asset: AssetRecord,
): Promise<unknown> {
  const response = await fetcher(url, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Unable to load approved pack asset '${asset.key}' (${response.status}).`);
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.bytes) {
    throw new Error(`Pack asset '${asset.key}' has an unexpected byte length.`);
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, '0')).join('');
  if (hash !== asset.sha256) {
    throw new Error(`Pack asset '${asset.key}' failed its SHA256 check.`);
  }

  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function getPathValue(value: unknown, fieldPath: string): unknown {
  return fieldPath.split('.').reduce<unknown>((current, part) => {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

async function sha256Text(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, '0')).join('');
}

async function verifyRegisteredClaims(
  artifacts: Record<string, unknown>,
  artifactHashes: Record<string, string>,
): Promise<VerifiedClaim[]> {
  const register = claimRegisterJson as {
    schema_version?: unknown;
    excerpt_encoding?: unknown;
    claims?: unknown;
  };
  if (
    register.schema_version !== 'jermilova-public-claim-register-v1' ||
    register.excerpt_encoding !== 'UTF-8 JSON.stringify(value)' ||
    !Array.isArray(register.claims)
  ) {
    throw new Error('Viewer claim register has an unsupported schema.');
  }

  const seen = new Set<string>();
  const visible: VerifiedClaim[] = [];
  for (const item of register.claims) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error('Viewer claim register contains an invalid row.');
    }
    const claim = item as Record<string, unknown>;
    const id = claim.id;
    const artifactKey = claim.artifact_key;
    const fieldPath = claim.field_path;
    const artifactHash = claim.artifact_sha256;
    const excerptHash = claim.excerpt_sha256;
    const status = claim.status;
    if (
      typeof id !== 'string' ||
      seen.has(id) ||
      typeof artifactKey !== 'string' ||
      typeof fieldPath !== 'string' ||
      typeof artifactHash !== 'string' ||
      typeof excerptHash !== 'string' ||
      (status !== 'ACCEPTED_CURRENT' && status !== 'SHOW_WITH_ERRATUM' && status !== 'OMIT')
    ) {
      throw new Error('Viewer claim register contains an incomplete or duplicate row.');
    }
    seen.add(id);

    if (artifactHashes[artifactKey] !== artifactHash) {
      throw new Error(`Viewer claim '${id}' is bound to a different frozen artifact.`);
    }
    const fieldValue = getPathValue(artifacts[artifactKey], fieldPath);
    const encodedValue = JSON.stringify(fieldValue);
    if (fieldValue === undefined || encodedValue === undefined || await sha256Text(encodedValue) !== excerptHash) {
      throw new Error(`Viewer claim '${id}' does not match its registered source excerpt.`);
    }

    if (status === 'OMIT') {
      if (claim.approved_text !== null) throw new Error(`Omitted viewer claim '${id}' must not have display text.`);
      continue;
    }

    const label = claim.label;
    const group = claim.group;
    const approvedText = claim.approved_text;
    if (
      typeof label !== 'string' ||
      typeof group !== 'string' ||
      (typeof approvedText !== 'string' && typeof approvedText !== 'number' && !Array.isArray(approvedText)) ||
      (status === 'ACCEPTED_CURRENT' && JSON.stringify(approvedText) !== encodedValue)
    ) {
      throw new Error(`Viewer claim '${id}' display text differs from its registered source excerpt.`);
    }
    visible.push({ id, group, label, approved_text: approvedText as string | number | string[] });
  }
  return visible;
}

function validateTrainingData(value: unknown): JermilovaTrainingData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Training data must be a JSON object.');
  }
  const models = (value as { models?: unknown }).models;
  if (typeof models !== 'object' || models === null || Array.isArray(models)) {
    throw new Error('Training data must contain GSL and GBS datasets.');
  }
  const source = models as Record<string, unknown>;
  if (Object.keys(source).sort().join(',') !== 'GBS,GSL') {
    throw new Error('Training data contains an unexpected dataset.');
  }

  const validateDataset = (key: 'GSL' | 'GBS', expected: { name: string; fish: number; water: number }): TrainingDataset => {
    const candidate = source[key];
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      throw new Error(`Training dataset ${key} is missing.`);
    }
    const dataset = candidate as Partial<TrainingDataset>;
    if (
      dataset.display_name !== expected.name ||
      dataset.fish_count !== expected.fish ||
      dataset.water_count !== expected.water ||
      !Array.isArray(dataset.fish_columns) ||
      !Array.isArray(dataset.water_columns) ||
      !Array.isArray(dataset.fish_cases) ||
      !Array.isArray(dataset.water_cases) ||
      dataset.fish_cases.length !== expected.fish ||
      dataset.water_cases.length !== expected.water
    ) {
      throw new Error(`Training dataset ${key} does not match the frozen schema and row counts.`);
    }
    return dataset as TrainingDataset;
  };

  return {
    models: {
      GSL: validateDataset('GSL', { name: 'Great Slave Lake', fish: 604, water: 855 }),
      GBS: validateDataset('GBS', { name: 'Great Bear Subbasin', fish: 274, water: 1589 }),
    },
  };
}

function validateRegistry(value: unknown): ViewerRegistry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Pack registry must be a JSON object.');
  }
  const registry = value as Partial<ViewerRegistry>;
  if (
    registry.schema_version !== '1.0' ||
    registry.default_pack_id !== JERMILOVA_VIEWER_CAPABILITIES.packId ||
    !Array.isArray(registry.packs) ||
    registry.packs.length !== 1
  ) {
    throw new Error('Pack registry does not contain the single approved Jermilova pack.');
  }

  const entry = registry.packs[0];
  if (
    entry.pack_id !== JERMILOVA_VIEWER_CAPABILITIES.packId ||
    entry.path !== `packs/${JERMILOVA_VIEWER_CAPABILITIES.packId}` ||
    entry.is_default !== true
  ) {
    throw new Error('Pack registry entry does not match the approved Jermilova pack.');
  }
  return registry as ViewerRegistry;
}

export async function loadJermilovaPack(fetcher: typeof fetch = fetch): Promise<LoadedJermilovaPack> {
  if (assetManifest.pack_id !== JERMILOVA_VIEWER_CAPABILITIES.packId) {
    throw new Error('Viewer asset manifest does not match the approved Jermilova pack.');
  }

  const registry = validateRegistry(await readJsonResponse(fetcher, '/bn-rrm/pack-registry.json'));
  const entry = registry.packs[0];
  const packBase = `/bn-rrm/${entry.path}`;

  const pack = (await readVerifiedJson(fetcher, `${packBase}/pack.json`, getAsset('pack'))) as PackManifest;
  validatePackSchema(pack);
  if (
    pack.pack_id !== JERMILOVA_VIEWER_CAPABILITIES.packId ||
    pack.runtime_schema_version !== 'generic-bn-rrm-v1' ||
    pack.release_stage !== 'prototype' ||
    pack.dag_node_count !== 14 ||
    pack.dag_edge_count !== 15
  ) {
    throw new Error('Pack manifest does not match the frozen Jermilova model shape.');
  }

  const runtimeAsset = getAsset('runtime_model');
  if (pack.artifacts.runtime_model !== runtimeAsset.path) {
    throw new Error('Pack runtime path does not match the verified asset manifest.');
  }

  const runtimeJson = await readVerifiedJson(
    fetcher,
    `${packBase}/${runtimeAsset.path}`,
    runtimeAsset,
  );
  const [modelOverview, decisions, provenance, rawTrainingData] = await Promise.all([
    readVerifiedJson(fetcher, `${packBase}/${getAsset('model_overview').path}`, getAsset('model_overview')),
    readVerifiedJson(fetcher, `${packBase}/${getAsset('decisions').path}`, getAsset('decisions')),
    readVerifiedJson(fetcher, `${packBase}/${getAsset('provenance').path}`, getAsset('provenance')),
    readVerifiedJson(fetcher, `${packBase}/${getAsset('training_data').path}`, getAsset('training_data')),
  ]);
  const trainingData = validateTrainingData(rawTrainingData);
  const artifacts: Record<string, unknown> = {
    pack,
    model_overview: modelOverview,
    decisions,
    provenance,
    training_data: trainingData,
  };
  const artifactHashes = Object.fromEntries(
    ['pack', 'model_overview', 'decisions', 'provenance', 'training_data'].map((key) => [key, getAsset(key).sha256]),
  );
  const claims = await verifyRegisteredClaims(artifacts, artifactHashes);
  const validatedRuntime = validateJermilovaRuntime(runtimeJson);
  const model = createGenericNetwork(
    validatedRuntime as unknown as Parameters<typeof createGenericNetwork>[0],
  );

  if (model.nodes.length !== 14 || model.edges.length !== 15 || model.cpts.length !== 7) {
    throw new Error('Generic network adapter returned an incompatible model.');
  }

  const forward = dagForwardInference(model, {});
  return { pack, model, baseline: forward.beliefs, artifacts, artifactHashes, claims };
}

export async function loadJermilovaMapLayer(key: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  if (!JERMILOVA_VIEWER_CAPABILITIES.mapKeys.includes(key as (typeof JERMILOVA_VIEWER_CAPABILITIES.mapKeys)[number])) {
    throw new Error('Map layer is outside the approved viewer allowlist.');
  }
  const asset = getAsset(key);
  if (asset.role !== 'map') throw new Error('Approved map key does not resolve to a map asset.');
  const url = `/bn-rrm/packs/${JERMILOVA_VIEWER_CAPABILITIES.packId}/${asset.path}`;
  return readVerifiedJson(fetcher, url, asset);
}
