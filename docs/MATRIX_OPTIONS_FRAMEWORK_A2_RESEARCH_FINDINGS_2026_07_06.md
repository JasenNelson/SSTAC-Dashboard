# Matrix Options -- Framework A2 Research Findings (2026-07-06)

Research-only pass. NO code or catalog values were changed by this session. Scope: four verification
tasks assigned against the cumulative-effects blueprint (`MATRIX_OPTIONS_CUMULATIVE_EFFECTS_IMPLEMENTATION_SPEC_2026_07_06.md`
Sections 2-4) and the prior A2 pass (`MATRIX_OPTIONS_A2_VERIFICATION_RESULTS_2026_07_06.md`).

**Repo-state note:** `src/lib/matrix-options/tefTable.ts` and `src/lib/matrix-options/rpfTable.ts` do NOT
exist yet in this checkout (verified by Glob across the full repo). Per session memory
(`dashboard_mo_cumulative_effects_lane_2026_07_06.md`), the cumulative-effects lane is at the
"research -> spec -> codex-hardened plan" stage, NOT implemented. All findings below are therefore
checked against the reference tables in the SPEC doc (Sections 2-4), which are the closest thing to
"tefTable/rpfTable" that currently exists. When the tables are implemented, re-point these findings at
the actual `.ts` files.

Confidence key: **VERIFIED-primary** (read the primary regulatory/scientific text directly and quote
it) / **corroborated-secondary** (multiple independent secondary sources agree, primary not directly
read) / **UNCERTAIN** (not resolved; primary source needed).

---

## Task 1 -- BC 5-PAH subset (HIGHEST VALUE item)

**Finding: the SPEC's claim "BC CSR uses a 5-PAH WHO-1998 BaP-TEF subset" is NOT CONFIRMED by primary
sources found in this session, and the actual picture is more complicated than a single 5-PAH table.**
Two distinct BC-origin PAH-TEF/PEF artifacts were found; neither is a clean "5-PAH WHO-1998 subset."

### 1a. BC Contaminated Sites Regulation (CSR) risk-assessment guidance -- adopts HC PQRA, NOT a BC-authored table

Source: **BC Technical Guidance 7, "Supplemental Guidance for Risk Assessments," Version 5, November
2017** (`www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/technical-guidance/tg07.pdf`),
read directly (text-extractable, page 2). Confidence: **VERIFIED-primary**.

Quote (p. 2): "the ministry strongly recommends use of the critical human receptors, physiological
parameters, exposure routes, exposure scenario assumptions and associated toxicological equations
provided in Health Canada, Federal Contaminated Site Risk Assessment in Canada Part I: Guidance on
Human Health Preliminary Quantitative Risk Assessment (PQRA), Version 2.0 (2012) guidance: ... Table 7.
Potency Equivalence Factors for Carcinogenic Polycyclic Aromatic Hydrocarbons, and Table 8. Toxic
Equivalency Factors for Dioxins, Furans, and Certain Polychlorinated Biphenyls."

=> For risk-assessment PAH potency-equivalence work, BC CSR does not author its own PEF table -- it
directs Qualified Professionals to **HC PQRA v2.0 (2012) Table 7**, which is the same CCME-2010 /
WHO-1998-derived 8-PAH lineage already verified in the prior A2 pass (`ccme-2010` / `who-1998-pah`
scheme; see `MATRIX_OPTIONS_A2_VERIFICATION_RESULTS_2026_07_06.md` Section 3). There is no independent
BC 5-compound table for this use case.

### 1b. BC Hazardous Waste Regulation -- a genuine BC-specific PAH-TEF table, but 6 compounds and a different regulation

Source: **BC Reg. 63/88, Hazardous Waste Regulation, Schedule 1.1 "PAH Toxicity Equivalency Factors"**
(`bclaws.gov.bc.ca/civix/document/id/complete/statreg/63_88_01` for the definition;
`bclaws.gov.bc.ca/civix/document/id/loo68/loo68/03_63_88sch1-4` for the schedule text). Confidence:
**VERIFIED-primary** (fetched twice independently; both extractions agree character-for-character).

Definition (BC Reg 63/88): "'polycyclic aromatic hydrocarbon TEQ' or 'PAH TEQ' means the polycyclic
aromatic hydrocarbon toxicity equivalent value relative to benzo[a]pyrene which is determined by adding
the products of the measured concentrations of each listed PAH in Column 1 of Schedule 1.1 multiplied by
the toxicity equivalency factor (TEF) listed opposite in Column 2."

Schedule 1.1 verbatim table:

| PAH | TEF | Primary source | Confidence |
|---|---|---|---|
| benzo[a]anthracene | 0.1 | BC Reg 63/88 Sch 1.1 | VERIFIED-primary |
| benzo[a]pyrene | 1.0 | BC Reg 63/88 Sch 1.1 | VERIFIED-primary |
| benzo[b]fluoranthene | 0.1 | BC Reg 63/88 Sch 1.1 | VERIFIED-primary |
| benzo[k]fluoranthene | 0.1 | BC Reg 63/88 Sch 1.1 | VERIFIED-primary |
| dibenzo[a,h]anthracene | **1.1** | BC Reg 63/88 Sch 1.1 | VERIFIED-primary (unusual value -- flag) |
| indeno[1,2,3-cd]pyrene | **0.2** | BC Reg 63/88 Sch 1.1 | VERIFIED-primary (unusual value -- flag) |

**This is 6 compounds, not 5.** Two of the six values are distinctively non-standard versus every other
scheme checked in this session and the prior A2 pass:
- `dibenzo[a,h]anthracene` = 1.1 here, vs 1.0 (CCME-2010/WHO-1998, Nisbet "index-adjacent"), 5.0
  (Nisbet & LaGoy 1992 original), or 10 (EPA 2010 draft). 1.1 does not match any other cited scheme.
- `indeno[1,2,3-cd]pyrene` = 0.2 here, vs 0.1 in every other scheme checked (Nisbet, CCME-2010,
  WHO-1998, EPA 2010 draft is 0.07).

These could be genuine BC-specific policy choices, or transcription/rounding artifacts that have
persisted in the regulation text since its original drafting -- **UNCERTAIN which**, and this needs a
second independent read of the official BC Laws PDF (not just the text-extraction tool used here) before
any of these two divergent values are trusted for a catalog entry.

**Also note the regulatory context mismatch:** Schedule 1.1 lives in the **Hazardous Waste Regulation**
(waste characterization / TEQ-based waste classification), not the **Contaminated Sites Regulation**
(soil/sediment/water numerical standards, Schedule 3.1-3.4). This session found no primary evidence that
CSR Schedule 3.1/3.4 numerical PAH standards use Schedule 1.1's 6-compound TEF set, or any independently
BC-authored 5-compound TEF set. A low-confidence secondary search hit (not independently verified) turned
up mismatched numbers -- "benzo[a]pyrene TPE factor of 1, dibenz[a,h]anthracene 1, indeno 0.1" from one
search snippet vs "benzo(a)pyrene 7.0, dibenz(a,h)anthracene 4.4, indeno 51" from another -- these look
like they are quoting numerical STANDARDS (concentration limits, e.g. ug/g) rather than TEF/PEF weighting
factors, and are almost certainly NOT what the SPEC meant by "TEF." **UNCERTAIN; do not use.**

### 1c. Recommendation

- **READY TO APPLY:** none from this sub-task without owner sign-off (see below).
- **STILL UNCERTAIN:** whether the SPEC's "BC CSR uses a 5-PAH WHO-1998 BaP-TEF subset" claim has any
  primary basis at all. Based on what TG-7 actually says (adopt HC PQRA Table 7, the 8-PAH CCME-2010
  lineage), the most defensible correction is: **there is no separate "BC" PAH scheme for CSR risk
  assessment -- BC CSR = HC PQRA v2.0/v3 Table 7 (already in the catalog as `ccme-2010`/`who-1998-pah`)**.
  The genuinely BC-specific 6-PAH table (Sch 1.1) belongs to a different regulation (hazardous waste, not
  contaminated sites) and should be labeled that way if it is ever added to `rpfTable.ts` -- e.g. as a
  `bc-hwr-schedule-1.1` scheme, NOT relabeled as `bc-csr` or folded into `who-1998-pah`.
- Needed to close this out: (a) a second, independent verbatim read of BC Reg 63/88 Schedule 1.1 (ideally
  the actual bclaws.gov.bc.ca PDF via a tool that renders text natively, to confirm 1.1 and 0.2 are not
  OCR/extraction errors); (b) direct text of CSR Schedule 3.1 Part 2/3 substance list to confirm whether
  BC has ANY separate numerical PAH standard derivation that differs from the HC PQRA Table 7 lineage.

---

## Task 2 -- WHO-2005 mammalian TEF verification (Van den Berg et al. 2006)

**Primary paper is paywalled** (Toxicological Sciences 93(2):223-241, DOI 10.1093/toxsci/kfl055; Oxford
Academic returned only the abstract). The USGS-hosted PDF copy
(`cerc.usgs.gov/pubs/center/pdfdocs/90970.pdf` -- note: this is actually the 1998 paper, see Task 3) and
the Hawaii DOH-hosted reprint (`health.hawaii.gov/heer/files/2021/07/WHO2005.pdf`) are both **scanned
image PDFs** that this session's tooling could not OCR (no `pdftoppm`/poppler available in this
environment) or text-extract (binary/stream artifacts only). **Direct primary-text read was not
achieved this session.**

Confidence for the SPEC's WHO-2005 mammalian column: **corroborated-secondary**, based on independent
cross-checks of a subset of values against other citing sources (not the primary itself):
- PCB-126 = 0.1, PCB-169 = 0.03, and the mono-ortho PCB group (PCB-105/114/118/123/156/157/167/189) all
  = 0.00003: confirmed via independent secondary aggregation of literature describing the WHO-2005
  revision. This matches the SPEC table exactly.
- The dioxin/furan congener values in the SPEC's WHO-2005 column (TCDD 1.0, PeCDD 1.0, HxCDDs
  0.1/0.1/0.1, HpCDD 0.01, OCDD 0.0003, TCDF 0.1, PeCDFs 0.03/0.3, HxCDFs all 0.1, HpCDFs 0.01/0.01,
  OCDF 0.0003) match the widely-known, extensively-republished WHO-2005 consensus set from general
  domain knowledge and the pattern of half-log-step revisions described in secondary sources (e.g. OCDD/
  OCDF stepped down from 0.0001 in 1998 to 0.0003 in 2005 -- both a plausible and commonly-cited change).
  This is NOT a primary-text confirmation.

**READY TO APPLY:** none -- table is plausible and secondary-corroborated but not primary-verified.
**STILL UNCERTAIN:** the full 29-congener WHO-2005 mammalian table needs either (a) OCR-capable tooling
(poppler/pdftoppm) pointed at the two scanned PDFs already fetched this session (saved locally --see
tool-result cache; owner/next session can retry with OCR available), or (b) a non-paywalled HTML mirror
of Van den Berg et al. 2006 Table (several WHO/state-agency fact sheets reproduce it; none found
text-extractable this session).

---

## Task 3 -- WHO-1998 taxa-specific TEFs (Van den Berg et al. 1998, Environ Health Perspect 106:775-792)

### 3a. PCDD/PCDF fish TEFs -- VERIFIED-primary (via a downstream primary citation)

Source: **CCME, "Canadian Sediment Quality Guidelines for the Protection of Aquatic Life --
Polychlorinated Dibenzo-p-Dioxins and Polychlorinated Dibenzofurans (PCDD/Fs)," 2001** (Table 2, p. 3;
`ccme.ca/en/res/polychlorinated-dioxins-and-furans-pcdd_fs-canadian-sediment-quality-guidelines-for-the-protection-of-aquatic-life-en.pdf`),
read directly page-by-page (this PDF WAS text-extractable). This table is explicitly sourced to "1998
WHO TEF values (van den Berg et al. 1998)". Confidence: **VERIFIED-primary** (verified against a document
that itself directly reproduces and cites the 1998 primary; the 1998 paper itself is a scanned PDF this
session could not OCR -- see 3b).

Every PCDD/PCDF fish-TEF value in the SPEC's "Fish WHO1998" column matches this CCME source exactly:
TCDD 1, PeCDD 1, 1,2,3,4,7,8-HxCDD 0.5, 1,2,3,6,7,8-HxCDD 0.01, 1,2,3,7,8,9-HxCDD 0.01, HpCDD 0.001, OCDD
0.0001; TCDF 0.05, 1,2,3,7,8-PeCDF 0.05, 2,3,4,7,8-PeCDF 0.5, all four HxCDF congeners 0.1, both HpCDF
congeners 0.01, OCDF 0.0001. **No disagreements found.**

### 3b. PCDD/PCDF mammal and avian WHO-1998 TEFs, and all PCB WHO-1998 TEFs (fish/avian/mammal) -- UNCERTAIN

The van den Berg et al. 1998 primary (EHP 106:775-792) was located (USGS-hosted PDF,
`cerc.usgs.gov/pubs/center/pdfdocs/90970.pdf`) but is an 18-page **scanned image PDF**; this session's
tooling lacks the poppler/pdftoppm renderer needed to OCR it, so the mammal/avian TEF table and all PCB
rows were **not verified against the primary text**. The CCME source above only republishes the
PCDD/PCDF *fish* TEFs (that document's own scope), so it does not help verify mammal/avian or PCB rows.

**STILL UNCERTAIN:** SPEC columns "Mammal WHO1998," "Avian WHO1998," and the PCB rows in "Fish WHO1998"
-- not primary-verified this session. Do not promote until either OCR tooling is available to read the
already-fetched scanned PDF, or a text-extractable mirror of van den Berg 1998 (e.g. PMC1566591 "The
trouble with TEFs" partially reproduces some values but was not exhaustively checked here) is consulted.

---

## Task 4 -- CCME "21.5" ambiguity: RESOLVED

**Confirmed: "21.5" is two unrelated numbers for two different analytes, in two different units. This is
a coincidental conflation, exactly as the SPEC suspected -- not the same guideline misquoted twice.**

Source: **CCME, "Canadian Sediment Quality Guidelines for the Protection of Aquatic Life --
Polychlorinated Dibenzo-p-Dioxins and Polychlorinated Dibenzofurans (PCDD/Fs)," 2001** (Table 1 p. 1, and
the PCB cross-reference paragraph p. 5), read directly, full text. Confidence: **VERIFIED-primary**.

| Value | Analyte | Unit | Meaning | Primary source | Confidence |
|---|---|---|---|---|---|
| 21.5 | PCDD/F TEQ | **ng TEQfish/kg dw** | Marine/estuarine PEL (provisional; adopted from the freshwater value; freshwater PEL is ALSO 21.5, both are safety-factor-10-adjusted from a PEL of 215 pg TEQ/g = 215 ng/kg) | CCME 2001 PCDD/F sediment guideline, Table 1 | VERIFIED-primary |
| 21.5 | Total PCBs (bulk, non-coplanar-only screen) | **ug/kg dw** | Marine sediment ISQG for total PCB congener sum (freshwater ISQG = 34.1 ug/kg) | Same CCME 2001 PCDD/F doc, p. 5 (cross-reference paragraph); PCB sediment guideline itself | VERIFIED-primary |

Exact quotes:
- PCDD/F PEL (Table 1, p. 1): "PEL 21.5* 21.5*[dagger]" with footnote "*Expressed on a TEQ basis using
  TEFs for fish. A safety factor of 10 was applied." and "[dagger]Provisional; adoption of the freshwater
  value." Units header: "(ng.kg-1 dw)".
- Total PCB ISQG (p. 5): "To protect aquatic life from non-coplanar PCBs, the total concentration of all
  PCB congeners should meet the recommended ISQGs for total PCBs (34.1 and 21.5 ug.kg-1 dw for freshwater
  and marine sediments, respectively)."

**Practical implication for the catalog/spec:** these are a **1000x unit difference** (ng/kg TEQ vs
ug/kg bulk mass) on top of being different analytes and different guideline tiers (PEL vs ISQG). Anyone
citing "CCME marine 21.5" MUST specify both the analyte (total-PCB mass vs PCDD/F-TEQ) and the unit
(ug/kg vs ng/kg) or the two will be silently swapped. Recommend the SPEC/eventual catalog rows carry an
explicit disambiguating label, e.g. `ccme_marine_isqg_total_pcb_21.5_ugkg` vs
`ccme_marine_pel_pcddf_teq_21.5_ngkg`.

Bonus corroboration (same document, not previously confirmed): CCME ISQG for PCDD/F = 0.85 ng TEQfish/kg
dw (both freshwater and marine-provisional) -- matches nothing previously in the SPEC but is now
available as a VERIFIED-primary companion value to the 21.5 PEL.

---

## READY TO APPLY (verified-primary, no owner action needed to trust the number itself)

1. CCME PCDD/F sediment PEL = 21.5 ng TEQfish/kg dw (freshwater; marine is the same value, adopted
   provisionally) -- and ISQG = 0.85 ng TEQfish/kg dw. Source: CCME 2001 PCDD/F sediment guideline.
2. CCME total-PCB (bulk, non-coplanar) sediment ISQG = 34.1 ug/kg dw freshwater, 21.5 ug/kg dw marine --
   confirmed as a DISTINCT value/analyte/unit from item 1, not a duplicate. Source: same CCME document.
3. CCME PCDD/PCDF **fish** TEF values (van den Berg 1998 lineage) as republished in CCME 2001 Table 2 --
   all match the SPEC's "Fish WHO1998" PCDD/PCDF rows exactly (PCB rows in that column NOT covered by
   this source; still uncertain, see Task 3b).
(Items 1-3 are trustworthy NUMBERS; the BC findings below are VERIFIED-primary as FACTS but are NOT
"ready-to-wire values" -- they are owner-decision inputs, moved out of this list per codex.)

## VERIFIED-primary but OWNER-GATED (a fact, not a ready-to-wire value)

4. BC Technical Guidance 7 (2017) directive (VERIFIED-primary quote): BC CSR risk assessment PAH
   potency-equivalence work "strongly recommends" HC PQRA v2.0 (2012) Table 7 (the CCME-2010/WHO-1998
   8-PAH lineage), not a separate BC table. This is strong evidence the SPEC's "BC = WHO-1998 5-PAH
   TEFs" framing is wrong, BUT it is an OWNER DECISION (not a no-owner-action application): the doc's
   own STILL-UNCERTAIN item 1 still calls for a direct CSR Schedule 3.1/3.4 read before the framing is
   formally corrected. Do NOT auto-remap `bc-csr` on the strength of this alone.
5. BC Hazardous Waste Regulation (BC Reg 63/88) Schedule 1.1 PAH TEF table EXISTS as written (6
   compounds: benz[a]anthracene 0.1, benzo[a]pyrene 1.0, benzo[b]fluoranthene 0.1, benzo[k]fluoranthene
   0.1, dibenzo[a,h]anthracene 1.1, indeno[1,2,3-cd]pyrene 0.2) -- the EXISTENCE is confirmed twice
   verbatim, but the two divergent VALUES (1.1, 0.2) are NOT ready to wire (see STILL-UNCERTAIN item 2:
   they need a second tool-independent read), and this is a DIFFERENT regulation (hazardous waste, not
   contaminated sites) than the SPEC's "BC CSR" framing. Do NOT wire these values as verified BC factors.

## STILL UNCERTAIN (needs owner/primary doc before promotion)

1. **Whether a genuine "BC CSR 5-PAH WHO-1998" scheme exists at all.** No primary source found in this
   session supports it as stated. The SPEC's Section 4 claim "BC = WHO-1998 5-PAH TEFs" should be
   corrected or retracted pending a direct read of CSR Schedule 3.1/3.4's PAH-related standards and any
   BC-specific derivation memo, OR reframed as "BC CSR risk assessment = HC PQRA Table 7 (8-PAH)" per
   Task 1a's confirmed finding.
2. **BC Hazardous Waste Reg Schedule 1.1's two divergent values** (dibenzo[a,h]anthracene 1.1; indeno
   0.2) -- need a second, tool-independent verbatim confirmation before trusting these are not
   transcription artifacts.
3. **WHO-2005 mammalian TEF table, full 29-congener primary read.** Only secondary-corroborated this
   session (paywalled primary; two scanned-PDF mirrors fetched but not OCR-able with available tooling).
4. **WHO-1998 mammal and avian TEF columns, and all WHO-1998 PCB rows (fish/avian/mammal).** Primary
   (van den Berg 1998) located as a scanned PDF but not OCR-able this session; only the PCDD/PCDF fish
   column was independently verified via the CCME 2001 cross-reference.
5. Everything already flagged UNCERTAIN in the prior A2 pass and not touched by this session: the 6
   EPA-2010-draft RPFs whose primary PDF is binary-encoded (benzo[b]fluoranthene 0.8, benzo[j] 0.3,
   benzo[k] 0.03, dibenz[a,h]anthracene 10, indeno 0.07, benzo[g,h,i]perylene 0.009); CalEPA/OEHHA BaP
   oral CSF = 1.7 (403 on the primary doc).

## Session disposition + recommended actions (orchestrator, 2026-07-06e)

The A1 tables DO exist (on branches `feat/mo-cumulative-a1-2026-07-06` / `feat/mo-cumulative-a3a`, PRs
#532/#533); the research subagent ran on a main-based checkout that lacks them, so it verified against
the SPEC -- equivalent, since codex confirmed the tables match the SPEC cell-for-cell. Re-point the
findings at `tefTable.ts` / `rpfTable.ts` once merged.

**Nothing here is auto-applied.** Two findings are consequential enough to require OWNER adjudication
because they CONTRADICT the already-reviewed SPEC (#528) / plan (#529):

1. **[OWNER DECISION -- HIGH] The SPEC's "BC = WHO-1998 5-PAH TEFs" (Section 4) is likely WRONG.**
   Primary (BC TG-7 2017): BC CSR risk assessment uses HC PQRA v2.0 Table 7 = the 8-PAH CCME-2010 /
   WHO-1998 lineage already in the catalog. Recommended correction (owner rules):
   - Remap `RPF_SCHEME_BY_AUTHORITY['bc-csr']` from `who-1998-pah` -> the VERIFIED 8-PAH Table-7
     lineage, i.e. `ccme-2010` (or a NEW dedicated scheme scoped to exactly HC PQRA Table 7's 8 PAHs).
     Do NOT remap to `hc-pqra-v3` (codex): that scheme in the shipped A1 table is BROADER than Table 7
     (it carries provisional dibenzopyrenes + 5-methylchrysene) AND is not scoring-blocked, so a
     bc-csr->hc-pqra-v3 remap would introduce a NEW BC over-sum risk. Keep the whole remap owner-gated.
   - RETIRE or relabel the `who-1998-pah` scheme: there is no BC-CSR 5-PAH set. If the genuinely
     BC-specific 6-PAH table is ever wanted, add it as a DISTINCT `bc-hwr-schedule-1.1` scheme (it is
     the Hazardous WASTE Reg, not Contaminated Sites) -- and only after its two divergent values
     (dibenzo[a,h]anthracene 1.1, indeno 0.2) get a second independent verbatim read.
   - **Interim safety is already in place:** `computeBaPeq` BLOCKS `who-1998-pah` scoring
     (`RPF_SCHEME_SCORING_BLOCKED`, shipped in #533) -- so the spec-error scheme cannot silently
     over-sum BC BaP-eq while this decision is pending. The block is now doubly justified.
2. **[VERIFIED-primary -- apply when wiring] CCME "21.5" is two analytes:** PCDD/F PEL 21.5 ng
   TEQ/kg dw vs total-PCB marine ISQG 21.5 ug/kg dw (1000x). When any CCME criterion is wired, carry an
   explicit analyte+unit label (e.g. `ccme_marine_isqg_total_pcb_21.5_ugkg` vs
   `ccme_marine_pel_pcddf_teq_21.5_ngkg`). Companion verified value: CCME PCDD/F ISQG 0.85 ng TEQ/kg dw.

**No TEF/RPF qa-flag flips this session** -- WHO-2005 (secondary-only) and WHO-1998 mammal/avian/PCB
(UNCERTAIN, un-OCR-able primary) stay `needs_review`, correctly. Only the PCDD/PCDF *fish* WHO-1998
column is now VERIFIED-primary (CCME 2001) -- a future targeted flip of just those rows is defensible,
but a partial-column flip is deferred to a reviewed change, not done here.

## Tooling note for the next session

Several primary PDFs in this space (van den Berg 1998, WHO2005 reprints, several `ccme.ca` and
`www2.gov.bc.ca` documents) are **scanned images**, not text PDFs. This environment's `Read` tool needs
`pdftoppm` (poppler-utils) to render/OCR scanned PDF pages, and poppler is not installed here -- every
attempt to read a scanned PDF with the `pages` parameter failed with "pdftoppm is not installed." Other
PDFs (the two CCME PCDD/F documents used in Tasks 3-4, and BC TG-7) WERE text-extractable directly via
WebFetch/Read with no OCR needed -- those succeeded cleanly. Installing poppler-utils (or using a
different OCR path) would very likely close out Tasks 1 (BC CSR schedule text), 2 (WHO-2005 full table),
and 3b (WHO-1998 mammal/avian/PCB rows) in the next pass.
