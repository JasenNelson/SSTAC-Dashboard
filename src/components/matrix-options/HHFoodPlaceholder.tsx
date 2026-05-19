'use client';

// HHFoodPlaceholder -- non-functional disclaimer panel for the Human
// Health -- Food Web pathway. Same shape as HHDirectPlaceholder; only the
// Appendix pointer differs (Appendix B for Food Web; Appendix C for Direct
// Contact). PR-A2 ships this file unrendered; MatrixDashboard wires it on
// at PR-A4 after HITL sign-off on the disclaimer wording.
//
// Plan v3 section 2 + section 7.2.
//
// Plain ASCII only.

import React from 'react';

export default function HHFoodPlaceholder() {
  return (
    <section
      role="alert"
      aria-label="Human Health Food Web pathway placeholder"
      data-testid="hh-food-placeholder"
      className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 dark:border-amber-400 p-6 rounded-r-2xl shadow-sm"
    >
      <h3 className="text-base font-bold text-amber-900 dark:text-amber-100 tracking-tight">
        Not a calculator. Not a defensible standard. Not for decision use.
      </h3>
      <p className="text-sm text-amber-900 dark:text-amber-100 mt-3 leading-relaxed">
        The Human Health -- Food Web pathway calculator is planned for a
        future slice. In the interim, consult the canonical regulatory
        science:
      </p>
      <ul className="list-disc pl-5 mt-3 text-sm text-amber-900 dark:text-amber-100 space-y-2">
        <li>
          <span className="font-semibold">Health Canada</span>{' '}
          <em>
            Supplemental Guidance on Human Health Risk Assessment of
            Contaminated Sediments
          </em>{' '}
          (Jurisdictional Frameworks tab --&gt; Human Health Pathways).
        </li>
        <li>
          <span className="font-semibold">
            Phase 2 Options Paper -- TWG Review tab
          </span>{' '}
          --&gt; Appendix B.
        </li>
      </ul>
      <p className="text-xs text-amber-800 dark:text-amber-200 mt-4 italic">
        No numeric output is computed in this view.
      </p>
    </section>
  );
}
