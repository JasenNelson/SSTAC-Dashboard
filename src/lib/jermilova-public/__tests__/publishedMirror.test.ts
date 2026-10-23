// Required-CI guard for the anonymous Jermilova viewer mounted at /Jermilova.
//
// The viewer's reviewed static export is committed under public/Jermilova/ and served as
// public files (src/lib/jermilova-public/route-config.ts). These tests run in the required
// Unit Tests job, so a partial, edited or leaking mirror, or a route change that would put
// the mount behind the login middleware, fails a required branch-protection check.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import {
  compareToManifest,
  inlineScriptHashes,
  listTree,
  mirrorRoot,
  readMirrorManifest,
  repositoryRoot,
  viewerSourceFingerprint,
} from '../../../../viewers/jermilova-public/scripts/publish-root-mirror.mjs';
import {
  auditBundleMarkers,
  authenticatePinnedApiRouteSources,
  NEXT_API_ROUTE_SOURCE_PINS,
} from '../../../../viewers/jermilova-public/scripts/audit-export-core.mjs';
import assetManifest from '../../../../viewers/jermilova-public/asset-manifest.json';
import { config as middlewareConfig } from '../../../middleware';
import {
  JERMILOVA_INLINE_SCRIPT_HASHES,
  JERMILOVA_PUBLIC_CSP,
  JERMILOVA_PUBLIC_MOUNT,
  jermilovaPublicHeaders,
  jermilovaPublicRewrites,
} from '../route-config';

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const mirrorFile = (relative: string) => fs.readFileSync(path.join(mirrorRoot, ...relative.split('/')));
const PACK_PREFIX = `bn-rrm/packs/${assetManifest.pack_id}/`;

describe('committed Jermilova mirror (public/Jermilova)', () => {
  const manifest = readMirrorManifest();
  const files = listTree(mirrorRoot);

  it('is exactly the published manifest: same files, byte lengths and SHA-256', () => {
    expect(manifest.base_path).toBe(JERMILOVA_PUBLIC_MOUNT);
    expect(manifest.mount).toBe('public/Jermilova');
    expect(compareToManifest(files, manifest)).toEqual({ ok: true, missing: [], extra: [], changed: [], countOk: true });
  });

  it('was published from the current viewer source (republish after any viewer change)', () => {
    // Recomputed from viewers/jermilova-public (source, config, data, src-closure pin).
    expect(viewerSourceFingerprint()).toEqual(manifest.viewer_source);
  });

  it('holds only framework output, the single page and the approved pack files', () => {
    // Framework output only as scanned scripts and styles plus binary images and fonts (no
    // source maps, SVG or other text files the marker scan below does not read).
    const allowed = [/^_next\/.+\.(js|css|png|woff2?)$/, /^bn-rrm\//, /^index\.(html|txt)$/];
    expect(files.filter((file) => !allowed.some((pattern) => pattern.test(file.path))).map((file) => file.path)).toEqual([]);
    // index.html is the only page, so the mount CSP (hashed from it) covers every published page.
    expect(files.filter((file) => /\.html?$/i.test(file.path)).map((file) => file.path)).toEqual(['index.html']);
    const packFiles = files.filter((file) => file.path.startsWith('bn-rrm/')).map((file) => file.path).sort();
    const expected = ['bn-rrm/pack-registry.json', ...assetManifest.assets.map((asset) => `${PACK_PREFIX}${asset.path}`)].sort();
    expect(packFiles).toEqual(expected);
  });

  it('serves pack files byte-identical to the asset manifest, and a registry offering only Jermilova', () => {
    for (const asset of assetManifest.assets) {
      const bytes = mirrorFile(`${PACK_PREFIX}${asset.path}`);
      expect(bytes.length, asset.path).toBe(asset.bytes);
      expect(sha256(bytes), asset.path).toBe(asset.sha256);
    }
    const registry = JSON.parse(mirrorFile('bn-rrm/pack-registry.json').toString('utf8'));
    expect(registry.default_pack_id).toBe(assetManifest.pack_id);
    expect(registry.packs.map((entry: { pack_id: string }) => entry.pack_id)).toEqual([assetManifest.pack_id]);
  });

  it('loads its page only from base-path framework files that exist in the mirror', () => {
    const html = mirrorFile('index.html').toString('utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    expect(refs.length).toBeGreaterThan(0);
    const paths = new Set(files.map((file) => file.path));
    for (const ref of refs) {
      expect(ref.startsWith(`${JERMILOVA_PUBLIC_MOUNT}/_next/`), ref).toBe(true);
      expect(paths.has(ref.slice(JERMILOVA_PUBLIC_MOUNT.length + 1)), ref).toBe(true);
    }
  });

  it('contains no Supabase, review, write, export or other-pack markers, and no /api/ path', () => {
    const records = NEXT_API_ROUTE_SOURCE_PINS.map((pin) => {
      const raw = fs.readFileSync(path.join(repositoryRoot, ...pin.path.split('/')));
      // Copy into this realm's Uint8Array: under jsdom a Node Buffer fails the core's
      // `instanceof Uint8Array` check, which would make the provenance check fail closed.
      const bytes = new Uint8Array(raw);
      return { path: pin.path, kind: pin.kind, bytes, bytes_count: raw.length, sha256: sha256(raw) };
    });
    const authentication = authenticatePinnedApiRouteSources(
      records,
      records.map((record) => ({ path: record.path, bytes: record.bytes_count, sha256: record.sha256 })),
    );
    expect(authentication.authenticated).toBe(true);
    const fullRegistry = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'public', 'bn-rrm', 'pack-registry.json'), 'utf8'));
    const otherPackIds = fullRegistry.packs.map((entry: { pack_id: string }) => entry.pack_id).filter((id: string) => id !== assetManifest.pack_id);
    expect(otherPackIds.length).toBeGreaterThan(0);
    const bundle = files
      .filter((file) => /\.(js|mjs|css|html|json|txt)$/i.test(file.path))
      .map((file) => ({ relativePath: file.path, bytes: mirrorFile(file.path) }));
    expect(bundle.length).toBeGreaterThan(40);
    expect(auditBundleMarkers(bundle, authentication.authenticated, otherPackIds)).toEqual([]);
  });
});

// The HSTS value src/middleware.ts sets in production on the routes it matches, found with the
// TypeScript parser (so comments and strings cannot confuse it): every call
// `<x>.headers.set('Strict-Transport-Security', '<literal>')`. Exactly one must exist; a
// non-literal value or a second call fails the guard.
function hstsValuesIn(source: string): string[] {
  const file = ts.createSourceFile('middleware.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'set' &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'headers' &&
      node.arguments.length === 2 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === 'Strict-Transport-Security'
    ) {
      const value = node.arguments[1];
      values.push(ts.isStringLiteralLike(value) ? value.text : '<non-literal>');
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return values;
}

function middlewareHstsValue(): string {
  const found = hstsValuesIn(fs.readFileSync(path.join(repositoryRoot, 'src', 'middleware.ts'), 'utf8'));
  expect(found).toHaveLength(1);
  return found[0];
}

describe('Jermilova mount routing', () => {
  it('rewrites only /Jermilova, to the export page', () => {
    expect(jermilovaPublicRewrites).toEqual([{ source: '/Jermilova', destination: '/Jermilova/index.html' }]);
  });

  it('reads the middleware HSTS value from code only, exactly once', () => {
    const call = (value: string) => `res.headers.set('Strict-Transport-Security', '${value}')`;
    expect(hstsValuesIn(`if (prod) {\n  ${call('max-age=1')}\n}`)).toEqual(['max-age=1']);
    expect(hstsValuesIn(`// ${call('max-age=1')}`)).toEqual([]);
    expect(hstsValuesIn(`/* ${call('max-age=1')} */`)).toEqual([]);
    expect(hstsValuesIn(`${call('max-age=1')}\n${call('max-age=2')}`)).toEqual(['max-age=1', 'max-age=2']);
    expect(hstsValuesIn(`res.headers.set('Strict-Transport-Security', value)`)).toEqual(['<non-literal>']);
    // A '/*' inside a string (as in the middleware's CSP) must not hide a later call.
    expect(hstsValuesIn(`const csp = 'https://*.example.org';\n/** doc */\n${call('max-age=1')}`)).toEqual(['max-age=1']);
    expect(hstsValuesIn(fs.readFileSync(path.join(repositoryRoot, 'src', 'middleware.ts'), 'utf8'))).toHaveLength(1);
  });

  it('sets the security headers on the mount and everything under it', () => {
    expect(jermilovaPublicHeaders.map((rule) => rule.source)).toEqual(['/Jermilova', '/Jermilova/:path*', '/Jermilova/index.html', '/Jermilova/bn-rrm/:path*']);
    for (const rule of jermilovaPublicHeaders.slice(0, 2)) {
      const headers = Object.fromEntries(rule.headers.map((header) => [header.key, header.value]));
      expect(headers['Content-Security-Policy']).toBe(JERMILOVA_PUBLIC_CSP);
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Robots-Tag']).toBe('noindex, nofollow');
      expect(headers['Strict-Transport-Security']).toBe(middlewareHstsValue());
    }
    expect(JERMILOVA_PUBLIC_CSP).toContain("frame-ancestors 'none'");
    expect(JERMILOVA_PUBLIC_CSP).toContain("object-src 'none'");
    expect(JERMILOVA_PUBLIC_CSP).not.toContain('unsafe-eval');
    expect(JERMILOVA_PUBLIC_CSP.toLowerCase()).not.toContain('supabase');
  });

  it('is never matched by the login middleware, which still guards the authenticated BN-RRM paths', () => {
    // Evaluated with Next's own matcher semantics, not by reading the matcher text.
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config: middlewareConfig, url });
    for (const url of [
      '/Jermilova',
      '/Jermilova/',
      '/Jermilova/index.html',
      '/Jermilova/bn-rrm/pack-registry.json',
      `/Jermilova/bn-rrm/packs/${assetManifest.pack_id}/pack.json`,
      '/Jermilova/_next/static/chunks/app/page.js',
    ]) {
      expect(matches(url), url).toBe(false);
    }
    // Two-sided: the same check reports the authenticated paths as matched.
    for (const url of ['/bn-rrm', '/bn-rrm/pack-registry.json', `/bn-rrm/packs/${assetManifest.pack_id}/pack.json`]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it('allows exactly the committed page inline scripts by hash, and no unsafe-inline script', () => {
    const html = fs.readFileSync(path.join(mirrorRoot, 'index.html'), 'utf8');
    const hashes = inlineScriptHashes(html);
    expect(hashes.length).toBeGreaterThan(0);
    expect(JERMILOVA_INLINE_SCRIPT_HASHES).toEqual(hashes);
    const scriptSrc = JERMILOVA_PUBLIC_CSP.split('; ').find((directive) => directive.startsWith('script-src '));
    expect(scriptSrc).toBe(`script-src 'self' ${hashes.map((hash) => `'${hash}'`).join(' ')}`);
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('revalidates the page on every load, so a fresh load never mixes old code with new pack files', () => {
    for (const source of ['/Jermilova', '/Jermilova/index.html']) {
      const rule = jermilovaPublicHeaders.find((candidate) => candidate.source === source);
      expect(rule?.headers, source).toContainEqual({ key: 'Cache-Control', value: 'no-cache' });
    }
    // Next applies every matching rule (the later one wins), and /Jermilova/:path* also matches
    // the page, so no other page-matching rule may set Cache-Control.
    for (const rule of jermilovaPublicHeaders.filter((candidate) => !['/Jermilova', '/Jermilova/index.html', '/Jermilova/bn-rrm/:path*'].includes(candidate.source))) {
      expect(rule.headers.map((header) => header.key.toLowerCase()), rule.source).not.toContain('cache-control');
    }
  });

  it('marks pack files no-store so a republish is never shadowed by a cached copy', () => {
    const rule = jermilovaPublicHeaders.find((entry) => entry.source === '/Jermilova/bn-rrm/:path*');
    expect(rule?.headers).toEqual([{ key: 'Cache-Control', value: 'no-store' }]);
  });
});
