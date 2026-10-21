import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import assetManifest from '../asset-manifest.json';
import { createVerifiedFetch, IntegrityViolation, PACK_ID } from './verifiedFetch';

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
