import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import assetManifest from '../asset-manifest.json';
import { JERMILOVA_VIEWER_CAPABILITIES } from '../viewer-capabilities';
import { loadJermilovaPack } from './loadJermilovaPack';

const viewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(viewerRoot, 'public');
const packId = 'bnrrm-casestudy-jermilova2025-mackenzie-hg';
const acceptedRootMarginalsPath = path.resolve(
  viewerRoot,
  '../../public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/review/cpt_transparency.json',
);
const acceptedRootMarginalsSha256 = '1b4e3da6faa1f51b51a0c34c526c0c3f25183d2e07fc51ee4b28b747f016ff37';

interface CptTransparencyArtifact {
  nodes: Array<{
    id: string;
    learned_distribution?: { marginal?: Record<string, number> };
  }>;
}

function referencePrecision(source: string, nodeId: string, stateId: string): number {
  const start = source.indexOf(`"id": "${nodeId}"`);
  if (start < 0) throw new Error(`Accepted CPT transparency reference is missing '${nodeId}'.`);
  const nextNode = source.indexOf('"id":', start + 1);
  const nodeSource = source.slice(start, nextNode < 0 ? source.length : nextNode);
  const marginal = nodeSource.match(/"marginal"\s*:\s*\{([^}]*)\}/)?.[1];
  const stateToken = marginal?.match(new RegExp(`"${stateId}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`))?.[1];
  if (!stateToken) throw new Error(`Accepted CPT transparency reference is missing '${nodeId}.${stateId}'.`);
  return stateToken.split('.')[1]?.length ?? 0;
}

function urlFor(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
}

function makePackFetcher(overrides: Record<string, Response> = {}) {
  const paths: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const url = urlFor(input);
    paths.push(url);
    if (overrides[url]) return overrides[url];

    const filePath = path.join(publicRoot, ...url.replace(/^\//, '').split('/'));
    try {
      return new Response(await readFile(filePath), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch {
      return new Response('missing', { status: 404 });
    }
  });
  return { fetcher, paths };
}

describe('loadJermilovaPack', () => {
  it('loads the packaged runtime through the generic adapter and forward engine', async () => {
    const { fetcher, paths } = makePackFetcher();
    const loaded = await loadJermilovaPack(fetcher);
    const acceptedRootMarginalsBytes = await readFile(acceptedRootMarginalsPath);
    expect(createHash('sha256').update(acceptedRootMarginalsBytes).digest('hex')).toBe(
      acceptedRootMarginalsSha256,
    );
    const acceptedRootMarginals = JSON.parse(
      acceptedRootMarginalsBytes.toString('utf8'),
    ) as CptTransparencyArtifact;

    expect(loaded.pack.pack_id).toBe(packId);
    expect(loaded.model.id).toBe('bnrrm-mackenzie-hg-gsl');
    expect(loaded.model.nodes).toHaveLength(14);
    expect(loaded.model.edges).toHaveLength(15);
    expect(loaded.model.cpts).toHaveLength(7);
    expect(loaded.artifacts.training_data).toMatchObject({
      models: {
        GSL: { display_name: 'Great Slave Lake', fish_count: 604, water_count: 855 },
        GBS: { display_name: 'Great Bear Subbasin', fish_count: 274, water_count: 1589 },
      },
    });
    const trainingData = loaded.artifacts.training_data as {
      models: Record<'GSL' | 'GBS', { fish_cases: unknown[]; water_cases: unknown[] }>;
    };
    expect(trainingData.models.GSL.fish_cases).toHaveLength(604);
    expect(trainingData.models.GSL.water_cases).toHaveLength(855);
    expect(trainingData.models.GBS.fish_cases).toHaveLength(274);
    expect(trainingData.models.GBS.water_cases).toHaveLength(1589);
    expect(paths).toEqual([
      '/bn-rrm/pack-registry.json',
      `/bn-rrm/packs/${packId}/pack.json`,
      `/bn-rrm/packs/${packId}/runtime/learned-model.json`,
      ...['model_overview', 'decisions', 'provenance', 'training_data'].map((key) => {
        const asset = assetManifest.assets.find((candidate) => candidate.key === key);
        if (!asset) throw new Error(`Asset ${key} is missing from the frozen manifest.`);
        return `/bn-rrm/packs/${packId}/${asset.path}`;
      }),
    ]);

    const nodesById = new Map(loaded.model.nodes.map((node) => [node.id, node]));
    for (const cpt of loaded.model.cpts) {
      const child = nodesById.get(cpt.nodeId);
      expect(child, cpt.nodeId).toBeDefined();
      const expectedRows = cpt.parentNodeIds.reduce(
        (count, parentId) => count * (nodesById.get(parentId)?.states.length ?? 0),
        1,
      );
      expect(cpt.entries, cpt.nodeId).toHaveLength(expectedRows);

      for (const entry of cpt.entries) {
        expect(Object.keys(entry.parentStates).sort()).toEqual([...cpt.parentNodeIds].sort());
        expect(Object.keys(entry.distribution).sort()).toEqual(
          child?.states.map((state) => state.id).sort(),
        );
        const probabilities = Object.values(entry.distribution);
        expect(probabilities.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
        expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
      }
    }

    for (const node of loaded.model.nodes) {
      const beliefs = loaded.baseline[node.id];
      expect(beliefs, node.id).toBeDefined();
      const probabilities = node.states.map((state) => beliefs[state.id]);
      expect(probabilities.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
      const probabilitySum = probabilities.reduce((sum, value) => sum + value, 0);
      const isEvidenceRoot = (JERMILOVA_VIEWER_CAPABILITIES.evidenceNodeIds as readonly string[]).includes(
        node.id,
      );
      if (isEvidenceRoot) {
        expect(beliefs, node.id).toEqual(node.beliefs);
      }

      if (isEvidenceRoot && ['atmospheric_hg_deposition', 'soil_erosion_hg_release'].includes(node.id)) {
        expect(['atmospheric_hg_deposition', 'soil_erosion_hg_release']).toContain(node.id);
        const acceptedRoot = acceptedRootMarginals.nodes.find((candidate) => candidate.id === node.id);
        const acceptedDistribution = acceptedRoot?.learned_distribution?.marginal;
        expect(acceptedDistribution, node.id).toBeDefined();
        expect(Object.keys(acceptedDistribution ?? {}).sort()).toEqual(
          node.states.map((state) => state.id).sort(),
        );
        for (const state of node.states) {
          const precision = referencePrecision(
            acceptedRootMarginalsBytes.toString('utf8'),
            node.id,
            state.id,
          );
          const scale = 10 ** precision;
          expect(Math.round(beliefs[state.id] * scale), `${node.id}.${state.id}`).toBe(
            Math.round((acceptedDistribution?.[state.id] ?? Number.NaN) * scale),
          );
        }
      }

      if (isEvidenceRoot && Math.abs(probabilitySum - 1) > 1e-12) {
        expect(JERMILOVA_VIEWER_CAPABILITIES.interactionMode).toBe('inspect-only');
        expect(JERMILOVA_VIEWER_CAPABILITIES.evidenceControlsEnabled).toBe(false);
      } else {
        expect(probabilitySum).toBeCloseTo(1, 12);
      }
    }
  });

  it('adapts the pack into the seven source groups, all initially collapsed, without mutating the loaded model', async () => {
    const loaded = await loadJermilovaPack(makePackFetcher().fetcher);
    const originalModel = JSON.stringify(loaded.model);
    const originalBaseline = JSON.stringify(loaded.baseline);
    const expectedGroups = [
      ['container_0', 'Point Sources', ['proximity_mine_gsl', 'proximity_historic_mine']],
      ['container_1', 'Nonpoint Sources', ['atmospheric_hg_deposition', 'permafrost_hg_release', 'soil_erosion_hg_release']],
      ['container_2', 'Hg Deposition', ['total_hg_deposition']],
      ['container_3', 'Exposure Factors', ['fish_species', 'fish_length']],
      ['container_4', 'Stressors', ['freshwater_thg', 'fish_tissue_hg']],
      ['container_5', 'Effects', ['degree_of_injury']],
      ['container_6', 'Human Health', ['eligible_commercial_catch', 'mehg_ingested', 'ptwi_exceedance']],
    ];
    expect(loaded.model.containers.map((container) => [container.id, container.label, container.childNodeIds])).toEqual(expectedGroups);
    expect(loaded.model.containers.every((container) => container.collapsed)).toBe(true);

    // Rendering of these groups (collapsed, mixed, expanded) is asserted against the
    // authenticated original Canvas in jermilovaParity.test.tsx.
    expect(JSON.stringify(loaded.model)).toBe(originalModel);
    expect(JSON.stringify(loaded.baseline)).toBe(originalBaseline);
  });
  it('rejects a registry with more than the single approved pack before loading assets', async () => {
    const registry = {
      schema_version: '1.0',
      default_pack_id: packId,
      packs: [
        { pack_id: packId, path: `packs/${packId}`, is_default: true },
        { pack_id: 'unexpected-pack', path: 'packs/unexpected-pack', is_default: false },
      ],
    };
    const { fetcher, paths } = makePackFetcher({
      '/bn-rrm/pack-registry.json': new Response(JSON.stringify(registry), { status: 200 }),
    });

    await expect(loadJermilovaPack(fetcher)).rejects.toThrow(/single approved Jermilova pack/);
    expect(paths).toEqual(['/bn-rrm/pack-registry.json']);
  });

  it('fails closed when the pack registry cannot be loaded', async () => {
    const { fetcher, paths } = makePackFetcher({
      '/bn-rrm/pack-registry.json': new Response('missing', { status: 404 }),
    });

    await expect(loadJermilovaPack(fetcher)).rejects.toThrow(/Unable to load approved pack resource \(404\)/);
    expect(paths).toEqual(['/bn-rrm/pack-registry.json']);
  });

  it('stops on a missing approved pack without trying a fallback model', async () => {
    const packPath = `/bn-rrm/packs/${packId}/pack.json`;
    const { fetcher, paths } = makePackFetcher({
      [packPath]: new Response('missing', { status: 404 }),
    });

    await expect(loadJermilovaPack(fetcher)).rejects.toThrow(/Unable to load approved pack asset 'pack'/);
    expect(paths).toEqual(['/bn-rrm/pack-registry.json', packPath]);
  });

  it('rejects a pack manifest with the wrong pack_id', async () => {
    const packAsset = assetManifest.assets.find((asset) => asset.key === 'pack');
    if (!packAsset) throw new Error('Pack asset is missing from the frozen manifest.');
    const originalAsset = { bytes: packAsset.bytes, sha256: packAsset.sha256 };
    const packPath = `/bn-rrm/packs/${packId}/pack.json`;
    const packBytes = Buffer.from(await readFile(path.join(publicRoot, ...packPath.slice(1).split('/'))));
    const pack = JSON.parse(packBytes.toString('utf8')) as { pack_id: string };
    pack.pack_id = `${packId.slice(0, -2)}zz`;
    const wrongIdentityBytes = Buffer.from(JSON.stringify(pack));
    packAsset.bytes = wrongIdentityBytes.byteLength;
    packAsset.sha256 = createHash('sha256').update(wrongIdentityBytes).digest('hex');

    try {
      const { fetcher, paths } = makePackFetcher({
        [packPath]: new Response(wrongIdentityBytes, { status: 200 }),
      });
      await expect(loadJermilovaPack(fetcher)).rejects.toThrow(/Pack manifest does not match/);
      expect(paths).toEqual(['/bn-rrm/pack-registry.json', packPath]);
    } finally {
      packAsset.bytes = originalAsset.bytes;
      packAsset.sha256 = originalAsset.sha256;
    }
  });

  it('fails closed when the packaged runtime cannot be loaded', async () => {
    const runtimeAsset = assetManifest.assets.find((asset) => asset.key === 'runtime_model');
    if (!runtimeAsset) throw new Error('Runtime asset is missing from the frozen manifest.');
    const runtimePath = `/bn-rrm/packs/${packId}/${runtimeAsset.path}`;
    const { fetcher, paths } = makePackFetcher({
      [runtimePath]: new Response('missing', { status: 404 }),
    });

    await expect(loadJermilovaPack(fetcher)).rejects.toThrow(/Unable to load approved pack asset 'runtime_model' \(404\)/);
    expect(paths).toEqual([
      '/bn-rrm/pack-registry.json',
      `/bn-rrm/packs/${packId}/pack.json`,
      runtimePath,
    ]);
  });

  it('rejects corrupt runtime JSON before model adaptation', async () => {
    const runtimePath = `/bn-rrm/packs/${packId}/${assetManifest.assets.find((asset) => asset.key === 'runtime_model')?.path}`;
    const runtimeAsset = assetManifest.assets.find((asset) => asset.key === 'runtime_model');
    if (!runtimeAsset) throw new Error('Runtime asset is missing from the frozen manifest.');
    const corrupted = Buffer.alloc(runtimeAsset.bytes, 0x20);
    const { fetcher, paths } = makePackFetcher({
      [runtimePath]: new Response(corrupted, { status: 200 }),
    });

    await expect(loadJermilovaPack(fetcher)).rejects.toThrow(/SHA256 check/);
    expect(paths).toHaveLength(3);
    expect(paths[2]).toBe(runtimePath);
  });

  it('fails closed when the packaged training data cannot be loaded', async () => {
    const trainingAsset = assetManifest.assets.find((asset) => asset.key === 'training_data');
    if (!trainingAsset) throw new Error('Training data asset is missing from the frozen manifest.');
    const trainingPath = `/bn-rrm/packs/${packId}/${trainingAsset.path}`;
    const { fetcher, paths } = makePackFetcher({
      [trainingPath]: new Response('missing', { status: 404 }),
    });

    await expect(loadJermilovaPack(fetcher)).rejects.toThrow(/Unable to load approved pack asset 'training_data' \(404\)/);
    expect(paths).toContain(trainingPath);
  });

  it('fails closed when training row counts do not match the frozen schema', async () => {
    const trainingAsset = assetManifest.assets.find((asset) => asset.key === 'training_data');
    if (!trainingAsset) throw new Error('Training data asset is missing from the frozen manifest.');
    const originalAsset = { bytes: trainingAsset.bytes, sha256: trainingAsset.sha256 };
    const trainingPath = `/bn-rrm/packs/${packId}/${trainingAsset.path}`;
    const trainingBytes = await readFile(path.join(publicRoot, ...trainingPath.slice(1).split('/')));
    const training = JSON.parse(trainingBytes.toString('utf8')) as {
      models: { GSL: { fish_count: number } };
    };
    training.models.GSL.fish_count = 603;
    const invalidBytes = Buffer.from(JSON.stringify(training));
    trainingAsset.bytes = invalidBytes.byteLength;
    trainingAsset.sha256 = createHash('sha256').update(invalidBytes).digest('hex');

    try {
      const { fetcher, paths } = makePackFetcher({
        [trainingPath]: new Response(invalidBytes, { status: 200 }),
      });
      await expect(loadJermilovaPack(fetcher)).rejects.toThrow(/Training dataset GSL does not match the frozen schema and row counts/);
      expect(paths).toContain(trainingPath);
    } finally {
      trainingAsset.bytes = originalAsset.bytes;
      trainingAsset.sha256 = originalAsset.sha256;
    }
  });
});
