import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


WIKI_DIR = Path(__file__).parent.parent
POWERSHELL = os.environ.get("PREFLIGHT_POWERSHELL") or shutil.which("powershell")
FOCUSED_TEST_TMP = WIKI_DIR.parent.parent / ".tmp" / "sync-wiki-contract-tests"


class TestSyncWikiContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sync = (WIKI_DIR / "sync_wiki.ps1").read_text(encoding="ascii")

    def test_default_graphify_resolves_from_selected_runtime_venv(self):
        self.assertIn("[string]$GraphifyExe = ''", self.sync)
        self.assertNotIn("[string]$GraphifyExe = 'graphify'", self.sync)
        self.assertIn(".venv-graphify\\Scripts\\graphify.exe", self.sync)
        self.assertIn("Resolve-WikiSyncExecutable", self.sync)

    def test_missing_pinned_executables_fail_closed(self):
        resolver = self.sync.split("function Resolve-WikiSyncExecutable", 1)[1].split(
            "$venvPythonDefault", 1
        )[0]
        self.assertIn("[System.IO.Path]::IsPathRooted", resolver)
        self.assertIn("Test-Path -LiteralPath $requested -PathType Leaf", resolver)
        self.assertIn("throw \"$Label is missing or is not a file: $requested\"", resolver)
        self.assertIn("FAIL: executable resolution", self.sync)
        self.assertIn("exit 1", self.sync.split("FAIL: executable resolution", 1)[1])

    def test_full_sync_runs_update_smoke_cluster_final_smoke_and_scan_in_order(self):
        update = self.sync.index("@('update', '.', '--no-cluster')")
        precluster_smoke = self.sync.index("smoke-precluster-sync.json")
        cluster = self.sync.index("@('cluster-only', $repoRoot, '--no-label', '--no-viz')")
        final_canonical = self.sync.index("canonicalization-sync-final.json")
        final_smoke = self.sync.index("--require-communities --receipt $plainSyncSmokeReceipt")
        graph_scan = self.sync.index("--target graphify-out")
        prepare = self.sync.index(" prepare --served")
        finalize = self.sync.index(" finalize --staging")
        swap = self.sync.index(" swap --served")
        self.assertLess(update, precluster_smoke)
        self.assertLess(precluster_smoke, cluster)
        self.assertLess(cluster, final_canonical)
        self.assertLess(final_canonical, final_smoke)
        self.assertLess(final_smoke, graph_scan)
        self.assertLess(graph_scan, prepare)
        self.assertLess(prepare, finalize)
        self.assertLess(finalize, swap)

    def test_clustering_failure_exits_before_any_publication(self):
        cluster_block = self.sync.split("$clusterResult = Invoke-GraphifyGuarded", 1)[1].split(
            '} else {\n    Write-Host "SKIP: graph update and clustering disabled', 1
        )[0]
        self.assertIn("$clusterDecisionExit = Get-WikiSyncGraphifyExitCode", cluster_block)
        self.assertIn("exit 124", cluster_block)
        self.assertIn("exit 1", cluster_block)
        self.assertNotIn("prepare --served", cluster_block)
        self.assertLess(
            self.sync.index("exit 1", self.sync.index("FAIL: graph clustering guardrail")),
            self.sync.index(" prepare --served"),
        )

    def test_skip_graph_requires_existing_community_complete_graph(self):
        skip_branch = self.sync.split(
            '} else {\n    Write-Host "SKIP: graph update and clustering disabled', 1
        )[1].split('Write-Host "--- 1c. Final canonicalization ---"', 1)[0]
        self.assertIn("Test-Path -LiteralPath $graphPath -PathType Leaf", skip_branch)
        self.assertIn("-SkipGraph requires an existing graphify-out\\graph.json", skip_branch)
        self.assertIn("--require-communities", self.sync)
        self.assertIn("community_contract.status -cne 'PASS'", self.sync)
        self.assertIn("$smokePopulatedNodeCount -ne $smokeNodeCount", self.sync)


class TestSyncWikiHelpers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sync = (WIKI_DIR / "sync_wiki.ps1").read_text(encoding="ascii")
        cls.helpers = "function Get-WikiSyncExactNonnegativeInteger" + cls.sync.split(
            "function Get-WikiSyncExactNonnegativeInteger", 1
        )[1].split("# Every Python call", 1)[0]

    def setUp(self):
        if not POWERSHELL:
            self.skipTest("PowerShell unavailable")
        FOCUSED_TEST_TMP.mkdir(parents=True, exist_ok=True)

    def run_helper(self, command):
        environment = os.environ.copy()
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        return subprocess.run(
            [POWERSHELL, "-NoProfile", "-NonInteractive", "-Command", self.helpers + command],
            cwd=str(WIKI_DIR.parent.parent),
            capture_output=True,
            text=True,
            check=False,
            env=environment,
        )

    @staticmethod
    def ps_quote(value):
        return str(value).replace("'", "''")

    def test_absolute_existing_executable_is_accepted(self):
        executable = self.ps_quote(Path(POWERSHELL).resolve())
        command = (
            f";$expected='{executable}';"
            "$actual=Resolve-WikiSyncExecutable -Candidate $expected "
            "-DefaultPath $expected -Label 'Test executable';"
            "if (-not [System.IO.Path]::IsPathRooted($actual)) { exit 1 };"
            "if (-not (Test-Path -LiteralPath $actual -PathType Leaf)) { exit 1 };"
            "exit 0"
        )
        result = self.run_helper(command)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_relative_missing_and_directory_executables_are_rejected(self):
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            fixture_dir = Path(temp_dir).resolve()
            missing = fixture_dir / "missing.exe"
            cases = ("relative.exe", str(missing), str(fixture_dir))
            for candidate in cases:
                with self.subTest(candidate=candidate):
                    quoted = self.ps_quote(candidate)
                    command = (
                        f";try {{ Resolve-WikiSyncExecutable -Candidate '{quoted}' "
                        f"-DefaultPath '{quoted}' -Label 'Test executable' | Out-Null; exit 0 }} "
                        "catch { exit 1 }"
                    )
                    result = self.run_helper(command)
                    self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_int32_and_int64_counts_are_accepted(self):
        cases = (("[int]7", 7), ("[long]8", 8))
        for expression, expected in cases:
            with self.subTest(expression=expression):
                command = (
                    f";$object=[pscustomobject]@{{value={expression}}};"
                    "$actual=Get-WikiSyncExactNonnegativeInteger -Object $object "
                    "-PropertyName 'value' -Maximum 100;"
                    f"if ($actual -ne {expected}) {{ exit 1 }}; exit 0"
                )
                result = self.run_helper(command)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_coercive_negative_missing_and_overflow_counts_are_rejected(self):
        cases = (
            "[pscustomobject]@{value=[bool]$true}",
            "[pscustomobject]@{value='1'}",
            "[pscustomobject]@{value=[double]1.0}",
            "[pscustomobject]@{value=[int]-1}",
            "[pscustomobject]@{}",
            "[pscustomobject]@{value=[long]101}",
        )
        for expression in cases:
            with self.subTest(expression=expression):
                command = (
                    f";$object={expression};"
                    "try { Get-WikiSyncExactNonnegativeInteger -Object $object "
                    "-PropertyName 'value' -Maximum 100 | Out-Null; exit 0 } "
                    "catch { exit 1 }"
                )
                result = self.run_helper(command)
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
