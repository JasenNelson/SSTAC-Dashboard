# Matrix Map -- Option C Owner Decision Packet (2026-07-20)

One place to make the centroid-publication call. Everything below is read-only status plus the
decisions only the owner can make. **No publication has occurred and none is requested by this
document.** Current stance is unchanged: no DRA publication.

Companion docs (deeper detail, do not need re-reading to decide):
- `docs/MATRIX_MAP_CENTROID_PUBLICATION_DECISION_PACKET_2026-07-20.md` -- the corrected decision
  packet (the "publish 4 surveyed DRAs" action was retracted; see its correction banner).
- `docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md` -- the Option C design,
  including the security section (s6) and the mandatory re-derivation queries (s9, Q1-Q6).

## 1. Where things stand

- The map is member-gated and shows **40 of 4494** samples. Nothing here changes that.
- The 4418 unpublished centroid-tier samples across **118 DRAs** collapse to **118 distinct
  coordinate points** -- every sample in a DRA shares one coordinate. Mean 37.4 samples per point,
  median 9, worst **476** on a single point. Rendering them per-sample would overstate both spatial
  precision and sampling density; that is the hazard Option C removes.
- You can now SEE this. A **read-only admin preview** ships at
  `/admin/matrix-map/site-aggregates`: a summary panel, a per-site table, and a map of the 118 sites
  as one marker each. It publishes nothing and has no write path. (Provenance of the shipped work is
  listed in section 5.)
- Three of the four required publication mitigations were already built (dash-array tier encoding,
  legend, honest popup caption); only the T20 statistics-exclusion remains.

## 2. The decision

**Should the 118 centroid sites become visible to members, and in what form?** There is exactly ONE
decision here -- the earlier "publish just the 28 surveyed samples" turned out not to be separable,
because visibility is DRA-granularity (a flip exposes every sample under a DRA, all tiers).

| Option | What members see | New production surface | Recommendation |
|---|---|---|---|
| **No publication now** | 40 samples (unchanged) | none | Safe default. Costs nothing, forecloses nothing |
| **C: site-aggregate publication** | 118 site markers, zero sample rows | a NEW audited publication primitive + RLS + trigger | **Recommended eventual direction** |
| **B: per-sample centroid pins** | 40 -> **4486** visible samples (see note) | reuse `flip_dra_public` | Not recommended -- the stacking hazard a label cannot fix |
| **D: OCR coordinate upgrade first** | nothing yet | none | Slowest; defers the decision |

Note on Option B's exposure: flipping the 118 centroid DRAs via `flip_dra_public` exposes **every**
sample in them, not just the centroid-tier rows -- that is the DRA-granularity property. Those 118
DRAs hold 4446 samples (4418 centroid + 28 surveyed), so members would go from 40 to **4486** visible
samples (verified 2026-07-20). This is exactly why "publish just the surveyed rows" is not a
separable action, and why B is not recommended.

**Recommendation: no publication now, then Option C when you are ready to authorise the RLS work.**
The preview lets you evaluate Option C's honesty before committing to build the publication path.

## 3. Two sub-questions Option C forces (both owner-gated)

**3a. Publication semantics -- shape (a) vs shape (b).**
- Shape (a): the aggregate layer shows a site only when its DRA is already visible. Read-side only,
  no new state -- but with 5 public DRAs it renders 4 markers and does not solve the problem.
- Shape (b): a site becomes visible as an aggregate WITHOUT its samples becoming visible. This is the
  shape that delivers the value (118 markers, zero centroid rows exposed), and it needs a new audited
  primitive (a sibling of `flip_dra_public`), new RLS, and an enforcement trigger.
- **Recommend shape (b)**, contingent on the reviews in section 4.

**3b. `matrix_map.samples.public` disposition.**
- The column exists but no RLS policy consults it; the fetch RPC reads it into a projection where it
  has no effect. It is a trap: an implementer may assume writing it restricts visibility. It does not.
- **Decide: wire it deliberately (policy change + review), or remove it from the projection** so it
  stops implying a capability it lacks. This blocks any tier-aware visibility design.

## 4. What must be reviewed before ANY Option C implementation

Not owner homework -- listed so the sequencing is clear. Before code:
1. Strategic `/codex-review` of the design, with the **aggregate-oracle hazard** (design s6.3) called
   out explicitly: an aggregate over rows a caller cannot see is an information channel; counts must
   use a fixed, caller-independent grouping with no caller-supplied bbox/radius/filter.
2. Your ruling on 3a and 3b.
3. Security review of any new RLS policy, RPC, and trigger before migration.

Note the prior-design risk R2 (direct `UPDATE dras SET public` bypassing the audited RPC) is now
CLOSED: trigger `trg_dras_public_flip_only` exists and is enabled. Any new primitive needs the
equivalent.

## 5. Provenance (what shipped, read-only)

- Design: PR #710 (merged).
- Read-only preview page (table + summary): PR #711 (merged).
- Read-only map render (118 markers + legend): PR #712 (open, gates green, owner merges).
- Admin-tier e2e coverage of the preview: PR opened this session (open, owner merges).
- This decision packet + status: the PR carrying this file (open, owner merges).

All read-only. No Supabase write, no publication, no `flip_dra_public` call, no schema/RLS migration
has been performed by any of the above.

## 6. Exact next actions for the owner

1. Open `/admin/matrix-map/site-aggregates` and look at the 118-site map + table.
2. Rule: no publication now / build Option C / accept B / defer via D.
3. If Option C: rule 3a (shape a vs b) and 3b (`samples.public`).
4. Nothing here is time-sensitive; the map stays at 40 visible until you decide.
