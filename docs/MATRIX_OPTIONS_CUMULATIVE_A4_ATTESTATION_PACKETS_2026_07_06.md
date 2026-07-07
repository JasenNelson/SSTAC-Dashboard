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

## Packet 2 -- benzo_a_pyrene EPA "2.0" oral SF: scenario-tag + current_default pick

**Resolved (A2, 2026-07-06):** the catalog's two benzo_a_pyrene sf_oral rows are BOTH legitimate current
values, not a data error:
- HC TRV v4.0 (2025) = `1.289 (mg/kgBW-day)^-1` (verified from the HC PDF; HC 2016 / Culp 1998 / Moffat 2015).
- EPA IRIS = `2.0 (mg/kg-day)^-1` = the LIFETIME oral CSF with ADAFs BAKED IN (EPA 2005 supplemental
  guidance; BaP mutagenic MoA). IRIS also lists `1.0` (adult-only). Pre-2017 `7.3` is superseded.

**OWNER DECISIONS (two):**
1. **Scenario tagging (recommended, low-risk):** tag each EPA row with its scenario so the two IRIS
   numbers are never confused -- `2.0` = "IRIS lifetime, ADAF-embedded"; `1.0` = "IRIS adult-only". This
   is metadata only (no value change). Recommended: APPROVE.
2. **current_default pick between HC 1.289 and the EPA value:** a policy call (Protocol 1 hierarchy:
   HC-default vs EPA-when-newer/more-defensible). AI does not pick. Owner rules.

**Calculator implication (already encoded in A3a, no action needed):** `computeBaPeq`'s ADAF option must
NOT be applied when the downstream cancer standard is anchored on the EPA 2.0 SF (ADAFs already embedded)
-- doing so double-counts. Anchoring on 1.0 (adult) or 1.289 (HC) and THEN applying ADAFs is the
alternative. `cumulative.ts` `computeBaPeq` surfaces this in its ADAF warning; the anchor-vs-ADAF choice
is the caller's (i.e. the eventual A3b UI + the owner's default pick).

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
| 2b | current_default: HC 1.289 vs EPA | owner policy call | medium |
| 3 | Adopt PCB Option A | ADOPT (research-backed) | low-medium |

Nothing above is applied. Each row stays `needs_review` / owner-attested per the dashboard rules.
