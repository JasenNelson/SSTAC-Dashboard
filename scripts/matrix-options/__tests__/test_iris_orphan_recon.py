"""Regression tests for the IRIS orphan recon guardrails (scripts/matrix-options/iris-orphan-recon.py).

Covers the 2026-06-03 hardening:
  - norm_casrn: whitespace strip, blank/None sentinel, int/float coercion.
  - colliding_minted_keys: 2+ distinct CASRNs -> collision; 0 or 1 -> not a collision; blanks
    (dropped by the caller) do not inflate the set.
  - exclude_colliding: a colliding minted key is partitioned OUT of BOTH minted-key buckets
    (orphan_new_substance AND ambiguous), while non-colliding entries (including a legitimately
    ambiguous-but-non-colliding entry) are preserved -- so a 2-CASRN-same-key pair can never be
    staged in ANY generation mode (the cross-bucket gap fixed 2026-06-03).

These exercise the recon's pure decision helpers (no Excel/catalog/snapshot I/O). Importing the
module is side-effect-free (main() is guarded by __name__ == "__main__").

Run from the catalog-overnight venv (has openpyxl, which the module imports at top level):
    C:\\Projects\\SSTAC-Dashboard\\scripts\\catalog-overnight\\.venv\\Scripts\\python.exe \\
        -m pytest scripts/matrix-options/__tests__/test_iris_orphan_recon.py -v
"""

from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

# Make the script directory importable without installing it.
_HERE = Path(__file__).resolve().parent
_SCRIPT_DIR = _HERE.parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

import importlib

recon = importlib.import_module("iris-orphan-recon")  # hyphenated module name


# ---------------------------------------------------------------------------
# norm_casrn
# ---------------------------------------------------------------------------

def test_norm_casrn_strips_surrounding_whitespace():
    assert recon.norm_casrn("  7440-38-2  ") == "7440-38-2"


def test_norm_casrn_blank_and_none_are_none_sentinel():
    assert recon.norm_casrn(None) is None
    assert recon.norm_casrn("") is None
    assert recon.norm_casrn("   ") is None


def test_norm_casrn_coerces_non_string_cells():
    # openpyxl may surface a numeric cell; normalization must yield a stable string.
    assert recon.norm_casrn(7439) == "7439"


def test_norm_casrn_whitespace_variants_compare_equal():
    assert recon.norm_casrn(" 50-00-0") == recon.norm_casrn("50-00-0 ")


# ---------------------------------------------------------------------------
# colliding_minted_keys
# ---------------------------------------------------------------------------

def test_collision_requires_two_distinct_casrns():
    minted = defaultdict(set)
    minted["foo"].update({"1-1-1", "2-2-2"})  # two distinct CASRNs -> collision
    minted["bar"].update({"3-3-3"})           # one CASRN -> not a collision
    minted["baz"]                              # blank-only key (caller dropped None) -> size 0
    assert recon.colliding_minted_keys(minted) == {"foo"}


def test_collision_same_casrn_multiple_inputs_not_flagged():
    # A single substance spanning multiple input_keys under ONE normalized CASRN: set size 1.
    minted = defaultdict(set)
    minted["chromium_vi"].update({"18540-29-9"})
    assert recon.colliding_minted_keys(minted) == set()


# ---------------------------------------------------------------------------
# exclude_colliding -- cross-bucket exclusion (the 2026-06-03 core fix)
# ---------------------------------------------------------------------------

def _entry(substance_key, classification, existing=None):
    e = {"substance_key": substance_key, "classification": classification}
    if existing is not None:
        e["existing_substance_key"] = existing
    return e


def test_cross_bucket_exclusion_removes_collision_from_both_buckets():
    # Synthetic 2-CASRN-same-key scenario: 'dup_key' was minted by two distinct EPA chemicals.
    # One landed in orphan_new_substance, one in ambiguous (it also collided with an existing
    # catalog substance). BOTH must be excluded so neither generation mode can stage it.
    minted = defaultdict(set)
    minted["dup_key"].update({"100-00-0", "200-00-0"})  # collision
    minted["solo_new"].update({"300-00-0"})             # legit new substance, no collision
    minted["solo_amb"].update({"400-00-0"})             # legit ambiguous, single CASRN

    colliding = recon.colliding_minted_keys(minted)
    assert colliding == {"dup_key"}

    orphan_new_substance = [
        _entry("dup_key", "ORPHAN_NEW_SUBSTANCE"),
        _entry("solo_new", "ORPHAN_NEW_SUBSTANCE"),
    ]
    ambiguous = [
        _entry("dup_key", "AMBIGUOUS", existing="some_existing_sub"),
        _entry("solo_amb", "AMBIGUOUS", existing="another_existing_sub"),
    ]

    kept_new = recon.exclude_colliding(orphan_new_substance, colliding)
    kept_amb = recon.exclude_colliding(ambiguous, colliding)

    # dup_key gone from BOTH buckets; the genuinely-non-colliding entries survive.
    assert [e["substance_key"] for e in kept_new] == ["solo_new"]
    assert [e["substance_key"] for e in kept_amb] == ["solo_amb"]


def test_non_colliding_ambiguous_entry_is_preserved():
    # Regression guard: do NOT pull legitimately-ambiguous-but-non-colliding entries out of ambiguous.
    minted = defaultdict(set)
    minted["arsenic"].update({"7440-38-2"})  # single CASRN -> not a collision
    colliding = recon.colliding_minted_keys(minted)
    ambiguous = [_entry("arsenic", "AMBIGUOUS", existing="arsenic_inorganic")]
    assert recon.exclude_colliding(ambiguous, colliding) == ambiguous
