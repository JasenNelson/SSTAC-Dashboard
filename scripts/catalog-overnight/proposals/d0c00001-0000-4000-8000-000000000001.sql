-- =====================================================================
-- Catalog staging proposals -- paste into the Supabase Studio SQL Editor.
-- Generated from: d0c00001-0000-4000-8000-000000000001.json
-- Proposal rows: 27
--
-- These INSERTs target ONLY public.catalog_extraction_staging. Every row
-- lands with hitl_status = 'pending'. Nothing is promoted to a production
-- table here. After pasting, review each row in the CatalogStagingReview
-- UI (admin) and approve the ones you accept; approval calls
-- catalog_approve_staging_row(id, notes), which promotes the payload into
-- the target table (promoted_parameter_values / catalog_evidence_items /
-- source_lead_triage) under your HITL authority. AI never approves.
-- =====================================================================

BEGIN;

-- Row 1: source_lead: protocol1-hhtrv-p28-ch8 | excerpt="The ministry requires the consideration of human health TRVs as listed in Pro..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249141+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-hhtrv-p28-ch8", "short_citation": "Protocol 28 Chapter 8 (human health TRVs for soil and vapour)", "trv_domain": "human_health", "media": "soil_vapour", "preference_tier": "primary", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "The ministry requires the consideration of human health TRVs as listed in Protocol 28, Chapter 8 for soil, and vapour.", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (primary human_health source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 2: source_lead: protocol1-hhtrv-p28-ch5-drinkingwater | excerpt="For drinking water, TRV sources provided in Chapter 5 of Protocol 28 must be ..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249155+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-hhtrv-p28-ch5-drinkingwater", "short_citation": "Protocol 28 Chapter 5 (drinking water TRV sources)", "trv_domain": "human_health", "media": "drinking_water", "preference_tier": "primary", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "For drinking water, TRV sources provided in Chapter 5 of Protocol 28 must be considered.", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (primary human_health source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 3: source_lead: protocol1-ecotrv-soil-ccme-criteria | excerpt="Canadian Council for Ministers of the Environment: Scientific Criteria Docume..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249163+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-soil-ccme-criteria", "short_citation": "CCME: Scientific Criteria Documents for Deriving Soil Guidelines", "trv_domain": "ecological", "media": "soil", "preference_tier": "preferred", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Canadian Council for Ministers of the Environment: Scientific Criteria Documents for Deriving Soil Guidelines", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (preferred ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 4: source_lead: protocol1-ecotrv-soil-usepa-ecossl | excerpt="United States Environmental Protection Agency: Interim Ecological Soil Screen..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249168+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-soil-usepa-ecossl", "short_citation": "US EPA: Interim Ecological Soil Screening Level Documents (Eco-SSL)", "trv_domain": "ecological", "media": "soil", "preference_tier": "preferred", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "United States Environmental Protection Agency: Interim Ecological Soil Screening Level Documents", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (preferred ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 5: source_lead: protocol1-ecotrv-soil-ornl-benchmarks | excerpt="Oak Ridge National Laboratory: Toxicological Benchmarks for Contaminants of P..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249174+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-soil-ornl-benchmarks", "short_citation": "ORNL: Toxicological Benchmarks (soil/litter invertebrates 1997; terrestrial plants 1997)", "trv_domain": "ecological", "media": "soil", "preference_tier": "preferred", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Oak Ridge National Laboratory: Toxicological Benchmarks for Contaminants of Potential Concern for Effects on Soil and Litter Invertebrates and Heterotrophic Process: 1997 Revision; Toxicological Benchmarks for Screening Contaminants of Potential Concern for Effects on Terrestrial Plants: 1997 Revision", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (preferred ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 6: source_lead: protocol1-ecotrv-soil-ontario-moe-2011 | excerpt="Ontario Ministry of Environment: Rationale for the Development of Soil and Gr..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249178+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-soil-ontario-moe-2011", "short_citation": "Ontario MOE: Rationale for Soil and Groundwater Standards in Ontario, 2011", "trv_domain": "ecological", "media": "soil", "preference_tier": "preferred", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Ontario Ministry of Environment: Rationale for the Development of Soil and Groundwater Standards for use at Contaminated Sites in Ontario, 2011", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (preferred ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 7: source_lead: protocol1-ecotrv-water-bc-wqg | excerpt="British Columbia Ministry of Environment and Climate Change Strategy: Approve..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249182+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-water-bc-wqg", "short_citation": "BC ENV: Approved and Working Water Quality Guidelines", "trv_domain": "ecological", "media": "water", "preference_tier": "preferred", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "British Columbia Ministry of Environment and Climate Change Strategy: Approved and Working Water Quality Guidelines", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (preferred ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 8: source_lead: protocol1-ecotrv-water-ccme-ceqg | excerpt="Canadian Council for Ministers of the Environment (CCME): Canadian Environmen..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249185+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-water-ccme-ceqg", "short_citation": "CCME: Canadian Environmental Quality Guidelines", "trv_domain": "ecological", "media": "water", "preference_tier": "preferred", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Canadian Council for Ministers of the Environment (CCME): Canadian Environmental Quality Guidelines", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (preferred ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 9: source_lead: protocol1-ecotrv-water-eccc-feqg | excerpt="Canadian Ministry of the Environment and Climate Change: Federal Environmenta..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249188+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-water-eccc-feqg", "short_citation": "ECCC: Federal Environmental Quality Guidelines (FEQGs)", "trv_domain": "ecological", "media": "water", "preference_tier": "preferred", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Canadian Ministry of the Environment and Climate Change: Federal Environmental Quality Guidelines (FEQGs)", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (preferred ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 10: source_lead: protocol1-ecotrv-sediment-ccme-1999 | excerpt="Canadian Council for Ministers of the Environment, 1999, Environmental Qualit..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249192+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-sediment-ccme-1999", "short_citation": "CCME 1999: Scientific Criteria Documents for Deriving Sediment Guidelines", "trv_domain": "ecological", "media": "sediment", "preference_tier": "preferred", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Canadian Council for Ministers of the Environment, 1999, Environmental Quality Guidelines: Scientific Criteria Documents for Deriving Sediment Guidelines", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (preferred ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 11: source_lead: protocol1-ecotrv-suppl-ornl-rais | excerpt="Oak Ridge National Laboratory: The Risk Assessment Information System, Ecolog..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249196+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-suppl-ornl-rais", "short_citation": "ORNL: Risk Assessment Information System, Ecological Benchmark Tool", "trv_domain": "ecological", "media": "general", "preference_tier": "supplemental", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Oak Ridge National Laboratory: The Risk Assessment Information System, Ecological Benchmark Tool", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (supplemental ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 12: source_lead: protocol1-ecotrv-suppl-usepa-r9-btag | excerpt="United States Environmental Protection Agency, Region 9: Biological Technical..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249200+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-suppl-usepa-r9-btag", "short_citation": "US EPA Region 9: BTAG Recommended TRVs for Mammals and Birds", "trv_domain": "ecological", "media": "wildlife", "preference_tier": "supplemental", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "United States Environmental Protection Agency, Region 9: Biological Technical Assistance Group (BTAG) Recommended Toxicity Reference Values for Mammals and Birds", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (supplemental ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 13: source_lead: protocol1-ecotrv-suppl-ceaeq-qc | excerpt="Centre d Expertise en Analyse Environnementale du Quebec: Valeurs de Referenc..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249203+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-suppl-ceaeq-qc", "short_citation": "CEAEQ Quebec: Valeurs de Reference pour les Recepteurs Terrestres", "trv_domain": "ecological", "media": "wildlife", "preference_tier": "supplemental", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Centre d Expertise en Analyse Environnementale du Quebec: Valeurs de Reference pour les Recepteurs Terrestres", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (supplemental ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 14: source_lead: protocol1-ecotrv-suppl-ccme-tissue-residue | excerpt="CCME: Canadian Tissue Residue Guidelines for the Protection of Wildlife Consu..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249207+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-suppl-ccme-tissue-residue", "short_citation": "CCME: Canadian Tissue Residue Guidelines (wildlife consumers of aquatic biota)", "trv_domain": "ecological", "media": "wildlife", "preference_tier": "supplemental", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "CCME: Canadian Tissue Residue Guidelines for the Protection of Wildlife Consumers of Aquatic Biota", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (supplemental ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 15: source_lead: protocol1-ecotrv-denovo-p28-appendix8 | excerpt="Protocol 28 "2016 Standards Derivation Methods" Appendix 8"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249211+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-denovo-p28-appendix8", "short_citation": "Protocol 28 Appendix 8 (de novo EcoTRV derivation)", "trv_domain": "ecological", "media": "general", "preference_tier": "de_novo", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Protocol 28 \"2016 Standards Derivation Methods\" Appendix 8", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (de_novo ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 16: source_lead: protocol1-ecotrv-denovo-usepa-ecossl-sop6 | excerpt="United States Environmental Protection Agency: Guidance for Developing Ecolog..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249214+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-denovo-usepa-ecossl-sop6", "short_citation": "US EPA: Eco-SSL SOP #6 Derivation of Wildlife TRV (June 2007)", "trv_domain": "ecological", "media": "wildlife", "preference_tier": "de_novo", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "United States Environmental Protection Agency: Guidance for Developing Ecological Soil Screening Levels (Eco-SSLs), Eco-SSL Standard Operating Procedure #6: Derivation of Wildlife Toxicity Reference Value (TRV) (June 2007)", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (de_novo ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 17: source_lead: protocol1-ecotrv-denovo-eccc-fcsap-module2 | excerpt="Environment and Climate Change Canada: FCSAP Supplemental Guidance for Ecolog..."
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$protocol-01-dra$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249218+00:00$cat$::timestamptz,
    $cat$source_lead$cat$,
    $cat${"lead_set_id": "protocol1-ecotrv-denovo-eccc-fcsap-module2", "short_citation": "ECCC: FCSAP Supplemental Guidance for ERA, Module 2 (site-specific TRVs, June 2010)", "trv_domain": "ecological", "media": "general", "preference_tier": "de_novo", "cited_in": "Protocol 1, section 4.4 (Effects Assessment / TRV selection)", "source_excerpt": "Environment and Climate Change Canada: FCSAP Supplemental Guidance for Ecological Risk Assessment, Module 2: Selection or Development of Site-Specific Toxicity Reference Values (June 2010)", "source_doc_id": "protocol-1-dra"}$cat$::jsonb,
    0.85,
    $cat$TRV source cited in Protocol 1 (de_novo ecological source). Candidate for source_lead_triage; owner triages promote/dismiss/defer.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 18: parameter_value: Benzo[a]pyrene oral TDI - Health Canada | value=3.0E-04 | excerpt="3.0E-04 mg/kgBW-day"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249225+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-bap-hh-direct-rfd-tdi", "substance_key": "benzo_a_pyrene", "pathway": "human-health-direct", "input_key": "rfd_oral_mg_per_kg_bw_day", "display_name": "Benzo[a]pyrene oral TDI - Health Canada", "value": "3.0E-04", "unit": "mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-direct__benzo_a_pyrene__rfd_oral_mg_per_kg_bw_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral TDI, PDF page 19", "source_excerpt": "3.0E-04 mg/kgBW-day", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.5,
    $cat$DISCREPANCY_RECORDED_NO_PROMOTION: Non-cancer endpoint; HC TDI 3.0E-04 matches IRIS RfD 3E-04, but BaP cancer slope factors conflict (Protocol 28 SFO 7.3 vs IRIS 2 vs HC 1.289). Pathway/ADAF review required before default use.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 19: parameter_value: Benzo[a]pyrene oral slope factor - Health Canada | value=1.289E+00 | excerpt="1.289E+00 (mg/kgBW-day)-1"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249231+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-bap-hh-direct-sf", "substance_key": "benzo_a_pyrene", "pathway": "human-health-direct", "input_key": "sf_oral_per_mg_per_kg_bw_per_day", "display_name": "Benzo[a]pyrene oral slope factor - Health Canada", "value": "1.289E+00", "unit": "per mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-direct__benzo_a_pyrene__sf_oral_per_mg_per_kg_bw_per_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral SF, PDF page 19", "source_excerpt": "1.289E+00 (mg/kgBW-day)-1", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.5,
    $cat$DISCREPANCY_RECORDED_NO_PROMOTION: HC SF 1.289 differs from Protocol 28 Appendix 8A SFO 7.30 and current IRIS oral SF 2 (adult-only 1). HC recommends ADAF for early-life. BC policy decision needed on which source controls (crystallized P28 vs current IRIS/HC).$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 20: parameter_value: Benzo[a]pyrene oral TDI - Health Canada | value=3.0E-04 | excerpt="3.0E-04 mg/kgBW-day"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249236+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-bap-hh-food-rfd-tdi", "substance_key": "benzo_a_pyrene", "pathway": "human-health-food", "input_key": "rfd_oral_mg_per_kg_bw_day", "display_name": "Benzo[a]pyrene oral TDI - Health Canada", "value": "3.0E-04", "unit": "mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-food__benzo_a_pyrene__rfd_oral_mg_per_kg_bw_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral TDI, PDF page 19", "source_excerpt": "3.0E-04 mg/kgBW-day", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.5,
    $cat$DISCREPANCY_RECORDED_NO_PROMOTION: Same non-cancer RfD as the direct-contact block; food-web pathway adds species-group applicability question. Cancer SF discrepancy (P28 7.3 vs IRIS 2 vs HC 1.289) unresolved.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 21: parameter_value: Benzo[a]pyrene oral slope factor - Health Canada | value=1.289E+00 | excerpt="1.289E+00 (mg/kgBW-day)-1"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249240+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-bap-hh-food-sf", "substance_key": "benzo_a_pyrene", "pathway": "human-health-food", "input_key": "sf_oral_per_mg_per_kg_bw_per_day", "display_name": "Benzo[a]pyrene oral slope factor - Health Canada", "value": "1.289E+00", "unit": "per mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-food__benzo_a_pyrene__sf_oral_per_mg_per_kg_bw_per_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral SF, PDF page 19", "source_excerpt": "1.289E+00 (mg/kgBW-day)-1", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.5,
    $cat$DISCREPANCY_RECORDED_NO_PROMOTION: Food-web context. HC SF 1.289 does not match Protocol 28 SFO 7.30; IRIS discrepancy and ADAF applicability block default promotion.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 22: parameter_value: Arsenic oral slope factor - Health Canada | value=1.8E+00 | excerpt="1.8E+00 (mg/kgBW-day)-1"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249245+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-arsenic-hh-direct-sf", "substance_key": "arsenic_inorganic", "pathway": "human-health-direct", "input_key": "sf_oral_per_mg_per_kg_bw_per_day", "display_name": "Arsenic oral slope factor - Health Canada", "value": "1.8E+00", "unit": "per mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-direct__arsenic_inorganic__sf_oral_per_mg_per_kg_bw_per_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, Arsenic (inorganic), Oral SF, PDF page 17", "source_excerpt": "1.8E+00 (mg/kgBW-day)-1", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.5,
    $cat$DISCREPANCY_RECORDED_NO_PROMOTION: Three-way conflict: HC SF 1.8 vs Protocol 28 SFO 1.50 vs current IRIS SF 32. IRIS RfD 6.0E-05 (updated 2025-01-13) is lower than P28 RfD 3.00E-04. HC notes SF under review. BC policy intent decision required.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 23: parameter_value: Arsenic oral slope factor - Health Canada | value=1.8E+00 | excerpt="1.8E+00 (mg/kgBW-day)-1"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249280+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-arsenic-hh-food-sf", "substance_key": "arsenic_inorganic", "pathway": "human-health-food", "input_key": "sf_oral_per_mg_per_kg_bw_per_day", "display_name": "Arsenic oral slope factor - Health Canada", "value": "1.8E+00", "unit": "per mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-food__arsenic_inorganic__sf_oral_per_mg_per_kg_bw_per_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, Arsenic (inorganic), Oral SF, PDF page 17", "source_excerpt": "1.8E+00 (mg/kgBW-day)-1", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.5,
    $cat$DISCREPANCY_RECORDED_NO_PROMOTION: Same three-way source conflict as the direct-contact block (HC 1.8 vs P28 1.50 vs IRIS 32). Food-web pathway does not resolve the source discrepancy.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 24: parameter_value: Non-dioxin-like PCBs oral TDI - Health Canada | value=1.0E-05 | excerpt="1.0E-05 mg/kgBW-day (based on an Aroclor 1254 mixture)"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249296+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-pcb-hh-direct-rfd-nondioxin", "substance_key": "total_pcbs_aroclor_1254", "pathway": "human-health-direct", "input_key": "rfd_oral_mg_per_kg_bw_day", "display_name": "Non-dioxin-like PCBs oral TDI - Health Canada", "value": "1.0E-05", "unit": "mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-direct__total_pcbs_aroclor_1254__rfd_oral_mg_per_kg_bw_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, PCBs non-dioxin-like, Oral TDI, PDF page 40", "source_excerpt": "1.0E-05 mg/kgBW-day (based on an Aroclor 1254 mixture)", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.4,
    $cat$AMBIGUOUS_MAPPING_NO_PROMOTION: Protocol 28 total-PCBs RfD 1.30E-04 does not match HC non-dioxin-like TDI 1.0E-05 (Aroclor 1254, provisional). IRIS gives no total-PCBs RfD. Mapping ambiguity: total vs Aroclor vs non-dioxin-like vs dioxin-like (TEQ). Substance-mapping decision required.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 25: parameter_value: Non-dioxin-like PCBs oral TDI - Health Canada | value=1.0E-05 | excerpt="1.0E-05 mg/kgBW-day (based on an Aroclor 1254 mixture)"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249305+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-pcb-hh-food-rfd-nondioxin", "substance_key": "total_pcbs_aroclor_1254", "pathway": "human-health-food", "input_key": "rfd_oral_mg_per_kg_bw_day", "display_name": "Non-dioxin-like PCBs oral TDI - Health Canada", "value": "1.0E-05", "unit": "mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-food__total_pcbs_aroclor_1254__rfd_oral_mg_per_kg_bw_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, PCBs non-dioxin-like, Oral TDI, PDF page 40", "source_excerpt": "1.0E-05 mg/kgBW-day (based on an Aroclor 1254 mixture)", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.4,
    $cat$AMBIGUOUS_MAPPING_NO_PROMOTION: Same mapping ambiguity as the direct-contact block; food-web pathway additionally requires dioxin-like vs non-dioxin-like and fish/shellfish bioaccumulation applicability mapping.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 26: parameter_value: Zinc oral UL - Health Canada child (5 to <12 yrs) | value=5.1E-01 | excerpt="5.1E-01 mg/kgBW-day for 5 to <12 yrs"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249315+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-zinc-hh-direct-ul-child", "substance_key": "zinc", "pathway": "human-health-direct", "input_key": "rfd_oral_mg_per_kg_bw_day", "display_name": "Zinc oral UL - Health Canada child (5 to <12 yrs)", "value": "5.1E-01", "unit": "mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-direct__zinc__rfd_oral_mg_per_kg_bw_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, Zinc, UL age-band values, PDF page 51", "source_excerpt": "5.1E-01 mg/kgBW-day for 5 to <12 yrs", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.7,
    $cat$DIRECT_SOURCE_MATCH_NO_PROMOTION: IRIS RfD 0.3 matches Protocol 28 3.00E-01 after notation normalization, but HC v4.0 uses age-banded ULs (child 5.1E-01), not a single hazard-based RfD. Essential-trace-element structure should not be collapsed without an explicit receptor/age decision.$cat$,
    $cat$claude-opus-4-8$cat$
);

-- Row 27: parameter_value: Zinc oral UL - Health Canada adult (>=20 yrs) | value=5.7E-01 | excerpt="5.7E-01 mg/kgBW-day for >=20 years"
INSERT INTO public.catalog_extraction_staging (source_zotero_key, source_attachment_path, extraction_pass_id, extraction_pass_started_at, extraction_pass_finished_at, extracted_at, proposed_kind, proposed_payload, confidence, extraction_notes, extraction_model)
VALUES (
    $cat$SSESKHQW$cat$,
    NULL,
    $cat$d0c00001-0000-4000-8000-000000000001$cat$::uuid,
    $cat$2026-05-29T02:04:17.249115+00:00$cat$::timestamptz,
    NULL,
    $cat$2026-05-29T02:04:17.249324+00:00$cat$::timestamptz,
    $cat$parameter_value$cat$,
    $cat${"parameter_value_id": "pv-hc-zinc-hh-food-ul-adult", "substance_key": "zinc", "pathway": "human-health-food", "input_key": "rfd_oral_mg_per_kg_bw_day", "display_name": "Zinc oral UL - Health Canada adult (>=20 yrs)", "value": "5.7E-01", "unit": "mg/kgBW-day", "value_type": "single_value", "candidate_group_id": "human-health-food__zinc__rfd_oral_mg_per_kg_bw_day__Canada_federal", "jurisdiction": "Canada_federal", "source_ids": ["src-health-canada-trv-v4-2025"], "locator": "Health Canada TRVs v4.0, Table 1, Zinc, UL age-band values, PDF page 51", "source_excerpt": "5.7E-01 mg/kgBW-day for >=20 years", "source_doc_id": "src-health-canada-trv-v4-2025"}$cat$::jsonb,
    0.7,
    $cat$DIRECT_SOURCE_MATCH_NO_PROMOTION: IRIS/Protocol 28 single RfD 0.3 does not match HC adult UL 5.7E-01. Essential-trace-element methodology (age bands, acceptable-intake ranges) differs from a hazard-based RfD; food-web pathway adds fish-consumption considerations for sensitive populations.$cat$,
    $cat$claude-opus-4-8$cat$
);

COMMIT;
