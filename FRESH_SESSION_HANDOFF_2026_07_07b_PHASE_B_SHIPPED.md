# Fresh Session Handoff -- 2026-07-07b (Phase B shipped, 3 PRs pending owner CI + merge; Phase C parked)

Supersedes (as the newest session anchor) `FRESH_SESSION_HANDOFF_2026_07_07_CUMULATIVE_LANE_SHIPPED.md`
-- that file remains the PRIOR anchor and is not edited; read it for Phase A history + the full roadmap
narrative. Plain ASCII.

## 0. One-screen orientation

This session continued the Matrix Options cumulative-effects lane as ORCHESTRATOR on Opus, delegation-heavy
(Sonnet subagents + AGY for mechanical authoring + codex two-tier for review) to conserve Claude budget.
Phase A (the calculation engine: A1 tables + A3a reducers) was already SHIPPED in the prior session. This
session executed Phase B -- the owner-gated anchor promotions D1/D2/D4 -- and attempted Phase C (framework-A2
WHO verification), which turned out to be blocked on missing source PDFs and is now PARKED, not failed.
D3 (PCB Option A) was recon'd + inspected and CLOSED OUT as DATA-LAYER SATISFIED, SCORING DEFERRED TO A3
(no data-layer code required; see the D3 section below).

## Shipped this session (3 PRs, all gates GREEN, awaiting owner CI + merge)

- **PR #540 (D1 -- dioxin-like TEQ oral TDI):** new needs_review candidate + owner-run
  `promote-hc-dioxin-teq.mjs` + a `fitz` text-extraction probe used to primary-verify the source. Value
  2.3e-9 mg TEQ/kg-bw/day (provisional), PRIMARY-confirmed against the HC TRV v4.0 (2025) PDF, PDF page 42
  / printed page 38. Catalog-only change: new `substance_key dioxin_like_teq`, new
  `input_key oral_tdi_teq_mg_per_kg_bw_day` -- NO change to `SubstanceKey` union behavior beyond the
  registration itself, no calculator wiring. Tip `fd70068` + follow-up `318e66b` (library.test.ts count
  updates: valueGroups 1684, approvedSourceBacked 1353, availableOptions 1679).
  - **CRITICAL --apply COUPLING (do not let the owner run this alone):** when the owner runs
    `node scripts/matrix-options/promote-hc-dioxin-teq.mjs --apply --reviewer "..." --date YYYY-MM-DD`,
    the SAME commit MUST also spread `...HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS` (imported from the promote
    script) into `sanctionedPromotionIds` in
    `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`. Skipping this trips the exact-set-
    equality tripwire and turns `test:ci` RED. This is documented as rule 4 inside the promote script
    itself -- read it before running `--apply`.
- **PR #541 (D4 -- BC PAH RPF remap):** `RPF_SCHEME_BY_AUTHORITY['bc-csr']` changed from `who-1998-pah` to
  `ccme-2010`, per BC TG-7 (2017, PRIMARY-verified, directs BC CSR to the 8-PAH table). `who-1998-pah` is
  now DEPRECATED-BUT-UNUSED: the type and table entries are kept (nothing deletes data) but nothing maps to
  it anymore, and it remains listed in `RPF_SCHEME_SCORING_BLOCKED` as an inert extra safety net. This
  reconciles cleanly with #537 (the prior session's benzo[b+j+k]fluoranthene fix) since `ccme-2010` already
  carries the correct combined PEF. Tip `ef65e8d`.
- **PR #542 (D2 -- BaP ADAF-stage anchor framing):** added additive `assumption_tags` (no value changes,
  no schema changes) on the 4 `benzo_a_pyrene` oral-SF rows: the HC 1.289 rows get
  `adaf_stage:adult_base_apply_on_top`; the EPA IRIS 2.0 rows get `adaf_stage:embedded_do_not_reapply`.
  This encodes the ADAF framing the prior session primary-verified (#538) directly onto the anchor rows so
  a future consumer can tell which treatment applies without re-deriving it. No guard was added inside
  `computeBaPeq` -- correct anchor pairing is explicitly deferred to the future A3b wrapper, per the
  single-bin contract clarified in #538. Tip `4746aff`.

## Phase C -- PARKED (not failed)

The C0 source-preflight step found that the WHO-2005 (Van den Berg 2006), WHO-1998 (Van den Berg 1998),
and HC PQRA H129-108-2021 primaries are NOT locally available (prior copies were scan-only or online-only),
and page-range PDF vision reads are unavailable in this environment (`pdftoppm`/poppler is not installed --
and per the non-negotiable OCR/vision-first rule, it must NEVER be installed as a workaround). As a result
the `who-2005`, `who-1998-mammal`, `who-1998-avian`, and `who-1998-fish` TEF editions in
`src/lib/matrix-options/tefTable.ts` STAY `needs_review` this session -- no regression, just no forward
progress. `who-2022-devito-2024` was already primary-verified in the prior session and is not affected.

**To resume:** the owner needs to place the WHO-2005 + WHO-1998 (+ HC H129-108-2021) source PDFs into
`G:\My Drive\SABCS - Sediment Project\References`, after which the C1 edition-packet verification
(edition-level all-or-nothing QA per `TEF_EDITION_QA`) can run. A reusable probe exists at
`scripts/matrix-options/probe_dioxin_tdi.py` (the `fitz` text-extraction pattern used successfully for D1 --
reuse this pattern rather than re-deriving a PDF-reading approach).

## D3 (PCB Option A) -- CLOSEOUT: DATA-LAYER SATISFIED, SCORING DEFERRED TO A3

Owner CONFIRMED Option A. A code-flow inspection of live `main` (verified: zero production callers of the
cumulative reducers; `compareEquivalentToStandard` header `cumulative.ts:18-19`; PCB rows in
`parameter_values.json`) established that **D3 is a dependency-tracking + deferred-scoring item, NOT a
data-layer coding task.** Do not invent reducer work for it.

Verdict: **DATA-LAYER SATISFIED, SCORING DEFERRED TO A3.**

What Option A needs, and its status:
- **Mass-based total PCBs:** `total_pcbs_aroclor_1254` stays the active canonical `current_default`
  (EPA/IRIS RfD 2.0e-5, SF 2.0, FCV 0.014) -- **UNCHANGED; MUST NOT be changed** (not a stale-default
  cleanup).
- **Non-DL PCB value:** `pcbs_non_coplanar` (HC 1e-5) -- **already approved / in place.**
- **DL-PCB fraction TDI:** supplied by D1 / #540 as `dioxin_like_teq` = **2.3e-9 mg TEQ/kg-bw/day**, with
  the **50% apportionment BAKED INTO THE CONSTANT at derivation** (HC / Baars-2001). **No runtime 50%
  operation should ever be implemented** -- there is nothing to apply at scoring time. This is a DATA
  dependency (arrives when #540 merges), not a D3 code task.

Why the scoring is deferred (not buildable as a data-layer change now):
- `computeTEQ` / `computeBaPeq` / `compareEquivalentToStandard` are **unwired / headless (D0-standalone),
  with ZERO production callers.** Building anything against them now would be dead code.
- `compareEquivalentToStandard` is **concentration-only and MUST NOT be used for a raw dose TDI**
  (mg/kg-bw/day) comparison -- it deliberately rejects dose-unit standards (`cumulative.ts:18-19`).

**Future A3 / Phase-D work (NOT this lane; start only when A3 is authorized):** compute the DL-PCB TEQ
intake (`computeTEQ` + exposure) and evaluate it as an **HQ against `dioxin_like_teq` via the calculators'
existing dose / RfD / HQ path** (NOT `compareEquivalentToStandard`), surfaced as a **parallel check
alongside** the mass-based total-PCB result. This is dispatch/UI wiring (`equationDispatch`, resolver,
`frameDefaults`, `defaultSelectionPolicy`, UI) and is owner-authorized A3 scope.

**Optional owner-gated housekeeping (NOT required for Option A correctness):** alias / deprecate the
overlapping `polychlorinated_biphenyls_total_pcbs` stub -- re-key its eco-FCV + P28 rows, **do not delete
rows** -- per `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`.

Dependency status at close: #540 (D1) was **still OPEN / not merged** at the time of this note (`main` at
`deede52`); the `dioxin_like_teq` data dependency lands only when #540 merges. Nothing further is needed
in the D3 data lane.

## Broader MO decisions (RESOLVED by owner this session 2026-07-07b)

- `phenylmercuric_acetate`: owner APPROVED a new `organomercury` `ContaminantClass`. ACTION (next
  session, when the substance is actually wired -- it is not in SUBSTANCE_LIBRARY yet): add
  `organomercury` to the ContaminantClass union and classify phenylmercuric_acetate (and other
  organomercurials) under it. No code this session because the substance is not yet wired.
- `cadmium` (0.0008) / `methylmercury` (0.0002) `current_default`s: owner CONFIRMED both (attested
  after-the-fact -- both are the most-protective/defensible value, consistent with the protective-default
  posture). No change needed; hold-flag concern resolved.
- Deferred framework-A2 remainders (belongs to the A3b/criterion-wiring lane, NOT Phase B or Phase C): 6
  unconfirmed EPA-2010 RPFs; the CCME "21.5" two-analyte labeling question; the framework-to-criterion
  mapping work generally.
- Deferred framework-A2 remainders (belongs to the A3b/criterion-wiring lane, NOT Phase B or Phase C): 6
  unconfirmed EPA-2010 RPFs; the CCME "21.5" two-analyte labeling question; the framework-to-criterion
  mapping work generally.

## Environment / mechanics notes for next session

- **Worktree:** `C:\Projects\SSTAC-Dashboard-worktrees\mo-cumulative-2026-07-07` (node_modules is a
  junction to the main checkout; `.env.local` copied in). Branches created this session:
  `lane/mo-d1-dioxin-teq-2026-07-07`, `lane/mo-d4-bc-pah-remap-2026-07-07`,
  `lane/mo-d2-bap-adaf-anchor-2026-07-07` (all pushed and PR'd), plus
  `lane/mo-d3-pcb-option-a-2026-07-07` (recon only, no commits made) and the docs branch carrying this
  handoff.
- **AGY:** worked for mechanical script authoring but its Antigravity auth DROPPED mid-session -- re-login
  via `agy` when the `cli-*.log` shows "not logged into Antigravity". AGY produced 2 systematic escaping
  defects on the D1 promote script (a Windows entrypoint guard written as
  `file://${argv}` instead of `path.resolve` + `fileURLToPath`; and a `'\\n'` double-escape) -- ALWAYS
  verify AGY output with `node --check` plus a real dry-run, never trust its own closeout claim. For
  promote scripts specifically, hand AGY a `cp` of an existing working template rather than asking it to
  "mirror this file" from scratch.
- **Gate commands** (run inside the worktree): `npm run lint` ; `npm run test:ci` ;
  `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10` ; `npm run test:e2e`. All 4 were
  GREEN on each D-item's final tip this session.
- **codex:** two-tier (Spark grind first, then gpt-5.5 xhigh as the ship gate). The xhigh gate caught real
  P2 findings on D1 that Spark missed (a missing durable-source provenance guard; a non-ASCII character in
  the probe script's regex) -- always run the xhigh gate to completion, do not stop at grind-GREEN.

## Next-session priority order

1. After the owner merges #540 (D1): resume D3 -- resolve the PCB key alias sub-decision, then wire the
   50% TEQ apportionment as A3-lane, owner-attested work.
2. Clear the two standing owner decisions: `phenylmercuric_acetate` class; confirm cadmium/methylmercury
   `current_default`s.
3. Resume Phase C once the owner supplies the WHO-2005 / WHO-1998 / HC H129-108-2021 source PDFs.
4. A3b UI wiring (only once Phase B and Phase C have both landed) + the deferred framework-A2 remainders.
