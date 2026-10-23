// @vitest-environment jsdom
//
// Behavioral parity: the viewer renders the authenticated original BN-RRM
// components (or their deletion-only forks) against the real Jermilova pack.
// React Flow itself needs a layout engine, so ReactFlow is replaced by a probe that
// records the nodes/edges the original Canvas logic hands to it; that is exactly
// the source behavior under test (grouping, positions, rerouting, arrows).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: (props: Record<string, unknown>) => {
      (globalThis as Record<string, unknown>).__flowProps = props;
      return null;
    },
  };
});

import { Canvas as OriginalCanvas } from '../../../src/components/bn-rrm/canvas/Canvas';
import { ResultsPanel as OriginalResultsPanel } from '../../../src/components/bn-rrm/panels/ResultsPanel';
import * as originalNetworkStore from '../../../src/stores/bn-rrm/networkStore';
import * as originalSiteDataStore from '../../../src/stores/bn-rrm/siteDataStore';
import { NodeInspector } from '@/components/bn-rrm/panels/NodeInspector';
import * as aliasedNetworkStore from '@/stores/bn-rrm/networkStore';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import * as aliasedSiteDataStore from '@/stores/bn-rrm/siteDataStore';
import JermilovaViewerClient from '../components/JermilovaViewerClient';
import { Canvas as ForkCanvas } from '../forked/Canvas';
import { ResultsPanel as ForkResultsPanel } from '../forked/ResultsPanel';
import * as forkNetworkStore from '../forked/networkStore';
import * as forkSiteDataStore from '../forked/siteDataStore';
import assetManifest from '../asset-manifest.json';
import { JERMILOVA_PUBLIC_BASE_PATH } from './publicBasePath';

const PACK_ID = 'bnrrm-casestudy-jermilova2025-mackenzie-hg';
const BASE = JERMILOVA_PUBLIC_BASE_PATH;
const viewerRoot = path.resolve(__dirname, '..');
const viewerPublic = path.join(viewerRoot, 'public');

// Source truth (BNRRMClient/Canvas/trained-network at the pinned base).
const SOURCE_EDGES = [
  'atmospheric_hg_deposition->total_hg_deposition',
  'permafrost_hg_release->total_hg_deposition',
  'soil_erosion_hg_release->total_hg_deposition',
  'proximity_mine_gsl->freshwater_thg',
  'proximity_historic_mine->freshwater_thg',
  'total_hg_deposition->freshwater_thg',
  'fish_species->fish_tissue_hg',
  'fish_length->fish_tissue_hg',
  'proximity_mine_gsl->fish_tissue_hg',
  'proximity_historic_mine->fish_tissue_hg',
  'total_hg_deposition->fish_tissue_hg',
  'fish_tissue_hg->degree_of_injury',
  'fish_tissue_hg->eligible_commercial_catch',
  'fish_tissue_hg->mehg_ingested',
  'mehg_ingested->ptwi_exceedance',
].sort();
const COLLAPSED_EDGES = [
  'container_1->container_2',
  'container_0->container_4',
  'container_2->container_4',
  'container_3->container_4',
  'container_4->container_5',
  'container_4->container_6',
].sort();

interface FlowNode { id: string; type?: string; position: { x: number; y: number } }
interface FlowEdge { id: string; source: string; target: string; markerEnd?: { type?: string } }
interface FlowProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodeClick?: (event: unknown, node: { id: string; type?: string }) => void;
}

const requests: Array<{ url: string; method: string }> = [];
// When set, the stub serves this pack file with one extra byte (integrity probe).
let tamperPath: string | null = null;
let packHashesAtStart: Record<string, string> = {};

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function packFileHashes() {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(viewerPublic, full).split(path.sep).join('/')] = sha256(fs.readFileSync(full));
    }
  };
  walk(path.join(viewerPublic, 'bn-rrm'));
  return out;
}

function installFetchStub() {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: { method?: string }) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String((input as { url: string }).url);
    const method = (init?.method ?? 'GET').toUpperCase();
    requests.push({ url, method });
    // The stores' direct loads in these tests (no wrapper) request '/bn-rrm/...'; the
    // mounted viewer's verifiedFetch requests '<base>/bn-rrm/...', as the deployment serves.
    const requested = decodeURIComponent(new URL(url, 'http://viewer.local').pathname);
    const pathname = requested.startsWith(`${BASE}/bn-rrm/`) ? requested.slice(BASE.length) : requested;
    const file = path.join(viewerPublic, ...pathname.slice(1).split('/'));
    if (method !== 'GET' || !pathname.startsWith('/bn-rrm/') || !file.startsWith(viewerPublic) || !fs.existsSync(file)) {
      return new Response('not found', { status: 404 });
    }
    const bytes = pathname === tamperPath ? Buffer.concat([fs.readFileSync(file), Buffer.from(' ')]) : fs.readFileSync(file);
    return new Response(bytes, { status: 200, headers: { 'content-type': 'application/json' } });
  }));
}

function flow(): FlowProps {
  return (globalThis as Record<string, unknown>).__flowProps as FlowProps;
}

function summarize(props: FlowProps) {
  return {
    nodes: props.nodes.map((n) => ({ id: n.id, type: n.type, x: n.position.x, y: n.position.y })),
    edges: props.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, marker: e.markerEnd?.type })),
  };
}

// Render the fork, then the original, against the same store state.
function renderBoth() {
  render(<ForkCanvas />);
  const fork = summarize(flow());
  cleanup();
  render(<OriginalCanvas />);
  const original = summarize(flow());
  cleanup();
  return { fork, original };
}

const isContainer = (n: { type?: string }) => n.type === 'containerNode';
const pairs = (edges: Array<{ source: string; target: string }>) => edges.map((e) => `${e.source}->${e.target}`).sort();

async function loadJermilova() {
  await usePackStore.getState().loadRegistry();
  const pack = usePackStore.getState();
  const base = pack.getPackBaseUrl();
  if (!base || !pack.packManifest) throw new Error('Jermilova pack did not load from the viewer registry.');
  await useNetworkStore.getState().loadPackModel(base, pack.packManifest);
}

describe('Jermilova viewer parity with the authenticated original', () => {
  beforeAll(async () => {
    packHashesAtStart = packFileHashes();
    installFetchStub();
    await loadJermilova();
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('loads only the Jermilova pack from the viewer registry, by GET under /bn-rrm/ only', () => {
    expect(usePackStore.getState().selectedPackId).toBe(PACK_ID);
    const model = useNetworkStore.getState().model;
    expect(model?.nodes).toHaveLength(14);
    expect(model?.edges).toHaveLength(15);
    expect(model?.containers).toHaveLength(7);
    expect(pairs(model?.edges ?? [])).toEqual(SOURCE_EDGES);
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.method).toBe('GET');
      expect(new URL(request.url, 'http://viewer.local').pathname.startsWith('/bn-rrm/')).toBe(true);
    }
  });

  it('collapsed: the fork matches the original with 7 containers, 0 children and 6 rerouted edges', () => {
    act(() => useNetworkStore.getState().collapseAllContainers());
    const { fork, original } = renderBoth();
    expect(fork).toEqual(original);
    expect(fork.nodes.filter(isContainer)).toHaveLength(7);
    expect(fork.nodes.filter((n) => !isContainer(n))).toHaveLength(0);
    expect(pairs(fork.edges)).toEqual(COLLAPSED_EDGES);
  });

  it('mixed: expanding one group keeps all 7 containers and adds only that group\'s children', () => {
    act(() => {
      useNetworkStore.getState().collapseAllContainers();
      useNetworkStore.getState().toggleContainer('container_4');
    });
    const { fork, original } = renderBoth();
    expect(fork).toEqual(original);
    expect(fork.nodes.filter(isContainer)).toHaveLength(7);
    expect(fork.nodes.filter((n) => !isContainer(n)).map((n) => n.id).sort()).toEqual(['fish_tissue_hg', 'freshwater_thg']);
  });

  it('expanded: 7 containers, 14 children and the 15 directed source edges with closed arrows at source offsets', () => {
    act(() => useNetworkStore.getState().expandAllContainers());
    const { fork, original } = renderBoth();
    expect(fork).toEqual(original);
    const containers = fork.nodes.filter(isContainer);
    const children = fork.nodes.filter((n) => !isContainer(n));
    expect(containers).toHaveLength(7);
    expect(children).toHaveLength(14);
    expect(pairs(fork.edges)).toEqual(SOURCE_EDGES);
    for (const edge of fork.edges) expect(edge.marker).toBe('arrowclosed');
    const model = useNetworkStore.getState().model!;
    for (const container of model.containers) {
      const frame = containers.find((c) => c.id === container.id)!;
      container.childNodeIds.forEach((childId, index) => {
        const child = children.find((c) => c.id === childId)!;
        expect(child.x).toBe(frame.x + 30);
        expect(child.y).toBe(frame.y + 60 + index * 160);
      });
    }
  });

  it('a child click drives the inspector and highlights its causal path; a container click selects nothing', async () => {
    act(() => {
      useNetworkStore.getState().expandAllContainers();
      useNetworkStore.getState().selectNode(null);
    });
    render(<ForkCanvas />);
    act(() => flow().onNodeClick?.({}, { id: 'container_4', type: 'containerNode' }));
    expect(useNetworkStore.getState().selectedNodeId).toBeNull();
    act(() => flow().onNodeClick?.({}, { id: 'fish_tissue_hg', type: 'effectNode' }));
    expect(useNetworkStore.getState().selectedNodeId).toBe('fish_tissue_hg');
    expect(useNetworkStore.getState().highlightedPath).toEqual(expect.arrayContaining(['fish_tissue_hg', 'total_hg_deposition']));
    cleanup();
    const label = useNetworkStore.getState().model!.nodes.find((n) => n.id === 'fish_tissue_hg')!.label;
    render(<NodeInspector />);
    expect(await screen.findAllByText(label)).not.toHaveLength(0);
    expect(screen.getByText('Parent Nodes (Causes)')).toBeTruthy();
  });

  it('in-memory what-if: evidence changes the beliefs, Reset restores them, and nothing reaches browser storage', async () => {
    // The store re-runs forward inference on a setTimeout(0) after each evidence change.
    const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    const downstream = () => JSON.stringify(useNetworkStore.getState().model!.nodes.find((n) => n.id === 'fish_tissue_hg')!.beliefs);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    act(() => useNetworkStore.getState().clearAllEvidence());
    await settle();
    const before = downstream();
    const root = useNetworkStore.getState().model!.nodes.find((n) => n.id === 'fish_length')!;
    act(() => useNetworkStore.getState().setEvidence(root.id, root.states[root.states.length - 1].id));
    await settle();
    expect(downstream()).not.toBe(before);
    render(<ForkResultsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    await settle();
    expect(useNetworkStore.getState().evidence).toEqual({});
    expect(downstream()).toBe(before);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('ResultsPanel keeps Reset and removes only the Export download (two-sided against the original)', () => {
    render(<OriginalResultsPanel />);
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeNull();
    cleanup();
    render(<ForkResultsPanel />);
    expect(screen.queryByRole('button', { name: /Reset/ })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull();
  });

  it('every importer of the site data store gets the persist-free fork (two-sided against the original)', () => {
    expect(aliasedSiteDataStore.useSiteDataStore).toBe(forkSiteDataStore.useSiteDataStore);
    expect((forkSiteDataStore.useSiteDataStore as unknown as { persist?: unknown }).persist).toBeUndefined();
    expect((originalSiteDataStore.useSiteDataStore as unknown as { persist?: unknown }).persist).toBeDefined();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    act(() => {
      forkSiteDataStore.useSiteDataStore.getState().selectSite('probe-site');
      forkSiteDataStore.useSiteDataStore.getState().selectSite(null);
    });
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('a failed runtime load leaves no model in the fork, where the original falls back to another model (two-sided)', async () => {
    expect(aliasedNetworkStore.useNetworkStore).toBe(forkNetworkStore.useNetworkStore);
    const manifest = usePackStore.getState().packManifest!;
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    originalNetworkStore.useNetworkStore.setState({ model: null });
    await originalNetworkStore.useNetworkStore.getState().loadPackModel('/bn-rrm/missing', manifest);
    const fallback = originalNetworkStore.useNetworkStore.getState().model;
    expect(fallback).not.toBeNull();
    expect(fallback!.nodes.length).not.toBe(14);
    forkNetworkStore.useNetworkStore.setState({ model: null });
    await forkNetworkStore.useNetworkStore.getState().loadPackModel('/bn-rrm/missing', manifest);
    expect(forkNetworkStore.useNetworkStore.getState().model).toBeNull();
    silence.mockRestore();
    await loadJermilova();
    expect(useNetworkStore.getState().model?.nodes).toHaveLength(14);
  });

  it('the viewer mounts the original page with exactly the six source tabs in source order', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    // Cold start: the page must load Jermilova itself, not reuse warmed store state.
    usePackStore.setState(usePackStore.getInitialState(), true);
    useNetworkStore.setState(useNetworkStore.getInitialState(), true);
    const firstMountRequest = requests.length;
    render(<JermilovaViewerClient />);
    try {
      await waitFor(() => expect(document.querySelectorAll('nav button')).toHaveLength(6), { timeout: 10000 });
    } catch (error) {
      throw new Error(`Shell did not mount: ${document.body.textContent?.slice(0, 400)}`, { cause: error });
    }
    const labels = [...document.querySelectorAll('nav button')].map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Guide', 'Conceptual', 'Detailed BN', 'CPT', 'Map', 'Data']);
    // The original PackBanner caveat for the read-only benchmark pack is shown verbatim.
    expect(await screen.findByText(/Frozen benchmark/)).toBeTruthy();
    expect(screen.getByText(/Use the Data tab to browse published training data/)).toBeTruthy();
    // The model loads after the pack banner; wait for its count rather than racing it.
    expect(await screen.findByText('14 nodes', {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.queryByText('Review')).toBeNull();
    expect(screen.queryByText('Case Studies')).toBeNull();
    fireEvent.click(screen.getByTitle('Upload & export'));
    // Data tab = the original BenchmarkDataViewer, which renders the original
    // TrainingDataTable (filter + column selector) once the training data loads.
    expect(await screen.findByPlaceholderText('Filter values...', {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByText('All columns')).toBeTruthy();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    for (const request of requests) expect(request.method).toBe('GET');
    // Every pack read the mounted viewer makes goes to the served mount, never to the
    // authenticated app's own /bn-rrm/ paths.
    const mounted = requests.slice(firstMountRequest).map((request) => new URL(request.url, 'http://viewer.local').pathname);
    expect(mounted.length).toBeGreaterThan(0);
    for (const pathname of mounted) expect(pathname.startsWith(`${BASE}/bn-rrm/`), pathname).toBe(true);
  }, 30000);

  it('a pack file tampered after mount replaces the page with the fail-closed error', async () => {
    usePackStore.setState(usePackStore.getInitialState(), true);
    useNetworkStore.setState(useNetworkStore.getInitialState(), true);
    render(<JermilovaViewerClient />);
    await waitFor(() => expect(document.querySelectorAll('nav button')).toHaveLength(6), { timeout: 10000 });
    tamperPath = `/bn-rrm/packs/${PACK_ID}/training_data.json`;
    try {
      fireEvent.click(screen.getByTitle('Upload & export'));
      expect(await screen.findByText('Approved pack unavailable', {}, { timeout: 10000 })).toBeTruthy();
      expect(document.querySelectorAll('nav button')).toHaveLength(0);
    } finally {
      tamperPath = null;
    }
  }, 30000);

  it('leaves every shipped pack file byte-identical to the asset manifest', () => {
    expect(packFileHashes()).toEqual(packHashesAtStart);
    const hashes = packFileHashes();
    for (const asset of assetManifest.assets) {
      expect(hashes[`bn-rrm/packs/${PACK_ID}/${asset.path}`]).toBe(asset.sha256);
    }
  });
});
