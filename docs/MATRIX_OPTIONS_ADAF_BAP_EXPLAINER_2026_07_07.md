# Age-Dependent Adjustment Factors (ADAFs) and the Benzo[a]pyrene Cancer Slope Factor -- Explainer

Date: 2026-07-07
Author: research subagent (per owner request, triggered by a flagged HC-vs-EPA BaP framing question)
Status: RESEARCH ONLY -- no code changed by this doc.

Trigger: owner flagged that HC v4.0 BaP oral slope factor (SF) 1.289 (mg/kg-day)^-1 and US EPA IRIS
BaP 2.0 (mg/kg-day)^-1 are "fundamentally different because EPA requires ADAF which HC doesn't use."
This doc verifies that claim against primary sources and corrects/refines it, then checks the shipped
`src/lib/matrix-options/adafTable.ts` + `cumulative.ts` (computeBaPeq) implementation against the
verified methodology.

---

## 1. What is an ADAF?

**Definition.** An Age-Dependent Adjustment Factor (ADAF) is a unitless multiplier applied to a
cancer slope factor (or unit risk) to account for the elevated susceptibility of early-life exposure
to carcinogens that act via a **mutagenic mode of action (MoA)**. It is NOT a general-purpose
child-safety factor for all carcinogens -- it applies specifically where the chemical's mechanism is
mutagenic (direct DNA-reactive damage), because young, rapidly-dividing tissue is more susceptible to
mutation-driven carcinogenesis per unit dose than adult tissue.

**Primary source:** US EPA (2005), *Supplemental Guidance for Assessing Susceptibility from
Early-Life Exposure to Carcinogens*, EPA/630/R-03/003F.
(https://www.epa.gov/risk/supplemental-guidance-assessing-susceptibility-early-life-exposure-carcinogens ;
full text: https://www.epa.gov/sites/default/files/2013-09/documents/childrens_supplement_final.pdf)
Confidence: VERIFIED-primary (document identified and its scope/values corroborated by EPA's own IRIS
chemical-landing page text for BaP, quoted in section 2).

**Why BaP qualifies.** EPA's 2017 IRIS Toxicological Review of BaP (EPA/635/R-17/003Fc) concluded BaP
is carcinogenic via a mutagenic MoA (BaP diol epoxide forms DNA adducts, producing characteristic
mutation signatures in tumor suppressor / oncogenes). HC v4.0 (2025) cites the same mutagenic-MoA
conclusion. Confidence: VERIFIED-primary (both agencies' own TRV tables state this; see quoted
text below).

**Standard ADAF values and age bins (both agencies use the same three bins):**

| Age bin | ADAF |
|---|---|
| 0 to <2 years | 10 |
| 2 to <16 years | 3 |
| >=16 years (through adulthood) | 1 |

Confidence: VERIFIED-primary for EPA (stated directly on EPA's guidance page and corroborated by the
IRIS BaP chemical-landing text); corroborated-secondary for HC's adoption of the identical 10/3/1
scheme via HC (2013b) -- see section 3.

**How ADAFs are APPLIED (mechanically):** the ADAF is a per-age-window multiplier on the (non-ADAF,
adult-based) slope factor, applied to that age window's own exposure estimate, then the resulting
age-window-specific risk contributions are summed (or exposure-duration-weighted) across the
individual's full exposure duration. i.e., for a receptor with exposure spanning multiple age windows:

```
Risk = SF_adult x [ (ADAF_0-2 x dose_0-2 x duration_0-2)
                   + (ADAF_2-16 x dose_2-16 x duration_2-16)
                   + (ADAF_16+  x dose_16+  x duration_16+) ] / averaging_time
```

This is a per-bin multiplier applied to that bin's dose contribution BEFORE summing across bins --
not a single scalar applied to a pre-summed lifetime average dose. EPA's own pre-computed "2.0"
lifetime value (section 2) is the closed-form result of running this bin-weighted calculation for a
**standard lifetime exposure duration assumption** (birth through 70 years, exposed continuously) and
folding the result back into an SF-equivalent number -- it is NOT simply `1.0 x 2` or some other
naive scalar; it is the exposure-duration-weighted average of `10 x (0-2yr fraction) + 3 x (2-16yr
fraction) + 1 x (16-70yr fraction)` of a standard lifetime, applied to the adult SF of 1.0.

---

## 2. The EPA BaP numbers -- what exactly is 2.0 vs 1.0?

**VERIFIED-primary**, quoted directly from EPA's IRIS chemical-landing page for BaP
(https://cfpub.epa.gov/ncea/iris2/chemicallanding.cfm?substance_nmbr=136 ; source assessment
EPA/635/R-17/003Fc, 2017):

> "Oral Slope Factor: 2 per mg/kg-day" [using a time-to-tumor dose-response model with linear
> extrapolation from the POD (BMDL10(HED)) associated with 10% extra cancer risk, and **includes
> application of age-dependent adjustment factors (ADAFs)**.]

> "EPA has also provided an adult-based cancer slope factor of 1 per mg/kg-day. This adult-based
> cancer slope factor can be used instead of the OSF when assessing cancer risk associated with
> exposure scenarios that don't include early life (< 16 years of age) or when other calculations by
> the user are necessary (e.g., **when applying ADAF**)."

**Owner's claim confirmed correct on this half:** yes -- EPA's headline oral CSF is 2.0
(mg/kg-day)^-1, and it is the LIFETIME value with ADAFs **already baked in** (exposure-duration-
weighted over a standard 0-70yr lifetime per the mechanism in section 1). EPA's 1.0 (mg/kg-day)^-1 is
the un-adjusted, adult-only slope factor -- the number you would multiply by an ADAF yourself if doing
a custom age-stratified calculation instead of using the pre-baked 2.0.

No correction needed to this part of the owner's framing; both numbers are real, EPA-sanctioned, and
serve different purposes.

---

## 3. The HC BaP number -- does HC use ADAF?

**VERIFIED-primary**, extracted directly from the local HC v4.0 source PDF
(`C:\Users\jasen\Downloads\HC 2025 - Toxicological Reference Values TRV.pdf`, page 20, and the
Summary of Revisions on page 6) via PyMuPDF text extraction. Quoted verbatim (unicode oddities from
extraction normalized):

Page 6, Summary of Revisions:
> "benzo[a]pyrene: updated TDI, **added note to oral slope factor (SF) regarding application of
> age-dependent adjustment factors (ADAFs) for early-life exposures**"

Page 20, the BaP TRV table row for Oral SF:

> "Oral SF (As per HC [2013b, 2024a], given that BaP is known to have a mutagenic mode of action, **HC
> recommends applying ADAFs to the oral SF when assessing risk associated with early life exposures at
> federal contaminated sites**) -- **1.289E+00 (mg/kgBW-day)^-1**"

Derivation shown in the same row: BMDL10 = 0.5389 mg/kgBW-day (chronic 2-year B6C3F1 **female mouse**
diet bioassay, adult-exposure-window study) -> allometric scaling to BMDL10,HEC = 0.07758 mg/kgBW-day
-> Oral SF = 0.1 / BMDL10,HEC = 1.289.

Footnote 2 on the same page: "Default adjusted ADAFs that HC recommends for federal contaminated site
risk assessments of non-threshold carcinogens with a mutagenic mode of action are provided in HC
(2013b)."

**Answer -- this corrects the owner's framing:** HC v4.0 (2025) DOES use ADAF for BaP. The owner's
statement "HC doesn't use ADAF" was accurate for *prior* HC TRV versions (v3.0, 2021, had no ADAF
note on BaP) but is **no longer accurate as of v4.0 (2025)**, which explicitly added the ADAF
recommendation as one of its named revisions.

**What 1.289 IS, precisely:** it is an **adult-based, non-ADAF-embedded** slope factor -- derived
purely from the adult-exposure-window mouse bioassay data via BMDL10/allometric scaling/linear
extrapolation, with no lifetime-exposure-duration-weighting of any ADAF folded in. Structurally, 1.289
is analogous to EPA's **1.0** (the adult-based CSF), NOT to EPA's 2.0 (the lifetime, ADAF-embedded
CSF). HC provides no pre-computed "lifetime-with-ADAF-baked-in" single-number equivalent to EPA's 2.0
-- HC leaves the per-age-window ADAF multiplication to the assessor, applying HC (2013b)'s own
guidance (which itself corroborated-secondarily adopts the same EPA-2005-origin 10/3/1 scheme; see
below).

**Corroborated-secondary** (not independently fetched from the primary HC 2013b PQRA/FCSAP guidance
document itself, but consistent across multiple secondary summaries and consistent with the v4.0
footnote's explicit cross-reference): HC (2013b)'s ADAF recommendation for FCSAP mutagenic-MoA
carcinogens adopts the same three age bins and the same 10 / 3 / 1 multipliers originated by US EPA
(2005a, 2005b). No evidence found of HC using different age-bin boundaries or different multiplier
values. If bit-for-bit certainty on HC 2013b's exact wording is needed, that document should be
sourced directly (it is a distinct FCSAP interim guidance document, not part of the v4.0 TRV PDF
itself) -- flagged for owner follow-up if load-bearing.

---

## 4. The load-bearing implication -- correct application rule per anchor

| Anchor SF | Already ADAF-embedded? | Apply ADAF again? | How |
|---|---|---|---|
| EPA IRIS 2.0 (mg/kg-day)^-1 (lifetime CSF) | YES -- ADAFs pre-baked via standard 0-70yr lifetime exposure-duration weighting | **NO** | Use 2.0 directly against the full-lifetime (or scenario) dose. Re-applying age-bin ADAF multipliers on top would double-count early-life sensitivity. |
| EPA IRIS 1.0 (mg/kg-day)^-1 (adult-based CSF) | NO | **YES**, for any exposure window <16 years old | Multiply the age-window-specific dose contribution by the matching ADAF (10 for 0-<2yr, 3 for 2-<16yr, 1 for >=16yr) per the bin-weighted formula in section 1, before summing across the individual's exposure duration. |
| HC v4.0 1.289 (mg/kgBW-day)^-1 | NO (adult-based, per section 3) | **YES**, per HC's own v4.0 note, for any exposure window <16 years old | Same mechanics as the EPA-1.0 row: multiply each age-window dose contribution by the HC(2013b)-recommended ADAF (10 / 3 / 1, corroborated-secondary as identical to EPA's) before summing. |

**Magnitude of error if done wrong** (illustrative, using a child 0-<2yr exposure window in isolation):

- Anchoring on EPA-2.0 and additionally applying ADAF=10 -> risk estimate is **10x too high**
  (double-counted early-life sensitivity on top of an already-lifetime-averaged value).
- Anchoring on EPA-1.0 or HC-1.289 and NOT applying ADAF for a 0-<2yr exposure window -> risk estimate
  is **10x too low** (fails to capture the elevated early-life mutagenic susceptibility HC/EPA both
  say applies).
- For the 2-<16yr window, the corresponding errors are 3x (over- or under-estimate) rather than 10x.
- Because real-world cumulative lifetime exposure blends age windows, a full lifetime scenario that
  mishandles ADAF will show a smaller but still material distortion (bounded between 1x and the
  worst-case per-bin multiplier, weighted by how much of the total exposure duration falls in the
  sensitive windows).

---

## 5. Is picking a single current_default between HC 1.289 and EPA 2.0 the right framing?

**No -- this is the key correction to the original framing.** HC-1.289 and EPA-2.0 are not two
competing point-estimates of the "same thing" that a QP simply picks between. They sit at **different
stages of the same underlying calculation**:

- EPA-2.0 = adult SF x lifetime-ADAF-weighting, already collapsed into one number.
- HC-1.289 = the adult SF stage only, with the ADAF-weighting step deliberately left to the assessor
  (per HC's own v4.0 note).

The methodologically valid comparison is:
- **HC-1.289 vs EPA-1.0** -- both adult-based, non-ADAF-embedded; a QP can sanity-check these against
  each other directly (they differ ~29% due to different critical studies/derivation paths -- HC uses
  a 2-year female-mouse diet bioassay with forestomach tumors as the critical effect; EPA uses a
  time-to-tumor model on a different POD/dataset).
- **HC-1.289 + separately-applied ADAF vs EPA-2.0** -- both represent an early-life-inclusive lifetime
  risk estimate, but only after the QP performs the same bin-weighting step HC leaves manual.

**What a QP actually needs to know to use each correctly:**
1. Identify whether the exposure scenario includes any age <16 years. If adult-only (>=16yr for the
   entire exposure duration), ADAF is moot -- use EPA-1.0 or HC-1.289 directly, no adjustment.
2. If early-life exposure is in scope:
   - Using EPA: either use the pre-baked EPA-2.0 directly (simplest, standard-lifetime-duration
     assumption), OR use EPA-1.0 + manual age-bin ADAF weighting if the exposure duration profile
     deviates materially from EPA's standard lifetime assumption (e.g. a shorter/longer residency).
   - Using HC: HC provides no pre-baked lifetime-ADAF number for BaP -- the QP MUST apply the
     age-bin ADAF weighting manually on top of 1.289 whenever early-life exposure is in scope. There
     is no "just use 1.289" shortcut once children are in the exposure scenario per HC's own v4.0
     guidance.
3. NEVER mix an ADAF-embedded anchor (EPA-2.0) with a manual ADAF re-application, and NEVER treat
   HC-1.289 as already early-life-inclusive.
4. current_default selection between HC-1.289 and EPA-2.0 (as raw numbers) is therefore not a clean
   "most-recent-wins" or "most-conservative-wins" choice -- it is a choice of **methodology package**
   (HC bin-weighted-manual vs EPA lifetime-pre-baked), and the calculator's UI/warnings must make that
   explicit rather than presenting them as interchangeable point values for the same quantity.

---

## 6. Shipped-code check -- `src/lib/matrix-options/adafTable.ts` + `cumulative.ts`

Files read: `src/lib/matrix-options/adafTable.ts`, `src/lib/matrix-options/cumulative.ts`
(`computeBaPeq`).

**What the code does correctly:**
- `ADAF_TABLE` in `adafTable.ts` matches the verified 10 / 3 / 1 scheme with the correct age-bin
  boundaries (0-<2, 2-<16, >=16). Matches section 1 exactly. VERIFIED against primary sources above.
- `adafTable.ts`'s own header comment already states the double-count guard correctly: "if the
  downstream cancer standard is anchored on an SF that ALREADY embeds ADAFs (e.g. the EPA IRIS
  lifetime BaP CSF 2.0 ...), these ADAFs MUST NOT be applied again. Apply ADAFs only when anchoring on
  an adult-only / non-ADAF SF (e.g. EPA IRIS 1.0 or HC 1.289)." -- This is **exactly right** per
  sections 2-4 of this doc, including correctly classifying HC-1.289 as a non-ADAF-embedded (adult)
  anchor, which required the v4.0 primary-source read in section 3 to confirm.
- `computeBaPeq`'s `BaPeqOptions` doc comment repeats the same correct guard, and the runtime warning
  emitted when `applyAdaf` is set ("ADAF ... applied ... Ensure the anchor SF is NOT already
  ADAF-adjusted") correctly pushes the double-count risk back onto the caller with an explicit
  reminder, rather than silently assuming either direction.
- `lookupAdaf` fails closed (returns `adaf: null` + blocks the result) on an invalid/missing age
  rather than defaulting to ADAF=1, which per section 4 would silently produce a 3x-10x
  UNDERESTIMATE for a child scenario -- correct conservative failure mode.

**Correctness gap / limitation found (not a bug, but a scope gap relative to the full methodology):**
- The implementation applies ADAF as a **single scalar per computeBaPeq call**, tied to one
  `opts.ageYears` value (i.e., one age bin) for the entire BaP-eq computation. Per section 1, the
  textbook methodology is **bin-weighted across an exposure DURATION that may span multiple age
  bins** (e.g. a 30-year lifetime exposure scenario starting at birth spans all three ADAF bins, each
  contributing proportionally to its own exposure-duration fraction). The current code does not do
  this multi-bin duration-weighting internally -- it applies exactly one ADAF value (whichever bin
  `ageYears` falls into) uniformly to every PAH entry's contribution in that single `computeBaPeq`
  call.
- This is NOT necessarily wrong as a code contract -- it is consistent with a caller invoking
  `computeBaPeq` once per age-bin-homogeneous scenario (e.g. "the child-only exposure window" as one
  call, "the adult-only exposure window" as a separate call, with duration-weighted combination done
  by the CALLER outside this function).
- **RESOLVED (this branch, 2026-07-07):** the single-bin scope is now explicitly documented in
  `cumulative.ts` -- the `BaPeqOptions` doc-comment states `ageYears` applies ONE age bin's ADAF (not
  lifetime duration-weighting) and that a full 0-70yr estimate must be per-age-window duration-weighted
  by the caller, and the runtime warning emitted on `applyAdaf` repeats this. So a caller reading the
  type/warning can no longer mistake it for a lifetime-integrated result. (A caller-facing
  array-of-`{ageBin, exposureFraction}` API is a possible future enhancement, not required for the
  contract to be honest.) It was never a live miscalculation -- no caller of `computeBaPeq` with
  `applyAdaf: true` exists yet; still grep call sites before shipping any UI that invokes this option.

**Bottom line on shipped code:** the ADAF table values, the double-count guard direction (including
correctly treating HC-1.289 as non-ADAF-embedded), and the fail-closed behavior are all CORRECT per
the verified primary-source methodology. The one gap is a documentation/contract clarity issue around
multi-age-bin lifetime exposure durations, not an incorrect ADAF value or an incorrect double-count
direction.

---

## Sources

- US EPA (2005), *Supplemental Guidance for Assessing Susceptibility from Early-Life Exposure to
  Carcinogens*, EPA/630/R-03/003F.
  https://www.epa.gov/risk/supplemental-guidance-assessing-susceptibility-early-life-exposure-carcinogens
  https://www.epa.gov/sites/default/files/2013-09/documents/childrens_supplement_final.pdf
  Confidence: VERIFIED-primary (identity, scope, 10/3/1 values corroborated via EPA's own IRIS
  BaP chemical-landing text, quoted in section 2).
- US EPA IRIS, Benzo[a]pyrene (BaP), CASRN 50-32-8, chemical landing page (source assessment
  EPA/635/R-17/003Fc, 2017). https://cfpub.epa.gov/ncea/iris2/chemicallanding.cfm?substance_nmbr=136
  Confidence: VERIFIED-primary (direct quotes in section 2, fetched and quoted verbatim).
- Health Canada (2025), *Federal Contaminated Site Risk Assessment in Canada, Part II: Toxicological
  Reference Values (TRVs) and Chemical-Specific Factors, Version 4.0*. Local copy:
  `C:\Users\jasen\Downloads\HC 2025 - Toxicological Reference Values TRV.pdf` (page 6 Summary of
  Revisions, page 20 BaP TRV table, footnote 2). Canada.ca landing page:
  https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites/federal-contaminated-site-risk-assessment-canada-part-health-canada-toxicological-reference-values-trvs-chemical-specific-factors.html
  Confidence: VERIFIED-primary (direct PyMuPDF text extraction, quoted verbatim in section 3).
- Health Canada (2013b), FCSAP ADAF guidance (cited by HC v4.0 footnote 2 as the source of HC's
  default ADAF values; not independently fetched in this pass -- 10/3/1-scheme match to EPA is
  corroborated-secondary via multiple independent web summaries, not a direct primary read of the
  2013b document itself). Flagged for owner follow-up if bit-for-bit HC(2013b) wording becomes
  load-bearing.
- Shipped code reviewed (no changes made): `src/lib/matrix-options/adafTable.ts`,
  `src/lib/matrix-options/cumulative.ts` (`computeBaPeq`, `BaPeqOptions`).

Plain ASCII throughout per repo convention.
