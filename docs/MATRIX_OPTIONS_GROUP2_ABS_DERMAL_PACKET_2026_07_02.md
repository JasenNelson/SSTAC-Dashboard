<!-- Generated 2026-07-02. Owner DECISION PACKET for the Group 2 (abs_dermal) anomalies from
docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md. NOTHING in this document has been
applied to substanceLibrary.ts. Values change only after owner picks. Plain ASCII. -->

# Matrix-Options Group 2 (abs_dermal) - Owner Decision Packet, 2026-07-02

## Purpose

Turn the Group 2 abs_dermal anomalies into a per-substance decision table so the owner can pick, per
substance, between: (a) REVERT to the contaminant-class default, or (b) CONFIRM a real Health Canada
TRV v4.0 Table 5 chemical-specific route absorption factor (RAF) and keep the deviation (with the note
corrected). No value is changed until the owner picks.

## VERIFICATION OUTCOME + FINAL DECISION (2026-07-02, owner-approved)

Sources verified: EPA RAGS Part E Exhibit 3-4 (EPA/540/R/99/005, 2004) + EPA supplemental ABS_d table
(Reifenrath et al. 2002) + HC TRV v4.0 Table 5 (H129-108-2021), cross-checked vs NJDEP's clean
reproduction of Exhibit 3-4. All anchor values confirmed (arsenic 0.03, cadmium 0.001, PAH 0.13, PCB
0.14, PCP 0.25, DDT 0.03, chlordane 0.04). This SUPERSEDES the pre-verification cluster
recommendations below where they differ (notably: TNT and styrene are KEPT, not reverted).

Key basis: EPA RAGS Part E SVOC soil default = 0.1; HC VOC RAFDerm default = 0.03 (MECP 2011); no
RAGS ABS_d exists for VOCs (routed via inhalation). Exhibit 3-4 lists only 10 chemicals; the EPA
supplemental table adds explosives.

**REVERT abs_dermal 0.03 -> 0.1 (6; SVOCs/solids, no chemical-specific support -> RAGS SVOC default):**
bis_2_ethylhexyl_phthalate_dehp, 2_4_dinitrotoluene (its EPA-specific 0.102 rounds to 0.1),
1_2_4_5_tetrachlorobenzene, phenol, bisphenol_a, nitrobenzene. Effect: LOWERS sedS (more conservative).

**KEEP 0.03, correct the note (7):**
- 2_4_6_trinitrotoluene_tnt -- 0.03 is REAL (EPA supplemental ABS_d 3.2%, Reifenrath 2002); was
  mislabeled "VOC RAF".
- acetone, 1_4_dioxane, acrylonitrile, carbon_disulfide, styrene -- confirmed VOCs; 0.03 = HC VOC
  RAFDerm default (MECP 2011).
- pyridine -- boundary case (volatile bp 115 C but Method 8270-classified); owner decision: keep 0.03
  as VOC default, note the ambiguity.

**KEEP 0.14, add disclosure (1):** total_pcbs_aroclor_1254 -- 0.14 is the REAL RAGS Exhibit 3-4
PCBs/Aroclor value (NOT drift; Cluster D resolved).

**DEFER (Cluster E, dormant -- no wired RfD/SF, no output effect today):** vinyl_chloride (1.0) + the 7
metals -- separate low-urgency PR.

Regression test locks each of the 14 abs_dermal values to its verified source.

## How abs_dermal affects output (so the stakes are clear)

`humanHealthDirectContact()` (`src/lib/matrix-options/derivations.ts`) uses:
`Dose ~ (IR_sed * BA_o + SA * AF_sed * ABS_d)`; that `contactRate` sits in the DENOMINATOR of the
screening value `sedS`. So a HIGHER `abs_dermal` -> higher contactRate -> LOWER (more conservative)
`sedS`, and a LOWER `abs_dermal` -> higher (LESS conservative) `sedS`. `abs_dermal` must be in [0,1].

**Consequence:** the mislabeled organics currently at 0.03 (vs the true organic default 0.1) are
UNDER-protective today - the dermal term is ~3.3x smaller than the class default would give.

## The critical split: LIVE vs DORMANT

`abs_dermal` only changes output when the substance has a wired `rfd_oral` OR `sf_oral` (else
`pickHumanHealthEndpoint` throws and the whole HH-direct pathway is inert for that substance). This
re-orders priority relative to the consolidated doc:

- **DORMANT (no output effect today - latent only):** `vinyl_chloride` (1.0), and the 7 metals
  `chromium_trivalent` / `barium` / `beryllium` / `chromium_hexavalent` / `chromium` (0.1),
  `nickel` / `mercury_inorganic` (0.03). All have `rfd_oral=null` AND `sf_oral=null`. Their abs_dermal
  is a latent bug that only bites the day an RfD/SF is wired. (This means the consolidated doc's
  "vinyl_chloride 1.0 = top priority" is actually LOW urgency: it cannot compute today.)
- **LIVE (moves HH-direct output now):** everything else below with a non-null RfD/SF.

## Class defaults (the baseline each anomaly deviates from)

| class | modal abs_dermal | share |
|---|---|---|
| organic | 0.1 | 162/181 |
| organic-halogenated | 0.1 | 157/170 |
| organic-PAH | 0.13 | 11/12 |
| divalent-metal | 0.001 | 11/18 |
| metalloid | 0.03 | 7/7 |
| inorganic | 0.1 | 17/17 |

## Decision table

Note on the "VOC RAF (cf. benzene/TCE/PCE)" claim: benzene/TCE/PCE are genuine VOCs (bp 80/87/121 C)
and carry only a generic "HC TRV v4.0 Table 5 dermal RAF" citation - they do NOT themselves say
"VOC RAF". The disputed entries copy-paste the more specific "VOC RAF (cf. benzene/TCE/PCE)" label onto
non-volatile substances, which is the chemistry error.

### Cluster A - LIVE, false "VOC RAF" on non-volatile SVOCs/solids (recommend REVERT to 0.1)

| key | class | abs_dermal | default | RfD / SF (live) | why 0.03 is wrong |
|---|---|---|---|---|---|
| bis_2_ethylhexyl_phthalate_dehp | organic | 0.03 | 0.1 | 0.02 / 0.014 | DEHP bp ~384 C, non-volatile plasticizer (EPA 8270, not 8260); "VOC RAF" indefensible |
| 2_4_6_trinitrotoluene_tnt | organic | 0.03 | 0.1 | 0.0005 / 0.03 | Low-volatility nitroaromatic solid (explosives 8330), not a VOC |
| 2_4_dinitrotoluene | organic | 0.03 | 0.1 | 0.002 / - | SVOC/explosives-related; more volatile than TNT but still not a VOC |
| 1_2_4_5_tetrachlorobenzene | organic-halogenated | 0.03 | 0.1 | 0.0003 / - | Persistent low-volatility SVOC (bp ~246 C) |

Recommendation: REVERT all four to 0.1 (class default) and delete the false VOC-RAF text, UNLESS the
owner confirms a genuine chemical-specific HC Table 5 RAF for a given one. Effect: LOWERS sedS (more
conservative) for each.

### Cluster B - LIVE, mislabeled "organic class default" on semi-volatiles/solids (recommend REVERT to 0.1)

| key | class | abs_dermal | default | RfD / SF (live) | note issue |
|---|---|---|---|---|---|
| phenol | organic | 0.03 | 0.1 | 0.3 / - | note says "organic class default" but the default is 0.1, not 0.03 |
| bisphenol_a | organic | 0.03 | 0.1 | 0.05 / - | solid (mp ~158 C), non-volatile - a VOC-style RAF is indefensible |
| nitrobenzene | organic | 0.03 | 0.1 | 0.002 / - | semi-volatile, not a VOC |
| styrene | organic | 0.03 | 0.1 | 0.2 / - | note mislabels 0.03 as the class default |
| pyridine | organic | 0.03 | 0.1 | 0.001 / - | note mislabels 0.03 as the class default |

Recommendation: REVERT to 0.1 (or confirm a real RAF); fix the mislabeled note either way. Effect:
LOWERS sedS (more conservative).

### Cluster C - LIVE, genuinely volatile (recommend KEEP 0.03, fix note only)

| key | class | abs_dermal | RfD / SF (live) | rationale |
|---|---|---|---|---|
| acetone | organic | 0.03 | 0.9 / - | bp 56 C - genuinely volatile; 0.03 plausibly a real VOC RAF |
| 1_4_dioxane | organic | 0.03 | 0.03 / 0.1 | bp 101 C - volatile |
| acrylonitrile | organic | 0.03 | - / 0.54 | bp 77 C - volatile |
| carbon_disulfide | organic | 0.03 | 0.1 / - | bp 46 C - volatile |

Recommendation: KEEP 0.03 as a disclosed VOC-specific override, but fix the note (it currently frames
0.03 as "the class default" - it is NOT; it is a chemical-specific override). No value change. Lower
priority than A/B.

### Cluster D - LIVE, undisclosed deviation

| key | class | abs_dermal | default | RfD / SF | issue |
|---|---|---|---|---|---|
| total_pcbs_aroclor_1254 | organic-halogenated | 0.14 | 0.1 | 2e-5 / 2.0 | 0.14 vs 0.1 default; no dermal-specific citation anywhere |

Recommendation: confirm whether 0.14 is a real chemical-specific RAF or drift; disclose either way. If
drift, revert to 0.1 (RAISES sedS - slightly less conservative). Direction is minor (0.14 vs 0.1).

### Cluster E - DORMANT (no output effect today; fix now to remove the latent bug, low urgency)

| key | class | abs_dermal | default | note |
|---|---|---|---|---|
| vinyl_chloride | organic-halogenated | 1.0 | 0.1 | extreme outlier (max legal); if RfD/SF ever wired, 1.0 -> maximally conservative sedS. Recommend correct to 0.1 (or 0.03 VOC-consistent). |
| chromium_trivalent | divalent-metal | 0.1 | 0.001 | speciation call; recommend 0.001 unless elevated dermal absorption is real |
| barium | divalent-metal | 0.1 | 0.001 | recommend 0.001 |
| beryllium | divalent-metal | 0.1 | 0.001 | recommend 0.001 |
| chromium_hexavalent | divalent-metal | 0.1 | 0.001 | Cr(VI) dermal absorption IS known elevated - 0.1 may be defensible; owner call |
| chromium (generic) | divalent-metal | 0.1 | 0.001 | recommend 0.001 |
| nickel | divalent-metal | 0.03 | 0.001 | recommend 0.001 (Ni dermal sensitization is a hazard, not an absorption-fraction, argument) |
| mercury_inorganic | divalent-metal | 0.03 | 0.001 | recommend 0.001 |

## Open verification (per "AI finds + verifies values")

Before reverting Clusters A/B, the exact-source step is: check HC TRV v4.0 Table 5 for a genuine
chemical-specific RAF for each substance. The consolidated deep audit concluded these are
copy-pasted false claims (the VOC RAF does not apply to non-volatile SVOCs), so the default (revert)
is the evidence-supported recommendation - but if the owner has HC Table 5 and a real per-chemical RAF
exists, that overrides the revert for that substance.

## Recommended execution order (once owner picks)

1. Cluster A + B reverts (LIVE, high-confidence, most output impact) - one value-correction PR.
2. Cluster C note-only fixes (LIVE, no value change) - can ride the same PR or a doc PR.
3. Cluster D (total_pcbs) - owner confirm/revert.
4. Cluster E (dormant) - a separate low-urgency PR (or fold in), since none compute today.
