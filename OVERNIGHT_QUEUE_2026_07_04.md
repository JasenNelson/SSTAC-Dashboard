# OVERNIGHT AUTONOMOUS QUEUE -- 2026-07-04 (Matrix-Options oral cohorts + QA audit)

Durable work queue for the self-paced `/loop` overnight run. Survives context compaction: on each wake,
READ this file, take the next `[ ]` item, execute, mark `[x]` DONE or `[!]` BLOCKED (with reason), then
schedule the next wake. Owner is ASLEEP -- never stop to ask; park anything uncertain and continue.

## Standing decisions (owner pre-approved 2026-07-04, do NOT re-ask)
- **Scope:** Lane A (Phase 2 wires) until exhausted, THEN Lane B (QA verification audit).
- **Merge authority:** self-merge on all-green (codex GREEN + all 6 gates + GitHub CI green). Anything
  not fully green -> leave the PR open + log; never merge a non-green PR.
- **Jurisdiction conflict rule:** seed the library default = the **Health Canada** value (BC Protocol 1
  v5.0 s4.4). The catalog already carries the IRIS/other rows as candidate options, so wiring HC also
  surfaces the alternatives in References & Values. If NO HC row exists, seed IRIS.
- **Multi-endpoint-from-ONE-source is NOT ambiguity** (owner, explicit): when a single source gives
  several endpoints (e.g. HC TDI + reproductive; IRIS neuro/repro/immune), those are OPTIONS -- they
  already exist as catalog rows in the candidate group; seed the sensible DEFAULT (the headline/primary
  labeled value) and let the panel surface the rest. Do NOT skip these as "ambiguous".
- **Genuine ambiguity rule (apply most-protective + log):** ONLY when a real cross-jurisdiction conflict
  can't be resolved by HC-default (e.g. HC value missing AND multiple IRIS endpoints with no headline,
  or IRIS is a clearly NEWER post-2015 assessment that supersedes HC) -> wire the more health-protective
  (lower) value AND log the call with evidence for morning review.
- **Verify every value against the LIVE source before wiring** (IRIS assessment page / HC FCSAP TRV v4.0
  PDF). Never wire from the catalog/recon/memory alone. Delegate verification to a Sonnet subagent.
- **Re-picks (already-wired values) are NOT auto-changed overnight** -- if HC-default differs from an
  already-wired value, DO NOT overwrite it; log it as a morning re-pick recommendation. Only FRESH wires
  (currently null) are shipped autonomously. (Changing existing behavior unattended is out of scope.)
- **Per-wire pipeline (each item):** branch off latest main -> Sonnet verifies HC value live -> AGY
  authors the entry + substanceLibrary.test block + resolver.integration SOURCED case -> orchestrator
  runs tsc + test:ci (confirms SOURCED) -> bump manifest -> lint + monitored build + e2e -> codex 5.5
  xhigh targeted (tight verdict-forcing prompt) -> path-scoped commit -> push -> PR -> poll CI ->
  self-merge on all-green. Batch 2-4 substances per PR to amortize gate wall-clock.
- **Guardrails:** 2x gate-fail on an item -> mark `[!]` BLOCKED + log + move on. Never `git add .`.
  Plain ASCII. One codex at a time (never parallel). If token budget hits the floor, stop + write the
  morning report. Update this file + OVERNIGHT_REPORT after every item.

## LANE A -- Phase 2 jurisdiction-conflict FRESH wires (null today -> wire HC-default)
Candidates (all currently rfd_oral=null in the library; verified 2026-07-04). Value column = the
EXPECTED HC-default from the recon/decision-table; MUST be live-verified before wiring.

- [ ] barium -- HC 0.19 (vs IRIS 0.2). Class divalent-metal? (verify class vs existing barium entry -- NOTE: decision-table said barium has an entry at line 304 with rfd null; confirm it's an existing null entry to BACKFILL, not a new key)
- [ ] benzo_a_pyrene -- HC 0.0003 (IRIS endpoints 0.0003 neuro / 0.0004 repro / 0.002 immune are the options). BACKFILL existing entry (sf_oral already wired 2.0). class organic-PAH.
- [ ] carbon_tetrachloride -- HC 0.00071 (vs IRIS 0.004). fresh wire.
- [ ] chlorobenzene -- HC 0.43 (vs IRIS 0.02) -- >20x gap: HC 0.43 is LESS protective; flag as ambiguity -> most-protective (IRIS 0.02) + log, OR verify HC basis. TREAT AS AMBIGUOUS (log).
- [ ] chromium_trivalent -- HC 0.3 (vs IRIS 1.5). fresh wire.
- [ ] dichlorobenzene_1_2 -- HC 0.43 (vs IRIS 0.09) -- HC less protective; AMBIGUOUS -> most-protective (0.09) + log.
- [ ] ethylbenzene -- HC 0.022 (vs IRIS 0.1). fresh wire.
- [ ] tetrachloroethylene -- HC 0.0047 (vs IRIS 0.006). fresh wire.
- [ ] trichloroethylene -- HC 0.00146 (vs IRIS 0.0005) -- IRIS MORE protective + IRIS is a 2011 assessment; AMBIGUOUS -> most-protective (IRIS 0.0005) + log.
- [ ] toluene -- HC 0.0097 (vs IRIS 0.08). class organic. fresh wire.
- [ ] xylenes -- HC 0.013 (vs IRIS 0.2). class organic. fresh wire.

## LANE A -- deferred re-picks (already wired; DO NOT auto-change -> log recommendation only)
- [ ] antimony -- wired 0.006 (BC P28 needs_review); IRIS-approved 0.0004 exists (~15x lower). LOG re-pick rec.
- [ ] arsenic_inorganic, cadmium, dichloroethylene_1_1, dichloromethane, manganese, methylmercury,
  total_pcbs_aroclor_1254, zinc -- already wired; if HC-default differs, LOG re-pick rec (no auto-change).
- [ ] nickel_chloride -- surface BOTH HC endpoints (0.02 headline default + 0.0013 reproductive option) as
  catalog rows; needs a catalog-row addition (0.02 row) + library default 0.02. Do if pipeline allows; else log.

## LANE B -- whole-catalog QA verification audit (READ-ONLY; run after Lane A exhausted)
- [ ] Fan out (workflow, context-cheap) over every already-wired substanceLibrary entry with a non-null
  rfd_oral/sf_oral; re-verify each value against its live IRIS/HC source; produce a flagged-discrepancy
  table (substance | wired value | live value | MATCH/MISMATCH | source). NO writes -- findings only.
- [ ] Write findings to OVERNIGHT_REPORT_2026_07_04.md for morning review.

## PROGRESS LOG (append per item; newest last)
- (loop appends here)
