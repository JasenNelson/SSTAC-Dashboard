# BN-RRM (Bayesian Network Relative Risk Model)

**Lifecycle:** REFERENCE
**Status:** Living reference for the dashboard-side BN-RRM feature.
**Authoritative current-status questions:** see `docs/INDEX.md`. Volatile counts (test totals, pack counts) live in `docs/_meta/docs-manifest.json` `facts` — not duplicated here.

## What this doc covers

The dashboard-side BN-RRM frontend, its pack model, the runtime artifact contract it consumes, and the boundary with the Regulatory Review (RR) engine that produces packs. It does **not** cover RR-side pack production internals — those live under `C:\Projects\Regulatory-Review\bnrrm_extraction` (RR repo).

## Feature overview

BN-RRM is a manifest-driven viewer for Bayesian Network Relative Risk Models. The dashboard renders model packs (DAG, CPTs, transparency JSON, optional spatial overlays) without hardcoding any per-model paths. Adding a new model means dropping a new pack folder under `public/bn-rrm/packs/` and registering it in `public/bn-rrm/pack-registry.json` — no code change.

UI entry point: the route under `src/app/(dashboard)/bn-rrm/` mounts `BNRRMClient.tsx`, which hydrates the pack store and renders feature components from `src/components/bn-rrm/**` (canvas, panels, review tabs, map, data tables, case studies, getting-started, CPT explorer).

## Pack model

A "pack" is a self-describing model bundle on disk under `public/bn-rrm/packs/<pack_id>/`. Two flavors of pack exist today, distinguished by `runtime_schema_version`:

- **`canonical-20node-v1`** — the original 20-node / 24-edge sediment DAG. `validatePackSchema()` enforces the node and edge counts exactly. Source: `src/lib/bn-rrm/pack-types.ts:290`.
- **`generic-bn-rrm-v1`** — flexible variant used by independently-reconstructed published models (the Jermilova mercury benchmark uses this). `validatePackSchema()` requires only `node_count > 0` and `edge_count > 0`.

Both flavors share the same `PackManifest` interface; only the count enforcement differs. Adding a third schema version means extending the `RuntimeSchemaVersion` literal type and adding a `case` in `validatePackSchema()`.

### Scope types

`scope_type` (declared in each `pack.json`) drives badging and the read-only rule:

| `scope_type`     | Badge                  | Read-only? |
|------------------|------------------------|------------|
| `general`        | "General"              | No         |
| `benchmark`      | "Benchmark (read-only)"| **Yes**    |
| `site_specific`  | "Site: {name}"         | No         |
| `experimental`   | "Experimental"         | No         |

The read-only rule is `isReadOnlyPack(manifest) === manifest.scope_type === 'benchmark'` (Source: `src/lib/bn-rrm/pack-types.ts:334`). Enforcement is **UI-layer only** — no TypeScript `readonly` modifier on pack types and no immutable-data wrapper. Components must check `isReadOnlyPack()` before rendering edit affordances.

### Release stage

`release_stage` (`scaffold` / `prototype` / `internal` / `review` / `published`) controls badge color and whether a banner is shown above the canvas. See `getReleaseBadge()` at `src/lib/bn-rrm/pack-types.ts:248`.

## Artifact contract

This is the dashboard-side contract for what a pack must contain. RR-side pack production must satisfy these requirements; otherwise the dashboard will fail to load the pack.

### Registry

`public/bn-rrm/pack-registry.json` is the single registry the dashboard fetches at startup. Schema:

```json
{
  "schema_version": "1.0",
  "default_pack_id": "<pack_id>",
  "packs": [
    {
      "pack_id": "...",
      "display_name": "...",
      "scope_type": "general | benchmark | site_specific | experimental",
      "release_stage": "scaffold | prototype | internal | review | published",
      "is_default": true | false,
      "path": "packs/<folder>"
    }
  ]
}
```

Loaded by `usePackStore.loadRegistry()` at `src/stores/bn-rrm/packStore.ts:87`. Exactly one pack should have `is_default: true` (the store warns if not).

### Pack manifest (`pack.json`)

Each pack folder must contain `pack.json` matching `PackManifest` (Source: `src/lib/bn-rrm/pack-types.ts:120`). Required keys include:

- `pack_id`, `display_name`, `model_family`, `scope_type`, `runtime_schema_version`
- `dag_node_count`, `dag_edge_count` — validated against `runtime_schema_version`
- `training_corpus`, `evaluation_profile`, `version_history`
- `release_stage`, `is_default`, `parent_pack_id`, `applicability_boundaries`
- `site_scope`, `site_inventory`
- `artifacts`: `runtime_model` (path), optional `training_data`, `review` (12 keys), optional `map`

Loaded by `usePackStore.selectPack()` at `src/stores/bn-rrm/packStore.ts:121`. `validatePackSchema()` runs on load.

### Review artifacts

Twelve review artifacts are declared per pack and lazy-loaded on demand (Source: `REVIEW_ARTIFACT_KEYS` at `src/lib/bn-rrm/pack-types.ts:165`):

`model_overview`, `validation`, `comparison`, `decisions`, `cpt_transparency`, `provenance`, `site_reports`, `risk_comparison`, `explainer`, `sensitivity`, `published_reference`, `comparison_results`.

Components consume them via `usePackArtifact<T>(key)` at `src/hooks/bn-rrm/usePackArtifact.ts:24`. The hook caches per-key, clears stale data on pack change, and waits for the new manifest before fetching.

### Map artifacts (optional)

For packs with spatial overlays, `artifacts.map` declares GeoJSON paths relative to the pack base URL. Twelve keys are recognized (Source: `MAP_ARTIFACT_KEYS` at `src/lib/bn-rrm/pack-types.ts:186`):

`basins_gsl`, `basins_gbs`, `advisory_lakes`, `commercial_fisheries`, `historic_mines`, `large_mines`, `mineral_claims`, `oil_gas_claims`, `hydro_facilities`, `communities`, `climate_stations`, `thaw_slumps`.

Each maps to a category for legend grouping in `MAP_ARTIFACT_CATEGORIES`. Only declared keys are loaded — packs without overlays simply omit the `map` block.

### Pack base URL

`/bn-rrm` is the public base URL (`PACK_BASE_URL` at `src/stores/bn-rrm/packStore.ts:27`). The registry lives at `/bn-rrm/pack-registry.json`; each pack's manifest is at `/bn-rrm/packs/<folder>/pack.json`; review and map artifact paths are resolved relative to the pack folder.

## Read-only-pack rules

A pack with `scope_type: 'benchmark'` is read-only. Concretely:

- The UI must not present any edit affordance (CPT editing, node addition/deletion, evidence injection) when `isReadOnlyPack(manifest)` is true.
- The transparency banner from `getReleaseBadge()` is the user-facing signal.
- Enforcement is convention, not type-system: any new edit feature must call `isReadOnlyPack()` itself.

## RR boundary

- The dashboard does **not** generate packs. RR's `bnrrm_extraction` pipeline produces them and writes them under `public/bn-rrm/packs/` (path on the dashboard side).
- The dashboard does not read any RR engine database for BN-RRM. Pack contents are static JSON / GeoJSON served from `public/`.
- Schema source-of-truth lives in the RR `pack_schema/` directory referenced by `src/lib/bn-rrm/pack-types.ts:7-9`. The TypeScript interfaces in `pack-types.ts` mirror that schema; if the RR-side schema changes, `pack-types.ts` must be updated and `validatePackSchema()` extended.

For the cross-repo handoff contract, see the RR-side `BNRRM_HANDOFF.md`. The dashboard never references RR-side files at runtime; only build-time / pack-prep coordination matters.

## Adding a new pack

1. RR side: produce a pack folder containing `pack.json` plus the artifact files it references.
2. Copy or symlink the folder to `public/bn-rrm/packs/<pack_id>/` on the dashboard.
3. Add a `packs[]` entry to `public/bn-rrm/pack-registry.json`.
4. Verify in browser: registry loads, pack appears in selector, `validatePackSchema()` does not throw, declared review artifacts resolve.
5. If introducing a new `runtime_schema_version`, extend `RuntimeSchemaVersion` and `validatePackSchema()` first.

## Cross-references

- Type contract: `src/lib/bn-rrm/pack-types.ts`
- Pack store: `src/stores/bn-rrm/packStore.ts`
- Lazy artifact hook: `src/hooks/bn-rrm/usePackArtifact.ts`
- Components: `src/components/bn-rrm/**`
- Static pack data: `public/bn-rrm/`
- Built-in transparency JSON for the canonical pack: `src/data/bn-rrm/transparency/`
- Dashboard learned-model data: `src/data/bn-rrm/learned-model.json`
- RR-side handoff: `BNRRM_HANDOFF.md` (RR repo)
