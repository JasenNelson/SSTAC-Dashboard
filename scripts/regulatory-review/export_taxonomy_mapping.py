import argparse
import csv
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

DEFAULT_DB = r"F:\Regulatory-Review\engine\data\rraa_v3_2.db"
DEFAULT_URL_MAP = r"F:\sstac-dashboard\scripts\regulatory-review\data\policy_source_urls.json"
DEFAULT_OUT = r"F:\sstac-dashboard\scripts\regulatory-review\data\taxonomy_mapping.csv"

PROTOCOL_RE = re.compile(r"Protocol\s+\d+", re.IGNORECASE)
TG_RE = re.compile(r"Technical Guidance\s+\d+", re.IGNORECASE)
CSR_SCH_RE = re.compile(r"Schedule\s+[0-9.]+", re.IGNORECASE)


def derive_citation_label(official_name: str | None, short_name: str | None, source_id: str) -> str:
    if short_name:
        return short_name
    if official_name:
        match = PROTOCOL_RE.search(official_name)
        if match:
            return match.group(0)
        match = TG_RE.search(official_name)
        if match:
            return match.group(0)
        match = CSR_SCH_RE.search(official_name)
        if match and 'CSR' in official_name.upper():
            return f"CSR {match.group(0)}"
        if 'Environmental Management Act' in official_name:
            return 'EMA'
        if 'Contaminated Sites Regulation' in official_name:
            return 'CSR'
    return source_id


def load_url_map(path: str) -> dict:
    map_path = Path(path)
    if not map_path.exists():
        return {}
    with map_path.open('r', encoding='utf-8') as f:
        return json.load(f)


def export_taxonomy_mapping(db_path: str, url_map_path: str, output_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Source document lookup for citation labels
    cur.execute("SELECT id, official_name, short_name FROM source_documents")
    source_docs = {row[0]: (row[1], row[2]) for row in cur.fetchall()}

    # Topic labels
    cur.execute("SELECT category, description FROM topic_categories")
    topic_labels = {row[0]: row[1] for row in cur.fetchall()}

    # Stage labels
    cur.execute("SELECT stage, description FROM lifecycle_stages")
    stage_labels = {row[0]: row[1] for row in cur.fetchall()}

    # Policy -> stages mapping
    cur.execute("SELECT policy_statement_id, lifecycle_stage FROM policy_statement_lifecycle_stages")
    policy_stages = defaultdict(list)
    for policy_id, stage in cur.fetchall():
        policy_stages[policy_id].append(stage)

    # Policy statements
    cur.execute(
        "SELECT id, topic_category, sub_category, source_document_id FROM policy_statements ORDER BY id"
    )
    policy_rows = cur.fetchall()

    conn.close()

    url_map = load_url_map(url_map_path)

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        'internal_requirement_id',
        'stage_id',
        'stage_label',
        'topic_id',
        'topic_label',
        'subtopic_id',
        'subtopic_label',
        'code',
        'citation_label',
        'notes',
    ]

    with out_path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for policy_id, topic_id, sub_category, source_document_id in policy_rows:
            stages = policy_stages.get(policy_id, [])
            if not stages:
                stages = ['']

            official_name, short_name = source_docs.get(source_document_id, (None, None))
            override = url_map.get(source_document_id, {})
            citation_label = override.get('citation_label') or derive_citation_label(official_name, short_name, source_document_id or '')

            topic_label = topic_labels.get(topic_id, '') if topic_id else ''
            subtopic_id = sub_category or ''
            subtopic_label = sub_category or ''

            for stage_id in stages:
                stage_label = stage_labels.get(stage_id, '') if stage_id else ''

                writer.writerow({
                    'internal_requirement_id': policy_id,
                    'stage_id': stage_id,
                    'stage_label': stage_label,
                    'topic_id': topic_id or '',
                    'topic_label': topic_label,
                    'subtopic_id': subtopic_id,
                    'subtopic_label': subtopic_label,
                    'code': source_document_id or '',
                    'citation_label': citation_label,
                    'notes': '',
                })

    print(f"Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description='Export taxonomy mapping from engine DB to CSV.')
    parser.add_argument('--db', default=DEFAULT_DB, help='Path to engine SQLite DB')
    parser.add_argument('--url-map', default=DEFAULT_URL_MAP, help='Path to URL overrides JSON')
    parser.add_argument('--output', default=DEFAULT_OUT, help='Output CSV path')
    args = parser.parse_args()

    export_taxonomy_mapping(args.db, args.url_map, args.output)


if __name__ == '__main__':
    main()
