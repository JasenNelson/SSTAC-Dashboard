import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

class TestPromotion(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.state_path = Path(self.temp_dir.name) / "promotion.json"
        self.graph_path = Path(self.temp_dir.name) / "graph.json"
        self.promo_script = Path(__file__).parent.parent / "promotion.py"

    def tearDown(self):
        self.temp_dir.cleanup()

    def _pairs(self, prefix, n, confidence='INFERRED'):
        # Generates n distinct {prefix}{i}a -> {prefix}{i}b INFERRED edges. Distinct
        # prefixes let a single test mix multiple independently-tracked pools (e.g. an
        # "n" pool being churned + an "m" pool used purely to pad the graph-wide INFERRED
        # count so the coverage guard and the churn breaker can be exercised in isolation
        # from each other).
        nodes = []
        links = []
        for i in range(n):
            a, b = f'{prefix}{i}a', f'{prefix}{i}b'
            nodes.append({'id': a})
            nodes.append({'id': b})
            links.append({'source': a, 'target': b, 'relation': 'ref', 'confidence': confidence})
        return nodes, links

    def write_graph(self, nodes, links):
        with open(self.graph_path, 'w', encoding='utf-8') as f:
            json.dump({'nodes': nodes, 'links': links}, f)

    def read_state(self):
        if not self.state_path.exists():
            return None
        with open(self.state_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def run_promo(self, commit, report=False, extract_status=None, expect_ok=True):
        cmd = [sys.executable, str(self.promo_script),
               "--graph", str(self.graph_path),
               "--state", str(self.state_path),
               "--commit", commit]
        if report:
            cmd.append("--report")
        if extract_status:
            cmd += ["--extract-status", extract_status]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        return result

    # ---- Core lifecycle (unchanged semantics; pools sized to avoid the 90% coverage
    # ---- guard tripping on ordinary graduation/promotion churn) ----

    def test_promotion_by_three_commits(self):
        nodes, links = self._pairs('n', 12)
        self.write_graph(nodes, links)
        self.run_promo('c1')
        self.run_promo('c2')
        out = self.run_promo('c3', report=True).stdout
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'promoted')
        self.assertEqual(state['entries']['n0a::n0b::ref']['promoted_at'], 'c3')
        self.assertIn("Newly promoted: 12", out)

    def test_promotion_by_graduation_to_extracted(self):
        nodes, links = self._pairs('n', 12)
        self.write_graph(nodes, links)
        self.run_promo('c1')

        links[0]['confidence'] = 'EXTRACTED'
        self.write_graph(nodes, links)
        out = self.run_promo('c2', report=True).stdout
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'promoted')
        self.assertEqual(state['entries']['n0a::n0b::ref']['promoted_at'], 'c2')
        self.assertIn("Newly promoted: 1", out)

    def test_idempotent_rerun_same_commit(self):
        nodes, links = self._pairs('n', 12)
        self.write_graph(nodes, links)
        self.run_promo('c1')
        self.run_promo('c1')
        state = self.read_state()
        self.assertEqual(len(state['entries']['n0a::n0b::ref']['seen_in']), 1)

    def test_retirement_on_node_deletion(self):
        # 14 stable pairs pad the graph-wide INFERRED count so a single node deletion
        # (14/15 = 93% coverage) does not trip the coverage guard.
        nodes, links = self._pairs('n', 15)
        self.write_graph(nodes, links)
        self.run_promo('c1')

        nodes2 = [n for n in nodes if n['id'] != 'n0b']
        links2 = [l for l in links if l['target'] != 'n0b']
        self.write_graph(nodes2, links2)
        self.run_promo('c2')
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'retired')

    # ---- Demotion grace (bounded enhancement): tolerate 1 absence, demote on the 2nd
    # ---- consecutive absence, reset the streak on recovery. 14 stable pairs pad
    # ---- coverage (14/15 = 93%) so the guard never intercepts these scenarios. ----

    def test_demotion_requires_two_consecutive_absences(self):
        nodes, links = self._pairs('n', 15)
        self.write_graph(nodes, links)
        self.run_promo('c1')

        links_absent = [l for l in links if not (l['source'] == 'n0a' and l['target'] == 'n0b')]
        self.write_graph(nodes, links_absent)
        self.run_promo('c2')
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'inferred',
                          "a single absence must not demote")
        self.assertEqual(state['entries']['n0a::n0b::ref']['absent_streak'], 1)

        out = self.run_promo('c3', report=True).stdout
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'demoted')
        self.assertIn("Newly demoted: 1", out)

    def test_demotion_grace_resets_on_recovery(self):
        nodes, links = self._pairs('n', 15)
        self.write_graph(nodes, links)
        self.run_promo('c1')

        links_absent = [l for l in links if not (l['source'] == 'n0a' and l['target'] == 'n0b')]
        self.write_graph(nodes, links_absent)
        self.run_promo('c2')
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['absent_streak'], 1)

        self.write_graph(nodes, links)  # edge reappears
        self.run_promo('c3')
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['absent_streak'], 0)
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'inferred')

    # ---- Demoted-edge revival (codex + Opus review fix, 2026-07-17) ----

    def test_demoted_edge_revives_as_inferred_on_reappearance(self):
        nodes, links = self._pairs('n', 15)
        self.write_graph(nodes, links)
        self.run_promo('c1')

        links_absent = [l for l in links if not (l['source'] == 'n0a' and l['target'] == 'n0b')]
        self.write_graph(nodes, links_absent)
        self.run_promo('c2')  # absent_streak 1
        self.run_promo('c3')  # absent_streak 2 -> demoted
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'demoted')

        # Edge reappears as INFERRED -- must revive, not stay permanently demoted.
        self.write_graph(nodes, links)
        self.run_promo('c4')
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'inferred')
        self.assertEqual(state['entries']['n0a::n0b::ref']['absent_streak'], 0)
        self.assertEqual(state['entries']['n0a::n0b::ref']['seen_in'], ['c4'])

    def test_demoted_edge_revives_directly_to_promoted_on_extracted_graduation(self):
        nodes, links = self._pairs('n', 15)
        self.write_graph(nodes, links)
        self.run_promo('c1')

        links_absent = [l for l in links if not (l['source'] == 'n0a' and l['target'] == 'n0b')]
        self.write_graph(nodes, links_absent)
        self.run_promo('c2')
        self.run_promo('c3')  # n0a::n0b -> demoted
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'demoted')

        # Edge reappears with EXTRACTED confidence (skips INFERRED entirely).
        links_extracted = [dict(l) for l in links]
        for l in links_extracted:
            if l['source'] == 'n0a' and l['target'] == 'n0b':
                l['confidence'] = 'EXTRACTED'
        self.write_graph(nodes, links_extracted)
        self.run_promo('c4')
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'promoted')

    def test_repeated_absence_after_demotion_does_not_recount_newly_demoted(self):
        nodes, links = self._pairs('n', 15)
        self.write_graph(nodes, links)
        self.run_promo('c1')

        links_absent = [l for l in links if not (l['source'] == 'n0a' and l['target'] == 'n0b')]
        self.write_graph(nodes, links_absent)
        self.run_promo('c2')
        out3 = self.run_promo('c3', report=True).stdout  # demotes here
        self.assertIn("Newly demoted: 1", out3)

        # Still absent on c4 -- must NOT re-count as a newly-demoted transition.
        out4 = self.run_promo('c4', report=True).stdout
        self.assertIn("Newly demoted: 0", out4)
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'demoted')

    # ---- Churn circuit breaker (bounded enhancement) ----

    def test_churn_circuit_breaker_trips_and_does_not_persist(self):
        # 15 "n" pairs get promoted, then 8 of them (n0..n7) are removed across two
        # consecutive runs (triggering demotion via the grace mechanism above). Each
        # removal run is padded with an equal number of freshly-introduced "m" pairs so
        # the graph-wide INFERRED count stays numerically stable -- this isolates the
        # churn breaker (which looks at ledger-entry status transitions) from the
        # coverage guard (which looks at the raw graph-wide INFERRED count), so the two
        # bounded enhancements can be verified independently.
        n_nodes, n_links = self._pairs('n', 15)
        self.write_graph(n_nodes, n_links)
        self.run_promo('c1')
        self.run_promo('c2')
        self.run_promo('c3')  # all 15 n-pairs promoted; coverage baseline = 15

        m_nodes, m_links = self._pairs('m', 8)
        nodes_c4 = n_nodes + m_nodes
        links_c4 = n_links[8:] + m_links  # drop n0..n7 (8 pairs), add m0..m7 (8 pairs)
        self.write_graph(nodes_c4, links_c4)
        self.run_promo('c4')  # n0..n7 absent_streak -> 1 (not yet demoted); coverage 15/15
        state = self.read_state()
        self.assertEqual(state['entries']['n0a::n0b::ref']['absent_streak'], 1)
        self.assertEqual(state['entries']['n0a::n0b::ref']['status'], 'promoted',
                          "grace must hold through the first absence")

        before_state = self.read_state()

        # c5: same graph again -- n0..n7 hit their 2nd consecutive absence (8 demotions
        # among 23 previously-active entries = 34.8%), which exceeds the 30% churn
        # threshold. The run must abort WITHOUT persisting any ledger change.
        self.write_graph(nodes_c4, links_c4)
        result = self.run_promo('c5', expect_ok=False)
        self.assertEqual(result.returncode, 3)
        self.assertIn("CHURN CIRCUIT BREAKER TRIPPED", result.stdout)

        after_state = self.read_state()
        self.assertEqual(before_state, after_state,
                          "a tripped breaker must not persist any change")

    # ---- Coverage guard (bounded enhancement) ----

    def test_coverage_guard_first_run_seeds_baseline(self):
        nodes, links = self._pairs('n', 5)
        self.write_graph(nodes, links)
        self.run_promo('c1')
        state = self.read_state()
        self.assertEqual(state['coverage_baseline']['inferred_edge_count'], 5)

    def test_coverage_guard_skips_on_large_drop(self):
        nodes, links = self._pairs('n', 10)
        self.write_graph(nodes, links)
        self.run_promo('c1')
        before_state = self.read_state()

        # INFERRED count drops from 10 to 5 (50% coverage, well under the 90% threshold)
        # -- must SKIP promotion entirely and leave the ledger untouched.
        links2 = links[:5]
        self.write_graph(nodes, links2)
        result = self.run_promo('c2')
        self.assertIn("SUSPECT_PARTIAL", result.stdout)

        after_state = self.read_state()
        self.assertEqual(before_state, after_state, "a skipped run must not mutate the ledger")

    def test_coverage_guard_skips_on_explicit_partial_status(self):
        nodes, links = self._pairs('n', 5)
        self.write_graph(nodes, links)
        self.run_promo('c1')
        before_state = self.read_state()

        # Same graph (100% coverage by count) but the caller explicitly flags the extract
        # as PARTIAL -- must skip regardless of the count-based ratio.
        result = self.run_promo('c2', extract_status='PARTIAL')
        self.assertIn("SUSPECT_PARTIAL", result.stdout)
        after_state = self.read_state()
        self.assertEqual(before_state, after_state)

    # ---- Pre-existing error-handling behavior (unchanged by the enhancements) ----

    def test_invalid_state_handling(self):
        with open(self.state_path, 'w', encoding='utf-8') as f:
            f.write("{invalid_json: true}")

        nodes = [{'id': 'n1'}, {'id': 'n2'}]
        links = [{'source': 'n1', 'target': 'n2', 'relation': 'ref', 'confidence': 'INFERRED'}]
        self.write_graph(nodes, links)

        cmd = [sys.executable, str(self.promo_script),
               "--graph", str(self.graph_path),
               "--state", str(self.state_path),
               "--commit", "c1"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("JSONDecodeError", result.stderr or result.stdout)

    def test_missing_parent_directory_failure(self):
        blocked_dir = Path(self.temp_dir.name) / "blocked_dir"
        with open(blocked_dir, 'w') as f:
            f.write("I am a file, not a directory")

        state_path = blocked_dir / "state.json"

        nodes = [{'id': 'n1'}, {'id': 'n2'}]
        links = [{'source': 'n1', 'target': 'n2', 'relation': 'ref', 'confidence': 'INFERRED'}]
        self.write_graph(nodes, links)

        cmd = [sys.executable, str(self.promo_script),
               "--graph", str(self.graph_path),
               "--state", str(state_path),
               "--commit", "c1"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
