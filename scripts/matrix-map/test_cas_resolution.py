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
        # A pulp-mill guaiacol not in the curated map (guaiacols are an
        # intentionally-deferred category pending isomer-specific verification).
        key, cas, matched = resolve_substance("4-Chloroguaiacol")
        self.assertEqual(key, "4-chloroguaiacol")
        self.assertIsNone(cas)
        self.assertFalse(matched)

    def test_excluded_param_returns_none(self) -> None:
        self.assertEqual(resolve_substance("- Paramete"), (None, None, False))

    def test_nonylphenol_resolves_to_branched_technical_cas(self) -> None:
        # Owner-decided canonical form: 84852-15-3 (branched 4-nonylphenol
        # technical, the usual environmental-monitoring default).
        self.assertEqual(
            resolve_substance("Nonylphenol"),
            ("nonylphenol", "84852-15-3", True),
        )

    def test_chlorophenol_isomers_resolve_to_verified_cas(self) -> None:
        # The full single-isomer chlorophenol set (batch2, 2026-06-20). DB2
        # parameter spellings slugify by dropping commas + parens and keeping
        # hyphens, mirroring the existing 246-trichlorophenol convention. Each
        # CAS web-verified (EPA Method 8041A / ATSDR tp107 / AccuStandard /
        # ChemicalBook).
        cases = [
            ("2-Chlorophenol", "2-chlorophenol", "95-57-8"),
            ("3-Chlorophenol", "3-chlorophenol", "108-43-0"),
            ("4-Chlorophenol", "4-chlorophenol", "106-48-9"),
            ("2,3-Dichlorophenol", "23-dichlorophenol", "576-24-9"),
            ("2,4-Dichlorophenol", "24-dichlorophenol", "120-83-2"),
            ("2,5-Dichlorophenol", "25-dichlorophenol", "583-78-8"),
            ("2,6-Dichlorophenol", "26-dichlorophenol", "87-65-0"),
            ("3,4-Dichlorophenol", "34-dichlorophenol", "95-77-2"),
            ("3,5-Dichlorophenol", "35-dichlorophenol", "591-35-5"),
            ("2,3,4-Trichlorophenol", "234-trichlorophenol", "15950-66-0"),
            ("2,3,5-Trichlorophenol", "235-trichlorophenol", "933-78-8"),
            ("2,3,6-Trichlorophenol", "236-trichlorophenol", "933-75-5"),
            ("2,4,5-Trichlorophenol", "245-trichlorophenol", "95-95-4"),
            ("3,4,5-Trichlorophenol", "345-trichlorophenol", "609-19-8"),
            ("2,3,4,5-Tetrachlorophenol", "2345-tetrachlorophenol", "4901-51-3"),
            ("2,3,5,6-Tetrachlorophenol", "2356-tetrachlorophenol", "935-95-5"),
        ]
        for param, expected_key, expected_cas in cases:
            with self.subTest(param=param):
                self.assertEqual(
                    resolve_substance(param),
                    (expected_key, expected_cas, True),
                )

    def test_deferred_categories_stay_unmatched(self) -> None:
        # Organotins + octylphenols + guaiacols are intentionally deferred:
        # they resolve to a slug with no CAS (needs_review), never auto-assigned.
        for param in (
            "Tributyltin",
            "Dibutyltin",
            "4-tert-Octylphenol",
            "4-Chloroguaiacol",
        ):
            with self.subTest(param=param):
                _, cas, matched = resolve_substance(param)
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
        # 67 HIGH-confidence entries (metals + PAHs + PCB Aroclors + the full
        # single-isomer chlorophenol set incl 3,4,5-trichlorophenol + nonylphenol
        # + methyl_mercury); mixed-isomer slugs + deferred categories omitted.
        self.assertEqual(len(cas_by_key), 67)
        self.assertIn("nonylphenol", cas_by_key)
        self.assertIn("methyl_mercury", cas_by_key)
        self.assertIn("2-chlorophenol", cas_by_key)
        self.assertIn("2345-tetrachlorophenol", cas_by_key)
        self.assertNotIn("total_pcbs", cas_by_key)
        self.assertNotIn("benzob&jfluoranthene", cas_by_key)
        self.assertIn("- Paramete", exclude)
        self.assertEqual(alias_overrides, {})

    def test_resolves_new_expansion_slugs(self) -> None:
        # Mangled PAH slug, PCB Aroclor, and metal all resolve to verified CAS.
        self.assertEqual(resolve_substance("Benzo(a)pyrene"), ("benzoapyrene", "50-32-8", True))
        self.assertEqual(resolve_substance("PCB 1254"), ("pcb_1254", "11097-69-1", True))
        self.assertEqual(resolve_substance("Arsenic"), ("arsenic", "7440-38-2", True))
        self.assertEqual(resolve_substance("Pentachlorophenol"), ("pentachlorophenol", "87-86-5", True))

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
