# Matrix Options Inhalation Schema Packet - 2026-07-08

## Verdict

Do not implement inhalation support during the autonomous run.

The inhalation backlog is real, but it is a schema and calculator-pathway expansion, not a missing
value-wiring cleanup. It would require new `SubstanceEntry` fields, human-health calculator inputs,
equations, UI, provenance display, and tests. That is outside the approved autonomous contract and
must not be mixed with A3/DL-PCB work.

## Current Runtime Schema

`src/lib/matrix-options/types.ts` currently exposes human-health runtime inputs only for oral
toxicity endpoints:

- `rfd_oral_mg_per_kg_bw_day`
- `sf_oral_per_mg_per_kg_bw_per_day`

`HumanHealthDirectContactInput`, `HumanHealthFoodWebInput`, and `SubstanceEntry` do not have runtime
fields for:

- inhalation RfC
- inhalation unit risk
- air concentration
- volatilization / particulate emission factor
- exposure inhalation rate
- indoor/outdoor attenuation

`src/lib/matrix-options/derivations.ts` likewise solves HH direct and HH food-web standards from
oral RfD / oral slope factor only. It has no inhalation equation branch.

## Provenance Layer Already Knows Inhalation Values

The provenance/test layer already carries and normalizes inhalation toxicity values:

- `rfc_inhalation_mg_per_m3`
- `unit_risk_inhalation_per_ug_m3`

Relevant tests include:

- `src/lib/matrix-options/__tests__/unitNormalization.test.ts`
- `src/lib/matrix-options/provenance/__tests__/unit-contract.test.ts`
- `src/lib/matrix-options/provenance/__tests__/value-groups.test.ts`
- `src/lib/matrix-options/provenance/__tests__/iris-canonical.test.ts`

This means the source/value layer has inhalation records, but the runtime calculator does not have a
place to use them.

## Already-Resolved False Positives

Older docs flagged `chlorine_dioxide` and `phosphine` as possible RfC/oral-unit mismatches. The later
architecture decision doc clarifies that those were recon-generator display bugs, not catalog defects:
both have genuine oral RfD rows and are already wired as `inorganic` runtime substances.

Current code confirms:

- `chlorine_dioxide`: oral RfD `0.03`, class `inorganic`
- `phosphine`: oral RfD `0.0003`, class `inorganic`

So the inhalation backlog should not be used to reopen those two runtime entries.

## Open Backlog Shape

`docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md` lists an inhalation-only schema gap:

- 48 substances have clean inhalation values only (`rfc_inh` / `iur_inh`)
- `SubstanceEntry` cannot hold those values
- calculator support does not exist

The correct future lane is not "add 48 substances." It is:

1. Design the inhalation pathway.
2. Add runtime endpoint fields and provenance plumbing.
3. Add equations and inputs.
4. Add UI and tests.
5. Then wire inhalation-only substances.

## Future Implementation Plan

Create a separate "HH inhalation pathway" design PR before code.

Minimum design questions:

- Is inhalation part of Human Health Direct Contact, a separate HH inhalation pathway, or a separate
  screening module?
- Does the sediment-to-air model use particulate dust, volatilization, or both?
- Which regulatory frames support the pathway?
- Which exposure assumptions are frame defaults vs user inputs?
- How should inhalation RfC and inhalation unit risk be compared and displayed?
- How should oral/dermal and inhalation risks be combined, if at all?

Likely future code surfaces:

- `src/lib/matrix-options/types.ts`
- `src/lib/matrix-options/derivations.ts`
- equation dispatch / pathway metadata
- HH calculator component(s)
- provenance panel / used-value rendering
- targeted unit and component tests
- authenticated e2e once available

Forbidden for the current autonomous run:

- adding placeholder inhalation fields to `SubstanceEntry`
- stuffing RfC/IUR values into oral RfD/SF fields
- wiring the 48 inhalation-only substances
- changing catalog rows or statuses

## Current Autonomous-Run Status

Status: resolved as future design lane.

No code change is appropriate under the current autonomous contract. The safe deliverable is this
packet and an updated backlog map entry.
