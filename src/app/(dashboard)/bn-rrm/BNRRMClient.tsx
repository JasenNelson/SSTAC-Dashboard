'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/utils/cn';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import { NodeInspector } from '@/components/bn-rrm/panels/NodeInspector';
import { ResultsPanel } from '@/components/bn-rrm/panels/ResultsPanel';
import { DataUploader } from '@/components/bn-rrm/data/DataUploader';
import { SiteDataTable } from '@/components/bn-rrm/data/SiteDataTable';
import { ExportPanel } from '@/components/bn-rrm/data/ExportPanel';
import { SiteDetails } from '@/components/bn-rrm/map/SiteDetails';
import { classifyRawSiteData, dagForwardInference } from '@/lib/bn-rrm/bn-inference';
import { createTrainedNetwork } from '@/lib/bn-rrm/trained-network';
import { Workflow, Network, Map, Database, PanelRightOpen, PanelRightClose, ChevronRight, Beaker, Thermometer, Activity, AlertTriangle, Upload, Table, Download, ClipboardCheck } from 'lucide-react';

const Canvas = dynamic(() => import('@/components/bn-rrm/canvas/Canvas').then((mod) => mod.Canvas), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="flex items-center gap-3 text-slate-400 dark:text-slate-500"><div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" /><span>Loading canvas...</span></div></div>,
});

const SiteMap = dynamic(() => import('@/components/bn-rrm/map/SiteMap').then((mod) => mod.SiteMap), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="flex items-center gap-3 text-slate-400 dark:text-slate-500"><div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" /><span>Loading map...</span></div></div>,
});

const CPTExplorer = dynamic(() => import('@/components/bn-rrm/cpt/CPTExplorer').then((mod) => mod.CPTExplorer), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="flex items-center gap-3 text-slate-400 dark:text-slate-500"><div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" /><span>Loading CPT explorer...</span></div></div>,
});

const ReviewView = dynamic(() => import('@/components/bn-rrm/review/ReviewView').then((mod) => mod.ReviewView), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="flex items-center gap-3 text-slate-400 dark:text-slate-500"><div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" /><span>Loading review...</span></div></div>,
});

type ViewTab = 'conceptual' | 'detailed' | 'cpt' | 'map' | 'data' | 'review';

const tabs: { id: ViewTab; label: string; icon: typeof Workflow; description: string }[] = [
  { id: 'conceptual', label: 'Conceptual', icon: Workflow, description: 'High-level causal framework' },
  { id: 'detailed', label: 'Detailed BN', icon: Network, description: 'Full Bayesian Network' },
  { id: 'cpt', label: 'CPT', icon: Table, description: 'Conditional Probability Tables' },
  { id: 'map', label: 'Map', icon: Map, description: 'Spatial data explorer' },
  { id: 'data', label: 'Data', icon: Database, description: 'Upload & export' },
  { id: 'review', label: 'Review', icon: ClipboardCheck, description: 'Peer review transparency' },
];

export default function BNRRMClient() {
  const [activeTab, setActiveTab] = useState<ViewTab>('detailed');
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const sites = useSiteDataStore((state) => state.sites);
  const selectSite = useSiteDataStore((state) => state.selectSite);
  const addAssessment = useSiteDataStore((state) => state.addAssessment);

  const loadTrainedModel = useNetworkStore((state) => state.loadTrainedModel);
  const model = useNetworkStore((state) => state.model);
  const siteCount = Object.keys(sites).length;

  useEffect(() => {
    loadTrainedModel();
  }, [loadTrainedModel]);

  const handleViewOnMap = useCallback((siteId: string) => {
    selectSite(siteId);
    setActiveTab('map');
  }, [selectSite]);

  // Run causal BN-RRM assessment for a site
  const handleRunAssessment = useCallback((siteId: string) => {
    const site = sites[siteId];
    if (!site) return;

    // Classify raw site data into evidence for causal DAG nodes
    const bnEvidence = classifyRawSiteData(site);

    // Run forward inference through the causal chain
    const networkModel = model ?? createTrainedNetwork();
    const result = dagForwardInference(networkModel, bnEvidence);

    // Find the impact node
    const impactNode = networkModel.nodes.find(n => n.category === 'impact');
    const impactNodeId = impactNode?.id ?? 'ecological_risk';
    const riskBeliefs = result.beliefs[impactNodeId] ?? { low: 0.33, moderate: 0.33, high: 0.33 };

    // Map 3-class ecological risk to 4-class impact probabilities
    const lowProb = riskBeliefs.low ?? riskBeliefs.Low ?? 0;
    const modProb = riskBeliefs.moderate ?? riskBeliefs.Moderate ?? 0;
    const highProb = riskBeliefs.high ?? riskBeliefs.High ?? 0;

    const impactProbabilities = {
      none: lowProb * 0.7,
      minor: lowProb * 0.3 + modProb * 0.3,
      moderate: modProb * 0.7,
      severe: highProb,
    };

    // Normalize
    const total = impactProbabilities.none + impactProbabilities.minor + impactProbabilities.moderate + impactProbabilities.severe;
    if (total > 0) {
      impactProbabilities.none /= total;
      impactProbabilities.minor /= total;
      impactProbabilities.moderate /= total;
      impactProbabilities.severe /= total;
    }

    // Find most likely
    let mostLikelyImpact: 'none' | 'minor' | 'moderate' | 'severe' = 'none';
    const maxProb = Math.max(impactProbabilities.none, impactProbabilities.minor, impactProbabilities.moderate, impactProbabilities.severe);
    if (maxProb === impactProbabilities.severe) mostLikelyImpact = 'severe';
    else if (maxProb === impactProbabilities.moderate) mostLikelyImpact = 'moderate';
    else if (maxProb === impactProbabilities.minor) mostLikelyImpact = 'minor';

    // Identify key contaminants from chemistry data
    const keyContaminants: string[] = [];
    const avgChem = site.sedimentChemistry[0];
    if (avgChem) {
      if ((avgChem.copper ?? 0) > 18.7) keyContaminants.push('Copper');
      if ((avgChem.zinc ?? 0) > 124) keyContaminants.push('Zinc');
      if ((avgChem.lead ?? 0) > 30.2) keyContaminants.push('Lead');
      if ((avgChem.cadmium ?? 0) > 0.7) keyContaminants.push('Cadmium');
      if ((avgChem.mercury ?? 0) > 0.13) keyContaminants.push('Mercury');
      if ((avgChem.arsenic ?? 0) > 7.24) keyContaminants.push('Arsenic');
      if ((avgChem.chromium ?? 0) > 52.3) keyContaminants.push('Chromium');
      if ((avgChem.totalPAHs ?? 0) > 1684) keyContaminants.push('PAHs');
    }

    // Identify key modifying conditions
    const keyModifiers: string[] = [];
    if (avgChem) {
      if (avgChem.toc !== undefined && avgChem.toc < 1) keyModifiers.push('Low TOC');
      if (avgChem.percentFines !== undefined && avgChem.percentFines > 60) keyModifiers.push('Fine sediment');
    }

    addAssessment({
      siteId,
      siteName: site.location.name,
      assessmentDate: new Date().toISOString(),
      chemistryDataPoints: site.sedimentChemistry.length,
      toxicityTests: site.toxicityTests?.length ?? 0,
      benthicSamples: site.benthicCommunity?.length ?? 0,
      impactProbabilities,
      mostLikelyImpact,
      confidence: 0.75, // Expert-elicited model — moderate confidence
      keyContaminants,
      keyModifiers,
    });

    // Build evidence summary for alert
    const evidenceKeys = Object.entries(bnEvidence)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    alert(
      `BN-RRM Causal Assessment for ${site.location.name}\n\n` +
      `Ecological Risk: Low=${(lowProb*100).toFixed(0)}%, Moderate=${(modProb*100).toFixed(0)}%, High=${(highProb*100).toFixed(0)}%\n\n` +
      `Evidence set:\n${evidenceKeys}\n\n` +
      `Key contaminants: ${keyContaminants.join(', ') || 'None above ISQG'}`
    );
  }, [sites, addAssessment, model]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-100 dark:bg-slate-900 bn-rrm-wrapper">
      {/* Sub-header with tab navigation */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm">
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
              <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={cn('p-2 rounded-lg transition-colors', showLeftPanel ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showLeftPanel ? 'Hide panel' : 'Show panel'}><PanelRightClose className="w-5 h-5 scale-x-[-1]" /></button>
              <button onClick={() => setShowRightPanel(!showRightPanel)} className={cn('p-2 rounded-lg transition-colors', showRightPanel ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showRightPanel ? 'Hide panel' : 'Show panel'}><PanelRightOpen className="w-5 h-5" /></button>
            </>
          )}
          <div className="text-xs text-slate-400 dark:text-slate-500 ml-2">
            BN-RRM Causal Model — {model?.nodes.length ?? 20} nodes
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex">
        {activeTab === 'conceptual' && <ConceptualView />}
        {activeTab === 'detailed' && <DetailedView showLeftPanel={showLeftPanel} showRightPanel={showRightPanel} onCloseLeftPanel={() => setShowLeftPanel(false)} />}
        {activeTab === 'cpt' && <CPTExplorer />}
        {activeTab === 'map' && <MapView showLeftPanel={showLeftPanel} showRightPanel={showRightPanel} onRunAssessment={handleRunAssessment} />}
        {activeTab === 'data' && <DataView onViewOnMap={handleViewOnMap} onRunAssessment={handleRunAssessment} />}
        {activeTab === 'review' && <ReviewView />}
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

function MapView({ showLeftPanel, showRightPanel, onRunAssessment }: { showLeftPanel: boolean; showRightPanel: boolean; onRunAssessment: (siteId: string) => void }) {
  const selectSite = useSiteDataStore((state) => state.selectSite);
  return (
    <div className="flex-1 flex overflow-hidden">
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden', showLeftPanel ? 'w-80' : 'w-0')}><SiteDetails className="h-full w-80" onRunAssessment={onRunAssessment} /></div>
      <div className="flex-1 relative"><SiteMap onSiteSelect={(id) => selectSite(id)} /></div>
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden', showRightPanel ? 'w-80' : 'w-0')}><ResultsPanel className="h-full w-80" /></div>
    </div>
  );
}

function DataView({ onViewOnMap, onRunAssessment }: { onViewOnMap: (siteId: string) => void; onRunAssessment: (siteId: string) => void }) {
  const [activeSection, setActiveSection] = useState<'upload' | 'sites' | 'export'>('upload');
  const sites = useSiteDataStore((state) => state.sites);
  const siteCount = Object.keys(sites).length;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Data Management</h3>
        <nav className="space-y-1">
          <NavButton icon={Upload} label="Upload Data" active={activeSection === 'upload'} onClick={() => setActiveSection('upload')} />
          <NavButton icon={Table} label="Site Data" active={activeSection === 'sites'} onClick={() => setActiveSection('sites')} badge={siteCount > 0 ? siteCount.toString() : undefined} />
          <NavButton icon={Download} label="Export" active={activeSection === 'export'} onClick={() => setActiveSection('export')} />
        </nav>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {activeSection === 'upload' && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Upload Site Data</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Import sediment chemistry, toxicity, and benthic community data from CSV, Excel, or JSON files.</p>
              <DataUploader />
            </div>
          )}
          {activeSection === 'sites' && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Loaded Sites</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">View and manage uploaded site data. Click a site to expand and see sample details.</p>
              <SiteDataTable onRunAssessment={onRunAssessment} onViewOnMap={onViewOnMap} />
            </div>
          )}
          {activeSection === 'export' && (
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Export Data</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Download site data and assessment results in various formats.</p>
              <ExportPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick, badge }: { icon: typeof Upload; label: string; active: boolean; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick} className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors', active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700')}>
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-xs rounded">{badge}</span>}
    </button>
  );
}

function ConceptualView() {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8"><h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Benthic Risk Conceptual Model</h2><p className="text-slate-500 dark:text-slate-400 mt-2">Causal pathway from contamination to ecological impact (Landis 2021)</p></div>
        <div className="flex items-stretch justify-center gap-4 mb-8">
          <ConceptualBox title="Substance" description="Contaminant presence in environmental media" icon={Beaker} color="blue" items={['Metals (Cu, Zn, Pb, Cd, Hg, As, Cr)', 'PAHs (16 priority compounds)', 'PCBs']} />
          <Arrow />
          <ConceptualBox title="Conditions" description="Factors modifying bioavailability and exposure" icon={Thermometer} color="violet" items={['TOC (organic carbon binding)', 'AVS (sulfide binding capacity)', 'Grain size (habitat structure)']} />
          <Arrow />
          <ConceptualBox title="Effect" description="Biological responses through causal pathways" icon={Activity} color="amber" items={['Metal/organic bioavailability', 'Amphipod toxicity', 'Community diversity & richness']} />
          <Arrow />
          <ConceptualBox title="Risk" description="Integrated ecological risk from causal chain" icon={AlertTriangle} color="red" items={['Low — Reference-like', 'Moderate — Some concern', 'High — Significant impact']} />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-12">
          <FeatureCard title="Forward Inference" description="Set contaminant concentrations and site conditions — risk propagates through causal pathways." icon="&#8594;" />
          <FeatureCard title="Backward Inference" description="Set target protection level — derive site-specific protective concentrations through causal chain." icon="&#8592;" />
          <FeatureCard title="Sensitivity Analysis" description="Identify which contaminants and conditions most influence the risk outcome." icon="&#9889;" />
        </div>
        <div className="text-center mt-8"><p className="text-sm text-slate-500 dark:text-slate-400">Click the <strong>Detailed BN</strong> tab to explore the full causal network</p></div>
      </div>
    </div>
  );
}

function ConceptualBox({ title, description, icon: Icon, color, items }: { title: string; description: string; icon: typeof Beaker; color: 'blue' | 'violet' | 'amber' | 'red'; items: string[] }) {
  const colors = { blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700', header: 'bg-blue-500', text: 'text-blue-800 dark:text-blue-200', icon: 'text-blue-600 dark:text-blue-400' }, violet: { bg: 'bg-violet-50 dark:bg-violet-900/30', border: 'border-violet-200 dark:border-violet-700', header: 'bg-violet-500', text: 'text-violet-800 dark:text-violet-200', icon: 'text-violet-600 dark:text-violet-400' }, amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-700', header: 'bg-amber-500', text: 'text-amber-800 dark:text-amber-200', icon: 'text-amber-600 dark:text-amber-400' }, red: { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-700', header: 'bg-red-500', text: 'text-red-800 dark:text-red-200', icon: 'text-red-600 dark:text-red-400' } };
  const c = colors[color];
  return (
    <div className={cn('rounded-xl border-2 overflow-hidden w-52 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]', c.bg, c.border)}>
      <div className={cn('px-4 py-3 flex items-center gap-2', c.header)}><Icon className="w-5 h-5 text-white" /><h3 className="font-bold text-white">{title}</h3></div>
      <div className="p-4"><p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{description}</p><ul className="space-y-1.5">{items.map((item, idx) => <li key={idx} className="flex items-start gap-2 text-xs"><ChevronRight className={cn('w-3 h-3 mt-0.5 shrink-0', c.icon)} /><span className={c.text}>{item}</span></li>)}</ul></div>
    </div>
  );
}

function Arrow() {
  return <div className="flex items-center self-center"><div className="w-8 h-0.5 bg-gradient-to-r from-slate-300 to-slate-400" /><div className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[10px] border-transparent border-l-slate-400" /></div>;
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow"><div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-xl mb-3" dangerouslySetInnerHTML={{ __html: icon }} /><h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{title}</h4><p className="text-sm text-slate-500 dark:text-slate-400">{description}</p></div>;
}
