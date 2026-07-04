# Fresh-session handoff -- Matrix Options lanes A/B/C/D (2026-07-04b)

Supersedes the run-state portion of `FRESH_SESSION_HANDOFF_2026_07_04_MO_ORAL_COHORTS_AND_UX.md`
(prior session). This session executed the 4-lane plan at
`~/.claude/plans/explore-code-base-and-atomic-hejlsberg.md` after driving it to mutual-agreement
GREEN via dual codex review (Opus Leg 1 + codex 5.5-xhigh Leg 2).

## TL;DR
- Started main `509b878` (count 4918). #475/#476 from the prior session merged early this session.
- The plan review REFRAMED the work: the committed HC v4.0 catalog rows are page-cited and
  INTERNALLY FAITHFUL (Lane C audit proves it), so the overnight "OCR-garbage -> should equal IRIS"
  premise is WRONG. Lane B is therefore a SOURCE-SELECTION decision (owner-gated), not a mechanical fix.
- Shipped 4 PRs (see below). Lane B held for owner decisions. Two Lane D items deferred (design-heavy).

## Shipped this session
| PR | Lane | What | Status |
|----|------|------|--------|
| #477 | C + A | HC/P28 integrity audit tool + report; Lane A source verdicts | MERGED (`0874561`) |
| #478 | D-2 | Eco-Food (BSAF) relabel -> "Wildlife consumers (bird/mammal)" | MERGED (`5253e51`) |
| #479 | D-1a | Per-substance pathway applicability model + badges (codex GREEN) | open, E2E gating |
| #480 | D-4 | Explicit reference-only/diagnostic eco states (codex GREEN) | open, build/E2E gating |

New/changed code of note:
- `src/lib/matrix-options/substanceApplicability.ts` -- `getSubstanceApplicability(key, frameId)`
  returns 4-state (computable / missing-input / not-applicable-for-class / hidden-by-frame) per
  pathway. Reused by the badges in `SharedGlobalInputs.tsx`. The EqP logKow gate is NOT relaxed.
- `scripts/matrix-options/audit-hc-p28-integrity.mjs` -- unit-aware read-only integrity audit
  (orchestrator-run). Re-run any time: `node scripts/matrix-options/audit-hc-p28-integrity.mjs`.
- Reference-only notices in both eco calculators (`eqp-reference-only-notice`,
  `ecofood-reference-only-notice`).

## Lane C audit -- the headline
`docs/MATRIX_OPTIONS_HC_P28_INTEGRITY_AUDIT_2026_07_04.md`: class-A value/value_text mismatch = 0,
class-B twin divergence = 0. The HC oral RfD/TDI rows are internally faithful. 71 approved-but-unwired
rows = the backlog. 399 P28 rows lack a machine-parseable "TRV Value:" label (policy-compilation,
non-default) -- a documented blind spot. RECOMMENDED (not yet added): a `catalog.test.ts` guard
asserting numeric `value` == `evidence_items[].value_text` for single_value rows.

## LANE B -- OWNER DECISIONS NEEDED (blocked; nothing edited)
Full table: `docs/MATRIX_OPTIONS_LANE_A_SOURCE_VERDICTS_2026_07_04.md`. HC v4.0 (page-cited, faithful)
vs IRIS vs HC-2016a:
1. **chromium_trivalent -- INVERTED.** HC v4.0 own value 0.3 is 5x MORE protective than IRIS 1.5 (the
   overnight target). Most-protective => wire 0.3, NOT 1.5. DECIDE: 0.3 (HC, most-protective) vs 1.5 (IRIS).
2. **barium** -- HC v4.0 0.19 vs IRIS 0.2 (5% rounding, immaterial). Recommend HC 0.19.
3. **benzo_a_pyrene** -- target 6.67e-5 is HC-2016a/Chen-2012, a DIFFERENT doc with NO `sources.json`
   record. Needs a NEW source record + NEW catalog rows (direct+food); do NOT overwrite the faithful
   v4.0 3.0e-4 rows or the IRIS neuro row. Confirm go-ahead.
4. **nickel_chloride** -- "0.02" does not exist for this species (it is IRIS `nickel_soluble_salts`).
   Real HC v4.0 value is 0.0013. DECIDE: wire 0.0013 (new key, 414->415) vs defer. Confirm distinct
   from `nickel`/`nickel_soluble_salts`/`nickel_sulfate`.

When approved, Lane B mechanics (from the reviewed plan): correct BOTH `-hh-direct-` and `-hh-food-`
twin rows (value + `evidence_items[].value_text` + locator; EvidenceLibrary renders value_text), cite
the HC row in library `sources` (resolver returns HC under default BC frame, NOT IRIS -- RUN the
resolver before authoring the integration assertion), MOVE chromium/barium out of the null-RfD block
`substanceLibrary.test.ts:914-929`, bump `vitest_test_count` + `facts_history`. No current_default
scaffold sync needed (RfD scaffolds are `not_default`).

## LANE A -- live-fetch blocker
Automated HC v4.0 re-acquisition is BLOCKED (canada.ca 403; publications.gc.ca serves an HTML wrapper
not the raw `H129-108-2021-eng.pdf`; Zotero not running). Verdicts rest on the page-cited catalog
evidence (strong). For a fresh independent read: owner downloads `H129-108-2021-eng.pdf` via browser
(or `! curl`), then extract with pdftotext/Docling.

## Remaining Lane D (deferred -- design-sensitive, want owner's eye)
- **item 1b** -- full type-to-search combobox to replace the ~400-item native `<select>` in
  `SharedGlobalInputs.tsx`. No internal combobox to fork; build or pull a headless accessible primitive.
  The applicability badges (item 1a, #479) are already in place to annotate options.
- **item 3** -- consolidated frame-impact card replacing the two competing notices
  (`RegulatoryFrameNotice` + `FrameVariantFallbackNotice`) in the dashboard.
- Item 1a (badges) and item 2 (relabel) and item 4 (reference-only states) are DONE.
- HARD CONSTRAINT (codex): do NOT relax the EqP `logKow === null` gate broadly.

## Load-bearing lessons
1. **Verify catalog values, but verify the DIRECTION too.** The overnight report's premise (HC rows
   are garbage == IRIS) was itself wrong; the HC v4.0 rows are faithful and the targets are OTHER
   sources. Dual codex review + the audit caught this before any wrong value shipped.
2. **Resolver source under the default frame is HC, not IRIS** (Canada_federal > US_federal in
   `defaultSelectionPolicy.ts:95`). Integration assertions must target the resolved HC pvid.
3. **In-place value edits must update the direct+food twin rows AND their evidence quotes** (rendered
   by EvidenceLibrary; a value-only edit passes tests but publishes contradictory provenance).
4. **CI Unit-Tests EPIPE = the known Node24 vitest flake** -> one rerun cleared it on both PRs.
5. AGY workhorse pattern held: AGY wrote the audit script + the applicability helper + the eco notices;
   orchestrator ran/verified; codex gated. Never trusted AGY closeouts -- verified via git diff + test runs.
