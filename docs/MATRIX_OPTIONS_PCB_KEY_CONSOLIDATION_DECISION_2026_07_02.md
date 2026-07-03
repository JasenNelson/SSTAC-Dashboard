# Matrix-Options PCB-Key Consolidation -- Decision Brief (2026-07-02)

### 1. Purpose
The MO substance library holds two overlapping "Total PCBs" keys plus related PCB-family keys; consolidation was deferred as an HITL item. This brief lays out the keys, the choice of canonical key, the required PCB congener-grouping policy, and a recommended ruling for owner sign-off. No library code changes are made by this brief.

### 2. The PCB-family keys (SUBSTANCE_LIBRARY entries vs catalog-only evidence keys)

IMPORTANT distinction (do not conflate): only `total_pcbs_aroclor_1254`,
`polychlorinated_biphenyls_total_pcbs`, `aroclor_1016`, and `biphenyl` are entries in
`SUBSTANCE_LIBRARY` (`src/lib/matrix-options/substanceLibrary.ts`). `polychlorinated_biphenyls_pcbs`
and `pcbs_non_coplanar` are CATALOG / PROVENANCE keys (in `human_health_trv_values.json` /
`eco_values.json`), NOT selectable library rows -- they are cited sources. The "role" column
below marks which is which; the consolidation decision applies to the LIBRARY rows only.

| key | line | displayName | logKow | rfd_oral | sf_oral | bsaf_fw | abs_dermal | fcv_ug/L | trv_eco | role |
|---|---|---|---|---|---|---|---|---|---|---|
| `total_pcbs_aroclor_1254` | ~40 | Total PCBs (Aroclor 1254) | 6.5 | 2.0e-5 | 2.0 | 2.0 | 0.14 | 0.014 (verified pv-pcb-fcv, EPA NRWQC) | null (nulled 2026-07-02, fabricated Eco-SSL source removed) | fully-wired HH+eco canonical row |
| `polychlorinated_biphenyls_total_pcbs` | ~1416 | Total PCBs | 6.5 | null | null | null | 0.1 | null (resolves 0.014 dynamically from the eco catalog) | null | eco-direct stub |
| `aroclor_1016` | ~3807 | Aroclor 1016 (PCB Mixture) | null | 7.0e-5 | null | null | 0.1 | null | null | distinct Aroclor, own IRIS RfD -- OUT OF SCOPE of the merge |
| `polychlorinated_biphenyls_pcbs` | catalog-only | Polychlorinated biphenyls (PCBs) | (generic IRIS PCBs key) | - | 2.0 | - | - | - | - | CATALOG/PROVENANCE key, NOT a library row: the generic IRIS PCBs SOURCE that `total_pcbs_aroclor_1254` BORROWS its sf_oral 2.0 from |
| `biphenyl` | ~873 (library) | Biphenyl | 4.01 | - | - | - | - | - | - | LIBRARY row: the un-chlorinated PARENT compound, NOT a PCB -- explicitly OUT OF SCOPE (do not fold in) |

Note: `pcbs_non_coplanar` (HC RfD 0.00001) is also a CATALOG/PROVENANCE key (not a library row); it overlaps `total_pcbs_aroclor_1254`'s 2.0e-5 IRIS RfD and is a separately-deferred HITL item that a congener policy must also address.

### 3. The overlap
`total_pcbs_aroclor_1254` and `polychlorinated_biphenyls_total_pcbs` are BOTH "Total PCBs", BOTH logKow 6.5, BOTH pointing at the same EPA NRWQC total-PCBs chronic FCV 0.014 ug/L. They differ only in HOW the value is held: the Aroclor row is fully wired (static FCV 0.014 + full HH toxicity), the plain row is an eco-direct stub whose FCV resolves 0.014 dynamically at runtime and whose HH fields are all null.

### 4. The EqP sediment-benchmark caveat (load-bearing)
Pairing the shared 0.014 ug/L water FCV with the high logKow 6.5 in the equilibrium-partitioning (EqP) model yields a LESS-stringent (not over-protective) sediment benchmark. So the choice of canonical key is not cosmetic: any consolidation must be checked against the site congener profile before it can be treated as protective. This is why the merge is HITL-gated, not mechanical.

### 5. Decision 1 -- which key is canonical?
- Option A (RECOMMENDED): keep `total_pcbs_aroclor_1254` as the single canonical "Total PCBs" row (it already carries the verified FCV + full HH toxicity), and reduce `polychlorinated_biphenyls_total_pcbs` to an explicit ALIAS/deprecation pointer (or remove it) so there is one Total-PCBs entry. Pro: one source of truth, keeps the verified FCV + HH toxicity. Con / REQUIRED follow-up scope: `polychlorinated_biphenyls_total_pcbs` owns CATALOG records beyond the runtime resolver path -- an approved eco FCV row (`eco_values.json`) and BC Protocol 28 HH direct/food RfD rows (`human_health_trv_values.json`). Removing or aliasing the library key REQUIRES migrating or re-keying those catalog value-groups (not merely a resolver-consumer check), or they are left split/orphaned. So Option A's follow-up PR must include catalog-row migration/alias handling, not just a library-side edit.
- Option B: keep BOTH but formally scope them (Aroclor row = HH+eco default; plain row = eco-direct dynamic-resolver only) with cross-referencing notes. Pro: least disruptive. Con: leaves two "Total PCBs" rows, the current ambiguity persists.
- Option C: make `polychlorinated_biphenyls_total_pcbs` canonical and demote the Aroclor-named row. Con: the Aroclor row holds the verified FCV + full HH toxicity; not recommended.

### 6. Decision 2 -- PCB congener-grouping policy (required regardless of Decision 1)
The library must answer so future PCB wiring is consistent:
- How Total-PCBs relates to Aroclor-specific mixtures (aroclor_1016, aroclor_1254) -- are they alternative representations or additive? (Risk of double-counting.)
- How non-coplanar vs coplanar (dioxin-like) congeners are handled (`pcbs_non_coplanar` HC RfD 0.00001 vs the 2.0e-5 IRIS total-PCBs RfD).
- Whether the generic `polychlorinated_biphenyls_pcbs` IRIS key should remain a standalone key or only a cited SOURCE for the Total-PCBs row (it is currently borrowed for sf_oral 2.0).

Recommendation: adopt a "Total-PCBs-as-default, Aroclor/congener-specific as explicit alternatives, never additive with Total-PCBs" convention, and record it in the library notes.

### 7. Recommended ruling (for owner sign-off)
Option A for Decision 1 + the Total-PCBs-default convention for Decision 2, executed as a follow-up PR ONLY after owner sign-off, with the EqP/site-congener caveat verified. Until then the in-code "do not merge" guards stay.

### 8. Status
This is a decision brief only. No library code changed. Awaiting owner ruling.
