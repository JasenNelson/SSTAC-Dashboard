# OpenHarness-dev -> SSTAC-Dashboard KB/Graphify gap analysis (2026-07-22)

Status: EVIDENCE PACKET (docs-only). Companion to
`docs/design/SSTAC_KB_GRAPHIFY_SOURCE_TRACE_2026-07-22.md` (instruction lineage) and
`docs/design/GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md` (phase-by-phase landed/unlanded state).
This doc inventories OpenHarness-dev's (OHD's) complete component set, maps it against SSTAC's current
state, and cross-checks a set of later-vintage findings surfaced by the Regulatory-Review (RR) fork of
this same plan against what SSTAC has actually landed.

Scope: **SSTAC-Dashboard's own** `tooling/wiki` Graphify/LLM-wiki pilot. OHD read-only; nothing in OHD
was modified to produce this doc.

## 1. OHD component inventory (the replication target)

- **Skills:** `sync-wiki` (OHD's variant AUTO-COMMITS `wiki/`, unlike SSTAC's pilot, which is
  no-commit by design), `sessionstart`; plus general-purpose skills not graphify-specific
  (checkpoint, handoff-update, lesson-capture, process-monitor, safe-exit, update-docs).
- **Hooks (`.claude/settings.json`):** `SessionStart` -> `session_bootstrap.py` (wiki bootstrap, ~15s)
  + `check_nightly_freshness_advisory.ps1`; `PreToolUse(Bash)` -> ship-protocols gate + verify gate +
  `graphify_nudge_pretooluse.py`.
- **Tooling (`tooling/wiki/`):** `wiki_compile.py`, `wiki_lint.py`, `promotion.py`,
  `check_conventions.py`, `conventions.md`, `graphify_guardrail.ps1`, `sync_wiki.ps1`, `ascii_json.py`
  -- plus items SSTAC does not yet have: `semantic_extract.ps1`, `nightly_wiki_sync.ps1`,
  `check_nightly_freshness.ps1` / `check_nightly_freshness_advisory.ps1`,
  `graphify_nudge_pretooluse.py`, `session_bootstrap.py`, `gen_docs_scope.py`, `check_orphans.ps1`,
  `register_wiki_nightly_task.ps1`, `guardrail_smoke.ps1`.
- **Config:** `.graphifyignore` (root); a scheduled-task lock file (`.claude/scheduled_tasks.lock`).
- **MCP:** graphify MCP is **not actually registered even in OHD** -- the `claude mcp add ... graphify`
  command exists as planned text but has not been executed anywhere, including in OHD itself.

## 2. Gap table: OHD component vs SSTAC state

| Component | OHD | SSTAC state | Notes |
|---|---|---|---|
| `sync-wiki` skill | present, auto-commits `wiki/` | **present** (`.claude/skills/sync-wiki/SKILL.md`, PR #731) | SSTAC variant deliberately no-commit; correct per plan |
| `sessionstart` skill (base ritual) | present | **present** (`.claude/skills/sessionstart/SKILL.md`) | base skill only -- it has no wiki/Graphify integration |
| `sessionstart` wiki-aware extensions | present (wiki bootstrap via Phase-6 hooks) | **missing** | gated(Phase 6), consistent with the `session_bootstrap.py` and hooks rows below; the port-brief provenance doc (`docs/SESSIONSTART_PORT_BRIEF_2026_07_06.md`, provenance PR in flight) documents the base-skill port only |
| `wiki_compile.py` / `wiki_lint.py` | present | **present**, 6 test files, 48/48 pass | Phase 3, code landed |
| `promotion.py` (ledger state machine) | present | **present**, demotion-grace + churn breaker + coverage guard | Phase 3, code landed |
| `check_conventions.py` / `conventions.md` | present | **present** | Phase 3, code landed |
| `graphify_guardrail.ps1` | present | **present**, `Invoke-GraphifyGuarded` wrapper | Phase 2 |
| `sync_wiki.ps1` | present, guarded | **present**, guarded since D1 fix (PR #733) | was unguarded prior to #733 |
| `ascii_json.py` | present | **missing -- DISPOSITION DECIDED 2026-07-22: not needed in Phase 0-3.5; REQUIRED at Phase 7** | OHD uses it in `sync_wiki.ps1` solely to ASCII-sanitize the graph copy into OHD's TRACKED `wiki/.graph/graph.json` (graphify can emit non-ASCII bytes; a verbatim copy into a tracked file fails the plain-ASCII gate -- the cause of OHD's diverged `b0684b5` nightly). SSTAC's `sync_wiki.ps1` step 4 does a verbatim `Copy-Item` into `wiki/.graph/graph.json`, which is GITIGNORED in the Phase 0-3.5 scope (no committed wiki), so the ASCII gate never applies to it today and no SSTAC script references `ascii_json.py` (grep-verified). Do NOT port now. At Phase 7 graduation (committed wiki), porting `ascii_json.py` + its test AND replacing the verbatim `Copy-Item` with the sanitized copy becomes a MANDATORY pre-condition -- add it to the Phase 7 porting checklist so it is not rediscovered |
| `.graphifyignore` | present | **present**, matches plan section 7 | Phase 2 config surface |
| `requirements-graphify.txt` | pins 0.9.6 | **present**, pins `graphifyy[sql,mcp]==0.9.17` | intentional deviation, see finding 9 below |
| `semantic_extract.ps1` | present | **missing** | gated(Phase 4) |
| `gen_docs_scope.py` | present | **missing** | gated(Phase 4) |
| `nightly_wiki_sync.ps1` | present | **missing** | gated(Phase 5) |
| `check_nightly_freshness(.\|_advisory).ps1` | present | **missing** | gated(Phase 5) |
| `register_wiki_nightly_task.ps1` | present | **missing** | gated(Phase 5) |
| `check_orphans.ps1` | present | **missing** | gated(Phase 5) |
| `guardrail_smoke.ps1` | present | **missing** | gated(Phase 5/6 smoke coverage) |
| `graphify_nudge_pretooluse.py` | present | **missing** | gated(Phase 6) |
| `session_bootstrap.py` | present | **missing** | gated(Phase 6); `check_conventions.py:13` already has a forward-reference that degrades gracefully (D3, phase-state audit) |
| `.claude/settings.json` hooks | present | **missing** -- file does not exist on `origin/main` | gated(Phase 6) |
| graphify MCP registration | **not present even in OHD** (planned only) | **missing** (`.mcp.json` has only supabase entries) | gated(Phase 6); OHD is not ahead of SSTAC here |
| `docs/WIKI_KB_OPERATIONS_*` runbook | present | **missing** | gated(Phase 7) |
| committed `wiki/` output | present (OHD auto-commits) | **missing**, by design (`wiki/` gitignored) | gated(Phase 7); SSTAC's Phase 3.5-and-earlier scope is deliberately no-commit |

Everything in the "missing" rows is **owner-gated behind Phase 3.5**, per the plan's own design (see
the phase-state audit section 4 and the source-trace doc section 4). None of it should be built before
that decision is recorded.

## 3. Later-vintage RR-plan findings -- cross-checked against SSTAC's current state

The RR fork of this plan (`~/.claude/plans/rr-kb-wiki-adoption-plan.md`, v2.0 FINAL, 2026-07-17)
underwent its own adversarial review after forking from SSTAC's plan, surfacing nine candidate
hardening findings. Since RR has not landed any code (source-trace doc section 3), these findings are
purely textual/design review output, not run-verified anywhere. Each is checked below against SSTAC's
actual committed state in this worktree, verified directly where cheap to do so.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | Graphify parses `.json` as CODE (`detect.py` `CODE_EXTENSIONS`) -> mandates default-exclude-all-json + explicit allowlist + a fail-closed `graph_smoke` assert | **[outstanding]** | `.graphifyignore` in this worktree has no `*.json` (or any json-specific) line anywhere. `tooling/wiki/graph_smoke.py` was read in full: its checks are the metric threshold table, the SUBSTRATE INVARIANT (git-tracked-or-allowlisted check), and the worktree/node_modules/env path audit -- no json-specific assert exists. The Row 10 receipt's observation that 22 JSON files produced zero nodes (graphify warning #1666) is consistent with json files being parsed as code and yielding empty ASTs -- i.e. the same mechanism this finding warns about, currently benign by chance rather than by an explicit exclude+assert. Not yet absorbed. |
| 2 | `DOC_EXTENSIONS` is `{.md,.mdx,.qmd,.txt,.rst,.html,.yaml,.yml}`, not just `.md` -- the Phase-2 code-only overlay must blanket-exclude all of them, not just `.md` | **[outstanding]** | `.graphifyignore` blanket-excludes only `*.md` (with a narrow `!/README.md` negation). No blanket line exists for `.mdx`, `.qmd`, `.txt`, `.rst`, `.html`, `.yaml`, or `.yml` (only specific named `.txt` files are excluded, e.g. `/ocr_results.txt`, `/scratch_view.txt` -- not a blanket). The Phase-2 "code-only" intent is therefore narrower than the full doc-extension set in practice. |
| 3 | Two gitignore last-match-wins blockers: negations must be file-type-narrow (never directory-wide); a wholesale-excluded parent permanently kills child negations | **[absorbed]** | `.graphifyignore` lines 108-113 place `!/README.md` as the last md-matching line, after both the docs-trust `/*.md` line and the Phase-2-only blanket `*.md` line, with an inline comment explicitly documenting the ordering requirement ("ORDERING MATTERS... this line MUST be the LAST md-matching line"). The negation is file-type-narrow (a single named file), not directory-wide. No directory-wide negation exists anywhere in the file that a wholesale parent-exclude could kill. |
| 4 | OHD bug flags: `semantic_extract.ps1` invokes `promotion.py` itself (breaking the single-invocation rule); OHD's bare `CreateNew` lock acquisition skips the Ollama-protocol 4-clause preflight | **[Phase-4-6-only]** | `semantic_extract.ps1` and any lock-acquisition code do not exist in SSTAC (`tooling/wiki/` glob confirms 8 scripts total, all Phase 2-3; no Phase 4 scripts present). Not yet applicable -- noted for when Phase 4 is built, so the port does not reproduce these two OHD bugs. |
| 5 | Decoupled semantic-auth watchdog design (per-night eval reads only the artifact; the aggregate starvation watchdog reads a durable tracked `wiki_nightly_config.json` `semantic_mode`) | **[Phase-4-6-only]** | No nightly scripts exist in SSTAC yet (confirmed absent in the phase-state audit and by the `tooling/wiki/` glob). This is Phase 5 design detail with nothing yet built to check it against. |
| 6 | Effective-ignore concat mechanism: base + code-only overlay merged into a temp file, with both hashes recorded in the build receipt | **[Phase-4-6-only]** | SSTAC's current mechanism is simpler and already different in kind: a single `.graphifyignore` file with an inline "Phase-2-only extra line" section (the blanket `*.md` line), which the file's own comment says gets manually removed and replaced with the docs-trust filter "at Phase 4 with a mandatory from-scratch rebuild" -- not a concat-with-dual-hash mechanism. This finding describes tooling that would matter at the Phase 2 -> Phase 4 transition, which has not happened. |
| 7 | Full takeover/re-root runbook: freeze tasks, re-anchor, cold rebuild, clean-slate ledger reseed, re-register scheduled tasks + MCP absolute paths | **[Phase-4-6-only]** | `docs/WIKI_KB_OPERATIONS_*` does not exist (confirmed in the phase-state audit and by grep of `docs/`). This is Phase 7 graduation-runbook scope; nothing to check it against yet. |
| 8 | `gen_docs_scope.py` hard SUBSET gate + negative-control fixtures | **[Phase-4-6-only]** | `gen_docs_scope.py` does not exist in SSTAC (confirmed by the `tooling/wiki/` glob and the phase-state audit's Phase 4 row). Phase 4 scope, not yet built. |
| 9 | Pin intel: SSTAC pins `graphifyy` 0.9.17; 0.9.18 exists on PyPI (as of 2026-07-17); RR recommends staying on 0.9.17 | **[absorbed]** | `tooling/wiki/requirements-graphify.txt` pins `graphifyy[sql,mcp]==0.9.17` and its own header comment already records, dated 2026-07-17 (same day as the RR finding's vintage), that 0.9.18 is the latest PyPI release and the pin deliberately stays at 0.9.17 pending a separate owner-gated re-verification pass. SSTAC independently reached the same conclusion the RR finding recommends. |

Findings 1 and 2 are the only ones that describe a real, currently-uncovered gap in code that is
**already landed** (Phase 2's `.graphifyignore`), as opposed to design detail for phases not yet built.
They are candidate hardening items for a future Phase-0-3.5-safe docs-and-config PR (tightening the
ignore file and adding a json-specific `graph_smoke.py` assert does not require crossing the Phase 3.5
gate, since it only strengthens the already-approved deterministic layer) -- but building that fix is
out of scope for this docs packet and needs its own owner-scoped PR.

## 4. Recommended next PR sequence

1. Merge #732 (phase-state audit) + #733 (D1 guardrail fix) + #734 (Row 10 build receipt) --
   **MERGED**.
2. Commit the local-only `docs/SESSIONSTART_PORT_BRIEF_2026_07_06.md` as durable provenance -- small
   docs PR, **in flight separately** from this one.
3. **This PR** -- formalize the source trace and gap analysis as committed docs
   (`SSTAC_KB_GRAPHIFY_SOURCE_TRACE_2026-07-22.md` + this document), so the reasoning behind "nothing
   is lost, the plan is complete, here is the precise remaining gap" survives as a durable artifact
   rather than a scratch file.
4. **Next: the Phase 3.5 decision packet PR** (owner-facing). Evidence for PROCEED: the guarded build
   works end-to-end (Row 10 receipt), D1 is fixed, the Ollama/GPU lane is currently free. Evidence
   against / still missing: no recorded instance yet of the wiki helping a real SSTAC task, and Phases
   4-7 add real new-infrastructure risk (hooks, MCP registration, a nightly scheduled task, a Python
   stack outside current CI coverage). Recommendation carried over unchanged from the phase-state audit:
   **STOP-HERE** by default unless the owner has concrete usage evidence and re-affirms priority over
   Matrix Options. A "Phase-6-first" re-sequencing (hooks + MCP before Ollama) is sometimes floated as
   a motion option; the decision-packet PR frames it correctly -- it is still Phase 4-7 infrastructure
   (session hooks are a new failure surface, graphify MCP is unproven even in OHD, the Python stack is
   outside CI) and would need its own owner ruling, not a default "low-risk" continuation.

## 5. Explicit boundary

**Phase 4-7 items (Ollama semantic tier, nightly automation, session-integration hooks, MCP
registration, the graduation runbook, and any hardening of findings 1/2 above that touches those
phases) must NOT be built without the Phase 3.5 owner gate being explicitly recorded first.** This gap
analysis is an inventory and cross-check, not an authorization to proceed.

## 6. References

- `docs/design/SSTAC_KB_GRAPHIFY_SOURCE_TRACE_2026-07-22.md` -- instruction lineage and the RR
  comparator conclusion (nothing to port from RR).
- `docs/design/GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md` -- phase-by-phase state, drift
  findings D1-D3, Phase 3.5 owner decision packet.
- `docs/design/GRAPHIFY_KB_ROW10_BUILD_RECEIPT_2026-07-22.md` -- guarded build run receipt.
- `tooling/wiki/graph_smoke.py`, `.graphifyignore`, `tooling/wiki/requirements-graphify.txt` -- read
  directly in this worktree to verify the findings table above.
