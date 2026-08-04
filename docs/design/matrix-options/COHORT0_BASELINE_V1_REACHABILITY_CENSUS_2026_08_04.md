# Cohort 0 Baseline-v1 Reachability Census

**Status:** Offline source-derived census; no regulatory value was selected,
promoted, changed, or written.

**Source authority:** 9af819af01e30d097a3ea492a9354f9378be3f58

**Owner-approved v1 boundary:** existing baseline screening calculators only;
desktop/tablet at 768px or wider; PR-MAP-6, PR-MAP-7, and the mobile summary
deferred; aggregate publication excluded from v1.

## 1. Scope and interpretation

The R2 decision did not name a smaller v1 substance set. This census therefore
covers all 426 substances selectable from SUBSTANCE_LIBRARY at the pinned
source authority. Cohort 1 still requires an owner/QP-selected workflow and
substance set.

The rendered Calculator tab contains one selected quadrant calculator
(Eco-Direct, Eco-Food, HH-Direct, or HH-Food), plus the always-rendered
inhalation, cumulative-effects, and background-adjustment surfaces.
FRAME_VARIANTS is empty, so this census measures the default
bc-protocol1-v5-dra baseline behavior, not frame-specific calculator parity.

Two row sets are kept separate:

1. **Substance-bound rows:** 14 input schemas x 426 selectable substances =
   5,964 rows keyed by surface, pathway, input_key, and substance_key.
2. **Non-substance/UI rows:** 55 input-schema rows keyed by surface, pathway,
   and input_key. Cumulative effects and background adjustment are included
   here because they are rendered baseline surfaces but are not
   substance-catalog pathways.

The four permitted classifications mean:

- **defaulted:** the current baseline UI automatically seeds the slot.
- **required_user_input:** the editable slot is blank, and supplying it (or
  another member of its named requirement group) can unblock computation.
- **supported_alternate:** the slot is optional/conditional, or another seeded
  endpoint already supports the route. A catalog alternative is never silently
  selected.
- **unsupported_fail_closed:** a non-editable prerequisite is absent or an
  explicit guard makes the combination noncomputable; other typed values cannot
  bypass it.

## 2. Substance-bound census

| Surface | Input schema | defaulted | required_user_input | supported_alternate | unsupported_fail_closed | Total |
|---|---|---:|---:|---:|---:|---:|
| Eco-Direct | logKow | 50 | 0 | 0 | 376 | 426 |
| Eco-Direct | fcv_ug_per_L | 47 | 3 | 0 | 376 | 426 |
| Eco-Food | trv_eco_mg_per_kg_bw_day | 24 | 1 | 0 | 401 | 426 |
| Eco-Food | bsaf_loc_freshwater | 4 | 21 | 0 | 401 | 426 |
| HH-Direct | rfd_oral_mg_per_kg_bw_per_day | 387 | 18 | 21 | 0 | 426 |
| HH-Direct | sf_oral_per_mg_per_kg_bw_per_day | 67 | 18 | 341 | 0 | 426 |
| HH-Direct | abs_dermal | 426 | 0 | 0 | 0 | 426 |
| HH-Direct | ba_oral | 426 | 0 | 0 | 0 | 426 |
| HH-Food | rfd_oral_mg_per_kg_bw_per_day | 387 | 18 | 21 | 0 | 426 |
| HH-Food | sf_oral_per_mg_per_kg_bw_per_day | 67 | 18 | 341 | 0 | 426 |
| HH-Food | bsaf_loc_freshwater | 4 | 422 | 0 | 0 | 426 |
| HH-Food | ba_oral | 426 | 0 | 0 | 0 | 426 |
| Inhalation | rfc_inhalation_mg_per_m3 | 3 | 423 | 0 | 0 | 426 |
| Inhalation | iur_inhalation_per_mg_per_m3 | 3 | 423 | 0 | 0 | 426 |
| **Total** | **14 schemas** | **2,321** | **1,365** | **724** | **1,554** | **5,964** |

Defaulted means runtime auto-population, not a new owner promotion and not
necessarily catalog default_status=current_default. The eco seed resolver is
read-only and may select an eligible existing record according to its frozen
ranking contract.

### 2.1 Route-readiness rollup

Each substance/pathway route is classified by whether its complete baseline
calculation is immediately reachable:

| Route | defaulted | required_user_input | supported_alternate | unsupported_fail_closed | Total |
|---|---:|---:|---:|---:|---:|
| Eco-Direct | 47 | 3 | 0 | 376 | 426 |
| Eco-Food | 3 | 22 | 0 | 401 | 426 |
| HH-Direct | 408 | 18 | 0 | 0 | 426 |
| HH-Food | 3 | 423 | 0 | 0 | 426 |
| Inhalation | 0 | 426 | 0 | 0 | 426 |
| **Total** | **461** | **892** | **0** | **777** | **2,130** |

Inhalation is user-input-gated for every substance because VF and PEF are
intentionally never seeded. Three substances have both toxicity inputs
defaulted, but they still require a transport factor.

Eco-Food is stricter than a blank editable field: when both the library BSAF
and a frame-eligible TRV seed are absent, the component's pre-parse
applicability guard fails closed before user overrides are parsed. Those 401
routes are therefore unsupported_fail_closed, not required_user_input.

### 2.2 Exact exception sets

The following sorted sets, together with the 426-row substance library pinned
below, make the route rollup reproducible. All unlisted keys fall into the
complement stated for that route.

**Eco-Direct defaulted (47):**
alpha_hexachlorocyclohexane_alpha_hch, azinphos_methyl, benzene, biphenyl,
bromoform, bromophenyl_phenyl_ether_4, butyl_benzyl_phthalate_bbp, carbaryl,
carbon_tetrachloride, chlordane_technical, chlorobenzene, chloroform,
chlorpyrifos, demeton, diazinon, dibenzofuran, dibutyl_phthalate_dbp,
dichlorobenzene_1_2, dichlorobenzene_1_3, dichlorobenzene_1_4, dieldrin,
diethyl_phthalate_dep, endosulfan, endosulfan_alpha, endosulfan_beta,
ethylbenzene, heptachlor, heptachlor_epoxide,
hexachlorocyclohexane_gamma, hexachloroethane, malathion, methoxychlor,
mirex, nonylphenol, p_p_dichlorodiphenyltrichloroethane_ddt, parathion,
pentachlorobenzene_1_2_3_4_5, polychlorinated_biphenyls_total_pcbs,
tetrachloroethane_1_1_2_2, tetrachloroethylene, toluene,
total_pcbs_aroclor_1254, toxaphene, trichlorobenzene_1_2_4,
trichloroethane_1_1_1, trichloroethylene, xylenes.

**Eco-Direct required_user_input (3):** benz_a_anthracene, benzo_a_pyrene,
pyrene. The other 376 selectable substances are unsupported_fail_closed
because logKow is absent and is not an editable v1 input.

**Eco-Food defaulted (3):** benzo_a_pyrene, lmw_pahs, methylmercury.

**Eco-Food required_user_input (22):** arsenic_inorganic, barium,
benz_a_anthracene, benzene, cadmium, chromium, chromium_hexavalent, copper,
ethylbenzene, lead, mercury_inorganic, naphthalene, nickel, pyrene, selenium,
thallium, toluene, total_pcbs_aroclor_1254, uranium, vanadium, xylenes, zinc.
Total PCBs has BSAF but no TRV; the other 21 have TRV but no BSAF. The other
401 selectable substances are unsupported_fail_closed by the pre-parse guard.

**HH oral endpoints both absent (18):** azinphos_methyl, benz_a_anthracene,
bromophenyl_phenyl_ether_4, chlorpyrifos, chromium, diazinon, dibenzofuran,
dichlorobenzene_1_3, endosulfan_alpha, endosulfan_beta, lmw_pahs, nickel,
nonylphenol, parathion, polychlorinated_biphenyls_total_pcbs, thallium,
trichloroethane_1_1_1, vanadium.

The other 408 substances are HH-Direct defaulted through at least one oral
toxicity endpoint. For an absent RfD or slope-factor slot within those 408,
the seeded counterpart is classified supported_alternate rather than missing.

**HH-Food defaulted (3):** benzo_a_pyrene, methylmercury,
total_pcbs_aroclor_1254. The other 423 are required_user_input because the
surface exposes the missing oral endpoint and/or BSAF field and does not apply
Eco-Food's pre-parse hard block.

**Inhalation toxicity-defaulted (3):** benzene, tetrachloroethylene,
trichloroethylene. All 426 routes remain required_user_input because at least
one of VF or PEF must be supplied.

## 3. Non-substance/UI schema census

| Classification | Count | Exact rows |
|---|---:|---|
| defaulted | 46 | shared.category; shared.substance_key; shared.regulatory_frame; eco-direct-eqp.foc; eco-food-bsaf.receptor; eco-food-bsaf.BW_eco_kg; eco-food-bsaf.IR_eco_kg_per_day; eco-food-bsaf.fLipid; eco-food-bsaf.foc; eco-food-bsaf.Fsite; human-health-direct.receptor_scenario; human-health-direct.BW_kg; human-health-direct.ED_years; human-health-direct.IR_sed_mg_per_day; human-health-direct.AT_cancer_years; human-health-direct.SA_cm2; human-health-direct.AF_sed_mg_per_cm2; human-health-direct.EF_days_per_year; human-health-direct.targetRisk; human-health-direct.hazardQuotient; human-health-food.receptor_scenario; human-health-food.BW_kg; human-health-food.IR_food_kg_per_day; human-health-food.targetRisk; human-health-food.hazardQuotient; human-health-food.fLipid; human-health-food.foc; human-health-food.ecosystem; inhalation.EF_days_per_year; inhalation.ED_years; inhalation.AT_cancer_years; inhalation.targetRisk; inhalation.hazardQuotient; background.scope; background.provincial_samples_mg_per_kg; cumulative-bapeq.pah_key; cumulative-bapeq.concentration; cumulative-bapeq.unit; cumulative-bapeq.rpf_scheme; cumulative-bapeq.lifetime_adaf; cumulative-teq.congener_id; cumulative-teq.concentration; cumulative-teq.unit; cumulative-teq.is_non_detect; cumulative-teq.tef_edition; cumulative-teq.non_detect_fraction |
| required_user_input | 2 | inhalation.volatilization_factor_m3_per_kg; inhalation.particulate_emission_factor_m3_per_kg. These form one transport_at_least_one requirement group. |
| supported_alternate | 7 | eco-direct-eqp.Cs_mg_per_kg (optional comparison); background.regional_samples_mg_per_kg (inactive retained scope); background.Cs_mg_per_kg (optional comparison); cumulative-bapeq.age_fraction_0_lt_2; cumulative-bapeq.age_fraction_2_lt_16; cumulative-bapeq.age_fraction_16_plus (the three are conditional on lifetime_adaf=true); cumulative-teq.mdl (conditional on is_non_detect=true). |
| unsupported_fail_closed | 0 | None. |
| **Total** | **55** | **Kept separate from substance coverage.** |

K_95_95 and utl_mg_per_kg are derived outputs, not input rows. Cumulative
effects remains a noncatalog reducer and is not counted as a provenance
dispatch pathway.

The receptor selectors are counted once as input schemas, not once per
substance. Eco-Food renders its selector for the 24 substances with at least
one eligible receptor TRV: 16 offer both receptors, 5 are mammal-only, and 3
are bird-only. The state defaults to mammal and snaps to the first eligible
receptor when mammal is unavailable. HH-Direct offers three selectable
scenarios and defaults to residential toddler. HH-Food offers four selectable
scenarios and defaults to recreational fisher.

## 4. Verification and frozen inputs

The census was computed mechanically by a read-only helper and independently
recomputed by a temporary Vitest verifier against the same source bytes.
Independent verification passed 1/1 with the exact 5,964-row classification
totals above. The 55-row rendered-control inventory was separately traced
through the component JSX and frame-default resolvers. The temporary verifier
was removed after the run and is not part of this candidate.

Load-bearing hashes:

~~~text
src/lib/matrix-options/substanceLibrary.ts C3A4D6652C1C136FB0F820487681D0886D107A519B0FD4DBCA4D812692CDEE46
src/lib/matrix-options/ecoSeed.ts 23A4270F9632CE18C131E9DD954188E7A10308CED0237354BB654DF474F88714
src/lib/matrix-options/frameVariants.ts 97B896B10773C834C5CF5F22E727094C36C3C5C12F1379FF1A4BB74879390F0E
src/lib/matrix-options/frameDefaults.ts D35E76EA8F76733AE1E398E225D3E6C2F3A0DA5EAB6EE931AD576214FCCBFAF6
src/lib/matrix-options/regulatoryFrames.ts B707B2AEA94FF24A76300B39ADCE238FCC0A86DEC61AF204E52665E26A1F5185
src/lib/matrix-options/defaultSelectionPolicy.ts 9B48115472F4CD742A7ED7995E6DF121973B4996BC1F11037C142BD59B25D93C
src/lib/matrix-options/provenance/catalog.ts 18AD863291D4A691839CCE82D5D58B225A8388A3D2019F4329377472E195EB73
src/components/MatrixDashboard.tsx B90E6BE061F0A8612055B49F3F8F871977C21172076D0D215F03E81CD087A4CE
src/components/matrix-options/SharedGlobalInputs.tsx CB47410535235E90DB3B453D792E20DA798B8333BBAD24C70A7C39F525B9582F
src/components/matrix-options/CategorySelector.tsx 5A45362BBDDD22513DF263516F8E969785ECD7CA62E31767C27FB2E1094A97F9
src/components/matrix-options/EcoDirectEqPCalculator.tsx 6FD11E58150D37442C6D2AFCB6F03EE4DD524905F38A71A90105AC826943EC1B
src/components/matrix-options/EcoFoodBSAFCalculator.tsx 17EB36D8C770FF200A81BB20867430D7F37EE9221BE8C9FABA563262DC1EB876
src/components/matrix-options/HHDirectContactCalculator.tsx 92B30CD02A3468E75C6E3FDB072C034F2FCFA68DDE913F6C2E777F98E8ED4717
src/components/matrix-options/HHFoodWebCalculator.tsx 78C0821A0C0D938A6C50BD3B4EB578640B6B564ED1AA581C8380664E6D12A9E2
src/components/matrix-options/HHInhalationCalculator.tsx 3187ACCCDF8C94AFFB034647D88E793E1F8F6FF8B24E38B4009F5624CAED8F23
src/components/matrix-options/BackgroundAdjustment.tsx 10E907F46E26DB76742B903CD7656E858C3DB883D8D4D2FDE4E7A75E7AD66AB8
src/components/matrix-options/CumulativeEffectsCalculator.tsx 2C8876C2AFF393829754FD8325E149FF718A25C3F5CF41B39BA6B96E5BF6766B
matrix_research/reference_catalog/sources.json A32904DBA64E80776642FE8DE3332ACA710A39E4E9B639D3971789624DFF033D
matrix_research/reference_catalog/parameter_values.json D4DDBA2799BA8AAFA1F5EAE877D3F247C935C269D07F4966F03866B61E234840
matrix_research/reference_catalog/human_health_trv_values.json 4BBB4BAE77D853AB2B5BEAEA6DAFB376B6F89FD9951E15779AF95D6073B8DB0D
matrix_research/reference_catalog/eco_values.json 978B0B1B26B73224B9F1CEF961A3DA277DF03DA35C6B2F54AFB76EC967E52794
~~~

No network, credential, production, Supabase, database, candidate, refresh,
publication, Git staging, or Git commit action was used.

## 5. Cohort 1 owner/QP decision inputs

HH-Direct is the mechanically smallest-gap vertical-slice candidate:
408/426 substances are default-reachable. This is a prioritization fact, not a
regulatory recommendation.

The owner/QP should decide:

1. Exact baseline workflow and 3-5 substances based on expected use.
2. Exact regulatory frame for the release slice.
3. Receptor scenario and its full seeded exposure-factor set. Eco-Food also
   binds the substance/receptor pair because receptor changes the TRV source
   and value.
4. Governing toxicity endpoint(s), primary source/version, and unit contract.
5. Whether supported alternates are only visible or are explicitly evaluated.
6. One worked methodology example and numeric acceptance tolerance.
7. Required fail-closed behavior for the 18 substances with neither oral
   toxicity endpoint.
8. Whether PCB TEQ special handling is in or out of the first slice.

No choice in this list is delegated to AI, and this census grants no authority
to select or promote a regulatory value.
