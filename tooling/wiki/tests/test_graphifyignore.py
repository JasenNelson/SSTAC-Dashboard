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
        extensions = ['*.mdx', '*.qmd', '*.txt', '*.rst', '*.html', '*.yaml', '*.yml', '*.md']
        for ext in extensions:
            self.assertIn(ext, self.lines)

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
