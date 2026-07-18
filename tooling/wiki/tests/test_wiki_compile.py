import sys
import os
import json
import shutil
import tempfile
import unittest
import subprocess
from pathlib import Path

class TestWikiCompile(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.graph_path = os.path.join(self.temp_dir, 'graph.json')
        self.out_dir = os.path.join(self.temp_dir, 'wiki_out')
        self.script_path = os.path.join(os.path.dirname(__file__), '..', 'wiki_compile.py')

        self.graph_data = {
            "nodes": [
                {"id": "n1", "label": "bash_func", "file_type": "code", "source_file": "script.sh", "metadata": {"kind": "bash_function"}},
                {"id": "n2", "label": "TSClass", "file_type": "code", "source_file": "src/app.ts"},
                {"id": "n3", "label": "Doc Section 1", "file_type": "document", "source_file": "docs/design.md", "source_location": "L1"},
                {"id": "n4", "label": "Doc Section 2", "file_type": "document", "source_file": "docs/design.md", "source_location": "L10"},
                {"id": "n5", "label": "Doc Section 3", "file_type": "document", "source_file": "docs/arch.md", "source_location": "L5"},
                {"id": "n6", "label": "Another TS", "file_type": "code", "source_file": "src/app.ts"}
            ],
            "links": [
                {"source": "n1", "target": "n2", "relation": "calls", "confidence": "EXTRACTED"},
                {"source": "n2", "target": "n3", "relation": "unknown_rel", "confidence": "EXTRACTED"},
                {"source": "n3", "target": "n1", "relation": "references", "confidence": "INFERRED"},
                {"source": "n5", "target": "n2", "relation": "references", "confidence": "AMBIGUOUS", "source_file": "docs/arch.md", "source_location": "L5", "context": "maybe references the parser"},
                {"source": "n2", "target": "n6", "relation": "contains", "confidence": "EXTRACTED"}
            ]
        }

        with open(self.graph_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph_data, f)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def run_compiler(self, graph_path=None, out_dir=None, dry_run=False, stamp="2026-07-04"):
        if graph_path is None:
            graph_path = self.graph_path
        if out_dir is None:
            out_dir = self.out_dir

        cmd = [
            sys.executable, self.script_path,
            "--graph", graph_path,
            "--repo-root", self.temp_dir,
            "--out", out_dir,
            "--stamp", stamp
        ]
        if dry_run:
            cmd.append("--dry-run")
        return subprocess.run(cmd, check=True, capture_output=True, text=True)

    def test_basic_compile(self):
        self.run_compiler()

        modules = list(Path(self.out_dir, "02_Modules").glob("*.md"))
        concepts = list(Path(self.out_dir, "01_Concepts").glob("*.md"))
        self.assertEqual(len(modules), 2)
        self.assertEqual(len(concepts), 2)

        app_ts_content = Path(self.out_dir, "02_Modules", "src_app_ts.md").read_text(encoding='utf-8')
        self.assertIn("id: src_app_ts", app_ts_content)
        self.assertIn("type: module", app_ts_content)
        self.assertIn('source_paths: ["src/app.ts"]', app_ts_content)

        self.assertIn("### unknown_rel", app_ts_content)
        self.assertIn("- [[docs_design_md]]", app_ts_content)

        self.assertIn("### contains", app_ts_content)
        self.assertIn("- Another TS", app_ts_content)
        self.assertNotIn("- [[src_app_ts]]", app_ts_content)

        script_sh_content = Path(self.out_dir, "02_Modules", "script_sh.md").read_text(encoding='utf-8')
        self.assertIn("[?] [[docs_design_md]]", script_sh_content)
        self.assertIn("confidence: mixed", script_sh_content)

        ambig_path = Path(self.out_dir, "_review", "ambiguous.md")
        self.assertTrue(ambig_path.exists())
        ambig_content = ambig_path.read_text(encoding='utf-8')
        self.assertIn("n5 -> Target: n2", ambig_content)
        self.assertIn("File: docs/arch.md", ambig_content)
        self.assertIn("L5", ambig_content)
        self.assertIn("maybe references the parser", ambig_content)
        self.assertNotIn("AMBIGUOUS", app_ts_content)

        self.run_compiler()
        app_ts_content2 = Path(self.out_dir, "02_Modules", "src_app_ts.md").read_text(encoding='utf-8')
        self.assertEqual(app_ts_content, app_ts_content2)

    def test_orphan_and_manual_notes(self):
        self.run_compiler()

        app_ts_path = Path(self.out_dir, "02_Modules", "src_app_ts.md")
        content = app_ts_path.read_text(encoding='utf-8')
        content += "\n## Manual Notes\nMy manual notes here."
        app_ts_path.write_text(content, encoding='utf-8')

        self.graph_data['nodes'] = [n for n in self.graph_data['nodes'] if n['id'] != 'n6']
        self.graph_data['nodes'] = [n for n in self.graph_data['nodes'] if n['source_file'] != 'script.sh']

        with open(self.graph_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph_data, f)

        self.run_compiler()

        self.assertFalse(Path(self.out_dir, "02_Modules", "script_sh.md").exists())
        self.assertTrue(Path(self.out_dir, ".orphaned", "script_sh.md").exists())

        app_ts_content2 = app_ts_path.read_text(encoding='utf-8')
        self.assertIn("## Manual Notes", app_ts_content2)
        self.assertIn("> [!WARNING] Contradiction check needed", app_ts_content2)
        self.assertIn("My manual notes here.", app_ts_content2)

    def test_degenerate_source_file_skipped(self):
        self.graph_data['nodes'].append({
            "id": "ndot",
            "label": "RepoRoot",
            "file_type": "code",
            "source_file": "."
        })
        with open(self.graph_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph_data, f)

        fresh_out = os.path.join(self.temp_dir, 'degenerate_out')
        self.run_compiler(out_dir=fresh_out)

        for root, dirs, files in os.walk(fresh_out):
            for file in files:
                self.assertNotEqual(file, '.md', "Found a stray '.md' file with empty basename.")
                if file.endswith('.md'):
                    path = os.path.join(root, file)
                    content = Path(path).read_text(encoding='utf-8')
                    self.assertNotIn('[[]]', content, f"Found empty wiki-link in {path}")

    # ---- Phase 3 bounded enhancement: doc-provenance frontmatter hook ----

    def test_doc_provenance_frontmatter_inert_by_default(self):
        # No node in this graph carries metadata.extraction_method == "semantic" (Phase
        # 0-3 is code-only, no LLM) -- the hook must never fire, and no page should carry
        # a doc_status/extraction_date frontmatter key.
        self.run_compiler()
        app_ts_content = Path(self.out_dir, "02_Modules", "src_app_ts.md").read_text(encoding='utf-8')
        self.assertNotIn("doc_status:", app_ts_content)
        self.assertNotIn("extraction_date:", app_ts_content)

    def test_doc_provenance_frontmatter_fires_on_semantic_marker(self):
        # A future Phase 4 semantic-extraction node would carry this metadata marker.
        # Simulate it here to prove the (currently inert) hook activates correctly.
        self.graph_data['nodes'].append({
            "id": "n7",
            "label": "Doc Section 3 (semantic)",
            "file_type": "document",
            "source_file": "docs/design.md",
            "source_location": "L20",
            "metadata": {"extraction_method": "semantic", "extraction_date": "2026-07-10"}
        })
        with open(self.graph_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph_data, f)

        self.run_compiler()
        docs_content = Path(self.out_dir, "01_Concepts", "docs_design_md.md").read_text(encoding='utf-8')
        self.assertIn("doc_status: semantic", docs_content)
        self.assertIn("extraction_date: 2026-07-10", docs_content)

        # A page with no semantic-tagged node must remain unaffected.
        app_ts_content = Path(self.out_dir, "02_Modules", "src_app_ts.md").read_text(encoding='utf-8')
        self.assertNotIn("doc_status:", app_ts_content)

    # ---- Phase 3 bounded enhancement: structured contradiction emission ----

    def test_contradiction_emits_structured_json_once(self):
        self.run_compiler(stamp="2026-07-04")

        app_ts_path = Path(self.out_dir, "02_Modules", "src_app_ts.md")
        content = app_ts_path.read_text(encoding='utf-8')
        content += "\n## Manual Notes\nMy manual notes here."
        app_ts_path.write_text(content, encoding='utf-8')

        # Change the AST content for src/app.ts (drop n6) so the compiler detects a
        # contradiction against the existing page's stored AST content.
        self.graph_data['nodes'] = [n for n in self.graph_data['nodes'] if n['id'] != 'n6']
        with open(self.graph_path, 'w', encoding='utf-8') as f:
            json.dump(self.graph_data, f)

        self.run_compiler(stamp="2026-07-05")

        contradictions_path = Path(self.out_dir, ".graph", "contradictions.json")
        self.assertTrue(contradictions_path.exists())
        entries = json.loads(contradictions_path.read_text(encoding='utf-8'))
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]['page_id'], 'src_app_ts')
        self.assertEqual(entries[0]['source_paths'], ['src/app.ts'])
        self.assertEqual(entries[0]['detected_at'], '2026-07-05')
        self.assertEqual(entries[0]['reason'], 'ast_content_changed')

        # Recompiling again with the SAME (still-diverging, still-unresolved) graph must
        # NOT append a duplicate entry -- the WARNING block is already present, which is
        # the same guard that gates the structured emission.
        self.run_compiler(stamp="2026-07-06")
        entries2 = json.loads(contradictions_path.read_text(encoding='utf-8'))
        self.assertEqual(len(entries2), 1)

    def test_no_contradiction_file_written_when_no_contradiction(self):
        self.run_compiler()
        contradictions_path = Path(self.out_dir, ".graph", "contradictions.json")
        self.assertFalse(contradictions_path.exists())

if __name__ == '__main__':
    unittest.main()
