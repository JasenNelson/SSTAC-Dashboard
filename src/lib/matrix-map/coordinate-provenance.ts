// Coordinate provenance labels + honest captions for Matrix Map markers, popups, and legend.
// Extracted from MatrixMap.tsx so the labeling is unit-testable without pulling Leaflet into
// jsdom. The 2026-07-11 data-truth diagnosis found ~98.5% of Matrix Map samples are BC CSR
// site centroids (approximate upland parcel locations), not surveyed sediment positions -- the
// UI must state that provenance explicitly rather than imply every marker is an exact location.
// Plain ASCII only.

import type { CoordinateQualityTier } from '@/app/(dashboard)/matrix-map/types';

// PLAN_V3_4_2 section 3.3 -- coordinate quality tier outline pattern.
export const COORD_TIER_DASH_ARRAY: Record<CoordinateQualityTier, string | undefined> = {
  high: undefined,    // solid stroke (surveyed)
  medium: '4 3',      // dashed (BC CSR centroid)
  low: '1 3',         // dotted (manual steward fill)
};

export const COORD_TIER_LABEL: Record<CoordinateQualityTier, string> = {
  high: 'Surveyed',
  medium: 'Centroid',
  low: 'Manual',
};

// Honest one-line provenance captions (regulatory communication).
export const COORD_TIER_CAPTION: Record<CoordinateQualityTier, string> = {
  high: 'Surveyed sediment location.',
  medium: 'Approximate BC CSR site centroid -- not a surveyed sediment location.',
  low: 'Manually placed -- approximate location.',
};
