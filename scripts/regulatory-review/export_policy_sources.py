import argparse
import csv
import json
import re
import sqlite3
from pathlib import Path

DEFAULT_DB = r"F:\Regulatory-Review\engine\data\rraa_v3_2.db"
DEFAULT_URL_MAP = r"F:\sstac-dashboard\scripts\regulatory-review\data\policy_source_urls.json"
DEFAULT_OUT = r"F:\sstac-dashboard\scripts\regulatory-review\data\policy_sources.csv"

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


def infer_issuing_body(source_id: str, doc_type: str | None) -> str:
    if source_id.startswith('CSAP_'):
        return 'CSAP Society'
    if source_id.startswith('EXT_'):
        return 'Atlantic PIRI'
    if doc_type in {
        'ACT',
        'REGULATION',
        'REGULATION_SCHEDULE',
        'PROTOCOL',
        'PROCEDURE',
        'TECHNICAL_GUIDANCE',
        'WEB_CONTENT',
    }:
        return 'BC Government'
    return ''


def infer_jurisdiction(source_id: str, issuing_body: str) -> str:
    if issuing_body == 'Atlantic PIRI':
        return 'Atlantic'
    if issuing_body:
        return 'BC'
    if source_id.startswith('EXT_'):
        return 'Atlantic'
    return ''


def load_url_map(path: str) -> dict:
    map_path = Path(path)
    if not map_path.exists():
        return {}
    with map_path.open('r', encoding='utf-8') as f:
        return json.load(f)


def export_policy_sources(db_path: str, url_map_path: str, output_path: str) -> None:
    url_map = load_url_map(url_map_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, document_type, official_name, short_name, version, source_url, env_url FROM source_documents ORDER BY id"
    )
    rows = cur.fetchall()
    conn.close()

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        'source_id',
        'title',
        'doc_type',
        'issuing_body',
        'jurisdiction',
        'citation_label',
        'code',
        'landing_page_url',
        'document_url',
        'last_updated',
        'version',
        'notes',
    ]

    with out_path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for source_id, doc_type, official_name, short_name, version, source_url, env_url in rows:
            overrides = url_map.get(source_id, {})
            issuing_body = infer_issuing_body(source_id, doc_type)
            jurisdiction = infer_jurisdiction(source_id, issuing_body)

            landing_page_url = overrides.get('landing_page_url') or env_url or source_url or ''
            document_url = overrides.get('document_url') or ''
            citation_label = overrides.get('citation_label') or derive_citation_label(official_name, short_name, source_id)

            writer.writerow({
                'source_id': source_id,
                'title': official_name or '',
                'doc_type': doc_type or '',
                'issuing_body': issuing_body,
                'jurisdiction': jurisdiction,
                'citation_label': citation_label,
                'code': source_id,
                'landing_page_url': landing_page_url,
                'document_url': document_url,
                'last_updated': overrides.get('last_updated', ''),
                'version': version or '',
                'notes': overrides.get('notes', ''),
            })

    print(f"Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description='Export policy sources from engine DB to CSV.')
    parser.add_argument('--db', default=DEFAULT_DB, help='Path to engine SQLite DB')
    parser.add_argument('--url-map', default=DEFAULT_URL_MAP, help='Path to URL overrides JSON')
    parser.add_argument('--output', default=DEFAULT_OUT, help='Output CSV path')
    args = parser.parse_args()

    export_policy_sources(args.db, args.url_map, args.output)


if __name__ == '__main__':
    main()
