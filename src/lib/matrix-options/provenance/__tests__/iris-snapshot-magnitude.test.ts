import { describe, expect, it } from 'vitest';
import { canonicalizeEpaRaw } from '../../../../../scripts/matrix-options/iris-raw-parse.mjs';
import snapshotRaw from './epa_iris_canonical_snapshot.json';

// EPA IRIS snapshot-anchor MAGNITUDE guard (F2, 2026-06-04).
//
// WHY THIS EXISTS (complements iris-canonical.test.ts): iris-canonical.test.ts proves the CATALOG value
// is a member of the snapshot's epa_values. It does NOT prove the snapshot's epa_values are themselves
// correct -- i.e. that each stored canonical magnitude actually equals what you get by canonicalizing
// its own verbatim epa_raw. The 2026-06-03 defect (corrected in PR #245) was exactly that gap: an anchor
// carried the canonical unit LABEL ("per ug/m3") together with the RAW, unconverted magnitude (8e-5
// instead of 8e-8 for ETBE), and the 2% data-integrity gate then compared a generated value against
// that mis-scaled anchor -- a wrong value validated against itself. This test re-derives every anchor
// value from its verbatim epa_raw via the SAME transform that wrote it (scripts/matrix-options/
// iris-raw-parse.mjs canonicalizeEpaRaw -> generate-catalog-records.mjs normalizeToCanonical) and
// asserts the stored epa_values reproduce, so that defect class cannot recur or be re-shipped.
//
// MULTISET, not index-paired: epa_values[] and epa_raw[] are NOT index-aligned (the writer appends in
// differing order; iris-canonical.test.ts already compares by set membership for the same reason). So
// the check is multiset equality within tolerance -- canonicalize every epa_raw, then count-based
// consume-once match against the stored epa_values, plus array-length parity.

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

const REL_TOL = 0.02; // 2% -- mirrors iris-canonical.test.ts + the generator's IRIS_SNAPSHOT_REL_TOL.
function withinTol(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.abs(b) * REL_TOL;
}

// KNOWN-BAD VERBATIM EPA SOURCE elements: malformed rows in EPA's OWN export. We do NOT mutate the
// verbatim epa_raw (it stays a faithful audit record of what EPA published); we EXCLUDE the element
// from the magnitude assertion with an explicit, cited reason. Owner decision 2026-06-04: allowlist-
// skip, mutate nothing.
interface KnownBadAnchor {
  substance_key: string;
  input_key: string;
  bad_raw: string;
  bad_value: number;
  reason: string;
}
const KNOWN_BAD_EPA_ANCHORS: KnownBadAnchor[] = [
  {
    substance_key: 'dibromoethane_1_2',
    input_key: 'sf_oral_per_mg_per_kg_bw_per_day',
    bad_raw: '1 mg/kg-day',
    bad_value: 1.0,
    // The EPA Chemicals_Details export has TWO Oral Slope Factor rows for 1,2-Dibromoethane (CASRN
    // 106-93-4), identical critical-effect text: "1 mg/kg-day" (missing "per") and "2 per mg/kg-day".
    // A slope factor is risk PER unit dose (the inverse of dose), so a valid SF unit must be reciprocal
    // ("per mg/kg-day"); bare "mg/kg-day" is a dose, an invalid SF unit -> normalizeToCanonical throws.
    // The real SF is 2 (the catalog carries value 2); the stored 1.0 is a phantom mapping to no
    // canonical SF. We leave the verbatim cell untouched and skip it here. Verified against the EPA
    // Excel 2026-06-04; see dashboard_iris_values_validate_against_epa_excel_not_memory.
    reason: 'verbatim malformed EPA duplicate SF row ("1 mg/kg-day", no "per"); real SF is 2',
  },
];

function keyOf(r: { substance_key: string; input_key: string }): string {
  return `${r.substance_key}/${r.input_key}`;
}

describe('EPA IRIS snapshot anchors are magnitude self-consistent (epa_raw -> canonical == epa_values)', () => {
  it('fixture wiring sanity: snapshot is non-empty and every record has paired value/raw arrays', () => {
    expect(snapshot.records.length).toBeGreaterThan(0);
    const unpaired = snapshot.records
      .filter((r) => !Array.isArray(r.epa_values) || !Array.isArray(r.epa_raw) || r.epa_values.length !== r.epa_raw.length)
      .map((r) => `${keyOf(r)} values=${JSON.stringify(r.epa_values)} raw=${JSON.stringify(r.epa_raw)}`);
    expect(unpaired).toEqual([]);
  });

  it('the known-bad dibromoethane SF element is still present (allowlist is live, not dead)', () => {
    for (const bad of KNOWN_BAD_EPA_ANCHORS) {
      const r = snapshot.records.find(
        (x) => x.substance_key === bad.substance_key && x.input_key === bad.input_key,
      );
      expect(r, `allowlisted record ${bad.substance_key}/${bad.input_key} missing from snapshot`).toBeDefined();
      expect(r!.epa_raw, `${bad.substance_key}/${bad.input_key} no longer carries ${JSON.stringify(bad.bad_raw)}`)
        .toContain(bad.bad_raw);
      // It genuinely does NOT canonicalize as that input_key (so the skip is justified, not masking a real value).
      expect(() => canonicalizeEpaRaw(bad.bad_raw, bad.input_key)).toThrow();
    }
  });

  it('every snapshot anchor reproduces its stored epa_values by canonicalizing its verbatim epa_raw', () => {
    const failures: string[] = [];
    for (const r of snapshot.records) {
      const key = keyOf(r);
      if (r.epa_values.length !== r.epa_raw.length) continue; // reported by the wiring-sanity test

      // Exclude known-bad elements (verbatim epa_raw left untouched; just not asserted). The removal is
      // SYMMETRIC and VERIFIED: a KNOWN_BAD entry that no longer matches the snapshot (its raw OR its
      // value missing) is recorded as a LOUD failure (a stale allowlist that must be re-verified against
      // the EPA source), never a silent skip. This closes the hole where removing only the raw would
      // desync the arrays and the length guard below would `continue` with nothing recorded.
      const raws = [...r.epa_raw];
      const vals = [...r.epa_values];
      let allowlistStale = false;
      for (const bad of KNOWN_BAD_EPA_ANCHORS) {
        if (bad.substance_key !== r.substance_key || bad.input_key !== r.input_key) continue;
        const ri = raws.indexOf(bad.bad_raw);
        const vi = vals.findIndex((v) => withinTol(v, bad.bad_value));
        if (ri < 0 || vi < 0) {
          failures.push(`${key}: stale KNOWN_BAD allowlist entry (raw ${JSON.stringify(bad.bad_raw)} ${ri < 0 ? 'MISSING' : 'found'}, value ${bad.bad_value} ${vi < 0 ? 'MISSING' : 'found'}) -- the snapshot changed; re-verify against the EPA source before trusting this skip`);
          allowlistStale = true;
          continue;
        }
        raws.splice(ri, 1);
        vals.splice(vi, 1);
      }
      if (allowlistStale) continue; // failure recorded above; never assert a half-excluded record

      // Near-equal guard (tripwire). In the PASSING case each canonicalized raw equals its stored value
      // within float precision (it IS the transform that wrote it), so sorted greedy pairs correctly
      // even with overlapping tolerance bands; and a real defect never passes silently because the
      // leftover / no-match checks below fail loudly. The guard exists only to surface the contrived
      // case of two near-equal endpoints in one record: today ZERO records trip it (min within-record
      // gap ~4%); a future EPA update adding near-equal endpoints should get a precise pairing rule.
      for (let i = 0; i < vals.length; i++) {
        for (let j = i + 1; j < vals.length; j++) {
          if (withinTol(vals[i], vals[j])) {
            failures.push(`${key}: two stored values within ${REL_TOL * 100}% (${vals[i]}, ${vals[j]}) -- greedy multiset match needs a precise pairing rule`);
          }
        }
      }

      // Canonicalize each remaining verbatim raw via the same transform that wrote the anchor.
      const canon: number[] = [];
      let canonError = false;
      for (const raw of raws) {
        try {
          canon.push(canonicalizeEpaRaw(raw, r.input_key).value);
        } catch (e) {
          failures.push(`${key}: epa_raw ${JSON.stringify(raw)} did not canonicalize for ${r.input_key}: ${(e as Error).message}`);
          canonError = true;
        }
      }
      if (canonError) continue; // a canonicalize failure was recorded above
      if (canon.length !== vals.length) {
        failures.push(`${key}: post-exclusion length mismatch (canonicalized ${canon.length} vs stored ${vals.length}) -- allowlist/parse inconsistency`);
        continue;
      }

      // Count-based consume-once multiset match: sort both ascending, match each stored value to a
      // distinct canonicalized value within tolerance, then assert nothing is left over either side.
      const sortedVals = [...vals].sort((a, b) => a - b);
      const sortedCanon = [...canon].sort((a, b) => a - b);
      const consumed = new Array<boolean>(sortedCanon.length).fill(false);
      for (const v of sortedVals) {
        const idx = sortedCanon.findIndex((c, k) => !consumed[k] && withinTol(c, v));
        if (idx < 0) {
          failures.push(`${key}: stored epa_value ${v} has no matching canonicalized epa_raw in ${JSON.stringify(sortedCanon)}`);
          continue;
        }
        consumed[idx] = true;
      }
      const leftover = sortedCanon.filter((_, k) => !consumed[k]);
      if (leftover.length) {
        failures.push(`${key}: canonicalized epa_raw values ${JSON.stringify(leftover)} have no matching stored epa_value (stored=${JSON.stringify(sortedVals)})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('the guard FAILS on a synthetic ETBE-shape anchor (canonical unit label + raw, unconverted magnitude)', () => {
    // The defect class: an IUR anchor stores the RAW magnitude (8e-5) under the canonical unit. The raw
    // "8 x 10 -5 per mg/m3" canonicalizes to 8e-8 per ug/m3 (/1000), so a stored 8e-5 must NOT match --
    // proving this test would catch the defect, not just pass on clean data.
    const storedDefect = 8e-5;
    const { value: canon } = canonicalizeEpaRaw('8 x 10 -5 per mg/m3', 'unit_risk_inhalation_per_ug_m3');
    expect(withinTol(canon, storedDefect)).toBe(false); // a defect anchor would be flagged
    expect(withinTol(canon, 8e-8)).toBe(true); // the correct canonical value reproduces
  });
});
