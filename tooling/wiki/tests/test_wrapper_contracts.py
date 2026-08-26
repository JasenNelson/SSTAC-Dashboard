import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

WIKI_DIR = Path(__file__).parent.parent
POWERSHELL = os.environ.get("PREFLIGHT_POWERSHELL") or shutil.which("powershell")
_ORIGINAL_EVIDENCE_ROOT = os.environ.get("SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT")


def _path_at_or_below(candidate, protected):
    try:
        return os.path.normcase(os.path.commonpath((candidate, protected))) == os.path.normcase(protected)
    except ValueError:
        return False


def _validate_supplied_evidence_parent(parent):
    if not os.path.lexists(parent):
        raise RuntimeError("supplied evidence root must already exist")
    repository_root = Path(__file__).resolve().parents[3]
    protected_roots = (
        Path(r"C:\Projects"),
        Path(r"C:\Projects\SSTAC-Dashboard"),
        repository_root,
        repository_root.parent,
    )
    if any(_path_at_or_below(str(parent), str(root)) for root in protected_roots):
        raise RuntimeError("supplied evidence root must not be at or below a project, repository, worktree, or shared worktree root")
    reparse = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    cursor = parent
    while True:
        cursor_stat = os.lstat(cursor)
        attributes = getattr(cursor_stat, "st_file_attributes", 0)
        if stat.S_ISLNK(cursor_stat.st_mode) or attributes & reparse or not stat.S_ISDIR(cursor_stat.st_mode):
            raise RuntimeError("supplied evidence root and every lexical ancestor must be ordinary directories")
        next_cursor = cursor.parent
        if next_cursor == cursor:
            break
        cursor = next_cursor
    return parent


def _create_owned_evidence_root():
    if _ORIGINAL_EVIDENCE_ROOT:
        parent = Path(os.path.abspath(_ORIGINAL_EVIDENCE_ROOT))
        _validate_supplied_evidence_parent(parent)
        owned = Path(tempfile.mkdtemp(prefix="wiki_wrapper_", dir=parent))
    else:
        owned = Path(tempfile.mkdtemp(prefix="wiki_wrapper_"))
    owned_stat = os.lstat(owned)
    if not stat.S_ISDIR(owned_stat.st_mode) or getattr(owned_stat, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400):
        raise RuntimeError("owned evidence root must be an ordinary directory")
    if _ORIGINAL_EVIDENCE_ROOT and os.path.normcase(str(owned.parent)) != os.path.normcase(str(parent)):
        raise RuntimeError("owned evidence root must be one direct child of the supplied parent")
    return owned


EVIDENCE_ROOT = _create_owned_evidence_root()
FOCUSED_TEST_TMP = EVIDENCE_ROOT / "focused-test-tmp"


def fixture_environment():
    environment = os.environ.copy()
    environment["SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT"] = str(EVIDENCE_ROOT)
    return environment


def tearDownModule():
    shutil.rmtree(EVIDENCE_ROOT)




class TestWrapperContracts(unittest.TestCase):
    ROOT_MODULES = (
        ("tooling.wiki.tests.test_activation_preflight", "wiki_activation_"),
        ("tooling.wiki.tests.test_registration_contracts", "wiki_registration_"),
        ("tooling.wiki.tests.test_wrapper_contracts", "wiki_wrapper_"),
    )

    def setUp(self):
        self.wrapper = (WIKI_DIR / "nightly_wiki_sync.ps1").read_text(encoding="ascii")
        self.preflight = (WIKI_DIR / "activation_preflight.ps1").read_text(encoding="ascii")

    def write_evidence_root_probe(self, directory):
        probe = Path(directory) / "evidence_root_probe.py"
        probe.write_text(
            "\n".join(
                (
                    "import importlib",
                    "import json",
                    "import os",
                    "import sys",
                    "module = importlib.import_module(sys.argv[1])",
                    "owned = str(module.EVIDENCE_ROOT)",
                    "module.tearDownModule()",
                    "print(json.dumps({'owned': owned, 'owned_absent': not os.path.lexists(owned)}, sort_keys=True))",
                    "",
                )
            ),
            encoding="ascii",
        )
        return probe

    def run_evidence_root_probe(self, probe, module_name, supplied_parent):
        environment = fixture_environment()
        environment["SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT"] = str(supplied_parent)
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        environment["PYTHONPATH"] = str(WIKI_DIR.parent.parent)
        return subprocess.run(
            [sys.executable, str(probe), module_name],
            cwd=str(WIKI_DIR.parent.parent),
            capture_output=True,
            text=True,
            check=False,
            env=environment,
        )

    def create_required_junction(self, link, target):
        self.assertIsNotNone(POWERSHELL)
        link_text = str(link).replace("'", "''")
        target_text = str(target).replace("'", "''")
        result = subprocess.run(
            [
                POWERSHELL,
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                f"New-Item -ItemType Junction -Path '{link_text}' -Target '{target_text}' -ErrorAction Stop | Out-Null",
            ],
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_supplied_root_missing_and_projects_rejected_all_modules(self):
        FOCUSED_TEST_TMP.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            fixture = Path(temp_dir)
            probe = self.write_evidence_root_probe(fixture)
            protected = WIKI_DIR.parent.parent
            protected_before = sorted(item.name for item in protected.iterdir())
            for index, (module_name, _) in enumerate(self.ROOT_MODULES):
                with self.subTest(module=module_name, case="missing"):
                    missing = fixture / f"missing-{index}"
                    result = self.run_evidence_root_probe(probe, module_name, missing)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(os.path.lexists(missing))
                    self.assertIn("must already exist", result.stderr)
                with self.subTest(module=module_name, case="projects"):
                    result = self.run_evidence_root_probe(probe, module_name, protected)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("must not be at or below", result.stderr)
                    self.assertEqual(sorted(item.name for item in protected.iterdir()), protected_before)

    def test_supplied_root_leaf_reparse_rejected_all_modules(self):
        FOCUSED_TEST_TMP.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            fixture = Path(temp_dir)
            probe = self.write_evidence_root_probe(fixture)
            target = fixture / "leaf-target"
            target.mkdir()
            sentinel = target / "sentinel.txt"
            sentinel.write_text("unchanged\n", encoding="ascii")
            link = fixture / "leaf-link"
            self.create_required_junction(link, target)
            try:
                for module_name, _ in self.ROOT_MODULES:
                    with self.subTest(module=module_name):
                        result = self.run_evidence_root_probe(probe, module_name, link)
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn("ordinary directories", result.stderr)
                        self.assertEqual(sentinel.read_text(encoding="ascii"), "unchanged\n")
                        self.assertEqual(sorted(item.name for item in target.iterdir()), ["sentinel.txt"])
                        self.assertTrue(getattr(os.lstat(link), "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))
            finally:
                os.rmdir(link)

    def test_supplied_root_intermediate_reparse_rejected_all_modules(self):
        FOCUSED_TEST_TMP.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            fixture = Path(temp_dir)
            probe = self.write_evidence_root_probe(fixture)
            target = fixture / "intermediate-target"
            supplied_target = target / "ordinary-parent"
            supplied_target.mkdir(parents=True)
            sentinel = supplied_target / "sentinel.txt"
            sentinel.write_text("unchanged\n", encoding="ascii")
            link = fixture / "intermediate-link"
            self.create_required_junction(link, target)
            apparent_parent = link / supplied_target.name
            try:
                for module_name, _ in self.ROOT_MODULES:
                    with self.subTest(module=module_name):
                        result = self.run_evidence_root_probe(probe, module_name, apparent_parent)
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn("ordinary directories", result.stderr)
                        self.assertEqual(sentinel.read_text(encoding="ascii"), "unchanged\n")
                        self.assertEqual(sorted(item.name for item in supplied_target.iterdir()), ["sentinel.txt"])
                        self.assertTrue(getattr(os.lstat(link), "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))
            finally:
                os.rmdir(link)

    def test_supplied_root_valid_parent_owns_and_removes_one_child_all_modules(self):
        FOCUSED_TEST_TMP.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            fixture = Path(temp_dir)
            probe = self.write_evidence_root_probe(fixture)
            for index, (module_name, expected_prefix) in enumerate(self.ROOT_MODULES):
                with self.subTest(module=module_name):
                    supplied = fixture / f"valid-parent-{index}"
                    supplied.mkdir()
                    sibling = supplied / "sibling.txt"
                    sibling.write_text("unchanged\n", encoding="ascii")
                    before = sorted(item.name for item in supplied.iterdir())
                    result = self.run_evidence_root_probe(probe, module_name, supplied)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    details = json.loads(result.stdout.splitlines()[-1])
                    owned = Path(details["owned"])
                    self.assertEqual(os.path.normcase(str(owned.parent)), os.path.normcase(str(supplied)))
                    self.assertTrue(owned.name.startswith(expected_prefix))
                    self.assertTrue(details["owned_absent"])
                    self.assertFalse(os.path.lexists(owned))
                    self.assertEqual(sorted(item.name for item in supplied.iterdir()), before)
                    self.assertEqual(sibling.read_text(encoding="ascii"), "unchanged\n")

    def test_terminal_receipt_has_definition_and_canonical_uuid_identity(self):
        self.assertIn("[guid]$TaskDefinitionId = [guid]::Empty", self.wrapper)
        self.assertIn("[guid]::NewGuid().ToString('D').ToLowerInvariant()", self.wrapper)
        self.assertIn('"terminal-receipt-$runId.json"', self.wrapper)
        self.assertIn("$TaskDefinitionId.ToString('D').ToLowerInvariant()", self.wrapper)

    def test_legacy_no_id_executes_but_zero_id_cannot_prove_contract_a(self):
        self.assertIn("[guid]$TaskDefinitionId = [guid]::Empty", self.wrapper)
        self.assertNotIn("if ($TaskDefinitionId -eq [guid]::Empty)", self.wrapper)
        self.assertIn("ExpectedTaskDefinitionId must be a non-empty GUID", self.preflight)
        self.assertIn("task_definition_id", self.preflight)
        self.assertIn("$taskDefinitionGuid.ToString('D').ToLowerInvariant()", self.preflight)

    def test_terminal_receipt_schema_is_complete(self):
        required = (
            "schema_version",
            "run_id",
            "task_definition_id",
            "started_at_utc",
            "completed_at_utc",
            "duration_seconds",
            "terminal_state",
            "native_exit_code",
            "n0_orphan",
            "n1_build",
            "n2_cluster",
            "n5_mode",
            "n5_skip_labeling",
            "n5_skip_semantic",
            "n5_run_label",
            "n5_run_semantic",
            "n5_lock_expiry_minutes",
            "n5_mutation_attempted",
            "semantic_execution_attempted",
            "n5_release_required",
            "n5_semantic",
            "n6_wiki",
            "n6_publication",
            "serve_gate",
            "final_canonicalization",
            "final_graph_smoke",
            "served_graph_sha256",
            "required_ref",
            "head_oid",
            "required_ref_oid",
            "build_stamp_oid",
            "terminal_process_custody",
            "terminal_process_custody_evidence",
            "autofollow_starting_head",
            "autofollow_fetched_oid",
            "autofollow_decision",
            "autofollow_attempted",
            "autofollow_result",
            "autofollow_final_head",
            "autofollow_rejection_reason",
        )
        for field in required:
            with self.subTest(field=field):
                self.assertRegex(self.wrapper, rf"(?m)^\s*{re.escape(field)}\s*=")

    def test_terminal_receipt_publish_is_atomic_and_unique(self):
        self.assertIn(". $terminalizerPath", self.wrapper)
        self.assertIn("Publish-NightlyTerminalReceipt -Receipt $terminalReceipt -ReceiptPath $terminalReceiptPath", self.wrapper)
        self.assertNotIn("$temporaryReceipt =", self.wrapper)
        self.assertNotIn("[System.IO.File]::Move($temporaryReceipt", self.wrapper)

    def test_terminal_receipt_is_pscustomobject_ordered(self):
        self.assertIn("$terminalReceipt = [pscustomobject][ordered]@{", self.wrapper)
        self.assertNotIn("$terminalReceipt = [ordered]@{", self.wrapper)

    def test_installed_runtime_has_no_remote_advancement_invocation(self):
        self.assertNotIn("serve_gate.py", self.wrapper)
        forbidden = re.compile(r"(?im)^\s*(?:&\s*)?git(?:\.exe)?\b[^\r\n]*\b(fetch|pull|checkout|switch|reset|merge)\b")
        self.assertIsNone(forbidden.search(self.wrapper))
        self.assertIn('Write-Host "--- N0 INSTALLED RUNTIME PREFLIGHT ---"', self.wrapper)
        self.assertIn('$autofollowDecision = "PINNED_INSTALLED_RUNTIME"', self.wrapper)

    def test_autofollow_fields_appear_last(self):
        receipt_match = re.search(r"\$terminalReceipt\s*=\s*\[pscustomobject\]\[ordered\]@\{(.*?)\}", self.wrapper, re.DOTALL)
        self.assertIsNotNone(receipt_match)
        fields = re.findall(r"^\s*([a-z0-9_]+)\s*=", receipt_match.group(1), re.MULTILINE)
        expected_last = [
            "terminal_process_custody_evidence",
            "autofollow_starting_head",
            "autofollow_fetched_oid",
            "autofollow_decision",
            "autofollow_attempted",
            "autofollow_result",
            "autofollow_final_head",
            "autofollow_rejection_reason",
        ]
        self.assertEqual(fields[-8:], expected_last, "Autofollow fields must appear exactly last and in correct order")

    def test_wrapper_receipt_matches_expected_top(self):
        receipt_match = re.search(r"\$terminalReceipt\s*=\s*\[pscustomobject\]\[ordered\]@\{(.*?)\}", self.wrapper, re.DOTALL)
        self.assertIsNotNone(receipt_match)
        fields = re.findall(r"^\s*([a-z0-9_]+)\s*=", receipt_match.group(1), re.MULTILINE)
        expected_top_match = re.search(r"\$expectedTop\s*=\s*@\((.*?)\)", self.preflight, re.DOTALL)
        self.assertIsNotNone(expected_top_match, "Could not find $expectedTop definition in activation_preflight.ps1")
        expected_order = re.findall(r"['\"]([a-z0-9_]+)['\"]", expected_top_match.group(1))
        self.assertEqual(fields, expected_order, "Wrapper receipt fields names and order must match $expectedTop in activation_preflight.ps1 exactly")

    def test_git_invocations_carry_auto_flags_in_installed_runtime_preflight(self):
        """Assert local Git reads in the installed-runtime block disable auto-maintenance."""
        preflight_block = self.wrapper.split('Write-Host "--- N0 INSTALLED RUNTIME PREFLIGHT ---"', 1)[1].split('Write-Host "--- N1 SCOPE+HASH ---"', 1)[0]
        git_invocations = re.findall(r"git\s+-c[^)]*", preflight_block)
        self.assertEqual(len(git_invocations), 1)
        for inv in git_invocations:
            self.assertIn("-c gc.auto=0", inv)
            self.assertIn("-c maintenance.auto=false", inv)
            self.assertIn("-C $normalizedRepoRoot", inv)


    def test_every_exit_flows_through_single_terminalizer(self):
        calls = re.findall(r"(?m)^\s*Complete-NightlyRun\s+\d+\s+'(?:FAILED|SKIPPED|SUCCESS)'\s*$", self.wrapper)
        self.assertGreaterEqual(len(calls), 9)
        raw_exits = [
            line
            for line in self.wrapper.splitlines()
            if re.search(r"^\s*exit\b", line) and "exit $finalExit" not in line
        ]
        self.assertEqual(raw_exits, ["    exit 1"], raw_exits)
        self.assertEqual(self.wrapper.count("exit $finalExit"), 1)
        direct_exit = self.wrapper.split("function Exit-NightlyTerminalFailure", 1)[1].split("function Get-NightlyFileSha256", 1)[0]
        self.assertNotIn("Complete-NightlyRun", direct_exit)

    def test_success_is_guarded_by_all_load_bearing_results(self):
        guard = self.wrapper.split("if ($finalState -eq 'SUCCESS'", 1)[1].split("}", 1)[0]
        for token in (
            "$finalExit -ne 0",
            "$n0OrphanStatus -ne 'OK'",
            "$step1Status -ne 'OK'",
            "$step2Status -ne 'OK'",
            "$step5Status -eq 'FAIL'",
            "$step6Status -ne 'OK'",
            "$n6Publication -ne 'SERVED_WIKI_SWAPPED'",
            "$serveGateResult -ne 'PASS'",
            "$finalCanonicalizationEvidence.status -ne 'PASS'",
            "$finalGraphSmokeEvidence.status -ne 'PASS'",
            "$servedGraphHashStatus -ne 'PASS'",
        ):
            with self.subTest(token=token):
                self.assertIn(token, guard)

    def test_terminal_process_custody_is_rechecked(self):
        terminalizer = self.wrapper.split("function Complete-NightlyRun", 1)[1].split("trap {", 1)[0]
        self.assertIn("-Mode EvaluateTerminal", terminalizer)
        self.assertIn("-ExpectedBaselineSha256 $custodyBaselineSha256", terminalizer)
        self.assertIn("expected_baseline_sha256 -cne $custodyBaselineSha256", terminalizer)
        self.assertIn("observed_baseline_sha256 -cne $custodyBaselineSha256", terminalizer)
        self.assertIn("terminal_process_custody_evidence = $terminalProcessCustodyEvidence", terminalizer)
        self.assertIn("if ($custody -ne 'PASS')", terminalizer)

    def test_baseline_is_captured_and_hashed_before_workload(self):
        capture = self.wrapper.index("-Mode CaptureBaseline")
        baseline_hash = self.wrapper.index("$custodyBaselineSha256 = Get-NightlyFileSha256")
        workload = self.wrapper.index("graphify_guardrail.ps1")
        self.assertLess(capture, baseline_hash)
        self.assertLess(baseline_hash, workload)
        self.assertLess(self.wrapper.index("$baselineExit = 1"), capture)
        self.assertNotIn("-Mode CaptureBaseline", self.wrapper[self.wrapper.index("trap {"):])

    def test_terminalization_is_guard_first_outer_catch_contained_and_last_child(self):
        complete = self.wrapper.split("function Complete-NightlyRun", 1)[1].split("trap {", 1)[0]
        self.assertRegex(complete, r"^\([^)]*\) \{\s*try \{ Enter-NightlyTerminalization")
        self.assertRegex(complete, r"catch \{ Exit-NightlyTerminalFailure \"terminal guard entry failed:[\s\S]*?\}\s*\n\s*try \{")
        self.assertRegex(complete, r"\} catch \{\s*Exit-NightlyTerminalFailure \"post-guard terminalization failed:")
        evaluate = complete.index("-Mode EvaluateTerminal")
        self.assertLess(complete.index("$custodyExit = 1"), evaluate)
        post_evaluate = complete[evaluate:]
        for child_token in ("git -C", "& powershell.exe", "& $pythonExe", "Start-Process"):
            with self.subTest(child_token=child_token):
                self.assertNotIn(child_token, post_evaluate)
        self.assertNotIn("Complete-NightlyRun", complete)

    def test_missing_build_stamp_is_caught_as_one_terminal_failure(self):
        complete = self.wrapper.split("function Complete-NightlyRun", 1)[1].split("trap {", 1)[0]
        self.assertIn("Get-Content -LiteralPath (Join-Path $RepoRoot 'wiki\\.build-stamp') -Raw -ErrorAction Stop", complete)
        self.assertIn("$finalState = 'FAILED'", complete)
        self.assertIn('Write-Host "FAIL: build stamp:', complete)

    def test_optional_n5_tooling_is_checked_only_in_enabled_paths(self):
        before_n5 = self.wrapper.split('Write-Host "--- N5 SEMANTIC ---"', 1)[0]
        self.assertNotIn('. (Join-Path $RepoRoot "tooling\\wiki\\ollama_lock.ps1")', before_n5)
        n0 = self.wrapper.split('Write-Host "--- N0 INSTALLED RUNTIME PREFLIGHT ---"', 1)[1].split(
            'Write-Host "--- N1 SCOPE+HASH ---"', 1
        )[0]
        self.assertIn("if (-not ($SkipLabeling -and $SkipSemantic))", n0)
        self.assertIn("if (-not $SkipSemantic)", n0)
        n5 = self.wrapper.split('Write-Host "--- N5 SEMANTIC ---"', 1)[1].split(
            'Write-Host "--- N5b PRE-PUBLICATION GRAPH INTEGRITY ---"', 1
        )[0]
        semantic_gate = n5.split("if ($semanticSkippedReason)", 1)[1]
        skip_branch, enabled_branch = semantic_gate.split("} else {", 1)
        for optional in ("ollama_lock.ps1", "semantic_extract.ps1", "promotion.py"):
            self.assertNotIn(optional, skip_branch)
        self.assertIn("Test-NightlyReadableFile $ollamaLockPath", enabled_branch)
        self.assertIn("if ($n5Plan.RunSemantic)", enabled_branch)
        self.assertIn("$semanticExtractPath", enabled_branch)
        self.assertIn("$promotionPath", enabled_branch)

    def test_affected_powershell_files_parse_under_windows_powershell_51(self):
        if not POWERSHELL:
            self.skipTest("Windows PowerShell unavailable")
        paths = [
            WIKI_DIR / "nightly_wiki_sync.ps1",
            WIKI_DIR / "activation_preflight.ps1",
            WIKI_DIR / "graphify_guardrail.ps1",
            WIKI_DIR / "guardrail_smoke.ps1",
        ]
        command = (
            "$errors=$null;$tokens=$null;"
            + ";".join(
                "[System.Management.Automation.Language.Parser]::ParseFile('"
                + str(path).replace("'", "''")
                + "',[ref]$tokens,[ref]$errors)|Out-Null;"
                "$path='"
                + str(path).replace("'", "''")
                + "';if($errors.Count -gt 0){throw($path+': '+($errors -join '; '))}"
                for path in paths
            )
            + ";Write-Output 'PS51_PARSE_OK'"
        )
        result = subprocess.run(
            [POWERSHELL, "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PS51_PARSE_OK", result.stdout)

    def test_early_paths_cannot_manufacture_success(self):
        self.assertNotIn("SKIPPED_ORPHANS", self.wrapper)
        self.assertNotIn("SKIPPED_DIRTY_TREE", self.wrapper.replace("PROMOTION_SKIPPED_DIRTY_TREE", ""))
        for marker in (
            "HOOK_DRIFT",
            "DOCS_SCOPE_FAIL",
            "SECRET_HIT",
            "SMOKE_FAIL",
        ):
            with self.subTest(marker=marker):
                tail = self.wrapper.split(marker, 1)[1][:300]
                self.assertRegex(tail, r"Complete-NightlyRun\s+1\s+'FAILED'")
                self.assertNotIn("Complete-NightlyRun 0 'SUCCESS'", tail)

    def test_success_terminalization_occurs_only_at_final_predicate(self):
        success_calls = [
            match.start()
            for match in re.finditer(r"Complete-NightlyRun\s+0\s+'SUCCESS'", self.wrapper)
        ]
        self.assertEqual(len(success_calls), 1)
        final_predicate = self.wrapper.rfind("# Final predicate")
        self.assertGreater(success_calls[0], final_predicate)
        self.assertNotIn("terminal_state = 'SUCCESS'", self.wrapper)

    def test_terminal_receipt_is_not_a_controller_manufactured_proof(self):
        forbidden = (
            "Start-Job",
            "Start-Process",
            "Register-ScheduledTask",
            "schtasks /Run",
            "terminal_state = 'SUCCESS'",
        )
        for token in forbidden:
            with self.subTest(token=token):
                self.assertNotIn(token, self.wrapper)

    def test_scheduled_action_never_enables_autocommit(self):
        self.assertNotRegex(self.wrapper, r"(?i)(^|\s)-AutoCommit(?:\s|$)")
        self.assertNotRegex(self.preflight, r"expectedArguments\s*=.*-AutoCommit")

    def test_no_background_or_detached_process_mechanism(self):
        forbidden = (
            "Start-Job",
            "Start-Process",
            "Register-ScheduledJob",
            "Register-ObjectEvent",
            "Win32_Process",
        )
        for token in forbidden:
            with self.subTest(token=token):
                self.assertNotIn(token, self.wrapper)

    def test_preflight_five_phase_and_limited_active_verdict(self):
        for phase in (
            "StagedAwaitingManual",
            "StagedManualProven",
            "ActiveAwaitingNatural",
            "Active0530Correlated",
            "Disabled",
        ):
            self.assertIn(phase, self.preflight)
        self.assertIn("READY_FOR_OWNER_NATURAL_PROVENANCE_MCP_AND_LOGGED_OUT_GATES", self.preflight)
        self.assertNotIn("UNATTENDED_PROVEN", self.preflight)
        self.assertNotIn("READY_FOR_UNATTENDED", self.preflight)
        self.assertNotIn("ActiveProven", self.preflight)

    def test_active_transition_is_hash_bound_and_requires_distinct_definition_ids(self):
        for token in (
            "ActiveTransitionReceiptPath",
            "ExpectedActiveTransitionReceiptSha256",
            "prior_staged_task_definition_id",
            "active_task_definition_id",
            "active task definition ID must differ from prior staged ID",
            "active transition receipt SHA-256 mismatch",
        ):
            with self.subTest(token=token):
                self.assertIn(token, self.preflight)

    def test_preflight_binds_action_to_new_definition_identity(self):
        expected = (
            '\'" -TaskDefinitionId "\' + $expectedDefinitionId + \'"\''
        )
        self.assertIn(expected, self.preflight)
        self.assertIn("task_definition_id", self.preflight)
        self.assertIn("matching terminal receipt cardinality", self.preflight)


    def test_graph_canonicalization_and_smoke_precede_every_publish(self):
        sync = (WIKI_DIR / "sync_wiki.ps1").read_text(encoding="ascii")
        self.assertLess(
            sync.index("canonicalize_graph.py"),
            sync.index("graph_smoke.py"),
        )
        self.assertLess(
            sync.index("graph_smoke.py"),
            sync.index(" finalize "),
        )

        cluster = self.wrapper.index("'cluster-only'")
        first_smoke = self.wrapper.index("graph_smoke.py", cluster)
        final_canonical = self.wrapper.index(
            "canonicalization-prepublish-$runId.json"
        )
        final_smoke = self.wrapper.index(
            "smoke-prepublish-$runId.json", final_canonical
        )
        finalize = self.wrapper.index(" finalize ", final_smoke)
        self.assertLess(cluster, first_smoke)
        self.assertLess(first_smoke, final_canonical)
        self.assertLess(final_canonical, final_smoke)
        self.assertLess(final_smoke, finalize)
        self.assertGreaterEqual(
            self.wrapper.count("--require-communities"), 2
        )
        self.assertEqual(sync.count("--require-communities"), 1)

    def test_each_identity_mutation_is_canonicalized_before_promotion(self):
        label = self.wrapper.index("@('label'")
        post_label = self.wrapper.index("canonicalization-postlabel-$runId.json")
        semantic = self.wrapper.index("$semanticExtractPath", post_label)
        post_semantic = self.wrapper.index(
            "canonicalization-postsemantic-$runId.json"
        )
        recluster = self.wrapper.index(
            "$postSemanticCluster = Invoke-GraphifyGuarded"
        )
        clustered_smoke = self.wrapper.index("smoke-postsemantic-$runId.json")
        promotion = self.wrapper.index("PROMOTION (THE ONLY invocation")
        self.assertLess(label, post_label)
        self.assertLess(post_label, semantic)
        self.assertLess(semantic, post_semantic)
        self.assertLess(post_semantic, recluster)
        self.assertLess(recluster, clustered_smoke)
        self.assertLess(clustered_smoke, promotion)
        self.assertNotIn("canonicalization-postsemantic-cluster", self.wrapper)

    def test_explicit_semantic_failure_blocks_integrity_publish_and_success(self):
        n5b_guard = self.wrapper.split(
            'Write-Host "--- N5b PRE-PUBLICATION GRAPH INTEGRITY ---"', 1
        )[1].split('Write-Host "--- N6 WIKI ---"', 1)[0]
        n6_guard = self.wrapper.split(
            'Write-Host "--- N6 WIKI ---"', 1
        )[1].split("& $pythonExe $publishHelper --repo-root $RepoRoot prepare", 1)[0]
        final_predicate = self.wrapper.split("# Final predicate", 1)[1]
        self.assertIn('$step5Status -ne "FAIL"', n5b_guard)
        self.assertIn('$step5Status -eq "FAIL"', n6_guard)
        self.assertIn('($step5Status -ne "FAIL")', final_predicate)
        self.assertIn("PROMOTION_SKIPPED_SEMANTIC_FAIL", self.wrapper)

    def test_terminal_receipt_binds_final_graph_receipts_and_link_count(self):
        for token in (
            '"canonicalization-prepublish-$runId.json"',
            '"smoke-prepublish-$runId.json"',
            "receipt_sha256 = Get-NightlyFileSha256",
            "node_count = $canonicalNodeCount",
            "link_count = $canonicalLinkCount",
            "distinct_community_count = $smokeCommunityCount",
            "final_canonicalization = $finalCanonicalizationEvidence",
            "final_graph_smoke = $finalGraphSmokeEvidence",
            '"Links: $linkCount"',
        ):
            with self.subTest(token=token):
                self.assertIn(token, self.wrapper)
        self.assertNotIn("d.get('edges',[])", self.wrapper)
        self.assertNotIn('"Edges: $edgeCount"', self.wrapper)

    def test_graph_hash_is_rechecked_before_finalize_and_after_swap(self):
        before_finalize = self.wrapper.index(
            "Test-NightlyGraphSha256 $graphPathForPublication"
        )
        finalize = self.wrapper.index(" finalize --staging")
        swap = self.wrapper.index(" swap --served")
        served_check = self.wrapper.index(
            "Test-NightlyGraphSha256 $servedGraphPath"
        )
        success = self.wrapper.index('$wikiServedStatus = "SERVED_WIKI_SWAPPED"')
        self.assertLess(before_finalize, finalize)
        self.assertLess(finalize, swap)
        self.assertLess(swap, served_check)
        self.assertEqual(
            self.wrapper.count(
                "--expected-graph-sha256 $finalGraphSmokeEvidence.graph_sha256"
            ),
            2,
        )
        self.assertLess(served_check, success)
        self.assertIn("graph bytes changed after final smoke", self.wrapper)
        self.assertIn("SERVED_WIKI_HASH_MISMATCH", self.wrapper)
        self.assertIn("served_graph_sha256 = $servedGraphSha256", self.wrapper)
        self.assertIn("graph_sha256 = $smokeGraphSha256", self.wrapper)

    def test_plain_sync_binds_smoked_graph_hash_to_publication(self):
        sync = (WIKI_DIR / "sync_wiki.ps1").read_text(encoding="ascii")
        smoke = sync.index("graph_smoke.py")
        receipt = sync.index("$plainSyncSmokeEvidence = Get-Content")
        digest = sync.index(
            "$publishedGraphSha256 = [string]$plainSyncSmokeEvidence.graph_sha256"
        )
        finalize = sync.index(" finalize ")
        swap = sync.index(" swap ")
        self.assertLess(smoke, receipt)
        self.assertLess(receipt, digest)
        self.assertLess(digest, finalize)
        self.assertLess(finalize, swap)
        self.assertIn("--receipt $plainSyncSmokeReceipt", sync)
        self.assertIn("graph_integrity.status -cne 'PASS'", sync)
        self.assertNotIn("$publishedGraphSha256 = (Get-FileHash", sync)
        self.assertEqual(
            sync.count("--expected-graph-sha256 $publishedGraphSha256"),
            2,
        )

    def test_graph_hash_helper_detects_post_smoke_mutation(self):
        if not POWERSHELL:
            self.skipTest("PowerShell unavailable")
        FOCUSED_TEST_TMP.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            graph = Path(temp_dir) / "graph.json"
            graph.write_text('{"nodes":[],"links":[]}', encoding="ascii")
            expected = hashlib.sha256(graph.read_bytes()).hexdigest()
            helper = "function Get-NightlyFileSha256" + self.wrapper.split(
                "function Get-NightlyFileSha256", 1
            )[1].split("try { . $terminalizerPath", 1)[0]
            command = (
                helper
                + f"; if (Test-NightlyGraphSha256 '{graph}' '{expected}') {{ exit 0 }} else {{ exit 1 }}"
            )
            first = subprocess.run(
                [POWERSHELL, "-NoProfile", "-Command", command],
                capture_output=True,
                text=True,
                env=fixture_environment(),
            )
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            graph.write_text(
                '{"nodes":[],"links":[],"changed":true}', encoding="ascii"
            )
            second = subprocess.run(
                [POWERSHELL, "-NoProfile", "-Command", command],
                capture_output=True,
                text=True,
                env=fixture_environment(),
            )
            self.assertEqual(second.returncode, 1, second.stdout + second.stderr)

    def test_producer_integer_helper_rejects_missing_and_coercive_scalars(self):
        if not POWERSHELL:
            self.skipTest("PowerShell unavailable")
        FOCUSED_TEST_TMP.mkdir(exist_ok=True)
        helper = "function Get-NightlyFileSha256" + self.wrapper.split(
            "function Get-NightlyFileSha256", 1
        )[1].split("try { . $terminalizerPath", 1)[0]
        cases = (
            ({"value": 1}, 0),
            ({}, 1),
            ({"value": "1"}, 1),
            ({"value": 1.0}, 1),
            ({"value": True}, 1),
            ({"value": -1}, 1),
        )
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            payload = Path(temp_dir) / "payload.json"
            for value, expected_exit in cases:
                with self.subTest(value=value):
                    payload.write_text(json.dumps(value), encoding="ascii")
                    command = (
                        helper
                        + f"; $d=Get-Content -LiteralPath '{payload}' -Raw|ConvertFrom-Json; "
                        + "try { [void](Get-NightlyExactNonnegativeInteger $d 'value' 100); exit 0 } catch { exit 1 }"
                    )
                    result = subprocess.run(
                        [POWERSHELL, "-NoProfile", "-Command", command],
                        capture_output=True,
                        text=True,
                        env=fixture_environment(),
                    )
                    self.assertEqual(
                        result.returncode,
                        expected_exit,
                        result.stdout + result.stderr,
                    )
        self.assertNotIn("[int]$canonicalData", self.wrapper)
        self.assertNotIn("[int]$smokeData", self.wrapper)

    def test_nightly_wiki_sync_array_wrapping_and_utf8_encoding(self):
        self.assertIn(
            '$hasReceipts = @(Get-ChildItem -Path $logDir -Filter "receipt-*.md" -File -ErrorAction SilentlyContinue).Count -gt 0',
            self.wrapper,
        )
        self.assertEqual(
            self.wrapper.count("open(sys.argv[1], encoding='utf-8')"),
            2,
        )
        self.assertNotIn("json.load(open(sys.argv[1]))", self.wrapper)

# Remote-autofollow tests were removed because they required in-run fetch,
# comparison, checkout, and repin behavior. Installed-runtime replacement
# coverage lives in test_l3_m0_state_index_contract.py.

class TestGraphifyGuardrailRootOnly(unittest.TestCase):
    def setUp(self):
        if not POWERSHELL:
            self.skipTest("PowerShell unavailable")
        FOCUSED_TEST_TMP.mkdir(exist_ok=True)
        self.guardrail_path = WIKI_DIR / "graphify_guardrail.ps1"
        self.guardrail = self.guardrail_path.read_text(encoding="ascii")
        self.nightly = (WIKI_DIR / "nightly_wiki_sync.ps1").read_text(encoding="ascii")
        self.semantic = (WIKI_DIR / "semantic_extract.ps1").read_text(encoding="ascii")
        self.sync = (WIKI_DIR / "sync_wiki.ps1").read_text(encoding="ascii")
        self.ollama_lock_path = WIKI_DIR / "ollama_lock.ps1"
        self.ollama_lock = self.ollama_lock_path.read_text(encoding="ascii")
        self.runbook = (WIKI_DIR.parents[1] / "docs" / "WIKI_KB_OPERATIONS_2026_07.md").read_text(
            encoding="ascii"
        )

    def run_guardrail_command(self, command):
        result = subprocess.run(
            [
                POWERSHELL,
                "-NoProfile",
                "-Command",
                f". '{self.guardrail_path}'; {command}",
            ],
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return json.loads(result.stdout.strip().splitlines()[-1])

    @staticmethod
    def fake_start_process(
        timeout=True,
        exit_code=0,
        dispose_throws=False,
        initial_wait_throws=False,
        kill_throws=False,
    ):
        initial_has_exited = "$false" if timeout else "$true"
        first_wait = "$false" if timeout else "$true"
        dispose_body = "throw 'dispose failed'" if dispose_throws else "$script:disposed=$true"
        kill_body = (
            "$script:killCalls++;throw 'synthetic root kill failure'"
            if kill_throws
            else "$script:killCalls++;$this.HasExited=$true"
        )
        wait_failure = (
            "if ($milliseconds -eq 1000) { throw 'synthetic initial wait failure' };"
            if initial_wait_throws
            else ""
        )
        return (
            "$script:killCalls=0;$script:waitArgs=@();$script:disposed=$false;"
            f"$fake=[pscustomobject]@{{Id=[int]42;Handle=[int]99;HasExited={initial_has_exited};"
            f"ExitCode=[int]{exit_code}}};"
            f"$fake|Add-Member ScriptMethod Kill {{ {kill_body} }};"
            "$fake|Add-Member ScriptMethod WaitForExit { param($milliseconds) "
            "$script:waitArgs+=@($milliseconds);"
            "if ($null -eq $milliseconds) { return };"
            + wait_failure
            +
            f"if ($milliseconds -eq 1000) {{ return {first_wait} }};return $this.HasExited }};"
            f"$fake|Add-Member ScriptMethod Dispose {{ {dispose_body} }};"
            "function Start-Process { param($FilePath,$ArgumentList,[switch]$PassThru,"
            "[switch]$NoNewWindow,$RedirectStandardOutput,$RedirectStandardError) return $script:fake };"
        )

    @staticmethod
    def temp_cleanup_failure_mock():
        return (
            "$script:removeCalls=0;"
            "function Remove-Item { param($LiteralPath,[switch]$Force,$ErrorAction) "
            "$script:removeCalls++;Microsoft.PowerShell.Management\\Remove-Item "
            "-LiteralPath $LiteralPath -Force -ErrorAction SilentlyContinue;"
            "if ($script:removeCalls -eq 1) { throw 'synthetic temp cleanup failure' } };"
        )

    def test_timeout_uses_exact_retained_root_and_never_claims_tree_killed(self):
        command = self.fake_start_process() + (
            "$result=Invoke-GraphifyGuarded -GraphifyExe 'fake.exe' -GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls;"
            "WaitArgs=$script:waitArgs;Disposed=$script:disposed}|ConvertTo-Json -Depth 5 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        result = evidence["Result"]
        self.assertTrue(result["TimedOut"])
        self.assertEqual(result["ExitCode"], 124)
        self.assertEqual(result["ProcId"], 42)
        self.assertFalse(result["Killed"])
        self.assertFalse(result["GuardrailFailed"])
        self.assertTrue(result["OrphanRisk"])
        self.assertTrue(result["RootTerminated"])
        self.assertEqual(result["CleanupStatus"], "ROOT_TERMINATED_TREE_UNPROVEN")
        self.assertEqual(evidence["KillCalls"], 1)
        self.assertEqual(evidence["WaitArgs"], [1000, 5000])
        self.assertTrue(evidence["Disposed"])

    def test_pre_start_failures_are_structured_without_orphan_claim(self):
        start_failure = (
            "function Start-Process { throw 'synthetic start failure' };"
            "$result=Invoke-GraphifyGuarded -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "$result|ConvertTo-Json -Depth 5 -Compress"
        )
        result = self.run_guardrail_command(start_failure)
        self.assertTrue(result["GuardrailFailed"])
        self.assertFalse(result["OrphanRisk"])
        self.assertFalse(result["TimedOut"])
        self.assertNotEqual(result["ExitCode"], 0)
        self.assertIsNone(result["ProcId"])
        self.assertEqual(result["CleanupStatus"], "START_FAILED")
        self.assertIn("synthetic start failure", result["GuardrailError"])

        capture_failure = (
            "function Start-Process { throw 'synthetic capture start failure' };"
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "$result|ConvertTo-Json -Depth 5 -Compress"
        )
        capture_result = self.run_guardrail_command(capture_failure)
        self.assertTrue(capture_result["GuardrailFailed"])
        self.assertFalse(capture_result["OrphanRisk"])
        self.assertFalse(capture_result["TimedOut"])
        self.assertIsNone(capture_result["ProcId"])
        self.assertEqual(capture_result["TempCleanupStatus"], "REMOVED")

    def test_capture_temp_allocation_failures_are_honestly_classified(self):
        first_failure = (
            "$script:allocCalls=0;"
            "function New-GuardedTempFile { $script:allocCalls++;"
            "throw 'synthetic first allocation failure' };"
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;AllocCalls=$script:allocCalls}"
            "|ConvertTo-Json -Depth 5 -Compress"
        )
        first = self.run_guardrail_command(first_failure)
        self.assertEqual(first["AllocCalls"], 1)
        self.assertTrue(first["Result"]["GuardrailFailed"])
        self.assertFalse(first["Result"]["OrphanRisk"])
        self.assertEqual(first["Result"]["CleanupStatus"], "START_FAILED")
        self.assertEqual(first["Result"]["TempCleanupStatus"], "NOT_CREATED")
        self.assertIsNone(first["Result"]["TempCleanupError"])

        second_failure = (
            "$script:allocCalls=0;"
            "function New-GuardedTempFile { $script:allocCalls++;"
            "if($script:allocCalls -eq 2){throw 'synthetic second allocation failure'};"
            "return [System.IO.Path]::GetTempFileName() };"
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;AllocCalls=$script:allocCalls}"
            "|ConvertTo-Json -Depth 5 -Compress"
        )
        second = self.run_guardrail_command(second_failure)
        self.assertEqual(second["AllocCalls"], 2)
        self.assertTrue(second["Result"]["GuardrailFailed"])
        self.assertFalse(second["Result"]["OrphanRisk"])
        self.assertEqual(second["Result"]["CleanupStatus"], "START_FAILED")
        self.assertEqual(second["Result"]["TempCleanupStatus"], "PARTIAL_REMOVED")
        self.assertIsNone(second["Result"]["TempCleanupError"])

    def test_initial_wait_exception_attempts_exact_root_cleanup(self):
        command = self.fake_start_process(initial_wait_throws=True) + (
            "$result=Invoke-GraphifyGuarded -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls;"
            "WaitArgs=$script:waitArgs;Disposed=$script:disposed}|ConvertTo-Json -Depth 5 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        result = evidence["Result"]
        self.assertTrue(result["GuardrailFailed"])
        self.assertTrue(result["OrphanRisk"])
        self.assertFalse(result["TimedOut"])
        self.assertEqual(result["ExitCode"], 1)
        self.assertTrue(result["RootTerminated"])
        self.assertEqual(result["CleanupStatus"], "ROOT_TERMINATED_TREE_UNPROVEN")
        self.assertIn("synthetic initial wait failure", result["GuardrailError"])
        self.assertEqual(evidence["KillCalls"], 1)
        self.assertEqual(evidence["WaitArgs"], [1000, 5000])
        self.assertTrue(evidence["Disposed"])

    def test_root_kill_and_wait_failures_are_surfaced(self):
        kill_failure = (
            "$fake=[pscustomobject]@{Id=[int]42;Handle=[int]99;HasExited=$false};"
            "$fake|Add-Member ScriptMethod Kill { throw 'synthetic kill failure' };"
            "$fake|Add-Member ScriptMethod WaitForExit { param($milliseconds) $false };"
            "$result=Stop-GuardedRootProcess -Process $fake;"
            "$result|ConvertTo-Json -Compress"
        )
        kill_result = self.run_guardrail_command(kill_failure)
        self.assertFalse(kill_result["RootTerminated"])
        self.assertEqual(kill_result["Status"], "ROOT_TERMINATION_FAILED")
        self.assertIn("synthetic kill failure", kill_result["Error"])
        self.assertIn("WaitForExit timed out", kill_result["Error"])

        wait_failure = (
            "$fake=[pscustomobject]@{Id=[int]42;Handle=[int]99;HasExited=$false};"
            "$fake|Add-Member ScriptMethod Kill { $this.HasExited=$true };"
            "$fake|Add-Member ScriptMethod WaitForExit { param($milliseconds) "
            "throw 'synthetic wait failure' };"
            "$result=Stop-GuardedRootProcess -Process $fake;"
            "$result|ConvertTo-Json -Compress"
        )
        wait_result = self.run_guardrail_command(wait_failure)
        self.assertTrue(wait_result["RootTerminated"])
        self.assertEqual(wait_result["Status"], "ROOT_TERMINATION_FAILED")
        self.assertIn("synthetic wait failure", wait_result["Error"])

    def test_normal_completion_and_dispose_error_are_compatible(self):
        command = self.fake_start_process(timeout=False, exit_code=7) + (
            "$result=Invoke-GraphifyGuarded -GraphifyExe 'fake.exe' -GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls;"
            "Disposed=$script:disposed}|ConvertTo-Json -Depth 5 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        result = evidence["Result"]
        self.assertFalse(result["TimedOut"])
        self.assertEqual(result["ExitCode"], 7)
        self.assertEqual(result["ProcId"], 42)
        self.assertFalse(result["Killed"])
        self.assertFalse(result["GuardrailFailed"])
        self.assertFalse(result["OrphanRisk"])
        self.assertFalse(result["RootTerminated"])
        self.assertEqual(result["CleanupStatus"], "NOT_REQUIRED")
        self.assertEqual(evidence["KillCalls"], 0)
        self.assertTrue(evidence["Disposed"])

        capture_command = self.fake_start_process(timeout=False, exit_code=3) + (
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "$result|ConvertTo-Json -Depth 5 -Compress"
        )
        capture_result = self.run_guardrail_command(capture_command)
        self.assertFalse(capture_result["TimedOut"])
        self.assertEqual(capture_result["ExitCode"], 3)
        self.assertEqual(capture_result["ProcId"], 42)
        self.assertFalse(capture_result["Killed"])
        self.assertFalse(capture_result["GuardrailFailed"])
        self.assertFalse(capture_result["OrphanRisk"])
        self.assertEqual(capture_result["CleanupStatus"], "NOT_REQUIRED")
        self.assertEqual(capture_result["TempCleanupStatus"], "REMOVED")

        capture_dispose_command = self.fake_start_process(
            timeout=False, exit_code=0, dispose_throws=True
        ) + (
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls}"
            "|ConvertTo-Json -Depth 5 -Compress"
        )
        capture_dispose_evidence = self.run_guardrail_command(capture_dispose_command)
        capture_dispose_result = capture_dispose_evidence["Result"]
        self.assertEqual(capture_dispose_result["ExitCode"], 1)
        self.assertTrue(capture_dispose_result["GuardrailFailed"])
        self.assertFalse(capture_dispose_result["OrphanRisk"])
        self.assertFalse(capture_dispose_result["RootTerminated"])
        self.assertEqual(capture_dispose_result["CleanupStatus"], "NOT_REQUIRED")
        self.assertIn("dispose failed", capture_dispose_result["ProcessDisposeError"])
        self.assertEqual(capture_dispose_evidence["KillCalls"], 0)

        dispose_command = self.fake_start_process(
            timeout=False, exit_code=0, dispose_throws=True
        ) + (
            "$result=Invoke-GraphifyGuarded -GraphifyExe 'fake.exe' -GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls}"
            "|ConvertTo-Json -Depth 5 -Compress"
        )
        dispose_evidence = self.run_guardrail_command(dispose_command)
        dispose_result = dispose_evidence["Result"]
        self.assertEqual(dispose_result["ExitCode"], 1)
        self.assertTrue(dispose_result["GuardrailFailed"])
        self.assertFalse(dispose_result["OrphanRisk"])
        self.assertFalse(dispose_result["RootTerminated"])
        self.assertEqual(dispose_result["CleanupStatus"], "NOT_REQUIRED")
        self.assertIn("dispose failed", dispose_result["ProcessDisposeError"])
        self.assertEqual(dispose_evidence["KillCalls"], 0)

    def test_capture_cleanup_failure_does_not_mask_timeout_124(self):
        command = self.fake_start_process() + self.temp_cleanup_failure_mock() + (
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;RemoveCalls=$script:removeCalls;"
            "Disposed=$script:disposed}|ConvertTo-Json -Depth 5 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        result = evidence["Result"]
        self.assertTrue(result["TimedOut"])
        self.assertEqual(result["ExitCode"], 124)
        self.assertFalse(result["Killed"])
        self.assertTrue(result["GuardrailFailed"])
        self.assertTrue(result["OrphanRisk"])
        self.assertTrue(result["RootTerminated"])
        self.assertEqual(result["CleanupStatus"], "ROOT_TERMINATED_TREE_UNPROVEN")
        self.assertEqual(result["TempCleanupStatus"], "REMOVAL_FAILED")
        self.assertIn("synthetic temp cleanup failure", result["TempCleanupError"])
        self.assertEqual(evidence["RemoveCalls"], 2)
        self.assertTrue(evidence["Disposed"])

        nonzero_command = (
            self.fake_start_process(timeout=False, exit_code=9)
            + self.temp_cleanup_failure_mock()
            + (
                "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
                "-GraphifyArgs @('arg') -TimeoutSec 1;"
                "$result|ConvertTo-Json -Depth 5 -Compress"
            )
        )
        nonzero_result = self.run_guardrail_command(nonzero_command)
        self.assertFalse(nonzero_result["TimedOut"])
        self.assertEqual(nonzero_result["ExitCode"], 9)
        self.assertTrue(nonzero_result["GuardrailFailed"])
        self.assertFalse(nonzero_result["OrphanRisk"])
        self.assertEqual(nonzero_result["TempCleanupStatus"], "REMOVAL_FAILED")
        self.assertIn("synthetic temp cleanup failure", nonzero_result["TempCleanupError"])

        success_command = (
            self.fake_start_process(timeout=False, exit_code=0)
            + self.temp_cleanup_failure_mock()
            + (
                "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
                "-GraphifyArgs @('arg') -TimeoutSec 1;"
                "$result|ConvertTo-Json -Depth 5 -Compress"
            )
        )
        success_result = self.run_guardrail_command(success_command)
        self.assertFalse(success_result["TimedOut"])
        self.assertEqual(success_result["ExitCode"], 1)
        self.assertTrue(success_result["GuardrailFailed"])
        self.assertFalse(success_result["OrphanRisk"])
        self.assertEqual(success_result["TempCleanupStatus"], "REMOVAL_FAILED")
        self.assertIn("synthetic temp cleanup failure", success_result["TempCleanupError"])

        partial_command = (
            "$script:allocCalls=0;"
            "function New-GuardedTempFile { $script:allocCalls++;"
            "if($script:allocCalls -eq 2){throw 'synthetic second allocation failure'};"
            "return [System.IO.Path]::GetTempFileName() };"
            "function Remove-Item { param($LiteralPath,[switch]$Force,$ErrorAction) "
            "Microsoft.PowerShell.Management\\Remove-Item -LiteralPath $LiteralPath "
            "-Force -ErrorAction SilentlyContinue;throw 'synthetic partial cleanup failure' };"
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "$result|ConvertTo-Json -Depth 5 -Compress"
        )
        partial_result = self.run_guardrail_command(partial_command)
        self.assertEqual(partial_result["ExitCode"], 1)
        self.assertTrue(partial_result["GuardrailFailed"])
        self.assertFalse(partial_result["OrphanRisk"])
        self.assertEqual(
            partial_result["TempCleanupStatus"], "PARTIAL_REMOVAL_FAILED"
        )

        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            fixture_root = Path(temp_dir)
            stdout_path = fixture_root / "stdout.tmp"
            stderr_path = fixture_root / "stderr.tmp"
            stdout_path.write_text("", encoding="ascii")
            stderr_path.write_text("", encoding="ascii")
            no_op_removal = (
                f"$script:tempPaths=@('{stdout_path}','{stderr_path}');"
                "$script:tempIndex=0;function New-GuardedTempFile {"
                "$path=$script:tempPaths[$script:tempIndex];$script:tempIndex++;return $path};"
                "function Remove-Item { param($LiteralPath,[switch]$Force,$ErrorAction) return };"
            )
            no_op_command = (
                self.fake_start_process(timeout=False, exit_code=0)
                + no_op_removal
                + "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
                "-GraphifyArgs @('arg') -TimeoutSec 1;"
                "$result|ConvertTo-Json -Depth 5 -Compress"
            )
            no_op_result = self.run_guardrail_command(no_op_command)
            self.assertTrue(stdout_path.exists())
            self.assertTrue(stderr_path.exists())
            self.assertEqual(no_op_result["ExitCode"], 1)
            self.assertTrue(no_op_result["GuardrailFailed"])
            self.assertFalse(no_op_result["OrphanRisk"])
            self.assertEqual(no_op_result["TempCleanupStatus"], "REMOVAL_FAILED")
            self.assertIn("survived terminating removal", no_op_result["TempCleanupError"])

            partial_path = fixture_root / "partial.tmp"
            partial_path.write_text("", encoding="ascii")
            partial_no_op_command = (
                "$script:allocCalls=0;function New-GuardedTempFile {"
                "$script:allocCalls++;if($script:allocCalls -eq 2){"
                "throw 'synthetic second allocation failure'};"
                f"return '{partial_path}' }};"
                "function Remove-Item { param($LiteralPath,[switch]$Force,$ErrorAction) return };"
                "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
                "-GraphifyArgs @('arg') -TimeoutSec 1;"
                "$result|ConvertTo-Json -Depth 5 -Compress"
            )
            partial_no_op_result = self.run_guardrail_command(partial_no_op_command)
            self.assertTrue(partial_path.exists())
            self.assertEqual(partial_no_op_result["ExitCode"], 1)
            self.assertTrue(partial_no_op_result["GuardrailFailed"])
            self.assertFalse(partial_no_op_result["OrphanRisk"])
            self.assertEqual(
                partial_no_op_result["TempCleanupStatus"],
                "PARTIAL_REMOVAL_FAILED",
            )
            self.assertIn(
                "survived terminating removal",
                partial_no_op_result["TempCleanupError"],
            )

        semantic = (WIKI_DIR / "semantic_extract.ps1").read_text(encoding="ascii")
        self.assertLess(
            semantic.index("$tempCleanupStatus = [string]$gr.TempCleanupStatus"),
            semantic.index("if ($gr.TimedOut)"),
        )
        self.assertIn(
            'Write-Log "Graphify temp cleanup evidence: '
            'status=$tempCleanupStatus; error=$tempCleanupError"',
            semantic,
        )
        self.assertIn('"Temp Cleanup Status: $tempCleanupStatus"', semantic)
        self.assertIn('"Temp Cleanup Error: $tempCleanupError"', semantic)
        self.assertIn("redirected temp cleanup failed", self.guardrail)
        self.assertIn("$releaseFailed", semantic)

    def test_capture_output_read_failure_preserves_timeout_evidence(self):
        normal_command = self.fake_start_process(timeout=False, exit_code=0) + (
            "function Get-Content { throw 'synthetic normal output read failure' };"
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls;"
            "Disposed=$script:disposed}|ConvertTo-Json -Depth 5 -Compress"
        )
        normal_evidence = self.run_guardrail_command(normal_command)
        normal_result = normal_evidence["Result"]
        self.assertFalse(normal_result["TimedOut"])
        self.assertEqual(normal_result["ExitCode"], 1)
        self.assertTrue(normal_result["GuardrailFailed"])
        self.assertFalse(normal_result["OrphanRisk"])
        self.assertFalse(normal_result["RootTerminated"])
        self.assertEqual(normal_result["CleanupStatus"], "NOT_REQUIRED")
        self.assertIn("normal output read failure", normal_result["OutputReadError"])
        self.assertEqual(normal_evidence["KillCalls"], 0)
        self.assertTrue(normal_evidence["Disposed"])

        command = self.fake_start_process(kill_throws=True) + (
            "function Get-Content { throw 'synthetic output read failure' };"
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls;"
            "Disposed=$script:disposed}|ConvertTo-Json -Depth 5 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        result = evidence["Result"]
        self.assertTrue(result["TimedOut"])
        self.assertEqual(result["ExitCode"], 124)
        self.assertTrue(result["GuardrailFailed"])
        self.assertTrue(result["OrphanRisk"])
        self.assertFalse(result["RootTerminated"])
        self.assertEqual(result["CleanupStatus"], "ROOT_TERMINATION_FAILED")
        self.assertIn("synthetic root kill failure", result["CleanupError"])
        self.assertIn("WaitForExit timed out", result["CleanupError"])
        self.assertIn("synthetic output read failure", result["OutputReadError"])
        self.assertIn("redirected output read failed", result["GuardrailError"])
        self.assertEqual(evidence["KillCalls"], 1)
        self.assertTrue(evidence["Disposed"])

    def test_timeout_cleanup_failures_are_wrapper_guardrail_failures(self):
        standard_command = self.fake_start_process(kill_throws=True) + (
            "$result=Invoke-GraphifyGuarded -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls}"
            "|ConvertTo-Json -Depth 5 -Compress"
        )
        standard_evidence = self.run_guardrail_command(standard_command)
        standard = standard_evidence["Result"]
        self.assertTrue(standard["TimedOut"])
        self.assertEqual(standard["ExitCode"], 124)
        self.assertEqual(standard["ProcId"], 42)
        self.assertFalse(standard["Killed"])
        self.assertTrue(standard["GuardrailFailed"])
        self.assertTrue(standard["OrphanRisk"])
        self.assertFalse(standard["RootTerminated"])
        self.assertEqual(standard["CleanupStatus"], "ROOT_TERMINATION_FAILED")
        self.assertIn("synthetic root kill failure", standard["CleanupError"])
        self.assertEqual(standard_evidence["KillCalls"], 1)

        capture_command = self.fake_start_process(kill_throws=True) + (
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 1;"
            "[pscustomobject]@{Result=$result;KillCalls=$script:killCalls}"
            "|ConvertTo-Json -Depth 5 -Compress"
        )
        capture_evidence = self.run_guardrail_command(capture_command)
        capture = capture_evidence["Result"]
        self.assertTrue(capture["TimedOut"])
        self.assertEqual(capture["ExitCode"], 124)
        self.assertEqual(capture["ProcId"], 42)
        self.assertFalse(capture["Killed"])
        self.assertTrue(capture["GuardrailFailed"])
        self.assertTrue(capture["OrphanRisk"])
        self.assertFalse(capture["RootTerminated"])
        self.assertEqual(capture["CleanupStatus"], "ROOT_TERMINATION_FAILED")
        self.assertIn("synthetic root kill failure", capture["CleanupError"])
        self.assertIsNone(capture["OutputReadError"])
        self.assertEqual(capture_evidence["KillCalls"], 1)

    def test_nightly_semantic_exit_124_always_sets_orphan_risk(self):
        condition = next(
            line.strip()
            for line in self.nightly.splitlines()
            if line.strip().startswith("if ($sr.OrphanRisk")
        )
        self.assertEqual(self.nightly.count(condition), 1)
        command = (
            "$cases=@("
            "[pscustomobject]@{OrphanRisk=$false;ExitCode=124},"
            "[pscustomobject]@{OrphanRisk=$true;ExitCode=1},"
            "[pscustomobject]@{OrphanRisk=$false;ExitCode=1});"
            "$risks=@();foreach($sr in $cases){$gpuOrphanRisk=$false;"
            + condition
            + ";$risks+=@($gpuOrphanRisk)};$risks|ConvertTo-Json -Compress"
        )
        risks = self.run_guardrail_command(command)
        self.assertEqual(risks, [True, True, False])

    def test_production_n5_plan_truth_table_and_source_binding(self):
        helper_tail = self.nightly.split(
            "function Get-NightlyN5Plan", 1
        )[1]
        helper = (
            "function Get-NightlyN5Plan"
            + helper_tail.split("\nfunction Get-NightlyN5ReleaseMode", 1)[0]
        )
        command = (
            helper
            + ";$plans=@("
            "(Get-NightlyN5Plan -SkipLabeling $false -SkipSemantic $false "
            "-LabelOnlyExpiryMinutes 60 -LabelAndSemanticExpiryMinutes 150),"
            "(Get-NightlyN5Plan -SkipLabeling $false -SkipSemantic $true "
            "-LabelOnlyExpiryMinutes 60 -LabelAndSemanticExpiryMinutes 150),"
            "(Get-NightlyN5Plan -SkipLabeling $true -SkipSemantic $false "
            "-LabelOnlyExpiryMinutes 60 -LabelAndSemanticExpiryMinutes 150),"
            "(Get-NightlyN5Plan -SkipLabeling $true -SkipSemantic $true "
            "-LabelOnlyExpiryMinutes 60 -LabelAndSemanticExpiryMinutes 150));"
            "$plans|ConvertTo-Json -Depth 5 -Compress"
        )
        plans = self.run_guardrail_command(command)
        self.assertEqual(
            plans,
            [
                {
                    "Mode": "LABEL_AND_SEMANTIC",
                    "SkipAll": False,
                    "RunLabel": True,
                    "RunSemantic": True,
                    "LockExpiryMinutes": 150,
                },
                {
                    "Mode": "LABEL_ONLY",
                    "SkipAll": False,
                    "RunLabel": True,
                    "RunSemantic": False,
                    "LockExpiryMinutes": 60,
                },
                {
                    "Mode": "SEMANTIC_ONLY",
                    "SkipAll": False,
                    "RunLabel": False,
                    "RunSemantic": True,
                    "LockExpiryMinutes": 150,
                },
                {
                    "Mode": "SKIP_ALL",
                    "SkipAll": True,
                    "RunLabel": False,
                    "RunSemantic": False,
                    "LockExpiryMinutes": 0,
                },
            ],
        )
        n5 = self.nightly.split('Write-Host "--- N5 SEMANTIC ---"', 1)[1].split(
            'Write-Host "--- N5b PRE-PUBLICATION GRAPH INTEGRITY ---"', 1
        )[0]
        for production_binding in (
            "$n5Plan = Get-NightlyN5Plan",
            "$($n5Plan.Mode)",
            "elseif ($n5Plan.SkipAll)",
            "$lockMins = $n5Plan.LockExpiryMinutes",
            "if ($n5Plan.RunLabel)",
            "if ($n5Plan.RunSemantic -and -not $gpuOrphanRisk -and -not $step5Fail)",
        ):
            with self.subTest(production_binding=production_binding):
                self.assertIn(production_binding, n5)
        after_plan_creation = n5.split(
            "-LabelAndSemanticExpiryMinutes $cfgExpiryLabelSem", 1
        )[1]
        self.assertNotIn("$SkipLabeling", after_plan_creation)
        self.assertNotIn("$SkipSemantic", after_plan_creation)
        self.assertEqual(n5.count("Invoke-NightlyN5Release"), 1)
        self.assertEqual(n5.count("Invoke-OllamaLockRelease"), 0)
        unexpected = n5.index('Write-Host "FAIL: unexpected N5 exception:')
        self.assertLess(n5.rindex("} catch {", 0, unexpected), unexpected)
        self.assertGreater(n5.index("} finally {", unexpected), unexpected)

    def test_contract_d_skip_all_decision_is_behaviorally_exact_and_side_effect_free(self):
        plan_tail = self.nightly.split("function Get-NightlyN5Plan", 1)[1]
        plan_helper = "function Get-NightlyN5Plan" + plan_tail.split(
            "\nfunction Test-NightlyN5DecisionEvidence", 1
        )[0]
        decision_tail = self.nightly.split("function Test-NightlyN5DecisionEvidence", 1)[1]
        decision_helper = "function Test-NightlyN5DecisionEvidence" + decision_tail.split(
            "\nfunction Get-NightlyN5ReleaseMode", 1
        )[0]
        release_tail = self.nightly.split("function Test-NightlyN5ReleaseEvidence", 1)[1]
        release_validator = "function Test-NightlyN5ReleaseEvidence" + release_tail.split(
            "\nfunction Test-NightlySemanticEvidenceSuccess", 1
        )[0]
        scan_tail = self.nightly.split("function Test-NightlyN5PostMutationScanEvidence", 1)[1]
        scan_validator = "function Test-NightlyN5PostMutationScanEvidence" + scan_tail.split(
            "\nfunction Invoke-NightlyN5PostMutationScan", 1
        )[0]
        command = (
            plan_helper
            + decision_helper
            + release_validator
            + scan_validator
            + ";$plan=Get-NightlyN5Plan -SkipLabeling $true -SkipSemantic $true -LabelOnlyExpiryMinutes 60 -LabelAndSemanticExpiryMinutes 150;"
            + "$scan=[pscustomobject][ordered]@{status='NOT_REQUIRED';mutation_attempted=$false;exit_code=$null;error=''};"
            + "$release=[pscustomobject][ordered]@{required=$false;status='NOT_REQUIRED';selected_mode=$null;observed=$null;error='';GraphOrphanRisk=$false};"
            + "$ok=Test-NightlyN5DecisionEvidence -Plan $plan -ExpectedSkipLabeling $true -ExpectedSkipSemantic $true -MutationAttempted $false -SemanticExecutionAttempted $false -ReleaseRequired $false -ExpectedReleaseGraphOrphanRisk $false -SemanticStatus 'SEMANTIC_SKIPPED_SkipFlags' -PostMutationScan $scan -ReleaseEvidence $release;"
            + "$bad=@();foreach($case in @('mutation','semantic','release','status','expectedRisk')){$m=$false;$s=$false;$r=$false;$risk=$false;$status='SEMANTIC_SKIPPED_SkipFlags';if($case-eq'mutation'){$m=$true};if($case-eq'semantic'){$s=$true};if($case-eq'release'){$r=$true};if($case-eq'status'){$status='OK'};if($case-eq'expectedRisk'){$risk=$true};$bad+=@(Test-NightlyN5DecisionEvidence -Plan $plan -ExpectedSkipLabeling $true -ExpectedSkipSemantic $true -MutationAttempted $m -SemanticExecutionAttempted $s -ReleaseRequired $r -ExpectedReleaseGraphOrphanRisk $risk -SemanticStatus $status -PostMutationScan $scan -ReleaseEvidence $release)};"
            + "[pscustomobject]@{Plan=$plan;Valid=$ok;Contradictions=$bad}|ConvertTo-Json -Depth 5 -Compress"
        )
        result = self.run_guardrail_command(command)
        self.assertEqual(
            result["Plan"],
            {
                "Mode": "SKIP_ALL",
                "SkipAll": True,
                "RunLabel": False,
                "RunSemantic": False,
                "LockExpiryMinutes": 0,
            },
        )
        self.assertTrue(result["Valid"])
        self.assertEqual(result["Contradictions"], [False, False, False, False, False])

        n5 = self.nightly.split('Write-Host "--- N5 SEMANTIC ---"', 1)[1].split(
            'Write-Host "--- N5b PRE-PUBLICATION GRAPH INTEGRITY ---"', 1
        )[0]
        skip_branch = n5.split("if ($semanticSkippedReason)", 1)[1].split("} else {", 1)[0]
        for forbidden in (
            "Invoke-OllamaLockAcquire",
            "Invoke-GraphifyGuarded",
            "promotion.py",
            "Invoke-NightlyN5PostMutationScan",
        ):
            self.assertNotIn(forbidden, skip_branch)

    def test_nightly_binds_one_absolute_ps51_host_for_every_powershell_child(self):
        assignment = "$windowsPowerShell51 = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'"
        self.assertEqual(self.nightly.count(assignment), 1)
        self.assertEqual(self.nightly.count("& $windowsPowerShell51 -NoProfile"), 3)
        self.assertEqual(
            self.nightly.count("Invoke-GraphifyGuarded -GraphifyExe $windowsPowerShell51"),
            1,
        )
        self.assertNotRegex(self.nightly, r"(?im)^\s*&\s+powershell(?:\.exe)?\b")
        self.assertNotRegex(self.nightly, r"-GraphifyExe\s+['\"]powershell(?:\.exe)?['\"]")

    def test_production_n5_release_selection_is_fail_closed(self):
        helper_tail = self.nightly.split(
            "function Get-NightlyN5ReleaseMode", 1
        )[1]
        helper = (
            "function Get-NightlyN5ReleaseMode"
            + helper_tail.split("\ntry { . $terminalizerPath }", 1)[0]
        )
        command = (
            helper
            + ";$script:calls=@();"
            "function New-OllamaReleaseResult { param([string]$RequestedMode,[string]$Error='');"
            "[pscustomobject]@{schema_version='1.0';requested_mode=$RequestedMode;"
            "outcome='FAILED';evidence_valid=$false;ownership_matched=$false;"
            "lock_absent=$false;manual_hold_verified=$false;drift_log_written=$false;"
            "marker_written=$false;error=$Error} };"
            "function Test-OllamaReleaseResult { param($Result,[string]$ExpectedRequestedMode);"
            "return ($Result.evidence_valid -and $Result.requested_mode -ceq $ExpectedRequestedMode) };"
            "function Invoke-OllamaLockRelease { param($Handle,[switch]$GpuOrphanRisk,"
            "[string]$Status);$manual=$PSBoundParameters.ContainsKey('GpuOrphanRisk');"
            "$requested=if($manual){'MANUAL_HOLD'}else{$Status};"
            "$script:calls+=@([pscustomobject]@{Handle=$Handle;GpuSwitch=$manual;Status=$Status});"
            "[pscustomobject]@{schema_version='1.0';requested_mode=$requested;"
            "outcome=if($manual){'VERIFIED_MANUAL_HOLD'}else{'VERIFIED_RELEASED'};"
            "evidence_valid=$true;ownership_matched=$true;lock_absent=(-not $manual);"
            "manual_hold_verified=$manual;drift_log_written=$true;marker_written=$manual;error=''} };"
            "$cases=@("
            "[pscustomobject]@{O=$false;F=$false;U=$false},"
            "[pscustomobject]@{O=$false;F=$false;U=$true},"
            "[pscustomobject]@{O=$false;F=$true;U=$false},"
            "[pscustomobject]@{O=$false;F=$true;U=$true},"
            "[pscustomobject]@{O=$true;F=$false;U=$false},"
            "[pscustomobject]@{O=$true;F=$false;U=$true},"
            "[pscustomobject]@{O=$true;F=$true;U=$false},"
            "[pscustomobject]@{O=$true;F=$true;U=$true});"
            "$results=@();foreach($case in $cases){$before=$script:calls.Count;"
            "$release=Invoke-NightlyN5Release -Handle 'h' -GpuOrphanRisk $case.O "
            "-Step5Fail $case.F -UnexpectedException $case.U;"
            "$call=$script:calls[-1];$results+=@([pscustomobject]@{"
            "O=$case.O;F=$case.F;U=$case.U;InvocationCount=$script:calls.Count-$before;"
            "SelectedMode=$release.selected_mode;EvidenceStatus=$release.status;"
            "ObservedMode=$release.observed.requested_mode;ObservedOutcome=$release.observed.outcome;"
            "GraphOrphanRisk=$release.GraphOrphanRisk;GpuSwitch=$call.GpuSwitch;Status=$call.Status})};"
            "$results|ConvertTo-Json -Depth 5 -Compress"
        )
        releases = self.run_guardrail_command(command)
        expected_modes = (
            "COMPLETED_GREEN",
            "COMPLETED_RED",
            "COMPLETED_RED",
            "COMPLETED_RED",
            "MANUAL_HOLD",
            "MANUAL_HOLD",
            "MANUAL_HOLD",
            "MANUAL_HOLD",
        )
        for result, expected_mode in zip(releases, expected_modes):
            self.assertEqual(result["InvocationCount"], 1)
            self.assertEqual(result["SelectedMode"], expected_mode)
            self.assertEqual(result["ObservedMode"], expected_mode)
            self.assertEqual(result["EvidenceStatus"], "PASS")
            self.assertEqual(result["GraphOrphanRisk"], result["O"])
            self.assertEqual(result["GpuSwitch"], expected_mode == "MANUAL_HOLD")
            expected_status = "" if expected_mode == "MANUAL_HOLD" else expected_mode
            self.assertEqual(result.get("Status"), expected_status)

        failure_command = (
            helper
            + ";$script:releaseCalls=0;"
            "function New-OllamaReleaseResult { param([string]$RequestedMode,[string]$Error='');"
            "[pscustomobject]@{schema_version='1.0';requested_mode=$RequestedMode;"
            "outcome='FAILED';evidence_valid=$false;ownership_matched=$false;"
            "lock_absent=$false;manual_hold_verified=$false;drift_log_written=$false;"
            "marker_written=$false;error=$Error} };"
            "function Test-OllamaReleaseResult { return $false };"
            "function Invoke-OllamaLockRelease { param($Handle,[switch]$GpuOrphanRisk,"
            "[string]$Status);$script:releaseCalls++;throw 'synthetic release failure' };"
            "$releaseResult=Invoke-NightlyN5Release -Handle 'h' "
            "-GpuOrphanRisk $false -Step5Fail $false -UnexpectedException $false;"
            "[pscustomobject]@{Calls=$script:releaseCalls;Status=$releaseResult.status;"
            "Error=$releaseResult.observed.error}|ConvertTo-Json -Compress"
        )
        failure = self.run_guardrail_command(failure_command)
        self.assertEqual(failure["Calls"], 1)
        self.assertIn("synthetic release failure", failure["Error"])
        self.assertEqual(failure["Status"], "FAIL")

        release_result_tail = self.ollama_lock.split(
            "function New-OllamaReleaseResult", 1
        )[1]
        release_result_helpers = (
            "function New-OllamaReleaseResult"
            + release_result_tail.split("\nfunction Remove-OllamaOwnedLockFile", 1)[0]
        )
        validator_tail = self.nightly.split(
            "function Test-NightlyN5ReleaseEvidence", 1
        )[1]
        release_validator = (
            "function Test-NightlyN5ReleaseEvidence"
            + validator_tail.split("\nfunction Test-NightlySemanticEvidenceSuccess", 1)[0]
        )
        validator_command = (
            release_result_helpers
            + ";"
            + release_validator
            + ";$normal=New-OllamaReleaseResult -RequestedMode COMPLETED_GREEN "
            "-Outcome VERIFIED_RELEASED -EvidenceValid $true -OwnershipMatched $true "
            "-LockAbsent $true -DriftLogWritten $true;"
            "$manual=New-OllamaReleaseResult -RequestedMode MANUAL_HOLD "
            "-Outcome VERIFIED_MANUAL_HOLD -EvidenceValid $true -OwnershipMatched $true "
            "-ManualHoldVerified $true -DriftLogWritten $true -MarkerWritten $true;"
            "$failedObserved=New-OllamaReleaseResult -RequestedMode COMPLETED_GREEN "
            "-Error 'release failed';"
            "$thrownObserved=New-OllamaReleaseResult -RequestedMode COMPLETED_GREEN "
            "-Error 'release helper threw: synthetic';"
            "$contradict=New-OllamaReleaseResult -RequestedMode COMPLETED_GREEN "
            "-Outcome VERIFIED_RELEASED -EvidenceValid $true -OwnershipMatched $true "
            "-LockAbsent $true -DriftLogWritten $true -MarkerWritten $true;"
            "function Envelope($Mode,$Observed,[bool]$Risk,[string]$Status='PASS',[string]$Error=''){"
            "[pscustomobject][ordered]@{required=$true;status=$Status;selected_mode=$Mode;"
            "observed=$Observed;error=$Error;GraphOrphanRisk=$Risk}};"
            "$valid=Envelope COMPLETED_GREEN $normal $false;"
            "$validManual=Envelope MANUAL_HOLD $manual $true;"
            "$notRequired=[pscustomobject][ordered]@{required=$false;status='NOT_REQUIRED';"
            "selected_mode=$null;observed=$null;error='';GraphOrphanRisk=$false};"
            "$absent=[pscustomobject][ordered]@{required=$true;status='PASS';"
            "selected_mode='COMPLETED_GREEN';error='';GraphOrphanRisk=$false};"
            "$extra=[pscustomobject][ordered]@{required=$true;status='PASS';"
            "selected_mode='COMPLETED_GREEN';observed=$normal;error='';"
            "GraphOrphanRisk=$false;extra='x'};"
            "$checks=[pscustomobject][ordered]@{"
            "Valid=(Test-NightlyN5ReleaseEvidence -Evidence $valid -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "ValidManual=(Test-NightlyN5ReleaseEvidence -Evidence $validManual -ExpectedRequired $true -ExpectedGraphOrphanRisk $true);"
            "NotRequired=(Test-NightlyN5ReleaseEvidence -Evidence $notRequired -ExpectedRequired $false -ExpectedGraphOrphanRisk $false);"
            "Null=(Test-NightlyN5ReleaseEvidence -Evidence $null -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "Absent=(Test-NightlyN5ReleaseEvidence -Evidence $absent -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "Array=(Test-NightlyN5ReleaseEvidence -Evidence @($valid,$valid) -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "Extra=(Test-NightlyN5ReleaseEvidence -Evidence $extra -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "Failed=(Test-NightlyN5ReleaseEvidence -Evidence (Envelope COMPLETED_GREEN $failedObserved $false 'FAIL' 'release failed') -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "Thrown=(Test-NightlyN5ReleaseEvidence -Evidence (Envelope COMPLETED_GREEN $thrownObserved $false 'FAIL' 'release helper threw') -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "ModeMismatch=(Test-NightlyN5ReleaseEvidence -Evidence (Envelope COMPLETED_RED $normal $false) -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "Contradict=(Test-NightlyN5ReleaseEvidence -Evidence (Envelope COMPLETED_GREEN $contradict $false) -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "StatusMismatch=(Test-NightlyN5ReleaseEvidence -Evidence (Envelope COMPLETED_GREEN $normal $false 'FAIL' '') -ExpectedRequired $true -ExpectedGraphOrphanRisk $false);"
            "GraphRiskMismatch=(Test-NightlyN5ReleaseEvidence -Evidence $valid -ExpectedRequired $true -ExpectedGraphOrphanRisk $true)};"
            "$checks|ConvertTo-Json -Compress"
        )
        validator_result = self.run_guardrail_command(validator_command)
        self.assertTrue(validator_result["Valid"])
        self.assertTrue(validator_result["ValidManual"])
        self.assertTrue(validator_result["NotRequired"])
        for rejected in (
            "Null",
            "Absent",
            "Array",
            "Extra",
            "Failed",
            "Thrown",
            "ModeMismatch",
            "Contradict",
            "StatusMismatch",
            "GraphRiskMismatch",
        ):
            with self.subTest(release_validator_rejects=rejected):
                self.assertFalse(validator_result[rejected])

        plan_tail = self.nightly.split("function Get-NightlyN5Plan", 1)[1]
        plan_helper = "function Get-NightlyN5Plan" + plan_tail.split(
            "\nfunction Test-NightlyN5DecisionEvidence", 1
        )[0]
        decision_tail = self.nightly.split("function Test-NightlyN5DecisionEvidence", 1)[1]
        decision_helper = "function Test-NightlyN5DecisionEvidence" + decision_tail.split(
            "\nfunction Get-NightlyN5ReleaseMode", 1
        )[0]
        scan_tail = self.nightly.split("function Test-NightlyN5PostMutationScanEvidence", 1)[1]
        scan_validator = "function Test-NightlyN5PostMutationScanEvidence" + scan_tail.split(
            "\nfunction Invoke-NightlyN5PostMutationScan", 1
        )[0]
        decision_command = (
            release_result_helpers
            + ";"
            + plan_helper
            + decision_helper
            + release_validator
            + scan_validator
            + ";$plan=Get-NightlyN5Plan -SkipLabeling $false -SkipSemantic $false -LabelOnlyExpiryMinutes 60 -LabelAndSemanticExpiryMinutes 150;"
            "$scan=[pscustomobject][ordered]@{status='NOT_REQUIRED';mutation_attempted=$false;exit_code=$null;error=''};"
            "$normal=New-OllamaReleaseResult -RequestedMode COMPLETED_GREEN -Outcome VERIFIED_RELEASED -EvidenceValid $true -OwnershipMatched $true -LockAbsent $true -DriftLogWritten $true;"
            "$manual=New-OllamaReleaseResult -RequestedMode MANUAL_HOLD -Outcome VERIFIED_MANUAL_HOLD -EvidenceValid $true -OwnershipMatched $true -ManualHoldVerified $true -DriftLogWritten $true -MarkerWritten $true;"
            "function Envelope($Mode,$Observed,[bool]$Risk){[pscustomobject][ordered]@{required=$true;status='PASS';selected_mode=$Mode;observed=$Observed;error='';GraphOrphanRisk=$Risk}};"
            "$normalEnvelope=Envelope COMPLETED_GREEN $normal $false;$manualEnvelope=Envelope MANUAL_HOLD $manual $true;"
            "$checks=[pscustomobject][ordered]@{"
            "ManualExpectedTrue=(Test-NightlyN5DecisionEvidence -Plan $plan -ExpectedSkipLabeling $false -ExpectedSkipSemantic $false -MutationAttempted $false -SemanticExecutionAttempted $false -ReleaseRequired $true -ExpectedReleaseGraphOrphanRisk $true -SemanticStatus 'OK' -PostMutationScan $scan -ReleaseEvidence $manualEnvelope);"
            "ManualExpectedFalse=(Test-NightlyN5DecisionEvidence -Plan $plan -ExpectedSkipLabeling $false -ExpectedSkipSemantic $false -MutationAttempted $false -SemanticExecutionAttempted $false -ReleaseRequired $true -ExpectedReleaseGraphOrphanRisk $false -SemanticStatus 'OK' -PostMutationScan $scan -ReleaseEvidence $manualEnvelope);"
            "NormalExpectedFalse=(Test-NightlyN5DecisionEvidence -Plan $plan -ExpectedSkipLabeling $false -ExpectedSkipSemantic $false -MutationAttempted $false -SemanticExecutionAttempted $false -ReleaseRequired $true -ExpectedReleaseGraphOrphanRisk $false -SemanticStatus 'OK' -PostMutationScan $scan -ReleaseEvidence $normalEnvelope);"
            "NormalExpectedTrue=(Test-NightlyN5DecisionEvidence -Plan $plan -ExpectedSkipLabeling $false -ExpectedSkipSemantic $false -MutationAttempted $false -SemanticExecutionAttempted $false -ReleaseRequired $true -ExpectedReleaseGraphOrphanRisk $true -SemanticStatus 'OK' -PostMutationScan $scan -ReleaseEvidence $normalEnvelope)};"
            "$checks|ConvertTo-Json -Compress"
        )
        decision_result = self.run_guardrail_command(decision_command)
        self.assertTrue(decision_result["ManualExpectedTrue"])
        self.assertFalse(decision_result["ManualExpectedFalse"])
        self.assertTrue(decision_result["NormalExpectedFalse"])
        self.assertFalse(decision_result["NormalExpectedTrue"])

        release_seam = self.nightly.split(
            "function Invoke-NightlyN5Release", 1
        )[1].split("\nfunction Test-NightlySemanticEvidenceSuccess", 1)[0]
        self.assertEqual(release_seam.count("Invoke-OllamaLockRelease"), 1)
        self.assertIn("Get-NightlyN5ReleaseMode", release_seam)
        self.assertIn("Test-NightlyN5ReleaseEvidence", self.nightly)
        release_finally = self.nightly.split(
            'Write-Host "FAIL: unexpected N5 exception:', 1
        )[1].split("$step5Status =", 1)[0]
        self.assertIn("Test-NightlyN5ReleaseEvidence", release_finally)
        terminal_predicate = self.nightly.split(
            "if ($finalState -eq 'SUCCESS'", 1
        )[1].split("# Deliberately the last child process", 1)[0]
        self.assertIn("Test-NightlyN5DecisionEvidence", terminal_predicate)
        self.assertNotIn("Test-NightlyN5ReleaseEvidence", terminal_predicate)
        self.assertIn("-ReleaseRequired $n5ReleaseRequired", terminal_predicate)
        self.assertIn(
            "-ExpectedReleaseGraphOrphanRisk $n5ReleaseExpectedGraphOrphanRisk",
            terminal_predicate,
        )
        self.assertIn("Test-NightlyN5ReleaseEvidence", decision_helper)
        self.assertIn(
            "-ExpectedGraphOrphanRisk $ExpectedReleaseGraphOrphanRisk",
            decision_helper,
        )
        self.assertNotIn(
            "([bool]$ReleaseEvidence.GraphOrphanRisk)", decision_helper
        )
        self.assertIn("trap {", self.nightly)
        self.assertIn("Complete-NightlyRun 1 'FAILED'", self.nightly)
        self.assertIn("$n5UnexpectedException = $true", self.nightly)
        self.assertIn(
            "Write-Host \"FAIL: unexpected N5 exception:",
            self.nightly,
        )
        self.assertLess(
            self.semantic.index("if ($gr.OrphanRisk)"),
            self.semantic.index("foreach ($line in $gr.OutputLines)"),
        )
        self.assertLess(
            self.semantic.index("$guardrailFailed = $gr.GuardrailFailed"),
            self.semantic.index("foreach ($line in $gr.OutputLines)"),
        )
        self.assertLess(
            self.semantic.index("if (-not $guardrailFailed)"),
            self.semantic.index("foreach ($line in $gr.OutputLines)"),
        )
        skip_guard = (
            'if ($graphOrphanRisk -or -not $n1BuildOk -or '
            '$step2Status -ne "OK")'
        )
        self.assertEqual(self.nightly.count(skip_guard), 2)
        self.assertIn("SKIP: N3 secrets requires proven N1/N2", self.nightly)
        self.assertIn("SKIP: N4 smoke requires proven N1/N2", self.nightly)
        self.assertNotIn(".TimedOut -and -not $gr.Killed", self.nightly)
        for token in (
            "if ($gr.OrphanRisk) { $graphOrphanRisk = $true }",
            "if ($gr.OrphanRisk) { $gpuOrphanRisk = $true }",
            "if ($postSemanticCluster.OrphanRisk) { $gpuOrphanRisk = $true }",
            "$gr.GuardrailFailed -or $gr.TimedOut -or $gr.ExitCode -ne 0",
            "$sr.GuardrailFailed -or $sr.TimedOut -or $sr.ExitCode -ne 0",
        ):
            with self.subTest(token=token):
                self.assertIn(token, self.nightly)

    def test_semantic_evidence_writer_validator_and_terminal_binding(self):
        writer_tail = self.semantic.split(
            "function Write-SemanticEvidenceFile", 1
        )[1]
        writer = (
            "function Write-SemanticEvidenceFile"
            + writer_tail.split('\nWrite-Log "--- START SEMANTIC EXTRACT', 1)[0]
        )
        hash_tail = self.nightly.split("function Get-NightlyFileSha256", 1)[1]
        hash_helper = (
            "function Get-NightlyFileSha256"
            + hash_tail.split("\nfunction Get-NightlyExactNonnegativeInteger", 1)[0]
        )
        validator_tail = self.nightly.split(
            "function Get-NightlyValidatedSemanticEvidence", 1
        )[1]
        validator = (
            "function Get-NightlyValidatedSemanticEvidence"
            + validator_tail.split("\ntry { . $terminalizerPath }", 1)[0]
        )
        run_id = "12345678-1234-4123-8123-123456789abc"
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            evidence_path = str(Path(temp_dir) / "semantic-evidence.json")
            bad_path = str(Path(temp_dir) / "bad-evidence.json")
            command = (
                writer
                + ";"
                + hash_helper
                + ";"
                + validator
                + f";$path='{evidence_path}';$badPath='{bad_path}';"
                "$evidence=[pscustomobject][ordered]@{schema_version='1.0';"
                f"run_id='{run_id}';graphify_exit_code=[int]0;graphify_status='OK';"
                "timed_out=$false;guardrail_failed=$false;orphan_risk=$false;"
                "temp_cleanup_status='REMOVED';temp_cleanup_error=''};"
                "Write-SemanticEvidenceFile -Path $path -Evidence $evidence;"
                "$before=[IO.File]::ReadAllText($path);$overwriteError=$null;"
                "try{Write-SemanticEvidenceFile -Path $path -Evidence $evidence}"
                "catch{$overwriteError=$_.Exception.Message};"
                "$after=[IO.File]::ReadAllText($path);"
                f"$valid=Get-NightlyValidatedSemanticEvidence -Path $path -ExpectedRunId '{run_id}' -ObservedWrapperExitCode ([int]0);"
                "$bad=[pscustomobject][ordered]@{schema_version='1.0';"
                f"run_id='{run_id}';graphify_exit_code=[int]0;graphify_status='OK';"
                "timed_out='false';guardrail_failed=$false;orphan_risk=$false;"
                "temp_cleanup_status='REMOVED';temp_cleanup_error=''};"
                "$bad|ConvertTo-Json|Set-Content -LiteralPath $badPath -Encoding UTF8;"
                "$validationError=$null;try{Get-NightlyValidatedSemanticEvidence "
                f"-Path $badPath -ExpectedRunId '{run_id}' -ObservedWrapperExitCode ([int]0)|Out-Null"
                "}catch{$validationError=$_.Exception.Message};"
                "[pscustomobject]@{Valid=$valid;OverwriteError=$overwriteError;"
                "Unchanged=($before -ceq $after);ValidationError=$validationError}"
                "|ConvertTo-Json -Depth 6 -Compress"
            )
            result = self.run_guardrail_command(command)
        self.assertEqual(result["Valid"]["status"], "PASS")
        self.assertEqual(result["Valid"]["receipt_name"], "semantic-evidence.json")
        self.assertRegex(result["Valid"]["sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(result["Valid"]["observed_wrapper_exit_code"], 0)
        self.assertEqual(result["Valid"]["temp_cleanup_status"], "REMOVED")
        self.assertEqual(result["Valid"]["temp_cleanup_error"], "")
        self.assertTrue(result["Unchanged"])
        self.assertTrue(result["OverwriteError"])
        self.assertIn("timed_out type is invalid", result["ValidationError"])
        for source_binding in (
            "-EvidencePath', $semanticEvidencePath, '-EvidenceRunId', $runId",
            "$semanticEvidence = Get-NightlyValidatedSemanticEvidence",
            "semantic_evidence = $semanticEvidence",
            "$semanticExecutionAttempted -and -not (Test-NightlySemanticEvidenceSuccess",
        ):
            with self.subTest(source_binding=source_binding):
                self.assertIn(source_binding, self.nightly)
        self.assertIn("[System.IO.FileMode]::CreateNew", self.semantic)
        self.assertIn("EvidencePath and EvidenceRunId must be provided together", self.semantic)
        self.assertIn("nightly evidence requires SkipLock", self.semantic)
        self.assertIn("$evidenceWriteFailed = $true", self.semantic)
        self.assertIn(
            "$semanticTerminalExit = Get-SemanticTerminalExitCode", self.semantic
        )
        self.assertIn("-ReleaseFailed $releaseFailed", self.semantic)

    def test_semantic_evidence_contradiction_table_and_terminal_defense(self):
        hash_tail = self.nightly.split("function Get-NightlyFileSha256", 1)[1]
        hash_helper = (
            "function Get-NightlyFileSha256"
            + hash_tail.split("\nfunction Get-NightlyExactNonnegativeInteger", 1)[0]
        )
        semantic_tail = self.nightly.split(
            "function Test-NightlySemanticEvidenceSuccess", 1
        )[1]
        semantic_helpers = (
            "function Test-NightlySemanticEvidenceSuccess"
            + semantic_tail.split("\nfunction Invoke-NightlyN5PostMutationScan", 1)[0]
        )
        run_id = "12345678-1234-4123-8123-123456789abc"
        base = {
            "schema_version": "1.0",
            "run_id": run_id,
            "graphify_exit_code": 0,
            "graphify_status": "OK",
            "timed_out": False,
            "guardrail_failed": False,
            "orphan_risk": False,
            "temp_cleanup_status": "REMOVED",
            "temp_cleanup_error": "",
        }
        cases = [
            ("graphify_exit", {"graphify_exit_code": 7}, 0),
            ("graphify_status", {"graphify_status": "FAIL"}, 0),
            ("timeout", {"timed_out": True}, 0),
            ("guardrail", {"guardrail_failed": True}, 0),
            ("orphan", {"orphan_risk": True}, 0),
            ("cleanup_not_run", {"temp_cleanup_status": "NOT_RUN"}, 0),
            ("cleanup_not_created", {"temp_cleanup_status": "NOT_CREATED"}, 0),
            ("cleanup_partial", {"temp_cleanup_status": "PARTIAL_REMOVED"}, 0),
            (
                "cleanup_partial_failure",
                {"temp_cleanup_status": "PARTIAL_REMOVAL_FAILED"},
                0,
            ),
            ("cleanup_failure", {"temp_cleanup_status": "REMOVAL_FAILED"}, 0),
            ("cleanup_error", {"temp_cleanup_error": "residue"}, 0),
            ("run_id", {"run_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}, 0),
            ("outer_exit", {}, 1),
        ]
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            payload = Path(temp_dir) / "semantic-evidence.json"
            for label, changes, observed_exit in cases:
                with self.subTest(label=label):
                    candidate = dict(base)
                    candidate.update(changes)
                    payload.write_text(json.dumps(candidate), encoding="ascii")
                    command = (
                        hash_helper
                        + ";"
                        + semantic_helpers
                        + ";$errorText='';$passed=$false;try{"
                        + f"Get-NightlyValidatedSemanticEvidence -Path '{payload}' "
                        + f"-ExpectedRunId '{run_id}' -ObservedWrapperExitCode ([int]{observed_exit})|Out-Null;"
                        + "$passed=$true}catch{$errorText=$_.Exception.Message};"
                        + "[pscustomobject]@{Passed=$passed;Error=$errorText}|ConvertTo-Json -Compress"
                    )
                    result = self.run_guardrail_command(command)
                    self.assertFalse(result["Passed"], result)
                    self.assertTrue(result["Error"], result)

            forged_cases = cases
            for label, changes, observed_exit in forged_cases:
                with self.subTest(forged=label):
                    candidate = dict(base)
                    candidate.update(changes)
                    candidate.update(
                        {
                            "status": "PASS",
                            "source_property_schema_valid": True,
                            "observed_wrapper_exit_code": observed_exit,
                        }
                    )
                    payload.write_text(json.dumps(candidate), encoding="ascii")
                    command = (
                        semantic_helpers.split(
                            "function Get-NightlyValidatedSemanticEvidence", 1
                        )[0]
                        + f";$d=Get-Content -LiteralPath '{payload}' -Raw|ConvertFrom-Json;"
                        + f"$ok=Test-NightlySemanticEvidenceSuccess -Evidence $d -ExpectedRunId '{run_id}';"
                        + "[pscustomobject]@{Passed=$ok}|ConvertTo-Json -Compress"
                    )
                    result = self.run_guardrail_command(command)
                    self.assertFalse(result["Passed"], result)

    def test_n5_common_post_mutation_scan_and_exact_zero_gates(self):
        exact_tail = self.nightly.split("function Test-NightlyExactZero", 1)[1]
        exact_helper = (
            "function Test-NightlyExactZero"
            + exact_tail.split("\nfunction Get-NightlyN5Plan", 1)[0]
        )
        scan_tail = self.nightly.split(
            "function Test-NightlyN5PostMutationScanEvidence", 1
        )[1]
        scan_helpers = (
            "function Test-NightlyN5PostMutationScanEvidence"
            + scan_tail.split("\ntry { . $terminalizerPath }", 1)[0]
        )
        exact_command = (
            exact_helper
            + ";$values=@([int]0,[int]1,[int]2,[int]7,[int]124);$out=@();"
            + "foreach($value in $values){$out+=@(Test-NightlyExactZero $value)};"
            + "$out|ConvertTo-Json -Compress"
        )
        self.assertEqual(
            self.run_guardrail_command(exact_command),
            [True, False, False, False, False],
        )
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            root = Path(temp_dir)
            valid_root = root / "valid"
            valid_graph = valid_root / "graphify-out"
            valid_graph.mkdir(parents=True)
            (valid_graph / "graph.json").write_text("{}", encoding="ascii")
            missing_target_root = root / "missing-target"
            missing_target_root.mkdir()
            missing_graph_root = root / "missing-graph"
            (missing_graph_root / "graphify-out").mkdir(parents=True)
            zero = root / "scan-zero.cmd"
            red = root / "scan-red.cmd"
            zero.write_text(
                "@echo off\necho noisy scan line one\necho noisy scan line two\nexit /b 0\n",
                encoding="ascii",
            )
            red.write_text("@echo off\nexit /b 7\n", encoding="ascii")
            command = (
                exact_helper
                + ";"
                + scan_helpers
                + f";$pass=Invoke-NightlyN5PostMutationScan -MutationAttempted $true -PythonExe '{zero}' -RepoRoot '{valid_root}';"
                + "$passCount=@($pass).Count;$passProperties=@($pass.PSObject.Properties.Name);"
                + "$passValid=Test-NightlyN5PostMutationScanEvidence -Evidence $pass -ExpectedMutationAttempted $true;"
                + f"$red=Invoke-NightlyN5PostMutationScan -MutationAttempted $true -PythonExe '{red}' -RepoRoot '{valid_root}';"
                + f"$thrown=Invoke-NightlyN5PostMutationScan -MutationAttempted $true -PythonExe '{root / 'missing.exe'}' -RepoRoot '{valid_root}';"
                + f"$missingTarget=Invoke-NightlyN5PostMutationScan -MutationAttempted $true -PythonExe '{zero}' -RepoRoot '{missing_target_root}';"
                + f"$missingGraph=Invoke-NightlyN5PostMutationScan -MutationAttempted $true -PythonExe '{zero}' -RepoRoot '{missing_graph_root}';"
                + f"$skip=Invoke-NightlyN5PostMutationScan -MutationAttempted $false -PythonExe '{root / 'missing.exe'}' -RepoRoot '{missing_target_root}';"
                + "$valid=[pscustomobject][ordered]@{status='PASS';mutation_attempted=$true;exit_code=[int]0;error=''};"
                + "$notRequired=[pscustomobject][ordered]@{status='NOT_REQUIRED';mutation_attempted=$false;exit_code=$null;error=''};"
                + "$failed=[pscustomobject][ordered]@{status='FAIL';mutation_attempted=$true;exit_code=[int]7;error='red'};"
                + "$extra=[pscustomobject][ordered]@{status='PASS';mutation_attempted=$true;exit_code=[int]0;error='';extra='x'};"
                + "$missing=[pscustomobject][ordered]@{status='PASS';mutation_attempted=$true;exit_code=[int]0};"
                + "$wrongType=[pscustomobject][ordered]@{status='PASS';mutation_attempted=$true;exit_code='0';error=''};"
                + "$contradict=[pscustomobject][ordered]@{status='PASS';mutation_attempted=$true;exit_code=[int]7;error=''};"
                + "$validator=[pscustomobject][ordered]@{"
                + "Null=(Test-NightlyN5PostMutationScanEvidence -Evidence $null -ExpectedMutationAttempted $true);"
                + "Array=(Test-NightlyN5PostMutationScanEvidence -Evidence @($valid,$valid) -ExpectedMutationAttempted $true);"
                + "Extra=(Test-NightlyN5PostMutationScanEvidence -Evidence $extra -ExpectedMutationAttempted $true);"
                + "Missing=(Test-NightlyN5PostMutationScanEvidence -Evidence $missing -ExpectedMutationAttempted $true);"
                + "WrongType=(Test-NightlyN5PostMutationScanEvidence -Evidence $wrongType -ExpectedMutationAttempted $true);"
                + "Contradict=(Test-NightlyN5PostMutationScanEvidence -Evidence $contradict -ExpectedMutationAttempted $true);"
                + "Failed=(Test-NightlyN5PostMutationScanEvidence -Evidence $failed -ExpectedMutationAttempted $true);"
                + "WrongExpected=(Test-NightlyN5PostMutationScanEvidence -Evidence $valid -ExpectedMutationAttempted $false);"
                + "NotRequired=(Test-NightlyN5PostMutationScanEvidence -Evidence $notRequired -ExpectedMutationAttempted $false)};"
                + "[pscustomobject]@{Pass=$pass;PassCount=$passCount;PassProperties=$passProperties;PassValid=$passValid;"
                + "PassStatusType=$pass.status.GetType().FullName;PassMutationType=$pass.mutation_attempted.GetType().FullName;"
                + "PassExitType=$pass.exit_code.GetType().FullName;PassErrorType=$pass.error.GetType().FullName;"
                + "Red=$red;Thrown=$thrown;MissingTarget=$missingTarget;MissingGraph=$missingGraph;Skip=$skip;Validator=$validator}"
                + "|ConvertTo-Json -Depth 7 -Compress"
            )
            result = self.run_guardrail_command(command)
        self.assertEqual(result["PassCount"], 1)
        self.assertEqual(
            result["PassProperties"],
            ["status", "mutation_attempted", "exit_code", "error"],
        )
        self.assertTrue(result["PassValid"])
        self.assertEqual(result["Pass"]["status"], "PASS")
        self.assertTrue(result["Pass"]["mutation_attempted"])
        self.assertEqual(result["Pass"]["exit_code"], 0)
        self.assertEqual(result["Pass"]["error"], "")
        self.assertEqual(result["PassStatusType"], "System.String")
        self.assertEqual(result["PassMutationType"], "System.Boolean")
        self.assertIn(result["PassExitType"], ("System.Int32", "System.Int64"))
        self.assertEqual(result["PassErrorType"], "System.String")
        self.assertEqual(result["Red"]["status"], "FAIL")
        self.assertEqual(result["Red"]["exit_code"], 7)
        self.assertEqual(result["Thrown"]["status"], "FAIL")
        self.assertEqual(result["MissingTarget"]["status"], "FAIL")
        self.assertIn("target directory is missing", result["MissingTarget"]["error"])
        self.assertEqual(result["MissingGraph"]["status"], "FAIL")
        self.assertIn("graph.json is missing", result["MissingGraph"]["error"])
        self.assertEqual(result["Skip"]["status"], "NOT_REQUIRED")
        self.assertTrue(result["Validator"]["NotRequired"])
        for rejected in (
            "Null",
            "Array",
            "Extra",
            "Missing",
            "WrongType",
            "Contradict",
            "Failed",
            "WrongExpected",
        ):
            with self.subTest(scan_validator_rejects=rejected):
                self.assertFalse(result["Validator"][rejected])

        n5 = self.nightly.split('Write-Host "--- N5 SEMANTIC ---"', 1)[1].split(
            'Write-Host "--- N5b PRE-PUBLICATION GRAPH INTEGRITY ---"', 1
        )[0]
        self.assertEqual(n5.count("Invoke-NightlyN5PostMutationScan"), 1)
        self.assertEqual(n5.count("$n5MutationAttempted = $true"), 3)
        scan = n5.index("$n5PostMutationScan = Invoke-NightlyN5PostMutationScan")
        for mutation_site in (
            "$gr = Invoke-GraphifyGuarded -GraphifyExe $graphifyExe -GraphifyArgs @('label'",
            "$sr = Invoke-GraphifyGuarded -GraphifyExe $windowsPowerShell51",
            "$postSemanticCluster = Invoke-GraphifyGuarded",
        ):
            with self.subTest(scan_after_mutation_site=mutation_site):
                self.assertGreater(scan, n5.index(mutation_site))
        self.assertLess(scan, n5.index("PROMOTION (THE ONLY invocation"))
        self.assertIn("-MutationAttempted $n5MutationAttempted", n5)
        scan_validation = n5.index(
            "Test-NightlyN5PostMutationScanEvidence -Evidence $n5PostMutationScan"
        )
        self.assertGreater(scan_validation, scan)
        self.assertLess(scan_validation, n5.index("$step5Fail = $true", scan_validation))
        terminal_predicate = self.nightly.split(
            "if ($finalState -eq 'SUCCESS'", 1
        )[1].split("# Deliberately the last child process", 1)[0]
        self.assertIn("Test-NightlyN5DecisionEvidence", terminal_predicate)
        self.assertIn("n5_post_mutation_scan = $n5PostMutationScan", self.nightly)
        self.assertIn("n5_release = $n5ReleaseEvidence", self.nightly)
        self.assertRegex(
            self.nightly,
            r"gen_docs_scope\.py[^\n]+\n\$docsScopeExit = \$LASTEXITCODE\nif \(-not \(Test-NightlyExactZero \$docsScopeExit\)\)",
        )
        self.assertRegex(
            self.nightly,
            r"graph_smoke\.py[^\n]+\n\s*\$n4SmokeExit = \$LASTEXITCODE\n\s*if \(-not \(Test-NightlyExactZero \$n4SmokeExit\)\)",
        )
        n1_gate = self.nightly.split("gen_docs_scope.py", 1)[1].split(
            "$hashBytes =", 1
        )[0]
        n4_gate = self.nightly.split('Write-Host "--- N4 SMOKE ---"', 1)[1].split(
            'Write-Host "--- N5 SEMANTIC ---"', 1
        )[0]
        self.assertIn("Complete-NightlyRun 1 'FAILED'", n1_gate)
        self.assertIn("Complete-NightlyRun 1 'FAILED'", n4_gate)

    def test_real_release_seam_is_redirected_structured_and_fail_closed(self):
        handle = (
            "$h=[pscustomobject]@{LaneId='sstac-wiki';SessionId='session-r10';"
            "OwnerPid=[int]4242;BlockId='SSTAC-R10';"
            "AcquiredAt=[datetime]'2026-08-01T18:00:00Z'};"
        )

        def run_release(root, body):
            command = (
                f". '{self.ollama_lock_path}';"
                + f"$script:OllamaControlRoot='{root}';"
                + handle
                + body
            )
            return self.run_guardrail_command(command)

        def write_lock(root, **changes):
            payload = {
                "lane_id": "sstac-wiki",
                "session_id": "session-r10",
                "process_id": 4242,
                "scheduled_block_id": "SSTAC-R10",
                "block_or_adhoc": "block",
                "purpose": "test",
                "acquired_at": "2026-08-01T18:00:00.0000000Z",
                "expires_at": "2026-08-01T20:00:00.0000000Z",
            }
            payload.update(changes)
            path = root / "OLLAMA_ACTIVE.lock"
            path.write_text(json.dumps(payload), encoding="ascii")
            return path

        FOCUSED_TEST_TMP.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            base_root = Path(temp_dir)

            missing_root = base_root / "missing"
            missing_root.mkdir()
            missing = run_release(
                missing_root,
                "$r=Invoke-OllamaLockRelease -Handle $h -Status COMPLETED_RED;"
                "$r|ConvertTo-Json -Depth 5 -Compress",
            )
            self.assertEqual(missing["outcome"], "FAILED")
            self.assertIn("missing", missing["error"])

            normal_root = base_root / "normal"
            normal_root.mkdir()
            write_lock(normal_root)
            normal = run_release(
                normal_root,
                "$r=Invoke-OllamaLockRelease -Handle $h -Status COMPLETED_GREEN;"
                "$ok=Test-OllamaReleaseResult -Result $r -ExpectedRequestedMode COMPLETED_GREEN;"
                "[pscustomobject]@{Result=$r;Valid=$ok;LockExists=(Test-Path -LiteralPath (Get-OllamaLockPath));"
                "ScheduleCount=@(Get-ChildItem -LiteralPath $script:OllamaControlRoot -Filter 'OLLAMA_SCHEDULE_*.md').Count}"
                "|ConvertTo-Json -Depth 6 -Compress",
            )
            self.assertTrue(normal["Valid"])
            self.assertFalse(normal["LockExists"])
            self.assertEqual(normal["ScheduleCount"], 1)
            self.assertEqual(normal["Result"]["outcome"], "VERIFIED_RELEASED")

            mismatch_cases = (
                ("lane", {"lane_id": "other-lane"}),
                ("session", {"session_id": "other-session"}),
                ("pid", {"process_id": 9999}),
                ("block", {"scheduled_block_id": "OTHER-BLOCK"}),
            )
            for label, changes in mismatch_cases:
                with self.subTest(mismatch=label):
                    root = base_root / f"mismatch-{label}"
                    root.mkdir()
                    lock = write_lock(root, **changes)
                    before = lock.read_bytes()
                    result = run_release(
                        root,
                        "$r=Invoke-OllamaLockRelease -Handle $h -Status COMPLETED_RED;"
                        "$r|ConvertTo-Json -Depth 5 -Compress",
                    )
                    self.assertEqual(result["outcome"], "FAILED")
                    self.assertFalse(result["ownership_matched"])
                    self.assertEqual(lock.read_bytes(), before)

            delete_root = base_root / "delete-failure"
            delete_root.mkdir()
            write_lock(delete_root)
            deletion = run_release(
                delete_root,
                "function Remove-OllamaOwnedLockFile { throw 'synthetic deletion failure' };"
                "$r=Invoke-OllamaLockRelease -Handle $h -Status COMPLETED_RED;"
                "[pscustomobject]@{Result=$r;LockExists=(Test-Path -LiteralPath (Get-OllamaLockPath))}"
                "|ConvertTo-Json -Depth 6 -Compress",
            )
            self.assertEqual(deletion["Result"]["outcome"], "FAILED")
            self.assertTrue(deletion["LockExists"])

            surviving_root = base_root / "surviving-readback"
            surviving_root.mkdir()
            write_lock(surviving_root)
            surviving = run_release(
                surviving_root,
                "function Remove-OllamaOwnedLockFile { param($Path) return };"
                "$r=Invoke-OllamaLockRelease -Handle $h -Status COMPLETED_RED;"
                "[pscustomobject]@{Result=$r;LockExists=(Test-Path -LiteralPath (Get-OllamaLockPath))}"
                "|ConvertTo-Json -Depth 6 -Compress",
            )
            self.assertEqual(surviving["Result"]["outcome"], "FAILED")
            self.assertIn("survived deletion", surviving["Result"]["error"])
            self.assertTrue(surviving["LockExists"])

            drift_root = base_root / "normal-drift-failure"
            drift_root.mkdir()
            write_lock(drift_root)
            drift = run_release(
                drift_root,
                "function Write-OllamaDriftLogRow { return $false };"
                "$r=Invoke-OllamaLockRelease -Handle $h -Status COMPLETED_RED;"
                "[pscustomobject]@{Result=$r;LockExists=(Test-Path -LiteralPath (Get-OllamaLockPath));"
                "MarkerCount=@(Get-ChildItem -LiteralPath $script:OllamaControlRoot -Filter 'HITL_OLLAMA_DRIFTLOG_APPEND_FAILED_*.md').Count}"
                "|ConvertTo-Json -Depth 6 -Compress",
            )
            self.assertEqual(drift["Result"]["outcome"], "FAILED")
            self.assertTrue(drift["Result"]["lock_absent"])
            self.assertTrue(drift["Result"]["marker_written"])
            self.assertFalse(drift["LockExists"])
            self.assertEqual(drift["MarkerCount"], 1)

            hold_root = base_root / "hold-success"
            hold_root.mkdir()
            hold_path = write_lock(hold_root)
            hold = run_release(
                hold_root,
                "$r=Invoke-OllamaLockRelease -Handle $h -GpuOrphanRisk;"
                "$ok=Test-OllamaReleaseResult -Result $r -ExpectedRequestedMode MANUAL_HOLD;"
                "$body=Get-Content -LiteralPath (Get-OllamaLockPath) -Raw|ConvertFrom-Json;"
                "[pscustomobject]@{Result=$r;Valid=$ok;Body=$body;"
                "MarkerCount=@(Get-ChildItem -LiteralPath $script:OllamaControlRoot -Filter 'HITL_OLLAMA_GPU_ORPHAN_SSTAC_*.md').Count}"
                "|ConvertTo-Json -Depth 7 -Compress",
            )
            self.assertTrue(hold["Valid"], hold)
            self.assertEqual(hold["Result"]["outcome"], "VERIFIED_MANUAL_HOLD")
            self.assertEqual(hold["Body"]["process_id"], "MANUAL_HOLD")
            self.assertEqual(hold["MarkerCount"], 1)
            self.assertTrue(hold_path.exists())

            hold_write_root = base_root / "hold-write-failure"
            hold_write_root.mkdir()
            hold_write_path = write_lock(hold_write_root)
            hold_before = hold_write_path.read_bytes()
            hold_write = run_release(
                hold_write_root,
                "function Set-OllamaManualHoldContent { throw 'synthetic hold write failure' };"
                "$r=Invoke-OllamaLockRelease -Handle $h -GpuOrphanRisk;"
                "$r|ConvertTo-Json -Depth 5 -Compress",
            )
            self.assertEqual(hold_write["outcome"], "FAILED")
            self.assertEqual(hold_write_path.read_bytes(), hold_before)

            contradiction_root = base_root / "hold-contradiction"
            contradiction_root.mkdir()
            write_lock(contradiction_root)
            contradiction = run_release(
                contradiction_root,
                "function Set-OllamaManualHoldContent { param($Path,$Content);"
                "$d=$Content|ConvertFrom-Json;$d.session_id='contradiction';"
                "$d|ConvertTo-Json|Set-Content -LiteralPath $Path -Encoding ascii -ErrorAction Stop };"
                "$r=Invoke-OllamaLockRelease -Handle $h -GpuOrphanRisk;"
                "$r|ConvertTo-Json -Depth 5 -Compress",
            )
            self.assertEqual(contradiction["outcome"], "FAILED")
            self.assertIn("readback contradiction", contradiction["error"])

            marker_root = base_root / "hold-marker-failure"
            marker_root.mkdir()
            write_lock(marker_root)
            marker = run_release(
                marker_root,
                "function Write-OllamaMarkerFile { throw 'synthetic marker failure' };"
                "$r=Invoke-OllamaLockRelease -Handle $h -GpuOrphanRisk;"
                "$r|ConvertTo-Json -Depth 5 -Compress",
            )
            self.assertEqual(marker["outcome"], "FAILED")
            self.assertTrue(marker["manual_hold_verified"])
            self.assertFalse(marker["marker_written"])

            hold_drift_root = base_root / "hold-drift-failure"
            hold_drift_root.mkdir()
            write_lock(hold_drift_root)
            hold_drift = run_release(
                hold_drift_root,
                "function Write-OllamaDriftLogRow { return $false };"
                "$r=Invoke-OllamaLockRelease -Handle $h -GpuOrphanRisk;"
                "$r|ConvertTo-Json -Depth 5 -Compress",
            )
            self.assertEqual(hold_drift["outcome"], "FAILED")
            self.assertTrue(hold_drift["manual_hold_verified"])
            self.assertTrue(hold_drift["marker_written"])
            self.assertFalse(hold_drift["drift_log_written"])

        self.assertIn("$script:OllamaControlRoot = 'C:\\Projects'", self.ollama_lock)
        self.assertNotIn("param([string]$OllamaControlRoot", self.ollama_lock)
        self.assertIn("lane_id -ceq $expectedLane", self.ollama_lock)
        self.assertIn("session_id -ceq $expectedSession", self.ollama_lock)
        self.assertIn("process_id -ceq $expectedPid", self.ollama_lock)
        self.assertIn("scheduled_block_id -ceq $expectedBlock", self.ollama_lock)

    def test_release_absence_readback_error_is_structured_and_blocks_drift(self):
        FOCUSED_TEST_TMP.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP) as temp_dir:
            root = Path(temp_dir)
            lock_path = root / "OLLAMA_ACTIVE.lock"
            lock_path.write_text(
                json.dumps(
                    {
                        "lane_id": "sstac-wiki",
                        "session_id": "session-readback-error",
                        "process_id": 4242,
                        "scheduled_block_id": "SSTAC-READBACK",
                        "block_or_adhoc": "block",
                        "purpose": "isolated readback regression fixture",
                        "acquired_at": "2026-08-01T18:00:00.0000000Z",
                        "expires_at": "2026-08-01T20:00:00.0000000Z",
                    }
                ),
                encoding="ascii",
            )
            command = (
                f". '{self.ollama_lock_path}';"
                + f"$script:OllamaControlRoot='{root}';"
                + "$h=[pscustomobject]@{LaneId='sstac-wiki';"
                + "SessionId='session-readback-error';OwnerPid=[int]4242;"
                + "BlockId='SSTAC-READBACK';"
                + "AcquiredAt=[datetime]'2026-08-01T18:00:00Z'};"
                + "$script:fixtureLockPath=Get-OllamaLockPath;"
                + "$script:afterRemoval=$false;$script:driftCalls=0;"
                + "function Remove-OllamaOwnedLockFile { param([string]$Path);"
                + "[System.IO.File]::Delete($Path);$script:afterRemoval=$true };"
                + "function Test-Path { [CmdletBinding()] param([string]$LiteralPath,[string]$PathType);"
                + "if($script:afterRemoval -and $LiteralPath -eq $script:fixtureLockPath){"
                + "Write-Error 'synthetic release absence readback failure';return };"
                + "if([string]::IsNullOrEmpty($PathType)){"
                + "return Microsoft.PowerShell.Management\\Test-Path -LiteralPath $LiteralPath};"
                + "return Microsoft.PowerShell.Management\\Test-Path -LiteralPath $LiteralPath -PathType $PathType };"
                + "function Write-OllamaDriftLogRow { param([string]$Line);"
                + "$script:driftCalls++;return $true };"
                + "$r=Invoke-OllamaLockRelease -Handle $h -Status COMPLETED_RED;"
                + "[pscustomobject]@{Result=$r;DriftCalls=$script:driftCalls;"
                + "ControlRoot=$script:OllamaControlRoot;"
                + "LockExistsAfter=(Microsoft.PowerShell.Management\\Test-Path -LiteralPath $script:fixtureLockPath)}"
                + "|ConvertTo-Json -Depth 6 -Compress"
            )
            result = self.run_guardrail_command(command)
            release = result["Result"]
            self.assertEqual(release["outcome"], "FAILED")
            self.assertFalse(release["evidence_valid"])
            self.assertTrue(release["ownership_matched"])
            self.assertFalse(release["lock_absent"])
            self.assertFalse(release["drift_log_written"])
            self.assertIn("absence readback failed", release["error"])
            self.assertIn("synthetic release absence readback failure", release["error"])
            self.assertEqual(result["DriftCalls"], 0)
            self.assertFalse(result["LockExistsAfter"])
            self.assertEqual(Path(result["ControlRoot"]).resolve(), root.resolve())

    def test_release_callers_consume_observed_evidence_exactly_once(self):
        semantic_tail = self.semantic.split(
            "function Invoke-SemanticObservedRelease", 1
        )[1]
        semantic_helper = (
            "function Invoke-SemanticObservedRelease"
            + semantic_tail.split('\nWrite-Log "--- START SEMANTIC EXTRACT', 1)[0]
        )
        command = (
            semantic_helper
            + ";$script:calls=0;"
            + "function New-OllamaReleaseResult { param([string]$RequestedMode,[string]$Error='');"
            + "[pscustomobject]@{schema_version='1.0';requested_mode=$RequestedMode;outcome='FAILED';"
            + "evidence_valid=$false;ownership_matched=$false;lock_absent=$false;"
            + "manual_hold_verified=$false;drift_log_written=$false;marker_written=$false;error=$Error} };"
            + "function Invoke-OllamaLockRelease {$script:calls++;throw 'synthetic standalone release failure'};"
            + "$r=Invoke-SemanticObservedRelease -Handle 'h' -RequestedMode COMPLETED_RED -GpuOrphanRisk $false;"
            + "[pscustomobject]@{Calls=$script:calls;Result=$r}|ConvertTo-Json -Depth 5 -Compress"
        )
        result = self.run_guardrail_command(command)
        self.assertEqual(result["Calls"], 1)
        self.assertEqual(result["Result"]["outcome"], "FAILED")
        self.assertIn("synthetic standalone release failure", result["Result"]["error"])

        semantic_finally = self.semantic.split("if ($lockAcquired)", 1)[1].split(
            "$endIso =", 1
        )[0]
        self.assertEqual(semantic_finally.count("Invoke-SemanticObservedRelease"), 1)
        self.assertIn("Test-OllamaReleaseResult", semantic_finally)
        self.assertIn("$releaseFailed", self.semantic)
        self.assertIn("Get-SemanticSelectedReleaseMode", semantic_finally)
        self.assertIn("-TimedOut $timedOut", semantic_finally)
        self.assertNotIn("$gpuOrphanRisk = $true", semantic_finally)
        self.assertIn("if ($TimedOut -or $GpuOrphanRisk)", self.semantic)
        self.assertIn("Get-SemanticTerminalExitCode", self.semantic)
        self.assertIn("exit $semanticTerminalExit", self.semantic)

    def test_standalone_release_mode_and_terminal_exit_classifiers(self):
        classifier_tail = self.semantic.split(
            "function Get-SemanticSelectedReleaseMode", 1
        )[1]
        classifiers = (
            "function Get-SemanticSelectedReleaseMode"
            + classifier_tail.split('\nWrite-Log "--- START SEMANTIC EXTRACT', 1)[0]
        )
        command = (
            classifiers
            + ";$cases=@("
            "[pscustomobject]@{Name='normal';TimedOut=$false;Orphan=$false;Evidence=$false;Release=$false;Status='OK'},"
            "[pscustomobject]@{Name='ordinary';TimedOut=$false;Orphan=$false;Evidence=$false;Release=$false;Status='FAIL'},"
            "[pscustomobject]@{Name='release_failure';TimedOut=$false;Orphan=$false;Evidence=$false;Release=$true;Status='OK'},"
            "[pscustomobject]@{Name='residue';TimedOut=$false;Orphan=$false;Evidence=$false;Release=$false;Status='FAIL'},"
            "[pscustomobject]@{Name='timeout';TimedOut=$true;Orphan=$false;Evidence=$false;Release=$false;Status='FAIL'},"
            "[pscustomobject]@{Name='gpu_orphan';TimedOut=$false;Orphan=$true;Evidence=$false;Release=$true;Status='FAIL'});"
            "$out=@();foreach($case in $cases){$out+=@([pscustomobject]@{Name=$case.Name;"
            "Mode=(Get-SemanticSelectedReleaseMode -TimedOut $case.TimedOut -GpuOrphanRisk $case.Orphan -GraphifyStatus $case.Status);"
            "Exit=(Get-SemanticTerminalExitCode -TimedOut $case.TimedOut -GpuOrphanRisk $case.Orphan "
            "-EvidenceWriteFailed $case.Evidence -ReleaseFailed $case.Release -GraphifyStatus $case.Status)})};"
            "$out|ConvertTo-Json -Compress"
        )
        results = self.run_guardrail_command(command)
        expected = {
            "normal": ("COMPLETED_GREEN", 0),
            "ordinary": ("COMPLETED_RED", 1),
            "release_failure": ("COMPLETED_GREEN", 1),
            "residue": ("COMPLETED_RED", 1),
            "timeout": ("MANUAL_HOLD", 124),
            "gpu_orphan": ("MANUAL_HOLD", 124),
        }
        for result in results:
            with self.subTest(classifier=result["Name"]):
                self.assertEqual(
                    (result["Mode"], result["Exit"]), expected[result["Name"]]
                )
        semantic_finally = self.semantic.split("if ($lockAcquired)", 1)[1].split(
            "$endIso =", 1
        )[0]
        self.assertIn("Get-SemanticSelectedReleaseMode", semantic_finally)
        terminal = self.semantic.split("$semanticTerminalExit =", 1)[1]
        self.assertIn("Get-SemanticTerminalExitCode", "$semanticTerminalExit =" + terminal)
        self.assertIn("exit $semanticTerminalExit", terminal)

    def test_sync_exit_helper_and_runbook_contract(self):
        helper_tail = self.sync.split("function Get-WikiSyncGraphifyExitCode", 1)[1]
        helper = (
            "function Get-WikiSyncGraphifyExitCode"
            + helper_tail.split("\nfunction Get-WikiSyncExactNonnegativeInteger", 1)[0]
        )
        command = (
            helper
            + ";$cases=@("
            "[pscustomobject]@{TimedOut=$true;OrphanRisk=$false;GuardrailFailed=$false;ExitCode=124},"
            "[pscustomobject]@{TimedOut=$false;OrphanRisk=$true;GuardrailFailed=$false;ExitCode=0},"
            "[pscustomobject]@{TimedOut=$false;OrphanRisk=$false;GuardrailFailed=$true;ExitCode=0},"
            "[pscustomobject]@{TimedOut=$false;OrphanRisk=$false;GuardrailFailed=$false;ExitCode=7},"
            "[pscustomobject]@{TimedOut=$false;OrphanRisk=$false;GuardrailFailed=$false;ExitCode=0});"
            "$codes=@();foreach($case in $cases){$codes+=@("
            "Get-WikiSyncGraphifyExitCode -Result $case)};"
            "$codes|ConvertTo-Json -Compress"
        )
        self.assertEqual(self.run_guardrail_command(command), [124, 124, 1, 1, 0])
        self.assertIn(
            "$graphDecisionExit = Get-WikiSyncGraphifyExitCode -Result $graphResult",
            self.sync,
        )
        self.assertIn("exit 124", self.sync)
        phrase = "124 = hard timeout or explicit GPU-orphan/custody risk"
        self.assertIn(phrase, self.runbook)
        self.assertIn("if ($TimedOut -or $GpuOrphanRisk)", self.semantic)
        self.assertIn("return 124", self.semantic)
        self.assertIn("exit $semanticTerminalExit", self.semantic)
        for warning in (
            "only the exact retained root `Process` object",
            "`Killed` remains false",
            "descendant termination is unproven without a Windows Job Object",
            "not eligible",
        ):
            with self.subTest(runbook_process_warning=warning):
                self.assertIn(warning, self.runbook)
        self.assertRegex(self.runbook, r"unattended\s+scheduling")

    def test_both_wrappers_share_root_only_cleanup_and_callers_are_honest(self):
        self.assertEqual(
            self.guardrail.count("Stop-GuardedRootProcess -Process $p"),
            2,
        )
        self.assertEqual(
            self.guardrail.count("Set-GuardedCustodyFailure -Result"),
            4,
        )
        for forbidden in (
            "Win32_Process",
            "Get-CimInstance",
            "GetProcessById",
            "taskkill",
            "Stop-Process",
            "Get-Process -Id",
            "-Name",
            "ORIGINAL_IDENTITIES_GONE",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, self.guardrail)
        root_helper = self.guardrail.split("function Stop-GuardedRootProcess", 1)[1].split(
            "function Invoke-GraphifyGuarded", 1
        )[0]
        self.assertIn("$Process.Kill()", root_helper)
        self.assertIn("$Process.WaitForExit(5000)", root_helper)
        self.assertNotIn("-Id", root_helper)
        standard = self.guardrail.split("function Invoke-GraphifyGuarded", 1)[1].split(
            "function Invoke-GraphifyGuardedCapture", 1
        )[0]
        capture = self.guardrail.split("function Invoke-GraphifyGuardedCapture", 1)[1]
        self.assertIn("$exitCode = 124", standard)
        self.assertIn("-ExitCode 124", standard)
        self.assertIn("$exitCode = 124", capture)
        self.assertIn("-ExitCode 124", capture)
        self.assertEqual(self.guardrail.count("Killed = $false"), 1)
        self.assertEqual(self.guardrail.count("$Result.CleanupStatus = $cleanup.Status"), 1)
        auxiliary = self.guardrail.split(
            "function Set-GuardedAuxiliaryFailure", 1
        )[1].split("function Invoke-GraphifyGuarded", 1)[0]
        self.assertNotIn("Stop-GuardedRootProcess", auxiliary)
        # Set-GuardedAuxiliaryFailure must stay custody-free in BOTH senses: it neither terminates
        # anything nor asserts an orphan. A drain expiry sets OrphanRisk at its own call site
        # precisely so this helper's other callers keep their existing meaning.
        self.assertNotIn("OrphanRisk", auxiliary)
        smoke = (WIKI_DIR / "guardrail_smoke.ps1").read_text(encoding="ascii")
        sync = (WIKI_DIR / "sync_wiki.ps1").read_text(encoding="ascii")
        semantic = (WIKI_DIR / "semantic_extract.ps1").read_text(encoding="ascii")
        self.assertNotIn("Get-Process -Id", smoke)
        self.assertIn("ROOT_TERMINATED_TREE_UNPROVEN", smoke)
        self.assertIn("descendant tree unproven", sync)
        self.assertIn("$gpuOrphanRisk = $true", semantic)
    # --- exact-environment coverage -------------------------------------------------
    #
    # These tests exercise the -ExactEnvironment capability end to end against real child
    # processes. The guardrail reports only the block it CONFIGURED (LaunchEnvironment,
    # sourced PROCESS_START_INFO_READBACK); a child may still add variables to itself after
    # start, which no launcher can observe. Exact child-observed equality is therefore a
    # property of these fixtures, reached by ALSO declaring the keys the shell injects
    # (PSModulePath, PSExecutionPolicyPreference). Keys compare case-insensitively because
    # Windows environment keys are case-insensitive; values compare ordinally.

    ENV_PROBE_BODY = (
        "$m = @{}\n"
        "foreach ($e in [System.Environment]::GetEnvironmentVariables().GetEnumerator()) {\n"
        "    $m[[string]$e.Key] = [string]$e.Value\n"
        "}\n"
        "[pscustomobject]@{ Env = $m } | ConvertTo-Json -Depth 5 -Compress\n"
    )

    # Interleaved so a sequential reader of one stream would block once the other pipe
    # buffer filled. 1000 iterations of ~66 bytes per stream comfortably exceeds the
    # default 64 KB pipe buffer, so this fails if the drain is not concurrent.
    STREAM_PROBE_BODY = (
        "for ($i = 1; $i -le 1000; $i++) {\n"
        "    [Console]::Out.WriteLine('OUT-' + $i + '-' + ('o' * 60))\n"
        "    [Console]::Error.WriteLine('ERR-' + $i + '-' + ('e' * 60))\n"
        "}\n"
    )

    EXIT_PROBE_BODY = (
        "$code = [int]$env:GUARDRAIL_EXIT_CODE\n"
        "exit $code\n"
    )

    MARKER_PROBE_BODY = (
        "param([string]$MarkerPath)\n"
        "[System.IO.File]::WriteAllText($MarkerPath, 'started')\n"
    )

    SLEEP_PROBE_BODY = "Start-Sleep -Seconds 600\n"

    SMALL_OUTPUT_PROBE_BODY = (
        "[Console]::Out.WriteLine('probe-stdout')\n"
        "[Console]::Error.WriteLine('probe-stderr')\n"
    )

    LAUNCH_EVIDENCE_FIELDS = (
        "ExecutablePath",
        "ArgumentSnapshot",
        "EnvironmentMode",
        "LaunchEnvironment",
        "LaunchEnvironmentSource",
        "LaunchWorkingDirectory",
        "EnvironmentValidationError",
        "StartUtc",
        "EndUtc",
        "DurationMs",
    )

    def exact_probe_dir(self):
        directory = FOCUSED_TEST_TMP / "exact-env"
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    def write_exact_probe(self, name, body):
        path = self.exact_probe_dir() / name
        path.write_text(body, encoding="ascii")
        return str(path)

    @staticmethod
    def child_launch_args(probe, *extra):
        elements = [
            "'-NoProfile'",
            "'-NonInteractive'",
            "'-ExecutionPolicy'",
            "'Bypass'",
            "'-File'",
            "'%s'" % probe,
        ]
        elements.extend("'%s'" % item for item in extra)
        return "@(%s)" % ",".join(elements)

    @staticmethod
    def declaration_snippet(extra_entries=(), omit=()):
        entries = [
            ("SystemRoot", "$env:SystemRoot"),
            ("PATH", "$env:PATH"),
            ("PATHEXT", "$env:PATHEXT"),
            ("TEMP", "$env:TEMP"),
            ("TMP", "$env:TMP"),
            ("EMPTYVAL", "''"),
            ("MiXeDcAsE", "'mixed-case-value'"),
            ("PSModulePath", "'C:\\NoSuchModules'"),
            ("PSExecutionPolicyPreference", "'Bypass'"),
        ]
        entries = [entry for entry in entries if entry[0] not in omit]
        entries.extend(extra_entries)
        parts = ["$decl = New-Object 'System.Collections.Specialized.OrderedDictionary';"]
        for key, value in entries:
            parts.append("$decl['%s'] = %s;" % (key, value))
        return "".join(parts)

    @staticmethod
    def as_line_list(value):
        # ConvertTo-Json in Windows PowerShell 5.1 can render a zero- or one-element
        # collection as null or as a bare scalar, so normalise before comparing.
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        return list(value)

    @staticmethod
    def fold_environment_keys(mapping):
        folded = {}
        for key, value in mapping.items():
            upper = str(key).upper()
            if upper in folded:
                raise AssertionError("case-colliding environment key observed: %s" % key)
            folded[upper] = value
        return folded

    @classmethod
    def diff_environment(cls, declared, observed):
        declared_ci = cls.fold_environment_keys(declared)
        observed_ci = cls.fold_environment_keys(observed)
        extra = sorted(set(observed_ci) - set(declared_ci))
        missing = sorted(set(declared_ci) - set(observed_ci))
        changed = sorted(
            key
            for key in set(declared_ci) & set(observed_ci)
            if declared_ci[key] != observed_ci[key]
        )
        return extra, missing, changed

    def test_exact_environment_child_receives_only_the_declared_block(self):
        probe = self.write_exact_probe("env_probe.ps1", self.ENV_PROBE_BODY)
        command = (
            "$env:GUARDRAIL_SENTINEL_ALPHA = 'alpha-secret';"
            "$env:GUARDRAIL_SENTINEL_BETA = 'beta-secret';"
            "$env:GUARDRAIL_SENTINEL_GAMMA = 'gamma-secret';"
            + self.declaration_snippet()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120 -ExactEnvironment $decl;"
            "[pscustomobject]@{Result=$r;Declared=$decl;"
            "ParentAlpha=$env:GUARDRAIL_SENTINEL_ALPHA;"
            "ParentLeakedDeclaredKey=[bool]$env:MiXeDcAsE;"
            "ParentSentinelIsTruthy=[bool]$env:GUARDRAIL_SENTINEL_ALPHA}"
            "|ConvertTo-Json -Depth 8 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        result = evidence["Result"]
        self.assertEqual(result["ExitCode"], 0, result)
        self.assertFalse(result["GuardrailFailed"], result)
        self.assertFalse(result["TimedOut"])
        self.assertFalse(result["OrphanRisk"])
        self.assertEqual(result["CleanupStatus"], "NOT_REQUIRED")
        self.assertEqual(result["EnvironmentMode"], "EXACT")
        self.assertEqual(result["LaunchEnvironmentSource"], "PROCESS_START_INFO_READBACK")
        self.assertIsNone(result["EnvironmentValidationError"])
        self.assertIsNone(result["OutputReadError"])
        self.assertEqual(result["TempCleanupStatus"], "REMOVED")

        declared = evidence["Declared"]
        observed = json.loads(result["StdOutText"])["Env"]
        self.assertEqual(
            self.diff_environment(declared, observed),
            ([], [], []),
            result["StdOutText"],
        )

        # LaunchEnvironment is the guardrail's own read-back of the block it configured,
        # and it matches what the child actually received.
        self.assertEqual(result["LaunchEnvironment"], declared)
        self.assertEqual(self.diff_environment(result["LaunchEnvironment"], observed), ([], [], []))

        observed_ci = self.fold_environment_keys(observed)
        for sentinel in (
            "GUARDRAIL_SENTINEL_ALPHA",
            "GUARDRAIL_SENTINEL_BETA",
            "GUARDRAIL_SENTINEL_GAMMA",
        ):
            self.assertNotIn(sentinel, observed_ci)

        for required in ("PATH", "PATHEXT", "SYSTEMROOT", "TEMP", "TMP"):
            self.assertIn(required, observed_ci)
        self.assertTrue(observed_ci["PATH"])
        self.assertEqual(observed_ci["EMPTYVAL"], "")
        self.assertEqual(observed_ci["MIXEDCASE"], "mixed-case-value")
        self.assertIn("MiXeDcAsE", declared)
        self.assertIn("MiXeDcAsE", result["LaunchEnvironment"])

        # The guardrail never writes to the calling process's own environment block.
        self.assertEqual(evidence["ParentAlpha"], "alpha-secret")
        self.assertFalse(evidence["ParentLeakedDeclaredKey"])
        # Two-sided: the same [bool]$env: expression shape must be able to report True, otherwise
        # a mistyped variable name would make the assertion above pass forever.
        self.assertTrue(evidence["ParentSentinelIsTruthy"])

    def test_exact_environment_comparison_detects_a_real_undeclared_child_variable(self):
        # Two-sided proof that the equality assertion above can fail. Omitting PSModulePath
        # lets the powershell child inject PSMODULEPATH itself, which is a genuine extra
        # variable produced by a real process rather than a synthetic mutation.
        probe = self.write_exact_probe("env_probe.ps1", self.ENV_PROBE_BODY)
        command = (
            self.declaration_snippet(omit=("PSModulePath",))
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120 -ExactEnvironment $decl;"
            "[pscustomobject]@{Result=$r;Declared=$decl}|ConvertTo-Json -Depth 8 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        result = evidence["Result"]
        self.assertEqual(result["ExitCode"], 0, result)
        declared = evidence["Declared"]
        observed = json.loads(result["StdOutText"])["Env"]
        extra, missing, changed = self.diff_environment(declared, observed)
        self.assertIn("PSMODULEPATH", extra)
        self.assertEqual(missing, [])
        self.assertEqual(changed, [])
        # The configured launch block is still exactly the declaration: the extra variable
        # is the child's own, not something the guardrail leaked into the launch.
        self.assertEqual(result["LaunchEnvironment"], declared)

        # The comparison itself is falsifiable in all three directions.
        base = {"ALPHA": "1", "BETA": ""}
        self.assertEqual(
            self.diff_environment(base, {"ALPHA": "1", "BETA": "", "GAMMA": "x"}),
            (["GAMMA"], [], []),
        )
        self.assertEqual(self.diff_environment(base, {"ALPHA": "1"}), ([], ["BETA"], []))
        self.assertEqual(self.diff_environment(base, {"ALPHA": "2", "BETA": ""}), ([], [], ["ALPHA"]))
        self.assertEqual(self.diff_environment(base, {"alpha": "1", "beta": ""}), ([], [], []))

    def test_exact_environment_keeps_stdout_and_stderr_separate_and_complete(self):
        probe = self.write_exact_probe("stream_probe.ps1", self.STREAM_PROBE_BODY)
        command = (
            self.declaration_snippet()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 300 -ExactEnvironment $decl;"
            "[pscustomobject]@{ExitCode=$r.ExitCode;GuardrailFailed=$r.GuardrailFailed;"
            "TimedOut=$r.TimedOut;OutputReadError=$r.OutputReadError;"
            "TempCleanupStatus=$r.TempCleanupStatus;"
            "OutCount=@($r.StdOutLines).Count;ErrCount=@($r.StdErrLines).Count;"
            "CombinedCount=@($r.OutputLines).Count;"
            "OutFirst=@($r.StdOutLines)[0];OutLast=@($r.StdOutLines)[-1];"
            "ErrFirst=@($r.StdErrLines)[0];ErrLast=@($r.StdErrLines)[-1];"
            "CombinedFirst=@($r.OutputLines)[0];CombinedLast=@($r.OutputLines)[-1];"
            "OutStreamLeak=@($r.StdOutLines | Where-Object { $_ -like 'ERR-*' }).Count;"
            "ErrStreamLeak=@($r.StdErrLines | Where-Object { $_ -like 'OUT-*' }).Count;"
            "OutTextLast=[bool]($r.StdOutText -like '*OUT-1000-*');"
            "ErrTextLast=[bool]($r.StdErrText -like '*ERR-1000-*')}"
            "|ConvertTo-Json -Depth 6 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        self.assertEqual(evidence["ExitCode"], 0, evidence)
        self.assertFalse(evidence["GuardrailFailed"], evidence)
        self.assertFalse(evidence["TimedOut"])
        self.assertIsNone(evidence["OutputReadError"])
        self.assertEqual(evidence["TempCleanupStatus"], "REMOVED")
        self.assertEqual(evidence["OutCount"], 1000)
        self.assertEqual(evidence["ErrCount"], 1000)
        self.assertEqual(evidence["CombinedCount"], 2000)
        self.assertEqual(evidence["OutStreamLeak"], 0)
        self.assertEqual(evidence["ErrStreamLeak"], 0)
        self.assertTrue(evidence["OutFirst"].startswith("OUT-1-"))
        self.assertTrue(evidence["OutLast"].startswith("OUT-1000-"))
        self.assertTrue(evidence["ErrFirst"].startswith("ERR-1-"))
        self.assertTrue(evidence["ErrLast"].startswith("ERR-1000-"))
        self.assertEqual(evidence["CombinedFirst"], evidence["OutFirst"])
        self.assertEqual(evidence["CombinedLast"], evidence["ErrLast"])
        self.assertTrue(evidence["OutTextLast"])
        self.assertTrue(evidence["ErrTextLast"])

    def test_exact_environment_declared_value_reaches_the_child_and_exit_code_passes_through(self):
        probe = self.write_exact_probe("exit_probe.ps1", self.EXIT_PROBE_BODY)
        command = (
            self.declaration_snippet(extra_entries=(("GUARDRAIL_EXIT_CODE", "'7'"),))
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$r = Invoke-GraphifyGuarded -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 60 -ExactEnvironment $decl;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(command)
        # The child could only exit 7 by reading a variable that exists solely in the
        # declared block, so this also proves the declaration reached the process.
        self.assertEqual(result["ExitCode"], 7, result)
        self.assertFalse(result["GuardrailFailed"], result)
        self.assertFalse(result["TimedOut"])
        self.assertFalse(result["OrphanRisk"])
        self.assertFalse(result["Killed"])
        self.assertEqual(result["CleanupStatus"], "NOT_REQUIRED")
        self.assertEqual(result["EnvironmentMode"], "EXACT")
        self.assertEqual(result["LaunchEnvironmentSource"], "PROCESS_START_INFO_READBACK")
        self.assertEqual(result["LaunchEnvironment"]["GUARDRAIL_EXIT_CODE"], "7")
        self.assertIsInstance(result["ProcId"], int)

    NEGATIVE_DECLARATIONS = (
        (
            "empty_declaration",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';",
            "exact environment declaration is empty",
        ),
        (
            "empty_key",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad[''] = 'value';",
            "exact environment declares an empty key",
        ),
        (
            "whitespace_key",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['   '] = 'value';",
            "exact environment declares an empty key",
        ),
        (
            "equals_sign_in_key",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['ALPHA=BETA'] = 'value';",
            "exact environment key contains an equals sign",
        ),
        (
            "null_value",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['ALPHA'] = $null;",
            "exact environment declares a null value for key",
        ),
        (
            "array_value",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['ALPHA'] = @('one','two');",
            "has no unambiguous string conversion",
        ),
        (
            "dictionary_value",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['ALPHA'] = @{ inner = 'one' };",
            "has no unambiguous string conversion",
        ),
        (
            # CreateProcess separates "key=value" entries with NUL, so an embedded NUL splits the
            # entry and injects an undeclared variable the read-back structurally cannot see.
            "nul_in_key",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['ALPHA' + [char]0 + 'BETA'] = 'value';",
            "exact environment key contains a NUL character",
        ),
        (
            "nul_in_value",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['ALPHA'] = 'dash-v' + [char]0 + 'INJECTED=yes';",
            "contains a NUL character",
        ),
        (
            # Keys get the same allow-list as values; without it an array key silently became the
            # literal string "System.Object[]".
            "array_key",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad[@('ALPHA','BETA')] = 'value';",
            "key with no unambiguous string conversion",
        ),
        (
            "arraylist_value",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['ALPHA'] = (New-Object 'System.Collections.ArrayList');",
            "has no unambiguous string conversion",
        ),
        (
            "pscustomobject_value",
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$bad['ALPHA'] = [pscustomobject]@{ inner = 'one' };",
            "has no unambiguous string conversion",
        ),
        (
            # A plain PowerShell @{} is already case-insensitive and would silently collapse
            # these two keys into one, so the collision must be built with an ordinal
            # dictionary for the case to exist at all.
            "case_colliding_keys",
            "$bad = New-Object 'System.Collections.Generic.Dictionary[string,string]' "
            "([System.StringComparer]::Ordinal);"
            "$bad.Add('Alpha','one');$bad.Add('ALPHA','two');",
            "case-colliding duplicate key",
        ),
    )

    def test_exact_environment_invalid_declarations_are_rejected_before_launch(self):
        probe = self.write_exact_probe("marker_probe.ps1", self.MARKER_PROBE_BODY)
        marker = str(self.exact_probe_dir() / "rejected_never_started.marker")
        if os.path.exists(marker):
            os.remove(marker)
        probe_args = self.child_launch_args(probe, marker)
        for label, builder, expected in self.NEGATIVE_DECLARATIONS:
            with self.subTest(rejection=label):
                command = (
                    builder
                    + "$exe = (Get-Command powershell).Source;"
                    "$probeArgs = " + probe_args + ";"
                    "$r = Invoke-GraphifyGuarded -GraphifyExe $exe -GraphifyArgs $probeArgs "
                    "-TimeoutSec 60 -ExactEnvironment $bad;"
                    "[pscustomobject]@{Result=$r;"
                    "MarkerExists=(Test-Path -LiteralPath '" + marker + "')}"
                    "|ConvertTo-Json -Depth 8 -Compress"
                )
                evidence = self.run_guardrail_command(command)
                result = evidence["Result"]
                self.assertTrue(result["GuardrailFailed"], result)
                self.assertFalse(result["OrphanRisk"], result)
                self.assertFalse(result["TimedOut"])
                self.assertNotEqual(result["ExitCode"], 0)
                self.assertIsNone(result["ProcId"])
                self.assertEqual(result["CleanupStatus"], "START_FAILED")
                self.assertEqual(result["EnvironmentMode"], "EXACT")
                self.assertEqual(
                    result["LaunchEnvironmentSource"],
                    "EXACT_ENVIRONMENT_REJECTED_BEFORE_LAUNCH",
                )
                self.assertIsNone(result["LaunchEnvironment"])
                self.assertIn(expected, result["EnvironmentValidationError"])
                self.assertIn(expected, result["GuardrailError"])
                self.assertFalse(evidence["MarkerExists"])
        self.assertFalse(os.path.exists(marker))

    def test_exact_environment_explicit_null_is_rejected_not_silently_downgraded(self):
        # Keying the branch on $PSBoundParameters rather than on the value means a caller whose
        # declaration computed to $null gets a rejection instead of an inherited-environment launch
        # that silently hands the child every parent variable.
        command = (
            "$exe = (Get-Command powershell).Source;"
            "$r = Invoke-GraphifyGuarded -GraphifyExe $exe "
            "-GraphifyArgs @('-NoProfile','-Command','exit 0') -TimeoutSec 30 "
            "-ExactEnvironment $null;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(command)
        self.assertEqual(result["EnvironmentMode"], "EXACT", result)
        self.assertEqual(
            result["LaunchEnvironmentSource"], "EXACT_ENVIRONMENT_REJECTED_BEFORE_LAUNCH"
        )
        self.assertTrue(result["GuardrailFailed"])
        self.assertFalse(result["OrphanRisk"])
        self.assertIsNone(result["ProcId"])
        self.assertEqual(result["CleanupStatus"], "START_FAILED")
        self.assertIn("declaration is null", result["EnvironmentValidationError"])

    def guardrail_code_tokens(self):
        # Structural pins must inspect CODE, not raw text. Stripping '#' lines by hand cannot see
        # PowerShell <# block comments #>, and a raw substring count is satisfied by a commented-out
        # statement: prefixing "$drainTimeoutMs = 5000" with '#' leaves its count at one while the
        # effective drain budget silently becomes zero, which the timing bounds still tolerate.
        # Tokenising with the real 5.1 parser drops every comment form.
        script = (
            "$errors=$null;$tokens=$null;"
            "[System.Management.Automation.Language.Parser]::ParseFile('"
            + str(self.guardrail_path).replace("'", "''")
            + "',[ref]$tokens,[ref]$errors)|Out-Null;"
            "if($errors.Count -gt 0){throw ('parse errors: ' + $errors.Count)};"
            "($tokens | Where-Object { $_.Kind -ne 'Comment' } | ForEach-Object { $_.Text })"
            " -join ' '"
        )
        result = subprocess.run(
            [POWERSHELL, "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(result.stdout.strip(), "tokeniser returned nothing")
        return result.stdout

    @staticmethod
    def squash(text):
        # Token text is re-joined with single spaces, so compare whitespace-insensitively.
        return "".join(text.split())

    def test_guardrail_pins_a_single_shared_drain_budget(self):
        # Load-independent complement to the wall-clock assertion in the descendant test: budgeting
        # each stream separately would double the worst case, and a timing threshold alone is a
        # weak guard against that regression.
        code = self.squash(self.guardrail_code_tokens())

        def count(needle):
            return code.count(self.squash(needle))

        self.assertEqual(count("$drainTimeoutMs = 5000"), 1)
        self.assertEqual(
            count("$remainingMs = $drainTimeoutMs - [int]$drainClock.ElapsedMilliseconds"), 1
        )
        self.assertEqual(count(".Wait($remainingMs)"), 1)
        # The whole budget must never be handed to a single stream's wait.
        self.assertEqual(count(".Wait($drainTimeoutMs)"), 0)
        # One clock, started BEFORE the loop is entered -- the counts above all survive moving the
        # Stopwatch inside it, which is exactly the per-stream regression.
        clock = self.squash("$drainClock = [System.Diagnostics.Stopwatch]::StartNew()")
        loop = self.squash("foreach ($pending in $pendingReads)")
        self.assertEqual(code.count(clock), 1)
        self.assertEqual(code.count(loop), 1)
        self.assertLess(code.index(clock), code.index(loop))
        # ... and restarting or resetting it inside the loop would defeat that ordering pin.
        self.assertEqual(count("$drainClock.Restart"), 0)
        self.assertEqual(count("$drainClock.Reset"), 0)
        self.assertEqual(count("$drainClock.Start()"), 0)
        # The pipes must be STREAMED to disk, never buffered whole: the drain budget bounds how
        # long the guardrail waits, not how much it holds, so a buffering read would reintroduce
        # an unbounded-memory path the file-backed inherited path does not have.
        self.assertEqual(count(".ReadToEndAsync("), 0)
        self.assertEqual(count(".BaseStream.CopyToAsync("), 2)
        # ... and the DESTINATION must be the temp files. Counting CopyToAsync alone cannot tell a
        # FileStream destination from a MemoryStream one, so swapping in a MemoryStream plus a
        # WriteAllBytes would restore unbounded buffering while passing every other assertion.
        self.assertEqual(count("[System.IO.File]::Create($so)"), 1)
        self.assertEqual(count("[System.IO.File]::Create($se)"), 1)
        self.assertEqual(count("$p.StandardOutput.BaseStream.CopyToAsync($outStream)"), 1)
        self.assertEqual(count("$p.StandardError.BaseStream.CopyToAsync($errStream)"), 1)
        # The close-flush failure must not be swallowed: Dispose is where the last buffered bytes
        # reach disk, so a bare catch there would present a truncated file as complete output.
        self.assertEqual(count("redirected output flush failed"), 1)
        # The SOURCE pipes must be closed too, or an abandoned copy stays blocked on a read and
        # parks a thread and a handle for the life of the host.
        self.assertEqual(count("$sourceReader.Dispose()"), 1)
        # Evidence recorded before the readback must survive a readback failure.
        self.assertEqual(count("Join-GuardedError $drainError $readMessage"), 1)

    def test_exact_environment_valid_declaration_starts_the_child_the_rejections_blocked(self):
        # Falsification pair for the rejection test above: the same executable and the same
        # arguments DO start and DO write the marker once the declaration is valid, so those
        # rejections are not passing merely because the child could never run.
        probe = self.write_exact_probe("marker_probe.ps1", self.MARKER_PROBE_BODY)
        marker = str(self.exact_probe_dir() / "accepted_did_start.marker")
        if os.path.exists(marker):
            os.remove(marker)
        command = (
            self.declaration_snippet()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe, marker) + ";"
            "$r = Invoke-GraphifyGuarded -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 60 -ExactEnvironment $decl;"
            "[pscustomobject]@{Result=$r;"
            "MarkerExists=(Test-Path -LiteralPath '" + marker + "')}"
            "|ConvertTo-Json -Depth 8 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        result = evidence["Result"]
        self.assertEqual(result["ExitCode"], 0, result)
        self.assertFalse(result["GuardrailFailed"], result)
        self.assertEqual(result["CleanupStatus"], "NOT_REQUIRED")
        self.assertEqual(result["LaunchEnvironmentSource"], "PROCESS_START_INFO_READBACK")
        self.assertTrue(evidence["MarkerExists"])
        self.assertTrue(os.path.exists(marker))
        os.remove(marker)

    def test_exact_environment_capture_rejection_still_cleans_redirect_temp_files(self):
        command = (
            "$bad = New-Object 'System.Collections.Specialized.OrderedDictionary';"
            "$exe = (Get-Command powershell).Source;"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe "
            "-GraphifyArgs @('-NoProfile','-Command','exit 0') -TimeoutSec 60 -ExactEnvironment $bad;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(command)
        self.assertTrue(result["GuardrailFailed"])
        self.assertFalse(result["OrphanRisk"])
        self.assertIsNone(result["ProcId"])
        self.assertEqual(result["CleanupStatus"], "START_FAILED")
        self.assertEqual(result["TempCleanupStatus"], "REMOVED")
        self.assertIsNone(result["TempCleanupError"])
        self.assertEqual(self.as_line_list(result["OutputLines"]), [])
        self.assertEqual(self.as_line_list(result["StdOutLines"]), [])
        self.assertEqual(self.as_line_list(result["StdErrLines"]), [])
        self.assertEqual(
            result["LaunchEnvironmentSource"], "EXACT_ENVIRONMENT_REJECTED_BEFORE_LAUNCH"
        )
        self.assertIn("declaration is empty", result["EnvironmentValidationError"])

    def test_convert_to_guarded_exact_environment_rejects_unsupported_argument_types(self):
        # Helper-level by necessity: the entry points type the parameter as
        # [System.Collections.IDictionary], so a string/int/array is refused by PowerShell
        # parameter binding with a hard error and no result object at all. This pins the helper's
        # own contract; the reachable entry-point case is the explicit $null test above.
        command = (
            "$cases = @("
            "[pscustomobject]@{L='string';V='notadict'},"
            "[pscustomobject]@{L='integer';V=42},"
            "[pscustomobject]@{L='array';V=@('one','two')},"
            "[pscustomobject]@{L='null';V=$null},"
            "[pscustomobject]@{L='plain_hashtable';V=@{ ALPHA = 'one' }},"
            "[pscustomobject]@{L='value_type_value';V=@{ ALPHA = 42 }},"
            "[pscustomobject]@{L='value_type_key';V=@{ 42 = 'one' }});"
            "$out = @();"
            "foreach ($case in $cases) {"
            "try { $converted = ConvertTo-GuardedExactEnvironment $case.V;"
            "$out += [pscustomobject]@{Label=$case.L;Rejected=$false;Message='';"
            "Count=$converted.Count} }"
            "catch { $out += [pscustomobject]@{Label=$case.L;Rejected=$true;"
            "Message=$_.Exception.Message;Count=-1} } };"
            "ConvertTo-Json -InputObject @($out) -Depth 5 -Compress"
        )
        outcomes = {case["Label"]: case for case in self.run_guardrail_command(command)}
        self.assertEqual(len(outcomes), 7)
        for label, fragment in (
            ("string", "must be a dictionary"),
            ("integer", "must be a dictionary"),
            ("array", "must be a dictionary"),
            ("null", "declaration is null"),
        ):
            with self.subTest(unsupported=label):
                self.assertTrue(outcomes[label]["Rejected"], outcomes[label])
                self.assertIn(fragment, outcomes[label]["Message"])
        # Two-sided: an ordinary hashtable is a supported declaration, and so is a value type --
        # without this, deleting the [System.ValueType] half of the allow-list would break no test.
        self.assertFalse(outcomes["plain_hashtable"]["Rejected"], outcomes["plain_hashtable"])
        self.assertEqual(outcomes["plain_hashtable"]["Count"], 1)
        self.assertFalse(outcomes["value_type_value"]["Rejected"], outcomes["value_type_value"])
        self.assertEqual(outcomes["value_type_value"]["Count"], 1)
        # Same for the KEY allow-list: without this, deleting its [System.ValueType] half would
        # break no test, since every other fixture uses string keys.
        self.assertFalse(outcomes["value_type_key"]["Rejected"], outcomes["value_type_key"])
        self.assertEqual(outcomes["value_type_key"]["Count"], 1)

    def test_exact_environment_timeout_terminates_the_exact_root_and_cleans_up(self):
        probe = self.write_exact_probe("sleep_probe.ps1", self.SLEEP_PROBE_BODY)
        command = (
            self.declaration_snippet()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 2 -ExactEnvironment $decl;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(command)
        self.assertTrue(result["TimedOut"], result)
        self.assertEqual(result["ExitCode"], 124)
        self.assertFalse(result["Killed"])
        self.assertTrue(result["RootTerminated"])
        self.assertTrue(result["OrphanRisk"])
        self.assertFalse(result["GuardrailFailed"], result)
        self.assertEqual(result["CleanupStatus"], "ROOT_TERMINATED_TREE_UNPROVEN")
        self.assertEqual(result["TempCleanupStatus"], "REMOVED")
        self.assertIsNone(result["OutputReadError"])
        self.assertEqual(result["EnvironmentMode"], "EXACT")
        self.assertEqual(result["LaunchEnvironmentSource"], "PROCESS_START_INFO_READBACK")
        self.assertIsInstance(result["ProcId"], int)

    def test_exact_environment_start_failure_is_reported_without_an_orphan_claim(self):
        command = (
            self.declaration_snippet()
            + "$r = Invoke-GraphifyGuarded "
            "-GraphifyExe 'C:\\guardrail-no-such-executable-exact-env.exe' "
            "-GraphifyArgs @('arg') -TimeoutSec 30 -ExactEnvironment $decl;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(command)
        self.assertTrue(result["GuardrailFailed"], result)
        self.assertFalse(result["OrphanRisk"])
        self.assertFalse(result["TimedOut"])
        self.assertIsNone(result["ProcId"])
        self.assertEqual(result["CleanupStatus"], "START_FAILED")
        self.assertEqual(result["EnvironmentMode"], "EXACT")
        # The block WAS configured and read back; only the launch failed, so the evidence
        # must not claim the declaration was rejected.
        self.assertEqual(result["LaunchEnvironmentSource"], "PROCESS_START_INFO_READBACK")
        self.assertIsNotNone(result["LaunchEnvironment"])
        self.assertIsNone(result["EnvironmentValidationError"])
        self.assertTrue(result["GuardrailError"])

    def test_exact_environment_output_read_and_temp_cleanup_failures_are_classified(self):
        probe = self.write_exact_probe("small_output_probe.ps1", self.SMALL_OUTPUT_PROBE_BODY)
        probe_args = self.child_launch_args(probe)
        read_failure = (
            self.declaration_snippet()
            + "function Get-Content { param($LiteralPath,$ErrorAction) "
            "throw 'synthetic output read failure' };"
            "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + probe_args + ";"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120 -ExactEnvironment $decl;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(read_failure)
        self.assertIn("synthetic output read failure", result["OutputReadError"])
        self.assertIn("redirected output read failed", result["GuardrailError"])
        self.assertTrue(result["GuardrailFailed"])
        self.assertFalse(result["OrphanRisk"])
        self.assertEqual(result["TempCleanupStatus"], "REMOVED")
        self.assertEqual(result["EnvironmentMode"], "EXACT")

        cleanup_failure = (
            self.declaration_snippet()
            + self.temp_cleanup_failure_mock()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + probe_args + ";"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120 -ExactEnvironment $decl;"
            "[pscustomobject]@{Result=$r;RemoveCalls=$script:removeCalls}"
            "|ConvertTo-Json -Depth 8 -Compress"
        )
        evidence = self.run_guardrail_command(cleanup_failure)
        cleanup_result = evidence["Result"]
        self.assertEqual(evidence["RemoveCalls"], 2)
        self.assertEqual(cleanup_result["TempCleanupStatus"], "REMOVAL_FAILED")
        self.assertIn("synthetic temp cleanup failure", cleanup_result["TempCleanupError"])
        self.assertIn("redirected temp cleanup failed", cleanup_result["GuardrailError"])
        self.assertTrue(cleanup_result["GuardrailFailed"])
        self.assertFalse(cleanup_result["OrphanRisk"])
        # The output was still read before cleanup ran.
        self.assertEqual(self.as_line_list(cleanup_result["StdOutLines"]), ["probe-stdout"])
        self.assertEqual(self.as_line_list(cleanup_result["StdErrLines"]), ["probe-stderr"])
        # Captured lines are plain strings, not Get-Content note-property objects.
        for line in self.as_line_list(cleanup_result["StdOutLines"]):
            self.assertIsInstance(line, str)

    def test_callers_without_exact_environment_keep_prior_behavior(self):
        probe = self.write_exact_probe("env_probe.ps1", self.ENV_PROBE_BODY)
        command = (
            "$env:GUARDRAIL_INHERIT_SENTINEL = 'inherited-value';"
            "$exe = (Get-Command powershell).Source;"
            "$plain = @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',"
            "'-Command','exit 7');"
            "$r1 = Invoke-GraphifyGuarded -GraphifyExe $exe -GraphifyArgs $plain -TimeoutSec 60;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$r2 = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120;"
            "[pscustomobject]@{Standard=$r1;Capture=$r2}|ConvertTo-Json -Depth 8 -Compress"
        )
        evidence = self.run_guardrail_command(command)

        standard = evidence["Standard"]
        self.assertEqual(standard["ExitCode"], 7, standard)
        self.assertFalse(standard["TimedOut"])
        self.assertFalse(standard["GuardrailFailed"], standard)
        self.assertFalse(standard["OrphanRisk"])
        self.assertFalse(standard["Killed"])
        self.assertEqual(standard["CleanupStatus"], "NOT_REQUIRED")
        self.assertEqual(standard["EnvironmentMode"], "INHERITED")
        self.assertEqual(
            standard["LaunchEnvironmentSource"], "INHERITED_PARENT_BLOCK_NOT_CAPTURED"
        )
        self.assertIsNone(standard["LaunchEnvironment"])
        self.assertIsNone(standard["EnvironmentValidationError"])

        capture = evidence["Capture"]
        self.assertEqual(capture["ExitCode"], 0, capture)
        self.assertFalse(capture["GuardrailFailed"], capture)
        self.assertEqual(capture["EnvironmentMode"], "INHERITED")
        self.assertEqual(
            capture["LaunchEnvironmentSource"], "INHERITED_PARENT_BLOCK_NOT_CAPTURED"
        )
        self.assertIsNone(capture["LaunchEnvironment"])
        self.assertIsNone(capture["OutputReadError"])
        self.assertEqual(capture["TempCleanupStatus"], "REMOVED")
        self.assertEqual(
            self.as_line_list(capture["OutputLines"]),
            self.as_line_list(capture["StdOutLines"]) + self.as_line_list(capture["StdErrLines"]),
        )

        for line in self.as_line_list(capture["StdOutLines"]):
            self.assertIsInstance(line, str)
        inherited = self.fold_environment_keys(json.loads(capture["StdOutText"])["Env"])
        # Inheritance is genuinely preserved on the unchanged path.
        self.assertEqual(inherited.get("GUARDRAIL_INHERIT_SENTINEL"), "inherited-value")

    def test_every_result_carries_launch_evidence_fields(self):
        command = self.fake_start_process(timeout=False, exit_code=0) + (
            "$result=Invoke-GraphifyGuarded -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('with space','plain') -TimeoutSec 1;"
            "$result|ConvertTo-Json -Depth 6 -Compress"
        )
        result = self.run_guardrail_command(command)
        for field in self.LAUNCH_EVIDENCE_FIELDS:
            with self.subTest(field=field):
                self.assertIn(field, result)
        self.assertEqual(result["ExecutablePath"], "fake.exe")
        # ArgumentSnapshot records the flattened, quoted argument list the guardrail
        # actually launched with, not the caller's unprocessed input.
        self.assertEqual(self.as_line_list(result["ArgumentSnapshot"]), ['"with space"', "plain"])
        self.assertEqual(result["EnvironmentMode"], "INHERITED")
        self.assertIsNone(result["LaunchEnvironment"])
        self.assertIsInstance(result["DurationMs"], int)
        self.assertGreaterEqual(result["DurationMs"], 0)
        self.assertRegex(result["StartUtc"], r"^\d{4}-\d{2}-\d{2}T")
        self.assertRegex(result["EndUtc"], r"^\d{4}-\d{2}-\d{2}T")

        capture_command = self.fake_start_process(timeout=False, exit_code=0) + (
            "$result=Invoke-GraphifyGuardedCapture -GraphifyExe 'fake.exe' "
            "-GraphifyArgs @('with space','plain') -TimeoutSec 1;"
            "$result|ConvertTo-Json -Depth 6 -Compress"
        )
        capture = self.run_guardrail_command(capture_command)
        for field in self.LAUNCH_EVIDENCE_FIELDS + (
            "StdOutLines",
            "StdErrLines",
            "StdOutText",
            "StdErrText",
            "OutputLines",
        ):
            with self.subTest(capture_field=field):
                self.assertIn(field, capture)
        self.assertEqual(self.as_line_list(capture["ArgumentSnapshot"]), ['"with space"', "plain"])
        self.assertEqual(capture["EnvironmentMode"], "INHERITED")

    # --- regressions found by adversarial review of the exact-environment change ----------

    # Starts a descendant that INHERITS the redirected stdout write handle and outlives its own
    # parent. The guardrail terminates only the retained root, so the pipe stays open after the
    # timeout kill -- the condition under which an unbounded drain would defeat the hard timeout.
    DESCENDANT_PROBE_BODY = (
        "$si = New-Object System.Diagnostics.ProcessStartInfo\n"
        "$si.FileName = (Get-Command powershell).Source\n"
        "$si.Arguments = '-NoProfile -NonInteractive -Command \"Start-Sleep -Seconds 30\"'\n"
        "$si.UseShellExecute = $false\n"
        "$null = [System.Diagnostics.Process]::Start($si)\n"
        "Start-Sleep -Seconds 120\n"
    )

    CWD_PROBE_BODY = "[Console]::Out.WriteLine((Get-Location).Path)\n"

    # 0xE9 is built from a code point so this file stays pure ASCII.
    MIXED_OUTPUT_PROBE_BODY = (
        "[Console]::Out.WriteLine('alpha-' + [char]0xE9 + '-omega')\n"
        "[Console]::Out.WriteLine('plain-ascii-line')\n"
        "[Console]::Error.WriteLine('err-plain-ascii')\n"
    )

    def test_exact_environment_bounded_drain_survives_a_descendant_holding_the_pipe(self):
        # A redirected pipe stays open while ANY process holding the inherited write handle lives.
        # This guardrail proves only ROOT termination (CleanupStatus ROOT_TERMINATED_TREE_UNPROVEN),
        # so a surviving descendant keeps the pipe open past the timeout kill. With an unbounded
        # read the timeout evidence is built and then never returned and the caller never resumes.
        # Falsification pair: test_exact_environment_timeout_terminates_the_exact_root_and_cleans_up
        # is the same timeout with no descendant, where OutputReadError stays None.
        #
        # The descendant self-limits to 30s and is never killed by PID: Windows recycles PIDs and
        # os.kill on Windows TERMINATES rather than probes, so PID-based cleanup could kill an
        # unrelated process.
        probe = self.write_exact_probe("descendant_probe.ps1", self.DESCENDANT_PROBE_BODY)
        # The guardrail's OWN return time is measured inside PowerShell. Wall clock here cannot be
        # used: bInheritHandles propagates this test runner's stdout pipe down the whole chain, so
        # the descendant holds a duplicate of it and subprocess.run blocks on its own pipe EOF
        # until the descendant exits, no matter how promptly the guardrail returned.
        command = (
            self.declaration_snippet()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$sw = [System.Diagnostics.Stopwatch]::StartNew();"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 3 -ExactEnvironment $decl;"
            "$sw.Stop();"
            "[pscustomobject]@{Result=$r;GuardrailMs=[int]$sw.ElapsedMilliseconds}"
            "|ConvertTo-Json -Depth 8 -Compress"
        )
        started = time.monotonic()
        evidence = self.run_guardrail_command(command)
        wall = time.monotonic() - started
        result = evidence["Result"]
        guardrail_ms = evidence["GuardrailMs"]
        # Three observed correct runs: 8194 / 8273 / 8363 ms (3000 timeout + a prompt root kill +
        # one shared 5000 ms drain budget). A PER-STREAM budget measures ~13200 ms, and an
        # unbounded drain waits out the 30s descendant. 12000 keeps ~1.2s of discrimination
        # against the per-stream shape (which a 15000 threshold did NOT have) while leaving ~3.6s
        # of headroom over the correct runs -- this test starts two real PowerShell processes
        # inside a suite that serially spawns dozens, so process-creation latency is the flake
        # risk. The structural test is the load-independent guard; this one proves "bounded".
        self.assertLess(
            guardrail_ms, 12000,
            "exact-mode drain was not bounded: guardrail returned in %d ms" % guardrail_ms)
        # It must still have honoured the timeout rather than returning early.
        self.assertGreaterEqual(guardrail_ms, 3000, guardrail_ms)
        self.assertLess(wall, 90, "descendant scenario hung: %.1fs" % wall)
        self.assertTrue(result["TimedOut"], result)
        self.assertEqual(result["ExitCode"], 124)
        self.assertFalse(result["Killed"])
        self.assertTrue(result["RootTerminated"])
        self.assertTrue(result["OrphanRisk"])
        self.assertEqual(result["CleanupStatus"], "ROOT_TERMINATED_TREE_UNPROVEN")
        self.assertIn("did not complete within", result["OutputReadError"])
        self.assertIn("redirected output read failed", result["GuardrailError"])
        self.assertTrue(result["GuardrailFailed"])
        # The bound must not cost the temp-file guarantees.
        self.assertEqual(result["TempCleanupStatus"], "REMOVED")
        self.assertEqual(result["EnvironmentMode"], "EXACT")
        self.assertEqual(result["LaunchEnvironmentSource"], "PROCESS_START_INFO_READBACK")

    # Same descendant, but the parent EXITS immediately instead of hanging, so the guardrail
    # takes the clean-exit path and never sets OrphanRisk from a timeout.
    SURVIVING_DESCENDANT_PROBE_BODY = (
        "$si = New-Object System.Diagnostics.ProcessStartInfo\n"
        "$si.FileName = (Get-Command powershell).Source\n"
        "$si.Arguments = '-NoProfile -NonInteractive -Command \"Start-Sleep -Seconds 20\"'\n"
        "$si.UseShellExecute = $false\n"
        "$null = [System.Diagnostics.Process]::Start($si)\n"
        "[Console]::Out.WriteLine('parent-exiting')\n"
    )

    def test_drain_expiry_after_a_clean_exit_is_reported_as_orphan_risk(self):
        # An expired drain is positive evidence that something still holds the inherited write
        # handle: the child is gone, yet the pipe is not at EOF. Reporting OrphanRisk = $false
        # beside "a surviving descendant may still hold the write handle" would contradict the
        # guardrail's own finding, and semantic_extract.ps1 keys its GPU-orphan handling and its
        # evidence receipt off exactly this flag.
        # Falsification pair: test_exact_environment_declared_value_reaches_the_child... is the
        # same clean exit with no descendant, where OrphanRisk stays False.
        probe = self.write_exact_probe(
            "surviving_descendant_probe.ps1", self.SURVIVING_DESCENDANT_PROBE_BODY
        )
        command = (
            self.declaration_snippet()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 90 -ExactEnvironment $decl;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(command)
        # The child exited on its own, so this is NOT the timeout path.
        self.assertFalse(result["TimedOut"], result)
        self.assertFalse(result["RootTerminated"])
        self.assertEqual(result["CleanupStatus"], "NOT_REQUIRED")
        self.assertIn("did not complete within", result["OutputReadError"])
        self.assertTrue(result["GuardrailFailed"])
        # The finding the guardrail actually made must reach the caller.
        self.assertTrue(result["OrphanRisk"], result)
        self.assertEqual(result["TempCleanupStatus"], "REMOVED")
        self.assertEqual(result["EnvironmentMode"], "EXACT")

    def test_drain_evidence_survives_a_failing_readback(self):
        # Both failures in ONE run: a descendant holds the pipe past the drain bound AND the
        # readback throws. The OrphanRisk branch sits after the read inside the try, so a throw
        # there used to skip it and overwrite OutputReadError, returning OrphanRisk = False beside
        # a lost "surviving descendant" finding.
        # Falsification pair: test_drain_expiry_after_a_clean_exit_is_reported_as_orphan_risk is
        # the same expiry with a WORKING readback, and
        # test_exact_environment_output_read_and_temp_cleanup_failures_are_classified is a failing
        # readback with no expiry -- neither alone exercises the interaction.
        probe = self.write_exact_probe(
            "surviving_descendant_probe.ps1", self.SURVIVING_DESCENDANT_PROBE_BODY
        )
        command = (
            self.declaration_snippet()
            + "function Get-Content { param($LiteralPath,$ErrorAction) "
            "throw 'synthetic readback failure' };"
            "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + self.child_launch_args(probe) + ";"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 90 -ExactEnvironment $decl;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(command)
        self.assertFalse(result["TimedOut"], result)
        self.assertTrue(result["GuardrailFailed"])
        # BOTH findings must reach the caller, not just the later one.
        self.assertIn("did not complete within", result["OutputReadError"])
        self.assertIn("synthetic readback failure", result["OutputReadError"])
        # And the orphan finding the expiry implies must not be lost.
        self.assertTrue(result["OrphanRisk"], result)

    def test_exact_environment_temp_allocation_failure_still_reports_exact_mode(self):
        # Temp allocation runs BEFORE the exact-mode branch. Deriving EnvironmentMode from having
        # reached that branch made a failed exact-mode call positively assert it was an
        # inherited-environment run, so an auditor asking "did any run use a non-exact
        # environment?" got the wrong answer.
        exact = (
            self.declaration_snippet()
            + "function New-GuardedTempFile { throw 'synthetic allocation failure' };"
            "$exe = (Get-Command powershell).Source;"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe "
            "-GraphifyArgs @('-NoProfile','-Command','exit 0') -TimeoutSec 30 -ExactEnvironment $decl;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        result = self.run_guardrail_command(exact)
        self.assertTrue(result["GuardrailFailed"])
        self.assertFalse(result["OrphanRisk"])
        self.assertEqual(result["CleanupStatus"], "START_FAILED")
        self.assertEqual(result["TempCleanupStatus"], "NOT_CREATED")
        self.assertEqual(result["EnvironmentMode"], "EXACT")
        self.assertEqual(result["LaunchEnvironmentSource"], "EXACT_ENVIRONMENT_NOT_CONFIGURED")
        self.assertIsNone(result["LaunchEnvironment"])
        # Nothing was rejected -- the declaration was never even examined -- so the validation
        # field must stay empty rather than absorbing an unrelated allocation failure.
        self.assertIsNone(result["EnvironmentValidationError"])
        self.assertIn("synthetic allocation failure", result["GuardrailError"])

        # Two-sided: the identical failure without -ExactEnvironment still reports an inherited run.
        inherited = (
            "function New-GuardedTempFile { throw 'synthetic allocation failure' };"
            "$exe = (Get-Command powershell).Source;"
            "$r = Invoke-GraphifyGuardedCapture -GraphifyExe $exe "
            "-GraphifyArgs @('-NoProfile','-Command','exit 0') -TimeoutSec 30;"
            "$r|ConvertTo-Json -Depth 8 -Compress"
        )
        plain = self.run_guardrail_command(inherited)
        self.assertEqual(plain["EnvironmentMode"], "INHERITED")
        self.assertEqual(
            plain["LaunchEnvironmentSource"], "INHERITED_PARENT_BLOCK_NOT_CAPTURED"
        )

    def test_exact_and_inherited_capture_are_byte_identical(self):
        probe = self.write_exact_probe("mixed_output_probe.ps1", self.MIXED_OUTPUT_PROBE_BODY)
        probe_args = self.child_launch_args(probe)
        command = (
            self.declaration_snippet()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + probe_args + ";"
            "$exact = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120 -ExactEnvironment $decl;"
            "$plain = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120;"
            # Character CODES, not the characters: this snippet's JSON reaches the runner through a
            # pipe and Windows PowerShell 5.1 ConvertTo-Json does NOT escape non-ASCII, so a
            # literal character would be re-encoded in transport and the assertion would be
            # measuring the harness rather than the guardrail.
            "$exactCodes = ((@($exact.StdOutLines)[0]).ToCharArray() "
            "| ForEach-Object { [int]$_ }) -join ',';"
            "$plainCodes = ((@($plain.StdOutLines)[0]).ToCharArray() "
            "| ForEach-Object { [int]$_ }) -join ',';"
            "[pscustomobject]@{Exact=$exact;Plain=$plain;ExactCodes=$exactCodes;"
            "PlainCodes=$plainCodes}|ConvertTo-Json -Depth 8 -Compress"
        )
        evidence = self.run_guardrail_command(command)
        exact_out = self.as_line_list(evidence["Exact"]["StdOutLines"])
        plain_out = self.as_line_list(evidence["Plain"]["StdOutLines"])
        self.assertEqual(len(exact_out), 2, exact_out)
        self.assertEqual(len(plain_out), 2, plain_out)
        # Pure-ASCII content must be identical on both launch paths.
        self.assertEqual(exact_out[1], "plain-ascii-line")
        self.assertEqual(exact_out[1], plain_out[1])
        self.assertEqual(
            self.as_line_list(evidence["Exact"]["StdErrLines"]),
            self.as_line_list(evidence["Plain"]["StdErrLines"]),
        )
        # BYTE PARITY on non-ASCII. Both paths now put the child's raw bytes on disk -- exact
        # mode streams the pipe with CopyToAsync, the inherited path lets Start-Process redirect --
        # and both read them back with the same Get-Content, so the two must agree exactly.
        # This is the guard for three regressions, all found by measurement:
        #   - CreateNoWindow = $true put the child in a private console, changing its output code
        #     page so it emitted a literal '?' where the inherited path preserved the character.
        #   - Decoding the pipe and re-encoding it as UTF-8 while Get-Content read the ANSI code
        #     page inflated every non-ASCII character into two.
        #   - Buffering both streams whole in memory, which is what forced that decode/re-encode.
        # Compared as CODES because this snippet's JSON reaches the runner through a pipe and PS
        # 5.1 ConvertTo-Json does not escape non-ASCII, so comparing the characters themselves
        # would measure the runner's locale rather than the guardrail.
        self.assertEqual(
            evidence["ExactCodes"], evidence["PlainCodes"],
            "exact and inherited disagree on non-ASCII output",
        )
        self.assertNotEqual(evidence["ExactCodes"], "", evidence)
        # Non-vacuity: on a host whose output code page cannot represent U+00E9 both paths would
        # emit '?' and agree on a pure-ASCII line, silently guarding nothing. The comparison is
        # only meaningful if a byte above 127 actually survived to be compared.
        self.assertTrue(
            any(int(code) > 127 for code in evidence["ExactCodes"].split(",")),
            evidence["ExactCodes"],
        )
        self.assertEqual(len(exact_out[0]), len(plain_out[0]))

    def test_exact_environment_child_uses_the_same_working_directory_as_the_inherited_path(self):
        # Start-Process launches at the PowerShell session location, but a bare ProcessStartInfo
        # inherits [Environment]::CurrentDirectory, which Set-Location does NOT update.
        # sync_wiki.ps1 does Set-Location and then passes the relative argument '.', so the
        # divergence would make an exact-mode caller silently operate on the wrong tree while
        # every field reported success.
        probe = self.write_exact_probe("cwd_probe.ps1", self.CWD_PROBE_BODY)
        workdir = self.exact_probe_dir() / "workdir"
        workdir.mkdir(parents=True, exist_ok=True)
        probe_args = self.child_launch_args(probe)
        command = (
            "Set-Location -LiteralPath '" + str(workdir) + "';"
            + self.declaration_snippet()
            + "$exe = (Get-Command powershell).Source;"
            "$probeArgs = " + probe_args + ";"
            "$exact = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120 -ExactEnvironment $decl;"
            "$plain = Invoke-GraphifyGuardedCapture -GraphifyExe $exe -GraphifyArgs $probeArgs "
            "-TimeoutSec 120;"
            "[pscustomobject]@{ExactCwd=@($exact.StdOutLines)[0];"
            "PlainCwd=@($plain.StdOutLines)[0];Session=(Get-Location).Path;"
            "ExactWorkDir=$exact.LaunchWorkingDirectory;"
            "PlainWorkDir=$plain.LaunchWorkingDirectory}"
            "|ConvertTo-Json -Depth 4 -Compress"
        )
        evidence = self.run_guardrail_command(command)

        def norm(value):
            return os.path.normcase(os.path.normpath(str(value)))

        expected = norm(workdir)
        self.assertEqual(norm(evidence["Session"]), expected)
        self.assertEqual(norm(evidence["PlainCwd"]), expected, evidence)
        self.assertEqual(norm(evidence["ExactCwd"]), expected, evidence)
        # The working directory is a launch input, so exact mode records what it configured.
        self.assertEqual(norm(evidence["ExactWorkDir"]), expected, evidence)
        # The inherited path never observes it, so it must not claim one.
        self.assertIsNone(evidence["PlainWorkDir"])


class TestProcessCustodyHelpers(unittest.TestCase):
    RUN_ID = "12345678-1234-4123-8123-123456789abc"

    def setUp(self):
        if not POWERSHELL:
            self.skipTest("PowerShell unavailable")
        FOCUSED_TEST_TMP.mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=FOCUSED_TEST_TMP)
        self.root = Path(self.tmp.name)
        self.root.relative_to(EVIDENCE_ROOT)
        (self.root / "tooling" / "wiki").mkdir(parents=True)
        self.checker = WIKI_DIR / "check_orphans.ps1"
        self.terminalizer = WIKI_DIR / "nightly_terminalizer.ps1"
        self.parent_pid, self.checker_pid = 100, 101

    def tearDown(self):
        self.tmp.cleanup()

    def row(self, pid, parent, name="python.exe", created="2026-07-30T01:00:00Z", command=None, executable=None):
        return {"process_id": pid, "parent_process_id": parent, "creation_utc": created, "name": name, "command_line": command, "executable_path": executable}

    def parent(self, created="2026-07-30T00:59:00Z"):
        script = self.root / "tooling" / "wiki" / "nightly_wiki_sync.ps1"
        return self.row(100, 50, "powershell.exe", created, f'powershell.exe -File "{script}"')

    def checker_row(self, pid=101, parent=100, command=None, mode="CaptureBaseline"):
        script = self.root / "tooling" / "wiki" / "check_orphans.ps1"
        return self.row(pid, parent, "powershell.exe", "2026-07-30T01:00:01Z", command or f'powershell.exe -File "{script}" -Mode {mode}')

    def graphify(self, pid=200, created="2026-07-29T22:00:00Z", root=None, parent=50):
        root = Path(root or self.root)
        graph, exe = root / "wiki" / ".graph" / "graph.json", root / ".venv-graphify" / "Scripts" / "python.exe"
        return self.row(pid, parent, "python.exe", created, f'"{exe}" -m graphify.serve "{graph}" --transport stdio', str(exe))

    def conhost(self, pid=300, parent=100, name="conhost.exe", executable=None, command=None, created="2026-07-30T01:00:00Z"):
        executable = executable or str(Path(os.environ["SystemRoot"]) / "System32" / "conhost.exe")
        command = command if command is not None else f'"{executable}" 0x4'
        return self.row(pid, parent, name, created, command=command, executable=executable)

    def base(self, graph=True):
        rows = [self.row(0, 0, None, None), self.row(10, 0, None, None), self.parent(), self.checker_row()]
        return rows + ([self.graphify()] if graph else [])

    def snapshot(self, rows, name, status="PASS"):
        path = self.root / name
        path.write_text(json.dumps({"schema_version": "1.0", "enumeration_status": status, "processes": rows}), encoding="ascii")
        return path

    def invoke(self, mode, rows, stem, checker_pid=101, baseline=None, expected=None, status="PASS", run_id=RUN_ID):
        snap, output = self.snapshot(rows, f"{stem}-snapshot.json", status), self.root / f"{stem}.json"
        command = [POWERSHELL, "-NoProfile", "-File", str(self.checker), "-Mode", mode, "-RuntimeRoot", str(self.root), "-RunParentPid", "100", "-OutputPath", str(output), "-ProcessSnapshotPath", str(snap), "-FixtureCheckerPid", str(checker_pid)]
        if run_id is not None:
            command += ["-RunId", run_id]
        if baseline:
            command += ["-BaselinePath", str(baseline), "-ExpectedBaselineSha256", expected or hashlib.sha256(baseline.read_bytes()).hexdigest()]
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        ), output

    def capture(self, rows, stem="baseline", status="PASS", run_id=RUN_ID):
        return self.invoke("CaptureBaseline", rows, stem, status=status, run_id=run_id)

    def terminal(self, baseline, rows, stem="terminal", checker_pid=102, expected=None, run_id=RUN_ID):
        rows = [row for row in rows if row["process_id"] not in (101, checker_pid)] + [self.checker_row(checker_pid, mode="EvaluateTerminal")]
        return self.invoke("EvaluateTerminal", rows, stem, checker_pid, baseline, expected, run_id=run_id)

    def terminal_with_status(self, baseline, rows, stem, status):
        rows = [row for row in rows if row["process_id"] != 101] + [self.checker_row(102, mode="EvaluateTerminal")]
        return self.invoke("EvaluateTerminal", rows, stem, 102, baseline, status=status)

    def test_exact_subset_departure_and_bounded_evidence(self):
        result, baseline = self.capture(self.base())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        base = json.loads(baseline.read_text(encoding="utf-8"))
        self.assertTrue(base["enumeration_succeeded"] and base["classification_succeeded"])
        self.assertNotIn("command_line", base["relevant_identities"][0])
        self.assertEqual(base["run_id"], self.RUN_ID)
        self.assertEqual(base["relevant_identities"][0]["process_class"], "PREEXISTING_GRAPHIFY_MCP")
        result, unchanged = self.terminal(baseline, self.base(), "unchanged")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        unchanged_data = json.loads(unchanged.read_text(encoding="utf-8"))
        self.assertEqual((unchanged_data["survivor_count"], unchanged_data["departed_baseline_count"], unchanged_data["terminal_relevant_count"]), (0, 0, 1))
        self.assertEqual(unchanged_data["baseline_captured_at_utc"], base["captured_at_utc"])
        unrelated = self.row(350, 1, "other.exe", "2026-07-30T00:00:00Z", "other.exe --safe", r"C:\Tools\other.exe")
        result, ignored = self.terminal(baseline, self.base() + [unrelated], "unrelated", 104)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(ignored.read_text(encoding="utf-8"))["terminal_relevant_count"], 1)
        result, receipt = self.terminal(baseline, [self.parent()], "departure", 103)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual((data["survivor_count"], data["departed_baseline_count"], data["result"]), (0, 1, "PASS"))
        self.assertTrue(data["baseline_captured_at_utc"].endswith("Z"))
        self.assertTrue(data["evaluated_at_utc"].endswith("Z"))

    def test_only_exact_direct_system_conhost_is_excluded(self):
        system_conhost = str(Path(os.environ["SystemRoot"]) / "System32" / "conhost.exe")
        exact = self.conhost(executable=system_conhost)
        result, receipt = self.capture(self.base(False) + [exact], "direct-system-conhost")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual(data["result"], "PASS")
        self.assertEqual(data["relevant_count"], 0)
        self.assertEqual(data["disallowed_relevant_count"], 0)

        normalized = str(Path(system_conhost).parent / "unused" / ".." / "conhost.exe")
        result, receipt = self.capture(self.base(False) + [self.conhost(pid=301, executable=normalized)], "normalized-system-conhost")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(receipt.read_text(encoding="utf-8"))["relevant_count"], 0)

        result, receipt = self.capture(self.base() + [self.conhost(pid=302)], "conhost-with-graphify")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual(data["relevant_count"], 1)
        self.assertEqual(data["relevant_identities"][0]["process_class"], "PREEXISTING_GRAPHIFY_MCP")

        nt_runtime = "\\??\\" + str(self.root)
        win32_runtime = "\\\\?\\" + str(self.root)
        nested_parent = self.row(310, 100, "worker.exe", command="worker.exe", executable=r"C:\Tools\worker.exe")
        cases = (
            ("wrong-path", [self.conhost(executable=r"C:\Temp\conhost.exe")], 300),
            ("missing-path", [dict(self.conhost(), executable_path=None)], 300),
            ("nested", [nested_parent, self.conhost(pid=311, parent=310)], 311),
            ("pre-parent", [self.conhost(created="2026-07-30T00:58:59Z")], 300),
            ("runtime-reference", [self.conhost(command=f'"{system_conhost}" "{self.root}"')], 300),
            ("nt-runtime-reference", [self.conhost(command=f'"{system_conhost}" "{nt_runtime}"')], 300),
            ("win32-runtime-reference", [self.conhost(command=f'"{system_conhost}" "{win32_runtime}"')], 300),
            (
                "similar-name",
                [self.conhost(name="conhost-helper.exe", executable=str(Path(system_conhost).with_name("conhost-helper.exe")))],
                300,
            ),
            (
                "arbitrary-child",
                [self.row(300, 100, "worker.exe", command="worker.exe", executable=r"C:\Tools\worker.exe")],
                300,
            ),
            ("missing-command", [dict(self.conhost(), command_line=None)], 300),
        )
        for label, extra_rows, target_pid in cases:
            with self.subTest(case=label):
                result, receipt = self.capture(self.base(False) + extra_rows, f"conhost-{label}")
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                data = json.loads(receipt.read_text(encoding="utf-8"))
                self.assertEqual(data["result"], "FAIL")
                target = next(item for item in data["disallowed_relevant_identities"] if item["process_id"] == target_pid)
                self.assertEqual(target["process_class"], "DISALLOWED_RELEVANT_PROCESS")

        for label, bad_parent in (("missing-parent", None), ("malformed-parent", "100")):
            with self.subTest(case=label):
                invalid = self.conhost()
                if bad_parent is None:
                    invalid.pop("parent_process_id")
                else:
                    invalid["parent_process_id"] = bad_parent
                result, receipt = self.capture(self.base(False) + [invalid], f"conhost-{label}")
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                data = json.loads(receipt.read_text(encoding="utf-8"))
                self.assertEqual(data["result"], "FAIL")
                self.assertFalse(data["classification_succeeded"])

    def test_console_host_chronology_is_bound_to_observation_time(self):
        future_conhost = self.conhost(created="2999-01-01T00:00:00Z")
        result, _ = self.capture(self.base(False) + [future_conhost], "future-conhost-baseline")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

        result, baseline = self.capture(self.base(False), "conhost-chronology-baseline")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        result, _ = self.terminal(
            baseline,
            self.base(False) + [future_conhost],
            "future-conhost-terminal",
        )
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

        result, receipt = self.terminal(
            baseline,
            self.base(False) + [self.conhost()],
            "valid-conhost-terminal",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual(data["result"], "PASS")
        self.assertEqual(data["terminal_relevant_count"], 0)
        self.assertEqual(data["survivor_count"], 0)

    def test_new_descendant_parent_dead_runtime_child_and_pid_reuse_fail(self):
        result, baseline = self.capture(self.base())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        cases = (self.base() + [self.row(300, 100, command="worker")], self.base() + [self.graphify(201)], self.base() + [self.graphify(202, parent=999)], [row for row in self.base() if row["process_id"] != 200] + [self.graphify(created="2026-07-30T02:00:00Z")])
        for index, rows in enumerate(cases):
            result, receipt = self.terminal(baseline, rows, f"new-{index}", 110 + index)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertGreater(json.loads(receipt.read_text(encoding="utf-8"))["survivor_count"], 0)

    def test_baseline_graphify_pid_reused_by_outside_runtime_process_fails(self):
        result, baseline = self.capture(self.base(), "outside-reuse-base")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        outside = self.row(
            200,
            1,
            "other.exe",
            "2026-07-30T02:00:00Z",
            "other.exe --outside-runtime",
            r"C:\Tools\other.exe",
        )
        result, receipt = self.terminal(baseline, [self.parent(), outside], "outside-reuse", 116)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        data = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual(data["result"], "FAIL")
        self.assertEqual(data["survivor_count"], 1)
        self.assertEqual(data["departed_baseline_count"], 1)
        survivor = data["survivor_identities"][0]
        self.assertEqual(survivor["process_id"], 200)
        self.assertEqual(survivor["process_class"], "BASELINE_PID_REUSE_OUTSIDE_RELEVANT_SCOPE")
        self.assertFalse(survivor["runtime_reference"])
        self.assertFalse(survivor["attributable_descendant"])

        for field in ("command_line", "executable_path"):
            with self.subTest(missing_field=field):
                missing = dict(outside)
                missing[field] = None
                result, failure = self.terminal(
                    baseline,
                    [self.parent(), missing],
                    f"outside-reuse-missing-{field}",
                    117 if field == "command_line" else 118,
                )
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                failure_data = json.loads(failure.read_text(encoding="utf-8"))
                self.assertEqual(failure_data["result"], "FAIL")
                self.assertIn("missing full current identity field", failure_data["error"])

    def test_parent_checker_path_boundary_and_exact_graph_fail_closed(self):
        result, baseline = self.capture(self.base())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for index, rows in enumerate(([row for row in self.base() if row["process_id"] != 100], [row for row in self.base() if row["process_id"] != 100] + [self.parent("2026-07-30T03:00:00Z")])):
            result, _ = self.terminal(baseline, rows, f"parent-{index}", 120 + index)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        spoof = self.snapshot([self.parent(), self.checker_row(command="powershell.exe -File other.ps1")], "spoof.json")
        result, _ = self.invoke("CaptureBaseline", json.loads(spoof.read_text())["processes"], "spoof-out")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        result, similar = self.capture(self.base(False) + [self.graphify(root=Path(str(self.root) + "-similar"))], "similar")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(similar.read_text(encoding="utf-8"))["relevant_count"], 0)
        wrong = self.graphify(); wrong["command_line"] = wrong["command_line"].replace("graph.json", "other.json")
        result, _ = self.capture(self.base(False) + [wrong], "wrong-graph")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        global_python = self.graphify()
        expected_exe = str(self.root / ".venv-graphify" / "Scripts" / "python.exe")
        global_python["executable_path"] = r"C:\Python311\python.exe"
        global_python["command_line"] = global_python["command_line"].replace(expected_exe, r"C:\Python311\python.exe")
        result, _ = self.capture(self.base(False) + [global_python], "global-python")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_failure_flags_hash_tamper_overflow_and_unrelated_missing_fields(self):
        result, receipt = self.capture([], "enum", "FAIL")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertFalse(json.loads(receipt.read_text(encoding="utf-8"))["enumeration_succeeded"])
        numeric_string = self.base()
        numeric_string[2]["process_id"] = "100"
        result, _ = self.capture(numeric_string, "numeric-string-snapshot-pid")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        result, _ = self.capture(self.base() + [self.graphify()], "duplicate-baseline")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        result, receipt = self.capture(self.base(False) + [self.row(300, 100, created=None, command="worker")], "classify")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        classified = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertTrue(classified["enumeration_succeeded"]); self.assertFalse(classified["classification_succeeded"])
        result, baseline = self.capture(self.base(), "hash-base")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        result, denied = self.terminal_with_status(baseline, self.base(), "terminal-enum-denied", "FAIL")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertFalse(json.loads(denied.read_text(encoding="utf-8"))["enumeration_succeeded"])
        result, _ = self.terminal(baseline, self.base(), "tamper", 130, "0" * 64)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        duplicate_rows = self.base() + [self.graphify()]
        result, _ = self.terminal(baseline, duplicate_rows, "duplicate-terminal", 131)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        malformed_rows = self.base()
        malformed_rows[-1] = self.graphify(created=None)
        result, _ = self.terminal(baseline, malformed_rows, "malformed-terminal", 132)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        overflow = self.base(False) + [self.row(400 + index, 100, command="worker") for index in range(17)]
        result, receipt = self.capture(overflow, "overflow")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertTrue(json.loads(receipt.read_text(encoding="utf-8"))["identity_overflow"])

    def test_rehashed_malformed_baseline_timestamps_and_run_id_fail_closed(self):
        result, baseline = self.capture(self.base(), "structural-base")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        original = json.loads(baseline.read_text(encoding="utf-8"))
        mutations = (
            ("status", "enumeration_succeeded", False),
            ("numeric-true-boolean", "enumeration_succeeded", 1),
            ("string-false-boolean", "identity_overflow", "false"),
            ("class", "process_class", "DISALLOWED_RELEVANT_PROCESS"),
            ("timestamp", "captured_at_utc", "not-a-time"),
            ("future", "captured_at_utc", "2999-01-01T00:00:00Z"),
            ("run-binding", "run_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
            ("string-count", "relevant_count", "1"),
            ("string-pid", "identity_process_id", "100"),
        )
        for index, (label, field, value) in enumerate(mutations):
            data = json.loads(json.dumps(original))
            if field == "process_class":
                data["relevant_identities"][0][field] = value
            elif field == "identity_process_id":
                data["run_parent_identity"]["process_id"] = value
            else:
                data[field] = value
            path = self.root / f"malformed-{label}.json"
            path.write_text(json.dumps(data), encoding="ascii")
            result, _ = self.terminal(path, self.base(), f"malformed-{index}", 140 + index)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        for index, run_id in enumerate((None, "NOT-CANONICAL")):
            result, _ = self.capture(self.base(), f"run-id-{index}", run_id=run_id)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        result, _ = self.terminal(baseline, self.base(), "wrong-terminal-run", 150, run_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        future = self.graphify(created="2999-01-01T00:00:00Z")
        result, _ = self.capture(self.base(False) + [future], "future-baseline-identity")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)

    def test_legacy_no_mode_remains_report_only(self):
        checker_text = self.checker.read_text(encoding="ascii")
        self.assertNotIn("[Parameter(Mandatory = $true)]", checker_text)
        parent = self.row(50, 0, "powershell.exe", command="powershell.exe")
        legacy = self.row(200, 50, "python.exe", command=r"python.exe C:\Projects\SSTAC-Dashboard\wiki\server.py")
        alive = self.snapshot([parent, legacy], "legacy-alive.json")
        result = subprocess.run([POWERSHELL, "-NoProfile", "-File", str(self.checker), "-ProcessSnapshotPath", str(alive)], capture_output=True, text=True, check=False, env=fixture_environment())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("ALIVE", result.stdout)
        orphan = self.snapshot([dict(legacy, parent_process_id=999)], "legacy-orphan.json")
        result = subprocess.run([POWERSHELL, "-NoProfile", "-File", str(self.checker), "-ProcessSnapshotPath", str(orphan)], capture_output=True, text=True, check=False, env=fixture_environment())
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("ORPHANED", result.stdout)

    @staticmethod
    def summary(pid, parent, marker, created="2026-07-30T00:58:00Z"):
        return {
            "process_id": pid,
            "parent_process_id": parent,
            "creation_utc": created,
            "name": "powershell.exe",
            "command_line_sha256": "a" * 64,
            "executable_path_sha256": "b" * 64,
            "identity_sha256": marker * 64,
            "runtime_reference": False,
            "attributable_descendant": False,
        }

    def custody(self):
        graph = self.summary(200, 50, "f", "2026-07-30T00:57:00Z")
        graph.update({"name": "python.exe", "runtime_reference": True, "process_class": "PREEXISTING_GRAPHIFY_MCP"})
        identity_set = hashlib.sha256(graph["identity_sha256"].encode("ascii")).hexdigest()
        return {
            "schema_version": "1.0",
            "evidence_type": "PROCESS_CUSTODY_TERMINAL",
            "run_id": self.RUN_ID,
            "baseline_captured_at_utc": "2026-07-30T00:59:30Z",
            "evaluated_at_utc": "2026-07-30T01:02:30Z",
            "result": "PASS",
            "baseline_result": "PASS",
            "enumeration_succeeded": True,
            "classification_succeeded": True,
            "expected_baseline_sha256": "e" * 64,
            "observed_baseline_sha256": "e" * 64,
            "run_parent_pid": 100,
            "run_parent_identity_match": True,
            "run_parent_identity": self.summary(100, 50, "c", "2026-07-30T00:58:30Z"),
            "checker_parent_match": True,
            "checker_identity": self.summary(102, 100, "d", "2026-07-30T01:02:00Z"),
            "identity_cap": 16,
            "identity_overflow": False,
            "baseline_relevant_count": 1,
            "terminal_relevant_count": 1,
            "allowed_preexisting_graphify_count": 1,
            "survivor_count": 0,
            "departed_baseline_count": 0,
            "baseline_identity_set_sha256": identity_set,
            "terminal_identity_set_sha256": identity_set,
            "baseline_relevant_identities": [dict(graph)],
            "terminal_relevant_identities": [dict(graph)],
            "survivor_identities": [],
            "departed_baseline_identities": [],
        }

    def receipt_payload(self):
        return {
            "run_id": self.RUN_ID,
            "started_at_utc": "2026-07-30T00:59:00Z",
            "completed_at_utc": "2026-07-30T01:03:00Z",
            "terminal_state": "SUCCESS",
            "native_exit_code": 0,
            "terminal_process_custody": "PASS",
            "terminal_process_custody_evidence": self.custody(),
        }

    def terminal_command(self, command):
        return subprocess.run([POWERSHELL, "-NoProfile", "-Command", f"$ErrorActionPreference='Stop'; . '{self.terminalizer}'; {command}"], capture_output=True, text=True, check=False, env=fixture_environment())

    def test_terminalizer_guard_first_publish_write_failure_reentry_and_custody(self):
        payload = self.root / "payload.json"; receipt = self.root / "receipt.json"; guard = self.root / "guard"
        payload.write_text(json.dumps(self.receipt_payload()), encoding="ascii")
        load = f"$r=Get-Content -LiteralPath '{payload}' -Raw|ConvertFrom-Json;"
        result = self.terminal_command(f"Enter-NightlyTerminalization -GuardPath '{guard}'; {load} Publish-NightlyTerminalReceipt -Receipt $r -ReceiptPath '{receipt}'")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr); self.assertTrue(receipt.is_file())
        reentry = self.root / "reentry"
        result = self.terminal_command(f"Enter-NightlyTerminalization -GuardPath '{reentry}'; Enter-NightlyTerminalization -GuardPath '{reentry}'")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr); self.assertTrue(reentry.is_file())
        write_guard, invalid_receipt = self.root / "write-guard", self.root / "bad<name>.json"
        result = self.terminal_command(f"Enter-NightlyTerminalization -GuardPath '{write_guard}'; {load} Publish-NightlyTerminalReceipt -Receipt $r -ReceiptPath '{invalid_receipt}'")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr); self.assertTrue(write_guard.is_file()); self.assertFalse(invalid_receipt.exists())
        collision = self.root / "collision.json"; collision.write_text("preserve", encoding="ascii"); collision_guard = self.root / "collision-guard"
        result = self.terminal_command(f"Enter-NightlyTerminalization -GuardPath '{collision_guard}'; {load} Publish-NightlyTerminalReceipt -Receipt $r -ReceiptPath '{collision}'")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr); self.assertEqual(collision.read_text(encoding="ascii"), "preserve")
        bad = json.loads(payload.read_text()); bad["terminal_process_custody_evidence"]["result"] = "FAIL"; bad_path = self.root / "bad.json"; bad_path.write_text(json.dumps(bad), encoding="ascii"); bad_receipt = self.root / "bad-receipt.json"; bad_guard = self.root / "bad-guard"
        result = self.terminal_command(f"Enter-NightlyTerminalization -GuardPath '{bad_guard}'; $r=Get-Content -LiteralPath '{bad_path}' -Raw|ConvertFrom-Json; Publish-NightlyTerminalReceipt -Receipt $r -ReceiptPath '{bad_receipt}'")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr); self.assertFalse(bad_receipt.exists())
        cases = []
        missing = self.receipt_payload(); missing.pop("terminal_process_custody_evidence"); cases.append(("missing", missing))
        contradiction = self.receipt_payload(); contradiction.update({"terminal_state": "FAILED", "native_exit_code": 1, "terminal_process_custody": "FAIL"}); cases.append(("contradiction", contradiction))
        reversed_time = self.receipt_payload(); reversed_time["terminal_process_custody_evidence"]["evaluated_at_utc"] = "2026-07-30T00:58:00Z"; cases.append(("reversed", reversed_time))
        malformed_time = self.receipt_payload(); malformed_time["terminal_process_custody_evidence"]["baseline_captured_at_utc"] = "2026-07-30T00:59:30+00:00"; cases.append(("malformed-time", malformed_time))
        wrong_run = self.receipt_payload(); wrong_run["terminal_process_custody_evidence"]["run_id"] = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; cases.append(("wrong-run", wrong_run))
        wrong_class = self.receipt_payload(); wrong_class["terminal_process_custody_evidence"]["baseline_relevant_identities"][0]["process_class"] = "OTHER"; cases.append(("wrong-class", wrong_class))
        future_identity = self.receipt_payload(); future_identity["terminal_process_custody_evidence"]["baseline_relevant_identities"][0]["creation_utc"] = "2026-07-30T01:00:00Z"; cases.append(("future-identity", future_identity))
        string_count = self.receipt_payload(); string_count["terminal_process_custody_evidence"]["baseline_relevant_count"] = "1"; cases.append(("string-count", string_count))
        string_pid = self.receipt_payload(); string_pid["terminal_process_custody_evidence"]["run_parent_pid"] = "100"; cases.append(("string-pid", string_pid))
        numeric_boolean = self.receipt_payload(); numeric_boolean["terminal_process_custody_evidence"]["enumeration_succeeded"] = 1; cases.append(("numeric-boolean", numeric_boolean))
        string_boolean = self.receipt_payload(); string_boolean["terminal_process_custody_evidence"]["identity_overflow"] = "false"; cases.append(("string-boolean", string_boolean))
        wrong_parent_name = self.receipt_payload(); wrong_parent_name["terminal_process_custody_evidence"]["run_parent_identity"]["name"] = "node.exe"; cases.append(("wrong-parent-name", wrong_parent_name))
        wrong_parent_flag = self.receipt_payload(); wrong_parent_flag["terminal_process_custody_evidence"]["checker_identity"]["attributable_descendant"] = True; cases.append(("wrong-parent-flag", wrong_parent_flag))
        wrong_graph_flag = self.receipt_payload(); wrong_graph_flag["terminal_process_custody_evidence"]["terminal_relevant_identities"][0]["runtime_reference"] = False; cases.append(("wrong-graph-flag", wrong_graph_flag))
        wrong_baseline_hash = self.receipt_payload(); wrong_baseline_hash["terminal_process_custody_evidence"]["observed_baseline_sha256"] = "f" * 64; cases.append(("wrong-baseline-hash", wrong_baseline_hash))
        for label, value in (("string-native-exit", "0"), ("boolean-native-exit", False), ("float-native-exit", 0.0)):
            wrong_native_exit = self.receipt_payload(); wrong_native_exit["native_exit_code"] = value; cases.append((label, wrong_native_exit))
        for index, (label, candidate) in enumerate(cases):
            candidate_path = self.root / f"terminalizer-{label}.json"; candidate_path.write_text(json.dumps(candidate), encoding="ascii")
            candidate_guard = self.root / f"terminalizer-{index}.guard"; candidate_receipt = self.root / f"terminalizer-{index}.receipt.json"
            result = self.terminal_command(f"Enter-NightlyTerminalization -GuardPath '{candidate_guard}'; $r=Get-Content -LiteralPath '{candidate_path}' -Raw|ConvertFrom-Json; Publish-NightlyTerminalReceipt -Receipt $r -ReceiptPath '{candidate_receipt}'")
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr); self.assertFalse(candidate_receipt.exists())

    def test_publish_accepts_pscustomobject_ordered_receipt(self):
        payload = self.root / "payload-pscustomobject.json"
        receipt = self.root / "receipt-pscustomobject.json"
        guard = self.root / "pscustomobject-guard"
        payload.write_text(json.dumps(self.receipt_payload()), encoding="ascii")
        ps_script = (
            f"Enter-NightlyTerminalization -GuardPath '{guard}'; "
            f"$p = Get-Content -LiteralPath '{payload}' -Raw | ConvertFrom-Json; "
            "$r = [pscustomobject][ordered]@{ "
            "run_id = $p.run_id; "
            "started_at_utc = $p.started_at_utc; "
            "completed_at_utc = $p.completed_at_utc; "
            "terminal_state = $p.terminal_state; "
            "native_exit_code = $p.native_exit_code; "
            "terminal_process_custody = $p.terminal_process_custody; "
            "terminal_process_custody_evidence = $p.terminal_process_custody_evidence }; "
            f"Publish-NightlyTerminalReceipt -Receipt $r -ReceiptPath '{receipt}'"
        )
        result = self.terminal_command(ps_script)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(receipt.is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
