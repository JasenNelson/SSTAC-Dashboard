"""Canonicalize Graphify output into a portable, closed graph.

Graphify's raw --no-cluster output can retain absolute scan-root prefixes on
unresolved edge endpoints and can omit explicit node records for reference
targets. This module removes only the exact current runtime-root encoding,
materializes every remaining endpoint with edge-derived provenance, and
validates the closed graph before it can be published.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path


class GraphIntegrityError(ValueError):
    pass


def _require_absolute_windows_root(runtime_root: str) -> str:
    if not isinstance(runtime_root, str) or not re.match(
        r"^[A-Za-z]:[\\/]", runtime_root
    ):
        raise GraphIntegrityError(
            "runtime root must be an absolute drive-qualified Windows path"
        )
    normalized = re.sub(
        r"/+", "/", runtime_root.replace("\\", "/")
    ).rstrip("/").casefold()
    if len(normalized) < 16 or normalized.count("/") < 2:
        raise GraphIntegrityError(
            "runtime root is too weak for low-false-positive matching"
        )
    return normalized


def slugify_path(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")


def runtime_root_encodings(runtime_root: str) -> dict[str, str]:
    normalized = _require_absolute_windows_root(runtime_root)
    return {
        "normalized": normalized,
        "slugged": slugify_path(normalized),
    }


def runtime_root_encoding_hits(
    candidate_id: str, runtime_root: str
) -> tuple[str, ...]:
    if not isinstance(candidate_id, str):
        raise GraphIntegrityError("graph ID must be a string")
    encodings = runtime_root_encodings(runtime_root)
    normalized_id = re.sub(
        r"/+", "/", candidate_id.replace("\\", "/")
    ).casefold()
    slug_shaped_id = re.fullmatch(r"[A-Za-z0-9_]+", candidate_id) is not None
    slugged_id = candidate_id.casefold() if slug_shaped_id else ""

    literal_pattern = (
        r"(?<![a-z0-9])"
        + re.escape(encodings["normalized"])
        + r"(?=$|[/\\:#@|])"
    )
    slug_pattern = (
        r"(?:^|_)"
        + re.escape(encodings["slugged"])
        + r"(?:_|$)"
    )

    hits = []
    if re.search(literal_pattern, normalized_id):
        hits.append("normalized")
    if slug_shaped_id and re.search(slug_pattern, slugged_id):
        hits.append("slugged")
    return tuple(hits)


def validate_graph_integrity(graph: dict, runtime_root: str) -> dict:
    nodes = graph.get("nodes")
    links = graph.get("links")
    hyperedges = graph.get("hyperedges", [])
    if not isinstance(nodes, list) or not isinstance(links, list):
        raise GraphIntegrityError("graph nodes and links must be arrays")
    if not isinstance(hyperedges, list):
        raise GraphIntegrityError("graph hyperedges must be an array when present")

    node_ids = []
    for node in nodes:
        node_id = node.get("id") if isinstance(node, dict) else None
        if not isinstance(node_id, str) or not node_id.strip():
            raise GraphIntegrityError(
                "every node must have a nonempty string ID"
            )
        node_ids.append(node_id)
    if len(set(node_ids)) != len(node_ids):
        raise GraphIntegrityError("node IDs must be unique")

    declared = set(node_ids)
    referenced_node_ids = set()
    runtime_hits = []
    for node_id in node_ids:
        hits = runtime_root_encoding_hits(node_id, runtime_root)
        if hits:
            runtime_hits.append(
                {"id": node_id, "location": "node", "encodings": list(hits)}
            )

    undeclared = []
    for index, link in enumerate(links):
        if not isinstance(link, dict):
            raise GraphIntegrityError("every link must be an object")
        for field in ("source", "target"):
            endpoint = link.get(field)
            if not isinstance(endpoint, str) or not endpoint.strip():
                raise GraphIntegrityError(
                    f"link {index} has an invalid {field} endpoint"
                )
            referenced_node_ids.add(endpoint)
            if endpoint not in declared:
                undeclared.append(
                    {"link_index": index, "field": field, "id": endpoint}
                )
            hits = runtime_root_encoding_hits(endpoint, runtime_root)
            if hits:
                runtime_hits.append(
                    {
                        "id": endpoint,
                        "location": f"link[{index}].{field}",
                        "encodings": list(hits),
                    }
                )

    undeclared_hyperedge_members = []
    for index, hyperedge in enumerate(hyperedges):
        if not isinstance(hyperedge, dict):
            raise GraphIntegrityError("every hyperedge must be an object")
        if "members" in hyperedge or "node_ids" in hyperedge:
            raise GraphIntegrityError(
                f"hyperedge {index} uses a noncanonical member alias"
            )
        members = hyperedge.get("nodes")
        if not isinstance(members, list) or not members:
            raise GraphIntegrityError(
                f"hyperedge {index} must have a nonempty nodes array"
            )
        for member_index, member in enumerate(members):
            if not isinstance(member, str) or not member.strip():
                raise GraphIntegrityError(
                    f"hyperedge {index} has an invalid nodes[{member_index}] member"
                )
            referenced_node_ids.add(member)
            if member not in declared:
                undeclared_hyperedge_members.append(
                    {
                        "hyperedge_index": index,
                        "member_index": member_index,
                        "id": member,
                    }
                )
            hits = runtime_root_encoding_hits(member, runtime_root)
            if hits:
                runtime_hits.append(
                    {
                        "id": member,
                        "location": f"hyperedge[{index}].nodes[{member_index}]",
                        "encodings": list(hits),
                    }
                )

    if undeclared:
        raise GraphIntegrityError(
            f"{len(undeclared)} link endpoint occurrence(s) are undeclared"
        )
    if undeclared_hyperedge_members:
        raise GraphIntegrityError(
            f"{len(undeclared_hyperedge_members)} hyperedge member occurrence(s) "
            "are undeclared"
        )
    if runtime_hits:
        raise GraphIntegrityError(
            f"{len(runtime_hits)} runtime-root-derived graph ID occurrence(s)"
        )

    return {
        "node_count": len(node_ids),
        "link_count": len(links),
        "hyperedge_count": len(hyperedges),
        "declared_isolated_node_count": len(declared - referenced_node_ids),
        "undeclared_endpoint_occurrence_count": 0,
        "undeclared_hyperedge_member_occurrence_count": 0,
        "runtime_root_derived_id_occurrence_count": 0,
    }


def _portable_runtime_id(value: str, runtime_root: str) -> str:
    encodings = runtime_root_encodings(runtime_root)
    normalized_value = re.sub(
        r"/+", "/", value.replace("\\", "/")
    ).casefold()
    normalized_root = encodings["normalized"]

    if normalized_value == normalized_root:
        raise GraphIntegrityError(
            "runtime-root-derived ID has no repository-relative suffix"
        )
    if normalized_value.startswith(normalized_root + "/"):
        relative = normalized_value[len(normalized_root) + 1 :]
        portable = slugify_path(relative)
        if not portable:
            raise GraphIntegrityError(
                "literal runtime-root-derived ID has no portable suffix"
            )
        return portable

    slugged_root = encodings["slugged"]
    slug_shaped = re.fullmatch(r"[A-Za-z0-9_]+", value) is not None
    folded = value.casefold()
    if slug_shaped and folded == slugged_root:
        raise GraphIntegrityError(
            "slugged runtime-root-derived ID has no portable suffix"
        )
    if slug_shaped and folded.startswith(slugged_root + "_"):
        portable = folded[len(slugged_root) + 1 :]
        if not portable:
            raise GraphIntegrityError(
                "slugged runtime-root-derived ID has no portable suffix"
            )
        return portable
    return value


def _runtime_source_form(value: str, runtime_root: str) -> tuple[str, str] | None:
    encodings = runtime_root_encodings(runtime_root)
    normalized_value = re.sub(
        r"/+", "/", value.replace("\\", "/")
    ).casefold()
    normalized_root = encodings["normalized"]
    if normalized_value.startswith(normalized_root + "/"):
        return ("literal", normalized_value[len(normalized_root) + 1 :])

    folded = value.casefold()
    slugged_root = encodings["slugged"]
    if (
        re.fullmatch(r"[A-Za-z0-9_]+", value) is not None
        and folded.startswith(slugged_root + "_")
    ):
        return ("slugged", folded[len(slugged_root) + 1 :])
    return None


def _is_prior_materialized_endpoint(node: object) -> bool:
    if not isinstance(node, dict):
        return False
    metadata = node.get("metadata")
    return (
        isinstance(metadata, dict)
        and metadata.get("kind") == "materialized_edge_endpoint"
    )


def _reference_class(endpoint: str, records: list[dict]) -> str:
    relations = {str(record.get("relation") or "") for record in records}
    source_files = {
        str(record.get("source_file") or "").replace("\\", "/")
        for record in records
        if record.get("source_file")
    }
    if endpoint.startswith("ref_"):
        return "external_reference"
    if (
        source_files
        and relations <= {"imports", "imports_from"}
        and all(
            source_file.lower().endswith(".py")
            for source_file in source_files
        )
    ):
        return "python_module_reference"
    return "unresolved_graph_reference"


def _materialized_node(endpoint: str, records: list[dict]) -> dict:
    relations = Counter(
        str(record.get("relation") or "unknown") for record in records
    )
    source_files = sorted(
        {
            str(record.get("source_file") or "").replace("\\", "/")
            for record in records
            if record.get("source_file")
        }
    )
    source_locations = sorted(
        {
            str(record.get("source_location") or "")
            for record in records
            if record.get("source_location")
        }
    )
    return {
        "id": endpoint,
        "label": endpoint,
        "file_type": "concept",
        "source_file": "",
        "source_location": None,
        "metadata": {
            "kind": "materialized_edge_endpoint",
            "reference_class": _reference_class(endpoint, records),
            "materialized_by": "sstac_repository_graph_canonicalizer",
            "incident_edge_count": len(records),
            "relations": dict(sorted(relations.items())),
            "source_files": source_files,
            "source_locations": source_locations,
        },
    }


def canonicalize_graph(graph: dict, runtime_root: str) -> tuple[dict, dict]:
    nodes = graph.get("nodes")
    links = graph.get("links")
    hyperedges = graph.get("hyperedges", [])
    if not isinstance(nodes, list) or not isinstance(links, list):
        raise GraphIntegrityError("graph nodes and links must be arrays")
    if not isinstance(hyperedges, list):
        raise GraphIntegrityError("graph hyperedges must be an array when present")

    prior_materialized = [
        node for node in nodes if _is_prior_materialized_endpoint(node)
    ]
    source_nodes = [
        node for node in nodes if not _is_prior_materialized_endpoint(node)
    ]
    source_communities_complete = bool(source_nodes) and all(
        isinstance(node, dict)
        and type(node.get("community")) is int
        and node["community"] >= 0
        for node in source_nodes
    )
    remap = {}
    observed_ids = set()

    def record_remap(candidate_id: object, location: str) -> None:
        if not isinstance(candidate_id, str) or not candidate_id.strip():
            raise GraphIntegrityError(
                f"{location} must have a nonempty string ID"
            )
        observed_ids.add(candidate_id)
        portable = _portable_runtime_id(candidate_id, runtime_root)
        if portable != candidate_id:
            remap[candidate_id] = portable

    for node in source_nodes:
        node_id = node.get("id") if isinstance(node, dict) else None
        record_remap(node_id, "every node")

    for link_index, link in enumerate(links):
        if not isinstance(link, dict):
            raise GraphIntegrityError("every link must be an object")
        for field in ("source", "target"):
            record_remap(link.get(field), f"link {link_index} {field}")

    for hyperedge_index, hyperedge in enumerate(hyperedges):
        if not isinstance(hyperedge, dict):
            raise GraphIntegrityError("every hyperedge must be an object")
        if "members" in hyperedge or "node_ids" in hyperedge:
            raise GraphIntegrityError(
                f"hyperedge {hyperedge_index} uses a noncanonical member alias"
            )
        members = hyperedge.get("nodes")
        if not isinstance(members, list) or not members:
            raise GraphIntegrityError(
                f"hyperedge {hyperedge_index} must have a nonempty nodes array"
            )
        for member_index, member in enumerate(members):
            record_remap(
                member,
                f"hyperedge {hyperedge_index} nodes[{member_index}]",
            )

    # Case and separator variants of one Windows path, including its Graphify
    # slug form, are semantically identical and may converge. Distinct literal
    # repository-relative paths that slugify to one ID remain a hard collision.
    target_to_source_forms = defaultdict(set)
    for source, target in remap.items():
        source_form = _runtime_source_form(source, runtime_root)
        if source_form is None:
            raise GraphIntegrityError(
                f"runtime-root remap source has no recognized form: {source}"
            )
        target_to_source_forms[target].add(source_form)
    collisions = {
        target: sorted(source_forms)
        for target, source_forms in target_to_source_forms.items()
        if len(source_forms) > 1
    }
    if collisions:
        raise GraphIntegrityError(
            f"runtime-root remap would collapse {len(collisions)} ID group(s)"
        )
    existing_target_collisions = {
        target
        for target in remap.values()
        if target in observed_ids and target not in remap
    }
    if existing_target_collisions:
        raise GraphIntegrityError(
            "runtime-root remap collides with existing graph ID(s): "
            + ", ".join(sorted(existing_target_collisions))
        )

    remapped_nodes = []
    seen_node_ids = set()
    for node in source_nodes:
        copied = dict(node)
        copied["id"] = remap.get(copied["id"], copied["id"])
        if copied["id"] in seen_node_ids:
            raise GraphIntegrityError(
                f"runtime-root remap collides with node ID {copied['id']}"
            )
        seen_node_ids.add(copied["id"])
        remapped_nodes.append(copied)

    remapped_links = []
    incident = defaultdict(list)
    for link in links:
        copied = dict(link)
        copied["source"] = remap.get(copied["source"], copied["source"])
        copied["target"] = remap.get(copied["target"], copied["target"])
        remapped_links.append(copied)
        incident[copied["source"]].append(copied)
        if copied["target"] != copied["source"]:
            incident[copied["target"]].append(copied)

    endpoints = {
        endpoint
        for link in remapped_links
        for endpoint in (link["source"], link["target"])
    }
    missing = sorted(endpoints - seen_node_ids)
    materialized = [
        _materialized_node(endpoint, incident[endpoint])
        for endpoint in missing
    ]
    if source_communities_complete:
        prior_communities = {}
        for node in prior_materialized:
            node_id = node.get("id")
            community = node.get("community")
            if (
                isinstance(node_id, str)
                and node_id.strip()
                and type(community) is int
                and community >= 0
            ):
                portable_id = _portable_runtime_id(node_id, runtime_root)
                existing = prior_communities.get(portable_id)
                if existing is not None and existing != community:
                    raise GraphIntegrityError(
                        f"conflicting prior materialized communities for {portable_id}"
                    )
                prior_communities[portable_id] = community
        for node in materialized:
            if node["id"] in prior_communities:
                node["community"] = prior_communities[node["id"]]

    remapped_hyperedges = []
    for hyperedge in hyperedges:
        copied = dict(hyperedge)
        copied["nodes"] = [
            remap.get(member, member) for member in copied["nodes"]
        ]
        remapped_hyperedges.append(copied)

    result = dict(graph)
    result["nodes"] = remapped_nodes + materialized
    result["links"] = remapped_links
    if "hyperedges" in result:
        result["hyperedges"] = remapped_hyperedges

    integrity = validate_graph_integrity(result, runtime_root)
    receipt = {
        "schema_version": "1.0.0",
        "portable_id_scheme": "repo-relative-slug-v1",
        "remapped_runtime_root_id_count": len(remap),
        "removed_prior_materialized_endpoint_node_count": len(
            prior_materialized
        ),
        "materialized_endpoint_node_count": len(materialized),
        **integrity,
    }
    return result, receipt


def _write_json_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--graph", required=True, type=Path)
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--receipt", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        graph = json.loads(args.graph.read_text(encoding="utf-8"))
        canonical, receipt = canonicalize_graph(
            graph, str(args.repo_root.resolve())
        )
        _write_json_atomic(args.graph, canonical)
        if args.receipt:
            _write_json_atomic(args.receipt, receipt)
        print(json.dumps(receipt, sort_keys=True))
        return 0
    except (GraphIntegrityError, OSError, json.JSONDecodeError) as exc:
        print(f"FAIL: graph canonicalization: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
