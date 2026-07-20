# Option C -- Site-Level Aggregate Publication Design (2026-07-20)

DESIGN ONLY. This is not a build, and it publishes nothing. It exists to make the next
implementation decision crisp. Building any part of it is OWNER-GATED and requires a strategic
`/codex-review` plus owner approval before any code or migration.

Companion documents:
- `docs/MATRIX_MAP_CENTROID_PUBLICATION_DECISION_PACKET_2026-07-20.md` -- the decision and its
  correction banner. Read that first.
- `docs/design/matrix-map/DRA_PUBLICATION_PATH_DESIGN_2026_07_11.md` -- the audited
  `flip_dra_public` path and its risk register R1-R8. This document extends that register; it does
  not replace it.

---

## 1. Current stance (unchanged by this document)

**No DRA publication now.** The map stays at 40 member-visible samples until the owner rules on
centroid publication policy. This document does not request a flip, and choosing to read it does not
commit the owner to Option C.

---

## 2. Why DRA-level flips are unsafe today

`matrix_map.flip_dra_public(p_dra_id, p_new_value, p_actor_id, p_reason)` updates **only**
`matrix_map.dras.public`. It touches no sample rows.

Member visibility is decided by RLS policy `samples_authenticated_select`:

```
is_email_allowlisted(jwt email)
AND source_dra_id IS NOT NULL
AND EXISTS (dras d WHERE d.id = samples.source_dra_id
            AND d.is_deleted = false
            AND (d.public = true OR matrix_map.has_private_grant(d.id)))
```

Visibility is therefore **DRA-granularity**. A flip exposes *every* sample beneath that DRA,
regardless of `coordinate_quality_tier`. There is no supported way to publish one tier and withhold
another.

This is what blocked the retracted "publish 4 surveyed DRAs" action (PR #709): those 4 DRAs are
mixed-tier, so the flip would have published 1197 samples rather than the intended 28.

**Design consequence:** any option that intends to show centroid *locations* without exposing
centroid *sample rows* cannot be built on `flip_dra_public` alone.

---

## 3. Point-in-time facts

All figures re-derived read-only against `origin/main` = `e0ccd7c1`, 2026-07-20. **These are
point-in-time and MUST be re-derived before any implementation or publication decision** -- the
appendix in this document's section 9 carries the queries (Q1-Q6).

| Fact | Value |
|---|---|
| DRAs total / public | 574 / 5 |
| Samples total / member-visible | 4494 / 40 |
| DRA-attached centroid-tier samples (publishable population) | **4418** |
| Distinct centroid DRAs | **118** |
| Distinct centroid coordinate points | **118** -- globally distinct (Q3), so exactly one per DRA and no two DRAs share a point |
| Centroid-tier orphans (`source_dra_id IS NULL`) | **8**, all medium-tier (Q2) -- out of publication scope; no DRA to flip |
| The 4 mixed-tier DRAs (retracted candidates) | **28 high + 1169 medium = 1197** |

The 1169 are a **subset** of the 4418, and the 4 DRAs are **members** of the 118 -- not additions to
either. There is one population, not two.

**Stacking distribution across the 118 centroid DRAs** (this is what the aggregate layer must
absorb):

| Metric | Value |
|---|---|
| min / median / mean / max samples per DRA | 1 / **9** / 37.4 / **476** |
| DRAs with >= 100 samples | 9 |
| DRAs with exactly 1 sample | 6 |

The distribution is heavily skewed: the mean is four times the median. A design tuned only for the
average case will render badly at both ends, so the marker must read sensibly at N=1 and N=476.

---

## 4. Option C defined precisely

**Publish one aggregate marker per centroid DRA, instead of per-sample centroid pins.**

Because each of the 118 centroid DRAs collapses to exactly one coordinate, the aggregate unit and
the coordinate cluster coincide today: 118 markers for 118 known locations. The design still keys on
a cluster rather than assuming 1:1, so it survives future coordinate enrichment that splits a DRA
across several points.

What a viewer sees: a marker at the approximate site location, visually distinct from a surveyed
sample point, labelled with how many samples the site carries -- not N coincident pins implying N
sampling locations.

**Why this is honest by construction.** The stacking hazard is a property of marker *geometry*, not
of labelling. 476 coincident pins read as 476 locations no matter what the popup says. One marker
carrying "476 samples" states the same information without the false spatial signal. This is the
reason Option C is preferred over Option B, and no badge or disclaimer substitutes for it.

**What Option C is NOT:** it is not a way to smuggle centroid sample rows to clients under a
different shape. If the aggregate is derived client-side from published sample rows, nothing has
been contained. See section 6.

---

## 5. Design-level data model and API

Design level only -- no DDL, no migration, no route implementation is proposed here.

### 5.1 Aggregate unit key

Key on `(source_dra_id, coordinate_cluster_id)` where `coordinate_cluster_id` is a deterministic
function of the rounded representative coordinate (5 decimal places, matching the precision used to
establish the 118-point count).

- Today this yields exactly one cluster per DRA.
- Keying on the pair rather than on `source_dra_id` alone means a DRA whose coordinates are later
  enriched into several true locations splits into several markers without a schema change.
- Rounding precision is a **design decision to confirm**: 5 dp is about 1 m at BC latitudes, which is
  far finer than a site centroid warrants. A coarser key would be more honest but changes counts.

### 5.2 Marker fields (the aggregate projection)

| Field | Purpose | Notes |
|---|---|---|
| `aggregate_id` | stable key | derived from the unit key above |
| `source_dra_id` | provenance | the DRA the site belongs to |
| `display_name` | label | DRA title, or a site name once one exists |
| `representative_latitude` / `_longitude` | placement | the shared centroid coordinate |
| `coordinate_quality_tier` | honesty | always `medium` for this layer |
| `coordinate_source` | provenance | carried through unchanged |
| `sample_count_total` | the number in the label | |
| `sample_count_high` / `_medium` | tier breakdown | makes mixed-tier sites legible |
| `measurement_count` | optional depth signal | defer if it complicates the query |
| `bc_region`, `waterbody`, `waterbody_type` | filtering | reuse existing columns |

**Deliberately excluded:** any per-sample identifier, any measurement value, any station id. The
aggregate must not be a join key back to unpublished sample rows. If a client can enumerate the
underlying samples from what the aggregate returns, the containment has failed.

### 5.3 Counts by tier

`sample_count_high` and `sample_count_medium` must be computed over **all** samples in the unit,
including ones the caller cannot see individually. This is intentional and is the one place the
design deliberately discloses information about non-visible rows -- an aggregate count, never row
content. Note this is exactly the shape of a previously-identified hazard
(`feedback_bbox_scoped_private_aggregate_is_a_spatial_oracle`): see section 6.3.

### 5.4 Representative coordinate and source

Use the shared coordinate directly while clusters are 1:1 with DRAs. When a cluster later contains
several distinct coordinates, the representative must be a **documented, deterministic choice** (for
example the centroid of the cluster) and never a silent "first row wins" -- otherwise the marker
moves when unrelated rows change.

### 5.5 Publication and audit semantics

This is the crux, and it is **an owner decision, not a design default.** Two shapes:

**(a) Derived-visibility (no new state).** The aggregate layer shows a site whenever its DRA would
already be visible. Adds no new publication surface and no new audit obligation, but it publishes
nothing new either -- with 5 public DRAs it renders 4 markers. It only becomes useful in combination
with a publication decision.

**(b) Independent aggregate publication (new state).** A site becomes visible as an aggregate
without its samples becoming visible. This is the shape that actually delivers Option C's value: it
would let all 118 sites appear as markers while every centroid sample row stays private.

Shape (b) requires a **new audited publication primitive** -- a sibling of `flip_dra_public`, with
the same guarantees: actor-must-equal-caller, admin/matrix_admin role, non-empty reason, atomic
update plus audit insert, no-op when unchanged, and an enforcement trigger so no unaudited path can
set the flag. Reuse the `dra_visibility_audit` pattern or add a parallel audit table; do not invent
a weaker one.

**Recommendation:** shape (b), because shape (a) does not solve the problem the owner is actually
choosing about. But (b) is a new production write path and must not be built until section 6's
review items are cleared.

### 5.6 Map UI behaviour

- Aggregate markers render in the existing centroid visual language: reuse
  `src/lib/matrix-map/coordinate-provenance.ts` (`COORD_TIER_LABEL`, `COORD_TIER_CAPTION`,
  `COORD_TIER_DASH_ARRAY`). Do not invent new tier vocabulary.
- Marker size may scale with `sample_count_total`, but must stay legible at N=1 and must not imply
  spatial extent -- a bigger circle should not read as a bigger contaminated area. If that ambiguity
  cannot be resolved visually, keep the size constant and put the count in the label.
- Popup states plainly that the point is an approximate site location, not a sample location, and
  reports the tier breakdown. The existing centroid caption already says this; reuse it verbatim.
- The existing "Surveyed only" filter must hide the aggregate layer, since it is entirely
  centroid-tier.
- The legend gains one entry for the aggregate layer. Note the legend currently hardcodes its three
  tier rows rather than deriving them from the shared constants -- worth fixing in the same PR.
- Aggregate markers and surveyed sample pins must be visually distinguishable from each other, not
  only from the background.

### 5.7 Admin preview and preflight

- **SHIPPED 2026-07-20.** The admin preview renders the aggregate layer over the full 118 sites
  **without publishing anything**, so the owner can see exactly what Option C looks like before
  ruling. Table + summary landed in PR #711; the Leaflet map (118 markers + legend) in PR #712;
  admin-tier e2e in a separate PR this session.
- As predicted, it was read-only and separable from the publication primitive -- it was built as a
  server component with no HTTP endpoint, so the oracle constraint (s6.3) holds by construction.
- Any future publication action reuses the mandatory preflight in the decision packet's section 9:
  group by DRA, count both tiers, and hard-stop on unexpected tier mixes.

---

## 6. Security and RLS implications

### 6.1 `samples.public` is NOT an access-control lever -- verified, and it is a trap

Verified 2026-07-20 against live catalogs:

- Neither policy on `matrix_map.samples` references it. `samples_authenticated_select` gates on
  `d.public` / `has_private_grant`; `samples_admin_all` gates on role.
- `matrix_map.fetch_samples_with_hidden_summary` **does** reference `s.public` -- but only in a
  SELECT projection list. Every gating predicate in that function uses `d.public` or
  `has_private_grant(d.id)`.

So `samples.public` is **read and returned to clients, while having zero effect on what is
returned.** That is worse than an unused column: an implementer who sees it in the payload may
reasonably assume writing it restricts visibility. It does not.

**Do not build tier-aware visibility on `samples.public` until its intended role is resolved by the
owner.** Either wire it deliberately (with policy changes and a review) or remove it from the
projection so it stops implying a capability it lacks.

### 6.2 Can Option C be read-side only?

- Shape (a): yes, read-side only.
- Shape (b): **no.** It introduces new publication state and therefore a new audited write path,
  new RLS, and a new trigger.

Anyone proposing "just add an aggregate endpoint" should be asked which shape they mean. The
read-side framing is only honest for (a).

### 6.3 The aggregate-oracle hazard (highest risk in this design)

An aggregate over rows the caller cannot see is an information channel. The standing lesson
`feedback_bbox_scoped_private_aggregate_is_a_spatial_oracle` (codex P1, 2026-06-23) is directly on
point: a private aggregate that can be **filter-scoped or bbox-scoped by the caller** becomes a
spatial oracle -- repeated narrowing queries recover the locations of hidden rows.

Binding constraints for any implementation:

- Aggregate counts must be computed over a **fixed, caller-independent grouping** (the site unit).
- The aggregate endpoint must **not** accept caller-supplied bbox, radius, or arbitrary filter
  parameters that scope the hidden-row counts.
- Only rows the caller may already see may be filter-scoped.
- If viewport-scoped delivery is needed for performance, return **pre-computed per-site rows** and
  filter client-side, rather than letting the server recompute counts under a caller-supplied bbox.

This is the item most likely to fail review if it is not designed in from the start.

### 6.4 Inherited risks from the prior design

From `DRA_PUBLICATION_PATH_DESIGN_2026_07_11.md`, with current status:

| Risk | Status 2026-07-20 |
|---|---|
| R1 mass-publish blast radius | **Amplified.** Option C shape (b) makes 118 sites publishable; no bulk-publish-all, per-site confirm, same as v1 |
| R2 direct-UPDATE bypasses audit | **CLOSED.** Trigger `trg_dras_public_flip_only` (`enforce_dras_public_via_flip`) exists and is enabled. Any new primitive needs the equivalent |
| R3 role-check duplication drift | Still applies; reuse `requireMatrixMapAdmin`, not generic `requireAdmin()` |
| R4 failed-attempt audit gaps | Still applies |
| R5 CSRF | Still applies; reuse `checkCsrf` |
| R6 stale visibility caches | Still applies |
| R7 over-exposure to all members | Still applies -- publication is to every allowlisted member, not a subset |
| R8 `matrix_admin` role | Re-verify row count before relying on it |

### 6.5 Must be reviewed before ANY implementation

1. Strategic `/codex-review` of this design, with the oracle hazard (6.3) called out explicitly.
2. Owner ruling on publication semantics: shape (a) vs (b).
3. Owner ruling on `samples.public`: wire it, or remove it from the projection.
4. Confirmation that a new publication primitive is wanted at all, versus deferring to Option D.
5. Security review of any new RLS policy, RPC, and trigger before migration.

---

## 7. Acceptance criteria for a future implementation PR

A PR implementing any part of this must satisfy all of the following.

**Correctness**
1. Exactly one aggregate marker per `(source_dra_id, coordinate_cluster_id)`; with current data that
   is 118 markers for the centroid population.
2. `sample_count_high + sample_count_medium = sample_count_total` for every unit.
3. Totals reconcile against **this document's** section 9 queries (Q1-Q6, all six) at implementation
   time -- not against the point-in-time numbers in section 3. Note the decision packet also has a
   section 9 (its publication preflight); these are different checklists and both apply.
4. Orphan samples (`source_dra_id IS NULL`) appear in no aggregate.
5. The representative coordinate is deterministic and stable across repeated runs.

**Containment**
6. The aggregate payload exposes no per-sample identifier, station id, or measurement value.
7. No caller-supplied bbox, radius, or filter parameter scopes any count over non-visible rows
   (see 6.3).
8. An unauthenticated caller receives nothing; `anon` retains zero access to schema `matrix_map`.
9. A member who cannot see a DRA's samples cannot enumerate them via the aggregate.

**Publication (shape (b) only)**
10. Aggregate visibility can be toggled only through an audited primitive; no unaudited path can set
    it, enforced by trigger.
11. Every toggle writes an audit row including actor, prior value, new value, and reason.
12. Toggling aggregate visibility does **not** change `dras.public` and does not make any sample row
    visible.

**UI**
13. The aggregate layer is visually distinct from surveyed sample pins, using shape or pattern, not
    colour alone.
14. Popups state the point is an approximate site location, reusing the existing caption verbatim.
15. "Surveyed only" hides the aggregate layer entirely.
16. Legible at N=1 and N=476.

**Process**
17. Full 6-gate suite green, monitored build only -- never raw `npm run build`.
18. `/codex-review` to mutual-agreement GREEN.
19. No data write or publication performed by the PR itself.

## 8. Test plan

**Unit** -- aggregation grouping (1:1 and a synthetic multi-cluster DRA); tier-count arithmetic;
orphan exclusion; representative-coordinate determinism; N=1 and N=476 label formatting.

**Integration / RLS** -- fixtures for admin, allowlisted member with a grant, allowlisted member
without, and anon. Assert each sees the correct aggregate set and that no path returns per-sample
identifiers. Include a **negative oracle test**: attempt to narrow counts via any exposed parameter
and assert it is impossible.

**E2E** -- extend `e2e/mo-map-access.spec.ts`, which already reaches the mounted map embed. Assert
the aggregate layer renders, the legend entry exists, and "Surveyed only" hides it. Follow the
existing `admin-tier-rbac.spec.ts` convention of failing loudly rather than skipping when a fixture
is missing.

**Regression** -- surveyed-sample rendering, the existing 40-sample visible set, and CSV export
must be unchanged. Never delete a regression test to make a gate pass.

## 9. Re-derivation queries (read-only)

Every gated fact in section 3 has a query below. **Run all six (Q1-Q6); none is optional.** Each is
annotated with the value it returned on 2026-07-20 so drift is obvious.

Q6 is the most load-bearing of the set, not an afterthought: if the visibility path is no longer
DRA-level, the population model in section 3 and the containment argument in section 6 both have to
be re-read from scratch. Run Q6 even if Q1-Q5 match exactly.

```sql
-- Q1: headline population.  Expected 2026-07-20:
--   574 / 5 / 4494 / 40 / 4418
select
  (select count(*) from matrix_map.dras) as dras_total,
  (select count(*) from matrix_map.dras where public) as dras_public,
  (select count(*) from matrix_map.samples) as samples_total,
  (select count(*) from matrix_map.samples s join matrix_map.dras d on d.id=s.source_dra_id
    where d.public) as samples_visible,
  (select count(*) from matrix_map.samples s join matrix_map.dras d on d.id=s.source_dra_id
    where d.public=false and s.coordinate_quality_tier='medium') as centroid_attached;

-- Q2: orphans BY TIER (not just total).  Expected: 8 / 8 / 0.
-- Proves the "8 centroid-tier orphans" claim rather than assuming all orphans are medium.
select
  count(*) as orphans_all,
  count(*) filter (where coordinate_quality_tier = 'medium')  as orphans_medium,
  count(*) filter (where coordinate_quality_tier <> 'medium') as orphans_non_medium
  from matrix_map.samples where source_dra_id is null;

-- Q3: GLOBAL distinctness of the centroid points.  Expected: 118 / 118, i.e. equal.
-- Proves no two centroid DRAs share a coordinate, which is what makes the aggregate unit
-- 1:1 with the DRA today. If these diverge, the (dra, cluster) key stops being 1:1 and
-- section 5.1's cluster keying becomes load-bearing rather than future-proofing.
select
  count(distinct (round(s.latitude::numeric,5)||','||round(s.longitude::numeric,5))) as globally_distinct_points,
  count(distinct s.source_dra_id) as centroid_dras
  from matrix_map.samples s join matrix_map.dras d on d.id = s.source_dra_id
 where d.public = false and s.coordinate_quality_tier = 'medium';

-- Q4: the prospective aggregate units and their stacking.
-- Expected 2026-07-20: 118 rows; n min 1 / median 9 / mean 37.4 / max 476; pts = 1 for every row.
select s.source_dra_id, count(*) as n,
       count(distinct (round(s.latitude::numeric,5)||','||round(s.longitude::numeric,5))) as pts
  from matrix_map.samples s join matrix_map.dras d on d.id = s.source_dra_id
 where d.public = false and s.coordinate_quality_tier = 'medium'
 group by s.source_dra_id order by n desc;

-- Q5: the 4 retracted mixed-tier DRAs, and the SUBSET/MEMBERSHIP claims in section 3.
-- Expected: 4 rows totalling 28 high + 1169 medium = 1197;
--           medium_in_the_4 = overlap_with_4418 = 1169  (subset, not addition);
--           of_which_in_the_118 = 4                     (members, not additions).
with target(id) as (values
  ('35626cb0-2413-40c1-8951-a2857b4272bc'::uuid),
  ('c2d6a380-4f3a-47a8-b773-1659436e7b36'::uuid),
  ('a3b95869-4fe8-43fd-8c39-2afc8fa9266e'::uuid),
  ('11f00164-2ba7-4f95-9034-18815e8a31f6'::uuid))
select
  (select count(*) from matrix_map.samples where source_dra_id in (select id from target)
     and coordinate_quality_tier='high')   as high_in_the_4,
  (select count(*) from matrix_map.samples where source_dra_id in (select id from target)
     and coordinate_quality_tier='medium') as medium_in_the_4,
  (select count(*) from matrix_map.samples where source_dra_id in (select id from target))
                                           as total_in_the_4,
  (select count(*) from matrix_map.samples s join matrix_map.dras d on d.id=s.source_dra_id
    where d.public=false and s.coordinate_quality_tier='medium'
      and s.source_dra_id in (select id from target)) as overlap_with_4418,
  (select count(*) from (
     select distinct s.source_dra_id from matrix_map.samples s
       join matrix_map.dras d on d.id=s.source_dra_id
      where d.public=false and s.coordinate_quality_tier='medium'
        and s.source_dra_id in (select id from target)) x) as of_which_in_the_118;

-- Q6: confirm the visibility path is still DRA-level before trusting ANY of the above.
-- Expected: samples_authenticated_select gates on d.public / has_private_grant, and NO
-- policy references samples.public.  If this changes, the whole design must be re-read.
select policyname, cmd, qual from pg_policies
 where schemaname='matrix_map' and tablename='samples';
```

**Reading the results.** Q3's two columns must be EQUAL. Q5's `medium_in_the_4` must equal
`overlap_with_4418` (subset) and `of_which_in_the_118` must equal 4 (membership). If either fails,
the section 3 population model is wrong and no publication decision should proceed on it.

---

## 10. Scope note

Nothing in this document authorises a publication, a migration, a schema change, or an app change.
The next step is a design review and an owner ruling, not an implementation.
