# Matrix Map -- Centroid Publication Decision Packet (2026-07-20)

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

- **Option A -- surveyed only (status quo+).** 
  Publish the unpublished surveyed data: 28 samples across 4 DRAs. 
  No new policy is needed. 
  The map stays sparse.

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

**5. Recommendation.**

We recommend Option A now, then Option C. 

Option A is immediate and needs no ruling. 

Option C resolves the stacking problem by construction rather than papering over it with a disclaimer. 

Note that Option B's risk is not fixable by a badge alone, because the misleading signal is the marker geometry itself, not the missing label.

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

**8. Exact owner action.**

This is TWO separate decisions, not one. They can be answered independently and in this order.

**Decision 1 -- Option A (surveyed publish). Recommended: YES, now.**
Flip the 4 unpublished surveyed DRAs (28 samples) through the in-app audited path
(`flip_dra_public` RPC). This needs no new policy: it applies the standard already used for the 40
currently-visible samples. Result: 40 -> 68 member-visible samples. An AI cannot perform this flip;
it requires an admin JWT.

**Decision 2 -- what to do with the 4418 centroid samples. Recommended: Option C.**
Choose one:
- Option C (recommended) -- approve building the site-level aggregate layer (118 markers, one per
  DRA, each labelled with its sample count), then publish. Resolves the stacking problem by
  construction.
- Option B -- publish centroids as per-sample markers. NOT recommended; section 3 explains why a
  label cannot fix this.
- Option D -- fund the OCR coordinate-upgrade lane first and defer publication.
- Defer -- leave centroids private for now. Decision 1 is unaffected either way.

Deciding 1 does not commit you to any answer on 2.

---

*End of decision packet.*
