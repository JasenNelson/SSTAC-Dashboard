import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tooling.wiki import serve_gate
from tooling.wiki.serve_gate import (
    FETCH_TIMEOUT_SECONDS,
    GateConfig,
    fetch_required_ref,
    load_gate_config,
    verify_receipt,
)


def run_git(repo: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(
            f"git {' '.join(args)} failed ({proc.returncode})\n"
            f"stdout: {proc.stdout}\n"
            f"stderr: {proc.stderr}"
        )
    return proc.stdout.strip()


class TestServeGate(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.runtime = Path(self.temp_dir.name)
        run_git(self.runtime, "init")
        run_git(self.runtime, "config", "user.name", "Wiki Gate Test")
        run_git(
            self.runtime,
            "config",
            "user.email",
            "wiki-gate@example.invalid",
        )
        (self.runtime / "seed.txt").write_text("main\n", encoding="ascii")
        run_git(self.runtime, "add", "seed.txt")
        run_git(self.runtime, "commit", "-m", "main seed")
        run_git(self.runtime, "branch", "-M", "main")
        self.main_oid = run_git(self.runtime, "rev-parse", "HEAD")
        run_git(
            self.runtime,
            "update-ref",
            "refs/remotes/origin/main",
            self.main_oid,
        )

        self.config_path = self.runtime / "wiki_nightly_config.json"
        self.receipt = self.runtime / ".tmp" / "fetch-receipt.json"
        self.write_config(branch="main")

    def tearDown(self):
        self.temp_dir.cleanup()

    def write_config(self, *, remote="origin", branch="main"):
        self.config_path.write_text(
            json.dumps({"serve_gate": {"remote": remote, "branch": branch}}),
            encoding="ascii",
        )

    def config(self) -> GateConfig:
        return load_gate_config(self.config_path, self.runtime)

    def fetch(self, *, succeeds=True):
        original_run_git = serve_gate.run_git

        def run_without_transport(repo_root, *args, timeout_seconds=None):
            if args and args[0] == "fetch":
                self.assertEqual(timeout_seconds, FETCH_TIMEOUT_SECONDS)
                return subprocess.CompletedProcess(
                    args=["git", *args],
                    returncode=0 if succeeds else 128,
                    stdout="",
                    stderr="" if succeeds else "injected fetch failure",
                )
            return original_run_git(
                repo_root,
                *args,
                timeout_seconds=timeout_seconds,
            )

        with mock.patch(
            "tooling.wiki.serve_gate.run_git",
            side_effect=run_without_transport,
        ):
            return fetch_required_ref(
                self.runtime,
                self.config(),
                self.receipt,
            )

    def test_detached_head_at_attested_main_is_allowed(self):
        fetched = self.fetch()
        run_git(self.runtime, "checkout", "--detach", fetched.fetched_oid)

        verified = verify_receipt(
            self.runtime,
            self.config(),
            self.receipt,
        )

        self.assertTrue(fetched.fetch_succeeded)
        self.assertTrue(verified.allowed)
        self.assertEqual(verified.reasons, [])

    def test_named_branch_ahead_of_attested_ref_is_blocked(self):
        self.fetch()
        (self.runtime / "seed.txt").write_text("local\n", encoding="ascii")
        run_git(self.runtime, "add", "seed.txt")
        run_git(self.runtime, "commit", "-m", "local move")

        result = verify_receipt(
            self.runtime,
            self.config(),
            self.receipt,
        )

        self.assertFalse(result.allowed)
        self.assertIn(
            "HEAD does not match the attested fetched commit",
            result.reasons,
        )

    def test_configured_alternate_branch_fetch_is_bound_to_its_oid(self):
        run_git(self.runtime, "checkout", "-b", "release")
        (self.runtime / "seed.txt").write_text("release\n", encoding="ascii")
        run_git(self.runtime, "add", "seed.txt")
        run_git(self.runtime, "commit", "-m", "release seed")
        release_oid = run_git(self.runtime, "rev-parse", "HEAD")
        run_git(
            self.runtime,
            "update-ref",
            "refs/remotes/origin/release",
            release_oid,
        )
        run_git(self.runtime, "checkout", "main")
        self.write_config(branch="release")

        fetched = self.fetch()
        blocked = verify_receipt(
            self.runtime,
            self.config(),
            self.receipt,
        )
        run_git(self.runtime, "checkout", "--detach", fetched.fetched_oid)
        allowed = verify_receipt(
            self.runtime,
            self.config(),
            self.receipt,
        )

        self.assertTrue(fetched.fetch_succeeded)
        self.assertFalse(blocked.allowed)
        self.assertIn(
            "HEAD does not match the attested fetched commit",
            blocked.reasons,
        )
        self.assertTrue(allowed.allowed)

    def test_config_change_after_fetch_fails_closed(self):
        self.fetch()
        changed_config = GateConfig(
            remote="origin",
            branch="other",
            required_ref="refs/remotes/origin/other",
        )

        result = verify_receipt(
            self.runtime,
            changed_config,
            self.receipt,
        )

        self.assertFalse(result.allowed)
        self.assertIn(
            "Fetch receipt does not match current serve-gate config",
            result.reasons,
        )

    def test_fetch_failure_is_recorded_and_blocks_verify(self):
        fetched = self.fetch(succeeds=False)
        result = verify_receipt(
            self.runtime,
            self.config(),
            self.receipt,
        )

        self.assertFalse(fetched.fetch_succeeded)
        self.assertFalse(result.allowed)
        self.assertIn(
            "Required remote branch was not fetched successfully",
            result.reasons,
        )

    def test_fetch_timeout_is_noninteractive_and_records_failure(self):
        captured = {}

        def time_out(command, **kwargs):
            captured.update(kwargs)
            raise subprocess.TimeoutExpired(command, kwargs["timeout"])

        config = GateConfig(
            remote="origin",
            branch="main",
            required_ref="refs/remotes/origin/main",
        )
        with mock.patch(
            "tooling.wiki.serve_gate.subprocess.run",
            side_effect=time_out,
        ):
            receipt = fetch_required_ref(
                self.runtime,
                config,
                self.receipt,
            )

        self.assertFalse(receipt.fetch_succeeded)
        self.assertIsNone(receipt.fetched_oid)
        self.assertEqual(captured["timeout"], FETCH_TIMEOUT_SECONDS)
        self.assertEqual(captured["env"]["GIT_TERMINAL_PROMPT"], "0")
        self.assertEqual(captured["env"]["GCM_INTERACTIVE"], "Never")
        stored = json.loads(self.receipt.read_text(encoding="ascii"))
        self.assertFalse(stored["fetch_succeeded"])


if __name__ == "__main__":
    unittest.main()
