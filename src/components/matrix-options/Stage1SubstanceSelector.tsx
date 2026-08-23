'use client';

import React, { useMemo } from 'react';
import { SUBSTANCE_LIBRARY, findSubstance } from '@/lib/matrix-options/substanceLibrary';
import { SubstanceCombobox } from './SubstanceCombobox';
import {
  getSubstanceApplicability,
  applicabilityBadgeClass,
  applicabilityShortLabel,
  type PathwayId4,
} from '@/lib/matrix-options/substanceApplicability';
import type { RegulatoryFrame } from './guide/content/jurisdictions';

export interface Stage1SubstanceSelectorProps {
  substanceKey: string;
  onSubstanceKeyChange?: (key: string) => void;
  jurisdiction?: RegulatoryFrame;
  pathwayId?: PathwayId4;
  idPrefix?: string;
}

export function Stage1SubstanceSelector({
  substanceKey,
  onSubstanceKeyChange,
  jurisdiction,
  pathwayId,
  idPrefix = 'stage1',
}: Stage1SubstanceSelectorProps) {
  const substance = findSubstance(substanceKey);
  const substanceOptions = useMemo(
    () => SUBSTANCE_LIBRARY.map((s) => ({ key: s.key, label: s.displayName })),
    [],
  );

  const applicability = jurisdiction
    ? getSubstanceApplicability(substanceKey, jurisdiction)
    : null;

  const currentPathwayApplicability =
    pathwayId && applicability ? applicability[pathwayId] : null;

  return (
    <div className="mb-5 pb-4 border-b border-slate-200 dark:border-slate-800 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <SubstanceCombobox
            id={`${idPrefix}-substance-select`}
            label="Substance"
            options={substanceOptions}
            value={substanceKey}
            onChange={(key) => {
              if (onSubstanceKeyChange && findSubstance(key)) {
                onSubstanceKeyChange(key);
              }
            }}
          />
        </div>
        {currentPathwayApplicability && (
          <div className="sm:self-end flex items-center gap-1.5 pb-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Applicability:</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${applicabilityBadgeClass(
                currentPathwayApplicability.state,
              )}`}
              title={currentPathwayApplicability.reason}
            >
              {applicabilityShortLabel(currentPathwayApplicability.state)}
            </span>
          </div>
        )}
      </div>

      {substance && (
        <div
          data-testid="stage1-substance-description"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono"
        >
          <span>Class: {substance.contaminantClass}</span>
          {substance.logKow !== null && <span>| log K_ow: {substance.logKow}</span>}
          {substance.fcv_ug_per_L !== null && <span>| FCV: {substance.fcv_ug_per_L} ug/L</span>}
        </div>
      )}

      {(substanceKey === 'cyanide_free' ||
        substanceKey === 'hydrogen_cyanide_and_cyanide_salts') && (
        <div
          role="alert"
          data-testid="cyanide-guidance-warning"
          className="p-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200 leading-relaxed"
        >
          <strong className="font-semibold">Caution:</strong> These endpoints represent equivalent cyanide exposure. Select only one.
        </div>
      )}
      {(substanceKey === 'copper_cyanide' ||
        substanceKey === 'silver_cyanide' ||
        substanceKey === 'potassium_silver_cyanide') && (
        <div
          role="alert"
          data-testid="cyanide-guidance-warning"
          className="p-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200 leading-relaxed"
        >
          <strong className="font-semibold">Complex Salt:</strong> Represents a metal-cyanide compound/salt; do not assess concurrently with generic metal or generic cyanide.
        </div>
      )}
    </div>
  );
}
