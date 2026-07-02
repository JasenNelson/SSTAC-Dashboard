'use client';

// SharedGlobalInputs -- the substance + jurisdiction selectors lifted out
// of the per-pathway calculators so the parent (MatrixDashboard) can pass
// them to every calculator branch consistently. Plan v3 section 4.1
// + v6 lock the short-form vocabulary; this component is the canonical
// emitter of substance / jurisdiction change events.
//
// Substance dropdown: all SUBSTANCE_LIBRARY rows. Per-pathway applicability
// (e.g., EqP requires logKow + FCV) is enforced inside each calculator,
// not here -- this control is the global "what substance am I working on"
// state, regardless of whether the active pathway can derive it.
//
// Jurisdiction selector: regulatory-frame rows that control value lookup,
// source hierarchy, and pathway applicability messaging. For the eco
// pathways (EqP FCV, food-web TRV), a reference-only or unsupported frame
// now suppresses the calculator input default (blank) instead of showing an
// unsupported static value; other pathways still use the current input
// defaults until frame-specific values pass QA.
//
// Plain ASCII only.

import React from 'react';
import { cn } from '@/utils/cn';
import {
  SUBSTANCE_LIBRARY,
  findSubstance,
} from '@/lib/matrix-options/substanceLibrary';
import {
  REGULATORY_FRAME_OPTIONS,
  coerceRegulatoryFrame,
  isRegulatoryFrame,
  type RegulatoryFrame,
} from './guide/content/jurisdictions';

// Default substance key: the first library entry that has both logKow AND
// FCV populated (i.e., the EqP path is applicable). Matches the prior
// per-calculator default so PR-A2 lifting does not change the initial
// render value. Falls back to the first library entry overall.
const EQP_CAPABLE = SUBSTANCE_LIBRARY.filter(
  (s) => s.logKow !== null && s.fcv_ug_per_L !== null,
);
export const DEFAULT_SUBSTANCE_KEY: string =
  EQP_CAPABLE[0]?.key ?? SUBSTANCE_LIBRARY[0].key;

export interface SharedGlobalInputsProps {
  substanceKey: string;
  jurisdiction: RegulatoryFrame;
  onSubstanceKeyChange: (key: string) => void;
  onJurisdictionChange: (jurisdiction: RegulatoryFrame) => void;
  className?: string;
}

export default function SharedGlobalInputs({
  substanceKey,
  jurisdiction,
  onSubstanceKeyChange,
  onJurisdictionChange,
  className,
}: SharedGlobalInputsProps) {
  const substance = findSubstance(substanceKey);
  const currentJurisdiction = REGULATORY_FRAME_OPTIONS.find(
    (j) => j.id === jurisdiction,
  );

  const handleSubstanceChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const next = e.target.value;
    // Defense-in-depth: only emit if the new value resolves to a real
    // library entry. Should never fire on stale dropdown options because
    // the option list is sourced from SUBSTANCE_LIBRARY itself.
    if (findSubstance(next)) {
      onSubstanceKeyChange(next);
    }
  };

  const handleJurisdictionChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    const next = coerceRegulatoryFrame(e.target.value);
    if (isRegulatoryFrame(next)) {
      onJurisdictionChange(next);
    }
  };

  return (
    <section
      data-testid="shared-global-inputs"
      aria-label="Shared calculator inputs"
      className={cn(
        'bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm',
        className,
      )}
    >
      <header className="mb-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          Shared inputs
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Substance and regulatory frame apply to every active pathway
          calculator below.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="shared-substance"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Substance
          </label>
          <select
            id="shared-substance"
            data-testid="shared-substance-select"
            value={substanceKey}
            onChange={handleSubstanceChange}
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            {SUBSTANCE_LIBRARY.map((s) => (
              <option key={s.key} value={s.key}>
                {s.displayName}
              </option>
            ))}
          </select>
          {substance && (
            <p
              className="text-xs text-slate-500 dark:text-slate-400 mt-1"
              data-testid="shared-substance-description"
            >
              Class: {substance.contaminantClass}; log K_ow:{' '}
              {substance.logKow ?? 'n/a'}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="shared-jurisdiction"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Regulatory frame
          </label>
          <select
            id="shared-jurisdiction"
            data-testid="shared-jurisdiction-select"
            value={jurisdiction}
            onChange={handleJurisdictionChange}
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            {REGULATORY_FRAME_OPTIONS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
          {currentJurisdiction && (
            <p
              className="text-xs text-slate-500 dark:text-slate-400 mt-1"
              data-testid="shared-jurisdiction-description"
            >
              {currentJurisdiction.description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
