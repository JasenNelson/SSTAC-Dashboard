# Matrix Options Organomercury Packet - 2026-07-08

## Verdict

Do not implement `phenylmercuric_acetate` wiring yet without two owner decisions:
1. The `abs_dermal` value (load-bearing in the human-health direct-contact calculator).
2. The implementation strategy (existing `organic` class vs new `organomercury` class).

Choosing these silently would create a hidden policy decision.

## Current Facts

- `phenylmercuric_acetate` is not present in `src/lib/matrix-options/substanceLibrary.ts`.
- It is present in the IRIS provenance snapshot at
  `src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json:8579`.
- Approved source rows exist in `matrix_research/reference_catalog/human_health_trv_values.json`:
  - `pv-iris-phenylmercuric_acetate-hh-direct-rfd`, value `0.00008`, unit `mg/kg-bw/day`,
    `qa_status: approved`, `default_status: available_option`.
  - `pv-iris-phenylmercuric_acetate-hh-food-rfd`, value `0.00008`, unit `mg/kg-bw/day`,
    `qa_status: approved`, `default_status: available_option`.
- Prior owner decision docs record the class direction:
  - `docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md:81` says
    `phenylmercuric_acetate | organomercury`.
  - `FRESH_SESSION_HANDOFF_2026_07_07b_PHASE_B_SHIPPED.md:104-106` says the owner approved a new
    `organomercury` `ContaminantClass`.

## Organometallic Code Precedent

Before adding `phenylmercuric_acetate`, we must observe how existing organometallics are handled in `src/lib/matrix-options/substanceLibrary.ts`:

- **Tetraethyl lead:** Lines 7445-7462
- **Tributyltin oxide (TBTO):** Lines 7471-7485

Both share the exact same structural pattern:
- `contaminantClass: 'organic'`
- `abs_dermal: 0.1`
- `ba_oral: 1.0`
- **Notes Pattern:** Explicitly documents the pragmatic use of the `organic` class.
  *(e.g., "contaminantClass organic is a pragmatic bucket for this Pb-C organometallic... NOT elemental lead. abs_dermal 0.1 = organic class default...")*

## Implementation Options Comparison

Because of the precedent above, there are two distinct implementation paths for `phenylmercuric_acetate`.

### Option A1: Pragmatic `organic` Bucket
This aligns exactly with the `tetraethyl_lead` and `tributyltin_oxide_tbto` precedent.
- **Files Touched:** `src/lib/matrix-options/substanceLibrary.ts` and `src/lib/matrix-options/__tests__/substanceLibrary.test.ts`.
- **Risk:** Low. Strictly additive library entry without mutating the underlying calculator logic or union types.
- **Test Implications:** Simple library entry validation.

### Option A2: New `organomercury` Class (Original Proposal)
This introduces formal structural separation but requires broader system wiring. `ContaminantClass` currently includes: `organic`, `organic-PAH`, `organic-halogenated`, `divalent-metal`, `methyl-Hg`, `metalloid`, and `inorganic`.
- **Files Touched:** `src/lib/matrix-options/types.ts`, `src/lib/matrix-options/substanceApplicability.ts`, `substanceLibrary.ts`, and tests.
- **Risk:** Broader. Modifies the `ContaminantClass` union type and requires new routing logic in the applicability tree.
- **Test Implications:** Requires testing new applicability branches alongside the library entry.

## Safe Implementation After Owner Decision

Allowed files:
- `src/lib/matrix-options/types.ts` (if Option A2)
- `src/lib/matrix-options/substanceLibrary.ts`
- `src/lib/matrix-options/substanceApplicability.ts` (if Option A2)
- `src/lib/matrix-options/__tests__/substanceLibrary.test.ts`
- narrowly related Matrix Options tests

Expected patch:
1. *(If Option A2)* Add `'organomercury'` to `ContaminantClass`.
2. Add `phenylmercuric_acetate` to `SUBSTANCE_LIBRARY` with:
   - display name `Phenylmercuric acetate`
   - contaminant class (chosen Option A1 or A2)
   - oral RfD `0.00008`
   - no oral slope factor
   - no eco fields unless separately approved
   - owner-approved `abs_dermal`
   - conservative `ba_oral` only if owner accepts the standard build-first convention
3. *(If Option A2)* Add `organomercury` to the no-logKow eco-direct not-applicable branch in `substanceApplicability.ts`.
4. Add tests asserting the entry, class, RfD, `abs_dermal`, and HH selectability.

Forbidden:
- Do not edit `matrix_research/reference_catalog/**`.
- Do not edit `src/data/**`.
- Do not change `qa_status` or `default_status`.
- Do not backfill this value onto `mercury_inorganic` or `methylmercury`.

## Owner Decision Needed

1. **Pick the Implementation Strategy:** Option A1 (`organic` bucket) vs Option A2 (`organomercury` class).
2. **Pick the `abs_dermal` policy** for `phenylmercuric_acetate`. Recommended framing:
   - `0.1`: treats it like the existing pragmatic organic/organometallic own-key entries.
   - `0.03`: conservative lower dermal absorption convention used by some non-organic classes.
   - `0.001`: metal-class dermal default, likely semantically wrong for organomercury but more conservative in dermal uptake terms.
   - custom value: requires source support.

Until this is decided, the correct autonomous action is to leave code unchanged.
