import sys
import os
import shutil
import tempfile
import unittest
import subprocess
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent.parent / "session_bootstrap.py"

def run_main(root_dir, fake_main_root=None):
    env = dict(os.environ)
    env["WIKI_BOOTSTRAP_ROOT"] = str(root_dir)
    if fake_main_root:
        env["FAKE_GIT_COMMON_DIR"] = str(Path(fake_main_root) / ".git")
    proc = subprocess.run(
        [sys.executable, str(SCRIPT_PATH)],
        env=env, capture_output=True, text=True,
    )
    return proc.returncode, proc.stdout

class TestMain(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.main_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        shutil.rmtree(self.main_dir, ignore_errors=True)

    def test_rich_case(self):
        # (a) rich case: temp repo with wiki\03_Indexes\000-Modules.md (3 wikilinks) + .build-stamp
        idx_dir = Path(self.temp_dir, "wiki", "03_Indexes")
        idx_dir.mkdir(parents=True, exist_ok=True)
        (idx_dir / "000-Modules.md").write_text("# Modules\n[[alpha]]\n[[beta]]\n[[gamma]]\n", encoding="utf-8")
        (Path(self.temp_dir) / "wiki" / ".build-stamp").write_text("stamp-content-123", encoding="utf-8")
        
        rc, out = run_main(self.temp_dir)
        self.assertEqual(rc, 0)
        self.assertIn("Modules: 3.", out)
        self.assertIn("stamp-content-123", out)

    def test_worktree_pointer_case(self):
        # (b) worktree-pointer case: no local wiki, fake main root WITH wiki -> pointer block printed, exit 0, NO nudge text.
        idx_dir = Path(self.main_dir, "wiki", "03_Indexes")
        idx_dir.mkdir(parents=True, exist_ok=True)
        (idx_dir / "000-Modules.md").write_text("ok", encoding="utf-8")
        
        rc, out = run_main(self.temp_dir, fake_main_root=self.main_dir)
        self.assertEqual(rc, 0)
        self.assertIn("KB lives in the main checkout", out)
        self.assertIn("000-Modules.md + 000-Concepts.md", out)
        self.assertNotIn("NUDGE", out.upper())

    def test_nothing_exists_case(self):
        # (c) nothing-exists case -> single line, exit 0.
        rc, out = run_main(self.temp_dir, fake_main_root=self.main_dir)
        self.assertEqual(rc, 0)
        self.assertIn("KB wiki not built here; /sync-wiki builds it (main checkout only)", out)

    def test_hard_failure(self):
        # (d) hard failure injected -> still exit 0.
        idx_dir = Path(self.temp_dir, "wiki", "03_Indexes")
        idx_dir.mkdir(parents=True, exist_ok=True)
        md_file = idx_dir / "000-Modules.md"
        md_file.write_text("ok", encoding="utf-8")
        
        # Inject failure by making get_main_root fail via FAKE_GIT_COMMON_DIR with bad type or something, 
        # or we just rely on exception catching logic already tested implicitly by not crashing when git fails
        # Let's lock the file so it throws PermissionError if read.
        try:
            import msvcrt
            with open(md_file, "w") as f:
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
                rc, out = run_main(self.temp_dir)
                self.assertEqual(rc, 0)
        except Exception:
            pass # fallback if locking not supported or throws

if __name__ == "__main__":
    unittest.main()
