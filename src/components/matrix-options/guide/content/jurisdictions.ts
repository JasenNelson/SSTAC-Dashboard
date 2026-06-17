// Regulatory-frame options for the matrix-options calculator shared
// global inputs. The user-selectable concept is a "regulatory frame";
// "jurisdiction" is now reserved for source provenance (catalog columns,
// CatalogJurisdiction). The canonical exports here are the RegulatoryFrame
// names; the historical Jurisdiction exports are kept as @deprecated
// re-export aliases so the ~15 importing files do not all churn at once.
//
// Underlying model lives in src/lib/matrix-options/regulatoryFrames.ts.
//
// Plain ASCII only.

import {
  DEFAULT_REGULATORY_FRAME_ID,
  REGULATORY_FRAME_IDS,
  REGULATORY_FRAMES,
  coerceRegulatoryFrameId,
  isRegulatoryFrameId,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';

// --- Canonical RegulatoryFrame vocabulary (preferred) ---

export type RegulatoryFrame = RegulatoryFrameId;

const ALL_REGULATORY_FRAMES_TUPLE = REGULATORY_FRAME_IDS;

export const REGULATORY_FRAME_OPTIONS_IDS: ReadonlyArray<RegulatoryFrame> =
  ALL_REGULATORY_FRAMES_TUPLE;

export const DEFAULT_REGULATORY_FRAME: RegulatoryFrame =
  DEFAULT_REGULATORY_FRAME_ID;

export interface RegulatoryFrameOption {
  id: RegulatoryFrame;
  label: string;
  description: string;
}

const REGULATORY_FRAME_OPTIONS_TUPLE = REGULATORY_FRAMES.map((frame) => ({
  id: frame.id,
  label: frame.label,
  description: frame.description,
})) as readonly RegulatoryFrameOption[];

export const REGULATORY_FRAME_OPTIONS: ReadonlyArray<RegulatoryFrameOption> =
  REGULATORY_FRAME_OPTIONS_TUPLE;

export function isRegulatoryFrame(value: unknown): value is RegulatoryFrame {
  return isRegulatoryFrameId(value);
}

export function coerceRegulatoryFrame(
  value: unknown,
): RegulatoryFrame | null {
  return coerceRegulatoryFrameId(value);
}

// --- Deprecated Jurisdiction aliases (kept to avoid churning ~15 imports) ---

/** @deprecated Use RegulatoryFrame. Reserved name "jurisdiction" now means source provenance. */
export type Jurisdiction = RegulatoryFrame;

/** @deprecated Use REGULATORY_FRAME_OPTIONS_IDS. */
export const ALL_JURISDICTIONS: ReadonlyArray<Jurisdiction> =
  REGULATORY_FRAME_OPTIONS_IDS;

/** @deprecated Use DEFAULT_REGULATORY_FRAME. */
export const DEFAULT_JURISDICTION: Jurisdiction = DEFAULT_REGULATORY_FRAME;

/** @deprecated Use RegulatoryFrameOption. */
export type JurisdictionOption = RegulatoryFrameOption;

/** @deprecated Use REGULATORY_FRAME_OPTIONS. */
export const JURISDICTION_OPTIONS: ReadonlyArray<JurisdictionOption> =
  REGULATORY_FRAME_OPTIONS;

/** @deprecated Use isRegulatoryFrame. */
export function isJurisdiction(value: unknown): value is Jurisdiction {
  return isRegulatoryFrame(value);
}

/** @deprecated Use coerceRegulatoryFrame. */
export function coerceJurisdiction(value: unknown): Jurisdiction | null {
  return coerceRegulatoryFrame(value);
}

type AllFramesExhaustive =
  Exclude<RegulatoryFrame, (typeof ALL_REGULATORY_FRAMES_TUPLE)[number]> extends never
    ? true
    : false;
const _allFramesExhaustive: AllFramesExhaustive = true;
void _allFramesExhaustive;

type OptionsCoverAllFrames =
  Exclude<RegulatoryFrame, (typeof REGULATORY_FRAME_OPTIONS_TUPLE)[number]['id']> extends never
    ? true
    : false;
const _optionsCoverAll: OptionsCoverAllFrames = true;
void _optionsCoverAll;
