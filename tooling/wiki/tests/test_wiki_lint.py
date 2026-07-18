import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

class TestWikiLint(unittest.TestCase):
    def setUp(self):
        self.wiki_dir = tempfile.TemporaryDirectory()
        self.wiki_path = Path(self.wiki_dir.name)

        # Create directories
        (self.wiki_path / "01_Concepts").mkdir()
        (self.wiki_path / "02_Modules").mkdir()
        (self.wiki_path / "03_Indexes").mkdir()

        # Good page
        (self.wiki_path / "01_Concepts" / "good.md").write_text(
            "---\n"
            "id: good\n"
            "type: concept\n"
            "source_paths: [\"good.py\"]\n"
            "last_compiled: 2026-07-04\n"
            "---\n"
            "Here is a link to [[other]].\n"
        )

        # Another good page for reference
        (self.wiki_path / "02_Modules" / "other.md").write_text(
            "---\n"
            "id: other\n"
            "type: module\n"
            "source_paths: [\"other.py\"]\n"
            "last_compiled: 2026-07-04\n"
            "---\n"
            "Linking back to [[good]] and to dead end [[dead_end]].\n"
            "Link to [[unreachable]].\n"
        )

        # Dead-end page (has incoming link from other, but no outgoing link)
        (self.wiki_path / "01_Concepts" / "dead_end.md").write_text(
            "---\n"
            "id: dead_end\n"
            "type: concept\n"
            "source_paths: [\"dead.py\"]\n"
            "last_compiled: 2026-07-04\n"
            "---\n"
            "No links here.\n"
        )

        # Unreachable page (orphan)
        (self.wiki_path / "01_Concepts" / "unreachable.md").write_text(
            "---\n"
            "id: unreachable\n"
            "type: concept\n"
            "source_paths: [\"unreachable.py\"]\n"
            "last_compiled: 2026-07-04\n"
            "---\n"
            "I link to [[good]]. But no one links to me (other links to me but other is reachable... wait.)\n"
            "Let's fix reachable logic: index links to good and other.\n"
        )

        # Actually make an unreachable page
        (self.wiki_path / "02_Modules" / "true_orphan.md").write_text(
            "---\n"
            "id: true_orphan\n"
            "type: module\n"
            "source_paths: [\"true_orphan.py\"]\n"
            "last_compiled: 2026-07-04\n"
            "---\n"
            "Link to [[good]].\n"
        )

        # Dead link
        (self.wiki_path / "02_Modules" / "dead_linker.md").write_text(
            "---\n"
            "id: dead_linker\n"
            "type: module\n"
            "source_paths: [\"dl.py\"]\n"
            "last_compiled: 2026-07-04\n"
            "---\n"
            "Link to [[does_not_exist]].\n"
        )

        # Index file
        (self.wiki_path / "03_Indexes" / "000-Main.md").write_text(
            "# Index\n"
            "- [[good]]\n"
            "- [[other]]\n"
            "- [[dead_linker]]\n"
        )

        # Non-ASCII page
        with open(self.wiki_path / "01_Concepts" / "non_ascii.md", "wb") as f:
            f.write(b"---\n")
            f.write(b"id: non_ascii\n")
            f.write(b"type: concept\n")
            f.write(b"source_paths: [\"x\"]\n")
            f.write(b"last_compiled: x\n")
            f.write(b"---\n")
            f.write(b"Link to [[good]].\n")
            f.write(b"Non-ascii: \xff\xfe\n")

        # Missing frontmatter page
        (self.wiki_path / "01_Concepts" / "no_fm.md").write_text("No frontmatter at all.")

        # Missing fields page
        (self.wiki_path / "01_Concepts" / "missing_fields.md").write_text(
            "---\n"
            "id: missing_fields\n"
            "type: concept\n"
            "---\n"
            "Missing source_paths and last_compiled.\n"
        )

        self.lint_script = Path(__file__).parent.parent / "wiki_lint.py"

    def tearDown(self):
        self.wiki_dir.cleanup()

    def run_lint(self, json_out=False):
        cmd = [sys.executable, str(self.lint_script), "--wiki", str(self.wiki_path)]
        if json_out:
            cmd.append("--json")
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result

    def test_lint_json(self):
        result = self.run_lint(json_out=True)
        self.assertNotEqual(result.returncode, 0)

        data = json.loads(result.stdout)

        # non-ascii
        self.assertTrue(any("non_ascii.md" in p for p in data["non_ascii"]))

        # dead links
        self.assertTrue(any("does_not_exist" == x.get("target") for x in data["dead_links"]))

        # dead ends
        self.assertTrue(any("dead_end.md" in x.get("file", "") for x in data["dead_ends"]))

        # orphans
        self.assertTrue(any("true_orphan.md" in p for p in data["orphans"]))

        # frontmatter errors
        self.assertTrue(any("no_fm.md" in x.get("file", "") and "Missing or invalid frontmatter" in x.get("error", "") for x in data["frontmatter"]))
        self.assertTrue(any("missing_fields.md" in x.get("file", "") and "Missing fields: source_paths, last_compiled" in x.get("error", "") for x in data["frontmatter"]))

    def test_lint_clean(self):
        # Create a clean wiki
        clean_dir = tempfile.TemporaryDirectory()
        clean_path = Path(clean_dir.name)
        (clean_path / "03_Indexes").mkdir()
        (clean_path / "01_Concepts").mkdir()

        (clean_path / "03_Indexes" / "000-Index.md").write_text("- [[page1]]")
        (clean_path / "01_Concepts" / "page1.md").write_text(
            "---\n"
            "id: page1\n"
            "type: concept\n"
            "source_paths: [\"page1.py\"]\n"
            "last_compiled: today\n"
            "---\n"
            "Link to [[000-Index]].\n"
        )

        cmd = [sys.executable, str(self.lint_script), "--wiki", str(clean_path)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("clean", result.stdout.lower())

        clean_dir.cleanup()

    # ---- Phase 3 new rule: source_paths resolving into docs/archive/ or dated-root ----

    def test_untrusted_source_path_archive(self):
        wiki_dir = tempfile.TemporaryDirectory()
        wiki_path = Path(wiki_dir.name)
        (wiki_path / "03_Indexes").mkdir()
        (wiki_path / "01_Concepts").mkdir()
        (wiki_path / "03_Indexes" / "000-Index.md").write_text("- [[archived_page]]")
        (wiki_path / "01_Concepts" / "archived_page.md").write_text(
            "---\n"
            "id: archived_page\n"
            "type: concept\n"
            "source_paths: [\"docs/archive/2026-05-19_old/OLD_PLAN.md\"]\n"
            "last_compiled: today\n"
            "---\n"
            "Link to [[000-Index]].\n"
        )
        cmd = [sys.executable, str(self.lint_script), "--wiki", str(wiki_path), "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        data = json.loads(result.stdout)
        self.assertTrue(any(
            x.get("file") == "01_Concepts/archived_page.md" and x.get("source_path", "").startswith("docs/archive/")
            for x in data["untrusted_source_paths"]
        ))
        wiki_dir.cleanup()

    def test_untrusted_source_path_archive_case_insensitive(self):
        # A case-sensitive prefix check would silently miss "Docs/Archive/..." on a
        # case-preserving filesystem.
        wiki_dir = tempfile.TemporaryDirectory()
        wiki_path = Path(wiki_dir.name)
        (wiki_path / "03_Indexes").mkdir()
        (wiki_path / "01_Concepts").mkdir()
        (wiki_path / "03_Indexes" / "000-Index.md").write_text("- [[archived_page2]]")
        (wiki_path / "01_Concepts" / "archived_page2.md").write_text(
            "---\n"
            "id: archived_page2\n"
            "type: concept\n"
            "source_paths: [\"Docs/Archive/2026-05-19_old/OLD_PLAN.md\"]\n"
            "last_compiled: today\n"
            "---\n"
            "Link to [[000-Index]].\n"
        )
        cmd = [sys.executable, str(self.lint_script), "--wiki", str(wiki_path), "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        data = json.loads(result.stdout)
        self.assertTrue(any(
            x.get("file") == "01_Concepts/archived_page2.md"
            for x in data["untrusted_source_paths"]
        ))
        wiki_dir.cleanup()

    def test_untrusted_source_path_dated_root(self):
        wiki_dir = tempfile.TemporaryDirectory()
        wiki_path = Path(wiki_dir.name)
        (wiki_path / "03_Indexes").mkdir()
        (wiki_path / "01_Concepts").mkdir()
        (wiki_path / "03_Indexes" / "000-Index.md").write_text("- [[handoff_page]]")
        (wiki_path / "01_Concepts" / "handoff_page.md").write_text(
            "---\n"
            "id: handoff_page\n"
            "type: concept\n"
            "source_paths: [\"FRESH_SESSION_HANDOFF_2026_07_17_KB.md\"]\n"
            "last_compiled: today\n"
            "---\n"
            "Link to [[000-Index]].\n"
        )
        cmd = [sys.executable, str(self.lint_script), "--wiki", str(wiki_path), "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        data = json.loads(result.stdout)
        self.assertTrue(any(
            x.get("source_path") == "FRESH_SESSION_HANDOFF_2026_07_17_KB.md"
            for x in data["untrusted_source_paths"]
        ))
        wiki_dir.cleanup()

    def test_trusted_source_path_not_flagged(self):
        # README.md and ordinary docs/** paths (not docs/archive/) must never be flagged.
        wiki_dir = tempfile.TemporaryDirectory()
        wiki_path = Path(wiki_dir.name)
        (wiki_path / "03_Indexes").mkdir()
        (wiki_path / "01_Concepts").mkdir()
        (wiki_path / "03_Indexes" / "000-Index.md").write_text("- [[trusted_page]]")
        (wiki_path / "01_Concepts" / "trusted_page.md").write_text(
            "---\n"
            "id: trusted_page\n"
            "type: concept\n"
            "source_paths: [\"docs/GATE_MODE_SOP.md\"]\n"
            "last_compiled: today\n"
            "---\n"
            "Link to [[000-Index]].\n"
        )
        cmd = [sys.executable, str(self.lint_script), "--wiki", str(wiki_path), "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        data = json.loads(result.stdout)
        self.assertEqual(data["untrusted_source_paths"], [])

    # ---- Phase 3 new rule: semantic-derived page lacking confidence frontmatter ----

    def test_semantic_page_missing_confidence_fails(self):
        wiki_dir = tempfile.TemporaryDirectory()
        wiki_path = Path(wiki_dir.name)
        (wiki_path / "03_Indexes").mkdir()
        (wiki_path / "01_Concepts").mkdir()
        (wiki_path / "03_Indexes" / "000-Index.md").write_text("- [[semantic_page]]")
        (wiki_path / "01_Concepts" / "semantic_page.md").write_text(
            "---\n"
            "id: semantic_page\n"
            "type: concept\n"
            "source_paths: [\"docs/design.md\"]\n"
            "last_compiled: today\n"
            "doc_status: semantic\n"
            "---\n"
            "Link to [[000-Index]].\n"
        )
        cmd = [sys.executable, str(self.lint_script), "--wiki", str(wiki_path), "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        data = json.loads(result.stdout)
        self.assertTrue(any(
            x.get("file") == "01_Concepts/semantic_page.md"
            for x in data["semantic_missing_confidence"]
        ))

    def test_semantic_page_with_confidence_passes(self):
        wiki_dir = tempfile.TemporaryDirectory()
        wiki_path = Path(wiki_dir.name)
        (wiki_path / "03_Indexes").mkdir()
        (wiki_path / "01_Concepts").mkdir()
        (wiki_path / "03_Indexes" / "000-Index.md").write_text("- [[semantic_page]]")
        (wiki_path / "01_Concepts" / "semantic_page.md").write_text(
            "---\n"
            "id: semantic_page\n"
            "type: concept\n"
            "source_paths: [\"docs/design.md\"]\n"
            "last_compiled: today\n"
            "doc_status: semantic\n"
            "confidence: extracted\n"
            "---\n"
            "Link to [[000-Index]].\n"
        )
        cmd = [sys.executable, str(self.lint_script), "--wiki", str(wiki_path), "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        data = json.loads(result.stdout)
        self.assertEqual(data["semantic_missing_confidence"], [])

if __name__ == '__main__':
    unittest.main()
