# Option D -- Lot C OCR Pilot Evidence + Owner Gate (2026-07-21)

READ-ONLY PILOT RESULT. This run was authorised to OCR Lot C's `Appendix G_Borehole Logs.pdf`. Before
spending an OCR run it verified the premise with read-only text extraction and found the premise
FALSIFIED, so **no OCR was executed** -- it was not warranted. **No coordinate write, no Supabase
write, no publication, no `flip_dra_public`, no schema/RLS/migration/catalog change, no
georeferencing/external-map lookup, no AGY call.** Determination: **NO-GO**; the run STOPS at the
owner gate (section 4).

## 1. Why OCR was not warranted (two independent, read-only findings)

**Finding A -- the Appendix G well logs carry NO surveyed coordinates.** Full text extraction of the
log pages (they are largely digital logs, not pure raster) shows the coordinate field is present as
TEXT and its value is "Not Surveyed". Of the 35 ESdat-format logs that have a `COORDINATES` field,
**35 of 35 say "Not Surveyed"** and 0 carry a coordinate value. Example, p356 (`MW21-01`, produced by
ESlog.ESdat.net on 09 Mar 2021):

```
COORDINATES Not Surveyed
SURFACE ELEVATION Not Surveyed
WELL TOC ELEVATION Not Surveyed
```

Older MW10-series logs (2010) instead use a narrative `Well location` value ("East of the Air
Compression Building"), not coordinates. The only 5-7 digit numbers on those pages are the project
number (`989417`) and street address (`37200` Galbraith Ave) -- not coordinates. So OCR would only
re-read the words "Not Surveyed" that are already in the text layer; it cannot recover coordinates
that were never recorded.

**Finding B -- Appendix G is the wrong target for these samples.** Lot C's 114 sample rows are
dominated by SEDIMENT stations, not monitoring wells (read-only `matrix_map.samples`):

| Sample series | Count |
|---|---|
| `SED*` sediment (2011, e.g. `SED11-*`) | 100 |
| `OU-*` outfalls | 8 |
| `MW` monitoring wells (`MW21`/`MW22`/`MW24`) | 3 |
| `PW` wells / other | 2 / 1 |

The borehole-log Appendix G covers monitoring wells -- 3 of 114 samples -- and those are Not Surveyed
(Finding A). The 100 `SED*` sediment stations (the actual majority) are not in a borehole-log
appendix at all; they are the same 2011 sediment family that was text-first NO-GO for r-0074.

Evidence artifacts (scratch, gitignored): `.tmp/option-d-lotc-ocr-pilot/` (RUN_STATE + COMMAND_LOG).

## 2. Correction to PR #718

PR #718 ranked Lot C the "best OCR candidate" on the assumption that Appendix G's raster `Well
location` fields held coordinates that OCR could read. This fuller extraction corrects that: the
coordinate fields are TEXT reading "Not Surveyed", and the sample population is 2011 sediment, not the
logged wells. The OCR-candidate premise does not hold; the correct classification for Lot C is NO-GO
(no surveyed coordinates exist for its stations in this corpus).

## 3. Bounded OCR page list (defined, then not run)

Per the contract a bounded OCR list was to be built from the Appendix G log pages. The candidate list
was the ~35 ESdat-format log pages carrying a `COORDINATES` field (identified read-only). Because
every one of those fields reads "Not Surveyed" in the existing text layer, OCR of them yields no
coordinate -- so the bounded list resolves to zero pages worth OCR-ing. No OCR was executed.

## 4. Owner gate (decide the next step)

The HHERA text-first path (PR #715-#717), the next-pilot text-first ranking (PR #718), and now the
Lot C borehole-log OCR path are all exhausted or falsified. Realistic options:

1. **Accept centroid `medium` tier (recommended):** no surveyed-coordinate data was found for these
   DRAs' stations in the located corpus (Lot C's wells are literally "Not Surveyed"; the sediment
   stations have no coordinate source in the checked documents). Close the coordinate-upgrade effort
   for these DRAs unless a new source (gate 2) is provided.
2. **Locate the original 2011 sediment study:** `SED11-*` stations now appear in BOTH r-0074 and
   Lot C, implying a shared 2011 sediment dataset. If the owner can identify/provide that source, a
   fresh read-only check can target it. A broad corpus search to find it is out of autonomous scope.
3. **Georeference the survey figures** (Howe Sound / Site 14764 site plans): a larger vision +
   georeferencing tooling scope; lowest priority and not currently built.
4. **Stop Option D** and rely on Option C (site-level aggregates) for map honesty.

Recommended: gate 1 (accept centroid tier) now, with gate 2 as the only path that could add real
per-station coordinates -- and only if the 2011 sediment source is provided.

## 5. Scope statement

No OCR/vision was run, no coordinate was written, no Supabase write occurred, no publication or
`flip_dra_public` was performed, and AGY was not invoked (no OCR/parser task was warranted). This
document records read-only pilot evidence and the owner gate/options; it records no completed owner
decision and authorises nothing further.
