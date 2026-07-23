import os
import json
import tempfile
import unittest
import subprocess
import shutil

class TestGenDocsScope(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.repo_root = os.path.join(self.temp_dir, "repo")
        os.makedirs(os.path.join(self.repo_root, "docs", "_meta"))
        os.makedirs(os.path.join(self.repo_root, "docs", "archive"))
        
        # Write small INDEX.md
        index_content = "- `docs/foo.md`\n- `docs/bar.md`\n"
        with open(os.path.join(self.repo_root, "docs", "INDEX.md"), "w", encoding="utf-8") as f:
            f.write(index_content)
            
        # Write small docs-manifest.json
        manifest_content = {"files": ["docs/baz.md"]}
        with open(os.path.join(self.repo_root, "docs", "_meta", "docs-manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest_content, f)
            
        self.script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "gen_docs_scope.py"))
        self.scan_file = os.path.join(self.temp_dir, "scan.txt")
        self.out_file = os.path.join(self.temp_dir, "out.json")
        
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
        
    def run_script(self, scan_paths=None):
        cmd = ["python", self.script_path, "--repo-root", self.repo_root, "--out", self.out_file]
        if scan_paths is not None:
            with open(self.scan_file, "w", encoding="utf-8") as f:
                f.write("\n".join(scan_paths))
            cmd.extend(["--check-scan", self.scan_file])
            
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result
        
    def test_registered_doc_ok(self):
        # (a) registered doc -> OK
        res = self.run_script(["docs/foo.md"])
        self.assertEqual(res.returncode, 0)
        
    def test_archive_path_fail(self):
        # (b) docs/archive/ path in scan -> FAIL exit 2
        res = self.run_script(["docs/archive/old.md"])
        self.assertEqual(res.returncode, 2)
        
    def test_pre_extension_fail(self):
        # (c) *.pre-* -> FAIL
        res = self.run_script(["docs/test.pre-123.md"])
        self.assertEqual(res.returncode, 2)
        
    def test_root_dated_md_fail(self):
        # (d) root-level dated md -> FAIL
        res = self.run_script(["2023-01-01-doc.md"])
        self.assertEqual(res.returncode, 2)
        
    def test_claude_path_fail(self):
        # (e) .claude/ path -> FAIL
        res = self.run_script([".claude/foo.md"])
        self.assertEqual(res.returncode, 2)
        
    def test_unregistered_doc_warn(self):
        # (f) unregistered docs/ md -> WARN, exit 0, listed in auto_excluded
        res = self.run_script(["docs/unknown.md"])
        self.assertEqual(res.returncode, 0)
        with open(self.out_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("docs/unknown.md", data.get("auto_excluded", []))
        
    def test_missing_manifest_fail(self):
        # (g) missing manifest -> exit 2
        os.remove(os.path.join(self.repo_root, "docs", "_meta", "docs-manifest.json"))
        res = self.run_script()
        self.assertEqual(res.returncode, 2)
        
    def test_readme_allowed(self):
        # (h) README.md allowed
        res = self.run_script(["README.md"])
        self.assertEqual(res.returncode, 0)


    def test_sensitive_docs_hard_excluded(self):
        import importlib.util, os as _os
        spec = importlib.util.spec_from_file_location(
            'gen_docs_scope', _os.path.join(_os.path.dirname(__file__), '..', 'gen_docs_scope.py'))
        g = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(g)
        self.assertTrue(g.is_hard_excluded('docs/ENVIRONMENT_REFERENCE.md'))

    def test_nested_archive_segment_hard_excluded(self):
        import importlib.util, os as _os
        spec = importlib.util.spec_from_file_location(
            'gen_docs_scope', _os.path.join(_os.path.dirname(__file__), '..', 'gen_docs_scope.py'))
        g = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(g)
        self.assertTrue(g.is_hard_excluded('docs/review-analysis/archive/OLD.md'))
        self.assertTrue(g.is_hard_excluded('docs/regulatory-review/archive/X.md'))
        self.assertTrue(g.is_hard_excluded('docs/_archive/Y.md'))
        self.assertFalse(g.is_hard_excluded('docs/archived-notes.md'))

    def test_emit_overlay_writes_negations_for_registered_docs_only(self):
        # Phase 4 overlay: registered docs/ md -> negation lines; hard-excluded and
        # out-of-docs registered paths never appear; file is plain ASCII.
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            'gen_docs_scope', os.path.join(os.path.dirname(__file__), '..', 'gen_docs_scope.py'))
        g = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(g)
        registered = ["docs/GOOD.md", "docs/sub/ALSO_GOOD.md", "README.md",
                      ".github/NOT_DOCS.md", "docs/archive/OLD.md"]
        count = g.emit_overlay(self.repo_root, registered)
        overlay = os.path.join(self.repo_root, "docs", ".graphifyignore")
        self.assertTrue(os.path.exists(overlay))
        content = open(overlay, encoding="ascii").read()
        self.assertEqual(count, 2)
        self.assertIn("!/GOOD.md", content)
        self.assertIn("!/sub/ALSO_GOOD.md", content)
        self.assertNotIn("README.md", content)
        self.assertNotIn("NOT_DOCS", content)
        self.assertNotIn("archive", content.replace("DO NOT EDIT", ""))

if __name__ == '__main__':
    unittest.main()
