# Fresh-Session Handoff -- Eco-pathway WIRING (make the eco values FUNCTION in the calculators)

> !!! SUPERSEDED IN PART (2026-06-17, /codex-review VERDICT RED) -- DO NOT BUILD STEPS 4/5 AS WRITTEN.
> Steps 4/5 below assume substance-specific eco fcv/trv values can seed via FRAME_DEFAULT_PROFILES.
> They CANNOT: `frameDefaults.resolveSeed` REJECTS any cited record whose `substance_key !== 'generic'`
> (verified `frameDefaults.ts:683-685` + validation `:1005-1007`). frameDefaults is for GENERIC exposure
> factors only; HH substance-specific values come from `substanceLibrary`, not frameDefaults. The eco
> wiring needs a NEW substance-aware seed path (catalog-direct resolver, "Path B"). Steps 1-2 below are
> still valid. The corrected design (Path B, narrowed to SUBSTANCE_LIBRARY substances) lives in the
> approved plan `~/.claude/plans/explore-code-base-and-dazzling-widget.md`. Read that, not Steps 4/5 here.

Entry point for the next SSTAC-Dashboard session. Read L0 `C:\Projects\CLAUDE.md` + L1 `CLAUDE.md` +
`docs/GATE_MODE_SOP.md` first. **Run /codex-review (adversarial loop to GREEN) before commits; full 6
gates before push.** This wiring touches SHARED provenance/seeding code (used by the human-health
pathways) -- harden it; do not rush.

## CONTEXT / WHY
PR #339 (merged, main `f3b56fe`) shipped 88 `needs_review` eco catalog rows + the generator, but
**deliberately did NOT wire them** -- loading needs_review rows into the global tuple provenance
resolver mis-attributes library-seeded calculator values. This session WIRES them so the eco-direct +
eco-food pathways auto-compute. Owner directives (2026-06-17, see memory
`feedback_needs_review_values_usable_build_first_review_later` -- HIGH AUTHORITY):
- **`needs_review` must NOT block calculator use.** Build-first, detailed value review later. Keep the
  flag honest (never falsely stamp `approved`/`direct_source_verified`).
- **Include ALL sources' values** (different sources, different values = the point of the DB; no
  adjudication). Default-SELECTION priority: HC / Environment Canada / FCSAP first, US EPA only when it
  adds info or is newer.
- **Seeding policy = HYBRID** (owner choice): provisional-seed needs_review values NOW (badged), pin +
  promote sources later (flip provisional -> approved over time).
- Comparison "matrix" view (D14) = DEFERRED, low urgency. Priority: build DB -> wiring works -> TEST
  wiring + verify all required input data is present (a massive job).

## INVESTIGATION ALREADY DONE (3 read-only agents, 2026-06-17) -- file:line facts to build on

### Seeding chain (agent A)
- `frameDefaults.ts:46-65` `SEEDABLE_KEYS` (eco-direct-eqp + eco-food-bsaf are `[]`); `:74-86`
  `SEEDABLE_KEY_UNITS` (no eco); `:183-577` `FRAME_DEFAULT_PROFILES` (HH rows only).
- `frameDefaults.ts:637-750` `resolveSeed`: a record only SEEDS if `qa_status==='approved'` (`:706-729`)
  AND passes the eligibility gate; `needs_review` -> status `'pending'` (value shown, NOT seeded,
  `:741-749`); `superseded` -> `'superseded'`. `getActiveScenarioFrameDefaults` (`:797-803`) returns
  only `status==='active'`.
- `defaultSelectionPolicy.ts:256-279` `getFrameSeedCandidateEligibility` reuses `classifyCandidate`
  (`:~187-227`): blocks unless `approved_source_backed` + `canonical_source_status==='direct_source_verified'`
  + a `canonical_candidate`/`isDirectCurrentSource` source + eligible jurisdiction + `single_value` +
  not `not_default` + not `current_calculator_scaffold`.
- HH calculators seed via `getActiveScenarioFrameDefaults(frame,pathway,scenarioId)` then filter by
  inputKey (`HHDirectContactCalculator.tsx:46-70,109-129,167-195`). Eco calculators currently seed from
  `substanceLibrary` (per-substance, not frame-aware): `EcoDirectEqPCalculator.tsx:72-90`,
  `EcoFoodBSAFCalculator.tsx:94-126`.

### Candidate-aware resolver (agent B) -- LOW RISK, HH-safe
- `catalog.ts:48-59` `getParameterValueRecord` returns FIRST tuple match; `resolver.ts:77-112`
  `resolveProvenanceRows` uses exact `parameter_value_id` if present ELSE the tuple fallback (`:84-88`).
- HH calculators SET `parameter_value_id` for frame defaults (`HHDirectContactCalculator.tsx:380-471`)
  -> a tuple-fallback change does NOT affect HH. Eco calculators set NO id -> rely on the tuple.
- FIX = make the tuple fallback VALUE-AWARE: if the matched record's `value` != the used value, return
  null (no mis-attribution) instead of the wrong record. Scoped to `resolver.ts:84-88` + a
  `resolver.test.ts` case (mock two same-tuple rows, different values). `getParameterValueRecordsForSubstance`
  exists (`catalog.ts:72-80`) + is unused -- useful for value-aware selection.

### Receptor scenarios + source-priority (agent C)
- Eco-food mammal/bird = mirror the HH scenario model: `FRAME_DEFAULT_PROFILES` rows with
  `receptorScenarioId` ('mammal'/'bird') each citing a DISTINCT eco-TRV `parameter_value_id`;
  `getSelectableFrameScenarios` populates a dropdown; calculator adds scenario state + reseed-on-change
  (mirror `HHFoodWebCalculator.tsx:168-220,468-492`). Files: `frameDefaults.ts:46-65,183+`,
  `EcoFoodBSAFCalculator.tsx`. NOTE: do NOT put receptor in `candidate_group_id` (catalog.test recomputes
  the 4-part key `pathway__substance__input__jurisdiction`); receptor is encoded by the scenario row +
  the cited per-receptor `parameter_value_id` + `species_groups`.
- Source-priority ALREADY EXISTS: `defaultSelectionPolicy.ts:81-134` `SOURCE_PRIORITY_BY_FRAME` ranks
  by jurisdiction (`bc-protocol1-v5-dra`: BC > Canada_federal > US_federal > general; `canada-fcsap-aquatic`:
  Canada_federal > general; `us-epa-usace-sediment`: US_federal > general) via `hierarchyRank` +
  `compareCandidates`. The owner's HC/FCSAP-over-EPA intent is already met at jurisdiction level;
  source-granular-WITHIN-Canada (HC vs FCSAP) is an OPTIONAL later tie-breaker (add
  `SOURCE_PRIORITY_BY_FRAME_AND_SOURCE` consulted on rank ties) -- defer unless needed.

## THE WIRING PLAN (sequence; each step = its own /codex-reviewed commit; 6 gates before push)

### Step 1 -- DATA EXPANSION (build the DB; safe, no wiring) -- can ship as its own PR first
Re-derive the eco staging to include MULTI-SOURCE values + un-hold:
- For every FCV-sheet substance with values in >1 column (EPA ESB / EPA NRWQC CCC / CCME CWQG), emit a
  SEPARATE needs_review row per source (not just the "recommended" one). E.g. diazinon (ESB 0.1699 +
  NRWQC 0.17), malathion (ESB 0.097 + NRWQC 0.1), methoxychlor (ESB 0.019 + NRWQC 0.03), endosulfan
  isomers (ESB + NRWQC), PCE (ESB 98 + CCME 110).
- UN-HOLD (set hold:false, emit): Toxaphene (ESB 0.039 AND add NRWQC CCC 0.0002 -- both sources),
  PCB-total (NRWQC 0.014; the "0.03" was a fetch MISREAD, not a 2nd source -> do not invent it),
  chloroform (CCME 1.8). All needs_review.
- Generator already supports this; the `parameter_value_id` includes source-short so multi-source rows
  per substance don't collide -- VERIFY the id scheme disambiguates by source (it currently keys on
  substance+pathway+short+receptor; ADD a source discriminator to the id if two sources share a pathway/
  input for one substance, else duplicate-id throws). Regenerate `eco_values.json`; update the
  eco-catalog-load test counts; gates + codex.

### Step 2 -- CANDIDATE-AWARE RESOLVER (low risk) + WIRE catalog.ts
- Implement the value-aware tuple fallback (`resolver.ts:84-88`) + test. Then re-add the catalog.ts
  import + spread (the 2 lines reverted in #339) so eco rows load. Confirm HH provenance unchanged
  (test:ci). This is the unblocker for loading needs_review rows without mis-attribution.

### Step 3 -- PROVISIONAL-SEEDING TIER (hybrid; shared-gate change -- HARDEN)
- Add a `'provisional'` seed status to `frameDefaults.resolveSeed`: a `needs_review` record cited in a
  FRAME_DEFAULT_PROFILES row (with an explicit `provisional: true` on the default entry) resolves to
  status `'provisional'` (value SEEDED) instead of `'pending'`. `getActiveScenarioFrameDefaults` includes
  `'provisional'` (or add `getSeededScenarioFrameDefaults` covering active+provisional).
- Calculator UI: show a "provisional -- not yet HITL-verified" badge on a provisionally-seeded input
  (so it's honest). Mirror the existing frame-default badge pattern.
- Keep the `approved`+`direct_source_verified` path intact (HH unaffected); provisional is an ADDITIVE
  tier. Regression-test the HH pathways thoroughly (they must behave identically).
- This is the load-bearing shared-code change -- holistic codex it.

### Step 4 -- WIRE ECO-DIRECT (simplest; no receptor split)
- `SEEDABLE_KEYS['eco-direct-eqp'] = ['fcv_ug_per_L']` (+ unit) + `foc` if seeding the EqP floor; author
  FRAME_DEFAULT_PROFILES eco-direct rows (per frame) citing the (source-priority-selected) fcv row as
  `provisional`. Wire `EcoDirectEqPCalculator.tsx` to seed `fcv` from `getSeededScenarioFrameDefaults`
  (fallback to substanceLibrary). Calculator now auto-computes from frame+substance. Test + gates + codex.

### Step 5 -- WIRE ECO-FOOD (receptor scenarios)
- `SEEDABLE_KEYS['eco-food-bsaf'] = ['trv_eco_mg_per_kg_bw_day', 'fLipid', 'foc', 'BSAF...']`; add
  mammal/bird `receptorScenarioId` profile rows (each citing the per-receptor TRV row); add the scenario
  dropdown + reseed logic to `EcoFoodBSAFCalculator.tsx` (mirror HHFoodWeb). Seed fLipid=0.03 / foc=0.002
  (from the ECO_DEFAULTS packet) + BSAF (per-substance; ERDC DB is a separate sourcing effort -- ITRC ~2
  generic trip-point as a placeholder if needed). Test + gates + codex.

### Step 6 -- PIN + PROMOTE (the "later" half of hybrid; owner-gated, incremental)
- Fetch + pin dated PDFs for EPA NRWQC + CCME-CWQG (my work, not owner value-review) -> set
  `canonical_source_status: direct_source_verified` honestly; author `promote-eco-*.mjs` (pattern:
  `promote-hc-pqra-direct.mjs`); on owner inline approval, promote rows -> `approved` (flip provisional ->
  approved). FCSAP Module 7 is already linked. Incremental -- not all at once.

### THEN (deferred) -- D14 comparison "matrix" view (low urgency).

## AGY ORCHESTRATION (workhorse model -- empirically validated 2026-06-17 on PR #339; full detail in memory `agy_antigravity_cli_usage`)
Division of labor: **AGY = implementer (edits + local checks); Claude = thin orchestrator (writes briefs,
runs codex, runs gates, verifies); codex = reviewer.** Conserves Anthropic tokens (AGY + codex run on
their own budgets). Per-task loop, repeat for each wiring step:
1. Claude writes a SELF-CONTAINED brief to `.tmp_agy_brief_<step>.md` in the worktree (AGY cannot see the
   chat) -- exact files, exact change, the relevant facts/values, and a named acceptance check. Do the
   judgment (which values, which keys) IN the brief; AGY transcribes/edits mechanically.
2. Launch: `cd <worktree> && agy -p "Read <ABS brief path> and execute it exactly; run the acceptance
   check; write the closeout to .tmp_agy_closeout_<step>.md; then stop." --print-timeout 8m` (foreground;
   Bash timeout ~9m). AGY edits are fast (~10-90s).
3. Claude VERIFIES on disk: read the closeout + `git diff` (NEVER trust AGY's claim) + run the acceptance
   check yourself. Then Claude runs `/codex` on the diff.
4. Keep each AGY invocation SMALL (edits only) so it stays under the 10-min Bash cap; Claude runs codex +
   gates (don't have AGY do long codex/test:ci -> background-death + OOM risk).

AGY NUANCES (verified -- do NOT relearn the hard way):
- AGY `-p` print mode SUPPRESSES its response on stdout when not a TTY (piped/redirected = 0 bytes). Its
  deliverable is the FILE EDITS + the closeout file -- read those from disk; `git diff` is the proof.
- `--output-format json` DOES NOT EXIST in v1.0.6. Models are parenthetical ("Gemini 3.5 Flash (High)").
- Do NOT pass `--dangerously-skip-permissions` -- it BYPASSES the settings.json deny-list (rm/fsutil/
  mklink/git push --force/git worktree remove/npm install/gh pr merge/...). The configured `command(*)` +
  `read_file(*)` + scoped `write_file` already let AGY edit + run node/git/`codex review` non-interactively
  with the deny-list intact.
- AGY honors tight briefs faithfully (touched only scoped files, ran the acceptance check, wrote the
  closeout across 5 tasks). It compacts silently on long runs -> keep briefs self-contained + small.
- For the accuracy-critical steps (Step 1 values, Step 5 receptor mapping), the `/codex` spot-review MUST
  verify value-by-value against the sheets/catalog -- not a diff skim.

## GUARDRAILS
- Shared code (resolver, defaultSelectionPolicy, frameDefaults, calculators) is HH-critical: every step
  re-runs `test:ci` to prove HH pathways unchanged; holistic codex on Steps 2/3.
- Never falsely stamp `approved`/`direct_source_verified` (keep needs_review honest; provisional badge).
- Plain ASCII; path-scoped staging; worktree-not-checkout-b + junction-safe cleanup (PowerShell-native:
  `fsutil reparsepoint delete` the node_modules junction FIRST + shared-store count gate, THEN
  `git worktree remove`; NEVER `Remove-Item -Recurse` on the junction); head-pinned squash; CI green before merge.

## STATE
main `f3b56fe` (PR #339 merged); eco_values.json (88 rows) + generator + staging + sources live on main;
catalog.ts is UNWIRED (the 2-line spread reverted). No open eco PR/branch. Memory:
`feedback_needs_review_values_usable_build_first_review_later`, `dashboard_session_2026_06_17_eco_catalog_plus_2pr`.
