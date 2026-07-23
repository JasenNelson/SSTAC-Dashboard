import stat
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tooling.wiki.publish_wiki import (
    PublishError,
    _is_link_or_junction,
    checked_path,
    finalize_staging,
    prepare_staging,
    swap_staging,
)


class TestPublishWiki(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.served = self.root / "wiki"
        self.staging = self.root / "wiki.staging"
        self.backup = self.root / ".tmp" / "wiki-backup"
        self.graph = self.root / "graphify-out" / "graph.json"
        self.report = self.root / "graphify-out" / "GRAPH_REPORT.md"

        (self.served / "02_Modules").mkdir(parents=True)
        (self.served / ".graph").mkdir()
        (self.served / "02_Modules" / "module.md").write_text(
            "old page\n## Manual Notes\nkeep me\n",
            encoding="ascii",
        )
        (self.served / ".graph" / "promotion.json").write_text(
            '{"ledger":"keep"}\n',
            encoding="ascii",
        )
        (self.served / ".graph" / "contradictions.json").write_text(
            '[{"existing":true}]\n',
            encoding="ascii",
        )
        (self.served / ".graph" / "GRAPH_REPORT.md").write_text(
            "stale report\n",
            encoding="ascii",
        )
        (self.served / ".build-stamp").write_text(
            "Build Stamp: old\nHEAD: old\n",
            encoding="ascii",
        )
        self.graph.parent.mkdir()
        self.graph.write_text('{"nodes":[],"links":[]}\n', encoding="ascii")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_package_preserves_state_and_publishes_all_artifacts(self):
        prepare_staging(self.served, self.staging)
        self.assertIn(
            "keep me",
            (self.staging / "02_Modules" / "module.md").read_text(encoding="ascii"),
        )

        self.report.write_text("fresh report\n", encoding="ascii")
        finalize_staging(
            staging=self.staging,
            graph=self.graph,
            graph_report=self.report,
            stamp="2026-07-22",
            head="abc123",
        )
        swap_staging(served=self.served, staging=self.staging, backup=self.backup)

        self.assertFalse(self.staging.exists())
        self.assertFalse(self.backup.exists())
        self.assertEqual(
            (self.served / ".graph" / "promotion.json").read_text(encoding="ascii"),
            '{"ledger":"keep"}\n',
        )
        self.assertEqual(
            (self.served / ".graph" / "contradictions.json").read_text(
                encoding="ascii"
            ),
            '[{"existing":true}]\n',
        )
        self.assertEqual(
            (self.served / ".graph" / "graph.json").read_text(encoding="ascii"),
            '{"nodes":[],"links":[]}\n',
        )
        self.assertEqual(
            (self.served / ".graph" / "GRAPH_REPORT.md").read_text(
                encoding="ascii"
            ),
            "fresh report\n",
        )
        self.assertEqual(
            (self.served / ".build-stamp").read_text(encoding="ascii"),
            "Build Stamp: 2026-07-22\nHEAD: abc123\n",
        )

    def test_missing_new_report_removes_stale_staged_report(self):
        prepare_staging(self.served, self.staging)
        finalize_staging(
            staging=self.staging,
            graph=self.graph,
            graph_report=self.report,
            stamp="2026-07-22",
            head="abc123",
        )
        self.assertFalse(
            (self.staging / ".graph" / "GRAPH_REPORT.md").exists()
        )

    def test_unpublished_promotion_candidate_leaves_served_state_byte_identical(self):
        served_state = self.served / ".graph" / "promotion.json"
        original_bytes = served_state.read_bytes()
        candidate = self.root / ".tmp" / "promotion-candidate.json"
        candidate.parent.mkdir()
        candidate.write_text('{"ledger":"candidate"}\n', encoding="ascii")

        prepare_staging(self.served, self.staging)
        finalize_staging(
            staging=self.staging,
            graph=self.graph,
            graph_report=self.report,
            stamp="2026-07-22",
            head="abc123",
            promotion_state=candidate,
        )

        self.assertEqual(served_state.read_bytes(), original_bytes)
        self.assertEqual(
            (self.staging / ".graph" / "promotion.json").read_bytes(),
            candidate.read_bytes(),
        )

    def test_failed_swap_restores_last_good(self):
        prepare_staging(self.served, self.staging)
        original_rename = Path.rename
        call_count = 0

        def fail_second_rename(path, target):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise OSError("injected staging rename failure")
            return original_rename(path, target)

        with mock.patch.object(Path, "rename", autospec=True, side_effect=fail_second_rename):
            with self.assertRaisesRegex(PublishError, "last-good restored"):
                swap_staging(
                    served=self.served,
                    staging=self.staging,
                    backup=self.backup,
                )

        self.assertTrue(self.served.exists())
        self.assertIn(
            "keep me",
            (self.served / "02_Modules" / "module.md").read_text(encoding="ascii"),
        )
        self.assertTrue(self.staging.exists())
        self.assertFalse(self.backup.exists())

    def test_checked_path_rejects_repository_root_and_outside_path(self):
        with self.assertRaisesRegex(PublishError, "repository root"):
            checked_path(self.root, self.root)
        with self.assertRaisesRegex(PublishError, "outside repository root"):
            checked_path(self.root, self.root.parent / "outside")

    def test_checked_path_resolves_relative_to_repository_root(self):
        self.assertEqual(
            checked_path(self.root, Path("wiki")), self.root / "wiki"
        )

    def test_windows_reparse_point_is_treated_as_junction(self):
        reparse_point = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
        metadata = mock.Mock(st_file_attributes=reparse_point)

        with mock.patch.object(Path, "is_symlink", return_value=False):
            with mock.patch(
                "tooling.wiki.publish_wiki.os.lstat",
                return_value=metadata,
            ):
                self.assertTrue(_is_link_or_junction(self.root / "junction"))

    def test_nested_link_in_served_tree_fails_closed_before_copy(self):
        linked = self.served / ".graph" / "linked"
        linked.mkdir()

        def identify_nested_link(path):
            return path == linked

        with mock.patch(
            "tooling.wiki.publish_wiki._is_link_or_junction",
            side_effect=identify_nested_link,
        ):
            with self.assertRaisesRegex(PublishError, "linked entry"):
                prepare_staging(self.served, self.staging)

        self.assertFalse(self.staging.exists())


if __name__ == "__main__":
    unittest.main()
