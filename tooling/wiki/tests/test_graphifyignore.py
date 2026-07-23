import unittest
from pathlib import Path


class TestGraphifyIgnore(unittest.TestCase):
    def setUp(self):
        self.ignore_path = Path(__file__).resolve().parent.parent.parent.parent / ".graphifyignore"
        with open(self.ignore_path, 'r', encoding='utf-8') as f:
            self.lines = f.read().splitlines()

    def test_json_exclusion_exists(self):
        self.assertIn('*.json', self.lines)

    def test_doc_extensions_exist(self):
        # Phase 4 (2026-07-22): ALL doc-extension blankets stay as the fail-closed
        # DEFAULT-DENY base; the registered md set is re-admitted per run by the
        # GENERATED docs/.graphifyignore negation overlay (gen_docs_scope --emit-overlay).
        extensions = ['*.mdx', '*.qmd', '*.txt', '*.rst', '*.html', '*.yaml', '*.yml', '*.md']
        for ext in extensions:
            self.assertIn(ext, self.lines)

    def test_phase4_default_deny_plus_overlay_contract(self):
        self.assertIn('*.md', self.lines, "the fail-closed blanket *.md base must remain")
        self.assertIn('/*.md', self.lines, "root-md docs-trust exclusion must remain")
        self.assertIn('/docs/archive/', self.lines)
        self.assertIn('*.pre-*', self.lines)
        self.assertIn('/.claude/', self.lines)
        # The overlay mechanism must be documented in the ignore file itself, and the
        # generated overlay must be gitignored (never committed).
        raw = "\n".join(self.lines)
        self.assertIn('--emit-overlay', raw)
        gitignore = (self.ignore_path.parent / '.gitignore').read_text(encoding='utf-8')
        self.assertIn('/docs/.graphifyignore', gitignore)

    def test_readme_negation_is_last_md_matching_line(self):
        last_md_match = None
        for line in self.lines:
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue
            if '.md' in stripped and stripped.endswith('.md'):
                last_md_match = stripped
        self.assertEqual(last_md_match, '!/README.md')

    def test_no_directory_wide_negations(self):
        for line in self.lines:
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue
            if stripped.startswith('!'):
                self.assertFalse(stripped.endswith('/'), f"Directory-wide negation found: {line}")


if __name__ == '__main__':
    unittest.main()
