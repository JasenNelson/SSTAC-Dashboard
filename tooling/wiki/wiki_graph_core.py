"""Pure, deterministic normalization and query logic for the read-only wiki graph."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Iterable

MAX_GRAPH_BYTES = 67_108_864
MAX_NODES = 250_000
MAX_LINKS = 1_000_000
MAX_QUERY_SCALARS = 256


class GraphInputError(ValueError):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


class DuplicateKeyError(ValueError):
    pass


def _pairs_hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise DuplicateKeyError(key)
        out[key] = value
    return out


def _reject_constant(_: str) -> Any:
    raise ValueError("non_finite_number")


def parse_json_strict(text: str) -> Any:
    """Parse JSON rejecting duplicate keys and NaN/Infinity constants."""
    return json.loads(text, object_pairs_hook=_pairs_hook, parse_constant=_reject_constant)


def canonical_json_bytes(value: Any) -> bytes:
    """RFC 8785 bytes for the value domain used here (strings, integers, booleans, null, containers)."""
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _scalar(value: Any, name: str) -> str:
    if not isinstance(value, str):
        raise GraphInputError(f"invalid_{name}")
    if any(0xD800 <= ord(ch) <= 0xDFFF for ch in value):
        raise GraphInputError(f"invalid_{name}")
    return value


def _nfc(value: Any, name: str, *, nonempty: bool = False) -> str:
    value = _scalar(value, name)
    if unicodedata.normalize("NFC", value) != value:
        raise GraphInputError(f"invalid_{name}")
    if nonempty and not value:
        raise GraphInputError(f"invalid_{name}")
    return value


def _source_file(value: Any) -> str | None:
    value = _nfc(value, "source_file")
    if not value:
        return None
    if "\\" in value or ":" in value or "\x00" in value or value.startswith("/"):
        raise GraphInputError("invalid_source_file")
    if any(part in ("", ".", "..") for part in value.split("/")):
        raise GraphInputError("invalid_source_file")
    return value


def _location(value: Any) -> dict[str, int] | None:
    if value is None:
        return None
    value = _nfc(value, "source_location")
    if not value:
        return None
    if re.fullmatch(r"L[1-9][0-9]*", value) is None:
        raise GraphInputError("invalid_source_location")
    line = int(value[1:])
    return {"start_line": line, "end_line": line}


def _kind(value: str) -> str:
    value = value.strip(" \t\n\r\x0b\x0c")
    value = "".join(chr(ord(ch) + 32) if "A" <= ch <= "Z" else ch for ch in value)
    value = re.sub(r"[^a-z0-9_]+", "_", value).strip("_")
    if not value:
        raise GraphInputError("invalid_kind")
    return value


def _relation(value: Any) -> str:
    value = _nfc(value, "relation").strip(" \t\n\r\x0b\x0c")
    value = "".join(chr(ord(ch) - 32) if "a" <= ch <= "z" else ch for ch in value)
    value = re.sub(r"[^A-Z0-9_]+", "_", value).strip("_")
    if not value:
        raise GraphInputError("invalid_relation")
    return value


def _community(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise GraphInputError("invalid_community")
    if isinstance(value, int):
        if value < 0:
            raise GraphInputError("invalid_community")
        return str(value)
    return _nfc(value, "community", nonempty=True)


@dataclass(frozen=True)
class Node:
    node_id: str
    label: str
    qualified_name: str
    kind: str
    community_id: str | None
    source_file: str | None
    source_location: dict[str, int] | None

    def record(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "label": self.label,
            "qualified_name": self.qualified_name,
            "kind": self.kind,
            "community_id": self.community_id,
            "source_file": self.source_file,
            "source_location": self.source_location,
        }


@dataclass(frozen=True)
class Edge:
    source_id: str
    relation: str
    target_id: str
    source_file: str | None
    source_location: dict[str, int] | None

    def record(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "relation": self.relation,
            "target_id": self.target_id,
            "source_file": self.source_file,
            "source_location": self.source_location,
        }

    def sort_key(self) -> tuple[Any, ...]:
        line = 0 if self.source_location is None else self.source_location["start_line"]
        return (self.source_id, self.relation, self.target_id, self.source_file or "", line)


@dataclass(frozen=True)
class Graph:
    nodes: tuple[Node, ...]
    edges: tuple[Edge, ...]
    graph_sha256: str
    source_oid: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "_nodes", {node.node_id: node for node in self.nodes})
        out: dict[str, list[Edge]] = defaultdict(list)
        incoming: dict[str, list[Edge]] = defaultdict(list)
        for edge in self.edges:
            out[edge.source_id].append(edge)
            incoming[edge.target_id].append(edge)
        object.__setattr__(self, "_out", {k: tuple(sorted(v, key=Edge.sort_key)) for k, v in out.items()})
        object.__setattr__(self, "_in", {k: tuple(sorted(v, key=Edge.sort_key)) for k, v in incoming.items()})

    def node(self, node_id: str) -> Node | None:
        return self._nodes.get(node_id)

    def records(self, ids: Iterable[str]) -> list[dict[str, Any]]:
        return [self._nodes[node_id].record() for node_id in sorted(ids)]

    def induced_edges(self, ids: set[str]) -> list[dict[str, Any]]:
        return [edge.record() for edge in self.edges if edge.source_id in ids and edge.target_id in ids]


def load_graph(raw_bytes: bytes, graph_sha256: str, source_oid: str) -> Graph:
    """Validate exact graph bytes against the controller pins, then normalize."""
    if len(raw_bytes) > MAX_GRAPH_BYTES:
        raise GraphInputError("graph_bytes_ceiling")
    if hashlib.sha256(raw_bytes).hexdigest() != graph_sha256:
        raise GraphInputError("graph_hash_mismatch")
    if re.fullmatch(r"[0-9a-f]{40}", source_oid) is None:
        raise GraphInputError("source_oid")
    try:
        text = bytes(raw_bytes).decode("utf-8")
    except UnicodeDecodeError as exc:
        raise GraphInputError("utf8") from exc
    try:
        raw = parse_json_strict(text)
    except DuplicateKeyError as exc:
        raise GraphInputError("duplicate_key") from exc
    except ValueError as exc:
        raise GraphInputError("json") from exc
    return normalize_graph(raw, graph_sha256, source_oid)


NODE_REQUIRED = {"id", "label", "file_type", "source_file", "source_location"}
NODE_ALLOWED = NODE_REQUIRED | {"metadata", "_origin", "community", "community_name", "norm_label"}
LINK_REQUIRED = {"source", "target", "relation", "source_file", "source_location"}
LINK_ALLOWED = LINK_REQUIRED | {"confidence", "confidence_score", "weight", "_origin"}


def normalize_graph(raw: Any, graph_sha256: str, source_oid: str) -> Graph:
    """All-or-nothing normalization of a parsed raw graph document."""
    if not isinstance(raw, dict):
        raise GraphInputError("top_level")
    if set(raw) != {"directed", "multigraph", "graph", "nodes", "links"}:
        raise GraphInputError("top_level_members")
    if raw["directed"] is not False:
        raise GraphInputError("directed")
    if raw["multigraph"] is not False:
        raise GraphInputError("multigraph")
    if raw["graph"] != {} or not isinstance(raw["graph"], dict):
        raise GraphInputError("graph_metadata")
    if not isinstance(raw["nodes"], list) or not isinstance(raw["links"], list):
        raise GraphInputError("arrays")
    if len(raw["nodes"]) > MAX_NODES:
        raise GraphInputError("node_count_ceiling")
    if len(raw["links"]) > MAX_LINKS:
        raise GraphInputError("link_count_ceiling")
    raw_ids: list[str] = []
    for item in raw["nodes"]:
        if not isinstance(item, dict) or not NODE_REQUIRED.issubset(item) or not set(item).issubset(NODE_ALLOWED):
            raise GraphInputError("node_members")
        raw_ids.append(_scalar(item["id"], "node_id"))
    if len(set(raw_ids)) != len(raw_ids):
        raise GraphInputError("duplicate_node_id")
    if len({unicodedata.normalize("NFC", node_id) for node_id in raw_ids}) != len(raw_ids):
        raise GraphInputError("nfc_collision")
    nodes: list[Node] = []
    for item in raw["nodes"]:
        node_id = _nfc(item["id"], "node_id", nonempty=True)
        label = _nfc(item["label"], "label", nonempty=True)
        file_type = _nfc(item["file_type"], "file_type", nonempty=True)
        source_file = _source_file(item["source_file"])
        source_location = _location(item["source_location"])
        metadata = item.get("metadata", {})
        if not isinstance(metadata, dict):
            raise GraphInputError("invalid_metadata")
        qname_value = metadata.get("qualified_name")
        if qname_value is not None and not isinstance(qname_value, str):
            raise GraphInputError("invalid_qualified_name")
        if qname_value:
            qualified_name = _nfc(qname_value, "qualified_name", nonempty=True)
        elif source_file:
            qualified_name = f"{source_file}::{label}"
        else:
            qualified_name = label
        kind_value = metadata.get("kind")
        if kind_value is not None and not isinstance(kind_value, str):
            raise GraphInputError("invalid_kind")
        kind = _kind(_nfc(kind_value if kind_value else file_type, "kind", nonempty=True))
        community = _community(item.get("community"))
        nodes.append(Node(node_id, label, qualified_name, kind, community, source_file, source_location))
    ids = set(raw_ids)
    edges: list[Edge] = []
    seen: set[tuple[Any, ...]] = set()
    for item in raw["links"]:
        if not isinstance(item, dict) or not LINK_REQUIRED.issubset(item) or not set(item).issubset(LINK_ALLOWED):
            raise GraphInputError("link_members")
        source_id = _nfc(item["source"], "source_id", nonempty=True)
        target_id = _nfc(item["target"], "target_id", nonempty=True)
        if source_id not in ids or target_id not in ids:
            raise GraphInputError("dangling_link")
        edge = Edge(source_id, _relation(item["relation"]), target_id, _source_file(item["source_file"]), _location(item["source_location"]))
        if edge.sort_key() in seen:
            raise GraphInputError("duplicate_link")
        seen.add(edge.sort_key())
        edges.append(edge)
    return Graph(tuple(sorted(nodes, key=lambda node: node.node_id)), tuple(sorted(edges, key=Edge.sort_key)), graph_sha256, source_oid)


def normalize_query(query: str) -> str:
    """NFC-normalize first, then enforce the 1..256 Unicode scalar bound."""
    value = unicodedata.normalize("NFC", query)
    if any(0xD800 <= ord(ch) <= 0xDFFF for ch in value) or not 1 <= len(value) <= MAX_QUERY_SCALARS:
        raise ValueError("INVALID_query")
    return value


def graph_stats(graph: Graph) -> dict[str, Any]:
    return {
        "status": "ok",
        "source_oid": graph.source_oid,
        "source_oid_basis": "controller_envelope",
        "graph_sha256": graph.graph_sha256,
        "node_count": len(graph.nodes),
        "edge_count": len(graph.edges),
        "community_count": len({node.community_id for node in graph.nodes if node.community_id is not None}),
        "input_directed": False,
        "traversal_orientation": "source_to_target",
    }


def _whole_token(field: str, query: str) -> bool:
    start = field.find(query)
    while start != -1:
        end = start + len(query)
        before = start == 0 or not field[start - 1].isalnum()
        after = end == len(field) or not field[end].isalnum()
        if before and after:
            return True
        start = field.find(query, start + 1)
    return False


def _match_rank(node: Node, folded_query: str) -> int | None:
    fields = [node.node_id, node.qualified_name, node.label]
    if node.source_file is not None:
        fields.append(node.source_file)
    fields.append(node.kind)
    folded = [unicodedata.normalize("NFC", field).casefold() for field in fields]
    if folded_query == folded[0]:
        return 0
    if folded_query == folded[1]:
        return 1
    if folded_query == folded[2]:
        return 2
    if any(field.startswith(folded_query) for field in folded):
        return 3
    if any(_whole_token(field, folded_query) for field in folded):
        return 4
    if any(folded_query in field for field in folded):
        return 5
    return None


def query_graph(graph: Graph, query: str, limit: int = 20) -> dict[str, Any]:
    folded_query = normalize_query(query).casefold()
    matches = sorted(
        ((rank, node.node_id) for node in graph.nodes if (rank := _match_rank(node, folded_query)) is not None)
    )
    selected = [node_id for _, node_id in matches[:limit]]
    nodes = [graph.node(node_id).record() for node_id in selected]
    edges = graph.induced_edges(set(selected))
    if not matches:
        return {"status": "not_found", "nodes": [], "edges": []}
    if len(matches) > limit:
        return {"status": "truncated", "total_matches": len(matches), "nodes": nodes, "edges": edges}
    return {"status": "ok", "nodes": nodes, "edges": edges}


def get_node(graph: Graph, *, node_id: str | None = None, selector: str | None = None) -> dict[str, Any]:
    if node_id is not None:
        node = graph.node(node_id)
        return {"status": "ok", "node": node.record()} if node else {"status": "not_found"}
    assert selector is not None
    folded = unicodedata.normalize("NFC", selector).casefold()
    candidates = [node for node in graph.nodes if unicodedata.normalize("NFC", node.qualified_name).casefold() == folded]
    if not candidates:
        candidates = [node for node in graph.nodes if unicodedata.normalize("NFC", node.label).casefold() == folded]
    if not candidates:
        return {"status": "not_found"}
    if len(candidates) > 1:
        return {"status": "ambiguous", "candidates": [node.record() for node in sorted(candidates, key=lambda n: n.node_id)]}
    return {"status": "ok", "node": candidates[0].record()}


def get_neighbors(graph: Graph, node_id: str, direction: str = "both", depth: int = 1, limit: int = 20) -> dict[str, Any]:
    root = graph.node(node_id)
    if root is None:
        return {"status": "not_found"}
    seen = {node_id}
    frontier = [node_id]
    for _ in range(depth):
        found: set[str] = set()
        for current in frontier:
            if direction in ("out", "both"):
                found.update(edge.target_id for edge in graph._out.get(current, ()))
            if direction in ("in", "both"):
                found.update(edge.source_id for edge in graph._in.get(current, ()))
        found -= seen
        if not found:
            break
        seen.update(found)
        frontier = sorted(found)
    ids = sorted(seen - {node_id})
    selected = ids[:limit]
    # The edge projection includes the root, so root-incident relationships are returned.
    payload = {"root": root.record(), "nodes": graph.records(selected), "edges": graph.induced_edges(set(selected) | {node_id})}
    if len(ids) > limit:
        return {"status": "truncated", "total_nodes": len(ids), **payload}
    return {"status": "ok", **payload}


def _steps(graph: Graph, current: str, mode: str) -> set[str]:
    nxt = {edge.target_id for edge in graph._out.get(current, ())}
    if mode == "undirected":
        nxt.update(edge.source_id for edge in graph._in.get(current, ()))
    nxt.discard(current)
    return nxt


def _reverse_steps(graph: Graph, current: str, mode: str) -> set[str]:
    prv = {edge.source_id for edge in graph._in.get(current, ())}
    if mode == "undirected":
        prv.update(edge.target_id for edge in graph._out.get(current, ()))
    prv.discard(current)
    return prv


def shortest_path(graph: Graph, source_id: str, target_id: str, mode: str = "directed", max_depth: int = 6) -> dict[str, Any]:
    missing = [item for item in (source_id, target_id) if graph.node(item) is None]
    if missing:
        return {"status": "not_found", "missing_ids": missing}
    if source_id == target_id:
        return {"status": "ok", "nodes": [graph.node(source_id).record()], "edges": []}
    # Distances to the target, searched backwards, bounded by max_depth.
    to_target = {target_id: 0}
    frontier = [target_id]
    level = 0
    while frontier and source_id not in to_target and level < max_depth:
        level += 1
        found: set[str] = set()
        for current in frontier:
            for prev in _reverse_steps(graph, current, mode):
                if prev not in to_target:
                    found.add(prev)
        for item in found:
            to_target[item] = level
        frontier = sorted(found)
    if source_id not in to_target:
        return {"status": "not_found"}
    path = [source_id]
    while path[-1] != target_id:
        remaining = to_target[path[-1]]
        path.append(min(item for item in _steps(graph, path[-1], mode) if to_target.get(item) == remaining - 1))
    edges: list[dict[str, Any]] = []
    for left, right in zip(path, path[1:]):
        options = [edge for edge in graph._out.get(left, ()) if edge.target_id == right]
        if mode == "undirected":
            options.extend(edge for edge in graph._in.get(left, ()) if edge.source_id == right)
        edges.append(min(options, key=Edge.sort_key).record())
    return {"status": "ok", "nodes": [graph.node(item).record() for item in path], "edges": edges}


def get_community(graph: Graph, community_id: str, limit: int = 50) -> dict[str, Any]:
    members = [node for node in graph.nodes if node.community_id == community_id]
    if not members:
        return {"status": "not_found", "members": [], "edges": []}
    selected = members[:limit]
    payload = {"members": [node.record() for node in selected], "edges": graph.induced_edges({node.node_id for node in selected})}
    if len(members) > limit:
        return {"status": "truncated", "total_members": len(members), **payload}
    return {"status": "ok", **payload}


def god_nodes(graph: Graph, limit: int = 10) -> dict[str, Any]:
    pairs = {(edge.source_id, edge.target_id) for edge in graph.edges}
    outdegree: dict[str, int] = defaultdict(int)
    indegree: dict[str, int] = defaultdict(int)
    for source_id, target_id in pairs:
        outdegree[source_id] += 1
        indegree[target_id] += 1
    rows = sorted(
        graph.nodes,
        key=lambda node: (-(outdegree[node.node_id] + indegree[node.node_id]), -outdegree[node.node_id], -indegree[node.node_id], node.node_id),
    )
    items = [
        {
            "node": node.record(),
            "total_degree": outdegree[node.node_id] + indegree[node.node_id],
            "out_degree": outdegree[node.node_id],
            "in_degree": indegree[node.node_id],
        }
        for node in rows[:limit]
    ]
    if len(rows) > limit:
        return {"status": "truncated", "total_nodes": len(rows), "nodes": items}
    return {"status": "ok", "nodes": items}
