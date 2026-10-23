import assetManifestJson from '../asset-manifest.json';

// Integrity for everything the original BN-RRM stores fetch. The viewer installs this
// wrapper before the original page mounts, so every /bn-rrm/ response the stores and
// views receive (registry, pack manifest, runtime model, training data, site reports,
// map layers) is checked against asset-manifest.json, not only what a one-time gate
// read. Other requests (cross-origin map tiles, same-origin framework files) pass through.
//
// Base path: the viewer is served under a prefix (lib/publicBasePath.ts). The original
// stores request '/bn-rrm/<path>'; the wrapper canonicalises every same-origin request
// (string, URL or Request; relative or absolute; with or without the prefix) to the
// app path '/bn-rrm/<path>', applies the checks to that path, and fetches exactly
// '<basePath>/bn-rrm/<path>'. Any other same-origin spelling of a pack path (encoded,
// different case, doubled slash, repeated base path) is refused. Through this wrapper a
// pack read therefore cannot reach the authenticated app's own /bn-rrm/ paths, and an
// already-prefixed request gets the same checks.

interface ManifestAsset { path: string; bytes: number; sha256: string }
const manifest = assetManifestJson as { pack_id: string; assets: ManifestAsset[] };

export const PACK_ID = manifest.pack_id;
const REGISTRY_PATH = '/bn-rrm/pack-registry.json';
// SHA-256 of the one-pack public/bn-rrm/pack-registry.json the viewer ships (pinned; a unit
// test keeps it equal to the file). The registry is checked byte for byte like every other
// pack read, and its structure is checked as well.
export const REGISTRY_SHA256 = 'a62993279e1872909d67831bce1dc3d4965479bc3d23ae58898b73b0b4e03454';
const PACK_PREFIX = `/bn-rrm/packs/${PACK_ID}/`;
const assetsByPath = new Map(manifest.assets.map((asset) => [asset.path, asset]));

export class IntegrityViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityViolation';
  }
}

// True when a same-origin path names the pack tree under some spelling the canonical check
// does not accept: any path segment equal to 'bn-rrm' after decoding (repeatedly, so double
// encoding is caught), lower-casing and collapsing slashes (percent-encoding, letter case,
// doubled slashes, a repeated base path, or the authenticated app's own '/bn-rrm' route
// itself). Such requests are refused instead of passing through unverified. A path that
// cannot be decoded, or is still encoded after several rounds, counts as suspicious.
function isNonCanonicalPackSpelling(pathname: string): boolean {
  let decoded = pathname;
  for (let round = 0; round < 4; round += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return true;
    }
    if (next === decoded) break;
    decoded = next;
  }
  if (decoded !== safeDecode(decoded)) return true;
  return decoded.toLowerCase().replace(/\/{2,}/g, '/').split('/').includes('bn-rrm');
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// True when the raw request path (before URL resolution, which would silently remove dot
// segments) has a '.' or '..' segment, literal or percent-encoded at any depth, or a backslash.
// The viewer never requests such a path; a same-origin one is refused rather than resolved, so
// something like '/Jermilova/bn-rrm/../../api/x' cannot turn into a different route.
function hasDotSegmentOrBackslash(raw: string): boolean {
  const pathPart = raw.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/\\]*/i, '').split(/[?#]/)[0];
  let decoded = pathPart;
  for (let round = 0; round < 4; round += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return true;
    }
    if (next === decoded) break;
    decoded = next;
  }
  if (decoded.includes('\\')) return true;
  return decoded.split('/').some((segment) => segment === '.' || segment === '..');
}

// Inputs are recognised by shape, not by realm: a URL or Request created in another
// same-origin window fails instanceof but is handled exactly like a local one.
function isRequestLike(input: unknown): input is Request {
  return typeof input === 'object' && input !== null && typeof (input as Request).url === 'string' && typeof (input as Request).method === 'string';
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (isRequestLike(input)) return input.url;
  if (typeof input === 'object' && input !== null && typeof (input as URL).href === 'string') return (input as URL).href;
  return String(input);
}

// Same precedence and conversion as fetch itself: any explicitly supplied init.method
// (even null or 0, which fetch converts to the strings 'null' / '0') wins; otherwise a
// Request carries its own method; otherwise GET.
function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init && init.method !== undefined) return String(init.method).toUpperCase();
  if (isRequestLike(input)) return input.method.toUpperCase();
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
  basePath = '',
): typeof fetch {
  if (basePath !== '' && (!/^\/[A-Za-z0-9_-]+$/.test(basePath))) {
    throw new Error(`Invalid viewer base path: ${basePath}`);
  }
  const fail = (message: string): never => {
    const error = new IntegrityViolation(message);
    onViolation(error);
    throw error;
  };
  // The only same-origin requests the viewer makes besides pack reads: its own page, its RSC
  // payload, its framework files and the favicon. Every other same-origin path is refused,
  // however it was spelled (dot segments, parser whitespace, or an already-normalised URL or
  // Request), so the wrapper never sends a request to the authenticated app's own routes.
  const isViewerFilePath = (pathname: string) =>
    pathname === (basePath || '/') ||
    pathname === `${basePath}/` ||
    pathname === `${basePath}/index.txt` ||
    (basePath !== '' && pathname === `${basePath}.txt`) ||
    pathname.startsWith(`${basePath}/_next/`) ||
    pathname === '/favicon.ico';

  return async function verifiedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Resolve exactly as the browser will (relative URLs against the page location).
    const pageUrl = new URL(globalThis.location?.href ?? 'http://viewer.local/');
    const target = new URL(requestUrl(input), pageUrl);
    // Pass-through always forwards exactly the URL that was checked: a string or a genuine
    // Request as given, anything else (URL objects, other realms) by its checked href.
    const passThrough = () => {
      if (typeof input === 'string' || (typeof Request !== 'undefined' && input instanceof Request)) return baseFetch(input, init);
      return baseFetch(isRequestLike(input) ? new Request(target.href, input) : target.href, init);
    };
    // Cross-origin requests (map tiles, WMS) are never pack reads.
    if (target.origin !== pageUrl.origin) return passThrough();
    if (hasDotSegmentOrBackslash(requestUrl(input))) fail(`Blocked same-origin path with dot segments or a backslash: ${requestUrl(input)}.`);
    const prefixed = basePath !== '' && (target.pathname === basePath || target.pathname.startsWith(`${basePath}/`));
    const pathname = prefixed ? target.pathname.slice(basePath.length) : target.pathname;
    if (!pathname.startsWith('/bn-rrm/')) {
      if (isNonCanonicalPackSpelling(target.pathname)) fail(`Blocked non-canonical pack path ${target.pathname}.`);
      if (!isViewerFilePath(target.pathname)) fail(`Blocked same-origin request outside the viewer's own files: ${target.pathname}.`);
      return passThrough();
    }

    const method = requestMethod(input, init);
    if (method !== 'GET') fail(`Blocked ${method} ${pathname}: the viewer is read-only.`);
    if (target.search) fail(`Blocked query string on pack path ${pathname}.`);

    const isRegistry = pathname === REGISTRY_PATH;
    const asset = pathname.startsWith(PACK_PREFIX) ? assetsByPath.get(pathname.slice(PACK_PREFIX.length)) : undefined;
    if (!isRegistry && !asset) fail(`Blocked unapproved pack path ${pathname}.`);

    // Fetch exactly the canonical served path; a Request keeps its own headers and signal.
    const networkPath = `${basePath}${pathname}`;
    const networkInput: RequestInfo | URL = isRequestLike(input) ? new Request(new URL(networkPath, pageUrl).href, input) : networkPath;

    let response: Response;
    try {
      response = await baseFetch(networkInput, init);
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
      if ((await sha256Hex(bytes)) !== REGISTRY_SHA256) fail('Pack registry does not match the approved registry.');
    } else if (bytes.byteLength !== asset!.bytes || (await sha256Hex(bytes)) !== asset!.sha256) {
      fail(`Pack file ${pathname} does not match the approved asset manifest.`);
    }

    return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}
