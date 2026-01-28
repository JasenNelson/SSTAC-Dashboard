-- Create policy sources and taxonomy mapping tables

CREATE TABLE IF NOT EXISTS policy_sources (
  source_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  doc_type TEXT,
  issuing_body TEXT,
  jurisdiction TEXT,
  citation_label TEXT,
  code TEXT,
  landing_page_url TEXT,
  document_url TEXT,
  last_updated TEXT,
  version TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS policy_source_aliases (
  alias_id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_source_id TEXT NOT NULL,
  alias_label TEXT NOT NULL,
  FOREIGN KEY (policy_source_id) REFERENCES policy_sources(source_id)
);

CREATE TABLE IF NOT EXISTS taxonomy_mapping (
  mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_requirement_id TEXT,
  stage_id TEXT,
  stage_label TEXT,
  topic_id TEXT,
  topic_label TEXT,
  subtopic_id TEXT,
  subtopic_label TEXT,
  code TEXT,
  citation_label TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_internal_requirement
  ON taxonomy_mapping (internal_requirement_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_stage
  ON taxonomy_mapping (stage_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_topic
  ON taxonomy_mapping (topic_id);
