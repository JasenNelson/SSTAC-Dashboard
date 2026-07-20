# Matrix Map -- Centroid Publication Decision Packet (2026-07-20)

> ## CORRECTION 2026-07-20 -- OPTION A IS BLOCKED. READ THIS FIRST.
>
> This packet originally recommended "Option A now": publish 4 surveyed DRAs, 28 samples,
> "no new policy needed", 40 -> 68 member-visible. **That recommendation was wrong and must not be
> executed.** A read-only preflight against live data before any flip found the premise false.
>
> **The 4 DRAs are not surveyed-only. They are mixed-tier.**
>
> | DRA ID | Title | `public` | high | medium | total |
> |---|---|---|---|---|---|
> | `35626cb0-2413-40c1-8951-a2857b4272bc` | ERA Volume 4 -- Mark Creek and Lois Creek | false | 20 | 35 | 55 |
> | `c2d6a380-4f3a-47a8-b773-1659436e7b36` | LTR Response to ENV comments, DHHERA | false | 5 | 413 | 418 |
> | `a3b95869-4fe8-43fd-8c39-2afc8fa9266e` | HHERA_FINAL | false | 2 | 245 | 247 |
> | `11f00164-2ba7-4f95-9034-18815e8a31f6` | Old Slope Place HHERA | false | 1 | **476** | 477 |
> | | **Total** | | **28** | **1169** | **1197** |
>
> **Why that blocks the action.** `matrix_map.flip_dra_public` updates only
> `matrix_map.dras.public`; it touches no sample rows. Member visibility is decided by RLS policy
> `samples_authenticated_select`, which gates on
> `d.public = true OR matrix_map.has_private_grant(d.id)` -- **DRA granularity**. Flipping a DRA
> publishes every sample beneath it, regardless of coordinate tier.
>
> | | Original claim | Verified actual |
> |---|---|---|
> | Samples published | 28 | **1197** |
> | Member-visible after | 40 -> 68 | **40 -> 1237** |
> | Centroid samples published | 0 | **1169** |
>
> Three consequences:
> 1. It would **silently enact Option B** -- the option this same packet does not recommend --
>    without Decision 2 ever being ruled on.
> 2. Those 1169 centroid samples sit on just **4 distinct coordinates** (about 292 pins per point),
>    a more extreme case of the stacking problem than the province-wide 37.4 average in section 3.
> 3. It includes **Old Slope Place**, which is the very DRA behind section 3's "476 samples on one
>    coordinate" warning.
>
> **There is no DRA-granularity path that publishes only the surveyed samples.** The claim "Option A
> needs no new policy" is false.
>
> **`samples.public` exists but is NOT consulted** by `samples_authenticated_select` (nor by the only
> other policy on the table, `samples_admin_all`). Whether that column is vestigial or
> intended-but-unwired is UNRESOLVED and must be investigated before any tier-aware approach is
> designed on top of it.
>
> **Status: no publication is approved.** Corrected below: section 4 (Option A withdrawn), section 5
> (recommendation withdrawn), section 8 (two decisions collapse to one), plus a new mandatory
> preflight in section 9. Sections 2, 3, 6 and 7 remain valid as written.
>
> Root cause, recorded so it is not repeated: the original analysis grouped samples by
> `(public, coordinate_quality_tier)` and read "28 high-tier samples across 4 DRAs" as "4 surveyed
> DRAs". It never checked whether those DRAs also contained other tiers. The document was internally
> consistent, which is why review did not catch it -- the defect was in the premise, not the
> reasoning. **Verify a publication unit against the schema's actual visibility granularity, not
> against an aggregate query.**

**1. The decision.**

A determination is required on whether the 4418 **publishable** centroid-tier samples should become
member-visible on the map, and if so, in what form. "Publishable" here means centroid-tier samples
attached to a DRA, which is what makes them eligible for a `flip_dra_public` publication. Total
centroid-tier storage is 4426; the other 8 are orphans with no `source_dra_id`, so there is no DRA
to flip and they are out of scope for this decision (they are tracked separately as a data-hygiene
item). 

Note that the map currently displays 40 of 4494 total samples to members. 
This access is member-gated, not anonymous-public.

**Full reconciliation of the 4494 samples** (these four buckets are exhaustive and non-overlapping):

| Bucket | Coordinate tier | Samples | Visible today |
|---|---|---|---|
| Published DRAs | high (surveyed) | 40 | yes |
| Unpublished, surveyed | high (surveyed) | 28 | no |
| Unpublished, centroid | medium (centroid) | 4418 | no |
| Orphans (null `source_dra_id`) | medium (centroid) | 8 | no -- invisible to everyone, including admins |
| **Total** | | **4494** | **40** |

Note that the 8 orphan samples are ALSO centroid-tier, so total centroid-tier is 4426, not 4418.
Surveyed-tier totals 68. Do not compute "non-centroid" as 4494 minus 4418.

**2. What a centroid actually is here.**

A BC-CSR approximate site centroid marks the approximate centre of a contaminated site. 

It is NOT the true location where a specific sediment sample was taken. 

Using these centroids means we are representing a general area rather than a precise sample point.

**3. The stacking problem.**

The decisive finding from our analysis is that the 118 DRAs with centroid-tier coordinates resolve to exactly 118 distinct coordinate points. 

This means every sample within a given DRA shares one identical coordinate. 

On average, there are 37.4 samples stacked per distinct point, and the worst single DRA stacks 476 samples on one coordinate. 

Rendering centroid samples as per-sample markers would place 4418 pins on 118 real locations, up to 476 perfectly coincident pins at one site. 

This is not merely imprecise -- a dense cluster of pins reads to a viewer as many distinct sampling locations, so the naive rendering would actively overstate both spatial precision AND sampling density.

**4. Options.**

There are four options for handling these centroids. 
Each details what the map would show, the risk, and the effort:

- ~~**Option A -- surveyed only (status quo+).**~~ **WITHDRAWN 2026-07-20 -- NOT EXECUTABLE.**
  ~~Publish the unpublished surveyed data: 28 samples across 4 DRAs. No new policy is needed.~~
  Both claims are false. The 4 DRAs are mixed-tier (28 high + 1169 medium), and visibility is
  DRA-granularity, so this flip publishes 1197 samples and DOES require the centroid-publication
  ruling. See the correction banner. Option A survives only as an intent -- "publish the surveyed
  data and nothing else" -- which is unreachable today and is what the tier-aware visibility option
  in section 8 would have to build.

- **Option B -- publish centroids as per-sample markers, with a tier badge.** 
  The map would show all 4418 centroid samples as individual points alongside the existing public ones.
  This offers the highest apparent coverage.
  However, it inherits the full stacking problem detailed in section 3.

- **Option C -- publish centroids as ONE site-level marker per DRA (RECOMMENDED).** 
  This adds 118 additional map points, each labelled as an approximate site location carrying N samples. 
  This is honest by construction: 118 points for 118 known locations. 
  It conveys real coverage without implying per-sample positions.

- **Option D -- coordinate upgrade first.** 
  Extract true coordinates via the OCR lane before publishing anything. 
  This offers the highest fidelity.
  However, it is the slowest path and requires attended sessions.

**5. Recommendation (CORRECTED 2026-07-20).**

~~We recommend Option A now, then Option C.~~ **Withdrawn.** Option A as written is not executable:
see the correction banner. The 4 candidate DRAs are mixed-tier, and `flip_dra_public` publishes at
DRA granularity, so "publish 28 surveyed samples via 4 DRA flips" would in fact publish 1197 samples
including 1169 centroid-tier.

**Corrected recommendation: make no publication now.** The next decision is policy and product, not
execution. Option A is no longer a free, ruling-free move that could be taken ahead of Decision 2 --
it *is* Decision 2, in disguise and at a worse stacking ratio.

Option C remains the recommended eventual direction: it resolves the stacking problem by
construction rather than papering over it with a disclaimer.

Option B's risk is still not fixable by a badge alone, because the misleading signal is the marker
geometry itself, not the missing label. That reasoning is unchanged, and it now applies to the
4-DRA flip as well.

**6. Mitigations -- 3 of the 4 REQUIRED mitigations are already built.**

Counting basis: four mitigations are required for any centroid publication. Three are already
shipped; one (statistics exclusion) is not. Additional capability shipped beyond those four is
listed separately as "bonus" and is not part of the 4.

Verified against origin/main (dddbe0f4) 2026-07-20. This materially lowers the cost of any option,
and it was NOT known when this decision was first framed.

Already shipped (via PRs #593, #600, #635), all sharing one vocabulary source,
`src/lib/matrix-map/coordinate-provenance.ts`:

- DONE -- Distinct visual encoding that does not rely on colour. Markers are differentiated by
  stroke pattern via `COORD_TIER_DASH_ARRAY`: solid = Surveyed, dashed = Centroid, dotted = Manual.
  This is shape-based, so it survives colour-blindness.
- DONE -- A persistent map legend with one entry per tier.
- DONE -- An explicit popup statement. `COORD_TIER_CAPTION` for the centroid tier already reads:
  "Approximate BC CSR site centroid -- not a surveyed sediment location."
Still outstanding (the 4th required mitigation):

- NOT DONE -- Exclusion of centroid rows from station-level statistics. This is the separate T20
  stats-tier ruling and remains open.

Bonus capability already shipped, over and above the 4 required mitigations: a "Surveyed only"
filter toggle, a province-wide provenance chip, and a coordinate-quality column in both the CSV
export and the reporting panel.

Consequence for the decision: the honest-labelling layer is in place today, so the residual risk of
publishing centroids is concentrated almost entirely in the stacking geometry described in section 3
-- which is precisely the risk that labelling cannot fix and that Option C removes by construction.

**7. What is NOT being asked.**

This packet does not request any catalog change, any verdict, or any change to how samples are stored. 

It is strictly a publication-visibility decision.

**8. Exact owner action (CORRECTED 2026-07-20).**

~~This is TWO separate decisions, not one.~~ **There is now ONE decision.** The original Decision 1
("Option A, surveyed publish, needs no policy") does not exist as a separable action: under
DRA-granularity visibility it collapses into Decision 2. Deciding it *is* deciding centroid
publication policy.

**No publication is approved, and none should be performed until this is ruled on.**

**THE DECISION -- centroid publication policy.** Choose one:

- **No publication now (recommended interim).** Leave all **118** centroid DRAs private. **The 4
  formerly-"surveyed" DRAs are 4 OF those 118, not additional to them** (verified: all 4 appear in
  the 118-DRA centroid set, and their 1169 medium samples are a subset of the 4418). There is one
  population here, not two. Costs nothing, forecloses nothing, and keeps the map honest at 40
  visible samples.
- **Option C -- build the site-level aggregate layer first** (118 markers, one per DRA, each
  labelled with its sample count), then publish. Recommended eventual direction; resolves the
  stacking problem by construction.
- **Tier-aware visibility.** Change the visibility path so surveyed and centroid samples can be
  published independently. This is the only route that recovers the original "publish 28 surveyed
  samples" intent. It requires an RLS/fetch design change and its own review, and it must first
  resolve whether `samples.public` (currently present but unconsulted) is the intended lever.
- **Option B, accepted knowingly.** Publish centroids as per-sample markers, understanding the
  stacking effect in section 3. Not recommended, but it is a legitimate call to make explicitly --
  which is precisely what the withdrawn Option A would have done implicitly.
- **Option D -- fund the OCR coordinate-upgrade lane first** and defer publication entirely.

Whichever is chosen, an AI cannot perform the flip: `flip_dra_public` requires an authenticated
admin JWT and explicitly rejects `service_role`.

**Before ANY future flip, re-run the preflight** in section 9 and confirm the tier mix of every
candidate DRA. Do not infer a DRA's tier composition from an aggregate sample query.

**9. Preflight query (read-only) -- MANDATORY before any publication.**

Establishes the true tier composition and blast radius of any candidate DRA set:

```sql
-- What would flipping these DRAs actually publish?
select d.id, d.title, d.public,
       count(*) filter (where s.coordinate_quality_tier = 'high')   as high_samples,
       count(*) filter (where s.coordinate_quality_tier = 'medium') as medium_samples,
       count(*) as total_samples,
       count(distinct (round(s.latitude::numeric,5)||','||round(s.longitude::numeric,5))) as distinct_points
  from matrix_map.dras d
  join matrix_map.samples s on s.source_dra_id = d.id
 where d.id in ( /* candidate DRA ids */ )
 group by d.id, d.title, d.public
 order by total_samples desc;
```

STOP if any candidate DRA reports a non-zero `medium_samples` count and centroid publication has not
been ruled on. Confirm the governing policy is still DRA-level before relying on this reading:

```sql
select policyname, cmd, qual from pg_policies
 where schemaname = 'matrix_map' and tablename = 'samples';
```

---

*End of decision packet.*
