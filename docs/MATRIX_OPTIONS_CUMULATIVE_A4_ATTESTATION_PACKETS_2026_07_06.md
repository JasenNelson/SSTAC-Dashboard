# Matrix Options -- Cumulative-Effects Lane A4 Owner-Attestation Packets (2026-07-06)

Companion to `MATRIX_OPTIONS_CUMULATIVE_EFFECTS_IMPLEMENTATION_PLAN_2026_07_06.md` (step A4) and
`MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`. Plain ASCII.

**STATUS: DRY-RUN / DECISION PACKETS ONLY.** Nothing here promotes, mutates, or re-ranks any catalog
value. AI does not write verdicts or promote the default-policy library (L1 CLAUDE.md). Each packet ends
at OWNER inline attestation; the promote-script `--apply` step is the owner's, run only after sign-off.

Context: this session shipped the cumulative-effects INFRASTRUCTURE as two PRs (A1 reference tables:
`tefTable.ts` / `rpfTable.ts` / `adafTable.ts`; A3a headless reducers: `cumulative.ts`). The three
decisions below are the value/representation calls that infrastructure surfaces but must NOT decide
autonomously.

---

## Packet 1 -- Dioxin / DL-PCB TEQ oral TDI = 2.3e-9 mg TEQ/kgBW-day (PROMOTE candidate)

**Primary source (now confirmed by direct PDF read, 2026-07-06):** HC TRV v4.0 (2025), extracted from the
PDF via `scripts/matrix-options/hc_trv_v4_table4_devito_tef_extract.py` provenance run. The value appears
for BOTH:
- `Polychlorinated dibenzo-p-dioxins/dibenzofurans (PCDDs/PCDFs)` -- Oral TDI (provisional)
  `2.3E-09 mg TEQ/kg-day BW`; basis Faqi and Chahoud 1998 (Wistar-rat developmental); WHO 2002b.
- `Polychlorinated biphenyls (PCBs) (dioxin-like, i.e. coplanar)` -- Oral TDI (provisional)
  `2.3E-09 mg TEQ/kg-day BW`; "should be evaluated with PCDDs/PCDFs using appropriate TEFs (see Table 4)".

So the SAME TEQ-anchored TDI governs PCDD/PCDF and the coplanar (dioxin-like) PCBs, applied to a
TEQ computed with the DeVito-2024 TEFs now in `tefTable.ts` (who-2022-devito-2024 edition, verified).

**Representation -- OWNER DECISION.** Recommended (AI recommendation, owner rules):
- A dedicated `substance_key` `dioxin_teq` (or `dioxin_like_teq`) with `input_key`
  `oral_tdi_teq_mg_per_kg_bw_day`, value `2.3e-9`, unit `mg TEQ/kgBW-day`, `qa_status: needs_review`,
  `default_status: available_option`, source = HC TRV v4.0 (2025) / Faqi and Chahoud 1998.
- Rationale for a dedicated TEQ key (vs annotating `pcbs_non_coplanar`): the unit is `mg TEQ/kg`, a
  TEQ-weighted quantity, NOT a raw mass concentration -- conflating it with a mass-based PCB key invites
  a unit/units-of-analysis error. The TEQ key is the compare-standard anchor for `computeTEQ` output.
- Alternative the owner may prefer: annotate the existing dioxin key
  (`2_3_7_8_tetrachlorodibenzo_p_dioxin`, which already carries the EPA IRIS RfD 7e-10) with an HC TEQ
  TDI row. (Not recommended -- mixes the TCDD single-congener RfD with the mixture TEQ TDI.)

**Dry-run (illustrative catalog row -- NOT applied):**
```
{ substance_key: 'dioxin_teq', input_key: 'oral_tdi_teq_mg_per_kg_bw_day',
  value: 2.3e-9, unit: 'mg TEQ/kgBW-day', pathway: 'hh-toxicity-value',
  qa_status: 'needs_review', default_status: 'available_option',
  source: 'HC TRV v4.0 (2025), provisional; Faqi & Chahoud 1998 (via WHO 2002b)' }
```
Owner attests (a) the value + locator, (b) the key/representation, (c) whether it becomes a
`current_default`. Then the owner runs the promote-script `--apply`.

---

## Packet 2 -- benzo_a_pyrene oral SF: anchor + ADAF methodology (NOT a bare number pick)

**REFRAMED 2026-07-07 (ADAF research, primary-verified -- see
`docs/MATRIX_OPTIONS_ADAF_BAP_EXPLAINER_2026_07_07.md`).** The earlier "pick HC 1.289 vs EPA 2.0"
framing was methodologically WRONG: those two values sit at DIFFERENT processing stages and are not
interchangeable. The three current values are:
- **HC TRV v4.0 (2025) = `1.289 (mg/kgBW-day)^-1`** -- derived from ADULT bioassay data (B6C3F1 mouse
  diet, BMDL10 + allometric scaling), NO lifetime-ADAF weighting baked in. Structurally analogous to
  EPA's adult 1.0, NOT its 2.0. **VERIFIED-primary 2026-07-07** by direct read of the HC v4.0 PDF, p.20,
  which states verbatim on the BaP oral SF row: "given that BaP is known to have a mutagenic mode of
  action, HC recommends applying ADAFs to the oral SF when assessing risk associated with early life
  exposures at federal contaminated sites" (and p.6 revisions: v4.0 ADDED this ADAF note -- it was NOT
  in v3.0). So: for an ADULT-only scenario 1.289 is used AS-IS (ADAF = 1); for an early-life-inclusive
  scenario ADAFs (10/3/1 per HC 2013b) are applied ON TOP. HC provides no pre-baked lifetime equivalent
  to EPA's 2.0.
- **EPA IRIS adult = `1.0 (mg/kg-day)^-1`** -- adult-only, NON-ADAF-embedded (apply ADAF on top).
- **EPA IRIS lifetime = `2.0 (mg/kg-day)^-1`** -- ADAFs ALREADY BAKED IN (0-70yr duration-weighted);
  do NOT apply ADAF again. Pre-2017 `7.3` is superseded.

**OWNER DECISIONS (reframed):**
1. **Scenario tagging (recommended, low-risk, metadata only):** tag each row with its ADAF stage --
   `1.289` = "HC v4.0, adult-base, apply ADAF on top"; `1.0` = "EPA IRIS adult, apply ADAF on top";
   `2.0` = "EPA IRIS lifetime, ADAF-embedded, do NOT re-apply". Recommended: APPROVE.
2. **current_default = choose an ANCHOR + its correct ADAF treatment (NOT just a number):** the valid,
   like-for-like comparisons are HC-1.289 (+ADAF-on-top) vs EPA-1.0 (+ADAF-on-top) [both adult-base], OR
   HC-1.289+ADAF vs EPA-2.0 [both early-life-inclusive]. Comparing HC-1.289 directly against EPA-2.0 is
   an apples-to-oranges error (3x-10x for a child window). The pick is a Protocol 1 policy call (owner
   rules); AI does not pick -- but the chosen anchor MUST be stored with its ADAF-treatment tag so the
   calculator pairs it correctly.

**Calculator status (A3a, verified correct 2026-07-07):** `computeBaPeq`'s ADAF logic is right -- ADAF
applied ON TOP when the caller asks (correct for HC-1.289 / EPA-1.0), and a warning to NOT double-count
against an ADAF-embedded anchor (EPA-2.0). The anchor<->applyAdaf pairing is the caller's (A3b UI)
responsibility; a UI test must force `applyAdaf=false` when the anchor is EPA-2.0. NOTE the documented
SINGLE-BIN scope: `computeBaPeq` applies one age bin's ADAF; a full lifetime (0-70yr) estimate needs
per-age-window duration-weighting by the caller (contract clarified in `cumulative.ts` 2026-07-07).

Ties to the HELD decision in `MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md` Lane 3.

---

## Packet 3 -- PCB policy: Option A (total-default; congener/Aroclor alternatives; never additive)

**Research backing (deep-research + spec, 2026-07-06):** Health Canada derives its non-DL PCB oral TDI
by taking the Aroclor-1254 TDI and applying a **50% apportionment** (Baars et al. 2001) so the non-DL
mass fraction (scored via the ICES-7 congeners: PCB-28/52/101/118/138/153/180) and the dioxin-like
fraction (scored via TEQ, Packet 1) are assessed CONCURRENTLY WITHOUT DOUBLE-COUNTING. BC and Ontario
likewise require BOTH a mass-based total-PCB check AND a separate dioxin-like TEQ check -- never
conflated.

**OWNER DECISION:** adopt Option A from `MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`:
- `total_pcbs_aroclor_1254` stays the mass-based non-DL default (HC 1e-5; EPA Aroclor-1254 RfD 2e-5;
  borrowed IRIS total-PCB SF 2.0 -- all corroborated, spec Section 5).
- congener-sum / Aroclor-sum are ALTERNATIVES, never additive to the default.
- the dioxin-like fraction is the SEPARATE TEQ key (Packet 1), 50%-apportioned.
- `pcbs_non_coplanar` disposition + `phenylmercuric_acetate` ContaminantClass remain owner calls (see
  the owner-decisions doc).

AI does not consolidate keys or re-rank the library. Owner rules; then the owner runs any promote/merge
script `--apply`.

---

## What the owner actually needs to do (summary)

| Packet | Decision | AI recommendation | Risk |
|---|---|---|---|
| 1 | Promote dioxin TEQ TDI 2.3e-9 + pick representation | dedicated `dioxin_teq` key, needs_review | value now primary-confirmed |
| 2a | Scenario-tag the two EPA BaP SF rows | APPROVE (metadata only) | low |
| 2b | current_default = ANCHOR + its ADAF treatment (HC 1.289 / EPA 1.0 = adult-base + ADAF-on-top; EPA 2.0 = ADAF-embedded, no re-apply) -- NOT a bare number pick | owner policy call | medium |
| 3 | Adopt PCB Option A | ADOPT (research-backed) | low-medium |

Nothing above is applied. Each row stays `needs_review` / owner-attested per the dashboard rules.
