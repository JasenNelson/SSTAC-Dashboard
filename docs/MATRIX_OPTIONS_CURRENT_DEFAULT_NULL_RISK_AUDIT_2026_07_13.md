# Matrix-Options current_default / resolveTupleRecord null-risk audit (2026-07-13)

Decision-support for Top-50 item #14. Read-only audit of the value resolver against the live catalog
(1779 rows, tree tip 6995bc7). BOTTOM LINE: the feared "systemic ~83-row current_default gap" is
largely a NON-issue under the resolver's actual logic. The genuinely at-risk set is **2 tuples** under
the default regulatory frame (up to 18 under a frame that ranks neither Canada_federal nor US_federal).
The naive fix (blanket-set current_default) would REGRESS frame-sensitivity and must not be applied.

## How the resolver actually picks a row (src/lib/matrix-options/provenance/resolver.ts:109-167)

`resolveTupleRecord` runs only when the used value carries no `parameter_value_id` (the exact-id path
short-circuits it, resolver.ts:174-176). Its cascade for a `(substance_key, pathway, input_key)` tuple:
1. Candidates are pre-filtered by `valuesMatch` to ONLY rows equal (numeric + unit aware) to the value
   the calculator actually used (resolver.ts:86-98, 121-123). So divergent-value rows self-disambiguate.
2. `matches.length === 1` -> return it.
3. else `current_default` row (if exactly 1) -> return it.
4. else single `approved` row -> return it (tiebreak added 2026-07-03).
5. else frame jurisdiction-rank tiebreak (`getFrameJurisdictionRank`, defaultSelectionPolicy.ts:127-134;
   default frame `bc-protocol1-v5-dra` ranks BC > Canada_federal > US_federal > general).
6. else `null` -> the calculator renders "unsourced".

The "no current_default -> null" path therefore fires ONLY when 2+ candidates share the identical
used value AND all downstream tiebreaks fail to produce a single winner.

## Corrected counts (vs the 83-row premise)

- 1779 rows -> 1383 distinct (substance, pathway, input_key) tuples; 83 rows carry current_default.
- 281 tuples have >=2 candidate rows; 1300 have no current_default, but 1067 of those are single-row
  (trivially resolve) and 163 have exactly 1 approved row (handled by step 4).
- The task's literal "at-risk" definition (>=2 approved rows, no current_default) = **68 tuples**
  (18 same-value, 50 divergent-value).
- After tracing the resolver's real semantics: the 50 divergent-value tuples are NOT at risk (step 1
  self-disambiguates by exact used value). Of the 18 same-value tuples, 16 are cross-jurisdiction
  (Canada_federal vs US_federal) ties that step 5 resolves deterministically under any frame that
  ranks those jurisdictions (4 of 6 frames, incl. the default -> HC wins, matching BC Protocol 1 s4.4).

## The genuinely at-risk set

**2 tuples, both under the default frame:**
- `endosulfan_alpha` / eco-direct-eqp / fcv_ug_per_L = 0.056 ug/L
- `endosulfan_beta`  / eco-direct-eqp / fcv_ug_per_L = 0.056 ug/L

Each has two approved rows with the identical value 0.056 ug/L but BOTH `jurisdiction: US_federal`
(EPA ESB-2008 vs EPA NRWQC-live) -- same jurisdiction, so step 5 has no discriminator and the resolve
falls through to null.

**Frame caveat:** the 16 cross-jurisdiction ties resolve only under frames that rank Canada_federal or
US_federal. Under `bc-csr-sediment-numerical` (ranks only [BC, general]) neither gets a finite rank ->
all 18 same-value tuples reproduce the null. So at-risk = 2 (default frame) up to 18 (non-ranking frame).

## Recommended dispositions (owner-gated; nothing applied)

1. **endosulfan_alpha / endosulfan_beta (the real 2):** set current_default on one of the two identical
   0.056 ug/L rows per tuple. This is an editorial pick between two equal-value EPA sources
   (ESB-2008 vs NRWQC-live), NOT a values dispute -- but it is still a catalog mutation and stays
   owner-gated. Cheapest genuine fix.
2. **Do NOT blanket auto-set current_default on the 16 cross-jurisdiction ties.** current_default is
   checked (step 3) AHEAD of the jurisdiction-rank fallback (step 5), so pinning e.g. the HC row would
   freeze it even under `us-epa-usace-sediment` where the code intends EPA to win -- a regression.
3. **Non-ranking-frame exposure (up to 18):** if the owner wants the same-value ties robust under
   `bc-csr-sediment-numerical`, the fix is at the FRAME-ranking layer (rank the jurisdictions in that
   frame), not per-row current_default -- a design decision, not a data edit.

## Two distinct structural gaps found (flagged; separate scoping)

- **25 placeholder-string rows** (`value = "not provided by current calculator"`, all needs_review /
  not_default); 15 tuples have this as their SOLE row (methylmercury, lead, copper, cadmium, zinc oral
  SF / BSAF-LOC tuples). Not lost approved data -- intentionally unfilled; but they never resolve for a
  numeric used value.
- **Range-string values** on some approved rows (benzene oral SF "0.015 to 0.055", chromium_hexavalent
  oral RfD "0.0007 to 0.07", vinyl_chloride ranges): `valuesMatch` requires exact numeric/string
  equality, so a range-valued approved row can NEVER be attributed via tuple-fallback regardless of
  default_status. Structurally different from the current_default question; worth separate owner scoping.

Machine-readable full lists (both at-risk categories) were produced at audit time under the session
scratchpad (at_risk_a.json / at_risk_b.json) and can be regenerated from the resolver + catalog.
