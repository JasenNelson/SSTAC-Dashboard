'use client';

import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, FileText } from 'lucide-react';
import MathRenderer from './MathRenderer';
import ConceptualMatrix from './ConceptualMatrix';
import TWGReviewPortal from './TWGReviewPortal';
import DerivationSimulator from './DerivationSimulator';

interface MatrixDashboardProps {
  eqpCaseStudyContent: string;
  bsafCaseStudyContent: string;
  humanHealthContent: string;
  guideContent: string;
}

const TABS = ['The Guide', 'Conceptual Model', 'Jurisdictional Frameworks', 'Interactive Map', 'TWG Review', 'Calculator'];
const JURISDICTIONAL_SIDE_TABS = ['Ecological: EqP & AVS', 'Ecological: Food Web (BSAF)', 'Human Health Pathways'];

export default function MatrixDashboard({ eqpCaseStudyContent, bsafCaseStudyContent, humanHealthContent, guideContent }: MatrixDashboardProps) {
  const [activeTopTab, setActiveTopTab] = useState('The Guide');
  const [activeSideTab, setActiveSideTab] = useState('Ecological: EqP & AVS');
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);

  const renderSidebar = () => {
    switch (activeTopTab) {
      case 'Jurisdictional Frameworks':
        return (
          <ul className="space-y-2">
            {JURISDICTIONAL_SIDE_TABS.map((tab) => (
              <li
                key={tab}
                onClick={() => setActiveSideTab(tab)}
                className={`p-3 rounded-lg cursor-pointer font-medium transition-colors ${
                  activeSideTab === tab
                    ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 font-semibold text-sky-700 dark:text-sky-400'
                    : 'hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab}
              </li>
            ))}
          </ul>
        );
      case 'The Guide':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Welcome to the Matrix Options Dashboard. Please read the full guide in the main content area.</p>;
      case 'Conceptual Model':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Explore the scientific and regulatory pathways in the main content area.</p>;
      case 'Interactive Map':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Geospatial visualization of sediment sample sites.</p>;
      case 'TWG Review':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Workspace for formal evaluation and feedback. See the main content area.</p>;
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (activeTopTab) {
      case 'Jurisdictional Frameworks':
        let contentToRender = '';
        if (activeSideTab === 'Ecological: EqP & AVS') contentToRender = eqpCaseStudyContent;
        else if (activeSideTab === 'Ecological: Food Web (BSAF)') contentToRender = bsafCaseStudyContent;
        else if (activeSideTab === 'Human Health Pathways') contentToRender = humanHealthContent;

        return (
          <div className="space-y-6">
            <div className="bg-sky-50 dark:bg-sky-900/20 border-l-4 border-sky-500 p-4 rounded-r-lg">
              <p className="text-sm text-sky-800 dark:text-sky-200 font-medium">
                Currently reviewing the <span className="font-bold">{activeSideTab}</span> methodology. Scroll to locate specific jurisdictional derivations within the document below.
              </p>
            </div>
            <MathRenderer content={contentToRender} />
          </div>
        );
      case 'The Guide':
        return (
          <div className="space-y-6">
            <MathRenderer content={guideContent} />
          </div>
        );
      case 'Conceptual Model':
        return (
          <div className="w-full">
            <ConceptualMatrix />
          </div>
        );
      case 'TWG Review':
        return (
          <div className="w-full">
            <TWGReviewPortal />
          </div>
        );
      case 'Calculator':
        return (
          <div className="w-full">
            <DerivationSimulator />
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 pt-20">
            <svg className="w-16 h-16 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
              Content for <span className="text-slate-700 dark:text-slate-300 font-bold">{activeTopTab}</span> is currently under construction.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-[calc(100vh-4rem)] flex flex-col bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg relative">
      {/* Sub-header / Toolbar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200 dark:border-slate-700">
             <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
             <div><h1 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">Matrix Options</h1><p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Policy Review</p></div>
          </div>
          <nav className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTopTab(tab)}
                className={cn('relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap', activeTopTab === tab ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-600/50')}
              >
                <span>{tab}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1 ml-auto pl-4 border-l border-slate-200 dark:border-slate-700">
           <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={cn('p-2 rounded-lg transition-colors', showLeftPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showLeftPanel ? 'Hide left panel' : 'Show left panel'}>
             {showLeftPanel ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
           </button>
           <button onClick={() => setShowRightPanel(!showRightPanel)} className={cn('p-2 rounded-lg transition-colors', showRightPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showRightPanel ? 'Hide right panel' : 'Show right panel'}>
             {showRightPanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
           </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className={cn('transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800', showLeftPanel ? 'w-80 p-6' : 'w-0')}>
          <div className="w-full min-w-[270px]">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">JURISDICTION / REGION</h3>
            {renderSidebar()}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative overflow-y-auto bg-white dark:bg-slate-950 p-8">
          {renderContent()}
        </div>

        {/* Right Drawer (Smart Tray) */}
        <div className={cn('transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl', showRightPanel ? 'w-80' : 'w-0')}>
          <div className="w-[320px] h-full flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Quick Reference / Polls</span>
              </h3>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Live polling and reference material will dynamically appear here during active Technical Working Group (TWG) sessions.
              </p>
              
              <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/50 rounded-xl">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Active Poll: AVS/SEM Ratio</p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Which molar valency multiplier for silver do you support adopting for the unified matrix framework?</p>
                <div className="space-y-3">
                  <button className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all shadow-sm">
                    Support US EPA (0.5 Ag multiplier)
                  </button>
                  <button className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all shadow-sm">
                    Support ANZG (2.0 Ag multiplier)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
