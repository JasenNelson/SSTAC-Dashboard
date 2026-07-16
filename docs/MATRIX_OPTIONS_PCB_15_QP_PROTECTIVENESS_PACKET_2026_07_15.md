# PCB Re-Key QP Protectiveness Packet (Row #15) -- DRAFT for Owner (QP) Judgment

> **STATUS: DRAFT ONLY.** This packet does NOT attest, does NOT migrate any catalog row, and does
> NOT change any code. It exists so the owner, acting as Qualified Professional (QP), can sign or
> reject the PCB re-key on the record. Per Stage 1 Ruling 6 (STAGE1_DECISION_LOG_2026_07_15.md,
> row 6 / base #15): "DO NOT ATTEST now. Catalog-row re-key BLOCKED pending a dedicated QP
> protectiveness packet ... AUTHORIZED: draft the QP sign-off packet ONLY." The underlying
> migration (Ruling 5 / base #13, "Option A + RELABEL") stays STAGED and BLOCKED until this
> packet is signed. No production write is authorized by this document.

## 1. Ruling-5 context (base #13): what is being proposed, and why it is gated

Source: `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md` +
`STAGE1_DECISION_LOG_2026_07_15.md` row 5.

The Matrix Options substance library currently carries two overlapping "Total PCBs" library
entries in `src/lib/matrix-options/substanceLibrary.ts`:

| key | line (approx) | displayName | role |
|---|---|---|---|
| `total_pcbs_aroclor_1254` | ~40 | Total PCBs (Aroclor 1254) | fully-wired HH + eco canonical row |
| `polychlorinated_biphenyls_total_pcbs` | ~1449 | Total PCBs | eco-direct stub (deprecated alias) |

**Owner ruling (2026-07-15, base #13): Option A + RELABEL.** `total_pcbs_aroclor_1254` becomes
the single canonical "Total PCBs" row, but its key/displayName is relabeled away from the
Aroclor-1254-specific name to "Total PCBs" (provenance notes retained: SF 2.0 = EPA
high-risk-tier total-PCB source; FCV 0.014 ug/L = NRWQC total-PCB criterion; RfD 2.0e-5 = IRIS
Aroclor-1254 surrogate). `polychlorinated_biphenyls_total_pcbs` becomes an explicit
alias/deprecation stub. The library convention: Total-PCBs is the default; Aroclor- or
congener-specific rows (e.g. `aroclor_1016`) are explicit NON-ADDITIVE alternatives; dioxin-like
congeners are handled via TEQ (a separate row #23 item), never summed into Total-PCBs.

**Why this write is staged behind the QP check, not applied directly:** the RELABEL is a code +
library edit with no numeric-value change, so it carries no protectiveness risk by itself. What
IS gated is the SEPARATE, larger action referenced in Ruling 5's "exact write": migrating
`polychlorinated_biphenyls_total_pcbs`'s own CATALOG records (an approved eco FCV row in
`eco_values.json`, and BC Protocol 28 HH direct/food RfD rows in `human_health_trv_values.json`)
onto the canonical `total_pcbs_aroclor_1254` key. That re-key applies the canonical row's FCV
0.014 ug/L / logKow 6.5 pairing to data that previously lived under the plain-named alias --
which is the site-protectiveness question this packet exists to resolve (section 2 below).

Current code state (verified 2026-07-15, `src/lib/matrix-options/substanceLibrary.ts`):
`total_pcbs_aroclor_1254`'s displayName is STILL "Total PCBs (Aroclor 1254)" -- the RELABEL has
NOT been applied yet; its notes already say "the CANONICAL 'Total PCBs' row (Option A,
owner-ruled 2026-07-13d)" and "the catalog-row value-migration/re-keying of the alias remains a
separate deferred packet" -- i.e., the code already reflects the "Option A ruled, migration
deferred" state this packet is gating.

## 2. The EqP protectiveness concern (why a QP must look at this before any re-key)

Source: `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md` section 4 +
`STAGE1_DECISION_PACKET_2026_07_15.md` section 6 + verified values in
`src/lib/matrix-options/substanceLibrary.ts` (lines ~40-75).

The canonical `total_pcbs_aroclor_1254` row pairs:

- **FCV (chronic aquatic-life criterion): 0.014 ug/L** -- US EPA National Recommended Water
  Quality Criteria, total-PCBs chronic (CCC); verified 2026-07-02 against the live NRWQC source
  (`src-us-epa-nrwqc-aquatic-life-live`, catalog row `pv-pcb-fcv`). This FCV explicitly covers the
  SUM of all congener/isomer/homolog/Aroclor analyses -- it is a mixture-level criterion, not a
  single-congener value.
- **logKow: 6.5** -- the Aroclor 1254 representative value (ATSDR Toxicological Profile for PCBs,
  Table 4-3, citing Hansch and Leo 1985).

In the equilibrium-partitioning (EqP) sediment-screening model
(`sedS = FCV * Koc(logKow) * foc`), Koc rises with logKow. Pairing the mixture-level FCV with the
HIGH 6.5 logKow yields a HIGHER -- i.e. LESS-STRINGENT, less-protective -- sediment benchmark than
a lower-Kow congener/Aroclor representative would produce. This is NOT an over-protective
combination; if the site's actual congener/Aroclor mixture skews toward lower-chlorinated,
lower-Kow congeners (PCB congener logKow spans roughly 4.5-8.2 across the full homolog range),
the 6.5-based benchmark could UNDER-protect relative to what the site's real mixture would
require. This is exactly why the codebase's own in-line note on
`polychlorinated_biphenyls_total_pcbs` calls this a "CAVEAT" requiring the site congener profile
to be checked before relying on the benchmark.

**The re-key amplifies this concern's reach.** Migrating `polychlorinated_biphenyls_total_pcbs`'s
catalog rows onto `total_pcbs_aroclor_1254` means data that was previously reachable under the
plain "Total PCBs" alias now resolves through the same FCV 0.014 / logKow 6.5 pairing as the
Aroclor-1254-named row. If any downstream consumer or historical record assumed the alias
resolved a DIFFERENT (e.g. lower-Kow, more conservative) benchmark, the re-key would silently
change that outcome. A QP check confirms whether that is acceptable for this site.

## 3. Template: SITE congener profile vs FCV 0.014 ug/L / logKow 6.5 EqP benchmark

**QP fills in this section using the actual site data before signing.** Placeholder only --
no site data has been entered by this draft.

| Field | Value (QP to complete) |
|---|---|
| Site / DRA name | _____________________ |
| Sediment/soil matrix sampled | _____________________ |
| Analytical method (e.g. Aroclor pattern-match vs full congener list, EPA 1668/8082) | _____________________ |
| Dominant Aroclor(s) or congener homolog group(s) observed at site | _____________________ |
| Site-weighted / representative logKow for the observed mixture | _____________________ (compare to the benchmark's 6.5) |
| Does the site mixture skew toward LOWER-chlorinated / lower-Kow congeners than Aroclor 1254? | Yes / No / Unable to determine |
| If yes: estimated site-representative logKow and the sedS benchmark it would imply (vs the 6.5-based benchmark) | _____________________ |
| Any prior site-specific PCB sediment benchmark on record (source + value) | _____________________ |
| QP conclusion: is the FCV 0.014 ug/L / logKow 6.5 EqP benchmark protective for THIS site's congener profile? | _____________________ |

## 4. The more-protective non-coplanar alternative to weigh

Source: `src/lib/matrix-options/substanceLibrary.ts` + verified in
`scripts/matrix-options/promote-hc-trv-v4-2025.mjs` `PROMOTION_ROWS` (already-promoted HC TRV
v4.0 batch) + `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md` section 6.

The canonical row's oral RfD is **2.0e-5 mg/kg-bw/day** (IRIS Aroclor-1254 surrogate). A separate,
CATALOG-ONLY (not a library row) Health Canada value exists for the non-coplanar PCB congener
group:

- `pcbs_non_coplanar` -- HC oral RfD **1.0e-5 mg/kg-bw/day** (`pv-hc-pcbs_non_coplanar-hh-direct-rfd`
  / `pv-hc-pcbs_non_coplanar-hh-food-rfd`, Health Canada TRVs v4.0 (2025), `approved_source_backed`).

1.0e-5 is HALF of 2.0e-5 -- i.e. the non-coplanar HC value is MORE protective (a lower RfD implies
a lower acceptable dose) than the IRIS Aroclor-1254 surrogate the canonical row currently uses.
This is a separate axis from the FCV/logKow EqP concern in section 2 (that one is
ecological/sediment; this one is human-health oral toxicity), but both bear on whether the
canonical row, as currently parameterized, is the right protective basis for THIS site:

- If the site's PCB burden is expected to be predominantly non-coplanar congeners (as opposed to
  dioxin-like coplanar congeners, which route through the separate TEQ pathway per row #23), the
  QP should weigh whether the more-protective 1.0e-5 non-coplanar RfD should be used in place of,
  or alongside as a sensitivity check against, the canonical row's 2.0e-5 IRIS Aroclor-1254
  surrogate RfD for the human-health direct/food pathways.
- Per the Decision-2 convention already adopted (section 1 above), Total-PCBs and
  congener-specific values are NEVER additive -- this is a "which single value is the right
  protective basis" question, not a "sum both" question.

**QP note (fill in):** ______________________________________________________________________

## 5. Sign-off block

This packet requires ONE of the three outcomes below, signed and dated by the owner acting as QP.
No catalog-row migration proceeds until "Attest protective" is selected and dated.

```
[ ] ATTEST PROTECTIVE
    I have reviewed the site congener profile (section 3) against the FCV 0.014 ug/L / logKow 6.5
    EqP sediment benchmark and the IRIS Aroclor-1254 surrogate RfD 2.0e-5 vs the more-protective
    HC non-coplanar RfD 1.0e-5 (section 4), and I attest the canonical total_pcbs_aroclor_1254
    values are protective for this site. The catalog-row re-key (migrating
    polychlorinated_biphenyls_total_pcbs's eco FCV + BC Protocol 28 HH rows onto
    total_pcbs_aroclor_1254) may proceed as a SEPARATE exact-operation approval.

[ ] REJECT
    The benchmark and/or RfD basis is NOT protective for this site as currently parameterized.
    Reason: ______________________________________________________________________
    Required remediation before re-consideration: ______________________________________

[ ] REQUEST MORE DATA
    Insufficient information to attest or reject. Specify what is needed:
    ______________________________________________________________________

QP name: ______________________   Date: ______________________   Signature: ______________________
```

## 6. What happens after sign-off (not authorized by this document)

- **ATTEST PROTECTIVE**: unblocks Ruling 5's deferred catalog-row migration (eco FCV row in
  `eco_values.json` + BC Protocol 28 HH direct/food RfD rows in `human_health_trv_values.json`,
  re-keyed from `polychlorinated_biphenyls_total_pcbs` to `total_pcbs_aroclor_1254`) AND the
  RELABEL (key/displayName away from "Aroclor 1254" to "Total PCBs"). Both remain
  PRODUCTION-WRITE items requiring a SEPARATE exact-operation approval and codex review before
  any code or catalog file is touched -- this sign-off alone does not execute anything.
- **REJECT**: the migration stays blocked; `polychlorinated_biphenyls_total_pcbs` continues to
  hold its own catalog rows as-is; the two library entries remain split.
- **REQUEST MORE DATA**: no migration; the QP's data request becomes the next scoped task.
