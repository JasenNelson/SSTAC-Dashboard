"""Session-local configuration helper and lifecycle runner for the read-only wiki_graph MCP adapter.

Operations (narrow by design):

    prepare   <base> <run_id>   create one fresh run leaf holding mcp-config.json and its .sha256
    validate  <config_path>     revalidate the interpreter, product pins and config; print argv
    smoke     <base> <run_id>   test-only: prepare, run one model-free lifecycle, tear down

The only files this module ever creates are ``mcp-config.json`` and ``mcp-config.json.sha256``
inside a run leaf that did not exist before, beneath a caller-owned base under the OS temp root
and outside every repository. It never writes Claude/global/user/project settings, registers an
MCP server, or copies product source. Run it as ``<python-3.11> -I -B wiki_graph_session.py``.

The validated config is the ONLY source of adapter argv: ``run_validated`` re-parses and
re-validates the config, and the interpreter/product identity, immediately before every spawn.
"""

from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import stat
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any

REPO_ROOT = str(Path(__file__).resolve().parents[2])

LOCAL_PYTHON = r"C:\Users\jasen\AppData\Local\Programs\Python\Python311\python.exe"
LOCAL_PYTHON_SHA256 = "5F7B89A612C9B8AF1D6456CDFCD1DBE5CA630849E79AEBCED9BEE9A6694952EC"

# Summary-key name -> (repository-relative path, pinned SHA-256). Invariant across both profiles.
PRODUCT_PINS = {
    "core_sha256": ("tooling/wiki/wiki_graph_core.py", "DAF9CB00F3257418E5E50540880877F301C68DA22FF058EFF6C6B2CF65D547BE"),
    "adapter_sha256": ("tooling/wiki/wiki_graph_mcp.py", "40D57E589C81F2A0EBECB1CF0E915275D3DB45DB3B9252B95A7060FAC3C4DFA5"),
    "synthetic_fixture_sha256": ("tooling/wiki/tests/fixtures/wiki_graph_synthetic_v1.json", "BD1A2EFEC3EE741617AAC853E5F0ED0160CE1F0FAF625F0E1E6B6B4D4BE535D8"),
    "cases_fixture_sha256": ("tooling/wiki/tests/fixtures/wiki_graph_product_cases_v1.json", "615C2BD4C893500D1F42C2A3AEB4E576008D347F81A27D446B66D4BF1BD3CE21"),
}
# An envelope assertion for the synthetic fixture, not proof of Git object provenance.
SOURCE_OID = "0123456789abcdef0123456789abcdef01234567"

CONFIG_NAME = "mcp-config.json"
SIDECAR_NAME = "mcp-config.json.sha256"
SERVER_NAME = "wiki_graph"
PROFILES = ("local_owner", "ci_windows_2025")
MAX_INPUT_BYTES = 4_194_304
MAX_CONFIG_BYTES = 65_536
_RUN_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", re.ASCII)
_REPARSE = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)

# One model-free lifecycle: initialize, initialized notification, tools/list, one call per tool.
LIFECYCLE_REQUESTS = [
    {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
    {"jsonrpc": "2.0", "method": "notifications/initialized"},
    {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
    {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "graph_stats", "arguments": {}}},
    {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "query_graph", "arguments": {"query": "pkg"}}},
    {"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "get_node", "arguments": {"node_id": "a"}}},
    {"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "get_neighbors", "arguments": {"node_id": "d", "direction": "both", "depth": 2}}},
    {"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "shortest_path", "arguments": {"source_id": "a", "target_id": "z"}}},
    {"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "get_community", "arguments": {"community_id": "extra"}}},
    {"jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": {"name": "god_nodes", "arguments": {"limit": 3}}},
]


class SessionRefused(Exception):
    """A fail-closed refusal. ``code`` is a short stable diagnostic."""

    def __init__(self, code: str, detail: str = ""):
        self.code = code
        self.detail = detail
        super().__init__(f"{code}:{detail}" if detail else code)


def lifecycle_payload() -> bytes:
    return b"".join(json.dumps(item, separators=(",", ":")).encode("ascii") + b"\n" for item in LIFECYCLE_REQUESTS)


# ---------------------------------------------------------------------------------------------
# Path safety
# ---------------------------------------------------------------------------------------------

def _is_reparse(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & _REPARSE)


def _norm(path: str) -> str:
    return os.path.normcase(os.path.realpath(path))


def _within(path: str, root: str) -> bool:
    child, parent = _norm(path), _norm(root)
    try:
        return os.path.commonpath([child, parent]) == parent
    except ValueError:
        return False


def _check_form(path: Any) -> str:
    """Absolute, non-UNC, no '.' or '..' segments, no drive-relative or stream forms."""
    if path.__class__ is not str or not path or not os.path.isabs(path) or path.startswith(("\\\\", "//")) or ":" in path[2:]:
        raise SessionRefused("PATH_FORM", "absolute local path required")
    drive, rest = os.path.splitdrive(path)
    if not drive or any(part in (".", "..") for part in rest.replace("/", os.sep).split(os.sep)):
        raise SessionRefused("PATH_FORM", "no dot segments")
    return os.path.abspath(path)


def _check_chain(path: str) -> None:
    """Every component from the drive root down must exist and be neither symlink nor reparse point."""
    final = _check_form(path)
    current = os.path.splitdrive(final)[0] + os.sep
    for part in [item for item in final[len(current):].split(os.sep) if item]:
        current = os.path.join(current, part)
        try:
            info = os.lstat(current)
        except OSError as exc:
            raise SessionRefused("PATH_MISSING", part) from exc
        if _is_reparse(info):
            raise SessionRefused("REPARSE", part)


def _regular_file(path: str) -> os.stat_result:
    try:
        info = os.lstat(path)
    except OSError as exc:
        raise SessionRefused("NOT_REGULAR", os.path.basename(path)) from exc
    if _is_reparse(info) or not stat.S_ISREG(info.st_mode):
        raise SessionRefused("NOT_REGULAR", os.path.basename(path))
    return info


def _directory(path: str) -> None:
    try:
        info = os.lstat(path)
    except OSError as exc:
        raise SessionRefused("NOT_DIRECTORY", os.path.basename(path)) from exc
    if _is_reparse(info) or not stat.S_ISDIR(info.st_mode):
        raise SessionRefused("NOT_DIRECTORY", os.path.basename(path))


def _read_regular(path: str, limit: int) -> bytes:
    _regular_file(path)
    with open(path, "rb") as stream:
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise SessionRefused("TOO_LARGE", os.path.basename(path))
    return data


def _create_new(path: str, data: bytes) -> None:
    """Exclusive create-new. An existing name (file, dir, link) is refused, never overwritten."""
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0)
    try:
        fd = os.open(path, flags, 0o600)
    except FileExistsError as exc:
        raise SessionRefused("FILE_EXISTS", os.path.basename(path)) from exc
    except OSError as exc:
        raise SessionRefused("FILE_CREATE", os.path.basename(path)) from exc
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)


def _check_base(base: str, repo_root: str) -> str:
    """The caller-owned base: existing real directory beneath the OS temp root, outside every repository."""
    base_abs = _check_form(base)
    _check_chain(base_abs)
    _directory(base_abs)
    temp_root = os.path.abspath(tempfile.gettempdir())
    if not _within(base_abs, temp_root):
        raise SessionRefused("BASE_OUTSIDE_TEMP")
    if _within(base_abs, repo_root) or _within(repo_root, base_abs):
        raise SessionRefused("BASE_IN_REPOSITORY")
    walker = _norm(base_abs)
    stop = _norm(temp_root)
    while True:
        if os.path.lexists(os.path.join(walker, ".git")):
            raise SessionRefused("BASE_IN_REPOSITORY", ".git")
        # A standard bare repository has no .git entry: HEAD file + objects/ + refs/ directories.
        if os.path.isfile(os.path.join(walker, "HEAD")) and os.path.isdir(os.path.join(walker, "objects")) and os.path.isdir(os.path.join(walker, "refs")):
            raise SessionRefused("BASE_IN_REPOSITORY", "bare")
        if walker == stop or os.path.dirname(walker) == walker:
            break
        walker = os.path.dirname(walker)
    return base_abs


# ---------------------------------------------------------------------------------------------
# Identity: interpreter profile and product pins
# ---------------------------------------------------------------------------------------------

def _sha256_upper(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def runtime_observation() -> dict[str, str]:
    """Verify and describe the running interpreter. local_owner is bound to the exact workstation
    path and hash; ci_windows_2025 records the fresh observation (validated against the job-start
    observation by the CI validator, never compared to the workstation values)."""
    if sys.version_info[:2] != (3, 11):
        raise SessionRefused("PYTHON_VERSION", platform.python_version())
    exe = os.path.abspath(sys.executable)
    with open(exe, "rb") as stream:
        digest = _sha256_upper(stream.read())
    if os.path.normcase(exe) == os.path.normcase(LOCAL_PYTHON):
        if digest != LOCAL_PYTHON_SHA256:
            raise SessionRefused("PYTHON_HASH")
        profile = "local_owner"
    elif os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("RUNNER_OS") == "Windows":
        profile = "ci_windows_2025"
    else:
        raise SessionRefused("RUNTIME_PROFILE")
    return {"profile": profile, "python_version": platform.python_version(), "resolved_executable_path": exe, "executable_sha256": digest}


def _authenticated_repo(repo_root: str | None) -> str:
    root = _check_form(repo_root or REPO_ROOT)
    _directory(root)
    own = os.path.join(root, "tooling", "wiki", "wiki_graph_session.py")
    if not os.path.exists(own) or _norm(own) != _norm(__file__):
        raise SessionRefused("REPO_ROOT", "helper is not part of this repository")
    return root


def verify_product_pins(repo_root: str | None = None, pins: dict[str, tuple[str, str]] | None = None) -> dict[str, str]:
    """Hash the four bound inputs against the literal pins. Refuse missing/non-regular inputs,
    any reparse component, escape from the repository root, or a hash mismatch."""
    root = _authenticated_repo(repo_root)
    table = PRODUCT_PINS if pins is None else pins
    observed: dict[str, str] = {}
    for name, (rel, expected) in table.items():
        path = os.path.join(root, *rel.split("/"))
        _check_chain(path)
        if not _within(path, root):
            raise SessionRefused("INPUT_ESCAPE", rel)
        digest = _sha256_upper(_read_regular(path, MAX_INPUT_BYTES))
        if digest != expected:
            raise SessionRefused("PIN_MISMATCH", name)
        observed[name] = digest
    return observed


# ---------------------------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------------------------

def _expected_args(root: str, pins: dict[str, str]) -> list[str]:
    adapter = os.path.join(root, "tooling", "wiki", "wiki_graph_mcp.py")
    graph = os.path.join(root, "tooling", "wiki", "tests", "fixtures", "wiki_graph_synthetic_v1.json")
    return ["-I", "-B", adapter, "--graph", graph, "--graph-sha256", pins["synthetic_fixture_sha256"].lower(), "--source-oid", SOURCE_OID]


def _canonical(config: dict[str, Any]) -> bytes:
    return (json.dumps(config, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode("ascii")


def _sidecar(config_bytes: bytes) -> bytes:
    return f"{_sha256_upper(config_bytes)}  {CONFIG_NAME}\n".encode("ascii")


def _strict_loads(text: str) -> Any:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        keys = [key for key, _ in items]
        if len(keys) != len(set(keys)):
            raise ValueError("duplicate key")
        return dict(items)

    def constant(name: str) -> Any:
        raise ValueError(name)

    return json.loads(text, object_pairs_hook=pairs, parse_constant=constant)


def prepare(base: str, run_id: str, *, repo_root: str | None = None) -> dict[str, Any]:
    """Create one fresh run leaf under ``base`` holding exactly the config and its hash sidecar."""
    root = _authenticated_repo(repo_root)
    runtime = runtime_observation()
    pins = verify_product_pins(root)
    if run_id.__class__ is not str or _RUN_ID.fullmatch(run_id) is None:
        raise SessionRefused("RUN_ID")
    base_abs = _check_base(base, root)
    leaf = os.path.join(base_abs, run_id)
    try:
        os.mkdir(leaf)
    except FileExistsError as exc:
        raise SessionRefused("LEAF_EXISTS", run_id) from exc
    except OSError as exc:
        raise SessionRefused("LEAF_CREATE", run_id) from exc
    _directory(leaf)
    config = {"mcpServers": {SERVER_NAME: {"command": runtime["resolved_executable_path"], "args": _expected_args(root, pins)}}}
    data = _canonical(config)
    config_path = os.path.join(leaf, CONFIG_NAME)
    sidecar_path = os.path.join(leaf, SIDECAR_NAME)
    _create_new(config_path, data)
    _create_new(sidecar_path, _sidecar(data))
    return {"leaf": leaf, "config_path": config_path, "sidecar_path": sidecar_path, "config_sha256": _sha256_upper(data), "runtime": runtime}


def validate(config_path: str, *, repo_root: str | None = None) -> dict[str, Any]:
    """Revalidate everything, then return the validated config path and its argv. The argv is derived
    ONLY from the parsed, schema-checked, byte-canonical config file."""
    root = _authenticated_repo(repo_root)
    config_abs = _check_form(config_path)
    _check_chain(config_abs)
    leaf = os.path.dirname(config_abs)
    if os.path.basename(config_abs) != CONFIG_NAME:
        raise SessionRefused("CONFIG_NAME")
    _directory(leaf)
    _check_base(os.path.dirname(leaf), root)
    if sorted(os.listdir(leaf)) != sorted([CONFIG_NAME, SIDECAR_NAME]):
        raise SessionRefused("LEAF_LISTING")
    runtime = runtime_observation()
    pins = verify_product_pins(root)
    data = _read_regular(config_abs, MAX_CONFIG_BYTES)
    if _read_regular(os.path.join(leaf, SIDECAR_NAME), MAX_CONFIG_BYTES) != _sidecar(data):
        raise SessionRefused("SIDECAR")
    try:
        config = _strict_loads(data.decode("ascii"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise SessionRefused("PARSE") from exc
    if config.__class__ is not dict or set(config) != {"mcpServers"} or config["mcpServers"].__class__ is not dict or set(config["mcpServers"]) != {SERVER_NAME}:
        raise SessionRefused("SCHEMA", "exactly one server named wiki_graph")
    server = config["mcpServers"][SERVER_NAME]
    if server.__class__ is not dict or set(server) != {"command", "args"} or server["command"].__class__ is not str or server["args"].__class__ is not list:
        raise SessionRefused("SCHEMA", "server keys")
    if server["command"] != runtime["resolved_executable_path"] or server["args"] != _expected_args(root, pins):
        raise SessionRefused("ARGS")
    if _canonical(config) != data:
        raise SessionRefused("CANONICAL")
    return {"config_path": config_abs, "argv": [server["command"], *server["args"]], "config_sha256": _sha256_upper(data), "runtime": runtime, "pins": pins}


# ---------------------------------------------------------------------------------------------
# Lifecycle runner and teardown
# ---------------------------------------------------------------------------------------------

def _drain(stream: Any, sink: dict[str, bytes], key: str) -> None:
    try:
        sink[key] = stream.read()
    except (OSError, ValueError):
        sink[key] = b""


def run_validated(config_path: str, payload: bytes, *, timeout: float = 30, teardown_timeout: float = 5, close_stdin: bool = True, repo_root: str | None = None) -> dict[str, Any]:
    """Validate immediately before use, spawn ONLY the validated argv, and tear down through the
    retained direct process handle: close stdin, drain both pipes, wait; on timeout terminate then
    kill that direct child only. No process tree, PID-only kill, or taskkill."""
    validated = validate(config_path, repo_root=repo_root)
    argv = validated["argv"]
    cwd = os.path.dirname(os.path.dirname(validated["config_path"]))
    env = {"SYSTEMROOT": os.environ.get("SYSTEMROOT", r"C:\WINDOWS"), "WINDIR": os.environ.get("WINDIR", r"C:\WINDOWS")}
    process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False)
    sink = {"out": b"", "err": b""}
    readers = [threading.Thread(target=_drain, args=(process.stdout, sink, "out"), daemon=True), threading.Thread(target=_drain, args=(process.stderr, sink, "err"), daemon=True)]
    for reader in readers:
        reader.start()
    timed_out = False
    try:
        try:
            process.stdin.write(payload)
            process.stdin.flush()
            if close_stdin:
                process.stdin.close()
        except OSError:
            pass
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            process.terminate()
            try:
                process.wait(timeout=teardown_timeout)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=teardown_timeout)
    finally:
        if process.poll() is None:
            process.kill()
        try:
            process.stdin.close()
        except OSError:
            pass
        for reader in readers:
            reader.join(timeout=teardown_timeout)
    return {"argv": argv, "returncode": process.returncode, "stdout": sink["out"], "stderr": sink["err"], "timed_out": timed_out, "child_exited": process.poll() is not None, "config_sha256": validated["config_sha256"]}


def teardown(leaf: str) -> None:
    """Remove ONLY the two owned regular files and the now-empty owned leaf. Anything unexpected is
    refused and the leaf is preserved for inspection; there is no recursive cleanup."""
    _check_chain(leaf)
    _directory(leaf)
    if sorted(os.listdir(leaf)) != sorted([CONFIG_NAME, SIDECAR_NAME]):
        raise SessionRefused("TEARDOWN_UNEXPECTED")
    for name in (CONFIG_NAME, SIDECAR_NAME):
        _regular_file(os.path.join(leaf, name))
    for name in (CONFIG_NAME, SIDECAR_NAME):
        os.remove(os.path.join(leaf, name))
    os.rmdir(leaf)


def parse_frames(stdout: bytes) -> list[Any]:
    """Complete newline-delimited JSON frames only; a trailing partial frame is refused."""
    if not stdout:
        return []
    if not stdout.endswith(b"\n"):
        raise SessionRefused("PARTIAL_FRAME")
    return [json.loads(line) for line in stdout[:-1].split(b"\n")]


def smoke(base: str, run_id: str, *, repo_root: str | None = None) -> dict[str, Any]:
    """Test-only: prepare, run one lifecycle through the validated config, tear down."""
    prepared = prepare(base, run_id, repo_root=repo_root)
    result = run_validated(prepared["config_path"], lifecycle_payload(), repo_root=repo_root)
    # Fail closed: any abnormal outcome refuses (nonzero CLI exit) and preserves the leaf for inspection.
    if result["timed_out"] or not result["child_exited"] or result["returncode"] != 0 or result["stderr"] != b"":
        raise SessionRefused("SMOKE_FAILED", "child exit/stderr/timeout")
    frames = parse_frames(result["stdout"])
    if [frame.get("id") if isinstance(frame, dict) else None for frame in frames] != list(range(1, 10)) or any("error" in frame or "result" not in frame for frame in frames):
        raise SessionRefused("SMOKE_FAILED", "responses")
    teardown(prepared["leaf"])
    return {
        "argv": result["argv"],
        "returncode": result["returncode"],
        "stderr": result["stderr"],
        "timed_out": result["timed_out"],
        "child_exited": result["child_exited"],
        "responses": frames,
        "config_sha256": result["config_sha256"],
        "runtime": prepared["runtime"],
    }


def _cli(argv: list[str]) -> int:
    try:
        if len(argv) == 3 and argv[0] == "prepare":
            out: Any = prepare(argv[1], argv[2])
        elif len(argv) == 2 and argv[0] == "validate":
            out = validate(argv[1])
        elif len(argv) == 3 and argv[0] == "smoke":
            out = smoke(argv[1], argv[2])
            out = {key: (value.decode("ascii", "replace") if isinstance(value, bytes) else value) for key, value in out.items()}
        else:
            sys.stderr.write("usage: wiki_graph_session.py prepare <base> <run_id> | validate <config_path> | smoke <base> <run_id>\n")
            return 2
    except SessionRefused as exc:
        sys.stderr.write(f"SESSION_REFUSED:{exc.code}\n")
        return 2
    sys.stdout.write(json.dumps(out, sort_keys=True, separators=(",", ":")) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv[1:]))
