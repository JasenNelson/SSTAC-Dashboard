"""Tests for doc_code_candidates.py -- deterministic DOC_CODE candidate mining.

Mechanical, exact-value tests against a small synthetic graph.json + a handful of
fixture document files written to a temp repo root. No graph traversal, no model,
no Ollama -- the tool under test is pure string resolution, so every expected
count in here is computed by hand from the fixture and asserted exactly.

Style follows test_graph_query_assist.py: subprocess-invoke the script exactly as
a caller would, with PYTHONDONTWRITEBYTECODE=1 set explicitly in the env even
though the script also sets sys.dont_write_bytecode itself.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).parent.parent / "doc_code_candidates.py"


def _write(path, lines):
    """Write lines (no trailing newlines in each) as an ASCII file, LF-only, so
    line numbers are exact and platform-independent."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="ascii", newline="\n") as handle:
        handle.write("\n".join(lines) + "\n")


def _node(node_id, label, file_type, source_file, source_location):
    return {
        "id": node_id,
        "label": label,
        "file_type": file_type,
        "source_file": source_file,
        "source_location": source_location,
    }


def _sha256(path):
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


class DocCodeCandidatesFixture(unittest.TestCase):
    """Base class: builds one shared synthetic repo + graph.json in a temp dir.

    Every scenario in the module docstring's test list gets its own document
    file and (where needed) its own code node(s), so scenarios cannot bleed
    into each other's candidate counts. Expected totals for the DEFAULT run
    (--limit-per-doc 25, the tool's own default) are computed by hand below
    and asserted exactly in test_default_run_totals_are_exact.
    """

    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.repo_root = Path(cls.temp_dir.name)
        cls.graph_path = cls.repo_root / "graph.json"

        # ---- fixture document files -----------------------------------
        _write(cls.repo_root / "docs" / "file_ref.md", [
            "# File Ref",
            "See `src/pkg/foo.py` for details.",
        ])
        _write(cls.repo_root / "docs" / "func_plain.md", [
            "# Func Plain",
            "Call `compute_widget` now.",
        ])
        _write(cls.repo_root / "docs" / "func_paren.md", [
            "# Func Paren",
            "Call `compute_widget()` now.",
        ])
        _write(cls.repo_root / "docs" / "fenced_ref.md", [
            "# Fenced Ref",
            "Example:",
            "```",
            "fenced_target",
            "```",
        ])
        section_lines = ["# Sections"]
        for i in range(2, 61):
            if i == 60:
                section_lines.append("See `section_target` for the algorithm.")
            else:
                section_lines.append("Filler paragraph line %d." % i)
        _write(cls.repo_root / "docs" / "sections.md", section_lines)
        _write(cls.repo_root / "docs" / "ambig_ref.md", [
            "# Ambiguous",
            "Use `helper_thing` here.",
        ])
        _write(cls.repo_root / "docs" / "generic_ref.md", [
            "# Generic",
            "The `data` is here.",
        ])
        _write(cls.repo_root / "docs" / "selfref.md", [
            "# Self Reference",
            "See `docs/selfref.md` for more.",
        ])
        _write(cls.repo_root / "docs" / "prose_ref.md", [
            "# Prose",
            "Please `see the docs` first.",
        ])
        _write(cls.repo_root / "docs" / "many_refs.md", [
            "# Many Refs",
            "Ref one `limit_target_1`.",
            "Ref two `limit_target_2`.",
            "Ref three `limit_target_3`.",
            "Ref four `limit_target_4`.",
            "Ref five `limit_target_5`.",
        ])

        # ---- graph.json nodes -------------------------------------------
        nodes = []

        # document nodes (one "section" node per heading; sections.md gets 3)
        nodes.append(_node("doc:file_ref", "File Ref", "document", "docs/file_ref.md", "L1"))
        nodes.append(_node("doc:func_plain", "Func Plain", "document", "docs/func_plain.md", "L1"))
        nodes.append(_node("doc:func_paren", "Func Paren", "document", "docs/func_paren.md", "L1"))
        nodes.append(_node("doc:fenced_ref", "Fenced Ref", "document", "docs/fenced_ref.md", "L1"))
        nodes.append(_node("doc:sec_l1", "Intro", "document", "docs/sections.md", "L1"))
        nodes.append(_node("doc:sec_l50", "Middle", "document", "docs/sections.md", "L50"))
        nodes.append(_node("doc:sec_l100", "End", "document", "docs/sections.md", "L100"))
        nodes.append(_node("doc:ambig_ref", "Ambiguous", "document", "docs/ambig_ref.md", "L1"))
        nodes.append(_node("doc:generic_ref", "Generic", "document", "docs/generic_ref.md", "L1"))
        nodes.append(_node("doc:selfref", "Self Reference", "document", "docs/selfref.md", "L1"))
        nodes.append(_node("doc:prose_ref", "Prose", "document", "docs/prose_ref.md", "L1"))
        nodes.append(_node("doc:many_refs", "Many Refs", "document", "docs/many_refs.md", "L1"))

        # code nodes
        # foo.py: 3 nodes share one source_file -- a real file-vs-member choice.
        nodes.append(_node("code:foo_file", "foo.py", "code", "src/pkg/foo.py", "L1"))
        nodes.append(_node("code:foo_bar", "bar_func", "code", "src/pkg/foo.py", "L10"))
        nodes.append(_node("code:foo_baz", "baz_func", "code", "src/pkg/foo.py", "L20"))
        nodes.append(_node("code:compute_widget", "compute_widget", "code", "src/pkg/mod.py", "L5"))
        nodes.append(_node("code:fenced_target", "fenced_target", "code", "src/pkg/fenced.py", "L1"))
        nodes.append(_node("code:section_target", "section_target", "code",
                            "src/pkg/section_target.py", "L1"))
        # two nodes share the label "helper_thing" -> ambiguous
        nodes.append(_node("code:helper1", "helper_thing", "code", "src/pkg/helper1.py", "L1"))
        nodes.append(_node("code:helper2", "helper_thing", "code", "src/pkg/helper2.py", "L1"))
        # a code node whose source_file equals a document's own source_file
        nodes.append(_node("code:selfref_file", "selfref.md", "code", "docs/selfref.md", "L1"))
        for i in range(1, 6):
            nodes.append(_node("code:limit_target_%d" % i, "limit_target_%d" % i, "code",
                                "src/pkg/limit_%d.py" % i, "L1"))

        graph = {"nodes": nodes, "links": []}
        with open(cls.graph_path, "w", encoding="ascii", newline="\n") as handle:
            handle.write(json.dumps(graph, indent=2) + "\n")

        cls.graph_hash_before_any_run = _sha256(cls.graph_path)

        # ---- one shared DEFAULT run (--limit-per-doc uses the tool default) --
        cls.default_out = cls.repo_root / "candidates_default.json"
        cls.default_proc = cls._invoke(cls, out_path=cls.default_out)
        assert cls.default_proc.returncode == 0, cls.default_proc.stderr
        with open(cls.default_out, "r", encoding="utf-8") as handle:
            cls.default_payload = json.load(handle)

        cls.graph_hash_after_default_run = _sha256(cls.graph_path)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    @classmethod
    def _invoke(cls, self_unused, out_path, limit_per_doc=None, graph_path=None):
        env = dict(os.environ)
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        args = [
            sys.executable, "-X", "utf8", str(SCRIPT_PATH),
            "--graph", str(graph_path or cls.graph_path),
            "--repo-root", str(cls.repo_root),
            "--out", str(out_path),
        ]
        if limit_per_doc is not None:
            args += ["--limit-per-doc", str(limit_per_doc)]
        return subprocess.run(
            args, capture_output=True, text=True, check=False, env=env, timeout=30,
        )

    def candidates_for(self, source_file, payload=None):
        payload = payload or self.default_payload
        return [c for c in payload["candidates"] if c["source_file"] == source_file]

    def targets_for(self, source_file, payload=None):
        return {c["target"] for c in self.candidates_for(source_file, payload)}


class TestPositive(DocCodeCandidatesFixture):

    def test_1_file_level_resolution_not_member_node(self):
        cands = self.candidates_for("docs/file_ref.md")
        self.assertEqual(len(cands), 1)
        self.assertEqual(cands[0]["target"], "code:foo_file")
        self.assertEqual(cands[0]["target_label"], "foo.py")
        # negative half: neither in-file member node was ever chosen, anywhere
        all_targets = {c["target"] for c in self.default_payload["candidates"]}
        self.assertNotIn("code:foo_bar", all_targets)
        self.assertNotIn("code:foo_baz", all_targets)

    def test_2_unambiguous_label_both_bare_and_paren_forms(self):
        plain = self.candidates_for("docs/func_plain.md")
        paren = self.candidates_for("docs/func_paren.md")
        self.assertEqual(len(plain), 1)
        self.assertEqual(len(paren), 1)
        self.assertEqual(plain[0]["target"], "code:compute_widget")
        self.assertEqual(paren[0]["target"], "code:compute_widget")
        self.assertEqual(plain[0]["evidence"]["quoted"], "compute_widget")
        self.assertEqual(paren[0]["evidence"]["quoted"], "compute_widget()")

    def test_3_fenced_code_block_citation_with_correct_line(self):
        cands = self.candidates_for("docs/fenced_ref.md")
        self.assertEqual(len(cands), 1)
        self.assertEqual(cands[0]["target"], "code:fenced_target")
        self.assertEqual(cands[0]["evidence"]["line"], 4)
        self.assertEqual(cands[0]["evidence"]["quoted"], "fenced_target")

    def test_4_section_attribution_picks_l50_not_l1_or_l100(self):
        cands = self.candidates_for("docs/sections.md")
        self.assertEqual(len(cands), 1)
        cand = cands[0]
        self.assertEqual(cand["target"], "code:section_target")
        self.assertEqual(cand["source"], "doc:sec_l50")
        self.assertEqual(cand["source_label"], "Middle")
        self.assertEqual(cand["source_section_line"], 50)
        self.assertNotEqual(cand["source"], "doc:sec_l1")
        self.assertNotEqual(cand["source"], "doc:sec_l100")
        self.assertEqual(cand["evidence"]["line"], 60)

    def test_5_every_evidence_quote_matches_its_own_line_in_the_cited_file(self):
        self.assertGreater(len(self.default_payload["candidates"]), 0)
        for cand in self.default_payload["candidates"]:
            evidence = cand["evidence"]
            full_path = self.repo_root / evidence["cited_in"].replace("/", os.sep)
            with open(full_path, "r", encoding="ascii") as handle:
                file_lines = handle.read().splitlines()
            self.assertLessEqual(evidence["line"], len(file_lines))
            actual_line = file_lines[evidence["line"] - 1]
            self.assertIn(
                evidence["quoted"], actual_line,
                msg="quoted %r not found on line %d of %s: %r"
                    % (evidence["quoted"], evidence["line"], evidence["cited_in"], actual_line),
            )


class TestNegative(DocCodeCandidatesFixture):

    def test_6_ambiguous_label_excluded_and_counted(self):
        cands = self.candidates_for("docs/ambig_ref.md")
        self.assertEqual(cands, [])
        all_targets = {c["target"] for c in self.default_payload["candidates"]}
        self.assertNotIn("code:helper1", all_targets)
        self.assertNotIn("code:helper2", all_targets)
        self.assertGreaterEqual(
            self.default_payload["unresolved_reason_counts"].get("AMBIGUOUS_LABEL", 0), 1
        )

    def test_7_generic_bare_word_produces_no_candidate(self):
        cands = self.candidates_for("docs/generic_ref.md")
        self.assertEqual(cands, [])
        self.assertGreaterEqual(
            self.default_payload["unresolved_reason_counts"].get("TOO_GENERIC", 0), 1
        )

    def test_8_self_reference_excluded_and_counted(self):
        cands = self.candidates_for("docs/selfref.md")
        self.assertEqual(cands, [])
        all_targets = {c["target"] for c in self.default_payload["candidates"]}
        self.assertNotIn("code:selfref_file", all_targets)
        self.assertGreaterEqual(
            self.default_payload["unresolved_reason_counts"].get("SELF_REFERENCE", 0), 1
        )

    def test_9_non_identifier_prose_produces_no_candidate(self):
        cands = self.candidates_for("docs/prose_ref.md")
        self.assertEqual(cands, [])
        self.assertGreaterEqual(
            self.default_payload["unresolved_reason_counts"].get("NOT_AN_IDENTIFIER", 0), 1
        )


class TestSafety(DocCodeCandidatesFixture):

    def test_10_graph_byte_identical_after_run(self):
        self.assertEqual(self.graph_hash_before_any_run, self.graph_hash_after_default_run)

    def test_11_out_equals_graph_is_refused_and_graph_untouched(self):
        before = _sha256(self.graph_path)
        proc = self._invoke(self, out_path=self.graph_path)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("REFUSED", proc.stdout)
        after = _sha256(self.graph_path)
        self.assertEqual(before, after)

    def test_12_limit_per_doc_caps_single_document_contribution(self):
        out_path = self.repo_root / "candidates_limited.json"
        proc = self._invoke(self, out_path=out_path, limit_per_doc=2)
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        with open(out_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        capped = self.candidates_for("docs/many_refs.md", payload=payload)
        self.assertEqual(len(capped), 2)
        self.assertEqual(
            {c["target"] for c in capped},
            {"code:limit_target_1", "code:limit_target_2"},
        )
        # every other document's citation count is 1, so a cap of 2 changes nothing there
        self.assertEqual(len(self.candidates_for("docs/file_ref.md", payload=payload)), 1)


class TestExactTotals(DocCodeCandidatesFixture):
    """Hand-computed exact totals for the default run, so any change to matching,
    dedup, or counting logic is caught even if it does not touch a named field
    checked elsewhere."""

    def test_default_run_totals_are_exact(self):
        payload = self.default_payload
        self.assertEqual(payload["document_nodes_seen"], 10)
        self.assertEqual(payload["documents_contributing"], 6)
        self.assertEqual(payload["candidate_count"], 10)
        self.assertEqual(payload["distinct_code_targets"], 9)
        self.assertEqual(payload["unreadable_document_sources"], [])
        self.assertEqual(payload["canonical_graph_modified"], False)
        self.assertEqual(payload["generated_without_model"], True)


if __name__ == "__main__":
    unittest.main()
