import argparse
import json
import os
import re
import sys
import shutil
from collections import defaultdict
from pathlib import Path

def slugify(text):
    if not text:
        return "unknown"
    text = str(text)
    return re.sub(r'[^a-zA-Z0-9]+', '_', text).strip('_').lower()

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--graph', required=True)
    parser.add_argument('--repo-root', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--stamp', required=True)
    parser.add_argument('--dry-run', action='store_true')
    return parser.parse_args()

def main():
    args = parse_args()

    with open(args.graph, 'r', encoding='utf-8') as f:
        graph_data = json.load(f)

    nodes = graph_data.get('nodes', [])
    links = graph_data.get('links', [])

    node_by_id = {n.get('id'): n for n in nodes if n.get('id')}

    nodes_by_file = defaultdict(list)
    for n in nodes:
        sf = n.get('source_file')
        if not sf:
            continue
        # Skip DEGENERATE source files whose slug is empty (e.g. '.', the repo root):
        # such a node would otherwise get an empty page id -> a `[[]]` empty wiki-link in
        # 000-Modules.md + a stray `.md` page, which fails wiki_lint (the nightly Step-4 fail).
        if not slugify(sf):
            continue
        nodes_by_file[sf].append(n)

    page_id_by_file = {}
    page_type_by_file = {}

    for sf, fnodes in nodes_by_file.items():
        page_id = slugify(sf)
        page_id_by_file[sf] = page_id

        is_code = False
        for n in fnodes:
            # Code classification: file_type == "code" or metadata.kind exists
            if n.get('file_type') == 'code' or n.get('metadata', {}).get('kind'):
                is_code = True
                break
        page_type_by_file[sf] = 'module' if is_code else 'concept'

    ambiguous_links = []
    links_by_source = defaultdict(list)
    links_by_target = defaultdict(list)

    for link in links:
        confidence = (link.get('confidence') or 'EXTRACTED').upper()
        if confidence == 'AMBIGUOUS':
            ambiguous_links.append(link)
            continue

        src = link.get('source')
        tgt = link.get('target')
        if not src or not tgt:
            continue

        src_node = node_by_id.get(src)
        tgt_node = node_by_id.get(tgt)
        if not src_node or not tgt_node:
            continue

        src_file = src_node.get('source_file')
        tgt_file = tgt_node.get('source_file')

        if not src_file or not tgt_file:
            continue
        # Skip links to/from a file that has no page (e.g. the degenerate '.' node skipped
        # above): rendering it would KeyError on page_id_by_file or emit a `[[]]` empty link.
        if src_file not in nodes_by_file or tgt_file not in nodes_by_file:
            continue

        links_by_source[src_file].append({
            'target_file': tgt_file,
            'target_node': tgt_node,
            'relation': link.get('relation', 'references'),
            'confidence': confidence
        })

        links_by_target[tgt_file].append({
            'source_file': src_file,
            'source_node': src_node,
            'relation': link.get('relation', 'references'),
            'confidence': confidence
        })

    pages = {}

    for sf, fnodes in nodes_by_file.items():
        page_id = page_id_by_file[sf]
        page_type = page_type_by_file[sf]

        content_lines = []
        title_prefix = "Module" if page_type == 'module' else "Concept"
        content_lines.append(f"# {title_prefix}: {sf}")
        content_lines.append("")

        if page_type == 'module':
            content_lines.append("## Entities")
            for n in sorted(fnodes, key=lambda x: x.get('label', x.get('id', ''))):
                label = n.get('label', n.get('id', 'unknown'))
                content_lines.append(f"- {label}")
            content_lines.append("")

            out_links = links_by_source.get(sf, [])
            if out_links:
                content_lines.append("## Outgoing Links")
                out_by_rel = defaultdict(list)
                for l in out_links:
                    out_by_rel[l['relation']].append(l)
                for rel in sorted(out_by_rel.keys()):
                    content_lines.append(f"### {rel}")
                    for l in sorted(out_by_rel[rel], key=lambda x: x['target_file']):
                        tgt_page_id = page_id_by_file[l['target_file']]
                        prefix = "[?] " if l['confidence'] == 'INFERRED' else ""
                        if tgt_page_id == page_id:
                            label = l['target_node'].get('label', l['target_node'].get('id', 'unknown'))
                            content_lines.append(f"- {prefix}{label}")
                        else:
                            content_lines.append(f"- {prefix}[[{tgt_page_id}]]")
                content_lines.append("")

            in_links = links_by_target.get(sf, [])
            if in_links:
                content_lines.append("## Incoming Links")
                in_by_rel = defaultdict(list)
                for l in in_links:
                    in_by_rel[l['relation']].append(l)
                for rel in sorted(in_by_rel.keys()):
                    content_lines.append(f"### {rel}")
                    for l in sorted(in_by_rel[rel], key=lambda x: x['source_file']):
                        src_page_id = page_id_by_file[l['source_file']]
                        prefix = "[?] " if l['confidence'] == 'INFERRED' else ""
                        if src_page_id == page_id:
                            label = l['source_node'].get('label', l['source_node'].get('id', 'unknown'))
                            content_lines.append(f"- {prefix}{label}")
                        else:
                            content_lines.append(f"- {prefix}[[{src_page_id}]]")
                content_lines.append("")

        else: # concept
            content_lines.append("## Outline")
            for n in sorted(fnodes, key=lambda x: x.get('label', x.get('id', ''))):
                label = n.get('label', n.get('id', 'unknown'))
                loc = n.get('source_location', 'unknown')
                content_lines.append(f"- {label} (Location: {loc})")
            content_lines.append("")

        index_link = "[[000-Modules]]" if page_type == 'module' else "[[000-Concepts]]"
        content_lines.append(f"Index: {index_link}")

        ast_content = "\n".join(content_lines) + "\n"

        dependencies = set()
        has_inferred = False
        for l in links_by_source.get(sf, []):
            tgt_page_id = page_id_by_file[l['target_file']]
            if tgt_page_id != page_id:
                if l['confidence'] == 'EXTRACTED':
                    dependencies.add(f"[[{tgt_page_id}]]")
            if l['confidence'] == 'INFERRED':
                has_inferred = True

        for l in links_by_target.get(sf, []):
            if l['confidence'] == 'INFERRED':
                has_inferred = True

        conf_str = "mixed" if has_inferred else "extracted"

        # --- Doc-provenance frontmatter hook (Phase 3 bounded enhancement) ---
        # INERT until Phase 4: Phase 4's semantic extraction (graphify extract via the
        # Ollama lock) is the only pipeline stage expected to tag doc-derived nodes with
        # metadata.extraction_method == "semantic" (+ metadata.extraction_date). No graph
        # produced by Phase 0-3 (code-only, no LLM) sets this key, so this block never
        # fires today. It activates automatically the moment Phase 4 nodes carry the
        # marker, without a second compiler edit. wiki_lint.py's new
        # "semantic-derived page lacking confidence" rule keys off the doc_status field
        # this block adds.
        doc_status = None
        extraction_date = None
        for n in fnodes:
            meta = n.get('metadata') or {}
            if meta.get('extraction_method') == 'semantic':
                doc_status = 'semantic'
                extraction_date = meta.get('extraction_date', args.stamp)
                break

        fm_lines = [
            "---",
            f"id: {page_id}",
            f"type: {page_type}",
            f"source_paths: [\"{sf}\"]",
            f"dependencies: {json.dumps(sorted(list(dependencies)))}",
            f"confidence: {conf_str}",
            f"last_compiled: {args.stamp}",
        ]
        if doc_status:
            fm_lines.append(f"doc_status: {doc_status}")
            fm_lines.append(f"extraction_date: {extraction_date}")
        fm_lines.append("---")

        frontmatter = "\n".join(fm_lines) + "\n"

        pages[page_id] = {
            'id': page_id,
            'type': page_type,
            'file_name': f"{page_id}.md",
            'ast_content': ast_content,
            'frontmatter': frontmatter,
            'sf': sf
        }

    out_dir = Path(args.out)
    out_modules = out_dir / "02_Modules"
    out_concepts = out_dir / "01_Concepts"
    out_indexes = out_dir / "03_Indexes"
    out_review = out_dir / "_review"
    out_orphaned = out_dir / ".orphaned"
    out_graph = out_dir / ".graph"

    existing_pages = {}
    if out_dir.exists():
        for d in [out_modules, out_concepts]:
            if d.exists():
                for p in d.glob("*.md"):
                    content = p.read_text(encoding='utf-8')
                    m = re.search(r'^id:\s*(\S+)', content, re.MULTILINE)
                    if m:
                        existing_pages[m.group(1)] = (p, content)

    # --- Structured contradiction emission (Phase 3 bounded enhancement) ---
    # The base contradiction signal (AST content changed under an existing page's Manual
    # Notes) already existed in OHD only as an inline WARNING callout. This extension ALSO
    # records a structured entry, so a later aggregation page (improvement-menu item 6)
    # and Phase 4's doc-vs-AST collisions (both feed the same signal: AST content diverged
    # from what a page previously claimed) have one queryable source of truth. Recorded
    # ONLY the first time a contradiction is detected for a given page (same guard as the
    # WARNING-block insertion) so re-running compile on an unresolved contradiction does
    # not spam duplicate entries.
    new_contradictions = []

    for page_id, pdata in pages.items():
        new_ast_content = pdata['ast_content']
        final_content = pdata['frontmatter'] + new_ast_content

        if page_id in existing_pages:
            old_path, old_content = existing_pages[page_id]

            parts = re.split(r'^## Manual Notes\s*\n', old_content, flags=re.MULTILINE, maxsplit=1)
            if len(parts) > 1:
                old_ast_content = parts[0]
                old_ast_content_no_fm = re.sub(r'^---\n.*?\n---\n', '', old_ast_content, flags=re.DOTALL)

                manual_notes = parts[1]

                if new_ast_content.strip() != old_ast_content_no_fm.strip():
                    if "> [!WARNING] Contradiction check needed" not in manual_notes:
                        manual_notes = "> [!WARNING] Contradiction check needed\n" + manual_notes
                        new_contradictions.append({
                            'page_id': page_id,
                            'source_paths': [pdata['sf']],
                            'detected_at': args.stamp,
                            'reason': 'ast_content_changed',
                        })

                final_content += "\n## Manual Notes\n" + manual_notes

        pdata['final_content'] = final_content

    orphans = []
    for page_id, (path, old_content) in existing_pages.items():
        if page_id not in pages:
            orphans.append((page_id, path))

    if args.dry_run:
        print(f"Planned pages: {len(pages)}")
        for pid, pdata in pages.items():
            print(f"  {pdata['type']} -> {pdata['file_name']}")
        print(f"Orphans to move: {len(orphans)}")
        for pid, path in orphans:
            print(f"  {path.name}")
        if new_contradictions:
            print(f"New contradictions (not written -- dry-run): {len(new_contradictions)}")
        sys.exit(0)

    out_modules.mkdir(parents=True, exist_ok=True)
    out_concepts.mkdir(parents=True, exist_ok=True)
    out_indexes.mkdir(parents=True, exist_ok=True)
    out_review.mkdir(parents=True, exist_ok=True)
    out_orphaned.mkdir(parents=True, exist_ok=True)

    for page_id, pdata in pages.items():
        dest_dir = out_modules if pdata['type'] == 'module' else out_concepts
        dest_path = dest_dir / pdata['file_name']
        dest_path.write_text(pdata['final_content'], encoding='utf-8')

    for page_id, path in orphans:
        dest_path = out_orphaned / path.name
        shutil.move(str(path), str(dest_path))

    modules_index = []
    concepts_index = []
    for pid, pdata in sorted(pages.items()):
        if pdata['type'] == 'module':
            modules_index.append(f"- [[{pid}]]")
        else:
            concepts_index.append(f"- [[{pid}]]")

    (out_indexes / "000-Modules.md").write_text("\n".join(["# Modules Index", ""] + modules_index) + "\n", encoding='utf-8')
    (out_indexes / "000-Concepts.md").write_text("\n".join(["# Concepts Index", ""] + concepts_index) + "\n", encoding='utf-8')

    ambig_path = out_review / "ambiguous.md"
    if ambiguous_links:
        ambig_lines = ["# Ambiguous Links Review", ""]
        for l in ambiguous_links:
            src = l.get('source', 'unknown')
            tgt = l.get('target', 'unknown')
            rel = l.get('relation', 'unknown')
            sf = l.get('source_file', 'unknown')
            sl = l.get('source_location', 'unknown')
            ctx = l.get('context')

            line = f"- Source: {src} -> Target: {tgt} (Relation: {rel}, File: {sf}, Location: {sl})"
            if ctx:
                line += f" Context: {ctx}"
            ambig_lines.append(line)
        with open(ambig_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(ambig_lines) + "\n")
    else:
        if ambig_path.exists():
            ambig_path.unlink()

    # --- Persist structured contradictions (Phase 3 bounded enhancement) ---
    # Appends to a running list at wiki/.graph/contradictions.json so a later aggregation
    # page (improvement-menu item 6) can render the accumulated history. A malformed or
    # missing prior file is treated as an empty list (never a fatal error -- this is a
    # secondary artifact, not gating).
    if new_contradictions:
        contradictions_path = out_graph / "contradictions.json"
        out_graph.mkdir(parents=True, exist_ok=True)
        existing_contradictions = []
        if contradictions_path.exists():
            try:
                with open(contradictions_path, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                if isinstance(loaded, list):
                    existing_contradictions = loaded
            except (json.JSONDecodeError, OSError):
                existing_contradictions = []
        existing_contradictions.extend(new_contradictions)
        with open(contradictions_path, 'w', encoding='utf-8') as f:
            json.dump(existing_contradictions, f, indent=2)

if __name__ == '__main__':
    main()
