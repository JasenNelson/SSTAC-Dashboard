import copy
import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parent.parent / "canonicalize_graph.py"
SPEC = importlib.util.spec_from_file_location("canonicalize_graph", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CanonicalizeGraphTests(unittest.TestCase):
    root_a = r"C:\Lab\sstac-runtime-alpha"
    root_b = r"D:\Builds\sstac-runtime-beta"

    @staticmethod
    def slug(value):
        return MODULE.slugify_path(value)

    def contaminated_graph(self, root):
        root_slug = self.slug(root)
        return {
            "nodes": [
                {
                    "id": root_slug + "_src_alpha_widget",
                    "label": "Widget",
                    "source_file": "src/alpha.ts",
                },
                {
                    "id": "isolated",
                    "label": "isolated",
                    "source_file": "src/isolated.ts",
                },
            ],
            "links": [
                {
                    "source": root_slug + "_src_alpha_widget",
                    "target": root_slug + "_src_beta_helper",
                    "relation": "calls",
                    "source_file": "src/alpha.ts",
                    "source_location": "L7",
                    "confidence": "EXTRACTED",
                },
                {
                    "source": root_slug + "_src_alpha_widget",
                    "target": "ref_react",
                    "relation": "imports_from",
                    "source_file": "src/alpha.ts",
                    "source_location": "L1",
                    "confidence": "EXTRACTED",
                },
            ],
            "hyperedges": [],
        }

    def test_distinct_runtime_roots_produce_identical_graph_identity(self):
        graph_a, _ = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        graph_b, _ = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_b), self.root_b
        )
        self.assertEqual(
            sorted(node["id"] for node in graph_a["nodes"]),
            sorted(node["id"] for node in graph_b["nodes"]),
        )
        self.assertEqual(
            sorted(
                (link["source"], link["target"], link["relation"])
                for link in graph_a["links"]
            ),
            sorted(
                (link["source"], link["target"], link["relation"])
                for link in graph_b["links"]
            ),
        )

    def test_runtime_derived_endpoint_is_remapped_and_declared(self):
        graph, receipt = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        declared = {node["id"] for node in graph["nodes"]}
        self.assertIn("src_beta_helper", declared)
        self.assertEqual(receipt["undeclared_endpoint_occurrence_count"], 0)
        self.assertGreater(receipt["remapped_runtime_root_id_count"], 0)

    def test_materialized_reference_has_edge_derived_provenance(self):
        graph, _ = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        node = next(node for node in graph["nodes"] if node["id"] == "ref_react")
        metadata = node["metadata"]
        self.assertEqual(metadata["kind"], "materialized_edge_endpoint")
        self.assertEqual(metadata["incident_edge_count"], 1)
        self.assertEqual(metadata["relations"], {"imports_from": 1})
        self.assertEqual(metadata["source_files"], ["src/alpha.ts"])
        self.assertEqual(metadata["source_locations"], ["L1"])

    def test_missing_source_file_does_not_fabricate_python_provenance(self):
        graph = {
            "nodes": [{"id": "anchor"}],
            "links": [
                {
                    "source": "anchor",
                    "target": "missing_module",
                    "relation": "imports",
                }
            ],
        }
        canonical, _ = MODULE.canonicalize_graph(graph, self.root_a)
        node = next(
            node for node in canonical["nodes"]
            if node["id"] == "missing_module"
        )
        self.assertEqual(
            node["metadata"]["reference_class"],
            "unresolved_graph_reference",
        )
        self.assertEqual(node["metadata"]["source_files"], [])

    def test_declared_isolated_node_is_preserved(self):
        graph, receipt = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        self.assertIn("isolated", {node["id"] for node in graph["nodes"]})
        self.assertEqual(receipt["declared_isolated_node_count"], 1)

    def test_canonicalization_is_idempotent(self):
        first, _ = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        second, receipt = MODULE.canonicalize_graph(
            copy.deepcopy(first), self.root_a
        )
        self.assertEqual(first, second)
        self.assertEqual(receipt["remapped_runtime_root_id_count"], 0)
        self.assertEqual(
            receipt["removed_prior_materialized_endpoint_node_count"], 2
        )
        self.assertEqual(receipt["materialized_endpoint_node_count"], 2)

    def test_stale_materialized_nodes_are_removed_and_provenance_is_refreshed(self):
        first, _ = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        first["links"] = [
            {
                "source": "src_alpha_widget",
                "target": "src_beta_helper",
                "relation": "uses",
                "source_file": "src/changed.ts",
                "source_location": "L99",
            }
        ]
        second, receipt = MODULE.canonicalize_graph(first, self.root_a)
        declared = {node["id"]: node for node in second["nodes"]}
        self.assertNotIn("ref_react", declared)
        self.assertIn("isolated", declared)
        metadata = declared["src_beta_helper"]["metadata"]
        self.assertEqual(metadata["relations"], {"uses": 1})
        self.assertEqual(metadata["source_files"], ["src/changed.ts"])
        self.assertEqual(metadata["source_locations"], ["L99"])
        self.assertEqual(
            receipt["removed_prior_materialized_endpoint_node_count"], 2
        )
        self.assertEqual(receipt["materialized_endpoint_node_count"], 1)

    def test_deterministic_rebuild_does_not_invent_synthetic_communities(self):
        first, _ = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        synthetic = [
            node
            for node in first["nodes"]
            if node.get("metadata", {}).get("kind")
            == "materialized_edge_endpoint"
        ]
        self.assertTrue(synthetic)
        self.assertTrue(all("community" not in node for node in synthetic))
        second, _ = MODULE.canonicalize_graph(first, self.root_a)
        second_synthetic = [
            node
            for node in second["nodes"]
            if node.get("metadata", {}).get("kind")
            == "materialized_edge_endpoint"
        ]
        self.assertTrue(all("community" not in node for node in second_synthetic))

    def test_clustered_rebuild_preserves_valid_synthetic_communities(self):
        first, _ = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        for index, node in enumerate(first["nodes"]):
            node["community"] = index % 3
        second, _ = MODULE.canonicalize_graph(first, self.root_a)
        expected = {node["id"]: node["community"] for node in first["nodes"]}
        actual = {node["id"]: node["community"] for node in second["nodes"]}
        self.assertEqual(actual, expected)

    def test_incomplete_source_communities_drop_prior_synthetic_labels(self):
        first, _ = MODULE.canonicalize_graph(
            self.contaminated_graph(self.root_a), self.root_a
        )
        for node in first["nodes"]:
            if node.get("metadata", {}).get("kind") == "materialized_edge_endpoint":
                node["community"] = 7
        next(node for node in first["nodes"] if node["id"] == "isolated")[
            "community"
        ] = 1
        second, _ = MODULE.canonicalize_graph(first, self.root_a)
        synthetic = [
            node
            for node in second["nodes"]
            if node.get("metadata", {}).get("kind")
            == "materialized_edge_endpoint"
        ]
        self.assertTrue(all("community" not in node for node in synthetic))

    def test_self_loop_provenance_counts_one_incident_edge(self):
        graph = {
            "nodes": [],
            "links": [
                {
                    "source": "loop",
                    "target": "loop",
                    "relation": "self",
                    "source_file": "src/loop.ts",
                }
            ],
        }
        canonical, _ = MODULE.canonicalize_graph(graph, self.root_a)
        metadata = canonical["nodes"][0]["metadata"]
        self.assertEqual(metadata["incident_edge_count"], 1)
        self.assertEqual(metadata["relations"], {"self": 1})

    def test_literal_and_slug_edge_only_convergence_fails_closed(self):
        root_slug = self.slug(self.root_a)
        graph = {
            "nodes": [{"id": "anchor"}],
            "links": [
                {
                    "source": self.root_a + r"\src\a-b.ts",
                    "target": "anchor",
                    "relation": "calls",
                },
                {
                    "source": root_slug + "_src_a_b_ts",
                    "target": "anchor",
                    "relation": "calls",
                },
            ],
        }
        with self.assertRaisesRegex(
            MODULE.GraphIntegrityError, "remap would collapse"
        ):
            MODULE.canonicalize_graph(graph, self.root_a)

    def test_hyperedge_nodes_are_remapped_and_validated(self):
        literal = self.root_a + r"\src\alpha.ts"
        graph = {
            "nodes": [{"id": literal}, {"id": "anchor"}],
            "links": [{"source": literal, "target": "anchor"}],
            "hyperedges": [
                {
                    "id": "h1",
                    "nodes": [literal.upper().replace("\\", "/"), "anchor"],
                    "relation": "group",
                }
            ],
        }
        canonical, receipt = MODULE.canonicalize_graph(graph, self.root_a)
        self.assertEqual(
            canonical["hyperedges"][0]["nodes"],
            ["src_alpha_ts", "anchor"],
        )
        self.assertEqual(receipt["hyperedge_count"], 1)
        self.assertEqual(
            receipt["undeclared_hyperedge_member_occurrence_count"], 0
        )

    def test_hyperedge_unknown_member_fails_closed(self):
        graph = {
            "nodes": [{"id": "anchor"}],
            "links": [{"source": "anchor", "target": "anchor"}],
            "hyperedges": [{"id": "h1", "nodes": ["anchor", "missing"]}],
        }
        with self.assertRaisesRegex(
            MODULE.GraphIntegrityError, "hyperedge member.*undeclared"
        ):
            MODULE.canonicalize_graph(graph, self.root_a)

    def test_hyperedge_runtime_member_is_remapped_before_unknown_check(self):
        graph = {
            "nodes": [{"id": "anchor"}],
            "links": [{"source": "anchor", "target": "anchor"}],
            "hyperedges": [
                {
                    "id": "h1",
                    "nodes": [self.root_a + r"\src\missing.ts"],
                }
            ],
        }
        with self.assertRaisesRegex(
            MODULE.GraphIntegrityError, "hyperedge member.*undeclared"
        ):
            MODULE.canonicalize_graph(graph, self.root_a)

    def test_hyperedge_alias_and_empty_shapes_fail_closed(self):
        bad_hyperedges = (
            [{"id": "h1", "members": ["anchor"]}],
            [{"id": "h1", "node_ids": ["anchor"]}],
            [{"id": "h1", "nodes": []}],
            ["not-an-object"],
        )
        for hyperedges in bad_hyperedges:
            with self.subTest(hyperedges=hyperedges):
                graph = {
                    "nodes": [{"id": "anchor"}],
                    "links": [{"source": "anchor", "target": "anchor"}],
                    "hyperedges": hyperedges,
                }
                with self.assertRaises(MODULE.GraphIntegrityError):
                    MODULE.canonicalize_graph(graph, self.root_a)

    def test_literal_runtime_path_is_canonicalized(self):
        graph = {
            "nodes": [
                {
                    "id": self.root_a + r"\src\alpha.ts",
                    "source_file": "src/alpha.ts",
                }
            ],
            "links": [
                {
                    "source": self.root_a.upper().replace("\\", "/")
                    + "/src/alpha.ts",
                    "target": self.root_a + r"\src\alpha.ts",
                    "relation": "self",
                }
            ],
        }
        canonical, _ = MODULE.canonicalize_graph(graph, self.root_a)
        self.assertEqual(
            {node["id"] for node in canonical["nodes"]},
            {"src_alpha_ts"},
        )
        self.assertEqual(
            canonical["links"][0]["source"], "src_alpha_ts"
        )

    def test_runtime_remap_collision_with_edge_only_portable_id_fails_closed(self):
        root_slug = self.slug(self.root_a)
        graph = {
            "nodes": [{"id": "anchor"}],
            "links": [
                {
                    "source": root_slug + "_src_alpha",
                    "target": "anchor",
                    "relation": "calls",
                },
                {
                    "source": "src_alpha",
                    "target": "anchor",
                    "relation": "references",
                },
            ],
        }
        with self.assertRaisesRegex(
            MODULE.GraphIntegrityError, "collides with existing graph ID"
        ):
            MODULE.canonicalize_graph(graph, self.root_a)

    def test_runtime_remap_collision_fails_closed(self):
        root_slug = self.slug(self.root_a)
        graph = {
            "nodes": [
                {"id": "src_alpha"},
                {"id": root_slug + "_src_alpha"},
            ],
            "links": [],
        }
        with self.assertRaisesRegex(
            MODULE.GraphIntegrityError, "collides with existing graph ID"
        ):
            MODULE.canonicalize_graph(graph, self.root_a)

    def test_undeclared_endpoint_validation_fails_closed(self):
        graph = {
            "nodes": [{"id": "n1"}],
            "links": [
                {"source": "n1", "target": "missing", "relation": "calls"}
            ],
        }
        with self.assertRaisesRegex(
            MODULE.GraphIntegrityError, "undeclared"
        ):
            MODULE.validate_graph_integrity(graph, self.root_a)

    def test_root_prefix_near_misses_are_not_flagged(self):
        candidates = (
            r"C:\Lab\sstac-runtime-alpha-copy\src\alpha.ts",
            r"E:\Unrelated\sstac-runtime-alpha\src\alpha.ts",
            "sstac_dashboard_runtime_feature",
        )
        for candidate in candidates:
            with self.subTest(candidate=candidate):
                self.assertEqual(
                    (),
                    MODULE.runtime_root_encoding_hits(candidate, self.root_a),
                )

    def test_drive_case_separator_and_slug_forms_are_flagged(self):
        candidates = (
            r"c:\lab\SSTAC-RUNTIME-ALPHA\src\alpha.ts",
            "C:/Lab/sstac-runtime-alpha/src/alpha.ts",
            "node_c_lab_sstac_runtime_alpha_src_alpha_ts",
        )
        for candidate in candidates:
            with self.subTest(candidate=candidate):
                self.assertTrue(
                    MODULE.runtime_root_encoding_hits(candidate, self.root_a)
                )

    def test_canonicalize_graph_without_hyperedges_key_is_idempotent(self):
        graph = {
            "nodes": [{"id": "n1", "label": "Node 1"}],
            "links": [{"source": "n1", "target": "n1"}],
        }
        first, _ = MODULE.canonicalize_graph(graph, self.root_a)
        self.assertEqual(first["hyperedges"], [])
        second, _ = MODULE.canonicalize_graph(
            copy.deepcopy(first), self.root_a
        )
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main(verbosity=2)
