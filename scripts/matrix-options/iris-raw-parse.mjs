// Canonical parser for verbatim EPA IRIS raw cells -> { value, unit } and the canonical magnitude.
// Plain ASCII only.
//
// WHY THIS EXISTS
// The EPA IRIS snapshot anchors (src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json)
// store, per record, paired arrays epa_values[] (canonical magnitudes) + epa_raw[] (the VERBATIM EPA
// cells, e.g. "9 x 10 -3 mg/kg-day"). build-iris-orphan-pass.mjs wrote those anchors by parsing each
// raw cell's unit (rawCellUnit) and feeding (value, unit) to generate-catalog-records.mjs
// normalizeToCanonical. This module is the SINGLE, committed, import-safe home for that raw-cell parse,
// so a vitest TEST can re-derive the canonical value from the verbatim raw and prove each stored anchor
// is self-consistent (the F2 magnitude guard). That guard catches the 2026-06-03 defect class where a
// canonical unit LABEL was stored together with a raw, unconverted magnitude (ETBE: 8e-5 per mg/m3 was
// stored as 8e-5 per ug/m3, 1000x too high, and the anchor validated against itself).
//
// ATTRIBUTION / DRIFT (DOCLING SOP drift-detector pattern)
// parseEpaRaw's unit logic is byte-identical to build-iris-orphan-pass.mjs rawCellUnit (the writer);
// its value math mirrors the recon's "N x 10 M" / "N" parse. The F2 snapshot magnitude test exercises
// EVERY committed anchor through this parser, so any divergence from the writer surfaces as a snapshot
// self-consistency failure -- the test IS the drift detector. FOLLOW-UP (deferred, out of F2 scope):
// have build-iris-orphan-pass.mjs import parseEpaRaw/asciiFold from here too, once that script's
// top-level work is guarded behind an invokedDirectly check (it currently runs on import, so it cannot
// be imported into a test as-is).

import { normalizeToCanonical } from './generate-catalog-records.mjs';

// Fold any non-ASCII code point (>127) to 'u' so the micro sign in IUR raws ("per <micro>g/m3")
// matches the generator's canonUnit ("per ug/m3"). Mirrors build-iris-orphan-pass.mjs asciiFold.
export function asciiFold(s) {
  let o = '';
  for (const c of String(s)) o += c.codePointAt(0) > 127 ? 'u' : c;
  return o;
}

// Parse a verbatim EPA cell into { value, unit }. Handles "N x 10 M unit" | "N unit" | "N".
// A bare number returns unit ''. An unparseable value returns { value: NaN, unit: <folded string> }.
// The unit branch logic is identical to build-iris-orphan-pass.mjs rawCellUnit; this adds the paired
// value parse (the writer took the value from the recon, but it is the same "N x 10 M" / "N" math).
export function parseEpaRaw(raw) {
  const s = asciiFold(String(raw || '')).trim().replace(/\s*\[[^\]]*\]\s*$/, '').trim();
  let m = s.match(/^\s*([0-9.]+)\s*x\s*10\s*(-?\d+)\s*(.*)$/i);
  if (m) return { value: parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10)), unit: m[3].trim() };
  m = s.match(/^\s*([0-9.]+)\s+(\S.*?)\s*$/);
  if (m) return { value: parseFloat(m[1]), unit: m[2].trim() };
  m = s.match(/^\s*([0-9.]+)\s*$/);
  if (m) return { value: parseFloat(m[1]), unit: '' };
  return { value: NaN, unit: s };
}

// EPA values are 1-2 significant figures; trim float-repr artifacts (0.013000000000000001 -> 0.013).
// Mirrors build-iris-orphan-pass.mjs clean().
export function clean(v) {
  return Number(Number(v).toPrecision(6));
}

// The full canonical transform the snapshot writer used: parse the verbatim raw, then normalize to the
// input_key's canonical unit/scale (the SAME math that produced the stored anchor). Throws (fail closed)
// when the raw value is non-numeric OR the unit cannot be classified for input_key -- the same
// fail-closed contract as normalizeToCanonical. A verbatim-but-malformed EPA cell (e.g. the
// non-reciprocal "1 mg/kg-day" on an Oral Slope Factor) therefore THROWS here, which is correct: such a
// cell is excluded from the magnitude assertion via the test's documented known-bad allowlist, never
// silently "fixed".
export function canonicalizeEpaRaw(raw, inputKey) {
  const { value, unit } = parseEpaRaw(raw);
  if (!Number.isFinite(value)) throw new Error('Unparseable EPA raw value "' + raw + '"');
  const out = normalizeToCanonical(value, unit, inputKey);
  return { value: clean(out.value), unit: out.unit };
}
