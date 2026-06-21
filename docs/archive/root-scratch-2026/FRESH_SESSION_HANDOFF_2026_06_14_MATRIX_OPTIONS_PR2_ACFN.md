# Fresh-session handoff -- Matrix Options PR2 (ACFN 388 community-specific food-web receptor)

**Date authored:** 2026-06-14. **main tip:** `78fbcb8` (origin/main, tracked-clean, all worktrees removed).
Plain ASCII only. Read `CLAUDE.md` (L1) + `docs/GATE_MODE_SOP.md` first.

---

## 0. State coming in (what shipped 2026-06-13/14)

Five PRs merged to main this session (all: full 6-gate suite GREEN + Opus + codex gpt-5.5-xhigh
mutual-agreement GREEN):
- **#313** `ac44595` -- HC PQRA v4.0 commercial/industrial WORKER receptor (3rd direct-contact
  scenario) + owner-attested SA correction 1640 -> 16640 cm2 + 5 catalog promotions.
- **#314** `7b37298` -- docs closeout (vitest_test_count 3618 -> 3758 + 2 LESSONS).
- **#315** `e7813ba` -- uniform attestation guard (reviewed_by/reviewed_at in valueAlreadyDone)
  across ALL 7 owner-run promote-*.mjs scripts + 7 regression tests.
- **#316** `78fbcb8` -- FOOD-WEB subsistence-fisher receptor (this is PR1 of the food-web lane).

### What #316 (PR1) put in place (the pattern PR2 mirrors)
- `src/lib/matrix-options/frameDefaults.ts`: the `bc-protocol1-v5-dra` / `human-health-food` profile
  is now TWO named receptor scenarios -- `recreational-fisher` (isDefaultScenario, IR 0.111) +
  `subsistence-fisher` (IR 0.22 kg/day = 220 g/day). BW (70.7 kg) is shared.
- `src/components/matrix-options/HHFoodWebCalculator.tsx`: scenario-aware seeding + a
  receptor-scenario selector (mirrors `HHDirectContactCalculator.tsx`). The selector auto-shows
  once `getSelectableFrameScenarios(...).length >= 2`.
- Catalog: `pv-wlrs-2023-ir-food-subsistence-bc` (0.22) promoted to approved; applicability enriched
  with TWN corroboration + the not-for-remediation caveat.
- `sources.json`: NEW source `src-bc-twn-burrard-inlet-wqo-tissue-2021` (the TWN Burrard Inlet WQO
  Tissue Quality Objectives report, ENV and HLTH 2021) -- a corroborating BC source, reference-only
  (NOT in any value's source_ids). VERIFIED against the primary PDF this session (220/111/21.5
  adult, 94 toddler g/day; BW 76.5 adult / 16.5 toddler / 69.8 female; AF 0.2, MeHg 1.0; aspirational
  Indigenous-subsistence basis, Richardson 1997).
- New owner-run `scripts/matrix-options/promote-wlrs-subsistence.mjs` + 32-case test.

---

## 1. PR2 scope: add the ACFN 388 g/day community-specific food-web scenario

Owner decision (2026-06-13): build the subsistence receptor (#316, done) AND add the **Athabasca
Chipewyan First Nation (ACFN) 388 g/day** as a SEPARATE, clearly-labeled community-specific scenario
(NOT a generic BC default).

**Source (per this session's research; VERIFY against the primary before any catalog entry):**
- Olsgard, M.L., Thompson, M.S. & Dyck, T. (2023). "Lower Athabasca Surface Water and Sediment Quality
  Criteria for Protection of Indigenous Use" (WQCIU). Athabasca Chipewyan First Nation.
- 388 g/day (0.388 kg/day) adult consumption rate, from a CONTEMPORARY traditional-food survey
  (230 community members across ACFN / Fort McKay / Mikisew Cree), Ch. 3 Sec. 3.3.5 (Eq 3.2),
  ingestion-rate discussion pp.206-207. AF 0.2 (mirrors TWN/WLRS).
- Accessibility: `G:\My Drive\SABCS - Sediment Project\References\WQCIU Report.pdf` is on Drive;
  Zotero item BHHDGZI9 (attachment T7T5IV8S). Also a source LEAD already exists in the repo:
  `matrix_research/reference_catalog/source_leads/wqciu_reference_leads_2026_05_23.json`
  (`wqciu-fish-ingestion-rate`). NOTE this is a needs_review LEAD, not a promoted source.

---

## 2. Build recipe (mirror the #316 subsistence PR exactly)

Set up a junction-safe worktree off main:
```
git -C C:\Projects\sstac-dashboard worktree add C:\Projects\SSTAC-Dashboard-worktrees\acfn-foodweb-2026-06-14 -b feat/matrix-options-foodweb-acfn-2026-06-14 origin/main
# PowerShell junction (from the primary repo cwd, NOT C:\Projects which the safety guard blocks):
New-Item -ItemType Junction -Path <wt>\node_modules -Target C:\Projects\sstac-dashboard\node_modules
Copy-Item C:\Projects\sstac-dashboard\.env.local <wt>\.env.local
```

1. **VERIFY the 388 value against the WQCIU primary** (per AI-finds-AND-verifies). Read
   `G:\...\WQCIU Report.pdf` (use the native Read tool's `pages=` PDF reader, NOT pypdf -- RAM-safe)
   at Ch.3 Sec.3.3.5 / pp.206-207. Confirm 388 g/day + the AF + the receptor definition. A Gemini/
   summary number is an INPUT, not a verified source (this session's LESSON; see #314 LESSONS.md).
2. **Source record:** add the WQCIU report to `sources.json` (`src-acfn-wqciu-2023` or similar) if not
   present, mirroring the TWN source shape. authority_scope likely `indigenous-community` or
   `non-bc-guidance`; canonical_source_status `needs_direct_source_check`.
3. **Value record:** create/verify a parameter_values.json record for the 388 g/day rate
   (value 0.388, unit kg/day, input_key IR_food_kg_per_day). **DESIGN QUESTION TO RESOLVE FIRST:**
   the recreational/subsistence records are jurisdiction `BC`, candidate_group_id
   `human-health-food__generic__IR_food_kg_per_day__BC`. ACFN is an Alberta/First-Nation value, NOT
   BC. A FRAME_DEFAULT_PROFILES seed must resolve `active` under `bc-protocol1-v5-dra`, which requires
   the value's jurisdiction to be in that frame's `eligibleCatalogJurisdictions` (see
   `regulatoryFrames.ts`). EITHER (a) the ACFN record uses jurisdiction `BC`/`general` + a distinct
   candidate_group_id, OR (b) confirm bc-protocol1-v5-dra admits the ACFN jurisdiction. Resolve this
   with `getFrameSeedCandidateEligibility` semantics BEFORE wiring -- a jurisdiction mismatch makes the
   seed resolve `invalid`/`blocked` and the scenario non-selectable. (This is the main new-design risk
   in PR2 that #316 did not face, since 220 was already a BC record.)
4. **promote-acfn-foodweb.mjs:** fork `promote-wlrs-subsistence.mjs`; identity value 0.388, the ACFN
   value id + source id. + its test.
5. **frameDefaults:** add a 3rd `bc-protocol1-v5-dra` / `human-health-food` scenario row,
   receptorScenarioId e.g. `acfn-community-specific`, scenarioLabel something explicit like
   "ACFN subsistence (Lower Athabasca, community-specific)". DO NOT move isDefaultScenario off
   recreational. The note + label MUST flag it as Lower-Athabasca/ACFN-community-specific, NOT a
   generic BC default (cultural-data care).
6. **Promote** the 388 record (owner inline attestation) via the new script --apply.
7. **Tests:** frameDefaults.test (count 6 -> 7) + integration (live ACFN scenario resolves 0.388) +
   HHFoodWebCalculator.test (3rd selector option) + library.test (approvedSourceBacked +1 ->1239,
   pendingSourceLocator depends on whether the ACFN record was already pending; run test:ci and bump
   to the FAILING assertion; assert valueGroups UNCHANGED if same slot, or +1 if a new slot).
8. **Gates** (docs/tsc/lint/test:ci/build/e2e) + Opus + codex (5.5 xhigh) to mutual-agreement GREEN
   + ship + merge on green. Then junction-safe worktree cleanup (cd primary repo first to free the
   shell-cwd lock; cmd /c rmdir the node_modules junction + verify shared count unchanged BEFORE
   git worktree remove).

---

## 3. Other queued / future work (owner-gated)

- **Direct-contact sediment-harvester receptor (separate lane):** the TWN BIWQO defers sediment
  direct-contact to Health Canada (2017) "Supplemental Guidance on HHRA of Contaminated Sediments:
  Direct Contact Pathway" -- sediment-specific factors notably HIGHER than the HC PQRA soil factors
  used in #313 (e.g. wet-sediment dermal adherence 1.0 mg/cm2 for wading/clamming vs the 0.01/0.1
  soil AF; sediment ingestion 72 mg/hour toddler). A future direct-contact "intertidal harvester"
  receptor would cite HC 2017. VERIFY the HC 2017 figures against the primary first.
- The TWN BIWQO toddler (94 g/day) / women-of-childbearing-age (220 g/day, BW 69.8, MeHg) receptors
  exist in the verified primary if finer food-web receptor granularity is wanted later.

## 4. Standing reminders
- AI never sets default_status / qa_status on its own judgment; owner inline approval IS the HITL
  attestation (run promote-*.mjs --apply yourself after a dry-run + before/after).
- `codex review -` CLI does NOT capture a verdict on a plan/non-diff artifact -- use the codex MCP
  session (read-only sandbox, repo cwd) for a clean captured verdict (this session's LESSON).
- Avoid pypdf-heavy subagents; prefer the native Read PDF reader + WebFetch.
- Worktree cleanup junction trap: remove the node_modules junction FIRST + verify shared count, then
  git worktree remove. cd to the primary repo (not C:\Projects) to avoid the safety-guard block.
