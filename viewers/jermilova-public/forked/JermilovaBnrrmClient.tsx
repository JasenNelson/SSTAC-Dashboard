'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/utils/cn';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { isReadOnlyPack } from '@/lib/bn-rrm/pack-types';
import { useAutoLoadPackSites } from '@/hooks/bn-rrm/useAutoLoadPackSites';
import { PackBanner } from '@/components/bn-rrm/shared/PackBanner';
import { NodeInspector } from '@/components/bn-rrm/panels/NodeInspector';
import { ResultsPanel } from './ResultsPanel';
import { BenchmarkDataViewer } from '@/components/bn-rrm/data/BenchmarkDataViewer';
import { SiteDetails } from './SiteDetails';
import { Workflow, Network, Map, Database, PanelRightOpen, PanelRightClose, ChevronRight, Beaker, Thermometer, Activity, AlertTriangle, Table, BookOpen } from 'lucide-react';

const Canvas = dynamic(() => import('./Canvas').then((mod) => mod.Canvas), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="flex items-center gap-3 text-slate-400 dark:text-slate-500"><div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" /><span>Loading canvas...</span></div></div>,
});

const SiteMap = dynamic(() => import('./SiteMap').then((mod) => mod.SiteMap), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="flex items-center gap-3 text-slate-400 dark:text-slate-500"><div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" /><span>Loading map...</span></div></div>,
});

const CPTExplorer = dynamic(() => import('@/components/bn-rrm/cpt/CPTExplorer').then((mod) => mod.CPTExplorer), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="flex items-center gap-3 text-slate-400 dark:text-slate-500"><div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" /><span>Loading CPT explorer...</span></div></div>,
});

const GettingStartedView = dynamic(() => import('@/components/bn-rrm/getting-started/GettingStartedView').then((mod) => mod.GettingStartedView), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="flex items-center gap-3 text-slate-400 dark:text-slate-500"><div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" /><span>Loading guide...</span></div></div>,
});

type ViewTab = 'gettingstarted' | 'conceptual' | 'detailed' | 'cpt' | 'map' | 'data';

const tabs: { id: ViewTab; label: string; icon: typeof Workflow; description: string }[] = [
  { id: 'gettingstarted', label: 'Guide', icon: BookOpen, description: 'Getting started' },
  { id: 'conceptual', label: 'Conceptual', icon: Workflow, description: 'High-level causal framework' },
  { id: 'detailed', label: 'Detailed BN', icon: Network, description: 'Full Bayesian Network' },
  { id: 'cpt', label: 'CPT', icon: Table, description: 'Conditional Probability Tables' },
  { id: 'map', label: 'Map', icon: Map, description: 'Spatial data explorer' },
  { id: 'data', label: 'Data', icon: Database, description: 'Upload & export' },
];

export default function BNRRMClient() {
  const [activeTab, setActiveTab] = useState<ViewTab>('detailed');
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const sites = useSiteDataStore((state) => state.sites);

  const loadPackModel = useNetworkStore((state) => state.loadPackModel);
  const model = useNetworkStore((state) => state.model);
  const siteCount = Object.keys(sites).length;

  // Pack store
  const selectedPackId = usePackStore((state) => state.selectedPackId);
  const loadRegistry = usePackStore((state) => state.loadRegistry);
  const registryLoaded = usePackStore((state) => state.registryLoaded);
  const registryError = usePackStore((state) => state.registryError);
  const packManifest = usePackStore((state) => state.packManifest);
  const packBaseUrl = usePackStore((state) => state.getPackBaseUrl());
  const packLoading = usePackStore((state) => state.packLoading);
  const packError = usePackStore((state) => state.packError);
  // Determine read-only from registry entry (instant) OR manifest (after load).
  // During pack switching, packManifest may briefly be stale (old pack's manifest),
  // so checking the registry entry for the selectedPackId avoids a flash of the
  // upload UI before the new manifest arrives.
  const registryEntry = usePackStore((state) =>
    state.registry?.packs.find(p => p.pack_id === state.selectedPackId)
  );
  const isReadOnly = registryEntry?.scope_type === 'benchmark'
    || (packManifest ? isReadOnlyPack(packManifest) : false);

  // Initialize: load pack registry on mount
  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  // When pack is selected and manifest loaded, load the runtime model.
  // Guard: only load if the manifest belongs to the currently selected pack.
  // During pack switching, selectedPackId updates immediately but packManifest
  // may still be from the previous pack until the new manifest fetch completes.
  useEffect(() => {
    if (packManifest && packBaseUrl && selectedPackId && packManifest.pack_id === selectedPackId) {
      loadPackModel(packBaseUrl, packManifest);
    }
  }, [packManifest, packBaseUrl, selectedPackId, registryLoaded, packLoading, loadPackModel]);

  // Auto-load pack reference sites (training/comparison) on pack switch.
  // Race-safe, tag-scoped, preserves user-uploaded sites. See
  // useAutoLoadPackSites for the full contract.
  useAutoLoadPackSites();

  // Benchmark packs now show BenchmarkDataViewer in the Data tab (read-only).
  // No redirect needed.

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-900 bn-rrm-wrapper print:h-auto print:block print:bg-white">
      {/* Sub-header with tab navigation. print:hidden so the PDF output
          of the TWG Review tier doesn't include the BN-RRM tab strip. */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25"><Network className="w-5 h-5 text-white" /></div>
            <div><h1 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">BN-RRM</h1><p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Benthic Risk Assessment</p></div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <nav className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const showBadge = tab.id === 'data' && siteCount > 0;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200', isActive ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-600/50')} title={tab.description}>
                  <Icon className="w-4 h-4" /><span className="hidden md:inline">{tab.label}</span>
                  {showBadge && <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{siteCount}</span>}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          {(activeTab === 'detailed' || activeTab === 'map') && (
            <>
              <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={cn('p-2 rounded-lg transition-colors', showLeftPanel ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showLeftPanel ? 'Hide left panel' : 'Show left panel'} aria-label={showLeftPanel ? 'Hide left panel' : 'Show left panel'}><PanelRightClose className="w-5 h-5 scale-x-[-1]" /></button>
              <button onClick={() => setShowRightPanel(!showRightPanel)} className={cn('p-2 rounded-lg transition-colors', showRightPanel ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showRightPanel ? 'Hide right panel' : 'Show right panel'} aria-label={showRightPanel ? 'Hide right panel' : 'Show right panel'}><PanelRightOpen className="w-5 h-5" /></button>
            </>
          )}
          <div className="text-xs text-slate-400 dark:text-slate-500 ml-2">
            {model?.nodes.length ?? 20} nodes
          </div>
        </div>
      </div>

      <PackBanner />

      {/* Pack system error banner. print:hidden -- error chrome is not
          document content (codex R5 P2). */}
      {(registryError || packError) && (
        <div className="px-4 py-1.5 flex items-center gap-2 text-xs font-medium shrink-0 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800 print:hidden">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{registryError ? `Pack registry error: ${registryError}` : `Pack error: ${packError}`}</span>
        </div>
      )}

      <main className="flex-1 overflow-hidden flex print:overflow-visible print:h-auto print:block">
        {activeTab === 'gettingstarted' && <GettingStartedView />}
        {activeTab === 'conceptual' && <ConceptualView key={selectedPackId ?? 'default'} />}
        {activeTab === 'detailed' && <DetailedView key={selectedPackId ?? 'default'} showLeftPanel={showLeftPanel} showRightPanel={showRightPanel} onCloseLeftPanel={() => setShowLeftPanel(false)} />}
        {activeTab === 'cpt' && <CPTExplorer key={selectedPackId ?? 'default'} />}
        {activeTab === 'map' && <MapView showLeftPanel={showLeftPanel} showRightPanel={showRightPanel} />}
        {activeTab === 'data' && <DataView isReadOnly={isReadOnly} />}
      </main>
    </div>
  );
}

function DetailedView({ showLeftPanel, showRightPanel, onCloseLeftPanel }: { showLeftPanel: boolean; showRightPanel: boolean; onCloseLeftPanel: () => void }) {
  return (
    <div className="flex-1 flex overflow-hidden">
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden', showLeftPanel ? 'w-80' : 'w-0')}><NodeInspector className="h-full w-80" onClose={onCloseLeftPanel} /></div>
      <div className="flex-1 relative"><Canvas showMinimap showControls /></div>
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden', showRightPanel ? 'w-80' : 'w-0')}><ResultsPanel className="h-full w-80" /></div>
    </div>
  );
}

function MapView({ showLeftPanel, showRightPanel }: { showLeftPanel: boolean; showRightPanel: boolean }) {
  const selectSite = useSiteDataStore((state) => state.selectSite);
  return (
    <div className="flex-1 flex overflow-hidden">
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden', showLeftPanel ? 'w-80' : 'w-0')}><SiteDetails className="h-full w-80" /></div>
      <div className="flex-1 relative"><SiteMap onSiteSelect={(id) => selectSite(id)} /></div>
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden', showRightPanel ? 'w-80' : 'w-0')}><ResultsPanel className="h-full w-80" /></div>
    </div>
  );
}

function DataView({ isReadOnly }: { isReadOnly?: boolean }) {
  if (isReadOnly) {
    return <BenchmarkDataViewer />;
  }

  return null;
}

function ConceptualView() {
  const model = useNetworkStore((state) => state.model);
  const manifest = usePackStore((state) => state.packManifest);
  const isGeneric = manifest?.runtime_schema_version === 'generic-bn-rrm-v1';

  // For generic packs, build conceptual boxes from model data
  if (isGeneric && model) {
    const colorOrder: ('blue' | 'violet' | 'amber' | 'red')[] = ['blue', 'violet', 'amber', 'red'];
    const iconOrder = [Beaker, Thermometer, Activity, AlertTriangle];
    const nodeMap = new globalThis.Map(model.nodes.map(n => [n.id, n] as const));
    const containerMap = new globalThis.Map(model.containers.map(c => [c.id, c] as const));

    // If model defines conceptualTiers, group containers into high-level boxes.
    // Otherwise fall back to one box per container.
    const boxes = model.conceptualTiers
      ? model.conceptualTiers.map((tier, i) => {
          const items = tier.containerIds.flatMap(cid => {
            const c = containerMap.get(cid);
            return c ? c.childNodeIds.map(nid => nodeMap.get(nid)?.label ?? nid) : [];
          }).slice(0, 8);
          return {
            title: tier.label,
            description: tier.description,
            icon: iconOrder[i % iconOrder.length],
            color: colorOrder[i % colorOrder.length],
            items,
          };
        })
      : model.containers.map((container, i) => {
          const items = container.childNodeIds
            .map(id => nodeMap.get(id)?.label ?? id)
            .slice(0, 8);
          return {
            title: container.label,
            description: `${items.length} node${items.length !== 1 ? 's' : ''}`,
            icon: iconOrder[i % iconOrder.length],
            color: colorOrder[i % colorOrder.length],
            items,
          };
        });

    return (
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{model.name}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">{model.description ?? 'Causal pathway conceptual model'}</p>
          </div>
          <div className="flex items-stretch justify-center gap-4 mb-8">
            {boxes.map((box, i) => (
              <div key={box.title} className="flex items-stretch gap-4 min-w-0">
                {i > 0 && <Arrow />}
                <ConceptualBox {...box} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-12">
            <FeatureCard title="Forward Inference" description="Set node states and observe how risk propagates through causal pathways." icon="→" />
            <FeatureCard title="Backward Inference" description="Set target protection level and derive protective concentrations through causal chain." icon="←" />
            <FeatureCard title="Sensitivity Analysis" description="Identify which nodes most influence the risk outcome." icon="⚡" />
          </div>
          <div className="text-center mt-8"><p className="text-sm text-slate-500 dark:text-slate-400">Click the <strong>Detailed BN</strong> tab to explore the full causal network</p></div>
        </div>
      </div>
    );
  }

  // Default: hardcoded benthic sediment conceptual model
  return null;
}

function ConceptualBox({ title, description, icon: Icon, color, items }: { title: string; description: string; icon: typeof Beaker; color: 'blue' | 'violet' | 'amber' | 'red'; items: string[] }) {
  const colors = { blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700', header: 'bg-blue-500', text: 'text-blue-800 dark:text-blue-200', icon: 'text-blue-600 dark:text-blue-400' }, violet: { bg: 'bg-violet-50 dark:bg-violet-900/30', border: 'border-violet-200 dark:border-violet-700', header: 'bg-violet-500', text: 'text-violet-800 dark:text-violet-200', icon: 'text-violet-600 dark:text-violet-400' }, amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-700', header: 'bg-amber-500', text: 'text-amber-800 dark:text-amber-200', icon: 'text-amber-600 dark:text-amber-400' }, red: { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-700', header: 'bg-red-500', text: 'text-red-800 dark:text-red-200', icon: 'text-red-600 dark:text-red-400' } };
  const c = colors[color];
  return (
    <div className={cn('rounded-xl border-2 overflow-hidden w-52 min-w-0 shrink transition-all duration-200 hover:shadow-lg hover:scale-[1.02]', c.bg, c.border)}>
      <div className={cn('px-4 py-3 flex items-center gap-2', c.header)}><Icon className="w-5 h-5 text-white" /><h3 className="font-bold text-white">{title}</h3></div>
      <div className="p-4"><p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{description}</p><ul className="space-y-1.5">{items.map((item, idx) => <li key={idx} className="flex items-start gap-2 text-xs"><ChevronRight className={cn('w-3 h-3 mt-0.5 shrink-0', c.icon)} /><span className={c.text}>{item}</span></li>)}</ul></div>
    </div>
  );
}

function Arrow() {
  return <div className="flex items-center self-center"><div className="w-8 h-0.5 bg-gradient-to-r from-slate-300 to-slate-400" /><div className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[10px] border-transparent border-l-slate-400" /></div>;
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow"><div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-xl mb-3">{icon}</div><h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{title}</h4><p className="text-sm text-slate-500 dark:text-slate-400">{description}</p></div>;
}
