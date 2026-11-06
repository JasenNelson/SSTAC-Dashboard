// Creates viewers/jermilova-public/forked/* from the authenticated originals in src/.
// Every change is an exact-string edit that must match exactly once, so a drifted
// source fails closed instead of producing a silently different fork. Edits are
// limited to approved viewer isolation, About, and fresh-baseline behavior.
// Usage: node viewers/jermilova-public/scripts/make-forks.mjs
// The repo root is derived from this file's location, never from the shell cwd.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const forkDir = path.join(repoRoot, 'viewers/jermilova-public/forked');

function between(text, start, end) {
  const a = text.indexOf(start);
  if (a < 0 || text.indexOf(start, a + 1) >= 0) throw new Error('start anchor not unique: ' + start.slice(0, 60));
  const b = text.indexOf(end, a);
  if (b < 0) throw new Error('end anchor missing after: ' + start.slice(0, 60));
  return text.slice(a, b + end.length);
}

function apply(text, edits, label) {
  let out = text;
  for (const [from, to] of edits) {
    const first = out.indexOf(from);
    if (first < 0 || out.indexOf(from, first + 1) >= 0) {
      throw new Error(label + ': edit anchor must match exactly once: ' + JSON.stringify(from.slice(0, 80)));
    }
    out = out.replace(from, () => to);
  }
  return out;
}

const forks = [
  {
    source: 'src/app/(dashboard)/bn-rrm/BNRRMClient.tsx',
    fork: 'JermilovaBnrrmClient.tsx',
    edits: (t) => [
      ["import { PackSelector } from '@/components/bn-rrm/shared/PackSelector';\n", ''],
      ["import { ResultsPanel } from '@/components/bn-rrm/panels/ResultsPanel';", "import { ResultsPanel } from './ResultsPanel';"],
      ["import { DataUploader } from '@/components/bn-rrm/data/DataUploader';\n", ''],
      ["import { ReferenceDataImporter } from '@/components/bn-rrm/data/ReferenceDataImporter';\n", ''],
      ["import { SiteDataTable } from '@/components/bn-rrm/data/SiteDataTable';\n", ''],
      ["import { ExportPanel } from '@/components/bn-rrm/data/ExportPanel';\n", ''],
      ["import { ReferenceDataBrowser } from '@/components/bn-rrm/data/ReferenceDataBrowser';\n", ''],
      ["import { SiteDetails } from '@/components/bn-rrm/map/SiteDetails';", "import { SiteDetails } from './SiteDetails';"],
      [
        "import { SiteDetails } from './SiteDetails';\n",
        "import { SiteDetails } from './SiteDetails';\nimport { AboutView } from '../components/AboutView';\nimport type { VerifiedClaim } from '../lib/loadJermilovaPack';\n",
      ],
      ["import { classifyRawSiteData, dagForwardInference } from '@/lib/bn-rrm/bn-inference';\nimport { createTrainedNetwork } from '@/lib/bn-rrm/trained-network';\n", ''],
      ['AlertTriangle, Upload, Table, Download, ClipboardCheck, BookOpen }', 'AlertTriangle, Table, BookOpen, Info }'],
      ["import('@/components/bn-rrm/canvas/Canvas')", "import('./Canvas')"],
      ["import('@/components/bn-rrm/map/SiteMap')", "import('./SiteMap')"],
      [between(t, 'const ReviewView = dynamic(', '});\n\n'), ''],
      [between(t, 'const CaseStudiesView = dynamic(', '});\n\n'), ''],
      [" | 'data' | 'review' | 'casestudies';", " | 'data' | 'about';"],
      [
        "  { id: 'data', label: 'Data', icon: Database, description: 'Upload & export' },\n",
        "  { id: 'data', label: 'Data', icon: Database, description: 'Upload & export' },\n  { id: 'about', label: 'About', icon: Info, description: 'Pack information and limitations' },\n",
      ],
      ["  { id: 'review', label: 'Review', icon: ClipboardCheck, description: 'Peer review transparency' },\n", ''],
      ["  { id: 'casestudies', label: 'Case Studies', icon: BookOpen, description: 'Site comparisons' },\n", ''],
      ['export default function BNRRMClient() {', 'export default function BNRRMClient({ aboutClaims }: { aboutClaims: VerifiedClaim[] }) {'],
      [
        '      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm print:hidden">\n        <div className="flex items-center gap-4">',
        '      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex min-w-0 items-center justify-between gap-2 shrink-0 shadow-sm sm:px-4 print:hidden">\n        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">',
      ],
      [
        '<nav className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">',
        '<nav aria-label="Viewer sections" className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain bg-slate-100 dark:bg-slate-700 rounded-lg p-1">',
      ],
      [
        "className={cn('relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200'",
        "className={cn('relative flex h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 sm:h-auto sm:min-w-0 sm:justify-start'",
      ],
      ['  const selectSite = useSiteDataStore((state) => state.selectSite);\n  const addAssessment = useSiteDataStore((state) => state.addAssessment);\n', ''],
      [between(t, '  const handleViewOnMap = useCallback(', '}, [sites, handleRunAssessment, setBatchProgress]);\n\n'), ''],
      ['h-[calc(100vh-4rem)]', 'h-screen'],
      ['          <PackSelector />\n', ''],
      ["        {activeTab === 'review' && <ReviewView />}\n        {activeTab === 'casestudies' && <CaseStudiesView />}\n", ''],
      [' onRunAssessment={handleRunAssessment} onRunBatchAssessment={handleRunBatchAssessment} />}', ' />}'],
      ['<DataView onViewOnMap={handleViewOnMap} onRunAssessment={handleRunAssessment} isReadOnly={isReadOnly} />', '<DataView isReadOnly={isReadOnly} />'],
      [
        "        {activeTab === 'data' && <DataView isReadOnly={isReadOnly} />}\n",
        "        {activeTab === 'data' && <DataView isReadOnly={isReadOnly} />}\n        {activeTab === 'about' && <AboutView claims={aboutClaims} />}\n",
      ],
      [
        'function MapView({ showLeftPanel, showRightPanel, onRunAssessment, onRunBatchAssessment }: { showLeftPanel: boolean; showRightPanel: boolean; onRunAssessment: (siteId: string) => void; onRunBatchAssessment: (siteIds: string[]) => void }) {',
        'function MapView({ showLeftPanel, showRightPanel }: { showLeftPanel: boolean; showRightPanel: boolean }) {',
      ],
      ['<SiteDetails className="h-full w-80" onRunAssessment={onRunAssessment} onRunBatchAssessment={onRunBatchAssessment} />', '<SiteDetails className="h-full w-80" />'],
      [
        between(t, 'function DataView({ onViewOnMap, onRunAssessment, isReadOnly }', '  );\n}\n\n'),
        'function DataView({ isReadOnly }: { isReadOnly?: boolean }) {\n  if (isReadOnly) {\n    return <BenchmarkDataViewer />;\n  }\n\n  return null;\n}\n\n',
      ],
      [between(t, 'function NavButton(', '    </button>\n  );\n}\n\n'), ''],
      ["import { useState, useCallback, useEffect } from 'react';", "import { useState, useEffect } from 'react';"],
      // No other model may ever render: delete the legacy expert-model fallback and
      // the banner note that would otherwise claim it is in use.
      ['  const loadTrainedModel = useNetworkStore((state) => state.loadTrainedModel);\n', ''],
      [
        "    } else if (registryLoaded && !packManifest && !packLoading && !selectedPackId) {\n      // Fallback: if registry failed or no packs available, use legacy path\n      loadTrainedModel();\n    }\n",
        '    }\n',
      ],
      [', loadPackModel, loadTrainedModel]);', ', loadPackModel]);'],
      ['          {registryError && <span className="ml-auto text-[10px] opacity-70">Using legacy expert model</span>}\n', ''],
      // The Conceptual tab's hardcoded benthic (non-Jermilova) default renders whenever the
      // Jermilova model is not loaded; delete it so only the pack-driven view can render.
      [between(t, '  // Default: hardcoded benthic sediment conceptual model\n', '  );\n}\n\n'), '  // Default: hardcoded benthic sediment conceptual model\n  return null;\n}\n\n'],
    ],
  },
  {
    source: 'src/components/bn-rrm/canvas/Canvas.tsx',
    fork: 'Canvas.tsx',
    edits: (t) => [
      ["from './nodes/BaseNode';", "from '@/components/bn-rrm/canvas/nodes/BaseNode';"],
      ["from './nodes/ContainerNode';", "from '@/components/bn-rrm/canvas/nodes/ContainerNode';"],
      ['  addEdge,\n  type Connection,\n', ''],
      [between(t, '  const onConnect = useCallback(', '[setEdges]\n  );\n\n'), ''],
      ['        onConnect={onConnect}\n', ''],
    ],
  },
  {
    source: 'src/components/bn-rrm/panels/ResultsPanel.tsx',
    fork: 'ResultsPanel.tsx',
    edits: (t) => [
      ['  Download,\n', ''],
      [between(t, '          <button\n            onClick={() => {\n              const nodes = model ?', '            Export\n          </button>\n'), ''],
    ],
  },
  {
    source: 'src/components/bn-rrm/map/SiteMap.tsx',
    fork: 'SiteMap.tsx',
    edits: (t) => [
      ["import {\n  formatIdentifyEmptyHtml,\n  formatIdentifyPopupHtml,\n} from '@/lib/maps/identify-format';\n", ''],
      ["const BC_WMS_IDENTIFY_PROXY_URL = '/api/bn-rrm/wms-identify';\nconst BC_WFS_IDENTIFY_PROXY_URL = '/api/bn-rrm/wfs-identify';\n", ''],
      [between(t, '  // Identify-area mode: drag a rectangle', '  }, [interactionMode, isLoaded, leaflet, setIdentifiedFeatures]);\n\n'), ''],
      [between(t, '  // Identify mode wiring.', '  }, [interactionMode, isLoaded, leaflet, setIdentifiedFeatures]);\n\n'), ''],
      [between(t, '  // Export map as image\n', '  }, []);\n\n'), ''],
      [between(t, '        <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />\n        <button\n          aria-label="Export map image"', '        </button>\n'), ''],
      [between(t, "        <button\n          onClick={() => setInteractionMode('identify')}", '          <span className="hidden sm:inline">Identify Area</span>\n        </button>\n'), ''],
      // Symbols left unused by the deletions above.
      ['  getActiveOverlaysInZOrder,\n  queryActiveOverlays,\n  queryActiveOverlaysInBounds,\n', ''],
      ['  type IdentifyOverlay,\n  type LeafletMapLike,\n', ''],
      ['  Download,\n', ''],
      ['  Crosshair,\n', ''],
      [between(t, '  // Transient "no features" / "N features" popup owned by the Identify tool.', '  const identifyRequestIdRef = useRef<number>(0);\n'), ''],
      ['  const setIdentifiedFeatures = useSiteDataStore((state) => state.setIdentifiedFeatures);\n', ''],
    ],
  },
  {
    source: 'src/components/bn-rrm/map/SiteDetails.tsx',
    fork: 'SiteDetails.tsx',
    edits: (t) => [
      ["from './IdentifiedFeaturesList';", "from '@/components/bn-rrm/map/IdentifiedFeaturesList';"],
      [between(t, '  const handleIdentifiedExport = () => {', '    );\n  };\n\n'), ''],
      [between(t, '          <div className="p-4 border-t border-slate-200 dark:border-slate-700">\n            <button\n              onClick={handleIdentifiedExport}', '            </button>\n          </div>\n'), ''],
      [between(t, '  // Multi-site report export\n', '    }\n  };\n\n'), ''],
      [between(t, '          <button\n            onClick={handleReportExport}', '            </button>\n          )}\n'), ''],
      [between(t, 'function downloadJson(', '}\n\n'), ''],
      // Symbols left unused by the deletions above.
      ['  FileText,\n', ''],
      ['  const primaryIdentifiedFeature =\n    primaryFeatureIndex !== null ? identifiedFeatures[primaryFeatureIndex] : null;\n', ''],
    ],
  },
  {
    // No other model may ever render: delete the legacy expert/dummy model loaders
    // and the expert-model fallback in loadPackModel's catch (on failure the model
    // simply stays unloaded).
    source: 'src/stores/bn-rrm/networkStore.ts',
    fork: 'networkStore.ts',
    edits: (t) => [
      ["import { createDummyNetwork } from '@/lib/bn-rrm/dummy-data';\n", ''],
      ["  loadDummyModel: () => void;\n  loadTrainedModel: (source?: 'expert' | 'learned') => void;\n", ''],
      [between(t, '      loadDummyModel: () => {', '          get().loadModel(trainedModel);\n        }\n      },\n\n'), ''],
      ["          // Fallback to expert model (only meaningful for canonical packs)\n          const trainedModel = createTrainedNetwork('expert');\n          get().loadModel(trainedModel);\n", ''],
      ['  model: NetworkModel | null;\n', '  model: NetworkModel | null;\n  baselineModel: NetworkModel | null;\n'],
      ['      model: null,\n', '      model: null,\n      baselineModel: null,\n'],
      [
        "      loadModel: (model) => {\n        const nodeMap = new Map(model.nodes.map(n => [n.id, n]));\n        const containerMap = new Map(model.containers.map(c => [c.id, c]));\n\n        set({\n          model,\n          nodeMap,\n          containerMap,\n          evidence: {},\n          selectedNodeId: null,\n          selectedContainerId: null,\n          highlightedPath: [],\n        });\n      },",
        "      loadModel: (model) => {\n        const cloneModel = (): NetworkModel => ({\n          ...model,\n          nodes: model.nodes.map((node) => ({\n            ...node,\n            beliefs: { ...node.beliefs },\n            evidence: null,\n          })),\n        });\n        const baselineModel = cloneModel();\n        const liveModel = cloneModel();\n        const nodeMap = new Map(liveModel.nodes.map(n => [n.id, n]));\n        const containerMap = new Map(model.containers.map(c => [c.id, c]));\n\n        set({\n          model: liveModel,\n          baselineModel,\n          nodeMap,\n          containerMap,\n          evidence: {},\n          selectedNodeId: null,\n          selectedContainerId: null,\n          highlightedPath: [],\n        });\n      },",
      ],
      ['        const { evidence, model } = get();\n', '        const { evidence, model, baselineModel } = get();\n'],
      ['          ? dagForwardInference(model, evidence)\n          : dagBackwardInference(model, evidence);', '          ? dagForwardInference(baselineModel ?? model, evidence)\n          : dagBackwardInference(baselineModel ?? model, evidence);'],
      [
        between(t, '      clearAllEvidence: () => {', '        });\n      },\n\n'),
        "      clearAllEvidence: () => {\n        const { model, baselineModel } = get();\n        if (!model) return;\n\n        const baselineBeliefs = dagForwardInference(baselineModel ?? model, {}).beliefs;\n        const updatedNodes = model.nodes.map(n => {\n          return { ...n, evidence: null, beliefs: { ...(baselineBeliefs[n.id] ?? n.beliefs) } };\n        });\n\n        const newNodeMap = new Map(updatedNodes.map(n => [n.id, n]));\n\n        set({\n          evidence: {},\n          model: { ...model, nodes: updatedNodes },\n          nodeMap: newNodeMap,\n        });\n      },\n\n",
      ],
    ],
  },
  {
    source: 'src/stores/bn-rrm/siteDataStore.ts',
    fork: 'siteDataStore.ts',
    edits: (t) => [
      ["import { devtools, persist } from 'zustand/middleware';", "import { devtools } from 'zustand/middleware';"],
      ['  devtools(\n    persist(\n', '  devtools(\n'],
      [between(t, "      {\n        name: 'sstac-bn-rrm-site-data',", '        }),\n      }\n    ),\n'), ''],
    ],
  },
];

fs.mkdirSync(forkDir, { recursive: true });
for (const f of forks) {
  const raw = fs.readFileSync(path.join(repoRoot, f.source), 'utf8');
  // Preserve the source's line endings: edit in LF, restore CRLF if the source used it.
  const crlf = raw.includes('\r\n');
  if (crlf && raw.replace(/\r\n/g, '').includes('\n')) throw new Error(f.source + ': mixed line endings');
  const src = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  const edited = apply(src, f.edits(src), f.fork);
  const out = crlf ? edited.replace(/\n/g, '\r\n') : edited;
  const dst = path.join(forkDir, f.fork);
  fs.writeFileSync(dst, out, { flag: 'wx' });
  console.log('forked', f.source, '->', path.relative(repoRoot, dst), src.length, '->', out.length, 'bytes');
}
