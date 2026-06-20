# Fresh Session Handoff -- 2026-06-19b -- ECO-DATA BACKLOG COMPLETE

**Status:** Eco-data backlog (matrix-options) is COMPLETE. Main tip after this session: `fa5e303`
(plus this handoff doc PR). All 97 eco-catalog rows are promoted to approved; all 4 eco sources pinned.

Plain ASCII only. Authored at session close-out per the CLAUDE.md mandatory-handoff rule (#351).

---

## What this session did (2026-06-19b) -- 8 feature PRs + this handoff

| PR | What | State |
|----|------|-------|
| #347 | eco-registry fan-out: 36 substances + 4 logKow backfills | merged (start of session) |
| #348 | PR B: 4 reconciliation substances (generic chromium, mercury_inorganic, total-PCBs, xylenes) + xylene_m->xylenes staging collapse | merged |
| #349 | Step-6 4A: preserve-approvals guard in the eco generator (fail-closed) | merged |
| #350 | Step-6 4A: CCME chloroform eco-direct row + library entry (logKow 1.97) -> 97-row catalog | merged |
| #351 | docs: CLAUDE.md Session-End now MANDATES a handoff refresh + commit | merged |
| #352 | Step-6 4B tooling: `promote-eco-source.mjs` (owner-run source-grouped promotion helper) | merged |
| #353 | Step-6 4B: CCME pilot promotion (1 chloroform row -> approved) | merged |
| #354 | Step-6 4B: full promotion (ESB 32 + FCSAP 45 + NRWQC 19 = 96 rows -> approved) | merged |

Every PR: full 6 push gates GREEN + Leg-1 Opus + Leg-2 codex 5.5-xhigh mutual-agreement GREEN.

## End state (verified on main)
- `matrix_research/reference_catalog/eco_values.json`: 97 rows, **97 approved, 0 needs_review**.
- 4 eco sources pinned (`currentness_status=current`, `canonical_source_status=direct_source_verified`):
  EPA ESB 2008 (tier_1), FCSAP Module 7 2021 (tier_1), EPA NRWQC (tier_2, access-dated live table),
  CCME CWQG (tier_2, chloroform factsheet). No source was re-tiered.
- Calculators (EcoDirect EqP, EcoFood BSAF) now seed APPROVED (non-provisional) eco values -- the
  provisional badge no longer shows for any eco substance.

## How the values were attested (reusable)
1. A 192-agent adversarial **verify+refute Workflow** machine-confirmed all 96 values against their
   pinned sources: ESB 32/32, FCSAP 45/45, NRWQC 19/19, each with a quoted source excerpt.
   - PDF extraction: `pdftotext` cracks the ESB (semspub.epa.gov/work/10/500006301.pdf) + FCSAP
     (publications.gc.ca/.../En14-92-7-2021-eng.pdf -- needs a Mozilla UA + a publications.gc.ca
     REFERER to fetch the real PDF, not the interstitial HTML) PDFs. WebFetch cannot read those binary
     PDFs; pdftotext (local) can. NRWQC is live HTML (agents WebFetch directly).
   - The 1 flag (NRWQC total-PCBs criterion type) was resolved authoritatively: **0.014 ug/L is the EPA
     freshwater CHRONIC CCC** (the value the eco-direct pathway needs).
2. The owner inline-attested each batch (dry-run -> before/after shown -> owner "yes" -> `--apply`,
   reviewer "J. Nelson"). Inline approval IS the HITL attestation.

## The promotion tooling (for any FUTURE eco rows)
`scripts/matrix-options/promote-eco-source.mjs --source <id> [--reviewer "..." --date YYYY-MM-DD --apply]`
- Dry-run default. Per-source exact-COUNT assertion + single-source + nested-source + relationship-role
  + row-identity (default_status=available_option / value_type / jurisdiction) + pre/done state machine
  + combined source-pin state machine + durable-locator guard + idempotent (PROMOTION_STAMP_MARKER).
- Flips currentness_status -> current (the eco-specific addition vs the HC template, which requires
  already-current). The generator's `--preserve-approvals` flag protects these approvals from a future
  regenerate (it REFUSES to overwrite a catalog containing approved rows otherwise).
- Promotion test-guard cascade (bump in the same commit): `library.test` approvedSourceBacked +N /
  pendingSourceLocator -N; `ecoSeed.test` provisional flips; `eco-catalog-load.test` coherence invariant
  (already relaxed to allow approved); `EcoDirect/EcoFood` component provisional-badge tests.

## What is NEXT (no in-flight eco work)
- The eco-data backlog is DONE. No eco rows remain needs_review; no eco promotion remains.
- D14 all-pathway comparison view: still owner-deprioritized (lowest priority).
- Future matrix-options work is owner-directed. If new eco substances/values are added later, use
  the generator (with `--preserve-approvals`) + `promote-eco-source.mjs` + the guard cascade above.

## Lessons (carried)
- EqP direction: `sedS = FCV * Koc(logKow) * foc`; HIGHER logKow => HIGHER (LESS-stringent) sediment
  benchmark. (Do not call a high-Kow pairing "conservative".)
- `| tail` / `| tee` MASKS the real exit code of test:ci/build -- read the captured log.
- `EvidenceLibrary.test.tsx` has 2 env-flaky 15s-timeout tests on the slow dev machine (pass at 60s;
  intermittent in test:ci) -- the known flake, not a regression.
- codex (Leg 2) is the load-bearing ship gate: round-1 caught REAL issues Opus missed on EVERY
  substantive PR this session. Always run the two-leg pipeline.
