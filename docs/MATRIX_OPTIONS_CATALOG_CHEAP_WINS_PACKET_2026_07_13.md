# AGY BRIEF 5 -- Catalog Cheap-Wins Decision Packet

## Win 1: benzo_a_pyrene oral RfD
- **Mechanism Justification**: The `benzo_a_pyrene` oral RfD is currently `null` in `src/lib/matrix-options/substanceLibrary.ts`. As seen with recently wired substances like `chlorobenzene` or `barium`, dual-wiring is used: (1) `rfd_oral_mg_per_kg_bw_per_day` is hardcoded in `substanceLibrary.ts` with updated source notes, and (2) the `default_status` of the corresponding rows in `matrix_research/reference_catalog/human_health_trv_values.json` is set to `"current_default"`. Both Health Canada (HC) and US EPA IRIS offer a concordant 0.0003 value. Health Canada is picked to align with the BC Protocol 1 hierarchy defaults.
- **Exact Edits**:
  1. `src/lib/matrix-options/substanceLibrary.ts` (benzo_a_pyrene entry):
     **Before**:
     ```typescript
     rfd_oral_mg_per_kg_bw_per_day: null,
     ```
     **After**:
     ```typescript
     rfd_oral_mg_per_kg_bw_per_day: 0.0003,
     ```
     *(The `sources` and `notes` fields should also be appended to cite "Health Canada TRV v4.0 oral TDI 0.0003 mg/kg-bw/day, pv-hc-bap-hh-direct-rfd-tdi")*
  2. `matrix_research/reference_catalog/human_health_trv_values.json`:
     **Rows**:
     - `pv-hc-bap-hh-direct-rfd-tdi` (value: 0.0003)
     - `pv-hc-bap-hh-food-rfd-tdi` (value: 0.0003)
     **Before**: `"default_status": "available_option"`
     **After**: `"default_status": "current_default"`
- **Coupled Test/Tripwire Edit**: Add both `pv-hc-bap-hh-direct-rfd-tdi` and `pv-hc-bap-hh-food-rfd-tdi` to the `APPROVED_CURRENT_DEFAULT_IDS` array in `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`.
- **Acceptance Check**: The `benzo_a_pyrene` human-health-direct and human-health-food calculators successfully resolve the 0.0003 oral RfD value instead of throwing a null-risk error.
- **OWNER-GATED: catalog mutation -- apply only on owner approval.**

## Win 2: endosulfan_alpha / endosulfan_beta eco-direct-eqp fcv current_default
- **Mechanism Justification**: The `matrix_research/reference_catalog/eco_values.json` catalog currently holds two identically valued candidates (0.056 ug/L) for each isomer: one from EPA ESB-2008 and one from EPA NRWQC-live. I recommend the **NRWQC-live** source (`pv-eco-endosulfan_alpha-direct-fcv-nrwqc` and `pv-eco-endosulfan_beta-direct-fcv-nrwqc`). NRWQC represents the active, continuously updated Clean Water Act Section 304(a) regulatory criteria, making it more recent and authoritative than the static 2008 ESB compendium.
- **Exact Edits**:
  `matrix_research/reference_catalog/eco_values.json`:
  **Rows**:
  - `pv-eco-endosulfan_alpha-direct-fcv-nrwqc` (value: 0.056)
  - `pv-eco-endosulfan_beta-direct-fcv-nrwqc` (value: 0.056)
  **Before**: `"default_status": "available_option"`
  **After**: `"default_status": "current_default"`
  *(The corresponding ESB-2008 rows remain as `available_option`)*
- **Coupled Test/Tripwire Edit**: No hardcoded `current_default` array tripwire exists for these FCV parameters in `library.test.ts` or `catalog.test.ts`, so no test file edits are required beyond ensuring the catalog schemas remain valid. 
- **Acceptance Check**: The `endosulfan_alpha` and `endosulfan_beta` eco-direct-eqp calculators dynamically resolve the 0.056 FCV.
- **OWNER-GATED: catalog mutation -- apply only on owner approval.**
