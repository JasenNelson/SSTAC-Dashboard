# Matrix Options -- sodium_ion Route-Specific Selection: Design Packet (2026-07-14)

## Problem
sodium_ion has 4 catalog rows, ALL input_key `rfd_oral_mg_per_kg_bw_day`, all BC Protocol 28 v3.0, all `available_option`: base 34.3 (`pv-p28-sodium_ion-hh-direct-rfd`, `pv-p28-sodium_ion-hh-food-rfd`) vs water-adjusted 21.2 (`pv-p28-sodium_ion-hh-direct-rfd-um-ion-rfd-water`, `pv-p28-sodium_ion-hh-food-rfd-um-ion-rfd-water`). The resolver's `current_default` is scoped per `(substance_key, input_key, pathway)`; both values sit in the SAME tuple, so a single `current_default` can encode only ONE -- it CANNOT express "use 34.3 for scenario X, 21.2 for the water-influenced scenario Y." This is why the owner deferred picking a default.

## Why this differs from copper
Both sodium values come from the SAME source (P28 v3.0) and differ by DERIVATION BASIS (base vs drinking-water-influenced), not source hierarchy -- a substantive judgment, not a tiebreak.

## Design options for route-specific selection

*   **Option C1 (derivation-basis tag + resolver awareness):** Add a `derivation_basis` (or `route_variant`) field/assumption_tag to the catalog record (e.g. 'base' vs 'water_influenced') and let the resolver/calculator select per an exposure-scenario flag (does the scenario include a drinking-water pathway?).
    *   **Pros:** Expresses the real distinction.
    *   **Cons:** Schema + resolver change, needs a scenario input in the calculator UI.
*   **Option C2 (two distinct input_keys):** Split the tuple by giving the water-adjusted rows a distinct `input_key` (e.g. `rfd_oral_water_influenced`) so each has its own `current_default`.
    *   **Pros:** Reuses the existing `current_default` mechanism per tuple.
    *   **Cons:** Proliferates `input_keys`, calculator must know which to consume when.
*   **Option C3 (document-only, defer wiring):** Keep both as `available_option`, surface the two bases in the Evidence Library UI with an explicit note that the QP must pick per scenario, and set NO `current_default`.
    *   **Pros:** Zero schema/protectiveness risk now.
    *   **Cons:** No automated default.

## Recommendation
**C3 short-term** (make the ambiguity visible, no default), **C1 as the principled longer-term design** if route-specific automation is wanted. A single `current_default` (34.3 or 21.2) is NOT recommended -- it silently hides the base-vs-water distinction.

## Exact rows involved
*   `pv-p28-sodium_ion-hh-direct-rfd` (base 34.3)
*   `pv-p28-sodium_ion-hh-food-rfd` (base 34.3)
*   `pv-p28-sodium_ion-hh-direct-rfd-um-ion-rfd-water` (water-adjusted 21.2)
*   `pv-p28-sodium_ion-hh-food-rfd-um-ion-rfd-water` (water-adjusted 21.2)

**Blast radius / reversibility / stop boundary:** NO catalog mutation in this packet; any option is owner-gated.

## Approvals
Paste-ready approval line for each option:
`[ ] APPROVED: Option C1 (derivation-basis tag + resolver awareness)`
`[ ] APPROVED: Option C2 (two distinct input_keys)`
`[ ] APPROVED: Option C3 (document-only, defer wiring)`

## A note
If safe UI-only work is desired to surface the ambiguity (Option C3), it is a presentation change (no default mutation) and can be a separate small PR.
