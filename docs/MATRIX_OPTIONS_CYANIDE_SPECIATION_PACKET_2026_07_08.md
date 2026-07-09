# Matrix Options Cyanide Selection Guidance - 2026-07-08

## 0. Strict Guardrails & Status
- **Cyanide runtime entries are already wired.**
- This is **not** a missing code-wiring task.
- **Do not** implement cyanide/speciation code changes until an owner selection convention is explicitly approved.
- The safe current deliverable is this docs/design packet and UI copy proposal only.

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
  These represent nearly identical toxicological endpoints (free CN vs total CN). If a user selects both, the assessment/reporting may double-count or confuse the selection basis.
- **`silver` (0.005) vs `silver_cyanide` (0.1) vs `potassium_silver_cyanide` (0.005):**
  A three-way conflict. `silver_cyanide` is 20x less stringent than generic silver. Selecting generic `silver` + `cyanide_free` vs selecting `silver_cyanide` alone yields drastically different screening outcomes.
- **`copper` (0.426) vs `copper_cyanide` (0.005):**
  Selecting generic copper and generic cyanide independently versus selecting the specific `copper_cyanide` salt creates an aggregation conflict.

## 3. Proposed Owner Decision Options (Not Yet Approved)
Please select the preferred strategy for managing these overlaps in the UI:

- **A. UI Guidance Only:** No hard filtering. Add warning/helper text (tooltips/chips) informing the user of the overlap, but allow all keys to remain selectable.
- **B. Preferred/Recommended Key Convention:** Highlight one specific key (e.g., recommend `cyanide_free` over `hydrogen_cyanide...`) visually, but leave the others available as advanced options.
- **C. Grouping/Alias Warning:** The UI dynamically warns the user if they select two overlapping keys simultaneously (e.g., "You have selected both Silver and Silver Cyanide").
- **D. Hard Filtering/Collapse (Not Recommended):** Hide overlapping variants from the dropdown entirely. *Note: this requires explicit owner authorization as it breaks 1:1 parity with the source catalogs.*

## 4. Proposed UI Copy (Pending Approval)
If Option A, B, or C is chosen, we propose the following tooltips/helper texts next to the relevant keys in the Substance Selection UI:

- **For `cyanide_free` & `hydrogen_cyanide_and_cyanide_salts`:**
  > *"Caution: These endpoints represent equivalent cyanide exposure. Select only one to avoid double-counting or confusing the selection basis."*
- **For `silver_cyanide` & `potassium_silver_cyanide`:**
  > *"Represents a metal-cyanide compound/salt; do not assess concurrently with generic metal or generic cyanide unless the assessment intentionally covers both representations."*
- **For `copper_cyanide`:**
  > *"Represents a metal-cyanide compound/salt; do not assess concurrently with generic metal or generic cyanide unless the assessment intentionally covers both representations."*

## 5. Recommended First Implementation Increment
Upon approval of the strategy, the implementation will proceed as follows:

- **Scope:** Add warning/helper text tooltips in the frontend components.
- **Likely Files After Inspection:**
  - `src/components/matrix-options/SubstanceCombobox.tsx`
  - `src/components/matrix-options/MatrixDashboard.tsx`
  - *Possibly calculator components if warnings are displayed in calculator panes.*
- **Tests Expected:** Add component tests to verify tooltip rendering when cyanide/metal-cyanides are present.

## 6. Explicit Non-Goals
This implementation strictly adheres to the following boundaries:
- **NO** value/RfD/class changes.
- **NO** catalog mutation (`matrix_research/reference_catalog/**` remains completely untouched).
- **NO** `src/data/**` edits.
- **NO** `qa_status` or `default_status` edits.
- **NO** key removal from the runtime library.
- **NO** re-ranking defaults.
- **NO** silent collapse or redirection of substances.

## 7. Next Step
**Provide an explicit instruction to proceed:**
> *"Proceed with Option C (Grouping Warning). Use the proposed copy."*
*(or specify your preferred option and adjustments).*
