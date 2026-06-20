"""
test_db2_guard.py -- stdlib unittest coverage for db2_guard.

No dependency on the real 62 MB DB2 artifact: integrity checks are exercised with
synthetic temp files whose expected hash/size we control. Run with:

    .venv/Scripts/python.exe -m unittest scripts.matrix-map.test_db2_guard
  or, from this folder:
    ../../.venv/Scripts/python.exe -m unittest test_db2_guard

Plain ASCII only. Python 3.11+. Stdlib only.
"""

from __future__ import annotations

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

# Allow `import db2_guard` whether run via discovery from repo root or directly.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import db2_guard  # noqa: E402
from db2_guard import (  # noqa: E402
    DB2_CANONICAL_FILENAME,
    DB2_EXPECTED_SHA256,
    DB2_EXPECTED_SIZE_BYTES,
    Db2IntegrityError,
    check_venv,
    decide_integrity_check,
    looks_like_db2,
    sha256_file,
    verify_db2_integrity,
)

_ADOPTION_DOC = (
    Path(__file__).resolve().parents[2]
    / "docs" / "design" / "matrix-map" / "DB2_ADOPTION.md"
)


def _write_tmp(content: bytes) -> Path:
    fh = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    try:
        fh.write(content)
    finally:
        fh.close()
    return Path(fh.name)


class Sha256FileTest(unittest.TestCase):
    def test_matches_hashlib(self) -> None:
        content = b"matrix-map db2 guard test bytes"
        p = _write_tmp(content)
        try:
            self.assertEqual(sha256_file(p), hashlib.sha256(content).hexdigest())
        finally:
            p.unlink(missing_ok=True)


class VerifyIntegrityTest(unittest.TestCase):
    def setUp(self) -> None:
        self.content = b"canonical-db2-stand-in"
        self.sha = hashlib.sha256(self.content).hexdigest()
        self.size = len(self.content)
        self.path = _write_tmp(self.content)

    def tearDown(self) -> None:
        self.path.unlink(missing_ok=True)

    def test_match_returns_true(self) -> None:
        self.assertTrue(
            verify_db2_integrity(
                self.path, expected_sha256=self.sha, expected_size=self.size,
            )
        )

    def test_sha_mismatch_hard_fail_raises(self) -> None:
        with self.assertRaises(Db2IntegrityError):
            verify_db2_integrity(
                self.path, expected_sha256="0" * 64, expected_size=self.size,
            )

    def test_sha_mismatch_soft_returns_false(self) -> None:
        self.assertFalse(
            verify_db2_integrity(
                self.path, expected_sha256="0" * 64, expected_size=self.size,
                hard_fail=False,
            )
        )

    def test_size_mismatch_raises_before_hashing(self) -> None:
        with self.assertRaises(Db2IntegrityError):
            verify_db2_integrity(
                self.path, expected_sha256=self.sha, expected_size=self.size + 1,
            )

    def test_size_none_skips_size_check(self) -> None:
        self.assertTrue(
            verify_db2_integrity(
                self.path, expected_sha256=self.sha, expected_size=None,
            )
        )

    def test_missing_file_soft_returns_false(self) -> None:
        self.assertFalse(
            verify_db2_integrity(
                Path("does-not-exist-xyz.db"), hard_fail=False,
            )
        )

    def test_missing_file_hard_fail_raises(self) -> None:
        with self.assertRaises(Db2IntegrityError):
            verify_db2_integrity(Path("does-not-exist-xyz.db"))


class LooksLikeDb2Test(unittest.TestCase):
    def test_canonical_filename_true_any_dir(self) -> None:
        self.assertTrue(
            looks_like_db2(Path("/some/where/bnrrm_training_DB2_20260503.db"))
        )

    def test_case_insensitive(self) -> None:
        self.assertTrue(looks_like_db2(Path("BNRRM_TRAINING_DB2_20260503.DB")))

    def test_other_db_false(self) -> None:
        self.assertFalse(looks_like_db2(Path("/x/bnrrm_training.db")))


class DecideIntegrityCheckTest(unittest.TestCase):
    NON_DB2 = Path("/x/bnrrm_training.db")
    DB2 = Path("/x/" + DB2_CANONICAL_FILENAME)

    def test_explicit_db2_hash_pins_size(self) -> None:
        sha, size, should = decide_integrity_check(
            DB2_EXPECTED_SHA256, self.NON_DB2, default_enforce=False,
        )
        self.assertEqual((sha, size, should), (DB2_EXPECTED_SHA256, DB2_EXPECTED_SIZE_BYTES, True))

    def test_explicit_custom_hash_relaxes_size(self) -> None:
        # The finding-1 fix: a custom hash must NOT be size-gated to the DB2 size.
        sha, size, should = decide_integrity_check(
            "a" * 64, self.NON_DB2, default_enforce=False,
        )
        self.assertEqual((sha, size, should), ("a" * 64, None, True))

    def test_db2_named_source_enforces_without_explicit(self) -> None:
        sha, size, should = decide_integrity_check(
            None, self.DB2, default_enforce=False,
        )
        self.assertEqual((sha, size, should), (DB2_EXPECTED_SHA256, DB2_EXPECTED_SIZE_BYTES, True))

    def test_non_db2_source_without_explicit_skips_when_not_default_enforce(self) -> None:
        # The ETL case: stale-DB1 default source -> no check, caller logs skip.
        self.assertEqual(
            decide_integrity_check(None, self.NON_DB2, default_enforce=False),
            (None, None, False),
        )

    def test_default_enforce_enforces_any_source(self) -> None:
        # The geocode case: default source IS DB2 -> always enforce DB2 hash+size.
        sha, size, should = decide_integrity_check(
            None, self.NON_DB2, default_enforce=True,
        )
        self.assertEqual((sha, size, should), (DB2_EXPECTED_SHA256, DB2_EXPECTED_SIZE_BYTES, True))


class CheckVenvTest(unittest.TestCase):
    def test_returns_bool_without_raising(self) -> None:
        self.assertIsInstance(check_venv(log=lambda *a, **k: None), bool)


class AdoptionDocDriftTest(unittest.TestCase):
    """The constants here are the single source of truth, but they MUST stay in
    lockstep with the committed DB2_ADOPTION.md record."""

    def test_expected_sha_present_in_adoption_doc(self) -> None:
        if not _ADOPTION_DOC.exists():
            self.skipTest("DB2_ADOPTION.md not found")
        text = _ADOPTION_DOC.read_text(encoding="utf-8")
        self.assertIn(DB2_EXPECTED_SHA256, text)
        # The doc records the size comma-formatted (e.g. "65,466,368 bytes").
        size = db2_guard.DB2_EXPECTED_SIZE_BYTES
        self.assertTrue(
            str(size) in text or f"{size:,}" in text,
            f"DB2 size {size} not found in DB2_ADOPTION.md (plain or comma form)",
        )
        self.assertIn(DB2_CANONICAL_FILENAME, text)


if __name__ == "__main__":
    unittest.main()
