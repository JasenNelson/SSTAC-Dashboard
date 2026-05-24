// Regulatory-frame options for the matrix-options calculator shared
// global inputs. This file preserves the historical Jurisdiction export
// name for component compatibility while the underlying model has moved
// to framework-level records in src/lib/matrix-options/regulatoryFrames.ts.
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

export type Jurisdiction = RegulatoryFrameId;

const ALL_JURISDICTIONS_TUPLE = REGULATORY_FRAME_IDS;

export const ALL_JURISDICTIONS: ReadonlyArray<Jurisdiction> =
  ALL_JURISDICTIONS_TUPLE;

export const DEFAULT_JURISDICTION: Jurisdiction =
  DEFAULT_REGULATORY_FRAME_ID;

export interface JurisdictionOption {
  id: Jurisdiction;
  label: string;
  description: string;
}

const JURISDICTION_OPTIONS_TUPLE = REGULATORY_FRAMES.map((frame) => ({
  id: frame.id,
  label: frame.label,
  description: frame.description,
})) as readonly JurisdictionOption[];

export const JURISDICTION_OPTIONS: ReadonlyArray<JurisdictionOption> =
  JURISDICTION_OPTIONS_TUPLE;

export function isJurisdiction(value: unknown): value is Jurisdiction {
  return isRegulatoryFrameId(value);
}

export function coerceJurisdiction(value: unknown): Jurisdiction | null {
  return coerceRegulatoryFrameId(value);
}

type AllJurisdictionsExhaustive =
  Exclude<Jurisdiction, (typeof ALL_JURISDICTIONS_TUPLE)[number]> extends never
    ? true
    : false;
const _allJurisdictionsExhaustive: AllJurisdictionsExhaustive = true;
void _allJurisdictionsExhaustive;

type OptionsCoverAllJurisdictions =
  Exclude<Jurisdiction, (typeof JURISDICTION_OPTIONS_TUPLE)[number]['id']> extends never
    ? true
    : false;
const _optionsCoverAll: OptionsCoverAllJurisdictions = true;
void _optionsCoverAll;
