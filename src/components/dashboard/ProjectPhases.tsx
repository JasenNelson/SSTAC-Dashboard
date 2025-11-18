'use client';

import { useState } from 'react';

export default function ProjectPhases() {
  const [expandedWhitePaper, setExpandedWhitePaper] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
          <span className="text-2xl">📋</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Project Deliverables in Phase 1</h3>
          <div className="space-y-3">
            {/* SABCS White Paper - Expandable */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  1
                </span>
                <div className="flex-1">
                  <button 
                    onClick={() => setExpandedWhitePaper(!expandedWhitePaper)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedWhitePaper(!expandedWhitePaper);
                      }
                    }}
                    className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                    aria-expanded={expandedWhitePaper}
                    aria-label={`${expandedWhitePaper ? 'Collapse' : 'Expand'} SABCS White Paper details`}
                  >
                    <span>SABCS White Paper (&apos;High-Level Summary&apos;)</span>
                    <span className={`transform transition-transform ${expandedWhitePaper ? 'rotate-180' : ''}`} aria-hidden="true">
                      ▼
                    </span>
                  </button>
                  
                  {/* Expandable Sub-bullets */}
                  {expandedWhitePaper && (
                    <div className="mt-3 ml-6 space-y-2">
                      {[
                        'Preliminary Scientific Review',
                        'Jurisdictional Scan', 
                        'Interim Scientific Framework Development',
                        'Community Engagement (Survey & CEW Session)',
                        'Strategic Pathways & Options Analysis',
                        'Conclusions & Recommendations'
                      ].map((subItem, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-3 h-3 bg-blue-400 rounded-full mt-1.5"></span>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">{subItem}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Scoping Plan */}
            <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                2
              </span>
              <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">Scoping Plan and Roadmap for Future Work</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
