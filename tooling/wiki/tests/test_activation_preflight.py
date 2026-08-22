import json
import hashlib
import os
import re
import shutil
import stat
import subprocess
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPT = Path(__file__).parent.parent / "activation_preflight.ps1"
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
        owned = Path(tempfile.mkdtemp(prefix="wiki_activation_", dir=parent))
    else:
        owned = Path(tempfile.mkdtemp(prefix="wiki_activation_"))
    owned_stat = os.lstat(owned)
    if not stat.S_ISDIR(owned_stat.st_mode) or getattr(owned_stat, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400):
        raise RuntimeError("owned evidence root must be an ordinary directory")
    if _ORIGINAL_EVIDENCE_ROOT and os.path.normcase(str(owned.parent)) != os.path.normcase(str(parent)):
        raise RuntimeError("owned evidence root must be one direct child of the supplied parent")
    return owned


EVIDENCE_ROOT = _create_owned_evidence_root()
ACTIVATION_TEST_TMP = EVIDENCE_ROOT / "activation-test-tmp"


def fixture_environment():
    environment = os.environ.copy()
    environment["SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT"] = str(EVIDENCE_ROOT)
    return environment


def tearDownModule():
    shutil.rmtree(EVIDENCE_ROOT)


POWERSHELL = os.environ.get("PREFLIGHT_POWERSHELL") or shutil.which("powershell")
TASK_NS = "http://schemas.microsoft.com/windows/2004/02/mit/task"
EXPECTED_ACCOUNT = r"DINGAPC\jasen"
DESCRIPTION = "SSTAC Wiki nightly candidate A: true unattended network-capable run. Staged with the daily trigger disabled."
DESCRIPTION_D = "SSTAC Wiki nightly candidate D: deterministic-only network-capable run; label and semantic disabled. Staged with the daily trigger disabled."
DEFINITION_ID = "11111111-2222-4333-8444-555555555555"
OTHER_DEFINITION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
ZERO_DEFINITION_ID = "00000000-0000-0000-0000-000000000000"
REGISTRATION_DATE = "2026-07-29T05:00:00"
ACTIVE_COMPLETION_MARGIN = timedelta(minutes=1)


def most_recent_completed_local_0530(reference):
    anchor = reference.replace(hour=5, minute=30, second=0, microsecond=0)
    if anchor + ACTIVE_COMPLETION_MARGIN > reference:
        anchor -= timedelta(days=1)
    return anchor


class ActivationPreflightTests(unittest.TestCase):
    def setUp(self):
        if not POWERSHELL:
            self.skipTest("PowerShell is unavailable")
        ACTIVATION_TEST_TMP.mkdir(parents=True, exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=ACTIVATION_TEST_TMP)
        self.root = Path(self.tmp.name)
        subprocess.run(["git", "init", str(self.root)], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(self.root), "config", "user.name", "Preflight Test"], check=True)
        subprocess.run(["git", "-C", str(self.root), "config", "user.email", "preflight@example.invalid"], check=True)
        (self.root / "seed.txt").write_text("seed\n", encoding="ascii")
        subprocess.run(["git", "-C", str(self.root), "add", "seed.txt"], check=True)
        subprocess.run(["git", "-C", str(self.root), "commit", "-m", "seed"], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(self.root), "branch", "-M", "main"], check=True)
        self.head = self.git("rev-parse", "HEAD")
        subprocess.run(["git", "-C", str(self.root), "update-ref", "refs/remotes/origin/main", self.head], check=True)

        self.config = self.root / "tooling" / "wiki" / "wiki_nightly_config.json"
        self.config.parent.mkdir(parents=True)
        self.config.write_text(
            json.dumps({"freshness_max_age_hours": 48, "serve_gate": {"remote": "origin", "branch": "main"}}),
            encoding="ascii",
        )
        self.graph_path = self.root / "wiki" / ".graph" / "graph.json"
        self.graph_path.parent.mkdir(parents=True)
        self.write_graph(
            [{"id": "n1", "community": 1}, {"id": "n2", "community": 2}],
            [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n1"}],
        )
        self.stamp_path = self.root / "wiki" / ".build-stamp"
        self.stamp_path.write_text(f"Build Stamp: 2026-07-29\nHEAD: {self.head}\n", encoding="ascii")

        self.task = self.root / "task.txt"
        self.task_xml = self.root / "task.xml"
        self.mcp = self.root / "mcp.txt"
        self.task.write_text("ERROR: The system cannot find the file specified.", encoding="ascii")
        self.task_xml.write_text("", encoding="ascii")
        self.mcp.write_text("graphify not found", encoding="ascii")
        self.control_fixture = self.root / "control-evidence"
        self.control_fixture.mkdir()
        self.standing_block = self.control_fixture / "standing-block.md"
        self.active_lock = self.control_fixture / "active.lock"

        sid_command = (
            f"(New-Object System.Security.Principal.NTAccount('{EXPECTED_ACCOUNT}'))."
            "Translate([System.Security.Principal.SecurityIdentifier]).Value"
        )
        self.expected_sid = subprocess.run(
            [POWERSHELL, "-NoProfile", "-Command", sid_command],
            check=True,
            capture_output=True,
            text=True,
            env=fixture_environment(),
        ).stdout.strip()
        self.assertRegex(self.expected_sid, r"^S-\d(?:-\d+)+$")

        self.fixture_reference = datetime.now().replace(microsecond=0)
        self.active_run_local = most_recent_completed_local_0530(self.fixture_reference)
        self.start_boundary = self.active_run_local.strftime("%Y-%m-%dT05:30:00")
        self.last_run = self.fixture_reference - timedelta(minutes=1)
        self.proof_not_before = None
        self.active_transition_path = None
        self.active_transition_sha256 = None

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(
            ["git", "-C", str(self.root), *args],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    def write_graph(self, nodes, links, hyperedges=None):
        graph = {"nodes": nodes, "links": links}
        if hyperedges is not None:
            graph["hyperedges"] = hyperedges
        self.graph_path.write_text(json.dumps(graph), encoding="ascii")

    def run_preflight(
        self,
        version="0.9.17",
        contract="Legacy",
        phase="Any",
        definition_id=DEFINITION_ID,
        start_boundary=None,
        registration_date=REGISTRATION_DATE,
        proof_not_before=None,
        active_transition_path=None,
        active_transition_sha256=None,
        evidence_mode="Fixture",
        include_fixture_tuple=True,
        omit_fixture_fields=(),
        extra_args=(),
        environment=None,
    ):
        command = [
            POWERSHELL,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(SCRIPT),
            "-EvidenceMode",
            evidence_mode,
            "-RuntimeRoot",
            str(self.root),
            "-ExpectedSchedulerContract",
            contract,
            "-ExpectedSchedulerPhase",
            phase,
            "-ExpectedStartBoundary",
            start_boundary or self.start_boundary,
            "-ExpectedRegistrationDate",
            registration_date,
            "-ExpectedTaskDefinitionId",
            definition_id,
        ]
        if include_fixture_tuple:
            fixture_values = {
                "TaskQueryOutputPath": self.task,
                "TaskXmlOutputPath": self.task_xml,
                "McpStatusOutputPath": self.mcp,
                "StandingBlockEvidencePath": self.standing_block,
                "ActiveLockEvidencePath": self.active_lock,
            }
            for name, value in fixture_values.items():
                if name not in omit_fixture_fields:
                    command.extend([f"-{name}", str(value)])
        proof = proof_not_before if proof_not_before is not None else self.proof_not_before
        if proof is not None:
            command.extend(["-ProofNotBeforeUtc", proof])
        transition_path = active_transition_path if active_transition_path is not None else self.active_transition_path
        transition_sha256 = active_transition_sha256 if active_transition_sha256 is not None else self.active_transition_sha256
        if transition_path is not None:
            command.extend(["-ActiveTransitionReceiptPath", str(transition_path)])
        if transition_sha256 is not None:
            command.extend(["-ExpectedActiveTransitionReceiptSha256", transition_sha256])
        if version is not None and "GraphifyVersionOverride" not in omit_fixture_fields:
            command.extend(["-GraphifyVersionOverride", version])
        command.extend(extra_args)
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            env=environment or fixture_environment(),
        )

    def make_junction(self, path, target):
        quoted_path = str(path).replace("'", "''")
        quoted_target = str(target).replace("'", "''")
        result = subprocess.run(
            [
                POWERSHELL,
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                (
                    "New-Item -ItemType Junction "
                    f"-Path '{quoted_path}' "
                    f"-Target '{quoted_target}' "
                    "-ErrorAction Stop | Out-Null"
                ),
            ],
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def assert_fixture_non_activation(self, result):
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        result_lines = [line for line in result.stdout.splitlines() if line.startswith("RESULT ")]
        self.assertEqual(result_lines, ["RESULT FIXTURE_NON_ACTIVATION"], result.stdout + result.stderr)
        self.assertEqual(result.stdout.splitlines()[-1], "RESULT FIXTURE_NON_ACTIVATION")

    def assert_not_ready(self, result, check_name):
        self.assert_fixture_non_activation(result)
        self.assertIn(f"FAIL    {check_name}:", result.stdout)

    def assert_evidence_mode_failure(self, result, diagnostic=None):
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("FAIL    evidence-mode:", result.stdout)
        self.assertEqual(
            [line for line in result.stdout.splitlines() if line.startswith("RESULT ")],
            ["RESULT NOT_READY"],
        )
        if diagnostic:
            self.assertIn(diagnostic, result.stdout)

    def run_preflight_function_probe(self, body):
        source_path = str(SCRIPT).replace("'", "''")
        command = (
            f"$source=Get-Content -LiteralPath '{source_path}' -Raw;"
            "$marker='$fixtureParameterNames = @(';"
            "$index=$source.IndexOf($marker,[StringComparison]::Ordinal);"
            "if($index -lt 1){throw 'function seam marker missing'};"
            ". ([scriptblock]::Create($source.Substring(0,$index)));"
            + body
        )
        return subprocess.run(
            [POWERSHELL, "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        )

    def write_verbose(self, phase, last_result="0", last_run=None, status="Ready"):
        state = "Disabled" if phase == "Disabled" else "Enabled"
        if last_run is None:
            if phase == "Active0530Correlated":
                last_run = self.active_run_local
            else:
                last_run = datetime.now().replace(microsecond=0) - timedelta(minutes=1)
        self.last_run = last_run
        last_run_text = last_run if isinstance(last_run, str) else last_run.strftime("%Y-%m-%dT%H:%M:%S")
        expected_script = self.root / "tooling" / "wiki" / "nightly_wiki_sync.ps1"
        self.task.write_text(
            "\n".join(
                (
                    r"TaskName: \SSTAC-Wiki-Nightly",
                    f"Status: {status}",
                    f"Scheduled Task State: {state}",
                    f"Last Run Time: {last_run_text}",
                    f"Last Result: {last_result}",
                    f'Task To Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{expected_script}"',
                )
            )
            + "\n",
            encoding="ascii",
        )

    def task_xml_text(
        self,
        phase,
        definition_id=DEFINITION_ID,
        user_id=None,
        omit=(),
        prefixed=False,
        start_boundary=None,
        contract="A",
    ):
        user_id = user_id or EXPECTED_ACCOUNT
        task_enabled = "false" if phase == "Disabled" else "true"
        trigger_enabled = "true" if phase in ("ActiveAwaitingNatural", "Active0530Correlated") else "false"
        powershell = Path(os.environ["SystemRoot"]) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
        script = self.root / "tooling" / "wiki" / "nightly_wiki_sync.ps1"
        p = "t:" if prefixed else ""
        namespace = f'xmlns:t="{TASK_NS}"' if prefixed else f'xmlns="{TASK_NS}"'
        start_boundary = start_boundary or self.start_boundary
        description = DESCRIPTION_D if contract == "D" else DESCRIPTION
        skip_arguments = " -SkipLabeling -SkipSemantic" if contract == "D" else ""
        optional = {
            "RunLevel": f"<{p}RunLevel>LeastPrivilege</{p}RunLevel>",
            "TaskEnabled": f"<{p}Enabled>{task_enabled}</{p}Enabled>",
            "TriggerEnabled": f"<{p}Enabled>{trigger_enabled}</{p}Enabled>",
            "AllowHardTerminate": f"<{p}AllowHardTerminate>true</{p}AllowHardTerminate>",
            "AllowStartOnDemand": f"<{p}AllowStartOnDemand>true</{p}AllowStartOnDemand>",
            "Hidden": f"<{p}Hidden>false</{p}Hidden>",
            "RunOnlyIfIdle": f"<{p}RunOnlyIfIdle>false</{p}RunOnlyIfIdle>",
            "Priority": f"<{p}Priority>7</{p}Priority>",
            "Duration": f"<{p}Duration>PT10M</{p}Duration>",
            "WaitTimeout": f"<{p}WaitTimeout>PT1H</{p}WaitTimeout>",
            "RestartOnIdle": f"<{p}RestartOnIdle>false</{p}RestartOnIdle>",
        }
        for name in omit:
            optional[name] = ""
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<{p}Task version="1.4" {namespace}>
  <{p}RegistrationInfo><{p}Date>{REGISTRATION_DATE}</{p}Date><{p}Author>{EXPECTED_ACCOUNT}</{p}Author><{p}Description>{description}</{p}Description><{p}URI>\SSTAC-Wiki-Nightly</{p}URI></{p}RegistrationInfo>
  <{p}Principals><{p}Principal id="Author"><{p}UserId>{user_id}</{p}UserId><{p}LogonType>Password</{p}LogonType>{optional["RunLevel"]}</{p}Principal></{p}Principals>
  <{p}Settings>
    <{p}MultipleInstancesPolicy>IgnoreNew</{p}MultipleInstancesPolicy>
    <{p}DisallowStartIfOnBatteries>false</{p}DisallowStartIfOnBatteries>
    <{p}StopIfGoingOnBatteries>false</{p}StopIfGoingOnBatteries>
    {optional["AllowHardTerminate"]}
    <{p}StartWhenAvailable>true</{p}StartWhenAvailable>
    <{p}RunOnlyIfNetworkAvailable>true</{p}RunOnlyIfNetworkAvailable>
    <{p}IdleSettings>{optional["Duration"]}{optional["WaitTimeout"]}<{p}StopOnIdleEnd>false</{p}StopOnIdleEnd>{optional["RestartOnIdle"]}</{p}IdleSettings>
    {optional["AllowStartOnDemand"]}{optional["TaskEnabled"]}{optional["Hidden"]}{optional["RunOnlyIfIdle"]}
    <{p}WakeToRun>true</{p}WakeToRun><{p}ExecutionTimeLimit>PT6H</{p}ExecutionTimeLimit>{optional["Priority"]}
  </{p}Settings>
  <{p}Triggers><{p}CalendarTrigger><{p}StartBoundary>{start_boundary}</{p}StartBoundary>{optional["TriggerEnabled"]}<{p}ScheduleByDay><{p}DaysInterval>1</{p}DaysInterval></{p}ScheduleByDay></{p}CalendarTrigger></{p}Triggers>
  <{p}Actions Context="Author"><{p}Exec><{p}Command>{powershell}</{p}Command><{p}Arguments>-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{script}" -RepoRoot "{self.root}" -TaskDefinitionId "{definition_id}"{skip_arguments}</{p}Arguments><{p}WorkingDirectory>{self.root}</{p}WorkingDirectory></{p}Exec></{p}Actions>
</{p}Task>
'''

    def write_contract(
        self,
        phase,
        definition_id=DEFINITION_ID,
        user_id=None,
        omit=(),
        prefixed=False,
        replacements=(),
        utf16=False,
        last_run=None,
        status="Ready",
        last_result="0",
        contract="A",
    ):
        self.write_verbose(phase, last_result=last_result, last_run=last_run, status=status)
        xml = self.task_xml_text(phase, definition_id, user_id, omit, prefixed, contract=contract)
        for old, new in replacements:
            self.assertIn(old, xml, old)
            xml = xml.replace(old, new, 1)
        self.task_xml.write_text(xml, encoding="utf-16" if utf16 else "ascii")

    @staticmethod
    def utc_z(value):
        return value.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")

    def write_active_transition(
        self,
        prior_definition_id=OTHER_DEFINITION_ID,
        active_definition_id=DEFINITION_ID,
        replacements=None,
        remove=(),
        extra=None,
        activated_local=None,
        raw=None,
        filename="active-transition.json",
    ):
        path = self.root / filename
        if raw is None:
            if activated_local is None:
                reference = self.last_run if isinstance(self.last_run, datetime) else datetime.now().replace(microsecond=0)
                activated_local = reference - timedelta(minutes=5)
            data = {
                "schema_version": "1.0",
                "terminal_state": "ACTIVE_DEFINITION_ACCEPTED",
                "task_name": r"\SSTAC-Wiki-Nightly",
                "prior_staged_task_definition_id": prior_definition_id,
                "active_task_definition_id": active_definition_id,
                "registration_date": REGISTRATION_DATE,
                "start_boundary": self.start_boundary,
                "activated_at_utc": self.utc_z(activated_local.astimezone()),
            }
            if replacements:
                data.update(replacements)
            for key in remove:
                data.pop(key, None)
            if extra:
                data.update(extra)
            raw = json.dumps(data, sort_keys=True)
        path.write_text(raw, encoding="ascii")
        self.active_transition_path = path
        self.active_transition_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
        return path

    @staticmethod
    def custody_identity(process_id, parent_process_id, name, created_at, marker, process_class, runtime_reference, descendant):
        return {
            "process_id": process_id,
            "parent_process_id": parent_process_id,
            "creation_utc": created_at,
            "name": name,
            "command_line_sha256": marker * 64,
            "executable_path_sha256": marker * 64,
            "identity_sha256": marker * 64,
            "process_class": process_class,
            "runtime_reference": runtime_reference,
            "attributable_descendant": descendant,
        }

    @staticmethod
    def custody_set_hash(identities):
        joined = "\n".join(sorted(item["identity_sha256"] for item in identities))
        return hashlib.sha256(joined.encode("utf-8")).hexdigest()

    def terminal_custody(self, run_id, start_aware, completed):
        baseline_captured = start_aware + timedelta(seconds=1)
        evaluated = completed - timedelta(seconds=1)
        graph = self.custody_identity(
            200,
            1,
            "python.exe",
            self.utc_z(start_aware - timedelta(minutes=1)),
            "c",
            "PREEXISTING_GRAPHIFY_MCP",
            True,
            False,
        )
        baseline_graph = dict(graph)
        terminal_graph = dict(graph)
        identity_set = self.custody_set_hash([baseline_graph])
        return {
            "schema_version": "1.0",
            "evidence_type": "PROCESS_CUSTODY_TERMINAL",
            "run_id": run_id,
            "baseline_captured_at_utc": self.utc_z(baseline_captured),
            "evaluated_at_utc": self.utc_z(evaluated),
            "result": "PASS",
            "baseline_result": "PASS",
            "enumeration_succeeded": True,
            "classification_succeeded": True,
            "expected_baseline_sha256": "e" * 64,
            "observed_baseline_sha256": "e" * 64,
            "runtime_root": str(self.root),
            "run_parent_pid": 100,
            "run_parent_identity_match": True,
            "run_parent_identity": self.custody_identity(
                100,
                50,
                "powershell.exe",
                self.utc_z(start_aware - timedelta(seconds=1)),
                "a",
                "RUN_PARENT",
                False,
                False,
            ),
            "checker_parent_match": True,
            "checker_identity": self.custody_identity(
                102,
                100,
                "powershell.exe",
                self.utc_z(evaluated - timedelta(seconds=1)),
                "b",
                "CUSTODY_CHECKER",
                False,
                False,
            ),
            "identity_cap": 16,
            "identity_overflow": False,
            "baseline_relevant_count": 1,
            "terminal_relevant_count": 1,
            "allowed_preexisting_graphify_count": 1,
            "survivor_count": 0,
            "departed_baseline_count": 0,
            "baseline_identity_set_sha256": identity_set,
            "terminal_identity_set_sha256": identity_set,
            "baseline_relevant_identities": [baseline_graph],
            "terminal_relevant_identities": [terminal_graph],
            "survivor_identities": [],
            "departed_baseline_identities": [],
        }

    def write_terminal_receipt(
        self,
        definition_id=DEFINITION_ID,
        run_id=None,
        start_local=None,
        replacements=None,
        remove=(),
        filename_run_id=None,
        completed_delta=timedelta(seconds=30),
        custody_replacements=None,
        custody_remove=(),
        custody_mutator=None,
        contract="A",
    ):
        receipt_dir = self.root / ".tmp_wiki_nightly"
        receipt_dir.mkdir(exist_ok=True)
        run_id = run_id or str(uuid.uuid4())
        filename_run_id = filename_run_id or run_id
        start_local = start_local or self.last_run
        start_aware = start_local.astimezone()
        completed = start_aware + completed_delta
        custody = self.terminal_custody(run_id, start_aware, completed)
        if custody_replacements:
            custody.update(custody_replacements)
        for key in custody_remove:
            custody.pop(key, None)
        if custody_mutator:
            custody_mutator(custody)
        canonical_name = f"canonicalization-prepublish-{run_id}.json"
        smoke_name = f"smoke-prepublish-{run_id}.json"
        canonical_path = receipt_dir / canonical_name
        smoke_path = receipt_dir / smoke_name
        graph = json.loads(self.graph_path.read_text(encoding="ascii"))
        graph_sha256 = hashlib.sha256(self.graph_path.read_bytes()).hexdigest()
        graph_node_count = len(graph.get("nodes", []))
        graph_link_count = len(graph.get("links", []))
        valid_communities = [
            node.get("community")
            for node in graph.get("nodes", [])
            if type(node.get("community")) is int and node["community"] >= 0
        ]
        graph_community_count = len(set(valid_communities))
        canonical_receipt = {
            "schema_version": "1.0.0",
            "node_count": graph_node_count,
            "link_count": graph_link_count,
            "hyperedge_count": 0,
            "materialized_endpoint_node_count": 0,
            "removed_prior_materialized_endpoint_node_count": 0,
            "undeclared_endpoint_occurrence_count": 0,
            "undeclared_hyperedge_member_occurrence_count": 0,
            "runtime_root_derived_id_occurrence_count": 0,
        }
        smoke_receipt = {
            "graph_sha256": graph_sha256,
            "graph_integrity": {
                "status": "PASS",
                "node_count": graph_node_count,
                "link_count": graph_link_count,
            },
            "community_contract": {
                "status": "PASS",
                "populated_node_count": len(valid_communities),
                "distinct_community_count": graph_community_count,
            },
            "hard_abort": False,
        }
        canonical_path.write_text(
            json.dumps(canonical_receipt, sort_keys=True), encoding="ascii"
        )
        smoke_path.write_text(
            json.dumps(smoke_receipt, sort_keys=True), encoding="ascii"
        )
        deterministic = contract == "D"
        data = {
            "schema_version": "1.0",
            "run_id": run_id,
            "task_definition_id": definition_id,
            "started_at_utc": self.utc_z(start_aware),
            "completed_at_utc": self.utc_z(completed),
            "duration_seconds": completed_delta.total_seconds(),
            "terminal_state": "SUCCESS",
            "native_exit_code": 0,
            "n0_orphan": "OK",
            "n1_build": "OK",
            "n2_cluster": "OK",
            "n5_mode": "SKIP_ALL" if deterministic else "LABEL_AND_SEMANTIC",
            "n5_skip_labeling": deterministic,
            "n5_skip_semantic": deterministic,
            "n5_run_label": not deterministic,
            "n5_run_semantic": not deterministic,
            "n5_lock_expiry_minutes": 0 if deterministic else 150,
            "n5_mutation_attempted": not deterministic,
            "semantic_execution_attempted": not deterministic,
            "n5_release_required": not deterministic,
            "n5_semantic": "SEMANTIC_SKIPPED_SkipFlags" if deterministic else "OK",
            "n6_wiki": "OK",
            "n6_publication": "SERVED_WIKI_SWAPPED",
            "serve_gate": "PASS",
            "final_canonicalization": {
                "status": "PASS",
                "receipt_name": canonical_name,
                "receipt_sha256": hashlib.sha256(
                    canonical_path.read_bytes()
                ).hexdigest(),
                "node_count": graph_node_count,
                "link_count": graph_link_count,
                "materialized_endpoint_node_count": 0,
                "removed_prior_materialized_endpoint_node_count": 0,
            },
            "final_graph_smoke": {
                "status": "PASS",
                "receipt_name": smoke_name,
                "receipt_sha256": hashlib.sha256(
                    smoke_path.read_bytes()
                ).hexdigest(),
                "node_count": graph_node_count,
                "link_count": graph_link_count,
                "distinct_community_count": graph_community_count,
                "graph_sha256": graph_sha256,
            },
            "semantic_evidence": {
                "status": "NOT_RUN" if deterministic else "PASS",
                "schema_version": "1.0",
                "run_id": run_id,
                "source_property_schema_valid": not deterministic,
                "receipt_name": None,
                "sha256": None,
                "observed_wrapper_exit_code": None if deterministic else 0,
                "graphify_exit_code": None if deterministic else 0,
                "graphify_status": "NOT_RUN" if deterministic else "OK",
                "timed_out": False,
                "guardrail_failed": False,
                "orphan_risk": False,
                "temp_cleanup_status": "NOT_RUN" if deterministic else "REMOVED",
                "temp_cleanup_error": "",
            },
            "n5_post_mutation_scan": {
                "status": "NOT_REQUIRED" if deterministic else "PASS",
                "mutation_attempted": not deterministic,
                "exit_code": None if deterministic else 0,
                "error": "",
            },
            "n5_release": {
                "required": not deterministic,
                "status": "NOT_REQUIRED" if deterministic else "PASS",
                "selected_mode": None if deterministic else "COMPLETED_GREEN",
                "observed": None,
                "error": "",
                "GraphOrphanRisk": False,
            },
            "served_graph_sha256": graph_sha256,
            "required_ref": "INSTALLED_RUNTIME",
            "head_oid": self.head,
            "required_ref_oid": self.head,
            "build_stamp_oid": self.head,
            "terminal_process_custody": "PASS",
            "terminal_process_custody_evidence": custody,
            "autofollow_starting_head": self.head,
            "autofollow_fetched_oid": self.head,
            "autofollow_decision": "ALREADY_CURRENT",
            "autofollow_attempted": False,
            "autofollow_result": "PASS",
            "autofollow_final_head": self.head,
            "autofollow_rejection_reason": "",
        }
        if replacements:
            data.update(replacements)
        for key in remove:
            data.pop(key, None)
        path = receipt_dir / f"terminal-receipt-{filename_run_id}.json"
        path.write_text(json.dumps(data, separators=(",", ":")), encoding="ascii")
        self.proof_not_before = self.utc_z(start_aware - timedelta(minutes=1))
        return path

    def assert_custody_not_ready(self, **receipt_kwargs):
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt(**receipt_kwargs)
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")
        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def ready_phase(self, phase):
        self.write_contract(phase)
        if phase in ("ActiveAwaitingNatural", "Active0530Correlated"):
            self.write_active_transition()
        if phase in ("StagedManualProven", "Active0530Correlated"):
            self.write_terminal_receipt()
        result = self.run_preflight(contract="A", phase=phase)
        self.assert_fixture_non_activation(result)
        self.assertIn(f"PASS    scheduler-contract: contract A/{phase}", result.stdout)
        return result

    def test_legacy_ready_and_config_without_freshness(self):
        self.config.write_text(json.dumps({"serve_gate": {"remote": "origin", "branch": "main"}}), encoding="ascii")
        result = self.run_preflight()
        self.assert_fixture_non_activation(result)

    def test_phase_success_matrix(self):
        for phase in ("Disabled", "StagedAwaitingManual", "StagedManualProven", "Active0530Correlated"):
            with self.subTest(phase=phase):
                self.ready_phase(phase)
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_active_awaiting_natural_is_always_not_ready(self):
        self.write_contract("ActiveAwaitingNatural")
        self.write_active_transition()
        result = self.run_preflight(contract="A", phase="ActiveAwaitingNatural")
        self.assert_fixture_non_activation(result)

    def test_explicit_phase_required(self):
        self.write_contract("StagedAwaitingManual")
        self.assert_not_ready(self.run_preflight(contract="A", phase="Any"), "scheduler-contract")

    def test_phase_state_cross_product_rejects_wrong_task_or_trigger_state(self):
        expected = {
            "Disabled": ("false", "false"),
            "StagedAwaitingManual": ("true", "false"),
            "StagedManualProven": ("true", "false"),
            "ActiveAwaitingNatural": ("true", "true"),
            "Active0530Correlated": ("true", "true"),
        }
        for phase, (task_state, trigger_state) in expected.items():
            for needle, wrong in ((f"<Enabled>{task_state}</Enabled>", f"<Enabled>{'false' if task_state == 'true' else 'true'}</Enabled>"),):
                with self.subTest(phase=phase, field="task"):
                    self.write_contract(phase, replacements=((needle, wrong),))
                    if phase in ("ActiveAwaitingNatural", "Active0530Correlated"):
                        self.write_active_transition()
                    self.assert_not_ready(self.run_preflight(contract="A", phase=phase), "scheduler-contract")
            trigger_needle = f"<Enabled>{trigger_state}</Enabled><ScheduleByDay>"
            trigger_wrong = f"<Enabled>{'false' if trigger_state == 'true' else 'true'}</Enabled><ScheduleByDay>"
            with self.subTest(phase=phase, field="trigger"):
                self.write_contract(phase, replacements=((trigger_needle, trigger_wrong),))
                if phase in ("ActiveAwaitingNatural", "Active0530Correlated"):
                    self.write_active_transition()
                self.assert_not_ready(self.run_preflight(contract="A", phase=phase), "scheduler-contract")

    def test_registration_info_exact_metadata_and_cardinality(self):
        mutations = (
            (f"<Date>{REGISTRATION_DATE}</Date>", "<Date>2026-07-29T05:00:01</Date>"),
            (f"<Author>{EXPECTED_ACCOUNT}</Author>", "<Author>OTHER\\owner</Author>"),
            (f"<Description>{DESCRIPTION}</Description>", "<Description>wrong</Description>"),
            (r"<URI>\SSTAC-Wiki-Nightly</URI>", r"<URI>\Other</URI>"),
            (f"<Description>{DESCRIPTION}</Description>", f"<Description>{DESCRIPTION}</Description><Source>x</Source>"),
            (f"<Description>{DESCRIPTION}</Description>", f"<Description>{DESCRIPTION}</Description><Version>1.0</Version>"),
            (f"<Description>{DESCRIPTION}</Description>", f"<Description>{DESCRIPTION}</Description><SecurityDescriptor>D:P</SecurityDescriptor>"),
            (f"<Date>{REGISTRATION_DATE}</Date>", f"<Date>{REGISTRATION_DATE}</Date><Date>{REGISTRATION_DATE}</Date>"),
            (f"<Date>{REGISTRATION_DATE}</Date>", ""),
            (f"<Author>{EXPECTED_ACCOUNT}</Author>", ""),
            (f"<Description>{DESCRIPTION}</Description>", ""),
            (r"<URI>\SSTAC-Wiki-Nightly</URI>", ""),
        )
        for old, new in mutations:
            with self.subTest(new=new):
                self.write_contract("StagedAwaitingManual", replacements=((old, new),))
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedAwaitingManual"), "scheduler-contract")

    def test_verbose_field_cardinality_and_english_labels_fail_closed(self):
        self.write_contract("StagedManualProven")
        self.task.write_text(self.task.read_text(encoding="ascii") + "Last Result: 0\n", encoding="ascii")
        self.write_terminal_receipt()
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)
        self.write_contract("StagedManualProven")
        localized = self.task.read_text(encoding="ascii").replace("Last Run Time:", "Heure de la derniere execution:")
        self.task.write_text(localized, encoding="ascii")
        self.write_terminal_receipt()
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

    def test_exact_start_boundary_and_definition_action_identity(self):
        for boundary in ("2026-07-30T05:30:00Z", "2026-07-30T05:30:00.000", "2026-07-30T05:31:00"):
            with self.subTest(boundary=boundary):
                self.write_contract("StagedAwaitingManual", replacements=((self.start_boundary, boundary),))
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="StagedAwaitingManual", start_boundary=boundary),
                    "scheduler-contract",
                )
        self.write_contract("StagedAwaitingManual", definition_id=OTHER_DEFINITION_ID)
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedAwaitingManual", definition_id=DEFINITION_ID),
            "scheduler-contract",
        )
        self.write_contract("StagedAwaitingManual")
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedAwaitingManual", definition_id="not-a-guid"),
            "scheduler-contract",
        )

    def test_sid_equivalence_and_wrong_sid(self):
        self.write_contract("StagedAwaitingManual", user_id=EXPECTED_ACCOUNT)
        result = self.run_preflight(contract="A", phase="StagedAwaitingManual")
        self.assert_fixture_non_activation(result)
        self.write_contract("StagedAwaitingManual", user_id=self.expected_sid)
        result = self.run_preflight(contract="A", phase="StagedAwaitingManual")
        self.assert_fixture_non_activation(result)
        self.write_contract("StagedAwaitingManual", user_id="S-1-5-18")
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedAwaitingManual"), "scheduler-contract")

    def test_export_readback_normalizations_are_semantically_equal(self):
        omitted_defaults = (
            "RunLevel",
            "AllowHardTerminate",
            "AllowStartOnDemand",
            "Hidden",
            "RunOnlyIfIdle",
            "Priority",
            "Duration",
            "WaitTimeout",
            "RestartOnIdle",
        )
        cases = (
            {"user_id": self.expected_sid},
            {"prefixed": True, "user_id": self.expected_sid},
            {"utf16": True, "user_id": self.expected_sid},
            {"omit": omitted_defaults, "user_id": self.expected_sid},
        )
        for case in cases:
            with self.subTest(case=case):
                self.write_contract("StagedAwaitingManual", **case)
                result = self.run_preflight(contract="A", phase="StagedAwaitingManual")
                self.assert_fixture_non_activation(result)

    def test_structural_cardinality_and_executable_surfaces_fail_closed(self):
        mutations = (
            ("</Principals>", f'<Principal id="Other"><UserId>{EXPECTED_ACCOUNT}</UserId><LogonType>Password</LogonType></Principal></Principals>'),
            ("</Principals>", "</Principals><Principals></Principals>"),
            ("</CalendarTrigger>", f"</CalendarTrigger><CalendarTrigger><StartBoundary>{self.start_boundary}</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>"),
            ("</CalendarTrigger>", "</CalendarTrigger><TimeTrigger><StartBoundary>2026-07-29T06:00:00</StartBoundary></TimeTrigger>"),
            ("</Exec>", "</Exec><Exec><Command>cmd.exe</Command></Exec>"),
            ("</Exec>", "</Exec><ComHandler><ClassId>{00000000-0000-0000-0000-000000000000}</ClassId></ComHandler>"),
            ("</Actions>", "</Actions><Actions Context=\"Author\"><Exec><Command>cmd.exe</Command></Exec></Actions>"),
            ("</Task>", "<BootTrigger></BootTrigger></Task>"),
        )
        for old, new in mutations:
            with self.subTest(new=new):
                self.write_contract("StagedAwaitingManual", replacements=((old, new),))
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="StagedAwaitingManual"),
                    "scheduler-contract",
                )

    def test_task_version_and_all_contract_attributes_are_exact(self):
        mutations = (
            (' version="1.4"', ""),
            ('version="1.4"', 'version="1.3"'),
            ('version="1.4"', 'version="1.4" extra="x"'),
            ("<RegistrationInfo>", '<RegistrationInfo extra="x">'),
            ("<Principals>", '<Principals extra="x">'),
            ("<UserId>", '<UserId extra="x">'),
            ("<Settings>", '<Settings extra="x">'),
            ("<CalendarTrigger>", '<CalendarTrigger extra="x">'),
            ("<ScheduleByDay>", '<ScheduleByDay extra="x">'),
            ("<Exec>", '<Exec extra="x">'),
            ("<Command>", '<Command extra="x">'),
        )
        for old, new in mutations:
            with self.subTest(new=new):
                self.write_contract("StagedAwaitingManual", replacements=((old, new),))
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="StagedAwaitingManual"),
                    "scheduler-contract",
                )

    def test_frozen_scheduler_fields_fail_closed(self):
        mutations = (
            ("<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>", "<MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>"),
            ("<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>", "<DisallowStartIfOnBatteries>true</DisallowStartIfOnBatteries>"),
            ("<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>", "<StopIfGoingOnBatteries>true</StopIfGoingOnBatteries>"),
            ("<AllowHardTerminate>true</AllowHardTerminate>", "<AllowHardTerminate>false</AllowHardTerminate>"),
            ("<StartWhenAvailable>true</StartWhenAvailable>", "<StartWhenAvailable>false</StartWhenAvailable>"),
            ("<RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>", "<RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>"),
            ("<AllowStartOnDemand>true</AllowStartOnDemand>", "<AllowStartOnDemand>false</AllowStartOnDemand>"),
            ("<Hidden>false</Hidden>", "<Hidden>true</Hidden>"),
            ("<RunOnlyIfIdle>false</RunOnlyIfIdle>", "<RunOnlyIfIdle>true</RunOnlyIfIdle>"),
            ("<WakeToRun>true</WakeToRun>", "<WakeToRun>false</WakeToRun>"),
            ("<ExecutionTimeLimit>PT6H</ExecutionTimeLimit>", "<ExecutionTimeLimit>PT1H</ExecutionTimeLimit>"),
            ("<Priority>7</Priority>", "<Priority>6</Priority>"),
            ("<Duration>PT10M</Duration>", "<Duration>PT5M</Duration>"),
            ("<WaitTimeout>PT1H</WaitTimeout>", "<WaitTimeout>PT2H</WaitTimeout>"),
            ("<StopOnIdleEnd>false</StopOnIdleEnd>", "<StopOnIdleEnd>true</StopOnIdleEnd>"),
            ("<RestartOnIdle>false</RestartOnIdle>", "<RestartOnIdle>true</RestartOnIdle>"),
            ("</IdleSettings>", "</IdleSettings><RestartOnFailure><Interval>PT1M</Interval><Count>1</Count></RestartOnFailure>"),
            ("<LogonType>Password</LogonType>", "<LogonType>InteractiveToken</LogonType>"),
            ("<RunLevel>LeastPrivilege</RunLevel>", "<RunLevel>HighestAvailable</RunLevel>"),
            ('<Principal id="Author">', '<Principal id="Other">'),
            ('<Actions Context="Author">', '<Actions Context="Other">'),
            ("<DaysInterval>1</DaysInterval>", "<DaysInterval>2</DaysInterval>"),
        )
        for old, new in mutations:
            with self.subTest(old=old):
                self.write_contract("StagedAwaitingManual", replacements=((old, new),))
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedAwaitingManual"), "scheduler-contract")

    def test_exact_action_command_arguments_working_directory_and_no_autocommit(self):
        powershell = Path(os.environ["SystemRoot"]) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
        script = self.root / "tooling" / "wiki" / "nightly_wiki_sync.ps1"
        exact_args = (
            f'-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{script}" '
            f'-RepoRoot "{self.root}" -TaskDefinitionId "{DEFINITION_ID}"'
        )
        mutations = (
            (f"<Command>{powershell}</Command>", "<Command>powershell.exe</Command>"),
            (f"<Arguments>{exact_args}</Arguments>", f"<Arguments>{exact_args} -AutoCommit</Arguments>"),
            (f"<Arguments>{exact_args}</Arguments>", f"<Arguments>{exact_args} -SkipSemantic</Arguments>"),
            (f"<WorkingDirectory>{self.root}</WorkingDirectory>", "<WorkingDirectory>C:\\</WorkingDirectory>"),
        )
        for old, new in mutations:
            with self.subTest(new=new):
                self.write_contract("StagedAwaitingManual", replacements=((old, new),))
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="StagedAwaitingManual"),
                    "scheduler-contract",
                )

    def test_proof_requires_ready_zero_and_valid_last_run(self):
        cases = (
            ("Running", "0", None),
            ("Queued", "0", None),
            ("Unknown", "0", None),
            ("Ready", "1", None),
            ("Ready", "267011", None),
            ("Ready", "0", "N/A"),
            ("Ready", "0", "1999-11-30T00:00:00"),
        )
        for status, result_value, last_run in cases:
            with self.subTest(status=status, result=result_value, last_run=last_run):
                self.write_contract("StagedManualProven", status=status, last_result=result_value, last_run=last_run)
                receipt_start = self.last_run if isinstance(self.last_run, datetime) else datetime.now().replace(microsecond=0)
                self.write_terminal_receipt(start_local=receipt_start)
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

    def test_arbitrary_proof_file_never_qualifies(self):
        self.write_contract("StagedManualProven")
        receipt_dir = self.root / ".tmp_wiki_nightly"
        receipt_dir.mkdir()
        (receipt_dir / "proof.txt").write_text("SUCCESS\n", encoding="ascii")
        (receipt_dir / "receipt-2026-07-29.md").write_text("N1 Build: OK\n", encoding="ascii")
        self.assert_not_ready(
            self.run_preflight(
                contract="A",
                phase="StagedManualProven",
                proof_not_before=self.utc_z(datetime.now(timezone.utc) - timedelta(minutes=5)),
            ),
            "execution-proof",
        )

    def test_proof_missing_ambiguous_replayed_and_other_definition(self):
        self.write_contract("StagedManualProven")
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedManualProven", proof_not_before=self.utc_z(datetime.now(timezone.utc))),
            "execution-proof",
        )
        self.write_terminal_receipt()
        self.write_terminal_receipt()
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

        shutil.rmtree(self.root / ".tmp_wiki_nightly")
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt(definition_id=OTHER_DEFINITION_ID)
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

        shutil.rmtree(self.root / ".tmp_wiki_nightly")
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt()
        after = self.utc_z(datetime.now(timezone.utc) + timedelta(minutes=1))
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedManualProven", proof_not_before=after),
            "execution-proof",
        )

    def test_receipt_last_run_correlation_freshness_and_latest_definition(self):
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt(start_local=self.last_run + timedelta(minutes=5))
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

        shutil.rmtree(self.root / ".tmp_wiki_nightly")
        stale = datetime.now().replace(microsecond=0) - timedelta(hours=72)
        self.write_contract("StagedManualProven", last_run=stale)
        self.write_terminal_receipt(start_local=stale)
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

        shutil.rmtree(self.root / ".tmp_wiki_nightly")
        current = datetime.now().replace(microsecond=0) - timedelta(minutes=2)
        self.write_contract("StagedManualProven", last_run=current)
        self.write_terminal_receipt(start_local=current)
        self.write_terminal_receipt(start_local=current + timedelta(minutes=1))
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

    def test_receipt_last_run_tolerance_is_exactly_sixty_seconds(self):
        base = datetime.now().replace(microsecond=0) - timedelta(minutes=5)
        self.write_contract("StagedManualProven", last_run=base)
        self.write_terminal_receipt(start_local=base + timedelta(seconds=60))
        result = self.run_preflight(contract="A", phase="StagedManualProven")
        self.assert_fixture_non_activation(result)

        shutil.rmtree(self.root / ".tmp_wiki_nightly")
        self.write_contract("StagedManualProven", last_run=base)
        self.write_terminal_receipt(start_local=base + timedelta(seconds=61))
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

    def test_malformed_terminal_receipts_fail_closed(self):
        cases = (
            ("terminal-receipt-not-a-guid.json", "{}"),
            (f"terminal-receipt-{uuid.uuid4()}.json", "{not-json"),
        )
        for name, body in cases:
            with self.subTest(name=name):
                self.write_contract("StagedManualProven")
                receipt_dir = self.root / ".tmp_wiki_nightly"
                receipt_dir.mkdir(exist_ok=True)
                (receipt_dir / name).write_text(body, encoding="ascii")
                self.assert_not_ready(
                    self.run_preflight(
                        contract="A",
                        phase="StagedManualProven",
                        proof_not_before=self.utc_z(datetime.now(timezone.utc) - timedelta(minutes=5)),
                    ),
                    "execution-proof",
                )
                shutil.rmtree(receipt_dir, ignore_errors=True)

    def test_receipt_uuid_timestamp_and_duration_guards(self):
        bad_cases = (
            {"filename_run_id": str(uuid.uuid4())},
            {"run_id": str(uuid.uuid4()).upper()},
            {"replacements": {"started_at_utc": "not-a-time"}},
            {"replacements": {"started_at_utc": "2026-07-29T18:00:00.000000+00:00"}},
            {"replacements": {"started_at_utc": "2026-07-29T18:00:00"}},
            {"replacements": {"completed_at_utc": "not-a-time"}},
            {"replacements": {"completed_at_utc": "2026-07-29T18:00:30.000000+00:00"}},
            {"completed_delta": timedelta(seconds=-1)},
            {"completed_delta": timedelta(hours=7)},
            {"replacements": {"duration_seconds": 999}},
            {"replacements": {"duration_seconds": "NaN"}},
            {"replacements": {"duration_seconds": "Infinity"}},
            {"replacements": {"duration_seconds": "-Infinity"}},
            {"replacements": {"duration_seconds": -1}},
            {"replacements": {"completed_at_utc": self.utc_z(datetime.now(timezone.utc) + timedelta(hours=2))}},
        )
        for case in bad_cases:
            with self.subTest(case=case):
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt(**case)
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_receipt_terminal_and_runtime_binding_fields_fail_closed(self):
        bad = {
            "terminal_state": "FAILED",
            "native_exit_code": 1,
            "n0_orphan": "FAIL",
            "n1_build": "FAIL",
            "n2_cluster": "FAIL",
            "n5_semantic": "FAIL",
            "n6_wiki": "FAIL",
            "n6_publication": "SERVED_WIKI_KEPT_LAST_GOOD",
            "serve_gate": "FAIL",
            "required_ref": "refs/remotes/origin/other",
            "head_oid": "0" * 40,
            "required_ref_oid": "0" * 40,
            "build_stamp_oid": "0" * 40,
            "terminal_process_custody": "FAIL",
        }
        for field, value in bad.items():
            with self.subTest(field=field):
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt(replacements={field: value})
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_actual_wrapper_shaped_terminal_receipt_authenticates_installed_runtime(self):
        remote_only_head = subprocess.run(
            [
                "git",
                "-C",
                str(self.root),
                "commit-tree",
                f"{self.head}^{{tree}}",
                "-p",
                self.head,
                "-m",
                "remote-only",
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        subprocess.run(
            ["git", "-C", str(self.root), "update-ref", "refs/remotes/origin/main", remote_only_head],
            check=True,
            capture_output=True,
        )
        self.write_contract("StagedManualProven")
        receipt_path = self.write_terminal_receipt()
        receipt = json.loads(receipt_path.read_text(encoding="ascii"))
        self.assertEqual(receipt["required_ref"], "INSTALLED_RUNTIME")
        self.assertEqual(receipt["required_ref_oid"], receipt["head_oid"])
        self.assertEqual(receipt["build_stamp_oid"], receipt["head_oid"])
        result = self.run_preflight(contract="A", phase="StagedManualProven")
        self.assert_fixture_non_activation(result)
        self.assertIn("PASS    runtime-ref:", result.stdout)
        self.assertIn("PASS    execution-proof:", result.stdout)

    def test_receipt_schema_and_native_exit_presence_fail_closed(self):
        for field in ("schema_version", "native_exit_code"):
            with self.subTest(field=field):
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt(remove=(field,))
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_final_graph_evidence_is_hash_bound_and_fail_closed(self):
        cases = (
            {"final_canonicalization": {"status": "FAIL"}},
            {"final_graph_smoke": {"status": "FAIL"}},
            {
                "final_canonicalization": {
                    "status": "PASS",
                    "receipt_name": "arbitrary-proof.json",
                    "receipt_sha256": "0" * 64,
                    "node_count": 2,
                    "link_count": 2,
                    "materialized_endpoint_node_count": 0,
                    "removed_prior_materialized_endpoint_node_count": 0,
                }
            },
        )
        for replacements in cases:
            with self.subTest(replacements=replacements):
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt(replacements=replacements)
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="StagedManualProven"),
                    "execution-proof",
                )
                shutil.rmtree(
                    self.root / ".tmp_wiki_nightly", ignore_errors=True
                )

        self.write_contract("StagedManualProven")
        terminal = self.write_terminal_receipt()
        terminal_data = json.loads(terminal.read_text(encoding="ascii"))
        evidence_path = terminal.parent / terminal_data["final_graph_smoke"][
            "receipt_name"
        ]
        evidence_path.unlink()
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedManualProven"),
            "execution-proof",
        )
        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

        self.write_contract("StagedManualProven")
        terminal = self.write_terminal_receipt()
        terminal_data = json.loads(terminal.read_text(encoding="ascii"))
        evidence_path = terminal.parent / terminal_data["final_canonicalization"][
            "receipt_name"
        ]
        evidence_path.write_text("{}", encoding="ascii")
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedManualProven"),
            "execution-proof",
        )
        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

        self.write_contract("StagedManualProven")
        terminal = self.write_terminal_receipt()
        terminal_data = json.loads(terminal.read_text(encoding="ascii"))
        smoke_path = terminal.parent / terminal_data["final_graph_smoke"][
            "receipt_name"
        ]
        smoke_data = json.loads(smoke_path.read_text(encoding="ascii"))
        smoke_data["hard_abort"] = True
        smoke_path.write_text(
            json.dumps(smoke_data, sort_keys=True), encoding="ascii"
        )
        terminal_data["final_graph_smoke"]["receipt_sha256"] = hashlib.sha256(
            smoke_path.read_bytes()
        ).hexdigest()
        terminal.write_text(
            json.dumps(terminal_data, sort_keys=True), encoding="ascii"
        )
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedManualProven"),
            "execution-proof",
        )
        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_final_graph_evidence_requires_numeric_bounded_counts(self):
        for field in ("node_count", "link_count"):
            with self.subTest(field=field):
                self.write_contract("StagedManualProven")
                terminal = self.write_terminal_receipt()
                terminal_data = json.loads(terminal.read_text(encoding="ascii"))
                terminal_data["final_canonicalization"][field] = "2"
                terminal.write_text(
                    json.dumps(terminal_data, sort_keys=True), encoding="ascii"
                )
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="StagedManualProven"),
                    "execution-proof",
                )
                shutil.rmtree(
                    self.root / ".tmp_wiki_nightly", ignore_errors=True
                )

    def test_served_graph_change_after_smoke_receipt_fails_closed(self):
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt()
        graph = json.loads(self.graph_path.read_text(encoding="ascii"))
        graph["post_smoke_mutation"] = True
        self.graph_path.write_text(
            json.dumps(graph, sort_keys=True), encoding="ascii"
        )
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedManualProven"),
            "execution-proof",
        )

    def test_terminal_and_smoke_graph_hash_mismatches_fail_closed(self):
        self.write_contract("StagedManualProven")
        terminal = self.write_terminal_receipt()
        data = json.loads(terminal.read_text(encoding="ascii"))
        data["served_graph_sha256"] = "0" * 64
        terminal.write_text(json.dumps(data, sort_keys=True), encoding="ascii")
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedManualProven"),
            "execution-proof",
        )
        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

        self.write_contract("StagedManualProven")
        terminal = self.write_terminal_receipt()
        data = json.loads(terminal.read_text(encoding="ascii"))
        smoke_path = terminal.parent / data["final_graph_smoke"]["receipt_name"]
        smoke = json.loads(smoke_path.read_text(encoding="ascii"))
        smoke["graph_sha256"] = "f" * 64
        smoke_path.write_text(json.dumps(smoke, sort_keys=True), encoding="ascii")
        data["final_graph_smoke"]["receipt_sha256"] = hashlib.sha256(
            smoke_path.read_bytes()
        ).hexdigest()
        terminal.write_text(json.dumps(data, sort_keys=True), encoding="ascii")
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedManualProven"),
            "execution-proof",
        )
    def test_receipt_schema_and_native_exit_values_fail_closed(self):
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt(replacements={"schema_version": "2.0"})
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")
        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt(replacements={"native_exit_code": "not-a-number"})
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")
        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)
        for value in ("0", False, 0.0):
            with self.subTest(native_exit_code=value):
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt(replacements={"native_exit_code": value})
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_terminal_receipt_schema_order_and_count(self):
        preflight_content = SCRIPT.read_text(encoding="ascii")
        expected_top_match = re.search(r"\$expectedTop\s*=\s*@\((.*?)\)", preflight_content, re.DOTALL)
        self.assertIsNotNone(expected_top_match, "Could not find $expectedTop definition in activation_preflight.ps1")
        expected_order = re.findall(r"['\"]([a-z0-9_]+)['\"]", expected_top_match.group(1))

        wrapper_path = SCRIPT.parent / "nightly_wiki_sync.ps1"
        wrapper_content = wrapper_path.read_text(encoding="ascii")
        receipt_match = re.search(r"\$terminalReceipt\s*=\s*\[pscustomobject\]\[ordered\]@\{(.*?)\}", wrapper_content, re.DOTALL)
        self.assertIsNotNone(receipt_match, "Could not find $terminalReceipt definition in nightly_wiki_sync.ps1")
        fields = re.findall(r"^\s*([a-z0-9_]+)\s*=", receipt_match.group(1), re.MULTILINE)

        self.assertEqual(len(fields), len(expected_order), f"Expected {len(expected_order)} fields, got {len(fields)}")
        self.assertEqual(fields, expected_order)

    def test_every_load_bearing_receipt_field_is_required(self):
        fields = (
            "run_id",
            "task_definition_id",
            "started_at_utc",
            "completed_at_utc",
            "duration_seconds",
            "terminal_state",
            "n0_orphan",
            "n1_build",
            "n2_cluster",
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
        )
        for field in fields:
            with self.subTest(field=field):
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt(remove=(field,))
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_terminal_custody_scalar_bindings_booleans_and_integers_fail_closed(self):
        scalar_cases = {
            "schema_version": "2.0",
            "evidence_type": "OTHER",
            "result": "FAIL",
            "baseline_result": "FAIL",
            "run_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "runtime_root": str(self.root) + "-other",
            "baseline_captured_at_utc": "not-a-time",
            "evaluated_at_utc": "2026-07-30T00:00:00Z",
            "expected_baseline_sha256": "x" * 64,
            "observed_baseline_sha256": "f" * 64,
            "enumeration_succeeded": False,
            "classification_succeeded": 1,
            "run_parent_identity_match": "true",
            "checker_parent_match": False,
            "identity_overflow": "false",
            "identity_cap": 15,
            "baseline_relevant_count": "1",
            "terminal_relevant_count": True,
            "allowed_preexisting_graphify_count": 1.0,
            "survivor_count": 1,
            "departed_baseline_count": -1,
            "baseline_identity_set_sha256": "0" * 64,
            "terminal_identity_set_sha256": "0" * 64,
        }
        for field, value in scalar_cases.items():
            with self.subTest(field=field, value=value):
                self.assert_custody_not_ready(custody_replacements={field: value})

    def test_terminal_custody_identity_and_subset_adversaries_fail_closed(self):
        def wrong_parent_name(custody):
            custody["run_parent_identity"]["name"] = "node.exe"

        def wrong_checker_parent(custody):
            custody["checker_identity"]["parent_process_id"] = 999

        def wrong_parent_flag(custody):
            custody["run_parent_identity"]["runtime_reference"] = True

        def wrong_graph_class(custody):
            custody["baseline_relevant_identities"][0]["process_class"] = "OTHER"

        def wrong_graph_flag(custody):
            custody["terminal_relevant_identities"][0]["runtime_reference"] = False

        def raw_process_surface(custody):
            custody["terminal_relevant_identities"][0]["command_line"] = "python secret.py"

        def future_identity(custody):
            custody["terminal_relevant_identities"][0]["creation_utc"] = "2999-01-01T00:00:00Z"

        def survivor(custody):
            custody["survivor_count"] = 1
            custody["survivor_identities"] = [dict(custody["terminal_relevant_identities"][0])]

        def pid_reuse(custody):
            reused = custody["terminal_relevant_identities"][0]
            reused["creation_utc"] = "2026-07-30T00:00:00Z"
            reused["identity_sha256"] = "d" * 64
            custody["terminal_identity_set_sha256"] = self.custody_set_hash([reused])

        for mutator in (
            wrong_parent_name,
            wrong_checker_parent,
            wrong_parent_flag,
            wrong_graph_class,
            wrong_graph_flag,
            raw_process_surface,
            future_identity,
            survivor,
            pid_reuse,
        ):
            with self.subTest(mutator=mutator.__name__):
                self.assert_custody_not_ready(custody_mutator=mutator)

    def test_every_terminal_custody_field_is_required(self):
        fields = (
            "schema_version",
            "evidence_type",
            "run_id",
            "baseline_captured_at_utc",
            "evaluated_at_utc",
            "result",
            "baseline_result",
            "enumeration_succeeded",
            "classification_succeeded",
            "expected_baseline_sha256",
            "observed_baseline_sha256",
            "runtime_root",
            "run_parent_pid",
            "run_parent_identity_match",
            "run_parent_identity",
            "checker_parent_match",
            "checker_identity",
            "identity_cap",
            "identity_overflow",
            "baseline_relevant_count",
            "terminal_relevant_count",
            "allowed_preexisting_graphify_count",
            "survivor_count",
            "departed_baseline_count",
            "baseline_identity_set_sha256",
            "terminal_identity_set_sha256",
            "baseline_relevant_identities",
            "terminal_relevant_identities",
            "survivor_identities",
            "departed_baseline_identities",
        )
        for field in fields:
            with self.subTest(field=field):
                self.assert_custody_not_ready(custody_remove=(field,))

    def test_active_transition_is_required_for_both_active_phases(self):
        for phase in ("ActiveAwaitingNatural", "Active0530Correlated"):
            with self.subTest(phase=phase):
                self.write_contract(phase)
                if phase == "Active0530Correlated":
                    self.write_terminal_receipt()
                self.assert_evidence_mode_failure(
                    self.run_preflight(contract="A", phase=phase),
                    "one complete pair",
                )
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_active_transition_fields_identity_and_hash_fail_closed(self):
        wrong_start_boundary = (
            datetime.strptime(self.start_boundary, "%Y-%m-%dT%H:%M:%S")
            + timedelta(days=1)
        ).strftime("%Y-%m-%dT%H:%M:%S")
        invalid_cases = (
            {"remove": ("schema_version",)},
            {"remove": ("terminal_state",)},
            {"remove": ("task_name",)},
            {"remove": ("prior_staged_task_definition_id",)},
            {"remove": ("active_task_definition_id",)},
            {"remove": ("registration_date",)},
            {"remove": ("start_boundary",)},
            {"remove": ("activated_at_utc",)},
            {"replacements": {"schema_version": "2.0"}},
            {"replacements": {"terminal_state": "SUCCESS"}},
            {"replacements": {"task_name": r"\Other"}},
            {"replacements": {"prior_staged_task_definition_id": ZERO_DEFINITION_ID}},
            {"replacements": {"prior_staged_task_definition_id": OTHER_DEFINITION_ID.upper()}},
            {"replacements": {"active_task_definition_id": OTHER_DEFINITION_ID}},
            {"prior_definition_id": DEFINITION_ID, "active_definition_id": DEFINITION_ID},
            {"replacements": {"active_task_definition_id": ZERO_DEFINITION_ID}},
            {"replacements": {"registration_date": "2026-07-29T05:00:01"}},
            {"replacements": {"start_boundary": wrong_start_boundary}},
            {"replacements": {"activated_at_utc": "not-a-time"}},
            {"replacements": {"activated_at_utc": "2026-07-29T18:00:00+00:00"}},
            {"replacements": {"activated_at_utc": "2026-07-29T18:00:00"}},
            {"replacements": {"activated_at_utc": self.utc_z(datetime.now(timezone.utc) + timedelta(minutes=5))}},
            {"extra": {"unexpected": "x"}},
        )
        for case in invalid_cases:
            with self.subTest(case=case):
                self.write_contract("ActiveAwaitingNatural")
                self.write_active_transition(**case)
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="ActiveAwaitingNatural"),
                    "active-transition",
                )

        self.write_contract("ActiveAwaitingNatural")
        self.write_active_transition(raw="{not-json")
        self.assert_not_ready(self.run_preflight(contract="A", phase="ActiveAwaitingNatural"), "active-transition")

        self.write_contract("ActiveAwaitingNatural")
        self.write_active_transition(filename="active-transition.txt")
        self.assert_not_ready(self.run_preflight(contract="A", phase="ActiveAwaitingNatural"), "active-transition")

        self.write_contract("ActiveAwaitingNatural")
        self.write_active_transition()
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="ActiveAwaitingNatural", active_transition_sha256="0" * 64),
            "active-transition",
        )
        self.assert_evidence_mode_failure(
            self.run_preflight(contract="A", phase="ActiveAwaitingNatural", active_transition_sha256=""),
            "one complete pair",
        )

    def test_active_transition_exact_date_tokens_are_cross_edition_stable(self):
        self.write_contract("ActiveAwaitingNatural")
        self.write_active_transition()
        result = self.run_preflight(contract="A", phase="ActiveAwaitingNatural")
        self.assert_fixture_non_activation(result)
        self.assertIn("PASS    active-transition:", result.stdout)

        altered_values = (
            {"registration_date": REGISTRATION_DATE + ".000"},
            {"start_boundary": self.start_boundary + ".000"},
        )
        for replacements in altered_values:
            with self.subTest(replacements=replacements):
                self.write_active_transition(replacements=replacements)
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="ActiveAwaitingNatural"),
                    "active-transition",
                )

    def test_most_recent_completed_local_0530_before_and_after_reference_inputs(self):
        cases = (
            (datetime(2026, 7, 30, 5, 29, 59), datetime(2026, 7, 29, 5, 30, 0)),
            (datetime(2026, 7, 30, 5, 30, 59), datetime(2026, 7, 29, 5, 30, 0)),
            (datetime(2026, 7, 30, 5, 31, 0), datetime(2026, 7, 30, 5, 30, 0)),
            (datetime(2026, 7, 30, 12, 0, 0), datetime(2026, 7, 30, 5, 30, 0)),
        )
        for reference, expected in cases:
            with self.subTest(reference=reference):
                anchor = most_recent_completed_local_0530(reference)
                self.assertEqual(anchor, expected)
                self.assertLessEqual(anchor + ACTIVE_COMPLETION_MARGIN, reference)
                self.assertEqual(anchor.strftime("%H:%M:%S"), "05:30:00")

        self.assertLessEqual(
            self.active_run_local + ACTIVE_COMPLETION_MARGIN,
            self.fixture_reference,
        )
        self.assertEqual(
            self.start_boundary,
            self.active_run_local.strftime("%Y-%m-%dT05:30:00"),
        )

    def test_active_0530_correlation_rejects_wrong_time_and_wrong_definition_receipt(self):
        wrong_time = self.active_run_local - timedelta(hours=12)
        wrong_boundary = wrong_time.replace(hour=5, minute=30).strftime("%Y-%m-%dT05:30:00")
        self.write_contract(
            "Active0530Correlated",
            last_run=wrong_time,
            replacements=((self.start_boundary, wrong_boundary),),
        )
        self.write_active_transition(
            activated_local=wrong_time - timedelta(minutes=5),
            replacements={"start_boundary": wrong_boundary},
        )
        self.write_terminal_receipt(start_local=wrong_time)
        self.assert_not_ready(
            self.run_preflight(
                contract="A",
                phase="Active0530Correlated",
                start_boundary=wrong_boundary,
            ),
            "execution-proof",
        )

        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)
        correlated = self.active_run_local
        self.write_contract("Active0530Correlated", definition_id=DEFINITION_ID, last_run=correlated)
        self.write_active_transition(activated_local=correlated - timedelta(minutes=5))
        self.write_terminal_receipt(definition_id=OTHER_DEFINITION_ID)
        self.assert_not_ready(self.run_preflight(contract="A", phase="Active0530Correlated"), "execution-proof")

    def test_manual_run_at_exact_0530_reaches_only_downgraded_external_gate(self):
        manual = self.active_run_local
        self.write_contract("Active0530Correlated", last_run=manual)
        self.write_active_transition(activated_local=manual - timedelta(minutes=5))
        self.write_terminal_receipt(start_local=manual)
        result = self.run_preflight(contract="A", phase="Active0530Correlated")
        self.assert_fixture_non_activation(result)
        self.assertIn("PASS    execution-proof:", result.stdout)
        self.assertNotIn("UNATTENDED_PROVEN", result.stdout)

    def test_active_0530_receipt_must_follow_transition_and_proof_cutoff(self):
        correlated = self.active_run_local
        self.write_contract("Active0530Correlated", last_run=correlated)
        self.write_active_transition(activated_local=correlated)
        self.write_terminal_receipt(start_local=correlated)
        self.assert_not_ready(self.run_preflight(contract="A", phase="Active0530Correlated"), "execution-proof")

        shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)
        self.write_contract("Active0530Correlated", last_run=correlated)
        self.write_active_transition(activated_local=correlated - timedelta(minutes=5))
        self.write_terminal_receipt(start_local=correlated)
        self.proof_not_before = self.utc_z(correlated.astimezone())
        self.assert_not_ready(self.run_preflight(contract="A", phase="Active0530Correlated"), "execution-proof")

    def test_staged_manual_proven_accepts_non_0530_manual_time(self):
        manual = self.active_run_local - timedelta(minutes=17)
        self.write_contract("StagedManualProven", last_run=manual)
        self.write_terminal_receipt(start_local=manual)
        result = self.run_preflight(contract="A", phase="StagedManualProven")
        self.assert_fixture_non_activation(result)

    def test_active_0530_correlation_requires_receipt_after_exact_boundary(self):
        boundary = (self.active_run_local + timedelta(days=1)).strftime("%Y-%m-%dT05:30:00")
        correlated = self.active_run_local
        self.write_contract("Active0530Correlated", last_run=correlated, replacements=((self.start_boundary, boundary),))
        self.write_active_transition(activated_local=correlated - timedelta(minutes=5), replacements={"start_boundary": boundary})
        self.write_terminal_receipt(start_local=correlated)
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="Active0530Correlated", start_boundary=boundary),
            "execution-proof",
        )

    def test_proven_graph_invariants(self):
        cases = (
            ([{"id": "n1", "community": 1}, {"id": "n1", "community": 2}], [{"source": "n1", "target": "n1"}]),
            ([{"id": "n1", "community": 1}], [{"source": "n1", "target": "missing"}]),
            ([{"id": "n1"}, {"id": "n2", "community": 2}], [{"source": "n1", "target": "n2"}]),
            ([{"id": "n1", "community": "x"}, {"id": "n2", "community": 2}], [{"source": "n1", "target": "n2"}]),
            ([{"id": "n1", "community": "1"}, {"id": "n2", "community": 2}], [{"source": "n1", "target": "n2"}]),
            ([{"id": "n1", "community": 1.0}, {"id": "n2", "community": 2}], [{"source": "n1", "target": "n2"}]),
            ([{"id": "n1", "community": True}, {"id": "n2", "community": 2}], [{"source": "n1", "target": "n2"}]),
            ([{"id": "n1", "community": -1}, {"id": "n2", "community": 2}], [{"source": "n1", "target": "n2"}]),
        )
        for nodes, links in cases:
            with self.subTest(nodes=nodes, links=links):
                self.write_graph(nodes, links)
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt()
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "served-graph")
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_canonical_hyperedge_is_accepted_and_counts_as_connected(self):
        self.write_graph(
            [
                {"id": "n1", "community": 0},
                {"id": "n2", "community": 1},
                {"id": "hyper-only", "community": 0},
            ],
            [{"source": "n1", "target": "n2"}],
            [{"id": "h1", "nodes": ["n1", "hyper-only"]}],
        )
        result = self.ready_phase("StagedManualProven")
        self.assertIn("0 isolated node(s) retained", result.stdout)

    def test_hyperedge_shapes_members_and_runtime_ids_fail_closed(self):
        runtime_member = str(self.root) + r"\src\bad.ts"
        cases = (
            {"id": "h1", "members": ["n1"]},
            {"id": "h1", "node_ids": ["n1"]},
            {"id": "h1", "nodes": []},
            {"id": "h1", "nodes": ["n1", "missing"]},
            {"id": "h1", "nodes": ["n1", runtime_member]},
            "not-an-object",
        )
        for hyperedge in cases:
            with self.subTest(hyperedge=hyperedge):
                self.write_graph(
                    [
                        {"id": "n1", "community": 0},
                        {"id": "n2", "community": 1},
                    ],
                    [{"source": "n1", "target": "n2"}],
                    [hyperedge],
                )
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt()
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="StagedManualProven"),
                    "served-graph",
                )
                shutil.rmtree(
                    self.root / ".tmp_wiki_nightly", ignore_errors=True
                )

    def test_runtime_root_derived_node_and_endpoint_ids_fail(self):
        for path_text in (str(self.root), str(self.root).replace("\\", "/").upper()):
            with self.subTest(path=path_text):
                self.write_graph(
                    [{"id": path_text + "/n1", "community": 1}, {"id": "n2", "community": 2}],
                    [{"source": path_text + "/n1", "target": "n2"}, {"source": "n2", "target": path_text + "/n1"}],
                )
                self.write_contract("StagedManualProven")
                self.write_terminal_receipt()
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "served-graph")
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)


    def test_declared_isolated_nodes_are_allowed(self):
        self.write_graph(
            [
                {"id": "n1", "community": 0},
                {"id": "n2", "community": 1},
                {"id": "isolated", "community": 0},
            ],
            [{"source": "n1", "target": "n2"}],
        )
        self.ready_phase("StagedManualProven")

    def test_all_scheduler_phases_reject_slugged_runtime_ids(self):
        root_slug = re.sub(
            r"[^a-z0-9]+", "_", str(self.root).casefold()
        ).strip("_")
        bad_id = root_slug + "_src_bad_ts"
        for phase in (
            "Disabled",
            "StagedAwaitingManual",
            "StagedManualProven",
            "ActiveAwaitingNatural",
            "Active0530Correlated",
        ):
            with self.subTest(phase=phase):
                self.write_graph(
                    [
                        {"id": bad_id, "community": 0},
                        {"id": "n2", "community": 1},
                    ],
                    [
                        {"source": bad_id, "target": "n2"},
                        {"source": "n2", "target": bad_id},
                    ],
                )
                self.write_contract(phase)
                if phase in ("StagedManualProven", "Active0530Correlated"):
                    self.write_terminal_receipt()
                if phase in ("ActiveAwaitingNatural", "Active0530Correlated"):
                    self.write_active_transition()
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase=phase),
                    "served-graph",
                )
                shutil.rmtree(
                    self.root / ".tmp_wiki_nightly", ignore_errors=True
                )

    def test_runtime_root_marker_near_miss_does_not_false_positive(self):
        near_miss = str(self.root) + "-copy"
        self.write_graph(
            [{"id": near_miss, "community": 0}, {"id": "n2", "community": 1}],
            [
                {"source": near_miss, "target": "n2"},
                {"source": "n2", "target": near_miss},
            ],
        )
        self.ready_phase("StagedManualProven")

    def test_deterministic_phase_allows_all_communities_absent(self):
        self.write_graph(
            [{"id": "n1"}, {"id": "n2"}],
            [
                {"source": "n1", "target": "n2"},
                {"source": "n2", "target": "n1"},
            ],
        )
        self.ready_phase("StagedAwaitingManual")

    def test_deterministic_phase_rejects_partial_communities(self):
        self.write_graph(
            [{"id": "n1", "community": 0}, {"id": "n2"}],
            [
                {"source": "n1", "target": "n2"},
                {"source": "n2", "target": "n1"},
            ],
        )
        self.write_contract("StagedAwaitingManual")
        self.assert_not_ready(
            self.run_preflight(contract="A", phase="StagedAwaitingManual"),
            "served-graph",
        )

    def test_zero_is_a_valid_community_label_when_communities_are_populated(self):
        self.write_graph(
            [{"id": "n1", "community": 0}, {"id": "n2", "community": 1}],
            [{"source": "n1", "target": "n2"}, {"source": "n2", "target": "n1"}],
        )
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt()
        result = self.run_preflight(contract="A", phase="StagedManualProven")
        self.assert_fixture_non_activation(result)

    def test_contract_a_build_stamp_exactness_and_legacy_compatibility(self):
        for content in (
            f"HEAD: {self.head}\nHEAD: {self.head}\n",
            f"prefix HEAD: {self.head}\n",
            f"HEAD:{self.head}\n",
            f"HEAD: {self.head.upper()}\n",
        ):
            with self.subTest(content=content):
                self.stamp_path.write_text(content, encoding="ascii")
                self.write_contract("StagedAwaitingManual")
                self.assert_not_ready(self.run_preflight(contract="A", phase="StagedAwaitingManual"), "build-stamp")
        self.stamp_path.write_text(f"legacy prefix {self.head} suffix\n", encoding="ascii")
        self.task.write_text("ERROR: The system cannot find the file specified.", encoding="ascii")
        result = self.run_preflight()
        self.assert_fixture_non_activation(result)

    def test_contract_a_requires_freshness_config(self):
        self.config.write_text(json.dumps({"serve_gate": {"remote": "origin", "branch": "main"}}), encoding="ascii")
        self.write_contract("StagedAwaitingManual")
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedAwaitingManual"), "serve-config")

    def test_contract_a_requires_finite_positive_freshness(self):
        for value in ("NaN", "Infinity", "-Infinity", 0, -1):
            with self.subTest(value=value):
                self.config.write_text(
                    json.dumps({"freshness_max_age_hours": value, "serve_gate": {"remote": "origin", "branch": "main"}}),
                    encoding="ascii",
                )
                self.write_contract("StagedAwaitingManual")
                self.assert_not_ready(
                    self.run_preflight(contract="A", phase="StagedAwaitingManual"),
                    "serve-config",
                )

    def test_legacy_no_id_receipt_is_informational_not_contract_a_proof(self):
        self.write_contract("StagedManualProven")
        self.write_terminal_receipt(definition_id=ZERO_DEFINITION_ID)
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedManualProven"), "execution-proof")

        self.config.write_text(json.dumps({"serve_gate": {"remote": "origin", "branch": "main"}}), encoding="ascii")
        self.task.write_text("ERROR: The system cannot find the file specified.", encoding="ascii")
        result = self.run_preflight(contract="Legacy", phase="Any")
        self.assert_fixture_non_activation(result)

    def test_mcp_binding_and_core_guards_are_preserved(self):
        python = self.root / ".venv-graphify" / "Scripts" / "python.exe"
        graph = self.root / "wiki" / ".graph" / "graph.json"
        self.mcp.write_text(f"Command: {python}\nArgs: -m graphify.serve {graph} --transport stdio", encoding="ascii")
        result = self.run_preflight()
        self.assert_fixture_non_activation(result)
        (self.root / "seed.txt").write_text("dirty\n", encoding="ascii")
        self.assert_not_ready(self.run_preflight(), "tracked-tree")

    def test_parameter_identities_reject_recased_values_before_any_result(self):
        cases = (
            {"evidence_mode": "live"},
            {"evidence_mode": "fixture"},
            {"contract": "legacy"},
            {"contract": "a"},
            {"contract": "d"},
            {"phase": "any"},
            {"phase": "stagedAwaitingManual"},
            {"phase": "stagedmanualproven"},
            {"phase": "activeAwaitingNatural"},
            {"phase": "active0530correlated"},
            {"phase": "disabled"},
        )
        for arguments in cases:
            with self.subTest(arguments=arguments):
                result = self.run_preflight(**arguments)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(
                    [line for line in result.stdout.splitlines() if line.startswith("RESULT ")],
                    [],
                    result.stdout + result.stderr,
                )
                self.assertIn("case-sensitive", result.stderr)
                self.assertNotIn("runtime-root", result.stdout)

    def test_live_default_and_every_fixture_override_fail_before_surface_use(self):
        text = SCRIPT.read_text(encoding="ascii")
        self.assertRegex(text, r"\[string\]\$EvidenceMode = 'Live'")
        overrides = (
            ("ConfigPath", self.config),
            ("TaskQueryOutputPath", self.task),
            ("TaskXmlOutputPath", self.task_xml),
            ("McpStatusOutputPath", self.mcp),
            ("GraphifyVersionOverride", "0.9.17"),
            ("StandingBlockEvidencePath", self.standing_block),
            ("ActiveLockEvidencePath", self.active_lock),
        )
        for name, value in overrides:
            with self.subTest(name=name):
                result = self.run_preflight(
                    version=None,
                    evidence_mode="Live",
                    include_fixture_tuple=False,
                    extra_args=(f"-{name}", str(value)),
                )
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("FAIL    evidence-mode:", result.stdout)
                self.assertEqual(
                    [line for line in result.stdout.splitlines() if line.startswith("RESULT ")],
                    ["RESULT NOT_READY"],
                )
                self.assertNotIn("runtime-root", result.stdout)

    def test_fixture_tuple_is_complete_and_rejects_missing_escape_ads_and_reparse(self):
        complete = self.run_preflight()
        self.assert_fixture_non_activation(complete)
        self.assertIn("PASS    evidence-mode: Fixture tuple is complete and contained", complete.stdout)
        for name in (
            "TaskQueryOutputPath",
            "TaskXmlOutputPath",
            "McpStatusOutputPath",
            "GraphifyVersionOverride",
            "StandingBlockEvidencePath",
            "ActiveLockEvidencePath",
        ):
            with self.subTest(missing=name):
                result = self.run_preflight(omit_fixture_fields=(name,))
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("FAIL    evidence-mode:", result.stdout)
                self.assertIn("RESULT NOT_READY", result.stdout)

        original = self.standing_block
        try:
            self.standing_block = EVIDENCE_ROOT.parent / "escape-standing-block.md"
            escaped = self.run_preflight()
            self.assertIn("FAIL    evidence-mode:", escaped.stdout)
            self.assertIn("escapes evidence root", escaped.stdout)

            self.standing_block = self.control_fixture / "standing-block.md:ads"
            ads = self.run_preflight()
            self.assertIn("FAIL    evidence-mode:", ads.stdout)
            self.assertIn("alternate data stream", ads.stdout)

            target = self.control_fixture / "junction-target"
            target.mkdir()
            junction = self.control_fixture / "junction"
            create = subprocess.run(
                [
                    POWERSHELL,
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    f"New-Item -ItemType Junction -Path '{junction}' -Target '{target}' -ErrorAction Stop | Out-Null",
                ],
                capture_output=True,
                text=True,
                check=False,
                env=fixture_environment(),
            )
            self.assertEqual(create.returncode, 0, create.stdout + create.stderr)
            try:
                self.standing_block = junction / "standing-block.md"
                reparse = self.run_preflight()
                self.assertIn("FAIL    evidence-mode:", reparse.stdout)
                self.assertIn("reparse point", reparse.stdout)
            finally:
                os.rmdir(junction)
        finally:
            self.standing_block = original


    def test_fixture_transition_pair_and_raw_containment_fail_closed(self):
        self.write_contract("ActiveAwaitingNatural")
        valid_path = self.write_active_transition()
        valid_hash = self.active_transition_sha256

        saved_path, saved_hash = self.active_transition_path, self.active_transition_sha256
        try:
            self.active_transition_sha256 = None
            self.assert_evidence_mode_failure(
                self.run_preflight(contract="A", phase="ActiveAwaitingNatural"),
                "one complete pair",
            )
            self.active_transition_path = None
            self.active_transition_sha256 = saved_hash
            self.assert_evidence_mode_failure(
                self.run_preflight(contract="A", phase="ActiveAwaitingNatural"),
                "one complete pair",
            )
        finally:
            self.active_transition_path, self.active_transition_sha256 = saved_path, saved_hash

        for phase in ("Disabled", "StagedAwaitingManual", "StagedManualProven"):
            with self.subTest(non_active_path=phase):
                self.write_contract(phase)
                saved_hash = self.active_transition_sha256
                self.active_transition_sha256 = None
                try:
                    self.assert_evidence_mode_failure(
                        self.run_preflight(contract="A", phase=phase),
                        "non-active phases reject",
                    )
                finally:
                    self.active_transition_sha256 = saved_hash
            with self.subTest(non_active_hash=phase):
                saved_path = self.active_transition_path
                self.active_transition_path = None
                try:
                    self.assert_evidence_mode_failure(
                        self.run_preflight(contract="A", phase=phase),
                        "non-active phases reject",
                    )
                finally:
                    self.active_transition_path = saved_path

        saved_path, saved_hash = self.active_transition_path, self.active_transition_sha256
        self.active_transition_path = None
        self.active_transition_sha256 = None
        try:
            for name in ("ActiveTransitionReceiptPath", "ExpectedActiveTransitionReceiptSha256"):
                with self.subTest(non_active_empty=name):
                    self.assert_evidence_mode_failure(
                        self.run_preflight(
                            contract="A",
                            phase="Disabled",
                            extra_args=(f"-{name}", ""),
                        ),
                        "non-active phases reject",
                    )
        finally:
            self.active_transition_path, self.active_transition_sha256 = saved_path, saved_hash

        escaped = EVIDENCE_ROOT / f"escaped-transition-{uuid.uuid4().hex}.json"
        escaped.write_bytes(valid_path.read_bytes())
        try:
            self.assert_evidence_mode_failure(
                self.run_preflight(
                    contract="A",
                    phase="ActiveAwaitingNatural",
                    active_transition_path=escaped,
                    active_transition_sha256=valid_hash,
                ),
                "escapes evidence root",
            )
        finally:
            escaped.unlink()

        self.assert_evidence_mode_failure(
            self.run_preflight(
                contract="A",
                phase="ActiveAwaitingNatural",
                active_transition_path=str(valid_path) + ":ads",
                active_transition_sha256=valid_hash,
            ),
            "alternate data stream",
        )

    def test_fixture_transition_and_optional_leaf_reparse_boundaries(self):
        self.write_contract("ActiveAwaitingNatural")
        valid_path = self.write_active_transition()
        valid_hash = self.active_transition_sha256
        target_dir = self.root / "transition-leaf-target"
        target_dir.mkdir()
        leaf_link = self.root / "transition-leaf-link.json"
        create_leaf = subprocess.run(
            [
                POWERSHELL,
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                f"New-Item -ItemType Junction -Path '{leaf_link}' -Target '{target_dir}' -ErrorAction Stop | Out-Null",
            ],
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        )
        if create_leaf.returncode != 0:
            self.skipTest("junction leaf fixture unavailable: " + create_leaf.stderr.strip())
        try:
            self.assert_evidence_mode_failure(
                self.run_preflight(
                    contract="A",
                    phase="ActiveAwaitingNatural",
                    active_transition_path=leaf_link,
                    active_transition_sha256=valid_hash,
                ),
                "reparse point",
            )
        finally:
            os.rmdir(leaf_link)

        outside = EVIDENCE_ROOT / f"transition-outside-{uuid.uuid4().hex}"
        outside.mkdir()
        outside_receipt = outside / "receipt.json"
        outside_receipt.write_bytes(valid_path.read_bytes())
        junction = self.root / "transition-junction"
        create_junction = subprocess.run(
            [
                POWERSHELL,
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                f"New-Item -ItemType Junction -Path '{junction}' -Target '{outside}' -ErrorAction Stop | Out-Null",
            ],
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        )
        if create_junction.returncode != 0:
            shutil.rmtree(outside)
            self.skipTest("junction fixture unavailable: " + create_junction.stderr.strip())
        try:
            self.assert_evidence_mode_failure(
                self.run_preflight(
                    contract="A",
                    phase="ActiveAwaitingNatural",
                    active_transition_path=junction / "receipt.json",
                    active_transition_sha256=valid_hash,
                ),
                "reparse point",
            )
        finally:
            os.rmdir(junction)
            shutil.rmtree(outside)

        self.active_transition_path = None
        self.active_transition_sha256 = None
        self.standing_block.write_text("ordinary\n", encoding="ascii")
        try:
            ordinary = self.run_preflight()
            self.assert_fixture_non_activation(ordinary)
            self.assertIn("PASS    terminal-path-evidence:", ordinary.stdout)
        finally:
            self.standing_block.unlink()

        optional_target = self.control_fixture / "optional-target"
        optional_target.mkdir()
        create_optional = subprocess.run(
            [
                POWERSHELL,
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                f"New-Item -ItemType Junction -Path '{self.standing_block}' -Target '{optional_target}' -ErrorAction Stop | Out-Null",
            ],
            capture_output=True,
            text=True,
            check=False,
            env=fixture_environment(),
        )
        if create_optional.returncode != 0:
            self.skipTest("optional junction fixture unavailable: " + create_optional.stderr.strip())
        try:
            self.assert_evidence_mode_failure(self.run_preflight(), "reparse point")
        finally:
            os.rmdir(self.standing_block)

    def test_terminal_exact_path_reobservation_rejects_state_changes_and_errors(self):
        cases = (
            ("same_false", "$false", "$false", True, "PASS", False),
            ("false_to_true", "$false", "$true", False, "PASS", True),
            ("true_to_false", "$true", "$false", False, "PASS", False),
            ("second_error", "$false", "'ERROR'", False, "ERROR", None),
        )
        for name, initial, fresh, expected_valid, expected_status, expected_present in cases:
            with self.subTest(name=name):
                body = (
                    f"$script:sequence=@({initial},{fresh});"
                    "function Test-Path { param($LiteralPath,$ErrorAction,$ErrorVariable) "
                    "$next=$script:sequence[0];$script:sequence=@($script:sequence|Select-Object -Skip 1);"
                    "if($next -is [string]){Write-Error -ErrorAction Continue 'forced second observation error';return};"
                    "return $next };"
                    "$initial=Get-ExactPathEvidence -LiteralPath 'C:\\tmp\\fixture-terminal-evidence';"
                    "$initialJson=$initial|ConvertTo-Json -Compress -Depth 4;"
                    "$initialHash=Get-PreflightTextSha256 $initialJson;"
                    "$binding=Get-FreshExactPathEvidenceBinding 'C:\\tmp\\fixture-terminal-evidence' $initial $initialJson $initialHash;"
                    "[pscustomobject]@{binding_valid=$binding.binding_valid;envelope_valid=$binding.envelope_valid;status=$binding.evidence.status;present=$binding.evidence.present;error=$binding.evidence.error}|ConvertTo-Json -Compress"
                )
                result = self.run_preflight_function_probe(body)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                data = json.loads(result.stdout.splitlines()[-1])
                self.assertIs(data["binding_valid"], expected_valid)
                self.assertTrue(data["envelope_valid"])
                self.assertEqual(data["status"], expected_status)
                self.assertIs(data["present"], expected_present)
                if expected_status == "ERROR":
                    self.assertTrue(data["error"])

    def test_exact_path_helper_rejects_all_malformed_success_streams(self):
        cases = {
            "true": ("return $true", "PASS", True),
            "false": ("return $false", "PASS", False),
            "terminating": ("throw 'forced terminating error'", "ERROR", None),
            "nonterminating_no_value": ("Write-Error -ErrorAction Continue 'forced nonterminating error'; return", "ERROR", None),
            "wrong_type": ("return 'true'", "ERROR", None),
            "multiple": ("$true; $false", "ERROR", None),
            "incidental": ("'noise'; $true", "ERROR", None),
        }
        for name, (behavior, status, present) in cases.items():
            with self.subTest(name=name):
                body = (
                    "function Test-Path { param($LiteralPath,$ErrorAction,$ErrorVariable) "
                    + behavior
                    + " };"
                    "$e=Get-ExactPathEvidence -LiteralPath 'C:\\tmp\\fixture-evidence';"
                    "$j=$e|ConvertTo-Json -Compress -Depth 4;"
                    "$h=Get-PreflightTextSha256 $j;"
                    "$valid=Test-ExactPathEvidence $e 'C:\\tmp\\fixture-evidence' $j $h;"
                    "[pscustomobject]@{evidence=$e;valid=$valid}|ConvertTo-Json -Compress -Depth 6"
                )
                result = self.run_preflight_function_probe(body)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                data = json.loads(result.stdout.splitlines()[-1])
                self.assertTrue(data["valid"])
                self.assertEqual(data["evidence"]["status"], status)
                self.assertIs(data["evidence"]["present"], present)
                if status == "ERROR":
                    self.assertTrue(data["evidence"]["error"])

    def test_exact_path_validator_rejects_array_null_extra_reordered_and_changed_bytes(self):
        body = (
            "$good=[pscustomobject][ordered]@{schema_version='1.0';evidence_type='EXACT_PATH_PRESENCE';path='C:\\tmp\\x';status='PASS';present=$false;error=$null};"
            "$json=$good|ConvertTo-Json -Compress;$sha=Get-PreflightTextSha256 $json;"
            "$extra=[pscustomobject][ordered]@{schema_version='1.0';evidence_type='EXACT_PATH_PRESENCE';path='C:\\tmp\\x';status='PASS';present=$false;error=$null;extra=1};"
            "$reordered=[pscustomobject][ordered]@{evidence_type='EXACT_PATH_PRESENCE';schema_version='1.0';path='C:\\tmp\\x';status='PASS';present=$false;error=$null};"
            "@((Test-ExactPathEvidence @($good,$good) 'C:\\tmp\\x' $json $sha),(Test-ExactPathEvidence $null 'C:\\tmp\\x' $json $sha),(Test-ExactPathEvidence $extra 'C:\\tmp\\x' $json $sha),(Test-ExactPathEvidence $reordered 'C:\\tmp\\x' $json $sha),(Test-ExactPathEvidence $good 'C:\\tmp\\x' ($json+' ') $sha))|ConvertTo-Json -Compress"
        )
        result = self.run_preflight_function_probe(body)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout.splitlines()[-1]), [False] * 5)

    def test_contract_d_phase_matrix_and_exact_fixture_terminal(self):
        for phase in ("Disabled", "StagedAwaitingManual", "StagedManualProven", "ActiveAwaitingNatural", "Active0530Correlated"):
            with self.subTest(phase=phase):
                self.write_contract(phase, contract="D")
                if phase in ("ActiveAwaitingNatural", "Active0530Correlated"):
                    self.write_active_transition()
                if phase in ("StagedManualProven", "Active0530Correlated"):
                    self.write_terminal_receipt(contract="D")
                result = self.run_preflight(contract="D", phase=phase)
                self.assert_fixture_non_activation(result)
                self.assertIn(f"PASS    scheduler-contract: contract D/{phase}", result.stdout)
                if phase in ("StagedManualProven", "Active0530Correlated"):
                    self.assertIn("PASS    execution-proof:", result.stdout)
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_contract_d_action_mutations_and_contract_cross_use_fail_closed(self):
        exact = self.task_xml_text("StagedAwaitingManual", contract="D")
        marker = " -SkipLabeling -SkipSemantic</Arguments>"
        self.assertIn(marker, exact)
        mutations = (
            "</Arguments>",
            " -SkipLabeling</Arguments>",
            " -SkipSemantic</Arguments>",
            " -SkipLabeling -SkipSemantic -SkipSemantic</Arguments>",
            " -SkipSemantic -SkipLabeling</Arguments>",
            " -SkipLabeling -SkipSemantic -Extra</Arguments>",
            " -skiplabeling -SkipSemantic</Arguments>",
            " -SkipLabeling -SkipSemantic -AutoCommit</Arguments>",
        )
        for replacement in mutations:
            with self.subTest(replacement=replacement):
                self.write_contract("StagedAwaitingManual", contract="D", replacements=((marker, replacement),))
                self.assert_not_ready(self.run_preflight(contract="D", phase="StagedAwaitingManual"), "scheduler-contract")

        self.write_contract("StagedAwaitingManual", contract="A")
        self.assert_not_ready(self.run_preflight(contract="D", phase="StagedAwaitingManual"), "scheduler-contract")
        self.write_contract("StagedAwaitingManual", contract="D")
        self.assert_not_ready(self.run_preflight(contract="A", phase="StagedAwaitingManual"), "scheduler-contract")

    def test_contract_d_d8_type_value_and_contradiction_matrix_fails_closed(self):
        cases = (
            {"n5_mode": "LABEL_ONLY"},
            {"n5_skip_labeling": "true"},
            {"n5_skip_semantic": False},
            {"n5_run_label": True},
            {"n5_run_semantic": True},
            {"n5_lock_expiry_minutes": "0"},
            {"n5_mutation_attempted": True},
            {"semantic_execution_attempted": True},
            {"n5_release_required": True},
            {"n5_semantic": "OK"},
            {"n5_post_mutation_scan": {"status": "PASS", "mutation_attempted": False, "exit_code": 0, "error": ""}},
            {"n5_release": {"required": False, "status": "PASS", "selected_mode": None, "observed": None, "error": "", "GraphOrphanRisk": False}},
        )
        for replacement in cases:
            with self.subTest(replacement=replacement):
                self.write_contract("StagedManualProven", contract="D")
                self.write_terminal_receipt(contract="D", replacements=replacement)
                self.assert_not_ready(self.run_preflight(contract="D", phase="StagedManualProven"), "execution-proof")
                shutil.rmtree(self.root / ".tmp_wiki_nightly", ignore_errors=True)

    def test_contract_d_freshness_fail_closed(self):
        cases = (
            ("missing", object()),
            ("null", None),
            ("nan", float("nan")),
            ("positive_infinity", float("inf")),
            ("negative_infinity", float("-inf")),
            ("zero", 0),
            ("negative", -1),
            ("string", "48"),
            ("boolean", True),
            ("array", [48]),
            ("object", {"value": 48}),
        )
        for name, value in cases:
            with self.subTest(name=name):
                config = {"serve_gate": {"remote": "origin", "branch": "main"}}
                if name != "missing":
                    config["freshness_max_age_hours"] = value
                self.config.write_text(
                    json.dumps(config, separators=(",", ":")),
                    encoding="ascii",
                )
                self.write_contract("StagedAwaitingManual", contract="D")
                result = self.run_preflight(
                    contract="D", phase="StagedAwaitingManual"
                )
                self.assert_not_ready(result, "serve-config")
                self.assertNotIn("PASS    serve-config:", result.stdout)

        self.config.write_text(
            json.dumps(
                {
                    "freshness_max_age_hours": 24.5,
                    "serve_gate": {"remote": "origin", "branch": "main"},
                },
                separators=(",", ":"),
            ),
            encoding="ascii",
        )
        self.write_contract("StagedAwaitingManual", contract="D")
        valid = self.run_preflight(contract="D", phase="StagedAwaitingManual")
        self.assert_fixture_non_activation(valid)
        self.assertIn("PASS    serve-config:", valid.stdout)
        self.assertIn(
            "PASS    scheduler-contract: contract D/StagedAwaitingManual",
            valid.stdout,
        )

    def test_contract_d_build_stamp_is_canonical(self):
        def write_stamp_bytes(content):
            payload = content.encode("ascii")
            self.stamp_path.write_bytes(payload)
            self.assertEqual(payload, self.stamp_path.read_bytes())

        other_oid = "0" * 40
        malformed = (
            f"HEAD: {self.head} suffix\n",
            f"prefix HEAD: {self.head}\n",
            f"HEAD: {self.head}\nHEAD: {self.head}\n",
            f"HEAD:{self.head}\n",
            f"HEAD:  {self.head}\n",
            f"HEAD: {self.head.upper()}\n",
            f"Head: {self.head}\n",
            f"HEAD: {other_oid}\n",
        )
        composite_siblings = (
            f"prefix HEAD: {other_oid}",
            f"HEAD: {other_oid} suffix",
            f"HEAD:{self.head}",
            f"Head: {self.head}",
            f"HEAD: {self.head.upper()}",
            f"HEAD: {other_oid}",
        )
        canonical_line = f"HEAD: {self.head}"
        newline_siblings = composite_siblings[:2]
        newline_composites = []
        for separator in ("\r\n", "\r"):
            for sibling in newline_siblings:
                newline_composites.extend(
                    (
                        separator.join((canonical_line, sibling)) + separator,
                        separator.join((sibling, canonical_line)) + separator,
                    )
                )
        for sibling in (
            f"metadata\rprefix HEAD: {other_oid}",
            f"metadata\rHEAD: {other_oid} suffix",
        ):
            newline_composites.extend(
                (
                    canonical_line + "\n" + sibling + "\n",
                    sibling + "\n" + canonical_line + "\n",
                )
            )
        for sibling in newline_siblings:
            newline_composites.extend(
                (
                    canonical_line + "\n" + sibling + "\r\r\n",
                    sibling + "\r\r\n" + canonical_line + "\n",
                )
            )
        newline_composites.extend(
            (
                canonical_line + "\r\n" + newline_siblings[0] + "\r",
                newline_siblings[0] + "\r" + canonical_line + "\r\n",
            )
        )
        for contract in ("A", "D"):
            for content in malformed:
                with self.subTest(contract=contract, content=content):
                    write_stamp_bytes(content)
                    self.write_contract(
                        "StagedAwaitingManual", contract=contract
                    )
                    self.assert_not_ready(
                        self.run_preflight(
                            contract=contract,
                            phase="StagedAwaitingManual",
                        ),
                        "build-stamp",
                    )

            for sibling in composite_siblings:
                for lines in (
                    (canonical_line, sibling),
                    (sibling, canonical_line),
                ):
                    content = "\n".join(lines) + "\n"
                    with self.subTest(
                        contract=contract, composite=content
                    ):
                        write_stamp_bytes(content)
                        self.write_contract(
                            "StagedAwaitingManual", contract=contract
                        )
                        self.assert_not_ready(
                            self.run_preflight(
                                contract=contract,
                                phase="StagedAwaitingManual",
                            ),
                            "build-stamp",
                        )

            for content in newline_composites:
                with self.subTest(contract=contract, newline_content=content):
                    write_stamp_bytes(content)
                    self.write_contract(
                        "StagedAwaitingManual", contract=contract
                    )
                    self.assert_not_ready(
                        self.run_preflight(
                            contract=contract,
                            phase="StagedAwaitingManual",
                        ),
                        "build-stamp",
                    )

            for separator in ("\n", "\r\n"):
                write_stamp_bytes(
                    separator.join(("Build Stamp: fixture", canonical_line))
                    + separator
                )
                self.write_contract(
                    "StagedAwaitingManual", contract=contract
                )
                canonical = self.run_preflight(
                    contract=contract, phase="StagedAwaitingManual"
                )
                self.assert_fixture_non_activation(canonical)
                self.assertIn("PASS    build-stamp:", canonical.stdout)

        write_stamp_bytes(f"legacy prefix {self.head} suffix\n")
        self.task.write_text(
            "ERROR: The system cannot find the file specified.", encoding="ascii"
        )
        legacy = self.run_preflight(contract="Legacy", phase="Any")
        self.assert_fixture_non_activation(legacy)
        self.assertIn("PASS    build-stamp: matches HEAD", legacy.stdout)

    def test_contract_d_proven_graph_recomputes_communities(self):
        self.write_graph(
            [{"id": "n1"}, {"id": "n2"}],
            [
                {"source": "n1", "target": "n2"},
                {"source": "n2", "target": "n1"},
            ],
        )
        self.write_contract("StagedManualProven", contract="D")
        terminal_path = self.write_terminal_receipt(contract="D")
        terminal = json.loads(terminal_path.read_text(encoding="ascii"))
        smoke_path = (
            terminal_path.parent
            / terminal["final_graph_smoke"]["receipt_name"]
        )
        smoke = json.loads(smoke_path.read_text(encoding="ascii"))
        smoke["community_contract"]["populated_node_count"] = 2
        smoke["community_contract"]["distinct_community_count"] = 1
        smoke_path.write_text(
            json.dumps(smoke, separators=(",", ":")), encoding="ascii"
        )
        terminal["final_graph_smoke"]["distinct_community_count"] = 1
        terminal["final_graph_smoke"]["receipt_sha256"] = hashlib.sha256(
            smoke_path.read_bytes()
        ).hexdigest()
        terminal_path.write_text(
            json.dumps(terminal, separators=(",", ":")), encoding="ascii"
        )
        missing = self.run_preflight(
            contract="D", phase="StagedManualProven"
        )
        self.assert_not_ready(missing, "served-graph")
        self.assertIn(
            "proven manual/nightly graph requires every node community",
            missing.stdout,
        )

        shutil.rmtree(self.root / ".tmp_wiki_nightly")
        self.write_graph(
            [
                {"id": "n1", "community": 0},
                {"id": "n2", "community": 1},
            ],
            [
                {"source": "n1", "target": "n2"},
                {"source": "n2", "target": "n1"},
            ],
        )
        self.write_contract("StagedManualProven", contract="D")
        self.write_terminal_receipt(contract="D")
        populated = self.run_preflight(
            contract="D", phase="StagedManualProven"
        )
        self.assert_fixture_non_activation(populated)
        self.assertIn("PASS    served-graph:", populated.stdout)
        self.assertIn("PASS    execution-proof:", populated.stdout)

    def test_terminal_json_duplicate_safe_exact_schema(self):
        for contract in ("A", "D"):
            with self.subTest(canonical=contract):
                self.write_contract("StagedManualProven", contract=contract)
                self.write_terminal_receipt(contract=contract)
                canonical = self.run_preflight(
                    contract=contract, phase="StagedManualProven"
                )
                self.assert_fixture_non_activation(canonical)
                self.assertIn("PASS    execution-proof:", canonical.stdout)
                shutil.rmtree(self.root / ".tmp_wiki_nightly")

        mutations = (
            (
                "duplicate_mode_wrong_then_expected",
                lambda raw: raw.replace(
                    '"n5_mode":"SKIP_ALL"',
                    '"n5_mode":"LABEL_ONLY","n5_mode":"SKIP_ALL"',
                    1,
                ),
            ),
            (
                "duplicate_mode_expected_then_wrong",
                lambda raw: raw.replace(
                    '"n5_mode":"SKIP_ALL"',
                    '"n5_mode":"SKIP_ALL","n5_mode":"LABEL_ONLY"',
                    1,
                ),
            ),
            (
                "duplicate_release_required",
                lambda raw: raw.replace(
                    '"n5_release":{"required":false,',
                    '"n5_release":{"required":true,"required":false,',
                    1,
                ),
            ),
            (
                "extra_ollama_top_level",
                lambda raw: raw[:-1] + ',"ollama_invoked":true}',
            ),
            (
                "extra_scan_field",
                lambda raw: raw.replace(
                    '"n5_post_mutation_scan":{"status":"NOT_REQUIRED","mutation_attempted":false,"exit_code":null,"error":""}',
                    '"n5_post_mutation_scan":{"status":"NOT_REQUIRED","mutation_attempted":false,"exit_code":null,"error":"","gpu_used":false}',
                    1,
                ),
            ),
            (
                "extra_release_field",
                lambda raw: raw.replace(
                    '"n5_release":{"required":false,"status":"NOT_REQUIRED","selected_mode":null,"observed":null,"error":"","GraphOrphanRisk":false}',
                    '"n5_release":{"required":false,"status":"NOT_REQUIRED","selected_mode":null,"observed":null,"error":"","GraphOrphanRisk":false,"lock_touched":false}',
                    1,
                ),
            ),
            (
                "reordered_top_level",
                lambda raw: re.sub(
                    r'^\{"schema_version":"1\.0","run_id":"([^"]+)",',
                    r'{"run_id":"\1","schema_version":"1.0",',
                    raw,
                    count=1,
                ),
            ),
            (
                "unknown_top_level",
                lambda raw: raw[:-1] + ',"unknown_terminal_field":null}',
            ),
            (
                "missing_d_decision",
                lambda raw: raw.replace('"n5_skip_semantic":true,', "", 1),
            ),
        )
        for name, mutate in mutations:
            with self.subTest(name=name):
                self.write_contract("StagedManualProven", contract="D")
                terminal_path = self.write_terminal_receipt(contract="D")
                raw = terminal_path.read_text(encoding="ascii")
                changed = mutate(raw)
                self.assertNotEqual(changed, raw)
                terminal_path.write_text(changed, encoding="ascii")
                rejected = self.run_preflight(
                    contract="D", phase="StagedManualProven"
                )
                self.assert_not_ready(rejected, "execution-proof")
                self.assertIn("raw terminal schema invalid", rejected.stdout)
                shutil.rmtree(self.root / ".tmp_wiki_nightly")

    def test_fixture_containment_covers_ancestors_and_derived_paths(self):
        self.write_contract("StagedAwaitingManual", contract="D")
        ordinary = self.run_preflight(
            contract="D", phase="StagedAwaitingManual"
        )
        self.assert_fixture_non_activation(ordinary)
        self.assertIn("PASS    evidence-mode:", ordinary.stdout)
        self.assertIn("PASS    receipt-containment:", ordinary.stdout)

        ancestor_target = EVIDENCE_ROOT / f"ancestor-target-{uuid.uuid4().hex}"
        ancestor_target.mkdir()
        (ancestor_target / "evidence").mkdir()
        ancestor_junction = EVIDENCE_ROOT / f"ancestor-junction-{uuid.uuid4().hex}"
        self.make_junction(ancestor_junction, ancestor_target)
        try:
            environment = fixture_environment()
            environment["SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT"] = str(
                ancestor_junction / "evidence"
            )
            rejected = self.run_preflight(
                contract="D",
                phase="StagedAwaitingManual",
                environment=environment,
            )
            self.assert_evidence_mode_failure(
                rejected, "ancestor is not an ordinary directory"
            )
        finally:
            os.rmdir(ancestor_junction)
            shutil.rmtree(ancestor_target)

        wiki_path = self.root / "wiki"
        wiki_target = self.root / "wiki-contained-target"
        wiki_path.rename(wiki_target)
        wiki_sentinel = wiki_target / "junction-sentinel.txt"
        wiki_sentinel.write_text("unchanged\n", encoding="ascii")
        self.make_junction(wiki_path, wiki_target)
        try:
            rejected = self.run_preflight(
                contract="D", phase="StagedAwaitingManual"
            )
            self.assert_not_ready(rejected, "served-graph")
            self.assertIn("reparse point", rejected.stdout)
            self.assertEqual(
                wiki_sentinel.read_text(encoding="ascii"), "unchanged\n"
            )
        finally:
            os.rmdir(wiki_path)
            wiki_target.rename(wiki_path)

        for leaf_name, leaf_path, check_name in (
            ("graph", self.graph_path, "served-graph"),
            ("stamp", self.stamp_path, "build-stamp"),
        ):
            with self.subTest(leaf=leaf_name):
                backup = leaf_path.with_name(leaf_path.name + ".ordinary")
                target = self.root / f"{leaf_name}-leaf-target"
                target.mkdir()
                sentinel = target / "sentinel.txt"
                sentinel.write_text("unchanged\n", encoding="ascii")
                leaf_path.rename(backup)
                self.make_junction(leaf_path, target)
                try:
                    rejected = self.run_preflight(
                        contract="D", phase="StagedAwaitingManual"
                    )
                    self.assert_not_ready(rejected, check_name)
                    self.assertIn("reparse point", rejected.stdout)
                    self.assertEqual(
                        sentinel.read_text(encoding="ascii"), "unchanged\n"
                    )
                finally:
                    os.rmdir(leaf_path)
                    backup.rename(leaf_path)
                    shutil.rmtree(target)

        self.write_contract("StagedManualProven", contract="D")
        self.write_terminal_receipt(contract="D")
        receipt_path = self.root / ".tmp_wiki_nightly"
        receipt_target = self.root / "receipt-directory-target"
        receipt_path.rename(receipt_target)
        receipt_sentinel = receipt_target / "sentinel.txt"
        receipt_sentinel.write_text("unchanged\n", encoding="ascii")
        self.make_junction(receipt_path, receipt_target)
        try:
            rejected = self.run_preflight(
                contract="D", phase="StagedManualProven"
            )
            self.assert_not_ready(rejected, "receipt-containment")
            self.assertIn("reparse point", rejected.stdout)
            self.assertEqual(
                receipt_sentinel.read_text(encoding="ascii"), "unchanged\n"
            )
        finally:
            os.rmdir(receipt_path)
            receipt_sentinel.unlink()
            receipt_target.rename(receipt_path)
            shutil.rmtree(receipt_path)

        for receipt_kind in ("terminal", "canonical", "smoke"):
            with self.subTest(receipt_kind=receipt_kind):
                self.write_contract("StagedManualProven", contract="D")
                terminal_path = self.write_terminal_receipt(contract="D")
                terminal = json.loads(terminal_path.read_text(encoding="ascii"))
                if receipt_kind == "terminal":
                    derived_path = terminal_path
                elif receipt_kind == "canonical":
                    derived_path = (
                        terminal_path.parent
                        / terminal["final_canonicalization"]["receipt_name"]
                    )
                else:
                    derived_path = (
                        terminal_path.parent
                        / terminal["final_graph_smoke"]["receipt_name"]
                    )
                backup = derived_path.with_name(derived_path.name + ".ordinary")
                target = self.root / f"{receipt_kind}-receipt-target"
                target.mkdir()
                sentinel = target / "sentinel.txt"
                sentinel.write_text("unchanged\n", encoding="ascii")
                derived_path.rename(backup)
                self.make_junction(derived_path, target)
                try:
                    rejected = self.run_preflight(
                        contract="D", phase="StagedManualProven"
                    )
                    self.assert_not_ready(rejected, "execution-proof")
                    self.assertIn("reparse point", rejected.stdout)
                    self.assertEqual(
                        sentinel.read_text(encoding="ascii"), "unchanged\n"
                    )
                finally:
                    os.rmdir(derived_path)
                    backup.rename(derived_path)
                    shutil.rmtree(target)
                    shutil.rmtree(self.root / ".tmp_wiki_nightly")

        self.assertFalse(ancestor_junction.exists())
        self.assertFalse((self.root / "wiki-contained-target").exists())
        self.assertFalse((self.root / "receipt-directory-target").exists())

    def test_production_terminal_classifier_preserves_a_and_adds_d_pairs(self):
        expected = {
            "A/Disabled": ("READY_FOR_REPLACEMENT_REVIEW", 0),
            "A/StagedAwaitingManual": ("READY_FOR_MANUAL_RUN_REVIEW", 0),
            "A/StagedManualProven": ("READY_FOR_TRIGGER_ENABLE_REVIEW", 0),
            "A/ActiveAwaitingNatural": ("NOT_READY_AWAITING_NATURAL_RUN", 1),
            "A/Active0530Correlated": ("READY_FOR_OWNER_NATURAL_PROVENANCE_MCP_AND_LOGGED_OUT_GATES", 0),
            "D/Disabled": ("READY_FOR_DETERMINISTIC_REPLACEMENT_REVIEW", 0),
            "D/StagedAwaitingManual": ("READY_FOR_DETERMINISTIC_MANUAL_RUN_REVIEW", 0),
            "D/StagedManualProven": ("READY_FOR_DETERMINISTIC_TRIGGER_ENABLE_REVIEW", 0),
            "D/ActiveAwaitingNatural": ("NOT_READY_DETERMINISTIC_AWAITING_NATURAL_RUN", 1),
            "D/Active0530Correlated": ("READY_FOR_OWNER_DETERMINISTIC_NATURAL_PROVENANCE_REVIEW", 0),
        }
        body = (
            "$rows=@();foreach($contract in @('A','D')){foreach($phase in @('Disabled','StagedAwaitingManual','StagedManualProven','ActiveAwaitingNatural','Active0530Correlated')){$c=Get-SchedulerTerminalClassification $contract $phase;$rows+=($contract+'/'+$phase+'|'+$c.result+'|'+$c.exit_code)}};$rows|ConvertTo-Json -Compress"
        )
        result = self.run_preflight_function_probe(body)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        rows = json.loads(result.stdout.splitlines()[-1])
        observed = {}
        for row in rows:
            key, terminal, exit_code = row.split("|")
            observed[key] = (terminal, int(exit_code))
        self.assertEqual(observed, expected)

    def test_source_remains_read_only_and_fixture_driven(self):
        text = SCRIPT.read_text(encoding="ascii")
        self.assertIn("TaskQueryOutputPath", text)
        self.assertIn("TaskXmlOutputPath", text)
        self.assertNotRegex(text, r"(?i)\bschtasks(?:\.exe)?\s+/(?:Create|Change|Delete|Run|End)\b")
        self.assertNotIn("Register-ScheduledTask", text)
        self.assertNotIn("Set-ScheduledTask", text)
        self.assertNotIn("Start-ScheduledTask", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
