# Matrix-Options Owner-Decisions Queue (2026-07-02 overnight autonomous run)

This is the consolidated worklist of MO items an autonomous overnight session identified but did NOT wire, because each needs an owner judgment (a value/source pick, a class call, a policy decision, or schema work). Nothing here was guessed or shipped. Items are grouped by lane. Cross-reference: the PCB-key ruling is detailed in `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`; the full wiring pool is in `scripts/matrix-options/_recon/wire_candidates.json`.

## Section A -- Lane 4: methylmercury eco TRV (highest-value single decision)

`methylmercury.trv_eco_mg_per_kg_bw_day` is currently null (a fabricated 0.000064 CCME citation was removed 2026-07-02). It is an ECO-ACTIVATION decision, not a simple backfill: `methylmercury.bsaf_loc_freshwater` is non-null (15), so writing a static `trv_eco` value goes LIVE and drives eco-food output (the exact static-driven path #449/#453 suppressed). Prior research found real CCME wildlife TRVs: mammal 22 and avian 31 ug/kg-bw/day (i.e. 0.000022 / 0.000031), plus a 33 ug/kg tissue guideline.

OWNER OPTIONS:

| Option | Description |
|---|---|
| Option 1 | wire mammal 0.000022 as the static default. |
| Option 2 | wire avian 0.000031 as the static default. |
| Option 3 | keep null and force the dynamic catalog resolver / explicit HITL receptor choice (the direction the benzo_a_pyrene note endorses for eco statics). Receptor-specific "carry both" is NOT expressible in the single scalar field -- it needs catalog rows filtered by species_groups in resolveEcoSeed + resolver/test work, out of scope for a static wire. |

PROVENANCE NOTE: `pv-mehg-trv-eco` was deliberately deleted (fabricated source). Wiring a value also requires re-establishing a real catalog/provenance row, or the library default has no evidence record.

Recommendation: confirm the CCME value against the live CCME source before wiring; Option 1 (mammal 0.000022) is the conservative default if a static value is chosen.

## Section B -- Lane 4: verified-null records (no action needed unless a source is found)

These two eco statics stay null; extensive search found no real source (not gaps to fill blindly):

| Record | Note |
|---|---|
| `benzo_a_pyrene.fcv_ug_per_L` = null | No EPA ESB / aquatic-life FCV exists for BaP (PAHs handled by a separate mixtures document). Re-fill only if a CCME / narcosis-model PAH benchmark is found. |
| `total_pcbs_aroclor_1254.trv_eco_mg_per_kg_bw_day` = null | No EPA Eco-SSL exists for PCBs. (Its FCV 0.014 is separately VERIFIED and stays.) |

## Section C -- Lane 3: PCB-key consolidation (awaiting ruling)

See the decision brief. Recommended: Option A (keep total_pcbs_aroclor_1254 canonical; alias/deprecate the plain key WITH catalog-row migration) + a "Total-PCBs-default, Aroclor/congener-specific as explicit alternatives, never additive" congener policy. In-code "do not merge" guards stay until sign-off.

## Section D -- Lane 1: queued wiring items (92) -- each needs an owner decision

Autonomous wiring tonight covered only selection_status=='clean' oral (rfd_oral/sf_oral) rows that map to existing library fields. The following are QUEUED (NOT wired):

### D1. Jurisdiction conflict on the oral field (17) -- pick one value/jurisdiction each

| Substances |
|---|
| arsenic_inorganic, barium, benzo_a_pyrene, cadmium, carbon_tetrachloride, chlorobenzene, chromium_trivalent, dichlorobenzene_1_2, dichloroethylene_1_1, dichloromethane, ethylbenzene, manganese, methylmercury, tetrachloroethylene, total_pcbs_aroclor_1254, trichloroethylene, zinc. |

(e.g. benzo_a_pyrene rfd_oral has candidates 0.0003 / 0.0004 / 0.002.)

### D2. Cyanide speciation cluster (9-10) -- dedup/speciation + silver convention

| Substances | Note |
|---|---|
| calcium_cyanide, copper_cyanide, cyanide_free, hydrogen_cyanide_and_cyanide_salts, potassium_cyanide, potassium_silver_cyanide, silver_cyanide, sodium_cyanide, cyanogen, cyanogen_bromide | Decide: cyanide_free vs the hydrogen_cyanide umbrella; silver_cyanide (0.1, ~20x less-stringent than generic silver 0.005) + potassium_silver_cyanide convention; copper_cyanide vs generic copper. |

### D3. Metal-salt backfills onto an elemental key (6) -- source-priority pick

| Metal-salt | Elemental Key / Action |
|---|---|
| mercuric_chloride_hgcl2 | -> mercury_inorganic |
| selenious_acid | -> selenium |
| uranium_soluble_salts | -> uranium |
| nickel_chloride (0.0013 HC) / nickel_soluble_salts (0.02 EPA) / nickel_sulfate (0.012 HC) | -> nickel (pick ONE) |

### D4. Organometallics (3) -- own key + contaminantClass call

| Substance | Note |
|---|---|
| tetraethyl_lead (RfD 1e-7), tributyltin_oxide_tbto (RfD 0.0003), aluminum_phosphide (RfD 0.0004) | Must get their own key (never backfill lead/tin/aluminum); class call needed (organometallics recommended "organic"). |

### D5. Deferred policy (2)

| Substance | Policy |
|---|---|
| pcbs_non_coplanar | needs the PCB congener policy from Section C |
| phenylmercuric_acetate | organomercury, RfD 0.00008, neither methyl-Hg nor divalent-metal/mercury_inorganic fits cleanly |

### D6. Source-priority / discrepancy (3)

| Substance | Issue |
|---|---|
| mirex | resolve self-flagged ~40x logKow discrepancy first |
| toluene | 0.08 IRIS / 0.0097 HC |
| xylenes | 0.2 IRIS / 0.013 HC |

### D7. Value mismatch / duplicate-key issues (3)

| Substance | Issue |
|---|---|
| antimony | existing library rfd_oral 0.006 (BC P28 needs_review) vs recon clean 0.0004 (IRIS, ~15x lower) -- source-priority pick. |
| dichloroethane_1_2 | same substance as existing key `1_2_dichloroethane` under a reversed-name key -- naming-dedup + jurisdiction decision, do NOT append a second key. |
| polychlorinated_biphenyls_pcbs | would be a 3rd PCB-family key -- fold into the Section C congener policy, likely redundant. |

### D8. Inhalation-only, schema gap (48) -- needs a SubstanceEntry rfc_inh/iur_inh field + calculator support

48 substances have only clean inhalation values (rfc_inh/iur_inh) that SubstanceEntry cannot hold. These require a schema addition before any can wire.

- 1_1_1_2_tetrafluoroethane
- 1_1_difluoroethane
- 1_4_dichlorobenzene
- 1_6_hexamethylene_diisocyanate
- 2_4_2_6_toluene_diisocyanate_mixture_tdi
- 2_chloroacetophenone
- 2_ethoxyethanol
- 2_methoxyethanol
- 2_nitropropane
- acetaldehyde
- acetonitrile
- allyl_chloride
- ammonia
- antimony_trioxide
- arsine
- butadiene_1_3
- cerium_oxide_and_cerium_compounds
- chloro_1_1_difluoroethane_1
- chlorodifluoromethane
- chloroethane
- chloromethane
- chloroprene
- coke_oven_emissions
- cyclohexane
- dibromo_3_chloropropane_1_2
- dichloropropane_1_2
- diesel_engine_exhaust
- epoxybutane_1_2
- ethylene_oxide
- hydrogen_chloride
- hydrogen_sulfide
- mercury_elemental
- methyl_isobutyl_ketone_mibk
- methyl_tert_butyl_ether_mtbe
- methylene_diphenyl_diisocyanate_monomeric_mdi_and_polymeric_mdi_pmdi
- n_n_dimethylformamide
- nickel_metallic
- nickel_mixture
- nickel_oxide
- nickel_refinery_dust
- nickel_subsulfide
- phosgene
- phosphoric_acid
- propionaldehyde
- propylene_glycol_monomethyl_ether_pgme
- triethylamine
- vinyl_acetate
- vinyl_bromide

## Section E -- Lane 2: truncated-citation residual

(This section is a placeholder the orchestrator fills after the Lane-2 run: list any of the 36 citations that could NOT be verified against a primary source and were left marked-incomplete.)
