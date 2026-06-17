# COMPANION: Aquatic-Life FCV/WQC Candidate Sheet -- eco-DIRECT (EqP) -- for OWNER disposition

Authored 2026-06-17 from a read-only research workflow (3 source sets: EPA ESB Tier-2 Compendium SCV/FCV
table; EPA National Recommended WQC CCC; ECCC/CCME). These are the AQUATIC-LIFE chronic values (protect
invertebrates / fish / aquatic plants) that drive the eco-DIRECT EqP pathway's `fcv_ug_per_L` input -- a
DIFFERENT value class from the dose-based wildlife (bird/mammal) TRVs in `ECO_TRV_CANDIDATE_ROWS_2026_06_17.md`.
needs_review; nothing promoted (no-AI-promotion rule). Companion to `ECO_DEFAULTS_CANDIDATE_PACKET_2026_06_17.md`.

PROVENANCE FLAGS (read before promotion):
- EPA ESB Compendium (EPA/600/R-02/016, Table 3-1) -- LOCAL pinned PDF (Zotero I2YMU9MP). Primary/canonical for the EqP path. 32 organics.
- EPA NRWQC CCC -- **LIVE WEB FETCH from epa.gov 2026-06-17 (NOT in local Zotero, confirmed after 9+ search variants).** Authoritative table, but NOT a pinned artifact -> owner should pin a dated PDF before promotion; treat as tier-2 until pinned. 44 rows.
- ECCC/CCME -- the Zotero item CHAWXHJJ was MISLABELED in the research hint as "FEQG"; it is actually FCSAP "Federal Interim Groundwater Quality Guidelines, 2016" (Cat. En14-91/2016-1). Its "Freshwater Life" column (CCME-adopted) yields only 2 EqP-usable organics (PCE, chloroform). RWUTZVXN = methodology only (no per-chemical values).

---

## 1. What these values are
AQUATIC-LIFE chronic water-quality values (ug/L) protecting the freshwater aquatic community (invertebrates,
fish, AND aquatic plants/algae) via the AWQC / GLI / CCME most-sensitive-genera methodology. DISTINCT from the
dose-based wildlife (bird/mammal) dietary TRVs. A value here answers "what water concentration protects
fish/inverts/plants," not "what dietary dose protects a heron or mink." Three classes (all water-column chronic, ug/L):
EPA ESB Tier-2 SCV (GLI-derived) / FCV (AWQC-derived); EPA NRWQC CCC (CWA 304(a) chronic; FCV-equivalent);
ECCC/CCME CWQG long-term.

## 2. Domain constraint (LOAD-BEARING)
This codebase's eco-direct EqP path is NONIONIC-ORGANICS-ONLY (neutral hydrophobic organics, log Kow >= ~2),
because ESB = Koc * (FCV or SCV). So the chronic water value IS the `fcv_ug_per_L` input -- but ONLY for
nonionic organics where Koc partitioning is valid. Therefore:
- Per-organic SCV/FCV/CCC/CWQG for neutral nonionic organics = directly-usable `fcv_ug_per_L` defaults.
- Metals (As/Cd/Cr/Cu/Pb/Hg/Ni/Se/Ag/Zn/Al/Fe/B), inorganic ions (chloride/cyanide/chlorine/sulfide/ammonia),
  ionizable/pH-dependent organics (PCP, glyphosate, trichlorfon), organometallics (TBT), miscible polar
  organics (methanol), ionizable PFAS (PFOA/PFOS) = CONTEXT ONLY; screened by a different sediment route, NOT
  this EqP path -> do NOT seed as eco-direct defaults.
- The EPA ESB "narcosis SCV" (italicized in the table) is "for comparison NOT for use"; the CONVENTIONAL FCV/SCV
  is the EqP input. Narcosis SCVs are excluded from all recommendations here.

## 3. Per-substance merged table
Preference order for the recommended default: EPA ESB FCV > EPA NRWQC CCC > EPA ESB SCV (GLI) > ECCC/CCME CWQG. All ug/L.

| Substance | CAS | EPA ESB | EPA NRWQC CCC | ECCC/CCME CWQG | EqP-usable | Rec. FCV default + source |
|---|---|---|---|---|---|---|
| Benzene | 71-43-2 | 130 (SCV) | -- | -- | yes | 130 (ESB SCV) |
| alpha-BHC | 319-86-8 | 2.2 (SCV) | -- | -- | yes | 2.2 (ESB SCV) |
| gamma-BHC (Lindane) | 58-89-9 | 0.080 (FCV) | N/A | -- | yes | 0.080 (ESB FCV) |
| Biphenyl | 92-52-4 | 14 (SCV) | -- | -- | yes | 14 (ESB SCV) |
| 4-Bromophenyl phenyl ether | 101-55-3 | 1.5 (SCV) | -- | -- | yes | 1.5 (ESB SCV) |
| Butyl benzyl phthalate | 85-68-7 | 19 (SCV) | -- | -- | yes | 19 (ESB SCV) |
| Chlorobenzene | 108-90-7 | 64 (SCV) | -- | -- | yes | 64 (ESB SCV) |
| Diazinon | 333-41-5 | 0.1699 (FCV) | 0.17 (CCC) | -- | yes | 0.1699 (ESB FCV; CCC corroborates) |
| Dibenzofuran | 132-64-9 | 3.7 (SCV) | -- | -- | yes | 3.7 (ESB SCV) |
| 1,2-Dichlorobenzene | 95-50-1 | 14 (SCV) | -- | -- | yes | 14 (ESB SCV) |
| 1,3-Dichlorobenzene | 541-73-1 | 71 (SCV) | -- | -- | yes | 71 (ESB SCV) |
| 1,4-Dichlorobenzene | 106-46-7 | 15 (SCV) | -- | -- | yes | 15 (ESB SCV) |
| Di-n-butyl phthalate | 84-74-2 | 35 (SCV) | -- | -- | yes | 35 (ESB SCV) |
| Diethyl phthalate | 84-66-2 | 270 (SCV)** | -- | -- | yes | 270 (ESB SCV; footnote **) |
| Endosulfan (mixed) | 115-29-7 | 0.056 (FCV) | -- | -- | yes | 0.056 (ESB FCV) |
| alpha-Endosulfan | 959-98-8 | 0.056 (FCV) | 0.056 (CCC) | -- | yes | 0.056 (ESB FCV; CCC corroborates) |
| beta-Endosulfan | 33213-65-9 | 0.056 (FCV) | 0.056 (CCC) | -- | yes | 0.056 (ESB FCV; CCC corroborates) |
| Ethylbenzene | 100-41-4 | 7.3 (SCV) | -- | -- | yes | 7.3 (ESB SCV) |
| Hexachloroethane | 67-72-1 | 12 (SCV) | -- | -- | yes | 12 (ESB SCV) |
| Malathion | 121-75-5 | 0.097 (SCV) | 0.1 (CCC) | -- | yes | 0.097 (ESB SCV; CCC corroborates) |
| Methoxychlor | 72-43-5 | 0.019 (SCV) | 0.03 (CCC) | -- | yes | 0.019 (ESB SCV; more conservative) |
| Pentachlorobenzene | 608-93-5 | 0.47 (SCV) | -- | -- | yes | 0.47 (ESB SCV) |
| 1,1,2,2-Tetrachloroethane | 79-34-5 | 610 (SCV) | -- | -- | yes | 610 (ESB SCV) |
| Tetrachloroethene (PCE) | 127-18-4 | 98 (SCV) | -- | 110 (CWQG) | yes | 98 (ESB SCV; more conservative) |
| Tetrachloromethane (CCl4) | 56-23-5 | 240 (SCV) | -- | -- | yes | 240 (ESB SCV) |
| Toluene | 108-88-3 | 9.8 (SCV) | -- | -- | yes | 9.8 (ESB SCV) |
| Toxaphene | 8001-35-2 | 0.039 (FCV) | 0.0002 (CCC) | -- | yes | **NEEDS REVIEW -- 195x split** |
| Tribromomethane (Bromoform) | 75-25-2 | 320 (SCV) | -- | -- | yes | 320 (ESB SCV) |
| 1,2,4-Trichlorobenzene | 120-82-1 | 110 (SCV) | -- | -- | yes | 110 (ESB SCV) |
| 1,1,1-Trichloroethane | 71-55-6 | 11 (SCV) | -- | -- | yes | 11 (ESB SCV) |
| Trichloroethene (TCE) | 79-01-6 | 47 (SCV) | -- | -- | yes | 47 (ESB SCV) |
| m-Xylene | 108-38-3 | 67 (SCV)*** | -- | -- | yes | 67 (ESB SCV; footnote ***) |
| Trichloromethane (Chloroform) | 67-66-3 | -- | -- | 1.8 (CWQG) | yes | 1.8 (CCME CWQG -- only source) |
| Aldrin | 309-00-2 | -- | N/A (acute only) | -- | yes | NONE -- no chronic value |
| Carbaryl | 63-25-2 | -- | 2.1 (CCC) | -- | yes | 2.1 (NRWQC CCC) |
| Chlordane | 57-74-9 | -- | 0.0043 (CCC) | -- | yes | 0.0043 (NRWQC CCC) |
| Chlorpyrifos | 2921-88-2 | -- | 0.041 (CCC) | -- | yes | 0.041 (NRWQC CCC) |
| Demeton | 8065-48-3 | -- | 0.1 (CCC) | -- | yes | 0.1 (NRWQC CCC; older basis -- verify) |
| Dieldrin | 60-57-1 | -- | 0.056 (CCC) | -- | yes | 0.056 (NRWQC CCC) |
| Guthion (Azinphos-methyl) | 86-50-0 | -- | 0.01 (CCC) | -- | yes | 0.01 (NRWQC CCC; older basis -- verify) |
| Heptachlor | 76-44-8 | -- | 0.0038 (CCC) | -- | yes | 0.0038 (NRWQC CCC) |
| Heptachlor epoxide | 1024-57-3 | -- | 0.0038 (CCC) | -- | yes | 0.0038 (NRWQC CCC) |
| Mirex | 2385-85-5 | -- | 0.001 (CCC) | -- | yes | 0.001 (NRWQC CCC; older basis -- verify) |
| Nonylphenol | 84852-15-3 | -- | 6.6 (CCC) | -- | yes | 6.6 (NRWQC CCC) |
| Parathion | 56-38-2 | -- | 0.013 (CCC) | -- | yes | 0.013 (NRWQC CCC) |
| PCBs (total) | 1336-36-3 | -- | 0.014 (CCC) | -- | yes | 0.014 (NRWQC CCC -- verify vs 0.03 misread) |
| 4,4'-DDT | 50-29-3 | -- | 0.001 (CCC) | -- | yes | 0.001 (NRWQC CCC) |

CONTEXT-ONLY (NOT seeded on eco-direct EqP): all metals/metalloids, inorganic ions, PCP, glyphosate,
trichlorfon, methanol, TBT, acrolein, PFOA, PFOS (metals/ionics/reactives -- routed to the sediment-metal screen).
Footnotes: ** DEP SCV revised 210->270 ug/L (Adams et al. 1995 LC50 included, Mount 2008). *** m-Xylene SCV per Mount 2006.

## 4. Coverage + gaps
- In-scope nonionic organics WITH a defensible single FCV default (seed candidates): ~44 (32 ESB + ~12 NRWQC + chloroform from CCME).
- NO defensible chronic value: Aldrin (acute only).
- HITL adjudication BEFORE seeding: **Toxaphene** (ESB FCV 0.039 vs NRWQC CCC 0.0002 = ~195x; later residue/BCF-driven CCC is more conservative -- owner picks basis); **PCB** (confirm 0.014 vs a second-fetch misread of 0.03 against the NRWQC footnote); older-FRV-basis pesticide CCCs (demeton, guthion, malathion, methoxychlor, mirex -- confirm EqP suitability or down-tier).

## 5. Owner disposition (no qa_status written; inline approval = attestation)
1. SEED as eco-direct-eqp `fcv_ug_per_L` defaults (recommend): the ~42 in-scope organics with an unambiguous single FCV (exclude Toxaphene + Aldrin), needs_review.
2. SOURCE-TIER: EPA ESB (pinned, primary) -> accept tier-1; EPA NRWQC (live fetch) -> **pin a dated PDF first, then accept tier-2**; ECCC/CCME (pinned) -> tier-2 alternate (chloroform only).
3. NEEDS_REVIEW (do not seed until adjudicated): Toxaphene basis; PCB 0.014-vs-0.03; older-FRV pesticides.
4. EXCLUSIONS (confirm not to seed on EqP): Aldrin; all metals/ions/PCP/glyphosate/trichlorfon/methanol/TBT/acrolein/PFOA/PFOS.
5. Units: all candidates ug/L (CCME mg/L x1000 conversions + ESB CAS line-wrap fixes documented for spot-check).

## 6. The two eco value classes are now both covered
- **eco-direct (aquatic life: inverts/fish/plants)** -> THIS sheet (FCV/SCV/CCC, ~44 organics, `fcv_ug_per_L`).
- **eco-food (wildlife: birds/mammals)** -> `ECO_TRV_CANDIDATE_ROWS_2026_06_17.md` (dose-based TRVs, `TRV_eco_mg_per_kg_bw_day`).
Plus the EqP machinery params (foc, fLipid, BSAF) in `ECO_DEFAULTS_CANDIDATE_PACKET_2026_06_17.md`.
