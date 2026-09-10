"""
graph_query_assist.py -- transparent stdio JSON-RPC relay in front of the upstream
graphify MCP server (python -m graphify.serve <graph.json> --transport stdio).

Why this exists: query_graph seeds a graph traversal from node LABELS matched against
the query tokens. A prose query (e.g. "protected path refusal") can collapse onto a
single generic node with no source location and no edges, and the tool still reports
SUCCESS. A caller cannot tell "no such structure exists" apart from "you seeded badly",
so it gives up instead of retrying with a real identifier. This relay detects that
degenerate shape and APPENDS an explicit, actionable diagnostic to the response text --
never replacing or truncating the original text, and never touching a healthy response.

Usage:
    python graph_query_assist.py --graph <graph.json>
        [--upstream-python <exe>] [--server-module graphify.serve]

Contract:
  - stdin -> child stdin, byte-for-byte, line by line.
  - child stdout -> our stdout, line by line; only tools/call responses whose id was
    remembered from a query_graph request are inspected, and only a DEGENERATE
    query_graph response is rewritten (re-serialized with the diagnostic appended).
    Every other line -- non-JSON, non-query_graph, healthy query_graph -- is passed
    through unchanged (the original raw bytes, never re-serialized).
  - child stderr -> our stderr only, never our stdout.
  - exits cleanly when stdin closes or the child process exits.
"""

import argparse
import json
import re
import subprocess
import sys
import threading
from pathlib import Path
from typing import Optional


HEADER_RE = re.compile(r"Start:\s*(\[.*?\])\s*\|\s*(\d+)\s*nodes found")


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Transparent stdio relay in front of the upstream graphify MCP server "
            "that makes degenerate query_graph retrieval explicit and actionable."
        )
    )
    parser.add_argument("--graph", required=True, type=Path, help="Path to graph.json")
    parser.add_argument(
        "--upstream-python",
        default=sys.executable,
        help="Python executable used to launch the upstream server (default: this interpreter)",
    )
    parser.add_argument(
        "--server-module",
        default="graphify.serve",
        help="Upstream server module (default: graphify.serve)",
    )
    return parser.parse_args(argv)


def parse_node_line_src(line: str) -> Optional[str]:
    """Returns the src= value of a NODE line (possibly empty string), or None if
    the line is not a parseable NODE line."""
    if not line.startswith("NODE"):
        return None
    idx = line.find("src=")
    if idx == -1:
        return None
    idx2 = line.find(" loc=", idx)
    if idx2 == -1:
        return None
    return line[idx + len("src=") : idx2]



def build_diagnostic(node_count: int) -> str:
    """Plain-ASCII, generic-only diagnostic block.

    R3 CORRECTION. This previously interpolated the upstream `Start: [...]` header,
    which is NOT the caller's query -- it is the list of node LABELS the upstream
    MATCHED. Echoing it injected real repository identifiers (file names, component
    names, function names) into the response, in sessions that may be answering
    questions about this very repository. The old docstring asserted the opposite,
    which is exactly why the leak survived review.

    Nothing derived from graph CONTENT may appear here. Only the node COUNT, which
    is a bare integer and carries no identifier, plus fixed generic guidance.
    """
    lines = [
        "[graph_query_assist diagnostic]",
        "This traversal matched %d node(s), and none of them carry a source "
        "location" % node_count,
        "(src is empty), so nothing here can be opened or cited.",
        "That is a COLLAPSED SEED. It is NOT evidence that the structure you are",
        "looking for is absent from the codebase.",
        "query_graph seeds its traversal from node LABELS, not from free-text",
        "search, so a prose phrase tends to collapse onto a generic node.",
        "Retry using an IDENTIFIER: a file name, a function name, or a class name.",
        "You can use the god_nodes tool to list well-connected anchor nodes, or the",
        "get_node tool with a label argument to look up a specific label directly,",
        "then retry query_graph from there.",
    ]
    return "\n".join(lines)


def classify_and_build_diagnostic(text: str) -> Optional[str]:
    """Returns the diagnostic block to append if `text` is a DEGENERATE query_graph
    retrieval, or None if it is healthy or could not be classified (in which case
    the caller must leave the response unchanged)."""
    header_match = HEADER_RE.search(text)
    if header_match is None:
        return None

    try:
        node_count = int(header_match.group(2))
    except ValueError:
        return None

    lines = text.splitlines()
    node_srcs = []
    for raw_line in lines:
        line = raw_line.lstrip()
        if line.startswith("EDGE"):
            # skip: an EDGE line must never be parsed as a NODE line
            continue
        src = parse_node_line_src(line)
        if src is not None:
            node_srcs.append(src)

    # R1/R2 CORRECTION. The rule is now the ONE branch that was measured to have zero
    # false positives: every returned node lacks a source location.
    #
    # `node_count <= 2` was REMOVED. Measured against real graph identifiers, it fired
    # on 113 of 150 (75.3%) -- and all 113 carried a real src. A precise two-node answer
    # is often exactly right, so that branch stamped CORRECT data as COLLAPSED and told
    # the caller to retry with the identifier they had just used successfully. It made
    # the tool worse than the defect it was written to fix.
    #
    # `edge_count == 0` was REMOVED. It cannot distinguish a genuinely edgeless result
    # from upstream token_budget TRUNCATION, and was observed calling a 213-node /
    # 222-edge result "zero edges returned" -- a false statement about the richest
    # results the tool produces.
    #
    # What remains is precise and is exactly the motivating case: a prose seed that
    # collapses onto a generic node with no source location, which the caller can
    # neither open nor cite.
    all_src_empty = bool(node_srcs) and all(src == "" for src in node_srcs)
    if not all_src_empty:
        return None

    return build_diagnostic(node_count)


def enrich_query_graph_response(obj: dict) -> Optional[dict]:
    """Returns a modified copy of `obj` with the diagnostic appended if this is a
    DEGENERATE query_graph response, or None if `obj` should be passed through
    unchanged (healthy response, or a shape this function cannot safely handle)."""
    result = obj.get("result")
    if not isinstance(result, dict):
        return None
    content = result.get("content")
    if not isinstance(content, list) or not content:
        return None
    first_item = content[0]
    if not isinstance(first_item, dict):
        return None
    text = first_item.get("text")
    if not isinstance(text, str):
        return None

    diagnostic = classify_and_build_diagnostic(text)
    if diagnostic is None:
        return None

    new_obj = json.loads(json.dumps(obj))
    new_obj["result"]["content"][0]["text"] = text + "\n\n" + diagnostic
    return new_obj


def is_query_graph_call(obj: dict) -> Optional[object]:
    """Returns the request id if `obj` is a tools/call request whose tool name ends
    with "query_graph", else None."""
    if obj.get("method") != "tools/call":
        return None
    params = obj.get("params")
    if not isinstance(params, dict):
        return None
    name = params.get("name")
    if not isinstance(name, str) or not name.endswith("query_graph"):
        return None
    req_id = obj.get("id")
    if req_id is None:
        return None
    return req_id


def process_request_line(raw: bytes, pending_ids: set, lock: threading.Lock) -> None:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return
    try:
        obj = json.loads(text)
    except ValueError:
        return
    if not isinstance(obj, dict):
        return
    req_id = is_query_graph_call(obj)
    if req_id is not None:
        with lock:
            pending_ids.add(req_id)


def process_response_line(raw: bytes, pending_ids: set, lock: threading.Lock) -> bytes:
    """Returns the bytes to write to our stdout for one raw response line from the
    child. Unchanged (the original bytes) unless this is a remembered query_graph
    response carrying a DEGENERATE result, in which case a re-serialized, enriched
    line is returned instead."""
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw

    stripped = text.rstrip("\r\n")
    newline = text[len(stripped) :]
    if not newline:
        newline = "\n"

    try:
        obj = json.loads(stripped)
    except ValueError:
        return raw
    if not isinstance(obj, dict):
        return raw

    resp_id = obj.get("id")
    matched = False
    if resp_id is not None:
        with lock:
            if resp_id in pending_ids:
                matched = True
                pending_ids.discard(resp_id)

    if not matched:
        return raw

    enriched = enrich_query_graph_response(obj)
    if enriched is None:
        return raw

    return (json.dumps(enriched) + newline).encode("utf-8")


def run_relay(child: subprocess.Popen) -> int:
    pending_ids: set = set()
    lock = threading.Lock()

    def relay_stdin() -> None:
        stdin_in = sys.stdin.buffer
        while True:
            raw = stdin_in.readline()
            if not raw:
                break
            process_request_line(raw, pending_ids, lock)
            try:
                child.stdin.write(raw)
                child.stdin.flush()
            except (BrokenPipeError, OSError, ValueError):
                break
        try:
            child.stdin.close()
        except (OSError, ValueError):
            pass

    def relay_stderr() -> None:
        stderr_in = child.stderr
        stderr_out = sys.stderr.buffer
        while True:
            raw = stderr_in.readline()
            if not raw:
                break
            try:
                stderr_out.write(raw)
                stderr_out.flush()
            except (OSError, ValueError):
                break

    stdin_thread = threading.Thread(target=relay_stdin, daemon=True)
    stderr_thread = threading.Thread(target=relay_stderr, daemon=True)
    stdin_thread.start()
    stderr_thread.start()

    stdout_in = child.stdout
    stdout_out = sys.stdout.buffer
    while True:
        raw = stdout_in.readline()
        if not raw:
            break
        out_line = process_response_line(raw, pending_ids, lock)
        stdout_out.write(out_line)
        stdout_out.flush()

    try:
        child.stdin.close()
    except (OSError, ValueError):
        pass

    try:
        child.wait(timeout=10)
    except subprocess.TimeoutExpired:
        child.kill()
        child.wait()

    return child.returncode if child.returncode is not None else 0


def main(argv=None) -> int:
    args = parse_args(argv)
    cmd = [
        args.upstream_python,
        "-m",
        args.server_module,
        str(args.graph),
        "--transport",
        "stdio",
    ]
    try:
        child = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
    except OSError as exc:
        sys.stderr.write("graph_query_assist: failed to launch upstream server: %s\n" % exc)
        return 1

    return run_relay(child)


if __name__ == "__main__":
    sys.exit(main())
