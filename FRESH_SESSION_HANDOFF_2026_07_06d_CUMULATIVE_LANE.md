# Fresh Session Handoff -- 2026-07-06d (cumulative-effects lane: research -> verified spec -> hardened plan -> A2)

Supersedes `FRESH_SESSION_HANDOFF_2026_07_06c_MO_GUARDS_SHIPPED.md`. Plain ASCII. Checkpoint of a long,
high-output session.

## Shipped + MERGED this session (PRs)

- **#522** zinc/manganese population/value tension flags (text-only, zero value mutation; 3rd review pass GREEN).
- **#523** prior handoff (07-06b).
- **#524** Task A: `EVIDENCE_SUBSTANCE_NAME_MISMATCH` guard (review fixed 19 missed HC locators + same-suffix swaps).
- **#525** Task B: `CROSS_SOURCE_VALUE_DIVERGENCE` extended to inhalation + eco pathways (review fixed receptor false-positives via a pairwise distinct-source test).
- **#526** close-out docs (owner-decision packet + 07-06c handoff + NEXT_STEPS/LESSONS + Ontario source).
- **#527** cumulative-effects deep-research plan + dichlorobenzene_1_2 correction.
- **#528** cumulative-effects implementation SPEC (verified vs HC v4.0 PDF).
- **#529** cumulative-effects implementation PLAN (codex-hardened to GREEN).
- **#530** A2 verification results (PAH RPFs + BaP SF) + THIS handoff -- OPEN, merging on green.

All guards are detection-only (zero catalog value mutation). Lane 2 (HC v4.0 re-verification) is RESOLVED.

## Cumulative-effects lane -- current state (NOT implemented per owner steer)

Chain on main: 3 Gemini Deep Research reports -> verified spec
(`docs/MATRIX_OPTIONS_CUMULATIVE_EFFECTS_IMPLEMENTATION_SPEC_2026_07_06.md`) -> codex-hardened plan
(`..._IMPLEMENTATION_PLAN_2026_07_06.md`) -> A2 verification
(`..._A2_VERIFICATION_RESULTS_2026_07_06.md`). The plan is the reviewed blueprint; implement in a
future owner-attested lane.

Verified facts (primary-source):
- HC TRV v4.0 (2025) uses **WHO-2022 / DeVito-2024 TEFs** (not WHO-2005) -> implementation needs
  RECEPTOR-AWARE, edition-keyed TEF tables (HC=DeVito-2024; BC/EPA/Ontario=WHO-2005; CCME=WHO-1998-taxa).
- Dioxin/DL-PCB oral TDI **2.3e-9 mg TEQ/kgBW-day** (HC v4.0 p.42, Faqi & Chahoud 1998) -- unpromoted
  candidate.
- **benzo_a_pyrene SF resolved:** catalog HC 1.289 (v4.0) + EPA 2.0 are BOTH legit -- 2.0 is the IRIS
  LIFETIME oral CSF with ADAFs baked in (IRIS also lists 1.0 adult-only; 7.3 = superseded pre-2017).
  Remaining = owner default pick + scenario tagging; implementation must NOT double-apply ADAFs if
  anchoring on 2.0.
- PAH RPF tables verified (Nisbet 1992: anthracene is 0.01 not 0.001, benzo[j]F not original; EPA 2010
  draft is SUSPENDED, 6 values need a primary-PDF read; HC/CCME PEFs = CCME-2010-from-WHO/IPCS-1998).

Plan's key design decisions (codex-GREEN): D0 reducers are STANDALONE utilities (do NOT extend
`ProvenancePathway` -- 5-member runtime array in `pathways.ts`, ~10-site blast radius); D1 reducer emits
an equivalent concentration + a new compare step (HH fns produce a standard, not a verdict); D2 A3a owns
a `CumulativeContributionRow` provenance shape; explicit UNIT contract (normalize to mg/kg before summing).

## Owner decisions still open (docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md)

- benzo_a_pyrene current_default pick (SF question now resolved; just the pick + scenario tag).
- PCB policy (total_pcbs_aroclor_1254 default + pcbs_non_coplanar; Option A -- research backs it +
  ICES-7 non-DL scoring + 50% apportionment).
- phenylmercuric_acetate ContaminantClass; cadmium/methylmercury confirm-after-fact.
- dichlorobenzene_1_2 -- CLOSED (keep IRIS 0.09; the "2025" HC label is a 1996-vintage assessment).

## Process + environment notes

- **Cursor codex backup** set up + verified working (carried gate rounds while codex was ~99%);
  documented in `C:\Projects\TOOLING_SETUP_FOR_NEW_PROJECT.md` B.5 + pointer from `/codex-review` skill.
  codex weekly reset ~7:07pm (back up now).
- 3 FOREIGN `gold-reliability` pytest processes from a parallel Regulatory-Review session (~400min,
  live parent) -- do NOT kill; not this project. `Get-Process node,python` will show them.
- Uncommitted harmless leftover: `.gitignore` (+`.gstack/`) has followed the working tree all session;
  not this session's work -- commit or drop at owner discretion.
- Ontario MECP 2026 TRVs.zip (G-drive) logged as a future catalog source (NEXT_STEPS).

## Gate + budget status

- All merged PRs (#522-#529) GREEN. #530 CI in progress at handoff time.
- Token budget LOW (~170k at checkpoint). Recommend a FRESH session for the implementation lane
  (A1 factor tables -> A3a headless core -> A3b UI -> A4 owner-attested promotions), which the hardened
  plan fully specifies.
