import argparse
import csv
import sqlite3
from pathlib import Path

DEFAULT_DB = r"F:\sstac-dashboard\src\data\regulatory-review.db"
DEFAULT_POLICY = r"F:\sstac-dashboard\scripts\regulatory-review\data\policy_sources.csv"
DEFAULT_TAXONOMY = r"F:\sstac-dashboard\scripts\regulatory-review\data\taxonomy_mapping.csv"

SCHEMA_SQL = """
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
    FOREIGN KEY(policy_source_id) REFERENCES policy_sources(source_id)
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

CREATE INDEX IF NOT EXISTS idx_taxonomy_internal_requirement ON taxonomy_mapping(internal_requirement_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_stage ON taxonomy_mapping(stage_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_topic ON taxonomy_mapping(topic_id);
"""


def normalize_value(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def load_policy_sources(conn: sqlite3.Connection, csv_path: Path) -> int:
    with csv_path.open('r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    for row in rows:
        conn.execute(
            """
            INSERT INTO policy_sources (
                source_id, title, doc_type, issuing_body, jurisdiction,
                citation_label, code, landing_page_url, document_url,
                last_updated, version, notes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(source_id) DO UPDATE SET
                title=excluded.title,
                doc_type=excluded.doc_type,
                issuing_body=excluded.issuing_body,
                jurisdiction=excluded.jurisdiction,
                citation_label=excluded.citation_label,
                code=excluded.code,
                landing_page_url=excluded.landing_page_url,
                document_url=excluded.document_url,
                last_updated=excluded.last_updated,
                version=excluded.version,
                notes=excluded.notes,
                updated_at=datetime('now')
            """,
            (
                normalize_value(row.get('source_id')),
                normalize_value(row.get('title')) or '',
                normalize_value(row.get('doc_type')),
                normalize_value(row.get('issuing_body')),
                normalize_value(row.get('jurisdiction')),
                normalize_value(row.get('citation_label')),
                normalize_value(row.get('code')),
                normalize_value(row.get('landing_page_url')),
                normalize_value(row.get('document_url')),
                normalize_value(row.get('last_updated')),
                normalize_value(row.get('version')),
                normalize_value(row.get('notes')),
            ),
        )

    return len(rows)


def load_taxonomy_mapping(conn: sqlite3.Connection, csv_path: Path, truncate: bool) -> int:
    if truncate:
        conn.execute("DELETE FROM taxonomy_mapping")

    with csv_path.open('r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    for row in rows:
        conn.execute(
            """
            INSERT INTO taxonomy_mapping (
                internal_requirement_id, stage_id, stage_label,
                topic_id, topic_label, subtopic_id, subtopic_label,
                code, citation_label, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                normalize_value(row.get('internal_requirement_id')),
                normalize_value(row.get('stage_id')),
                normalize_value(row.get('stage_label')),
                normalize_value(row.get('topic_id')),
                normalize_value(row.get('topic_label')),
                normalize_value(row.get('subtopic_id')),
                normalize_value(row.get('subtopic_label')),
                normalize_value(row.get('code')),
                normalize_value(row.get('citation_label')),
                normalize_value(row.get('notes')),
            ),
        )

    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description='Load policy sources and taxonomy mapping into SQLite.')
    parser.add_argument('--db', default=DEFAULT_DB, help='Target SQLite DB path')
    parser.add_argument('--policy-sources', default=DEFAULT_POLICY, help='Policy sources CSV path')
    parser.add_argument('--taxonomy', default=DEFAULT_TAXONOMY, help='Taxonomy mapping CSV path')
    parser.add_argument('--no-truncate-taxonomy', action='store_true', help='Do not truncate taxonomy_mapping before load')
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        raise FileNotFoundError(f"DB not found: {db_path}")

    policy_path = Path(args.policy_sources)
    taxonomy_path = Path(args.taxonomy)

    if not policy_path.exists():
        raise FileNotFoundError(f"Policy sources CSV not found: {policy_path}")
    if not taxonomy_path.exists():
        raise FileNotFoundError(f"Taxonomy mapping CSV not found: {taxonomy_path}")

    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_SQL)

    with conn:
        policy_count = load_policy_sources(conn, policy_path)
        taxonomy_count = load_taxonomy_mapping(conn, taxonomy_path, truncate=not args.no_truncate_taxonomy)

    conn.close()

    print(f"Loaded {policy_count} policy sources")
    print(f"Loaded {taxonomy_count} taxonomy mapping rows")


if __name__ == '__main__':
    main()
