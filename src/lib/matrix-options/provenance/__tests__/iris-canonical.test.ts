import { describe, expect, it } from 'vitest';
import { PARAMETER_VALUE_RECORDS } from '../catalog';
import snapshotRaw from './epa_iris_canonical_snapshot.json';

// EPA IRIS canonical guardrail.
//
// WHY THIS EXISTS: on 2026-05-31 a data-integrity review (Opus subagents + codex + claude
// desktop, independently) all flagged the catalog's arsenic IRIS oral RfD (6e-05) and oral
// slope factor (32) as "errors" -- because each cross-checked against AI-MEMORIZED 1991/1995
// canonical values (3e-4 / 1.5). The owner's authoritative source (the live EPA IRIS site,
// https://www.epa.gov/iris, and its Chemicals_Details Excel export) showed the catalog was
// CORRECT: the current IRIS inorganic-arsenic assessment gives RfD 6e-05 (ischemic heart
// disease + type-2 diabetes) and oral SF 32 (bladder/lung cancer). Every catalog IRIS toxicity
// value was extracted faithfully from that EPA export.
//
// This test bottles that lesson so it cannot be lost again: it asserts every IRIS-labeled
// catalog toxicity value matches the committed EPA IRIS snapshot (./epa_iris_canonical_snapshot.json,
// derived directly from the EPA export), NOT anyone's memory of "canonical" values. When IRIS
// updates, regenerate the snapshot from a fresh EPA export; a real future extraction error
// (a mis-keyed exponent, wrong row, stale value) will fail here against the source of truth.

interface SnapshotRecord {
  substance_key: string;
  input_key: string;
  exposure_route: string;
  toxicity_value_type: string;
  excel_chemical: string[];
  epa_values: number[];
  epa_raw: string[];
}
const snapshot = snapshotRaw as { records: SnapshotRecord[] };

// The four EPA IRIS toxicity-value input types the snapshot covers. Other IRIS-labeled inputs
// (e.g. a logKow physicochemical property) are not EPA IRIS toxicity values and are out of scope.
const IRIS_TOXICITY_INPUTS = new Set<string>([
  'rfd_oral_mg_per_kg_bw_day',
  'sf_oral_per_mg_per_kg_bw_per_day',
  'rfc_inhalation_mg_per_m3',
  'unit_risk_inhalation_per_ug_m3',
]);

function isIrisLabeled(r: { display_name: string; source_ids: string[] }): boolean {
  return (
    r.display_name.toLowerCase().includes('iris') ||
    r.source_ids.join(' ').toLowerCase().includes('iris')
  );
}

const REL_TOL = 0.02; // 2% -- accommodates the EPA export's 2-significant-figure notation.
function matchesAny(value: number, epaValues: number[]): boolean {
  return epaValues.some((e) => Math.abs(value - e) <= Math.abs(e) * REL_TOL);
}
function parseRange(s: string): [number, number] | null {
  const m = s.match(/^\s*([0-9.eE+-]+)\s+to\s+([0-9.eE+-]+)\s*$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a <= b ? [a, b] : [b, a];
}

// Unit-aware comparison. The snapshot's epa_values are in each input's BASE unit (RfD =
// mg/kg-bw/day, oral SF = (mg/kg-day)^-1, RfC = mg/m3, inhalation unit risk = (ug/m3)^-1). A
// catalog record may legitimately carry the SAME value in a different unit -- e.g. arsenic oral
// RfD 0.06 ug/kg-bw/day == 6e-5 mg/kg-bw/day -- so we MUST normalize the catalog value by its
// unit to the base before comparing, or a correct value gets false-flagged. (Lesson 2026-05-31:
// a bare-number comparison wrongly called 0.06 ug/kg "1000x off"; 0.06 ug/kg = 6e-5 mg/kg.)
export function normalizeToBase(value: number, unit: string, inputKey: string): number {
  const u = (unit || '').toLowerCase().replace(/\s+/g, '').replace('cu.m', 'm3');
  if (inputKey === 'rfd_oral_mg_per_kg_bw_day') {
    return u.startsWith('ug/kg') ? value * 1e-3 : value; // base mg/kg-bw/day
  }
  if (inputKey === 'rfc_inhalation_mg_per_m3') {
    return u.startsWith('ug/m3') ? value * 1e-3 : value; // base mg/m3
  }
  // Oral slope factor base (mg/kg-day)^-1 and inhalation unit risk base (ug/m3)^-1: the catalog
  // uses these bases (no observed ug/mg slope-factor variants). Pass through; extend if one appears.
  return value;
}

const snapByKey = new Map<string, SnapshotRecord>(
  snapshot.records.map((r) => [`${r.substance_key}::${r.input_key}`, r]),
);

const irisToxicityRecords = PARAMETER_VALUE_RECORDS.filter(
  (r) => isIrisLabeled(r) && IRIS_TOXICITY_INPUTS.has(r.input_key),
);

describe('EPA IRIS canonical guardrail (catalog values must match the EPA source, not memory)', () => {
  it('has IRIS-labeled toxicity records and a non-empty snapshot (fixture wiring sanity)', () => {
    expect(irisToxicityRecords.length).toBeGreaterThan(0);
    expect(snapshot.records.length).toBeGreaterThan(0);
  });

  it('every IRIS-labeled toxicity record has an EPA snapshot anchor', () => {
    const orphans = irisToxicityRecords
      .filter((r) => !snapByKey.has(`${r.substance_key}::${r.input_key}`))
      .map((r) => `${r.substance_key}/${r.input_key} (${r.parameter_value_id})`);
    // An orphan = an IRIS-labeled toxicity value with no EPA anchor: either a mislabeled
    // record or a snapshot that needs regenerating from a fresh EPA IRIS export.
    expect(orphans).toEqual([]);
  });

  it('every IRIS-labeled toxicity value matches the EPA IRIS snapshot', () => {
    const mismatches: string[] = [];
    for (const r of irisToxicityRecords) {
      const snap = snapByKey.get(`${r.substance_key}::${r.input_key}`);
      if (!snap) continue; // covered by the orphan test above
      const epa = snap.epa_values;
      const v = r.value;
      if (typeof v === 'number') {
        const nv = normalizeToBase(v, r.unit, r.input_key);
        if (!matchesAny(nv, epa)) {
          mismatches.push(
            `${r.substance_key}/${r.input_key}: catalog ${v} ${r.unit} (= ${nv} base) not in EPA ${JSON.stringify(epa)}`,
          );
        }
      } else {
        const range = parseRange(v);
        if (!range) {
          mismatches.push(
            `${r.substance_key}/${r.input_key}: catalog value ${JSON.stringify(v)} is neither numeric nor an "a to b" range for an IRIS toxicity input`,
          );
        } else {
          const lo = normalizeToBase(range[0], r.unit, r.input_key);
          const hi = normalizeToBase(range[1], r.unit, r.input_key);
          if (!matchesAny(lo, epa) || !matchesAny(hi, epa)) {
            mismatches.push(
              `${r.substance_key}/${r.input_key}: catalog range ${JSON.stringify(v)} ${r.unit} endpoints are not both EPA values ${JSON.stringify(epa)}`,
            );
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  // NOTE: we deliberately do NOT assert "one value per (substance,input)". IRIS legitimately
  // publishes multiple endpoint-/medium-specific values for a single input -- e.g. benzo[a]pyrene
  // has three oral RfDs (3e-4 / 4e-4 / 2e-3) and cadmium two (1e-3 dietary, 5e-4 water), all in
  // the snapshot. The "same-authority single value" idea (proposed by the codex/claude-desktop
  // reviews) was itself a memory-style assumption that contradicts IRIS reality; the correct and
  // sufficient integrity check is membership in the EPA snapshot (the test above).

  it('normalizes units before comparing (a ug-unit value equals its mg-unit EPA value)', () => {
    // 2026-05-31 lesson: a catalog value in ug units is the SAME as the mg-unit EPA value, and the
    // guardrail must not false-flag it. 0.06 ug/kg-bw/day == 6e-5 mg/kg-bw/day; 2e-2 ug/m3 == 2e-5 mg/m3.
    expect(normalizeToBase(0.06, 'ug/kg-day', 'rfd_oral_mg_per_kg_bw_day')).toBeCloseTo(6e-5, 12);
    expect(normalizeToBase(2e-2, 'ug/m3', 'rfc_inhalation_mg_per_m3')).toBeCloseTo(2e-5, 8);
    // mg-unit values pass through unchanged.
    expect(normalizeToBase(6e-5, 'mg/kg-bw/day', 'rfd_oral_mg_per_kg_bw_day')).toBeCloseTo(6e-5, 12);
    expect(normalizeToBase(0.052, '(mg/kg-day)-1', 'sf_oral_per_mg_per_kg_bw_per_day')).toBeCloseTo(0.052, 6);
  });
});
