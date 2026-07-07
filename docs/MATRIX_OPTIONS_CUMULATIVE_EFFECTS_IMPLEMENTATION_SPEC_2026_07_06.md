# Matrix Options -- Cumulative-Effects Implementation & Verification Spec (2026-07-06)

Consolidates three Gemini Deep Research reports (owner-run 2026-07-06) into a catalog-ready spec for
implementing cumulative/additive toxicity methods (TEF/TEQ for dioxin-like compounds; RPF/BaP-equivalent
for carcinogenic PAHs; total/non-dioxin-like PCB mass methods). Companion to the research plan
`MATRIX_OPTIONS_CUMULATIVE_EFFECTS_DEEP_RESEARCH_PLAN_2026_07_06.md`.

## 0. STATUS AND CONFIDENCE (read first)

- **Everything below is a PROMOTION CANDIDATE, not an approved catalog value.** The source is
  AI-generated deep research. Every numeric factor / TRV / criterion MUST be verified against its cited
  primary source and owner-attested before it enters the catalog (needs_review -> verify -> promote,
  per the dashboard rules). This doc is the work-list + the reference scaffold, not the source of truth.
- **Reference-quality caveat:** the three reports lean heavily on a small number of secondary sources
  (notably one Taylor & Francis dioxin/furan review cited repeatedly) and show citation-numbering
  artifacts. Treat the STRUCTURE and METHOD descriptions as reliable orientation; treat every NUMBER as
  unverified until checked against the primary document named in Section 7.
- **Strong corroboration signal (Section 5):** where the reports overlap with values ALREADY wired in
  our catalog, they match cleanly (HC non-DL PCB 1e-5, EPA Aroclor-1254 RfD 2e-5, EPA total-PCB SF 2.0,
  NRWQC FW CCC 0.014, TCDD RfD 7e-10). That raises confidence in the mass-based PCB layer specifically.

## 1. The three methods (what they are; how substances combine)

**A. Dioxin-like compounds (PCDD + PCDF + 12 dioxin-like PCBs) -- TEF/TEQ.** Shared AhR mechanism =>
dose additivity. Reference = 2,3,7,8-TCDD (TEF 1.0). `TEQ = sum(C_i * TEF_i)` over the 29 target
congeners; compare TEQ to a TCDD-anchored TDI/RfD. Non-detects: half the method detection limit
(0.5*MDL). Analysis requires HRGC/HRMS (EPA 1613 / 8290A / EPS 1/RM/19). Bulk "total dioxins" is
useless for TEQ -- congener-specific quantitation is mandatory.

**B. Carcinogenic PAHs -- RPF / BaP-equivalent.** Shared mutagenic (DNA-adduct) MoA => dose additivity.
Reference = benzo[a]pyrene (RPF 1.0). `BaP_eq = sum(C_i * RPF_i)` over the carcinogenic PAHs; the summed
BaP-eq is the exposure point concentration, multiplied by the BaP oral cancer slope factor (or
inhalation unit risk). Two extra multipliers: (i) **ADAFs** for the mutagenic MoA -- 10 (age 0-<2),
3 (2-<16), 1 (16+), applied per age bin; (ii) HC also applies a dermal **relative absorption factor
(RAF)** (ties to our existing `abs_dermal` fields). Non-carcinogenic PAHs are EXCLUDED from the sum and
assessed separately as non-cancer hazard quotients.

**C. Total / non-dioxin-like PCBs -- mass-based (NOT potency-weighted).** "Total PCBs" is an analytical
construct: sum of Aroclors (GC-ECD pattern match), sum of congeners/homologs (GC-MS/HRMS), or an
indicator subset x a multiplier (ICES-7 x ~2.5-5; NOAA-18 x ~2.0). **The load-bearing rule (answers the
owner's question):** Health Canada derives its non-DL PCB oral TDI by taking the Aroclor-1254 TDI and
applying a **50% apportionment** (Baars et al. 2001) so the non-DL mass (scored via the ICES-7
congeners: PCB-28,52,101,118,138,153,180) and the dioxin-like fraction (scored via TEQ, Method A) are
assessed CONCURRENTLY WITHOUT DOUBLE-COUNTING. BC/Ontario likewise require BOTH a mass-based total-PCB
check AND a separate dioxin-like TEQ check; they must not be conflated.

## 2. Reference table -- Dioxin-like TEF values (VERIFY before promote)

29 congeners. WHO 2005 mammalian is the current statutory standard for most frameworks; WHO 1998
taxa-specific sets are required by CCME/FCSAP for ecological (fish/avian) receptors. NOTE the reports
claim HC TRV v4.0 (2025) has moved to the WHO-2022 / DeVito-2024 set (PCB-126 0.1->0.05,
1,2,3,7,8-PeCDD 1.0->0.4) -- THIS IS THE #1 VERIFY ITEM (check the HC v4.0 PDF the owner has), because
it means the catalog must carry MULTIPLE TEF editions keyed by framework, not one table.

| Congener | Mammal WHO2005 | Mammal WHO1998 | Avian WHO1998 | Fish WHO1998 |
|---|---|---|---|---|
| 2,3,7,8-TCDD | 1.0 | 1.0 | 1.0 | 1.0 |
| 1,2,3,7,8-PeCDD | 1.0 | 1.0 | 1.0 | 1.0 |
| 1,2,3,4,7,8-HxCDD | 0.1 | 0.1 | 0.05 | 0.5 |
| 1,2,3,6,7,8-HxCDD | 0.1 | 0.1 | 0.01 | 0.01 |
| 1,2,3,7,8,9-HxCDD | 0.1 | 0.1 | 0.1 | 0.01 |
| 1,2,3,4,6,7,8-HpCDD | 0.01 | 0.01 | <0.001 | 0.001 |
| OCDD | 0.0003 | 0.0001 | <0.0001 | <0.0001 |
| 2,3,7,8-TCDF | 0.1 | 0.1 | 1.0 | 0.05 |
| 1,2,3,7,8-PeCDF | 0.03 | 0.05 | 0.1 | 0.05 |
| 2,3,4,7,8-PeCDF | 0.3 | 0.5 | 1.0 | 0.5 |
| 1,2,3,4,7,8-HxCDF | 0.1 | 0.1 | 0.1 | 0.1 |
| 1,2,3,6,7,8-HxCDF | 0.1 | 0.1 | 0.1 | 0.1 |
| 1,2,3,7,8,9-HxCDF | 0.1 | 0.1 | 0.1 | 0.1 |
| 2,3,4,6,7,8-HxCDF | 0.1 | 0.1 | 0.1 | 0.1 |
| 1,2,3,4,6,7,8-HpCDF | 0.01 | 0.01 | 0.01 | 0.01 |
| 1,2,3,4,7,8,9-HpCDF | 0.01 | 0.01 | 0.01 | 0.01 |
| OCDF | 0.0003 | 0.0001 | <0.0001 | <0.0001 |
| PCB-77 (3,3',4,4'-TCB) | 0.0001 | 0.0001 | 0.05 | 0.0001 |
| PCB-81 (3,4,4',5-TCB) | 0.0003 | 0.0001 | 0.1 | 0.0005 |
| PCB-126 (3,3',4,4',5-PeCB) | 0.1 | 0.1 | 0.1 | 0.005 |
| PCB-169 (3,3',4,4',5,5'-HxCB) | 0.03 | 0.01 | 0.001 | 0.00005 |
| PCB-105 | 0.00003 | 0.0001 | 0.0001 | <0.000005 |
| PCB-114 | 0.00003 | 0.0005 | 0.0001 | <0.000005 |
| PCB-118 | 0.00003 | 0.0001 | 0.00001 | <0.000005 |
| PCB-123 | 0.00003 | 0.0001 | 0.00001 | <0.000005 |
| PCB-156 | 0.00003 | 0.0005 | 0.0001 | <0.000005 |
| PCB-157 | 0.00003 | 0.0005 | 0.0001 | <0.000005 |
| PCB-167 | 0.00003 | 0.00001 | 0.00001 | <0.000005 |
| PCB-189 | 0.00003 | 0.0001 | 0.00001 | <0.000005 |

Dioxin-like anchor TRVs (VERIFY): TCDD oral RfD 7e-10 mg/kg-d (EPA IRIS 2012) -- MATCHES catalog. HC
dioxin-like-PCB/TCDD oral TDI 2.3e-9 mg TEQ/kg-d (HC TRV v4.0 2025; JECFA-2002 PTMI 70 pg/kg-mo / 30) --
currently UNPROMOTED in our catalog (only in a markdown packet); this is a top promotion candidate.

## 3. Reference table -- PAH RPF values (VERIFY before promote)

| PAH | CAS | Nisbet&LaGoy 1992 | HC PQRA v3 | EPA 2010 draft |
|---|---|---|---|---|
| Naphthalene | 91-20-3 | 0.001 | excluded | excluded |
| Acenaphthylene | 208-96-8 | 0.001 | excluded | excluded |
| Acenaphthene | 83-32-9 | 0.001 | excluded | excluded |
| Fluorene | 86-73-7 | 0.001 | excluded | excluded |
| Phenanthrene | 85-01-8 | 0.001 | 0.001 (prov) | 0 (excluded) |
| Anthracene | 120-12-7 | 0.01 | excluded | 0 (excluded) |
| Fluoranthene | 206-44-0 | 0.001 | excluded | excluded |
| Pyrene | 129-00-0 | 0.001 | excluded | 0 (excluded) |
| Benz[a]anthracene | 56-55-3 | 0.1 | 0.1 (rec) | 0.2 |
| Chrysene | 218-01-9 | 0.01 | 0.01 (rec) | 0.1 |
| Benzo[b]fluoranthene | 205-99-2 | 0.1 | 0.1 (rec) | 0.8 |
| Benzo[j]fluoranthene | 205-82-3 | 0.1 | 0.1 (rec) | 0.3 |
| Benzo[k]fluoranthene | 207-08-9 | 0.1 | 0.1 (rec) | 0.03 |
| Benzo[a]pyrene | 50-32-8 | 1.0 (index) | 1.0 (index) | 1.0 (index) |
| Dibenz[a,h]anthracene | 53-70-3 | 5.0 | 1.0 (rec) | 10 |
| Indeno[1,2,3-cd]pyrene | 193-39-5 | 0.1 | 0.1 (rec) | 0.07 |
| Benzo[g,h,i]perylene | 191-24-2 | 0.01 | 0.01 (rec) | 0.009 |
| Dibenzo[a,e]pyrene | 192-65-4 | 1.0 | 1.0 (prov) | 0.4 |
| Dibenzo[a,h]pyrene | 189-64-0 | 10 | 10 (prov) | 0.9 |
| Dibenzo[a,i]pyrene | 189-55-9 | 10 | 10 (prov) | 0.6 |
| Dibenzo[a,l]pyrene | 191-30-0 | 10 | 10 (prov) | 30 |
| 5-Methylchrysene | 3697-24-3 | n/d | 1.0 (prov) | n/d |
| Cyclopenta[c,d]pyrene | 27208-37-3 | n/d | n/d | 0.4 |

BaP anchor slope factors (VERIFY -- see the discrepancy in Section 5): HC PQRA v3 oral CSF
2.3 (mg/kg-d)^-1 (Neal & Rigdon 1967); EPA IRIS-2017 oral CSF 1.0 (mg/kg-d)^-1; EPA pre-2017 7.3;
IUR: EPA-2017 6e-4 (ug/m3)^-1. HC uses Table 2 "Recommended" (= CCME 2010 values) + Table 3
"Provisional". BC CSR uses a 5-PAH WHO-1998 BaP-TEF subset. ADAFs: 10 / 3 / 1.

## 4. Framework -> approach -> criterion matrix (the owner's core question)

Which PCB approach applies to which standard (all values VERIFY; ug/g = mg/kg = ppm):

- **BC CSR Sched 3.1 soil** (total PCBs = sum of 9 Aroclors 1016/1221/1232/1242/1248/1254/1260/1262/1268):
  WLN 8, AL/PL/RL 15, CL/IL 350 ug/g. **DL-PCBs ALSO required** as PCDD/F TEQ (WHO 2005). BOTH REQUIRED.
- **BC CSR Sched 3.4 sediment** (dwt): FW-sensitive 1.7, FW-typical 3.3, marine-sensitive 1.2,
  marine-typical 2.3 ug/g. DL-PCB TEQ also required.
- **CCME soil SQG**: Ag 0.5, Res/Park 1.3, Comm/Ind 33 mg/kg (bulk total PCB; HH pathways "Not Calc").
- **CCME sediment**: FW ISQG 34.1 / PEL 277 ug/kg; marine ISQG 21.5 / PEL 189 ug/kg. (VERIFY -- do not
  confuse the marine total-PCB ISQG 21.5 ug/kg with the separately-cited dioxin-TEQ sediment PEL
  "21.5 ng TEQ/kg"; the reports reuse 21.5 for two different analytes -- a likely conflation to check.)
- **HC TRV v4.0**: non-DL PCB oral TDI 1e-5 mg/kg-bw/d (ICES-7 mass) + separate dioxin/DL-PCB TDI
  2.3e-9 mg TEQ/kg-d. BOTH REQUIRED, 50% apportioned to avoid double-count.
- **US EPA IRIS**: Aroclor-1254 RfD 2e-5, Aroclor-1016 RfD 7e-5 mg/kg-d; tiered cancer SF 2.0 / 0.4 /
  0.07 (mg/kg-d)^-1 by persistence tier.
- **US EPA NRWQC** (total = sum of all homolog/isomer/congener/Aroclor): saltwater CCC 0.03,
  freshwater CCC 0.014 ug/L.
- **MacDonald 2000 consensus sediment** (EPA Superfund): TEC 59.8 / PEC 676 ug/kg dwt.
- **Ontario O.Reg 153/04 soil**: ~0.3 ug/g (Table 1/2), 0.2 (Table 3 non-potable); dioxin/furan TEQ
  assessed separately. **Ontario PSQG sediment**: NEL 0.01, LEL 0.07 ug/g dwt, SEL 530 ug/g-OC
  (SEL is organic-carbon-normalized -- multiply by site TOC fraction, cap 10%).

Analogous mapping exists for dioxins/furans (TEQ per Section 2, edition per framework) and PAHs
(BaP-eq per Section 3): BC = WHO-1998 5-PAH TEFs; CCME/Ontario = CCME-2010 8-PAH PEFs + IACR for water;
HC = PQRA v3 Table 2/3 + dermal RAF + ADAF; EPA = 1993/2010 RPF + mandatory ADAFs + IRIS-2017 BaP CSF.

## 5. Catalog cross-check (what we already have vs the research)

CORROBORATED (research matches wired values -- raises confidence):
- `total_pcbs_aroclor_1254` HC non-DL 1e-5 (matches); EPA Aroclor-1254 RfD 2e-5 (matches).
- EPA total-PCB high-risk cancer SF 2.0 (matches the borrowed IRIS PCBs SF on total_pcbs_aroclor_1254).
- `polychlorinated_biphenyls_total_pcbs` eco FCV 0.014 ug/L = EPA NRWQC FW CCC (matches).
- `2_3_7_8_tetrachlorodibenzo_p_dioxin` RfD 7e-10 = EPA IRIS 2012 (matches).

DISCREPANCY TO RESOLVE (feeds the benzo_a_pyrene HELD decision):
- Catalog benzo_a_pyrene sf_oral rows are HC-v4.0 1.289 and EPA 2.0. Research gives HC PQRA v3 (2021)
  2.3 and EPA IRIS-2017 1.0 (pre-2017 7.3). Implication to verify: HC likely revised the BaP CSF
  2.3 (v3) -> 1.289 (v4.0 2025); and our EPA "2.0" is not the IRIS-2017 1.0 -- identify its true source.

GAPS the research can fill (promotion candidates, post-verification):
- Dioxin-like PCB TEQ TDI 2.3e-9 mg TEQ/kg-d (now has an HC v4.0 locator) -> promote as a keyed value.
- The 29-congener TEF reference table(s) + the PAH RPF reference table (new reference data).
- PCDF (furan) congeners -- absent from the catalog entirely.
- A TEF-weighted TEQ equation and an RPF-weighted BaP-eq equation in `equations.json` (today only a
  single-substance `hazardQuotient` exists).

## 6. Implementation approach (later, owner-attested lane)

1. **Reference data:** add TEF factor table(s) (keyed by edition: WHO-2005, WHO-1998-mammal/avian/fish,
   and WHO-2022/DeVito-2024 IF the HC v4.0 verify confirms it) and the PAH RPF table(s) (Nisbet-1992,
   HC-PQRA-v3, EPA-2010) as reference datasets, each row source-attributed.
2. **Equations:** add `TEQ = sum(C_i * TEF_i)` and `BaP_eq = sum(C_i * RPF_i)` to `equations.json`,
   plus ADAF age-binning and the HC dermal RAF hook (reuse `abs_dermal`).
3. **Substance/keys:** promote the dioxin-like PCB TEQ TDI; add PCDF congeners as needed; keep the
   existing total_pcbs_aroclor_1254 (non-DL mass) key -- the research VALIDATES the current three-key
   PCB layout and the "never additive; total-default, congener/Aroclor as alternatives" convention.
4. **Framework-option UX (owner's 2026-07-06 requirement):** the framework/standard selector must make
   explicit which PCB/dioxin/PAH approach + which TEF/RPF edition applies, and must present BOTH the
   mass-based total-PCB check AND the DL-PCB TEQ check where a framework requires both (BC, Ontario, HC)
   -- never conflated, never double-counted.
5. **Ties to:** PCB-key consolidation (Option A, `MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`);
   the Ontario MECP 2026 TRVs ingestion backlog; `abs_dermal` (Group-2 dermal RAF); the benzo_a_pyrene
   HELD decision (Section 5 discrepancy).

## 7. Verification checklist (BEFORE any promotion)

Verify each candidate value against its PRIMARY source (not the research prose). Owner has the HC PDF;
the rest are public:
- HC TRV v4.0 (2025) PDF (owner G-drive; publications.gc.ca H129-108-2025): confirm (a) the dioxin/
  DL-PCB TDI 2.3e-9 mg TEQ/kg-d + locator; (b) the non-DL PCB TDI 1e-5 + the 50%/ICES-7 method;
  (c) THE BIG ONE -- whether v4.0 uses WHO-2022/DeVito-2024 TEFs or WHO-2005; (d) the BaP CSF 1.289.
- WHO 2005 (Van den Berg et al. 2006) + WHO 1998 + DeVito et al. 2024: confirm the TEF tables.
- HC PQRA v3 (2021/2023): confirm the PAH RPF Table 2/3 + BaP CSF 2.3 + dermal RAF.
- US EPA IRIS: TCDD RfD 7e-10 (2012), BaP 2017 review (CSF 1.0, IUR 6e-4), Aroclor 1254/1016 RfDs,
  tiered PCB CSFs, NRWQC total-PCB CCCs.
- CCME SQG/SedQG + BC CSR Sched 3.1/3.4 + Protocol 28 + Ontario O.Reg 153/04 + PSQG: confirm the
  criteria in Section 4 (and resolve the CCME 21.5 total-PCB-vs-dioxin-TEQ ambiguity).

Nothing here changes a catalog value until each row is verified and owner-attested. This spec + the
three source reports are the inputs to that lane.
