# FRESH SESSION HANDOFF -- 2026-07-03 -- MO Autonomous Overnight Run (4 lanes)

**Status:** 4 lanes worked; 4 PRs merged (#455/#456/#457/#458). Lane 1 partially shipped
(4 metals wired) with a systemic provenance finding + remaining backlog for the owner.
**Main tip at close:** 77efa3e (PR #458 merged; earlier tips: #455 #456 #457) (after PR #458).

---

## What shipped (all self-merged after codex mutual-agreement GREEN + full gates + GitHub CI)

| PR | Lane | Summary |
|----|------|---------|
| #455 | Lane 3 | PCB-key consolidation DECISION BRIEF (doc-only; deferred HITL). codex caught 2 P2s (catalog-vs-library key distinction; Option A must migrate catalog rows). |
| #456 | Lane 2 | 36 truncated `sources` citations restored, all source-verified (PubChem PUG-View / HSDB / ATSDR / PPDB). Fixed 5 substantive provenance errors: carbon_tetrachloride CID 5566(=Trifluoperazine)->5943; endosulfan_alpha/beta wrong-CID/source; Lindane logKow->PPDB; thallium CID guard (23966=Americium); trichlorobenzene_1_2_4 dropped-RfD-provenance restored. Sources text only; no numeric field changed. |
| #457 | Queue doc + Lane 4 | `docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md`. Lane 4: MeHg eco-TRV = owner decision (eco-activation via non-null bsaf; CCME mammal 0.000022 / avian 0.000031 / keep-null; needs a re-established `pv-mehg-trv-eco` catalog row); BaP FCV + PCB TRV = verified-null (no real source). Plus 92 queued Lane-1 items. |
| #458 | Lane 1 metals | Wired 4 source-verified metals: chromium_hexavalent (RfD 0.0022 HC + SF 0.27 IRIS), mercury_inorganic (0.0003 HC), uranium (0.0006 HC), vanadium_pentoxide (0.009 IRIS, new, CASRN 1314-62-1). Manifest 4869->4871; length 406->407. |

---

## LANE 1 -- REMAINING WORK (start here next session)

### 1. SYSTEMIC provenance finding (OWNER DECISION -- highest priority)
Two metals (beryllium 0.002, selenium 0.005) were verified but **DEFERRED** from #458: each has
multiple same-value catalog candidates and **no `current_default` row**, so `resolveTupleRecord`
(`src/lib/matrix-options/provenance/resolver.ts:104-131`) returns null -> the calculator shows the
value as an **unsourced scaffold**. This is a **pre-existing systemic gap**: any substance wired from
the auto-generated `human_health_trv_values.json` without a hand-added `current_default` row in
`matrix_research/reference_catalog/parameter_values.json` has it -- confirmed for **naphthalene and
pyrene** (already shipped, already unsourced). The cleanly-resolving substances (arsenic_inorganic,
zinc, cadmium, methylmercury, lead, total_pcbs_aroclor_1254, benzo_a_pyrene) resolve only because
someone previously hand-added `current_default` rows.
- **Owner decision:** adopt a `current_default`-curation pass (add rows for beryllium, selenium,
  naphthalene, pyrene, and future dual-source wires). This is HITL-gated catalog work (CLAUDE.md
  "no catalog mutation without owner approval"). Once decided, beryllium/selenium wire trivially
  (values already verified; entries currently dormant).
- **Test coverage gap:** `provenance/__tests__/resolver.integration.test.ts` only exercises 4
  substances (all with current_default); it does NOT assert this display path for wired substances.
  Consider adding a resolver test that flags any wired library value that resolves to no source.

### 2. Organic wiring cohorts NOT yet wired (~35 autonomous-eligible)
The metals triage covered only Cohort 5. Cohorts 1-4 from the earlier triage remain unwired:
Cohort 1 organochlorines (~11), Cohort 2 chlorinated solvents/ethers (~8), Cohort 3 aromatic
amines/nitro carcinogens (~9), Cohort 4 phthalates/misc (~7). **These need per-substance abs_dermal
VOLATILITY determination** (RAGS SVOC 0.1 vs HC VOC 0.03 -- NOT a halogen-class pick; re-opens the
#451 defect if guessed) + the same provenance check as above (many will hit the current_default gap).
Wire only `selection_status==='clean'` `rfd_oral`/`sf_oral` rows; queue jurisdiction_conflict +
inhalation-only (48, need an rfc_inh/iur_inh schema field) + organometallics + cyanide speciation.

### 3. The 92 queued items
All in the merged `docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md` (Section D). Each needs
an owner pick (jurisdiction, speciation, class, or schema work).

---

## Key artifacts (scratch, not committed -- regenerate/read as needed)
- Lane-1 metals verified spec: `.tmp_lane1_cohort5_spec.md` (full per-substance values/sources/tests).
- Provenance-resolver investigation (the systemic finding): captured in this handoff + the #458 PR body.
- Lane-2 verified citations: `.tmp_lane2_verified_citations.md` + `.tmp_lane2_batch{3..6}.md` + `.tmp_lane2_clean.md`.
- Recon pool: regenerate with `node scripts/matrix-options/wire-recon.mjs` -> `scripts/matrix-options/_recon/wire_candidates.json` (untracked; discard after).

## Process notes / lessons this run
- **Verify every value against the LIVE source, never memory** (vanadium_pentoxide CASRN 1314-62-1
  confirmed vs EPA IRIS + PubChem CID 14814; all wired values grep-checked back to the catalog).
- **codex earns its keep even on "doc-only" PRs** -- caught real P2s on all three docs (PCB brief,
  queue doc) and the metals provenance P2. Every commit went through the Leg-1(Opus)+Leg-2(codex) loop.
- **The plan itself went through 6 codex rounds** before any code (bookkeeping new-vs-backfill split,
  MeHg eco-activation, abs_dermal volatility, jurisdiction-conflict values, inhalation-field schema
  gap, wildcard-deletion safety).
- **AGY cold-start-hangs** -- one authoring run stalled (empty log, 5+ min); killed by explicit PID +
  tree (never by image name) and finished the small edit inline. For big authoring AGY works well
  (retry once on stall); for small delicate reverts, inline Edit is more reliable.
- **CI E2E is the ~15-min long pole** per PR; doc-only PRs still run the full suite (not path-filtered).
- Reference/source files live in **Google Drive** (`G:\My Drive\SABCS - Sediment Project\References`),
  never OneDrive (L0 rule 1.14).

## Close-out hygiene
- Scratch to remove (exact paths only; NEVER wildcard -- pre-existing untracked temp.txt/temp2.txt/
  temp3.txt + operational artifacts must stay): the `.tmp_codex_*`, `.tmp_agy_*`, `.tmp_lane*`,
  `.tmp_gate_*`, and `.tmp_handoff_*` files THIS session created (enumerate before deleting).
- Orphan sweep: `Get-Process node,python` -- one stalled AGY (agy.exe) was killed this session; verify
  no orphans remain.
