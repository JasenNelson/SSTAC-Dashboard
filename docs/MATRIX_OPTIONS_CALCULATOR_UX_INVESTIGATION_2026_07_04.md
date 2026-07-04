# Matrix-Options Calculator UX Investigation + Recommendations (2026-07-04)

Investigation of three owner-raised concerns in the Matrix-Options calculators, with options and
recommendations for each. Feeds a `/codex-review` (codex is invited to propose its own / hybrid options).
All findings are code-grounded (file:line in the Evidence sections). Plain ASCII.

Scope: (1) the substance dropdown ("very limited set of options"); (2) the regulatory-frame control
("still awkward"); (3) the eco food-web wildlife-receptor set (bird/mammal only; "missing fish, plants,
invertebrates").

---

## 1. Substance dropdown -- "very limited set of available options"

### What it actually is
The substance dropdown is a single shared `<select>` (`SharedGlobalInputs.tsx:114-126`) that renders the
FULL 414-entry `SUBSTANCE_LIBRARY` with NO filter. It is global state (independent of frame and pathway).
So the dropdown itself is not over-restricted -- it already shows every substance.

The "limited options" perception is one (or both) of:
- **(A) Eco-pathway computability gates.** Inside the calculators, substances are gated by whether the
  pathway can compute them: Eco-Direct (EqP) HARD-BLOCKS any substance with `logKow === null`
  (`EcoDirectEqPCalculator.tsx:174-178`) -> only ~50 of 414 substances are usable on EqP. Eco-Food (BSAF)
  needs a library BSAF (only 3/414) or a dynamic catalog TRV. HH pathways need rfd_oral (356/414) or
  sf_oral (54/414). So on the ECO tabs, most substances silently return "not applicable."
- **(B) The frame-coupled RECEPTOR dropdown** (a DIFFERENT control) in Eco-Food, which filters by
  (substance, frame) and can show as few as 0-1 options (`EcoFoodBSAFCalculator.tsx:158-171`).
- **(C) UX**: a ~400-item native `<select>` with no type-to-search, no grouping -- hard to navigate even
  though everything is present.

### Options
- **1a. Combobox + grouping (UX).** Replace the native `<select>` with a type-to-filter combobox and/or
  `<optgroup>` by `contaminantClass`. Makes the full library discoverable. Low risk, high value.
- **1b. Per-pathway applicability badges.** In the substance option list (or a side indicator), mark which
  pathways each substance can compute (e.g. badge "EqP n/a" for null-logKow) so "not applicable" is
  visible BEFORE selection, not a post-hoc error.
- **1c. Relax the EqP logKow hard-gate.** Allow manual logKow entry on Eco-Direct (mirroring the already-
  relaxed BSAF manual path, `EcoFoodBSAFCalculator.tsx:258-269`) so a null-logKow substance is not a dead
  end. Lifts the eco-direct usable set from ~50 toward the full library. Medium effort; needs a UX for
  user-entered logKow + a provenance note that it is user-supplied.
- **1d. Backfill library eco fields.** Only 1/414 has a library fcv, 3/414 a bsaf -- broader coverage (or
  fuller reliance on the dynamic catalog resolver) widens eco computability. Data effort (owner-gated).

### Recommendation
Do **1a (combobox + optgroup)** first -- it directly addresses "hard to find substances" at near-zero
risk. Add **1b (applicability badges)** so the eco "not applicable" surprise is pre-empted. Treat **1c**
(relax EqP logKow gate) as the substantive follow-up if the real complaint is "too few substances compute
on Eco-Direct." Confirm with the owner WHICH tab they were on when they saw "limited options" -- that
disambiguates dropdown-UX (1a/1b) vs eco-computability (1c/1d).

---

## 2. Regulatory frame -- "still awkward"

### What it actually does
One global `<select>` labeled "Regulatory frame" (`SharedGlobalInputs.tsx:138-166`), persisted to
localStorage, fanned out to all four calculators (`MatrixDashboard.tsx:821-865`). Selecting a frame drives
FOUR distinct mechanisms (`regulatoryFrames.ts`, `defaultSelectionPolicy.ts`):
(a) source-priority ranking (HC vs IRIS vs BC per BC Protocol 1 s4.4 hierarchy);
(b) per-(frame x pathway) applicability gating (calculation_ready / needs_review / reference_only /
   unsupported);
(c) eco catalog jurisdiction eligibility (which rows are even visible);
(d) default-value seed selection.
For ECO pathways, an `unsupported`/`reference_only` frame BLANKS the output (the #449 static-fallback
suppression); for HH/background pathways the same frame change does NOT blank -- it only changes offered
seeds. Every current frame's `safeUseNote` admits it "changes lookup eligibility and warnings, not the
current calculator defaults yet" (`regulatoryFrames.ts:161`; `FRAME_VARIANTS` is intentionally empty).

### Why it feels awkward (diagnosed)
1. One global control silently reshapes four calculators' outputs with no confirmation at the output.
2. Inconsistent per-pathway response: blanks eco outputs, no-ops HH (`RegulatoryFrameNotice.tsx:41`).
3. Label promises a regulatory RESULT ("give me the CCME number") but the mechanism is source-plumbing +
   applicability warnings + seed selection -- an expectation/reality gap.
4. `unsupported` -> blank output reads as a bug, not an intentional "this body does not cover this pathway."
5. Terminology overload: `jurisdiction` is BOTH the deprecated name for the frame (props/state/localStorage)
   AND the live provenance field (`CatalogJurisdiction`).
6. Two competing notices can render at once (`RegulatoryFrameNotice` + `FrameVariantFallbackNotice`).

### Options
- **2a. Reframe the label + inline explainer.** Rename to something like "Regulatory context (source
  hierarchy + coverage)" and put a persistent one-line "what changing this does" explainer next to it.
  Cheapest; addresses the expectation gap (#3) directly.
- **2b. Make the per-pathway effect explicit + consistent.** At each calculator output, always render the
  frame's applicability state (pill + one line), and for eco make "output intentionally blank because
  <frame> does not cover this pathway" an explicit, styled empty-state (not a bare blank). Fixes #2/#4.
- **2c. Terminology cleanup.** Rename the component-layer `jurisdiction` prop/state/localStorage-key to
  `regulatoryFrame`/`frameId`; keep the deprecated alias for provenance `CatalogJurisdiction`. Mechanical
  but removes a real cognitive-overload source (#5). Touches ~15 files.
- **2d. Surface the source hierarchy.** Expose the frame's tiered `sourceHierarchy` + `conflictRule` (today
  almost entirely hidden) in an expandable panel so the user sees WHAT is being modeled, not just a label.
- **2e. Per-pathway frame (bigger).** Consider whether a single GLOBAL frame is right, or whether each
  calculator tab should carry its own frame (since a user often works one pathway at a time and the global
  control's cross-pathway effects are the core surprise). Larger refactor; may be over-engineering.
- **2f. Consolidate the two notices** into one frame-status component.

### Recommendation
**2a + 2b + 2f** as the near-term fix (label/explainer + consistent, explicit per-pathway effect +
single notice) -- these directly kill the "awkward/looks-broken" feeling at modest cost. Do **2c**
(terminology) as a clean-up PR. Hold **2d** (hierarchy panel) as a nice-to-have. Flag **2e** (per-pathway
frame) as an open architecture question for owner + codex -- it is the highest-leverage but highest-risk
change and should not be done without a deliberate decision.

---

## 3. Eco food-web wildlife receptors -- bird/mammal only, "missing fish/plants/invertebrates"

### What it actually is -- BY DESIGN, not a gap
The Eco-Food (BSAF) pathway is the DIETARY-DOSE WILDLIFE TRV pathway: it models birds and mammals that
CONSUME contaminated aquatic biota, using a dose TRV (mg/kg-bw/day) back-calculated to a sediment standard
via a bioaccumulation factor (BSAF) + receptor intake (body weight, ingestion rate). `EcoReceptor =
'mammal' | 'bird'` (`ecoSeed.ts:22`); the generator HARD-GUARDS food-bsaf rows to receptor mammal|bird
(`generate-eco-catalog-records.mjs:210-212`); the sole source is FCSAP ERA Module 7 wildlife TRVs.

Fish, benthic invertebrates, and aquatic plants are AQUATIC LIFE -- protected by the SEPARATE Eco-Direct
(EqP) pathway via a water-column Final Chronic Value partitioned to sediment (equilibrium partitioning).
Every eco-direct catalog row is tagged `species_groups: ['benthic invertebrate','fish','aquatic plant']`
+ `receptor_groups: ['aquatic life']` (`generate-eco-catalog-records.mjs:201-207`; eco_values.json).

This is the standard BC/CCME/FCSAP ecological-risk structure (wildlife consumers vs aquatic-life receptors)
and reflects toxicological reality: there are essentially NO dose-based (mg/kg-bw/day) TRVs for fish/plants/
invertebrates -- those taxa are assessed by water/tissue concentration, not dietary dose. A "fish food-web
TRV" is not a meaningful quantity, and the BW/IR intake terms have no meaning for those taxa.

### The actual bug: misleading UX
- The Eco-Food calculator's own title reads "Eco-Food (BSAF) -- Wildlife / **Fish** Receptor"
  (`EcoFoodBSAFCalculator.tsx:443`). The word "Fish" is misleading: fish appear here as the BSAF PREY, not
  as a protected receptor. This is likely what led to the "why only bird/mammal, where are fish" question.
- The receptor help text does not explain WHY only bird/mammal, nor point to where fish/inverts/plants ARE
  covered.

### Options
- **3a. Relabel + explain (recommended).** Retitle to "Eco-Food (BSAF) -- Wildlife consumers (bird/mammal)"
  (drop the misleading "/Fish"); add a note: "Fish, invertebrates, and aquatic plants are assessed as
  aquatic life in the Eco-Direct (EqP) tab." Cross-reference the two pathways in the UI.
- **3b. Do NOT add fish/invert/plant to the food-web receptor list.** It would be scientifically incorrect
  (no dose TRVs; intake model undefined) and require inventing data absent from the source frameworks.
- **3c. (Optional) A pathway-picker framing** that presents "which receptors do you want to protect?" and
  routes wildlife -> Eco-Food, aquatic life -> Eco-Direct, so the split is explicit by construction.

### Recommendation
**3a (relabel + cross-reference), and explicitly 3b (do not add the taxa).** The gap is perceptual; the fix
is clarity. 3c is a nice future framing if the two eco pathways are ever unified under one entry point.

---

## Cross-cutting theme
All three concerns share one root cause: the calculators enforce rich, correct domain logic (pathway
applicability, source hierarchy, receptor/pathway pairing) but SURFACE it poorly -- silent "not applicable"
errors, hidden source hierarchies, and a misleading receptor title. The highest-value work is UX/labeling
that makes the existing (correct) logic legible, NOT changing the underlying model. The one genuine
model/data question is 1c (relax the EqP logKow gate) + 1d (eco field backfill); the one genuine
architecture question is 2e (global vs per-pathway frame).

## Open questions for codex / owner
- Which tab was the owner on when they saw "limited options" (disambiguates 1a/1b UX vs 1c/1d eco-compute)?
- Is a single global regulatory frame the right model, or per-pathway (2e)?
- Is relaxing the EqP logKow hard-gate (1c) desirable, or is "not applicable" the correct honest state?

## Evidence (key file:line)
- Substance dropdown: `SharedGlobalInputs.tsx:40-44,114-126`; `substanceLibrary.ts:10`;
  `MatrixDashboard.tsx:316,821-850`; EqP gate `EcoDirectEqPCalculator.tsx:174-178`; BSAF gate
  `EcoFoodBSAFCalculator.tsx:158-171,258-269`.
- Regulatory frame: `SharedGlobalInputs.tsx:138-166`; `regulatoryFrames.ts:37-48,147-397,455-478`;
  `defaultSelectionPolicy.ts:81-96,127-143,165-243,340-345`; `frameDefaults.ts:46-48`;
  `frameVariants.ts:5`; `RegulatoryFrameNotice.tsx:41-92`; `FrameVariantFallbackNotice.tsx:76-103`;
  `MatrixDashboard.tsx:125,185-191,319,357-359,821-865`; `guide/content/jurisdictions.ts:1-10,58-85`.
- Eco receptors: `ecoSeed.ts:21-22,85-93`; `EcoFoodBSAFCalculator.tsx:76-81,158-184,443,515-541`;
  `EcoDirectEqPCalculator.tsx:81-110`; `generate-eco-catalog-records.mjs:76,200-219`; eco_values.json
  (52 direct rows aquatic-life species_groups; 47 food rows mammal/bird).

---

## v2 -- codex-review revisions (2026-07-04, mutual-agreement)

codex verified the findings against the code. It CONFIRMED the two load-bearing conclusions: the substance
dropdown is not filtered (all 414 shown), and the eco receptor bird/mammal-only design is correct (do NOT
add fish/plants/inverts). Verdict NEEDS-REVISION with these accepted corrections/additions:

1. **1c EqP logKow gate -- risk correction (ACCEPTED).** For metals/ionic/PFAS, `logKow === null` means
   "EqP scientifically NOT applicable," not "data missing." Do NOT frame 1c as lifting EqP toward all 414.
   Restrict any relaxation to a SOURCE-BACKED override for NONIONIC ORGANICS where the method applies but
   the catalog lacks a value. Owner-gated science work.
2. **Equation fallback is a first-class "awkward frame" issue (ADD).** Selecting CCME/US EPA still runs the
   BC BASELINE equation (FRAME_VARIANTS is empty) -> a major expectation gap the doc under-weighted.
3. **Catalog expansion != library backfill (ADD).** Backfilling library eco fields can recreate the stale
   hidden defaults #449 removed. Prefer new CATALOG rows + promoted seed/default mechanisms, not library
   fields.
4. **Manual-override-under-frame diagnostic labeling (ADD).** If a user typed an FCV/TRV then switches to a
   reference_only/unsupported frame, output may still compute. Label it diagnostic/reference-only, not a
   frame-supported result.
5. **Compare-mode instead of per-pathway frame (REPLACES 2e).** Keep ONE global assessment frame; let users
   PREVIEW another frame's candidate values/status without changing calculation state. Safer than
   per-pathway frame.
6. **Four-state applicability taxonomy (upgrades 1b badges):** (a) applicable + computable; (b) applicable
   but missing source-backed input; (c) not applicable for this contaminant class; (d) hidden/suppressed by
   the selected frame. Surface the REASON, not just a badge.

### Agreed priority sequence (codex, owner to confirm)
1. Substance combobox + pathway applicability badges + unavailable-REASON text (search + facets: "EqP
   computable" / "Eco-food TRV available" / "HH RfD" / "HH SF"; reason when unavailable).
2. Eco-Food relabel ("Wildlife consumers (bird/mammal)"; drop misleading "/Fish" at
   EcoFoodBSAFCalculator.tsx:443) + explicit cross-link to the Eco-Direct (EqP) aquatic-life pathway.
3. Consolidated FRAME-IMPACT CARD merging regulatory status + seed behavior + evidence filter + equation
   fallback (one component; replaces the two competing notices).
4. Explicit empty/reference/diagnostic states for eco outputs under unsupported/reference_only frames,
   including the manual-override case.
5. Terminology cleanup `jurisdiction` -> `regulatoryFrame`/`frameId` (preserve localStorage migration).
6. Frame COMPARISON panel (not per-pathway frame) -- only if owner wants mixed-frame assessments.
7. Owner-gated science/data: source-backed EqP logKow/Koc overrides for APPLICABLE nonionic organics only;
   catalog expansion (not library backfill).

STATUS: doc reviewed to mutual-agreement (Opus + codex). Low-risk items 1-4 are ready to implement on owner
go-ahead; items 6-7 are owner decisions. Open question for owner: which calculator tab were you on when the
"limited options" appeared (disambiguates dropdown-UX vs eco-computability)?
