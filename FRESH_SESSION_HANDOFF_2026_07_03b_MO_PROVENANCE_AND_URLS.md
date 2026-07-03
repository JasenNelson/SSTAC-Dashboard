# FRESH SESSION HANDOFF -- 2026-07-03b -- MO provenance resolver + source-URL corrections

**Continues** `FRESH_SESSION_HANDOFF_2026_07_03_MO_OVERNIGHT_4LANE.md` (the overnight 4-lane run).
This session did the overnight run PLUS two owner-raised follow-ups: a systemic provenance-resolver
fix and a source-URL verification/correction pass. **Main tip at close: `d7a2bde`** (+ PR #462 in CI).

---

## MERGED to main this session (9 PRs)
Overnight 4-lane run: #455 (Lane 3 PCB brief) / #456 (Lane 2 36 citations) / #457 (owner-decisions
queue + Lane 4) / #458 (Lane 1 metals, 4 substances) / #459 (overnight handoff).
Follow-ups: **#460** (source-URL corrections) / **#461** (provenance resolver approved-tiebreak, 39/41)
/ (#462 below, in CI).

---

## IN FLIGHT -- finish this FIRST next session
### PR #462 -- frame-aware provenance jurisdiction tiebreak (the last 2 of 41)
Branch `fix/mo-provenance-jurisdiction-tiebreak-2026-07-03`. Fully gated + green locally (tsc,
test:ci 4878, monitored build, e2e); GitHub CI Unit+Build+Lint PASS, E2E was finishing at close.
**ACTION: verify #462 E2E green, then self-merge** (owner pre-approved self-merge-on-all-green).
- codex note: round-1 raised a P1 (isolated `resolver.test.ts` transitive-import) that was
  EMPIRICALLY REFUTED (that suite passes 37 tests in test:ci AND in GitHub CI Unit Tests) and
  ADDRESSED (mock `defaultSelectionPolicy` in the unit suite). codex round-2 was inconclusive --
  its sandbox cannot run Vitest (known Windows limitation); GitHub CI is the authoritative gate.

---

## THE ONE REMAINING TASK -- PR-B (owner-approved, do after #462 merges)
### Re-wire beryllium + selenium (complete the metals cohort 6/6)
In #458 I deferred beryllium (0.002) + selenium (0.005) because they resolved to unsourced scaffolds.
The #461 + #462 resolver fixes now make them resolve, so they can be re-wired:
- **selenium** rfd 0.005: resolves to IRIS (single approved; the P28 sibling is needs_review) via the
  #461 approved-tiebreak. Just re-wire the value.
- **beryllium** rfd 0.002: dual-approved (IRIS US_federal + HC Canada_federal). Resolves to HC under
  BC/default frames, IRIS under US frames, via the #462 frame-aware tiebreak. Just re-wire the value.
- Recipe: branch off updated main. In `substanceLibrary.ts`, set rfd_oral for beryllium (0.002) and
  selenium (0.005) to the WIRED values (they are currently dormant/null -- see their entries ~line 341
  / ~529; their metals `sources`/`notes` from the #458 spec are in `.tmp_lane1_cohort5_spec.md`).
  Move both from the Cluster E dormant block into the "Lane 1 metals cohort HH wiring" describe block
  in `__tests__/substanceLibrary.test.ts` (add {key, rfd, sf:null, cls, absDermal}); beryllium stays
  divalent-metal 0.001, selenium metalloid 0.03. Bump manifest vitest_test_count (+2). tsc + test:ci +
  codex + gates + self-merge. Verify each resolves SOURCED (not scaffold) after wiring.

---

## Provenance architecture (context for the above)
`resolveTupleRecord` (`src/lib/matrix-options/provenance/resolver.ts`) resolves a wired HH-direct
value to a catalog source. Tiebreak ORDER when >1 catalog rows match the value (all merged/pending
this session): (1) explicit `current_default` row -- the professional-judgment override; (2) single
`qa_status=approved` match (#461); (3) FRAME-AWARE jurisdiction rank via
`getFrameJurisdictionRank(frameId, record)` from `defaultSelectionPolicy` -- BC/Canada/default frames
rank Canada_federal (HC) > US_federal (IRIS) per **BC Protocol 1 v5.0 s4.4**, US frames rank US_federal
first (#462); (4) else null. `resolveProvenanceRows(usedValues, frameId?)` takes the frame; the panel
forwards its `regulatoryFrameId`. This fixed all 41 previously-unsourced HH-direct endpoints.

Owner decision captured (2026-07-03): source-default hierarchy follows BC Protocol 1 v5.0 s4.4 --
Health Canada preferred when values are concordant; US EPA usable when more scientifically defensible
(professional judgment, per-substance, via a current_default row). See
https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/protocols/2026-04-13_p1_v_50_final_signed.pdf (s4.4).

## Source-URL verification (done, #460)
All 38 `sources.json` URLs were fetch-verified: 35 correct, 3 fixed (src-health-canada-hhra-2023 URL
9.832535->9.833859 + year 2023->2017 + short_citation; src-oehha-fish-contaminant-goals-2017 year
->2008; src-acfn-wqciu title). Method: a URL claiming a title must resolve to that document. If more
source URLs are added later, re-run the same fetch+title-match verification.

## Scratch artifacts (gitignored, on disk; regenerate if missing)
- `.tmp_lane1_cohort5_spec.md` -- metals cohort full spec (beryllium/selenium values/sources/notes for PR-B).
- `.tmp_provenance_scope.md` / `.tmp_frame_scope.md` -- the resolver + frame investigations.
- `.tmp_lane2_verified_citations.md` -- the 36 verified Lane-2 citations.
- Recon: `node scripts/matrix-options/wire-recon.mjs` -> `_recon/wire_candidates.json`.

## Owner-decisions queue (from the overnight run, still open)
`docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md`: MeHg eco-TRV, ~35 unwired organic cohorts
(per-substance abs_dermal volatility), 92 queued items (jurisdiction/speciation/schema).

## Process lessons this session
- Verify values AND source URLs against the LIVE source, never memory (the wrong HC link, the drug/CID
  citation mix-up, arsenic IRIS-2025).
- codex catches real P2s on doc-only + data PRs too; its Windows sandbox can't run Vitest -- for
  test-heavy diffs, GitHub CI Unit Tests is the authoritative gate; don't block on a sandbox-stuck re-review.
- Do NOT run `codex review --commit HEAD` and then switch branches -- HEAD moves and the review targets
  the wrong commit. Use `--commit <SHA>`.
- Manifest facts_history entry is MANUAL per bump.
