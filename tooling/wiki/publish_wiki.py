import argparse
import hashlib
import os
import re
import shutil
import stat
import sys
from pathlib import Path


class PublishError(RuntimeError):
    pass


def _validated_sha256(expected_sha256: str) -> str:
    if re.fullmatch(r"[0-9a-f]{64}", expected_sha256) is None:
        raise PublishError("expected graph SHA-256 must be 64 lowercase hex characters")
    return expected_sha256


def _require_graph_sha256(
    graph_path: Path,
    expected_sha256: str,
    *,
    surface: str,
) -> None:
    actual_sha256 = hashlib.sha256(graph_path.read_bytes()).hexdigest()
    if actual_sha256 != expected_sha256:
        raise PublishError(
            f"{surface} graph SHA-256 mismatch: "
            f"expected {expected_sha256}, found {actual_sha256}"
        )


def _is_link_or_junction(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    if is_junction and is_junction():
        return True
    try:
        attributes = os.lstat(path).st_file_attributes
    except (AttributeError, FileNotFoundError):
        return False
    reparse_point = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return bool(attributes & reparse_point)


def checked_path(repo_root: Path, candidate: Path) -> Path:
    root = repo_root.resolve()
    candidate_path = candidate if candidate.is_absolute() else root / candidate
    path = Path(os.path.abspath(candidate_path))
    resolved_path = path.resolve()
    if path == root or resolved_path == root:
        raise PublishError("refusing to operate on the repository root")
    try:
        resolved_path.relative_to(root)
    except ValueError as exc:
        raise PublishError(
            f"path is outside repository root: {resolved_path}"
        ) from exc
    return path


def validate_tree_no_links(root: Path) -> None:
    pending = [root]
    while pending:
        current = pending.pop()
        for child in current.iterdir():
            if _is_link_or_junction(child):
                raise PublishError(
                    f"refusing linked entry in wiki package: {child}"
                )
            if child.is_dir():
                pending.append(child)


def remove_owned_tree(path: Path) -> None:
    if not path.exists():
        return
    if _is_link_or_junction(path):
        raise PublishError(f"refusing to remove link or junction: {path}")
    if not path.is_dir():
        raise PublishError(f"expected directory: {path}")
    validate_tree_no_links(path)
    shutil.rmtree(path)


def prepare_staging(served: Path, staging: Path) -> None:
    remove_owned_tree(staging)
    if served.exists():
        if _is_link_or_junction(served) or not served.is_dir():
            raise PublishError(f"served wiki must be a real directory: {served}")
        validate_tree_no_links(served)
        shutil.copytree(served, staging)
        validate_tree_no_links(staging)
    else:
        staging.mkdir(parents=True)


def finalize_staging(
    *,
    staging: Path,
    graph: Path,
    graph_report: Path,
    stamp: str,
    head: str,
    expected_graph_sha256: str,
    promotion_state: Path | None = None,
) -> None:
    expected_graph_sha256 = _validated_sha256(expected_graph_sha256)
    if not staging.is_dir():
        raise PublishError(f"staging wiki does not exist: {staging}")
    validate_tree_no_links(staging)
    if not graph.is_file():
        raise PublishError(f"graph does not exist: {graph}")

    graph_dir = staging / ".graph"
    graph_dir.mkdir(parents=True, exist_ok=True)
    staged_graph = graph_dir / "graph.json"
    shutil.copy2(graph, staged_graph)
    _require_graph_sha256(
        staged_graph,
        expected_graph_sha256,
        surface="staged",
    )

    staged_report = graph_dir / "GRAPH_REPORT.md"
    if graph_report.is_file():
        shutil.copy2(graph_report, staged_report)
    elif staged_report.exists():
        staged_report.unlink()

    if promotion_state is not None:
        if not promotion_state.is_file():
            raise PublishError(f"promotion candidate does not exist: {promotion_state}")
        shutil.copy2(promotion_state, graph_dir / "promotion.json")

    stamp_path = staging / ".build-stamp"
    stamp_tmp = staging / ".build-stamp.tmp"
    stamp_tmp.write_text(
        f"Build Stamp: {stamp}\nHEAD: {head}\n",
        encoding="ascii",
    )
    os.replace(stamp_tmp, stamp_path)


def swap_staging(
    *,
    served: Path,
    staging: Path,
    backup: Path,
    expected_graph_sha256: str,
) -> None:
    expected_graph_sha256 = _validated_sha256(expected_graph_sha256)
    if not staging.is_dir():
        raise PublishError(f"staging wiki does not exist: {staging}")
    validate_tree_no_links(staging)
    _require_graph_sha256(
        staging / ".graph" / "graph.json",
        expected_graph_sha256,
        surface="staged",
    )
    if backup.exists():
        raise PublishError(f"backup path already exists: {backup}")
    backup.parent.mkdir(parents=True, exist_ok=True)

    moved_old = False
    if served.exists():
        if _is_link_or_junction(served) or not served.is_dir():
            raise PublishError(f"served wiki must be a real directory: {served}")
        served.rename(backup)
        moved_old = True

    try:
        staging.rename(served)
    except OSError as publish_exc:
        if moved_old:
            try:
                backup.rename(served)
            except OSError as rollback_exc:
                raise PublishError(
                    f"publish failed and rollback failed: {publish_exc}; {rollback_exc}"
                ) from rollback_exc
        raise PublishError(f"publish failed; last-good restored: {publish_exc}") from publish_exc

    try:
        _require_graph_sha256(
            served / ".graph" / "graph.json",
            expected_graph_sha256,
            surface="served",
        )
    except (OSError, PublishError) as verification_exc:
        try:
            if staging.exists():
                raise PublishError(
                    f"rollback staging path unexpectedly exists: {staging}"
                )
            served.rename(staging)
            if moved_old:
                backup.rename(served)
        except (OSError, PublishError) as rollback_exc:
            raise PublishError(
                "published graph verification failed and rollback failed: "
                f"{verification_exc}; {rollback_exc}"
            ) from rollback_exc
        if moved_old:
            raise PublishError(
                "published graph verification failed; last-good restored: "
                f"{verification_exc}"
            ) from verification_exc
        raise PublishError(
            "published graph verification failed; rejected candidate retained "
            f"at staging: {verification_exc}"
        ) from verification_exc

    if moved_old:
        try:
            remove_owned_tree(backup)
        except (OSError, PublishError) as cleanup_exc:
            print(f"WARN: served wiki swapped but backup cleanup failed: {cleanup_exc}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare, finalize, or atomically swap the served wiki package."
    )
    parser.add_argument("--repo-root", type=Path, required=True)
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare = subparsers.add_parser("prepare")
    prepare.add_argument("--served", type=Path, required=True)
    prepare.add_argument("--staging", type=Path, required=True)

    finalize = subparsers.add_parser("finalize")
    finalize.add_argument("--staging", type=Path, required=True)
    finalize.add_argument("--graph", type=Path, required=True)
    finalize.add_argument("--graph-report", type=Path, required=True)
    finalize.add_argument("--stamp", required=True)
    finalize.add_argument("--head", required=True)
    finalize.add_argument("--expected-graph-sha256", required=True)
    finalize.add_argument("--promotion-state", type=Path)

    swap = subparsers.add_parser("swap")
    swap.add_argument("--served", type=Path, required=True)
    swap.add_argument("--staging", type=Path, required=True)
    swap.add_argument("--backup", type=Path, required=True)
    swap.add_argument("--expected-graph-sha256", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        repo_root = args.repo_root.resolve()
        if args.command == "prepare":
            prepare_staging(
                checked_path(repo_root, args.served),
                checked_path(repo_root, args.staging),
            )
        elif args.command == "finalize":
            finalize_staging(
                staging=checked_path(repo_root, args.staging),
                graph=checked_path(repo_root, args.graph),
                graph_report=checked_path(repo_root, args.graph_report),
                stamp=args.stamp,
                head=args.head,
                expected_graph_sha256=args.expected_graph_sha256,
                promotion_state=(
                    checked_path(repo_root, args.promotion_state)
                    if args.promotion_state is not None
                    else None
                ),
            )
        else:
            swap_staging(
                served=checked_path(repo_root, args.served),
                staging=checked_path(repo_root, args.staging),
                backup=checked_path(repo_root, args.backup),
                expected_graph_sha256=args.expected_graph_sha256,
            )
    except (OSError, PublishError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
