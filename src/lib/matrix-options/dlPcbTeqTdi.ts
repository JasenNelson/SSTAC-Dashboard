// DL-PCB (dioxin-like PCB) TEQ oral TDI resolver.
// Plain ASCII only.
//
// A3 Option A: the Human Health Direct Contact calculator adds a PARALLEL
// screening card for total PCBs that reuses the SAME inverse (solve-for-sedS)
// math as the mass-based calculation, but with the RfD input replaced by the
// dioxin-like-TEQ oral TDI. This module resolves and validates that single
// catalog value. No forward HQ, no runtime apportionment math -- the 50%
// dioxin-like-PCB apportionment is already baked into the cited TDI value.
//
// Fail-closed: any missing record, non-finite/non-positive value, or unit
// mismatch returns a blocked result instead of a fabricated/coerced number.

import { getParameterValueRecord } from './provenance/catalog';

export const DL_PCB_TEQ_SUBSTANCE_KEY = 'dioxin_like_teq';
export const DL_PCB_TEQ_PATHWAY = 'human-health-direct' as const;
export const DL_PCB_TEQ_INPUT_KEY = 'oral_tdi_teq_mg_per_kg_bw_day';
export const DL_PCB_TEQ_EXPECTED_UNIT = 'mg/kg-bw/day';

export interface DlPcbTeqTdiResolved {
  ok: true;
  tdi_mg_per_kg_bw_day: number;
  parameterValueId: string;
  qaStatus: string;
  unit: string;
}

export interface DlPcbTeqTdiBlocked {
  ok: false;
  reason: string;
}

export type DlPcbTeqTdiResolution = DlPcbTeqTdiResolved | DlPcbTeqTdiBlocked;

// Resolve the dioxin-like-TEQ oral TDI catalog row (dioxin_like_teq / human-health-direct /
// oral_tdi_teq_mg_per_kg_bw_day). Returns a blocked result (never throws, never fabricates)
// when the record is missing, its value is not a finite positive number, or its unit does not
// match the expected mg/kg-bw/day basis.
export function resolveDlPcbTeqTdi(): DlPcbTeqTdiResolution {
  const record = getParameterValueRecord(
    DL_PCB_TEQ_SUBSTANCE_KEY,
    DL_PCB_TEQ_PATHWAY,
    DL_PCB_TEQ_INPUT_KEY,
  );
  if (!record) {
    return { ok: false, reason: 'DL-PCB TEQ oral TDI catalog record was not found.' };
  }
  const rawValue = record.value;
  const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return {
      ok: false,
      reason: 'DL-PCB TEQ oral TDI catalog value is not a finite positive number.',
    };
  }
  if (record.unit !== DL_PCB_TEQ_EXPECTED_UNIT) {
    return {
      ok: false,
      reason: `DL-PCB TEQ oral TDI catalog unit "${record.unit}" does not match the expected "${DL_PCB_TEQ_EXPECTED_UNIT}".`,
    };
  }
  return {
    ok: true,
    tdi_mg_per_kg_bw_day: numericValue,
    parameterValueId: record.parameter_value_id,
    qaStatus: record.qa_status,
    unit: record.unit,
  };
}
