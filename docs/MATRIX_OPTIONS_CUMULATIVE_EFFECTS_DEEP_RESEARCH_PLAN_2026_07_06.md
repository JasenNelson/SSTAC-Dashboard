# Deep Research Plan -- Cumulative / Additive Toxicity Methods for PCBs, Dioxins/Furans, and PAHs

Purpose: brief for a SEPARATE Google Gemini Deep Research session (owner runs the Gemini DEEP RESEARCH
tool manually). It scopes what to research so the results can be promoted into the Matrix Options
catalog with proper provenance. It is grounded in the CURRENT catalog state (Section A) so the research
targets real gaps, not things already wired.

Owner framing (2026-07-06): some jurisdictions' thresholds/standards/guidelines include CUMULATIVE
effects from PCBs (and analogously dioxins/furans and PAHs). We need to (1) identify whether that
applies to the TRVs in our catalog, and (2) determine HOW the individual substances are combined --
in some cases an equivalency factor plus a quotient/summation approach that is highly specific and does
NOT include all congeners.

---

## Section A -- Current catalog state (the grounding; do not re-research this)

Every wired, APPROVED TRV in the catalog for these groups is an INDIVIDUAL-substance or named-mixture
mass-based value. No potency-weighted cumulative method is implemented. Specifics:

**PCBs (6 substance_keys, all individual/mixture, mass-based):**
- `total_pcbs_aroclor_1254`: HC non-dioxin-like oral TDI 1.0E-05 mg/kgBW-day (Aroclor 1254 basis) +
  IRIS Aroclor 1254 RfD; carcinogenic SF (2 per mg/kg-day) + IUR (1E-04 per ug/m3) BORROWED from the
  generic IRIS "PCBs" CASRN 1336-36-3 (IRIS never assessed Aroclor 1254 carcinogenicity separately).
- `polychlorinated_biphenyls_total_pcbs`: BC Protocol 28 mass-based RfD 1.30E-04 mg/kg/d (CAS
  1336-36-3); eco FCV 0.014 ug/L from EPA NRWQC (the ONE live summation value -- "sum of all
  congener/isomer/homolog/Aroclor analyses", but mass-based, NOT TEQ). Flagged "do not merge" with
  total_pcbs_aroclor_1254 (two parallel total-PCB keys -- see the PCB-consolidation decision doc).
- `pcbs_non_coplanar`: HC non-coplanar congener-class provisional TDI 1.0E-05.
- `aroclor_1016` (IRIS 7E-05), `polychlorinated_biphenyls_pcbs` (generic IRIS).

**Dioxins / furans:**
- `2_3_7_8_tetrachlorodibenzo_p_dioxin` (TCDD): IRIS oral RfD 7E-10 mg/kg-bw/day.
- `hexachlorodibenzo_p_dioxin_..._HxCDD_mixture`: IRIS SF 6200 (named 2-congener mixture, single number).
- GAP: NO polychlorinated dibenzofuran (PCDF) congeners; NO TEF/TEQ table; NO "total dioxin/furan TEQ".

**PAHs:**
- Individual PAHs wired with own TRVs (e.g. `benzo_a_pyrene` oral SF 2.0 IRIS 2017 ADAF-adjusted;
  `naphthalene` oral RfD 0.02).
- Eco-only group surrogates `lmw_pahs` / `hmw_pahs` (FCSAP ERA Module 7 2021; a coarse LMW/HMW split,
  NOT RPF/BaP-equivalency). No human-health group PAH TRV.

**Cumulative methods DOCUMENTED but NOT promoted (the two concrete targets):**
1. HC dioxin-like PCB oral TDI = 2.3E-09 mg TEQ/kgBW-day (provisional) -- exists only in
   `matrix_research/reference_catalog/protocol28_pcb_direct_source_verification_packet_2026_05_25.md`;
   no substance_key / parameter_value_id anywhere in the JSON catalog.
2. HC PQRA v3 BaP-equivalent Relative Potency Factor (RPF) method for carcinogenic PAHs -- documented in
   `source_leads/wqciu_reference_leads_2026_05_23.json` (lead `wqciu-eq-3-4-bap-equivalent`,
   promotion_status `needs_exact_source_locator`); no RPF value on any substance, no equation wired.
- `equations.json` `hazardQuotient` is a SINGLE-substance dose/RfD HQ, not a multi-substance hazard
  index. No TEF/TEQ/RPF/summation mechanism exists in equations.json.

---

## Section B -- Gemini Deep Research prompt (paste this)

> Research how Canadian and US contaminated-sites / sediment frameworks handle CUMULATIVE (additive)
> toxicity for three chemical groups -- polychlorinated biphenyls (PCBs), polychlorinated dibenzo-
> dioxins/dibenzofurans (PCDD/PCDF), and polycyclic aromatic hydrocarbons (PAHs) -- and produce the
> reference tables needed to implement each method. Cover these frameworks explicitly: British Columbia
> Contaminated Sites Regulation + BC Protocol 1 and Protocol 28; CCME (Canadian sediment/soil quality
> guidelines); Health Canada (FCSAP ERA guidance + PQRA v3 + Toxicological Reference Values v4.0/2025);
> US EPA (IRIS, NRWQC, Regional Screening Levels); and Ontario MECP.
>
> For EACH of the three groups, answer:
> 1. WHICH of the listed frameworks require or recommend a cumulative/additive treatment (vs treating
>    each substance individually), and for what medium (soil, sediment, water, biota/tissue)?
> 2. The COMBINATION METHOD used, precisely:
>    - PCBs: distinguish (a) NON-dioxin-like / total PCBs -- is it a mass-based sum of Aroclors or
>      congeners, and against what criterion? -- from (b) DIOXIN-LIKE PCBs -- the Toxic Equivalency
>      Factor (TEF) / Toxic Equivalency (TEQ) approach. Give the exact TEF scheme used (e.g. WHO 2005
>      mammalian TEFs), the list of the 12 dioxin-like PCB congeners included, each congener's TEF, the
>      reference compound (2,3,7,8-TCDD), and the TEQ summation formula. Confirm the Health Canada
>      dioxin-like PCB oral TDI expressed as mg TEQ/kgBW-day and give its exact source + PDF locator.
>    - PCDD/PCDF (dioxins/furans): the WHO TEF scheme (which edition -- 1998 vs 2005) for the 17
>      2,3,7,8-substituted PCDD/PCDF congeners; the full congener-to-TEF table; the reference
>      (2,3,7,8-TCDD); the TEQ summation formula; and which frameworks mandate TEQ vs a single-congener
>      value.
>    - PAHs: the Benzo[a]pyrene-equivalent / Relative Potency Factor (RPF) or Potency Equivalency Factor
>      (PEF) approach. Give the RPF/PEF table (which carcinogenic PAHs are included, each factor), the
>      reference (benzo[a]pyrene), and the summed-BaP-equivalent formula. Cover BOTH the Health Canada
>      PQRA v3 RPF set AND any US EPA RPF set (e.g. EPA 2010 RPFs), noting differences. State explicitly
>      which PAHs are EXCLUDED (non-carcinogenic PAHs).
> 3. Whether the standard is applied as (a) a SUMMED equivalent concentration compared to a single
>    reference-substance criterion, or (b) a HAZARD INDEX = sum of individual hazard quotients. Be
>    specific per framework.
> 4. Congener/analyte SCOPE: exactly which congeners/analytes are included vs excluded, and whether the
>    method depends on a site-specific congener profile.
> 5. For every numeric factor, TDI/RfD/SF, or criterion you report, give the AUTHORITATIVE primary
>    source and an exact locator (document title, year, table/page). Flag anything provisional or
>    superseded, and note edition dates (assessment vintage vs publication date -- they differ).
>
> Deliver the results as structured tables (one per method) plus a short narrative per framework.

---

## Section C -- Deliverable format (so results are catalog-ready)

Ask Gemini to return, for each cumulative method, a table the owner can promote into the catalog with
the standard needs_review -> owner-attested promotion discipline (per-source provenance, exact locator):

| Field | Example (dioxin-like PCB TEQ) |
|-------|-------------------------------|
| Method name | WHO-2005 TEF / TEQ for dioxin-like PCBs |
| Reference substance | 2,3,7,8-TCDD |
| Included congeners + factor | PCB-77 = 0.0001, PCB-126 = 0.1, PCB-169 = 0.03, ... (full list) |
| Excluded | non-dioxin-like congeners (handled by mass-based total) |
| Combination formula | TEQ = sum(C_i x TEF_i); compare to TCDD-based TDI |
| Group TRV | HC dioxin-like PCB oral TDI = 2.3E-09 mg TEQ/kgBW-day (confirm) |
| Authoritative source + locator | HC TRV v4.0, Table 1, p.41 (confirm current edition/locator) |
| Frameworks requiring it | (list) |

Then a follow-up implementation session can decide catalog representation: likely a new equation in
`equations.json` (TEF/RPF-weighted summation), TEF/RPF factor tables as reference data, and per-congener
or per-method substance_keys -- with the "add total-PCB frameworks as a selectable OPTION, making clear
which approach maps to which threshold/standard/guideline" requirement the owner set on 2026-07-06.

Scope note: this plan defines the RESEARCH; no catalog values are changed by it. Implementation
(promoting TEF/RPF tables + wiring the summation equations + the option-selection UX) is a later,
owner-attested lane. Ties to the PCB-key consolidation decision (Option A) and the Ontario MECP 2026
TRVs ingestion backlog item.
