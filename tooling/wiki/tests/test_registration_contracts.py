import unittest
import subprocess
import os
import shutil
import hashlib
import json
import stat
import tempfile
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
        owned = Path(tempfile.mkdtemp(prefix="wiki_registration_", dir=parent))
    else:
        owned = Path(tempfile.mkdtemp(prefix="wiki_registration_"))
    owned_stat = os.lstat(owned)
    if not stat.S_ISDIR(owned_stat.st_mode) or getattr(owned_stat, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400):
        raise RuntimeError("owned evidence root must be an ordinary directory")
    if _ORIGINAL_EVIDENCE_ROOT and os.path.normcase(str(owned.parent)) != os.path.normcase(str(parent)):
        raise RuntimeError("owned evidence root must be one direct child of the supplied parent")
    return owned


EVIDENCE_ROOT = _create_owned_evidence_root()
REGISTRATION_TEST_TMP = EVIDENCE_ROOT / "registration-test-tmp"


def fixture_environment():
    environment = os.environ.copy()
    environment["SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT"] = str(EVIDENCE_ROOT)
    return environment


def tearDownModule():
    shutil.rmtree(EVIDENCE_ROOT)



@unittest.skipIf(not POWERSHELL, "PowerShell unavailable")
class TestRegistrationContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.worktree = str(WIKI_DIR.parent.parent)
        cls.script_path = str(WIKI_DIR / "register_wiki_nightly_task.ps1")
        cls.preflight_path = str(WIKI_DIR / "activation_preflight.ps1")
        REGISTRATION_TEST_TMP.mkdir(exist_ok=True)
        cls.out_dir = tempfile.mkdtemp(prefix="registration_tests_", dir=REGISTRATION_TEST_TMP)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.out_dir):
            owned_root = cls.out_dir

            def recover_owned_readonly_unlink(function, path, exc_info):
                cls.recover_owned_readonly_unlink(
                    owned_root, function, path, exc_info
                )

            shutil.rmtree(cls.out_dir, onerror=recover_owned_readonly_unlink)

    @staticmethod
    def recover_owned_readonly_unlink(owned_root, function, path, exc_info):
        error = exc_info[1]
        if not isinstance(error, PermissionError):
            raise error
        if function not in (os.unlink, os.remove):
            raise error

        root = os.path.abspath(os.fspath(owned_root))
        candidate = os.path.abspath(os.fspath(path))
        try:
            if (
                os.path.normcase(os.path.commonpath((root, candidate)))
                != os.path.normcase(root)
                or os.path.normcase(candidate) == os.path.normcase(root)
            ):
                raise error
        except ValueError:
            raise error

        readonly = getattr(stat, "FILE_ATTRIBUTE_READONLY", 0x1)
        reparse = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
        cursor = candidate
        while True:
            subject_stat = os.lstat(cursor)
            attributes = getattr(subject_stat, "st_file_attributes", 0)
            if stat.S_ISLNK(subject_stat.st_mode) or attributes & reparse:
                raise error
            if os.path.normcase(cursor) == os.path.normcase(root):
                break
            parent = os.path.dirname(cursor)
            if parent == cursor:
                raise error
            cursor = parent

        file_stat = os.lstat(candidate)
        if not stat.S_ISREG(file_stat.st_mode):
            raise error
        if not (getattr(file_stat, "st_file_attributes", 0) & readonly):
            raise error
        if os.path.normcase(os.path.commonpath((os.path.realpath(root), os.path.realpath(candidate)))) != os.path.normcase(os.path.realpath(root)):
            raise error

        os.chmod(candidate, file_stat.st_mode | stat.S_IWRITE)
        function(candidate)

    def test_teardown_readonly_recovery_is_strictly_bounded(self):
        owned = Path(tempfile.mkdtemp(prefix="cleanup_owned_", dir=self.out_dir))
        readonly_file = owned / "readonly.txt"
        readonly_file.write_text("owned\n", encoding="ascii")
        os.chmod(readonly_file, stat.S_IREAD)
        permission_error = PermissionError(13, "synthetic access denied", str(readonly_file))
        self.recover_owned_readonly_unlink(
            str(owned), os.unlink, str(readonly_file),
            (PermissionError, permission_error, None),
        )
        self.assertFalse(readonly_file.exists())

        writable_file = owned / "writable.txt"
        writable_file.write_text("writable\n", encoding="ascii")
        with self.assertRaises(PermissionError):
            self.recover_owned_readonly_unlink(
                str(owned), os.unlink, str(writable_file),
                (PermissionError, permission_error, None),
            )
        self.assertTrue(writable_file.exists())

        outside = Path(tempfile.mkdtemp(prefix="cleanup_outside_", dir=self.out_dir))
        outside_file = outside / "readonly.txt"
        outside_file.write_text("outside\n", encoding="ascii")
        os.chmod(outside_file, stat.S_IREAD)
        try:
            with self.assertRaises(PermissionError):
                self.recover_owned_readonly_unlink(
                    str(owned), os.unlink, str(outside_file),
                    (PermissionError, permission_error, None),
                )
            self.assertTrue(outside_file.exists())
        finally:
            os.chmod(outside_file, stat.S_IWRITE)

        directory = owned / "directory"
        directory.mkdir()
        with self.assertRaises(PermissionError):
            self.recover_owned_readonly_unlink(
                str(owned), os.unlink, str(directory),
                (PermissionError, permission_error, None),
            )
        unexpected_operation_file = owned / "unexpected.txt"
        unexpected_operation_file.write_text("unexpected\n", encoding="ascii")
        os.chmod(unexpected_operation_file, stat.S_IREAD)
        try:
            with self.assertRaises(PermissionError):
                self.recover_owned_readonly_unlink(
                    str(owned), os.rmdir, str(unexpected_operation_file),
                    (PermissionError, permission_error, None),
                )
        finally:
            os.chmod(unexpected_operation_file, stat.S_IWRITE)

        unrelated_error = OSError(5, "synthetic unrelated error")
        with self.assertRaises(OSError) as raised:
            self.recover_owned_readonly_unlink(
                str(owned), os.unlink, str(writable_file),
                (OSError, unrelated_error, None),
            )
        self.assertIs(raised.exception, unrelated_error)

        link = owned / "link"
        link_target = owned / "link_target"
        link_target.mkdir()
        create_link = self.run_ps(
            [
                f"New-Item -ItemType Junction -Path '{link}' -Target '{link_target}' -ErrorAction Stop | Out-Null"
            ]
        )
        if create_link.returncode != 0:
            self.skipTest("junction reparse fixture unavailable: " + create_link.stderr.strip())
        try:
            with self.assertRaises(PermissionError):
                self.recover_owned_readonly_unlink(
                    str(owned), os.unlink, str(link),
                    (PermissionError, permission_error, None),
                )
            link_stat = os.lstat(link)
            self.assertTrue(
                getattr(link_stat, "st_file_attributes", 0)
                & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
            )
            self.assertTrue(link_target.exists())
        finally:
            os.rmdir(link)


    def test_teardown_rejects_intermediate_junction_escape(self):
        owned = Path(tempfile.mkdtemp(prefix="junction_owned_", dir=self.out_dir))
        outside = Path(tempfile.mkdtemp(prefix="junction_outside_", dir=self.out_dir))
        outside_file = outside / "readonly.txt"
        outside_file.write_text("outside\n", encoding="ascii")
        os.chmod(outside_file, stat.S_IREAD)
        link = owned / "link"
        create = self.run_ps(
            [
                f"New-Item -ItemType Junction -Path '{link}' -Target '{outside}' -ErrorAction Stop | Out-Null"
            ]
        )
        if create.returncode != 0:
            os.chmod(outside_file, stat.S_IWRITE)
            self.skipTest("junction fixture unavailable: " + create.stderr.strip())
        apparent = link / outside_file.name
        permission_error = PermissionError(13, "synthetic access denied", str(apparent))
        try:
            with self.assertRaises(PermissionError) as raised:
                self.recover_owned_readonly_unlink(
                    str(owned),
                    os.unlink,
                    str(apparent),
                    (PermissionError, permission_error, None),
                )
            self.assertIs(raised.exception, permission_error)
            link_stat = os.lstat(link)
            self.assertTrue(
                stat.S_ISLNK(link_stat.st_mode)
                or getattr(link_stat, "st_file_attributes", 0)
                & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
            )
            self.assertTrue(outside_file.exists())
            self.assertTrue(
                getattr(os.stat(outside_file), "st_file_attributes", 0)
                & getattr(stat, "FILE_ATTRIBUTE_READONLY", 0x1)
            )
        finally:
            os.rmdir(link)
            os.chmod(outside_file, stat.S_IWRITE)

    def run_ps(self, args):
        cmd = [POWERSHELL, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"] + args
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=fixture_environment(),
        )

    def create_isolated_runtime(self):
        root = Path(tempfile.mkdtemp(prefix="runtime_", dir=self.out_dir))
        subprocess.run(["git", "init", str(root)], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(root), "config", "user.name", "Registration Test"], check=True)
        subprocess.run(["git", "-C", str(root), "config", "user.email", "registration@example.invalid"], check=True)
        wiki_tools = root / "tooling" / "wiki"
        wiki_tools.mkdir(parents=True)
        (wiki_tools / "nightly_wiki_sync.ps1").write_text("# isolated fixture\n", encoding="ascii")
        (wiki_tools / "wiki_nightly_config.json").write_text(
            json.dumps({"freshness_max_age_hours": 48, "serve_gate": {"remote": "origin", "branch": "main"}}),
            encoding="ascii",
        )
        graph = root / "wiki" / ".graph" / "graph.json"
        graph.parent.mkdir(parents=True)
        graph.write_text(
            json.dumps(
                {
                    "nodes": [{"id": "n1", "community": 1}, {"id": "n2", "community": 2}],
                    "links": [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n1"}],
                }
            ),
            encoding="ascii",
        )
        (root / "seed.txt").write_text("seed\n", encoding="ascii")
        subprocess.run(["git", "-C", str(root), "add", "seed.txt", "tooling/wiki/nightly_wiki_sync.ps1", "tooling/wiki/wiki_nightly_config.json", "wiki/.graph/graph.json"], check=True)
        subprocess.run(["git", "-C", str(root), "commit", "-m", "fixture"], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(root), "branch", "-M", "main"], check=True)
        head = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
        subprocess.run(["git", "-C", str(root), "update-ref", "refs/remotes/origin/main", head], check=True)
        (root / "wiki" / ".build-stamp").write_text(f"Build Stamp: fixture\nHEAD: {head}\n", encoding="ascii")
        return root

    def test_deterministic_identical_bytes(self):
        guid = "12345678-1234-1234-1234-1234567890ab"
        for contract in ("A", "D"):
            with self.subTest(contract=contract):
                out1 = os.path.join(self.out_dir, f"{contract}_test1.xml")
                out2 = os.path.join(self.out_dir, f"{contract}_test2.xml")
                args1 = f"& '{self.script_path}' -SchedulerContract '{contract}' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out1}'"
                args2 = f"& '{self.script_path}' -SchedulerContract '{contract}' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out2}'"
                res1 = self.run_ps([args1])
                res2 = self.run_ps([args2])
                self.assertEqual(res1.returncode, 0, res1.stderr)
                self.assertEqual(res2.returncode, 0, res2.stderr)
                b1 = Path(out1).read_bytes()
                b2 = Path(out2).read_bytes()
                self.assertEqual(b1, b2)
                self.assertEqual(hashlib.sha256(b1).hexdigest(), hashlib.sha256(b2).hexdigest())

    def test_activation_preflight_acceptance(self):
        runtime = self.create_isolated_runtime()
        fixture_dir = runtime / "fixture-inputs"
        fixture_dir.mkdir()
        out_xml = fixture_dir / "preflight_test.xml"
        guid = "12345678-1234-1234-1234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'D' -RuntimeRoot '{runtime}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out_xml}'"
        res = self.run_ps([args])
        self.assertEqual(res.returncode, 0, res.stderr)

        query_txt = fixture_dir / "query.txt"
        query_txt.write_text("Scheduled Task State: Enabled\n", encoding="ascii")
        mcp_txt = fixture_dir / "mcp.txt"
        mcp_txt.write_text("graphify not found\n", encoding="ascii")
        standing = fixture_dir / "standing-block.md"
        active_lock = fixture_dir / "active.lock"
        pf_args = f"& '{self.preflight_path}' -EvidenceMode Fixture -ExpectedSchedulerContract 'D' -ExpectedSchedulerPhase 'StagedAwaitingManual' -ExpectedStartBoundary '2026-08-01T05:30:00' -ExpectedRegistrationDate '2026-07-31T12:00:00' -ExpectedTaskDefinitionId '{guid}' -TaskXmlOutputPath '{out_xml}' -TaskQueryOutputPath '{query_txt}' -McpStatusOutputPath '{mcp_txt}' -GraphifyVersionOverride '0.9.17' -StandingBlockEvidencePath '{standing}' -ActiveLockEvidencePath '{active_lock}' -RuntimeRoot '{runtime}'"
        pf_res = self.run_ps([pf_args])
        self.assertEqual(pf_res.returncode, 1, pf_res.stdout + pf_res.stderr)
        self.assertIn("PASS    scheduler-contract", pf_res.stdout)
        self.assertNotIn("FAIL    scheduler-contract", pf_res.stdout)
        self.assertEqual(
            [line for line in pf_res.stdout.splitlines() if line.startswith("RESULT ")],
            ["RESULT FIXTURE_NON_ACTIVATION"],
        )
        self.assertNotIn(r"C:\Projects\OLLAMA_ACTIVE.lock", pf_res.stdout + pf_res.stderr)

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

    def test_contract_d_exact_xml_action_description_and_settings(self):
        out = os.path.join(self.out_dir, "contract_d_exact.xml")
        guid = "12345678-1234-4234-8234-1234567890ab"
        args = f"& '{self.script_path}' -SchedulerContract 'D' -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
        result = self.run_ps([args])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        xml = Path(out).read_text(encoding="ascii")
        expected_script = Path(self.worktree) / "tooling" / "wiki" / "nightly_wiki_sync.ps1"
        expected_action = (
            f'-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{expected_script}" '
            f'-RepoRoot "{self.worktree}" -TaskDefinitionId "{guid}" -SkipLabeling -SkipSemantic'
        )
        self.assertIn("SSTAC Wiki nightly candidate D: deterministic-only network-capable run; label and semantic disabled. Staged with the daily trigger disabled.", xml)
        self.assertIn(f"<Arguments>{expected_action.replace(chr(34), '&quot;')}</Arguments>", xml)
        self.assertEqual(xml.count("<CalendarTrigger>"), 1)
        self.assertEqual(xml.count("<DaysInterval>1</DaysInterval>"), 1)
        self.assertIn("<Enabled>false</Enabled>", xml)
        self.assertIn("<LogonType>Password</LogonType>", xml)
        self.assertIn("<RunLevel>LeastPrivilege</RunLevel>", xml)
        self.assertIn("<ExecutionTimeLimit>PT6H</ExecutionTimeLimit>", xml)
        self.assertNotIn("RestartOnFailure", xml)
        self.assertNotIn("-AutoCommit", xml)

    def test_contract_d_apply_and_unregister_are_refused_without_task_calls(self):
        for switch in ("Apply", "Unregister"):
            with self.subTest(switch=switch):
                out = os.path.join(self.out_dir, f"contract_d_{switch}.xml")
                guid = "12345678-1234-4234-8234-1234567890ab"
                args = f"& '{self.script_path}' -SchedulerContract 'D' -{switch} -RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' -StartBoundary '2026-08-01T05:30:00' -RegistrationDate '2026-07-31T12:00:00' -OutputXmlPath '{out}'"
                result = self.run_ps([args])
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(Path(out).exists())
                self.assertIn("Contract D", result.stderr)

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

    def test_scheduler_contract_identity_is_exact_case_before_output_or_task_handling(self):
        guid = "12345678-1234-1234-1234-1234567890ab"
        for index, contract in enumerate(("legacy", "LEGACY", "a", "d")):
            with self.subTest(contract=contract):
                out = Path(self.out_dir) / f"recased_contract_{index}.xml"
                args = (
                    f"& '{self.script_path}' -SchedulerContract '{contract}' "
                    f"-RuntimeRoot '{self.worktree}' -TaskDefinitionId '{guid}' "
                    "-StartBoundary '2026-08-01T05:30:00' "
                    "-RegistrationDate '2026-07-31T12:00:00' "
                    f"-OutputXmlPath '{out}'"
                )
                result = self.run_ps([args])
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse(out.exists())
                self.assertIn("case-sensitive", result.stderr)
                self.assertNotIn("Exact schtasks command", result.stdout)

        exact = self.run_ps(
            [f"& '{self.script_path}' -SchedulerContract 'Legacy' -TaskName 'TestLegacyTask' -StartTime '06:00'"]
        )
        self.assertEqual(exact.returncode, 0, exact.stdout + exact.stderr)
        self.assertIn("DRY RUN ONLY", exact.stdout)

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
