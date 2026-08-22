import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


WIKI_DIR = Path(__file__).parent.parent
WRAPPER_PATH = WIKI_DIR / "nightly_wiki_sync.ps1"
POWERSHELL = os.environ.get("PREFLIGHT_POWERSHELL") or shutil.which("powershell")


class TestL3M0InstalledRuntimeContract(unittest.TestCase):
    def setUp(self):
        self.wrapper = WRAPPER_PATH.read_text(encoding="ascii")

    def test_wrapper_has_no_remote_advancement_command(self):
        forbidden = re.compile(
            r"(?im)^\s*(?:&\s*)?git(?:\.exe)?\b[^\r\n]*\b"
            r"(fetch|pull|checkout|switch|reset|merge)\b"
        )
        self.assertIsNone(forbidden.search(self.wrapper))
        self.assertNotIn("serve_gate.py", self.wrapper)
        self.assertNotIn("origin/main", self.wrapper)
        self.assertNotIn("REPINNED", self.wrapper)

    def test_success_identity_is_bound_to_installed_runtime(self):
        for token in (
            '$serveGateRequiredRef = "INSTALLED_RUNTIME"',
            '$autofollowDecision = "PINNED_INSTALLED_RUNTIME"',
            "$autofollowAttempted = $false",
            "$autofollowFetchedOid = $null",
            "$autofollowFinalHead = $autofollowStartingHead",
            "$requiredRefOid = $autofollowStartingHead",
            "$finalHead -ceq $requiredRefOid",
            "$buildStampOid -ceq $requiredRefOid",
        ):
            with self.subTest(token=token):
                self.assertIn(token, self.wrapper)

    def test_publication_requires_unchanged_head_and_clean_tracked_files(self):
        gate = self.wrapper.split("$trackedStatus = @(", 1)[1].split(
            "$serveGateSummary = ", 1
        )[0]
        for token in (
            "status --porcelain --untracked-files=no",
            "$trackedStatusExit -eq 0",
            "$trackedStatus.Count -eq 0",
            "rev-parse HEAD",
            "$currentHead -ceq $autofollowStartingHead",
            "$serveGateOk = ($trackedClean -and $headUnchanged)",
        ):
            with self.subTest(token=token):
                self.assertIn(token, gate)

    def test_required_build_and_publish_are_not_optional_stage_gated(self):
        n1 = self.wrapper.index('Write-Host "--- N1 SCOPE+HASH ---"')
        n2 = self.wrapper.index('Write-Host "--- N2 CLUSTER ---"')
        n6 = self.wrapper.index('Write-Host "--- N6 WIKI ---"')
        skip_plan = self.wrapper.index("$n5Plan = Get-NightlyN5Plan")
        self.assertLess(n1, n2)
        self.assertLess(n2, n6)
        self.assertLess(skip_plan, n1)
        self.assertIn("SEMANTIC_SKIPPED_SkipFlags", self.wrapper)
        self.assertIn("SERVED_WIKI_SWAPPED", self.wrapper)

    def test_process_custody_single_terminalization_and_last_good_paths_remain(self):
        self.assertEqual(self.wrapper.count("exit $finalExit"), 1)
        self.assertIn("-Mode EvaluateTerminal", self.wrapper)
        self.assertIn("Enter-NightlyTerminalization -GuardPath $terminalGuardPath", self.wrapper)
        self.assertIn('SERVED_WIKI_KEPT_LAST_GOOD (Publish failed)', self.wrapper)
        self.assertIn("prepare --served $w --staging $ws", self.wrapper)
        self.assertIn("finalize --staging $ws", self.wrapper)
        self.assertIn("swap --served $w --staging $ws --backup $publishBackup", self.wrapper)

    def test_installed_runtime_path_does_not_depend_on_optional_state_index(self):
        block = self.wrapper.split(
            'Write-Host "--- N0 INSTALLED RUNTIME PREFLIGHT ---"', 1
        )[1].split('Write-Host "--- N1 SCOPE+HASH ---"', 1)[0]
        self.assertNotRegex(block.lower(), r"state[-_ ]index|alarm|notifier|scheduler")


@unittest.skipUnless(POWERSHELL, "Windows PowerShell unavailable")
class TestL3M0InstalledRuntimeExecution(unittest.TestCase):
    def setUp(self):
        self.wrapper = WRAPPER_PATH.read_text(encoding="ascii")
        self.readable_helper = "function Test-NightlyReadableFile" + self.wrapper.split(
            "function Test-NightlyReadableFile", 1
        )[1].split("function Get-NightlyExactNonnegativeInteger", 1)[0]
        self.n0_block = self.wrapper.split(
            'Write-Host "--- N0 INSTALLED RUNTIME PREFLIGHT ---"', 1
        )[1].split('Write-Host "--- N1 SCOPE+HASH ---"', 1)[0]
        gate_start = "$trackedStatus = @("
        gate_end_line = next(
            line
            for line in self.wrapper.splitlines()
            if line.strip().startswith('$serveGateSummary = "allowed=$serveGateOk;')
        )
        gate_tail = self.wrapper.split(gate_start, 1)[1]
        self.publication_gate = gate_start + gate_tail.split(gate_end_line, 1)[0] + gate_end_line

    @staticmethod
    def run_command(*args, cwd, check=True):
        return subprocess.run(
            list(args), cwd=cwd, capture_output=True, text=True, check=check
        )

    def create_repo(self, root):
        self.run_command("git", "init", cwd=root)
        self.run_command("git", "config", "user.name", "test", cwd=root)
        self.run_command("git", "config", "user.email", "test@example.com", cwd=root)
        tracked = Path(root) / "tracked.txt"
        tracked.write_text("installed\n", encoding="ascii")
        self.run_command("git", "add", "tracked.txt", cwd=root)
        self.run_command("git", "commit", "-m", "installed", cwd=root)
        return self.run_command("git", "rev-parse", "HEAD", cwd=root).stdout.strip()

    @staticmethod
    def create_required_tooling(root):
        root = Path(root)
        scripts = (
            "check_orphans.ps1",
            "nightly_terminalizer.ps1",
            "graphify_guardrail.ps1",
            "ollama_lock.ps1",
            "gen_docs_scope.py",
            "canonicalize_graph.py",
            "scan_secrets.py",
            "graph_smoke.py",
            "semantic_extract.ps1",
            "promotion.py",
            "publish_wiki.py",
            "wiki_compile.py",
            "wiki_lint.py",
            "wiki_nightly_config.json",
        )
        wiki = root / "tooling" / "wiki"
        wiki.mkdir(parents=True, exist_ok=True)
        for name in scripts:
            (wiki / name).write_text("{}\n" if name.endswith(".json") else "placeholder\n", encoding="ascii")
        bin_dir = root / "fixture-bin"
        bin_dir.mkdir()
        for name in ("python.exe", "graphify.exe", "powershell.exe"):
            (bin_dir / name).write_text("placeholder\n", encoding="ascii")
        return bin_dir

    def run_n0(self, root, shim="", missing_tool=None, skip_labeling=False, skip_semantic=False):
        root = Path(root)
        bin_dir = self.create_required_tooling(root)
        missing_tools = (missing_tool,) if isinstance(missing_tool, str) else tuple(missing_tool or ())
        for tool in missing_tools:
            (root / "tooling" / "wiki" / tool).unlink()
        script = "\n".join(
            (
                "Set-StrictMode -Version 2.0",
                f"$normalizedRepoRoot = '{root}'",
                f"$RepoRoot = '{root}'",
                f"$logDir = '{root}'",
                "$stamp = '2026-08-21'",
                f"$windowsPowerShell51 = '{bin_dir / 'powershell.exe'}'",
                f"$checkOrphansPath = '{root / 'tooling' / 'wiki' / 'check_orphans.ps1'}'",
                f"$terminalizerPath = '{root / 'tooling' / 'wiki' / 'nightly_terminalizer.ps1'}'",
                f"$graphifyExe = '{bin_dir / 'graphify.exe'}'",
                f"$pythonExe = '{bin_dir / 'python.exe'}'",
                f"$configFile = '{root / 'tooling' / 'wiki' / 'wiki_nightly_config.json'}'",
                f"$SkipLabeling = ${str(skip_labeling)}".lower(),
                f"$SkipSemantic = ${str(skip_semantic)}".lower(),
                "$serveGateRequiredRef = 'INSTALLED_RUNTIME'",
                "$autofollowStartingHead = ''",
                "$autofollowFetchedOid = $null",
                "$autofollowDecision = 'NOT_EVALUATED'",
                "$autofollowAttempted = $false",
                "$autofollowResult = 'NOT_RUN'",
                "$autofollowFinalHead = ''",
                "$autofollowRejectionReason = ''",
                "function Complete-NightlyRun([int]$NativeExitCode, [string]$TerminalState) {",
                "  [pscustomobject]@{ terminal_state=$TerminalState; native_exit_code=$NativeExitCode; required_ref=$serveGateRequiredRef; starting=$autofollowStartingHead; final=$autofollowFinalHead; fetched=$autofollowFetchedOid; decision=$autofollowDecision; attempted=$autofollowAttempted; result=$autofollowResult; reason=$autofollowRejectionReason } | ConvertTo-Json -Compress | Write-Output",
                "  exit $NativeExitCode",
                "}",
                self.readable_helper,
                shim,
                self.n0_block,
                "[pscustomobject]@{ terminal_state='SUCCESS'; native_exit_code=0; required_ref=$serveGateRequiredRef; starting=$autofollowStartingHead; final=$autofollowFinalHead; fetched=$autofollowFetchedOid; decision=$autofollowDecision; attempted=$autofollowAttempted; result=$autofollowResult; reason=$autofollowRejectionReason } | ConvertTo-Json -Compress | Write-Output",
            )
        )
        script_path = root / "run-installed-preflight.ps1"
        script_path.write_text(script, encoding="ascii")
        result = self.run_command(
            POWERSHELL,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script_path),
            cwd=root,
            check=False,
        )
        payload = json.loads(result.stdout.strip().splitlines()[-1])
        return payload, result.returncode

    def run_publication_gate(self, root, installed_head):
        root = Path(root)
        script = "\n".join(
            (
                "Set-StrictMode -Version 2.0",
                f"$RepoRoot = '{root}'",
                f"$autofollowStartingHead = '{installed_head}'",
                "$autofollowFinalHead = $autofollowStartingHead",
                "$serveGateRequiredRef = 'INSTALLED_RUNTIME'",
                self.publication_gate,
                "[pscustomobject]@{ allowed=$serveGateOk; tracked_clean=$trackedClean; head_unchanged=$headUnchanged; reasons=$serveGateReasons; final=$autofollowFinalHead } | ConvertTo-Json -Compress | Write-Output",
            )
        )
        script_path = root / "run-publication-gate.ps1"
        script_path.write_text(script, encoding="ascii")
        result = self.run_command(
            POWERSHELL,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script_path),
            cwd=root,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return json.loads(result.stdout.strip().splitlines()[-1])

    def test_moving_origin_main_is_ignored_and_installed_head_is_preserved(self):
        with tempfile.TemporaryDirectory(prefix="l3_m0_installed_") as temp_dir:
            installed = self.create_repo(temp_dir)
            upstream = self.run_command(
                "git",
                "commit-tree",
                f"{installed}^{{tree}}",
                "-p",
                installed,
                "-m",
                "upstream",
                cwd=temp_dir,
            ).stdout.strip()
            self.run_command("git", "update-ref", "refs/remotes/origin/main", upstream, cwd=temp_dir)
            payload, exit_code = self.run_n0(temp_dir)
            self.assertEqual(exit_code, 0, payload)
            self.assertEqual(payload["decision"], "PINNED_INSTALLED_RUNTIME")
            self.assertEqual(payload["result"], "PASS")
            self.assertFalse(payload["attempted"])
            self.assertIsNone(payload["fetched"])
            self.assertEqual(payload["required_ref"], "INSTALLED_RUNTIME")
            self.assertEqual(payload["starting"], installed)
            self.assertEqual(payload["final"], installed)
            self.assertEqual(self.run_command("git", "rev-parse", "HEAD", cwd=temp_dir).stdout.strip(), installed)

    def test_missing_required_tooling_fails_before_build(self):
        with tempfile.TemporaryDirectory(prefix="l3_m0_installed_") as temp_dir:
            self.create_repo(temp_dir)
            payload, exit_code = self.run_n0(temp_dir, missing_tool="publish_wiki.py")
            self.assertEqual(exit_code, 1, payload)
            self.assertEqual(payload["terminal_state"], "FAILED")
            self.assertIn("required installed tooling absent or unreadable", payload["reason"])
            self.assertIn("publish_wiki.py", payload["reason"])

    def test_optional_n5_tooling_is_conditional_and_enabled_stages_fail_closed(self):
        cases = (
            (True, True, 0, ("ollama_lock.ps1", "semantic_extract.ps1", "promotion.py")),
            (False, True, 1, ("ollama_lock.ps1",)),
            (True, False, 1, ("semantic_extract.ps1", "promotion.py")),
        )
        for skip_labeling, skip_semantic, expected_exit, missing in cases:
            with self.subTest(skip_labeling=skip_labeling, skip_semantic=skip_semantic):
                with tempfile.TemporaryDirectory(prefix="l3_m0_installed_") as temp_dir:
                    self.create_repo(temp_dir)
                    payload, exit_code = self.run_n0(
                        temp_dir,
                        missing_tool=missing,
                        skip_labeling=skip_labeling,
                        skip_semantic=skip_semantic,
                    )
                    self.assertEqual(exit_code, expected_exit, payload)
                    if expected_exit == 0:
                        self.assertEqual(payload["required_ref"], "INSTALLED_RUNTIME")
                    else:
                        self.assertIn("required installed tooling absent or unreadable", payload["reason"])
                        for tool in missing:
                            self.assertIn(tool, payload["reason"])

    def test_invalid_installed_head_fails_closed(self):
        with tempfile.TemporaryDirectory(prefix="l3_m0_installed_") as temp_dir:
            self.create_repo(temp_dir)
            shim = (
                "function git { $global:LASTEXITCODE = 0; Write-Output 'NOT_A_COMMIT' }"
            )
            payload, exit_code = self.run_n0(temp_dir, shim=shim)
            self.assertEqual(exit_code, 1, payload)
            self.assertEqual(payload["terminal_state"], "FAILED")
            self.assertIn("invalid OID", payload["reason"])

    def test_local_tracked_change_blocks_publication(self):
        with tempfile.TemporaryDirectory(prefix="l3_m0_gate_") as temp_dir:
            installed = self.create_repo(temp_dir)
            (Path(temp_dir) / "tracked.txt").write_text("changed\n", encoding="ascii")
            payload = self.run_publication_gate(temp_dir, installed)
            self.assertFalse(payload["allowed"])
            self.assertFalse(payload["tracked_clean"])
            self.assertIn("Tracked files dirty", payload["reasons"])

    def test_local_head_change_blocks_publication(self):
        with tempfile.TemporaryDirectory(prefix="l3_m0_gate_") as temp_dir:
            installed = self.create_repo(temp_dir)
            (Path(temp_dir) / "tracked.txt").write_text("new commit\n", encoding="ascii")
            self.run_command("git", "add", "tracked.txt", cwd=temp_dir)
            self.run_command("git", "commit", "-m", "changed head", cwd=temp_dir)
            current = self.run_command("git", "rev-parse", "HEAD", cwd=temp_dir).stdout.strip()
            payload = self.run_publication_gate(temp_dir, installed)
            self.assertFalse(payload["allowed"])
            self.assertTrue(payload["tracked_clean"])
            self.assertFalse(payload["head_unchanged"])
            self.assertIn("HEAD changed", payload["reasons"])
            self.assertEqual(payload["final"], current)


if __name__ == "__main__":
    unittest.main()
