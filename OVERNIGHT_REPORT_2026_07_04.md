# >>> MORNING SUMMARY (2026-07-04 autonomous overnight run) <<<

## SHIPPED (5 PRs self-merged, all live-verified + fully gated): main at 3e9dbb4, vitest 4878 -> 4913
- **#470** Phase 1a: 5 metal-salts + 2 organometallics as own keys (mercuric_chloride_hgcl2 0.0003,
  selenious_acid 0.005, uranium_soluble_salts 0.003, nickel_soluble_salts 0.02, nickel_sulfate 0.012,
  tetraethyl_lead 1e-7, tributyltin_oxide_tbto 0.0003).
- **#471** Phase 2 A1: toluene 0.0097, ethylbenzene 0.022, xylenes 0.013 (HC-default backfills).
- **#472** Phase 2 A2: carbon_tetrachloride 0.00071, tetrachloroethylene 0.0047 (HC-default).
- **#473** Phase 2 A3: chlorobenzene 0.43, dichlorobenzene_1_2 0.43 (HC-default), trichloroethylene
  0.0005 (most-protective override to IRIS 2011 -- flagged).
- TOTAL: **15 substances wired** this run, each resolving SOURCED, each through tsc/test:ci/build/e2e/codex.

## >>> YOUR MORNING DECISIONS (all owner-gated; nothing auto-changed) <<<
### A. 4 CATALOG DATA ERRORS (live-verification caught the repo carrying wrong/fabricated "HC" values):
1. **chromium_trivalent**: catalog HC 0.3 is WRONG -> real HC == IRIS == 1.5. Fix catalog, then wire 1.5.
2. **barium**: catalog HC 0.19 is WRONG -> real HC == IRIS == 0.2. Fix catalog, then wire 0.2.
3. **benzo_a_pyrene**: catalog "HC 0.0003" is the IRIS value mislabeled -> real HC = 6.67e-5 (no catalog
   row). Fix catalog, then wire (BaP sf_oral 2.0 already correct).
4. **antimony** (already WIRED to 0.006): 0.006 has NO basis in any source (antimony absent from HC v4.0;
   IRIS = 0.0004). Re-pick to IRIS 0.0004.

### B. 4 HC re-pick recommendations (already-wired to the IRIS value; HC s4.4 default differs):
- cadmium 0.001 -> HC 0.0008 (more protective) | manganese 0.14 -> HC 0.025 (~5.6x more protective) |
  zinc 0.3 -> HC age-dependent UL ~0.48-0.57 (less stringent; pick age-group) | methylmercury 1e-4 ->
  HC 2e-4 (LESS protective -- confirm you want HC-default here vs keeping IRIS 1e-4).

### C. nickel_chloride dual-option: surface BOTH HC endpoints (headline TDI 0.02 + reproductive 0.0013)
  as catalog candidate rows; needs a catalog-row add (owner-gated).

## KEY LESSON: the repo catalog's "HC" values are unreliable for several substances (4 errors found in
~20 checked). The cracked trv40.txt Table 1 grid is OCR-garbled; the Appendix A per-substance narrative
+ the clean downloaded HC PDF (scratchpad/hc_trv_2021b.pdf) are reliable. A broader catalog-integrity
pass is worthwhile.

---
# OVERNIGHT AUTONOMOUS RUN -- REPORT + RECOVERY SNAPSHOT (2026-07-04)

## >>> RECOVERY SNAPSHOT (read this first after any compaction) <<<
The autonomous MO oral-cohort loop. If context was compacted, resume from HERE:
1. Read this file + `OVERNIGHT_QUEUE_2026_07_04.md` (the queue with standing decisions/rules).
2. `git checkout main && git pull`; `git log --oneline -5` to see what merged.
3. Check pending background tasks (TaskList) before relaunching anything.
4. Continue the per-wire pipeline (verify-live -> AGY -> tsc/test:ci -> manifest bump -> lint/build ->
   codex -> commit -> push -> PR -> self-merge on all-green). Batch 2-4 subs/PR. Update THIS file + the
   queue after every item. Rules (HC-default, most-protective+log on genuine conflict, multi-endpoint=
   options, re-picks logged-not-changed, verify-live-always) are in OVERNIGHT_QUEUE.

**Standing decisions (owner):** scope = Lane A wires then Lane B QA audit; self-merge on all-green;
ambiguity -> most-protective + log; one-source-multi-endpoint = surface options (not ambiguous).
**Token discipline (owner):** delegate to Sonnet subagents / AGY / a Workflow; keep orchestrator turns short.

### CURRENT STATE (update as you go)
- main tip: 70a059f (after #470). Manifest vitest: 4903 (on #471 branch, merging).
- **Pending background tasks:** #471 poll+merge (bnlrj8821); 3-conflict live-verify (a6c01a03150a6f6d5).
- **Next action when #471 merges:** sync main -> branch A2 -> AGY run `.tmp_agy_brief_A2.md`
  (carbon_tetrachloride 0.00071 + tetrachloroethylene 0.0047 backfills) -> gates -> merge.
- **After A2:** batch A3 = the 3 conflict subs (chlorobenzene/dichlorobenzene_1_2/trichloroethylene) --
  wire the MOST-PROTECTIVE value per the verification result (agent a6c01a03150a6f6d5), + log.
- **Then:** benzo_a_pyrene backfill (HC 0.0003; multi-endpoint options already in catalog); re-pick logs;
  Lane B QA audit (Workflow fan-out).

## SHIPPED (merged to main)
- **#470** -- Phase 1a: 5 metal-salts + 2 organometallics own-key wiring (mercuric_chloride_hgcl2 0.0003,
  selenious_acid 0.005, uranium_soluble_salts 0.003, nickel_soluble_salts 0.02, nickel_sulfate 0.012,
  tetraethyl_lead 1e-7, tributyltin_oxide_tbto 0.0003). Live-verified. vitest 4897.

## IN FLIGHT
- **#471** -- Phase 2 A1: toluene 0.0097 / ethylbenzene 0.022 / xylenes 0.013 (HC-default backfills).
  Local gates green; codex GREEN (2 doc fixes applied); CI polling -> self-merge. vitest 4903.

## [MORNING] CATALOG-DATA ERRORS found by live verification (parked -- owner review)
- **chromium_trivalent**: catalog `pv-hc-chromium_trivalent-hh-direct-rfd = 0.3` is WRONG. HC v4.0 states
  1.5 mg/kg-bw/day (HC adopted US EPA 1998c verbatim; HC == IRIS == 1.5, NOT a conflict). Fix catalog to
  1.5 (or drop the HC row), then wire chromium_trivalent = 1.5.
- **barium**: catalog `pv-hc-barium-hh-direct-rfd = 0.19` is WRONG. HC v4.0 states 0.2 (HC adopted US EPA
  2005a; HC == IRIS == 0.2). Fix catalog to 0.2, then wire barium = 0.2.
Neither value (0.3 / 0.19) appears in the HC source document -- treat as catalog data errors, not
alternate HC values.

## [MORNING] Re-pick recommendations (already-wired; NOT auto-changed) -- to be filled
- antimony (wired 0.006 BC P28 needs_review; approved IRIS 0.0004 exists, ~15x lower) -- recommend re-pick.
- nickel_chloride: HC dual endpoints (headline TDI 0.02 + reproductive 0.0013) -> surface BOTH as catalog
  options + seed default 0.02 (needs a catalog-row add). Owner-gated.
- (8 already-wired D1 subs: arsenic_inorganic, cadmium, dichloroethylene_1_1, dichloromethane, manganese,
  methylmercury, total_pcbs_aroclor_1254, zinc -- audit in Lane B; log any HC-default re-pick.)

## QA AUDIT (Lane B) -- pending (Workflow fan-out after Lane A)

## Batch A3 decisions (live-verified 2026-07-04; no catalog errors this batch)
- chlorobenzene -> HC 0.43 (HC 1996 NTP-1985a hepatotox, UF 100; NEWER than the frozen-1989 IRIS 0.02 -> HC-default). SOURCED pv-hc-chlorobenzene-hh-direct-rfd.
- dichlorobenzene_1_2 -> HC 0.43 (HC 1996 NTP-1985b nephrotox; NEWER than IRIS-1989 0.09 -> HC-default). SOURCED pv-hc-dichlorobenzene_1_2-hh-direct-rfd.
- trichloroethylene -> IRIS 0.0005 [OVERRIDE-LOGGED]: IRIS 2011 Tox Review (developmental/immune, midpoint of 3 RfDs) is NEWER than HC 2005 (0.00146) AND more protective -> most-protective per owner rule. SOURCED pv-iris-trichloroethylene-hh-direct-rfd (US_federal). HC 0.00146 remains a candidate option.

## [MORNING] 3rd CATALOG-DATA ERROR: benzo_a_pyrene (PARKED, not wired)
Live-verified against the CLEAN HC PDF (downloaded hc_trv_2021b.pdf; the cracked trv40.txt Table 1 is
garbled for BaP -- column bleed). Real HC oral TDI = 6.67e-5 mg/kg-bw-day (HC 2016a, Chen 2012
neurodevelopmental, NOAEL 0.02 / UF 300). The catalog's pv-hc-bap-hh-direct-rfd-tdi = 0.0003 is WRONG --
0.0003 is actually the IRIS 2017 overall RfD value (Chen 2012 via BMD), not HC. IRIS 2017 endpoints:
3e-4 developmental (overall RfD), 4e-4 reproductive, 2e-3 immune (all in catalog).
DECISION: PARK. To wire BaP correctly per HC-default needs a catalog fix (add/correct an HC 6.67e-5 row)
-- owner-gated. Do NOT wire 0.0003 as "HC" (mislabeled). BaP sf_oral (2.0) already wired + accurate.
RELIABILITY NOTE: the cracked trv40.txt Table 1 grid is unreliable (OCR column-bleed); the Appendix A
per-substance narrative fields ARE reliable (used for A1/A2/A3 -- those values are solid). A1/A2/A3 were
verified via Appendix A narrative + cross-checks, not Table 1.

## LANE A FINAL SCOPE: A1 (3, shipped #471) + A2 (2, #472 CI) + A3 (3, ready). benzo_a_pyrene PARKED.

## LANE B -- QA verification audit RESULTS (9 already-wired substances; live-verified 2026-07-04)
All owner-gated (re-picks change already-wired values -> NOT auto-changed; logged here).

KEEP (4, MATCH -- wired value verified correct):
- arsenic_inorganic 6e-5 (IRIS 2025 final; HC has no oral TDI -- non-threshold carcinogen). Correct.
- dichloroethylene_1_1 0.003 (HC FCSAP v4.0 oral TDI; HC-default already). Correct.
- dichloromethane 0.014 (HC FCSAP v4.0; HC-default already). Correct.
- total_pcbs_aroclor_1254 2e-5 (IRIS Aroclor-1254 RfD = HC Aroclor-1254 TDI). Correct (HC's 1e-5 is the DIFFERENT PCB-mixture value).

RE-PICK to HC recommended (4 -- wired to the IRIS value; HC value should be the s4.4 default):
- cadmium: wired 0.001 (IRIS food RfD 1989) -> HC provisional oral TDI 0.0008 (WHO 2011, nephrotox). Re-pick 0.001 -> 0.0008.
- manganese: wired 0.14 (IRIS 1995) -> HC oral TDI 0.025 (HC 2019b, neurodevelopmental). Re-pick 0.14 -> 0.025 (~5.6x lower).
- methylmercury: wired 1e-4 (IRIS 2001) -> HC oral TDI 2.0e-4 (HC 2007, sensitive pop). Re-pick 1e-4 -> 2e-4 (NOTE: HC is HIGHER here; s4.4 default is HC but confirm -- HC 2e-4 less protective than IRIS 1e-4; owner call).
- zinc: wired 0.3 (IRIS 2005) -> HC age-dependent UL ~0.48-0.57 (IOM 2001). Re-pick owner-gated (age-group choice; HC less stringent).

CATALOG_ERROR (1, 4th fabricated value found):
- antimony: wired 0.006 has NO basis in any live source (antimony ABSENT from HC v4.0; IRIS oral RfD = 0.0004, 15x lower; 0.006 coincides with an unrelated lead GI-absorption factor). Re-pick to IRIS 0.0004 (1991). Same class as barium 0.19 / benzo_a_pyrene 0.0003 / chromium_trivalent 0.3.

AUDIT SUMMARY: of 9 already-wired values, 4 correct, 4 should re-pick to the HC s4.4 default, 1 is a
fabricated/unsourced value (antimony). Recommend an owner re-pick pass (cadmium/manganese/zinc -> HC
more-protective; methylmercury -> confirm HC 2e-4 vs keep IRIS 1e-4; antimony -> IRIS 0.0004).
