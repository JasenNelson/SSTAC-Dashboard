# Matrix-Options IRIS orphan recon (2026-06-02)

Status: Phase A recon output -- READ-ONLY analysis, no catalog/snapshot/SQL written.
Source of truth: EPA IRIS export `Chemicals_Details (1).xlsx` (authoritative; never AI memory).
AI proposes; HITL disposes. Every generated row would be default_status=available_option,
qa_status=needs_review. This report exists for the owner to approve scope before any generation.

## Totals

| Bucket | Groups (substance x input) | Distinct substances |
|---|---|---|
| Already covered (catalog has a candidate) | 137 | -- |
| ORPHAN new-input (known substance, new input) | 42 | 29 |
| ORPHAN new-substance (not in catalog) | 407 | 338 |
| AMBIGUOUS (needs owner adjudication) | 21 | 16 |
| DATA-QUALITY flagged (cell unit vs type) | 3 | -- |
| Unparseable EPA value rows | 0 | -- |

A 'group' is one (substance_key, input_key); a group may carry multiple EPA endpoint
values (each becomes a separate candidate record; the snapshot anchor holds all values).

New-substance orphans by input: {"rfd_oral_mg_per_kg_bw_day": 280, "sf_oral_per_mg_per_kg_bw_per_day": 54, "unit_risk_inhalation_per_ug_m3": 32, "rfc_inhalation_mg_per_m3": 41}
New-input orphans by input: {"unit_risk_inhalation_per_ug_m3": 13, "sf_oral_per_mg_per_kg_bw_per_day": 16, "rfc_inhalation_mg_per_m3": 8, "rfd_oral_mg_per_kg_bw_day": 5}

## AMBIGUOUS -- owner must adjudicate before these are generated

These EPA chemicals minted a key that collides with an existing catalog substance
(likely the same substance already present via a non-IRIS source, e.g. Health Canada).
Owner decides: attach the IRIS value to the existing substance_key, or treat as distinct.

| EPA chemical | CASRN | input | existing substance_key | reason |
|---|---|---|---|---|
| Acetonitrile | 75-05-8 | inhalation_rfc | acetonitrile | minted key collides with existing substance_key 'acetonitrile' |
| Anthracene | 120-12-7 | oral_rfd | anthracene | minted key collides with existing substance_key 'anthracene' |
| Antimony | 7440-36-0 | oral_rfd | antimony | minted key collides with existing substance_key 'antimony' |
| Benzyl chloride | 100-44-7 | oral_slope_factor | benzyl_chloride | minted key collides with existing substance_key 'benzyl_chloride' |
| Chlorodifluoromethane | 75-45-6 | inhalation_rfc | chlorodifluoromethane | minted key collides with existing substance_key 'chlorodifluoromethane' |
| Chloroform | 67-66-3 | inhalation_unit_risk | chloroform | minted key collides with existing substance_key 'chloroform' |
| Chloroform | 67-66-3 | oral_rfd | chloroform | minted key collides with existing substance_key 'chloroform' |
| Cyanogen | 460-19-5 | oral_rfd | cyanogen | minted key collides with existing substance_key 'cyanogen' |
| Cyanogen bromide | 506-68-3 | oral_rfd | cyanogen_bromide | minted key collides with existing substance_key 'cyanogen_bromide' |
| Epichlorohydrin | 106-89-8 | oral_slope_factor | epichlorohydrin | minted key collides with existing substance_key 'epichlorohydrin' |
| Epichlorohydrin | 106-89-8 | inhalation_unit_risk | epichlorohydrin | minted key collides with existing substance_key 'epichlorohydrin' |
| Epichlorohydrin | 106-89-8 | inhalation_rfc | epichlorohydrin | minted key collides with existing substance_key 'epichlorohydrin' |
| Ethylene oxide | 75-21-8 | inhalation_unit_risk | ethylene_oxide | minted key collides with existing substance_key 'ethylene_oxide' |
| Hexachlorobutadiene | 87-68-3 | inhalation_unit_risk | hexachlorobutadiene | minted key collides with existing substance_key 'hexachlorobutadiene' |
| Hexachlorobutadiene | 87-68-3 | oral_slope_factor | hexachlorobutadiene | minted key collides with existing substance_key 'hexachlorobutadiene' |
| Methanol | 67-56-1 | oral_rfd | methanol | minted key collides with existing substance_key 'methanol' |
| Methanol | 67-56-1 | inhalation_rfc | methanol | minted key collides with existing substance_key 'methanol' |
| Methyl isobutyl ketone (MIBK) | 108-10-1 | inhalation_rfc | methyl_isobutyl_ketone_mibk | minted key collides with existing substance_key 'methyl_isobutyl_ketone_mibk' |
| Nickel subsulfide | 12035-72-2 | inhalation_unit_risk | nickel_subsulfide | minted key collides with existing substance_key 'nickel_subsulfide' |
| Silver | 7440-22-4 | oral_rfd | silver | minted key collides with existing substance_key 'silver' |
| Triethylamine | 121-44-8 | inhalation_rfc | triethylamine | minted key collides with existing substance_key 'triethylamine' |

## ORPHAN new-input (known substance, EPA has an input the catalog lacks)

| substance_key | EPA chemical | input | values | snapshot anchor? |
|---|---|---|---|---|
| acetaldehyde | Acetaldehyde | inhalation_unit_risk | 2.2e-06 | yes |
| acrylonitrile | Acrylonitrile | oral_slope_factor | 0.54 | yes |
| acrylonitrile | Acrylonitrile | inhalation_unit_risk | 6.8e-05 | yes |
| arsenic_inorganic | Arsenic, Inorganic | inhalation_unit_risk | 0.0043 | yes |
| benzo_a_pyrene | Benzo[a]pyrene (BaP) | inhalation_unit_risk | 0.001 | yes |
| benzo_a_pyrene | Benzo[a]pyrene (BaP) | inhalation_rfc | 3e-06, 2e-06 | yes |
| bis_2_ethylhexyl_phthalate_dehp | Di (2-ethylhexyl)phthalate (DEHP) | oral_slope_factor | 0.013999999999999999 | yes |
| bromodichloromethane | Bromodichloromethane | oral_slope_factor | 0.062000000000000006 | yes |
| bromoform | Bromoform | oral_slope_factor | 0.0079 | yes |
| butadiene_1_3 | 1,3-Butadiene | inhalation_rfc | 0.002 | yes |
| carbon_tetrachloride | Carbon tetrachloride | oral_slope_factor | 0.07 | yes |
| carbon_tetrachloride | Carbon tetrachloride | inhalation_unit_risk | 6e-06 | yes |
| chloroprene | Chloroprene | inhalation_unit_risk | 0.00030000000000000003 | yes |
| dibromochloromethane | Dibromochloromethane | oral_slope_factor | 0.084 | yes |
| dibromoethane_1_2 | 1,2-Dibromoethane | oral_slope_factor | 2.0 | yes |
| dibromoethane_1_2 | 1,2-Dibromoethane | oral_rfd | 0.009000000000000001 | yes |
| dibromoethane_1_2 | 1,2-Dibromoethane | inhalation_rfc | 0.009000000000000001 | yes |
| dichloromethane | Dichloromethane | oral_slope_factor | 0.0033 | yes |
| dichloromethane | Dichloromethane | inhalation_unit_risk | 1.7e-08 | yes |
| dichloropropene_1_3_cis_trans | 1,3-Dichloropropene | inhalation_unit_risk | 4e-06 | yes |
| dichloropropene_1_3_cis_trans | 1,3-Dichloropropene | inhalation_rfc | 0.02 | yes |
| dichloropropene_1_3_cis_trans | 1,3-Dichloropropene | oral_rfd | 0.03 | yes |
| hexachlorobenzene | Hexachlorobenzene | oral_slope_factor | 1.6 | yes |
| hexachlorobenzene | Hexachlorobenzene | inhalation_unit_risk | 0.00045999999999999996 | yes |
| hexachlorocyclopentadiene | Hexachlorocyclopentadiene (HCCPD) | oral_rfd | 0.006 | yes |
| hexachloroethane | Hexachloroethane | oral_slope_factor | 0.04 | yes |
| manganese | Manganese | inhalation_rfc | 5e-05 | yes |
| methyl_ethyl_ketone_mek | Methyl ethyl ketone (MEK) | inhalation_rfc | 5.0 | yes |
| nitrobenzene | Nitrobenzene | oral_rfd | 0.002 | yes |
| nitrobenzene | Nitrobenzene | inhalation_unit_risk | 4e-05 | yes |
| pentachlorophenol | Pentachlorophenol | oral_slope_factor | 0.4 | yes |
| phosphine | Phosphine | oral_rfd | 0.00030000000000000003 | yes |
| propylene_oxide | Propylene oxide | oral_slope_factor | 0.24 | yes |
| propylene_oxide | Propylene oxide | inhalation_unit_risk | 3.7e-06 | yes |
| tetrachloroethane_1_1_1_2 | 1,1,1,2-Tetrachloroethane | inhalation_unit_risk | 7.4e-06 | yes |
| tetrachloroethane_1_1_1_2 | 1,1,1,2-Tetrachloroethane | oral_slope_factor | 0.026000000000000002 | yes |
| tetrachloroethane_1_1_2_2 | 1,1,2,2-Tetrachloroethane | oral_slope_factor | 0.2 | yes |
| tetrahydrofuran | Tetrahydrofuran | inhalation_rfc | 2.0 | yes |
| toluene | Toluene | inhalation_rfc | 5.0 | yes |
| trichloroethane_1_1_2 | 1,1,2-Trichloroethane | inhalation_unit_risk | 1.6000000000000003e-05 | yes |
| trichloroethane_1_1_2 | 1,1,2-Trichloroethane | oral_slope_factor | 0.057 | yes |
| trichloropropane_1_2_3 | 1,2,3-Trichloropropane | oral_slope_factor | 0.5 | yes |

## ORPHAN new-substance (full list)

Proposed substance_key is minted snake_case from the EPA chemical name; owner may rename.

| proposed substance_key | EPA chemical | CASRN | input | values |
|---|---|---|---|---|
| 1_1_1_2_tetrafluoroethane | 1,1,1,2-Tetrafluoroethane | 811-97-2 | inhalation_rfc | 80.0 |
| 1_1_1_trichloroethane | 1,1,1-Trichloroethane | 71-55-6 | inhalation_rfc | 7.0, 5.0, 9.0, 6.0 |
| 1_1_1_trichloroethane | 1,1,1-Trichloroethane | 71-55-6 | oral_rfd | 7.0, 2.0 |
| 1_1_difluoroethane | 1,1-Difluoroethane | 75-37-6 | inhalation_rfc | 40.0 |
| 1_2_3_trimethylbenzene | 1,2,3-Trimethylbenzene | 526-73-8 | inhalation_rfc | 0.06, 0.2 |
| 1_2_3_trimethylbenzene | 1,2,3-Trimethylbenzene | 526-73-8 | oral_rfd | 0.04, 0.01 |
| 1_2_4_5_tetrachlorobenzene | 1,2,4,5-Tetrachlorobenzene | 95-94-3 | oral_rfd | 0.00030000000000000003 |
| 1_2_4_tribromobenzene | 1,2,4-Tribromobenzene | 615-54-3 | oral_rfd | 0.005 |
| 1_2_4_trimethylbenzene | 1,2,4-Trimethylbenzene | 95-63-6 | inhalation_rfc | 0.2, 4.0, 3.0, 0.06, 0.08 |
| 1_2_4_trimethylbenzene | 1,2,4-Trimethylbenzene | 95-63-6 | oral_rfd | 0.01, 0.04 |
| 1_2_dichloroethane | 1,2-Dichloroethane | 107-06-2 | oral_slope_factor | 0.091 |
| 1_2_dichloroethane | 1,2-Dichloroethane | 107-06-2 | inhalation_unit_risk | 2.6000000000000002e-05 |
| 1_2_diphenylhydrazine | 1,2-Diphenylhydrazine | 122-66-7 | oral_slope_factor | 0.8 |
| 1_2_diphenylhydrazine | 1,2-Diphenylhydrazine | 122-66-7 | inhalation_unit_risk | 0.00022000000000000003 |
| 1_3_5_trimethylbenzene | 1,3,5-Trimethylbenzene | 108-67-8 | inhalation_rfc | 0.06, 4.0, 0.4, 0.2 |
| 1_3_5_trimethylbenzene | 1,3,5-Trimethylbenzene | 108-67-8 | oral_rfd | 0.01, 0.04 |
| 1_3_5_trinitrobenzene | 1,3,5-Trinitrobenzene | 99-35-4 | oral_rfd | 0.03 |
| 1_4_dibromobenzene | 1,4-Dibromobenzene | 106-37-6 | oral_rfd | 0.01 |
| 1_4_dichlorobenzene | 1,4-Dichlorobenzene | 106-46-7 | inhalation_rfc | 0.8 |
| 1_4_dioxane | 1,4-Dioxane | 123-91-1 | inhalation_rfc | 0.03 |
| 1_4_dioxane | 1,4-Dioxane | 123-91-1 | oral_rfd | 0.03 |
| 1_4_dioxane | 1,4-Dioxane | 123-91-1 | oral_slope_factor | 0.1 |
| 1_4_dioxane | 1,4-Dioxane | 123-91-1 | inhalation_unit_risk | 4.9999999999999996e-06 |
| 1_4_dithiane | 1,4-Dithiane | 505-29-3 | oral_rfd | 0.01 |
| 1_6_hexamethylene_diisocyanate | 1,6-Hexamethylene diisocyanate | 822-06-0 | inhalation_rfc | 1e-05 |
| 2_2_3_3_4_4_5_5_6_6_decabromodiphenyl_ether_bde_209 | 2,2',3,3',4,4',5,5',6,6'-Decabromodiphenyl ether (BDE-209) | 1163-19-5 | oral_rfd | 0.007 |
| 2_2_3_3_4_4_5_5_6_6_decabromodiphenyl_ether_bde_209 | 2,2',3,3',4,4',5,5',6,6'-Decabromodiphenyl ether (BDE-209) | 1163-19-5 | oral_slope_factor | 0.0007 |
| 2_2_4_4_5_5_hexabromodiphenyl_ether_bde_153 | 2,2',4,4',5,5'-Hexabromodiphenyl ether (BDE-153) | 68631-49-2 | oral_rfd | 0.0002 |
| 2_2_4_4_5_pentabromodiphenyl_ether_bde_99 | 2,2',4,4',5-Pentabromodiphenyl ether (BDE-99) | 60348-60-9 | oral_rfd | 0.0001 |
| 2_2_4_4_tetrabromodiphenyl_ether_bde_47 | 2,2',4,4'-Tetrabromodiphenyl ether (BDE-47) | 5436-43-1 | oral_rfd | 0.0001 |
| 2_2_4_5_trichlorophenoxy_propionic_acid_2_4_5_tp | 2(2,4,5-Trichlorophenoxy) propionic acid (2,4,5-TP) | 93-72-1 | oral_rfd | 0.008 |
| 2_2_methyl_4_chlorophenoxy_propionic_acid_mcpp | 2-(2-Methyl-4-chlorophenoxy)propionic acid (MCPP) | 93-65-2 | oral_rfd | 0.001 |
| 2_3_7_8_tetrachlorodibenzo_p_dioxin | 2,3,7,8-Tetrachlorodibenzo-p-dioxin | 1746-01-6 | oral_rfd | 7.000000000000001e-10 |
| 2_3_dichloropropanol | 2,3-Dichloropropanol | 616-23-9 | oral_rfd | 0.003 |
| 2_4_2_6_dinitrotoluene_mixture | 2,4-/2,6-Dinitrotoluene mixture | Various | oral_slope_factor | 0.68 |
| 2_4_2_6_toluene_diisocyanate_mixture_tdi | 2,4-/2,6-Toluene diisocyanate mixture (TDI) | 26471-62-5 | inhalation_rfc | 7.000000000000001e-05 |
| 2_4_5_trichlorophenoxyacetic_acid_2_4_5_t | 2,4,5-Trichlorophenoxyacetic acid (2,4,5-T) | 93-76-5 | oral_rfd | 0.01 |
| 2_4_6_trichlorophenol | 2,4,6-Trichlorophenol | 88-06-2 | oral_slope_factor | 0.011000000000000001 |
| 2_4_6_trichlorophenol | 2,4,6-Trichlorophenol | 88-06-2 | inhalation_unit_risk | 3.1e-06 |
| 2_4_6_trinitrotoluene_tnt | 2,4,6-Trinitrotoluene (TNT) | 118-96-7 | oral_rfd | 0.0005 |
| 2_4_6_trinitrotoluene_tnt | 2,4,6-Trinitrotoluene (TNT) | 118-96-7 | oral_slope_factor | 0.03 |
| 2_4_dichlorophenoxyacetic_acid_2_4_d | 2,4-Dichlorophenoxyacetic acid (2,4-D) | 94-75-7 | oral_rfd | 0.01 |
| 2_4_dinitrotoluene | 2,4-Dinitrotoluene | 121-14-2 | oral_rfd | 0.002 |
| 2_chloroacetophenone | 2-Chloroacetophenone | 532-27-4 | inhalation_rfc | 3.0000000000000004e-05 |
| 2_ethoxyethanol | 2-Ethoxyethanol | 110-80-5 | inhalation_rfc | 0.2 |
| 2_hexanone | 2-Hexanone | 591-78-6 | inhalation_rfc | 0.03 |
| 2_hexanone | 2-Hexanone | 591-78-6 | oral_rfd | 0.005 |
| 2_methoxyethanol | 2-Methoxyethanol | 109-86-4 | inhalation_rfc | 0.02 |
| 2_methyl_4_chlorophenoxyacetic_acid_mcpa | 2-Methyl-4-chlorophenoxyacetic acid (MCPA) | 94-74-6 | oral_rfd | 0.0005 |
| 2_methylnaphthalene | 2-Methylnaphthalene | 91-57-6 | oral_rfd | 0.004 |
| 2_nitropropane | 2-Nitropropane | 79-46-9 | inhalation_rfc | 0.02 |
| 3_3_dichlorobenzidine | 3,3'-Dichlorobenzidine | 91-94-1 | oral_slope_factor | 0.45 |
| 4_2_4_dichlorophenoxy_butyric_acid_2_4_db | 4-(2,4-Dichlorophenoxy)butyric acid (2,4-DB) | 94-82-6 | oral_rfd | 0.008 |
| 4_2_methyl_4_chlorophenoxy_butyric_acid_mcpb | 4-(2-Methyl-4-chlorophenoxy) butyric acid (MCPB) | 94-81-5 | oral_rfd | 0.01 |
| 4_4_methylene_bis_n_n_dimethyl_aniline | 4,4'-Methylene bis(N,N'-dimethyl)aniline | 101-61-1 | oral_slope_factor | 0.046 |
| 4_6_dinitro_o_cyclohexyl_phenol | 4,6-Dinitro-o-cyclohexyl phenol | 131-89-5 | oral_rfd | 0.002 |
| acenaphthene | Acenaphthene | 83-32-9 | oral_rfd | 0.06 |
| acephate | Acephate | 30560-19-1 | oral_rfd | 0.004 |
| acetochlor | Acetochlor | 34256-82-1 | oral_rfd | 0.02 |
| acetophenone | Acetophenone | 98-86-2 | oral_rfd | 0.1 |
| acifluorfen_sodium | Acifluorfen, sodium | 62476-59-9 | oral_rfd | 0.013000000000000001 |
| acrylamide | Acrylamide | 79-06-1 | inhalation_rfc | 0.006 |
| acrylamide | Acrylamide | 79-06-1 | oral_rfd | 0.002 |
| acrylamide | Acrylamide | 79-06-1 | oral_slope_factor | 0.8300000000000001 |
| acrylamide | Acrylamide | 79-06-1 | inhalation_unit_risk | 0.00017 |
| acrylic_acid | Acrylic acid | 79-10-7 | inhalation_rfc | 0.001 |
| acrylic_acid | Acrylic acid | 79-10-7 | oral_rfd | 0.5 |
| alachlor | Alachlor | 15972-60-8 | oral_rfd | 0.01 |
| alar | Alar | 1596-84-5 | oral_rfd | 0.15000000000000002 |
| aldicarb | Aldicarb | 116-06-3 | oral_rfd | 0.001 |
| aldicarb_sulfone | Aldicarb sulfone | 1646-88-4 | oral_rfd | 0.001 |
| aldrin | Aldrin | 309-00-2 | oral_rfd | 3.0000000000000004e-05 |
| aldrin | Aldrin | 309-00-2 | oral_slope_factor | 17.0 |
| aldrin | Aldrin | 309-00-2 | inhalation_unit_risk | 0.004900000000000001 |
| ally | Ally | 74223-64-6 | oral_rfd | 0.25 |
| allyl_alcohol | Allyl alcohol | 107-18-6 | oral_rfd | 0.005 |
| alpha_hexachlorocyclohexane_alpha_hch | alpha-Hexachlorocyclohexane (alpha-HCH) | 319-84-6 | oral_slope_factor | 6.3 |
| alpha_hexachlorocyclohexane_alpha_hch | alpha-Hexachlorocyclohexane (alpha-HCH) | 319-84-6 | inhalation_unit_risk | 0.0018000000000000002 |
| aluminum_phosphide | Aluminum phosphide | 20859-73-8 | oral_rfd | 0.0004 |
| amdro | Amdro | 67485-29-4 | oral_rfd | 0.00030000000000000003 |
| ametryn | Ametryn | 834-12-8 | oral_rfd | 0.009000000000000001 |
| amitraz | Amitraz | 33089-61-1 | oral_rfd | 0.0025 |
| ammonia | Ammonia | 7664-41-7 | inhalation_rfc | 0.5 |
| ammonium_sulfamate | Ammonium sulfamate | 7773-06-0 | oral_rfd | 0.2 |
| aniline | Aniline | 62-53-3 | inhalation_rfc | 0.001 |
| aniline | Aniline | 62-53-3 | oral_slope_factor | 0.0057 |
| antimony_trioxide | Antimony trioxide | 1309-64-4 | inhalation_rfc | 0.0002 |
| apollo | Apollo | 74115-24-5 | oral_rfd | 0.013000000000000001 |
| aramite | Aramite | 140-57-8 | oral_slope_factor | 0.025 |
| aramite | Aramite | 140-57-8 | inhalation_unit_risk | 7.099999999999999e-06 |
| aroclor_1016 | Aroclor 1016 | 12674-11-2 | oral_rfd | 7.000000000000001e-05 |
| arsine | Arsine | 7784-42-1 | inhalation_rfc | 5e-05 |
| asbestos | Asbestos | 1332-21-4 | inhalation_unit_risk | 0.22999999999999998 |
| assure | Assure | 76578-14-8 | oral_rfd | 0.009000000000000001 |
| asulam | Asulam | 3337-71-1 | oral_rfd | 0.05 |
| atrazine | Atrazine | 1912-24-9 | oral_rfd | 0.035 |
| avermectin_b1 | Avermectin B1 | 65195-55-3 | oral_rfd | 0.0004 |
| azobenzene | Azobenzene | 103-33-3 | oral_slope_factor | 0.11000000000000001 |
| azobenzene | Azobenzene | 103-33-3 | inhalation_unit_risk | 3.1e-05 |
| baygon | Baygon | 114-26-1 | oral_rfd | 0.004 |
| bayleton | Bayleton | 43121-43-3 | oral_rfd | 0.03 |
| baythroid | Baythroid | 68359-37-5 | oral_rfd | 0.025 |
| benefin | Benefin | 1861-40-1 | oral_rfd | 0.30000000000000004 |
| benomyl | Benomyl | 17804-35-2 | oral_rfd | 0.05 |
| bentazon_basagran | Bentazon (Basagran) | 25057-89-0 | oral_rfd | 0.03 |
| benzaldehyde | Benzaldehyde | 100-52-7 | oral_rfd | 0.1 |
| benzidine | Benzidine | 92-87-5 | oral_rfd | 0.003 |
| benzidine | Benzidine | 92-87-5 | oral_slope_factor | 229.99999999999997 |
| benzidine | Benzidine | 92-87-5 | inhalation_unit_risk | 0.067 |
| benzoic_acid | Benzoic acid | 65-85-0 | oral_rfd | 4.0 |
| benzotrichloride | Benzotrichloride | 98-07-7 | oral_slope_factor | 13.0 |
| beta_chloronaphthalene | beta-Chloronaphthalene | 91-58-7 | oral_rfd | 0.08 |
| beta_hexachlorocyclohexane_beta_hch | beta-Hexachlorocyclohexane (beta-HCH) | 319-85-7 | oral_slope_factor | 1.8 |
| beta_hexachlorocyclohexane_beta_hch | beta-Hexachlorocyclohexane (beta-HCH) | 319-85-7 | inhalation_unit_risk | 0.00053 |
| bidrin | Bidrin | 141-66-2 | oral_rfd | 0.0001 |
| biphenthrin | Biphenthrin | 82657-04-3 | oral_rfd | 0.015 |
| biphenyl | Biphenyl | 92-52-4 | oral_rfd | 0.5 |
| biphenyl | Biphenyl | 92-52-4 | oral_slope_factor | 0.008 |
| bis_chloroethyl_ether_bcee | Bis(chloroethyl)ether (BCEE) | 111-44-4 | oral_slope_factor | 1.1 |
| bis_chloroethyl_ether_bcee | Bis(chloroethyl)ether (BCEE) | 111-44-4 | inhalation_unit_risk | 0.00033 |
| bis_chloromethyl_ether_bcme | Bis(chloromethyl)ether (BCME) | 542-88-1 | oral_slope_factor | 220.00000000000003 |
| bis_chloromethyl_ether_bcme | Bis(chloromethyl)ether (BCME) | 542-88-1 | inhalation_unit_risk | 0.062000000000000006 |
| bisphenol_a | Bisphenol A | 80-05-7 | oral_rfd | 0.05 |
| bromate | Bromate | 15541-45-4 | oral_rfd | 0.004 |
| bromate | Bromate | 15541-45-4 | oral_slope_factor | 0.7000000000000001 |
| bromoxynil | Bromoxynil | 1689-84-5 | oral_rfd | 0.02 |
| bromoxynil_octanoate | Bromoxynil octanoate | 1689-99-2 | oral_rfd | 0.02 |
| butyl_benzyl_phthalate_bbp | Butyl benzyl phthalate (BBP) | 85-68-7 | oral_rfd | 0.2 |
| butylate | Butylate | 2008-41-5 | oral_rfd | 0.05 |
| butylphthalyl_butylglycolate_bpbg | Butylphthalyl butylglycolate (BPBG) | 85-70-1 | oral_rfd | 1.0 |
| calcium_cyanide | Calcium cyanide | 592-01-8 | oral_rfd | 0.001 |
| caprolactam | Caprolactam | 105-60-2 | oral_rfd | 0.5 |
| captafol | Captafol | 2425-06-1 | oral_rfd | 0.002 |
| captan | Captan | 133-06-2 | oral_rfd | 0.13 |
| carbaryl | Carbaryl | 63-25-2 | oral_rfd | 0.1 |
| carbofuran | Carbofuran | 1563-66-2 | oral_rfd | 0.005 |
| carbosulfan | Carbosulfan | 55285-14-8 | oral_rfd | 0.01 |
| carboxin | Carboxin | 5234-68-4 | oral_rfd | 0.1 |
| cerium_oxide_and_cerium_compounds | Cerium Oxide and Cerium Compounds | 1306-38-3 | inhalation_rfc | 0.0009000000000000001 |
| chloral_hydrate | Chloral hydrate | 302-17-0 | oral_rfd | 0.1 |
| chloramben | Chloramben | 133-90-4 | oral_rfd | 0.015 |
| chlordane_technical | Chlordane (Technical) | 12789-03-6 | inhalation_rfc | 0.0007 |
| chlordane_technical | Chlordane (Technical) | 12789-03-6 | oral_rfd | 0.0005 |
| chlordane_technical | Chlordane (Technical) | 12789-03-6 | oral_slope_factor | 0.35000000000000003 |
| chlordane_technical | Chlordane (Technical) | 12789-03-6 | inhalation_unit_risk | 0.0001 |
| chlordecone_kepone | Chlordecone (Kepone) | 143-50-0 | oral_rfd | 0.00030000000000000003 |
| chlordecone_kepone | Chlordecone (Kepone) | 143-50-0 | oral_slope_factor | 10.0 |
| chlorimuron_ethyl | Chlorimuron-ethyl | 90982-32-4 | oral_rfd | 0.02 |
| chlorine | Chlorine | 7782-50-5 | oral_rfd | 0.1 |
| chlorine_cyanide | Chlorine cyanide | 506-77-4 | oral_rfd | 0.05 |
| chlorine_dioxide | Chlorine dioxide | 10049-04-4 | inhalation_rfc | 0.0002 |
| chlorine_dioxide | Chlorine dioxide | 10049-04-4 | oral_rfd | 0.03 |
| chlorite_sodium_salt | Chlorite (sodium salt) | 7758-19-2 | oral_rfd | 0.03 |
| chlorobenzilate | Chlorobenzilate | 510-15-6 | oral_rfd | 0.02 |
| chlorothalonil | Chlorothalonil | 1897-45-6 | oral_rfd | 0.015 |
| chlorpropham | Chlorpropham | 101-21-3 | oral_rfd | 0.2 |
| chlorsulfuron | Chlorsulfuron | 64902-72-3 | oral_rfd | 0.05 |
| cis_1_2_dichloroethylene | cis-1,2-Dichloroethylene | 156-59-2 | oral_rfd | 0.002 |
| coke_oven_emissions | Coke oven emissions | None | inhalation_unit_risk | 0.00062 |
| copper_cyanide | Copper cyanide | 544-92-3 | oral_rfd | 0.005 |
| cyanide_free | Cyanide, free | 57-12-5 | oral_rfd | 0.00063 |
| cyclohexane | Cyclohexane | 110-82-7 | inhalation_rfc | 6.0 |
| cyclohexanone | Cyclohexanone | 108-94-1 | oral_rfd | 5.0 |
| cyclohexylamine | Cyclohexylamine | 108-91-8 | oral_rfd | 0.2 |
| cyhalothrin_karate | Cyhalothrin/Karate | 68085-85-8 | oral_rfd | 0.005 |
| cypermethrin | Cypermethrin | 52315-07-8 | oral_rfd | 0.01 |
| cyromazine | Cyromazine | 66215-27-8 | oral_rfd | 0.0075 |
| dacthal | Dacthal | 1861-32-1 | oral_rfd | 0.01 |
| dalapon_sodium_salt | Dalapon, sodium salt | 75-99-0 | oral_rfd | 0.03 |
| danitol | Danitol | 39515-41-8 | oral_rfd | 0.025 |
| demeton | Demeton | 8065-48-3 | oral_rfd | 4e-05 |
| di_2_ethylhexyl_adipate | Di(2-ethylhexyl)adipate | 103-23-1 | oral_rfd | 0.6000000000000001 |
| di_2_ethylhexyl_adipate | Di(2-ethylhexyl)adipate | 103-23-1 | oral_slope_factor | 0.0012 |
| dicamba | Dicamba | 1918-00-9 | oral_rfd | 0.03 |
| dichloroacetic_acid | Dichloroacetic acid | 79-43-6 | oral_rfd | 0.004 |
| dichloroacetic_acid | Dichloroacetic acid | 79-43-6 | oral_slope_factor | 0.05 |
| dichlorvos | Dichlorvos | 62-73-7 | inhalation_rfc | 0.0005 |
| dichlorvos | Dichlorvos | 62-73-7 | oral_rfd | 0.0005 |
| dichlorvos | Dichlorvos | 62-73-7 | oral_slope_factor | 0.29 |
| dieldrin | Dieldrin | 60-57-1 | oral_rfd | 5e-05 |
| dieldrin | Dieldrin | 60-57-1 | oral_slope_factor | 16.0 |
| dieldrin | Dieldrin | 60-57-1 | inhalation_unit_risk | 0.0046 |
| diesel_engine_exhaust | Diesel engine exhaust | None | inhalation_rfc | 0.005 |
| diethyl_phthalate_dep | Diethyl phthalate (DEP) | 84-66-2 | oral_rfd | 0.8 |
| difenzoquat | Difenzoquat | 43222-48-6 | oral_rfd | 0.08 |
| diflubenzuron | Diflubenzuron | 35367-38-5 | oral_rfd | 0.02 |
| diisopropyl_methylphosphonate_dimp | Diisopropyl methylphosphonate (DIMP) | 1445-75-6 | oral_rfd | 0.08 |
| dimethipin | Dimethipin | 55290-64-7 | oral_rfd | 0.02 |
| dimethoate | Dimethoate | 60-51-5 | oral_rfd | 0.0002 |
| dimethyl_terephthalate_dmt | Dimethyl terephthalate (DMT) | 120-61-6 | oral_rfd | 0.1 |
| dinoseb | Dinoseb | 88-85-7 | oral_rfd | 0.001 |
| diphenamid | Diphenamid | 957-51-7 | oral_rfd | 0.03 |
| diphenylamine | Diphenylamine | 122-39-4 | oral_rfd | 0.025 |
| diquat | Diquat | 2764-72-9 | oral_rfd | 0.0022 |
| disulfoton | Disulfoton | 298-04-4 | oral_rfd | 4e-05 |
| diuron | Diuron | 330-54-1 | oral_rfd | 0.002 |
| dodine | Dodine | 2439-10-3 | oral_rfd | 0.004 |
| endosulfan | Endosulfan | 115-29-7 | oral_rfd | 0.006 |
| endothall | Endothall | 145-73-3 | oral_rfd | 0.02 |
| endrin | Endrin | 72-20-8 | oral_rfd | 0.00030000000000000003 |
| ethephon | Ethephon | 16672-87-0 | oral_rfd | 0.005 |
| ethion | Ethion | 563-12-2 | oral_rfd | 0.0005 |
| ethyl_p_nitrophenyl_phenylphosphorothioate_epn | Ethyl p-nitrophenyl phenylphosphorothioate (EPN) | 2104-64-5 | oral_rfd | 1e-05 |
| ethyl_tertiary_butyl_ether_etbe | Ethyl Tertiary Butyl Ether (ETBE) | 637-92-3 | inhalation_rfc | 40.0 |
| ethyl_tertiary_butyl_ether_etbe | Ethyl Tertiary Butyl Ether (ETBE) | 637-92-3 | oral_rfd | 1.0 |
| ethyl_tertiary_butyl_ether_etbe | Ethyl Tertiary Butyl Ether (ETBE) | 637-92-3 | inhalation_unit_risk | 8e-05 |
| ethylene_glycol_monobutyl_ether_egbe_2_butoxyethanol | Ethylene glycol monobutyl ether (EGBE) (2-Butoxyethanol) | 111-76-2 | inhalation_rfc | 1.6 |
| ethylene_glycol_monobutyl_ether_egbe_2_butoxyethanol | Ethylene glycol monobutyl ether (EGBE) (2-Butoxyethanol) | 111-76-2 | oral_rfd | 0.1 |
| ethylene_thiourea_etu | Ethylene thiourea (ETU) | 96-45-7 | oral_rfd | 8e-05 |
| ethylphthalyl_ethylglycolate_epeg | Ethylphthalyl ethylglycolate (EPEG) | 84-72-0 | oral_rfd | 3.0 |
| express | Express | 101200-48-0 | oral_rfd | 0.008 |
| fenamiphos | Fenamiphos | 22224-92-6 | oral_rfd | 0.00025 |
| fluometuron | Fluometuron | 2164-17-2 | oral_rfd | 0.013000000000000001 |
| fluorene | Fluorene | 86-73-7 | oral_rfd | 0.04 |
| fluorine_soluble_fluoride | Fluorine (soluble fluoride) | 7782-41-4 | oral_rfd | 0.06 |
| fluridone | Fluridone | 59756-60-4 | oral_rfd | 0.08 |
| flurprimidol | Flurprimidol | 56425-91-3 | oral_rfd | 0.02 |
| flutolanil | Flutolanil | 66332-96-5 | oral_rfd | 0.06 |
| fluvalinate | Fluvalinate | 69409-94-5 | oral_rfd | 0.01 |
| folpet | Folpet | 133-07-3 | oral_rfd | 0.1 |
| fonofos | Fonofos | 944-22-9 | oral_rfd | 0.002 |
| formaldehyde | Formaldehyde | 50-00-0 | inhalation_rfc | 0.007 |
| formaldehyde | Formaldehyde | 50-00-0 | oral_rfd | 0.2 |
| formaldehyde | Formaldehyde | 50-00-0 | inhalation_unit_risk | 1.1000000000000001e-05 |
| fosetyl_al | Fosetyl-al | 39148-24-8 | oral_rfd | 3.0 |
| furfural | Furfural | 98-01-1 | oral_rfd | 0.003 |
| furmecyclox | Furmecyclox | 60568-05-0 | oral_slope_factor | 0.03 |
| glufosinate_ammonium | Glufosinate-ammonium | 77182-82-2 | oral_rfd | 0.0004 |
| glycidaldehyde | Glycidaldehyde | 765-34-4 | oral_rfd | 0.0004 |
| glyphosate | Glyphosate | 1071-83-6 | oral_rfd | 0.1 |
| haloxyfop_methyl | Haloxyfop-methyl | 69806-40-2 | oral_rfd | 5e-05 |
| harmony | Harmony | 79277-27-3 | oral_rfd | 0.013000000000000001 |
| heptachlor | Heptachlor | 76-44-8 | oral_rfd | 0.0005 |
| heptachlor | Heptachlor | 76-44-8 | oral_slope_factor | 4.5 |
| heptachlor | Heptachlor | 76-44-8 | inhalation_unit_risk | 0.0013000000000000002 |
| heptachlor_epoxide | Heptachlor epoxide | 1024-57-3 | oral_rfd | 1.3000000000000001e-05 |
| heptachlor_epoxide | Heptachlor epoxide | 1024-57-3 | oral_slope_factor | 9.1 |
| heptachlor_epoxide | Heptachlor epoxide | 1024-57-3 | inhalation_unit_risk | 0.0026000000000000003 |
| hexabromobenzene | Hexabromobenzene | 87-82-1 | oral_rfd | 0.002 |
| hexachlorodibenzo_p_dioxin_hxcdd_mixture_of_1_2_3_6_7_8_hxcdd_and_1_2_3_7_8_9_hxcdd | Hexachlorodibenzo-p-dioxin (HxCDD), mixture of 1,2,3,6,7,8-HxCDD and 1,2,3,7,8,9-HxCDD | 57653-85-7 | oral_slope_factor | 6200.0 |
| hexachlorodibenzo_p_dioxin_hxcdd_mixture_of_1_2_3_6_7_8_hxcdd_and_1_2_3_7_8_9_hxcdd | Hexachlorodibenzo-p-dioxin (HxCDD), mixture of 1,2,3,6,7,8-HxCDD and 1,2,3,7,8,9-HxCDD | 57653-85-7 | inhalation_unit_risk | 1.3 |
| hexachlorophene | Hexachlorophene | 70-30-4 | oral_rfd | 0.00030000000000000003 |
| hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx | Hexahydro-1,3,5-trinitro-1,3,5-triazine (RDX) | 121-82-4 | oral_rfd | 0.01, 0.0008, 0.004 |
| hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx | Hexahydro-1,3,5-trinitro-1,3,5-triazine (RDX) | 121-82-4 | oral_slope_factor | 0.08 |
| hexazinone | Hexazinone | 51235-04-2 | oral_rfd | 0.033 |
| hydrazine_hydrazine_sulfate | Hydrazine/Hydrazine sulfate | 302-01-2 | oral_slope_factor | 3.0 |
| hydrazine_hydrazine_sulfate | Hydrazine/Hydrazine sulfate | 302-01-2 | inhalation_unit_risk | 0.004900000000000001 |
| hydrogen_chloride | Hydrogen chloride | 7647-01-0 | inhalation_rfc | 0.02 |
| hydrogen_cyanide_and_cyanide_salts | Hydrogen Cyanide and Cyanide Salts | Various | inhalation_rfc | 0.0008 |
| hydrogen_cyanide_and_cyanide_salts | Hydrogen Cyanide and Cyanide Salts | Various | oral_rfd | 0.0006000000000000001 |
| hydrogen_sulfide | Hydrogen sulfide | 7783-06-4 | inhalation_rfc | 0.002 |
| imazalil | Imazalil | 35554-44-0 | oral_rfd | 0.013000000000000001 |
| imazaquin | Imazaquin | 81335-37-7 | oral_rfd | 0.25 |
| iprodione | Iprodione | 36734-19-7 | oral_rfd | 0.04 |
| isobutyl_alcohol | Isobutyl alcohol | 78-83-1 | oral_rfd | 0.30000000000000004 |
| isophorone | Isophorone | 78-59-1 | oral_rfd | 0.2 |
| isophorone | Isophorone | 78-59-1 | oral_slope_factor | 0.00095 |
| isopropalin | Isopropalin | 33820-53-0 | oral_rfd | 0.015 |
| isopropyl_methyl_phosphonic_acid_impa | Isopropyl methyl phosphonic acid (IMPA) | 1832-54-8 | oral_rfd | 0.1 |
| isoxaben | Isoxaben | 82558-50-7 | oral_rfd | 0.05 |
| lactofen | Lactofen | 77501-63-4 | oral_rfd | 0.002 |
| linuron | Linuron | 330-55-2 | oral_rfd | 0.002 |
| londax | Londax | 83055-99-6 | oral_rfd | 0.2 |
| m_dinitrobenzene | m-Dinitrobenzene | 99-65-0 | oral_rfd | 0.0001 |
| m_phenylenediamine | m-Phenylenediamine | 108-45-2 | oral_rfd | 0.006 |
| malathion | Malathion | 121-75-5 | oral_rfd | 0.02 |
| maleic_anhydride | Maleic anhydride | 108-31-6 | oral_rfd | 0.1 |
| maleic_hydrazide | Maleic hydrazide | 123-33-1 | oral_rfd | 0.5 |
| maneb | Maneb | 12427-38-2 | oral_rfd | 0.005 |
| mepiquat_chloride | Mepiquat chloride | 24307-26-4 | oral_rfd | 0.03 |
| mercuric_chloride_hgcl2 | Mercuric chloride (HgCl2) | 7487-94-7 | oral_rfd | 0.00030000000000000003 |
| mercury_elemental | Mercury, elemental | 7439-97-6 | inhalation_rfc | 0.00030000000000000003 |
| merphos | Merphos | 150-50-5 | oral_rfd | 3.0000000000000004e-05 |
| merphos_oxide | Merphos oxide | 78-48-8 | oral_rfd | 3.0000000000000004e-05 |
| metalaxyl | Metalaxyl | 57837-19-1 | oral_rfd | 0.06 |
| methamidophos | Methamidophos | 10265-92-6 | oral_rfd | 5e-05 |
| methidathion | Methidathion | 950-37-8 | oral_rfd | 0.001 |
| methomyl | Methomyl | 16752-77-5 | oral_rfd | 0.025 |
| methoxychlor | Methoxychlor | 72-43-5 | oral_rfd | 0.005 |
| methyl_parathion | Methyl parathion | 298-00-0 | oral_rfd | 0.00025 |
| methylene_diphenyl_diisocyanate_monomeric_mdi_and_polymeric_mdi_pmdi | Methylene Diphenyl Diisocyanate (monomeric MDI) and polymeric MDI (PMDI) | 101-68-8 | inhalation_rfc | 0.0006000000000000001 |
| metolachlor | Metolachlor | 51218-45-2 | oral_rfd | 0.15000000000000002 |
| metribuzin | Metribuzin | 21087-64-9 | oral_rfd | 0.025 |
| mirex | Mirex | 2385-85-5 | oral_rfd | 0.0002 |
| molinate | Molinate | 2212-67-1 | oral_rfd | 0.002 |
| monochloramine | Monochloramine | 10599-90-3 | oral_rfd | 0.1 |
| n_butanol | n-Butanol | 71-36-3 | oral_rfd | 0.1 |
| n_n_dimethylformamide | N,N-Dimethylformamide | 68-12-2 | inhalation_rfc | 0.03 |
| n_nitroso_di_n_butylamine | N-Nitroso-di-n-butylamine | 924-16-3 | oral_slope_factor | 5.4 |
| n_nitroso_di_n_butylamine | N-Nitroso-di-n-butylamine | 924-16-3 | inhalation_unit_risk | 0.0016 |
| n_nitroso_n_methylethylamine | N-Nitroso-N-methylethylamine | 10595-95-6 | oral_slope_factor | 22.0 |
| n_nitrosodi_n_propylamine | N-Nitrosodi-N-propylamine | 621-64-7 | oral_slope_factor | 7.0 |
| n_nitrosodiethanolamine | N-Nitrosodiethanolamine | 1116-54-7 | oral_slope_factor | 2.8 |
| n_nitrosodiethylamine | N-Nitrosodiethylamine | 55-18-5 | oral_slope_factor | 150.0 |
| n_nitrosodiethylamine | N-Nitrosodiethylamine | 55-18-5 | inhalation_unit_risk | 0.043 |
| n_nitrosodimethylamine | N-Nitrosodimethylamine | 62-75-9 | oral_slope_factor | 51.0 |
| n_nitrosodimethylamine | N-Nitrosodimethylamine | 62-75-9 | inhalation_unit_risk | 0.013999999999999999 |
| n_nitrosodiphenylamine | N-Nitrosodiphenylamine | 86-30-6 | oral_slope_factor | 0.004900000000000001 |
| n_nitrosopyrrolidine | N-Nitrosopyrrolidine | 930-55-2 | oral_slope_factor | 2.1 |
| n_nitrosopyrrolidine | N-Nitrosopyrrolidine | 930-55-2 | inhalation_unit_risk | 0.00061 |
| naled | Naled | 300-76-5 | oral_rfd | 0.002 |
| napropamide | Napropamide | 15299-99-7 | oral_rfd | 0.1 |
| nickel_refinery_dust | Nickel refinery dust | None | inhalation_unit_risk | 0.00024 |
| nickel_soluble_salts | Nickel, soluble salts | Various | oral_rfd | 0.02 |
| nitrate | Nitrate | 14797-55-8 | oral_rfd | 1.6 |
| nitrite | Nitrite | 14797-65-0 | oral_rfd | 0.1 |
| nitroguanidine | Nitroguanidine | 556-88-7 | oral_rfd | 0.1 |
| norflurazon | Norflurazon | 27314-13-2 | oral_rfd | 0.04 |
| nustar | NuStar | 85509-19-9 | oral_rfd | 0.0007 |
| octabromodiphenyl_ether | Octabromodiphenyl ether | 32536-52-0 | oral_rfd | 0.003 |
| octahydro_1_3_5_7_tetranitro_1_3_5_7_tetrazocine_hmx | Octahydro-1,3,5,7-tetranitro-1,3,5,7-tetrazocine (HMX) | 2691-41-0 | oral_rfd | 0.05 |
| oryzalin | Oryzalin | 19044-88-3 | oral_rfd | 0.05 |
| oxadiazon | Oxadiazon | 19666-30-9 | oral_rfd | 0.005 |
| oxamyl | Oxamyl | 23135-22-0 | oral_rfd | 0.025 |
| oxyfluorfen | Oxyfluorfen | 42874-03-3 | oral_rfd | 0.003 |
| p_chloroaniline | p-Chloroaniline | 106-47-8 | oral_rfd | 0.004 |
| p_p_dichlorodiphenyl_dichloroethane_ddd | p,p'-Dichlorodiphenyl dichloroethane (DDD) | 72-54-8 | oral_slope_factor | 0.24 |
| p_p_dichlorodiphenyldichloroethylene_dde | p,p'-Dichlorodiphenyldichloroethylene (DDE) | 72-55-9 | oral_slope_factor | 0.34 |
| p_p_dichlorodiphenyltrichloroethane_ddt | p,p'-Dichlorodiphenyltrichloroethane (DDT) | 50-29-3 | oral_rfd | 0.0005 |
| p_p_dichlorodiphenyltrichloroethane_ddt | p,p'-Dichlorodiphenyltrichloroethane (DDT) | 50-29-3 | oral_slope_factor | 0.34 |
| p_p_dichlorodiphenyltrichloroethane_ddt | p,p'-Dichlorodiphenyltrichloroethane (DDT) | 50-29-3 | inhalation_unit_risk | 9.7e-05 |
| paclobutrazol | Paclobutrazol | 76738-62-0 | oral_rfd | 0.013000000000000001 |
| paraquat | Paraquat | 1910-42-5 | oral_rfd | 0.0045000000000000005 |
| pendimethalin | Pendimethalin | 40487-42-1 | oral_rfd | 0.04 |
| pentabromodiphenyl_ether | Pentabromodiphenyl ether | 32534-81-9 | oral_rfd | 0.002 |
| pentachloronitrobenzene_pcnb | Pentachloronitrobenzene (PCNB) | 82-68-8 | oral_rfd | 0.003 |
| perchlorate_clo4_and_perchlorate_salts | Perchlorate (ClO4) and Perchlorate Salts | 7790-98-9 | oral_rfd | 0.0007 |
| perfluorobutanoic_acid_pfba | Perfluorobutanoic Acid (PFBA) | 375-22-4 | oral_rfd | 0.01, 0.006, 0.001 |
| perfluorodecanoic_acid_pfda | Perfluorodecanoic Acid (PFDA) | 335-76-2 | oral_rfd | 2e-09, 6e-07, 3e-06, 1e-06 |
| perfluorohexanoic_acid_pfhxa | Perfluorohexanoic Acid (PFHxA) | 307-24-4 | oral_rfd | 0.001, 0.0008, 0.0005, 0.005, 0.0004 |
| phenmedipham | Phenmedipham | 13684-63-4 | oral_rfd | 0.25 |
| phenylmercuric_acetate | Phenylmercuric acetate | 62-38-4 | oral_rfd | 8e-05 |
| phosgene | Phosgene | 75-44-5 | inhalation_rfc | 0.00030000000000000003 |
| phosmet | Phosmet | 732-11-6 | oral_rfd | 0.02 |
| phosphoric_acid | Phosphoric acid | 7664-38-2 | inhalation_rfc | 0.01 |
| phthalic_anhydride | Phthalic anhydride | 85-44-9 | oral_rfd | 2.0 |
| picloram | Picloram | 1918-02-1 | oral_rfd | 0.07 |
| pirimiphos_methyl | Pirimiphos-methyl | 29232-93-7 | oral_rfd | 0.01 |
| polychlorinated_biphenyls_pcbs | Polychlorinated Biphenyls (PCBs) | 1336-36-3 | oral_slope_factor | 2.0 |
| polychlorinated_biphenyls_pcbs | Polychlorinated Biphenyls (PCBs) | 1336-36-3 | inhalation_unit_risk | 0.0001 |
| potassium_cyanide | Potassium cyanide | 151-50-8 | oral_rfd | 0.002 |
| potassium_silver_cyanide | Potassium silver cyanide | 506-61-6 | oral_rfd | 0.005 |
| prochloraz | Prochloraz | 67747-09-5 | oral_rfd | 0.009000000000000001 |
| prochloraz | Prochloraz | 67747-09-5 | oral_slope_factor | 0.15000000000000002 |
| prometon | Prometon | 1610-18-0 | oral_rfd | 0.015 |
| prometryn | Prometryn | 7287-19-6 | oral_rfd | 0.004 |
| pronamide | Pronamide | 23950-58-5 | oral_rfd | 0.075 |
| propachlor | Propachlor | 1918-16-7 | oral_rfd | 0.013000000000000001 |
| propanil | Propanil | 709-98-8 | oral_rfd | 0.005 |
| propargite | Propargite | 2312-35-8 | oral_rfd | 0.02 |
| propargyl_alcohol | Propargyl alcohol | 107-19-7 | oral_rfd | 0.002 |
| propazine | Propazine | 139-40-2 | oral_rfd | 0.02 |
| propham | Propham | 122-42-9 | oral_rfd | 0.02 |
| propiconazole | Propiconazole | 60207-90-1 | oral_rfd | 0.013000000000000001 |
| propionaldehyde | Propionaldehyde | 123-38-6 | inhalation_rfc | 0.008 |
| propylene_glycol_monomethyl_ether_pgme | Propylene glycol monomethyl ether (PGME) | 107-98-2 | inhalation_rfc | 2.0 |
| pursuit | Pursuit | 81335-77-5 | oral_rfd | 0.25 |
| pydrin | Pydrin | 51630-58-1 | oral_rfd | 0.025 |
| quinalphos | Quinalphos | 13593-03-8 | oral_rfd | 0.0005 |
| quinoline | Quinoline | 91-22-5 | oral_slope_factor | 3.0 |
| resmethrin | Resmethrin | 10453-86-8 | oral_rfd | 0.03 |
| rotenone | Rotenone | 83-79-4 | oral_rfd | 0.004 |
| s_ethyl_dipropylthiocarbamate_eptc | S-Ethyl dipropylthiocarbamate (EPTC) | 759-94-4 | oral_rfd | 0.025 |
| savey | Savey | 78587-05-0 | oral_rfd | 0.025 |
| selenious_acid | Selenious acid | 7783-00-8 | oral_rfd | 0.005 |
| sethoxydim | Sethoxydim | 74051-80-2 | oral_rfd | 0.09 |
| silver_cyanide | Silver cyanide | 506-64-9 | oral_rfd | 0.1 |
| simazine | Simazine | 122-34-9 | oral_rfd | 0.005 |
| sodium_azide | Sodium azide | 26628-22-8 | oral_rfd | 0.004 |
| sodium_cyanide | Sodium cyanide | 143-33-9 | oral_rfd | 0.001 |
| sodium_diethyldithiocarbamate | Sodium diethyldithiocarbamate | 148-18-5 | oral_rfd | 0.03 |
| sodium_fluoroacetate | Sodium fluoroacetate | 62-74-8 | oral_rfd | 2e-05 |
| strontium | Strontium | 7440-24-6 | oral_rfd | 0.6000000000000001 |
| strychnine | Strychnine | 57-24-9 | oral_rfd | 0.00030000000000000003 |
| systhane | Systhane | 88671-89-0 | oral_rfd | 0.025 |
| tebuthiuron | Tebuthiuron | 34014-18-1 | oral_rfd | 0.07 |
| technical_hexachlorocyclohexane_t_hch | technical Hexachlorocyclohexane (t-HCH) | 608-73-1 | oral_slope_factor | 1.8 |
| technical_hexachlorocyclohexane_t_hch | technical Hexachlorocyclohexane (t-HCH) | 608-73-1 | inhalation_unit_risk | 0.00051 |
| terbacil | Terbacil | 5902-51-2 | oral_rfd | 0.013000000000000001 |
| terbutryn | Terbutryn | 886-50-0 | oral_rfd | 0.001 |
| tert_butyl_alcohol_tba | tert-Butyl Alcohol (tBA) | 75-65-0 | inhalation_rfc | 5.0 |
| tert_butyl_alcohol_tba | tert-Butyl Alcohol (tBA) | 75-65-0 | oral_rfd | 0.4 |
| tert_butyl_alcohol_tba | tert-Butyl Alcohol (tBA) | 75-65-0 | oral_slope_factor | 0.0005 |
| tetrachlorovinphos | Tetrachlorovinphos | 961-11-5 | oral_rfd | 0.03 |
| tetraethyl_lead | Tetraethyl lead | 78-00-2 | oral_rfd | 1e-07 |
| tetraethyldithiopyrophosphate | Tetraethyldithiopyrophosphate | 3689-24-5 | oral_rfd | 0.0005 |
| thiobencarb | Thiobencarb | 28249-77-6 | oral_rfd | 0.01 |
| thiophanate_methyl | Thiophanate-methyl | 23564-05-8 | oral_rfd | 0.08 |
| thiram | Thiram | 137-26-8 | oral_rfd | 0.005 |
| toxaphene | Toxaphene | 8001-35-2 | oral_slope_factor | 1.1 |
| toxaphene | Toxaphene | 8001-35-2 | inhalation_unit_risk | 0.00032 |
| tralomethrin | Tralomethrin | 66841-25-6 | oral_rfd | 0.0075 |
| triallate | Triallate | 2303-17-5 | oral_rfd | 0.013000000000000001 |
| triasulfuron | Triasulfuron | 82097-50-5 | oral_rfd | 0.01 |
| tributyltin_oxide_tbto | Tributyltin oxide (TBTO) | 56-35-9 | oral_rfd | 0.00030000000000000003 |
| trichloroacetic_acid | Trichloroacetic acid | 76-03-9 | oral_rfd | 0.02 |
| trichloroacetic_acid | Trichloroacetic acid | 76-03-9 | oral_slope_factor | 0.07 |
| tridiphane | Tridiphane | 58138-08-2 | oral_rfd | 0.003 |
| trifluralin | Trifluralin | 1582-09-8 | oral_rfd | 0.0075 |
| trifluralin | Trifluralin | 1582-09-8 | oral_slope_factor | 0.0077 |
| uranium_soluble_salts | Uranium, soluble salts | Various | oral_rfd | 0.003 |
| vanadium_pentoxide | Vanadium pentoxide | 1314-62-1 | oral_rfd | 0.009000000000000001 |
| vernam | Vernam | 1929-77-7 | oral_rfd | 0.001 |
| vinclozolin | Vinclozolin | 50471-44-8 | oral_rfd | 0.025 |
| warfarin | Warfarin | 81-81-2 | oral_rfd | 0.00030000000000000003 |
| white_phosphorus | White phosphorus | 7723-14-0 | oral_rfd | 2e-05 |
| zineb | Zineb | 12122-67-7 | oral_rfd | 0.05 |

## DATA-QUALITY flagged (excluded; cell unit contradicts its type)

The EPA cell's own unit string disagrees with its TOXICITY VALUE TYPE column
(e.g. an Oral Slope Factor whose unit is the non-reciprocal 'mg/kg-day'). These
are excluded from generation and reported for owner/HITL inspection -- never coerced.

| EPA chemical | CASRN | type | raw value | cell unit |
|---|---|---|---|---|
| 1,2-Dibromoethane | 106-93-4 | Oral Slope Factor | 1 mg/kg-day | mg/kg-day |
| Libby Amphibole Asbestos | 1318-09-8 | RfC | 9 x 10 -5 fiber/cc | fiber/cc |
| Libby Amphibole Asbestos | 1318-09-8 | Inhalation Unit Risk | 1.7 x 10 -1 per fiber/cc | per fiber/cc |

## Next step (owner gate)

Confirm: (1) scope -- all orphans / a subset / a bounded pilot; (2) the AMBIGUOUS
adjudications above. Then Phase B extends the EPA snapshot, builds an orphan staging
pass, and runs `generate-catalog-records.mjs` (units normalized fail-closed; every
value validated vs the EPA snapshot at 2%).
