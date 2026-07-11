# MATRIX OPTIONS INHALATION MODEL DECISION PACKET

This is a SINGLE owner-decision packet consolidating the 3 existing inhalation docs (MATRIX_OPTIONS_INHALATION_SCHEMA_PACKET_2026_07_08.md, MATRIX_OPTIONS_INHALATION_PACKET_2026_07_09.md, MATRIX_OPTIONS_INHALATION_IMPLEMENTATION_PLAN_2026_07_09.md) into ONE decision. Note this packet SUPERSEDES their scattered owner-decision lists for the VF/PEF question.

## CURRENT STATE
- Fields `rfc_inhalation_mg_per_m3` and `iur_inhalation_per_mg_per_m3` exist on `SubstanceEntry` (nullable).
- Stub `deriveInhalationStandards` returns `blocked=true`, `nonCancerBlocked=true`, and `cancerBlocked=true` unconditionally.
- 0/425 substances populated with values.
- Not wired into `derivations.ts` or any dispatch table.
- 97 needs_review candidate rows (75 RfC + 22 IUR) are waiting in the provenance layer.

## THE DECISION
The inhalation pathway requires turning a soil/sediment concentration into an air concentration using a volatilization factor (VF) and/or particulate emission factor (PEF). Three architecturally distinct options exist:

### Option A: Dynamic/derived VF-PEF (compute from soil/sediment properties + site params)
- **What it needs:** A transport-model equation (e.g. EPA Johnson & Ettinger or soil screening VFss/PEF equations) plus site/soil inputs (organic carbon fraction, bulk density, porosity, etc.).
- **Primary source required:** A named transport-model guidance document.
- **Pros:** Most technically defensible; adapts per site/soil; matches regulatory frameworks.
- **Cons:** Largest scope; needs new per-substance physicochemical properties (Henry's constant, diffusion coefficients) and a new site-input UI surface. Highest primary-source research burden.
- **Fail-closed behavior:** Must block per-substance (missing properties) and potentially per-site (missing soil parameters).

### Option B: User-supplied VF-PEF (the QP enters site-specific values)
- **What it needs:** Numeric VF and/or PEF input field(s) added to `HumanHealthInhalationInput`.
- **Primary source required:** None for the calculator (QP justifies their entered value outside the tool).
- **Pros:** Smallest engineering scope; consistent with existing "QP owns site-specific professional judgment" posture; unblocks quickly.
- **Cons:** Shifts defensibility burden entirely onto the QP with no tool-side sanity check; risk of silently-wrong values; least automatable.
- **Fail-closed behavior:** Blocks until the QP fills the field in (similar to current null-RfC/IUR gate).

### Option C: Hardcoded default VF-PEF (a single conservative default)
- **What it needs:** One conservative default VF and PEF constant(s) drawn from a specific named guidance document, applied uniformly.
- **Primary source required:** A single named regulatory default.
- **Pros:** Unblocks the calculator with the least ongoing per-calculation research burden; matches many screening-level frameworks.
- **Cons:** Least site-specific / most conservative; a wrong or stale default is a silent-error risk across every substance; may not be defensible for sediment-specific contexts if derived for soil.
- **Fail-closed behavior:** No missing-input fail-closed case for VF/PEF itself (it's a constant); blocks only on null-RfC/IUR. A wrong constant is not caught by fail-closed logic.

## ORCHESTRATOR SEQUENCING RECOMMENDATION
**ENGINEERING SEQUENCING recommendation (NOT a regulatory determination):** Recommend v1 = Option B (user-supplied VF/PEF) because it needs NO transport-model primary source and is fully fail-closed (blocks if the QP omits values), so it unblocks a functioning inhalation calculator soonest. Option C (hardcoded default) requires the owner to name a conservative default source; Option A (dynamic/derived) requires the full VF/PEF transport model + its primary source and is the largest effort -- defer to a later lane. This sequencing does NOT choose a regulatory value; the owner still names the anchoring guidance and any default. The owner may override this sequencing.

## THE PRIMARY-SOURCE ASK
The owner must answer which guidance anchors VF/PEF (EPA J&E / RAGS Part F family vs Health Canada vs BC-specific) -- none currently referenced in-repo.

## PREREQUISITE (T33)
The unit-basis boundary (catalog IUR per-ug/m3 vs library field per-mg/m3, x1000) must be settled before ANY of the 22 IUR rows can be promoted -- cross-reference T33.

## WHAT IS BLOCKED
- The `HHInhalationCalculator` cannot compute a single value until the VF/PEF model decision is made.
- Neither `HumanHealthDirectContactInput` nor `HumanHealthFoodWebInput` nor `derivations.ts` can be extended until the routing decision is confirmed as final by the owner.
- The 97 candidate rows (75 RfC, 22 IUR) cannot be promoted or wired into `SubstanceEntry` until the VF/PEF decision unblocks the calculator and the T33 unit-conversion boundary is settled.
- Data provenance confirmation and pathway-exclusion-by-jurisdiction UI questions remain open.
