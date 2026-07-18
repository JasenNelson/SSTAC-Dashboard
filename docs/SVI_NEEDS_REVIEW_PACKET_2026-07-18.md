# #3 SVI Inhalation Params -- Research Findings + needs_review Packet (2026-07-18)

Owner-authorized source research + vision-first extraction (owner instruction 2026-07-18). NOTHING
applied: this is a draft `needs_review` packet for owner-gated review. No catalog `--apply`, no
`current_default`. Pathway = `human-health-inhalation` (added to the taxonomy by PR #678; 0 rows use
it yet).

## MAJOR FINDING (reframes the gap)

The 8 slots were framed as "missing HC SVI-2023 values." Research shows most are NOT distinct HC
values -- **HC/FCSAP defers to the CCME baseline already in the system.** The authoritative primary
source is the **CCME 2014 "A Protocol for the Derivation of Soil Vapour Quality Guidelines for
Protection of Human Exposures Via Inhalation of Vapours"** (PN 1531, ISBN 978-1-77202-013-7, (c) CCME
2014). This document is:
- Present LOCALLY: `G:\...\References\A Protocol for the Derivation of Soil Vapour Quality Guidelines
  for Protection of Human Exposures Via Inhalation of Vapours (en).pdf` (the OWNER packet mis-flagged
  it "BC/SABCS" -- it is CCME, verified from the title page).
- Fetchable from ccme.ca (not 403-blocked, unlike canada.ca): https://ccme.ca/en/res/a-protocol-for-the-derivation-of-soil-vapour-quality-guidelines-for-protection-of-human-exposures-via-inhalation-of-vapours-en.pdf
- Vision-first extracted this session (Read `pages=`, no OCR/poppler) -- citations below are exact.

## needs_review rows -- PRIMARY-SOURCE CONFIRMED (from CCME 2014, vision-first)

| slot | value | unit | source | citation (CCME 2014 PN 1531) | qa_status |
|---|---|---|---|---|---|
| hc_svi_attenuation_factor_residential | 0.03 | unitless (alpha) | CCME 2014 (HC/FCSAP defers) | App B, p28, "Minimum separation distance..." para: "default attenuation factors of 0.03 (residential)..." | needs_review |
| hc_svi_attenuation_factor_commercial | 0.01 | unitless (alpha) | CCME 2014 (HC/FCSAP defers) | App B, p28, same para: "...and 0.01 (commercial/industrial)." | needs_review |
| hc_svi_model_variant_statement | Johnson-Ettinger (1991) indoor-air attenuation algorithm as adopted by CCME 2014 (Eq A-5), with a FIXED Qsoil by soil texture/land use (167 coarse / 16.7 fine cm3/s, Table B.2) rather than permeability-calculated. Outdoor pathway uses VF_sv,amb (Eq A-13). | text | CCME 2014 | App A Eq A-1/A-3 (indoor threshold/non-threshold), Eq A-5 (alpha), Eq A-13 (outdoor VF), p22-25; References p20 (Johnson & Ettinger 1991) | needs_review |
| hc_pqra_vf_pef_methodology_statement | HC PQRA / FCSAP defers to the CCME 2014 soil vapour protocol: indoor air via attenuation factor alpha (Eq A-5, generic Tier-1 = 0.03 resid / 0.01 comm); outdoor air via volatilization factor VF_sv,amb (Eq A-13). No separate HC VF/PEF model for soil vapour. | text | CCME 2014 | App A p22-25 | needs_review |

Bonus well-cited CCME 2014 defaults (available if the calculator wants source-backed exposure inputs):
- Exposure scenarios (Table B.1, p26): Residential D1=24 h/d, D2=7 d/wk, D3=52 wk/yr; Commercial 10, 5, 48. Non-threshold Tier-1 Exposure Term defaults to "one" (per Health Canada Part I 2004).
- Building params (Table B.3, p27): ACH 0.5 resid / 0.9 comm; Lcrack 11.25 cm; foundation 100 cm source separation.
- BAF = 10 (Tier-1 petroleum HC: BTEX, F1, F2 non-aviation, TMBs, naphthalene, straight-chain alkanes).
- Outdoor (Table B.4, p28): mixing zone 150 cm; air velocity 400 cm/s; depth 100 cm; source width 3000 cm.

## HC-DISTINCT slots -- values IDENTIFIED, primary citation BLOCKED (canada.ca 403)

| slot | web-identified value | authoritative source | blocker | remaining need |
|---|---|---|---|---|
| hc_pqra_target_cancer_risk | 1x10-5 (distinct from EPA 1e-6) | HC PQRA v3.0 (FCSAP Part I) -- HC states it uses 1 in 10^5 for inhalation | canada.ca WebFetch = HTTP 403 | primary-page quote from HC PQRA (owner supplies PDF, or vision-extract a LOCAL HC PQRA copy -- none found locally) |
| hc_pqra_target_hazard_quotient | ~0.2 (HC PQRA convention; UNCONFIRMED) | HC PQRA v3.0 | 403 | confirm exact HQ + page from HC PQRA |
| hc_pqra_inhalation_rate_adult | 15.8 m3/day (= CCME baseline, NOT distinct) | HC/CCME exposure factors (Richardson 1997 compendium; EPA EFH 2011) | 403 for HC page | confirm HC uses 15.8 (matches baseline -> likely "defer, not distinct") |
| hc_pqra_inhalation_rate_child_or_toddler | 9.3 m3/day toddler 7mo-4yr (= CCME baseline) | HC/CCME exposure factors | 403 for HC page | confirm HC uses 9.3 (matches baseline -> likely "defer") |

## Search log (owner asked for this)
- Local corpus (metadata/filenames): References has the CCME 2014 protocol (primary, used above) +
  ARBCA VI guidance + SABCS 2006 Soil Vapour + Soil-Vapour-Panel-Stage-1 + HC Site Characterization
  Manual V1-3 + DQRA HC 2009 + HC 2025 TRV + several FCSAP docs. **No file dated/named HC SVI-2023**
  (it likely does not exist as a distinct doc; HC vapour intrusion guidance = FCSAP Part VII 2010d +
  deferral to CCME 2014).
- Zotero local API (localhost:23119): NOT running -> unavailable this session.
- Web: canada.ca (HC PQRA / exposure factors) = HTTP 403 to WebFetch (search snippets OK, primary
  quotes blocked). ccme.ca = fetchable (used). Rejected non-primary hits (research papers, other
  jurisdictions) per "primary/official only".

## HC -> CCME deferral chain (documented per owner request)
For the SVI attenuation/model slots, the HC/FCSAP authority chain is:
1. **HC PQRA** (Federal Contaminated Site Risk Assessment, Part I -- Human Health PQRA, v3.0) sets
   the RECEPTOR/target framework (target cancer risk, HQ, exposure factors).
2. **FCSAP Part VII** (Guidance for Soil Vapour Intrusion Assessment at Contaminated Sites,
   Health Canada 2010d) is HC's soil-vapour-intrusion guidance; it DEFERS to CCME for the numeric
   attenuation model/factors rather than defining its own.
3. **CCME 2014 Soil Vapour Protocol** (PN 1531) is the numeric primary source actually used for the
   attenuation factors (0.03/0.01), the indoor attenuation model (Eq A-5, Johnson-Ettinger), and the
   outdoor VF (Eq A-13). This is what the 4 confirmed rows above cite.
So attenuation/model slots are legitimately CCME-sourced with an HC deferral note; they are NOT
"missing HC values."

## BLOCKED HC PQRA slots -- EXACT missing quote/page needed (owner request)
No local HC PQRA primary copy exists (searched References + Regulatory-Review this session; found the
**Detailed** QRA "DQRA HC final draft Feb 2009" but NOT the **Preliminary** QRA / FCSAP Part I). canada.ca
is 403-blocked to WebFetch. Each blocked slot below needs ONE exact primary quote:

| slot | exact missing artifact | expected value (web-identified, UNCITED) | canonical source doc |
|---|---|---|---|
| hc_pqra_target_cancer_risk | the sentence stating HC's target incremental lifetime cancer risk for inhalation + its page | "1 x 10^-5" | HC FCSAP Part I (PQRA) v3.0, section on non-threshold/carcinogens |
| hc_pqra_target_hazard_quotient | the sentence stating HC's target hazard quotient + page | "0.2" (UNCONFIRMED) | HC FCSAP Part I (PQRA) v3.0, section on threshold contaminants |
| hc_pqra_inhalation_rate_adult | HC's default adult inhalation rate table row + page | 15.8 m3/day (matches CCME baseline) | HC exposure factors (Richardson 1997 compendium) or FCSAP Part I receptor table |
| hc_pqra_inhalation_rate_child_or_toddler | HC's default toddler (7mo-4yr) inhalation rate row + page | 9.3 m3/day (matches CCME baseline) | same |

To unblock: owner drops a LOCAL copy of HC FCSAP Part I (PQRA v3.0) -> AI vision-extracts the exact
quote+page for each, OR owner attests the values above. Until then these 4 slots stay BLOCKED
(needs_review, no value emitted).

## Recommendation (owner-gated next steps)
1. ACCEPT the 4 CCME-2014-sourced needs_review rows above (attenuation 0.03/0.01, model, VF/PEF
   methodology) -- primary-source, vision-first, exact citations. AI can emit them as catalog JSON via
   `vfpef_extract_hc.py fill` on owner go-ahead (still needs_review; no apply).
2. For the 4 HC-distinct/deferral slots: either (a) owner drops a LOCAL copy of HC PQRA v3.0 (FCSAP
   Part I) so AI vision-extracts the exact 1e-5 / HQ / breathing-rate pages, or (b) owner confirms
   "HC defers to CCME baseline for inhalation rates; target cancer risk = 1e-5 per HC PQRA" as an
   attested value. The FCSAP Part VII (2010d, Soil Vapour Intrusion) + HC PQRA are the canonical HC
   docs; neither is currently a local file.
3. NO catalog apply / current_default until owner review of the above.
