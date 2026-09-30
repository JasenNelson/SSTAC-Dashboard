"""Deterministic, model-free lifecycle tests for the wiki_graph session helper.

Every case drives ``wiki_graph_session``: it freshly prepares and validates a session config under a
disposable temp root, then launches the real read-only adapter using ONLY the argv the helper
returns from that validated config. No test bypasses the helper, no model or provider is involved,
and the only files written are inside one fresh test-owned temporary directory.

Run as ``<python-3.11> -I -B tooling/wiki/tests/test_wiki_graph_session.py``. The runner prints
exactly one ``WIKI_GRAPH_SESSION_SUMMARY`` JSON line and exits nonzero on any failure, error, skip,
zero-test run, missing/duplicate/out-of-order case, or unmet invariant. The Windows junction case is
mandatory: it is never skipped and creation failure is an error.
"""

import contextlib
import hashlib
import importlib.util
import io
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
FIXTURES = ROOT / "tests" / "fixtures"
CASES_PATH = FIXTURES / "wiki_graph_product_cases_v1.json"
SUMMARY_PREFIX = "WIKI_GRAPH_SESSION_SUMMARY "
SCHEMA_VERSION = "wiki-graph-session-lifecycle-summary-v3"

LOCAL_PYTHON = r"C:\Users\jasen\AppData\Local\Programs\Python\Python311\python.exe"
LOCAL_PYTHON_SHA256 = "5F7B89A612C9B8AF1D6456CDFCD1DBE5CA630849E79AEBCED9BEE9A6694952EC"
OID = "0123456789abcdef0123456789abcdef01234567"
ALT_OID = "fedcba9876543210fedcba9876543210fedcba98"
CONFIG_NAME = "mcp-config.json"
SIDECAR_NAME = "mcp-config.json.sha256"

# Literal, independent copies of the invariant product pins (never derived from the helper).
PINS = {
    "core_sha256": "DAF9CB00F3257418E5E50540880877F301C68DA22FF058EFF6C6B2CF65D547BE",
    "adapter_sha256": "40D57E589C81F2A0EBECB1CF0E915275D3DB45DB3B9252B95A7060FAC3C4DFA5",
    "synthetic_fixture_sha256": "BD1A2EFEC3EE741617AAC853E5F0ED0160CE1F0FAF625F0E1E6B6B4D4BE535D8",
    "cases_fixture_sha256": "615C2BD4C893500D1F42C2A3AEB4E576008D347F81A27D446B66D4BF1BD3CE21",
}
PIN_PATHS = {
    "core_sha256": ROOT / "wiki_graph_core.py",
    "adapter_sha256": ROOT / "wiki_graph_mcp.py",
    "synthetic_fixture_sha256": FIXTURES / "wiki_graph_synthetic_v1.json",
    "cases_fixture_sha256": CASES_PATH,
}

# The fixed, ordered case table. A literal: never derived from the helper, discovery, or a fixture.
REQUIRED_CASES = (
    ("CONFIG-ONLY-WIKI-GRAPH", "ok"),
    ("CONFIG-UNUSABLE-REJECTED", "rejected_before_spawn"),
    ("CREATE-NEW-ALLOWLIST", "ok"),
    ("PATH-ESCAPE-REPARSE", "refused"),
    ("IDENTITY-PINS", "ok"),
    ("FIXTURE-HASH-OID", "refused"),
    ("LIFECYCLE-TOOLS-EXACT-SEVEN", "ok"),
    ("LIFECYCLE-STATUS-MATCH", "ok"),
    ("LIFECYCLE-CLEAN-EOF-STDERR", "ok"),
    ("MALFORMED-FRAME", "refused"),
    ("TIMEOUT-TEARDOWN", "timed_out_child_exited"),
    ("NO-OUTSIDE-WRITES", "ok"),
)
CHECK_KEYS = (
    "runtime_profile_verified", "python_311", "python_hash_bound", "product_pins_match", "config_one_server",
    "generated_config_consumed", "unusable_config_no_spawn", "create_new_allowlist", "path_escape_reparse_refused",
    "identity_revalidated", "tools_exactly_seven", "statuses_match", "clean_eof_empty_stderr", "timeout_child_exited",
    "no_outside_writes", "summary_non_vacuous",
)
REQUIRED_TOOLS = ("graph_stats", "query_graph", "get_node", "get_neighbors", "shortest_path", "get_community", "god_nodes")
EXPECTED_STATUS = {"graph_stats": "ok", "query_graph": "ok", "get_node": "ok", "get_neighbors": "ok", "shortest_path": "ok", "get_community": "ok", "god_nodes": "truncated"}
FIXTURE_CASE_FOR_TOOL = {
    "graph_stats": "T-STATS-OK", "query_graph": "T-QUERY-OK", "get_node": "T-NODE-ID", "get_neighbors": "T-NEIGHBORS-BOTH",
    "shortest_path": "T-PATH-DIRECTED", "get_community": "T-COMMUNITY-OK", "god_nodes": "T-GOD-OK",
}


def _load_session():
    path = ROOT / "wiki_graph_session.py"
    spec = importlib.util.spec_from_file_location("wiki_graph_session", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["wiki_graph_session"] = module
    spec.loader.exec_module(module)
    return module


session = _load_session()
CASES = {case["id"]: case for case in json.loads(CASES_PATH.read_bytes())["cases"]}

# Filled only after a case's assertions have all passed.
OBSERVED = {}
FLAGS = {"generated_config_consumed": False, "junction_exercised": False, "identity_revalidated": False}
LIFE = {}
TMP = None


def setUpModule():
    global TMP
    TMP = Path(tempfile.mkdtemp(prefix="wiki_graph_session_")).resolve()


def tearDownModule():
    if TMP is not None and TMP.exists():
        for item in [TMP, *TMP.rglob("*")]:
            if getattr(os.lstat(item), "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT or item.is_symlink():
                raise RuntimeError(f"REFUSED_REPARSE:{item}")
        shutil.rmtree(TMP)


def case_dir(name):
    path = TMP / name
    path.mkdir()
    return str(path)


def canon(value):
    """Test-side canonical JSON (sorted keys, no whitespace, UTF-8), written independently of the adapter."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def sha_upper(data):
    return hashlib.sha256(data).hexdigest().upper()


def listing(path):
    return sorted(os.listdir(path))


def code_of(fn):
    """The SessionRefused code raised by ``fn``, or None when it did not refuse."""
    try:
        fn()
    except session.SessionRefused as exc:
        return exc.code
    return None


def is_reparse(path):
    return bool(os.lstat(path).st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT)


def record(case_id, status):
    assert case_id not in OBSERVED, f"duplicate observation for {case_id}"
    OBSERVED[case_id] = status


def rewrite(prepared, data):
    """Test-owned mutation: replace the config bytes and keep the sidecar consistent with them."""
    Path(prepared["config_path"]).write_bytes(data)
    Path(prepared["sidecar_path"]).write_bytes(f"{sha_upper(data)}  {CONFIG_NAME}\n".encode("ascii"))


def config_of(prepared):
    return json.loads(Path(prepared["config_path"]).read_bytes().decode("ascii"))


def tree_snapshot(root):
    """Content-sensitive snapshot: relative path -> (type, SHA-256 for regular files). No size or mtime."""
    snapshot = {}
    for directory, dirs, files in os.walk(root):
        for name in dirs:
            snapshot[os.path.relpath(os.path.join(directory, name), root)] = ("dir", None)
        for name in files:
            path = os.path.join(directory, name)
            regular = stat.S_ISREG(os.lstat(path).st_mode)
            snapshot[os.path.relpath(path, root)] = ("file", sha_upper(Path(path).read_bytes())) if regular else ("other", None)
    return snapshot


def optional_file_state(path):
    """SHA-256 of an existing regular file, the sentinel NOT_REGULAR for any other entry, or ABSENT."""
    if not os.path.lexists(path):
        return "ABSENT"
    if not stat.S_ISREG(os.lstat(path).st_mode):
        return "NOT_REGULAR"
    return sha_upper(Path(path).read_bytes())


def forbidden_popen(*args, **kwargs):
    raise AssertionError("a child process spawn was attempted")


def lifecycle():
    """One shared prepare -> validate -> spawn -> teardown lifecycle for the three LIFECYCLE cases."""
    if "value" in LIFE:
        return LIFE["value"]
    if "error" in LIFE:
        raise LIFE["error"]
    try:
        base = case_dir("lifecycle")
        prepared = session.prepare(base, "life1")
        server = config_of(prepared)["mcpServers"]["wiki_graph"]
        expected_argv = [server["command"], *server["args"]]
        launched = []
        real_popen = subprocess.Popen

        def spy(argv, *args, **kwargs):
            launched.append(list(argv))
            return real_popen(argv, *args, **kwargs)

        with mock.patch.object(session.subprocess, "Popen", spy):
            result = session.run_validated(prepared["config_path"], session.lifecycle_payload())
        session.teardown(prepared["leaf"])
        LIFE["value"] = {"result": result, "launched": launched, "expected_argv": expected_argv, "base": base}
    except BaseException as exc:
        LIFE["error"] = exc
        raise
    return LIFE["value"]


def lifecycle_frames(life):
    frames = session.parse_frames(life["result"]["stdout"])
    assert [frame["id"] for frame in frames] == [1, 2, 3, 4, 5, 6, 7, 8, 9], "response ids"
    return frames


class SessionLifecycleTests(unittest.TestCase):
    def test_CONFIG_ONLY_WIKI_GRAPH(self):
        base = case_dir("config_only")
        prepared = session.prepare(base, "c1")
        self.assertEqual(listing(base), ["c1"])
        self.assertEqual(listing(prepared["leaf"]), sorted([CONFIG_NAME, SIDECAR_NAME]))
        data = Path(prepared["config_path"]).read_bytes()
        self.assertEqual(Path(prepared["sidecar_path"]).read_bytes(), f"{sha_upper(data)}  {CONFIG_NAME}\n".encode("ascii"))
        config = json.loads(data.decode("ascii"))
        self.assertEqual(list(config), ["mcpServers"])
        self.assertEqual(list(config["mcpServers"]), ["wiki_graph"])
        server = config["mcpServers"]["wiki_graph"]
        self.assertEqual(sorted(server), ["args", "command"])
        self.assertEqual(server["command"], os.path.abspath(sys.executable))
        self.assertEqual(server["args"], [
            "-I", "-B", str(ROOT / "wiki_graph_mcp.py"),
            "--graph", str(FIXTURES / "wiki_graph_synthetic_v1.json"),
            "--graph-sha256", PINS["synthetic_fixture_sha256"].lower(),
            "--source-oid", OID,
        ])
        validated = session.validate(prepared["config_path"])
        self.assertEqual(validated["argv"], [server["command"], *server["args"]])
        session.teardown(prepared["leaf"])
        self.assertEqual(listing(base), [])
        record("CONFIG-ONLY-WIKI-GRAPH", "ok")

    def test_CONFIG_UNUSABLE_REJECTED(self):
        base = case_dir("unusable")

        def append_space(prepared):
            with open(prepared["config_path"], "ab") as stream:
                stream.write(b" ")

        def wrong_oid(prepared):
            rewrite(prepared, Path(prepared["config_path"]).read_bytes().replace(OID.encode("ascii"), ALT_OID.encode("ascii")))

        def delete_config(prepared):
            os.remove(prepared["config_path"])

        def extra_file(prepared):
            Path(prepared["leaf"], "notes.txt").write_bytes(b"x")

        def second_server(prepared):
            config = config_of(prepared)
            config["mcpServers"]["other"] = {"command": "x", "args": []}
            rewrite(prepared, canon(config) + b"\n")

        def reformatted(prepared):
            rewrite(prepared, (json.dumps(config_of(prepared), indent=2) + "\n").encode("ascii"))

        variants = (
            ("u1", append_space, "SIDECAR"),
            ("u2", wrong_oid, "ARGS"),
            ("u3", delete_config, "PATH_MISSING"),
            ("u4", extra_file, "LEAF_LISTING"),
            ("u5", second_server, "SCHEMA"),
            ("u6", reformatted, "CANONICAL"),
        )
        with mock.patch.object(session.subprocess, "Popen", forbidden_popen):
            for name, mutate, expected in variants:
                prepared = session.prepare(base, name)
                mutate(prepared)
                with self.assertRaises(session.SessionRefused) as raised:
                    session.run_validated(prepared["config_path"], b"")
                self.assertEqual(raised.exception.code, expected, name)
        record("CONFIG-UNUSABLE-REJECTED", "rejected_before_spawn")

    def test_CREATE_NEW_ALLOWLIST(self):
        base = case_dir("create_new")
        prepared = session.prepare(base, "n1")
        names = sorted([CONFIG_NAME, SIDECAR_NAME])
        self.assertEqual(listing(prepared["leaf"]), names)
        before = {name: sha_upper(Path(prepared["leaf"], name).read_bytes()) for name in names}
        self.assertEqual(code_of(lambda: session.prepare(base, "n1")), "LEAF_EXISTS")
        self.assertEqual({name: sha_upper(Path(prepared["leaf"], name).read_bytes()) for name in names}, before)
        self.assertEqual(listing(prepared["leaf"]), names)
        os.mkdir(os.path.join(base, "n2"))
        self.assertEqual(code_of(lambda: session.prepare(base, "n2")), "LEAF_EXISTS")
        self.assertEqual(listing(os.path.join(base, "n2")), [])
        self.assertEqual(code_of(lambda: session._create_new(prepared["config_path"], b"x")), "FILE_EXISTS")
        self.assertEqual(sha_upper(Path(prepared["config_path"]).read_bytes()), before[CONFIG_NAME])
        self.assertEqual(listing(base), ["n1", "n2"])
        session.teardown(prepared["leaf"])
        os.rmdir(os.path.join(base, "n2"))
        self.assertEqual(listing(base), [])
        record("CREATE-NEW-ALLOWLIST", "ok")

    def test_PATH_ESCAPE_REPARSE(self):
        import _winapi  # mandatory on Windows; an import or creation failure is an ERROR, never a skip

        d = case_dir("path_escape")
        target = os.path.join(d, "real")
        os.mkdir(target)
        os.mkdir(os.path.join(target, "sub"))
        junction = os.path.join(d, "junc")
        alias = os.path.join(d, "alias")
        fake_repo = os.path.join(d, "fakerepo")
        os.mkdir(fake_repo)
        made = []
        try:
            _winapi.CreateJunction(target, junction)
            made.append(junction)
            self.assertTrue(is_reparse(junction))
            FLAGS["junction_exercised"] = True
            self.assertEqual(code_of(lambda: session.prepare(junction, "j1")), "REPARSE")
            self.assertEqual(code_of(lambda: session.prepare(os.path.join(junction, "sub"), "j2")), "REPARSE")
            self.assertEqual(listing(target), ["sub"])
            self.assertEqual(code_of(lambda: session.prepare(str(REPO), "esc1")), "BASE_OUTSIDE_TEMP")
            self.assertEqual(code_of(lambda: session.prepare(d + os.sep + "..", "esc2")), "PATH_FORM")
            for bad in ("..", "a/b", "a\\b", "", "x" + chr(233)):
                self.assertEqual(code_of(lambda: session.prepare(d, bad)), "RUN_ID", repr(bad))
            self.assertEqual(listing(d), ["fakerepo", "junc", "real"])
            # A standard bare repository (HEAD + objects/ + refs/, no .git entry) is refused as a base or ancestor.
            bare = os.path.join(d, "bare.git")
            os.mkdir(bare)
            Path(bare, "HEAD").write_bytes(b"ref: refs/heads/main\n")
            os.mkdir(os.path.join(bare, "objects"))
            os.mkdir(os.path.join(bare, "refs"))
            os.mkdir(os.path.join(bare, "sub"))
            self.assertEqual(code_of(lambda: session.prepare(bare, "b1")), "BASE_IN_REPOSITORY")
            self.assertEqual(code_of(lambda: session.prepare(os.path.join(bare, "sub"), "b2")), "BASE_IN_REPOSITORY")
            self.assertEqual(listing(bare), ["HEAD", "objects", "refs", "sub"])
            self.assertEqual(listing(os.path.join(bare, "sub")), [])
            # A validated leaf reached through a junction alias is refused.
            prepared = session.prepare(d, "p1")
            _winapi.CreateJunction(prepared["leaf"], alias)
            made.append(alias)
            self.assertEqual(code_of(lambda: session.validate(os.path.join(alias, CONFIG_NAME))), "REPARSE")
            # A bound product input reached through a junction is refused even though its bytes match the pins.
            _winapi.CreateJunction(str(ROOT.parent), os.path.join(fake_repo, "tooling"))
            made.append(os.path.join(fake_repo, "tooling"))
            self.assertEqual(code_of(lambda: session.verify_product_pins(fake_repo)), "REPARSE")
        finally:
            for path in reversed(made):
                if os.path.lexists(path) and is_reparse(path):
                    os.rmdir(path)  # removes only the test-owned junction, never its target
        for path in made:
            self.assertFalse(os.path.lexists(path), path)
        self.assertEqual(listing(target), ["sub"])
        self.assertEqual(session.verify_product_pins(), PINS)  # junction removal left the real inputs intact
        session.teardown(prepared["leaf"])
        record("PATH-ESCAPE-REPARSE", "refused")

    def test_IDENTITY_PINS(self):
        self.assertEqual(session.verify_product_pins(), PINS)
        for key, path in PIN_PATHS.items():
            self.assertEqual(sha_upper(path.read_bytes()), PINS[key], key)
        self.assertEqual({key: value[1] for key, value in session.PRODUCT_PINS.items()}, PINS)
        self.assertEqual(session.SOURCE_OID, OID)
        tampered = dict(session.PRODUCT_PINS)
        tampered["core_sha256"] = (tampered["core_sha256"][0], "0" * 64)
        self.assertEqual(code_of(lambda: session.verify_product_pins(pins=tampered)), "PIN_MISMATCH")
        runtime = session.runtime_observation()
        exe = os.path.abspath(sys.executable)
        self.assertEqual(runtime["python_version"].split(".")[:2], ["3", "11"])
        self.assertEqual(runtime["resolved_executable_path"], exe)
        self.assertEqual(runtime["executable_sha256"], sha_upper(Path(exe).read_bytes()))
        if runtime["profile"] == "local_owner":
            self.assertEqual(os.path.normcase(exe), os.path.normcase(LOCAL_PYTHON))
            self.assertEqual(runtime["executable_sha256"], LOCAL_PYTHON_SHA256)
        else:
            self.assertEqual(runtime["profile"], "ci_windows_2025")
            self.assertEqual(os.environ.get("GITHUB_ACTIONS"), "true")
        # Identity is revalidated at prepare, at validate, and again immediately before every spawn.
        counts = {"pins": 0, "runtime": 0}
        real_pins, real_runtime = session.verify_product_pins, session.runtime_observation

        def pins_spy(*args, **kwargs):
            counts["pins"] += 1
            return real_pins(*args, **kwargs)

        def runtime_spy(*args, **kwargs):
            counts["runtime"] += 1
            return real_runtime(*args, **kwargs)

        base = case_dir("identity")
        stages = []
        with mock.patch.object(session, "verify_product_pins", pins_spy), mock.patch.object(session, "runtime_observation", runtime_spy):
            prepared = session.prepare(base, "i1")
            stages.append(dict(counts))
            session.validate(prepared["config_path"])
            stages.append(dict(counts))
            result = session.run_validated(prepared["config_path"], b"")
            stages.append(dict(counts))
        self.assertEqual(result["returncode"], 0)
        previous = {"pins": 0, "runtime": 0}
        for stage in stages:
            self.assertGreater(stage["pins"], previous["pins"])
            self.assertGreater(stage["runtime"], previous["runtime"])
            previous = stage
        session.teardown(prepared["leaf"])
        FLAGS["identity_revalidated"] = True
        record("IDENTITY-PINS", "ok")

    def test_FIXTURE_HASH_OID(self):
        base = case_dir("fixture_oid")
        tampered = dict(session.PRODUCT_PINS)
        tampered["synthetic_fixture_sha256"] = (tampered["synthetic_fixture_sha256"][0], "F" * 64)
        self.assertEqual(code_of(lambda: session.verify_product_pins(pins=tampered)), "PIN_MISMATCH")
        self.assertEqual(session.PRODUCT_PINS["synthetic_fixture_sha256"][1], PINS["synthetic_fixture_sha256"])

        def flip_hash(config):
            args = config["mcpServers"]["wiki_graph"]["args"]
            args[6] = ("0" if args[6][0] != "0" else "1") + args[6][1:]

        def wrong_oid(config):
            config["mcpServers"]["wiki_graph"]["args"][8] = ALT_OID

        def upper_hash(config):
            config["mcpServers"]["wiki_graph"]["args"][6] = PINS["synthetic_fixture_sha256"]

        with mock.patch.object(session.subprocess, "Popen", forbidden_popen):
            for name, mutate in (("f1", flip_hash), ("f2", wrong_oid), ("f3", upper_hash)):
                prepared = session.prepare(base, name)
                config = config_of(prepared)
                mutate(config)
                rewrite(prepared, canon(config) + b"\n")
                self.assertEqual(code_of(lambda: session.validate(prepared["config_path"])), "ARGS", name)
                self.assertEqual(code_of(lambda: session.run_validated(prepared["config_path"], b"")), "ARGS", name)
        record("FIXTURE-HASH-OID", "refused")

    def test_LIFECYCLE_TOOLS_EXACT_SEVEN(self):
        life = lifecycle()
        self.assertEqual(life["launched"], [life["expected_argv"]])
        self.assertEqual(life["result"]["argv"], life["expected_argv"])
        FLAGS["generated_config_consumed"] = True
        frames = lifecycle_frames(life)
        tools = frames[1]["result"]["tools"]
        self.assertEqual(len(tools), 7)
        self.assertEqual(tuple(tool["name"] for tool in tools), REQUIRED_TOOLS)
        self.assertEqual(sorted(frames[0]["result"]), ["capabilities", "protocolVersion", "serverInfo"])
        record("LIFECYCLE-TOOLS-EXACT-SEVEN", "ok")

    def test_LIFECYCLE_STATUS_MATCH(self):
        life = lifecycle()
        frames = lifecycle_frames(life)
        requests = [request for request in session.LIFECYCLE_REQUESTS if "id" in request]
        self.assertEqual(len(requests), 9)
        self.assertEqual([request["params"]["name"] for request in requests[2:]], list(REQUIRED_TOOLS))
        for index, tool in enumerate(REQUIRED_TOOLS):
            request, frame = requests[2 + index], frames[2 + index]
            self.assertEqual(frame["id"], request["id"], tool)
            structured = frame["result"]["structuredContent"]
            self.assertEqual(structured["status"], EXPECTED_STATUS[tool], tool)
            self.assertEqual(json.loads(frame["result"]["content"][0]["text"]), structured, tool)
            fixture_frame = CASES[FIXTURE_CASE_FOR_TOOL[tool]]["frames"][0]
            self.assertEqual(request["params"], fixture_frame["request"]["params"], tool)
            self.assertEqual(structured, fixture_frame["expect"]["tool_result"], tool)
        record("LIFECYCLE-STATUS-MATCH", "ok")

    def test_LIFECYCLE_CLEAN_EOF_STDERR(self):
        life = lifecycle()
        result = life["result"]
        self.assertFalse(result["timed_out"])
        self.assertTrue(result["child_exited"])
        self.assertEqual(result["returncode"], 0)
        self.assertEqual(result["stderr"], b"")
        stdout = result["stdout"]
        self.assertTrue(stdout.endswith(b"\n"))
        lines = stdout[:-1].split(b"\n")
        self.assertEqual(len(lines), 9)
        for line in lines:
            self.assertEqual(line, canon(json.loads(line)))
        self.assertEqual(listing(life["base"]), [])
        record("LIFECYCLE-CLEAN-EOF-STDERR", "ok")

    def test_MALFORMED_FRAME(self):
        base = case_dir("malformed")
        prepared = session.prepare(base, "m1")
        payload = (
            b'{"jsonrpc":"2.0","id":1,\n'
            b'{"jsonrpc":"2.0","id":2,"id":3,"method":"tools/list"}\n'
            b"\xff\xfe\n"
            b'{"jsonrpc":"2.0","id":4,"method":"tools/list","params":{}}\n'
        )
        result = session.run_validated(prepared["config_path"], payload)
        self.assertEqual((result["returncode"], result["stderr"], result["timed_out"]), (0, b"", False))
        frames = session.parse_frames(result["stdout"])
        self.assertEqual(len(frames), 4)
        self.assertEqual([frame["error"] for frame in frames[:3]], [
            {"code": -32700, "message": "PARSE_ERROR"},
            {"code": -32600, "message": "DUPLICATE_JSON_KEY"},
            {"code": -32700, "message": "INVALID_UTF8"},
        ])
        self.assertEqual([frame["id"] for frame in frames[:3]], [None, None, None])
        self.assertEqual(frames[3]["id"], 4)
        self.assertEqual(len(frames[3]["result"]["tools"]), 7)
        session.teardown(prepared["leaf"])
        record("MALFORMED-FRAME", "refused")

    def test_TIMEOUT_TEARDOWN(self):
        base = case_dir("timeout")
        prepared = session.prepare(base, "t1")
        result = session.run_validated(prepared["config_path"], b"", close_stdin=False, timeout=3, teardown_timeout=5)
        self.assertTrue(result["timed_out"])
        self.assertTrue(result["child_exited"])
        self.assertIsNotNone(result["returncode"])
        session.teardown(prepared["leaf"])
        self.assertEqual(listing(base), [])
        record("TIMEOUT-TEARDOWN", "timed_out_child_exited")

    def test_NO_OUTSIDE_WRITES(self):
        # Scope (deliberately NOT a global claim): the tooling/wiki tree, the repo-root .mcp.json name,
        # and the caller-owned temp base. Home/user settings are outside this evidence.
        base = case_dir("no_writes")
        before_tree = tree_snapshot(ROOT)
        self.assertGreater(sum(1 for kind, _ in before_tree.values() if kind == "file"), 30)  # non-vacuous: real files hashed
        # Positive control: the snapshot detects an added file and a changed file in a test-owned tree.
        control = case_dir("no_writes_control")
        Path(control, "a.txt").write_bytes(b"one")
        control_before = tree_snapshot(control)
        self.assertEqual(len(control_before), 1)
        Path(control, "b.txt").write_bytes(b"two")
        self.assertNotEqual(tree_snapshot(control), control_before)
        Path(control, "b.txt").unlink()
        self.assertEqual(tree_snapshot(control), control_before)
        # Same-length content mutation with the timestamp restored: only the content hash can notice it.
        a_path = os.path.join(control, "a.txt")
        original = os.lstat(a_path)
        Path(a_path).write_bytes(b"ONE")
        os.utime(a_path, ns=(original.st_atime_ns, original.st_mtime_ns))
        mutated = os.lstat(a_path)
        self.assertEqual((mutated.st_size, mutated.st_mtime_ns), (original.st_size, original.st_mtime_ns))
        self.assertNotEqual(tree_snapshot(control), control_before)
        # The .mcp.json sentinel logic distinguishes absent, present, and changed-content states.
        sentinel = os.path.join(control, ".mcp.json")
        self.assertEqual(optional_file_state(sentinel), "ABSENT")
        Path(sentinel).write_bytes(b"{}")
        present = optional_file_state(sentinel)
        self.assertEqual(present, sha_upper(b"{}"))
        Path(sentinel).write_bytes(b"[]")
        self.assertNotEqual(optional_file_state(sentinel), present)
        before_mcp = optional_file_state(REPO / ".mcp.json")
        result = session.smoke(base, "w1")
        self.assertEqual((result["returncode"], result["stderr"], result["timed_out"]), (0, b"", False))
        self.assertEqual(len(result["responses"]), 9)
        self.assertEqual(tree_snapshot(ROOT), before_tree)
        self.assertEqual(optional_file_state(REPO / ".mcp.json"), before_mcp)
        self.assertEqual(listing(base), [])
        # Fail-closed smoke: an abnormal lifecycle refuses, the CLI exits nonzero, and the leaf is preserved.
        bad_base = case_dir("smoke_fail")
        with mock.patch.object(session, "lifecycle_payload", lambda: b'{"bad\n'):
            self.assertEqual(code_of(lambda: session.smoke(bad_base, "x1")), "SMOKE_FAILED")
            self.assertEqual(listing(bad_base), ["x1"])
            errors = io.StringIO()
            with contextlib.redirect_stderr(errors):
                self.assertEqual(session._cli(["smoke", bad_base, "x2"]), 2)
        self.assertEqual(errors.getvalue(), "SESSION_REFUSED:SMOKE_FAILED\n")
        self.assertEqual(listing(bad_base), ["x1", "x2"])
        self.assertEqual(listing(os.path.join(bad_base, "x1")), sorted([CONFIG_NAME, SIDECAR_NAME]))
        self.assertEqual(tree_snapshot(ROOT), before_tree)
        record("NO-OUTSIDE-WRITES", "ok")


def main():
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(stream=sys.stderr, verbosity=2).run(suite)
    try:
        runtime = session.runtime_observation()
        runtime_ok = True
    except session.SessionRefused:
        runtime = {"profile": "", "python_version": "", "resolved_executable_path": "", "executable_sha256": ""}
        runtime_ok = False
    exe = os.path.abspath(sys.executable)
    independent_hash = sha_upper(Path(exe).read_bytes())
    if runtime["profile"] == "local_owner":
        hash_bound = runtime["executable_sha256"] == LOCAL_PYTHON_SHA256 == independent_hash and os.path.normcase(runtime["resolved_executable_path"]) == os.path.normcase(LOCAL_PYTHON)
    else:
        hash_bound = runtime["profile"] == "ci_windows_2025" and runtime["executable_sha256"] == independent_hash and runtime["resolved_executable_path"] == exe
    pins_now = {key: sha_upper(path.read_bytes()) for key, path in PIN_PATHS.items()}
    counts = {
        "tests_run": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "required_cases": len(REQUIRED_CASES),
        "observed_cases": len([case_id for case_id, _ in REQUIRED_CASES if case_id in OBSERVED]),
    }
    required = [{"case_id": case_id, "expected_status": status} for case_id, status in REQUIRED_CASES]
    results = [{"case_id": case_id, "observed_status": OBSERVED.get(case_id)} for case_id, _ in REQUIRED_CASES]
    statuses_ok = all(item["observed_status"] == expected[1] for item, expected in zip(results, REQUIRED_CASES))
    non_vacuous = (
        counts["tests_run"] > 0 and counts["failures"] == 0 and counts["errors"] == 0 and counts["skipped"] == 0
        and counts["required_cases"] == 12 and counts["observed_cases"] == 12 and len(OBSERVED) == 12 and statuses_ok
    )

    def observed(case_id):
        return OBSERVED.get(case_id) == dict(REQUIRED_CASES)[case_id]

    checks = {
        "runtime_profile_verified": runtime_ok and runtime["profile"] in ("local_owner", "ci_windows_2025"),
        "python_311": runtime_ok and runtime["python_version"].startswith("3.11.") and sys.version_info[:2] == (3, 11),
        "python_hash_bound": runtime_ok and hash_bound,
        "product_pins_match": pins_now == PINS and observed("IDENTITY-PINS") and observed("FIXTURE-HASH-OID"),
        "config_one_server": observed("CONFIG-ONLY-WIKI-GRAPH"),
        "generated_config_consumed": FLAGS["generated_config_consumed"] and observed("LIFECYCLE-TOOLS-EXACT-SEVEN"),
        "unusable_config_no_spawn": observed("CONFIG-UNUSABLE-REJECTED"),
        "create_new_allowlist": observed("CREATE-NEW-ALLOWLIST"),
        "path_escape_reparse_refused": FLAGS["junction_exercised"] and observed("PATH-ESCAPE-REPARSE"),
        "identity_revalidated": FLAGS["identity_revalidated"] and observed("IDENTITY-PINS"),
        "tools_exactly_seven": observed("LIFECYCLE-TOOLS-EXACT-SEVEN"),
        "statuses_match": observed("LIFECYCLE-STATUS-MATCH"),
        "clean_eof_empty_stderr": observed("LIFECYCLE-CLEAN-EOF-STDERR") and observed("MALFORMED-FRAME"),
        "timeout_child_exited": observed("TIMEOUT-TEARDOWN"),
        "no_outside_writes": observed("NO-OUTSIDE-WRITES"),
        "summary_non_vacuous": non_vacuous,
    }
    assert tuple(checks) == CHECK_KEYS
    summary = {
        "schema_version": SCHEMA_VERSION,
        "suite": "wiki_graph_session",
        "runtime": runtime,
        "product_pins": pins_now,
        "counts": counts,
        "required_cases": required,
        "case_results": results,
        "checks": checks,
        "ok": all(checks.values()),
    }
    sys.stdout.write(SUMMARY_PREFIX + json.dumps(summary, separators=(",", ":")) + "\n")
    sys.stdout.flush()
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
