<!-- Generated 2026-07-01 by the mo-deep-library-audit workflow (84 agents, multi-dimension + adversarial verify + completeness critic). REPORT-ONLY. HITL review required before any value/architecture change; documentation-truth fixes and build-first wiring of APPROVED catalog values may proceed gated. -->

# SSTAC Dashboard - Matrix Options SUBSTANCE_LIBRARY QA Audit Report

**Scope:** `src/lib/matrix-options/substanceLibrary.ts` (389 entries) cross-referenced against `matrix_research/reference_catalog/human_health_trv_values.json` and (partially, see Section 4) `matrix_research/reference_catalog/eco_values.json`.
**Mode:** REPORT-ONLY. No file mutation performed or proposed by this audit. All findings below are taken verbatim/condensed from the adversarially-verified findings supplied for this audit and the completeness-critic pass; nothing has been added or inferred beyond what was provided.

---

## 1. Summary

- **Findings in this report:** 59 adversarially-verified findings (Section 2) plus 7 completeness-critic findings covering up to ~54 additional substance-level defects concentrated in the previously-unaudited `eco_values.json` catalog (Section 4).
- **Distinct substance keys touched (Section 2 only):** approximately 50 (several substances carry 2-4 independent findings that converged from different angles - e.g. naphthalene, total_pcbs_aroclor_1254, vinyl_chloride, 1_4_dioxane, benzo_a_pyrene, copper, acetone, acrylonitrile, carbon_disulfide, DEHP, TNT, 2_4_dinitrotoluene - these are treated as separate rows below since each captures a distinct facet of the defect).

**By severity (Section 2, 59 findings):**

| Severity | Count |
|---|---|
| High | 8 |
| Medium | 41 |
| Low | 10 |

**By dimension (Section 2, 59 findings):**

| Dimension | High | Medium | Low | Total |
|---|---|---|---|---|
| value-vs-catalog | 3 | 11 | 0 | 14 |
| abs_dermal | 4 | 10 | 0 | 14 |
| provenance-notes | 1 | 15 | 8 | 24 |
| cross-key-borrow | 0 | 1 | 1 | 2 |
| class | 0 | 4 | 1 | 5 |
| logKow | - | - | - | 0 (not separately flagged; see Section 4 gap #3) |
| unit | - | - | - | 0 (no unit-mismatch findings verified) |

**Headline pattern across the 59 findings:** two recurring defect classes dominate:
1. **Stale/incorrect provenance text** - notes claiming a row is "needs_review" or misattributing a value to the wrong source (IRIS vs Health Canada) when the catalog has since moved to `approved`/`approved_source_backed`, or when the wired number actually traces to a different agency's row than the one cited. 17 of the 24 provenance-notes findings are this pattern.
2. **Undisclosed `abs_dermal` deviations from class defaults** - especially a contradictory "0.03 is the organic class default" claim (true default is 0.1, used by 162/181 organic entries) repeated across at least 10 entries, and a mechanically copy-pasted "HC Table 5 VOC RAF (cf. benzene/TCE/PCE)" citation applied to chemically implausible non-VOC substances (DEHP, TNT, 2,4-DNT, 1,2,4,5-tetrachlorobenzene).

---

## 2. Findings by dimension

### 2.1 value-vs-catalog (14 findings: 3 high, 11 medium)

| Key | Severity | Detail |
|---|---|---|
| copper | high | rfd_oral = 0.04 matches no catalog row for copper (approved HC rows = 0.426; needs_review BC P28 rows = 0.09 / 0.141). Sources cite "US EPA IRIS Cu" but no IRIS rfd row exists for copper in the catalog at all - the cited source doesn't exist for this endpoint. Confirmed by mechanical RFD_VALUE_MISMATCH. |
| benzo_a_pyrene | high | sf_oral = 1.0 matches no approved catalog row (Health Canada approved = 1.289; US EPA IRIS approved = 2). Confirmed SF_VALUE_MISMATCH. Sources field is legacy pre-catalog prose predating the source_id citation convention, untraceable to either approved value - looks like a stale/rounded legacy figure. |
| total_pcbs_aroclor_1254 | high | sf_oral = 2.0 has zero backing rows under this substance_key (no approved, no needs_review row exists at all). Matches mechanical SF_NO_APPROVED_ROW=high. rfd_oral (2.0e-5) does correctly match the approved IRIS row; only the SF endpoint is unbacked. Sources string implies IRIS backs both endpoints when it only backs RfD. |
| benzo_a_pyrene | medium | rfd_oral is null despite Health Canada (approved) and US EPA IRIS (approved) agreeing on 0.0003 mg/kg-bw/day for the single most safety-critical carcinogenic PAH in the cohort. Not disclosed as an intentional non-carcinogenic-pathway exclusion (unlike dibenzo_a_h_anthracene, which explicitly documents "sf_oral set, rfd_oral null" by design); notes here only discuss the coastal-marine BSAF multiplier. |
| naphthalene | medium | rfd_oral is null despite Health Canada and US EPA IRIS agreeing on 0.02 mg/kg-bw/day. Notes acknowledge "candidates are available in References & Values" but the number was never wired, unlike the sibling PAH batch (anthracene/fluoranthene/phenanthrene/acenaphthene/fluorene). |
| pyrene | medium | rfd_oral is null despite Health Canada (approved), US EPA IRIS (approved), and BC Protocol 28 (needs_review) all agreeing on 0.03 mg/kg-bw/day. Entry still uses the older identity-only "eco-registry pilot batch (2026-06-19)" template and was never updated when the same catalog-lookup pattern ran into its PAH siblings. |
| p_p_dichlorodiphenyltrichloroethane_ddt | medium | rfd_oral and sf_oral both null despite fully APPROVED catalog rows for both endpoints (RfD 0.0005 mg/kg-bw/day; SF 0.34 per mg/kg-bw/day). Genuine unwired build-first opportunity, stronger than a needs_review gap since both rows are already approved. |
| tetrachloroethane_1_1_2_2 | medium | rfd_oral and sf_oral both null despite approved rows for both (RfD 0.05 mg/kg-bw/day; SF 0.2 per mg/kg-bw/day). Unwired build-first gap. |
| methoxychlor | medium | rfd_oral null despite an approved catalog RfD of 0.005 mg/kg-bw/day. Unwired build-first gap. |
| mirex | medium | rfd_oral null despite an approved catalog RfD of 0.0002 mg/kg-bw/day. Unwired build-first gap. |
| pentachlorobenzene_1_2_3_4_5 | medium | rfd_oral null despite an approved catalog RfD of 0.0008 mg/kg-bw/day. Unwired build-first gap. |
| trichlorobenzene_1_2_4 | medium | rfd_oral null despite an approved catalog RfD of 0.01 mg/kg-bw/day. Unwired build-first gap. |
| benzene | medium | rfd_oral and sf_oral both null despite an APPROVED oral RfD (0.004 mg/kg-bw/day) and an APPROVED oral SF (0.083 per mg/kg-bw/day, Health Canada 2025). Notes only say candidates are available, without disclosing approved status. Benzene is a top-priority, ubiquitous contaminant; leaving it unwired is a significant functional coverage gap. Predates the "build-first" campaign (part of the original v1 starter library) so this looks like backlog rather than a fresh error, but is real and high-impact. |
| toluene, malathion, xylenes | medium | Wired eco-only (rfd_oral null) with notes stating "HH fields null; abs_dermal/ba_oral inert defaults," but the catalog holds APPROVED oral RfD rows for all three: toluene (0.08 IRIS-approved; also 0.0097 HC-approved), malathion (0.02 IRIS-approved), xylenes (0.2 IRIS-approved; also 0.013 HC-approved). Genuine missing-approved-rows coverage gap under the project's build-first policy; unlike nonylphenol/parathion which are correctly left null (catalog genuinely has zero HH rows for those two). |

### 2.2 abs_dermal (14 findings: 4 high, 10 medium)

| Key | Severity | Detail |
|---|---|---|
| vinyl_chloride | high | abs_dermal = 1.0, cited to the same generic "Health Canada TRVs v4.0 Table 5 dermal RAF" phrase used verbatim for tetrachloroethylene and trichloroethylene, both of which are 0.03 - a 33x divergence with no explanation and no catalog abs_dermal row for vinyl_chloride at all. Likely a legacy placeholder predating the HC Table-5 VOC-RAF wiring pattern; as written, the citation falsely implies the same table-lookup basis as the 0.03 entries. |
| vinyl_chloride | high | (Independent confirmation, different framing) abs_dermal = 1.0 vs the organic-halogenated class default of 0.1 (157/170 entries) - a 10x deviation and the single most extreme value in the entire library (next-highest non-default is 0.14). Vinyl chloride is a gas (bp -13C) treated as a VOC everywhere else in the catalog (peer chlorinated VOCs get 0.03). Notes are generic boilerplate with zero disclosure. Physically implausible and undisclosed - looks like a data-entry defect (likely meant 0.1 or 0.03), not an intentional override. |
| bis_2_ethylhexyl_phthalate_dehp | high | abs_dermal = 0.03 with sources/notes asserting it "is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE)." DEHP is a high-MW (390 g/mol), effectively non-volatile plasticizer/SVOC (analyzed via EPA 8270, not VOC method 8260) - a "VOC RAF" citation is chemically implausible. Unlike honest sibling entries (di_2_ethylhexyl_adipate, hexahydro-RDX, acephate) that label 0.1 as "not a verified chemical-specific RAF," this entry asserts a specific, unverified, almost-certainly-wrong citation as fact. Net effect: dermal-contact risk for DEHP is likely understated ~3.3x vs the true 0.1 organic default. |
| 2_4_6_trinitrotoluene_tnt | high | abs_dermal = 0.03 with the identical boilerplate claim "HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE)." TNT is a nitroaromatic solid (mp ~80C, low volatility) analyzed via explosives/SVOC methods (EPA 8330), not a VOC. Looks like the VOC-RAF note+value pair was applied mechanically without checking TNT's actual volatility class. |
| chromium_trivalent | medium | abs_dermal = 0.1, an undisclosed deviation from the divalent-metal class default (0.001); notes discuss speciation but never justify the dermal RAF value. |
| naphthalene | medium | abs_dermal = 0.148, the sole outlier among all 12 organic-PAH entries - every other PAH (including its own close structural analog 2-methylnaphthalene) uses 0.13. Sources string is the same generic boilerplate used for entries carrying 0.1, 0.03, and 1.0, so it does not disclose 0.148 as a naphthalene-specific override. |
| naphthalene | medium | (Independent confirmation) same 0.148-vs-0.13 deviation from the PAH class default used by all 11 other PAH entries; notes discuss only RfD/RfC/EqP gaps, never the dermal RAF; sources field is the generic organic template rather than the PAH-specific pattern used by the other 11. |
| 2_4_dinitrotoluene | medium | abs_dermal = 0.03 via the same "HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE)" note. DNT, like its TNT congener, is typically handled as an SVOC/explosive-related compound, not a VOC. Severity set medium rather than high because DNT is somewhat more volatile than TNT/DEHP, making the misclassification less clear-cut, but the boilerplate citation is still dubious for a nitroaromatic solid. |
| acetone | medium | abs_dermal = 0.03, notes call it "organic class defaults pending HITL." Contradicts the codebase's own convention: 162/181 "organic"-class entries use 0.1, and multiple sibling entries in this file explicitly state 0.1 IS "the conservative organic default." Only 19 entries use 0.03, and most of those cite it as a genuine VOC-specific override, not a class default. |
| 1_4_dioxane | medium | abs_dermal = 0.03 labeled "organic class defaults pending HITL" - same mislabeled-default issue as acetone. 1,4-Dioxane is borderline-volatile so a VOC-style override might be defensible, but no genuine chemical-specific source is cited - it is just mislabeled as the class default. |
| acrylonitrile | medium | abs_dermal = 0.03 labeled "organic class defaults pending HITL" - same mislabeled-default issue. Acrylonitrile is genuinely volatile so a VOC-style RAF is scientifically plausible, but the note frames it as the class default, internally inconsistent with the rest of the file. |
| carbon_disulfide | medium | abs_dermal = 0.03 labeled "organic class defaults pending HITL" - same mislabeled-default issue. Carbon disulfide is volatile so 0.03 may be defensible as a VOC RAF, but the note again asserts it is the class default, contradicting the actual 0.1 default used by 162/181 organic entries. |
| styrene, phenol, nitrobenzene, pyridine | medium | These 4 "organic"-class entries set abs_dermal = 0.03 with notes labeling it only "organic class defaults pending HITL" - wording identical to ~71 other organic-class entries whose notes explicitly state 0.1 is the conservative organic default. Traces to a contradictory 2026-06-20 batch-header convention claiming organic default = 0.03 (vs the majority 0.1 convention). A reviewer would reasonably conclude 0.03 is either an undisclosed chemical-specific override or a data-entry bug, not a documented convention. Unlike formaldehyde/benzene (also 0.03) which at least cite HC Table 5 explicitly, these 4 do not cite that source for 0.03 at all. |
| barium | medium | abs_dermal = 0.1 vs the divalent-metal class default of 0.001 used by 11/18 metal entries (several of which explicitly name it "the divalent-metal class default" in notes). Barium's notes instead say "Calculator defaults remain unset until owner-approved selection rules land" - no explanation for why this entry uses the generic 0.1 instead of the metal-class 0.001. |

### 2.3 provenance-notes (24 findings: 1 high, 15 medium, 8 low)

| Key | Severity | Detail |
|---|---|---|
| dichloromethane | high | Sources field reads "US EPA IRIS toxicity values; Health Canada TRVs v4.0 Table 5 dermal RAF," implying IRIS is the source of the wired RfD (0.014) and SF (0.002). In the catalog those values actually match ONLY the Health Canada rows (approved, src-health-canada-trv-v4-2025). The IRIS approved rows have DIFFERENT values (RfD 0.006, SF 0.0033) that were NOT used. Backwards HC-vs-IRIS attribution - a reviewer would wrongly conclude the wired values came from IRIS. Also matches mechanical DUAL_SOURCE_CITATION_INCOMPLETE. |
| strontium | medium | Notes describe the pv-iris-strontium rows as "the needs_review row," but that row is evidence_support_status=approved_source_backed / qa_status=approved in the catalog (and the only catalog row for strontium - no BC P28 row exists). Same stale-mislabel pattern as molybdenum below. |
| dichloroethylene_1_1 | medium | Same HC-vs-IRIS misattribution pattern as dichloromethane: sources says "US EPA IRIS...HC Table 5," but the wired RfD (0.003) matches ONLY the Health Canada approved row; the IRIS approved row for this substance is a completely different value (0.05, unused). Sources text misattributes the wired value to IRIS. |
| hexachlorobenzene | medium | Notes state "Both rows remain needs_review in the catalog," referring to the SF (1.6) and RfD (0.0008) rows actually cited as the wiring source. Per the catalog, both of those rows are qa_status=approved (only a separate BC Protocol 28 duplicate row is needs_review). Stale/incorrect note understates the QA status of the values actually used. |
| aldrin | medium | Notes say "Both rows remain needs_review" for the SF (17) and RfD (3.0e-5) rows, but the catalog shows ALL four related IRIS rows (direct-rfd, food-rfd, direct-sf, food-sf) are qa_status=approved - none are needs_review. |
| endrin | medium | Notes describe the RfD as "seeded build-first from the needs_review row" (value 3.0e-4), but both catalog rows are qa_status=approved, not needs_review. |
| hexachlorobutadiene | medium | Notes describe the SF as "seeded build-first from the needs_review row" (value 0.078). Both catalog rows are qa_status=approved; only an unrelated inhalation-unit-risk BC Protocol 28 row is needs_review. |
| hexachlorocyclopentadiene | medium | Notes describe the RfD as "seeded build-first from the needs_review row" (value 0.006). Both catalog rows are qa_status=approved; only an unrelated inhalation-RfC BC Protocol 28 row is needs_review. |
| alpha_hexachlorocyclohexane_alpha_hch + 13-entry cohort (bromoform, bromophenyl_phenyl_ether_4, carbon_tetrachloride, chlorpyrifos, dichlorobenzene_1_2/_1_3/_1_4, endosulfan/_alpha/_beta, heptachlor, heptachlor_epoxide, hexachloroethane) | medium | 14 entries have a `sources` string literally truncated mid-word in the raw TS file (confirmed against source, not a display artifact - e.g. "...Physical and Chemical Propert..." with no closing citation). All are eco-registry pilot/fan-out batch (2026-06-19) logKow entries where the disclosed citation for the load-bearing logKow value is incomplete, preventing full provenance verification even though the values themselves are individually plausible against known literature ranges. |
| 1_4_dioxane | medium | Notes state "Both rows remain needs_review in the catalog," but BOTH the matched rfd_oral row (0.03, src-us-epa-iris-rfd-table-live) and sf_oral row (0.1, src-us-epa-iris-chemical-details-live) carry qa_status=approved / evidence_support_status=approved_source_backed. Stale text could mislead a reviewer into thinking promotion work is still pending. |
| isophorone | medium | Notes state "Both rows remain needs_review," but the catalog shows BOTH the matched rfd_oral row (0.2) and sf_oral row (9.5e-4) with qa_status=approved. Same stale-needs_review defect as 1_4_dioxane. |
| total_pcbs_aroclor_1254 | medium | abs_dermal = 0.14 vs organic-halogenated class default 0.1 (157/170 entries). Notes only discuss the eco-BSAF/coastal-PAH-multiplier exception and never mention or justify the dermal RAF value; sources list has no dermal-specific citation at all (unlike the rest of the class). |
| phenol | medium | abs_dermal = 0.03, and notes literally assert "abs_dermal/ba_oral are organic class defaults pending HITL" - but the actual organic class default (162/181 entries) is 0.1, not 0.03. Factually wrong phrasing disguises a real deviation as the default; phenol (bp 182C) is also not conventionally a VOC. Same defect pattern repeats verbatim across 10 entries in this file. |
| bisphenol_a | medium | abs_dermal = 0.03 with the same mislabeled "organic class defaults pending HITL" note; true default is 0.1. Bisphenol A is a SOLID (mp ~158C, essentially non-volatile) so a VOC-style reduced RAF is chemically indefensible and there is zero substance-specific disclosure for the override. |
| nitrobenzene | medium | abs_dermal = 0.03 with the same mislabeled note; true default is 0.1. Nitrobenzene (bp 211C) is semi-volatile, not a VOC, so the reduced dermal RAF is unsupported and undisclosed. |
| 1_4_dioxane | medium | (Second, distinct provenance defect on the same key) No inline rationale ties abs_dermal = 0.03 to volatility or to an HC/EPA dermal-RAF source - the only text is the mislabeled "organic class defaults pending HITL" note addressed above. |
| molybdenum | low | Notes describe the pv-iris-molybdenum rows as "the needs_review row," but they are evidence_support_status=approved_source_backed / qa_status=approved (and are the ONLY catalog row for molybdenum - no BC P28 row exists). Stale/incorrect "needs_review" framing on an already-approved value. |
| pentachlorophenol | low | Notes state "Both rows remain needs_review," but both rows (SF 0.4, RfD 0.005) now carry qa_status=approved / evidence_support_status=approved_source_backed. Also matches mechanical DUAL_SOURCE_CITATION_INCOMPLETE (sources string names sources generically rather than by literal source_id). |
| acetone | low | abs_dermal = 0.03 with the same mislabeled "organic class defaults pending HITL" note; true default is 0.1. Acetone is genuinely volatile (bp 56C) so the value itself is plausible, but the note misrepresents it as the class default. |
| acrylonitrile | low | Same mislabeled note; true default is 0.1. Acrylonitrile (bp 77C) is volatile so the value is chemically plausible, but the disclosure is incorrect about what the value represents. |
| carbon_disulfide | low | Same mislabeled note; true default is 0.1. Carbon disulfide (bp 46C) is genuinely volatile so the value is plausible, but the note misstates it as the class default. |
| benzene | low | abs_dermal = 0.03 (deviates from organic default 0.1) but notes are generic "candidates are available in References & Values" boilerplate - no inline disclosure of the VOC-RAF rationale, even though other entries (dichloromethane) cite benzene as the class precedent ("cf. benzene/TCE/PCE"). Justification exists elsewhere in the file but not on this row. |
| tetrachloroethylene | low | abs_dermal = 0.03 (deviates from organic-halogenated default 0.1) with only generic boilerplate notes; no inline disclosure despite being cited as the "PCE" precedent by other entries' notes. |
| trichloroethylene | low | abs_dermal = 0.03 (deviates from organic-halogenated default 0.1) with only generic boilerplate notes; no inline disclosure despite being cited as the "TCE" precedent by other entries' notes. |

### 2.4 cross-key-borrow (2 findings: 1 medium, 1 low)

| Key | Severity | Detail |
|---|---|---|
| total_pcbs_aroclor_1254 | medium | sf_oral = 2.0 has ZERO catalog rows (any qa_status) under substance_key='total_pcbs_aroclor_1254'. The value 2.0 exists only under substance_key='polychlorinated_biphenyls_pcbs' (the generic "PCBs" IRIS entry, not Aroclor-1254-specific). Library sources string ("US EPA IRIS Aroclor 1254; BSAF-Translation Section 4; US EPA Eco-SSL...") non-disclosingly misrepresents the borrowed generic-PCB SF as Aroclor-1254-specific. rfd_oral (2.0e-5) IS legitimately its own-key approved row; only SF is affected. Confirmed still present and unfixed. |
| copper | low | rfd_oral = 0.04 does not match copper's own catalog rows (0.426 / 0.09 / 0.141, already flagged separately as RFD_VALUE_MISMATCH). The wired value 0.04 DOES appear in the catalog, but under 11 unrelated substance_keys (fluoranthene, phenanthrene, fluorene, bis_2_chloro_1_methylethyl_ether, chlorobutane_1, the 3 trimethylbenzene isomers, iprodione, norflurazon, pendimethalin), all sourced from BC Protocol 28 v3.0. Because 0.04 is shared by 11 chemically-unrelated substances, this looks like a coincidental shared/default Protocol-28 value rather than a deliberate single-substance borrow - flagged as a lower-confidence variant for owner triage, not a confirmed disguised borrow. |

### 2.5 class (5 findings: 4 medium, 1 low)

| Key | Severity | Detail |
|---|---|---|
| bis_2_ethylhexyl_phthalate_dehp | medium | abs_dermal = 0.03 sourced to a copy-pasted note: "abs_dermal is the HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE)." DEHP is a plasticizer/SVOC with bp ~384C and negligible volatility - not a VOC by any standard definition. Lumping it with the benzene/TCE/PCE VOC precedent is a chemistry error; appears the "VOC RAF" note+value pair was applied mechanically to a batch of HH-only build-first entries without checking volatility. |
| 2_4_6_trinitrotoluene_tnt | medium | abs_dermal = 0.03 via the same copy-pasted "HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE)" note. TNT is a solid nitroaromatic explosive with very low vapor pressure - not a VOC. Chemically inapplicable and undisclosed as a TNT-specific determination; appears to be the same template-copy defect as DEHP. |
| 2_4_dinitrotoluene | medium | abs_dermal = 0.03 via the same copy-pasted note. 2,4-DNT is a low-volatility solid nitroaromatic, not a VOC. Same mechanical-template defect as DEHP/TNT - reduces dermal absorption below the 0.1 organic default with no chemical basis. |
| 1_2_4_5_tetrachlorobenzene | medium | abs_dermal = 0.03 via the same copy-pasted note. This chlorobenzene congener has bp ~246C and is a persistent, low-volatility SVOC (unlike the mono-/di-chlorobenzenes in the same batch), so grouping it with the VOC RAF precedent is questionable; the note gives no substance-specific volatility check. |
| maneb | low | Maneb (manganese ethylenebis(dithiocarbamate), CAS 12427-38-2) is classed "organic" with zero disclosure of its manganese content, even though Mn is coordinated within the dithiocarbamate chelate structure (not a simple ionic counterion like the Cl- in mepiquat_chloride/paraquat). Inconsistent with the file's own precedent: thiram's notes in the same cohort explicitly justify "organic" classification by stating it is "metal-free," implying metal content would matter. Maneb's notes never address the manganese - reads as an undisclosed judgment call or a missed re-classification. |

---

## 3. SAFE TO AUTO-FIX vs NEEDS HITL

This section classifies each finding by whether it can be corrected as a pure documentation-truth edit (no numeric field changes, no policy judgment) versus whether it requires a HITL value/policy/architecture decision. Per project rules (`CLAUDE.md`: "No default policy promotion," "No catalog mutation" without explicit owner approval), **nothing in either list is being applied by this report** - this is a triage classification only.

### 3.1 SAFE TO AUTO-FIX (documentation-truth only, no value change)

These findings can be corrected by editing the `notes`/`sources` text to match the catalog's actual current qa_status/evidence_support_status or actual source attribution, without touching any `rfd_oral`, `sf_oral`, `abs_dermal`, `ba_oral`, `fcv_ug_per_L`, `trv_eco_mg_per_kg_bw_day`, `bsaf_loc_freshwater`, `logKow`, or `class` field:

- **Stale "needs_review" labels on now-approved rows** (text-only correction to reflect current catalog status): molybdenum, strontium, hexachlorobenzene, aldrin, endrin, hexachlorobutadiene, hexachlorocyclopentadiene, pentachlorophenol, 1_4_dioxane (RfD/SF needs_review claim), isophorone.
- **Source misattribution where the wired value is actually correct** (fix the citation text to name Health Canada, not IRIS - underlying RfD/SF values are already right): dichloromethane, dichloroethylene_1_1.
- **Mislabeled "organic class default" notes** (correct the note text to either honestly disclose an undisclosed chemical-specific override or flag the value itself for HITL, without changing the number in this pass): phenol, acetone, 1_4_dioxane (class-default mislabel), acrylonitrile, carbon_disulfide, bisphenol_a, nitrobenzene, and the styrene/phenol/nitrobenzene/pyridine cohort note.
- **Truncated `sources` strings** (complete the citation text; does not change any numeric field): the 14-entry alpha-HCH cohort (alpha_hexachlorocyclohexane_alpha_hch, bromoform, bromophenyl_phenyl_ether_4, carbon_tetrachloride, chlorpyrifos, dichlorobenzene_1_2/_1_3/_1_4, endosulfan/_alpha/_beta, heptachlor, heptachlor_epoxide, hexachloroethane).
- **De-claiming false chemical-specific citations without changing the number** (replace the false "VOC RAF" assertion with an honest "not a verified chemical-specific RAF, pending HITL" framing, leaving the numeric abs_dermal value itself flagged separately for HITL): DEHP, TNT, 2_4_dinitrotoluene, 1_2_4_5_tetrachlorobenzene - text-only portion of these findings is safe; the underlying number is NOT (see 3.2).
- **Undisclosed-deviation notes lacking any rationale** (add a disclosure note pointing to the class-default deviation; does not resolve whether the deviation itself is correct): total_pcbs_aroclor_1254 (abs_dermal 0.14 dermal-RAF disclosure gap), benzene / tetrachloroethylene / trichloroethylene (low-severity missing inline VOC-RAF cross-reference), chromium_trivalent (add disclosure of the deviation, not a fix to the value), maneb (add disclosure of manganese content in notes without necessarily reclassifying).
- **cross-key-borrow disclosure text** for total_pcbs_aroclor_1254 SF (disclose that 2.0 is borrowed from the generic `polychlorinated_biphenyls_pcbs` key, not Aroclor-1254-specific) - the disclosure itself is safe; whether to keep, replace, or null the borrowed value is a HITL decision (see 3.2).

### 3.2 NEEDS HITL (value / policy / architecture)

These findings require a substantive decision - which catalog value to wire, whether a value is chemically defensible, or a classification judgment - and therefore cannot be resolved by a text-only edit:

- **All value-vs-catalog mismatches and unwired-approved-value gaps:** copper (rfd_oral - no traceable source at all), benzo_a_pyrene (sf_oral mismatch; rfd_oral unwired gap), naphthalene (rfd_oral unwired gap), pyrene (rfd_oral unwired gap), total_pcbs_aroclor_1254 (sf_oral unbacked / cross-key-borrow), p_p_dichlorodiphenyltrichloroethane_ddt, tetrachloroethane_1_1_2_2, methoxychlor, mirex, pentachlorobenzene_1_2_3_4_5, trichlorobenzene_1_2_4, benzene (rfd_oral/sf_oral unwired), toluene/malathion/xylenes (rfd_oral unwired).
- **All abs_dermal numeric deviations requiring a chemistry/policy call on the correct RAF:** vinyl_chloride (1.0 - likely data-entry defect, needs a real Table 5 lookup or correction to 0.03/0.1), DEHP, TNT, 2_4_dinitrotoluene, 1_2_4_5_tetrachlorobenzene (VOC-RAF misapplied to non-VOC substances - needs a genuine chemical-specific determination or reversion to the 0.1 organic-halogenated/organic default), naphthalene (0.148 vs 0.13 PAH default - needs confirmation of whether 0.148 is a real HC Table 5 override), chromium_trivalent and barium (0.1 vs 0.001 divalent-metal default - needs a speciation-based determination), acetone/1_4_dioxane/acrylonitrile/carbon_disulfide/styrene-phenol-nitrobenzene-pyridine cohort (0.03 vs 0.1 - needs a decision on whether these are genuine VOC-specific overrides or should revert to 0.1).
- **Classification judgment calls:** maneb (organic vs metal-bearing reclassification), and the underlying "is 0.03 a genuine VOC RAF for this chemical" question for every entry listed under Section 2.5 (class dimension).
- **cross-key-borrow value resolution:** total_pcbs_aroclor_1254 sf_oral (decide whether to keep the borrowed generic-PCB value, source a real Aroclor-1254-specific SF, or null the field pending HITL); copper cross-key coincidence (decide whether 0.04 is a legitimate shared Protocol-28 default for copper or should be replaced/nulled).

---

## 4. Completeness-critic gaps and round-2 assessment

The completeness critic (working from `substanceLibrary.ts`, `types.ts`, and `matrix_research/reference_catalog/eco_values.json`) identified that the primary audit (Sections 2-3 above) checked essentially only `human_health_trv_values.json`. Four gaps were flagged; the first three carry verified findings, the fourth is unverified and deferred.

### 4.1 Gap 1 (verified, largest): `eco_values.json` was never cross-referenced

The library's `fcv_ug_per_L` (Eco-Direct EqP) and `trv_eco_mg_per_kg_bw_day` (Eco-Food) fields were never checked against the 97-row, 71-substance eco catalog. This is the eco-pathway mirror of every "unwired build-first gap" finding already caught on the HH side, roughly 4x larger in scope, and includes direct textual contradictions (sources/notes claiming a value was "seeded from the eco catalog" when the field is literally null). Critic-verified findings:

| Key(s) | Dimension | Severity | Detail |
|---|---|---|---|
| toluene, xylenes, dieldrin, p_p_dichlorodiphenyltrichloroethane_ddt, polychlorinated_biphenyls_total_pcbs, chromium | eco-value-vs-catalog | high | fcv_ug_per_L / trv_eco_mg_per_kg_bw_day are null in the raw TS object, yet each entry's OWN sources or notes text affirmatively claims the value was wired (e.g. toluene: "Eco FCV/TRV seeded from the eco catalog"; DDT: "Eco FCV from catalog"; chromium: "Eco-food TRV seeded from the eco catalog (FCSAP ERA Module 7)"). eco_values.json has approved rows for all of these (toluene 9.8 ug/L; DDT 0.001; xylenes 67; PCBs-total 0.014; chromium 2.4/2.66 mg/kg-bw/day) that never made it into the library object. Direct contradiction between shipped provenance text and shipped data, not just an undisclosed gap. |
| 39 additional substances (full list: alpha_hexachlorocyclohexane_alpha_hch, hexachlorocyclohexane_gamma, biphenyl, bromophenyl_phenyl_ether_4, butyl_benzyl_phthalate_bbp, chlorobenzene, diazinon, dibenzofuran, dichlorobenzene_1_2/_1_3/_1_4, dibutyl_phthalate_dbp, diethyl_phthalate_dep, endosulfan/_alpha/_beta, ethylbenzene, hexachloroethane, malathion, methoxychlor, pentachlorobenzene_1_2_3_4_5, tetrachloroethane_1_1_2_2, tetrachloroethylene, carbon_tetrachloride, bromoform, trichlorobenzene_1_2_4, trichloroethane_1_1_1, trichloroethylene, carbaryl, chlordane_technical, chlorpyrifos, demeton, azinphos_methyl, heptachlor, heptachlor_epoxide, mirex, nonylphenol, parathion, toxaphene, benzene) | value-vs-catalog (eco fcv) | high | 39 substances (46 total combined with the 6 above, out of 71 substances present in eco_values.json) have an approved, single-value fcv_ug_per_L row in the eco catalog that is not reflected anywhere in the library object. Same "approved-but-unwired" defect class already caught for rfd_oral on toluene/malathion/xylenes/benzene (Section 2.1), extended to the Eco-Direct EqP pathway at roughly 4x scope. Entirely missed because the catalog cross-reference only covered human_health_trv_values.json. |
| arsenic_inorganic, cadmium, lead, copper | value-vs-catalog (eco trv) | high | trv_eco_mg_per_kg_bw_day is wired but matches NEITHER of the two approved eco_values.json rows for each substance (e.g. arsenic: wired 0.043 vs catalog 1.04 mammal / 4.4 bird; copper: wired 7.0 vs catalog 5.6 / 4.5). The cited source ("US EPA Eco-SSL avian TRV") does not correspond to any source_id present in eco_values.json for these substances at all - untraceable to the current catalog. Same defect class as the confirmed copper RfD finding (Section 2.1), but on the Eco-Food pathway, across 4 metals. |
| barium, chromium_hexavalent | value-vs-catalog (eco trv) | medium | trv_eco_mg_per_kg_bw_day is null despite approved eco_values.json rows existing (barium 51.8/51.3; chromium_hexavalent 9.24/16, both FCSAP Module 7, approved). Unwired build-first gap on the Eco-Food pathway. |
| mercury_inorganic | value-vs-catalog (eco trv) | medium | trv_eco_mg_per_kg_bw_day is null despite an approved eco_values.json mammal-TRV row (5.8 mg/kg-bw/day, FCSAP Module 7, approved; a second bird-TRV row of 0.8 also exists). Same unwired-eco-pathway gap. |

### 4.2 Gap 2 (verified): truncated-`sources` sweep undercounted

The primary audit named 14 entries with a bare "..." truncated citation (Section 2.3). A full-file mechanical sweep finds **36** such entries - 22 more than originally caught: azinphos_methyl, biphenyl, carbaryl, chlorpyrifos, demeton, diazinon, dibutyl_phthalate_dbp, diethyl_phthalate_dep, thallium, uranium, vanadium, hexachlorocyclohexane_gamma, plus 10 more not itemized by the critic (already partly overlapping the original 14). Severity: low (same defect class as the original finding, just undercounted).

### 4.3 Gap 3 (verified): divalent-metal abs_dermal sweep undercounted

The primary audit caught 2 of 7 deviating divalent-metal-class entries (chromium_trivalent, barium - Section 2.2). A full sweep of all 18 divalent-metal-class entries finds 5 more undisclosed deviations:

| Key | Dimension | Severity | Detail |
|---|---|---|---|
| beryllium, chromium_hexavalent, chromium, nickel, mercury_inorganic | abs_dermal | medium | Full sweep of all 18 divalent-metal-class entries confirms the class default is 0.001 (11/18 entries). 7 entries deviate; the primary audit caught only 2. These 5 additional deviations were missed: beryllium (0.1), chromium_hexavalent (0.1), chromium/generic (0.1), nickel (0.03), mercury_inorganic (0.03) - none of their notes offer any dermal-RAF-specific rationale for the deviation. Same undisclosed-deviation pattern already confirmed for chromium_trivalent/barium, just uncounted. |

### 4.4 Gap 4 (flagged, NOT verified - deferred to a round-2 spot-check)

The critic explicitly flagged but did not verify:
- `bsaf_loc_freshwater` vs `erdc_bsaf_*` catalog leads - not cross-checked.
- Duplicate/near-duplicate key pairs (2_methylnaphthalene / methylnaphthalene_2; the chromium / chromium_trivalent / chromium_hexavalent triple-bucket, which the chromium entry's own notes admit is an awkward enum-forced convention) - not audited for consistency.
- The wiring/selection layer outside `substanceLibrary.ts` (candidate_group_id, defaultSelectionPolicy) - entirely out of scope of this pass.
- Self-flagged internal uncertainty never escalated as a finding: mirex's own notes reportedly admit a "~40x" logKow discrepancy between its two candidate sources, but this was never surfaced as a finding in either pass.
- Inhalation fields are confirmed **out of scope by design** - no `rfc`/inhalation field exists anywhere in `SubstanceEntry`, so this is not a gap, it is a non-issue.

### 4.5 Is a second, eco_values.json-focused audit round warranted?

**Yes.** Per the critic's own tally, roughly 54 of 389 entries (~14%) carry a previously-unaudited eco-catalog defect (Section 4.1), plus 22 additional truncated-citation instances (Section 4.2) and 5 additional undisclosed abs_dermal deviations (Section 4.3) beyond what the primary pass caught. This is not a marginal miss - `eco_values.json` (97 approved rows, 71 substances) is a whole catalog file that received zero cross-referencing in the primary pass, and it surfaces the same two defect classes (unwired-approved-value gaps, and text/data contradictions) at comparable or larger scale than the HH-pathway findings in Section 2. A follow-up round scoped specifically to (a) completing the `eco_values.json` cross-reference for all 71 substances present in that catalog, (b) finishing the truncated-sources and divalent-metal abs_dermal sweeps to full-file completion, and (c) spot-checking the four unverified items in Section 4.4, is recommended before this audit is considered complete.

---

*Report-only. No SUBSTANCE_LIBRARY, catalog, or provenance file was modified in the production of this audit. Files consulted: `src/lib/matrix-options/substanceLibrary.ts`, `src/lib/matrix-options/types.ts`, `matrix_research/reference_catalog/human_health_trv_values.json`, `matrix_research/reference_catalog/eco_values.json`.*
