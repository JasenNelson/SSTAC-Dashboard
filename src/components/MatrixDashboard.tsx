'use client';

import React, { useState } from 'react';
import MathRenderer from './MathRenderer';
import ConceptualMatrix from './ConceptualMatrix';
import TWGReviewPortal from './TWGReviewPortal';

interface MatrixDashboardProps {
  eqpCaseStudyContent: string;
  bsafCaseStudyContent: string;
  humanHealthContent: string;
  guideContent: string;
}

const TABS = ['The Guide', 'Conceptual Model', 'Jurisdictional Frameworks', 'Interactive Map', 'TWG Review'];
const JURISDICTIONAL_SIDE_TABS = ['Ecological: EqP & AVS', 'Ecological: Food Web (BSAF)', 'Human Health Pathways'];

export default function MatrixDashboard({ eqpCaseStudyContent, bsafCaseStudyContent, humanHealthContent, guideContent }: MatrixDashboardProps) {
  const [activeTopTab, setActiveTopTab] = useState('The Guide');
  const [activeSideTab, setActiveSideTab] = useState('Ecological: EqP & AVS');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
    <div className="w-full h-[750px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg relative">
      {/* Top Navigation */}
      <div className="flex bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTopTab(tab)}
            className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTopTab === tab
                ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-4 pl-4 border-l border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="px-4 py-2 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 rounded-lg text-sm font-bold hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors border border-sky-200 dark:border-sky-800 flex items-center space-x-2"
          >
            <span>{isDrawerOpen ? 'Close Tray' : 'Quick Reference / Polls'}</span>
            <svg className={`w-4 h-4 transition-transform ${isDrawerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 p-6 flex-shrink-0 overflow-y-auto z-0">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">JURISDICTION / REGION</h3>
          {renderSidebar()}
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white dark:bg-slate-950 p-8 overflow-y-auto max-w-none z-0">
          {renderContent()}
        </div>

        {/* Right Drawer (Smart Tray) */}
        <div 
          className={`absolute top-0 right-0 h-full w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out z-20 ${
            isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Quick Reference / Polls</span>
            </h3>
            <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5 overflow-y-auto h-[calc(100%-69px)]">
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
  );
}
