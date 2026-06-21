# Fresh-Session Handoff -- Matrix-Options lane (2026-06-15)

Entry point for a fresh session continuing the **matrix-options** work in SSTAC-Dashboard. Read this,
then `~/.claude/plans/mo-queue-attestation-packet-2026-06-15.md` (owner activation steps) and
`~/.claude/plans/explore-code-base-RUNLOG.md` (full transaction log).

## SCOPE (owner, HIGH AUTHORITY)
**Matrix-options is the PRIMARY lane** for this and subsequent sessions. Two OTHER parallel Claude
sessions exist; their work is NOT this lane and you do NOT pick it up unless they explicitly ask for
SSTAC-Dashboard support (a side request):
- **engine-v2** (RRAA engine; qwen2.5:14b). Its dashboard "go-live" is BLOCKED on an ENGINE-side bug
  (S2 ChunkStore / Option A C1) and is handed BACK to the engine session. Handoff:
  `~/.claude/plans/engine-v2-golive-BLOCKER-s2-chunkstore-2026-06-15.md`. Do NOT treat it as an MO priority.
- **DRA-KB / Sediment-DRA-Pipeline** (velvet-narwhal; gemma3:12b -- the ~8.6GB VRAM holder). Now building
  a deterministic **Structured Measurement Store** (SQLite chemistry-results DB, CPU-only) for Site 3250,
  because bare numerics don't survive LightRAG semantic extraction. Fully separate repo, NO dashboard
  coupling today. FUTURE (deferred, not active): that structured store is explicitly designed to FEED
  matrix-options + BN-RRM as a cross-site queryable substrate (background stats / probabilistic inputs) --
  a future CONSUMER integration that will eventually land in THIS lane. Watch for it; do not build toward
  it until the DRA-KB store is ready and the owner asks.
**Matrix-options is Ollama-FREE** (no LLM/graph/model RAM) -- you do NOT contend for the GPU with either.

## STATE
- origin/main tip: `6203315`. Working tree clean (untracked root `*.md` handoffs are expected scratch).
- All session worktrees removed; shared node_modules store intact (723). No orphan node/python from this lane.
- This session merged (full pipeline each -- codex GREEN + 6 gates + head-pinned squash):
  #324 (CI unit shards 4->6, cleared the structural write-EPIPE coverage OOM that blocked ALL MO PRs),
  #323 (SSD mixed-unit fail-closed), #325 (coverage: generate-catalog-records + censored-KM Gamma UCL),
  #326 (SSD live ecotox_mirror mixed-unit guard, per-column graceful degradation).
  (#327 engine-v2 Phase 2 is the tangential engine lane, not MO.)
- Closed as superseded: #198 / #199 (Lane 1b layout-rebalance drafts; intent shipped via merged #202/#203).

## THE AUTONOMOUS MO WELL IS DRY
After this session's coverage PR (#325), SSD guards (#323/#326), and M6 build (#328), there is **no
remaining substantive autonomous catalog/test build** sitting ready. Do NOT invent MO work. Specifically
confirmed not-needed this session:
- Deferred IRIS substances (anthracene/ddt_total/fluoride/uranium) -- ALREADY in the catalog with EPA
  snapshot anchors (the "deferred" note was stale; the 2026-06-02 orphan passes added them). Only a tiny
  HITL classification call remains: whether `ddt_total` warrants separate records vs the canonical
  `p_p_dichlorodiphenyltrichloroethane_ddt` (low priority, owner decision).
- Frame-aware equations / eco passes / The Guide refresh -- owner-gated on owner-chosen data/content.

## WHAT'S LEFT = OWNER-GATED (you PREP, owner does --apply; the bright line: AI NEVER runs promote --apply)
Two PREP-ONLY draft PRs await owner activation (both built + gated + codex-GREEN; records are needs_review,
non-selectable; promote scripts fail-closed):
- **PR #328** -- HC 2017 sediment direct-contact receptor (recreational toddler). 7 needs_review records +
  `promote-hc-2017-sed-direct.mjs` (fail-closes on `currentness_status !== 'current'`) + frameDefaults
  `recreational-shoreline-toddler` scenario. Owner-overridable SCREENING defaults (HC 2017 gives no
  AF/EF/ED/hr-per-day defaults): IR_sed 288 (=72 mg/hr x ~4 hr/day), AF 0.50, EF 52, ED 6 -- documented in
  each record. Owner activation: review the 4 screening values -> mark ready -> merge -> browser-confirm
  HC 2017 currentness (canada.ca 403s automation) -> set `current` -> `promote-hc-2017-sed-direct.mjs --apply`.
- **PR #320** -- TWN toddler 94 g/day food-web receptor. Owner activation: merge -> file the TWN PDF in
  Zotero -> `promote-twn-foodweb-toddler.mjs --apply --reviewer "J. Nelson" --date <YYYY-MM-DD>`
  (exact command + dry-run plan in the attestation packet).
- **M5-A** TWN WOCBA 220 g/day -- recommend Option A (do nothing; 220 g/day already live as subsistence-fisher).
All three detailed in `~/.claude/plans/mo-queue-attestation-packet-2026-06-15.md` (verified values, dry-runs,
exact commands).

## PROTOCOLS / LESSONS (carry forward)
- BRIGHT LINE: AI never runs `promote-*.mjs --apply`; inline owner approval IS the attestation. Build
  drafts pre-promotion (needs_review), owner activates.
- Ship every PR via the full pipeline: Opus subagent review -> codex Spark grind -> codex 5.5-xhigh GATE
  (mutual-agreement GREEN) + 6 gates (lint, tsc, `npm run test:ci`, monitored build, e2e). Use `npm run
  test:ci` (NOT `CI=true npm run test:ci` -- redundant + not PS-portable). CI is sharded 6x (after #324);
  if it OOMs again the next lever is 8 shards, never maxWorkers=2.
- Worktree discipline: junction-safe (PowerShell `New-Item -ItemType Junction`; cleanup via `fsutil
  reparsepoint delete` then Remove-Item the empty dir -- NOT `cmd /c rmdir`; verify shared store count
  unchanged). Head-pinned merge needs the FULL 40-char SHA. Re-run gates on the FINAL/rebased tip.
- When adding a frameDefaults scenario, bump BOTH `frameDefaults.test.ts` AND
  `frameDefaults.integration.test.ts` counts (the latter is easy to miss -- caught on #328).
- Use sonnet subagents to AUTHOR + an Opus subagent to REVIEW (Leg 1) to keep main context lean; run the
  authoritative test:ci/build/e2e + codex + merge YOURSELF. Never let a subagent run a long detached test:ci.
- codex Spark can error on sandbox `npx tsx`/network (ENOTCACHED) -> inconclusive grind; go to 5.5-xhigh gate.
- Catalog substances resolve by CAS/canonical key, not colloquial name. The IRIS 2% snapshot guard is in
  the generator; values validate against the EPA Excel, not memory.

## POINTERS
- Owner activation packet: `~/.claude/plans/mo-queue-attestation-packet-2026-06-15.md`
- Full run log: `~/.claude/plans/explore-code-base-RUNLOG.md`
- Memory: `dashboard_session_2026_06_15_ci_unblock_mo_runway.md` + MEMORY.md index
- Gate authority: `docs/GATE_MODE_SOP.md`; L1 `CLAUDE.md`; L0 `C:\Projects\CLAUDE.md`
