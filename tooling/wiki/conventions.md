# Wiki Conventions for SSTAC-Dashboard

This document defines the shared page, link, and tier conventions for the SSTAC-Dashboard wiki
system, which is automatically compiled from the repository's semantic knowledge graph (Graphify +
the OpenHarness-pattern LLM-wiki compiler). Ported from the OpenHarness-dev (OHD) reference
implementation at `C:\Projects\OpenHarness-dev\tooling\wiki\`; see
`C:\Users\jasen\.claude\plans\jolly-marinating-piglet.md` for the adoption plan and port map this
port followed.

## 1. Link Format (Wikilinks)
- **Regex Pattern:** The compiler and linter scan for internal wiki links using the pattern `\[\[(.*?)\]\]` (or `\[\[([^\]]+)\]\]` in orientation checks).
- **Format:** Internal links are formatted as `[[page_id]]` where `page_id` is the slugified name of the target page (lowercase, alphanumeric, with spaces replaced by underscores).
- **Inferred Prefix:** Semantic links that are `INFERRED` by the graph database are displayed with a `[?] ` prefix in compiled outputs (e.g., `[?] [[target_page]]`).

## 2. Directory Layout and File Naming
All compiled wiki assets reside in the following structure:
- `01_Concepts/`: Markdown pages for conceptual/documentation files (type: `concept`).
- `02_Modules/`: Markdown pages for code/source modules (type: `module`).
- `03_Indexes/`: Contains the primary indices of the wiki:
  - `000-Modules.md`: Alphabetical list of all compiled module pages.
  - `000-Concepts.md`: Alphabetical list of all compiled concept pages.
- `_review/`: Used for review artifacts, specifically:
  - `ambiguous.md`: Contains links with low confidence requiring manual inspection.
- `.orphaned/`: Target directory where pages that are no longer part of the compiled set are moved during synchronization.
- `.graph/`: Contains the served copy of `graph.json` (synced by `sync_wiki.ps1`), the promotion
  ledger `promotion.json`, and the structured contradiction log `contradictions.json`.

NOTE: during the Phase 0-3.5 pilot, `wiki/` (and `graphify-out/`, `.venv-graphify/`) are
**gitignored and untracked** -- the entire compiled wiki is a local, on-demand artifact, refreshed
manually via `sync_wiki.ps1 -SkipGraph` (or `/sync-wiki` once the pilot skill lands). There is no
nightly automation and no auto-commit during the pilot; see the plan's Phase 3.5 gate.

## 3. Link Confidence Tiers
The system classifies semantic relationships between entities into three distinct confidence levels:
- `EXTRACTED`: Relationships explicitly identified via static code analysis or reference tracing.
- `INFERRED`: Relationships established by proximity, co-occurrence, or semantic clustering.
- `AMBIGUOUS`: Relationships with low confidence or conflicting context. These are filtered out of page lists and written to the `_review/ambiguous.md` file.

## 4. Promotion State Machine
For inferred links, the compiler maintains a promotion ledger in `wiki/.graph/promotion.json` with the following lifecycle states:
- `inferred`: A newly detected semantic link.
- `promoted`: An inferred link that has been observed in at least 3 distinct commits, OR that
  graduated to `EXTRACTED` confidence in the graph.
- `demoted`: A previously promoted or inferred link that is no longer present in the graph but whose
  source and target nodes still exist. SSTAC's port adds a **demotion grace period**: an edge must be
  absent across 2 CONSECUTIVE runs before it demotes (a single transient graph-rebuild hiccup does not
  demote a stable edge; the absence streak resets to 0 the moment the edge reappears).
- `retired`: A link whose source or target node has been deleted from the codebase. Node deletion
  retires immediately -- the demotion grace period does not apply, because a deleted node is not a
  transient scan hiccup.

### 4.1 SSTAC-specific ledger safeguards (bounded enhancements over the OHD reference)
- **Churn circuit breaker:** if more than 30% of the previously-active ledger entries (status
  `inferred` or `promoted`) would transition to `demoted`/`retired` in a single run -- and the
  previously-active pool is at least 10 entries -- the run ABORTS without persisting any change and
  prints `CHURN CIRCUIT BREAKER TRIPPED`. This protects the ledger against mass damage from a single
  anomalous graph rebuild (a partial or mis-scoped scan making many real edges look absent at once).
  Investigate the graph rebuild before re-running `promotion.py`.
- **Coverage guard:** promotion is SKIPPED entirely (ledger untouched, `SUSPECT_PARTIAL` printed) when
  either (a) the caller passes `--extract-status PARTIAL`, or (b) the current graph's INFERRED-edge
  count has dropped more than 10% versus the prior successful run's baseline (recorded in
  `promotion.json`'s `coverage_baseline` key). The very first run always seeds the baseline instead of
  skipping (there is nothing to compare against yet).
- **Single-invocation rule (HIGH AUTHORITY):** `promotion.py` runs from exactly ONE place in the
  pipeline: the coverage-guarded semantic step (Phase 4/5, contingent), or a one-time manual ledger
  seed (Phase 3). `sync_wiki.ps1` in this port does **NOT** invoke `promotion.py` -- unlike the OHD
  reference, which calls it unconditionally on every sync. Running an unguarded promotion pass on a
  lock-busy or partial-graph night would apply an ungraded demotion pass over a graph that may lack
  cached doc edges, mass-demoting the ledger. If you find yourself adding a second call site for
  `promotion.py`, that is a violation of this rule -- route it through the coverage-guarded step
  instead.

## 5. Vocabulary of Relations
The knowledge graph uses standard relations to model connections between entities:
- `calls`: Represents a function or method invocation.
- `references`: Represents a variable, class, or text reference.
- `shares_data_with`: Represents data transfer or shared state.
- `conceptually_related_to`: Denotes semantic mapping between nodes.

## 6. Sync Receipts and logs
- **Nightly Sync Receipts (Phase 5, contingent -- not built in the 0-3.5 pilot):** nightly execution
  would create status receipt files in `.tmp_wiki_nightly/` using the patterns:
  - `receipt-YYYY-MM-DD.md`
  - `semantic-receipt-YYYY-MM-DD.md`
- **Manual `/sync-wiki` runs (Phase 0-3.5, current):** `sync_wiki.ps1` prints step-by-step status to
  the invoking shell; there is no persisted receipt file during the pilot.
- **Safe Exit Logs:** the `/safe-exit` checks log detailed execution diagnostics to:
  - `safe-exit_YYYYMMDD_HHMMSS.log`

## 7. Node-ID stability
Page IDs are derived by slugifying a node's `source_file` path (see `slugify()` in
`wiki_compile.py`). This means:
- A file **rename** changes its node ID. The compiler treats this as: the OLD page (old slug) becomes
  an orphan (moved to `.orphaned/`) and a NEW page (new slug) is created fresh (no Manual Notes carry
  forward automatically). This is **expected, by-design behavior**, not a bug -- if you rename a
  heavily-annotated file, manually copy forward any `## Manual Notes` content you want to keep before
  the next recompile.
- A file **move** (same basename, different directory) is the same case as a rename from the
  compiler's point of view, because the slug is derived from the full `source_file` path.
- IDs are stable across recompiles for files whose path does not change, even if their content
  changes substantially (the AST content updates in place; only a genuine content-vs-Manual-Notes
  divergence triggers the contradiction-warning path in section 4).

## 8. MANUAL_HOLD lock discipline (Ollama GPU lock; Phase 4/5, contingent)
Ported from the cross-project Ollama schedule protocol (`C:\Projects\OLLAMA_SCHEDULE_PROTOCOL.md`):
a lock whose `process_id` field is the literal string `MANUAL_HOLD` (non-numeric) is **NEVER
auto-reclaimable** by any stale-lock recovery path, regardless of how long it has been held. Only an
owner (or an explicit owner-approved recovery script run) may clear a `MANUAL_HOLD` lock. This
protects a standalone long-running semantic pass (which can outlive the default lock expiry) from
being reclaimed mid-run by a peer lane's dead-PID recovery logic.

## 9. Runbook and authority references
- Gate authority for every tracked commit/push touching `tooling/wiki/`:
  `C:\Users\jasen\.claude\skills\ship-protocols\SKILL.md` (commit = `/codex-review` to
  mutual-agreement GREEN; push = the full gate suite re-enumerated from that skill at execution time).
- Project anchors: `CLAUDE.md` (SSTAC-Dashboard L1) and `docs/GATE_MODE_SOP.md` (gate discipline
  authority) at the repository root.
- Operational runbook: `docs/WIKI_KB_OPERATIONS_2026_07.md` is a Phase 7 (contingent) deliverable --
  it does not exist during the Phase 0-3.5 pilot. Until it lands, this file (`conventions.md`) and the
  adoption plan (`jolly-marinating-piglet.md`) are the operational reference.
- Adoption plan (locked owner decisions, phase gates, port map, config artifacts):
  `C:\Users\jasen\.claude\plans\jolly-marinating-piglet.md`.

## 10. Note: "all-EXTRACTED baseline" phrasing correction (2026-07-17)
Earlier planning language described the expected initial graph state as an "all-EXTRACTED
baseline." That phrasing was imprecise. Graph extraction is high-quality, but the graph
legitimately includes INFERRED edges (section 3) alongside EXTRACTED ones -- proximity,
co-occurrence, and semantic-clustering relationships are a normal, expected extraction
output, not a defect. `promotion.json` seeds its promotion ledger from those inferred
candidates: for this code graph, that seed count is 224 INFERRED entries. A nonzero
INFERRED seed count at first run is expected behavior, not a signal of extraction
quality regression.
