# Matrix Options Cyanide Selection Guidance - 2026-07-08

## 1. Current Wired Cyanide-Family Entries
The following cyanide-family substances are actively wired in `src/lib/matrix-options/substanceLibrary.ts` with `contaminantClass: 'inorganic'`:
- `chlorine_cyanide`: RfD `0.05`
- `cyanogen`: RfD `0.001`
- `cyanogen_bromide`: RfD `0.09`
- `calcium_cyanide`: RfD `0.001`
- `copper_cyanide`: RfD `0.005`
- `cyanide_free`: RfD `0.00063`
- `hydrogen_cyanide_and_cyanide_salts`: RfD `0.0006`
- `potassium_cyanide`: RfD `0.002`
- `potassium_silver_cyanide`: RfD `0.005`
- `silver_cyanide`: RfD `0.1`
- `sodium_cyanide`: RfD `0.001`

*Note: Generic `silver` (RfD `0.005`) and `copper` (RfD `0.426`) exist as `divalent-metal` entries.*

## 2. Exact Overlap Problems
The abundance of cyanide/metal-cyanide representations creates a high risk of double-counting or inappropriate selections:

- **`cyanide_free` (0.00063) vs `hydrogen_cyanide_and_cyanide_salts` (0.0006):**
  These represent nearly identical toxicological endpoints (free CN vs total CN). If a user selects both, the cumulative effect calculations will artificially inflate risk.
- **`silver` (0.005) vs `silver_cyanide` (0.1) vs `potassium_silver_cyanide` (0.005):**
  A three-way conflict. `silver_cyanide` is 20x less stringent than generic silver. Selecting generic `silver` + `cyanide_free` vs selecting `silver_cyanide` alone yields drastically different screening outcomes.
- **`copper` (0.426) vs `copper_cyanide` (0.005):**
  Selecting generic copper and generic cyanide independently versus selecting the specific `copper_cyanide` salt creates an aggregation conflict.

## 3. Owner Decision Options
Please select the preferred strategy for managing these overlaps in the UI:

- **A. UI Guidance Only:** No hard filtering. Add warning/helper text (tooltips/chips) informing the user of the overlap, but allow all keys to remain selectable.
- **B. Preferred/Recommended Key Convention:** Highlight one specific key (e.g., recommend `cyanide_free` over `hydrogen_cyanide...`) visually, but leave the others available as advanced options.
- **C. Grouping/Alias Warning:** The UI dynamically warns the user if they select two overlapping keys simultaneously (e.g., "You have selected both Silver and Silver Cyanide").
- **D. Hard Filtering/Collapse (Not Recommended):** Hide overlapping variants from the dropdown entirely. *Note: this requires explicit owner authorization as it breaks 1:1 parity with the source catalogs.*

## 4. Proposed UI Copy
If Option A, B, or C is chosen, we propose the following tooltips/helper texts next to the relevant keys in the Substance Selection UI:

- **For `cyanide_free` & `hydrogen_cyanide_and_cyanide_salts`:**
  > *"Caution: These endpoints represent equivalent cyanide exposure. Select only one to avoid double-counting cumulative risk."*
- **For `silver_cyanide` & `potassium_silver_cyanide`:**
  > *"Complex Salt: Includes both silver and cyanide toxicity. Do not assess concurrently with generic Silver or generic Cyanide."*
- **For `copper_cyanide`:**
  > *"Complex Salt: Includes both copper and cyanide toxicity. Do not assess concurrently with generic Copper or generic Cyanide."*

## 5. Recommended First Implementation Increment
Upon approval of the strategy (e.g., **Option A or C**), the implementation will proceed as follows:

- **Scope:** Add warning/helper text tooltips in the frontend components.
- **Exact Files Likely Touched:**
  - `src/components/matrix-options/SubstanceSelector.tsx` (or equivalent component handling the substance dropdown/list)
  - `src/components/matrix-options/CalculatorPanel.tsx` (to display active warnings)
- **Tests Expected:** Add component tests to verify tooltip rendering when cyanide/metal-cyanides are present.

## 6. Explicit Non-Goals
This implementation strictly adheres to the following boundaries:
- **NO** value changes to RfDs or classes.
- **NO** catalog mutation (`src/data/**` remains completely untouched).
- **NO** `qa_status` or `default_status` edits.
- **NO** key removal from the runtime library.
- **NO** silent collapse or redirection of substances.

## 7. Next Step
**Provide an explicit instruction to proceed:**
> *"Proceed with Option C (Grouping Warning). Use the proposed copy."*
*(or specify your preferred option and adjustments).*
