"""doc_code_candidates.py -- generate GENUINE document-to-code semantic candidates.

WHY THIS EXISTS
---------------
The knowledge graph has no document-to-code relation at all. Measured against the accepted graph
(12464 nodes / 24548 edges, built at 3600a18f), edge endpoints partition like this:

    EXTRACTED   (code, code) 18880 | (code, concept) 2714 | (document, document) 2411
                (code, rationale) 198 | (concept, document) 22
    INFERRED    (code, code) 284 | (code, concept) 39

Zero `(code, document)` edges exist in EITHER layer, despite 2467 document nodes. Documents form an
island linked only to each other. For a Wiki-KB whose purpose is connecting documentation to the
code it describes, the single most valuable edge type is entirely absent.

That absence also makes the M4 semantic canary unsatisfiable as written: its frozen strata require
ten DOC_CODE edges before deterministic deficit fill, and the pool is empty.

WHAT THIS DOES
--------------
It mines a bridge signal that already exists in the corpus: documentation cites code in BACKTICKS.
The repository's own docs-trust mechanism already depends on backtick-referenced paths, so this is
the established convention rather than a new one.

For every document node, this reads that document's source file and extracts the inline-code spans
and fenced-code blocks. A span becomes a candidate edge ONLY when it resolves EXACTLY to an existing
code node -- either that node's repo-relative source_file, or its unambiguous label. Every candidate
carries the citing file, the line number, and the exact quoted text.

That grounding is deliberate. The M4 support rubric holds that "an edge is supported only when both
endpoint identities and the asserted relation are grounded in exact cited content from the
authenticated source snapshot". A backtick citation IS exact cited content, so these candidates are
gradeable under the existing rubric without weakening it.

WHAT THIS DOES NOT DO
---------------------
- It NEVER writes to the input graph. The graph is opened read-only and the candidates go to a
  separate output file. The canonical served graph is not touched.
- It requires NO model, NO Ollama and NO GPU. It is deterministic string resolution against nodes
  that already exist, so it runs outside the shared-GPU schedule entirely.
- It does not promote anything. It produces CANDIDATES for review. Promotion remains gated.
- It does not guess. An ambiguous label -- one matching more than one code node -- is recorded as
  ambiguous and EXCLUDED, because a candidate that cannot name one endpoint is not grounded.

Usage:
    python doc_code_candidates.py --graph <graph.json> --repo-root <root> --out <candidates.json>
"""
import argparse
import io
import json
import os
import re
import sys

sys.dont_write_bytecode = True

# Inline code spans: `like_this`. Non-greedy, single-line, no empty spans.
INLINE_CODE = re.compile(r"`([^`\r\n]+)`")
# Fenced blocks are handled line-wise so a line number can be attributed to every candidate.
FENCE = re.compile(r"^\s*```")
# A plausible code reference: a path with a code-ish extension, or an identifier possibly with ().
CODE_EXT = (".py", ".ps1", ".psm1", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".sh")
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_.\-]*(\(\))?$")


def load_graph(path):
    with io.open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def line_of(node):
    """Start line of a node, from its source_location ("L1", "L432"). 0 when unknown."""
    raw = str(node.get("source_location") or "").strip()
    match = re.match(r"^L(\d+)$", raw)
    return int(match.group(1)) if match else 0


def build_code_index(graph):
    """Lookup tables over CODE nodes: by repo-relative source_file, and by label.

    A file path resolves to the FILE-LEVEL node, not to an arbitrary member of that file. A code
    file contributes one node per function or class, all sharing the same source_file, so treating
    a path citation as ambiguous discarded the single most common and most meaningful reference a
    document makes -- naming the file it documents. The file-level node is the one whose label is
    the basename, falling back to the lowest start line.

    Label collisions are kept so the caller can EXCLUDE them rather than pick arbitrarily.
    """
    by_source_all = {}
    by_label = {}
    for node in graph.get("nodes") or []:
        if (node.get("file_type") or "") != "code":
            continue
        source = (node.get("source_file") or "").strip()
        if source:
            by_source_all.setdefault(source.replace("\\", "/").lower(), []).append(node)
        label = (node.get("label") or "").strip()
        if label:
            by_label.setdefault(label.rstrip("()").lower(), []).append(node)

    by_source = {}
    for key, nodes in by_source_all.items():
        basename = key.rsplit("/", 1)[-1]
        exact = [n for n in nodes if (n.get("label") or "").strip().lower() == basename]
        by_source[key] = exact[0] if exact else sorted(nodes, key=line_of)[0]
    return by_source, by_label


def build_doc_sections(graph):
    """Map document source_file -> sections sorted by start line.

    A document contributes many nodes (one per heading). Scanning the file once per NODE produced
    the same citations repeatedly -- 20518 candidates from only 56 distinct files. Scanning once
    per FILE and attributing each citation to the ENCLOSING SECTION is both correct and sharper: the
    resulting edge says "this section documents this symbol", not merely "this file mentions it".
    """
    sections = {}
    for node in graph.get("nodes") or []:
        if (node.get("file_type") or "") != "document":
            continue
        source = (node.get("source_file") or "").strip()
        if not source:
            continue
        sections.setdefault(source, []).append(node)
    for source in sections:
        sections[source].sort(key=line_of)
    return sections


def enclosing_section(sections_for_file, line_no):
    """The section node with the greatest start line <= line_no; the first node otherwise."""
    chosen = sections_for_file[0]
    for node in sections_for_file:
        start = line_of(node)
        if start and start <= line_no:
            chosen = node
        elif start > line_no:
            break
    return chosen


def iter_cited_spans(text):
    """Yield (line_number, span_text) for every inline-code span and fenced-code line."""
    in_fence = False
    for index, line in enumerate(text.splitlines(), start=1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            token = line.strip()
            if token:
                yield index, token
            continue
        for match in INLINE_CODE.finditer(line):
            span = match.group(1).strip()
            if span:
                yield index, span


def resolve(span, by_source, by_label):
    """Resolve a cited span to exactly one code node, or explain why it cannot be resolved.

    Returns (node, reason). Exactly one of them is None.
    """
    cleaned = span.strip().strip(",;:").strip()
    if not cleaned or len(cleaned) > 200:
        return None, "SPAN_UNUSABLE"

    normalised = cleaned.replace("\\", "/").lower()
    # 1. exact repo-relative path match, resolved to that file's FILE-LEVEL node
    hit = by_source.get(normalised)
    if hit is not None:
        if not (hit.get("source_file") or "").strip():
            return None, "TARGET_HAS_NO_SOURCE_FILE"
        return hit, None

    # 2. exact label match, only for things that actually look like identifiers
    if not IDENT.match(cleaned):
        return None, "NOT_AN_IDENTIFIER"
    if not (cleaned.endswith("()") or "." in cleaned or "_" in cleaned or cleaned.endswith(CODE_EXT)):
        # A bare lowercase word is far more likely prose in backticks than a symbol reference.
        if cleaned.islower() and len(cleaned) < 12:
            return None, "TOO_GENERIC"
    hits = by_label.get(cleaned.rstrip("()").lower())
    if not hits:
        return None, "NO_MATCH"
    if len(hits) > 1:
        return None, "AMBIGUOUS_LABEL"
    node = hits[0]

    # CASE MUST MATCH EXACTLY. The lookup is case-folded so a citation can be found at all, but a
    # citation that differs only in case is not a reference to the symbol -- it is a coincidence.
    # Measured example: a bare SQL keyword `SET` inside a fenced block resolved to a `set()` helper
    # in an unrelated theme unit test, three times. Identifiers are case-sensitive; so is this.
    want = cleaned.rstrip("()")
    have = (node.get("label") or "").rstrip("()")
    if want != have:
        return None, "CASE_MISMATCH"

    # A target with no source_file cannot be opened or cited, so it cannot ground an edge.
    if not (node.get("source_file") or "").strip():
        return None, "TARGET_HAS_NO_SOURCE_FILE"
    return node, None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--graph", required=True, help="graph.json, opened READ-ONLY")
    parser.add_argument("--repo-root", required=True, help="root the document source_file paths resolve against")
    parser.add_argument("--out", required=True, help="candidate output JSON (never the input graph)")
    parser.add_argument("--limit-per-doc", type=int, default=25,
                        help="cap candidates contributed by any single document, so one index page "
                             "cannot dominate the pool")
    args = parser.parse_args()

    if os.path.abspath(args.out) == os.path.abspath(args.graph):
        print("REFUSED: --out must not be the input graph")
        return 2

    graph = load_graph(args.graph)
    by_source, by_label = build_code_index(graph)
    doc_sections = build_doc_sections(graph)

    candidates = []
    reasons = {}
    docs_contributing = 0
    unreadable = []
    seen_pairs = set()

    # ONE pass per document FILE. Each citation is attributed to the section that encloses it.
    for source, sections in sorted(doc_sections.items()):
        full = os.path.join(args.repo_root, source.replace("/", os.sep))
        if not os.path.isfile(full):
            unreadable.append(source)
            continue
        try:
            with io.open(full, "r", encoding="utf-8", errors="replace") as handle:
                text = handle.read()
        except (IOError, OSError):
            unreadable.append(source)
            continue

        produced = 0
        for line_no, span in iter_cited_spans(text):
            if produced >= args.limit_per_doc:
                break
            target, reason = resolve(span, by_source, by_label)
            if target is None:
                reasons[reason] = reasons.get(reason, 0) + 1
                continue
            if target.get("source_file") == source:
                reasons["SELF_REFERENCE"] = reasons.get("SELF_REFERENCE", 0) + 1
                continue
            node = enclosing_section(sections, line_no)
            pair = (node.get("id"), target.get("id"))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            produced += 1
            candidates.append({
                "source": node.get("id"),
                "source_label": node.get("label"),
                "source_file": source,
                "source_section_line": line_of(node),
                "target": target.get("id"),
                "target_label": target.get("label"),
                "target_file": target.get("source_file"),
                "relation": "documents",
                "confidence": "CANDIDATE",
                "stratum": "DOC_CODE",
                "evidence": {
                    "cited_in": source,
                    "line": line_no,
                    "quoted": span[:200],
                },
            })
        if produced:
            docs_contributing += 1
    docs_seen = len(doc_sections)

    payload = {
        "schema_version": "doc-code-candidates-v1",
        "graph": os.path.abspath(args.graph),
        "repo_root": os.path.abspath(args.repo_root),
        "generated_without_model": True,
        "canonical_graph_modified": False,
        "document_nodes_seen": docs_seen,
        "documents_contributing": docs_contributing,
        "candidate_count": len(candidates),
        "distinct_code_targets": len({c["target"] for c in candidates}),
        "unresolved_reason_counts": dict(sorted(reasons.items())),
        "unreadable_document_sources": sorted(set(unreadable))[:20],
        "candidates": candidates,
    }
    with io.open(args.out, "w", encoding="utf-8", newline="") as handle:
        handle.write(json.dumps(payload, indent=2) + "\n")

    print("document nodes seen        : %d" % docs_seen)
    print("documents contributing     : %d" % docs_contributing)
    print("DOC_CODE candidates        : %d" % len(candidates))
    print("distinct code targets      : %d" % payload["distinct_code_targets"])
    print("unreadable document sources: %d" % len(set(unreadable)))
    print("top unresolved reasons     : %s"
          % ", ".join("%s=%d" % kv for kv in sorted(reasons.items(), key=lambda kv: -kv[1])[:6]))
    print("written                    : %s" % args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
