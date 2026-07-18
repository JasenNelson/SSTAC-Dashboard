import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

class TestCheckConventions(unittest.TestCase):
    def setUp(self):
        self.script_path = Path(__file__).parent.parent / "check_conventions.py"

    def test_real_conventions_pass(self):
        # Run against the real repository
        res = subprocess.run([sys.executable, str(self.script_path)], capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertIn("All conventions and constants verified successfully", res.stdout)

    def test_missing_conventions_file_fails(self):
        # Run in a temp directory without conventions.md
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            # Copy check_conventions.py there
            dest_script = tmp_path / "check_conventions.py"
            shutil.copy2(self.script_path, dest_script)

            res = subprocess.run([sys.executable, str(dest_script)], capture_output=True, text=True)
            self.assertEqual(res.returncode, 1)
            self.assertIn("Error: Conventions document not found", res.stdout or res.stderr)

    def test_missing_constant_in_conventions_fails(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            dest_script = tmp_path / "check_conventions.py"
            shutil.copy2(self.script_path, dest_script)

            # Create a conventions.md missing some expected constants (e.g. "retired")
            conventions_content = "000-Modules 000-Concepts EXTRACTED INFERRED AMBIGUOUS inferred promoted demoted"
            (tmp_path / "conventions.md").write_text(conventions_content, encoding='utf-8')

            # Create fake script files containing all constants
            fake_script_content = '"000-Modules" "000-Concepts" "EXTRACTED" "INFERRED" "AMBIGUOUS" "inferred" "promoted" "demoted" "retired" [[test]]'
            (tmp_path / "wiki_compile.py").write_text(fake_script_content, encoding='utf-8')
            (tmp_path / "wiki_lint.py").write_text(fake_script_content, encoding='utf-8')
            (tmp_path / "promotion.py").write_text(fake_script_content, encoding='utf-8')
            (tmp_path / "session_bootstrap.py").write_text(fake_script_content, encoding='utf-8')

            res = subprocess.run([sys.executable, str(dest_script)], capture_output=True, text=True)
            self.assertEqual(res.returncode, 1)
            self.assertIn("Error: The following constants are missing in conventions.md", res.stdout)
            self.assertIn("retired", res.stdout)


if __name__ == '__main__':
    unittest.main()
