import importlib.util
import os
import sys
import unittest
import subprocess
import tempfile
import json

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("extract_dra_coordinates", os.path.join(_HERE, "extract_dra_coordinates.py"))
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

class TestExtractDRACoordinates(unittest.TestCase):

    def test_normalize_and_validate_coords(self):
        # valid BC coord
        self.assertEqual(mod.normalize_and_validate_coords(49.2, -123.1), (49.2, -123.1))

        # out-of-bounds latitude
        with self.assertRaises(ValueError):
            mod.normalize_and_validate_coords(10.0, -123.1)

        # out-of-bounds longitude
        with self.assertRaises(ValueError):
            mod.normalize_and_validate_coords(49.2, 0.0)

        # non-numeric
        with self.assertRaises(ValueError):
            mod.normalize_and_validate_coords("abc", "def")

        # is_utm=True
        with self.assertRaises(NotImplementedError):
            mod.normalize_and_validate_coords(49.2, -123.1, is_utm=True)

    def test_validate_dra_id(self):
        # valid UUID
        mod._validate_dra_id("052c6a9d-0000-4000-8000-000000000000")

        # non-UUID
        with self.assertRaises(ValueError):
            mod._validate_dra_id("not-a-uuid")

    def test_safe_station_literal(self):
        # safe id
        self.assertEqual(mod._safe_station_literal("SED-01"), "'SED-01'")

        # unsafe id with an injection payload -> rejected by the regex
        with self.assertRaises(ValueError):
            mod._safe_station_literal("x'; DROP TABLE samples;--")

        # a single quote is NOT an allowed station-id character -> rejected (the
        # regex is the primary guard; the .replace() doubling is defense-in-depth).
        with self.assertRaises(ValueError):
            mod._safe_station_literal("O'Brien-1")

    def test_generate_sql(self):
        # valid dra_id and one station
        dra_id = "052c6a9d-0000-4000-8000-000000000000"
        stations_data = [{"station_id": "SED-01", "lat": 49.2, "lon": -123.1}]
        output = mod.generate_sql(dra_id, stations_data)

        self.assertIn("UPDATE matrix_map.samples", output)
        self.assertIn("coordinate_quality_tier = 'high'", output)
        self.assertIn(f"WHERE station_id = 'SED-01' AND source_dra_id = '{dra_id}'", output)
        self.assertIn("PRE-FLIGHT", output)
        self.assertIn("POST-FLIGHT", output)
        self.assertIn("\n", output)
        self.assertTrue(output.count("\n") > 3)

        # invalid dra_id
        with self.assertRaises(ValueError):
            mod.generate_sql("invalid-uuid", stations_data)

        # station with non-float lat
        bad_stations = [{"station_id": "SED-01", "lat": "49.2", "lon": -123.1}]
        with self.assertRaises(ValueError):
            mod.generate_sql(dra_id, bad_stations)

    def test_build_dry_run_report(self):
        report = mod.build_dry_run_report("some-id", "some-pdf.pdf", [])
        self.assertEqual(report["status"], "BLOCKED")
        self.assertEqual(report["stations_extracted"], 0)

        missing_inputs = " ".join(report["missing_inputs"])
        self.assertIn("NEEDS-TUNING", missing_inputs)

        self.assertIsInstance(report["pyproj_available"], bool)
        self.assertIsInstance(report["docling_available"], bool)
        self.assertEqual(report["generated_by"], "extract_dra_coordinates.py dry-run")

    def test_main_smoke_subprocess(self):
        script_path = os.path.join(_HERE, "extract_dra_coordinates.py")

        # --apply
        cmd_apply = [sys.executable, script_path, "--pdf", "dummy.pdf", "--dra-id", "dummy-id", "--out-sql", "dummy.sql", "--apply"]
        proc_apply = subprocess.run(cmd_apply, cwd=_HERE, capture_output=True)
        self.assertEqual(proc_apply.returncode, 2)

        # normal dry-run
        with tempfile.TemporaryDirectory() as temp_dir:
            out_sql = os.path.join(temp_dir, "out.sql")
            cmd_dry = [sys.executable, script_path, "--pdf", "nonexistent.pdf", "--dra-id", "dummy-id", "--out-sql", out_sql]
            proc_dry = subprocess.run(cmd_dry, cwd=_HERE, capture_output=True)
            self.assertEqual(proc_dry.returncode, 1)

            report_path = f"{out_sql}.dryrun.json"
            self.assertTrue(os.path.exists(report_path))

            with open(report_path, "r") as f:
                report = json.load(f)

            self.assertEqual(report["status"], "BLOCKED")
            self.assertFalse(report["pdf_exists"])
            missing_inputs = " ".join(report["missing_inputs"])
            self.assertIn("source PDF not found", missing_inputs)

if __name__ == "__main__":
    unittest.main()
