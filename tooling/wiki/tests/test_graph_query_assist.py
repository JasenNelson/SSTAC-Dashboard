import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parent.parent / "graph_query_assist.py"

# Forbidden repository-specific identifiers: the diagnostic text must never leak
# these (or any file/function/class example) into a caller's context.
FORBIDDEN_WORDS = ("publish_wiki", "swap_staging", "nightly", "wiki_lint")

# A minimal fake upstream MCP-over-stdio server, written INLINE here (as source
# text) so the unit tests need no real graph and no real graphify install. It is
# materialized to a temp module at test time (see setUp) and launched by
# graph_query_assist.py exactly the way the real upstream is launched: as
# `<python> -m <module> <graph> --transport stdio`. For every tools/call request it
# echoes back whatever result the test asked for via the request's own arguments
# (_fake_response_text / _fake_is_error / _fake_response_mode), so each test fully
# controls the "upstream" response without any real graph traversal.
FAKE_SERVER_SOURCE = """
import json
import sys


def main():
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            continue
        if not isinstance(obj, dict):
            continue
        method = obj.get("method")
        if method == "emit_raw":
            # Writes an arbitrary, non-JSON-RPC-shaped line straight to stdout, so
            # the relay's "child stdout line that is not valid JSON passes through
            # unchanged" behaviour can be exercised directly.
            params = obj.get("params") or {}
            sys.stdout.write(params.get("text", "") + chr(10))
            sys.stdout.flush()
            continue
        if method != "tools/call":
            continue
        req_id = obj.get("id")
        params = obj.get("params") or {}
        arguments = params.get("arguments") or {}
        mode = arguments.get("_fake_response_mode")
        if mode == "no_content":
            result = {"isError": False}
        else:
            text = arguments.get("_fake_response_text", "")
            is_error = bool(arguments.get("_fake_is_error", False))
            result = {
                "content": [{"type": "text", "text": text}],
                "isError": is_error,
            }
        response = {"jsonrpc": "2.0", "id": req_id, "result": result}
        sys.stdout.write(json.dumps(response) + chr(10))
        sys.stdout.flush()


if __name__ == "__main__":
    main()
"""

HEALTHY_TEXT = (
    "Traversal: BFS depth=3 | Start: ['widget_module.example'] | 24 nodes found\n\n"
    "NODE widget_module.example [src=some/module.example loc=L1 community=1]\n"
    "NODE helper.example [src=some/helper.example loc=L5 community=1]\n"
    "EDGE widget_module.example --imports [EXTRACTED context=import]--> helper.example"
)

SINGLE_NODE_EMPTY_SRC_TEXT = (
    "Traversal: BFS depth=3 | Start: ['Widget'] | 1 nodes found\n\n"
    "NODE Widget [src= loc= community=extract.example]"
)

# 3 nodes, zero EDGE lines, every node carrying a REAL src. This is a HEALTHY fixture:
# the removed edge_count==0 branch would have flagged it, and upstream token_budget
# truncation produces exactly this shape on large results.
HEALTHY_NO_EDGES_TEXT = (
    "Traversal: BFS depth=3 | Start: ['Widget'] | 3 nodes found\n\n"
    "NODE Widget [src=some/widget.example loc=L1 community=1]\n"
    "NODE Gadget [src=some/gadget.example loc=L2 community=1]\n"
    "NODE Sprocket [src=some/sprocket.example loc=L3 community=1]"
)

# 3 nodes with an EDGE line, but every NODE line has an empty src= -- the ONLY
# surviving degenerate branch.
# R4 CORRECTION. The previous anti-leak fixture seeded on 'Widget', a word that could
# never appear in a leak assertion, so the guard could not fail and it certified the very
# leak it existed to prevent. This fixture seeds on REAL repository identifiers of the
# shape the upstream actually emits, so echoing the seed is detectable.
DEGENERATE_REAL_IDENTIFIER_SEED_TEXT = (
    "Traversal: BFS depth=3 | Start: ['publish_wiki.py', 'swap_staging()', "
    "'MatrixDashboard.tsx'] | 2 nodes found\n\n"
    "NODE publish_wiki.py [src= loc= community=extract.example]\n"
    "NODE swap_staging() [src= loc= community=extract.example]"
)

DEGENERATE_ALL_SRC_EMPTY_TEXT = (
    "Traversal: BFS depth=3 | Start: ['Widget'] | 3 nodes found\n\n"
    "NODE Widget [src= loc=None community=1]\n"
    "NODE Gadget [src= loc=None community=1]\n"
    "NODE Sprocket [src= loc=None community=1]\n"
    "EDGE Widget --references [EXTRACTED]--> Gadget"
)


def make_response(req_id, text, is_error=False):
    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {"content": [{"type": "text", "text": text}], "isError": is_error},
    }


class TestGraphQueryAssist(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)

        self.graph_path = root / "graph.json"
        self.graph_path.write_text('{"nodes":[],"links":[]}\n', encoding="ascii")

        self.fake_server_dir = root / "fake_server_pkg"
        self.fake_server_dir.mkdir()
        (self.fake_server_dir / "fake_graphify_server.py").write_text(
            FAKE_SERVER_SOURCE, encoding="ascii"
        )

        self.env = dict(os.environ)
        self.env["PYTHONDONTWRITEBYTECODE"] = "1"
        existing_path = self.env.get("PYTHONPATH", "")
        self.env["PYTHONPATH"] = (
            str(self.fake_server_dir) + os.pathsep + existing_path
            if existing_path
            else str(self.fake_server_dir)
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def run_relay(self, request_lines, timeout=30):
        proc = subprocess.run(
            [
                sys.executable,
                str(SCRIPT_PATH),
                "--graph",
                str(self.graph_path),
                "--upstream-python",
                sys.executable,
                "--server-module",
                "fake_graphify_server",
            ],
            input="".join(request_lines).encode("utf-8"),
            capture_output=True,
            check=False,
            env=self.env,
            timeout=timeout,
        )
        self.assertEqual(
            proc.returncode,
            0,
            msg="relay exited non-zero; stderr=%r" % proc.stderr,
        )
        return proc.stdout.decode("utf-8").splitlines()

    def request_line(self, req_id, name, fake_response_text=None, is_error=False, mode=None):
        """Builds one JSON-RPC request line understood by the fake server above."""
        arguments = {"question": "unused"}
        if mode is not None:
            arguments["_fake_response_mode"] = mode
        else:
            arguments["_fake_response_text"] = fake_response_text
            arguments["_fake_is_error"] = is_error
        return (
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "method": "tools/call",
                    "params": {"name": name, "arguments": arguments},
                }
            )
            + "\n"
        )

    def test_degenerate_response_gets_diagnostic_appended_original_preserved(self):
        lines = self.run_relay(
            [self.request_line(1, "query_graph", SINGLE_NODE_EMPTY_SRC_TEXT)]
        )
        self.assertEqual(len(lines), 1)
        obj = json.loads(lines[0])
        text = obj["result"]["content"][0]["text"]
        self.assertTrue(text.startswith(SINGLE_NODE_EMPTY_SRC_TEXT))
        self.assertIn("[graph_query_assist diagnostic]", text)
        self.assertIn("COLLAPSED SEED", text)

    def test_healthy_response_passes_through_byte_identical(self):
        lines = self.run_relay([self.request_line(2, "query_graph", HEALTHY_TEXT)])
        self.assertEqual(len(lines), 1)
        obj = json.loads(lines[0])
        self.assertEqual(obj["result"]["content"][0]["text"], HEALTHY_TEXT)
        self.assertNotIn("graph_query_assist", lines[0])
        expected = json.dumps(make_response(2, HEALTHY_TEXT, is_error=False))
        self.assertEqual(lines[0], expected)

    def test_non_query_graph_tool_call_passes_through_unchanged(self):
        lines = self.run_relay(
            [self.request_line(3, "get_node", SINGLE_NODE_EMPTY_SRC_TEXT)]
        )
        self.assertEqual(len(lines), 1)
        obj = json.loads(lines[0])
        self.assertEqual(obj["result"]["content"][0]["text"], SINGLE_NODE_EMPTY_SRC_TEXT)
        self.assertNotIn("graph_query_assist", lines[0])

    def test_non_json_line_passes_through_unchanged(self):
        # Exercises a non-JSON line arriving on the CHILD's stdout (the case the
        # contract describes: "any line that is not valid JSON passes through
        # unchanged"). The fake server's emit_raw method writes this line to its
        # own stdout verbatim, bypassing JSON-RPC encoding entirely.
        request = json.dumps(
            {
                "jsonrpc": "2.0",
                "method": "emit_raw",
                "params": {"text": "not json at all"},
            }
        ) + "\n"
        lines = self.run_relay([request])
        self.assertEqual(lines, ["not json at all"])

    def test_malformed_result_shape_passes_through_without_raising(self):
        # A response whose result.content is missing entirely -- the enrichment
        # code must not raise, and must pass the line through unchanged.
        lines = self.run_relay(
            [self.request_line(4, "query_graph", mode="no_content")]
        )
        self.assertEqual(len(lines), 1)
        obj = json.loads(lines[0])
        self.assertNotIn("content", obj["result"])

    def test_diagnostic_has_no_repository_specific_identifiers(self):
        """Two-sided guard: the fixture's seed labels are real repository identifiers,
        so an implementation that echoes the upstream Start: header FAILS this test."""
        lines = self.run_relay(
            [self.request_line(5, "query_graph", DEGENERATE_REAL_IDENTIFIER_SEED_TEXT)]
        )
        obj = json.loads(lines[0])
        text = obj["result"]["content"][0]["text"]
        diagnostic = text[len(DEGENERATE_REAL_IDENTIFIER_SEED_TEXT) :]
        for leaked in ("publish_wiki.py", "swap_staging()", "MatrixDashboard.tsx"):
            self.assertNotIn(leaked, diagnostic)
        self.assertNotIn(".py", diagnostic)
        self.assertNotIn("()", diagnostic)
        for word in FORBIDDEN_WORDS:
            self.assertNotIn(word, diagnostic)

    def test_few_nodes_with_real_src_is_NOT_degenerate(self):
        """R1 regression guard. `node_count <= 2` was removed: measured against real
        graph identifiers it fired on 113 of 150 (75.3%), every one carrying a real
        src, so it stamped CORRECT data as COLLAPSED and told the caller to retry with
        the identifier they had just used. A small precise answer must pass through."""
        lines = self.run_relay(
            [self.request_line(6, "query_graph", SINGLE_NODE_EMPTY_SRC_TEXT.replace(
                "NODE Widget [src= loc= community=extract.example]",
                "NODE Widget [src=some/widget.example loc=L1 community=1]"))]
        )
        obj = json.loads(lines[0])
        self.assertNotIn("graph_query_assist diagnostic",
                         obj["result"]["content"][0]["text"])

    def test_no_edges_with_real_src_is_NOT_degenerate(self):
        """R2 regression guard. `edge_count == 0` was removed: it cannot tell a genuinely
        edgeless result from upstream token_budget TRUNCATION, and was observed calling a
        213-node / 222-edge result "zero edges returned"."""
        lines = self.run_relay(
            [self.request_line(7, "query_graph", HEALTHY_NO_EDGES_TEXT)]
        )
        obj = json.loads(lines[0])
        self.assertNotIn("graph_query_assist diagnostic",
                         obj["result"]["content"][0]["text"])

    def test_degenerate_branch_all_src_empty(self):
        lines = self.run_relay(
            [self.request_line(8, "query_graph", DEGENERATE_ALL_SRC_EMPTY_TEXT)]
        )
        obj = json.loads(lines[0])
        text = obj["result"]["content"][0]["text"]
        self.assertIn("[graph_query_assist diagnostic]", text)
        self.assertIn("none of them carry a source location", text)
        self.assertIn("COLLAPSED SEED", text)

    def test_healthy_multinode_response_with_one_empty_src_is_not_degenerate(self):
        # Mirrors the real upstream shape: most NODE lines have a real src, but one
        # (e.g. a builtin/typing reference) has an empty src -- must NOT trip the
        # all-src-empty branch, which requires EVERY node line to be empty.
        text = (
            "Traversal: BFS depth=3 | Start: ['widget_module.example'] | 3 nodes found\n\n"
            "NODE widget_module.example [src=some/module.example loc=L1 community=1]\n"
            "NODE helper.example [src=some/helper.example loc=L5 community=1]\n"
            "NODE Path [src= loc= community=1]\n"
            "EDGE widget_module.example --imports [EXTRACTED context=import]--> helper.example"
        )
        lines = self.run_relay([self.request_line(9, "query_graph", text)])
        obj = json.loads(lines[0])
        self.assertEqual(obj["result"]["content"][0]["text"], text)
        self.assertNotIn("graph_query_assist", lines[0])

    def test_multiple_requests_in_one_session(self):
        lines = self.run_relay(
            [
                self.request_line(10, "query_graph", HEALTHY_TEXT),
                self.request_line(11, "query_graph", SINGLE_NODE_EMPTY_SRC_TEXT),
            ]
        )
        self.assertEqual(len(lines), 2)
        first = json.loads(lines[0])
        second = json.loads(lines[1])
        self.assertEqual(first["result"]["content"][0]["text"], HEALTHY_TEXT)
        self.assertIn(
            "[graph_query_assist diagnostic]",
            second["result"]["content"][0]["text"],
        )


if __name__ == "__main__":
    unittest.main()
