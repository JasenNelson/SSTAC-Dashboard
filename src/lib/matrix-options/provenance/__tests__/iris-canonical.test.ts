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
        if (!matchesAny(v, epa)) {
          mismatches.push(
            `${r.substance_key}/${r.input_key}: catalog ${v} not in EPA ${JSON.stringify(epa)}`,
          );
        }
      } else {
        const range = parseRange(v);
        if (!range) {
          mismatches.push(
            `${r.substance_key}/${r.input_key}: catalog value ${JSON.stringify(v)} is neither numeric nor an "a to b" range for an IRIS toxicity input`,
          );
        } else if (!matchesAny(range[0], epa) || !matchesAny(range[1], epa)) {
          mismatches.push(
            `${r.substance_key}/${r.input_key}: catalog range ${JSON.stringify(v)} endpoints are not both EPA values ${JSON.stringify(epa)}`,
          );
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
});
