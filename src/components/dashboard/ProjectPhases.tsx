'use client';

import { useState } from 'react';

export default function ProjectPhases() {
  const [expandedWhitePaper, setExpandedWhitePaper] = useState(false);

  return (
    <div className="space-y-6">
      {/* Phase 2 (Active Focus) */}
      <div className="flex items-start space-x-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Phase 2: Foundational Research and Framework Development (2026-2027)</h3>
            {/* Leg-1 round-4 P2: white on bg-sky-600 is 4.09:1 and white on the
                former dark:bg-sky-500 is 2.77:1 -- both under the 4.5:1 AA floor
                for this 12px chip (bold text-xs does NOT qualify as WCAG "large
                text", which starts at 18.66px bold). Darkened to sky-700 in BOTH
                modes = 5.93:1. Kept white-on-saturated rather than flipping to
                dark-text-on-light-chip, because decision #17 chose Option A
                explicitly WITHOUT the colour inversion. */}
            <span className="inline-flex items-center rounded-full border-2 border-sky-800 bg-sky-700 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white dark:border-sky-500 dark:bg-sky-700">
              Active
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Currently active phase focusing on the Matrix Sediment Standards Derivation Options and BN-RRM implementation.
          </p>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-sky-200 dark:border-sky-700 shadow-sm">
              <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-sky-500" aria-hidden="true"></span>
              <span className="text-slate-700 dark:text-slate-200 text-sm font-medium mt-0.5">Matrix Sediment Standards Derivation Options Paper</span>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-sky-200 dark:border-sky-700 shadow-sm">
              <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-sky-500" aria-hidden="true"></span>
              <span className="text-slate-700 dark:text-slate-200 text-sm font-medium mt-0.5">BN-RRM Implementation</span>
            </div>
          </div>
        </div>
      </div>

      <div className="my-6 border-b border-slate-200 dark:border-slate-700"></div>

      {/* Phase 1 (Completed) */}
      <div className="flex items-start space-x-4 opacity-80 grayscale">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-400">Phase 1: Scientific Framework Development (Completed - 2025)</h3>
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-400">
              Complete
            </span>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500 font-medium mb-3 bg-amber-50 dark:bg-amber-900/20 inline-block px-2 py-1 rounded">
            The Project Deliverable (Conceptual White Paper) is complete and undergoing final review pending ENV feedback.
          </p>
          <div className="space-y-2">
            {/* SABCS White Paper - Expandable */}
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-slate-400" aria-hidden="true"></span>
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
              <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-slate-400" aria-hidden="true"></span>
              <span className="text-slate-500 dark:text-slate-400 text-sm">Scoping Plan and Roadmap for Future Work</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
