# Eco-Pathway Default Assumptions -- Candidate Packet (US EPA sources, for OWNER disposition)

Authored 2026-06-17 from a read-only research workflow over the LOCAL Zotero library
(localhost:23119) -- 4 parallel extraction agents (foc, fLipid, BSAF, eco-TRV) reading the
US EPA / FCSAP source PDFs, then synthesis. AI has found + verified; per the no-AI-promotion /
no-QA-promotion rules NOTHING here seeds any eco pathway until the owner approves the dispositions
in section 5. Purpose: fill the empty eco `SEEDABLE_KEYS` so the eco-direct + eco-food calculators
(and the planned cross-pathway comparison view) can compute from frame + substance defaults.

Sources located in Zotero: EPA/600/R-02/016 ESB Compendium (item I2YMU9MP; PDF BLZ4TUYB),
ITRC CS-1 2011 Bioavailability (ND29BMRR), USACE-ERDC BSAF Database (S7CI9WJS/UVKW3UVQ),
FCSAP ERA Module 7 wildlife TRVs (7JQ2YJ9T) compiling USEPA Eco-SSL.

## 1. Summary Table

| Parameter | Default | Unit | Basis | Universal vs Substance-specific | Source + Locator | Confidence |
|---|---|---|---|---|---|---|
| Sediment fraction organic carbon (fOC) for OC-normalization | No universal default; site-measured. Screening FLOOR fOC = 0.002 (0.2% TOC); illustrative central fOC = 0.01 (1% TOC, NOT EPA-endorsed) | mass fraction (g OC / g dry sediment) = %TOC/100 | fraction of dry weight; ESB_OC = ESB_DRYWT / fOC | Only the 0.002 applicability FLOOR is universal; operative value is site-measured | EPA/600/R-02/016 (Mar 2008) ESB Compendium: Glossary p.xi; Sec 3.1 Eq 3-2/3-3; Eq 3-6 Sec 3.3 p.3-7; floor p.3-1; Table 3-3 p.3-10. Zotero I2YMU9MP | high |
| Biota lipid fraction (fLipid) | 0.03 (3% lipid, wet weight) | fraction | fraction of wet-weight tissue that is lipid; BSAF = [C_tissue/fLipid] / [C_sed/fOC] | Universal screening default | ITRC CS-1 (2011) Bioavailability, slide 60 / Text Box 8-1. Zotero ND29BMRR | medium |
| Biota-Sediment Accumulation Factor (BSAF) | Substance/receptor-specific; lookup per chemical/species (ERDC DB). Theoretical equilibrium ~1-4 (~1.7-2); ITRC screening threshold ~2 | unitless (g OC / g lipid) | lipid-normalized tissue / OC-normalized dry-weight sediment | Substance-specific (per-substance rows) | ITRC CS-1 (2011) Slide 46; USACE-ERDC BSAF Database (14,323 records / 548 chemicals / 273 species). Zotero ND29BMRR, S7CI9WJS | medium |
| Ecological / wildlife dietary eco-TRV (dose-based) | Substance- AND receptor-specific. Per-substance mammal/bird, e.g. As 1.04/4.4; Cd 0.77/2.1; Cr(VI) 9.24/16; Cu 5.6/4.5; Pb 4.7/1.63; Ni 1.7/6.71; Se 0.143/0.29; V 4.16/0.344; Zn 75.4/66.1; LMW-PAH 65.6 (mammal); HMW-PAH 0.615 (mammal) | mg chemical / kg body mass / day | dose-based TRV vs total oral dose via HQ = dose / TRV | Substance- AND receptor-specific (per-substance, per-receptor rows) | FCSAP ERA Module 7 v1.0 (ECCC Apr 2021, En14-92/7-2021E) Table 1 pp.10-11, compiling USEPA Eco-SSL. Zotero 7JQ2YJ9T | high |

## 2. Verbatim Supporting Quotes

- **fOC (EPA/600/R-02/016):** "For nonionic organic chemicals, ESBs are expressed as ug chemical/gOC and apply to sediments having >= 0.2% organic carbon by dry weight." ... "KP = fOC . KOC (3-2)" ... "ESBTier2OC = ESBTier2DRY WT / fOC (3-6)" ... "fOC values were set to the environmentally relevant range of 0.002 to 0.05."
- **fLipid (ITRC CS-1, 2011):** "Default values for fish lipid fraction = 0.03"
- **BSAF (ITRC CS-1, 2011 + ERDC):** "If the ratio of lipid-adjusted tissue residues are generally less than two, then the COPC will not bioaccumulate. Ratios typically greater than 2 may have a potential to accumulate within the food chain." BSAF = [COPC_tissue/f_lipid] / [COPC_sed/f_OC].
- **eco-TRV (FCSAP Module 7, 2021; As-Mammal):** "Selected TRV = 1.04 mg/kg bm/day; Source: USEPA, 2005a; Grade: A. ... the highest bound NOAEL below the lowest bound LOAEL for relevant biological endpoints. ... No uncertainty factors were applied."

## 3. Universal frame-default seeds vs substance-specific catalog rows

- **Universal frame-default seed candidates:** fLipid = 0.03 (single scalar, BSAF/biota pathway); fOC = 0.002 ONLY as a labeled conservative screening FLOOR (NOT a typical-site default; central 0.01 is NOT EPA-endorsed -> owner judgment if wanted).
- **Substance-specific catalog rows (never a single frame scalar):** BSAF (per chemical x species, ERDC DB / measured; ITRC ~2 only as a generic trip-point); wildlife eco-TRV (per substance x receptor mammal/bird, from FCSAP Module 7 Table 1, each carrying its A/B/C grade + Appendix A pointer).

## 4. Caveats / applicability floors

- **EqP applicability floor (governs fOC + organic BSAF):** ESB/EqP apply ONLY to sediments with TOC >= 0.2% (fOC >= 0.002) AND nonionic organics with log Kow >= 2; below that the normalization is unreliable. Low-Kow (~2-3) + low-fOC needs the modified fSolids correction (Eq 3-5).
- **Screening-only:** all four are screening tools; ESB exceedances are weight-of-evidence triggers, not pass/fail; eco-TRVs are HQ inputs, not cleanup levels, and do not replace CCME / Federal EQGs.
- **eco-TRV:** NOAEL/LOAEL-bounded with NO uncertainty factors applied -> adding further safety factors double-counts. Wildlife = birds + mammals only (excludes fish/inverts). Read each grade + Appendix A before applying.
- **Source tier:** fLipid + BSAF are ITRC (EPA-co-hosted, not EPA-promulgated); eco-TRVs are FCSAP Module 7 compiling USEPA Eco-SSL (a standalone Eco-SSL PDF was NOT in local Zotero -- verified via the FCSAP compilation that cites the EPA source docs). Stamp seeded rows with the correct source tier.
- **Do not conflate human vs eco:** the EPA-derived HUMAN fish-tissue path (BC/WLRS 2023 citing USEPA 2000; AF=0.2, RAForal=100%) is human-health, NOT these eco/wildlife defaults.

## 5. Owner disposition required (AI will NOT seed/promote without explicit approval)

1. **fLipid = 0.03** as a universal eco frame-default seed (BSAF/biota pathway)? Confirm source tier (ITRC) + whether medium confidence seeds directly or stages as needs_review.
2. **fOC = 0.002** seeded ONLY as a labeled conservative screening floor (not a typical-site default)? OR a central illustrative 0.01 with explicit owner authorship? OR keep fOC fully site-measured (no seeded scalar)?
3. **BSAF** stays substance-specific (per-substance rows from ERDC DB / measured); encode ITRC ~2 as a generic screening trip-point? (No single BSAF frame scalar.)
4. **Wildlife eco-TRV** -- create per-substance, per-receptor (mammal/bird) needs_review catalog rows from FCSAP Module 7 Table 1 (each stamped with its grade + Appendix A pointer)? Is the FCSAP-compilation provenance acceptable, or must the primary USEPA Eco-SSL PDFs be located first?
5. **Source-tier + qa_status stamping:** AI drafts rows as needs_review by default; no promote --apply without explicit inline owner approval (reviewer J. Nelson).
6. **Scope confirmation:** confirm eco-pathway seeding is in-scope for the current matrix-options lane before any draft PR is opened.
