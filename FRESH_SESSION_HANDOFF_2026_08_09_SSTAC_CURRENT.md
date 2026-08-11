# SSTAC-Dashboard -- CURRENT SESSION CONTINUITY ANCHOR (2026-08-09)

Registered as `continuity.current_handoff` (lifecycle AUTHORITATIVE) in
`docs/_meta/docs-manifest.json`.

## 1. What this file is, and what it is NOT

This is a **repository-wide ROUTING anchor**. It tells a fresh session WHERE current truth lives.

It is NOT a status dashboard, NOT a metrics page, and NOT a lane report. It deliberately does not
restate test counts, streak counts, grades, PR states, or any other volatile number, because every
past root handoff that did so went stale and then had to be corrected. If you want a number, follow
the route below to its canonical home and read it there.

**Reading rule:** anything in this file that is not a route is a dated statement, tied to its own
stated date, and must be re-verified before you act on it. Sections 2 through 6 are dated 2026-08-09.
Section 7 is a later dated addendum and carries its own date.

## 2. Start here, in this order

1. `C:\Projects\CLAUDE.md` (L0 cross-project rules) then `CLAUDE.md` (L1 project rules).
2. `AGENTS.md` -- the primary agent operating guide.
3. `docs/INDEX.md` -- the canonical documentation entrypoint. Route from there, not from filename
   guesses or repo-wide grep.
4. `docs/GATE_MODE_SOP.md` -- gate authority. Read before any commit or push.
5. `.claude/skills/sessionstart/SKILL.md` -- the fresh-session ritual.

## 3. Where current facts actually live

| You want | Canonical home |
| :--- | :--- |
| Any volatile metric (test counts, streak, grades) | `docs/_meta/docs-manifest.json` -> `facts`. `facts_history` is frozen history and is NEVER current authority. |
| Documentation routing and required-doc gates | `docs/INDEX.md` + `docs/_meta/docs-manifest.json` |
| Matrix Options / Matrix Map lane status | `docs/MATRIX_OPTIONS_STATUS.md` (lane-scoped by design; it does not claim global status) |
| Wiki / Graphify operations, contracts, known issues | `docs/WIKI_KB_OPERATIONS_2026_07.md` |
| Commit / push / merge protocol | `docs/GATE_MODE_SOP.md` |
| Deferred items and open threads | `docs/NEXT_STEPS.md` (append-only; not a status dashboard) |

## 4. Wiki / Graphify lane -- verified live on 2026-08-09

Only these events are asserted, and each was verified live at authoring time:

- **PR #776 is MERGED** as `d6690b6f0f7262ead9027225442289d5e1e964e5`, which is `origin/main`.
  It restored the deterministic `/sync-wiki` contract (runtime-pinned executables with fail-closed
  resolution; split update/cluster with pre-cluster canonicalization and a community-required final
  smoke) and landed two non-authoritative reference packets.
- **The canonical runtime was manually repinned to that OID and rebuilt.** This was REQUIRED, not
  optional: the merge touched `tooling/wiki/**`, which is inside the N0 auto-follow protected
  pathspec, so auto-follow would otherwise refuse (`REFUSED_TOOLING_CHANGE`) every night. Postflight
  confirmed the three-way bind -- runtime HEAD, the remote-tracking ref, and `wiki\.build-stamp` all
  read `d6690b6f` -- with HEAD detached, tree clean, and the served graph published with complete
  community population.
- **Counted-window status is NOT restated in this file.** The current value is canonical ONLY at
  `facts.wiki_runtime.counted_window` in `docs/_meta/docs-manifest.json`. Read it there. This file
  makes no live claim about which day the window has reached, and no claim at all about any night
  after 2026-08-09.

  DATED SNAPSHOT, 2026-08-09 ONLY (not a live counter, not a prediction): as of that date the
  deterministic window stood at 4 of 10 and the semantic-qualifying count at 0 of 5. Both numbers
  are frozen to 2026-08-09 and are superseded by the manifest fact the moment it advances.
- Phase 7 graduation remains blocked on the separate `semantic ran >=5/10 nights` criterion, because
  the installed task is deterministic-only. Nothing about MCP, semantic, Ollama, scheduler state, or
  committed `wiki/` output was activated.

## 5. Deliberately NOT claimed here

- The state of PR #773 and PR #774 was NOT re-verified for this anchor. Do not read their absence
  or presence here as a status claim; query GitHub.
- No claim is made about any other active lane, worktree, or open PR.
- No volatile counter is duplicated from the manifest.
- An untracked recovery harness (`capture-repinned-receipt.ps1`) exists in the primary checkout. It
  is a one-shot whose success test only accepts `REPINNED`, so it reports a false negative on a
  correct `ALREADY_CURRENT` night. It is intentionally not committed and not a supported tool.

## 6. Historical predecessor

`docs/archive/2026-08-09_wiki-recovery/FRESH_SESSION_HANDOFF_2026_08_07b_VERIFICATION_AND_REPINNED_CAPTURE.md`
is a byte-identical historical import of the prior recovery handoff; see that folder's `README.md`
for source path, hash, and why it was archived rather than adopted. Its original remains untracked
and untouched in the primary checkout.

`FRESH_SESSION_HANDOFF_2026_07_30_F2_MERGED_HOTFIX_MERGED_D2_BLOCKED.md` remains HISTORICAL and is
not a continuity anchor; its "D2 BLOCKED" framing predates the 2026-08-01 apply.

## 7. Dated addendum, 2026-08-10 -- Graphify MCP proof attempt failed before MCP

This section is dated 2026-08-10. It adds no route and no counter; it exists so a fresh session does
not misread the 2026-08-09 snapshot in section 4.

- A disposable Graphify MCP compatibility-proof attempt (R13) was run once on 2026-08-10 and exited
  in its own controller preflight, BEFORE package installation and before any Graphify or MCP
  process existed. Nothing was downloaded, installed, reviewed, or tested; no server and no MCP
  session started; no compatibility receipt exists. **Graphify/MCP compatibility is UNKNOWN.**
- **Call it a pre-MCP controller-preflight failure.** It is not a Graphify failure and not an MCP
  failure, and it is not evidence for or against the candidate pin.
- **It changed nothing this file routes to.** No deterministic night, no semantic progress, no
  scheduler, Ollama, canonical-runtime, requirements, registration, or `wiki/` change. The section 4
  statement that nothing about MCP, semantic, Ollama, scheduler state, or committed `wiki/` output
  was activated remains true on 2026-08-10.
- **The section 4 dated snapshot is NOT restated or revised here**, and its 2026-08-09 figures were
  not caused by, and are not affected by, this attempt. Read the live value at
  `facts.wiki_runtime.counted_window` in `docs/_meta/docs-manifest.json`. This addendum makes no
  claim about any night after 2026-08-09.
- Routes: the immutable attempt record and root cause are section 9 of
  `docs/design/wiki/GRAPHIFY_MCP_REPAIR_PACKET_2026_08_08.md`; an unapproved, materially simpler
  DRAFT proof contract is section 10 of the same packet; the dated disposition is in
  `docs/NEXT_STEPS.md`; the reusable lesson is in `docs/LESSONS.md`; the immutable attempt fact is
  `facts_history.session_2026_08_10_graphify_mcp_compat_r13_attempt` in the manifest, and the live
  status is `facts.wiki_runtime.graphify_mcp_compatibility` (UNKNOWN).
- The R13 authorization is consumed, its evidence root is preserved with no cleanup or reuse
  authorized, and there is no R14 and no authorized controller/parser patch.
