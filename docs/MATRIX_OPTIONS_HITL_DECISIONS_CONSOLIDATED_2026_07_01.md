<!-- Generated 2026-07-01 (rewrite). Consolidated, de-duplicated HITL decision list synthesized from
five same-day matrix-options audit/proposal reports. Plain ASCII. No values changed by this
document; it is a decision aid only. Supersedes the prior version of this file, which was written
against an older 16-finding audit before the 59-finding deep audit existed on disk. -->

# Matrix-Options HITL Decisions - Consolidated 2026-07-01

**Purpose:** turn every NEEDS-HITL item from the five 2026-07-01 audit/proposal reports into one
crisp, de-duplicated action list for owner approval. Nothing in this document has been applied to
`src/lib/matrix-options/substanceLibrary.ts` or any catalog file. Where a substance/field appears in
more than one source report (e.g. copper, benzo_a_pyrene, naphthalene, total_pcbs_aroclor_1254), it
is consolidated into a single row here, citing every contributing report.

## Source reports

1. `docs/MATRIX_OPTIONS_DEEP_LIBRARY_AUDIT_2026_07_01.md` - **primary HH-pathway audit**, 59
   adversarially-verified findings (84 agents) + completeness-critic gap analysis of the eco catalog.
2. `docs/MATRIX_OPTIONS_ECO_AUDIT_ROUND2_2026_07_01.md` - eco-pathway audit, 47 findings across 51 of
   71 eco-catalog substances (77 agents, adversarial verify).
3. `docs/MATRIX_OPTIONS_VALUE_RECONCILIATION_PROPOSAL_2026_07_01.md` - live-source value
   reconciliation for 8 substance/endpoint pairs, each independently re-verified against primary
   sources (IRIS, HC TRV v4.0, BC Protocol 28).
4. `docs/MATRIX_OPTIONS_EXCLUDED_CLASSES_PROPOSAL_2026_07_01.md` - per-substance wiring proposal for
   the 37 metal/inorganic substances excluded from the (now-complete) organic wiring lane.
5. `docs/MATRIX_OPTIONS_EXCLUDED_CLASSES_ARCHITECTURE_DECISION_2026_07_01.md` - the one architecture
   call (add an `'inorganic'` `ContaminantClass`) needed to unblock report 4.
6. `docs/MATRIX_OPTIONS_LIBRARY_AUDIT_2026_07_01.md` - the earlier, narrower 16-finding first pass.
   Superseded by report 1 for everything it also covers; used here **only** to pull forward two items
   with no equivalent in the deep audit: `arsenic_inorganic` (HH dual-source citation) and
   `formaldehyde` (stale SF-candidate text).

---

## ALREADY FIXED THIS SESSION - do not re-triage

These items were documentation-truth corrections (text/citation only, zero numeric/class/field
change), adversarially verified, codex-GREEN. They are removed from every group below.

**PR #437 (merged, 3 entries)** - stale "remain needs_review" notes corrected to reflect
`qa_status=approved`: `pentachlorophenol`, `1_4_dioxane` (needs_review claim only - the dual-source
citation gap on this key is still open, see Group 5), `isophorone` (needs_review claim only - the
dual-source citation gap is still open, see Group 5).

**PR #440 (open, shipped, 9 entries)** - `docs(matrix-options): provenance-truth fixes (9 entries)`:
- 7 stale "remain needs_review" notes corrected to `approved`: `molybdenum`, `strontium`,
  `hexachlorobenzene`, `aldrin`, `endrin`, `hexachlorobutadiene`, `hexachlorocyclopentadiene`.
- 2 backwards HC-vs-IRIS attribution fixes (wired value is 100% Health Canada-sourced but `sources`
  credited IRIS): `dichloromethane`, `dichloroethylene_1_1`.

---

## Group 1: VALUE CORRECTIONS

A wired number is wrong, unsupported by any approved catalog row, or traces to a source that does
not exist for that endpoint. HH items are live-source-reconciled; eco items are wired-vs-catalog
mismatches. Several rows need a **receptor pick** (mammal vs bird) or a **jurisdiction/source-priority
pick** (Health Canada vs BC Protocol 28 vs US EPA) in addition to the magnitude correction.

### 1a. Human health

| Substance / key | Issue | Current value | Recommended value / action | Source |
|---|---|---|---|---|
| copper (oral RfD) | Cited to "US EPA IRIS Cu" - IRIS has no oral RfD row for copper at all; wired value is unsupportable | 0.04 mg/kg-bw/day | **Default-policy pick needed** among 3 sourced candidates: 0.426 (Health Canada TRV v4.0, approved) vs 0.09 (BC P28 App 8A, needs_review) vs 0.141 (BC P28 App 8C, needs_review). 0.04 also coincidentally matches 11 unrelated BC-P28 substances (fluoranthene, phenanthrene, etc.) - a shared default, not a copper-specific value; confirmed unsupportable either way. | Deep Audit 2.1 (high); Value Reconciliation Sec 2/4; Library Audit (high) |
| benzo_a_pyrene (oral SF) | Mislabeled as "the" IRIS value; matches neither approved candidate | 1.0 per mg/kg-bw/day | 2.0 per mg/kg-bw/day (IRIS 2017, ADAF-adjusted, lifetime default). Health Canada approved alternative = 1.289. Note: 1.0 is a real adult-only, non-default EPA alternate - keep as a disclosed alternate, do not delete. | Deep Audit 2.1 (high); Value Reconciliation Sec 2/4 (agree); Library Audit (high) |
| lead (oral RfD) | Uncited, untraceable "Health Canada HHRA 2023" figure; diverges ~7x from the approved HC value | 3.5e-3 mg/kg-bw/day | 5.0e-4 mg/kg-bw/day (Health Canada TRV v4.0 provisional risk-specific dose; independently corroborated by EFSA 2010 BMDL01). Owner must confirm the risk-specific-dose semantics (IEUBK-linked target blood-lead level, not a classic NOAEL/UF RfD) are compatible with how `rfd_oral` is consumed downstream before wiring like-for-like. BC P28 alternative = 0.0006 (needs_review). | Value Reconciliation Sec 2/4; Library Audit (medium) |
| total_pcbs_aroclor_1254 (oral SF) | Value has zero catalog rows under this substance_key; cross-key-borrowed from the generic `polychlorinated_biphenyls_pcbs` CASRN without disclosure; `sources` implies an Aroclor-1254-specific IRIS number that does not exist | 2.0 per mg/kg-bw/day (no numeric change proposed) | No value change - IRIS genuinely has no Aroclor-1254-specific cancer assessment; borrowing the generic-PCB "high risk and persistence" tier value is defensible. Rewrite `sources` to disclose the borrow explicitly. `rfd_oral` (2.0e-5) is independently correct and already backed by its own approved row - no issue there. | Deep Audit 2.1/2.4 (high + medium cross-key-borrow); Value Reconciliation Sec 3 (agree, label-only); Library Audit (high) |
| arsenic_inorganic (oral RfD + SF) | Wired RfD (0.0003) and SF (1.5) exactly match BC Protocol 28 needs_review rows, but `sources` credits only "US EPA IRIS iAs," whose approved values differ materially (RfD ~5x lower, SF ~21x higher) | RfD 0.0003, SF 1.5 | **Source-priority pick needed**: (a) formally adopt BC P28 as the disclosed source and correct the citation, or (b) switch to the approved IRIS values. Not a mechanical fix. (Not covered by the deep audit; carried forward from the earlier pass.) | Library Audit (medium) - no deep-audit equivalent found |

### 1b. Ecological (Eco-Food TRV metal mismatches)

All 6 rows below share the same defect pattern: the wired value cites "US EPA Eco-SSL avian TRV," a
source that does not exist anywhere in `eco_values.json`; the only approved catalog rows come from
FCSAP ERA Module 7 (2021) and diverge by 2x-1500x. Each needs a **receptor pick** (mammal vs bird, or
carry both as selectable) in addition to retiring the legacy Eco-SSL number.

| Substance / key | Current value (Eco-SSL, uncatalogued) | Approved catalog rows (FCSAP wildlife TRV) | Source |
|---|---|---|---|
| copper | 7.0 mg/kg-bw/day | 5.6 (mammal) / 4.5 (bird) | Eco Audit 2.2 (HIGH, confirmed twice); Deep Audit 4.1 |
| cadmium | 0.0014 mg/kg-bw/day | 0.77 / 2.1 (~550x-1500x higher) | Eco Audit 2.2 (HIGH, confirmed twice) |
| zinc | 14.0 mg/kg-bw/day | 75.4 (mammal) / 66.1 (bird) | Eco Audit 2.2 (HIGH) |
| arsenic_inorganic | 0.043 mg/kg-bw/day | 1.04 (mammal) / 4.4 (bird) (~24x-100x higher) | Eco Audit 2.2 (severity split HIGH/MEDIUM across two passes - treat as HIGH pending owner call) |
| lead | 0.0080 mg/kg-bw/day | 4.7 (mammal) / 1.63 (bird) (~200x-590x higher). Likely dead code today - `EcoFoodBSAFCalculator.tsx`'s dynamic `resolveEcoSeed` path may bypass this static fallback - but remains the on-disk fallback if the resolver ever misses. | Eco Audit 2.2 (severity split HIGH/MEDIUM) |
| benzo_a_pyrene | 0.0025 mg/kg-bw/day | 3.6 / 0.001 (wide spread - owner must pick, or carry both) | Eco Audit 2.2 (MEDIUM) |

**Group 1 total: 5 HH decision rows + 6 eco decision rows = 11 rows.**

---

## Group 2: abs_dermal ANOMALIES

Every row below is an undisclosed or chemically-implausible deviation from the class default (0.1
organic, 0.001 divalent-metal). None can be resolved as a documentation-only fix; each needs a
chemistry/policy call: revert to the class default, or confirm a real Health Canada TRV v4.0 Table 5
route-specific absorption factor (RAF) applies.

| Substance / key | Issue | Current value | Class default | Recommended action | Source |
|---|---|---|---|---|---|
| vinyl_chloride | Cited to the same generic HC Table 5 boilerplate used for TCE/PCE (both 0.03) - a 10-33x divergence with zero catalog row and zero chemical rationale. Single most extreme outlier in the library (next-highest non-default is 0.14). Likely a data-entry defect. | 1.0 | 0.1 (organic-halogenated) | Confirm via a real Table 5 lookup, or correct to 0.03 (VOC-consistent with its peer chlorinated VOCs) or revert to 0.1. | Deep Audit 2.2 (high, 2 independent findings) |
| bis_2_ethylhexyl_phthalate_dehp (DEHP) | `sources` asserts "HC TRV v4.0 Table 5 VOC RAF (cf. benzene/TCE/PCE)" - DEHP is a non-volatile SVOC plasticizer (bp ~384C, analyzed via EPA 8270 not 8260), not a VOC. Chemistry error, mechanically copy-pasted. | 0.03 | 0.1 (organic) | Revert to 0.1, or confirm a genuine chemical-specific RAF exists (none currently cited). De-claim the false "VOC RAF" text regardless of the value outcome. | Deep Audit 2.2/2.5 (high + medium) |
| 2_4_6_trinitrotoluene_tnt (TNT) | Same copy-pasted "VOC RAF" claim. TNT is a low-volatility nitroaromatic solid (explosives/SVOC method 8330), not a VOC. | 0.03 | 0.1 (organic) | Same as DEHP: revert or confirm a genuine RAF; de-claim the VOC text. | Deep Audit 2.2/2.5 (high + medium) |
| 2_4_dinitrotoluene | Same copy-pasted "VOC RAF" claim; somewhat more volatile than TNT/DEHP so the misclassification is less clear-cut, but still an SVOC/explosives-related compound, not a VOC. | 0.03 | 0.1 (organic) | Same treatment; medium confidence this is wrong (vs high for DEHP/TNT). | Deep Audit 2.2/2.5 (medium) |
| 1_2_4_5_tetrachlorobenzene | Same copy-pasted "VOC RAF" claim. This congener (bp ~246C) is a persistent low-volatility SVOC, unlike the mono-/di-chlorobenzenes in the same batch. | 0.03 | 0.1 (organic-halogenated) | Same treatment. | Deep Audit 2.5 (medium) |
| phenol, bisphenol_a, nitrobenzene, styrene, pyridine (5 entries) | Notes literally assert "abs_dermal is the organic class default" at 0.03 - but the true default (162/181 organic entries) is 0.1. Internally contradicts the codebase's own convention. bisphenol_a is a solid (mp ~158C, non-volatile) so a VOC-style RAF is chemically indefensible; phenol/nitrobenzene are semi-volatile, not VOCs. | 0.03 | 0.1 (organic) | Decide: genuine chemical-specific override (needs a real source) or data-entry bug (revert to 0.1). Fix the mislabeled note either way. | Deep Audit 2.2/2.3 (medium x5) |
| acetone, 1_4_dioxane, acrylonitrile, carbon_disulfide (4 entries) | Same "organic class defaults pending HITL" mislabel at 0.03. These 4 are genuinely volatile (bp 46-101C) so 0.03 is chemically plausible as a real VOC RAF - but the note incorrectly frames it as the class default rather than a disclosed override. | 0.03 | 0.1 (organic) | Lower-priority than the SVOC set above (value is plausible); still needs the note corrected and a decision on whether to keep 0.03 as a disclosed VOC-specific override. | Deep Audit 2.2/2.3 (medium x4 + low x3) |
| chromium_trivalent, barium, beryllium, chromium_hexavalent, chromium (generic), nickel, mercury_inorganic (7 entries) | Undisclosed deviations from the divalent-metal class default (0.001, used by 11/18 metal entries). No note offers any dermal-RAF-specific rationale; chromium_trivalent/barium notes discuss speciation/defaults-unset in general terms but never justify the number. | chromium_trivalent/barium/beryllium/chromium_hexavalent/chromium = 0.1; nickel/mercury_inorganic = 0.03 | 0.001 (divalent-metal) | Speciation-based determination needed per metal: is dermal absorption genuinely elevated for this species, or is 0.001 correct and the deviation undisclosed drift? | Deep Audit 2.2 (medium x2) + 4.3 completeness-critic sweep (5 more, medium) |
| total_pcbs_aroclor_1254 | abs_dermal = 0.14 vs the organic-halogenated class default (0.1, 157/170 entries). Notes discuss only the eco-BSAF/coastal-PAH multiplier, never the dermal RAF; no dermal-specific citation exists in `sources`. | 0.14 | 0.1 (organic-halogenated) | Confirm whether 0.14 is a real chemical-specific RAF or an undisclosed drift; disclose either way. | Deep Audit 2.3 (medium) |
| naphthalene | **Resolved by live-source verification - no action needed on naphthalene itself.** Library Audit flagged 0.148 as an undisclosed deviation from the PAH-class default (0.13, used by 11/11 other PAH entries incl. its own analog 2-methylnaphthalene), calling it a "possible transcription error." Value Reconciliation independently re-verified 0.148 against Health Canada TRV v4.0/v3.0 Table 5 (Moody et al. 2007 B[a]P study) and confirmed it IS the correct PAH-class default. | 0.148 (confirmed correct) | 0.13 (used elsewhere - now the suspected outlier) | Treat the live-source reconciliation as authoritative. Open a **follow-up audit**: check whether the other 11 organic-PAH entries at 0.13 should instead be 0.148 (out of scope of both existing reports). | Value Reconciliation Sec 2/3; Deep Audit 2.2 (medium x2); Library Audit (medium) |

**Group 2 total: 10 decision rows** (naphthalene resolved as "no action on this key, opens a
follow-up"), covering ~24 individual substance entries.

---

## Group 3: BUILD-FIRST WIRING GAPS

Approved catalog values not yet wired into `substanceLibrary.ts`. Each item notes whether the
approved value is single/clean (safe to wire build-first, no judgment call) or needs a
receptor/jurisdiction pick first.

### 3a. HH-pathway - named single-value gaps (wireable once picked)

| Substance / key | Approved value | Wireable as-is? | Source |
|---|---|---|---|
| benzo_a_pyrene (oral RfD) | 0.0003 mg/kg-bw/day - Health Canada (approved) AND US EPA IRIS (approved) agree | Yes - single concordant value, not disclosed as an intentional exclusion (unlike dibenzo_a_h_anthracene, which explicitly documents rfd_oral=null by design). | Deep Audit 2.1 (medium) |
| naphthalene (oral RfD) | 0.02 mg/kg-bw/day - HC and IRIS agree | Yes - sibling PAH batch (anthracene/fluoranthene/phenanthrene/acenaphthene/fluorene) already wired the same pattern. | Deep Audit 2.1 (medium) |
| pyrene (oral RfD) | 0.03 mg/kg-bw/day - HC (approved), IRIS (approved), BC P28 (needs_review) all agree | Yes - still uses an old identity-only template from the eco-registry pilot batch (2026-06-19); never updated when its PAH siblings were wired. | Deep Audit 2.1 (medium) |
| p_p_dichlorodiphenyltrichloroethane_ddt (RfD + SF) | RfD 0.0005 mg/kg-bw/day; SF 0.34 per mg/kg-bw/day - both fully approved | Yes - both endpoints null despite approved rows for both. | Deep Audit 2.1 (medium) |
| tetrachloroethane_1_1_2_2 (RfD + SF) | RfD 0.05; SF 0.2 - both approved | Yes. | Deep Audit 2.1 (medium) |
| methoxychlor (oral RfD) | 0.005 mg/kg-bw/day, approved | Yes. | Deep Audit 2.1 (medium) |
| mirex (oral RfD) | 0.0002 mg/kg-bw/day, approved | Yes, but note: mirex's own notes reportedly self-flag a ~40x logKow discrepancy between two candidate sources that was never escalated as a finding - check before wiring. | Deep Audit 2.1 (medium) + 4.4 (unverified self-flag) |
| pentachlorobenzene_1_2_3_4_5 (oral RfD) | 0.0008 mg/kg-bw/day, approved | Yes. | Deep Audit 2.1 (medium) |
| trichlorobenzene_1_2_4 (oral RfD) | 0.01 mg/kg-bw/day, approved | Yes. | Deep Audit 2.1 (medium) |
| benzene (RfD + SF) | RfD 0.004 mg/kg-bw/day; SF 0.083 per mg/kg-bw/day (Health Canada 2025) - both approved | Yes - ubiquitous, top-priority contaminant; predates the build-first campaign (v1 starter library backlog) but real and high-impact. | Deep Audit 2.1 (medium) |
| toluene, malathion, xylenes (oral RfD, 3 substances) | toluene 0.08 (IRIS) / 0.0097 (HC); malathion 0.02 (IRIS); xylenes 0.2 (IRIS) / 0.013 (HC) - all approved | Yes for malathion (single value). toluene and xylenes each have 2 approved values (IRIS vs HC) - needs a source-priority pick. Currently wired eco-only with notes wrongly implying zero HH data exists (unlike nonylphenol/parathion, which correctly have zero HH rows). | Deep Audit 2.1 (medium) |
| chlorine_dioxide (oral RfD) | 0.03 mg/kg-bw/day, US EPA IRIS. Source catalog row is correctly labeled; the "inhalation RfC" mislabel exists only in `scripts/matrix-options/wire-recon.mjs`'s collapsed per-endpoint display (a generator display bug, not a catalog defect). | Yes, single clean value - **fix the recon-generator display bug first** so the mislabel doesn't repeat on future wiring passes. | Value Reconciliation Sec 2/3; Excluded-Classes Architecture Decision |
| phosphine (oral RfD) | 0.0003 mg/kg-bw/day, US EPA IRIS I.A. Same generator display-bug pattern (coincidentally same magnitude as its separate inhalation RfC). | Yes, single clean value - same generator fix first. Note: phosphine is also the gas released by `aluminum_phosphide` (Group 3b) - resolving one may inform the other. | Value Reconciliation Sec 2/3; Excluded-Classes Proposal Cohort H |
| vanadium_pentoxide (oral RfD) | 0.009 mg/kg-bw/day, US EPA IRIS 1987. Confirmed a genuine oral RfD (not a route mislabel); "Dermal" system-column label on the live IRIS page refers to affected organ, not exposure route. No existing library entry - only an unrelated elemental "vanadium" key. | Yes, single clean value - wire as its own key, do NOT backfill "vanadium." | Value Reconciliation Sec 2/5; Excluded-Classes Proposal Cohort F |

### 3b. HH-pathway - 37-substance excluded metal/inorganic cohort (architecture-gated)

**Blocking prerequisite:** approve the Group 4 `'inorganic'` ContaminantClass decision first. All 37
have an approved oral RfD; none fit the Kow-driven organic template. Once approved, wiring splits
into these sub-cohorts:

| Sub-cohort | Substances | Action | Source |
|---|---|---|---|
| Clean, no overlap (~19) | bromate, chlorite_sodium_salt, monochloramine, perchlorate_clo4_and_perchlorate_salts, nitrate, nitrite, ammonium_sulfamate, fluorine_soluble_fluoride, white_phosphorus, sodium_azide, cyanogen, cyanogen_bromide, chlorine_cyanide, calcium_cyanide, potassium_cyanide, sodium_cyanide, chlorine (confirm sediment-matrix relevance first) | Wire directly as `inorganic`, standard HH-only template. | Excluded-Classes Proposal Cohorts A/B/C/H/I |
| Backfill candidates (fills an existing null-RfD key - HITL sign-off each, do not silently backfill) | mercuric_chloride_hgcl2 -> `mercury_inorganic`; selenious_acid -> `selenium`; uranium_soluble_salts -> `uranium`; nickel_chloride (0.0013 HC) / nickel_soluble_salts (0.02 EPA) / nickel_sulfate (0.012 HC) -> `nickel` (pick ONE, source-priority HC/ECCC over US EPA) | Each needs explicit sign-off before mutating an already-wired key. | Excluded-Classes Proposal Cohorts D/E/F; Architecture Decision Sec "Backfill candidates" |
| Do-NOT-conflate (own key, huge value gap vs. the inorganic parent) | tetraethyl_lead (organolead, RfD 1e-7, ~35000x more stringent than `lead`'s 3.5e-3); tributyltin_oxide_tbto (organotin, RfD 0.0003, ~2000x vs `tin`'s 0.6); aluminum_phosphide (RfD 0.0004, phosphide-driven, ~2500x vs `aluminum`'s 1.0) | Must get their own key, never backfill lead/tin/aluminum. Class call: organometallics (tetraethyl_lead, tributyltin_oxide_tbto) recommended as `organic` (real logKow, honest chemistry, though HH-only wiring nulls logKow so it computes identically to `inorganic`); aluminum_phosphide as `inorganic`. | Excluded-Classes Proposal Cohorts D/G/H; Architecture Decision Sec 3 |
| Cyanide dedup/speciation | cyanide_free (0.00063) vs hydrogen_cyanide_and_cyanide_salts (0.0006, IRIS umbrella value) - likely overlapping assessments, pick one or clarify the distinction. silver_cyanide (0.1, 20x LESS stringent than generic `silver` 0.005) needs re-verification before shipping. potassium_silver_cyanide (0.005) creates a third silver-adjacent value alongside `silver` and `silver_cyanide` - needs a selection convention. copper_cyanide (0.005) - verify against the already-wired generic `copper` key before treating as additive. | Resolve dedup + naming convention before wiring this cluster. | Excluded-Classes Proposal Cohort A; Architecture Decision Sec 4 |
| HITL-deferred (carried over from a prior handoff - no new resolution) | pcbs_non_coplanar (RfD 0.00001 HC, overlaps `total_pcbs_aroclor_1254`'s 2.0e-5 IRIS RfD - needs a PCB congener-grouping policy before wiring); phenylmercuric_acetate (organomercury, RfD 0.00008, neither `methyl-Hg` nor a clean `divalent-metal`/`mercury_inorganic` fit) | Do not wire without an explicit policy call. | Excluded-Classes Proposal Cohorts E/J; Architecture Decision Sec 5 |

### 3c. Eco-pathway - text-data contradictions (notes claim a value was seeded; field is actually null)

| Substance / key | Approved value | Wireable as-is? | Source |
|---|---|---|---|
| chloroform (fcv_ug_per_L) | 1.8 ug/L (CCME) - text cites this exact number | Yes - single row, mechanical fill. | Eco Audit 2.1/3.1 |
| chromium (trv_eco_mg_per_kg_bw_day) | 2.4 / 2.66 mg/kg-bw/day (FCSAP wildlife) | No - 2 approved rows, needs a receptor/estimate pick. | Eco Audit 2.1/3.1-3.2 |
| benz_a_anthracene (trv_eco_mg_per_kg_bw_day) | 0.107 mg/kg-bw/day | Yes - single row. | Eco Audit 2.1/3.1 |
| chlordane_technical (fcv_ug_per_L) | 0.0043 ug/L | Yes - single row. | Eco Audit 2.1/3.1 |
| polychlorinated_biphenyls_total_pcbs (fcv_ug_per_L) | 0.014 ug/L - text cites this exact number, most explicit contradiction in the set | Yes - single row. | Eco Audit 2.1/3.1 |
| pyrene (trv_eco_mg_per_kg_bw_day) | 20.5 mg/kg-bw/day (generic bird) | Yes - single row. | Eco Audit 2.1/3.1 |
| p_p_dichlorodiphenyltrichloroethane_ddt (fcv_ug_per_L) | 0.001 ug/L | Yes - single row. | Eco Audit 2.1/3.1 |

### 3d. Eco-pathway - unwired-approved gaps (no false claim in the text; genuinely never wired)

Single-row (mechanical, build-first-safe): benzene (both fields), barium, chromium_hexavalent,
azinphos_methyl, biphenyl, bromoform, bromophenyl_phenyl_ether_4, butyl_benzyl_phthalate_bbp,
carbaryl, carbon_tetrachloride, chlorpyrifos, demeton, dibutyl_phthalate_dbp, dichlorobenzene_1_2,
dichlorobenzene_1_3, dichlorobenzene_1_4, diethyl_phthalate_dep, endosulfan (parent), heptachlor,
heptachlor_epoxide, hexachlorocyclohexane_gamma (Lindane), tetrachloroethylene, trichloroethylene,
tetrachloroethane_1_1_2_2, trichloroethane_1_1_1, thallium, uranium (26 substances/fields).

Multi-row (2 approved candidate rows - needs a receptor/estimate pick before wiring): diazinon
(0.1699 vs 0.17 ug/L, concordant), endosulfan_alpha (both rows 0.056 ug/L, concordant), endosulfan_beta
(both rows 0.056 ug/L, concordant), ethylbenzene (fcv single-row-safe; trv side needs the same pick
as its fcv counterpart - text already correctly cites "seeded from the eco catalog" for both, not a
contradiction).

naphthalene (trv_eco_mg_per_kg_bw_day): stale documentation (notes say "pending source-backed
ecological values," citing only HH sources) plus an unwired gap. Catalog has 2 approved rows: 14.3
mammal / 7.7 bird. Real-world calculator output may be unaffected if the dynamic `resolveEcoSeed()`
resolver masks it, but the static notes should be corrected and the receptor choice made explicitly.

**Source for 3d: Eco Audit 2.3/3.2 (33 rows, all MEDIUM).**

### 3e. PHC family and lmw_pahs - whole-substance gap (no library entry exists at all)

| Substance / key | Approved eco-food TRV | Note |
|---|---|---|
| lmw_pahs | 65.6 mg/kg-bw/day (mammal) / 7.7 (bird) | Cannot be selected in the calculator UI at all - data is completely unreachable. |
| phc_f1 / phc_f2 / phc_f3 / phc_f4 | 48.72 / 44.73 / 72.45 / 38.22 mg/kg-bw/day (generic mammal) | No entry anywhere in `src/` (confirmed by grep). |
| total_phcs | 210 mg/kg-bw/day (mammal) / 125 (bird) | Same. |

Needs a decision on whether/how to add these keys - aggregate PAH/PHC fraction handling may
double-count against individual congeners already in the library. Source: Eco Audit 2.4/3.2 (MEDIUM).

**Group 3 total: 14 named HH single-item rows + 1 architecture-gated 37-substance HH cohort (5
sub-cohorts) + 7 eco text-data-contradiction rows + 30 eco unwired-gap rows (26 single-row safe + 4
multi-row-pick, plus naphthalene) + 1 PHC/lmw_pahs bundle (5 substances) = roughly 90 individual
substance/field wiring actions once the architecture gate and receptor/source picks are resolved.**

---

## Group 4: CLASSIFICATION

| Item | Issue | Recommendation | Source |
|---|---|---|---|
| **`ContaminantClass` architecture decision (primary, blocks Group 3b)** | The closed 6-value union (`organic \| organic-PAH \| organic-halogenated \| divalent-metal \| methyl-Hg \| metalloid`) has no honest slot for cyanides/oxyanions/DBP species/reactive gases. `derivations.ts` only branches on `organic-PAH` and `methyl-Hg` - every other class (including `divalent-metal`/`metalloid`) already behaves identically at calc time (M_eco=1, standard dermal derivation), so it is descriptive metadata, not a computation switch. | **Recommended: Option B** - add one value, `'inorganic'`, to the union in `types.ts`. Zero `derivations.ts` change needed (falls through the existing default path); confirmed no exhaustive switch/never-check would break. Add one derivations test confirming an `inorganic` entry derives with M_eco=1. Rejected alternative: Option A (reuse `divalent-metal`/`metalloid` as a catch-all) - works with zero code change but ships semantically wrong labels (e.g. sodium cyanide is not a "divalent metal"). | Excluded-Classes Architecture Decision (full doc) |
| maneb | Classed `organic` with zero disclosure of its manganese content (Mn coordinated within the dithiocarbamate chelate, not a simple ionic counterion like Cl- in mepiquat_chloride/paraquat). Inconsistent with the file's own precedent: thiram's notes in the same cohort explicitly justify `organic` by stating it is "metal-free," implying metal content matters. | Classification judgment call: keep `organic` with a disclosure note on the Mn content, or reclassify. | Deep Audit 2.5 (low) |
| zineb (informational - resolved, no decision needed) | Landed in the 37-substance metal-exclusion cohort because of its Zn coordination center, but it is a dithiocarbamate fungicide, predominantly organic chemistry - directly analogous to `thiram` (already wired as `organic`). RfD 0.05 mg/kg-bw/day, approved (US EPA IRIS). | Already resolved by the architecture decision doc: class as `organic`, wire via the standard HH-only organic template. One-substance follow-on to the completed organic lane; does not need the `'inorganic'` decision. Flagged here only so the owner sees the resolution. | Excluded-Classes Architecture Decision Sec "zineb - routing resolved" |

**Group 4 total: 1 primary architecture decision + 1 substance classification call (maneb) + 1
informational (zineb, already resolved).**

---

## Group 5: PROVENANCE/TEXT still needing HITL

Not fabricated numeric errors - citation/documentation-accuracy gaps in the `sources`/`notes` audit
trail. Lower risk (no calculator output changes) but still gated per "no catalog mutation without
HITL" policy. **Excludes everything already fixed in PR #437 / #440 (see banner above).**

| Substance / key | Issue | Recommended action | Source |
|---|---|---|---|
| Truncated `sources` strings (~36 entries) | Full-file mechanical sweep found 36 entries whose `sources` string is truncated mid-word (e.g. "...Physical and Chemical Propert..." with no closing citation) - up from the 14 originally caught. Confirmed members: alpha_hexachlorocyclohexane_alpha_hch, bromoform, bromophenyl_phenyl_ether_4, carbon_tetrachloride, chlorpyrifos, dichlorobenzene_1_2/_1_3/_1_4, endosulfan/_alpha/_beta, heptachlor, heptachlor_epoxide, hexachloroethane, azinphos_methyl, biphenyl, carbaryl, demeton, diazinon, dibutyl_phthalate_dbp, diethyl_phthalate_dep, thallium, uranium, hexachlorocyclohexane_gamma - plus 10 more not individually itemized by the completeness critic. Concentrated in the eco-registry pilot/fan-out batch (2026-06-19) where the load-bearing logKow citation is incomplete; values themselves are individually plausible against known literature ranges. | Documentation-truth fix (complete the citation text; touches no numeric field). Commission a dedicated mechanical sweep to produce the complete, exact 36-entry list before batch-fixing (10 members are still unnamed). | Deep Audit 4.2 (verified gap, low severity) |
| 1_4_dioxane (RfD + SF sources string) | RfD and SF are both correct and approved, but come from two distinct source_ids; `sources` cites neither literally, breaking the dual-source-id convention used elsewhere (RDX, acrylamide). Separate from the already-fixed "remain needs_review" text (PR #437 fixed only the staleness claim, not this citation-completeness gap). | Add literal source_ids per the established convention; no value change. | Library Audit (medium) - no deep-audit equivalent found |
| 2_4_6_trinitrotoluene_tnt (RfD + SF sources string) | Same dual-source-id gap; pre-dates the stricter convention Batch H established after codex flagged the identical pattern on RDX. Separate from the abs_dermal VOC-RAF issue on the same key (Group 2). | Add literal source_ids; no value change. | Library Audit (medium) |
| isophorone (RfD + SF sources string) | Same missing-literal-source-id gap; full traceability is preserved via `notes` (cites specific parameter_value_ids), so this is a citation-convention gap, not a traceability gap. Separate from the already-fixed "remain needs_review" text (PR #437). | Add literal source_ids; no value change. | Library Audit (low) |
| bis_2_ethylhexyl_phthalate_dehp (RfD + SF sources string) | Same missing-literal-source-id gap as TNT; fully traceable via the JSON catalog itself. Separate from the abs_dermal VOC-RAF issue on the same key (Group 2). | Add literal source_ids; no value change. | Library Audit (low) |
| formaldehyde | `notes` says "oral RfD/SF candidates approved," but `sf_oral` is null and the catalog has no oral SF row for formaldehyde at all (only RfD plus inhalation UR/RfC). Leftover template wording copied across an 8-entry batch; no functional impact since SF is correctly excluded. | Fix the leftover templated wording; no value change. | Library Audit (medium) - no deep-audit equivalent found |
| Disclosure-only additions (no wording correction needed beyond adding a note) | total_pcbs_aroclor_1254 (disclose the abs_dermal 0.14 deviation - value decision itself is in Group 2); chromium_trivalent (disclose the abs_dermal deviation - value decision in Group 2); maneb (disclose Mn content - classification decision in Group 4); benzene / tetrachloroethylene / trichloroethylene (add an inline cross-reference to the VOC-RAF rationale already stated elsewhere in the file for their 0.03 abs_dermal - low severity, no value change). | Add disclosure notes; the underlying value/classification decisions live in Groups 2 and 4, not here. | Deep Audit 2.2/2.3/2.5 (low, "safe to auto-fix disclosure" tier per the deep audit's own Section 3.1) |

**Group 5 total: 1 batched truncated-sources item (~36 entries) + 4 named dual-source-citation gaps +
1 stale-wording item (formaldehyde) + 1 batched disclosure-only item (6 entries) = 7 line items.**

---

## Owner action summary

| Group | Decision rows / line items | Underlying substances/fields (approx.) |
|---|---|---|
| 1. Value corrections | 11 | 11 (5 HH + 6 eco) |
| 2. abs_dermal anomalies | 10 | ~24 (vinyl_chloride, 4 VOC-RAF-misapplied, 5 mislabeled-SVOC, 4 mislabeled-VOC-plausible, 7 divalent-metal, 1 PCB, naphthalene resolved) |
| 3. Build-first wiring gaps | 14 named + 1 cohort (5 sub-cohorts) + 7 + 30 + 1 bundle (5) | ~90 (14 HH named + 37 HH cohort + 7 eco contradictions + 30 eco gaps + 5 PHC/lmw_pahs) |
| 4. Classification | 1 primary architecture decision + 1 substance call + 1 informational | 1 architecture + 1 audited (maneb) |
| 5. Provenance/text | 7 line items | ~44 (36 truncated-sources + 4 dual-source-citation + formaldehyde + 6 disclosure-only) |
| **Already fixed (no action)** | - | 12 (3 in #437 + 9 in #440) |

**Total actionable HITL decision rows in this consolidation: 43 line items**, covering roughly 170+
individual substance/field corrections once multi-row picks and the 37-substance and 30-substance
cohorts are expanded. The single highest-leverage unblock is the Group 4 `'inorganic'`
`ContaminantClass` decision (Option B): a one-line type change that unblocks 37 HH substances at once.

*Report-only. No `SUBSTANCE_LIBRARY`, catalog, or provenance file was modified in the production of
this consolidation. Source reports consulted: items 1-6 above.*
