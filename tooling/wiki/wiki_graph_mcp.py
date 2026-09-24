"""Minimal stdio MCP adapter for the repository-owned wiki_graph surface."""

from __future__ import annotations

import importlib.util
import os
import re
import stat
import sys
from pathlib import Path
from typing import Any


def _load_core() -> Any:
    """Load the sibling core module by absolute path (works under python -I)."""
    path = Path(__file__).resolve().with_name("wiki_graph_core.py")
    existing = sys.modules.get("wiki_graph_core")
    if existing is not None and Path(existing.__file__).resolve() == path:
        return existing
    spec = importlib.util.spec_from_file_location("wiki_graph_core", path)
    if spec is None or spec.loader is None:
        raise ImportError("wiki_graph_core")
    module = importlib.util.module_from_spec(spec)
    sys.modules["wiki_graph_core"] = module
    spec.loader.exec_module(module)
    return module


core = _load_core()

MAX_FRAME = 1_048_576
MAX_RESULT = 32_000
SERVER_INFO = {"name": "wiki_graph", "version": "r2"}
PROTOCOL_VERSION = "2025-06-18"

# The three normative refusal diagnostics. No other diagnostic exists.
SIDE_EFFECT_REFUSED = "SIDE_EFFECT_REFUSED"
WRITE_REFUSED = "WRITE_REFUSED"
AUDIT_AMBIGUOUS_FLAGS = "AUDIT_AMBIGUOUS_FLAGS"

_BLOCKED_EVENTS = frozenset({
    "socket.__new__", "socket.getaddrinfo", "socket.gethostbyname", "socket.gethostbyname_ex",
    "socket.getnameinfo", "subprocess.Popen", "os.system", "os.spawn", "os.posix_spawn",
    "os.remove", "os.unlink", "os.rename", "os.replace", "os.mkdir", "os.rmdir", "os.makedirs",
    "shutil.copyfile", "shutil.copytree", "shutil.move",
})
_WRITE_FLAGS = os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND


def _audit_hook(event: str, args: tuple[Any, ...]) -> None:
    """Refuse side effects. The CPython 'open' event is dispatched by argument shape:
    builtins.open sends (path, mode:str, flags:int); os.open sends (path, None, flags:int)."""
    if event in _BLOCKED_EVENTS or event.startswith("subprocess."):
        raise RuntimeError(SIDE_EFFECT_REFUSED)
    if event == "open":
        if len(args) != 3:
            raise RuntimeError(AUDIT_AMBIGUOUS_FLAGS)
        mode, flags = args[1], args[2]
        if isinstance(mode, str):
            if any(char in mode for char in "wax+"):
                raise RuntimeError(WRITE_REFUSED)
            return
        if mode is not None or not isinstance(flags, int) or isinstance(flags, bool):
            raise RuntimeError(AUDIT_AMBIGUOUS_FLAGS)
        if flags & _WRITE_FLAGS:
            raise RuntimeError(WRITE_REFUSED)


class ProtocolError(ValueError):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _result(request_id: Any, value: dict[str, Any]) -> dict[str, Any]:
    """Direct method-specific result object (initialize and the list methods)."""
    return {"jsonrpc": "2.0", "id": request_id, "result": value}


def _envelope(request_id: Any, value: dict[str, Any]) -> dict[str, Any]:
    """tools/call only: the tool value as structuredContent plus its canonical text."""
    text = core.canonical_json_bytes(value).decode("utf-8")
    return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": text}], "structuredContent": value}}


def _limit(default: int | None) -> dict[str, Any]:
    schema: dict[str, Any] = {"type": "integer", "minimum": 1, "maximum": 50}
    if default is not None:
        schema["default"] = default
    return schema


TOOL_DEFS = [
    {"name": "graph_stats", "description": "Return graph identity and counts.", "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "query_graph", "description": "Search graph nodes.", "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}, "limit": _limit(None)}, "required": ["query"], "additionalProperties": False}},
    {"name": "get_node", "description": "Fetch a node by identity or selector.", "inputSchema": {"type": "object", "properties": {"node_id": {"type": "string"}, "selector": {"type": "string"}}, "oneOf": [{"required": ["node_id"]}, {"required": ["selector"]}], "additionalProperties": False}},
    {"name": "get_neighbors", "description": "Traverse graph neighbors.", "inputSchema": {"type": "object", "properties": {"node_id": {"type": "string"}, "direction": {"type": "string", "enum": ["out", "in", "both"], "default": "both"}, "depth": {"type": "integer", "minimum": 1, "maximum": 3, "default": 1}, "limit": _limit(20)}, "required": ["node_id"], "additionalProperties": False}},
    {"name": "shortest_path", "description": "Find a shortest path.", "inputSchema": {"type": "object", "properties": {"source_id": {"type": "string"}, "target_id": {"type": "string"}, "mode": {"type": "string", "enum": ["directed", "undirected"], "default": "directed"}, "max_depth": {"type": "integer", "minimum": 1, "maximum": 8, "default": 6}}, "required": ["source_id", "target_id"], "additionalProperties": False}},
    {"name": "get_community", "description": "Fetch community members.", "inputSchema": {"type": "object", "properties": {"community_id": {"type": "string"}, "limit": _limit(50)}, "required": ["community_id"], "additionalProperties": False}},
    {"name": "god_nodes", "description": "Rank high-degree nodes.", "inputSchema": {"type": "object", "properties": {"limit": _limit(10)}, "additionalProperties": False}},
]
_TOOLS = {item["name"]: item for item in TOOL_DEFS}
_STRING_ARGS = {"query", "node_id", "selector", "source_id", "target_id", "community_id", "direction", "mode"}


def _validate_args(name: str, value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProtocolError(-32602, "INVALID_ARGUMENTS")
    schema = _TOOLS[name]["inputSchema"]
    properties = schema["properties"]
    if any(key not in properties for key in value):
        raise ProtocolError(-32602, "EXTRA_PROPERTY")
    for key in schema.get("required", []):
        if key not in value:
            raise ProtocolError(-32602, f"MISSING_{key}")
    for key, item in value.items():
        spec = properties[key]
        if key in _STRING_ARGS:
            if item.__class__ is not str or not item:
                raise ProtocolError(-32602, f"INVALID_{key}")
            if "enum" in spec and item not in spec["enum"]:
                raise ProtocolError(-32602, f"INVALID_{key}")
        elif spec.get("type") == "integer":
            if item.__class__ is not int or not spec["minimum"] <= item <= spec["maximum"]:
                raise ProtocolError(-32602, f"INVALID_{key}")
    if name == "get_node" and ("node_id" in value) == ("selector" in value):
        raise ProtocolError(-32602, "EXACTLY_ONE_SELECTOR")
    if name == "query_graph":
        try:
            core.normalize_query(value["query"])
        except ValueError as exc:
            raise ProtocolError(-32602, "INVALID_query") from exc
    return value


def _dispatch(graph: Any, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "graph_stats":
        return core.graph_stats(graph)
    if name == "query_graph":
        return core.query_graph(graph, args["query"], args.get("limit", 20))
    if name == "get_node":
        return core.get_node(graph, node_id=args.get("node_id"), selector=args.get("selector"))
    if name == "get_neighbors":
        return core.get_neighbors(graph, args["node_id"], args.get("direction", "both"), args.get("depth", 1), args.get("limit", 20))
    if name == "shortest_path":
        return core.shortest_path(graph, args["source_id"], args["target_id"], args.get("mode", "directed"), args.get("max_depth", 6))
    if name == "get_community":
        return core.get_community(graph, args["community_id"], args.get("limit", 50))
    return core.god_nodes(graph, args.get("limit", 10))


def bounded_result(value: dict[str, Any]) -> dict[str, Any]:
    """Replace a would-be result over 32,000 canonical UTF-8 bytes with a small complete refusal."""
    if len(core.canonical_json_bytes(value)) > MAX_RESULT:
        return {"status": "refused", "code": "RESULT_TOO_LARGE", "message": "result exceeds 32000 UTF-8 bytes"}
    return value


def handle(graph: Any, request: Any) -> dict[str, Any] | None:
    if not isinstance(request, dict):
        raise ProtocolError(-32600, "INVALID_REQUEST")
    if request.get("jsonrpc") != "2.0" or not isinstance(request.get("method"), str) or set(request) - {"jsonrpc", "id", "method", "params"}:
        raise ProtocolError(-32600, "INVALID_REQUEST")
    request_id = request.get("id")
    method = request["method"]
    params = request.get("params", {})
    if method == "notifications/initialized":
        return None
    if method == "initialize":
        return _result(request_id, {"protocolVersion": PROTOCOL_VERSION, "serverInfo": SERVER_INFO, "capabilities": {"tools": {}}})
    if method == "resources/list":
        return _result(request_id, {"resources": []})
    if method == "resources/templates/list":
        return _result(request_id, {"resourceTemplates": []})
    if method == "prompts/list":
        return _result(request_id, {"prompts": []})
    if method == "tools/list":
        return _result(request_id, {"tools": TOOL_DEFS})
    if method != "tools/call":
        raise ProtocolError(-32601, "METHOD_NOT_FOUND")
    if not isinstance(params, dict) or set(params) != {"name", "arguments"} or not isinstance(params.get("name"), str):
        raise ProtocolError(-32602, "INVALID_TOOL_CALL")
    name = params["name"]
    if name not in _TOOLS:
        raise ProtocolError(-32602, "UNKNOWN_TOOL")
    args = _validate_args(name, params["arguments"])
    return _envelope(request_id, bounded_result(_dispatch(graph, name, args)))


def _checked_graph_path(path: str) -> str:
    if not os.path.isabs(path) or path.startswith(("\\\\", "//")) or ":" in path[2:]:
        raise core.GraphInputError("graph_path")
    final = os.path.abspath(path)
    current = os.path.splitdrive(final)[0] + os.sep
    for part in final[len(current):].split(os.sep):
        current = os.path.join(current, part)
        try:
            info = os.lstat(current)
        except OSError as exc:
            raise core.GraphInputError("graph_path") from exc
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise core.GraphInputError("graph_path_reparse")
    return final


def _refuse(reason: str) -> int:
    sys.stderr.buffer.write(f"GRAPH_INPUT_REFUSED:{reason}\n".encode("ascii"))
    sys.stderr.buffer.flush()
    return 2


def _write(stdout: Any, response: dict[str, Any]) -> None:
    stdout.write(core.canonical_json_bytes(response) + b"\n")
    stdout.flush()


def main(argv: list[str]) -> int:
    if len(argv) != 6 or argv[0::2] != ["--graph", "--graph-sha256", "--source-oid"]:
        return _refuse("startup_pins")
    graph_arg, graph_sha256, source_oid = argv[1], argv[3], argv[5]
    if re.fullmatch(r"[0-9a-f]{64}", graph_sha256) is None or re.fullmatch(r"[0-9a-f]{40}", source_oid) is None:
        return _refuse("startup_pins")
    sys.addaudithook(_audit_hook)
    try:
        with open(_checked_graph_path(graph_arg), "rb") as stream:
            raw_bytes = stream.read(core.MAX_GRAPH_BYTES + 1)
        graph = core.load_graph(raw_bytes, graph_sha256, source_oid)
    except core.GraphInputError as exc:
        return _refuse(exc.reason)
    except OSError:
        return _refuse("graph_unreadable")
    stdin = sys.stdin.buffer
    stdout = sys.stdout.buffer
    while True:
        line = stdin.readline(MAX_FRAME + 2)
        if not line:
            return 0
        raw = line[:-1] if line.endswith(b"\n") else line
        if raw.endswith(b"\r"):
            raw = raw[:-1]
        if not raw:
            continue
        if len(raw) > MAX_FRAME:
            _write(stdout, _error(None, -32600, "FRAME_TOO_LARGE"))
            return 0
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            _write(stdout, _error(None, -32700, "INVALID_UTF8"))
            continue
        try:
            request = core.parse_json_strict(text)
        except core.DuplicateKeyError:
            _write(stdout, _error(None, -32600, "DUPLICATE_JSON_KEY"))
            continue
        except ValueError:
            _write(stdout, _error(None, -32700, "PARSE_ERROR"))
            continue
        try:
            response = handle(graph, request)
        except ProtocolError as exc:
            response = _error(request.get("id") if isinstance(request, dict) else None, exc.code, exc.message)
        if response is not None:
            _write(stdout, response)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
