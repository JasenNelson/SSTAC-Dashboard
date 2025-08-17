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
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Project Deliverables in Phase 1</h3>
          <div className="space-y-3">
            {/* SABCS White Paper - Expandable */}
            <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  1
                </span>
                <div className="flex-1">
                  <button 
                    onClick={() => setExpandedWhitePaper(!expandedWhitePaper)}
                    className="flex items-center space-x-2 text-gray-700 text-sm font-medium hover:text-blue-600 transition-colors"
                  >
                    <span>SABCS White Paper ('High-Level Summary')</span>
                    <span className={`transform transition-transform ${expandedWhitePaper ? 'rotate-180' : ''}`}>
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
                        'Options Analysis',
                        'Prioritization Framework',
                        'Strategic Considerations',
                        'Recommendations for Future Research'
                      ].map((subItem, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="flex-shrink-0 w-3 h-3 bg-blue-400 rounded-full mt-1.5"></span>
                          <span className="text-gray-600 text-sm">{subItem}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Scoping Plan */}
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                2
              </span>
              <span className="text-gray-700 text-sm font-medium">Scoping Plan and Roadmap for Future Work</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
