# Option D -- r-0074 Source-Document Check + Owner Gate (2026-07-21)

READ-ONLY SOURCE CHECK. Follow-up to the r-0074 text-first NO-GO
(`OPTION_D_R0074_PILOT_EVIDENCE_2026-07-20.md`). It asks: do the `SED11-*` 2011 sediment station
coordinates live in an original 2011 sediment investigation source document rather than the 2024
HHERA? This run performed only filesystem inventory + pypdf text-layer probes on the r-0074 site
file. **No OCR, no vision, no georeferencing, no external map lookup, no coordinate write, no
Supabase write, no publication, no AGY call.** Determination: **text-first NO-GO from the available
site-file corpus**; the run STOPS at the owner gate (section 5).

## 1. What was checked (site file 19661 -- 660 Quayside Drive, New Westminster; BOSA)

r-0074 = `id 90d54294-...`, `site_id 162`, `bnrrm_doc_id 351`. The 24 sample rows are 2011 sediment
stations `SED11-137A` .. `SED11-160` (`display_name`), currently centroid `medium` tier. Filesystem
inventory of `G:\My Drive\Site_Remediation_Data\PDF_Archive\19661\` identified all candidate source
PDFs; the coordinate-bearing candidates (site-investigation reports) were probed text-layer-only:

| Document | Pages | `SED11-*` in text layer | UTM coord pairs in text | Notes |
|---|---|---|---|---|
| `r-0074-40-01-HHERA-FINAL-v2.pdf` (bnrrm_doc_id 351) | 200 | 0 | 0 | prior pilot; coordinate content is map figures only |
| `SRCR_April 1 2024_w figures_rev.pdf` | 13 | 0 | 0 | -- |
| `l-0074-40-01-PVP-FINAL-v2.pdf` | 5 | 0 | 0 | -- |
| `2-Stage2PSI-DSI-COR_Draft_19661.pdf` | 270 | 0 | 4 pages | coords are `BH15-*`/`MW15-*` (2015) |
| `1-Stage1PSI_Draft_19661.pdf` | 728 | 0 | 5 pages | boreholes/wells |
| `r-0074-40-01-Stage 1&2 PSI_DSI_COR-v1.pdf` (master, 163 MB) | 2932 | **0** | 37 pages | `SED11` + UTM co-occurrence = **0** |

Evidence artifacts (scratch, gitignored): `.tmp/option-d-source-check/evidence/` --
`srccheck_probe.json`, `bigfile_sed_scan.json`.

## 2. Key findings

- **`SED11-*` appears zero times in the text layer of ANY checked document**, including a full scan
  of the 2932-page master Stage 1&2 PSI/DSI/COR compilation. There is no text-layer page where a
  `SED11-*` label co-occurs with a UTM coordinate pair.
- The site's OWN investigations use different naming and eras: the master report's `16.2.6 Location
  Survey` states locations were surveyed by MTE and "reflected in the locations shown on our
  figures" (i.e. maps, with QA/QC in Appendix 13). The `17.3.4 Sediment Chemistry` section shows the
  site's sediment samples are labelled `SE19-*` / `SE20-*` (2019/2020) and were RECLASSIFIED AS SOIL
  ("...would have been considered sediment, but have since reverted to become... evaluated as soil").
- Text-layer UTM coordinate pairs that DO exist (37 pages in the master report) belong to
  `BH`/`MW`/`SE` soil/groundwater stations from the 2015-2020 investigations (project T17-035), not
  the 2011 `SED11-*` sediment stations.

## 3. Interpretation (scoped to the evidence -- text-layer only)

The `SED11-*` labels were extracted by BN-RRM from the HHERA (`bnrrm_doc_id 351`) but are absent from
that document's text layer and from every other document in the site file. The most plausible
explanations, both consistent with a text-first NO-GO:

1. The `SED11-*` stations exist only as a RASTER (image) data table inside the HHERA (BN-RRM's table
   extraction recovered the station names but not coordinates, which is why the rows are centroid
   tier). Recovering anything from it would require OCR -- and the HHERA's coordinate content is map
   figures, so that table most likely carries chemistry, not coordinates.
2. The original 2011 sediment coordinates live in an EXTERNAL 2011 sediment/foreshore study that is
   NOT filed under site 19661 (660 Quayside is on the Fraser River; the 2011 work predates the
   2015-2020 T17-035 investigations). Locating it would require broad corpus exploration or owner
   knowledge of the source -- outside this run's read-only, site-file scope.

This run cannot rule out a raster table via text-layer probes; the claim is scoped to text-layer
absence across the available site-file corpus.

## 4. Determination

**Text-first NO-GO from the available r-0074 site-file corpus.** The `SED11-*` sediment coordinates
are not text-extractable from any document in site file 19661, so no text-first extractor run is
warranted and AGY was not invoked.

## 5. Owner gate (decide the next step; no work proceeds without it)

1. **Different-pilot gate (recommended):** select a DRA whose sample stations appear as a TEXT-LAYER
   coordinate table in an available source. r-0074 is not viable text-first, and the evidence
   suggests even OCR of its site file is unlikely to yield `SED11-*` coordinates (the naming is
   absent entirely; site sediment was reclassified as soil).
2. **Accept-centroid gate:** leave r-0074 at centroid `medium` tier and defer any coordinate upgrade.
3. **External-source gate:** if the owner can identify/provide the ORIGINAL 2011 sediment
   investigation report (external to site file 19661), a text-first re-check can target that document
   specifically. A broad corpus search to find it is out of scope for an autonomous run.
4. **OCR/vision gate (lowest expected yield):** approve OCR of the specific HHERA raster table that
   holds the `SED11-*` stations only if the owner wants to confirm whether it carries coordinates at
   all; expected yield is low because that document's coordinate content is map figures.

Recommended: gate 1 or gate 2. The coordinate-upgrade value for r-0074 is not recoverable from the
available corpus via any tooling currently in scope.

## 6. Scope statement

No coordinate was written, no Supabase write occurred, no publication or `flip_dra_public` was
performed, and no OCR/vision/georeferencing/external-map lookup was run. This document records
read-only source-check evidence and the owner gate/options; it records no completed owner decision
and authorises nothing further.
