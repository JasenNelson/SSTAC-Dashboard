# FRESH SESSION HANDOFF -- Matrix-Options Substance-Wiring Lane
Date: 2026-07-01 (Batch V shipped; organic HH-oral-RfD lane COMPLETE)

## STATUS

MO substance-wiring lane: 16 batches (G through V) merged to main. 270 substances wired.
`SUBSTANCE_LIBRARY` count 119 -> 389. Manifest `vitest_test_count` -> 4823. PRs #418-#434.

**The organic HH-oral-RfD wiring lane is COMPLETE.** Batch V (PR #434, 21 substances,
systhane -> warfarin) wired the final alphabetical cohort after `strychnine`. A Step-0 re-run of
`wire-recon.mjs` against the current 389-key library confirmed ZERO clean organic oral-RfD
candidates remain -- the entire approved-catalog organic oral-RfD pool is now wired.

STALE-RECON LESSON (why the prior estimate was wrong): the prior handoff said "~80-100 candidates /
4-5 batches remaining." That came from the COMMITTED `_recon/wire_candidates.json`, which was never
regenerated after the early batches (~105 of its `wireable_new` entries were already wired). Always
re-run `wire-recon.mjs` (Step 0) and cross-check candidates against the LIVE `substanceLibrary.ts`
before trusting the count. The true remaining organic pool after `strychnine` was just the 21 of
Batch V.

BN-RRM lane is CLOSED (separate lane; `[[dashboard_bnrrm_fullcorpus_loaded_2026_06_30]]`). Do not
resume BN-RRM work from this handoff.

## SOURCE OF TRUTH

Memory anchor `dashboard_mo_wiring_lane_2026_06_30` -- full method, conventions, key lessons, the
lane-complete status, and the NEXT LANES list.

## WHAT REMAINS (NOT this lane -- needs owner direction / a different path)

After Batch V the only recon entries left are NON-organic-oral-RfD:
- **Metal / inorganic / elemental / cyanide / oxyanion / DBP-ion / organometallic** (~35 subs:
  aluminum_phosphide, bromate, the cyanide salts, nitrate/nitrite, perchlorate, mercuric_chloride,
  nickel salts, phosphine, selenious_acid, sodium_azide, tetraethyl_lead, tributyltin_oxide_tbto,
  uranium_soluble_salts, vanadium_pentoxide, white_phosphorus, zineb, ...). These need a different
  wiring path (divalent-metal / metalloid class + different fields), NOT the organic template.
- **Inhalation-only** (no clean oral RfD): technical_hexachlorocyclohexane_t_hch (sf_oral+iur only),
  triethylamine, vinyl_acetate, vinyl_bromide.
- **HITL-DEFERRED:** PCBs (`pcbs_non_coplanar` -- overlaps `total_pcbs_aroclor_1254`),
  `phenylmercuric_acetate` (organomercury). NOTE: `diquat`/`fosetyl_al` (previously listed deferred)
  were already wired in earlier batches -- confirmed via the Step-0 live-library check.

## NEXT LANES (candidates -- reasoning-dense / parallelizable; Workflow + adversarial-verify shaped)

1. **Excluded-classes TRV research packet** (metals / inorganic / eco): per-substance source-finding
   (HC > ECCC > EPA) + verification + class handling proposal. Output a HITL-reviewed candidate set;
   wire nothing autonomously.
2. **Whole matrix-options SUBSTANCE_LIBRARY correctness audit** (389 entries: value-vs-catalog drift,
   unit errors, class misassignments, dual-source completeness). Report-only.
3. **Recon-regen + catalog reconciliation sweep** -- surface any NEW approved IRIS rows.

## METHOD (unchanged; for any future wiring batch)

Step 0: re-run `wire-recon.mjs` (authoritative pool; never trust the committed JSON) + cross-check
vs live library. Then AGY authors the 3-file diff (mirror `strychnine` single-source / `prochloraz`
dual-source; dual-source cites BOTH source_ids) -> orchestrator verifies inline vs catalog + `tsc
--noEmit` + `CI=true npm run test:ci` -> Leg 1 (Sonnet/Opus) + Leg 2 (codex) commit gate to GREEN ->
path-scoped commit -> 4 push gates foreground (lint / test:ci / monitored build / e2e) -> PR ->
merge after CI green (mergeStateStatus=CLEAN; E2E spawns LATE). Known EPIPE flake:
`gh run rerun <run-id> --failed`. AGY bug: sometimes drops `[]` off the `satisfies` clause -- verify
before tsc.
