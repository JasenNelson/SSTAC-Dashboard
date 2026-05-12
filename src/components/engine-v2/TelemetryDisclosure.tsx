"use client";

// engine_v2 frontend: progressive-disclosure wrapper around TelemetrySidebar.
//
// Owner feedback: the telemetry/engineering details intimidate non-technical
// reviewers. By default we hide the sidebar and expose a small text toggle.
// Clicking the toggle reveals the full TelemetrySidebar below it.
//
// Constraints:
//   - ASCII only. No em dashes, smart quotes, or Unicode arrows.
//   - TypeScript strict.

import { useState } from "react";
import { TelemetrySidebar } from "./TelemetrySidebar";
import type { V2Evaluation } from "@/lib/engine-v2/types_lane2";

interface Props {
  evaluation: V2Evaluation;
}

export function TelemetryDisclosure({
  evaluation,
}: Props): React.ReactElement {
  const [show, setShow] = useState<boolean>(false);

  if (!show) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="telemetry-disclosure-show"
          onClick={() => setShow(true)}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
        >
          Show technical details
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="telemetry-disclosure-hide"
          onClick={() => setShow(false)}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
        >
          Hide technical details
        </button>
      </div>
      <TelemetrySidebar evaluation={evaluation} />
    </div>
  );
}
