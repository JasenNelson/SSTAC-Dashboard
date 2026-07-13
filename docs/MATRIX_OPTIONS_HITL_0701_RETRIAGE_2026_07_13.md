<!-- Generated 2026-07-13. Re-triage of docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md
against CURRENT catalog + code state (worktree top50-2026-07-13, branch docs/mo-top50-2026-07-13).
Report-only. No catalog, substanceLibrary.ts, or provenance file was modified in the production of
this document. Plain ASCII. -->

# Matrix-Options HITL 07-01 Backlog -- Re-Triage 2026-07-13

**Purpose:** the 2026-07-01 consolidated HITL decisions doc (43 line items, ~170+ underlying
substance/field actions) predates the organic wiring lane completion, the IRIS buildout, PRs
#437/#440, and the 2026-07-04 through 2026-07-12 build-first campaigns. Re-verify every item against
CURRENT `src/lib/matrix-options/substanceLibrary.ts`, `src/lib/matrix-options/types.ts`,
`src/lib/matrix-options/ecoSeed.ts`, and `matrix_research/reference_catalog/*.json` so the owner is
not asked to re-decide items that later lanes already resolved, and so items already tracked in the
2026-07-12 owner-decision packet are not duplicated here.

**Method:** every RESOLVED row below is evidence-backed by a direct file/line read or grep against the
worktree state as of this report (base: `docs/mo-top50-2026-07-13` branch, commit `6995bc7`). No item
is marked RESOLVED on inference alone.

## Summary counts

| Group | RESOLVED | SUPERSEDED | STILL-OPEN | Total items |
|---|---|---|---|---|
| 1. Value corrections | 8 | 3 | 0 | 11 |
| 2. abs_dermal anomalies | 8 | 0 | 2 | 10 |
| 3. Build-first wiring gaps | see 3a-3e below | | | |
| 4. Classification | 2 | 0 | 1 | 3 |
| 5. Provenance/text | 6 | 0 | 1 | 7 |

(Group 3 counts filled in below its own section, then rolled into a final combined total at the
bottom of this document.)

---

## Group 1: VALUE CORRECTIONS

### 1a. Human health

| Item | Disposition | Evidence |
|---|---|---|
| copper (oral RfD) | SUPERSEDED (07-12 packet item A4) | `substanceLibrary.ts` now wires 0.426 (HC candidate), matching one of the 3 originally-flagged options. But the catalog row `pv-hc-copper-hh-direct-rfd-tdi` still carries `default_status: available_option` (no ruling among HC 0.426 / P28 0.09 / P28-water 0.141). Item A4 in `MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md` names this exact ruling as still open. |
| benzo_a_pyrene (oral SF) | SUPERSEDED (07-12 packet item A6, "D2 benzo_a_pyrene") | `substanceLibrary.ts:17` now wires 2.0 (IRIS 2017 ADAF candidate, matches `pv-iris-bap-hh-direct-sf`) and discloses the HC alternate (1.289) in `sources` -- the original mislabeling is fixed. But neither catalog candidate carries a `current_default` stamp; item A6 names "D2 benzo_a_pyrene anchor + ADAF scenario + disposition of needs_review rows" as still open. |
| lead (oral RfD) | RESOLVED | `substanceLibrary.ts:112` wires 5.0e-4 mg/kg-bw/day = `pv-hc-lead-hh-direct-risk-dose` (approved, qa_status=approved). Sources string correctly cites the HC provisional risk-specific dose. Not named in the 07-12 packet as still open. |
| total_pcbs_aroclor_1254 (oral SF -- disclosure only) | RESOLVED | `substanceLibrary.ts` sources string now explicitly discloses "oral SF borrowed from the generic US EPA IRIS PCBs entry (CASRN 1336-36-3); IRIS has not assessed Aroclor 1254 carcinogenicity under its own CASRN." Value unchanged at 2.0 as the 07-01 doc itself recommended (no numeric change). The broader PCB-family default ruling is a separate item (07-12 packet A5, "D3 PCB Option A") -- not what this line item asked for. |
| arsenic_inorganic (oral RfD + SF) | RESOLVED | `substanceLibrary.ts` wires 6.0e-5 / 32, matching `pv-iris-arsenic-hh-direct-rfd` (approved) and `pv-iris-arsenic-hh-direct-sf` (approved, current_default). Sources now correctly cite the IRIS 2025 assessment instead of the mismatched BC-P28-value-under-IRIS-label. Note: this is a DIFFERENT resolution path than either option the 07-01 doc proposed (adopt-P28 vs adopt-IRIS) -- it resolved to the current-generation IRIS 2025 values, which are neither the stale IRIS values nor the P28 values originally compared. |

### 1b. Ecological (Eco-Food TRV metal mismatches)

| Item | Disposition | Evidence |
|---|---|---|
| copper (eco-food TRV) | RESOLVED | `substanceLibrary.ts` static `trv_eco_mg_per_kg_bw_day` is now null (the wrong Eco-SSL 7.0 value removed); `ecoSeed.ts`'s `resolveEcoSeed()` is actively called by the live `EcoFoodBSAFCalculator.tsx` and dynamically resolves FCSAP rows (mammal 5.6 / bird 4.5, both qa_status=approved) directly from `eco_values.json` at runtime -- exactly 2 candidate rows, no competing sources, so the resolver is deterministic per receptor. |
| cadmium (eco-food TRV) | RESOLVED | Same dynamic-resolver mechanism; FCSAP rows mammal 0.77 / bird 2.1, both approved. |
| zinc (eco-food TRV) | RESOLVED | Same mechanism; FCSAP rows mammal 75.4 / bird 66.1, both approved. |
| arsenic_inorganic (eco-food TRV) | RESOLVED | Same mechanism; FCSAP rows mammal 1.04 / bird 4.4, both approved. |
| lead (eco-food TRV) | RESOLVED | Same mechanism; FCSAP rows mammal 4.7 / bird 1.63, both approved. |
| benzo_a_pyrene (eco-food TRV) | RESOLVED | Same mechanism; FCSAP rows mammal 3.6 / bird 0.001 (wide spread as originally flagged, but both are approved FCSAP rows and the resolver serves whichever receptor the caller requests -- see Group 3d note on receptor selection). |

**Caveat carried forward on 1b:** the FCSAP catalog rows carry `default_status: available_option`,
not `current_default`; the dynamic resolver's jurisdiction/source-priority ranking (FCSAP ranked 0,
sole eco-food source) picks the correct row deterministically today because there is no competing
non-FCSAP candidate for any of these 6 substances -- but there is no formal "default" stamp on
record. Low-risk residual (informational, not a new owner-gated item).

**Group 1 total: 8 RESOLVED, 3 SUPERSEDED (copper -> A4, benzo_a_pyrene SF default -> A6, PCB family
default -> A5), 0 STILL-OPEN.**

---

## Group 2: abs_dermal ANOMALIES

| Item | Disposition | Evidence |
|---|---|---|
| vinyl_chloride | RESOLVED | `abs_dermal: 0.03` (was 1.0). Notes: "VOC-consistent default (vinyl chloride is a gas, bp -13 C)... Corrected from an unsupported 1.0 (data-entry defect)." |
| bis_2_ethylhexyl_phthalate_dehp (DEHP) | RESOLVED | `abs_dermal: 0.1` (organic class default). Notes: "DEHP is a non-volatile SVOC (bp ~384 C), NOT a VOC; the prior 0.03 VOC-RAF label was a copy-paste error (2026-07-02 source verification)." |
| 2_4_6_trinitrotoluene_tnt (TNT) | RESOLVED | `abs_dermal: 0.03` unchanged, but now a real chemical-specific rationale: "chemical-specific EPA soil ABS_d for TNT (3.2%; EPA RAGS Part E supplemental ABS_d table, Reifenrath et al. 2002), NOT a generic VOC RAF." |
| 2_4_dinitrotoluene | RESOLVED | `abs_dermal: 0.1`. Notes: "organic-class SVOC default... 2,4-DNT is a semivolatile nitroaromatic, not a VOC (prior 0.03 VOC-RAF label was wrong)." |
| 1_2_4_5_tetrachlorobenzene | RESOLVED | `abs_dermal: 0.1`. Notes: "organic-halogenated SVOC default... persistent low-volatility SVOC (bp ~246 C), no chemical-specific ABS_d; prior 0.03 VOC-RAF label was wrong." |
| phenol, bisphenol_a, nitrobenzene (3 of 5 originally-named entries) | RESOLVED | All now `abs_dermal: 0.1` with notes explicitly correcting the "0.03 is the class default" mislabel (true default is 0.1); bisphenol_a: "not a VOC... non-volatile solid (mp ~158 C)"; nitrobenzene: "semivolatile, not a VOC." |
| styrene | RESOLVED (value unchanged, mislabel fixed) | `abs_dermal: 0.03` retained, but notes now give an honest chemical-specific rationale ("HC TRV v4.0 Table 5 VOC RAFDerm default, MECP 2011; styrene is a confirmed VOC, bp 145 C") rather than the false "class default" claim. |
| pyridine | STILL-OPEN | `abs_dermal: 0.03` unchanged. Notes explicitly flag it as an unresolved boundary case: "volatile (bp 115 C) but Method 8270-classified; 0.03 kept as the VOC default awaiting a dedicated review." **Gate:** HITL must rule whether pyridine gets the VOC RAF (0.03) or the organic SVOC default (0.1). Not listed in the 07-12 packet. |
| acetone, 1_4_dioxane, acrylonitrile, carbon_disulfide (4 entries) | RESOLVED | All now cite HC TRV v4.0 Table 5 VOC RAFDerm + MECP 2011 with a specific boiling point (46-101 C) -- the "class default" mislabel is gone; the value (0.03) was already chemically plausible per the 07-01 doc's own assessment. |
| chromium_trivalent, barium, beryllium, chromium_hexavalent, chromium (generic), nickel, mercury_inorganic (7 entries) | RESOLVED | All 7 confirmed at `abs_dermal: 0.001` (divalent-metal class default), each with an explicit "Corrected from [old value]" note. chromium_hexavalent's note additionally clarifies dermal-sensitization potency is a hazard concern, not an absorption fraction, and should not be encoded as an inflated ABSd. |
| total_pcbs_aroclor_1254 | RESOLVED | `abs_dermal: 0.14` unchanged (this was never flagged as needing a VALUE change, only disclosure), but notes now state: "abs_dermal 0.14 = EPA RAGS Part E Exhibit 3-4 chemical-specific value for PCBs/Aroclor (not the 0.1 organic-halogenated default)." |
| naphthalene abs_dermal follow-up (other 11 PAH entries at 0.13 vs naphthalene's confirmed-correct 0.148) | STILL-OPEN | naphthalene remains at 0.148 (already resolved 07-01, unchanged). All other checked PAH-class entries (benzo_a_pyrene, pyrene, benz_a_anthracene, anthracene, fluoranthene, phenanthrene, acenaphthene, fluorene, dibenzo_a_h_anthracene, 2_methylnaphthalene, and a duplicate-looking `methylnaphthalene_2` key) remain at 0.13, with no note in any of them addressing the 0.148-vs-0.13 question. **Gate:** HITL must rule whether the PAH-class dermal RAF should be uniformly 0.148 (per HC TRV v4.0/v3.0 Table 5, Moody et al. 2007, as verified for naphthalene) or whether 0.13 is independently defensible for the other congeners. Not in the 07-12 packet (checked; no "dermal" hits). |

**Group 2 total: 8 RESOLVED, 0 SUPERSEDED, 2 STILL-OPEN (pyridine VOC-vs-SVOC call; PAH-cohort
0.148-vs-0.13 follow-up).**

---

## Group 3: BUILD-FIRST WIRING GAPS

### 3a. HH-pathway named single-value gaps (14 items)

13 of 14 are wired and match the originally-recommended value exactly; only benzo_a_pyrene's oral RfD
remains unwired.

| Item | Disposition | Evidence |
|---|---|---|
| benzo_a_pyrene (oral RfD) | STILL-OPEN | `substanceLibrary.ts:16`: `rfd_oral_mg_per_kg_bw_per_day: null`, unchanged. The approved 0.0003 mg/kg-bw/day candidate (HC + IRIS concordant) is still not wired, unlike its sibling PAHs. No note explains the omission (unlike dibenzo_a_h_anthracene's disclosed-null-by-design pattern). **Gate:** simple build-first wire (single concordant value, no judgment call) -- lowest-friction item in this entire re-triage. |
| naphthalene (oral RfD) | RESOLVED | Wired at 0.02, matches recommendation exactly. |
| pyrene (oral RfD) | RESOLVED | Wired at 0.03, matches recommendation exactly. |
| p_p_dichlorodiphenyltrichloroethane_ddt (RfD + SF) | RESOLVED | Wired at 0.0005 / 0.34, matches recommendation exactly. |
| tetrachloroethane_1_1_2_2 (RfD + SF) | RESOLVED | Wired at 0.05 / 0.2, matches recommendation exactly. |
| methoxychlor (oral RfD) | RESOLVED | Wired at 0.005, matches recommendation exactly. |
| mirex (oral RfD) | RESOLVED | Wired at 0.0002; the self-flagged ~40x logKow discrepancy (ATSDR/Niimi 1991 vs PubChem/HSDB Veith 1979) is preserved verbatim in the notes, exactly as the original finding anticipated. |
| pentachlorobenzene_1_2_3_4_5 (oral RfD) | RESOLVED | Wired at 0.0008, matches recommendation exactly. |
| trichlorobenzene_1_2_4 (oral RfD) | RESOLVED | Wired at 0.01, matches recommendation exactly. |
| benzene (RfD + SF) | RESOLVED | Wired at 0.004 / 0.083, matches recommendation exactly. |
| toluene, malathion, xylenes (oral RfD) | RESOLVED | malathion wired at 0.02 (single value). toluene wired at 0.0097 (HC) and xylenes at 0.013 (HC) -- the source-priority pick the 07-01 doc flagged as needed is resolved: both now cite "Seeded as the BC Protocol 1 v5.0 s4.4 Health Canada default," with the US EPA IRIS alternate (0.08 / 0.2) disclosed as a candidate option, not silently dropped. |
| chlorine_dioxide (oral RfD) | RESOLVED | Wired at 0.03; sources/notes correctly label it as an oral RfD (no residual inhalation-RfC mislabel visible in the current entry). |
| phosphine (oral RfD) | RESOLVED | Wired at 0.0003, matches recommendation exactly. |
| vanadium_pentoxide (oral RfD) | RESOLVED | Wired at 0.009 as its own key (`vanadium_pentoxide`), distinct from the elemental `vanadium` key -- matches recommendation exactly, including the "do NOT backfill vanadium" instruction. |

**3a total: 13 RESOLVED, 1 STILL-OPEN (benzo_a_pyrene oral RfD).**

### 3b. HH-pathway 37-substance excluded metal/inorganic cohort (architecture-gated)

The blocking prerequisite (Group 4's `'inorganic'` ContaminantClass) is confirmed added
(`types.ts:12`). With that unblocked, the cohort itself is now almost entirely wired:

- **"Clean, no overlap" sub-cohort (~19 substances):** ALL confirmed present as their own keys with
  `contaminantClass: 'inorganic'` and an approved wired RfD: bromate, chlorite_sodium_salt,
  monochloramine, perchlorate_clo4_and_perchlorate_salts, nitrate, nitrite, ammonium_sulfamate,
  fluorine_soluble_fluoride, white_phosphorus, sodium_azide, cyanogen, cyanogen_bromide,
  chlorine_cyanide, calcium_cyanide, potassium_cyanide, sodium_cyanide, chlorine, aluminum_phosphide,
  phosphine, chlorine_dioxide, vanadium_pentoxide. **RESOLVED.**
- **"Backfill candidates" sub-cohort:** the 07-01 doc worried these would silently mutate existing
  keys (mercury_inorganic, selenium, uranium, nickel). Confirmed they were instead wired as their OWN
  distinct keys -- `mercuric_chloride_hgcl2`, `selenious_acid`, `uranium_soluble_salts`,
  `nickel_chloride` / `nickel_soluble_salts` / `nickel_sulfate` (all three nickel salts kept
  separate, not collapsed into "pick ONE") -- each with a note explicitly stating it is a distinct
  salt entry and does NOT backfill the elemental/parent key. **RESOLVED** (more conservative than the
  proposal even asked for -- no backfill occurred at all, avoiding the sign-off risk the doc flagged).
- **"Do-NOT-conflate" sub-cohort (tetraethyl_lead, tributyltin_oxide_tbto, aluminum_phosphide):** all
  three confirmed wired as their own keys (tetraethyl_lead / tributyltin_oxide_tbto as
  `contaminantClass: 'organic'` per the recommended "pragmatic bucket" call; aluminum_phosphide as
  `'inorganic'`), each with an explicit "do NOT reuse the elemental [lead/tin/aluminum] entry" note.
  **RESOLVED**, matches the recommended classification exactly.
- **Cyanide dedup/speciation cluster:** confirmed ALL of cyanide_free, hydrogen_cyanide_and_cyanide_salts,
  silver_cyanide, potassium_silver_cyanide, copper_cyanide are wired as distinct own-key entries (not
  merged/deduped), each disclosing its distinctness from the generic `silver` / `copper` keys. The
  07-01 doc's "needs re-verification" flag on silver_cyanide is addressed by an explicit "live-verified
  2026-07-04" note. **RESOLVED** -- the wiring-gap and dedup-ambiguity concern is closed by giving every
  candidate its own key rather than picking a winner.
- **HITL-deferred sub-cohort:** `phenylmercuric_acetate` confirmed wired (own key,
  `contaminantClass: 'organic'`, RfD 0.00008, matches the 07-01 doc's implicit resolution and is also
  independently confirmed as decided in `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md` per the
  2026-07-11 completion-status doc). **RESOLVED.** `pcbs_non_coplanar` is confirmed NOT present as a
  key anywhere in `substanceLibrary.ts` -- still blocked on the PCB congener-grouping policy call.
  **SUPERSEDED** by 07-12 packet item A5 ("D3 PCB Option A -- closes total_pcbs_aroclor_1254 default +
  pcbs_non_coplanar alias").

**3b total: effectively the entire 37-substance cohort RESOLVED (wired, each on its own key, no
silent backfills) except pcbs_non_coplanar, which is SUPERSEDED by 07-12 packet item A5.** This is the
single largest resolution in this re-triage -- the 2026-07-04b/2026-07-04d build-first campaigns
appear to have wired essentially the entire architecture-gated cohort the 07-01 doc treated as
blocked-and-unstarted.

### 3c. Eco-pathway "text-data contradictions" (7 items)

**Architectural finding (load-bearing for this whole subsection and for 3d):** `ecoSeed.ts` exposes
`resolveEcoSeed(substanceKey, pathway, inputKey, frameId, receptor)`, which is actively called at
runtime by the live components `EcoDirectEqPCalculator.tsx` and `EcoFoodBSAFCalculator.tsx`. It reads
`eco_values.json` directly and independently of the static `fcv_ug_per_L` /
`trv_eco_mg_per_kg_bw_day` fields in `substanceLibrary.ts`. A substance is therefore functionally
wired in the eco calculators today whenever (a) it has a `key` in `substanceLibrary.ts` (selectable in
the UI) and (b) `eco_values.json` has an eligible catalog row. The 07-01 doc's "field is null" framing
undercounts what is actually live.

| Item | Disposition | Evidence |
|---|---|---|
| chloroform (fcv_ug_per_L) | RESOLVED | Key exists in substanceLibrary.ts (L1533); single approved row (`pv-eco-chloroform-direct-fcv-ccme`, 1.8 ug/L, Canada_federal) -- single-row-safe, no receptor ambiguity for the eco-direct pathway. |
| chromium (trv_eco_mg_per_kg_bw_day) | RESOLVED | Key exists (`chromium`, generic, L1479). 2 approved FCSAP rows (2.4 mammal / 2.66 bird), both Canada_federal. `EcoFoodBSAFCalculator.tsx` exposes a live "Wildlife receptor (TRV basis)" dropdown (`data-testid="ecofood-receptor-select"`, defaults to mammal, offers bird when `resolveEcoSeed` returns non-null for it) -- the receptor pick is a real, user-facing UI control today, not an engineering gap. |
| benz_a_anthracene (trv_eco_mg_per_kg_bw_day) | RESOLVED | Key exists; single approved row (0.107), dynamically served. |
| chlordane_technical (fcv_ug_per_L) | RESOLVED | Key exists; single approved row (0.0043 ug/L), dynamically served. |
| polychlorinated_biphenyls_total_pcbs (fcv_ug_per_L) | RESOLVED | Key exists; single approved row (0.014 ug/L), dynamically served. |
| pyrene (trv_eco_mg_per_kg_bw_day) | RESOLVED | Key exists; generic-bird row (20.5) dynamically served. |
| p_p_dichlorodiphenyltrichloroethane_ddt (fcv_ug_per_L) | RESOLVED | Key exists; single approved row (0.001 ug/L), dynamically served. |

**3c total: 7 RESOLVED** (all via the dynamic resolver architecture; the "static field is null" framing
of the original text-data-contradiction finding no longer describes a functional gap).

### 3d. Eco-pathway unwired-approved gaps (~30 items)

- **Single-row-safe cohort (26 substances):** benzene, barium, chromium_hexavalent, azinphos_methyl,
  biphenyl, bromoform, bromophenyl_phenyl_ether_4, butyl_benzyl_phthalate_bbp, carbaryl,
  carbon_tetrachloride, chlorpyrifos, demeton, dibutyl_phthalate_dbp, dichlorobenzene_1_2,
  dichlorobenzene_1_3, dichlorobenzene_1_4, diethyl_phthalate_dep, endosulfan, heptachlor,
  heptachlor_epoxide, hexachlorocyclohexane_gamma, tetrachloroethylene, trichloroethylene,
  tetrachloroethane_1_1_2_2, trichloroethane_1_1_1, thallium, uranium. **RESOLVED** -- all confirmed
  present as `substanceLibrary.ts` keys; via the same dynamic-resolver architecture as 3c, each is
  functionally wired in the live eco calculators as long as its catalog row remains eligible (approved
  rows for all 26 were already confirmed by the source audits and no catalog row has been retracted).
- **Multi-row-pick cohort (4 items):** diazinon, endosulfan_alpha, endosulfan_beta, ethylbenzene --
  each has a key. diazinon and endosulfan_alpha/beta each have 2 eco_values.json rows, but they are
  NOT a genuine tie: `ecoSeed.ts`'s `ECO_SOURCE_PREFERENCE` table ranks the EPA ESB source (0) above
  NRWQC (1) for the same eco-direct slot, so `resolveEcoSeed()` deterministically picks the ESB row
  every time (diazinon 0.1699; endosulfan_alpha/beta both 0.056, concordant with the NRWQC alternate
  regardless). ethylbenzene has only 1 fcv row and only 1 trv row in the current catalog -- the
  07-01 doc's "trv side needs the same pick" concern describes a competing row that does not currently
  exist. **RESOLVED, all 4** -- no blocked tie in any of them today.
- **naphthalene (trv_eco_mg_per_kg_bw_day):** 2 approved rows (14.3 mammal / 7.7 bird), both
  Canada_federal/FCSAP -- a genuine same-jurisdiction, same-source-preference tie (unlike diazinon).
  **RESOLVED via the live receptor selector** (see mechanism below), same mechanism as chromium. The
  static notes calling this "pending source-backed ecological values" are stale text (a residual,
  out-of-scope documentation nit, not a functional gap).

**Receptor-selection mechanism (confirmed):** `EcoFoodBSAFCalculator.tsx` has a real, first-class UI
control -- a "Wildlife receptor (TRV basis)" `<select>` (`data-testid="ecofood-receptor-select"`)
bound to `useState<EcoReceptor>('mammal')` (mammal is the default). `availableReceptors` is computed
by calling `resolveEcoSeed(substanceKey, 'eco-food-bsaf', 'trv_eco_mg_per_kg_bw_day', jurisdiction, r)`
for each of `['mammal','bird']` and only offering receptors that return non-null, so for chromium and
naphthalene both options appear in the dropdown and either deterministically resolves the matching
catalog row via `species_groups?.includes(receptor)`. The "receptor pick" the 07-01 doc asked for is
therefore a live, user-facing selection the QP already makes today (defaulting to mammal), not an
engineering gap or blocked feature. A user who never touches the dropdown gets the mammal value by
default and never sees the bird value unless they select it -- worth noting as a UX/defaults
observation, but not an open HITL decision gate.

**3d total: 26 + 4 + 1 = 31 items, all RESOLVED.**

### 3e. PHC family and lmw_pahs (whole-substance gap)

| Item | Disposition | Evidence |
|---|---|---|
| lmw_pahs, phc_f1, phc_f2, phc_f3, phc_f4, total_phcs (6 keys) | STILL-OPEN | Confirmed via grep: none of these appear as a `key:` anywhere in `substanceLibrary.ts`. Confirmed via `eco_values.json`: approved FCSAP catalog rows DO exist for at least lmw_pahs (mammal 65.6 / bird 7.7, both promoted-to-approved 2026-06-19) and total_phcs (mammal 210, approved) -- so the data is ready, but because no `substanceLibrary.ts` key exists, the dynamic-resolver architecture that closed most of 3c/3d does NOT apply here: there is nothing for the calculator UI to select, so the resolver is never invoked. **Gate unchanged from 07-01:** needs a decision on whether/how to add these keys (aggregate PAH/PHC fraction handling may double-count against individual congeners already in the library). |

**3e total: 6 substances, STILL-OPEN (unchanged from 07-01).**

### Group 3 combined total

| Sub-group | RESOLVED | SUPERSEDED | STILL-OPEN |
|---|---|---|---|
| 3a (14 named) | 13 | 0 | 1 (benzo_a_pyrene RfD) |
| 3b (37-substance cohort) | 36 | 1 (pcbs_non_coplanar -> A5) | 0 |
| 3c (7 text-contradictions) | 7 | 0 | 0 |
| 3d (~31 unwired gaps) | 31 (4 provisional pending receptor-UI check) | 0 | 0 |
| 3e (6 PHC/lmw_pahs) | 0 | 0 | 6 |
| **Group 3 total** | **87** | **1** | **7** |

---

## Group 4: CLASSIFICATION

| Item | Disposition | Evidence |
|---|---|---|
| ContaminantClass architecture decision (add `'inorganic'`) | RESOLVED | `types.ts:5-12`: union is now `'organic' \| 'organic-PAH' \| 'organic-halogenated' \| 'divalent-metal' \| 'methyl-Hg' \| 'metalloid' \| 'inorganic'` -- exactly the recommended Option B. `derivations.ts` has zero references to the literal string `'inorganic'` and no exhaustive switch on `contaminantClass` -- only explicit `'organic-PAH'` and `'methyl-Hg'` branches exist, confirming the "falls through the default path, zero derivations.ts change needed" claim was correct and implemented as specced. |
| maneb (Mn disclosure) | STILL-OPEN | `substanceLibrary.ts` entry for maneb: classed `organic`, notes discuss only the abs_dermal conservative-default rationale; no mention of manganese, Mn, or the dithiocarbamate-chelate distinction anywhere in the entry. **Gate unchanged:** classification judgment call (keep organic with Mn disclosure, or reclassify) still needed. |
| zineb (informational, already resolved per 07-01) | RESOLVED | Confirmed wired: `key: 'zineb'`, `contaminantClass: 'organic'`, `rfd_oral_mg_per_kg_bw_per_day: 0.05`, sourced to US EPA IRIS `pv-iris-zineb-hh-direct-rfd`. Matches the 07-01 doc's own "already resolved" framing exactly. |

**Group 4 total: 2 RESOLVED, 0 SUPERSEDED, 1 STILL-OPEN (maneb Mn disclosure/classification call).**

---

## Group 5: PROVENANCE/TEXT

| Item | Disposition | Evidence |
|---|---|---|
| Truncated `sources` strings (~36 entries) | RESOLVED (spot-check, 7/7 clean; not exhaustively re-enumerated) | Spot-checked alpha_hexachlorocyclohexane_alpha_hch, azinphos_methyl, bromoform, carbon_tetrachloride, chlorpyrifos, thallium, uranium -- all end in a complete citation/CAS/value clause; none truncated mid-word. carbon_tetrachloride's string even explicitly notes a prior-truncation error was corrected. High confidence the sweep completed; a full 36-entry mechanical re-enumeration (including the ~10 originally-unnamed members) was not performed in this pass. |
| 1_4_dioxane (RfD+SF dual-source-id gap) | RESOLVED | sources string now embeds both literal ids: `pv-iris-1_4_dioxane-hh-direct-rfd / src-us-epa-iris-rfd-table-live` and the matching `-sf` id. |
| 2_4_6_trinitrotoluene_tnt (dual-source-id gap) | RESOLVED | Both literal RfD and SF parameter-value ids present in the sources string. |
| isophorone (dual-source-id gap) | RESOLVED | Both literal RfD and SF parameter-value ids present. |
| bis_2_ethylhexyl_phthalate_dehp (dual-source-id gap) | RESOLVED | Both literal RfD and SF parameter-value ids present. |
| formaldehyde (stale "candidates approved" wording) | RESOLVED | Notes now read "oral RfD candidate approved" (singular, correct), not the old "RfD/SF candidates" plural. `sf_oral` confirmed still null; no leftover SF-plural template text remains. |
| Disclosure-only additions (6 entries: total_pcbs_aroclor_1254, chromium_trivalent, maneb, benzene, tetrachloroethylene, trichloroethylene) | PARTIALLY RESOLVED -- 4 of 6 done, maneb + the benzene/PCE/TCE cross-reference STILL-OPEN | total_pcbs_aroclor_1254 abs_dermal disclosure: RESOLVED (explicit RAGS Part E citation now in notes). chromium_trivalent: RESOLVED-BY-SUPERSESSION -- the underlying Group 2 value itself was corrected to the class default (0.001), so there is no longer a deviation to disclose. maneb: STILL-OPEN (see Group 4, same gate). benzene / tetrachloroethylene / trichloroethylene: STILL-OPEN -- none of the three entries' notes mention "VOC" or cross-reference the VOC-RAF rationale stated elsewhere in the file (formaldehyde's note already contains the reciprocal "cf. benzene/TCE/PCE" language, but the three named substances were never given the matching inline note back). **Gate:** low-severity documentation-only fix, no value change, add the cross-reference note to all 3. |

**Group 5 total: 6 RESOLVED, 0 SUPERSEDED, 1 STILL-OPEN (maneb + benzene/PCE/TCE cross-reference
note -- both low-severity, documentation-only, no numeric change required).**

**A7/A3 supersession check (07-12 packet):** neither A7 ("357 P28 verify-vs-primary sweep") nor A3
("41 IRIS needs_review alternates") supersedes any Group 5 item. A7 targets Protocol-28-compiled
catalog rows verified against primary literature -- a catalog-layer QA task -- while Group 5's
truncated-sources and dual-source-id items are `substanceLibrary.ts`-layer text-completeness issues
for a different population (the 2026-06-19 eco-registry pilot/fan-out batch's PubChem/ATSDR/HSDB
identity citations). A3 targets `qa_status=needs_review` catalog rows needing a reject/retain/
set-default ruling -- also a different population. No overlap found.

---

## Combined totals across all 5 groups

| Group | RESOLVED | SUPERSEDED | STILL-OPEN |
|---|---|---|---|
| 1. Value corrections | 8 | 3 | 0 |
| 2. abs_dermal anomalies | 8 | 0 | 2 |
| 3. Build-first wiring gaps | 87 | 1 | 7 |
| 4. Classification | 2 | 0 | 1 |
| 5. Provenance/text | 6 | 0 | 1 |
| **TOTAL** | **111** | **4** | **11** |

## STILL-OPEN items requiring an owner decision (all 11, consolidated)

1. **copper oral RfD default** -- rule among HC 0.426 / P28 0.09 / P28-water 0.141. SUPERSEDED-tracking:
   07-12 packet item A4.
2. **benzo_a_pyrene oral SF anchor + ADAF scenario** -- which candidate (IRIS 2.0 ADAF-adjusted vs HC
   1.289) becomes current_default. SUPERSEDED-tracking: 07-12 packet item A6.
3. **total_pcbs_aroclor_1254 / pcbs_non_coplanar PCB-family default ruling** ("D3 PCB Option A").
   SUPERSEDED-tracking: 07-12 packet item A5.
4. **pyridine abs_dermal:** VOC RAF (0.03) vs organic SVOC default (0.1) -- boundary case explicitly
   flagged in-file as awaiting review. NOT in the 07-12 packet -- net-new open item surfaced by this
   re-triage.
5. **PAH-class abs_dermal cohort:** should the 11 PAH entries at 0.13 be updated to match
   naphthalene's confirmed-correct 0.148 (HC TRV v4.0/v3.0 Table 5, Moody et al. 2007)? NOT in the
   07-12 packet -- net-new open item.
6. **benzo_a_pyrene oral RfD (Group 3a):** simplest item in this entire re-triage -- single
   concordant approved value (0.0003, HC + IRIS agree), currently unwired (`rfd_oral` still null).
   Recommend wiring build-first with no further owner input needed, since both approved sources agree.
7. **pcbs_non_coplanar wiring** -- blocked on item 3 above (PCB congener-grouping policy).
8. **PHC family + lmw_pahs (6 keys):** whole-substance gap, no library entry exists at all despite
   approved catalog rows for at least 2 of the 6. Needs a decision on whether/how to add these keys
   given aggregate-fraction double-counting risk against individual PAH/PHC congeners already in the
   library.
9. **maneb classification/disclosure** -- keep `organic` with an Mn-content disclosure note, or
   reclassify given its manganese-coordinated dithiocarbamate chemistry.
10. **benzene / tetrachloroethylene / trichloroethylene abs_dermal cross-reference note** --
    documentation-only, no value change; add the inline VOC-RAF rationale cross-reference already
    present on formaldehyde's entry.

**Informational, not owner-gated (confirmed during this re-triage, no action needed):**
`EcoFoodBSAFCalculator.tsx` DOES expose a live mammal/bird receptor selector
(`data-testid="ecofood-receptor-select"`, defaults to mammal) for every receptor-differentiated
substance (chromium, naphthalene, benzo_a_pyrene eco-food TRV, etc.) -- confirmed by direct code
read. All Group 1b/3c/3d items that depended on this mechanism are fully RESOLVED, not provisional.
The only residual note is a UX observation (mammal is the silent default when a user does not
interact with the dropdown), not a decision gate.

*Report-only. No `SUBSTANCE_LIBRARY`, catalog, or provenance file was modified in the production of
this re-triage. All evidence cites file/line or grep results against the worktree state as of
2026-07-13, commit 6995bc7 on branch docs/mo-top50-2026-07-13.*
