<!-- Generated 2026-07-01 by the mo-audit-and-excluded-proposal workflow (24 Sonnet agents, adversarial-verify). REPORT/PROPOSAL ONLY -- no library/catalog mutation. HITL review required before any fix or wiring. -->

# Proposal Packet: Wiring the 37 Excluded Metal/Inorganic Matrix-Options Substances

**Status: PROPOSAL ONLY. Nothing in this packet has been wired into `SUBSTANCE_LIBRARY`.**

## Intro

These 37 substances all have an **approved oral RfD** in the matrix-options catalog (verified clean, no CAS collisions, per `scripts/matrix-options/_recon/wire_candidates.json`), which is why the now-complete organic wiring lane (Batches G-V, PRs #418-#434) skipped them: none is a Kow-driven organic contaminant, so the organic template (`contaminantClass: 'organic' | 'organic-PAH' | 'organic-halogenated'`, `logKow` load-bearing) does not fit. The problem is architectural, not data-availability: `ContaminantClass` in `src/lib/matrix-options/types.ts` is a **closed union of 6 values** (`organic`, `organic-PAH`, `organic-halogenated`, `divalent-metal`, `methyl-Hg`, `metalloid`), and `derivations.ts` only special-cases `organic-PAH` and `methyl-Hg` -- every other class behaves identically at calc time. That means `divalent-metal`/`metalloid` already function as a **descriptive, non-Kow catch-all** (established precedent: chromium, aluminum, molybdenum, boron entries all say so explicitly in their `notes`), but none of it was designed with cyanide salts, oxyanions, reactive gases, or organometallics in mind. Wiring these 37 cleanly requires HITL sign-off on: (1) whether to force-fit into the existing catch-all classes or add new `ContaminantClass` values (a type-system change), (2) `abs_dermal` defaults for chemistries with no existing library precedent, and (3) several substance-identity overlaps with **already-wired generic elemental keys** (nickel, mercury_inorganic, uranium, vanadium, silver, lead, tin, aluminum) where a compound-specific RfD could either backfill the generic key's null value or create a confusing duplicate. Two rows also carry a probable **data-integrity defect** (RfC mislabeled/stored as an oral RfD). No autonomous wiring should proceed until these are resolved.

---

## Cohort A: Cyanide-family compounds (11)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `cyanide_free` | Conditional | `divalent-metal` (catch-all)* | 0.1 (TBD) | None (new key) | **DEDUP** | RfD 0.00063 mg/kg-bw/day (US EPA IRIS). Near-identical to `hydrogen_cyanide_and_cyanide_salts` (0.0006) -- likely the same or overlapping IRIS free-CN- assessment cited under two catalog labels. |
| `hydrogen_cyanide_and_cyanide_salts` | Conditional | `divalent-metal` (catch-all)* | 0.1 (TBD) | None (new key) | **DEDUP + UMBRELLA** | RfD 0.0006. This is IRIS's umbrella "cyanide salts" value; wiring it alongside the individual salts below risks a user double-counting CN- exposure (umbrella vs. speciated key ambiguity). |
| `calcium_cyanide` | Conditional | `divalent-metal` (catch-all)* | 0.1 (TBD) | None (new key) | class-fit + abs_dermal | RfD 0.001. Toxicity is CN- -driven, not Ca2+; no plain-cyanide class exists. |
| `copper_cyanide` | Conditional | `divalent-metal` (catch-all)* | 0.1 (TBD) | N/A -- overlaps `copper` (already wired, HH-only) | **OVERLAP** | RfD 0.005. Verify vs. existing `copper` generic key before treating as additive/separate. |
| `potassium_cyanide` | Conditional | `divalent-metal` (catch-all)* | 0.1 (TBD) | None (new key) | class-fit + abs_dermal | RfD 0.002. |
| `sodium_cyanide` | Conditional | `divalent-metal` (catch-all)* | 0.1 (TBD) | None (new key) | class-fit + abs_dermal | RfD 0.001. |
| `silver_cyanide` | Conditional | `divalent-metal` (catch-all)* | 0.1 (TBD) | N/A -- overlaps `silver` (already wired, RfD 5.0e-3, BC P28) | **OVERLAP -- VERIFY VALUE** | RfD 0.1, i.e. 20x LESS stringent than generic `silver` (0.005). Plausible (AgCN dissociation differs from ionic Ag+) but needs an adversarial re-check before shipping, not an assumption. |
| `potassium_silver_cyanide` | Conditional | `divalent-metal` (catch-all)* | 0.1 (TBD) | N/A -- overlaps `silver` + `silver_cyanide` | **OVERLAP (3-way)** | RfD 0.005. Creates a THIRD silver-adjacent value in the library alongside `silver` (0.005) and `silver_cyanide` (0.1); needs an explicit HITL naming/selection convention so calculator users pick the right one. |
| `cyanogen` | Yes (caveat) | `divalent-metal` (catch-all)* | 0.1 (TBD) | None (new key) | abs_dermal only | RfD 0.001. Distinct gas-phase compound (NC-CN), no overlap. |
| `cyanogen_bromide` | Yes (caveat) | `divalent-metal` (catch-all)* | 0.1 (TBD) | None (new key) | abs_dermal only | RfD 0.09. Distinct, no overlap. |
| `chlorine_cyanide` | Yes (caveat) | `divalent-metal` (catch-all)* | 0.1 (TBD) | None (new key) | abs_dermal only | RfD 0.05 (cyanogen chloride, CNCl). Distinct, no overlap. |

*No cyanide-family entry exists in the library today, so there is no in-repo `abs_dermal` precedent. HCN/CN- salts are historically considered readily dermally/respiratorily absorbed (ATSDR); 0.1 is a placeholder pending HITL toxicological review, not a derived value.

## Cohort B: Chlorine oxidants / disinfection-byproduct (DBP) species (6)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `bromate` | Yes | `divalent-metal` (catch-all) | 0.03 (metalloid-analogue, TBD) | None (new key) | class-fit only | RfD 0.004 (US EPA IRIS). Clean, no overlap. Note: primarily a drinking-water DBP; sediment-matrix relevance should be confirmed. |
| `chlorite_sodium_salt` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 0.03 (US EPA IRIS). Clean. |
| `monochloramine` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 0.1 (US EPA IRIS). Clean. |
| `perchlorate_clo4_and_perchlorate_salts` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 0.0007 (US EPA IRIS). Clean, well-established regulatory analyte. |
| `chlorine` | Conditional | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | applicability | RfD 0.1 (US EPA IRIS). Chlorine gas/hypochlorite does not persist in sediment; confirm this belongs in a sediment-matrix calculator before wiring. |
| `chlorine_dioxide` | **Blocked** | TBD | TBD | None | **ROUTE-MISMATCH (real=false pending verify)** | Catalog labels this "inhalation RfC" but stores 0.03 in mg/kg-bw/day -- an oral-RfD unit, not an RfC unit (mg/m3). Do not wire until the source record is re-verified; this looks like a unit/route transcription defect in the underlying catalog row. |

## Cohort C: Nitrogen oxyanions (2)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `nitrate` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 1.6 (US EPA IRIS). Clean; very common groundwater/surface-water analyte, limited sediment specificity but catalog-approved. |
| `nitrite` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 0.1 (US EPA IRIS). Clean. |

## Cohort D: Nickel compound-specific salts (3)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `nickel_chloride` | Conditional | `divalent-metal` | 0.03 (nickel precedent) | N/A -- overlaps `nickel` (already wired, eco-food selectable, RfD null) | **OVERLAP / BACKFILL?** | RfD 0.0013 (HC TRV v4.0). Generic `nickel` key exists with a NULL oral RfD today. Decide: backfill `nickel`'s RfD field with a speciated value, or keep this as a distinct key (speciated bioavailability differs materially by Ni compound). |
| `nickel_soluble_salts` | Conditional | `divalent-metal` | 0.03 (nickel precedent) | N/A -- same overlap | **OVERLAP / BACKFILL? + DEDUP vs nickel_sulfate** | RfD 0.02 (US EPA IRIS). Same backfill question as above; also close in identity to `nickel_sulfate` below (different source, different value) -- needs a source-priority call (HC/ECCC > US EPA per lane convention). |
| `nickel_sulfate` | Conditional | `divalent-metal` | 0.03 (nickel precedent) | N/A -- same overlap | **OVERLAP / BACKFILL? + DEDUP vs nickel_soluble_salts** | RfD 0.012 (HC TRV v4.0). See above; three nickel values (chloride/soluble-salts/sulfate) competing for one generic key's null slot. |

## Cohort E: Mercury compounds (2)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `mercuric_chloride_hgcl2` | Conditional | `divalent-metal` | 0.03 (mercury_inorganic precedent) | N/A -- overlaps `mercury_inorganic` (already wired, RfD null) | **OVERLAP / BACKFILL** | RfD 0.0003 (US EPA IRIS). HgCl2 is the standard IRIS proxy for divalent inorganic Hg toxicity -- high-confidence backfill candidate for `mercury_inorganic`'s null RfD field, but still HITL-gated per no-autonomous-mutation policy. |
| `phenylmercuric_acetate` | **HITL-DEFERRED** (carried over from the prior handoff) | TBD -- not `methyl-Hg`, not a clean `divalent-metal` fit | TBD | None (new key) | **CLASS-AMBIGUITY (prior deferral)** | RfD 0.00008 (US EPA IRIS). Organomercury with its own toxicokinetics, distinct from both `methylmercury` and `mercury_inorganic`. Previously explicitly deferred; no new information changes that. |

## Cohort F: Other metal/metalloid compound-specific values (3)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `selenious_acid` | Conditional | `metalloid` | 0.03 (selenium precedent) | N/A -- overlaps `selenium` (already wired, eco-food selectable, RfD null) | **OVERLAP / BACKFILL (high confidence)** | RfD 0.005 (US EPA IRIS). H2SeO3 (Se-IV) is the standard IRIS basis for elemental Se toxicity -- strong backfill candidate for `selenium`'s null RfD. |
| `uranium_soluble_salts` | Conditional | `metalloid` | 0.03 (uranium precedent) | N/A -- overlaps `uranium` (already wired, eco-selectable, RfD null) | **OVERLAP / BACKFILL** | RfD 0.003 (US EPA IRIS). Plausible backfill for `uranium`'s null RfD. |
| `vanadium_pentoxide` | Conditional | `metalloid` | 0.03 (vanadium precedent) | N/A -- overlaps `vanadium` (already wired, eco-selectable, RfD null) | **OVERLAP / BACKFILL + ROUTE CHECK** | RfD 0.009 (US EPA IRIS). V2O5 dust toxicity is historically inhalation-dominated in the literature; confirm this specific value is a genuine oral endpoint (not another RfC mislabel like Cohort B/H) before treating as a backfill source. |

## Cohort G: Organometallic pesticides/additives (2)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `tetraethyl_lead` | Conditional | **`organic` (candidate)** -- has a real measured logKow (~3.7-4.0); overlaps `lead` (already wired, divalent-metal, RfD 3.5e-3) but at a value ~35,000x more stringent (1e-7) | TBD | N/A -- do NOT inherit `lead`'s eco pathway | **CLASS-AMBIGUITY + DO-NOT-CONFLATE-WITH-Pb2+** | RfD 1.0e-7 (US EPA IRIS). Organolead is neurotoxicologically distinct from inorganic Pb2+; the huge value gap means this must be its own key, never a `lead` backfill. Kow-driven `organic` class may be the more honest fit than `divalent-metal`. |
| `tributyltin_oxide_tbto` | Conditional | **`organic` (candidate)** -- has a real measured logKow (~3.2-4.1); overlaps `tin` (already wired, divalent-metal, RfD 0.6) at ~2000x more stringent (0.0003) | TBD | N/A -- do NOT inherit `tin`'s pathway | **CLASS-AMBIGUITY + DO-NOT-CONFLATE-WITH-Sn** | RfD 0.0003 (US EPA IRIS). Well-known highly-toxic organotin antifoulant; must not backfill generic `tin`. |

## Cohort H: Elemental / reactive non-metals (4)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `white_phosphorus` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 0.00002 (US EPA IRIS). Clean elemental P4, no overlap. |
| `sodium_azide` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 0.004 (US EPA IRIS). Azide anion, fast-acting; no overlap, class-fit caveat only. |
| `aluminum_phosphide` | Conditional | `divalent-metal` (catch-all) | 0.03 (TBD) | N/A -- do NOT inherit `aluminum`'s pathway | **DO-NOT-CONFLATE-WITH-Al** | RfD 0.0004 (US EPA IRIS). Overlaps `aluminum` (already wired, RfD 1.0) at ~2500x more stringent -- toxicity is phosphide/PH3-release driven, not Al3+. Must be its own key. |
| `phosphine` | **Blocked** | TBD | TBD | None | **ROUTE-MISMATCH (real=false pending verify)** | Catalog labels this "inhalation RfC" but stores 0.0003 in mg/kg-bw/day, the same unit/route defect pattern as `chlorine_dioxide`. Also note: this is the gas released by `aluminum_phosphide` above -- resolving one may inform the other, but do not wire either as an oral pathway until the source record is confirmed. |

## Cohort I: Miscellaneous inorganic salts (2)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `ammonium_sulfamate` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 0.2 (US EPA IRIS). Herbicide/fire-retardant salt, clean, no overlap. |
| `fluorine_soluble_fluoride` | Yes | `divalent-metal` (catch-all) | 0.03 (TBD) | None (new key) | class-fit only | RfD 0.06 (US EPA IRIS). Common regulated anion; class-fit caveat only. |

## Cohort J: Organic-adjacent edge cases (2)

| substance_key | wireable | proposed_class | abs_dermal | existing eco value | HITL flag | rationale |
|---|---|---|---|---|---|---|
| `zineb` | Conditional | **`organic` or `organic-halogenated` (candidate)** -- zinc dithiocarbamate fungicide, predominantly organic chemistry with a coordination-bound Zn center | TBD | None (new key) | **ROUTING QUESTION** | RfD 0.05 (US EPA IRIS). Landed in this metal-exclusion list, but arguably belongs in the now-COMPLETE organic HH-oral-RfD lane (Batches G-V) with a real logKow. Recommend HITL decide whether to reopen that lane for one substance vs. wire here as a metal-adjacent catch-all. |
| `pcbs_non_coplanar` | **HITL-DEFERRED** (carried over from the prior handoff) | `organic-halogenated` (matches existing PCB convention) | Match `total_pcbs_aroclor_1254` (0.14) if wired | N/A -- overlaps `total_pcbs_aroclor_1254` (already wired, RfD 2.0e-5, organic-halogenated) | **OVERLAP + POLICY DECISION** | RfD 0.00001 (HC TRV v4.0) vs. the already-wired Aroclor 1254 RfD of 2.0e-5 (US EPA IRIS) -- two different PCB toxicity bases would coexist under "PCBs," risking ambiguous double-selection by calculator users. Needs an explicit PCB congener-grouping policy before wiring, not a mechanical fix. |

---

## HITL DECISIONS NEEDED

- **Architecture (blanket, all 37):** decide whether to reuse `divalent-metal`/`metalloid` as a purely-descriptive catch-all for non-metal anions/gases/cyanides (fast, no type change, but semantically loose) or extend the closed `ContaminantClass` union in `types.ts` (cleaner, requires a code change + `derivations.ts` review).
- `cyanide_free` / `hydrogen_cyanide_and_cyanide_salts` -- likely-duplicate IRIS CN- assessments; pick one or clarify the distinction before wiring both.
- `copper_cyanide` -- verify against the already-wired generic `copper` key before treating as additive.
- `silver_cyanide` -- RfD is 20x less stringent than generic `silver`; re-verify the value before shipping.
- `potassium_silver_cyanide` -- creates a third silver-adjacent value alongside `silver` and `silver_cyanide`; needs a selection convention.
- `chlorine_dioxide` -- **verdict: real=false pending verification.** Labeled "inhalation RfC" but stored in oral-RfD units; do not wire until the source record is re-checked.
- `phosphine` -- **verdict: real=false pending verification.** Same RfC/unit-mismatch defect as `chlorine_dioxide`.
- `nickel_chloride`, `nickel_soluble_salts`, `nickel_sulfate` -- three competing candidate values for the already-wired `nickel` key's null RfD slot; decide backfill-vs-separate-key and source priority (HC/ECCC vs. US EPA).
- `mercuric_chloride_hgcl2` -- high-confidence backfill candidate for `mercury_inorganic`'s null RfD; needs HITL sign-off before mutation.
- `phenylmercuric_acetate` -- class-ambiguous organomercury; carried over as HITL-deferred from the prior session, no new resolution.
- `selenious_acid`, `uranium_soluble_salts`, `vanadium_pentoxide` -- each a plausible backfill candidate for the already-wired `selenium` / `uranium` / `vanadium` null-RfD keys; `vanadium_pentoxide` additionally needs a route check (possible RfC-mislabel pattern).
- `tetraethyl_lead`, `tributyltin_oxide_tbto` -- organometallics with real logKow values; class assignment (`organic` vs. `divalent-metal`) is a genuine judgment call, and both must NOT backfill their much-less-stringent inorganic-metal counterparts (`lead`, `tin`).
- `aluminum_phosphide` -- must not backfill `aluminum` (2500x value gap; toxicity is phosphide-driven).
- `zineb` -- routing question: possibly belongs in the completed organic lane rather than this metal/inorganic lane.
- `pcbs_non_coplanar` -- HITL-deferred; overlaps `total_pcbs_aroclor_1254` and needs a PCB congener-grouping policy decision.

---

**No wiring action has been taken.** This packet is for HITL review only; per the matrix-options working rules, AI does not promote, wire, or mutate `SUBSTANCE_LIBRARY` without explicit HITL direction on the class-fit, backfill, and data-integrity questions above.
