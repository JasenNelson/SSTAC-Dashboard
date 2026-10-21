import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import assetManifest from '../asset-manifest.json';
import { JERMILOVA_VIEWER_CAPABILITIES } from '../viewer-capabilities';

const viewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(viewerRoot, '../..');
const sourcePackRoot = path.join(repositoryRoot, 'public', 'bn-rrm', 'packs', assetManifest.pack_id);

describe('viewer asset manifest', () => {
  it('keeps asset preparation and export auditing in the sole build path', async () => {
    const packageJson = JSON.parse(await readFile(path.join(viewerRoot, 'package.json'), 'utf8'));
    expect(packageJson.scripts.build).toBe(
      'npm run prepare:assets && node scripts/src-closure.mjs --check && node scripts/fork-patches.mjs --check && next build && node scripts/audit-export.mjs',
    );
  });

  it('contains exactly the retained-view fetch closure: six core, one review and twelve map assets', () => {
    expect(assetManifest.assets).toHaveLength(19);
    expect(assetManifest.assets.map((asset) => asset.key).sort()).toEqual(
      [...JERMILOVA_VIEWER_CAPABILITIES.assetKeys].sort(),
    );
    expect(assetManifest.assets.filter((asset) => asset.role === 'core')).toHaveLength(6);
    expect(assetManifest.assets.filter((asset) => asset.role === 'review').map((asset) => asset.key)).toEqual(['site_reports']);
    expect(assetManifest.assets.filter((asset) => asset.role === 'map')).toHaveLength(12);
  });

  it('matches every frozen source asset by exact byte count and SHA256', async () => {
    for (const asset of assetManifest.assets) {
      const bytes = await readFile(path.join(sourcePackRoot, ...asset.path.split('/')));
      expect(bytes.byteLength, asset.path).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), asset.path).toBe(asset.sha256);
    }
  });
});
