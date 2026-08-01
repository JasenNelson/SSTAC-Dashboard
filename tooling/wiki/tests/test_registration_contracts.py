import unittest
import subprocess
import os
import shutil
import hashlib
from pathlib import Path

WIKI_DIR = Path(__file__).parent.parent
POWERSHELL = os.environ.get("PREFLIGHT_POWERSHELL") or shutil.which("powershell")

@unittest.skipIf(not POWERSHELL, "PowerShell unavailable")
class TestRegistrationContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import tempfile
        cls.worktree = str(WIKI_DIR.parent.parent)
        cls.script_path = str(WIKI_DIR / "register_wiki_nightly_task.ps1")
        cls.preflight_path = str(WIKI_DIR / "activation_preflight.ps1")
        tmp_root = "C:\\tmp"
        os.makedirs(tmp_root, exist_ok=True)
        cls.out_dir = tempfile.mkdtemp(prefix="registration_tests_", dir=tmp_root)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.out_dir):
            shutil.rmtree(cls.out_dir)

    def run_ps(self, args):
        cmd = [POWERSHELL, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"] + args
        return subprocess.run(cmd, capture_output=True, text=True)

    def test_deterministic_identical_bytes(self):
        out1 = os.path.join(self.out_dir, "test1.xml")
        out2 = os.path.join(self.out_dir, "test2.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"

        args1 = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out1}'"
        res1 = self.run_ps([args1])
        self.assertEqual(res1.returncode, 0, res1.stderr)

        args2 = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out2}'"
        res2 = self.run_ps([args2])
        self.assertEqual(res2.returncode, 0, res2.stderr)

        with open(out1, 'rb') as f:
            b1 = f.read()
        with open(out2, 'rb') as f:
            b2 = f.read()
        self.assertEqual(b1, b2)
        h1 = hashlib.sha256(b1).hexdigest()
        h2 = hashlib.sha256(b2).hexdigest()
        self.assertEqual(h1, h2)

    def test_activation_preflight_acceptance(self):
        out_xml = os.path.join(self.out_dir, "preflight_test.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out_xml}'"
        res = self.run_ps([args])
        self.assertEqual(res.returncode, 0, res.stderr)

        query_txt = os.path.join(self.out_dir, "query.txt")
        with open(query_txt, 'w', encoding='utf-8') as f:
            f.write("Scheduled Task State: Enabled\n")

        pf_args = f"& '{self.preflight_path}' -ExpectedSchedulerContract 'A' -ExpectedSchedulerPhase 'StagedAwaitingManual' -ExpectedStartBoundary '2026-08-01T05:30:00' -ExpectedRegistrationDate '2026-07-31T12:00:00' -ExpectedTaskDefinitionId '{guid}' -TaskXmlOutputPath '{out_xml}' -TaskQueryOutputPath '{query_txt}' -RuntimeRoot '{self.worktree}'"
        pf_res = self.run_ps([pf_args])
        self.assertIn("PASS    scheduler-contract", pf_res.stdout)
        self.assertNotIn("FAIL    scheduler-contract", pf_res.stdout)

    def test_rejects_malformed_guid(self):
        out = os.path.join(self.out_dir, "bad_guid.xml")
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId 'bad-guid' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("canonical nonempty GUID", res.stderr)

    def test_rejects_invalid_boundary(self):
        out = os.path.join(self.out_dir, "bad_bound.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01 05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("timezone-less local YYYY-MM-DDT05:30:00", res.stderr)

    def test_rejects_invalid_boundary_datetime(self):
        out = os.path.join(self.out_dir, "bad_dt_bound.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-99-99T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("must be a valid datetime", res.stderr)

    def test_rejects_relative_missing_runtime(self):
        out = os.path.join(self.out_dir, "bad_root.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot 'missing_dir' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("existing directory", res.stderr)

    def test_rejects_missing_wrapper_script(self):
        # Create a real directory without the wrapper script
        bad_runtime = os.path.join(self.out_dir, "empty_runtime")
        os.makedirs(bad_runtime, exist_ok=True)
        out = os.path.join(self.out_dir, "bad_wrapper.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{bad_runtime}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("Wrapper script not found", res.stderr)

    def test_rejects_unsafe_overwrite(self):
        out = os.path.join(self.out_dir, "overwrite.xml")
        with open(out, 'w') as f:
            f.write("test")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("already exists", res.stderr)

    def test_contract_a_apply_fails(self):
        out = os.path.join(self.out_dir, "apply.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -Apply -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("never install the task", res.stderr)

    def test_contract_a_unregister_fails(self):
        out = os.path.join(self.out_dir, "unregister.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -Unregister -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("Contract A does not support -Unregister", res.stderr)

    def test_accepts_bracketed_runtime_root(self):
        bracketed_root = os.path.join(self.out_dir, "test[brackets]dir")
        wiki_dir = os.path.join(bracketed_root, "tooling", "wiki")
        os.makedirs(wiki_dir, exist_ok=True)
        with open(os.path.join(wiki_dir, "nightly_wiki_sync.ps1"), 'w') as f:
            f.write("# mock")
        out = os.path.join(self.out_dir, "bracketed_out.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{bracketed_root}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertTrue(os.path.exists(out))

    def test_rejects_non_0530_starttime(self):
        out = os.path.join(self.out_dir, "bad_starttime.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -StartTime '06:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("Contract A does not support arbitrary StartTime", res.stderr)

    def test_rejects_date_only_registration_date(self):
        out = os.path.join(self.out_dir, "bad_reg_date1.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("RegistrationDate must be a valid XML dateTime including time", res.stderr)

    def test_rejects_malformed_xml_datetime_registration_date(self):
        out = os.path.join(self.out_dir, "bad_reg_date2.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026/07/31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("RegistrationDate must be a valid XML dateTime", res.stderr)

    def test_legacy_behavior_compatible(self):
        args = f"& '{self.script_path}' -TaskName 'TestLegacyTask' -StartTime '06:00'"
        res = self.run_ps([args])
        self.assertEqual(res.returncode, 0)
        self.assertIn("DRY RUN ONLY", res.stdout)
        self.assertIn("06:00", res.stdout)
        self.assertIn("TestLegacyTask", res.stdout)

    def test_rejects_empty_guid(self):
        out = os.path.join(self.out_dir, "empty_guid.xml")
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '00000000-0000-0000-0000-000000000000' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("cannot be the empty GUID", res.stderr)

    def test_rejects_non_canonical_task_name(self):
        out = os.path.join(self.out_dir, "bad_name.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -TaskName '\Wrong-Name' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("task name must be exactly \SSTAC-Wiki-Nightly", res.stderr)

    def test_rejects_terminal_newlines_in_guid(self):
        out = os.path.join(self.out_dir, "bad_guid.xml")
        guid = "12345678-1234-1234-1234-1234567890ab\n"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("TaskDefinitionId is required and must be a canonical nonempty GUID.", res.stderr)

    def test_accepts_output_paths_with_wildcard_characters(self):
        out = os.path.join(self.out_dir, "task[1].xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertEqual(res.returncode, 0)
        self.assertIn("Contract A generated successfully.", res.stdout)
        self.assertTrue(os.path.exists(out))

    def test_unknown_scheduler_contract_fails(self):
        out = os.path.join(self.out_dir, "unknown_contract.xml")
        args = f"& '{self.script_path}' -SchedulerContract 'B'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("Unsupported SchedulerContract: B", res.stderr)

    def test_rejects_non_ascii_paths(self):
        out = os.path.join(self.out_dir, "non_ascii.xml")
        guid = "12345678-1234-1234-1234-1234567890ab"
        non_ascii_root = os.path.join(self.out_dir, "r\xe9pertoir\xe9")
        os.makedirs(non_ascii_root, exist_ok=True)
        # Create a dummy script path so it passes the Test-Path before the encode step
        dummy_script_dir = os.path.join(non_ascii_root, "tooling", "wiki")
        os.makedirs(dummy_script_dir, exist_ok=True)
        with open(os.path.join(dummy_script_dir, "nightly_wiki_sync.ps1"), 'w') as f:
            f.write("# Dummy")

        args = f"& '{self.script_path}' -SchedulerContract 'A' -RuntimeRoot '{non_ascii_root}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        res = self.run_ps([args])
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("non-ASCII characters", res.stderr)


if __name__ == '__main__':
    unittest.main()
