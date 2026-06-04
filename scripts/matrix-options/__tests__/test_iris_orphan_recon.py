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


# ---------------------------------------------------------------------------
# unit_consistent -- inhalation scale/basis gate (the 2026-06-03 fiber + scale fix)
# ---------------------------------------------------------------------------

IUR = "unit_risk_inhalation_per_ug_m3"
RFC = "rfc_inhalation_mg_per_m3"


def test_iur_per_mg_m3_is_accepted_and_convertible():
    # Mass-scale reciprocal air unit (the ETBE case "8 x 10^-5 per mg/m3"): convertible to
    # per ug/m3 by the builder (/1000), so unit_consistent ACCEPTS it -> stays an orphan.
    assert recon.unit_consistent("per mg/m3", IUR) is True


def test_iur_per_ug_m3_and_per_ng_m3_accepted():
    # All mass-scale variants are convertible and must stay accepted.
    assert recon.unit_consistent("per ug/m3", IUR) is True
    assert recon.unit_consistent("per ng/m3", IUR) is True


def test_iur_fiber_unit_routes_to_data_quality():
    # Fiber-count basis (the asbestos case "2.3 x 10^-1 per f/mL") is NOT mass-convertible to
    # per ug/m3 -> unit_consistent REJECTS it so the recon routes it to data_quality (excluded).
    assert recon.unit_consistent("per f/mL", IUR) is False
    assert recon.unit_consistent("per fiber/cc", IUR) is False
    assert recon.unit_consistent("per fiber", IUR) is False


def test_rfc_fiber_unit_routes_to_data_quality():
    # An RfC carried in a fiber basis is likewise non-convertible and excluded.
    assert recon.unit_consistent("f/mL", RFC) is False


def test_rfc_mass_air_accepted():
    # A normal mass-per-air RfC unit stays accepted.
    assert recon.unit_consistent("mg/m3", RFC) is True
    assert recon.unit_consistent("ug/m3", RFC) is True


# ---------------------------------------------------------------------------
# unit_consistent -- builder parity (F1 2026-06-03)
#
# recon.unit_consistent must accept a unit IFF generate-catalog-records.mjs:normalizeToCanonical
# would convert it. The helpers (canon_unit / numerator_prefix / is_reciprocal_unit / is_per_day /
# is_dose / is_air) are ported byte-for-byte from the builder, so the recon's orphan pool and the
# builder's accepted set cannot drift. A preflight over all 676 EPA toxicity rows confirmed the
# port + the /day guard reclassify ZERO real rows (pure hardening).
# ---------------------------------------------------------------------------

RFD = "rfd_oral_mg_per_kg_bw_day"
SF = "sf_oral_per_mg_per_kg_bw_per_day"

# (unit_text, input_key, expect_accept)
_PARITY_CASES = [
    # accept: convertible mass-per-air / dose units across every prefix the builder maps.
    ("per ug/m3", IUR, True),
    ("per ng/m3", IUR, True),
    ("per mg/m3", IUR, True),
    ("per mcg/m3", IUR, True),        # mcg -> ug via canon_unit; the builder converts it
    ("per microg/m3", IUR, True),
    ("mg/m3", RFC, True),
    ("ug/m3", RFC, True),
    ("ng/m3", RFC, True),
    ("mcg/m3", RFC, True),
    ("mg/kg-day", RFD, True),
    ("ug/kg-day", RFD, True),
    ("per mg/kg-day", SF, True),
    # accept: dose+m3 hybrids -- the builder's RfD/SF branches take the mass numerator and ignore
    # the stray m3 (the /day guard is air-branch only), so recon must accept them too (parity).
    ("mg/kg-day/m3", RFD, True),
    ("per mg/kg-day/m3", SF, True),
    # accept: case / whitespace variants canonicalize identically.
    ("PER MG/M3", IUR, True),
    ("  mg / m3  ", RFC, True),
    # reject: real-but-non-convertible scales/bases -> route to data_quality, not the orphan pool.
    ("per kg/m3", IUR, False),        # kg numerator -> numerator_prefix None (old endswith('g') bug)
    ("per mg/m2", RFC, False),        # m2 surface -> is_air False (old '/m' clause wrongly accepted)
    ("f/mL", RFC, False),             # fiber basis -> is_air False
    ("per f/mL", IUR, False),
    ("per fiber/cc", IUR, False),
    # reject: air RATE carrying a trailing /day (/day guard, RfC/IUR branches only).
    ("mg/m3/day", RFC, False),
    ("per mg/m3/day", IUR, False),
    # reject: empty/bare cell -- builder throws on "" -> recon mirrors (routes to data_quality).
    ("", RFD, False),
    ("", IUR, False),
    # reject: wrong reciprocal polarity for the type.
    ("per mg/kg-day", RFD, False),    # RfD must be non-reciprocal
    ("mg/kg-day", SF, False),         # SF must be reciprocal
    ("per mg/m3", RFC, False),        # RfC must be non-reciprocal
    ("mg/m3", IUR, False),            # IUR must be reciprocal
    # reject: dose missing its /day basis or its numerator mass prefix.
    ("mg/kg", RFD, False),            # no /day -> is_dose False
    ("per /kg-day", SF, False),       # no numerator mass prefix
]


def test_unit_consistent_builder_parity_table():
    failures = []
    for unit_text, input_key, expect in _PARITY_CASES:
        got = recon.unit_consistent(unit_text, input_key)
        if got is not expect:
            failures.append({"unit": unit_text, "input_key": input_key, "expect": expect, "got": got})
    assert not failures, "unit_consistent parity mismatches: " + repr(failures)
