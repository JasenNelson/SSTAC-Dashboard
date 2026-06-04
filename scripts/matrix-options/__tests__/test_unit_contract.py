"""F3 cross-language unit CONTRACT -- Python (recon) side.

Reads the SHARED fixture scripts/matrix-options/__tests__/unit_contract_fixtures.json (the same file
the vitest builder side reads in src/lib/matrix-options/provenance/__tests__/unit-contract.test.ts) and
asserts the recon's unit_consistent(raw_unit, input_key) acceptance decision matches expect_accept for
every row. Because BOTH languages assert against the SAME table, recon's accept-set and the builder's
convert-set cannot drift apart -- a divergence fails CI on one side or the other.

Importing iris-orphan-recon is side-effect-free (its main() is guarded by __name__ == "__main__"); the
module imports openpyxl at top level, so run from the catalog-overnight venv:
    C:\\Projects\\SSTAC-Dashboard\\scripts\\catalog-overnight\\.venv\\Scripts\\python.exe \\
        -m pytest scripts/matrix-options/__tests__/test_unit_contract.py -v
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Make the script directory importable without installing it (mirrors test_iris_orphan_recon.py).
_HERE = Path(__file__).resolve().parent
_SCRIPT_DIR = _HERE.parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

import importlib

recon = importlib.import_module("iris-orphan-recon")  # hyphenated module name

_FIXTURE = _HERE / "unit_contract_fixtures.json"


def _rows():
    with _FIXTURE.open(encoding="utf-8") as f:
        return json.load(f)["rows"]


def _numerator_token(raw_unit):
    # Mass-prefix token from a raw unit's numerator (mirrors the builder numeratorPrefix shape): text
    # before the first '/', keep alphanumerics, strip a leading 'per'. Makes the coverage assertion
    # meaningful (a substring 'g' in 'mg/kg-day' would otherwise satisfy it trivially).
    head = "".join(c for c in raw_unit.split("/")[0] if c.isalnum())
    if head.lower().startswith("per"):
        head = head[3:]
    return head.lower()


def test_fixture_is_populated_and_every_row_has_numeric_raw_value():
    rows = _rows()
    assert len(rows) >= 20, "contract fixture too small to be meaningful"
    # AMEND-F3a: a numeric raw_value on EVERY row (so the JS side throws on the unit, not the value).
    # bool is a subclass of int in Python -- exclude it explicitly.
    bad = [
        r for r in rows
        if not isinstance(r.get("raw_value"), (int, float)) or isinstance(r.get("raw_value"), bool)
    ]
    assert not bad, "rows missing a numeric raw_value: " + repr(bad)
    # Accepted rows must carry the expected canonical pair; rejected rows must NOT assert one.
    for r in rows:
        if r["expect_accept"]:
            assert "expect_canonical_value" in r and "expect_canonical_unit" in r, \
                "accepted row missing canonical pair: " + repr(r)
        else:
            assert "expect_canonical_value" not in r and "expect_canonical_unit" not in r, \
                "rejected row should not assert a canonical value or unit: " + repr(r)


def test_recon_acceptance_matches_contract():
    failures = []
    for r in _rows():
        got = recon.unit_consistent(r["raw_unit"], r["input_key"])
        if bool(got) is not bool(r["expect_accept"]):
            failures.append({
                "input_key": r["input_key"],
                "raw_unit": r["raw_unit"],
                "expect_accept": r["expect_accept"],
                "recon_got": got,
            })
    assert not failures, "recon unit_consistent disagrees with the shared contract: " + repr(failures)


def test_contract_covers_all_four_input_types_and_mass_prefixes():
    accepted = [r for r in _rows() if r["expect_accept"]]
    for k in (
        "rfd_oral_mg_per_kg_bw_day",
        "sf_oral_per_mg_per_kg_bw_per_day",
        "rfc_inhalation_mg_per_m3",
        "unit_risk_inhalation_per_ug_m3",
    ):
        assert any(r["input_key"] == k for r in accepted), "no accepted row for " + k
    for p in ("ng", "ug", "mcg", "mg", "g"):
        assert any(_numerator_token(r["raw_unit"]) == p for r in accepted), \
            "no accepted row with numerator prefix " + p
