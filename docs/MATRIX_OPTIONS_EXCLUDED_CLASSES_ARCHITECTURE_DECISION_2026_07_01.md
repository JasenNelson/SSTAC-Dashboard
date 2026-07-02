<!-- Authored 2026-07-01 (autonomous overnight). DECISION BRIEF for the excluded-classes lane. No code/value/catalog change made -- this is the one architecture decision + execution plan the owner needs to approve before the 37 excluded metal/inorganic substances can be wired. Companion to docs/MATRIX_OPTIONS_EXCLUDED_CLASSES_PROPOSAL_2026_07_01.md (per-substance) and _VALUE_RECONCILIATION_ (values). Plain ASCII. -->

# Excluded-Classes Lane -- Architecture Decision Brief

## The one decision to make

The 37 excluded substances (metals salts, cyanides, oxyanions, DBP species, reactive gases,
organometallics) all have an approved oral RfD but do not fit the organic wiring template. The only
blocking question is: **what `contaminantClass` do they carry?**

### Ground truth (verified in code)
`ContaminantClass` (`src/lib/matrix-options/types.ts:5-11`) is a closed union of 6 values:
`organic | organic-PAH | organic-halogenated | divalent-metal | methyl-Hg | metalloid`.

`derivations.ts` only BRANCHES on two of them: `organic-PAH` (applies the coastal-marine M_eco
biomagnification multiplier + PAH BSAF handling) and `methyl-Hg` (special-case). **Every other class
falls through the same default path: M_eco = 1 and standard dermal derivation via `abs_dermal`.** So
at calc time, `organic`, `organic-halogenated`, `divalent-metal`, and `metalloid` are already
behaviorally identical; the class is descriptive metadata, not a computation switch (except PAH/MeHg).

### Options
- **Option A -- reuse the metal catch-all (ZERO code change).** Wire cyanides/oxyanions/gases as
  `divalent-metal` or `metalloid`. Works today (they hit the default path). Downside: semantically
  wrong labels (sodium cyanide is not a "divalent metal"); future readers/maintainers misled.
- **Option B (RECOMMENDED) -- add one value `'inorganic'` to the union.** One-line change in
  `types.ts` (`| 'inorganic'`). Because `derivations.ts` routes every non-PAH/non-MeHg class through
  the default, `'inorganic'` needs NO derivation logic -- it inherits M_eco=1 + standard dermal
  automatically. Cost: the 1-line union edit + a grep for any exhaustive `switch`/never-check on
  ContaminantClass (there is none that would break; the class comparisons are `if/else if` chains
  with a default). Cleaner semantics, honest labels, trivial risk.

**Recommendation: Option B.** Add `'inorganic'`; class the cyanides/oxyanions/DBP/gases/simple
inorganic salts as `inorganic`; keep genuine metal cations as `divalent-metal`/`metalloid`;
organometallics get their own call (see below). Confirm no exhaustiveness break, add one derivations
test that an `inorganic` entry derives with M_eco=1.

## Execution plan (once Option B is approved)

Wire in cohorts using the same HH-only template as the organic lane (rfd from catalog, HH-only nulls,
`ba_oral` 1.0), with these class/abs_dermal calls and the per-substance exceptions from the
proposal doc:

1. **Clean new inorganic keys (no overlap)** -- straightforward `inorganic` wiring: bromate,
   chlorite_sodium_salt, monochloramine, perchlorate, nitrate, nitrite, ammonium_sulfamate,
   fluorine_soluble_fluoride, white_phosphorus, sodium_azide, cyanogen, cyanogen_bromide,
   chlorine_cyanide, calcium/potassium/sodium/copper/silver cyanide (see cyanide dedup below),
   chlorine (confirm sediment-matrix relevance).
2. **Backfill candidates (HITL sign-off each -- fills an existing null-RfD key, does NOT add a key):**
   mercuric_chloride_hgcl2 -> `mercury_inorganic`; selenious_acid -> `selenium`;
   uranium_soluble_salts -> `uranium`; the nickel salts -> `nickel` (pick ONE: source-priority
   HC/ECCC > US EPA; the three are chloride 0.0013 HC / soluble-salts 0.02 EPA / sulfate 0.012 HC).
3. **Do-NOT-conflate (own key, never backfill the inorganic parent):** tetraethyl_lead (organolead,
   1e-7, ~35000x more stringent than `lead`), tributyltin_oxide_tbto (organotin, ~2000x vs `tin`),
   aluminum_phosphide (phosphide-driven, ~2500x vs `aluminum`). Class call: organometallics have real
   logKow -> arguably `organic`, but HH-only wiring nulls logKow anyway, so `inorganic` or `organic`
   both compute identically; recommend `organic` for the two organometal(loid)s (honest chemistry),
   `inorganic` for aluminum_phosphide.
4. **Cyanide dedup/speciation (HITL):** cyanide_free (0.00063) vs hydrogen_cyanide_and_cyanide_salts
   (0.0006 umbrella) overlap; the silver trio (silver 0.005 / silver_cyanide 0.1 / potassium_silver_
   cyanide 0.005) needs a selection convention so users pick the right key.
5. **HITL-deferred (do not wire without a policy call):** pcbs_non_coplanar (overlaps
   total_pcbs_aroclor_1254; needs a PCB congener-grouping policy), phenylmercuric_acetate
   (organomercury -- neither methyl-Hg nor clean divalent).

## zineb -- routing resolved

`zineb` (zinc ethylenebis(dithiocarbamate), oral RfD 0.05) landed in the metal-exclusion list because
of its Zn center, but it is a dithiocarbamate FUNGICIDE whose chemistry is predominantly organic --
directly analogous to `thiram` (tetramethylthiuram disulfide), which the organic lane wired as
`organic`. Its logKow is low/poorly-defined, but HH-only wiring nulls logKow (eco filtered) so the
class is non-computational here. **Recommendation: class `zineb` as `organic`, wire via the standard
HH-only template** (it does not need Option B). This is a 1-substance follow-on to the organic lane,
not part of the inorganic decision.

## Not an architecture issue -- 2 recon-generator display bugs (separate small fix)

The "chlorine_dioxide / phosphine labeled inhalation RfC but stored in oral units" flags are NOT
catalog defects (the source catalog is correctly labeled -- confirmed in the value-reconciliation
pass). They are a display bug in `scripts/matrix-options/wire-recon.mjs`, which collapses per-endpoint
`display_name`s onto one substance-level field, so an RfC label can appear next to an RfD value. Fix
the recon generator to keep per-endpoint labels before the next recon-driven wiring pass; spot-check
other substances that have both an RfD and an RfC row. Both chlorine_dioxide (0.03) and phosphine
(0.0003) are genuine US EPA IRIS oral RfDs and wire normally under Option B.

## Summary for the owner
1. Approve **Option B** (add `'inorganic'` to ContaminantClass) -- trivial, clean.
2. Then the 37 wire in ~2 cohort batches via the existing template, EXCEPT the backfills, cyanide
   dedup, organometallics, and 2 HITL-deferred items, which need the per-substance calls above.
3. `zineb` -> `organic`, standalone. The 2 RfC "defects" are a recon-generator display fix, not a
   value problem.
