"""
test_cas_resolution.py -- stdlib unittest for the ETL CAS-resolution mechanism
(resolve_substance + the curated substance_cas_map.json).

Run from this folder:
    ../../.venv/Scripts/python.exe -m unittest test_cas_resolution

Plain ASCII only. Python 3.11+. Stdlib only.
"""

from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from etl_bnrrm_to_supabase import (  # noqa: E402
    resolve_substance,
    substance_key,
    _load_cas_map,
    _parse_cas_map,
)

_MAP_PATH = Path(__file__).resolve().parent / "substance_cas_map.json"
_CAS_RE = re.compile(r"^\d{2,7}-\d{2}-\d$")  # CAS Registry Number shape


class ResolveSubstanceTest(unittest.TestCase):
    def test_mapped_substance_returns_cas_and_matched(self) -> None:
        key, cas, matched = resolve_substance("Lead")
        self.assertEqual(key, "lead")
        self.assertEqual(cas, "7439-92-1")
        self.assertTrue(matched)

    def test_mapped_zinc(self) -> None:
        key, cas, matched = resolve_substance("Zinc")
        self.assertEqual((key, cas, matched), ("zinc", "7440-66-6", True))

    def test_unmapped_real_chemistry_resolves_to_slug_no_cas(self) -> None:
        # A pulp-mill chlorophenol not in the curated map.
        key, cas, matched = resolve_substance("2-Chlorophenol")
        self.assertEqual(key, "2-chlorophenol")
        self.assertIsNone(cas)
        self.assertFalse(matched)

    def test_excluded_param_returns_none(self) -> None:
        self.assertEqual(resolve_substance("- Paramete"), (None, None, False))

    def test_ambiguous_nonylphenol_not_auto_assigned(self) -> None:
        # Intentionally omitted from cas_by_key (ambiguous CAS) -> needs_review.
        key, cas, matched = resolve_substance("Nonylphenol")
        self.assertEqual(key, "nonylphenol")
        self.assertIsNone(cas)
        self.assertFalse(matched)

    def test_slug_canonicalizes_case_variants(self) -> None:
        # The two DB2 spellings of 2-methylnaphthalene collapse to one key.
        self.assertEqual(
            resolve_substance("2-MethylNaphthalene")[0],
            resolve_substance("2-Methylnaphthalene")[0],
        )

    def test_empty_param(self) -> None:
        key, cas, matched = resolve_substance("")
        self.assertEqual(substance_key(""), "unknown_substance")
        self.assertEqual(key, "unknown_substance")
        self.assertIsNone(cas)
        self.assertFalse(matched)


class CasMapFileTest(unittest.TestCase):
    def setUp(self) -> None:
        self.data = json.loads(_MAP_PATH.read_text(encoding="utf-8"))

    def test_json_valid_and_shaped(self) -> None:
        self.assertIn("cas_by_key", self.data)
        self.assertIn("exclude_params", self.data)
        self.assertIn("alias_overrides", self.data)

    def test_all_cas_well_formed(self) -> None:
        for key, cas in self.data["cas_by_key"].items():
            self.assertRegex(cas, _CAS_RE, f"{key} CAS {cas} malformed")

    def test_loader_returns_curated_entries(self) -> None:
        cas_by_key, alias_overrides, exclude = _load_cas_map()
        # 12 HIGH-confidence overlap substances seeded (nonylphenol omitted).
        self.assertEqual(len(cas_by_key), 12)
        self.assertNotIn("nonylphenol", cas_by_key)
        self.assertIn("- Paramete", exclude)
        self.assertEqual(alias_overrides, {})

    def test_no_ambiguous_or_duplicate_cas(self) -> None:
        cas_values = list(self.data["cas_by_key"].values())
        self.assertEqual(len(cas_values), len(set(cas_values)), "duplicate CAS")


class ParseCasMapDegradeTest(unittest.TestCase):
    """The parser must tolerate imperfect inputs by degrading, never raising,
    and never emit a null/blank CAS as a matched value (codex C2 P3 fixes)."""

    def test_non_dict_root_degrades_empty(self) -> None:
        # A bad edit leaving a JSON array root must not AttributeError.
        self.assertEqual(_parse_cas_map([]), ({}, {}, frozenset()))
        self.assertEqual(_parse_cas_map("oops"), ({}, {}, frozenset()))
        self.assertEqual(_parse_cas_map(None), ({}, {}, frozenset()))

    def test_null_cas_value_treated_as_missing(self) -> None:
        cas_by_key, _, _ = _parse_cas_map(
            {"cas_by_key": {"foo": None, "bar": "  ", "baz": "50-32-8"}}
        )
        self.assertNotIn("foo", cas_by_key)  # null -> missing, never 'None'
        self.assertNotIn("bar", cas_by_key)  # blank -> missing
        self.assertEqual(cas_by_key, {"baz": "50-32-8"})

    def test_wrong_section_types_degrade(self) -> None:
        cas, alias, exclude = _parse_cas_map(
            {"cas_by_key": [], "alias_overrides": "x", "exclude_params": "y"}
        )
        self.assertEqual((cas, alias, exclude), ({}, {}, frozenset()))

    def test_cas_value_is_trimmed(self) -> None:
        cas_by_key, _, _ = _parse_cas_map({"cas_by_key": {"x": " 91-20-3 "}})
        self.assertEqual(cas_by_key["x"], "91-20-3")


if __name__ == "__main__":
    unittest.main()
