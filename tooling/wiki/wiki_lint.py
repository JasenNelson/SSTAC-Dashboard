import argparse
import json
import os
import re
import sys
from pathlib import Path
from collections import defaultdict

def parse_frontmatter(content):
    # Extracts the frontmatter block between --- and ---
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return None
    fm_text = match.group(1)
    fm = {}
    for line in fm_text.splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            fm[k.strip()] = v.strip()
    return fm

def check_ascii(path):
    with open(path, 'rb') as f:
        data = f.read()
        try:
            data.decode('ascii')
            return True
        except UnicodeDecodeError:
            return False

def get_links(content):
    # match [[target]]
    return re.findall(r'\[\[(.*?)\]\]', content)

# --- Docs trust model (Phase 3 bounded enhancement; see plan section 7) ---
# Mirrors the Phase 4 semantic-tier trust model: docs/archive/** content and dated-root
# handoff-style markdown are historical-by-default and must never source a compiled page.
# This is inert defense TODAY (Phase 0-3 never scans docs at all) but wiki_lint enforces it
# now so a page compiled from an untrusted source_path fails loudly the moment Phase 4
# lands, even before gen_docs_scope.py's allowlist exists.
_DATED_ROOT_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]*_\d{4}_\d{2}_\d{2}[A-Za-z0-9_.-]*\.md$')

def is_untrusted_source_path(path):
    if not path:
        return False
    norm = path.replace('\\', '/').lstrip('/')
    # Case-insensitive prefix check: graphify/OS path casing is not guaranteed, and a
    # case-sensitive check would silently miss e.g. "Docs/Archive/..." on a case-preserving
    # filesystem.
    if norm.lower().startswith('docs/archive/'):
        return True
    # Dated root markdown: no directory separator, matches a _YYYY_MM_DD token
    # (FRESH_SESSION_HANDOFF_2026_07_17.md, DEV_PLAN_2026_06_01.md, etc.).
    if '/' not in norm and _DATED_ROOT_RE.match(norm):
        return True
    return False

def parse_source_paths(raw):
    # frontmatter value looks like: ["docs/design.md"] or ["a.md", "b.md"]
    if not raw:
        return []
    return re.findall(r'"([^"]*)"', raw)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--wiki', required=True)
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()

    wiki_dir = Path(args.wiki)
    if not wiki_dir.exists():
        print(f"Error: {args.wiki} does not exist.")
        sys.exit(1)

    findings = {
        'frontmatter': [],
        'dead_links': [],
        'dead_ends': [],
        'non_ascii': [],
        'orphans': [],
        'untrusted_source_paths': [],
        'semantic_missing_confidence': [],
    }

    pages = {} # filepath -> { id, links, is_index }
    page_ids = set()
    id_to_filepath = {}

    for root, dirs, files in os.walk(wiki_dir):
        # Exclude .orphaned and _review
        dirs[:] = [d for d in dirs if d not in ('.orphaned', '_review')]
        for file in files:
            if not file.endswith('.md'):
                continue

            filepath = Path(root) / file
            rel_path = filepath.relative_to(wiki_dir).as_posix()

            if not check_ascii(filepath):
                findings['non_ascii'].append(rel_path)

            try:
                content = filepath.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                # If we can't even read it as utf-8, fallback to ascii/ignore
                with open(filepath, 'r', encoding='latin-1') as f:
                    content = f.read()

            fm = parse_frontmatter(content)
            page_id = None
            is_index = '03_Indexes' in filepath.parts

            if not is_index:
                if not fm:
                    findings['frontmatter'].append({'file': rel_path, 'error': 'Missing or invalid frontmatter'})
                else:
                    missing = [k for k in ['id', 'type', 'source_paths', 'last_compiled'] if k not in fm]
                    if missing:
                        findings['frontmatter'].append({'file': rel_path, 'error': f'Missing fields: {", ".join(missing)}'})
                    else:
                        page_id = fm['id']

                    # RULE: source_paths resolving into docs/archive/ or the dated-root set
                    # never sources a compiled page.
                    for sp in parse_source_paths(fm.get('source_paths')):
                        if is_untrusted_source_path(sp):
                            findings['untrusted_source_paths'].append({'file': rel_path, 'source_path': sp})

                    # RULE: a semantic-derived page (doc_status present in frontmatter,
                    # set by wiki_compile's Phase-4 hook) must carry a confidence value.
                    if fm.get('doc_status') and 'confidence' not in fm:
                        findings['semantic_missing_confidence'].append({'file': rel_path})
            else:
                page_id = file[:-3] # filename without .md for indexes

            if not page_id:
                # fallback for linking
                page_id = file[:-3]

            page_ids.add(page_id)
            id_to_filepath[page_id] = rel_path

            links = get_links(content)
            pages[rel_path] = {
                'id': page_id,
                'links': links,
                'is_index': is_index
            }

    # Second pass: check links and dead-ends
    incoming_links = defaultdict(set)
    for rel_path, pdata in pages.items():
        for target in pdata['links']:
            incoming_links[target].add(rel_path)
            if target not in page_ids:
                findings['dead_links'].append({'file': rel_path, 'target': target})

    for rel_path, pdata in pages.items():
        if pdata['is_index']:
            continue
        # NO DEAD-END: every page has >=1 outgoing link AND is referenced by >=1 other page or an index
        out_count = len(pdata['links'])
        in_count = len(incoming_links.get(pdata['id'], set()))
        if out_count == 0 or in_count == 0:
            findings['dead_ends'].append({'file': rel_path, 'out_links': out_count, 'in_links': in_count})

    # Orphan candidates: pages not reachable from any 03_Indexes page
    reachable = set()
    queue = []

    # Start BFS from indexes
    for rel_path, pdata in pages.items():
        if pdata['is_index']:
            queue.append(pdata['id'])
            reachable.add(pdata['id'])

    while queue:
        curr = queue.pop(0)
        curr_file = id_to_filepath.get(curr)
        if not curr_file:
            continue
        pdata = pages.get(curr_file)
        if not pdata:
            continue

        for target in pdata['links']:
            if target not in reachable and target in page_ids:
                reachable.add(target)
                queue.append(target)

    for rel_path, pdata in pages.items():
        if pdata['is_index']:
            continue
        if pdata['id'] not in reachable:
            findings['orphans'].append(rel_path)

    has_findings = any(len(v) > 0 for v in findings.values())

    if args.json:
        print(json.dumps(findings, indent=2))
    else:
        if not has_findings:
            print("Wiki is clean.")
        else:
            for k, v in findings.items():
                if v:
                    print(f"--- {k.upper()} ---")
                    for item in v:
                        print(f"  {item}")
                    print()

    if has_findings:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()
