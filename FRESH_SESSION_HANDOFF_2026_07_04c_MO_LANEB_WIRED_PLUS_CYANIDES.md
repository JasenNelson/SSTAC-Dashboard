# Fresh-session handoff -- MO Lane B wired + cyanide cohort (2026-07-04c)

Continuation of `FRESH_SESSION_HANDOFF_2026_07_04b_MO_LANES_ABCD.md` (the reframe + Lane C/A/D work).
This addendum covers the owner-approved Lane B wiring + the clean-backlog cyanide cohort shipped after.

## Shipped this session (all codex-gated, self-merged on green)
| PR | What |
|----|------|
| #477 | Lane C HC/P28 integrity audit tool + report; Lane A source verdicts |
| #478 | Lane D-2 Eco-Food relabel |
| #479 | Lane D-1a per-substance applicability model + badges |
| #480 | Lane D-4 explicit reference-only/diagnostic eco states |
| #481 | session handoff (2026-07-04b) |
| #482 | catalog value/value_text integrity guard + manifest |
| #483 | **Lane B: chromium_trivalent 0.3 + barium 0.19** (HC v4.0, owner most-protective) |
| #484 | Lane D-3 FrameImpactCard (consolidates the two competing frame notices) |
| #485 | Lane D-1b accessible type-to-search SubstanceCombobox (replaces the 414-option select) |
| #486 | **Lane B: nickel_chloride 0.0013** (HC v4.0; "0.02" was a species conflation) |
| #487, #489 | manifest count syncs (-> 4944 -> 4960) |
| #488 | **8 cyanide-salt substances** wired build-first to approved US EPA IRIS oral RfD |

vitest_test_count 4918 -> **4960**. SUBSTANCE_LIBRARY 414 -> **423**. No catalog data mutated in any
Lane B PR (the HC values were already faithful in the catalog per the Lane C audit); the cyanides are
new own-key entries citing existing approved IRIS rows.

## The load-bearing reframe (see 2026-07-04b handoff for detail)
The committed HC v4.0 catalog rows are page-cited and internally FAITHFUL (Lane C audit: 0 mismatches;
the #482 guard now enforces value==value_text permanently). So Lane B was a SOURCE-SELECTION decision,
not typo-fixing. Owner chose HC most-protective for chromium (0.3 vs IRIS 1.5) + barium (0.19 vs 0.2);
nickel_chloride to its real HC value 0.0013.

## Owner-gated remaining (nothing else is blocked)
1. **benzo_a_pyrene** -- HELD. Target 6.67e-5 is HC-2016a (Chen 2012), not verifiable in-repo; automated
   HC fetch is blocked (canada.ca 403 / no Zotero). Owner-assisted download of `H129-108-2021-eng.pdf`
   or the HC-2016 BaP drinking-water guideline PDF unblocks it. Details in
   `docs/MATRIX_OPTIONS_LANE_A_SOURCE_VERDICTS_2026_07_04.md`.
2. **phenylmercuric_acetate** (organomercury) + **pcbs_non_coplanar** (overlaps total_pcbs_aroclor_1254)
   -- prior-handoff DEFERRED for HITL; not wired.
3. **Jurisdiction-conflict recon candidates** (18 rfd / 4 sf / etc.) -- multiple differing approved
   values; each needs an owner source-selection decision. See `scripts/matrix-options/_recon/wire_candidates_summary.md`.
4. **zineb** (0.05, IRIS) -- the one remaining CLEAN single-approved rfd not yet wired; trivial to add
   if desired (a fungicide; left out of the cyanide cohort for coherence).

## State
main green (4960 tests); orphan sweep clean; all session PRs merged (#489 manifest self-merging on green).
Clean uncontested wiring backlog is now exhausted apart from zineb. Awaiting owner direction.
