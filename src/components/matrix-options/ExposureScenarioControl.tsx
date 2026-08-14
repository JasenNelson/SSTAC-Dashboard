'use client';

// ExposureScenarioControl -- the left-rail "Exposure scenario" control
// (PRODUCT.md "Exposure Scenarios" + DESIGN.md "Exposure scenario is a
// first-class control, and it carries provenance").
//
// This step (calculator redesign step 3 of 4) ships CUSTOM ONLY: Protocol
// 28 preset scenarios differ by receptor type and media type and must be
// sourced from Protocol 28 and verified before they can appear here.
// Inventing a plausible preset, or a dropdown of plausible-sounding
// scenario names, is exactly what DESIGN.md "Never fabricate" forbids.
// Presets are a later, separately-scoped step.
//
// The control must read as "not available yet", not as empty or broken --
// so it renders as a real, operable <select> with its one true option
// (Custom) plus an explicit note explaining why presets are absent.
//
// Plain ASCII only.

import React from 'react';
import { cn } from '@/utils/cn';

export interface ExposureScenarioControlProps {
  className?: string;
}

export default function ExposureScenarioControl({
  className,
}: ExposureScenarioControlProps) {
  return (
    <div className={cn('mb-4', className)} data-testid="exposure-scenario-control">
      <label
        htmlFor="exposure-scenario-select"
        className="text-[11px] font-bold uppercase tracking-wide text-[var(--db-text-muted)]"
      >
        Exposure scenario
      </label>
      {/* A real, operable select (DESIGN.md "Real semantic elements") with
          its single true option today. Not disabled -- a disabled control
          fails "complete keyboard operability"; the single option itself is
          the honest state, not a disabled affordance. */}
      <select
        id="exposure-scenario-select"
        data-testid="exposure-scenario-select"
        value="custom"
        onChange={() => {
          /* Only one option exists today; nothing to change to. */
        }}
        aria-describedby="exposure-scenario-note"
        className="mt-1 w-full min-h-[44px] rounded border border-[var(--db-border-strong)] bg-[var(--db-surface)] p-2.5 text-sm font-semibold text-[var(--db-text-primary)]"
      >
        <option value="custom">Custom (every assumption entered manually)</option>
      </select>
      <p
        id="exposure-scenario-note"
        data-testid="exposure-scenario-note"
        className="mt-1.5 text-xs leading-relaxed text-[var(--db-text-muted)]"
      >
        Protocol 28 preset scenarios (by receptor type and media type) are not available yet
        in this build. Every exposure assumption below is entered and adjusted manually until
        preset values are sourced from Protocol 28 and verified.
      </p>
    </div>
  );
}
