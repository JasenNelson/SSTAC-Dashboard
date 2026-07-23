import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parent.parent / "graphify_nudge_pretooluse.py"


class TestGraphifyNudge(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.local = self.root / "local"
        self.runtime = self.root / "runtime"
        self.local.mkdir()
        graph_dir = self.runtime / "wiki" / ".graph"
        graph_dir.mkdir(parents=True)
        (graph_dir / "graph.json").write_text(
            '{"nodes":[],"links":[]}\n',
            encoding="ascii",
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_configured_runtime_is_the_nudge_consumer_path(self):
        env = dict(os.environ)
        env["WIKI_BOOTSTRAP_ROOT"] = str(self.local)
        env["SSTAC_WIKI_RUNTIME_ROOT"] = str(self.runtime)
        payload = {
            "tool_name": "Bash",
            "tool_input": {"command": "rg auth ."},
        }

        proc = subprocess.run(
            [sys.executable, str(SCRIPT_PATH)],
            input=json.dumps(payload),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        result = json.loads(proc.stdout)
        context = result["hookSpecificOutput"]["additionalContext"]

        self.assertEqual(proc.returncode, 0)
        self.assertIn(str(self.runtime), context)
        self.assertIn(
            str(self.runtime / ".venv-graphify" / "Scripts" / "graphify.exe"),
            context,
        )
        self.assertNotIn(str(self.local / "wiki"), context)

    def test_main_runtime_fallback_uses_absolute_command_paths(self):
        env = dict(os.environ)
        env.pop("SSTAC_WIKI_RUNTIME_ROOT", None)
        env["WIKI_BOOTSTRAP_ROOT"] = str(self.local)
        env["FAKE_GIT_COMMON_DIR"] = str(self.runtime / ".git")
        payload = {
            "tool_name": "Bash",
            "tool_input": {"command": "rg auth ."},
        }

        proc = subprocess.run(
            [sys.executable, str(SCRIPT_PATH)],
            input=json.dumps(payload),
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        result = json.loads(proc.stdout)
        context = result["hookSpecificOutput"]["additionalContext"]

        self.assertEqual(proc.returncode, 0)
        self.assertIn(
            str(self.runtime / ".venv-graphify" / "Scripts" / "graphify.exe"),
            context,
        )
        self.assertIn(
            str(self.runtime / "wiki" / ".graph" / "graph.json"),
            context,
        )
        self.assertNotIn(str(self.local / "wiki"), context)


if __name__ == "__main__":
    unittest.main()
