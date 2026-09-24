"""Core tests for the read-only wiki_graph normalizer and seven query operations.

Expected values are hand-written literals derived from the synthetic fixture
tests/fixtures/wiki_graph_synthetic_v1.json. Ceilings are exercised with bounded
test doubles, never large allocations. Nothing here writes to disk.

Run as ``<python-3.11> -I -B tooling/wiki/tests/test_wiki_graph_core.py``. The
runner prints one ``WIKI_GRAPH_PRODUCT_SUMMARY`` JSON line and exits nonzero on
any failure, error, skip, or zero-test run.
"""

import hashlib
import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "wiki_graph_synthetic_v1.json"
FIXTURE_SHA256 = "bd1a2efec3ee741617aac853e5f0ed0160ce1f0faf625f0e1e6b6b4d4be535d8"
OID = "0123456789abcdef0123456789abcdef01234567"
ALT_OID = "fedcba9876543210fedcba9876543210fedcba98"
SUMMARY_PREFIX = "WIKI_GRAPH_PRODUCT_SUMMARY "


def _load(name):
    path = ROOT / f"{name}.py"
    existing = sys.modules.get(name)
    if existing is not None and Path(existing.__file__).resolve() == path:
        return existing
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


core = _load("wiki_graph_core")


def raw_bytes():
    return FIXTURE.read_bytes()


def graph(oid=OID):
    return core.load_graph(raw_bytes(), FIXTURE_SHA256, oid)


def ids(records):
    return [item["node_id"] for item in records]


def triples(edges):
    return [(edge["source_id"], edge["relation"], edge["target_id"]) for edge in edges]


def reason(call):
    try:
        call()
    except core.GraphInputError as exc:
        return exc.reason
    return None


class ReportedLengthBytes(bytes):
    """Real fixture bytes whose reported length is fixed, so the ceiling branch is exercised without allocation."""

    reported = 0

    def __len__(self):
        return self.reported


class ReportedLengthList(list):
    reported = 0

    def __len__(self):
        return self.reported


class CeilingTests(unittest.TestCase):
    def test_graph_bytes_ceiling(self):
        self.assertEqual(core.MAX_GRAPH_BYTES, 67108864)
        for reported, expected in ((core.MAX_GRAPH_BYTES, None), (core.MAX_GRAPH_BYTES + 1, "graph_bytes_ceiling")):
            double = ReportedLengthBytes(raw_bytes())
            double.reported = reported
            with self.subTest(reported=reported):
                self.assertEqual(reason(lambda: core.load_graph(double, FIXTURE_SHA256, OID)), expected)

    def check_count_ceiling(self, member, constant, expected_reason):
        raw = json.loads(raw_bytes())
        for reported, expected in ((constant, None), (constant + 1, expected_reason)):
            doc = dict(raw)
            double = ReportedLengthList(raw[member])
            double.reported = reported
            doc[member] = double
            with self.subTest(member=member, reported=reported):
                self.assertEqual(reason(lambda: core.normalize_graph(doc, "0" * 64, OID)), expected)

    def test_node_count_ceiling(self):
        self.assertEqual(core.MAX_NODES, 250000)
        self.check_count_ceiling("nodes", core.MAX_NODES, "node_count_ceiling")

    def test_link_count_ceiling(self):
        self.assertEqual(core.MAX_LINKS, 1000000)
        self.check_count_ceiling("links", core.MAX_LINKS, "link_count_ceiling")


class EnvelopeTests(unittest.TestCase):
    """The caller-supplied startup envelope: exact graph bytes, expected SHA-256, and source OID."""

    def test_fixture_hash_is_pinned(self):
        self.assertEqual(hashlib.sha256(raw_bytes()).hexdigest(), FIXTURE_SHA256)

    def test_stats_echo_the_caller_envelope(self):
        for oid in (OID, ALT_OID):
            value = core.graph_stats(graph(oid))
            self.assertEqual(value, {
                "status": "ok",
                "source_oid": oid,
                "source_oid_basis": "controller_envelope",
                "graph_sha256": FIXTURE_SHA256,
                "node_count": 68,
                "edge_count": 64,
                "community_count": 3,
                "input_directed": False,
                "traversal_orientation": "source_to_target",
            })

    def test_envelope_refusals(self):
        data = raw_bytes()
        self.assertEqual(reason(lambda: core.load_graph(data, "0" * 64, OID)), "graph_hash_mismatch")
        self.assertEqual(reason(lambda: core.load_graph(data, FIXTURE_SHA256.upper(), OID)), "graph_hash_mismatch")
        self.assertEqual(reason(lambda: core.load_graph(data, FIXTURE_SHA256, OID.upper())), "source_oid")
        self.assertEqual(reason(lambda: core.load_graph(data, FIXTURE_SHA256, OID[:-1])), "source_oid")

    def test_byte_level_refusals(self):
        for payload, expected in ((b"\xff", "utf8"), (b"{", "json"), (b'{"a":1,"a":2}', "duplicate_key"), (b"[NaN]", "json")):
            with self.subTest(payload=payload):
                self.assertEqual(reason(lambda: core.load_graph(payload, hashlib.sha256(payload).hexdigest(), OID)), expected)


class NormalizationTests(unittest.TestCase):
    def test_field_normalization(self):
        g = graph()
        self.assertEqual((g.node("a").kind, g.node("a").qualified_name), ("class", "pkg.Alpha"))
        self.assertEqual(g.node("b").kind, "function_kind")
        self.assertEqual(g.node("c").kind, "typescript_function")
        self.assertEqual(g.node("e").kind, "other_thing")
        self.assertEqual(g.node("t1").qualified_name, "docs/b.md::Twin")
        self.assertEqual(g.node("e").qualified_name, "Epsilon")
        self.assertEqual(g.node("e").source_location, {"start_line": 5, "end_line": 5})
        self.assertEqual(g.node("a").community_id, "1")
        self.assertEqual(g.node("t1").community_id, "extra")

    def test_no_fabricated_provenance(self):
        g = graph()
        self.assertIsNone(g.node("u2").source_file)
        self.assertIsNone(g.node("u2").source_location)
        self.assertIsNone(g.node("d").source_location)
        self.assertIsNone(g.node("e").source_file)
        self.assertIsNone(g.node("solo").community_id)
        documents = [edge.record() for edge in g.edges if edge.relation == "DOCUMENTS"]
        self.assertEqual(documents, [{"source_id": "e", "relation": "DOCUMENTS", "target_id": "f", "source_file": None, "source_location": None}])
        self.assertEqual(sorted({edge.relation for edge in g.edges}), ["CALLS", "CONTAINS", "DOCUMENTS", "IMPORTS", "RELATES_TO", "SELF_LOOP", "SUPPORTS"])

    def test_malformed_graph_refusals(self):
        raw = json.loads(raw_bytes())
        node0 = raw["nodes"][0]
        for mutate, expected in (
            (lambda d: d.update(extra=1), "top_level_members"),
            (lambda d: d.update(directed=True), "directed"),
            (lambda d: d.update(multigraph=True), "multigraph"),
            (lambda d: d.update(graph={"x": 1}), "graph_metadata"),
            (lambda d: d.update(nodes={}), "arrays"),
            (lambda d: d["nodes"].append({**node0, "id": "n", "bogus": 1}), "node_members"),
            (lambda d: d["nodes"].append(dict(node0)), "duplicate_node_id"),
            (lambda d: d["nodes"].extend([{**node0, "id": chr(0x00E9)}, {**node0, "id": "e" + chr(0x0301)}]), "nfc_collision"),
            (lambda d: d["nodes"].append({**node0, "id": "n", "metadata": {"kind": "---"}}), "invalid_kind"),
            (lambda d: d["nodes"][0].update(source_file="..\\x"), "invalid_source_file"),
            (lambda d: d["nodes"][0].update(source_file="/abs"), "invalid_source_file"),
            (lambda d: d["nodes"][0].update(source_location="7"), "invalid_source_location"),
            (lambda d: d["links"].append({**d["links"][1], "target": "nope"}), "dangling_link"),
            (lambda d: d["links"].append(dict(d["links"][1])), "duplicate_link"),
            (lambda d: d["links"].append({key: value for key, value in d["links"][1].items() if key != "relation"}), "link_members"),
        ):
            doc = json.loads(json.dumps(raw))
            mutate(doc)
            with self.subTest(expected=expected):
                self.assertEqual(reason(lambda: core.normalize_graph(doc, "0" * 64, OID)), expected)


class QueryTests(unittest.TestCase):
    def test_query_nfc_normalization_and_bounds(self):
        decomposed = "e" + chr(0x0301)
        self.assertEqual(core.normalize_query(decomposed * 256), chr(0x00E9) * 256)
        for bad in (decomposed * 257, "", "x" * 257):
            with self.subTest(length=len(bad)), self.assertRaises(ValueError):
                core.normalize_query(bad)

    def test_query_rank_order_beats_id_order(self):
        value = core.query_graph(graph(), "b")
        self.assertEqual((value["status"], ids(value["nodes"])), ("ok", ["b", "c", "d", "t1", "t2", "hub"]))

    def test_query_truncated_and_not_found(self):
        value = core.query_graph(graph(), "b", 2)
        self.assertEqual((value["status"], value["total_matches"], ids(value["nodes"])), ("truncated", 6, ["b", "c"]))
        value = core.query_graph(graph(), "node 0", 5)
        self.assertEqual((value["status"], value["total_matches"], ids(value["nodes"])), ("truncated", 9, ["L01", "L02", "L03", "L04", "L05"]))
        self.assertEqual(core.query_graph(graph(), "no-such-token"), {"status": "not_found", "nodes": [], "edges": []})

    def test_query_induced_edges(self):
        value = core.query_graph(graph(), "pkg")
        self.assertEqual(ids(value["nodes"]), ["a", "b", "f", "z"])
        self.assertEqual([(e["source_id"], e["relation"], e["target_id"]) for e in value["edges"]], [("a", "CALLS", "b"), ("a", "IMPORTS", "b"), ("b", "CALLS", "z"), ("f", "SELF_LOOP", "f")])


class NodeTests(unittest.TestCase):
    def test_selectors(self):
        g = graph()
        self.assertEqual(core.get_node(g, node_id="a")["node"]["qualified_name"], "pkg.Alpha")
        self.assertEqual(core.get_node(g, selector="pkg.alpha")["node"]["node_id"], "a")
        self.assertEqual(core.get_node(g, selector="zeta")["node"]["node_id"], "z")
        ambiguous = core.get_node(g, selector="Shared")
        self.assertEqual((ambiguous["status"], ids(ambiguous["candidates"])), ("ambiguous", ["c", "d"]))
        twins = core.get_node(g, selector="twin")
        self.assertEqual((twins["status"], ids(twins["candidates"])), ("ambiguous", ["t1", "t2"]))
        self.assertEqual(core.get_node(g, node_id="A"), {"status": "not_found"})
        self.assertEqual(core.get_node(g, selector="nothing"), {"status": "not_found"})


class NeighborTests(unittest.TestCase):
    def test_directions(self):
        g = graph()
        self.assertEqual(ids(core.get_neighbors(g, "a", "out")["nodes"]), ["b", "c", "d"])
        self.assertEqual(ids(core.get_neighbors(g, "z", "in")["nodes"]), ["b", "c"])
        self.assertEqual(ids(core.get_neighbors(g, "d", "both")["nodes"]), ["a", "e"])
        self.assertEqual(ids(core.get_neighbors(g, "f", "both")["nodes"]), ["e"])

    def test_depth_bound(self):
        g = graph()
        self.assertEqual(ids(core.get_neighbors(g, "a", "out", 2)["nodes"]), ["b", "c", "d", "e", "z"])
        self.assertEqual(ids(core.get_neighbors(g, "a", "out", 3)["nodes"]), ["b", "c", "d", "e", "f", "z"])

    def test_truncated_and_not_found(self):
        g = graph()
        value = core.get_neighbors(g, "hub", "out", 1, 3)
        self.assertEqual((value["status"], value["total_nodes"], ids(value["nodes"])), ("truncated", 55, ["L01", "L02", "L03"]))
        self.assertEqual(triples(value["edges"]), [("hub", "CONTAINS", "L01"), ("hub", "CONTAINS", "L02"), ("hub", "CONTAINS", "L03")])
        self.assertEqual(core.get_neighbors(g, "nope"), {"status": "not_found"})

    def test_root_incident_edges_are_projected(self):
        """Regression for C2 P2: edges touching the root are part of the projection."""
        g = graph()
        value = core.get_neighbors(g, "d", "both")
        self.assertEqual((ids(value["nodes"]), triples(value["edges"])), (["a", "e"], [("a", "RELATES_TO", "d"), ("d", "SUPPORTS", "e")]))
        value = core.get_neighbors(g, "f", "both")
        self.assertEqual((ids(value["nodes"]), triples(value["edges"])), (["e"], [("e", "DOCUMENTS", "f"), ("f", "SELF_LOOP", "f")]))
        value = core.get_neighbors(g, "z", "in")
        self.assertEqual(triples(value["edges"]), [("b", "CALLS", "z"), ("c", "CALLS", "z")])
        value = core.get_neighbors(g, "solo")
        self.assertEqual((value["status"], value["nodes"], value["edges"]), ("ok", [], []))


class PathTests(unittest.TestCase):
    def test_paths(self):
        g = graph()
        value = core.shortest_path(g, "a", "z")
        self.assertEqual(ids(value["nodes"]), ["a", "b", "z"])
        self.assertEqual([edge["relation"] for edge in value["edges"]], ["CALLS", "CALLS"])
        self.assertEqual(core.shortest_path(g, "z", "a"), {"status": "not_found"})
        self.assertEqual(ids(core.shortest_path(g, "z", "a", "undirected")["nodes"]), ["z", "b", "a"])
        self.assertEqual(core.shortest_path(g, "a", "z", max_depth=1), {"status": "not_found"})
        self.assertEqual(ids(core.shortest_path(g, "a", "z", max_depth=2)["nodes"]), ["a", "b", "z"])
        self.assertEqual(core.shortest_path(g, "a", "a")["edges"], [])
        self.assertEqual(core.shortest_path(g, "a", "nope"), {"status": "not_found", "missing_ids": ["nope"]})
        self.assertEqual(ids(core.shortest_path(g, "d", "f")["nodes"]), ["d", "e", "f"])


class CommunityTests(unittest.TestCase):
    def test_communities(self):
        g = graph()
        value = core.get_community(g, "1")
        self.assertEqual((value["status"], ids(value["members"]), len(value["edges"])), ("ok", ["a", "b", "c", "d", "e", "f", "z"], 9))
        value = core.get_community(g, "2", 5)
        self.assertEqual((value["status"], value["total_members"], ids(value["members"])), ("truncated", 58, ["L01", "L02", "L03", "L04", "L05"]))
        self.assertEqual(core.get_community(g, "nope"), {"status": "not_found", "members": [], "edges": []})


class GodNodeTests(unittest.TestCase):
    def test_ranking_ties_and_self_loop(self):
        value = core.god_nodes(graph(), 9)
        self.assertEqual((value["status"], value["total_nodes"]), ("truncated", 68))
        # f carries the self-loop (f,f), counted once as out and once as in, plus (e,f): total 3,
        # tying a (total 3) and ranking after it on out-degree.
        self.assertEqual([item["node"]["node_id"] for item in value["nodes"]], ["hub", "a", "f", "b", "c", "d", "e", "z", "L01"])
        rows = {item["node"]["node_id"]: item for item in value["nodes"]}
        self.assertEqual((rows["hub"]["out_degree"], rows["hub"]["in_degree"], rows["hub"]["total_degree"]), (55, 0, 55))
        self.assertEqual((rows["a"]["out_degree"], rows["a"]["in_degree"]), (3, 0))
        self.assertEqual((rows["f"]["out_degree"], rows["f"]["in_degree"], rows["f"]["total_degree"]), (1, 2, 3))
        self.assertEqual((rows["z"]["out_degree"], rows["z"]["in_degree"]), (0, 2))


class CanonicalJsonTests(unittest.TestCase):
    def test_canonical_bytes(self):
        e_acute = chr(0x00E9)
        self.assertEqual(core.canonical_json_bytes({"b": 1, "a": e_acute}), ('{"a":"' + e_acute + '","b":1}').encode("utf-8"))
        self.assertEqual(core.canonical_json_bytes({"z": [True, None], "a": {"d": 1, "c": 2}}), b'{"a":{"c":2,"d":1},"z":[true,null]}')


def main():
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(stream=sys.stderr, verbosity=2).run(suite)
    checks = {
        "tests_ran": result.testsRun > 0,
        "no_failures": not result.failures and not result.errors,
        "no_skips": not result.skipped and not result.expectedFailures and not result.unexpectedSuccesses,
    }
    summary = {
        "suite": "core",
        "tests_run": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "checks": checks,
        "ok": all(checks.values()),
    }
    sys.stdout.write(SUMMARY_PREFIX + json.dumps(summary, sort_keys=True, separators=(",", ":")) + "\n")
    sys.stdout.flush()
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
