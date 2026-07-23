import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


RECEIPT_SCHEMA_VERSION = 1
FETCH_TIMEOUT_SECONDS = 300
REMOTE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


@dataclass(frozen=True)
class GateConfig:
    remote: str
    branch: str
    required_ref: str


@dataclass(frozen=True)
class FetchReceipt:
    schema_version: int
    remote: str
    branch: str
    required_ref: str
    fetch_succeeded: bool
    fetched_oid: str | None


@dataclass(frozen=True)
class ServeGateDecision:
    allowed: bool
    required_ref: str
    fetched_oid: str | None
    head: str | None
    required_ref_head: str | None
    reasons: list[str]


def run_git(
    repo_root: Path,
    *args: str,
    timeout_seconds: int | None = None,
) -> subprocess.CompletedProcess[str]:
    command = ["git", "-C", str(repo_root), *args]
    environment = os.environ.copy()
    environment["GIT_TERMINAL_PROMPT"] = "0"
    environment["GCM_INTERACTIVE"] = "Never"
    try:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout_seconds,
            env=environment,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(
            args=command,
            returncode=124,
            stdout="",
            stderr=f"git command timed out after {timeout_seconds} seconds",
        )


def load_gate_config(config_path: Path, repo_root: Path) -> GateConfig:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    gate = config.get("serve_gate", {})
    if not isinstance(gate, dict):
        raise ValueError("serve_gate must be an object")

    remote = gate.get("remote", "origin")
    branch = gate.get("branch", "main")
    if not isinstance(remote, str) or not REMOTE_PATTERN.fullmatch(remote):
        raise ValueError("serve_gate.remote is invalid")
    if not isinstance(branch, str) or not branch:
        raise ValueError("serve_gate.branch must be a non-empty string")
    branch_check = run_git(repo_root, "check-ref-format", "--branch", branch)
    if branch_check.returncode != 0:
        raise ValueError("serve_gate.branch is invalid")
    return GateConfig(
        remote=remote,
        branch=branch,
        required_ref=f"refs/remotes/{remote}/{branch}",
    )


def resolve_commit(repo_root: Path, revision: str) -> str | None:
    proc = run_git(repo_root, "rev-parse", "--verify", f"{revision}^{{commit}}")
    if proc.returncode != 0:
        return None
    value = proc.stdout.strip()
    return value or None


def write_receipt(path: Path, receipt: FetchReceipt) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    temp_path.write_text(
        json.dumps(asdict(receipt), indent=2, sort_keys=True) + "\n",
        encoding="ascii",
    )
    os.replace(temp_path, path)


def fetch_required_ref(
    repo_root: Path,
    config: GateConfig,
    receipt_path: Path,
) -> FetchReceipt:
    refspec = (
        f"+refs/heads/{config.branch}:"
        f"refs/remotes/{config.remote}/{config.branch}"
    )
    fetch = run_git(
        repo_root,
        "fetch",
        config.remote,
        refspec,
        timeout_seconds=FETCH_TIMEOUT_SECONDS,
    )
    fetched_oid = (
        resolve_commit(repo_root, config.required_ref)
        if fetch.returncode == 0
        else None
    )
    receipt = FetchReceipt(
        schema_version=RECEIPT_SCHEMA_VERSION,
        remote=config.remote,
        branch=config.branch,
        required_ref=config.required_ref,
        fetch_succeeded=fetch.returncode == 0 and fetched_oid is not None,
        fetched_oid=fetched_oid,
    )
    write_receipt(receipt_path, receipt)
    return receipt


def verify_receipt(
    repo_root: Path,
    config: GateConfig,
    receipt_path: Path,
) -> ServeGateDecision:
    receipt_data = json.loads(receipt_path.read_text(encoding="ascii"))
    receipt = FetchReceipt(**receipt_data)
    head = resolve_commit(repo_root, "HEAD")
    required_ref_head = resolve_commit(repo_root, config.required_ref)
    reasons = []

    if receipt.schema_version != RECEIPT_SCHEMA_VERSION:
        reasons.append("Fetch receipt schema is unsupported")
    if (
        receipt.remote != config.remote
        or receipt.branch != config.branch
        or receipt.required_ref != config.required_ref
    ):
        reasons.append("Fetch receipt does not match current serve-gate config")
    if not receipt.fetch_succeeded or receipt.fetched_oid is None:
        reasons.append("Required remote branch was not fetched successfully")
    if head is None:
        reasons.append("HEAD could not be resolved")
    if required_ref_head is None:
        reasons.append(f"Required ref could not be resolved: {config.required_ref}")
    if (
        receipt.fetched_oid is not None
        and required_ref_head is not None
        and receipt.fetched_oid != required_ref_head
    ):
        reasons.append("Required ref moved after the attested fetch")
    if (
        receipt.fetched_oid is not None
        and head is not None
        and receipt.fetched_oid != head
    ):
        reasons.append("HEAD does not match the attested fetched commit")

    return ServeGateDecision(
        allowed=not reasons,
        required_ref=config.required_ref,
        fetched_oid=receipt.fetched_oid,
        head=head,
        required_ref_head=required_ref_head,
        reasons=reasons,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch and verify the exact remote branch allowed to serve the wiki."
    )
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("fetch", "verify"):
        subparser = subparsers.add_parser(command)
        subparser.add_argument("--receipt", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        repo_root = args.repo_root.resolve()
        config = load_gate_config(args.config, repo_root)
        if args.command == "fetch":
            result = fetch_required_ref(repo_root, config, args.receipt)
            payload = asdict(result)
            allowed = result.fetch_succeeded
        else:
            result = verify_receipt(repo_root, config, args.receipt)
            payload = asdict(result)
            allowed = result.allowed
    except (OSError, TypeError, ValueError, json.JSONDecodeError) as exc:
        payload = {
            "allowed": False,
            "reasons": [f"Serve gate error: {exc}"],
        }
        allowed = False

    print(json.dumps(payload, sort_keys=True))
    return 0 if allowed else 1


if __name__ == "__main__":
    sys.exit(main())
