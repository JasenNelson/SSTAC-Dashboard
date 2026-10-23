// Public viewer scope, asserted against the authenticated original source.
// (Replaces the R3 cases that asserted the superseded reimplementation's own
// constants, e.g. a +16 child offset, instead of source behavior.)
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import closure from '../src-closure.json';

const viewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(viewerRoot, '../..');
const read = (rel: string) => readFileSync(path.join(repoRoot, ...rel.split('/')), 'utf8');
const ORIGINAL_SHELL = 'src/app/(dashboard)/bn-rrm/BNRRMClient.tsx';
const FORK_SHELL = 'viewers/jermilova-public/forked/JermilovaBnrrmClient.tsx';

function tabsOf(source: string) {
  return [...source.matchAll(/\{ id: '([a-z]+)', label: '([^']+)'/g)].map((m) => ({ id: m[1], label: m[2] }));
}

// Viewer-local files reachable from the route entry (app/page.tsx) by import.
function productViewerFiles() {
  const seen = new Set<string>();
  const queue = [path.join(viewerRoot, 'app', 'page.tsx'), path.join(viewerRoot, 'app', 'layout.tsx')];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const ref of ts.preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles) {
      if (!ref.fileName.startsWith('.')) continue;
      const base = path.resolve(path.dirname(file), ref.fileName);
      const hit = ['', '.ts', '.tsx'].map((ext) => base + ext).find((candidate) => {
        try {
          return readFileSync(candidate) && candidate.startsWith(viewerRoot) && /\.(ts|tsx)$/.test(candidate);
        } catch {
          return false;
        }
      });
      if (hit) queue.push(hit);
    }
  }
  return [...seen].map((f) => path.relative(viewerRoot, f).split(path.sep).join('/')).sort();
}

describe('Jermilova public viewer scope', () => {
  it('shows the original tab list minus Review and Case Studies, in source order, defaulting to Detailed BN', () => {
    const original = tabsOf(read(ORIGINAL_SHELL));
    const fork = tabsOf(read(FORK_SHELL));
    expect(original.map((t) => t.id)).toContain('review');
    expect(original.map((t) => t.id)).toContain('casestudies');
    expect(fork).toEqual(original.filter((t) => t.id !== 'review' && t.id !== 'casestudies'));
    expect(fork.map((t) => t.label)).toEqual(['Guide', 'Conceptual', 'Detailed BN', 'CPT', 'Map', 'Data']);
    for (const source of [read(ORIGINAL_SHELL), read(FORK_SHELL)]) {
      expect(source).toContain("useState<ViewTab>('detailed')");
    }
  });

  it('mounts only the forked original shell; the superseded reimplementation is unreachable', () => {
    const files = productViewerFiles();
    expect(files).toEqual(expect.arrayContaining([
      'app/page.tsx',
      'components/JermilovaViewerClient.tsx',
      'forked/JermilovaBnrrmClient.tsx',
      'forked/Canvas.tsx',
      'forked/ResultsPanel.tsx',
      'forked/SiteMap.tsx',
      'forked/SiteDetails.tsx',
    ]));
    for (const superseded of ['ReadOnlyNetworkCanvas', 'GuideView', 'ConceptualView', 'DataView', 'JermilovaMapView', 'JermilovaMapCanvas', 'AboutView']) {
      expect(files).not.toContain(`components/${superseded}.tsx`);
    }
    const modules = (closure.entries as Array<{ path: string; role: string }>).filter((e) => e.role === 'module').map((e) => e.path);
    expect(modules).toEqual(expect.arrayContaining([
      'src/components/bn-rrm/panels/NodeInspector.tsx',
      'src/components/bn-rrm/cpt/CPTExplorer.tsx',
      'src/components/bn-rrm/data/BenchmarkDataViewer.tsx',
      'src/components/bn-rrm/getting-started/GettingStartedView.tsx',
      'src/components/bn-rrm/shared/PackBanner.tsx',
      'src/stores/bn-rrm/packStore.ts',
    ]));
    // The stores the viewer forks are pinned as originals, never shipped as modules.
    for (const forkedStore of ['src/stores/bn-rrm/networkStore.ts', 'src/stores/bn-rrm/siteDataStore.ts']) {
      expect(modules).not.toContain(forkedStore);
    }
  });

  it('removes write, export, server and other-model paths from the forks only (two-sided)', () => {
    const cases: Array<[string, string, string[]]> = [
      [ORIGINAL_SHELL, FORK_SHELL, ['PackSelector', 'ReviewView', 'CaseStudiesView', 'handleRunAssessment', 'addAssessment', 'loadTrainedModel()', 'DataUploader', 'ExportPanel', 'Benthic Risk Conceptual Model', 'Landis 2021']],
      ['src/components/bn-rrm/canvas/Canvas.tsx', 'viewers/jermilova-public/forked/Canvas.tsx', ['onConnect', 'addEdge']],
      ['src/components/bn-rrm/panels/ResultsPanel.tsx', 'viewers/jermilova-public/forked/ResultsPanel.tsx', ['bn-rrm-results-', 'createObjectURL']],
      ['src/components/bn-rrm/map/SiteMap.tsx', 'viewers/jermilova-public/forked/SiteMap.tsx', ["setInteractionMode('identify')", "setInteractionMode('identify-area')", '/api/bn-rrm/wms-identify', '/api/bn-rrm/wfs-identify', 'Export map image', 'html-to-image']],
      ['src/components/bn-rrm/map/SiteDetails.tsx', 'viewers/jermilova-public/forked/SiteDetails.tsx', ['downloadJson', 'Export Identified', 'handleReportExport']],
      ['src/stores/bn-rrm/siteDataStore.ts', 'viewers/jermilova-public/forked/siteDataStore.ts', ['persist(', 'sstac-bn-rrm-site-data']],
      ['src/stores/bn-rrm/networkStore.ts', 'viewers/jermilova-public/forked/networkStore.ts', ["createTrainedNetwork('expert')", 'loadTrainedModel', 'loadDummyModel', 'createDummyNetwork', 'learned-model.json']],
    ];
    for (const [original, fork, markers] of cases) {
      const o = read(original);
      const f = read(fork);
      for (const marker of markers) {
        expect(o.includes(marker), `${original} has ${marker}`).toBe(true);
        expect(f.includes(marker), `${fork} lacks ${marker}`).toBe(false);
      }
    }
  });

  it('keeps the owner-approved verbatim source text (Data tooltip) in the fork', () => {
    const line = "{ id: 'data', label: 'Data', icon: Database, description: 'Upload & export' }";
    expect(read(ORIGINAL_SHELL)).toContain(line);
    expect(read(FORK_SHELL)).toContain(line);
  });

  it('styles the original components with the authenticated app stylesheet and Tailwind sources', () => {
    const css = read('viewers/jermilova-public/app/globals.css');
    expect(css).toContain('@import "../../../src/app/globals.css";');
    for (const source of ['@source "../../../src/components/bn-rrm";', '@source "../../../src/lib/bn-rrm";', '@source "../forked";']) {
      expect(css).toContain(source);
    }
    expect(read('viewers/jermilova-public/app/layout.tsx')).toContain('<body className="antialiased">');
  });

  it('exports a single route and ships no public files beyond the approved pack (source side of audit T2)', () => {
    const list = (rel: string) => readdirSync(path.join(viewerRoot, rel)).sort();
    expect(list('app')).toEqual(['globals.css', 'layout.tsx', 'page.tsx']);
    expect(list('public')).toEqual(['bn-rrm']);
    expect(list('public/bn-rrm')).toEqual(['pack-registry.json', 'packs']);
    expect(list('public/bn-rrm/packs')).toEqual(['bnrrm-casestudy-jermilova2025-mackenzie-hg']);
  });

  it('offers exactly one pack, Jermilova, as the registry default', () => {
    const registry = JSON.parse(read('viewers/jermilova-public/public/bn-rrm/pack-registry.json'));
    expect(registry.default_pack_id).toBe('bnrrm-casestudy-jermilova2025-mackenzie-hg');
    expect(registry.packs.map((p: { pack_id: string }) => p.pack_id)).toEqual(['bnrrm-casestudy-jermilova2025-mackenzie-hg']);
  });
});
