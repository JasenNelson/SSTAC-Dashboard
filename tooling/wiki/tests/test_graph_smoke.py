import hashlib
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class TestGraphSmoke(unittest.TestCase):
    def setUp(self):
        self.script_path = Path(__file__).parent.parent / "graph_smoke.py"
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = Path(self.temp_dir.name)
        # A minimal but real git repo so `git ls-files` / `git worktree list` behave.
        subprocess.run(['git', 'init', '-q'], cwd=str(self.repo_root), check=True)
        subprocess.run(['git', 'config', 'user.email', 'a@b.c'], cwd=str(self.repo_root), check=True)
        subprocess.run(['git', 'config', 'user.name', 'a'], cwd=str(self.repo_root), check=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def write_and_track(self, relpath, content="x\n"):
        p = self.repo_root / relpath
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
        subprocess.run(['git', 'add', relpath], cwd=str(self.repo_root), check=True)

    def commit(self):
        subprocess.run(['git', 'commit', '-q', '-m', 'seed'], cwd=str(self.repo_root), check=True)

    def filler_nodes(self, n_files=20, nodes_per_file=5, track=True):
        # Pads mean_nodes_per_file (healthy 3-40) and largest_community_pct (healthy
        # <=35%) so a test can isolate ONE metric (substrate invariant / path audit /
        # communities count) without tripping the other threshold-table rows as a side
        # effect of using a tiny/degenerate fixture graph.
        nodes = []
        for i in range(n_files):
            relpath = f"filler_{i}.ts"
            if track:
                self.write_and_track(relpath, f"export const f{i} = {i};\n")
            for j in range(nodes_per_file):
                nodes.append({
                    "id": f"filler_{i}_{j}",
                    "source_file": relpath,
                    "community": i,
                })
        if track:
            self.commit()
        return nodes

    def write_graph(self, nodes, links=None):
        graph_path = self.repo_root / "graph.json"
        with open(graph_path, 'w', encoding='utf-8') as f:
            json.dump({'nodes': nodes, 'links': links or []}, f)
        return graph_path

    def run_smoke(self, graph_path, manifest_path=None, allowlist_path=None,
                  data_allowlist_path=None, require_communities=False,
                  receipt_path=None):
        cmd = [sys.executable, str(self.script_path),
               "--graph", str(graph_path), "--repo-root", str(self.repo_root)]
        if manifest_path:
            cmd += ["--manifest", str(manifest_path)]
        if allowlist_path:
            cmd += ["--allowlist", str(allowlist_path)]
        if data_allowlist_path:
            cmd += ["--data-allowlist", str(data_allowlist_path)]
        if require_communities:
            cmd += ["--require-communities"]
        if receipt_path:
            cmd += ["--receipt", str(receipt_path)]
        return subprocess.run(cmd, capture_output=True, text=True)

    def test_receipt_binds_exact_checked_graph_bytes(self):
        nodes = self.filler_nodes()
        graph_path = self.write_graph(nodes)
        receipt_path = self.repo_root / "smoke-receipt.json"
        expected_hash = hashlib.sha256(graph_path.read_bytes()).hexdigest()
        result = self.run_smoke(graph_path, receipt_path=receipt_path)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        self.assertEqual(receipt["graph_sha256"], expected_hash)

    def test_substrate_invariant_passes_for_tracked_files(self):
        nodes = self.filler_nodes()
        graph_path = self.write_graph(nodes)
        result = self.run_smoke(graph_path)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("OK: every source_file is git-tracked or allowlisted", result.stdout)

    def test_substrate_invariant_hard_fails_for_untracked_file(self):
        nodes = self.filler_nodes()
        nodes.append({"id": "n_extra", "source_file": "scratch_untracked.py", "community": 999})
        graph_path = self.write_graph(nodes)
        result = self.run_smoke(graph_path)
        self.assertEqual(result.returncode, 1)
        self.assertIn("scratch_untracked.py", result.stdout)
        self.assertIn("HARD FAIL", result.stdout)

    def test_substrate_invariant_allowlist_exempts_untracked_file(self):
        nodes = self.filler_nodes()
        nodes.append({"id": "n_extra", "source_file": "scratch_untracked.py", "community": 999})
        graph_path = self.write_graph(nodes)
        allowlist_path = self.repo_root / "allow.txt"
        allowlist_path.write_text("scratch_untracked.py\n")
        result = self.run_smoke(graph_path, allowlist_path=allowlist_path)
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_node_modules_path_hard_fails(self):
        nodes = self.filler_nodes()
        nodes.append({"id": "n_extra", "source_file": "node_modules/react/index.js", "community": 999})
        graph_path = self.write_graph(nodes)
        result = self.run_smoke(graph_path)
        self.assertEqual(result.returncode, 1)
        self.assertIn("node_modules/", result.stdout)

    def test_root_exact_dotenv_path_hard_fails(self):
        # codex review fix (2026-07-17): the original substring patterns ('/.env',
        # '.env.') both miss an exact root-level ".env" (no leading slash in a normalized
        # relative path, no trailing content after "env"). Confirm the exact-basename
        # check now catches it.
        nodes = self.filler_nodes()
        nodes.append({"id": "n_extra", "source_file": ".env", "community": 999})
        graph_path = self.write_graph(nodes)
        result = self.run_smoke(graph_path)
        self.assertEqual(result.returncode, 1)
        self.assertIn(".env", result.stdout)
        self.assertIn("HARD FAIL", result.stdout)

    def test_communities_out_of_band_is_warn_only_never_hard(self):
        # 5 communities is far below the 15-700 healthy band (2026-07-17: upper bound
        # widened 250 -> 700, see docs/KB_COMMUNITY_CALIBRATION_2026-07-17.md; lower
        # bound 15 unchanged, so this test is unaffected), but must only WARN (no
        # stated HARD limit for community COUNT) -- must not cause a non-zero exit on its
        # own. Nodes are spread evenly across the 5 communities (20% each) so
        # largest_community_pct stays healthy (<=35%) -- num_communities=1 would force
        # largest_community_pct=100% by construction, which is a DIFFERENT (HARD) metric,
        # so 5 communities isolates the community-COUNT check cleanly.
        nodes = []
        for i in range(20):
            relpath = f"comm_{i}.ts"
            self.write_and_track(relpath, f"export const f{i} = {i};\n")
            community = i % 5
            for j in range(5):
                nodes.append({
                    "id": f"c_{i}_{j}",
                    "source_file": relpath,
                    "community": community,
                })
        self.commit()
        graph_path = self.write_graph(nodes)
        result = self.run_smoke(graph_path)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("num_communities: 5 [WARN]", result.stdout)

    def test_data_as_code_hard_fails(self):
        # The json file IS git-tracked, so the substrate invariant passes and the
        # exit-1 comes solely from the DATA-AS-CODE audit (check isolation).
        self.write_and_track("src/data/foo.json", "{}\n")
        nodes = self.filler_nodes()
        nodes.append({"id": "n_data", "source_file": "src/data/foo.json", "community": 999})
        graph_path = self.write_graph(nodes)
        result = self.run_smoke(graph_path)
        self.assertEqual(result.returncode, 1)
        self.assertIn("DATA-AS-CODE audit", result.stdout)
        self.assertIn("src/data/foo.json", result.stdout)
        self.assertIn("HARD FAIL", result.stdout)
        self.assertIn("OK: every source_file is git-tracked or allowlisted", result.stdout)

    def test_data_as_code_allowlist_exempts_file(self):
        # Tracked (substrate passes) + data-allowlisted (data audit passes) -> exit 0.
        self.write_and_track("src/data/foo.json", "{}\n")
        nodes = self.filler_nodes()
        nodes.append({"id": "n_data", "source_file": "src/data/foo.json", "community": 999})
        graph_path = self.write_graph(nodes)
        allowlist_path = self.repo_root / "data_allow.txt"
        allowlist_path.write_text("src/data/foo.json\n")
        result = self.run_smoke(graph_path, data_allowlist_path=allowlist_path)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("DATA-AS-CODE audit", result.stdout)
        self.assertIn("OK: zero data-extension source_files", result.stdout)

    def test_data_as_code_allowlist_backslash_entry_matches(self):
        # codex P2 (2026-07-22): an allowlist entry written with Windows separators
        # must still match the forward-slash-normalized source_file comparison.
        self.write_and_track("src/data/foo.json", "{}\n")
        nodes = self.filler_nodes()
        nodes.append({"id": "n_data", "source_file": "src/data/foo.json", "community": 999})
        graph_path = self.write_graph(nodes)
        allowlist_path = self.repo_root / "data_allow.txt"
        allowlist_path.write_text("src\\data\\foo.json\n")
        result = self.run_smoke(graph_path, data_allowlist_path=allowlist_path)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("OK: zero data-extension source_files", result.stdout)

    def test_data_as_code_case_insensitive(self):
        self.write_and_track("src/data/X.JSON", "{}\n")
        nodes = self.filler_nodes()
        nodes.append({"id": "n_data", "source_file": "src/data/X.JSON", "community": 999})
        graph_path = self.write_graph(nodes)
        result = self.run_smoke(graph_path)
        self.assertEqual(result.returncode, 1)
        self.assertIn("src/data/X.JSON", result.stdout)

    def test_data_as_code_clean_graph(self):
        nodes = self.filler_nodes()
        graph_path = self.write_graph(nodes)
        result = self.run_smoke(graph_path)
        self.assertEqual(result.returncode, 0)
        self.assertIn("DATA-AS-CODE audit", result.stdout)
        self.assertIn("OK: zero data-extension source_files", result.stdout)


    def test_materialized_endpoint_does_not_inflate_import_resolution(self):
        nodes = self.filler_nodes()
        nodes.append({
            "id": "materialized_target",
            "label": "materialized_target",
            "file_type": "concept",
            "source_file": "",
            "metadata": {"kind": "materialized_edge_endpoint"},
            "community": 0,
        })
        links = [{
            "source": "filler_0_0",
            "target": "materialized_target",
            "relation": "imports",
        }]
        result = self.run_smoke(self.write_graph(nodes, links))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("internal_import_resolution_pct: 0.0 [HARD]", result.stdout)

    def test_declared_isolated_node_is_valid(self):
        nodes = self.filler_nodes()
        nodes.append({
            "id": "isolated",
            "source_file": "filler_0.ts",
            "community": 99,
        })
        result = self.run_smoke(self.write_graph(nodes))
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("declared isolated node(s) retained", result.stdout)

    def test_undeclared_source_and_target_are_hard(self):
        nodes = self.filler_nodes()
        for link in (
            {"source": "missing", "target": "filler_0_0", "relation": "calls"},
            {"source": "filler_0_0", "target": "missing", "relation": "calls"},
        ):
            with self.subTest(link=link):
                result = self.run_smoke(self.write_graph(nodes, [link]))
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertIn("endpoint occurrence(s) are undeclared", result.stdout)

    def test_literal_and_slugged_runtime_ids_are_hard(self):
        root_text = str(self.repo_root.resolve())
        root_slug = re.sub(
            r"[^a-z0-9]+", "_", root_text.casefold()
        ).strip("_")
        baseline_nodes = self.filler_nodes()
        for bad_id in (
            root_text + r"\src\bad.ts",
            root_text.replace("\\", "/").upper() + "/src/bad.ts",
            root_slug + "_src_bad_ts",
        ):
            with self.subTest(bad_id=bad_id):
                nodes = [dict(node) for node in baseline_nodes]
                nodes[0]["id"] = bad_id
                result = self.run_smoke(self.write_graph(nodes))
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertIn("runtime-root-derived", result.stdout)

    def test_runtime_root_near_misses_are_not_flagged(self):
        root_text = str(self.repo_root.resolve())
        nodes = self.filler_nodes()
        nodes[0]["id"] = root_text + "-copy"
        result = self.run_smoke(self.write_graph(nodes))
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_deterministic_graph_allows_all_communities_absent(self):
        nodes = self.filler_nodes()
        for node in nodes:
            node.pop("community", None)
        result = self.run_smoke(self.write_graph(nodes))
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("deterministic --no-cluster graph may omit", result.stdout)

    def test_deterministic_graph_rejects_partial_communities(self):
        nodes = self.filler_nodes()
        for node in nodes[1:]:
            node.pop("community", None)
        result = self.run_smoke(self.write_graph(nodes))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("community population must be all-or-none", result.stdout)

    def test_clustered_graph_requires_complete_communities(self):
        nodes = self.filler_nodes()
        for node in nodes:
            node.pop("community", None)
        result = self.run_smoke(
            self.write_graph(nodes), require_communities=True
        )
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("communities are required after cluster-only", result.stdout)

    def test_clustered_graph_accepts_zero_community_label(self):
        nodes = self.filler_nodes()
        for index, node in enumerate(nodes):
            node["community"] = index % 4
        result = self.run_smoke(
            self.write_graph(nodes), require_communities=True
        )
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("complete community population", result.stdout)

if __name__ == '__main__':
    unittest.main()
