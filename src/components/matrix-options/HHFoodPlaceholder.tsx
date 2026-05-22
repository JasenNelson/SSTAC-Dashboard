'use client';

// HHFoodPlaceholder -- non-functional disclaimer panel for the Human
// Health -- Food Web pathway. Same shape as HHDirectPlaceholder; only the
// Appendix pointer differs (Appendix B for Food Web; Appendix C for Direct
// Contact). The category is intentionally visible, but numeric output
// remains blocked until methodology sign-off.
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
        Human Health Food Web is under methodology review.
      </h3>
      <p className="text-sm text-amber-900 dark:text-amber-100 mt-3 leading-relaxed">
        This pathway is available in the category selector so reviewers can
        see the intended Matrix shape, but it does not calculate a value yet.
        Consumption assumptions, trophic transfer factors, and endpoint
        mapping still require HITL sign-off before this panel can produce a
        defensible screening number.
      </p>
      <p className="text-sm text-amber-900 dark:text-amber-100 mt-3 leading-relaxed">
        For current review, use the canonical regulatory science:
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
