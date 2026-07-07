# Matrix Options -- A2 Verification Results: PAH RPF tables + BaP slope factors (2026-07-06)

First A2 pass (per the cumulative-effects implementation plan): the PAH RPF reference tables and the
benzo[a]pyrene oral slope-factor question, verified against PRIMARY regulatory sources. This hardens the
factor-table data the eventual implementation (A1/A3) will use. No catalog values changed. Values not
marked VERIFIED remain needs_review.

## Headline: the benzo_a_pyrene SF "discrepancy" is RESOLVED (not an error)

Our catalog's benzo_a_pyrene sf_oral rows (HC-v4.0 1.289, EPA 2.0) are BOTH legitimate current values --
they are different metrics, not a mistake:
- **EPA IRIS 2017 oral CSF = 1.0 (mg/kg-day)^-1** (VERIFIED, primary IRIS doc EPA/635/R-17/003Fc,
  Executive Summary; Beland & Culp 1998 alimentary-tract tumors, adult-exposure scenario).
- **EPA IRIS = 2.0 (mg/kg-day)^-1** is ALSO a current IRIS value: the LIFETIME oral CSF with
  Age-Dependent Adjustment Factors (ADAFs) baked in (per EPA's 2005 Supplemental Guidance for early-life
  carcinogen susceptibility; BaP has a mutagenic MoA). IRIS lists both 1.0 (adult-only) and 2.0
  (lifetime-with-ADAF). Source: IRIS chemical landing page, substance 136. So our "2.0" (attributed to
  an EPA IRIS chemical-details export) is the ADAF-adjusted figure -- correct, just under-labeled.
- EPA pre-2017 = 7.3 (mg/kg-day)^-1 (legacy, from the 1993 Provisional Guidance; SUPERSEDED by the 2017 = 1.0).
- CalEPA/OEHHA oral CSF = 1.7 (mg/kg-day)^-1 (separate agency value; UNCONFIRMED -- primary DTSC/OEHHA
  doc returned 403; corroborated via search only).
- HC TRV v4.0 (2025) = 1.289 (mg/kgBW-day)^-1 (already verified from the HC PDF).

**Two load-bearing implications:**
1. **Owner-decision (benzo_a_pyrene HELD):** the current_default is a choice between HC-v4.0 1.289 and
   the EPA IRIS values; and each EPA row should be TAGGED with its scenario (adult-only 1.0 vs
   lifetime-with-ADAF 2.0) so the two IRIS numbers are not confused. Still an owner call, but no longer a
   suspected data error.
2. **Implementation (plan A3 ADAF handling):** if the cumulative PAH BaP-eq calc anchors on the EPA 2.0
   figure, it MUST NOT separately apply ADAFs (10/3/1) -- they are already embedded. Anchoring on 1.0
   (adult) or 1.289 (HC) and then applying ADAFs is the alternative. The A3 ADAF option must make the
   anchor-vs-ADAF choice explicit to avoid double-counting. Add this to the A3 unit/ADAF contract.

## Section 1 -- Nisbet & LaGoy (1992) TEFs: VERIFIED (2 corrections)

Matches the original (Regul. Toxicol. Pharmacol. 16:290-300; PubMed 1293646): BaP 1.0; benz[a]anthracene
0.1; benzo[b]fluoranthene 0.1; benzo[k]fluoranthene 0.1; indeno[1,2,3-cd]pyrene 0.1;
dibenz[a,h]anthracene 5.0; chrysene 0.01; benzo[g,h,i]perylene 0.01; LMW PAHs 0.001. CORRECTIONS to the
research draft:
- **anthracene = 0.01** (0.01 tier with chrysene/BghiP), NOT 0.001 as the draft grouped it.
- **benzo[j]fluoranthene** was NOT in Nisbet & LaGoy's original list; later compilers assign it 0.1 by
  analogy to b/k-fluoranthene. Mark the Nisbet `benzo[j]fluoranthene` = 0.1 cell as compiler-assigned,
  not primary.

## Section 2 -- US EPA 2010 draft RPFs (EPA/635/R-08/012A): STATUS = SUSPENDED; partial verify

Document + status VERIFIED: External Review Draft, SAB-reviewed 2011, never finalized, formally
SUSPENDED (2019). Sources: cfpub.epa.gov/ncea/iris_drafts (deid 194584); PMC9368405. **Flag: do NOT
cite these as current EPA policy** regardless of value correctness; treat the whole `epa-2010-draft`
scheme as provisional/non-final in the rpfTable.
- VERIFIED (via MN Dept of Health compiled table citing the draft): benz[a]anthracene 0.2, chrysene 0.1,
  cyclopenta[c,d]pyrene 0.4, dibenzo[a,l]pyrene 30.
- UNCONFIRMED (primary PDF is binary-encoded; extraction failed): benzo[b]fluoranthene 0.8,
  benzo[j]fluoranthene 0.3, benzo[k]fluoranthene 0.03, dibenz[a,h]anthracene 10, indeno[1,2,3-cd]pyrene
  0.07, benzo[g,h,i]perylene 0.009. FOLLOW-UP: a direct read of the source PDF is needed before these 6
  are trusted (values are plausible / commonly cited but not primary-confirmed here).

## Section 3 -- Health Canada PQRA / CCME 2010 RPFs: VERIFIED (provenance correction)

CCME 2010 Canadian Soil Quality Guidelines for carcinogenic PAHs PEFs -- VERIFIED (benz[a]anthracene
0.1, chrysene 0.01, dibenz[a,h]anthracene 1.0, benzo[b/j/k]fluoranthene 0.1, IcdP 0.1, BghiP 0.01, BaP
1.0). PROVENANCE CORRECTION: the CCME 2010 PEFs were **adapted from WHO/IPCS (1998)**, not independently
derived by CCME -- cite the lineage as CCME-2010 (from WHO/IPCS-1998). HC PQRA adopts this set as
"recommended". Sources: ccme.ca 2010-pah-csqg-scd-1445-en.pdf; publications.gc.ca H129-108-2021 (HC
FCSRA TRV doc). => the `rpfTable` `ccme-2010` and `who-1998-pah` schemes are effectively the same PEF
lineage; represent that.

## Remaining A2 follow-ups (not blocking the plan)

- Primary-PDF read of the EPA 2010 draft (deid 194584) to confirm the 6 UNCONFIRMED RPFs.
- Confirm the CalEPA/OEHHA BaP oral CSF = 1.7 against the primary OEHHA doc.
- Framework criteria (BC CSR Sched 3.1/3.4, CCME SQG/SedQG, Ontario O.Reg 153/04 + PSQG, EPA NRWQC) --
  not yet A2-verified; needed only if/when criterion comparison is wired (plan A3b+), not for A3a math.
