# Matrix Options Organomercury Packet - 2026-07-08

## Verdict

Do not implement `phenylmercuric_acetate` wiring yet without one more owner decision.

The RfD source row exists and the owner-approved class direction is clear, but a selectable
`SUBSTANCE_LIBRARY` entry also needs `abs_dermal`, which is load-bearing in the human-health direct-contact
calculator. Existing decision docs left that field as TBD. Choosing it silently would create a hidden policy
decision.

## Current Facts

- `phenylmercuric_acetate` is not present in `src/lib/matrix-options/substanceLibrary.ts`.
- It is present in the IRIS provenance snapshot at
  `src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json:8579`.
- Approved source rows exist in `matrix_research/reference_catalog/human_health_trv_values.json`:
  - `pv-iris-phenylmercuric_acetate-hh-direct-rfd`, value `0.00008`, unit `mg/kg-bw/day`,
    `qa_status: approved`, `default_status: available_option`.
  - `pv-iris-phenylmercuric_acetate-hh-food-rfd`, value `0.00008`, unit `mg/kg-bw/day`,
    `qa_status: approved`, `default_status: available_option`.
- Owner decision docs record the class decision:
  - `docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md:81` says
    `phenylmercuric_acetate | organomercury`.
  - `FRESH_SESSION_HANDOFF_2026_07_07b_PHASE_B_SHIPPED.md:104-106` says the owner approved a new
    `organomercury` `ContaminantClass`.

## Why This Is Not A One-Line Patch

`ContaminantClass` currently includes:

- `organic`
- `organic-PAH`
- `organic-halogenated`
- `divalent-metal`
- `methyl-Hg`
- `metalloid`
- `inorganic`

Adding `organomercury` to the type union is easy, but not sufficient. A new library entry must also carry:

- `logKow`
- `rfd_oral_mg_per_kg_bw_per_day`
- `sf_oral_per_mg_per_kg_bw_per_day`
- `bsaf_loc_freshwater`
- `abs_dermal`
- `ba_oral`
- `fcv_ug_per_L`
- `trv_eco_mg_per_kg_bw_day`
- provenance notes

The direct-contact calculator uses `abs_dermal`, so a default like `0.1`, `0.03`, or `0.001` changes the
screening standard. Older docs explicitly treated that value as TBD for this substance.

## Safe Implementation After Owner Decision

Allowed files:

- `src/lib/matrix-options/types.ts`
- `src/lib/matrix-options/substanceLibrary.ts`
- `src/lib/matrix-options/substanceApplicability.ts`
- `src/lib/matrix-options/__tests__/substanceLibrary.test.ts`
- narrowly related Matrix Options tests

Expected patch:

1. Add `'organomercury'` to `ContaminantClass`.
2. Add `phenylmercuric_acetate` to `SUBSTANCE_LIBRARY` with:
   - display name `Phenylmercuric acetate`
   - contaminant class `organomercury`
   - oral RfD `0.00008`
   - no oral slope factor
   - no eco fields unless separately approved
   - owner-approved `abs_dermal`
   - conservative `ba_oral` only if owner accepts the standard build-first convention
3. Add `organomercury` to the no-logKow eco-direct not-applicable branch in
   `substanceApplicability.ts`, unless owner explicitly wants an organic/logKow route.
4. Add tests asserting the entry, class, RfD, `abs_dermal`, and HH selectability.

Forbidden:

- Do not edit `matrix_research/reference_catalog/**`.
- Do not edit `src/data/**`.
- Do not change `qa_status` or `default_status`.
- Do not backfill this value onto `mercury_inorganic` or `methylmercury`.

## Owner Decision Needed

Pick the `abs_dermal` policy for `phenylmercuric_acetate`.

Recommended framing:

- `0.1`: treats it like the existing pragmatic organic/organometallic own-key entries.
- `0.03`: conservative lower dermal absorption convention used by some non-organic classes.
- `0.001`: metal-class dermal default, likely semantically wrong for organomercury but more conservative in
  dermal uptake terms.
- custom value: requires source support.

Until this is decided, the correct autonomous action is to leave code unchanged.
