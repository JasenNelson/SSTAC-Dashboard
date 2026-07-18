# KB Graph Community-Count WARN Calibration (2026-07-17)

Scope: deterministic-only follow-up (no Ollama, no Phase 4, no nightly/hooks). Analyzes
whether SSTAC's Phase 2 code-graph community count (534, WARN vs. the plan's stated
15-250 healthy band in `tooling/wiki/graph_smoke.py`) is expected for SSTAC's scale, or
indicates a clustering/extraction defect. Filesystem-only exploration; graph node/edge
content was not read, only community-structure metadata (sizes/counts).

## Inputs

- Built graph: `C:\Projects\SSTAC-Dashboard-worktrees\kb-build-2026-07-17\graphify-out\graph.json`
  (8517 nodes, 0 top-level `edges` field populated -- edges live under `links`/`hyperedges`;
  1233 distinct `source_file` values among nodes) + `GRAPH_REPORT.md` in the same folder.
- Threshold band: `tooling/wiki/graph_smoke.py` on `origin/main` (landed via PR #676),
  `THRESHOLD_TABLE` entries for `largest_community_pct` (healthy <=35%, hard >50%) and
  `num_communities` (healthy 15-250, WARN-only, no stated HARD limit).
- Plan rationale: `~/.claude/plans/jolly-marinating-piglet.md` line 48-50 -- the OHD
  reference instance the 15-250 band was set against is described there as "a 2851-node
  graph" (13 consecutive green nightlies, 2026-07-04..07-16).
- Cross-check: OHD's own live `graphify-out/<date>/GRAPH_REPORT.md` history at
  `C:\Projects\OpenHarness-dev\graphify-out\` (13 daily snapshots, 2026-07-04..07-17).

## 1. SSTAC community-size distribution (metadata only)

Computed directly from `graph.json`'s per-node `community` field (534 communities,
8517 nodes, sum of sizes reconciles exactly to node count):

| Stat | Value |
|---|---|
| Communities | 534 |
| Nodes | 8517 |
| Mean size | 15.95 |
| Median size | 7.5 |
| Stdev | 20.47 |
| Min / Max size | 1 / 143 |
| Largest community | 1.68% of all nodes |
| Top-10 communities | 1065 nodes = 12.5% of all nodes |
| Singletons (size==1) | 101 communities (18.9% of communities), 101 nodes (1.2% of nodes) |
| Communities <3 nodes | 170 (31.8% of communities), but only ~2.5% of nodes |
| Communities <5 nodes | 219 (41.0% of communities), only 401 nodes = 4.7% of nodes |

Size-bucket histogram:

```
size 1     : 101 communities,  101 nodes
size 2     :  69 communities,  138 nodes
size 3-4   :  49 communities,  162 nodes
size 5-9   :  69 communities,  465 nodes
size 10-19 :  86 communities, 1190 nodes
size 20-49 : 120 communities, 3642 nodes
size 50-99 :  35 communities, 2190 nodes
size 100+  :   5 communities,  629 nodes
```

Reading: the community COUNT is inflated by a long tail of small/singleton
communities (41% of communities hold under 5% of the node mass), while the bulk of
nodes (85%+) sit in a broad middle band of 5-99-node communities. There is no
dominant giant blob (`largest_community_pct` = 1.68%, nowhere near the 35% healthy
ceiling or the 50% hard limit) and no evidence of a single pathological structural
collapse. This shape -- many small, cleanly-separated communities plus a healthy
middle distribution -- is the expected signature of a large, feature-sliced
codebase (1233 source files across dashboard routes, API routes, matrix-options
calculators, bn-rrm components, catalog/promotion scripts, engine-v2, test
fixtures, etc.) where many narrowly-scoped modules, one-off scripts, and type-only
files legitimately form their own small components. It is NOT the signature of a
disconnected-extraction defect, which would instead show as many singleton/thin
communities dominating the node MASS (they don't -- singletons are 18.9% of
community count but only 1.2% of nodes).

## 2. Comparison to the plan's 15-250 band -- is it scale-calibrated?

The plan's band was set against OHD's reference instance described as "a
2851-node graph" (as of the plan's writing, 2026-07-04..07-16 window). SSTAC's
built graph is 8517 nodes -- ~3.0x that reference point already, before any
scale adjustment.

More importantly, OHD's *own* live instance has since outgrown the band it was
originally used to justify. Pulling OHD's daily `GRAPH_REPORT.md` snapshots:

| Date | Nodes | Communities | Communities / 1000 nodes |
|---|---|---|---|
| 2026-07-04 | 394 | 117 | 296.9 |
| 2026-07-05 | 1157 | 235 | 203.1 |
| 2026-07-06 | 1341 | 226 | 168.5 |
| 2026-07-07 | 1441 | 190 | 131.9 |
| 2026-07-08 | 1524 | 199 | 130.6 |
| 2026-07-10 | 1843 | 239 | 129.7 |
| 2026-07-11 | 2268 | 435 | 191.8 |
| 2026-07-12 | 1332 | 294 | 220.7 |
| 2026-07-13 | 2184 | 465 | 212.9 |
| 2026-07-14 | 2783 | 595 | 213.8 |
| 2026-07-15 | 2844 | 654 | 230.0 |
| 2026-07-16 | 2868 | 660 | 230.1 |
| 2026-07-17 | 2907 | 669 | 230.2 |

By 2026-07-11 OHD's own community count (435) had already exceeded the 250 upper
healthy bound the plan cites it as calibrated against, and by 2026-07-17 OHD sits
at 669 communities/2907 nodes -- 2.7x the stated healthy ceiling -- while still
running 13 consecutive green nightlies (the WARN is non-blocking by design, so
this did not stop the pipeline, but it does mean the band itself was already
stale for its own reference project days before this SSTAC build).

Density comparison (communities per 1000 nodes):

- SSTAC: 534 / 8517 * 1000 = **62.7** per 1000 nodes
- OHD (current, 2026-07-17): 669 / 2907 * 1000 = **230.2** per 1000 nodes
- OHD (full 13-day observed range): **129.7 - 296.9** per 1000 nodes

SSTAC's community density (62.7/1000) is actually LOWER (more consolidated) than
every single OHD snapshot in the 13-day history, including the smallest/earliest
ones. Scaling the original band's intent (15-250 for ~2851 nodes) proportionally
to SSTAC's 8517 nodes via the ratio implied by the low end of OHD's own observed
range (~130/1000) would put SSTAC's implied healthy ceiling at roughly
8517 * 0.13 = ~1100 communities -- 534 is comfortably inside that. Even using
OHD's current, tighter ratio (230/1000) as the yardstick, SSTAC's implied ceiling
is 8517 * 0.230 = ~1959 communities. Either way, 534 sits well inside a
scale-normalized healthy range; it is the fixed absolute upper bound (250) that
is out of date, not SSTAC's graph.

## 3. Verdict

**EXPECTED -- scale-driven granularity, healthy graph. Not a clustering or
extraction-scoping defect.**

Evidence:
1. `largest_community_pct` = 1.68%, far inside the healthy band (<=35%) and nowhere
   near the hard limit (>50%). No giant-blob collapse.
2. Small/singleton communities (the mechanism that would inflate community COUNT
   without a real defect) account for a large share of community COUNT (41% of
   communities are <5 nodes) but a small share of node MASS (4.7%) -- consistent
   with many small, legitimately-separated feature-slice modules in a 1233-file
   repo, not with a broken extraction pass fragmenting real content into orphaned
   pieces.
3. SSTAC's graph is ~3.0x the node count of the reference instance the 15-250
   band was set against, and even OHD's OWN live instance has already grown past
   the 250 ceiling (669 communities as of today) while remaining healthy by every
   other signal -- so the absolute band is demonstrably under-calibrated even for
   its original reference project, not just for SSTAC's larger one.
4. By a scale-normalized (communities-per-1000-nodes) reading, SSTAC (62.7/1000)
   is LESS fragmented than OHD has been at any point in its 13-day history
   (129.7-296.9/1000).

## 4. Recommended calibration

**Widen the absolute `num_communities` healthy-band upper bound in
`tooling/wiki/graph_smoke.py`**, rather than forcing SSTAC's graph to produce
fewer communities (there is nothing to fix in the graph itself).

Chosen approach: widened absolute band (not a restructured ratio metric), because:
- `num_communities` is WARN-only by design (no HARD limit stated in the plan) --
  a generously-set upper bound carries low risk; other independent gates
  (`largest_community_pct`, `mean_nodes_per_file`) already catch the pathological
  cases (one dominant blob; too few/too many nodes per file) that a raw count
  alone cannot distinguish from healthy fragmentation.
- A true scale-aware ratio metric (`communities_per_1000_nodes`) would require
  restructuring `THRESHOLD_TABLE`'s lambda signature (currently takes only the
  metric's own value) to also receive node count, plus updating/renaming the
  metric key -- a larger, riskier edit than this bounded follow-up calls for.
  Documented here as a **future upgrade option** if the band needs re-tightening
  once more graphs are observed, but not implemented now.
- Existing test `test_communities_out_of_band_is_warn_only_never_hard` in
  `tooling/wiki/tests/test_graph_smoke.py` only exercises the LOWER bound (5
  communities, asserting `num_communities: 5 [WARN]`) -- widening only the UPPER
  bound does not touch that assertion and needs no test edit.

Proposed new band: `15 <= v <= 700` (was `15 <= v <= 250`). Rationale for 700:
comfortably covers both current data points (SSTAC 534, OHD-current 669) with a
~5% margin above the higher of the two, while still flagging genuinely
pathological over-fragmentation (a graph whose community count approaches its
node count, e.g. from a broken/near-fully-disconnected extraction pass) as WARN
for investigation.

If a code change is drafted: single-file edit to `tooling/wiki/graph_smoke.py`
`THRESHOLD_TABLE`, `num_communities` row, upper-bound literal `250` -> `700`,
plus a code comment citing this analysis doc and the SSTAC/OHD data points as the
calibration basis. No other files require changes; the existing test suite is
unaffected (verified above).
