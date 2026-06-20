"""
db2_guard.py -- shared integrity + environment pre-flight guards for the
matrix-map DB2 tooling (geocode_bc_csr.py, etl_bnrrm_to_supabase.py).

This is the SINGLE SOURCE OF TRUTH for the canonical DB2 SHA-256 + size,
recorded in docs/design/matrix-map/DB2_ADOPTION.md (ADOPTED 2026-06-16). Per
that record: "Any rerun of the geocoder / ETL MUST verify this SHA-256 and
hard-fail / warn on mismatch." Keeping the constant here (not duplicated in each
script) avoids drift between the two consumers.

Plain ASCII only. Python 3.11+. Stdlib only.
"""

from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path
from typing import Callable

# Canonical DB2 = bnrrm_training_DB2_20260503.db. Source of truth for these
# values: docs/design/matrix-map/DB2_ADOPTION.md (Canonical artifact section).
DB2_EXPECTED_SHA256 = (
    "73a4aa9ca7ff70446c367f7429a3be611ec8bd01e27daa3d9d6467dd7c3631df"
)
DB2_EXPECTED_SIZE_BYTES = 65466368
DB2_CANONICAL_FILENAME = "bnrrm_training_DB2_20260503.db"

_READ_CHUNK = 1 << 20  # 1 MiB streaming blocks (DB2 is ~62 MB)


LogFn = Callable[..., None]


def _emit(log: LogFn | None, phase: str, **fields) -> None:
    """Route a structured event through the caller's logger, else to stderr."""
    if log is not None:
        log(phase, **fields)
    else:
        sys.stderr.write(f"[db2_guard] {phase}: {fields}\n")
        sys.stderr.flush()


class Db2IntegrityError(RuntimeError):
    """Raised when a DB2 integrity check fails under hard_fail=True."""


def sha256_file(path: Path, *, chunk_size: int = _READ_CHUNK) -> str:
    """Stream a file through SHA-256 (constant memory)."""
    h = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for block in iter(lambda: fh.read(chunk_size), b""):
            h.update(block)
    return h.hexdigest()


def looks_like_db2(path: Path | str) -> bool:
    """True when `path`'s filename matches the canonical DB2 artifact name.

    Filename match (not resolve()) is robust across drive letters / Google Drive
    mount points where path resolution can differ between machines.
    """
    return Path(path).name.lower() == DB2_CANONICAL_FILENAME.lower()


def decide_integrity_check(
    explicit_sha: str | None,
    source_path: Path | str,
    *,
    default_enforce: bool,
) -> tuple[str | None, int | None, bool]:
    """Decide the integrity-check parameters for a source DB.

    Returns ``(expected_sha256, expected_size, should_check)``:
      - ``explicit_sha`` given -> check it; size is pinned to the DB2 size ONLY
        when the hash equals the canonical DB2 hash, else None (a custom hash is
        for a file of unknown size, so do not size-gate it).
      - else if the source looks like the canonical DB2 -> enforce DB2 hash+size.
      - else if ``default_enforce`` (the caller's default source IS DB2, e.g. the
        geocoder) -> enforce DB2 hash+size.
      - else -> no check (``should_check`` False); the caller logs a skip (e.g.
        the ETL whose historical default source is the stale DB1).

    Centralizing this here keeps the two consumers' enforcement policy identical
    and unit-testable (the inline form previously diverged: the geocoder size-gated
    a custom hash, the ETL did not).
    """
    if explicit_sha is not None:
        size = DB2_EXPECTED_SIZE_BYTES if explicit_sha == DB2_EXPECTED_SHA256 else None
        return explicit_sha, size, True
    if looks_like_db2(source_path) or default_enforce:
        return DB2_EXPECTED_SHA256, DB2_EXPECTED_SIZE_BYTES, True
    return None, None, False


def verify_db2_integrity(
    path: Path,
    *,
    expected_sha256: str = DB2_EXPECTED_SHA256,
    expected_size: int | None = DB2_EXPECTED_SIZE_BYTES,
    hard_fail: bool = True,
    log: LogFn | None = None,
) -> bool:
    """Verify a DB file matches the canonical DB2 hash. Return True on match.

    A fast size pre-check short-circuits before hashing an obviously-wrong file.
    On any mismatch (missing / size / sha): raise Db2IntegrityError when
    hard_fail (default), else log and return False.
    """
    p = Path(path)
    if not p.exists():
        _emit(log, "db2_integrity_error", reason="file missing", path=str(p))
        if hard_fail:
            raise Db2IntegrityError(f"DB2 file missing: {p}")
        return False

    if expected_size is not None:
        actual_size = p.stat().st_size
        if actual_size != expected_size:
            _emit(
                log, "db2_integrity_mismatch", kind="size",
                expected=expected_size, actual=actual_size, path=str(p),
            )
            if hard_fail:
                raise Db2IntegrityError(
                    f"DB2 size mismatch: expected {expected_size}, "
                    f"got {actual_size} ({p})"
                )
            return False

    actual_sha = sha256_file(p)
    if actual_sha != expected_sha256:
        _emit(
            log, "db2_integrity_mismatch", kind="sha256",
            expected=expected_sha256, actual=actual_sha, path=str(p),
        )
        if hard_fail:
            raise Db2IntegrityError(
                f"DB2 SHA-256 mismatch: expected {expected_sha256}, "
                f"got {actual_sha} ({p})"
            )
        return False

    _emit(
        log, "db2_integrity_ok",
        sha256=actual_sha, size=p.stat().st_size, path=str(p),
    )
    return True


def check_venv(log: LogFn | None = None) -> bool:
    """Log the active interpreter; warn (do not fail) when it is not the repo .venv.

    Per CLAUDE.md "Venv / Node check": prefer .venv/Scripts/python.exe for
    scripts/ helpers. Returns True only when running inside a virtualenv whose
    prefix looks like the repo .venv.
    """
    prefix = sys.prefix
    in_venv = (
        sys.prefix != getattr(sys, "base_prefix", sys.prefix)
        or bool(os.environ.get("VIRTUAL_ENV"))
    )
    # Match ".venv" as a PATH COMPONENT, not a loose substring (so ".venv-old"
    # or an unrelated path containing the literal ".venv" does not read as OK).
    parts = {part.lower() for part in Path(prefix).parts}
    looks_repo_venv = ".venv" in parts
    if in_venv and looks_repo_venv:
        _emit(log, "venv_ok", prefix=prefix)
        return True
    _emit(
        log, "venv_warning",
        msg="not running from the repo .venv; prefer .venv/Scripts/python.exe",
        prefix=prefix, in_venv=in_venv,
    )
    return False
