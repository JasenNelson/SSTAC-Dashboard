-- ADOPTED REFERENCE COPY (read-only) of the DB2 schema for the matrix-map lane.
-- Source: /c/Projects/Regulatory-Review-worktrees/bnrrm-fixes/2026_Database_Development/data_acquisition/bnrrm_extraction/schema/bnrrm_training.sql
-- Source worktree branch bnrrm/fixes-20260421 @ d00a2f66; DB mtime 2026-05-03 12:04.
-- DB2 SHA-256: 73a4aa9ca7ff70446c367f7429a3be611ec8bd01e27daa3d9d6467dd7c3631df
-- Canonical custody: G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-datanrrm_training_DB2_20260503.db
-- Do NOT edit; regenerate from the source if it changes.

-- BN-RRM Training Database Schema
-- Purpose: Store structured data extracted from BC risk assessment PDFs
--         for training Bayesian Network conditional probability tables
-- Created: 2026-03-06
-- Project: SSTAC Dashboard BN-RRM

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- SITES & SPATIAL FRAMEWORK
-- ============================================================================

CREATE TABLE sites (
    site_id         INTEGER PRIMARY KEY,
    registry_id     TEXT UNIQUE,          -- BC SITE registry ID (e.g., '9930')
    name            TEXT NOT NULL,
    latitude        REAL,
    longitude       REAL,
    site_type       TEXT,                 -- 'industrial', 'mining', 'port', 'municipal', etc.
    region          TEXT,                 -- geographic region
    waterbody       TEXT,                 -- associated water body
    waterbody_type  TEXT,                 -- 'marine', 'freshwater', 'estuarine'
    notes           TEXT
);

CREATE TABLE stations (
    station_id      INTEGER PRIMARY KEY,
    site_id         INTEGER NOT NULL REFERENCES sites(site_id),
    name            TEXT NOT NULL,        -- e.g., 'SED06-113'
    station_type    TEXT,                 -- 'near-field', 'far-field', 'reference', 'gradient'
    latitude        REAL,
    longitude       REAL,
    depth_m         REAL,                 -- overlying water depth
    habitat_type    TEXT,                 -- 'subtidal', 'intertidal', 'deep'
    notes           TEXT,
    UNIQUE(site_id, name)
);

CREATE TABLE sampling_events (
    event_id        INTEGER PRIMARY KEY,
    station_id      INTEGER NOT NULL REFERENCES stations(station_id),
    date_sampled    TEXT,                 -- ISO 8601
    media_type      TEXT NOT NULL,        -- 'sediment', 'porewater', 'tissue', 'water'
    pre_remediation INTEGER DEFAULT 1,   -- 1 = pre-remediation, 0 = post
    sampling_method TEXT,                 -- 'Van Veen grab', 'core', 'composite'
    depth_top_cm    REAL,
    depth_bottom_cm REAL,
    notes           TEXT,
    source_table_ref TEXT                 -- TLOAD.1: doc/page/table discriminator
                                          -- for doc-by-doc extracts; NULL for
                                          -- seed-loaded events (legacy semantic)
);

-- ============================================================================
-- LOE 1: CHEMISTRY
-- ============================================================================

CREATE TABLE sediment_chemistry (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES sampling_events(event_id),
    parameter       TEXT NOT NULL,        -- e.g., 'Copper', 'Benzo(a)pyrene', 'Total PAHs'
    parameter_group TEXT,                 -- 'Metal', 'PAH', 'PCB', 'Dioxin/Furan', 'Organotin', 'Other'
    value           REAL,
    unit            TEXT NOT NULL,        -- 'mg/kg', 'ug/kg', 'ng/kg TEQ'
    detection_limit REAL,
    qualifier       TEXT,                 -- '<', 'J', 'U', etc.
    basis           TEXT DEFAULT 'dry',   -- 'dry', 'wet'
    analytical_method TEXT,
    UNIQUE(event_id, parameter)
);

CREATE TABLE porewater_chemistry (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES sampling_events(event_id),
    parameter       TEXT NOT NULL,
    parameter_group TEXT,
    value           REAL,
    unit            TEXT NOT NULL,        -- 'ug/L', 'mg/L'
    detection_limit REAL,
    qualifier       TEXT,
    UNIQUE(event_id, parameter)
);

CREATE TABLE surface_water_chemistry (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES sampling_events(event_id),
    parameter       TEXT NOT NULL,
    parameter_group TEXT,
    value           REAL,
    unit            TEXT NOT NULL,
    detection_limit REAL,
    qualifier       TEXT,
    fraction        TEXT,                 -- 'dissolved', 'total'
    UNIQUE(event_id, parameter, fraction)
);

-- ============================================================================
-- ENVIRONMENTAL MODIFIERS
-- ============================================================================

CREATE TABLE env_modifiers (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES sampling_events(event_id),
    parameter       TEXT NOT NULL,        -- 'TOC', 'AVS', 'SEM', 'Grain_Size_Fines',
                                          -- 'Grain_Size_Sand', 'Grain_Size_Gravel',
                                          -- 'pH', 'Redox', 'Ammonia', 'Sulfide',
                                          -- 'Salinity', 'Temperature'
    value           REAL,
    unit            TEXT NOT NULL,        -- '%', 'umol/g', 'mV', 'mg/L', 'psu', 'C'
    UNIQUE(event_id, parameter)
);

-- ============================================================================
-- LOE 2: TOXICITY
-- ============================================================================

CREATE TABLE toxicity_tests (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES sampling_events(event_id),
    test_type       TEXT NOT NULL,        -- 'amphipod_survival', 'polychaete_survival',
                                          -- 'polychaete_growth', 'bivalve_larval',
                                          -- 'microtox', 'sea_urchin', 'chironomid',
                                          -- 'hyalella', 'mussel_larvae'
    species         TEXT,                 -- e.g., 'Eohaustorius estuarius'
    duration_days   REAL,
    endpoint        TEXT NOT NULL,        -- 'survival', 'growth', 'reproduction',
                                          -- 'normal_development', 'luminescence'
    result          REAL,                 -- % survival, mg dry weight, etc.
    unit            TEXT,                 -- '%', 'mg', 'mg/individual'
    control_result  REAL,
    reference_result REAL,               -- result from reference station
    sig_different   INTEGER,             -- 1 = statistically significant, 0 = not
    stat_test       TEXT,                 -- 'Dunnetts', 't-test', 'Fishers', etc.
    p_value         REAL,
    percent_of_control REAL,             -- result/control * 100
    lc50            REAL,
    ec50            REAL,
    ic25            REAL,
    notes           TEXT
);

-- ============================================================================
-- LOE 3: BENTHIC COMMUNITY
-- ============================================================================

CREATE TABLE benthic_community (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES sampling_events(event_id),
    replicate       INTEGER,
    abundance       INTEGER,
    taxa_richness   INTEGER,
    shannon_h       REAL,                -- Shannon-Wiener H'
    simpson_d       REAL,                -- Simpson's 1-D
    pielous_j       REAL,                -- Pielou's evenness J'
    bray_curtis     REAL,                -- Bray-Curtis dissimilarity to reference
    ept_pct         REAL,                -- % EPT taxa (freshwater)
    oligochaete_pct REAL,
    amphipod_pct    REAL,
    polychaete_pct  REAL,
    mollusc_pct     REAL,
    biomass         REAL,                -- total biomass g/m2
    stress_index    REAL,                -- AMBI or similar
    notes           TEXT
);

CREATE TABLE benthic_taxa (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES sampling_events(event_id),
    replicate       INTEGER,
    taxon_name      TEXT NOT NULL,
    taxon_level     TEXT,                -- 'species', 'genus', 'family', 'order'
    count           INTEGER,
    biomass         REAL,
    life_stage      TEXT,                -- 'adult', 'juvenile', 'intermediate'
    notes           TEXT
);

-- ============================================================================
-- BIOACCUMULATION
-- ============================================================================

CREATE TABLE tissue_residues (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES sampling_events(event_id),
    species         TEXT NOT NULL,        -- e.g., 'Dungeness crab', 'English sole'
    tissue_type     TEXT NOT NULL,        -- 'whole_body', 'muscle', 'hepatopancreas',
                                          -- 'liver', 'gill', 'composite'
    parameter       TEXT NOT NULL,
    parameter_group TEXT,
    value           REAL,
    unit            TEXT NOT NULL,        -- 'mg/kg ww', 'mg/kg dw', 'ng/kg TEQ'
    detection_limit REAL,
    qualifier       TEXT,
    basis           TEXT,                 -- 'wet', 'dry', 'lipid'
    lipid_pct       REAL,
    moisture_pct    REAL,
    bsaf            REAL,                -- biota-sediment accumulation factor
    UNIQUE(event_id, species, tissue_type, parameter)
);

-- ============================================================================
-- RISK ASSESSMENT DOCUMENTS
-- ============================================================================

CREATE TABLE ra_documents (
    doc_id          INTEGER PRIMARY KEY,
    site_id         INTEGER REFERENCES sites(site_id),
    filepath        TEXT,
    filename        TEXT,
    title           TEXT,
    author          TEXT,                 -- consulting firm
    doc_date        TEXT,                 -- ISO 8601
    doc_type        TEXT,                 -- 'HHERA', 'ERA', 'SRA', 'DSI', 'SSI', 'EEM'
    total_pages     INTEGER,
    methodology_types TEXT,              -- JSON array: ["WOE","LOE","SQT","toxicity","community","bioaccumulation"]
    notes           TEXT
);

-- ============================================================================
-- WOE / PROFESSIONAL JUDGMENT
-- ============================================================================

CREATE TABLE loe_assessments (
    id              INTEGER PRIMARY KEY,
    doc_id          INTEGER NOT NULL REFERENCES ra_documents(doc_id),
    station_id      INTEGER REFERENCES stations(station_id),
    loe_type        TEXT NOT NULL,        -- 'chemistry', 'toxicity', 'community',
                                          -- 'tissue_chemistry', 'fish_community'
    loe_code        TEXT,                 -- e.g., 'LoE 2a', 'LoE 2b', 'LoE 2c'
    assigned_rank   TEXT,                 -- 'negligible', 'low', 'moderate', 'high'
                                          -- or '-', '+/-', '+'
    rank_magnitude  TEXT,                 -- 'negligible-to-low', 'moderate-to-high', etc.
    weighting_factor REAL,               -- 1-5 scale
    confidence      TEXT,                 -- 'low', 'moderate', 'high'
    data_quality    REAL,                -- 1-5 scale
    rationale       TEXT,                 -- narrative rationale
    page_ref        INTEGER              -- page number in source doc
);

CREATE TABLE woe_integration (
    id              INTEGER PRIMARY KEY,
    doc_id          INTEGER NOT NULL REFERENCES ra_documents(doc_id),
    station_id      INTEGER REFERENCES stations(station_id),
    receptor        TEXT,                 -- 'benthic_invertebrate', 'fish', 'wildlife'
    scenario        INTEGER,             -- WOE decision matrix scenario (1-8)
    chemistry_rank  TEXT,                 -- '-', '+/-', '+'
    toxicity_rank   TEXT,
    community_rank  TEXT,
    bioaccum_rank   TEXT,
    overall_risk    TEXT,                 -- 'low', 'moderate', 'moderate-to-high', 'high'
    management_action TEXT,              -- 'none required', 'may be required', 'required'
    framework_type  TEXT DEFAULT 'Chapman_Anderson_2005',
                                          -- 'Chapman_Anderson_2005', 'Azimuth_Hybrid',
                                          -- 'Exponent_2011', 'Menzie_Hull_Swanson', etc.
    rationale       TEXT,
    page_ref        INTEGER
);

CREATE TABLE sqt_scores (
    id              INTEGER PRIMARY KEY,
    doc_id          INTEGER NOT NULL REFERENCES ra_documents(doc_id),
    station_id      INTEGER REFERENCES stations(station_id),
    chemistry_score REAL,
    toxicity_score  REAL,
    benthic_score   REAL,
    integrated_score REAL,
    risk_category   TEXT,                -- 'low', 'moderate', 'high'
    method          TEXT,                -- scoring methodology reference
    page_ref        INTEGER
);

-- ============================================================================
-- RISK NARRATIVES & CSM
-- ============================================================================

CREATE TABLE risk_narratives (
    id              INTEGER PRIMARY KEY,
    doc_id          INTEGER NOT NULL REFERENCES ra_documents(doc_id),
    section_type    TEXT,                 -- 'executive_summary', 'risk_characterization',
                                          -- 'uncertainty', 'conclusions', 'recommendations'
    section_number  TEXT,                 -- e.g., '6.4.1'
    page_start      INTEGER,
    page_end        INTEGER,
    extracted_text  TEXT,
    key_findings    TEXT,                 -- condensed findings
    uncertainty_discussion TEXT
);

CREATE TABLE csm_elements (
    id              INTEGER PRIMARY KEY,
    doc_id          INTEGER NOT NULL REFERENCES ra_documents(doc_id),
    source          TEXT,                 -- e.g., 'Pulp mill effluent', 'Historic fill'
    pathway         TEXT,                 -- e.g., 'Direct contact', 'Ingestion', 'Bioaccumulation'
    receptor        TEXT,                 -- e.g., 'Benthic invertebrates', 'Fish', 'Human'
    receptor_type   TEXT,                 -- 'ecological', 'human'
    exposure_route  TEXT,                 -- 'sediment contact', 'dietary', 'dermal'
    media           TEXT,                 -- 'sediment', 'water', 'tissue', 'air'
    complete        INTEGER DEFAULT 1,   -- 1 = pathway complete, 0 = incomplete
    notes           TEXT
);

-- ============================================================================
-- PROVENANCE & QUALITY
-- ============================================================================

CREATE TABLE extraction_provenance (
    id              INTEGER PRIMARY KEY,
    target_table    TEXT NOT NULL,
    target_id       INTEGER NOT NULL,
    doc_id          INTEGER REFERENCES ra_documents(doc_id),
    page_number     INTEGER,
    table_number    TEXT,                 -- e.g., 'Table 3.9', 'Table 6.1'
    figure_number   TEXT,
    extraction_method TEXT,              -- 'docling', 'pymupdf', 'vision', 'manual'
    confidence      REAL,                -- 0-1
    reviewer_verified INTEGER DEFAULT 0, -- 1 = human reviewed
    extraction_date TEXT,
    notes           TEXT
);

-- ============================================================================
-- TLOAD LEGACY EXTRACTION STATUS
-- ============================================================================

CREATE TABLE tload_doc_status (
    status_id       INTEGER PRIMARY KEY,
    doc_id          INTEGER REFERENCES ra_documents(doc_id),
    art_doc_id      TEXT,
    filename        TEXT,
    status          TEXT NOT NULL CHECK (
        status IN (
            'loaded_pre_tload1',
            'legacy_unloaded',
            'reload_candidate',
            'reextract_candidate',
            'manually_parked',
            'legacy_seed',
            'manual_review',
            'loaded',
            'reload_failed',
            'reextract_failed'
        )
    ),
    lane            TEXT,
    reason          TEXT,
    source_bucket   TEXT,
    artifact_path   TEXT,
    artifact_size_bytes INTEGER,
    text_block_count INTEGER,
    mapped_summary_json TEXT,
    classified_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEDIMENT QUALITY GUIDELINES (reference table)
-- ============================================================================

CREATE TABLE sediment_guidelines (
    id              INTEGER PRIMARY KEY,
    parameter       TEXT NOT NULL,
    guideline_name  TEXT NOT NULL,        -- 'CCME_ISQG', 'CCME_PEL', 'BC_CSR_SedQC_TS',
                                          -- 'BC_CSR_SedQC_SS', 'PSDDA'
    value           REAL NOT NULL,
    unit            TEXT NOT NULL,
    source          TEXT,
    year            INTEGER,
    UNIQUE(parameter, guideline_name)
);

-- Pre-populate CCME guidelines
INSERT INTO sediment_guidelines (parameter, guideline_name, value, unit, source, year) VALUES
    ('Copper', 'CCME_ISQG', 18.7, 'mg/kg', 'CCME 1999', 1999),
    ('Copper', 'CCME_PEL', 108, 'mg/kg', 'CCME 1999', 1999),
    ('Zinc', 'CCME_ISQG', 124, 'mg/kg', 'CCME 1999', 1999),
    ('Zinc', 'CCME_PEL', 271, 'mg/kg', 'CCME 1999', 1999),
    ('Lead', 'CCME_ISQG', 30.2, 'mg/kg', 'CCME 1999', 1999),
    ('Lead', 'CCME_PEL', 112, 'mg/kg', 'CCME 1999', 1999),
    ('Cadmium', 'CCME_ISQG', 0.7, 'mg/kg', 'CCME 1999', 1999),
    ('Cadmium', 'CCME_PEL', 4.2, 'mg/kg', 'CCME 1999', 1999),
    ('Mercury', 'CCME_ISQG', 0.13, 'mg/kg', 'CCME 1999', 1999),
    ('Mercury', 'CCME_PEL', 0.7, 'mg/kg', 'CCME 1999', 1999),
    ('Arsenic', 'CCME_ISQG', 7.24, 'mg/kg', 'CCME 1999', 1999),
    ('Arsenic', 'CCME_PEL', 41.6, 'mg/kg', 'CCME 1999', 1999),
    ('Chromium', 'CCME_ISQG', 52.3, 'mg/kg', 'CCME 1999', 1999),
    ('Chromium', 'CCME_PEL', 160, 'mg/kg', 'CCME 1999', 1999),
    ('Naphthalene', 'CCME_ISQG', 34.6, 'ug/kg', 'CCME 1999', 1999),
    ('Naphthalene', 'CCME_PEL', 391, 'ug/kg', 'CCME 1999', 1999),
    ('Fluorene', 'CCME_ISQG', 21.2, 'ug/kg', 'CCME 1999', 1999),
    ('Fluorene', 'CCME_PEL', 144, 'ug/kg', 'CCME 1999', 1999),
    ('Phenanthrene', 'CCME_ISQG', 86.7, 'ug/kg', 'CCME 1999', 1999),
    ('Phenanthrene', 'CCME_PEL', 544, 'ug/kg', 'CCME 1999', 1999),
    ('Anthracene', 'CCME_ISQG', 46.9, 'ug/kg', 'CCME 1999', 1999),
    ('Anthracene', 'CCME_PEL', 245, 'ug/kg', 'CCME 1999', 1999),
    ('Fluoranthene', 'CCME_ISQG', 113, 'ug/kg', 'CCME 1999', 1999),
    ('Fluoranthene', 'CCME_PEL', 1494, 'ug/kg', 'CCME 1999', 1999),
    ('Pyrene', 'CCME_ISQG', 153, 'ug/kg', 'CCME 1999', 1999),
    ('Pyrene', 'CCME_PEL', 1398, 'ug/kg', 'CCME 1999', 1999),
    ('Benz(a)anthracene', 'CCME_ISQG', 74.8, 'ug/kg', 'CCME 1999', 1999),
    ('Benz(a)anthracene', 'CCME_PEL', 693, 'ug/kg', 'CCME 1999', 1999),
    ('Chrysene', 'CCME_ISQG', 108, 'ug/kg', 'CCME 1999', 1999),
    ('Chrysene', 'CCME_PEL', 846, 'ug/kg', 'CCME 1999', 1999),
    ('Benzo(a)pyrene', 'CCME_ISQG', 88.8, 'ug/kg', 'CCME 1999', 1999),
    ('Benzo(a)pyrene', 'CCME_PEL', 763, 'ug/kg', 'CCME 1999', 1999),
    ('Dibenz(a,h)anthracene', 'CCME_ISQG', 6.22, 'ug/kg', 'CCME 1999', 1999),
    ('Dibenz(a,h)anthracene', 'CCME_PEL', 135, 'ug/kg', 'CCME 1999', 1999),
    ('Acenaphthylene', 'CCME_ISQG', 5.87, 'ug/kg', 'CCME 1999', 1999),
    ('Acenaphthylene', 'CCME_PEL', 128, 'ug/kg', 'CCME 1999', 1999),
    ('Acenaphthene', 'CCME_ISQG', 6.71, 'ug/kg', 'CCME 1999', 1999),
    ('Acenaphthene', 'CCME_PEL', 88.9, 'ug/kg', 'CCME 1999', 1999),
    ('Total PAHs', 'CCME_ISQG', 1684, 'ug/kg', 'CCME 1999', 1999),
    ('Total PAHs', 'CCME_PEL', 16770, 'ug/kg', 'CCME 1999', 1999),
    ('Total PCBs', 'CCME_ISQG', 21.5, 'ug/kg', 'CCME 1999', 1999),
    ('Total PCBs', 'CCME_PEL', 189, 'ug/kg', 'CCME 1999', 1999);

-- ============================================================================
-- BN-RRM TRAINING VIEW: Co-located data
-- ============================================================================

CREATE VIEW bn_training_data AS
SELECT
    s.site_id,
    s.registry_id,
    s.name AS site_name,
    st.station_id,
    st.name AS station_name,
    st.station_type,
    se.event_id,
    se.date_sampled,
    se.pre_remediation,
    -- Chemistry (key metals - pivoted)
    MAX(CASE WHEN sc.parameter = 'Copper' THEN sc.value END) AS copper_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Zinc' THEN sc.value END) AS zinc_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Lead' THEN sc.value END) AS lead_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Cadmium' THEN sc.value END) AS cadmium_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Mercury' THEN sc.value END) AS mercury_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Arsenic' THEN sc.value END) AS arsenic_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Chromium' THEN sc.value END) AS chromium_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Total PAHs' THEN sc.value END) AS total_pahs_ug_kg,
    MAX(CASE WHEN sc.parameter = 'Total PCBs' THEN sc.value END) AS total_pcbs_ug_kg,
    -- Modifiers
    MAX(CASE WHEN em.parameter = 'TOC' THEN em.value END) AS toc_pct,
    MAX(CASE WHEN em.parameter = 'AVS' THEN em.value END) AS avs_umol_g,
    MAX(CASE WHEN em.parameter = 'SEM' THEN em.value END) AS sem_umol_g,
    MAX(CASE WHEN em.parameter = 'Grain_Size_Fines' THEN em.value END) AS fines_pct,
    MAX(CASE WHEN em.parameter = 'pH' THEN em.value END) AS ph,
    MAX(CASE WHEN em.parameter = 'Redox' THEN em.value END) AS redox_mv,
    -- Toxicity (key endpoints)
    MAX(CASE WHEN tt.test_type = 'amphipod_survival' THEN tt.result END) AS amphipod_survival_pct,
    MAX(CASE WHEN tt.test_type = 'amphipod_survival' THEN tt.sig_different END) AS amphipod_sig,
    MAX(CASE WHEN tt.test_type = 'polychaete_survival' THEN tt.result END) AS polychaete_survival_pct,
    MAX(CASE WHEN tt.test_type = 'polychaete_growth' THEN tt.result END) AS polychaete_growth_mg,
    MAX(CASE WHEN tt.test_type = 'bivalve_larval' THEN tt.result END) AS bivalve_normal_dev_pct,
    -- Community metrics
    bc.abundance,
    bc.taxa_richness,
    bc.shannon_h,
    bc.simpson_d,
    bc.pielous_j,
    bc.bray_curtis,
    -- WOE integration (if available)
    wi.overall_risk AS woe_risk,
    wi.scenario AS woe_scenario,
    wi.framework_type AS woe_framework
FROM sampling_events se
JOIN stations st ON se.station_id = st.station_id
JOIN sites s ON st.site_id = s.site_id
LEFT JOIN sediment_chemistry sc ON sc.event_id = se.event_id
LEFT JOIN env_modifiers em ON em.event_id = se.event_id
LEFT JOIN toxicity_tests tt ON tt.event_id = se.event_id
LEFT JOIN benthic_community bc ON bc.event_id = se.event_id
LEFT JOIN woe_integration wi ON wi.station_id = st.station_id
WHERE se.media_type = 'sediment'
GROUP BY se.event_id;

-- ============================================================================
-- BN-RRM CONSOLIDATED VIEW: One row per station per campaign
--
-- I-006 FIX (2026-03-08): Groups by (station_id, campaign_year) instead of
-- just station_id. Prevents silent cross-year merging (e.g., Woodfibre
-- 2006 chemistry + 2014 toxicity = 2922-day span, scientifically invalid).
--
-- campaign_year: derived from date_sampled year, or 'unknown' if NULL.
-- temporal_span_days: max date range within each campaign group.
-- colocation_quality: data completeness indicator for training eligibility.
-- event_count: number of sampling events aggregated in this row.
-- has_chemistry/has_toxicity/has_modifiers/has_community: boolean flags.
-- ============================================================================

CREATE VIEW bn_training_consolidated AS
SELECT
    s.site_id,
    s.registry_id,
    s.name AS site_name,
    st.station_id,
    st.name AS station_name,
    st.station_type,
    -- Temporal clustering
    COALESCE(strftime('%Y', se.date_sampled), 'unknown') AS campaign_year,
    MIN(se.date_sampled) AS earliest_sample,
    MAX(se.date_sampled) AS latest_sample,
    CAST(julianday(MAX(se.date_sampled)) - julianday(MIN(se.date_sampled)) AS INTEGER) AS temporal_span_days,
    COUNT(DISTINCT se.event_id) AS event_count,
    MAX(se.pre_remediation) AS pre_remediation,
    -- Chemistry (key metals - pivoted, MAX within campaign)
    MAX(CASE WHEN sc.parameter = 'Copper' THEN sc.value END) AS copper_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Zinc' THEN sc.value END) AS zinc_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Lead' THEN sc.value END) AS lead_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Cadmium' THEN sc.value END) AS cadmium_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Mercury' THEN sc.value END) AS mercury_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Arsenic' THEN sc.value END) AS arsenic_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Chromium' THEN sc.value END) AS chromium_mg_kg,
    MAX(CASE WHEN sc.parameter = 'Total PAHs' THEN sc.value END) AS total_pahs_ug_kg,
    MAX(CASE WHEN sc.parameter = 'Total PCBs' THEN sc.value END) AS total_pcbs_ug_kg,
    -- Modifiers
    MAX(CASE WHEN em.parameter = 'TOC' THEN em.value END) AS toc_pct,
    MAX(CASE WHEN em.parameter = 'AVS' THEN em.value END) AS avs_umol_g,
    MAX(CASE WHEN em.parameter = 'SEM' THEN em.value END) AS sem_umol_g,
    MAX(CASE WHEN em.parameter = 'Grain_Size_Fines' THEN em.value END) AS fines_pct,
    MAX(CASE WHEN em.parameter = 'pH' THEN em.value END) AS ph,
    MAX(CASE WHEN em.parameter = 'Redox' THEN em.value END) AS redox_mv,
    -- Toxicity: Marine endpoints
    MAX(CASE WHEN tt.test_type = 'amphipod_survival' THEN tt.result END) AS amphipod_survival_pct,
    MAX(CASE WHEN tt.test_type = 'amphipod_survival' THEN tt.sig_different END) AS amphipod_sig,
    MAX(CASE WHEN tt.test_type = 'polychaete_survival' THEN tt.result END) AS polychaete_survival_pct,
    MAX(CASE WHEN tt.test_type = 'polychaete_growth' THEN tt.result END) AS polychaete_growth_mg,
    MAX(CASE WHEN tt.test_type = 'bivalve_larval' THEN tt.result END) AS bivalve_normal_dev_pct,
    -- Toxicity: Freshwater endpoints
    MAX(CASE WHEN tt.test_type = 'chironomid_survival' THEN tt.result END) AS chironomid_survival_pct,
    MAX(CASE WHEN tt.test_type = 'chironomid_growth' THEN tt.result END) AS chironomid_growth_mg,
    MAX(CASE WHEN tt.test_type = 'hyalella_survival' THEN tt.result END) AS hyalella_survival_pct,
    MAX(CASE WHEN tt.test_type = 'hyalella_survival' THEN tt.sig_different END) AS hyalella_sig,
    MAX(CASE WHEN tt.test_type = 'hyalella_growth' THEN tt.result END) AS hyalella_growth_mg,
    -- Community metrics (MAX within campaign)
    MAX(bc.abundance) AS abundance,
    MAX(bc.taxa_richness) AS taxa_richness,
    MAX(bc.shannon_h) AS shannon_h,
    MAX(bc.simpson_d) AS simpson_d,
    MAX(bc.pielous_j) AS pielous_j,
    MAX(bc.bray_curtis) AS bray_curtis,
    -- WOE integration (already station-level)
    wi.overall_risk AS woe_risk,
    wi.scenario AS woe_scenario,
    wi.framework_type AS woe_framework,
    -- Data presence flags
    MAX(CASE WHEN sc.parameter IN ('Copper','Zinc','Lead','Cadmium','Mercury','Arsenic','Chromium') THEN 1 ELSE 0 END) AS has_chemistry,
    MAX(CASE WHEN tt.test_type IS NOT NULL THEN 1 ELSE 0 END) AS has_toxicity,
    MAX(CASE WHEN em.parameter IS NOT NULL THEN 1 ELSE 0 END) AS has_modifiers,
    MAX(CASE WHEN bc.id IS NOT NULL THEN 1 ELSE 0 END) AS has_community,
    -- Co-location quality score
    CASE
        WHEN MAX(CASE WHEN sc.parameter = 'Copper' THEN 1 END) IS NOT NULL
         AND MAX(CASE WHEN tt.test_type = 'amphipod_survival' THEN 1 END) IS NOT NULL
         AND MAX(CASE WHEN em.parameter = 'TOC' THEN 1 END) IS NOT NULL
         AND MAX(CASE WHEN bc.id IS NOT NULL THEN 1 END) IS NOT NULL
        THEN 'full'
        WHEN MAX(CASE WHEN sc.parameter = 'Copper' THEN 1 END) IS NOT NULL
         AND MAX(CASE WHEN tt.test_type = 'amphipod_survival' THEN 1 END) IS NOT NULL
         AND MAX(CASE WHEN em.parameter = 'TOC' THEN 1 END) IS NOT NULL
        THEN 'chem_tox_mod'
        WHEN MAX(CASE WHEN sc.parameter = 'Copper' THEN 1 END) IS NOT NULL
         AND MAX(CASE WHEN tt.test_type = 'amphipod_survival' THEN 1 END) IS NOT NULL
        THEN 'chem_tox'
        WHEN MAX(CASE WHEN sc.parameter = 'Copper' THEN 1 END) IS NOT NULL
        THEN 'chem_only'
        WHEN MAX(CASE WHEN tt.test_type IS NOT NULL THEN 1 END) IS NOT NULL
        THEN 'tox_only'
        ELSE 'partial'
    END AS colocation_quality
FROM stations st
JOIN sites s ON st.site_id = s.site_id
LEFT JOIN sampling_events se ON se.station_id = st.station_id AND se.media_type = 'sediment'
LEFT JOIN sediment_chemistry sc ON sc.event_id = se.event_id
LEFT JOIN env_modifiers em ON em.event_id = se.event_id
LEFT JOIN toxicity_tests tt ON tt.event_id = se.event_id
LEFT JOIN benthic_community bc ON bc.event_id = se.event_id
LEFT JOIN woe_integration wi ON wi.station_id = st.station_id
GROUP BY st.station_id, COALESCE(strftime('%Y', se.date_sampled), 'unknown');

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_stations_site ON stations(site_id);
CREATE INDEX idx_events_station ON sampling_events(station_id);
CREATE INDEX idx_events_date ON sampling_events(date_sampled);
CREATE INDEX idx_sedchem_event ON sediment_chemistry(event_id);
CREATE INDEX idx_sedchem_param ON sediment_chemistry(parameter);
CREATE INDEX idx_porewater_event ON porewater_chemistry(event_id);
CREATE INDEX idx_tox_event ON toxicity_tests(event_id);
CREATE INDEX idx_benthic_event ON benthic_community(event_id);
CREATE INDEX idx_tissue_event ON tissue_residues(event_id);
CREATE INDEX idx_modifiers_event ON env_modifiers(event_id);
CREATE INDEX idx_events_source_ref ON sampling_events(source_table_ref);
CREATE INDEX idx_loe_doc ON loe_assessments(doc_id);
CREATE INDEX idx_loe_station ON loe_assessments(station_id);
CREATE INDEX idx_woe_doc ON woe_integration(doc_id);
CREATE INDEX idx_woe_station ON woe_integration(station_id);
CREATE INDEX idx_provenance_target ON extraction_provenance(target_table, target_id);
CREATE INDEX idx_tload_doc_status_doc ON tload_doc_status(doc_id);
CREATE INDEX idx_tload_doc_status_art_doc ON tload_doc_status(art_doc_id);
CREATE INDEX idx_tload_doc_status_status ON tload_doc_status(status);
