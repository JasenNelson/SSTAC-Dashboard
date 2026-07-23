import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parent.parent / "activation_preflight.ps1"
POWERSHELL = shutil.which("powershell")

class ActivationPreflightTests(unittest.TestCase):
    def setUp(self):
        if not POWERSHELL:
            self.skipTest("Windows PowerShell is unavailable")
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        subprocess.run(["git", "init", str(self.root)], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(self.root), "config", "user.name", "Preflight Test"], check=True)
        subprocess.run(["git", "-C", str(self.root), "config", "user.email", "preflight@example.invalid"], check=True)
        (self.root / "seed.txt").write_text("seed\n", encoding="ascii")
        subprocess.run(["git", "-C", str(self.root), "add", "seed.txt"], check=True)
        subprocess.run(["git", "-C", str(self.root), "commit", "-m", "seed"], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(self.root), "branch", "-M", "main"], check=True)
        self.head = self.git("rev-parse", "HEAD")
        subprocess.run(
            ["git", "-C", str(self.root), "update-ref", "refs/remotes/origin/main", self.head],
            check=True,
        )
        config = self.root / "tooling" / "wiki" / "wiki_nightly_config.json"
        config.parent.mkdir(parents=True)
        config.write_text(
            json.dumps({"serve_gate": {"remote": "origin", "branch": "main"}}),
            encoding="ascii",
        )
        graph = self.root / "wiki" / ".graph" / "graph.json"
        graph.parent.mkdir(parents=True)
        graph.write_text(
            json.dumps({"nodes": [{"id": "n1"}], "links": [{"source": "n1", "target": "n1"}]}),
            encoding="ascii",
        )
        (self.root / "wiki" / ".build-stamp").write_text(
            f"Build Stamp: test\nHEAD: {self.head}\n",
            encoding="ascii",
        )
        self.task = self.root / "task.txt"
        self.mcp = self.root / "mcp.txt"
        self.task.write_text("ERROR: The system cannot find the file specified.", encoding="ascii")
        self.mcp.write_text("graphify not found", encoding="ascii")

    def tearDown(self):
        if hasattr(self, "tmp"):
            self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(
            ["git", "-C", str(self.root), *args],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    def run_preflight(self, version="0.9.17"):
        command = [
            POWERSHELL,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(SCRIPT),
            "-RuntimeRoot",
            str(self.root),
            "-TaskQueryOutputPath",
            str(self.task),
            "-McpStatusOutputPath",
            str(self.mcp),
        ]
        if version is not None:
            command.extend(["-GraphifyVersionOverride", version])
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )

    def assert_not_ready(self, result, check_name):
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"FAIL    {check_name}:", result.stdout)
        self.assertIn("RESULT NOT_READY", result.stdout)

    def test_ready_detached_runtime(self):
        result = self.run_preflight()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS    served-graph: 1 nodes, 1 links", result.stdout)
        self.assertIn("RESULT READY", result.stdout)

    def test_missing_graph_fails(self):
        (self.root / "wiki" / ".graph" / "graph.json").unlink()
        self.assert_not_ready(self.run_preflight(), "served-graph")

    def test_invalid_config_fails(self):
        config = self.root / "tooling" / "wiki" / "wiki_nightly_config.json"
        config.write_text(json.dumps({"serve_gate": {"remote": "origin"}}), encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "serve-config")

    def test_stamp_mismatch_fails(self):
        (self.root / "wiki" / ".build-stamp").write_text("HEAD: deadbeef\n", encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "build-stamp")

    def test_remote_ref_mismatch_fails(self):
        (self.root / "seed.txt").write_text("second\n", encoding="ascii")
        subprocess.run(["git", "-C", str(self.root), "add", "seed.txt"], check=True)
        subprocess.run(["git", "-C", str(self.root), "commit", "-m", "second"], check=True, capture_output=True)
        new_head = self.git("rev-parse", "HEAD")
        (self.root / "wiki" / ".build-stamp").write_text(f"HEAD: {new_head}\n", encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "runtime-ref")

    def test_missing_remote_ref_fails_without_abort(self):
        subprocess.run(
            ["git", "-C", str(self.root), "update-ref", "-d", "refs/remotes/origin/main"],
            check=True,
        )
        result = self.run_preflight()
        self.assert_not_ready(result, "runtime-ref")
        self.assertIn("refs/remotes/origin/main absent; no fetch performed", result.stdout)

    def test_wrong_graphify_version_fails(self):
        self.assert_not_ready(self.run_preflight(version="0.9.18"), "graphify-version")

    def test_missing_graphify_env_fails_without_abort(self):
        result = self.run_preflight(version=None)
        self.assert_not_ready(result, "graphify-version")
        self.assertIn("got unavailable", result.stdout)

    def test_dirty_tracked_tree_fails(self):
        (self.root / "seed.txt").write_text("dirty\n", encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "tracked-tree")

    def test_scheduler_wrong_runtime_fails(self):
        self.task.write_text("Task To Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\\other\\nightly_wiki_sync.ps1", encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "scheduler")

    def test_scheduler_path_only_fails(self):
        expected = self.root / "tooling" / "wiki" / "nightly_wiki_sync.ps1"
        self.task.write_text(f"Task To Run: powershell -File {expected}", encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "scheduler")

    def test_scheduler_selected_runtime_passes_status_check(self):
        expected = self.root / "tooling" / "wiki" / "nightly_wiki_sync.ps1"
        self.task.write_text(
            f'Task To Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{expected}"',
            encoding="ascii",
        )
        receipt_dir = self.root / ".tmp_wiki_nightly"
        receipt_dir.mkdir()
        (receipt_dir / "receipt-test.md").write_text("test\n", encoding="ascii")
        result = self.run_preflight()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("INFO    scheduler: present and matches expected nightly command", result.stdout)

    def test_mcp_wrong_runtime_fails(self):
        self.mcp.write_text("Command: C:\\other\\python.exe\nArgs: -m graphify.serve C:\\other\\wiki\\.graph\\graph.json --transport stdio", encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "graphify-mcp")

    def test_mcp_path_only_fails(self):
        graph = self.root / "wiki" / ".graph" / "graph.json"
        self.mcp.write_text(f"graphify {graph}", encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "graphify-mcp")

    def test_mcp_selected_runtime_passes_status_check(self):
        python = self.root / ".venv-graphify" / "Scripts" / "python.exe"
        graph = self.root / "wiki" / ".graph" / "graph.json"
        self.mcp.write_text(
            f"Command: {python}\nArgs: -m graphify.serve {graph} --transport stdio",
            encoding="ascii",
        )
        result = self.run_preflight()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("INFO    graphify-mcp: present and matches expected graphify serve command", result.stdout)

    def test_read_only_process_contract(self):
        text = SCRIPT.read_text(encoding="ascii").lower()
        self.assertIn("system.diagnostics.processstartinfo", text)
        self.assertIn("redirectstandardoutput", text)
        self.assertIn("git_optional_locks", text)
        self.assertIn("--no-optional-locks", text)
        self.assertIn("invoke-readonlystatus $python", text)
        self.assertNotIn("& $python", text)
        self.assertNotIn("start-process", text)
        self.assertNotIn("gettempfilename", text)
        for forbidden in (
            "register_wiki_nightly_task", " mcp add", " mcp remove", "& ollama", "/api/"
        ):
            self.assertNotIn(forbidden, text)

if __name__ == "__main__":
    unittest.main()