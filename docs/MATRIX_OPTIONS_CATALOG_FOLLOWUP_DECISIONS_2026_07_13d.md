# Matrix Options -- Catalog Follow-up Decisions (2026-07-13d)

Owner-ruled, protective-neutral catalog metadata changes. NO current_default changes, NO
toxicity/FCV value changes (except the endosulfan LIBRARY seed). No calculator output changes.

## C2 -- benzo_a_pyrene cancer slope factor: Option B (tag now, keep EPA 2.0 anchor)

**Owner ruling (2026-07-13d):** add ADAF scenario tags now; KEEP the current EPA 2.0
(ADAF-baked/lifetime) value as the active/default cancer slope factor. Do NOT flip the
headline/default anchor to HC 1.289 yet.

**Why (primary-source verified, `MATRIX_OPTIONS_ADAF_BAP_EXPLAINER_2026_07_07.md`):** HC v4.0
1.289 is an **adult-based, non-ADAF-embedded** slope factor -- structurally analogous to EPA's
**1.0**, NOT EPA's 2.0. EPA 2.0 has ADAFs baked in via standard lifetime (0-70yr) exposure-duration
weighting. Anchoring the default on 1.289 would make the headline BaP cancer SF adult-only, and
using it correctly REQUIRES applying age-bin ADAFs (10/3/1) for any early-life (<16y) exposure.
The ADAF machinery exists (`adafTable.ts` + `computeBaPeq`) but **has no caller yet**
(`applyAdaf: true` is unused). So flipping the anchor to 1.289 without ADAF application wiring would,
by default, UNDERESTIMATE child-inclusive cancer risk by up to 10x. Option B avoids that regression.

**What changed here (metadata only):** the active default scaffold rows `pv-bap-hh-direct-slope`
and `pv-bap-hh-food-slope` (value 2.0) now carry `adaf_stage:embedded_do_not_reapply`, matching the
already-tagged `pv-iris-bap-*-sf` (2.0, embedded) and consistent with the `pv-hc-bap-*-sf` rows
(1.289, `adaf_stage:adult_base_apply_on_top`). This makes the adult-only vs lifetime-ADAF distinction
explicit so the two are not conflated. No value/default_status changed. (`pv-p28-bap-*-slope`, the
lead-surrogate 7.3 rows, are left untagged pending verification of their ADAF basis.)

**FOLLOW-UP ITEM (gated):** HC 1.289 can become the default BaP cancer SF **only after** the
calculator/QP ADAF application path is implemented and tested (a `computeBaPeq` caller with
`applyAdaf: true`, or an equivalent age-bin duration-weighting path, plus tests). Until then EPA 2.0
stays the default. This is a separate packet.

## C1 -- PCB Total-PCBs consolidation: Option A safe subset (notes/convention only)

**Owner ruling (2026-07-13d):** proceed with the safe protective-neutral subset only --
alias/deprecation notes + non-additive convention. NO value migration, NO protectiveness-sensitive
default change without a separate packet.

**What changed here (notes only):**
- `total_pcbs_aroclor_1254` notes now state it is the CANONICAL "Total PCBs" row (Option A), and
  that Total-PCBs and Aroclor/congener-specific rows are alternative representations that MUST NEVER
  be summed (non-additive convention).
- `polychlorinated_biphenyls_total_pcbs` notes now mark it a DEPRECATED ALIAS of the canonical
  row; the entry is RETAINED (not deleted); never sum with the canonical (non-additive).
- No numeric field, key, or default_status changed on either entry.

**FOLLOW-UP ITEM (gated):** the catalog-row value-migration/re-keying of the alias's owned records
(its eco FCV row + BC Protocol 28 HH RfD rows) remains a SEPARATE deferred packet. Per the PCB
decision brief, that migration is protectiveness-sensitive (EqP sediment-benchmark caveat: the shared
0.014 ug/L water FCV with logKow 6.5 yields a less-stringent benchmark and must be checked against
the site congener profile) -- it is NOT mechanical and must not be done without a dedicated packet.

## Endosulfan -- library FCV seed (corrected operation)

**Owner ruling (2026-07-13d):** approve the corrected library FCV seed only; do NOT set eco catalog
current_default (that would violate the `eco-catalog-load` invariant that all `eco_values.json` rows
are `available_option`).

**What changed:** `substanceLibrary.ts` endosulfan_alpha + endosulfan_beta `fcv_ug_per_L` null ->
0.056 (EPA NRWQC, matching the two approved available_option eco rows). `eco_values.json` is
UNCHANGED (invariant preserved). The calculator resolves the FCV via the library seed; the eco
catalog defaults stay dynamically resolved.

## Sodium_ion -- deferred

Per owner (2026-07-13d): defer; do NOT set current_default. The base (34.3) vs water-adjusted (21.2)
derivation basis needs a design decision because a tuple-scoped current_default cannot express
route-specific selection (both share `input_key` + pathway). See
`MATRIX_OPTIONS_OWNER_FOLLOWUP_2026_07_13d.md` (PR #637).
