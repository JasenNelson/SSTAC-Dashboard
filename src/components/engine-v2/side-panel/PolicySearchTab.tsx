// engine_v2 frontend Lane 2d / Phase A: Policy Search tab.
//
// Thin wrapper around the existing PolicySearchPanel component. Phase A
// relocates PolicySearchPanel from its previous mount on the
// project-detail page into the evaluation-page side panel's tertiary
// tab. The underlying L2d-1 API (/api/engine-v2/policies/search) is
// unchanged; only the mount site moves.
//
// PolicySearchPanel is mounted with its existing `projectId` prop and
// nothing else (codex pre-emption checklist: "no new prop surface
// introduced").
//
// ASCII only.

"use client";

import type { ReactElement } from "react";

import { PolicySearchPanel } from "@/components/engine-v2/PolicySearchPanel";

export interface PolicySearchTabProps {
  projectId: string;
}

export function PolicySearchTab({
  projectId,
}: PolicySearchTabProps): ReactElement {
  return (
    <div
      data-testid="policy-search-tab"
      className="h-full overflow-y-auto p-3"
    >
      <PolicySearchPanel projectId={projectId} />
    </div>
  );
}

export default PolicySearchTab;
