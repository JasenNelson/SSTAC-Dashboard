import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

class TestScanSecrets(unittest.TestCase):
    def setUp(self):
        self.script_path = Path(__file__).parent.parent / "scan_secrets.py"
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def run_scan(self, targets, quarantine=False, expect_hits=False):
        cmd = [sys.executable, str(self.script_path), "--repo-root", str(self.repo_root)]
        for t in targets:
            cmd += ["--target", t]
        if quarantine:
            cmd.append("--quarantine")
        if expect_hits:
            cmd.append("--expect-hits")
        return subprocess.run(cmd, capture_output=True, text=True)

    def test_clean_scan_zero_hits(self):
        (self.repo_root / "wiki").mkdir()
        (self.repo_root / "wiki" / "page.md").write_text("# Just a normal wiki page.\n[[other]]\n")
        result = self.run_scan(["wiki"])
        self.assertEqual(result.returncode, 0)
        self.assertIn("clean (zero hits)", result.stdout)

    def test_value_signature_jwt_detected_and_value_never_printed(self):
        # Built from fragments at runtime (never a contiguous literal in source) so this
        # positive-control fixture is not itself a secret-shaped literal GitGuardian would
        # flag in the committed file -- the assembled value is still the real detected shape.
        (self.repo_root / "wiki").mkdir()
        jwt_header = "ey" + "J" + "hbGciOiJIUzI1NiJ9"
        jwt_payload = "ey" + "J" + "zdWIiOiIxMjM0NTY3ODkwIn0"
        jwt_signature = "dQw4w9WgXcQ" + "_" + "fake" + "fake" + "fake" + "123"
        fake_jwt = jwt_header + "." + jwt_payload + "." + jwt_signature
        (self.repo_root / "wiki" / "leaky.md").write_text(f"token = {fake_jwt}\n")
        result = self.run_scan(["wiki"])
        self.assertEqual(result.returncode, 1)
        self.assertIn("jwt", result.stdout)
        self.assertNotIn(fake_jwt, result.stdout)
        self.assertNotIn(fake_jwt, result.stderr)

    def test_value_signature_modern_openai_prefixed_key_detected(self):
        # A bare short-prefix regex misses the modern project-/service-account-/admin-scoped
        # key formats (the segment before the next hyphen is too short); this covers the fix.
        # Fragments join at runtime only -- no secret-shaped literal in source.
        (self.repo_root / "wiki").mkdir()
        key_prefix = "sk" + "-" + "proj" + "-"
        key_body = "FAKE" * 6 + "1234567890"
        fake_key = key_prefix + key_body
        (self.repo_root / "wiki" / "leaky.md").write_text(f"key = {fake_key}\n")
        result = self.run_scan(["wiki"])
        self.assertEqual(result.returncode, 1)
        self.assertIn("openai_style_key", result.stdout)
        self.assertNotIn(fake_key, result.stdout)

    def test_value_signature_postgres_creds_detected(self):
        # Fragments join at runtime only -- no secret-shaped literal in source.
        (self.repo_root / "wiki").mkdir()
        scheme = "postgres" + "ql" + "://"
        user = "my" + "user"
        password = "my" + "secret" + "password"
        host = "db.example.com:5432/mydb"
        conn_line = "conn = " + scheme + user + ":" + password + "@" + host + "\n"
        (self.repo_root / "wiki" / "leaky.md").write_text(conn_line)
        result = self.run_scan(["wiki"])
        self.assertEqual(result.returncode, 1)
        self.assertIn("postgres_creds_url", result.stdout)
        self.assertNotIn(password, result.stdout)

    def test_path_audit_flags_env_file(self):
        (self.repo_root / "graphify-out").mkdir()
        (self.repo_root / "graphify-out" / ".env.local").write_text("SOMETHING=1\n")
        result = self.run_scan(["graphify-out"])
        self.assertEqual(result.returncode, 1)
        self.assertIn(".env.local", result.stdout)

    def test_quarantine_refused_outside_allowed_roots(self):
        # Fragments join at runtime only -- no secret-shaped literal in source.
        (self.repo_root / "src").mkdir()
        dashes = "-" * 5
        begin_marker = dashes + "BEGIN" + " RSA PRIVATE KEY" + dashes
        end_marker = dashes + "END" + " RSA PRIVATE KEY" + dashes
        fake_key_block = begin_marker + "\nfake\n" + end_marker + "\n"
        (self.repo_root / "src" / "leaky.ts").write_text(fake_key_block)
        result = self.run_scan(["src"], quarantine=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("REFUSING to quarantine", result.stdout)
        self.assertTrue((self.repo_root / "src" / "leaky.ts").exists(),
                         "source file must never be renamed/moved")

    def test_quarantine_renames_scan_output_only(self):
        # Fragments join at runtime only -- no secret-shaped literal in source.
        (self.repo_root / "wiki").mkdir()
        target = self.repo_root / "wiki" / "leaky.md"
        marker = "SERVICE" + "_" + "ROLE"
        target.write_text(f"{marker} key present here\n")
        result = self.run_scan(["wiki"], quarantine=True)
        self.assertEqual(result.returncode, 1)  # still fails the run (hits found)
        self.assertFalse(target.exists(), "offending scan-output file must be renamed away")
        quarantined = list((self.repo_root / "wiki").glob("leaky.md.quarantined*"))
        self.assertEqual(len(quarantined), 1)

    def test_expect_hits_positive_control_passes_on_synthetic_fixture(self):
        # Fragments join at runtime only -- no secret-shaped literal in source.
        (self.repo_root / ".tmp_secrets_fixture").mkdir()
        key_prefix = "sk" + "-"
        key_body = "FAKE" * 6 + "1234567890"
        fixture_line = key_prefix + key_body + "\n"
        (self.repo_root / ".tmp_secrets_fixture" / "fixture.txt").write_text(fixture_line)
        result = self.run_scan([".tmp_secrets_fixture"], expect_hits=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("POSITIVE CONTROL OK", result.stdout)

    def test_expect_hits_fails_when_no_hits_found(self):
        (self.repo_root / ".tmp_secrets_fixture").mkdir()
        (self.repo_root / ".tmp_secrets_fixture" / "fixture.txt").write_text("nothing interesting here\n")
        result = self.run_scan([".tmp_secrets_fixture"], expect_hits=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("POSITIVE CONTROL FAILED", result.stdout)

if __name__ == '__main__':
    unittest.main()
