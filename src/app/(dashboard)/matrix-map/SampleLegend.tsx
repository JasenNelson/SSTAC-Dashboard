'use client';

// =====================================================================
// Matrix Interactive Map -- sample symbology legend (PR-MAP-3a)
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-3a-samples-symbology
// Plan:   docs/design/matrix-map/PR_MAP_3_PLAN.md section 3.3
//
// 9 visual states = 3 classifications x 3 coordinate-quality tiers.
// Collapsible card pinned at the bottom-left of the map; starts
// collapsed per the design (legend is reference, not chrome).
//
// Plain ASCII only. Per L0 CLAUDE.md section 1.1.
// =====================================================================

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { buildSampleIconHtml, TIER_LABEL } from './sample-icons';
import type {
  Classification,
  CoordinateQualityTier,
} from './types';

const CLASSIFICATIONS: { key: Classification; label: string }[] = [
  { key: 'reference', label: 'Reference (background)' },
  { key: 'impacted', label: 'Impacted (above threshold)' },
  { key: 'unknown', label: 'Unknown (no classification recorded)' },
];

const TIERS: { key: CoordinateQualityTier; label: string }[] = [
  { key: 'high', label: 'High (surveyed)' },
  { key: 'medium', label: 'Medium (BC CSR centroid)' },
  { key: 'low', label: 'Low (manual steward fill)' },
];

interface SwatchProps {
  classification: Classification;
  tier: CoordinateQualityTier;
}

function Swatch({ classification, tier }: SwatchProps) {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center"
      // The inner SVG is fully self-contained markup built by the
      // shared icon builder so the legend matches the live marker.
      dangerouslySetInnerHTML={{
        __html: buildSampleIconHtml(classification, tier),
      }}
    />
  );
}

export function SampleLegend() {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <aside
      className="absolute bottom-4 left-4 z-[1000] flex max-w-[20rem] flex-col rounded-lg border border-slate-200 bg-white/95 shadow-md backdrop-blur"
      data-testid="matrix-map-legend"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-left"
        aria-expanded={expanded}
        aria-controls="matrix-map-legend-body"
        data-testid="matrix-map-legend-toggle"
      >
        <span className="text-sm font-semibold text-slate-700">
          Sample legend
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        )}
      </button>
      {expanded ? (
        <div
          id="matrix-map-legend-body"
          className="flex flex-col gap-3 px-3 py-3"
          data-testid="matrix-map-legend-body"
        >
          <section>
            <p className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Classification (shape + color)
            </p>
            <ul className="space-y-1">
              {CLASSIFICATIONS.map(({ key, label }) => (
                <li
                  key={key}
                  className="flex items-center gap-2 text-xs text-slate-700"
                >
                  <Swatch classification={key} tier="high" />
                  <span className="leading-tight">{label}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Coordinate quality (outline)
            </p>
            <ul className="space-y-1">
              {TIERS.map(({ key, label }) => (
                <li
                  key={key}
                  className="flex items-start gap-2 text-xs text-slate-700"
                >
                  <Swatch classification="unknown" tier={key} />
                  <span className="leading-tight">
                    <span className="font-medium">{label}</span>
                    <span className="block text-[10px] text-slate-500">
                      {TIER_LABEL[key]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <p className="border-t border-slate-100 pt-2 text-[10px] leading-tight text-slate-400">
            Selection (blue stroke) lands in PR-MAP-4.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
