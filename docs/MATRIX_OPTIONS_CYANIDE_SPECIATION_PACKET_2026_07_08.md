# Matrix Options Cyanide Speciation Packet - 2026-07-08

## Verdict

Do not implement cyanide/speciation code changes during the autonomous run.

The older "cyanide speciation" backlog item is partly stale: the `inorganic` class and the cyanide
runtime entries have already landed. The remaining work is a policy/UX selection convention for
overlapping cyanide and silver-cyanide substances, not a missing code wiring task.

## Current Runtime Evidence

`src/lib/matrix-options/types.ts` already includes:

```ts
| 'inorganic'
```

`src/lib/matrix-options/substanceLibrary.ts` includes wired cyanide-family entries:

- `chlorine_cyanide`: RfD `0.05`, class `inorganic`
- `cyanogen`: RfD `0.001`, class `inorganic`
- `cyanogen_bromide`: RfD `0.09`, class `inorganic`
- `calcium_cyanide`: RfD `0.001`, class `inorganic`
- `copper_cyanide`: RfD `0.005`, class `inorganic`
- `cyanide_free`: RfD `0.00063`, class `inorganic`
- `hydrogen_cyanide_and_cyanide_salts`: RfD `0.0006`, class `inorganic`
- `potassium_cyanide`: RfD `0.002`, class `inorganic`
- `potassium_silver_cyanide`: RfD `0.005`, class `inorganic`
- `silver_cyanide`: RfD `0.1`, class `inorganic`
- `sodium_cyanide`: RfD `0.001`, class `inorganic`

`src/lib/matrix-options/__tests__/substanceLibrary.test.ts` asserts the cyanide-salts cohort values
and classes, including the eight 2026-07-04b cyanide-salt entries.

## What Remains Open

The open issue is not whether these can compute. They can: as `inorganic`, they follow the default
non-PAH/non-MeHg calculation path, with HH-only fields and no eco pathway.

The open issue is how users should choose among overlapping keys:

### `cyanide_free` vs `hydrogen_cyanide_and_cyanide_salts`

- `cyanide_free`: `0.00063`
- `hydrogen_cyanide_and_cyanide_salts`: `0.0006`

These values are nearly identical and likely overlap as free-CN / HCN+CN- representations. Presenting
both without guidance risks double counting or arbitrary selection.

### Silver cyanide family

- generic `silver`: `0.005` (existing non-cyanide silver key)
- `potassium_silver_cyanide`: `0.005`
- `silver_cyanide`: `0.1`

This creates a three-way silver-adjacent selection problem. `silver_cyanide` is 20x less stringent
than generic silver and potassium silver cyanide. That may be chemically defensible, but it needs an
explicit selection convention so users do not pick the wrong silver/cyanide representation.

### `copper_cyanide` vs generic `copper`

`copper_cyanide` is an own-key cyanide-salt entry with RfD `0.005`. It should not be silently treated
as additive with a generic copper assessment unless the assessment is actually for both copper and
cyanide components. This is a user-selection/speciation convention issue.

## Recommended Future Work

Create a narrow "cyanide selection guidance" PR, not a value-wiring PR.

Possible implementation surfaces, from lowest to highest risk:

1. Add clearer notes/provenance text in `SUBSTANCE_LIBRARY` entries explaining umbrella vs speciated
   cyanide keys.
2. Add UI helper text or warning chips when selecting cyanide-family substances.
3. Add a grouping/alias metadata layer so the UI can warn when multiple related cyanide keys are
   selected or compared.

Preferred first increment:

- docs/design packet plus UI copy proposal only.
- No value changes.
- No `qa_status` / `default_status` changes.
- No catalog mutation.

## Non-Goals

Do not:

- remove any cyanide key
- re-rank defaults
- change the wired RfDs
- change `qa_status` or `default_status`
- collapse `cyanide_free` into `hydrogen_cyanide_and_cyanide_salts` without owner approval
- collapse silver cyanide entries into generic silver without owner approval

## Current Autonomous-Run Status

Status: resolved as policy/UX backlog.

No code change is appropriate under the current autonomous contract. The safe deliverable is this
packet and an updated backlog map entry.
