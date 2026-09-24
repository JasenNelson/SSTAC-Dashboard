"""Product acceptance for the read-only wiki_graph MCP stdio adapter.

Every numbered case comes from the compact literal fixture
tests/fixtures/wiki_graph_product_cases_v1.json. Its expected values are
hand-written literals derived from wiki_graph_synthetic_v1.json; nothing in this
module generates, refreshes, or blesses them. Each case launches the real adapter
with ``-I -B`` (or, for side-effect cases, a child that runs the adapter's real
startup path first) under a bounded timeout, and tears the child down through its
own process handle only. Tests write only inside one fresh test-owned temporary
directory.

Run as ``<python-3.11> -I -B tooling/wiki/tests/test_wiki_graph_mcp.py``. The
runner prints one ``WIKI_GRAPH_PRODUCT_SUMMARY`` JSON line and exits nonzero on
any failure, error, skip, zero-test run, or required/fixture/executed ID mismatch.
"""

import hashlib
import importlib.util
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADAPTER = ROOT / "wiki_graph_mcp.py"
FIXTURES = ROOT / "tests" / "fixtures"
GRAPH = FIXTURES / "wiki_graph_synthetic_v1.json"
CASES_PATH = FIXTURES / "wiki_graph_product_cases_v1.json"
PYTHON = Path(sys.executable).resolve()
OID = "0123456789abcdef0123456789abcdef01234567"
ALT_OID = "fedcba9876543210fedcba9876543210fedcba98"
ENV = {"SYSTEMROOT": os.environ.get("SYSTEMROOT", r"C:\WINDOWS"), "WINDIR": os.environ.get("WINDIR", r"C:\WINDOWS")}
TIMEOUT = 30
TEARDOWN_TIMEOUT = 5
SUMMARY_PREFIX = "WIKI_GRAPH_PRODUCT_SUMMARY "

# The required case-ID set is a literal. It is never derived from the fixture,
# the adapter, test discovery, or any historical file.
REQUIRED_IDS = (
    "CAP-INITIALIZE",
    "CAP-TOOLS-EXACT-SEVEN",
    "T-STATS-OK",
    "T-QUERY-OK",
    "T-NODE-ID",
    "T-NEIGHBORS-BOTH",
    "T-PATH-DIRECTED",
    "T-COMMUNITY-OK",
    "T-GOD-OK",
    "E-UNKNOWN-METHOD",
    "E-UNKNOWN-TOOL",
    "E-EXTRA-PROPERTY",
    "E-NFC-257",
    "E-WRONG-GRAPH-HASH",
    "E-FRAME-OVERSIZE",
    "E-RESULT-OVERSIZE",
    "IO-EMPTY-SURFACES",
    "IO-REPEATED-CALLS",
    "IO-CLEAN-EOF",
    "SFX-SOCKET",
    "SFX-SUBPROCESS",
    "SFX-BUILTINS-OPEN-W",
    "SFX-OS-OPEN-W",
    "SFX-REMOVE",
    "SFX-RENAME",
    "SFX-MKDIR",
)
REQUIRED_TOOLS = ("graph_stats", "query_graph", "get_node", "get_neighbors", "shortest_path", "get_community", "god_nodes")
REQUIRED_SIDE_EFFECT_IDS = ("SFX-SOCKET", "SFX-SUBPROCESS", "SFX-BUILTINS-OPEN-W", "SFX-OS-OPEN-W", "SFX-REMOVE", "SFX-RENAME", "SFX-MKDIR")

# Filled only after a case's assertions have all passed.
EXECUTED_IDS = []
EXECUTED_TOOLS = set()
TMP = None


def _load(name):
    path = ROOT / f"{name}.py"
    existing = sys.modules.get(name)
    if existing is not None and Path(existing.__file__).resolve() == path:
        return existing
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


mcp = _load("wiki_graph_mcp")
CASES_DOC = json.loads(CASES_PATH.read_bytes())
FIXTURE_IDS = [case["id"] for case in CASES_DOC["cases"]]
CASES = {case["id"]: case for case in CASES_DOC["cases"]}


def canon(value):
    """Test-side canonical JSON (sorted keys, no whitespace, UTF-8), written independently of the adapter."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def setUpModule():
    global TMP
    TMP = Path(tempfile.mkdtemp(prefix="wiki_graph_product_")).resolve()


def tearDownModule():
    if TMP is not None and TMP.exists():
        for item in [TMP, *TMP.rglob("*")]:
            if getattr(os.lstat(item), "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT or item.is_symlink():
                raise RuntimeError(f"REFUSED_REPARSE:{item}")
        shutil.rmtree(TMP)


def case_dir(case_id):
    path = TMP / case_id
    path.mkdir()
    return path


def adapter_argv(graph=GRAPH, graph_sha256=None, source_oid=OID):
    graph = Path(graph)
    digest = graph_sha256 or hashlib.sha256(graph.read_bytes()).hexdigest()
    return [str(PYTHON), "-I", "-B", str(ADAPTER), "--graph", str(graph), "--graph-sha256", digest, "--source-oid", source_oid]


def run_child(argv, payload, cwd):
    """Write the payload, close stdin, drain stdout and stderr, and wait. On timeout,
    terminate (then kill) only this child through its retained handle and fail."""
    process = subprocess.Popen(argv, cwd=str(cwd), env=ENV, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False)
    try:
        stdout, stderr = process.communicate(payload, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        process.terminate()
        try:
            process.communicate(timeout=TEARDOWN_TIMEOUT)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate(timeout=TEARDOWN_TIMEOUT)
        raise AssertionError(f"child exceeded {TIMEOUT}s and was torn down by handle: {argv[3]}")
    return process.returncode, stdout, stderr


def repeat_unit(repeat):
    """The fixture stays ASCII: a non-ASCII query unit is spelled as code points."""
    return "".join(chr(point) for point in repeat["unit_codepoints"])


def frame_method(item):
    if "request" in item:
        return item["request"]["method"]
    return json.loads(item["raw"])["method"]


def frame_bytes(item):
    if "raw" in item:
        return item["raw"].encode("utf-8")
    request = json.loads(json.dumps(item["request"]))
    repeat = item.get("repeat_query")
    if repeat is not None:
        query = repeat_unit(repeat) * repeat["count"]
        assert len(query) == repeat["pre_nfc_scalars"], "repeat_query pre-NFC scalar count"
        request["params"]["arguments"]["query"] = query
    frame = json.dumps(request, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    pad = item.get("pad_to_bytes")
    if pad is not None:
        assert len(frame) < pad, "padding target must exceed the request"
        frame += b" " * (pad - len(frame))
        assert len(frame) == pad, "padded frame length"
    return frame


def build_graph(spec, directory):
    label = spec["label_prefix"] + spec["label_fill"] * spec["label_fill_count"]
    nodes = [
        {"id": f"{spec['node_id_prefix']}{index:02d}", "label": label, "file_type": spec["file_type"], "source_file": "", "source_location": None}
        for index in range(spec["node_count"])
    ]
    path = directory / "graph.json"
    path.write_bytes(json.dumps({"directed": False, "multigraph": False, "graph": {}, "nodes": nodes, "links": []}).encode("utf-8"))
    return path


def expected_envelope(expect):
    """``tool_result`` (tools/call only) is wrapped as content + structuredContent; ``result``
    is a direct method-specific result object; ``error`` is a JSON-RPC error."""
    if "tool_result" in expect:
        structured = expect["tool_result"]
        result = {"content": [{"type": "text", "text": canon(structured).decode("utf-8")}], "structuredContent": structured}
        return {"jsonrpc": "2.0", "id": expect["id"], "result": result}
    if "result" in expect:
        return {"jsonrpc": "2.0", "id": expect["id"], "result": expect["result"]}
    return {"jsonrpc": "2.0", "id": expect["id"], "error": expect["error"]}


# Exact top-level result keys per method. A literal, independent of the fixture: the universal
# tools/call envelope (content + structuredContent) on any other method is a contract defect.
RESULT_KEYS = {
    "initialize": {"protocolVersion", "serverInfo", "capabilities"},
    "tools/list": {"tools"},
    "resources/list": {"resources"},
    "resources/templates/list": {"resourceTemplates"},
    "prompts/list": {"prompts"},
    "tools/call": {"content", "structuredContent"},
}


def stdout_lines(stdout):
    if not stdout:
        return []
    if not stdout.endswith(b"\n"):
        return None
    return stdout[:-1].split(b"\n")


CHILD_CODE = r"""
import importlib.util, json, os, socket, subprocess, sys
adapter, graph, digest, oid, operation, target, other = sys.argv[1:8]
spec = importlib.util.spec_from_file_location("wiki_graph_mcp", adapter)
module = importlib.util.module_from_spec(spec)
sys.modules["wiki_graph_mcp"] = module
spec.loader.exec_module(module)
startup_rc = module.main(["--graph", graph, "--graph-sha256", digest, "--source-oid", oid])

def attempt():
    if operation == "socket":
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).close()
    elif operation == "subprocess":
        subprocess.Popen([sys.executable, "-I", "-c", "open(%r, 'w').close()" % target]).wait(10)
    elif operation == "builtins_open_w":
        open(target, "w").close()
    elif operation == "os_open_w":
        os.close(os.open(target, os.O_WRONLY | os.O_CREAT))
    elif operation == "remove":
        os.remove(target)
    elif operation == "rename":
        os.rename(target, other)
    elif operation == "mkdir":
        os.mkdir(target)
    else:
        raise SystemExit("UNKNOWN_OPERATION")

try:
    attempt()
    refusal = None
except RuntimeError as exc:
    refusal = str(exc)
sys.stdout.write(json.dumps({"refusal": refusal, "startup_returncode": startup_rc}, sort_keys=True) + "\n")
sys.stdout.flush()
"""

TARGET_BYTES = b"test-owned target bytes\n"


class ProductCaseTests(unittest.TestCase):
    """One test per required case ID. Each launches real children."""

    def run_case(self, case_id):
        case = CASES[case_id]
        if case["kind"] == "exchange":
            self.run_exchange(case_id, case)
        elif case["kind"] == "side_effect":
            self.run_side_effect(case_id, case)
        else:
            self.fail(f"{case_id}: unknown case kind {case['kind']!r}")
        EXECUTED_IDS.append(case_id)

    def assert_line(self, case_id, line, expect, method):
        message = json.loads(line)
        envelope = expected_envelope(expect)
        self.assertEqual(message, envelope, f"{case_id}: response differs")
        self.assertEqual(line, canon(envelope), f"{case_id}: response is not canonical JSON-RPC bytes")
        if "error" in expect:
            self.assertNotIn("result", message, case_id)
            return
        self.assertEqual(set(message["result"]), RESULT_KEYS[method], f"{case_id}: {method} result shape")
        if method == "tools/call":
            content = message["result"]["content"]
            self.assertEqual(len(content), 1, case_id)
            self.assertEqual(json.loads(content[0]["text"]), message["result"]["structuredContent"], case_id)

    def exchange_once(self, case_id, case, directory):
        graph = GRAPH
        if "graph_spec" in case:
            graph = build_graph(case["graph_spec"], directory)
        argv = adapter_argv(graph, case.get("launch", {}).get("graph_sha256"))
        frames = [frame_bytes(item) for item in case["frames"]]
        rc, stdout, stderr = run_child(argv, b"".join(frame + b"\n" for frame in frames), directory)
        self.assertEqual(rc, case.get("expect_returncode", 0), f"{case_id}: returncode")
        self.assertEqual(stderr, case.get("expect_stderr", "").encode("ascii"), f"{case_id}: stderr")
        lines = stdout_lines(stdout)
        self.assertIsNotNone(lines, f"{case_id}: stdout is not LF-terminated frames")
        expected = [(item["expect"], frame_method(item)) for item in case["frames"] if item["expect"] is not None]
        self.assertEqual(len(lines), len(expected), f"{case_id}: response count")
        for line, (expect, method) in zip(lines, expected):
            self.assert_line(case_id, line, expect, method)
        return stdout

    def run_exchange(self, case_id, case):
        directory = case_dir(case_id)
        stdout = self.exchange_once(case_id, case, directory)
        if case.get("fresh_process_repeat"):
            self.assertEqual(self.exchange_once(case_id, case, directory), stdout, f"{case_id}: fresh process differs")
        for item in case["frames"]:
            request = item.get("request", {})
            expect = item["expect"]
            if request.get("method") == "tools/call" and expect is not None and "tool_result" in expect and expect["tool_result"].get("status") != "refused":
                EXECUTED_TOOLS.add(request["params"]["name"])

    def run_side_effect(self, case_id, case):
        directory = case_dir(case_id)
        target = directory / "target"
        other = directory / "other"
        if case["target_state"] == "present":
            target.write_bytes(TARGET_BYTES)
        before = self.snapshot(directory)
        digest = hashlib.sha256(GRAPH.read_bytes()).hexdigest()
        argv = [str(PYTHON), "-I", "-B", "-c", CHILD_CODE, str(ADAPTER), str(GRAPH), digest, OID, case["operation"], str(target), str(other)]
        rc, stdout, stderr = run_child(argv, b"", directory)
        self.assertEqual((rc, stderr), (0, b""), f"{case_id}: child exit/stderr {stderr[-400:]!r}")
        self.assertEqual(json.loads(stdout), {"refusal": case["expect_refusal"], "startup_returncode": 0}, case_id)
        self.assertEqual(self.snapshot(directory), before, f"{case_id}: test-owned directory changed")
        if case["target_state"] == "present":
            self.assertEqual(target.read_bytes(), TARGET_BYTES, case_id)
        elif case["target_state"] == "absent":
            self.assertFalse(os.path.lexists(target), case_id)
        if case.get("other_state") == "absent":
            self.assertFalse(os.path.lexists(other), case_id)

    @staticmethod
    def snapshot(directory):
        return sorted((str(path.relative_to(directory)), path.is_dir(), None if path.is_dir() else path.read_bytes()) for path in directory.rglob("*"))

    def test_CAP_INITIALIZE(self):
        self.run_case("CAP-INITIALIZE")

    def test_CAP_TOOLS_EXACT_SEVEN(self):
        self.run_case("CAP-TOOLS-EXACT-SEVEN")
        tools = CASES["CAP-TOOLS-EXACT-SEVEN"]["frames"][0]["expect"]["result"]["tools"]
        self.assertEqual(tuple(tool["name"] for tool in tools), REQUIRED_TOOLS)

    def test_T_STATS_OK(self):
        self.run_case("T-STATS-OK")

    def test_T_QUERY_OK(self):
        self.run_case("T-QUERY-OK")

    def test_T_NODE_ID(self):
        self.run_case("T-NODE-ID")

    def test_T_NEIGHBORS_BOTH(self):
        self.run_case("T-NEIGHBORS-BOTH")

    def test_T_PATH_DIRECTED(self):
        self.run_case("T-PATH-DIRECTED")

    def test_T_COMMUNITY_OK(self):
        self.run_case("T-COMMUNITY-OK")

    def test_T_GOD_OK(self):
        self.run_case("T-GOD-OK")

    def test_E_UNKNOWN_METHOD(self):
        self.run_case("E-UNKNOWN-METHOD")

    def test_E_UNKNOWN_TOOL(self):
        self.run_case("E-UNKNOWN-TOOL")

    def test_E_EXTRA_PROPERTY(self):
        self.run_case("E-EXTRA-PROPERTY")

    def test_E_NFC_257(self):
        import unicodedata
        for item in CASES["E-NFC-257"]["frames"]:
            repeat = item["repeat_query"]
            self.assertEqual(repeat["unit_codepoints"], [0x65, 0x0301])
            self.assertEqual(len(unicodedata.normalize("NFC", repeat_unit(repeat) * repeat["count"])), repeat["post_nfc_scalars"])
        self.run_case("E-NFC-257")

    def test_E_WRONG_GRAPH_HASH(self):
        self.run_case("E-WRONG-GRAPH-HASH")

    def test_E_FRAME_OVERSIZE(self):
        self.assertEqual(mcp.MAX_FRAME, 1048576)
        self.run_case("E-FRAME-OVERSIZE")

    def test_E_RESULT_OVERSIZE(self):
        self.run_case("E-RESULT-OVERSIZE")

    def test_IO_EMPTY_SURFACES(self):
        self.run_case("IO-EMPTY-SURFACES")

    def test_IO_REPEATED_CALLS(self):
        self.run_case("IO-REPEATED-CALLS")

    def test_IO_CLEAN_EOF(self):
        self.run_case("IO-CLEAN-EOF")

    def test_SFX_SOCKET(self):
        self.run_case("SFX-SOCKET")

    def test_SFX_SUBPROCESS(self):
        self.run_case("SFX-SUBPROCESS")

    def test_SFX_BUILTINS_OPEN_W(self):
        self.run_case("SFX-BUILTINS-OPEN-W")

    def test_SFX_OS_OPEN_W(self):
        self.run_case("SFX-OS-OPEN-W")

    def test_SFX_REMOVE(self):
        self.run_case("SFX-REMOVE")

    def test_SFX_RENAME(self):
        self.run_case("SFX-RENAME")

    def test_SFX_MKDIR(self):
        self.run_case("SFX-MKDIR")


class FixtureContractTests(unittest.TestCase):
    def test_required_ids_are_literal_and_complete(self):
        self.assertEqual(len(REQUIRED_IDS), 26)
        self.assertEqual(len(set(REQUIRED_IDS)), 26)
        self.assertEqual(len(FIXTURE_IDS), len(set(FIXTURE_IDS)), "duplicate fixture IDs")
        self.assertEqual(set(FIXTURE_IDS), set(REQUIRED_IDS))
        self.assertEqual(len(REQUIRED_TOOLS), 7)
        self.assertTrue(set(REQUIRED_SIDE_EFFECT_IDS) <= set(REQUIRED_IDS))
        self.assertEqual({case["id"] for case in CASES_DOC["cases"] if case["kind"] == "side_effect"}, set(REQUIRED_SIDE_EFFECT_IDS))

    def test_expectation_kind_matches_method(self):
        """Only tools/call may expect the content + structuredContent envelope."""
        checked = 0
        for case in CASES_DOC["cases"]:
            for item in case.get("frames", []):
                expect = item["expect"]
                if expect is None or "error" in expect:
                    continue
                method = frame_method(item)
                self.assertEqual(("tool_result" in expect), method == "tools/call", f"{case['id']}: {method}")
                self.assertEqual(("result" in expect), method != "tools/call", f"{case['id']}: {method}")
                checked += 1
        self.assertEqual(checked, 25)

    def test_fixture_pins_the_synthetic_graph(self):
        self.assertEqual(CASES_DOC["graph"]["fixture"], GRAPH.name)
        self.assertEqual(CASES_DOC["graph"]["graph_sha256"], hashlib.sha256(GRAPH.read_bytes()).hexdigest())
        self.assertEqual(CASES_DOC["graph"]["source_oid"], OID)

    def test_product_tests_have_no_historical_dependencies(self):
        for path in (Path(__file__), ROOT / "tests" / "test_wiki_graph_core.py", CASES_PATH):
            text = path.read_text(encoding="ascii")
            for token in ("wiki_graph_" + "q0", "golden" + "_v1", "mission" + "-control", "synthetic_" + "source"):
                self.assertNotIn(token, text, f"{path.name} references {token}")


class ControllerEnvelopeTests(unittest.TestCase):
    """``controller_envelope`` is the historical name of the caller-supplied startup
    envelope (graph path, expected graph SHA-256, source OID). It names no external
    controller process, launcher, or receipt."""

    def test_source_oid_basis_reports_the_caller_supplied_startup_envelope(self):
        directory = case_dir("envelope")
        request = b'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_stats","arguments":{}}}\n'
        rc, stdout, stderr = run_child(adapter_argv(source_oid=ALT_OID), request, directory)
        self.assertEqual((rc, stderr), (0, b""))
        stats = json.loads(stdout)["result"]["structuredContent"]
        self.assertEqual(stats["source_oid"], ALT_OID)
        self.assertEqual(stats["graph_sha256"], "bd1a2efec3ee741617aac853e5f0ed0160ce1f0faf625f0e1e6b6b4d4be535d8")
        self.assertEqual(stats["source_oid_basis"], "controller_envelope")

    def test_startup_envelope_is_exactly_three_pins(self):
        directory = case_dir("envelope_pins")
        for argv in (adapter_argv()[:-2], adapter_argv(source_oid="ABC"), adapter_argv() + ["--extra", "x"]):
            rc, stdout, stderr = run_child(argv, b"", directory)
            self.assertEqual((rc, stdout, stderr), (2, b"", b"GRAPH_INPUT_REFUSED:startup_pins\n"))


class MethodResultShapeTests(unittest.TestCase):
    """Regression for C2 P1: initialize and the list methods return direct method-specific
    result objects; only tools/call carries content + structuredContent."""

    def test_exact_result_shape_per_method(self):
        directory = case_dir("method_shapes")
        requests = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
            {"jsonrpc": "2.0", "id": 3, "method": "resources/list", "params": {}},
            {"jsonrpc": "2.0", "id": 4, "method": "resources/templates/list", "params": {}},
            {"jsonrpc": "2.0", "id": 5, "method": "prompts/list", "params": {}},
            {"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "graph_stats", "arguments": {}}},
        ]
        payload = b"".join(json.dumps(item, separators=(",", ":")).encode("ascii") + b"\n" for item in requests)
        rc, stdout, stderr = run_child(adapter_argv(), payload, directory)
        self.assertEqual((rc, stderr), (0, b""))
        responses = [json.loads(line) for line in stdout_lines(stdout)]
        self.assertEqual([item["id"] for item in responses], [1, 2, 3, 4, 5, 6])
        observed = {request["method"]: set(response["result"]) for request, response in zip(requests, responses)}
        self.assertEqual(observed, {
            "initialize": {"protocolVersion", "serverInfo", "capabilities"},
            "tools/list": {"tools"},
            "resources/list": {"resources"},
            "resources/templates/list": {"resourceTemplates"},
            "prompts/list": {"prompts"},
            "tools/call": {"content", "structuredContent"},
        })
        for request, response in zip(requests[:5], responses[:5]):
            with self.subTest(method=request["method"]):
                self.assertNotIn("content", response["result"])
                self.assertNotIn("structuredContent", response["result"])
        self.assertEqual(responses[0]["result"]["protocolVersion"], "2025-06-18")
        self.assertEqual(len(responses[1]["result"]["tools"]), 7)
        self.assertEqual(responses[5]["result"]["structuredContent"]["status"], "ok")


class ResultBoundTests(unittest.TestCase):
    def test_result_bound_is_inclusive_at_32000_bytes(self):
        at_limit = {"pad": "x" * 31976, "status": "ok"}
        over_limit = {"pad": "x" * 31977, "status": "ok"}
        self.assertEqual(len(canon(at_limit)), 32000)
        self.assertEqual(mcp.bounded_result(at_limit), at_limit)
        self.assertEqual(mcp.bounded_result(over_limit), {"status": "refused", "code": "RESULT_TOO_LARGE", "message": "result exceeds 32000 UTF-8 bytes"})


class AuditHookTests(unittest.TestCase):
    """Direct hook dispatch by CPython 'open' argument shape."""

    def refused(self, event, args):
        try:
            mcp._audit_hook(event, args)
        except RuntimeError as exc:
            return str(exc)
        return None

    def test_open_event_shapes(self):
        self.assertEqual(self.refused("open", ("t", "w", os.O_WRONLY)), "WRITE_REFUSED")
        self.assertEqual(self.refused("open", ("t", "r+", os.O_RDWR)), "WRITE_REFUSED")
        self.assertIsNone(self.refused("open", ("t", "rb", os.O_RDONLY)))
        self.assertEqual(self.refused("open", ("t", None, os.O_WRONLY)), "WRITE_REFUSED")
        self.assertEqual(self.refused("open", ("t", None, os.O_WRONLY | os.O_CREAT | os.O_EXCL)), "WRITE_REFUSED")
        self.assertIsNone(self.refused("open", ("t", None, os.O_RDONLY)))
        self.assertEqual(self.refused("open", ("t", None, "x")), "AUDIT_AMBIGUOUS_FLAGS")
        self.assertEqual(self.refused("open", ("t", 5, 0)), "AUDIT_AMBIGUOUS_FLAGS")
        self.assertEqual(self.refused("socket.__new__", ()), "SIDE_EFFECT_REFUSED")
        self.assertEqual(self.refused("os.mkdir", ("d", 0o777, -1)), "SIDE_EFFECT_REFUSED")
        self.assertIsNone(self.refused("import", ("x",)))


def main():
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(stream=sys.stderr, verbosity=2).run(suite)
    executed = sorted(EXECUTED_IDS)
    checks = {
        "tests_ran": result.testsRun > 0,
        "no_failures": not result.failures and not result.errors,
        "no_skips": not result.skipped and not result.expectedFailures and not result.unexpectedSuccesses,
        "required_count_26": len(REQUIRED_IDS) == 26 and len(set(REQUIRED_IDS)) == 26,
        "fixture_ids_unique": len(FIXTURE_IDS) == len(set(FIXTURE_IDS)),
        "executed_ids_unique": len(EXECUTED_IDS) == len(set(EXECUTED_IDS)),
        "fixture_eq_required_eq_executed": set(FIXTURE_IDS) == set(REQUIRED_IDS) == set(EXECUTED_IDS),
        "tools_exact_seven": EXECUTED_TOOLS == set(REQUIRED_TOOLS),
        "side_effects_executed": set(REQUIRED_SIDE_EFFECT_IDS) <= set(EXECUTED_IDS),
    }
    summary = {
        "suite": "mcp",
        "tests_run": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "required_count": len(REQUIRED_IDS),
        "required_ids": sorted(REQUIRED_IDS),
        "fixture_ids": sorted(FIXTURE_IDS),
        "executed_ids": executed,
        "tools_executed": sorted(EXECUTED_TOOLS),
        "side_effect_ids_executed": sorted(set(REQUIRED_SIDE_EFFECT_IDS) & set(EXECUTED_IDS)),
        "checks": checks,
        "ok": all(checks.values()),
    }
    sys.stdout.write(SUMMARY_PREFIX + json.dumps(summary, sort_keys=True, separators=(",", ":")) + "\n")
    sys.stdout.flush()
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
