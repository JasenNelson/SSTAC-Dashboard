# Matrix Options PCB Alias Packet - 2026-07-08

## Verdict

Do not implement PCB key alias/deprecation during the autonomous run.

The code has two selectable Total-PCBs runtime rows, but collapsing them is not a safe library-only
change. The existing decision brief says Option A requires catalog-row migration or alias handling,
and this run is explicitly barred from catalog mutation and review-status/default-status changes.

## Runtime Rows

### `total_pcbs_aroclor_1254`

Current `SUBSTANCE_LIBRARY` entry:

- display name: `Total PCBs (Aroclor 1254)`
- contaminant class: `organic-halogenated`
- logKow: `6.50`
- oral RfD: `2.0e-5`
- oral slope factor: `2.0`
- freshwater BSAF: `2.0`
- abs dermal: `0.14`
- FCV: `0.014`
- eco TRV: `null`

Notes in code state that the FCV is verified against EPA NRWQC total-PCBs chronic criterion and that
the prior unverifiable Eco-SSL wildlife TRV was removed. The notes also explicitly say duplicate PCB
key consolidation with `polychlorinated_biphenyls_total_pcbs` is deferred and that neither entry
should be merged or deleted yet.

### `polychlorinated_biphenyls_total_pcbs`

Current `SUBSTANCE_LIBRARY` entry:

- display name: `Total PCBs`
- contaminant class: `organic-halogenated`
- logKow: `6.5`
- oral RfD: `null`
- oral slope factor: `null`
- freshwater BSAF: `null`
- abs dermal: `0.1`
- FCV: `null`
- eco TRV: `null`

Notes in code state that this row is eco-direct-only, that its FCV resolves dynamically from the eco
catalog, and that it should not be merged with `total_pcbs_aroclor_1254`.

## Existing Decision Brief

`docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md` recommends Option A:

- keep `total_pcbs_aroclor_1254` as the canonical Total-PCBs row
- reduce `polychlorinated_biphenyls_total_pcbs` to an alias/deprecation pointer or remove it

But the same brief states the required follow-up scope:

- `polychlorinated_biphenyls_total_pcbs` owns catalog records beyond the runtime resolver path
- approved eco FCV row(s) and BC Protocol 28 HH direct/food RfD rows must be migrated, re-keyed, or
  aliased
- a library-only edit would split or orphan value groups

That makes this a catalog-identity migration, not a safe autonomous code cleanup.

## Why This Matters

The overlap is not cosmetic:

- both runtime rows are named Total PCBs
- both use logKow 6.5
- both point to the same EPA NRWQC total-PCBs chronic FCV concept
- they differ in how values are carried: one statically wired with HH+eco values, one dynamically
  resolved as an eco-direct stub

The EqP caveat is load-bearing: pairing the shared water FCV with high logKow 6.5 produces a less
stringent sediment benchmark than a lower-Kow representative. The correct key can depend on the site
congener/Aroclor profile, so consolidation needs explicit policy and provenance handling.

## Future Implementation Plan

Open a dedicated owner-gated PR only after confirming the catalog migration approach.

Recommended future sequence:

1. Inventory catalog rows keyed to `polychlorinated_biphenyls_total_pcbs`,
   `total_pcbs_aroclor_1254`, `polychlorinated_biphenyls_pcbs`, and `pcbs_non_coplanar`.
2. Decide whether aliasing is represented in code, catalog metadata, resolver logic, or docs only.
3. Preserve `total_pcbs_aroclor_1254` as the canonical runtime row unless the owner reverses the
   July 2 recommendation.
4. Do not delete catalog rows; re-key or alias them with before/after dry-runs.
5. Add tests proving:
   - the canonical Total-PCBs row remains selectable
   - no duplicate generic Total-PCBs row is presented unless intentionally scoped
   - dynamic eco FCV resolution still finds the approved 0.014 value
   - HH direct/food values do not become orphaned

## Current Autonomous-Run Status

Status: resolved as blocked for implementation.

No code should be written for this item under the current autonomous contract because the needed
work crosses into catalog identity and aliasing. The safe deliverable is this packet plus the backlog
map entry.
