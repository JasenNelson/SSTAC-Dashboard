import React from 'react';

export default function ConceptualMatrix() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Conceptual Model: 2x2 Matrix Framework</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
          A high-level visual architecture of the four primary sediment derivation pathways, establishing the foundation for structural policy review.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1">
          Phase 2 of the BC Sediment Standards Project (2026 scope).
        </p>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        role="list"
        aria-label="Four sediment derivation pathways arranged in a 2 by 2 matrix"
      >
        {/* Quadrant 1: Ecological - Direct Contact */}
        <div role="listitem" className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-800/50 rounded-xl">
              <svg className="w-6 h-6 text-emerald-700 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-300">Ecological: Direct Contact</h3>
          </div>
          <p className="text-sm text-emerald-800 dark:text-emerald-200/80 leading-relaxed">
            Protects benthic invertebrates dwelling within the sediment matrix. Primary methodologies include Equilibrium Partitioning (EqP) and Acid Volatile Sulfide (AVS) normalization.
          </p>
        </div>

        {/* Quadrant 2: Ecological - Food Web */}
        <div role="listitem" className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-teal-100 dark:bg-teal-800/50 rounded-xl">
              <svg className="w-6 h-6 text-teal-700 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-teal-900 dark:text-teal-300">Ecological: Food Web</h3>
          </div>
          <p className="text-sm text-teal-800 dark:text-teal-200/80 leading-relaxed">
            Protects higher trophic-level aquatic life and wildlife from bioaccumulative contaminants. Primary methodologies utilize Biota-Sediment Accumulation Factors (BSAF) and trophic transfer modeling.
          </p>
        </div>

        {/* Quadrant 3: Human Health - Direct Contact */}
        <div role="listitem" className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-sky-100 dark:bg-sky-800/50 rounded-xl">
              <svg className="w-6 h-6 text-sky-700 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-sky-900 dark:text-sky-300">Human Health: Direct Contact</h3>
          </div>
          <p className="text-sm text-sky-800 dark:text-sky-200/80 leading-relaxed">
            Protects humans from acute and chronic exposure via dermal absorption of wetted sediments and incidental ingestion during recreational or occupational activities.
          </p>
        </div>

        {/* Quadrant 4: Human Health - Food Web */}
        <div role="listitem" className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-800/50 rounded-xl">
              <svg className="w-6 h-6 text-indigo-700 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300">Human Health: Food Web</h3>
          </div>
          <p className="text-sm text-indigo-800 dark:text-indigo-200/80 leading-relaxed">
            Protects human populations reliant on aquatic environments for sustenance. Requires specialized modifiers for high-volume Indigenous traditional food consumption rates.
          </p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold">Where to go next:</span> Use <span className="font-semibold">Jurisdictional Frameworks</span> to compare how other regulatory programs approach each pathway, then test specific values in the <span className="font-semibold">Calculator</span>.
        </p>
      </div>
    </div>
  );
}
