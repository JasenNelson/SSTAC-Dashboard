// engine_v2 frontend Lane 2d / Phase A: Ask AI tab placeholder.
//
// Phase A ships ONLY the placeholder body. Phase D wires the actual
// two-mode chat. See plan section "Phase D" + TODO marker below for
// the wiring scope. The prop surface is the stable contract Phase D
// reaches into; do not extend without a plan amendment.
//
// ASCII only.

"use client";

import type { ReactElement } from "react";

export interface AskAiTabProps {
  evaluationId: string;
}

// TODO(phase-d): wire fast / thinking mode chat, model registry,
// SSE delta stream, retrieval over v2_submission_chunks +
// policy_kb.searchPolicies. See plan section "Phase D".
export function AskAiTab(_props: AskAiTabProps): ReactElement {
  return (
    <div
      data-testid="ask-ai-tab-placeholder"
      className="flex h-full items-center justify-center p-6 text-sm text-slate-600 dark:text-slate-300"
    >
      <p>Ask AI is coming in Phase D</p>
    </div>
  );
}

export default AskAiTab;
