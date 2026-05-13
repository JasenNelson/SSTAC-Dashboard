// engine_v2 frontend Lane 2d / Phase A: Submission Search tab placeholder.
//
// Phase A ships ONLY the placeholder body. Phase C wires tsvector
// submission search via Phase B's submission_search lib. See plan
// section "Phase C" + TODO marker below. The prop surface is the
// stable contract Phase C reaches into; do not extend without a plan
// amendment.
//
// ASCII only.

"use client";

import type { ReactElement } from "react";

export interface SubmissionSearchTabProps {
  evaluationId: string;
}

// TODO(phase-c): wire tsvector submission search via shared
// `submission_search.ts` lib + content-type badge.
export function SubmissionSearchTab(
  _props: SubmissionSearchTabProps,
): ReactElement {
  return (
    <div
      data-testid="submission-search-tab-placeholder"
      className="flex h-full items-center justify-center p-6 text-sm text-slate-600 dark:text-slate-300"
    >
      <p>Submission search is coming in Phase C</p>
    </div>
  );
}

export default SubmissionSearchTab;
