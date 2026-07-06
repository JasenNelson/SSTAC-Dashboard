# Fresh-session migration handoff + roadmap (2026-07-05b)

Continues `FRESH_SESSION_HANDOFF_2026_07_05_MO_DEFAULTS_AND_INTEGRITY.md`. Written at a low-token
migration checkpoint. main is green; nothing important uncommitted.

## Delta since the 2026-07-05 handoff (the HC-value verification thread)
- **HC v4.0 SOURCE ACCESS SOLVED (partially):** the headless browser (`/browse`) bypasses canada.ca's
  bot-block; owner Google Drive is reachable via gdrive MCP + the local `G:\` mount. BUT the HC TRV v4.0
  (2025) chemical-specific VALUE TABLES are NOT web-published (canada.ca page is order-a-copy only) and
  are NOT in Drive. Drive has the **HC 2010 Part II** TRV PDF (`G:\...\CSAP\Risk Assessment PDFs\`), which
  is SUPERSEDED -- **owner rule: HC v4.0 (2025) TRUMPS 2010** (see memory
  `feedback_protocol1_hierarchy_hc_default_epa_when_newer_defensible`).
- **PR #516 CLOSED (unmerged, correctly):** it quarantined 1,2-DCB (catalog HC 0.43) based on the 2010
  value (0.03). Wrong -- 2025 trumps 2010, and 1,2-DCB 0.43 is a legitimate HC oral TDI that may be
  correct in v4.0. 1,2-DCB is UNCHANGED on main (HC 0.43 candidate, EPA 0.09 current_default). Do NOT
  re-quarantine it without the v4.0 value. #516 also carried a HC-2010 cross-check tool
  (`scripts/matrix-options/hc-trv-partii-crosscheck.mjs`) -- lives only in the closed-PR history.
- **chlorobenzene fix (#513) STANDS** -- it does NOT depend on 2010: 0.43 was the mg/m3 inhalation TC
  mis-filed into the oral RfD field (unit/column error), corroborated wrong by EPA IRIS 0.02 + BC P28 0.02.

## PENDING (not started / interrupted this session)
1. **(a) #513 note-wording fix (owner-approved):** the merged chlorobenzene review_note calls 0.43 a
   "1,2-DCB mis-attribution"; the accurate root cause is "inhalation TC (mg/m3) mis-filed into the oral
   RfD field". Cosmetic catalog-note change; ship a tiny PR.
2. **(b) HC v4.0 CONFIRMATION (the big one):** our catalog's entire HC TRV v4.0 (2025) dataset was
   robot-extracted 2026-05-29 from a canada.ca page that now shows NO value tables -> it is UNCONFIRMED,
   and the extraction already produced >=1 proven error (chlorobenzene). Needs the actual HC TRV v4.0
   (2025) document (order-a-copy). When obtained + dropped in Drive/repo, run a clean full cross-check
   (the tool is reusable -- recover it from closed #516 or re-author).
3. **(c) CI/E2E slowness investigation (owner-requested, /codex-review):** E2E bottlenecked every merge
   this session (~15-30 min queue stalls). Owner wants: investigate why (required-check config, run time,
   sharding/concurrency in `.github/workflows/ci.yml`), consult codex, present options + recommendations.
   NOT started. (A Sonnet subagent gathered that ci.yml holds the E2E job; go from there.)
4. **Cross-check tool decision:** owner's answer split (re-ship vs drop); defer -- re-ship a tool-only PR
   (no 1,2-DCB quarantine) if v4.0 audit is planned, else drop.

## Development plan, progress, next 10 sessions
See the fuller roadmap the /update-docs subagent produced (scratchpad ROADMAP_2026_07_05.md) and the
committed matrix-options plan docs. Synthesis:

**Plan:** Matrix-Options is THE priority lane -- a defensible HHRA/ERA calculator suite (HH direct-contact,
HH food-web, Eco direct/food) over a provenance-tracked substance catalog with Protocol-1-aligned TRV
values, so QPs run contaminated-sites risk assessments with source-cited, HITL-selectable values.

**Progress:** SUBSTANCE_LIBRARY ~424 entries; clean single-approved rfd/sf backlog EXHAUSTED; current_default
set on ~18 multi-option substances per the recency rule; whole-library provenance audit + coverage tests +
two integrity guards shipped; chlorobenzene mis-value fixed. Full 6-gate CI; ~5080 vitest. Prior
whole-app demo-readiness ~75-80% (gap = owner env/migration confirmations, not code).

**Next ~10 sessions (prioritized):**
1. **HC v4.0 confirmation** -- obtain the v4.0 doc -> full clean cross-check of all pv-hc-* values (data
   integrity foundation; chlorobenzene showed the extraction is fallible).
2. **CI/E2E speedup** -- unblock merge throughput (every session pays the E2E-queue tax). Investigate +
   fix (shard/concurrency/required-check).
3. **Owner value decisions -> wire** -- benzo_a_pyrene (HC-2016a), PCBs (total/non-coplanar),
   phenylmercuric_acetate. Each is a HITL source-selection then a build-first wire.
4. **current_default curation for remaining multi-value substances** -- the systemic gap is only ~18
   done; sweep the rest per the recency rule.
5. **Eco pathway completion/verification** -- confirm eco catalog wiring + eco-food/eco-direct defaults.
6. **Evidence-vs-substance CAS/name guard** -- catches the WRONG-SUBSTANCE mis-attribution mode (#514
   caught wrong-VALUE); extend divergence guard to rfc_inh/iur_inh + eco.
7. **Frame-default profiles** -- expand jurisdiction/frame default assumption rows.
8. **Excluded-classes TRV research** -- the classes deferred from the QA audit.
9. **Demo-readiness closeout** -- drive the ~20-25% gap (owner env confirmations + any real UI/UX polish).
10. **Broader lanes as directed** -- BN-RRM maps, matrix-map data load, SSD workbench (owner steers).

## Fleet/budget posture (worked well; keep it)
AGY authors mechanical diffs; Sonnet subagents for research + Claude-side analysis/test-fixes; codex
5.5-xhigh gates to round-2 GREEN; Opus orchestrates + adjudicates owner rules. Research stays in-lane
(cursor = engine-v2 session; opencode/ollama-cloud = OpenHarness session). See
`feedback_token_efficient_means_delegate_claude_budget`.

## Working-tree note (unchanged)
`.agents/skills/**`, `.mcp.json`, `opencode.json` tracked on main but untracked in the primary local
checkout (parallel session) -> blocks `git checkout main`; all work used a worktree off freshly-fetched
origin/main. A fresh clean checkout sidesteps it.
