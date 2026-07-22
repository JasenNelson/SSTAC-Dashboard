# SSTAC-Dashboard Graphify / KB-wiki -- Phase 3.5 owner decision packet (2026-07-22)

Status: OWNER-DECISION PACKET (docs-only). This packet REFRESHES, and cross-references rather than
duplicates, the Phase 3.5 material in `docs/design/GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md`
sections 4-5 (the gate's verbatim intent and the original decision items), with the evidence that
landed after that audit was written. It authorizes NOTHING: it is inputs for one owner decision.

Plan authority: `~/.claude/plans/jolly-marinating-piglet.md` (Phases 0-3.5 owner-approved 2026-07-17;
Phase 3.5 is a HARD owner gate; **STOP-HERE IS THE DEFAULT**).

## 1. What changed since the phase-state audit

The audit (PR #732) was written when the guarded build was unverified and D1 was unfixed. Since then,
all in the 2026-07-22 lane:

- **D1 guardrail fix MERGED** (PR #733): `sync_wiki.ps1`'s graph step now goes through
  `Invoke-GraphifyGuarded` -- the audit's "fix before any proceed" pre-condition is met.
- **Row 10 receipt MERGED** (PR #734, `docs/design/GRAPHIFY_KB_ROW10_BUILD_RECEIPT_2026-07-22.md`):
  the guarded build + ledger seed RAN end-to-end (exit 0): graph 8743 nodes / 19535 edges, 1271 wiki
  pages, lint pass, ledger seed 271 INFERRED entries. The audit's open "did it actually run" item
  (its section 5 item 2) is resolved.
- **Source trace + gap analysis** (companion PR in flight): confirms the instruction set is complete
  (nothing lost to drift), RR has nothing to port from, and cross-checks nine later-vintage RR-plan
  findings against SSTAC's landed state.
- **Ollama/GPU lane currently FREE** (owner-confirmed 2026-07-22): the third-lane scheduling
  constraint that would burden Phase 4 is, at the moment, not contended.

## 2. The gate, condition by condition

Per the audit section 4, PROCEED requires ALL THREE simultaneously true:

| # | Condition | State 2026-07-22 | Evidence |
|---|---|---|---|
| 1 | Code-graph smoke metrics healthy | **PARTIALLY MET (not fully verified)** | Row 10 receipt: guarded build exit 0, 8743 nodes / 19535 edges (node count consistent with the earlier ~8517-node calibration), wiki compile 1271 pages, lint pass, ledger seed 271 entries. HOWEVER the build ran `--no-cluster`, so NO community count was computed and `graph_smoke.py`'s `num_communities` band was NOT checked in that run (receipt, Graph size row). A full-metrics smoke pass on a clustered build remains unverified |
| 2 | Phase 3 wiki demonstrably helped real work | **NOT MET** | No recorded instance of the wiki contributing to a real SSTAC task. This is the plan's true bar; nothing currently on file satisfies it |
| 3 | Owner re-affirms priority vs the Matrix Options flagship | **NOT GIVEN** | Matrix Options remains the standing worklane priority (owner 2026-06-16); no re-sanction recorded |

Zero of three conditions is fully met (condition 1 is partial). **By the plan's own rule, PROCEED is
not available today.**

## 3. Options

- **STOP-HERE (DEFAULT -- RECOMMENDED):** keep only the deterministic Phase 0-3.5 layer, refreshed
  on-demand via `/sync-wiki`. Phases 4-7 stay contingent shelf designs. Requires no action; the gate
  stays open for a future evidence-based revisit. The natural path to condition 2 is simply USING the
  wiki: the next real SSTAC task that consults it (and records that it helped) creates the missing
  data point at zero infrastructure risk.
- **PROCEED to Phases 4-7:** unavailable today (section 2). A future PROCEED additionally requires,
  before build: absorbing the gap analysis's [outstanding] hardening findings 1-2 (json-as-code
  exclusion; full doc-extension blanket exclude) and honoring the [Phase-4-6-only] bug flags (OHD's
  `semantic_extract.ps1` promotion double-invoke; bare `CreateNew` lock bypassing the Ollama-protocol
  preflight) so known OHD defects are not ported.
- **ABANDON:** delete untracked outputs; revert the tooling commits via a normal gated PR. Not
  recommended -- the deterministic layer is cheap to keep, test-covered (48/48), and now run-proven.

### 3a. "Phase-6-early" re-sequencing -- a distinct owner ruling, NOT a default motion path

A re-ordering that builds Phase 6 (session hooks + graphify MCP) before Phase 4 (Ollama) is sometimes
floated because it avoids the GPU lane. To be explicit: **this is still Phase 4-7 infrastructure and
still requires passing the Phase 3.5 gate plus its own strategic review.** It must not be treated as a
"low-risk" or "deterministic" continuation of the approved scope, because:

- `.claude/settings.json` SessionStart hooks are a NEW failure surface on every session start of every
  future session (SSTAC currently has NO settings.json at all);
- PreToolUse hooks intercept every Bash call (latency + a new way to break all sessions at once);
- graphify MCP registration is UNPROVEN anywhere -- it was never actually executed even in OHD (the
  `claude mcp add` command exists only as planned text; see the gap analysis inventory);
- the Python stack involved is outside current CI coverage;
- the approved plan itself orders Phase 6 AFTER Phases 4/5, so this is a plan amendment, not a subset.

If the owner wants forward motion despite condition 2 being unmet, the cheaper and gate-compatible
alternative is section 4 below.

## 4. Gate-independent follow-ups (available WITHOUT any Phase 3.5 decision)

These strengthen the already-approved deterministic layer and do not cross the gate:

1. **Hardening PR for gap-analysis findings 1-2:** add a json exclusion + fail-closed
   `graph_smoke.py` assert; widen the Phase-2 blanket exclude to the full doc-extension set.
   (Owner-scoped; small config + one-assert change.)
2. **`ascii_json.py` disposition:** RESOLVED 2026-07-22 -- not needed in Phase 0-3.5 (SSTAC's
   `wiki/.graph/` copy target is gitignored, so the ASCII gate never applies); becomes a MANDATORY
   Phase 7 pre-condition (tracked wiki) recorded in the gap-analysis inventory row.
3. **Use the wiki on real work** and record any instance where it helps -- the only way condition 2
   can ever be met, and it costs nothing.

## 5. Recommendation

**STOP-HERE**, exactly as the plan's default intends: two of three PROCEED conditions are unmet, and
the one genuinely load-bearing condition (real-task usefulness) can only be earned through use, not
built through infrastructure. The 2026-07-22 lane has already banked everything that was cheap and
safe (D1 fixed, build proven, instructions traced, gaps inventoried). The gate loses nothing by
staying closed: every Phase 4-7 design remains on the shelf, and the packet above defines exactly
what evidence would reopen it.

## 6. References

- `docs/design/GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md` sections 4-5 -- the gate's verbatim
  three options and the original owner decision items (D1 item now resolved by #733; Row 10 item now
  resolved by #734).
- `docs/design/GRAPHIFY_KB_ROW10_BUILD_RECEIPT_2026-07-22.md` -- the run evidence behind condition 1.
- `docs/design/SSTAC_KB_GRAPHIFY_SOURCE_TRACE_2026-07-22.md` +
  `docs/design/OPENHARNESS_TO_SSTAC_KB_GAP_ANALYSIS_2026-07-22.md` (companion PR) -- instruction
  completeness, RR comparator, and the cross-checked hardening findings cited in sections 3-4.
- `~/.claude/plans/jolly-marinating-piglet.md` -- the plan text of the Phase 3.5 gate (off-repo).

Forbidden-scope confirmation (this packet): no Ollama, no semantic extraction, no nightly task, no
hooks, no MCP registration, no committed wiki output, no `-AutoCommit`. Docs-only; nothing executed.
