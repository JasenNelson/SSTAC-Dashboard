// AUTO-DESIGNED compact catalog fixture for EvidenceLibrary.test.tsx.
//
// PURPOSE: EvidenceLibrary renders the FULL live reference catalog on every test. After a
// promotion the catalog grew ~5.6x (human_health_trv_values.json alone is 1577 rows), pushing
// this test file to ~10.7 min locally and ~20 min on CI, with one test timing out at the CI
// 60s per-test cap. This module is a COMPACT, representative fixture that the test mocks in for
// '@/lib/matrix-options/provenance/catalog', bounding everything the component + library.ts
// read (PARAMETER_VALUE_RECORDS, SOURCE_RECORDS, EQUATION_RECORDS, SOURCE_LEAD_SETS and the
// getter helpers). The REAL audit / filter / default-selection-policy / saved-views logic is
// UNCHANGED -- only the DATA is small. Every row exists to reproduce a state an existing
// assertion checks (see the per-row notes below and the test file).
//
// Records are trimmed verbatim copies of real catalog rows (sources.json,
// parameter_values.json, human_health_trv_values.json, equations.json) plus one added
// IRIS-backed BaP food-web RfD row so the "Extracted 2026-05-23" test sees both a Health
// Canada and a US EPA IRIS approved BaP human-health-food source. Plain ASCII only.
import type {
  EquationRecord,
  ParameterValueRecord,
  SourceRecord,
} from '@/lib/matrix-options/provenance/types';

export const FIXTURE_PARAMETER_VALUE_RECORDS: ParameterValueRecord[] =
[
  {
    "parameter_value_id": "pv-bap-logkow",
    "substance_key": "benzo_a_pyrene",
    "pathway": "eco-direct-eqp",
    "input_key": "logKow",
    "display_name": "Benzo[a]pyrene log Kow",
    "value": 6.13,
    "unit": "unitless",
    "value_type": "single_value",
    "default_status": "current_default",
    "extraction_status": "extracted_from_current_calculator",
    "qa_status": "needs_review",
    "source_ids": [
      "src-us-epa-esb-tier2-nonionic-organics-2008"
    ],
    "equation_ids": [
      "eq-eco-direct-eqp-di-toro"
    ],
    "jurisdiction": "general",
    "applicability": "Non-ionic organic EqP pathway.",
    "uncertainty": null,
    "review_notes": "Starter value from current substance library. Confirm exact ecological EqP source table or physicochemical property database. Do not cite IRIS for this Eco-Direct input; IRIS is human-health TRV context.",
    "evidence_items": [
      {
        "source_id": "src-us-epa-esb-tier2-nonionic-organics-2008",
        "locator": "Current calculator substance library; source page/table pending",
        "value_text": "6.13",
        "extraction_method": "current_calculator_scaffold",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Exact source locator must be confirmed before approval.",
        "evidence_id": "ev-pv-bap-logkow-1",
        "locator_type": "current_calculator"
      }
    ],
    "candidate_group_id": "eco-direct-eqp__benzo_a_pyrene__logKow__general",
    "evidence_support_status": "pending_source_locator"
  },
  {
    "parameter_value_id": "pv-hc-bap-hh-food-sf",
    "substance_key": "benzo_a_pyrene",
    "pathway": "human-health-food",
    "input_key": "sf_oral_per_mg_per_kg_bw_per_day",
    "display_name": "Benzo[a]pyrene oral slope factor - Health Canada",
    "value": 1.289,
    "unit": "per mg/kg-bw/day",
    "value_type": "single_value",
    "default_status": "available_option",
    "evidence_support_status": "approved_source_backed",
    "extraction_status": "extracted_from_source",
    "qa_status": "approved",
    "source_ids": [
      "src-health-canada-trv-v4-2025"
    ],
    "equation_ids": [
      "eq-human-health-food-web"
    ],
    "jurisdiction": "Canada_federal",
    "applicability": "Health Canada oral slope factor for benzo[a]pyrene; cancer oral TRV candidate. ADAF note applies for early-life exposures.",
    "uncertainty": null,
    "evidence_items": [
      {
        "source_id": "src-health-canada-trv-v4-2025",
        "locator": "Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral SF, PDF page 19, web page checked 2026-05-23",
        "value_text": "1.289E+00 (mg/kgBW-day)-1",
        "extraction_method": "manual_source_extraction",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "approved",
        "reviewed_by": "codex",
        "reviewed_at": "2026-05-23",
        "note": "Official Health Canada source; extracted on 2026-05-23. Includes Health Canada ADAF note for early-life exposure assessment.",
        "evidence_id": "ev-pv-hc-bap-hh-food-sf-1",
        "locator_type": "source_table"
      }
    ],
    "review_notes": "Health Canada TRVs v4.0, 2025 Tier 1 human-health TRV candidate extracted on 2026-05-23. Use as read-only source-backed library value until the calculator default-selection policy is owner-approved.",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "canonical_source_status": "direct_source_verified",
    "bc_protocol_alignment": "protocol_1_v5_0_tier_1_government_source",
    "bc_protocol_basis": "Government or regulatory source aligned with the Protocol 1 source hierarchy; BC legal requirements and ministry guidance still control where conflicts exist.",
    "source_crystallization_date": "2025-10-15",
    "source_relationships": [
      {
        "source_id": "src-health-canada-trv-v4-2025",
        "role": "canonical_candidate",
        "note": "Health Canada TRVs v4.0, 2025 is the canonical source for this extracted TRV row; extraction date 2026-05-23."
      }
    ],
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "toxicology endpoint",
      "food web",
      "TRV"
    ],
    "candidate_group_id": "human-health-food__benzo_a_pyrene__sf_oral_per_mg_per_kg_bw_per_day__Canada_federal"
  },
  {
    "parameter_value_id": "pv-p28-bap-hh-food-slope",
    "substance_key": "benzo_a_pyrene",
    "pathway": "human-health-food",
    "input_key": "sf_oral_per_mg_per_kg_bw_per_day",
    "display_name": "Benzo[a]pyrene oral slope factor - Protocol 28 lead",
    "value": 7.3,
    "unit": "per mg/kg-bw/day",
    "value_type": "single_value",
    "default_status": "available_option",
    "extraction_status": "extracted_from_source",
    "qa_status": "needs_review",
    "source_ids": [
      "src-bc-protocol-28-v3-0-2024"
    ],
    "canonical_source_ids": [],
    "compilation_source_ids": [
      "src-bc-protocol-28-v3-0-2024"
    ],
    "equation_ids": [
      "eq-human-health-food-web"
    ],
    "jurisdiction": "BC",
    "applicability": "Protocol 28 Appendix 8A human-health soil TRV lead for benzo(a)pyrene. Candidate only; direct canonical source check is pending before use as a calculator default.",
    "uncertainty": "Protocol 28 crystallization date is 2015-11-30; original-source currentness and exact source locator are pending.",
    "review_notes": "Listed in Protocol 28 Appendix 8A as an SFO for benzo(a)pyrene. Treat Protocol 28 as a policy compilation and source-mining lead, not the canonical scientific source.",
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "toxicology endpoint",
      "food web",
      "Protocol 28 lead"
    ],
    "evidence_items": [
      {
        "source_id": "src-bc-protocol-28-v3-0-2024",
        "locator": "Appendix 8A, PDF page 96, benzo(a)pyrene row",
        "locator_type": "source_table",
        "value_text": "7.30 (mg/kg/d)-1 SFO",
        "extraction_method": "manual_source_extraction",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Original source and current value must be checked directly before promotion.",
        "evidence_id": "ev-pv-p28-bap-hh-food-slope-1"
      }
    ],
    "candidate_group_id": "human-health-food__benzo_a_pyrene__sf_oral_per_mg_per_kg_bw_per_day__BC",
    "evidence_support_status": "pending_source_locator",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "canonical_source_status": "needs_direct_source_check",
    "bc_protocol_alignment": "protocol_1_v5_0_effective_2027_01_15",
    "bc_protocol_basis": "Protocol 28 Appendix 8A provides the compiled value; Protocol 1 v5.0 is the target hierarchy for 2027 standards work.",
    "source_crystallization_date": "2015-11-30",
    "source_relationships": [
      {
        "source_id": "src-bc-protocol-28-v3-0-2024",
        "role": "policy_compilation",
        "note": "BC policy compilation showing a TRV value and source hierarchy; original source pending direct check."
      }
    ]
  },
  {
    "parameter_value_id": "pv-iris-zinc-hh-food-rfd",
    "substance_key": "zinc",
    "pathway": "human-health-food",
    "input_key": "rfd_oral_mg_per_kg_bw_day",
    "display_name": "Zinc oral RfD - IRIS",
    "value": 0.3,
    "unit": "mg/kg-bw/day",
    "value_type": "single_value",
    "default_status": "available_option",
    "evidence_support_status": "approved_source_backed",
    "extraction_status": "extracted_from_source",
    "qa_status": "approved",
    "source_ids": [
      "src-us-epa-iris-rfd-table-live"
    ],
    "equation_ids": [
      "eq-human-health-food-web"
    ],
    "jurisdiction": "US_federal",
    "applicability": "US EPA IRIS oral RfD for zinc and compounds; human-health TRV candidate.",
    "uncertainty": null,
    "evidence_items": [
      {
        "source_id": "src-us-epa-iris-rfd-table-live",
        "locator": "IRIS Advanced Search RfD Toxicity Values, Zinc and Compounds, CASRN 7440-66-6, RfD row, export/table checked 2026-05-23",
        "value_text": "3 x 10 -1 mg/kg-day",
        "extraction_method": "manual_source_extraction",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "approved",
        "reviewed_by": "codex",
        "reviewed_at": "2026-05-23",
        "note": "Official US EPA IRIS table; extracted on 2026-05-23. Owner-provided export was used only as a workbench; reference target remains the live IRIS website.",
        "evidence_id": "ev-pv-iris-zinc-hh-food-rfd-1",
        "locator_type": "source_table"
      }
    ],
    "review_notes": "US EPA IRIS RfD table, live Tier 1 human-health TRV candidate extracted on 2026-05-23. Use as read-only source-backed library value until the calculator default-selection policy is owner-approved.",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "canonical_source_status": "direct_source_verified",
    "bc_protocol_alignment": "protocol_1_v5_0_tier_1_government_source",
    "bc_protocol_basis": "Government or regulatory source aligned with the Protocol 1 source hierarchy; BC legal requirements and ministry guidance still control where conflicts exist.",
    "source_crystallization_date": "2026-05-23",
    "source_relationships": [
      {
        "source_id": "src-us-epa-iris-rfd-table-live",
        "role": "canonical_candidate",
        "note": "US EPA IRIS RfD table, live is the canonical source for this extracted TRV row; extraction date 2026-05-23."
      }
    ],
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "toxicology endpoint",
      "food web",
      "TRV"
    ],
    "candidate_group_id": "human-health-food__zinc__rfd_oral_mg_per_kg_bw_day__US_federal"
  },
  {
    "parameter_value_id": "pv-hc-zinc-hh-food-ul-adult",
    "substance_key": "zinc",
    "pathway": "human-health-food",
    "input_key": "rfd_oral_mg_per_kg_bw_day",
    "display_name": "Zinc oral UL - Health Canada adult",
    "value": 0.57,
    "unit": "mg/kg-bw/day",
    "value_type": "single_value",
    "default_status": "available_option",
    "evidence_support_status": "approved_source_backed",
    "extraction_status": "extracted_from_source",
    "qa_status": "approved",
    "source_ids": [
      "src-health-canada-trv-v4-2025"
    ],
    "equation_ids": [
      "eq-human-health-food-web"
    ],
    "jurisdiction": "Canada_federal",
    "applicability": "Health Canada adult oral UL for zinc; food-web adult TRV candidate.",
    "uncertainty": null,
    "evidence_items": [
      {
        "source_id": "src-health-canada-trv-v4-2025",
        "locator": "Health Canada TRVs v4.0, Table 1, Zinc, UL age-band values, PDF page 51, web page checked 2026-05-23",
        "value_text": "5.7E-01 mg/kgBW-day for >=20 years",
        "extraction_method": "manual_source_extraction",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "approved",
        "reviewed_by": "codex",
        "reviewed_at": "2026-05-23",
        "note": "Official Health Canada source; extracted on 2026-05-23. Zinc values are age-banded ULs, not a single generic RfD.",
        "evidence_id": "ev-pv-hc-zinc-hh-food-ul-adult-1",
        "locator_type": "source_table"
      }
    ],
    "review_notes": "Health Canada TRVs v4.0, 2025 Tier 1 human-health TRV candidate extracted on 2026-05-23. Use as read-only source-backed library value until the calculator default-selection policy is owner-approved.",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "canonical_source_status": "direct_source_verified",
    "bc_protocol_alignment": "protocol_1_v5_0_tier_1_government_source",
    "bc_protocol_basis": "Government or regulatory source aligned with the Protocol 1 source hierarchy; BC legal requirements and ministry guidance still control where conflicts exist.",
    "source_crystallization_date": "2025-10-15",
    "source_relationships": [
      {
        "source_id": "src-health-canada-trv-v4-2025",
        "role": "canonical_candidate",
        "note": "Health Canada TRVs v4.0, 2025 is the canonical source for this extracted TRV row; extraction date 2026-05-23."
      }
    ],
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "toxicology endpoint",
      "food web",
      "TRV"
    ],
    "candidate_group_id": "human-health-food__zinc__rfd_oral_mg_per_kg_bw_day__Canada_federal"
  },
  {
    "parameter_value_id": "pv-p28-zinc-hh-food-rfd",
    "substance_key": "zinc",
    "pathway": "human-health-food",
    "input_key": "rfd_oral_mg_per_kg_bw_day",
    "display_name": "Zinc oral RfD - Protocol 28 lead",
    "value": 0.3,
    "unit": "mg/kg-bw/day",
    "value_type": "single_value",
    "default_status": "available_option",
    "extraction_status": "extracted_from_source",
    "qa_status": "needs_review",
    "source_ids": [
      "src-bc-protocol-28-v3-0-2024"
    ],
    "canonical_source_ids": [],
    "compilation_source_ids": [
      "src-bc-protocol-28-v3-0-2024"
    ],
    "equation_ids": [
      "eq-human-health-food-web"
    ],
    "jurisdiction": "BC",
    "applicability": "Protocol 28 Appendix 8A human-health soil TRV lead for zinc. Candidate only; direct canonical source check is pending before use as a calculator default.",
    "uncertainty": "Protocol 28 crystallization date is 2015-11-30; original-source currentness and exact source locator are pending.",
    "review_notes": "Listed in Protocol 28 Appendix 8A as an RfD for zinc. Treat Protocol 28 as a policy compilation and source-mining lead, not the canonical scientific source.",
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "toxicology endpoint",
      "food web",
      "Protocol 28 lead"
    ],
    "evidence_items": [
      {
        "source_id": "src-bc-protocol-28-v3-0-2024",
        "locator": "Appendix 8A, PDF page 100, zinc row",
        "locator_type": "source_table",
        "value_text": "3.00E-01 mg/kg/d RfD",
        "extraction_method": "manual_source_extraction",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Original source and current value must be checked directly before promotion.",
        "evidence_id": "ev-pv-p28-zinc-hh-food-rfd-1"
      }
    ],
    "candidate_group_id": "human-health-food__zinc__rfd_oral_mg_per_kg_bw_day__BC",
    "evidence_support_status": "pending_source_locator",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "canonical_source_status": "needs_direct_source_check",
    "bc_protocol_alignment": "protocol_1_v5_0_effective_2027_01_15",
    "bc_protocol_basis": "Protocol 28 Appendix 8A provides the compiled value; Protocol 1 v5.0 is the target hierarchy for 2027 standards work.",
    "source_crystallization_date": "2015-11-30",
    "source_relationships": [
      {
        "source_id": "src-bc-protocol-28-v3-0-2024",
        "role": "policy_compilation",
        "note": "BC policy compilation showing a TRV value and source hierarchy; original source pending direct check."
      }
    ]
  },
  {
    "parameter_value_id": "pv-arsenic-hh-food-rfd",
    "substance_key": "arsenic_inorganic",
    "pathway": "human-health-food",
    "input_key": "rfd_oral_mg_per_kg_bw_day",
    "display_name": "Arsenic oral RfD",
    "value": 0.00006,
    "unit": "mg/kg-bw/day",
    "value_type": "single_value",
    "default_status": "current_default",
    "extraction_status": "extracted_from_current_calculator",
    "qa_status": "needs_review",
    "source_ids": [
      "src-current-calculator-design-v1"
    ],
    "equation_ids": [
      "eq-human-health-food-web"
    ],
    "jurisdiction": "general",
    "applicability": "Human food-web non-cancer endpoint scaffold.",
    "uncertainty": "Current calculator scaffold; exact source locator pending.",
    "review_notes": "Current substance-library value. Do not treat as source-approved until exact source locator is confirmed.",
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "toxicology endpoint",
      "food web"
    ],
    "evidence_items": [
      {
        "source_id": "src-current-calculator-design-v1",
        "locator": "Current calculator substance library; source page/table pending",
        "value_text": "0.00006 mg/kg-bw/day",
        "extraction_method": "current_calculator_scaffold",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Exact source locator must be confirmed before approval.",
        "evidence_id": "ev-pv-arsenic-hh-food-rfd-1",
        "locator_type": "current_calculator"
      }
    ],
    "candidate_group_id": "human-health-food__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__general",
    "evidence_support_status": "current_calculator_scaffold"
  },
  {
    "parameter_value_id": "pv-arsenic-hh-direct-rfd",
    "substance_key": "arsenic_inorganic",
    "pathway": "human-health-direct",
    "input_key": "rfd_oral_mg_per_kg_bw_day",
    "display_name": "Arsenic oral RfD",
    "value": 0.00006,
    "unit": "mg/kg-bw/day",
    "value_type": "single_value",
    "default_status": "current_default",
    "extraction_status": "extracted_from_current_calculator",
    "qa_status": "needs_review",
    "source_ids": [
      "src-current-calculator-design-v1"
    ],
    "equation_ids": [
      "eq-human-health-direct-contact"
    ],
    "jurisdiction": "general",
    "applicability": "Human direct-contact non-cancer endpoint scaffold.",
    "uncertainty": "Current calculator scaffold; exact source locator pending.",
    "review_notes": "Current substance-library value. Do not treat as source-approved until exact source locator is confirmed.",
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening child"
    ],
    "species_groups": [],
    "assumption_tags": [
      "toxicology endpoint",
      "direct contact"
    ],
    "evidence_items": [
      {
        "source_id": "src-current-calculator-design-v1",
        "locator": "Current calculator substance library; source page/table pending",
        "value_text": "0.00006 mg/kg-bw/day",
        "extraction_method": "current_calculator_scaffold",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Exact source locator must be confirmed before approval.",
        "evidence_id": "ev-pv-arsenic-hh-direct-rfd-1",
        "locator_type": "current_calculator"
      }
    ],
    "candidate_group_id": "human-health-direct__arsenic_inorganic__rfd_oral_mg_per_kg_bw_day__general",
    "evidence_support_status": "current_calculator_scaffold"
  },
  {
    "parameter_value_id": "pv-pcb-hh-food-bsaf",
    "substance_key": "total_pcbs_aroclor_1254",
    "pathway": "human-health-food",
    "input_key": "bsaf_loc_freshwater",
    "display_name": "Aroclor 1254 freshwater BSAF for human food web",
    "value": 2,
    "unit": "unitless",
    "value_type": "single_value",
    "default_status": "current_default",
    "extraction_status": "extracted_from_current_calculator",
    "qa_status": "needs_review",
    "source_ids": [
      "src-current-calculator-design-v1"
    ],
    "equation_ids": [
      "eq-human-health-food-web"
    ],
    "jurisdiction": "general",
    "applicability": "Human food-web BSAF scaffold.",
    "uncertainty": "Current calculator scaffold; exact source locator pending.",
    "review_notes": "Current substance-library value. Do not treat as source-approved until exact source locator is confirmed.",
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "BSAF",
      "food web"
    ],
    "evidence_items": [
      {
        "source_id": "src-current-calculator-design-v1",
        "locator": "Current calculator substance library; source page/table pending",
        "value_text": "2",
        "extraction_method": "current_calculator_scaffold",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Exact source locator must be confirmed before approval.",
        "evidence_id": "ev-pv-pcb-hh-food-bsaf-1",
        "locator_type": "current_calculator"
      }
    ],
    "candidate_group_id": "human-health-food__total_pcbs_aroclor_1254__bsaf_loc_freshwater__general",
    "evidence_support_status": "current_calculator_scaffold"
  },
  {
    "parameter_value_id": "pv-iris-bap-hh-food-rfd",
    "substance_key": "benzo_a_pyrene",
    "pathway": "human-health-food",
    "input_key": "rfd_oral_mg_per_kg_bw_day",
    "display_name": "Benzo[a]pyrene oral RfD - IRIS",
    "value": 0.0003,
    "unit": "mg/kg-bw/day",
    "value_type": "single_value",
    "default_status": "available_option",
    "evidence_support_status": "approved_source_backed",
    "extraction_status": "extracted_from_source",
    "qa_status": "approved",
    "source_ids": [
      "src-us-epa-iris-rfd-table-live"
    ],
    "equation_ids": [
      "eq-human-health-food-web"
    ],
    "jurisdiction": "US_federal",
    "applicability": "US EPA IRIS oral RfD for benzo[a]pyrene; human-health food-web TRV candidate.",
    "uncertainty": null,
    "evidence_items": [
      {
        "source_id": "src-us-epa-iris-rfd-table-live",
        "locator": "IRIS Advanced Search RfD Toxicity Values, Benzo[a]pyrene, RfD row, export/table checked 2026-05-23",
        "value_text": "3 x 10 -4 mg/kg-day",
        "extraction_method": "manual_source_extraction",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "approved",
        "reviewed_by": "codex",
        "reviewed_at": "2026-05-23",
        "note": "Official US EPA IRIS table; extracted on 2026-05-23.",
        "evidence_id": "ev-pv-iris-bap-hh-food-rfd-1",
        "locator_type": "source_table"
      }
    ],
    "review_notes": "US EPA IRIS RfD table, live Tier 1 human-health TRV candidate extracted on 2026-05-23. Read-only source-backed library value.",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "canonical_source_status": "direct_source_verified",
    "bc_protocol_alignment": "protocol_1_v5_0_tier_1_government_source",
    "bc_protocol_basis": "Government or regulatory source aligned with the Protocol 1 source hierarchy.",
    "source_crystallization_date": "2026-05-23",
    "source_relationships": [
      {
        "source_id": "src-us-epa-iris-rfd-table-live",
        "role": "canonical_candidate",
        "note": "US EPA IRIS RfD table, live is the canonical source for this extracted TRV row; extraction date 2026-05-23."
      }
    ],
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "toxicology endpoint",
      "food web",
      "TRV"
    ],
    "candidate_group_id": "human-health-food__benzo_a_pyrene__rfd_oral_mg_per_kg_bw_day__US_federal"
  }
] as ParameterValueRecord[];

export const FIXTURE_SOURCE_RECORDS: SourceRecord[] =
[
  {
    "source_id": "src-us-epa-esb-tier2-nonionic-organics-2008",
    "short_citation": "US EPA ESB Tier 2 values for nonionic organics, 2008",
    "title": "Procedures for the Derivation of Equilibrium Partitioning Sediment Benchmarks (ESBs) for the Protection of Benthic Organisms: Compendium of Tier 2 Values for Nonionic Organics",
    "year": 2008,
    "publisher": "US Environmental Protection Agency",
    "doi": null,
    "url": "https://semspub.epa.gov/work/10/500006301.pdf",
    "zotero_item_key": "I2YMU9MP",
    "zotero_collection_path": "Sediment Project; References",
    "zotero_attachment_keys": [
      "BLZ4TUYB",
      "AYX4658R"
    ],
    "zotero_status": "linked",
    "external_file_hint": "Zotero attachment filename: 500006301.pdf.",
    "file_storage": "zotero_or_external",
    "notes": "First-batch source candidate for EqP values and nonionic-organics method review. [Source promoted to direct_source_verified + currentness_status current on 2026-06-19 by J. Nelson; the pending / needs_currentness language above is superseded.]",
    "authority_scope": "international-guidance",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "currentness_status": "current",
    "version": null,
    "page_last_modified": null,
    "checked_at": null,
    "conflict_rule": "BC legal requirements, protocols, and ministry guidance supersede US EPA guidance where conflicts exist.",
    "supersedes_source_ids": [],
    "canonical_source_status": "direct_source_verified"
  },
  {
    "source_id": "src-health-canada-trv-v4-2025",
    "short_citation": "Health Canada TRVs v4.0, 2025",
    "title": "Federal contaminated site risk assessment in Canada: Toxicological reference values (TRVs), version 4.0",
    "year": 2025,
    "publisher": "Health Canada",
    "doi": null,
    "url": "https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites/federal-contaminated-site-risk-assessment-canada-part-health-canada-toxicological-reference-values-trvs-chemical-specific-factors.html",
    "zotero_item_key": "SSESKHQW",
    "zotero_collection_path": "Sediment Project; Regulatory_Frameworks",
    "zotero_attachment_keys": [],
    "zotero_status": "linked",
    "external_file_hint": "Zotero metadata-only webpage record added from Health Canada current-guidance queue.",
    "file_storage": "zotero_or_external",
    "notes": "Current Health Canada TRV source for human-health TRVs. Evidence items record exact table/value extraction dates; BC legal requirements and ministry guidance still control where conflicts exist.",
    "authority_scope": "federal-guidance",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "currentness_status": "current",
    "version": "4.0",
    "page_last_modified": "2025-10-15",
    "checked_at": "2026-05-23",
    "conflict_rule": "BC legal requirements, protocols, and ministry guidance supersede federal guidance where conflicts exist.",
    "supersedes_source_ids": [],
    "calculator_source_role": "canonical_candidate",
    "canonical_source_status": "direct_source_verified",
    "bc_protocol_alignment": "protocol_1_v5_0_tier_1_government_source",
    "bc_protocol_basis": "Health Canada is a federal government source aligned with the Protocol 1 source hierarchy for human-health TRVs where BC source requirements do not provide a different controlling value.",
    "source_crystallization_date": "2025-10-15"
  },
  {
    "source_id": "src-bc-protocol-28-v3-0-2024",
    "short_citation": "BC Protocol 28 v3.0, 2024",
    "title": "2016 Standards Derivation Methods",
    "year": 2024,
    "publisher": "Province of British Columbia",
    "doi": null,
    "url": "https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/protocols/p28__jan_2021_revisions_final_signed.pdf",
    "zotero_item_key": "LPZUVAC2",
    "zotero_collection_path": "Sediment Project; Regulatory_Frameworks",
    "zotero_attachment_keys": [
      "HYNUIDR5"
    ],
    "zotero_status": "linked",
    "external_file_hint": "Official BC PDF. Zotero export candidate LPZUVAC2 includes attachment HYNUIDR5 (Protocol 28 for Contaminated Sites.pdf). Use metadata and locators only; do not copy the PDF into the repo.",
    "file_storage": "zotero_or_external",
    "notes": "Policy compilation and source-mining record for TRV candidates in sections 2.6 and 3.3, with value tables in Appendices 8A and 8B. Use Protocol 28 to find BC-aligned values and cited sources; verify the original source directly before approving any calculator value.",
    "authority_scope": "bc-guidance",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "currentness_status": "needs_currentness_check",
    "version": "3.0",
    "page_last_modified": null,
    "checked_at": "2026-05-23",
    "conflict_rule": "Use as a BC policy compilation and source-mining aid. Do not treat Protocol 28 as the canonical scientific source for calculator values when an original Health Canada, US EPA, CCME, or other cited source can be checked directly.",
    "supersedes_source_ids": [],
    "calculator_source_role": "policy_compilation",
    "canonical_source_status": "needs_direct_source_check",
    "bc_protocol_alignment": "protocol_28_v3_0_policy_compilation",
    "bc_protocol_basis": "Protocol 28 sections 2.6 and 3.3 list TRV derivation inputs; Protocol 1 v5.0 is the target hierarchy for standards work effective 2027-01-15.",
    "source_crystallization_date": "2015-11-30"
  },
  {
    "source_id": "src-us-epa-iris-rfd-table-live",
    "short_citation": "US EPA IRIS RfD table, live",
    "title": "Integrated Risk Information System RfD Toxicity Values",
    "year": null,
    "publisher": "US Environmental Protection Agency",
    "doi": null,
    "url": "https://iris.epa.gov/AdvancedSearch/rfd_toxicity_values",
    "zotero_item_key": null,
    "zotero_collection_path": null,
    "zotero_attachment_keys": [],
    "zotero_status": "pending_owner_export",
    "external_file_hint": null,
    "file_storage": "zotero_or_external",
    "notes": "Live IRIS human-health RfD toxicity-value table. Use for human-health oral RfD TRV extraction with the extraction date recorded on each value evidence item; do not cite IRIS as an ecological EqP, FCV, or sediment-benchmark source.",
    "authority_scope": "international-guidance",
    "source_authority_tier": "tier_1_government_or_regulatory",
    "currentness_status": "current",
    "version": null,
    "page_last_modified": null,
    "checked_at": "2026-05-23",
    "conflict_rule": "BC legal requirements, protocols, and ministry guidance supersede US EPA guidance where conflicts exist.",
    "supersedes_source_ids": [],
    "calculator_source_role": "canonical_candidate",
    "canonical_source_status": "direct_source_verified",
    "bc_protocol_alignment": "protocol_1_v5_0_tier_1_government_source",
    "bc_protocol_basis": "US EPA IRIS is a government source in the Protocol 1 hierarchy when BC and Canadian federal sources do not provide the needed value or when used as a supporting Tier 1 source.",
    "source_crystallization_date": "2026-05-23"
  },
  {
    "source_id": "src-current-calculator-design-v1",
    "short_citation": "Current calculator scaffold - not an evidence source",
    "title": "Current Matrix Options calculator scaffold - implementation provenance only",
    "year": 2026,
    "publisher": "SSTAC Dashboard repository",
    "doi": null,
    "url": null,
    "zotero_item_key": null,
    "zotero_collection_path": null,
    "zotero_attachment_keys": [],
    "zotero_status": "not_in_zotero",
    "external_file_hint": ".tmp_calculator_design_v1.md or promoted design doc",
    "file_storage": "repo_metadata_only",
    "notes": "Internal implementation provenance marker only. Do not cite as a scientific or regulatory source; replace with exact Zotero/source locators before approval.",
    "authority_scope": "repo-design",
    "currentness_status": "current",
    "version": null,
    "page_last_modified": null,
    "checked_at": "2026-05-23",
    "conflict_rule": null,
    "supersedes_source_ids": [],
    "calculator_source_role": "implementation_scaffold"
  },
  {
    "source_id": "src-nist-sematech-ehandbook-7-2-6-3",
    "short_citation": "NIST/SEMATECH e-Handbook, section 7.2.6.3",
    "title": "NIST/SEMATECH e-Handbook of Statistical Methods, section 7.2.6.3",
    "year": null,
    "publisher": "NIST/SEMATECH",
    "doi": null,
    "url": "https://www.itl.nist.gov/div898/handbook/prc/section2/prc263.htm",
    "zotero_item_key": null,
    "zotero_collection_path": null,
    "zotero_attachment_keys": [],
    "zotero_status": "pending_owner_export",
    "external_file_hint": null,
    "file_storage": "zotero_or_external",
    "notes": "Used for UTL 95/95 tolerance factor method and lookup-table provenance.",
    "authority_scope": "supporting-science",
    "currentness_status": "needs_currentness_check",
    "version": null,
    "page_last_modified": null,
    "checked_at": null,
    "conflict_rule": "Use as statistical-method support only; BC legal requirements, protocols, and ministry guidance control application.",
    "supersedes_source_ids": []
  },
  {
    "source_id": "src-health-canada-hhra-2023",
    "short_citation": "Health Canada HHRA guidance, 2023",
    "title": "Federal Contaminated Site Risk Assessment in Canada: Supplemental Guidance on Human Health Risk Assessment of Contaminated Sediments: Direct Contact Pathway",
    "year": 2017,
    "publisher": "Health Canada",
    "doi": null,
    "url": "https://publications.gc.ca/site/eng/9.833859/publication.html",
    "zotero_item_key": null,
    "zotero_collection_path": null,
    "zotero_attachment_keys": [],
    "zotero_status": "pending_owner_export",
    "external_file_hint": null,
    "file_storage": "zotero_or_external",
    "notes": "Referenced by current Matrix Options human health and methylmercury starter content.",
    "authority_scope": "federal-guidance",
    "currentness_status": "needs_currentness_check",
    "version": null,
    "page_last_modified": null,
    "checked_at": null,
    "conflict_rule": "BC legal requirements, protocols, and ministry guidance supersede federal guidance where conflicts exist.",
    "supersedes_source_ids": []
  },
  {
    "source_id": "src-health-canada-contaminated-sites-index-current",
    "short_citation": "Health Canada contaminated-sites guidance index",
    "title": "Contaminated sites: Reports and publications",
    "year": 2026,
    "publisher": "Health Canada",
    "doi": null,
    "url": "https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites.html",
    "zotero_item_key": "AURXQTJG",
    "zotero_collection_path": "Sediment Project; Regulatory_Frameworks",
    "zotero_attachment_keys": [],
    "zotero_status": "linked",
    "external_file_hint": "Zotero metadata-only webpage record added from Health Canada current-guidance queue.",
    "file_storage": "zotero_or_external",
    "notes": "Current official federal guidance index. Use to check whether Health Canada guidance records are current before approving values.",
    "authority_scope": "federal-guidance",
    "currentness_status": "current",
    "version": null,
    "page_last_modified": "2026-02-05",
    "checked_at": "2026-05-23",
    "conflict_rule": "BC legal requirements, protocols, and ministry guidance supersede federal guidance where conflicts exist.",
    "supersedes_source_ids": []
  }
] as SourceRecord[];

export const FIXTURE_EQUATION_RECORDS: EquationRecord[] =
[
  {
    "equation_id": "eq-eco-direct-eqp-di-toro",
    "pathway": "eco-direct-eqp",
    "display_name": "Eco-Direct EqP sediment benchmark",
    "equation_latex": "log K_{oc} = 0.00028 + 0.983 log K_{ow}; ESB_{oc} = FCV K_{oc} 10^{-3}; SedS = ESB_{oc} f_{oc}",
    "plain_language": "Estimate organic-carbon partitioning from log Kow, convert a water chronic value to an organic-carbon-normalized sediment benchmark, then scale by sediment organic carbon.",
    "input_keys": [
      "logKow",
      "fcv_ug_per_L",
      "foc",
      "Cs_mg_per_kg"
    ],
    "output_keys": [
      "sedS_mg_per_kg_dry",
      "logKoc",
      "Koc_L_per_kg_OC",
      "ESBoc_mg_per_kg_OC"
    ],
    "unit_notes": "FCV is entered in ug/L and converted by 1e-3 inside the equation.",
    "source_ids": [
      "src-current-calculator-design-v1"
    ],
    "applicability": "Single-substance non-ionic organic pathway. Not valid for methylmercury or divalent metals.",
    "qa_status": "needs_review",
    "review_notes": "Equation matches current derivation implementation. Needs final source-level citation for Di Toro regression and EqP method.",
    "evidence_items": [
      {
        "source_id": "src-current-calculator-design-v1",
        "locator": "Current calculator implementation; source equation citation pending",
        "value_text": "log K_{oc} = 0.00028 + 0.983 log K_{ow}; ESB_{oc} = FCV K_{oc} 10^{-3}; SedS = ESB_{oc} f_{oc}",
        "extraction_method": "current_calculator_scaffold",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Equation behavior matches the current implementation, but source-level citation review is still pending.",
        "evidence_id": "ev-eq-eco-direct-eqp-di-toro-1",
        "locator_type": "current_calculator"
      }
    ],
    "evidence_support_status": "current_calculator_scaffold"
  },
  {
    "equation_id": "eq-human-health-food-web",
    "pathway": "human-health-food",
    "display_name": "Human Health Food Web sediment screen",
    "equation_latex": "C_tissue = targetDose BW / (IR_food BA_o); SedS = C_tissue / BSAF_effective",
    "plain_language": "Derive a protective tissue concentration from the selected dose endpoint and food ingestion rate, then back-calculate a sediment value through the effective BSAF.",
    "input_keys": [
      "rfd_oral_mg_per_kg_bw_day",
      "sf_oral_per_mg_per_kg_bw_per_day",
      "targetRisk",
      "hazardQuotient",
      "BW_kg",
      "IR_food_kg_per_day",
      "ba_oral",
      "bsaf_loc_freshwater",
      "fLipid",
      "foc",
      "ecosystem"
    ],
    "output_keys": [
      "sedS_mg_per_kg_dry",
      "tissueTarget_mg_per_kg",
      "BSAF_effective",
      "M_eco"
    ],
    "unit_notes": "Calculator output is mg/kg dry sediment. Tissue target is mg/kg tissue. Oral slope factor is entered as per mg/kg-bw/day.",
    "source_ids": [
      "src-current-calculator-design-v1"
    ],
    "applicability": "Screening-grade human food-web pathway for fish or shellfish consumption.",
    "qa_status": "needs_review",
    "review_notes": "Formula matches current implementation. Exact guidance locators for food ingestion assumptions, endpoints, and BSAF translation are pending.",
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening adult"
    ],
    "species_groups": [
      "fish or shellfish"
    ],
    "assumption_tags": [
      "food web",
      "fish consumption",
      "BSAF"
    ],
    "evidence_items": [
      {
        "source_id": "src-current-calculator-design-v1",
        "locator": "Current calculator implementation; source equation citation pending",
        "value_text": "C_tissue = targetDose BW / (IR_food BA_o); SedS = C_tissue / BSAF_effective",
        "extraction_method": "current_calculator_scaffold",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Equation behavior matches the current implementation, but source-level citation review is still pending.",
        "evidence_id": "ev-eq-human-health-food-web-1",
        "locator_type": "current_calculator"
      }
    ],
    "evidence_support_status": "current_calculator_scaffold"
  },
  {
    "equation_id": "eq-human-health-direct-contact",
    "pathway": "human-health-direct",
    "display_name": "Human Health Direct Contact sediment screen",
    "equation_latex": "Dose = C_s CF EF ED (IR_sed BA_o + SA AF_sed ABS_d) / (BW AT)",
    "plain_language": "Solve the direct-contact exposure equation for sediment concentration using the available non-cancer and cancer endpoints, then use the lower screening value.",
    "input_keys": [
      "rfd_oral_mg_per_kg_bw_day",
      "sf_oral_per_mg_per_kg_bw_per_day",
      "targetRisk",
      "hazardQuotient",
      "BW_kg",
      "ED_years",
      "EF_days_per_year",
      "AT_cancer_years",
      "IR_sed_mg_per_day",
      "SA_cm2",
      "AF_sed_mg_per_cm2",
      "abs_dermal",
      "ba_oral"
    ],
    "output_keys": [
      "sedS_mg_per_kg_dry",
      "nonCancerSedS",
      "cancerSedS",
      "contactRate_mg_per_day"
    ],
    "unit_notes": "Calculator output is mg/kg dry sediment. Oral slope factor is entered as per mg/kg-bw/day.",
    "source_ids": [
      "src-current-calculator-design-v1"
    ],
    "applicability": "Screening-grade human direct-contact pathway for incidental ingestion plus dermal contact with wet sediment.",
    "qa_status": "needs_review",
    "review_notes": "Formula matches current implementation. Exact guidance locators for exposure defaults and endpoints are pending.",
    "receptor_groups": [
      "human"
    ],
    "population_groups": [
      "screening child"
    ],
    "species_groups": [],
    "assumption_tags": [
      "direct contact",
      "sediment ingestion",
      "dermal contact"
    ],
    "evidence_items": [
      {
        "source_id": "src-current-calculator-design-v1",
        "locator": "Current calculator implementation; source equation citation pending",
        "value_text": "Dose = C_s CF EF ED (IR_sed BA_o + SA AF_sed ABS_d) / (BW AT)",
        "extraction_method": "current_calculator_scaffold",
        "extracted_by": "codex",
        "extracted_at": "2026-05-23",
        "qa_status": "needs_review",
        "reviewed_by": null,
        "reviewed_at": null,
        "note": "Equation behavior matches the current implementation, but source-level citation review is still pending.",
        "evidence_id": "ev-eq-human-health-direct-contact-1",
        "locator_type": "current_calculator"
      }
    ],
    "evidence_support_status": "current_calculator_scaffold"
  }
] as EquationRecord[];

// Raw source-lead sets (the shape library.ts sourceLeadSummary() consumes). Two sets:
// the ACFN WQCIU reference-mining lead and the BC Protocol 28 policy-compilation lead.
export const FIXTURE_SOURCE_LEAD_SETS: unknown[] =
[
  {
    "lead_set_id": "wqciu-reference-leads-2026-05-23",
    "status": "needs_review",
    "created_at": "2026-05-23",
    "created_by": "codex",
    "policy": "metadata_only_no_source_file_copy",
    "source_of_sources_rule": "WQCIU is a reference-mining and Indigenous-use framing source. For calculator values and equations, promote the underlying cited source as canonical unless the record is specifically about WQCIU contextual framing and has an exact locator.",
    "primary_document": {
      "source_id": "src-acfn-wqciu",
      "short_citation": "ACFN WQCIU report",
      "title": "Lower Athabasca Surface Water and Sediment Quality Criteria for Protection of Indigenous Use",
      "calculator_source_role": "reference_mining"
    },
    "document_leads": [
      {
        "doc": "WQCIU Report.pdf"
      }
    ],
    "canonical_source_leads": [
      {
        "source": "underlying cited criteria source"
      }
    ],
    "next_steps": [
      "Verify the original cited source for each WQCIU criterion before any calculator use."
    ]
  },
  {
    "lead_set_id": "bc-protocol28-trv-reference-leads-2026-05-23",
    "status": "needs_review",
    "created_at": "2026-05-23",
    "created_by": "codex",
    "policy": "metadata_only_no_source_file_copy",
    "source_of_sources_rule": "Protocol 28 is a BC policy compilation and TRV source-mining aid. Promote the original cited government or regulatory source after direct currentness, value, unit, applicability, and exact-locator checks; do not approve a calculator value solely because Protocol 28 lists it.",
    "primary_document": {
      "source_id": "src-bc-protocol-28-v3-0-2024",
      "short_citation": "BC Protocol 28 v3.0, 2024",
      "title": "2016 Standards Derivation Methods",
      "calculator_source_role": "policy_compilation"
    },
    "parameter_value_leads": [
      {
        "input_key": "sf_oral_per_mg_per_kg_bw_per_day"
      },
      {
        "input_key": "rfd_oral_mg_per_kg_bw_day"
      }
    ],
    "canonical_source_leads": [
      {
        "source": "original Health Canada / US EPA cited source"
      }
    ],
    "next_steps": [
      "Check the original cited source directly for each Protocol 28 TRV before promotion."
    ]
  }
];
