# Matrix Options -- Owner Decision Follow-ups (2026-07-13d)

Records owner decisions + explanations from the 2026-07-13d approved batch. No code/data
changed by this doc.

## F. Security #22 -- dras_admin_all direct UPDATE: ACCEPT FOR v1

**Decision (owner, 2026-07-13d):** Accept for v1 and document. No trigger/migration work now.

**What it is:** The `dras_admin_all` RLS policy permits an admin to `UPDATE` `matrix_map.dras`
rows directly (including `public`), not only through the audited `flip_dra_public` RPC. A direct
admin UPDATE outside `flip_dra_public` would not be captured by that RPC's audit path.

**Why accept-for-v1 is reasonable:** The application's publish/unpublish flow goes through
`flip_dra_public` (admin JWT, audited). The direct-UPDATE surface is admin-only and not exercised
by the app UI. The residual risk is an admin making an out-of-band change that bypasses the RPC
audit -- low likelihood, admin-trusted, and visible in Postgres logs.

**Revisit trigger:** if DRA publication moves beyond the pilot to a broader/self-serve model, or if
an audit trail of ALL `dras` mutations (not just `flip_dra_public`) becomes a requirement, add a
trigger that logs/blocks non-`flip_dra_public` UPDATEs. Until then, no migration.

**Security lane status:** CLOSED for v1. #628 (hitl-packets admin gate + prioritization-matrix
HMAC pseudonymization + escapeCSV injection guard) and #634 (role-gate regression tests) are merged;
#22 is the only remaining role-model item and is now accepted-for-v1.

## C4b. sodium_ion -- why current_default cannot express the base-vs-water P28 choice

**Owner asked:** how does `current_default` interact with route-specific P28-water values (before
picking a sodium_ion default)?

**Verified catalog state (read-only):** sodium_ion has 4 rows, ALL `input_key =
rfd_oral_mg_per_kg_bw_day`, ALL from BC Protocol 28 v3.0, ALL `available_option`:

| pvid | pathway | value |
|------|---------|-------|
| pv-p28-sodium_ion-hh-direct-rfd | human-health-direct | 34.3 |
| pv-p28-sodium_ion-hh-direct-rfd-um-ion-rfd-water | human-health-direct | 21.2 |
| pv-p28-sodium_ion-hh-food-rfd | human-health-food | 34.3 |
| pv-p28-sodium_ion-hh-food-rfd-um-ion-rfd-water | human-health-food | 21.2 |

**The interaction (the crux):** `current_default` is scoped per
`(substance_key, input_key, pathway)` tuple. Both the base value (34.3) and the water-adjusted
value (21.2) share the SAME `input_key` (`rfd_oral_mg_per_kg_bw_day`) and pathway. So they sit in
the SAME tuple. Setting `current_default` therefore picks exactly ONE of {34.3, 21.2} as THE oral
RfD for that tuple -- it CANNOT express "use 34.3 for scenario X and 21.2 for the water-influenced
scenario Y." The route-specificity (base vs "um-ion-rfd-water", the drinking-water-influenced P28
derivation) is NOT captured by `input_key`/`pathway`, so it is invisible to the resolver's
tuple-scoped default mechanism.

**Why this differs from copper:** copper's chosen default (HC v4.0 0.426) came from a DIFFERENT,
higher-precedence source than its P28 alternates, so picking it is a clear source-hierarchy call.
sodium_ion's two candidates are BOTH from the SAME authoritative source (P28 v3.0) and differ only
by derivation BASIS (base vs water-adjusted). That is a substantive toxicological/exposure judgment,
not a source-hierarchy tiebreak -- which is exactly why it was correctly deferred.

**Options for the owner (when ready):**
- A) current_default = 34.3 (base P28 oral RfD) -- if the base derivation governs the calculator's
  exposure scenarios.
- B) current_default = 21.2 (water-adjusted) -- if the drinking-water-influenced derivation is the
  intended governing value.
- C) If BOTH must apply route-specifically (34.3 for some routes, 21.2 for others), that CANNOT be
  expressed by a single tuple-scoped `current_default`; it would require a schema change
  (a route/derivation-basis dimension on the tuple) -- a larger design item, not a default flip.

**Recommendation:** pick A or B if one derivation basis governs; escalate to option C's design item
only if route-specific selection is genuinely required. No apply until the owner rules.

## Related deferred findings (from PR #636, for owner awareness)
- **endosulfan_alpha/beta**: the approved "set eco current_default" op conflicts with the deliberate
  `eco-catalog-load` invariant (all `eco_values.json` rows are `available_option`, not wired into
  the resolver). Correct fix = a library `fcv` seed (0.056) -- a DIFFERENT op than approved. Awaiting
  owner confirmation to apply the library-seed fix.
- **benzo_a_pyrene FOOD RfD**: left `available_option` to preserve the `defaultSelectionPolicy`
  manual-decision behavioral test (which uses benzo food RfD as its multi-top-ranked example). The
  calculator resolves both pathways via the library seed 0.0003; flipping the food catalog default
  would require repointing that test.
