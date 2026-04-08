'use client';

import { useState } from 'react';

export default function ProjectPhases() {
  const [expandedWhitePaper, setExpandedWhitePaper] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
          <span className="text-2xl">📋</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Project Deliverables in Phase 1</h3>
          <div className="space-y-3">
            {/* SABCS White Paper - Expandable */}
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-sky-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  1
                </span>
                <div className="flex-1">
                  <button 
                    onClick={() => setExpandedWhitePaper(!expandedWhitePaper)}
                    aria-expanded={expandedWhitePaper}
                    aria-controls="white-paper-details"
                    className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 text-sm font-medium hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                  >
                    <span>SABCS White Paper (&apos;High-Level Summary&apos;)</span>
                    <span className={`transform transition-transform ${expandedWhitePaper ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  {/* Expandable Sub-bullets */}
                  {expandedWhitePaper && (
                    <div id="white-paper-details" className="mt-3 ml-6 space-y-2">
                      {[
                        'Preliminary Scientific Review',
                        'Jurisdictional Scan', 
                        'Interim Scientific Framework Development',
                        'Community Engagement (Survey & CEW Session)',
                        'Strategic Pathways & Options Analysis',
                        'Conclusions & Recommendations'
                      ].map((subItem, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-3 h-3 bg-sky-400 rounded-full mt-1.5"></span>
                          <span className="text-slate-500 dark:text-slate-400 text-sm">{subItem}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Scoping Plan */}
            <div className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
              <span className="flex-shrink-0 w-6 h-6 bg-sky-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                2
              </span>
              <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">Scoping Plan and Roadmap for Future Work</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
