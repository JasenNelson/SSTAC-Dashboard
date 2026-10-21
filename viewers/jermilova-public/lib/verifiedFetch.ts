import assetManifestJson from '../asset-manifest.json';

// Integrity for everything the original BN-RRM stores fetch. The viewer installs this
// wrapper before the original page mounts, so every /bn-rrm/ response the stores and
// views receive (registry, pack manifest, runtime model, training data, site reports,
// map layers) is checked against asset-manifest.json, not only what a one-time gate
// read. Requests outside /bn-rrm/ (none are fetch()ed by the page today) pass through.

interface ManifestAsset { path: string; bytes: number; sha256: string }
const manifest = assetManifestJson as { pack_id: string; assets: ManifestAsset[] };

export const PACK_ID = manifest.pack_id;
const REGISTRY_PATH = '/bn-rrm/pack-registry.json';
const PACK_PREFIX = `/bn-rrm/packs/${PACK_ID}/`;
const assetsByPath = new Map(manifest.assets.map((asset) => [asset.path, asset]));

export class IntegrityViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityViolation';
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === 'object' && !(input instanceof URL) && 'method' in input && input.method) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function checkRegistry(bytes: ArrayBuffer) {
  let registry: { default_pack_id?: unknown; packs?: Array<{ pack_id?: unknown }> };
  try {
    registry = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new IntegrityViolation('Pack registry is not valid JSON.');
  }
  const packs = Array.isArray(registry.packs) ? registry.packs : [];
  if (registry.default_pack_id !== PACK_ID || packs.length !== 1 || packs[0]?.pack_id !== PACK_ID) {
    throw new IntegrityViolation('Pack registry must offer exactly the approved Jermilova pack.');
  }
}

export function createVerifiedFetch(
  baseFetch: typeof fetch,
  onViolation: (error: IntegrityViolation) => void,
): typeof fetch {
  const fail = (message: string): never => {
    const error = new IntegrityViolation(message);
    onViolation(error);
    throw error;
  };

  return async function verifiedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Resolve exactly as the browser will (relative URLs against the page location).
    const pathname = new URL(requestUrl(input), globalThis.location?.href ?? 'http://viewer.local').pathname;
    if (!pathname.startsWith('/bn-rrm/')) return baseFetch(input, init);

    const method = requestMethod(input, init);
    if (method !== 'GET') fail(`Blocked ${method} ${pathname}: the viewer is read-only.`);

    const isRegistry = pathname === REGISTRY_PATH;
    const asset = pathname.startsWith(PACK_PREFIX) ? assetsByPath.get(pathname.slice(PACK_PREFIX.length)) : undefined;
    if (!isRegistry && !asset) fail(`Blocked unapproved pack path ${pathname}.`);

    let response: Response;
    try {
      response = await baseFetch(input, init);
    } catch (error) {
      // A caller's own abort is not an integrity event; any other transport failure of an
      // approved file fails closed (the original stores would otherwise render no model).
      if (error instanceof Error && error.name === 'AbortError') throw error;
      return fail(`Approved file ${pathname} could not be loaded.`);
    }
    if (!response.ok) fail(`Approved file ${pathname} returned HTTP ${response.status}.`);
    let bytes: ArrayBuffer;
    try {
      bytes = await response.arrayBuffer();
    } catch (error) {
      // Same contract as the transport catch: a body that fails mid-stream fails closed.
      if (error instanceof Error && error.name === 'AbortError') throw error;
      return fail(`Approved file ${pathname} could not be read.`);
    }

    if (isRegistry) {
      try {
        checkRegistry(bytes);
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Pack registry failed verification.');
      }
    } else if (bytes.byteLength !== asset!.bytes || (await sha256Hex(bytes)) !== asset!.sha256) {
      fail(`Pack file ${pathname} does not match the approved asset manifest.`);
    }

    return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}
