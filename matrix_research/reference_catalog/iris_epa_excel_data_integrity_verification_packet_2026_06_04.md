# IRIS EPA-Excel Data-Integrity Verification Packet - 2026-06-04

## Purpose

This packet records a metadata-only, three-layer cross-walk of the catalog's US EPA IRIS
human-health toxicity values against the authoritative EPA source, for the substances that an
earlier backlog item flagged as "data-integrity mismatches" or "deferred":

- Disputed integrity trio: benzo(a)pyrene (BaP), chromium(VI), carbon tetrachloride.
- Formerly-deferred set: anthracene, p,p'-DDT, fluoride, uranium.

The three layers compared, for each substance and each EPA IRIS toxicity input
(oral RfD, oral slope factor, inhalation RfC, inhalation unit risk):

1. Live EPA IRIS export `Chemicals_Details (1).xlsx` (column TOXICITY VALUE), read in place.
2. Committed snapshot `src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json`
   (fields `epa_raw` / `epa_values`).
3. Catalog `matrix_research/reference_catalog/human_health_trv_values.json`
   (IRIS-sourced rows; field `value`).

It closes the historical "BaP / Cr(VI) / carbon-tet data-integrity mismatch" item: every current
catalog IRIS value for these substances MATCHES the EPA Excel, and the snapshot faithfully captures
the Excel. It does not copy source files into the repo, does not change any catalog JSON value,
unit, or qa_status, does not change the snapshot, does not change calculator defaults, and does not
mark any value as QA-approved.

## Non-Authorizing Status

- Review status: direct-source verification (cross-walk) packet only.
- Calculator-default status: no change.
- Catalog-data status: no source, value, unit, qa_status, equation, or source-relationship JSON
  changes are made by this packet. All values below are reported as they exist on origin/main;
  none are modified.
- QA status: no QA, owner, or delegated approval is recorded here. The qa-promotion candidate sheet
  in Section 4 is owner INPUT only -- a list for HITL to act on, not an applied change. AI does not
  write qa_status.
- Source-file status: no PDF, attachment, spreadsheet, snapshot, or full-text source file is copied
  into `C:\Projects`. The EPA Excel was read in place at the owner's local path; nothing was copied.

US EPA IRIS remains the authoritative source. This packet records a comparison and preserves the
review boundary; it confers no new authority.

## Sources Checked

Repo inputs used for comparison (read read-only at origin/main, commit 782f360; not source truth):

- `matrix_research/reference_catalog/human_health_trv_values.json` (1573 records).
- `src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json` (606 records).
- `src/lib/matrix-options/provenance/__tests__/iris-canonical.test.ts` (catalog-vs-snapshot guard).
- `src/lib/matrix-options/provenance/__tests__/iris-snapshot-magnitude.test.ts` (snapshot
  self-consistency guard, F2 / PR #247).
- `scripts/matrix-options/iris-raw-parse.mjs` (F2 raw-cell parser).

Authoritative source read on 2026-06-04 (in place, not copied):

- US EPA IRIS Chemicals_Details export: `Chemicals_Details (1).xlsx`, sheet `Chemicals_Details`,
  columns: CHEMICAL NAME, CASRN, EXPOSURE ROUTE, ASSESSMENT TYPE, CRIT EFFECT/TUMOR TYPE,
  WOE CHARACTERIZATION, TOXICITY VALUE TYPE, TOXICITY VALUE.
- US EPA IRIS: https://www.epa.gov/iris (the export's origin).

## Method and Guard Map

For each substance, the EPA Excel rows were matched by CHEMICAL NAME + CASRN, then each toxicity
value was compared across the three layers with units carried and normalized
(e.g. 0.06 ug/kg-bw/day == 6e-5 mg/kg-bw/day; "per ug/m3" is a reciprocal-concentration unit).

Which guard already covers which link, and the gap this packet fills:

| Link | Covered by | Status |
| --- | --- | --- |
| catalog value == snapshot epa_values | `iris-canonical.test.ts` | test-enforced |
| snapshot epa_raw re-canonicalizes to epa_values (self-consistency) | `iris-snapshot-magnitude.test.ts` (F2) | test-enforced |
| recon <-> builder unit parity | F1 (PR #246) | test-enforced |
| cross-language unit contract | F3 (PR #248) | test-enforced |
| snapshot epa_raw == LIVE EPA Excel cell | (none) | VERIFIED MANUALLY in this packet |

SCOPE: the Excel -> snapshot manual cross-walk in this packet covers ONLY the 7 named substances.
The rest of the IRIS catalog is snapshot-anchored only -- `iris-canonical.test.ts` proves
catalog == snapshot, but does not re-derive from the live Excel. This packet does NOT assert that
the entire IRIS catalog is Excel-verified.

Reproducibility -- the cross-walk is reproducible read-only with:

- `git show origin/main:matrix_research/reference_catalog/human_health_trv_values.json` (catalog).
- `git show origin/main:src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json`
  (snapshot).
- A read-only openpyxl read of `Chemicals_Details (1).xlsx` (sheet `Chemicals_Details`), filtering
  rows by CHEMICAL NAME / CASRN.

KEY-RESOLUTION NOTE: each substance was first resolved to its canonical catalog substance_key(s) by
CAS / Excel chemical name, NOT by colloquial name. This matters: the IRIS fluoride and uranium rows
use the EPA-export-faithful keys `fluorine_soluble_fluoride` and `uranium_soluble_salts`, DISTINCT
from the BC-Protocol-28 keys `fluoride` and `uranium`. A colloquial-key-only search misses them.

## 1. Disputed-substance dossier

All values verified on origin/main (commit 782f360) on 2026-06-04. EPA exponents are written in
plain ASCII (e.g. "3 x 10 -4"). Where a snapshot epa_raw string contains a non-ASCII micro sign in
"per [micro]g/m3", it is rendered here as "per ug/m3" (see Section 6, Observations).

### 1.1 Benzo(a)pyrene (BaP), CAS 50-32-8, Excel chemical "Benzo[a]pyrene (BaP)"

| Endpoint | Catalog IRIS value (pv id; qa) | Snapshot epa_values (epa_raw) | EPA Excel (row: TOXICITY VALUE) | Match |
| --- | --- | --- | --- | --- |
| Oral RfD - neurobehavioral | 3 x 10 -4 mg/kg-bw/day (pv-iris-bap-hh-direct-rfd-neuro / -food-; approved) | 3e-4 ("3 x 10 -4 mg/kg-day") | Row 83: 3 x 10 -4 mg/kg-day | yes |
| Oral RfD - ovarian/repro | 4 x 10 -4 mg/kg-bw/day (pv-iris-bap-hh-direct-rfd-repro / -food-; approved) | 4e-4 ("4 x 10 -4 mg/kg-day") | Row 88: 4 x 10 -4 mg/kg-day | yes |
| Oral RfD - immune | 2 x 10 -3 mg/kg-bw/day (pv-iris-bap-hh-direct-rfd-immune / -food-; approved) | 2e-3 ("2 x 10 -3 mg/kg-day") | Row 89: 2 x 10 -3 mg/kg-day | yes |
| Oral slope factor | 2 per mg/kg-bw/day (pv-iris-bap-hh-direct-sf / -food-; approved) | 2 ("2 per mg/kg-day") | Row 84: 2 per mg/kg-day | yes |
| Inhalation unit risk | 1 x 10 -3 per ug/m3 (pv-iris-benzo_a_pyrene-hh-direct-iur; needs_review) | 0.001 ("1 x 10 -3 per ug/m3") | Row 85: 1 x 10 -3 per ug/m3 | yes |
| Inhalation RfC | 3 x 10 -6 mg/m3 (pv-iris-benzo_a_pyrene-hh-direct-rfc; needs_review) | [2e-6, 3e-6] | Row 86: 3 x 10 -6 mg/m3 | yes |
| Inhalation RfC (2nd) | 2 x 10 -6 mg/m3 (pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2; needs_review) | [2e-6, 3e-6] | Row 87: 2 x 10 -6 mg/m3 | yes |

Resolution: RESOLVED. The current catalog IRIS values match the EPA Excel exactly. The historical
"SF 1 vs 2" and "IUR 0.0006 vs 0.001" notes were Health-Canada-vs-EPA jurisdiction confusion: the
catalog also carries SEPARATE Health Canada rows (oral SF 1.289; inhalation unit risk 0.0006;
src-health-canada-trv-v4-2025), which are a different authority, not a defect in the EPA values.

### 1.2 Chromium(VI), CAS 18540-29-9, Excel chemical "Chromium(VI)"

| Endpoint | Catalog IRIS value (pv id; qa) | Snapshot epa_values (epa_raw) | EPA Excel (row: TOXICITY VALUE) | Match |
| --- | --- | --- | --- | --- |
| Oral RfD (range) | "0.0007 to 0.07" mg/kg-bw/day (pv-iris-chromium-hexavalent-hh-direct-rfd / -food-; approved) | [7e-4, 9e-4, 1e-2, 7e-2] | Rows 193 (9 x 10 -4), 197 (7 x 10 -4), 198 (7 x 10 -2), 199 (1 x 10 -2) | yes (range spans the EPA min 7e-4 to max 7e-2) |
| Oral slope factor | 0.27 per mg/kg-bw/day (pv-iris-chromium-hexavalent-hh-direct-sf / -food-; approved) | 0.27 ("2.7 x 10 -1 per mg/kg-day") | Row 195: 2.7 x 10 -1 per mg/kg-day | yes |
| Inhalation RfC | 3 x 10 -5 mg/m3 (pv-iris-chromium-hexavalent-hh-direct-rfc; approved) | 3e-5 ("3 x 10 -5 mg/m3") | Row 196: 3 x 10 -5 mg/m3 | yes |
| Inhalation unit risk | 0.018 per ug/m3 (pv-iris-chromium-hexavalent-hh-direct-iur; approved) | 0.018 ("1.8 x 10 -2 per ug/m3") | Row 194: 1.8 x 10 -2 per ug/m3 | yes |

Resolution: RESOLVED. The current catalog IRIS values match the EPA Excel. The historical
"SF 0.16 / IUR 0.011" figures were unit-blind false positives (already retracted in prior session
notes). The oral RfD is stored as a range string spanning the four EPA Cr(VI) oral RfD values.

### 1.3 Carbon tetrachloride, CAS 56-23-5, Excel chemical "Carbon tetrachloride"

| Endpoint | Catalog IRIS value (pv id; qa) | Snapshot epa_values (epa_raw) | EPA Excel (row: TOXICITY VALUE) | Match |
| --- | --- | --- | --- | --- |
| Oral RfD | 4 x 10 -3 mg/kg-bw/day (pv-iris-carbon_tetrachloride-hh-direct-rfd / -food-; needs_review) | 4e-3 ("4 x 10 -3 mg/kg-day") | Row 150: 4 x 10 -3 mg/kg-day | yes |
| Oral slope factor | 7 x 10 -2 per mg/kg-bw/day (pv-iris-carbon_tetrachloride-hh-direct-sf / -food-; needs_review) | 0.07 ("7 x 10 -2 per mg/kg-day") | Row 148: 7 x 10 -2 per mg/kg-day | yes |
| Inhalation RfC | 1 x 10 -1 mg/m3 (pv-iris-carbon_tetrachloride-hh-direct-rfc; needs_review) | 0.1 ("1 x 10 -1 mg/m3") | Row 151: 1 x 10 -1 mg/m3 | yes |
| Inhalation unit risk | 6 x 10 -6 per ug/m3 (pv-iris-carbon_tetrachloride-hh-direct-iur; needs_review) | 6e-6 ("6 x 10 -6 per ug/m3") | Row 149: 6 x 10 -6 per ug/m3 | yes |

Resolution: RESOLVED. The current catalog IRIS inhalation unit risk is 6 x 10 -6 per ug/m3, which
matches the EPA Excel. The previously-documented bad value (1.5 x 10 -5) is ABSENT from both the
catalog and the snapshot -- it was dropped by the generator's data-integrity gate. No catalog change
is needed.

## 2. Formerly-deferred substance status

All four are PRESENT as IRIS-sourced rows and match the EPA Excel. None are gaps.

| Substance (IRIS substance_key) | Endpoint | Catalog IRIS value (pv id; qa) | EPA Excel (row: TOXICITY VALUE) | Match |
| --- | --- | --- | --- | --- |
| anthracene | Oral RfD | 0.3 mg/kg-bw/day (pv-iris-anthracene-hh-direct-rfd / -food-; needs_review) | Row 46: 3 x 10 -1 mg/kg-day | yes |
| p,p'-DDT (p_p_dichlorodiphenyltrichloroethane_ddt) | Inhalation unit risk | 9.7 x 10 -5 per ug/m3 (...-hh-direct-iur; needs_review) | Row 252: 9.7 x 10 -5 per ug/m3 | yes |
| p,p'-DDT | Oral slope factor | 0.34 per mg/kg-bw/day (...-hh-direct-sf / -food-; needs_review) | Row 253: 3.4 x 10 -1 per mg/kg-day | yes |
| p,p'-DDT | Oral RfD | 5 x 10 -4 mg/kg-bw/day (...-hh-direct-rfd / -food-; needs_review) | Row 254: 5 x 10 -4 mg/kg-day | yes |
| fluoride (fluorine_soluble_fluoride) | Oral RfD | 0.06 mg/kg-bw/day (pv-iris-fluorine_soluble_fluoride-hh-direct-rfd / -food-; needs_review) | Row 353: 6 x 10 -2 mg/kg-day | yes |
| uranium (uranium_soluble_salts) | Oral RfD | 0.003 mg/kg-bw/day (pv-iris-uranium_soluble_salts-hh-direct-rfd / -food-; needs_review) | Row 719: 3 x 10 -3 mg/kg-day | yes |

Authority distinction (do not conflate): the catalog ALSO carries separate non-IRIS rows for these
names -- BC Protocol 28 `fluoride` (oral RfD 0.105), BC Protocol 28 `uranium` (oral RfD 0.003), and
Health Canada `uranium` (oral RfD 0.0006). Those are different authorities verified against their
own sources, NOT the EPA IRIS values above, and are out of scope for this EPA-Excel cross-walk.

## 3. Cross-walk result

For all 7 named substances and every EPA IRIS toxicity input: EPA Excel cell == snapshot epa_raw
(verbatim) == snapshot epa_values == catalog IRIS value (units normalized). Zero mismatches.

The historical "BaP / Cr(VI) / carbon-tet data-integrity mismatch" backlog item is RESOLVED: the
current values are correct against the authoritative EPA source, and the one link no automated guard
covered (snapshot vs the live Excel) is now independently confirmed for these 7 substances.

## 4. QA-promotion candidate sheet (owner input only)

The following EPA-IRIS-sourced rows are currently `qa_status = needs_review` AND now verify against
the EPA Excel (Sections 1-2). They are CANDIDATES for the owner/HITL to consider promoting to
`approved`. This packet records NO qa_status change; AI does not write qa_status. The current
qa_status column is read verbatim from the origin/main catalog.

| parameter_value_id | substance | input | value + unit | EPA citation | current qa_status | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| pv-iris-benzo_a_pyrene-hh-direct-iur | BaP | inhalation unit risk | 1 x 10 -3 per ug/m3 | Excel row 85 | needs_review | owner MAY promote |
| pv-iris-benzo_a_pyrene-hh-direct-rfc | BaP | inhalation RfC | 3 x 10 -6 mg/m3 | Excel row 86 | needs_review | owner MAY promote |
| pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2 | BaP | inhalation RfC | 2 x 10 -6 mg/m3 | Excel row 87 | needs_review | owner MAY promote |
| pv-iris-carbon_tetrachloride-hh-direct-rfd | carbon-tet | oral RfD | 4 x 10 -3 mg/kg-bw/day | Excel row 150 | needs_review | owner MAY promote |
| pv-iris-carbon_tetrachloride-hh-food-rfd | carbon-tet | oral RfD | 4 x 10 -3 mg/kg-bw/day | Excel row 150 | needs_review | owner MAY promote |
| pv-iris-carbon_tetrachloride-hh-direct-rfc | carbon-tet | inhalation RfC | 1 x 10 -1 mg/m3 | Excel row 151 | needs_review | owner MAY promote |
| pv-iris-carbon_tetrachloride-hh-direct-sf | carbon-tet | oral slope factor | 7 x 10 -2 per mg/kg-bw/day | Excel row 148 | needs_review | owner MAY promote |
| pv-iris-carbon_tetrachloride-hh-food-sf | carbon-tet | oral slope factor | 7 x 10 -2 per mg/kg-bw/day | Excel row 148 | needs_review | owner MAY promote |
| pv-iris-carbon_tetrachloride-hh-direct-iur | carbon-tet | inhalation unit risk | 6 x 10 -6 per ug/m3 | Excel row 149 | needs_review | owner MAY promote |
| pv-iris-anthracene-hh-direct-rfd | anthracene | oral RfD | 3 x 10 -1 mg/kg-bw/day | Excel row 46 | needs_review | owner MAY promote |
| pv-iris-anthracene-hh-food-rfd | anthracene | oral RfD | 3 x 10 -1 mg/kg-bw/day | Excel row 46 | needs_review | owner MAY promote |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-iur | p,p'-DDT | inhalation unit risk | 9.7 x 10 -5 per ug/m3 | Excel row 252 | needs_review | owner MAY promote |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-sf | p,p'-DDT | oral slope factor | 3.4 x 10 -1 per mg/kg-bw/day | Excel row 253 | needs_review | owner MAY promote |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-sf | p,p'-DDT | oral slope factor | 3.4 x 10 -1 per mg/kg-bw/day | Excel row 253 | needs_review | owner MAY promote |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-rfd | p,p'-DDT | oral RfD | 5 x 10 -4 mg/kg-bw/day | Excel row 254 | needs_review | owner MAY promote |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-rfd | p,p'-DDT | oral RfD | 5 x 10 -4 mg/kg-bw/day | Excel row 254 | needs_review | owner MAY promote |
| pv-iris-fluorine_soluble_fluoride-hh-direct-rfd | fluoride | oral RfD | 6 x 10 -2 mg/kg-bw/day | Excel row 353 | needs_review | owner MAY promote |
| pv-iris-fluorine_soluble_fluoride-hh-food-rfd | fluoride | oral RfD | 6 x 10 -2 mg/kg-bw/day | Excel row 353 | needs_review | owner MAY promote |
| pv-iris-uranium_soluble_salts-hh-direct-rfd | uranium | oral RfD | 3 x 10 -3 mg/kg-bw/day | Excel row 719 | needs_review | owner MAY promote |
| pv-iris-uranium_soluble_salts-hh-food-rfd | uranium | oral RfD | 3 x 10 -3 mg/kg-bw/day | Excel row 719 | needs_review | owner MAY promote |

Total: 20 needs_review EPA-IRIS rows that verify against the Excel.

Already `approved` -- NO ACTION (listed for completeness, NOT candidates): BaP oral RfD
(neuro/repro/immune, direct+food = 6 rows) + BaP oral slope factor (direct+food = 2 rows); the
Chromium(VI) IRIS rows (4 endpoint families = 6 parameter rows: oral RfD range direct+food, oral SF
direct+food, inhalation RfC direct, inhalation unit risk direct). These are already approved and
require no promotion.

Scope: this sheet lists EPA-IRIS-sourced rows ONLY. Health Canada and BC Protocol 28 rows verify
against different authorities and have their own verification workflow
(`protocol28_direct_source_verification_workflow.md`); they are not promotion candidates here.

## 5. Residual / owner-gated (NOT done in this packet)

- NO IRIS data gaps remain among the 7 named substances. (The earlier "fluoride / uranium absent"
  characterization was a key-name blind spot: both are present under `fluorine_soluble_fluoride` /
  `uranium_soluble_salts` and match the EPA Excel.)
- Applying the Section 4 qa promotions is an owner/HITL action.
- An OPTIONAL executable Excel-vs-snapshot revalidation tool could bottle the one link this packet
  verified manually. It would be local-only (the EPA Excel is an external file that cannot be
  committed or run in CI), so it cannot become a CI gate; it is a future convenience, not part of
  this packet.

## 6. Observations / data hygiene (no action in this packet)

- The snapshot `epa_raw` strings for inhalation-unit-risk records contain a non-ASCII micro sign in
  "per [micro]g/m3" (the micro glyph, code point above 127; rendered here in ASCII as "ug/m3").
  Magnitudes are unaffected: the F2 parser's asciiFold maps the micro sign to "u" before parsing.
  This is a data-hygiene note for a possible future snapshot pass; it is not corrected here (that
  would be a snapshot mutation, out of scope for this docs-only packet).
- There are 8 string-range catalog records (5 distinct range values: Chromium(VI) oral RfD
  "0.0007 to 0.07"; benzene oral SF; benzene inhalation unit risk; vinyl chloride oral SF; vinyl
  chloride inhalation unit risk), all qa=approved. These are intentional faithful EPA ranges; noted
  for downstream numeric-handling awareness. No action.

## Provenance

- Verified against origin/main commit 782f360 on 2026-06-04.
- EPA source: `Chemicals_Details (1).xlsx`, sheet `Chemicals_Details`, read in place (not copied).
- Method: three-layer cross-walk (Excel -> snapshot -> catalog) with units normalized; substances
  resolved to canonical substance_key by CAS / Excel chemical name.
