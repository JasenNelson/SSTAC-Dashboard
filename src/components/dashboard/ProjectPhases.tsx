'use client';

import { useState } from 'react';

export default function ProjectPhases() {
  const [expandedWhitePaper, setExpandedWhitePaper] = useState(false);

  return (
    <div className="space-y-6">
      {/* Phase 2 (Active Focus) */}
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-12 h-12 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center border-2 border-sky-500">
          <span className="text-2xl">🚀</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-sky-700 dark:text-sky-400 mb-2">Phase 2: Foundational Research (2026)</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Currently active phase focusing on the Matrix Sediment Standards Derivation Options and BN-RRM implementation.
          </p>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-sky-200 dark:border-sky-700 shadow-sm">
              <span className="flex-shrink-0 w-6 h-6 bg-sky-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                1
              </span>
              <span className="text-slate-700 dark:text-slate-200 text-sm font-medium mt-0.5">Matrix Sediment Standards Derivation Options Paper</span>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-sky-200 dark:border-sky-700 shadow-sm">
              <span className="flex-shrink-0 w-6 h-6 bg-sky-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                2
              </span>
              <span className="text-slate-700 dark:text-slate-200 text-sm font-medium mt-0.5">BN-RRM Implementation</span>
            </div>
          </div>
        </div>
      </div>

      <div className="my-6 border-b border-slate-200 dark:border-slate-700"></div>

      {/* Phase 1 (Completed) */}
      <div className="flex items-start space-x-4 opacity-80">
        <div className="flex-shrink-0 w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center grayscale">
          <span className="text-xl">✅</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-400 mb-1">Phase 1: Scientific Framework Development (Completed - 2025)</h3>
          <p className="text-xs text-amber-600 dark:text-amber-500 font-medium mb-3 bg-amber-50 dark:bg-amber-900/20 inline-block px-2 py-1 rounded">
            The Project Deliverable (Conceptual White Paper) is complete and undergoing final review pending ENV feedback.
          </p>
          <div className="space-y-2">
            {/* SABCS White Paper - Expandable */}
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-5 h-5 bg-slate-400 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  1
                </span>
                <div className="flex-1">
                  <button
                    onClick={() => setExpandedWhitePaper(!expandedWhitePaper)}
                    aria-expanded={expandedWhitePaper}
                    aria-controls="white-paper-details"
                    className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 text-sm hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    <span>SABCS White Paper (&apos;High-Level Summary&apos;)</span>
                    <span className={`transform transition-transform text-xs ${expandedWhitePaper ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  {/* Expandable Sub-bullets */}
                  {expandedWhitePaper && (
                    <div id="white-paper-details" className="mt-2 ml-5 space-y-1">
                      {[
                        'Preliminary Scientific Review',
                        'Jurisdictional Scan', 
                        'Interim Scientific Framework Development',
                        'Community Engagement (Survey & CEW Session)',
                        'Strategic Pathways & Options Analysis',
                        'Conclusions & Recommendations'
                      ].map((subItem, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-2 h-2 bg-slate-300 rounded-full mt-1.5"></span>
                          <span className="text-slate-400 dark:text-slate-500 text-xs">{subItem}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Scoping Plan */}
            <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="flex-shrink-0 w-5 h-5 bg-slate-400 text-white text-xs font-bold rounded-full flex items-center justify-center">
                2
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-sm">Scoping Plan and Roadmap for Future Work</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
