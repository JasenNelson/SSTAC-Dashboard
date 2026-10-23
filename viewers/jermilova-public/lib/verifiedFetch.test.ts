import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import assetManifest from '../asset-manifest.json';
import { JERMILOVA_PUBLIC_BASE_PATH, JERMILOVA_PUBLIC_BUILD_ID } from './publicBasePath';
import { createHash } from 'node:crypto';
import { createVerifiedFetch, IntegrityViolation, PACK_ID, REGISTRY_SHA256 } from './verifiedFetch';

const viewerPublic = path.resolve(__dirname, '../public');
const fileBytes = (urlPath: string) => fs.readFileSync(path.join(viewerPublic, ...urlPath.slice(1).split('/')));

// A fake network that serves the viewer's public files, optionally tampered.
function network(tamper?: (urlPath: string, bytes: Buffer) => Buffer | null) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const urlPath = new URL(String(input), 'http://viewer.local').pathname;
    const raw = fs.existsSync(path.join(viewerPublic, ...urlPath.slice(1).split('/'))) ? fileBytes(urlPath) : null;
    const bytes = raw && tamper ? tamper(urlPath, raw) : raw;
    return bytes ? new Response(new Uint8Array(bytes), { status: 200 }) : new Response('missing', { status: 404 });
  }) as unknown as typeof fetch;
}

const assetUrl = (assetPath: string) => `/bn-rrm/packs/${PACK_ID}/${assetPath}`;

describe('verifiedFetch', () => {
  it('passes every approved asset and the registry through byte-identical', async () => {
    const onViolation = vi.fn();
    const verified = createVerifiedFetch(network(), onViolation);
    for (const asset of assetManifest.assets) {
      const body = Buffer.from(await (await verified(assetUrl(asset.path))).arrayBuffer());
      expect(body.equals(fileBytes(assetUrl(asset.path))), asset.path).toBe(true);
    }
    expect((await verified('/bn-rrm/pack-registry.json')).ok).toBe(true);
    expect(onViolation).not.toHaveBeenCalled();
  });

  it('rejects a tampered approved file and reports the violation', async () => {
    const onViolation = vi.fn();
    const target = assetUrl('training_data.json');
    const verified = createVerifiedFetch(network((p, b) => (p === target ? Buffer.concat([b, Buffer.from(' ')]) : b)), onViolation);
    await expect(verified(target)).rejects.toBeInstanceOf(IntegrityViolation);
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it('rejects unapproved pack paths, other packs, writes and missing approved files', async () => {
    const onViolation = vi.fn();
    const verified = createVerifiedFetch(network(), onViolation);
    await expect(verified(assetUrl('review/explainer.json'))).rejects.toBeInstanceOf(IntegrityViolation);
    await expect(verified('/bn-rrm/packs/bnrrm-general-v1.0-dev-map/pack.json')).rejects.toBeInstanceOf(IntegrityViolation);
    await expect(verified(assetUrl('pack.json'), { method: 'POST' })).rejects.toBeInstanceOf(IntegrityViolation);
    const missing = createVerifiedFetch(network((p, b) => (p === assetUrl('pack.json') ? null : b)), onViolation);
    await expect(missing(assetUrl('pack.json'))).rejects.toBeInstanceOf(IntegrityViolation);
    expect(onViolation).toHaveBeenCalledTimes(4);
  });

  it('rejects a registry that offers any pack other than Jermilova', async () => {
    const onViolation = vi.fn();
    const widened = network((p, b) => {
      if (p !== '/bn-rrm/pack-registry.json') return b;
      const registry = JSON.parse(b.toString('utf8'));
      registry.packs.push({ ...registry.packs[0], pack_id: 'bnrrm-general-v1.0-dev-map', is_default: false });
      return Buffer.from(JSON.stringify(registry));
    });
    await expect(createVerifiedFetch(widened, onViolation)('/bn-rrm/pack-registry.json')).rejects.toBeInstanceOf(IntegrityViolation);
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it('pins the shipped registry bytes', () => {
    expect(createHash('sha256').update(fileBytes('/bn-rrm/pack-registry.json')).digest('hex')).toBe(REGISTRY_SHA256);
  });

  it('rejects a registry whose ids are intact but whose other bytes changed', async () => {
    const onViolation = vi.fn();
    const relabelled = network((p, b) => {
      if (p !== '/bn-rrm/pack-registry.json') return b;
      const registry = JSON.parse(b.toString('utf8'));
      registry.packs[0] = { ...registry.packs[0], label: 'changed' };
      return Buffer.from(JSON.stringify(registry));
    });
    await expect(createVerifiedFetch(relabelled, onViolation)('/bn-rrm/pack-registry.json')).rejects.toBeInstanceOf(IntegrityViolation);
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a transport failure of an approved file but passes a caller abort through', async () => {
    const onViolation = vi.fn();
    const down = vi.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    await expect(createVerifiedFetch(down, onViolation)(assetUrl('runtime/learned-model.json'))).rejects.toBeInstanceOf(IntegrityViolation);
    expect(onViolation).toHaveBeenCalledTimes(1);
    const aborted = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    await expect(createVerifiedFetch(aborted, onViolation)(assetUrl('training_data.json'))).rejects.toMatchObject({ name: 'AbortError' });
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it('fails closed when an approved response body fails mid-stream', async () => {
    const onViolation = vi.fn();
    const brokenBody = vi.fn(async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.error(new TypeError('connection reset'));
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;
    await expect(createVerifiedFetch(brokenBody, onViolation)(assetUrl('training_data.json'))).rejects.toBeInstanceOf(IntegrityViolation);
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it('leaves requests outside /bn-rrm/ untouched', async () => {
    const base = vi.fn(async () => new Response('tile', { status: 200 })) as unknown as typeof fetch;
    const onViolation = vi.fn();
    const response = await createVerifiedFetch(base, onViolation)('https://tile.openstreetmap.org/1/1/1.png');
    expect(await response.text()).toBe('tile');
    expect(onViolation).not.toHaveBeenCalled();
  });
});

describe('verifiedFetch under the /Jermilova base path', () => {
  const BASE = JERMILOVA_PUBLIC_BASE_PATH;
  const PAGE_ORIGIN = 'http://viewer.local';

  // Serves the viewer's public files ONLY under the base path, the way the root deployment
  // serves public/Jermilova/. An unmapped '/bn-rrm/...' request therefore gets 404.
  function servedUnderBase() {
    const seen: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), PAGE_ORIGIN);
      seen.push(url.pathname);
      if (!url.pathname.startsWith(`${BASE}/`)) return new Response('missing', { status: 404 });
      const file = path.join(viewerPublic, ...url.pathname.slice(BASE.length + 1).split('/'));
      return fs.existsSync(file) ? new Response(new Uint8Array(fs.readFileSync(file)), { status: 200 }) : new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    return { fetcher, seen };
  }

  it('is the base path and fixed build id the export is built with', async () => {
    // The viewer config fails closed unless loaded from the viewer package (the test cwd).
    const config = (await import('../next.config')).default;
    expect(BASE).toBe('/Jermilova');
    expect(config.basePath).toBe(BASE);
    expect(await config.generateBuildId?.()).toBe(JERMILOVA_PUBLIC_BUILD_ID);
  });

  it('maps every approved asset and the registry to <base>/bn-rrm/ and verifies them', async () => {
    const onViolation = vi.fn();
    const { fetcher, seen } = servedUnderBase();
    const verified = createVerifiedFetch(fetcher, onViolation, BASE);
    for (const asset of assetManifest.assets) {
      const body = Buffer.from(await (await verified(assetUrl(asset.path))).arrayBuffer());
      expect(body.equals(fileBytes(assetUrl(asset.path))), asset.path).toBe(true);
    }
    expect((await verified('/bn-rrm/pack-registry.json')).ok).toBe(true);
    expect(onViolation).not.toHaveBeenCalled();
    expect(seen.length).toBe(assetManifest.assets.length + 1);
    expect(seen.every((p) => p.startsWith(`${BASE}/bn-rrm/`))).toBe(true);
  });

  it('gives prefixed, absolute same-origin, URL and Request inputs the same checks and the same canonical fetch', async () => {
    const onViolation = vi.fn();
    const { fetcher, seen } = servedUnderBase();
    const verified = createVerifiedFetch(fetcher, onViolation, BASE);
    const canonical = `${BASE}${assetUrl('pack.json')}`;
    await verified(canonical);
    await verified(`${PAGE_ORIGIN}${assetUrl('pack.json')}`);
    await verified(new URL(canonical, PAGE_ORIGIN));
    await verified(new Request(`${PAGE_ORIGIN}${assetUrl('pack.json')}`, { headers: { accept: 'application/json' } }));
    expect(seen).toEqual([canonical, canonical, canonical, canonical]);
    expect(onViolation).not.toHaveBeenCalled();
    // A prefixed path to an unapproved file, or to another pack, is still refused.
    await expect(verified(`${BASE}${assetUrl('review/explainer.json')}`)).rejects.toBeInstanceOf(IntegrityViolation);
    await expect(verified(`${BASE}/bn-rrm/packs/bnrrm-general-v1.0-dev-map/pack.json`)).rejects.toBeInstanceOf(IntegrityViolation);
    expect(seen).toHaveLength(4);
  });

  it('refuses a write, including a Request object carrying the method, and a query string', async () => {
    const onViolation = vi.fn();
    const { fetcher, seen } = servedUnderBase();
    const verified = createVerifiedFetch(fetcher, onViolation, BASE);
    await expect(verified(new Request(`${PAGE_ORIGIN}${assetUrl('pack.json')}`, { method: 'POST', body: '{}' }))).rejects.toBeInstanceOf(IntegrityViolation);
    await expect(verified(`${BASE}${assetUrl('pack.json')}`, { method: 'PUT' })).rejects.toBeInstanceOf(IntegrityViolation);
    await expect(verified(`${assetUrl('pack.json')}?v=2`)).rejects.toBeInstanceOf(IntegrityViolation);
    // fetch converts a non-string method to a string ('null', '0'): never treated as GET.
    await expect(verified(assetUrl('pack.json'), { method: null as unknown as string })).rejects.toBeInstanceOf(IntegrityViolation);
    await expect(verified(assetUrl('pack.json'), { method: 0 as unknown as string })).rejects.toBeInstanceOf(IntegrityViolation);
    // init.method overrides a Request's own method, exactly as fetch does.
    await expect(verified(new Request(`${PAGE_ORIGIN}${assetUrl('pack.json')}`), { method: 'POST' })).rejects.toBeInstanceOf(IntegrityViolation);
    expect(seen).toEqual([]);
    expect(onViolation).toHaveBeenCalledTimes(6);
    // A lowercase 'get' is still a read and passes.
    expect((await verified(assetUrl('pack.json'), { method: 'get' })).ok).toBe(true);
    expect(onViolation).toHaveBeenCalledTimes(6);
  });

  it('treats a tampered file served under the base path as a violation', async () => {
    const onViolation = vi.fn();
    const tampered = vi.fn(async () => new Response('{"tampered":true}', { status: 200 })) as unknown as typeof fetch;
    await expect(createVerifiedFetch(tampered, onViolation, BASE)(assetUrl('pack.json'))).rejects.toBeInstanceOf(IntegrityViolation);
    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it('refuses every non-canonical same-origin spelling of a pack path instead of passing it through', async () => {
    const onViolation = vi.fn();
    const base = vi.fn(async () => new Response('other', { status: 200 })) as unknown as typeof fetch;
    const verified = createVerifiedFetch(base, onViolation, BASE);
    const spellings = [
      `${BASE}x/bn-rrm/pack-registry.json`,
      '/bn%2Drrm/pack-registry.json',
      `${BASE}/bn%2Drrm/pack-registry.json`,
      '/jermilova/bn-rrm/pack-registry.json',
      '/BN-RRM/pack-registry.json',
      `${BASE}//bn-rrm/pack-registry.json`,
      `${BASE}${BASE}/bn-rrm/pack-registry.json`,
      '/%E0%A4%A',
      // Dot segments (literal, encoded, double-encoded) and backslashes, which URL resolution
      // would otherwise collapse into a different route.
      `${BASE}/bn-rrm/../../api/secret`,
      '/bn-rrm/%2e%2e/%2e%2e/api/secret',
      `${BASE}/bn-rrm/%252e%252e/x`,
      '/bn-rrm/./pack-registry.json',
      '/bn-rrm' + String.fromCharCode(92) + 'pack-registry.json',
      // Double, triple and five-layer encodings of 'bn-rrm' ('b' is %62).
      '/%2562n-rrm/pack-registry.json',
      `${BASE}/%252562n-rrm/pack-registry.json`,
      '/%2525252562n-rrm/pack-registry.json',
      // The authenticated app's own route, with or without a query, and the bare mount path.
      '/bn-rrm',
      '/bn-rrm?tab=review',
      `${BASE}/bn-rrm`,
    ];
    for (const spelling of spellings) {
      await expect(verified(spelling), spelling).rejects.toBeInstanceOf(IntegrityViolation);
    }
    expect(onViolation).toHaveBeenCalledTimes(spellings.length);
    expect(base).not.toHaveBeenCalled();
  });

  it('handles URL and Request objects from another realm by shape, exactly like local ones', async () => {
    const onViolation = vi.fn();
    const { fetcher, seen } = servedUnderBase();
    const verified = createVerifiedFetch(fetcher, onViolation, BASE);
    // Stand-ins for objects created in another same-origin window (they fail instanceof).
    const foreignUrl = { href: `${PAGE_ORIGIN}${assetUrl('pack.json')}`, toString() { return this.href; } };
    expect(foreignUrl instanceof URL).toBe(false);
    expect((await verified(foreignUrl as unknown as URL)).ok).toBe(true);
    expect(seen).toEqual([`${BASE}${assetUrl('pack.json')}`]);
    const foreignWrite = { url: `${PAGE_ORIGIN}${assetUrl('pack.json')}`, method: 'POST', headers: {} };
    await expect(verified(foreignWrite as unknown as Request)).rejects.toBeInstanceOf(IntegrityViolation);
    const foreignRoute = { href: `${PAGE_ORIGIN}/bn-rrm`, toString() { return this.href; } };
    await expect(verified(foreignRoute as unknown as URL)).rejects.toBeInstanceOf(IntegrityViolation);
    // An object whose href and string form disagree: the checked href is what is fetched.
    const twoFaced = { href: `${PAGE_ORIGIN}${BASE}/index.txt`, toString() { return `${PAGE_ORIGIN}${assetUrl('pack.json')}`; } };
    await verified(twoFaced as unknown as URL);
    expect(seen).toEqual([`${BASE}${assetUrl('pack.json')}`, `${BASE}/index.txt`]);
    expect(onViolation).toHaveBeenCalledTimes(2);
  });

  it('passes same-origin framework files and cross-origin requests through unmapped', async () => {
    const onViolation = vi.fn();
    const base = vi.fn(async () => new Response('other', { status: 200 })) as unknown as typeof fetch;
    const verified = createVerifiedFetch(base, onViolation, BASE);
    await verified(`${BASE}/_next/static/chunks/app/page.js`);
    await verified(`${BASE}/index.txt`);
    await verified('https://tile.openstreetmap.org/bn-rrm/1/1/1.png');
    expect((base as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((call) => String(call[0]))).toEqual([
      `${BASE}/_next/static/chunks/app/page.js`,
      `${BASE}/index.txt`,
      'https://tile.openstreetmap.org/bn-rrm/1/1/1.png',
    ]);
    expect(onViolation).not.toHaveBeenCalled();
  });

  it('refuses every other same-origin path, however it is spelled or pre-normalised', async () => {
    const onViolation = vi.fn();
    const base = vi.fn(async () => new Response('app', { status: 200 })) as unknown as typeof fetch;
    const verified = createVerifiedFetch(base, onViolation, BASE);
    const inputs: Array<RequestInfo | URL> = [
      '/api/secret',
      '/login',
      `${BASE}/other.html`,
      // Parser whitespace inside dot segments: URL parsing strips the tabs, then resolves '..'.
      `${BASE}/bn-rrm/.${String.fromCharCode(9)}./.${String.fromCharCode(9)}./api/secret`,
      // Already normalised to /api/secret by construction.
      new URL(`${BASE}/bn-rrm/../../api/secret`, PAGE_ORIGIN),
      new Request(`${PAGE_ORIGIN}${BASE}/bn-rrm/../../api/secret`),
    ];
    for (const input of inputs) {
      await expect(verified(input), String(input)).rejects.toBeInstanceOf(IntegrityViolation);
    }
    expect(onViolation).toHaveBeenCalledTimes(inputs.length);
    expect(base).not.toHaveBeenCalled();
  });

  it('rejects a malformed base path at construction', () => {
    const base = vi.fn() as unknown as typeof fetch;
    for (const bad of ['Jermilova', '/Jermilova/', '/a/b', '/']) {
      expect(() => createVerifiedFetch(base, vi.fn(), bad), bad).toThrow(/Invalid viewer base path/);
    }
  });
});
