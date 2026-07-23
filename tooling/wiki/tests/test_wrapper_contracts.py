import unittest
from pathlib import Path


WIKI_DIR = Path(__file__).parent.parent


class TestWrapperContracts(unittest.TestCase):
    def test_on_demand_publishes_only_after_staging_gates(self):
        script = (WIKI_DIR / "sync_wiki.ps1").read_text(encoding="ascii")
        prepare = script.index("prepare --served")
        compile_wiki = script.index("wiki_compile.py")
        lint_wiki = script.index("wiki_lint.py")
        scan_wiki = script.index("--target wiki.staging")
        finalize = script.index("finalize --staging")
        swap = script.index("swap --served")

        self.assertLess(prepare, compile_wiki)
        self.assertLess(compile_wiki, lint_wiki)
        self.assertLess(lint_wiki, scan_wiki)
        self.assertLess(scan_wiki, finalize)
        self.assertLess(finalize, swap)
        self.assertNotIn("--head $syncHead", script.split("wiki_compile.py", 1)[1].splitlines()[0])

    def test_nightly_fetch_receipt_and_publish_package_are_wired(self):
        script = (WIKI_DIR / "nightly_wiki_sync.ps1").read_text(encoding="ascii")
        fetch = script.index("serve_gate.py")
        fetch_command = script.index(" fetch --receipt")
        prepare = script.index("prepare --served")
        compile_wiki = script.index("wiki_compile.py", prepare)
        lint_wiki = script.index("wiki_lint.py", compile_wiki)
        verify = script.index(" verify --receipt")
        finalize = script.index("finalize --staging")
        swap = script.index("swap --served")

        self.assertLess(fetch, fetch_command)
        self.assertLess(fetch_command, prepare)
        self.assertLess(prepare, compile_wiki)
        self.assertLess(compile_wiki, lint_wiki)
        self.assertLess(lint_wiki, verify)
        self.assertLess(verify, finalize)
        self.assertLess(finalize, swap)
        self.assertNotIn("Rename-Item $ws", script)
        self.assertNotIn("Copy-Item (Join-Path $RepoRoot \"graphify-out\\graph.json\")", script)
        self.assertIn("[guid]::NewGuid()", script)
        self.assertIn("'--state', $promotionCandidate", script)
        self.assertNotIn("'--state', (Join-Path $RepoRoot \"wiki\\.graph\\promotion.json\")", script)

    def test_freshness_advisory_uses_configured_runtime_and_kill_switch(self):
        script = (WIKI_DIR / "check_nightly_freshness_advisory.ps1").read_text(
            encoding="ascii"
        )
        kill_switch = script.index("SSTAC_WIKI_HOOKS_OFF")
        runtime = script.index("SSTAC_WIKI_RUNTIME_ROOT")
        checker = script.index("& powershell")

        self.assertLess(kill_switch, checker)
        self.assertLess(runtime, checker)

    def test_build_stamp_is_not_written_by_compiler(self):
        compiler = (WIKI_DIR / "wiki_compile.py").read_text(encoding="ascii")
        publisher = (WIKI_DIR / "publish_wiki.py").read_text(encoding="ascii")

        self.assertNotIn(".build-stamp", compiler)
        self.assertIn(".build-stamp", publisher)


if __name__ == "__main__":
    unittest.main()
