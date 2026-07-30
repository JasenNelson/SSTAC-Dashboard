import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

WIKI_DIR = Path(__file__).parent.parent
POWERSHELL = os.environ.get("PREFLIGHT_POWERSHELL") or shutil.which("powershell")
EVIDENCE_ROOT = WIKI_DIR.parents[2]
FOCUSED_TEST_TMP = EVIDENCE_ROOT / "focused-test-tmp"


class TestWrapperContracts(unittest.TestCase):
    def setUp(self):
        self.wrapper = (WIKI_DIR / "nightly_wiki_sync.ps1").read_text(encoding="ascii")
        self.preflight = (WIKI_DIR / "activation_preflight.ps1").read_text(encoding="ascii")

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
            "n6_wiki",
            "n6_publication",
            "serve_gate",
            "required_ref",
            "head_oid",
            "required_ref_oid",
            "build_stamp_oid",
            "terminal_process_custody",
            "terminal_process_custody_evidence",
        )
        for field in required:
            with self.subTest(field=field):
                self.assertRegex(self.wrapper, rf"(?m)^\s*{re.escape(field)}\s*=")

    def test_terminal_receipt_publish_is_atomic_and_unique(self):
        self.assertIn(". $terminalizerPath", self.wrapper)
        self.assertIn("Publish-NightlyTerminalReceipt -Receipt $terminalReceipt -ReceiptPath $terminalReceiptPath", self.wrapper)
        self.assertNotIn("$temporaryReceipt =", self.wrapper)
        self.assertNotIn("[System.IO.File]::Move($temporaryReceipt", self.wrapper)

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
            "$step6Status -ne 'OK'",
            "$n6Publication -ne 'SERVED_WIKI_SWAPPED'",
            "$serveGateResult -ne 'PASS'",
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

    def test_early_paths_cannot_manufacture_success(self):
        self.assertNotIn("SKIPPED_ORPHANS", self.wrapper)
        for marker in (
            "HOOK_DRIFT",
            "SKIPPED_DIRTY_TREE",
            "DOCS_SCOPE_FAIL",
            "SECRET_HIT",
            "SMOKE_FAIL",
        ):
            with self.subTest(marker=marker):
                tail = self.wrapper.split(marker, 1)[1][:300]
                self.assertRegex(tail, r"Complete-NightlyRun\s+[01]\s+'(?:FAILED|SKIPPED)'")
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
        return subprocess.run(command, capture_output=True, text=True, check=False), output

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
        result = subprocess.run([POWERSHELL, "-NoProfile", "-File", str(self.checker), "-ProcessSnapshotPath", str(alive)], capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("ALIVE", result.stdout)
        orphan = self.snapshot([dict(legacy, parent_process_id=999)], "legacy-orphan.json")
        result = subprocess.run([POWERSHELL, "-NoProfile", "-File", str(self.checker), "-ProcessSnapshotPath", str(orphan)], capture_output=True, text=True, check=False)
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
        return subprocess.run([POWERSHELL, "-NoProfile", "-Command", f"$ErrorActionPreference='Stop'; . '{self.terminalizer}'; {command}"], capture_output=True, text=True, check=False)

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

if __name__ == "__main__":
    unittest.main(verbosity=2)
