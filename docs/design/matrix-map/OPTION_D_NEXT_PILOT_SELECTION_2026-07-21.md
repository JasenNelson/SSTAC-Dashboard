# Option D -- Next Text-First Pilot Selection + Owner Gate (2026-07-21)

READ-ONLY CANDIDATE SELECTION. After r-0074 was text-first NO-GO
(`OPTION_D_R0074_SOURCE_CHECK_2026-07-21.md`), this run ranked the remaining located Option D
candidates and ran bounded pypdf text-layer probes on their source documents. **No OCR, no vision,
no georeferencing, no external-map lookup, no corpus-wide scan, no coordinate/Supabase write, no
publication, no AGY call.** Determination: **no text-first GO exists among the located candidates**;
Lot C is NO-GO text-first but the strongest OCR candidate (its full borehole-log set is raster). The
run STOPS at the owner gate (section 4).

## 1. Candidates assessed

The source-locator packet (`DRA_EXPANSION_LOCATORS_AND_IOCO_PACKET_2026_07_12.md`) resolved four
centroid DRAs to source PDFs; r-0074 is already NO-GO, leaving three. Sample `display_name` patterns
(the labels a coordinate table must match) were read read-only from `matrix_map.samples`.

| DRA | Stations | Sample labels (`display_name`) | Source PDF (pages) | Text-layer coordinate table? | Class |
|---|---|---|---|---|---|
| Howe Sound `052c6a9d` | 198 (Marine) | `SED06-*` sediment, few `HSB*` | HHERA Sediment (1234) | **No** -- chemistry tables + dive-survey narrative; 0 pages with `easting`+`northing` | NO-GO |
| Lot C `578bab5d` | 114 | `MW*` wells, `OU-*` | DSI+HHERA addendum (153) + `Appendix G_Borehole Logs.pdf` (410) | **No (text-first)** -- one 2024 addendum log has text coords (p28: `MW/SV24-29S` = E 488123 / N 5503598), but the full log set (Appendix G, 410 pp) is mostly RASTER (89/410 pp have any text) with NO text-layer coordinates; Appendix B is chemistry | NO-GO text-first; **best OCR candidate** |
| Site 14764 `e6c0df6d` | 49 | `SED09-*` sediment | Supp SI + HHERA (716) | **No** -- `SED09` labels (5 pp) never co-occur with coordinates; this run's text probe shows the doc's UTM content is `MW` wells, a different feature class than the `SED09` samples (consistent with the prior OCR dry-run's `MW08-3` finding, `OPTION_D_R0074_PILOT_EVIDENCE_2026-07-20.md`) | NO-GO |
| r-0074 `90d54294` | 24 | `SED11-*` sediment | HHERA (200) | No (prior runs, PR #716/#717) | NO-GO |

Evidence artifacts (scratch, gitignored): `.tmp/option-d-next-pilot/evidence/nextpilot_probe.json`.

## 2. Systemic finding (the load-bearing insight)

Across all four DRAs the pattern is identical and explains every NO-GO: **the DRA source documents
BN-RRM extracted from are HHERA / ERA risk assessments, which carry CHEMISTRY tables (station id +
analyte results), not station COORDINATE tables.** Coordinate values live elsewhere:

- **DSI borehole LOGS** -- the coordinate home, and they map cleanly to `MW*` `display_name`s. But
  extractability varies by vintage: a modern-tool log has text coordinates (Lot C 2024 addendum p28,
  `MW/SV24-29S ... 488123 m ... 5503598 m`, UTM Zone 10N), while the bulk scanned log appendix is
  RASTER with no text coordinates (Lot C `Appendix G`, 410 pp, only 89 with any text). So DSI logs
  are the right target, but usually need OCR of the `Well location:` field, not a text parse.
- **Survey figures / site plans** -- raster (needs OCR + georeferencing).
- A crude UTM-pair regex is unreliable on these documents: 6-7 digit LAB SAMPLE IDs and analyte
  values in chemistry tables produce heavy false positives (Howe Sound flagged 161 "UTM" pages that
  were all chemistry). The reliable text-layer signals are `easting`+`northing` header co-presence
  and the borehole-log `<easting> m / <northing> m` pattern with a well id.

Implication: a text-first Option D pilot must target the **DSI borehole-log set** for a DRA, not the
HHERA that seeded the sample rows. For the HHERA-sourced candidates (Howe Sound, Site 14764, r-0074)
the located source is the HHERA, which carries no coordinate table -- so they fail for lack of a
coordinate source. Lot C is different: its DSI logs (Appendix G) were located, but they fail
text-first because they are raster (section 3), which is why an OCR pilot, not a text parse, is the
path there.

## 3. Best lead: Lot C -- NO-GO text-first, but the strongest OCR candidate

Lot C's full borehole-log set was located: `Supporting docs/PSI_DSI/Appendix G_Borehole Logs.pdf`,
410 pages, holding 52 distinct `MW*` well ids spanning 2010-2022 (including `MW21`/`MW22` that match
sample `display_name`s). This is the coordinate source -- but it is **mostly RASTER**: only 89 of 410
pages carry any text (median text length 0), the text-bearing pages are log-form templates ("Log of
Monitoring Well: ... Well location:") whose filled-in coordinate values are NOT in the text layer,
and a full probe found ZERO text-layer coordinate pages. The single text-layer coordinate in the
whole Lot C corpus is the one 2024 addendum log (p28, `MW/SV24-29S`), authored with a newer tool.

So Lot C is **NO-GO text-first** (its coordinates are raster), but it is by far the **strongest
OCR/vision candidate** of the set: the log set is structured and consistent, the `MW*` well ids are
already text-readable and match the sample `display_name`s (solving the mapping/feature-class problem
that blocked r-0074 and Site 14764), and OCR would need only to read the `Well location:` field per
log. That is a bounded, high-confidence OCR target -- unlike Howe Sound / Site 14764 whose coordinate
content is site-plan/dive-survey figures needing georeferencing.

## 4. Owner gate (decide the next step)

1. **Lot C bounded OCR pilot (recommended if any OCR is authorized):** the text-first path is
   exhausted, but Lot C's `Appendix G_Borehole Logs.pdf` is a high-confidence OCR target -- structured
   per-well logs, `MW*` ids already text-readable and matching sample `display_name`s, coordinate only
   in the `Well location:` raster field. A bounded, single-DRA OCR run (AGY writes the log parser: OCR
   the `Well location` field -> well id -> easting/northing -> WGS84 via EPSG 26910; orchestrator runs;
   mapping keys on `display_name`; coordinate write stays owner-gated) is the strongest coordinate
   upgrade available. This is an OCR gate, not text-first -- it needs the owner's OCR/vision approval.
2. **Accept centroid `medium` tier** for these DRAs and defer coordinate upgrade (the zero-cost path).
3. **Re-target the data strategy** for centroid DRAs generally: source the DSI borehole logs (not the
   HHERA), and expect them to be raster -> an OCR pipeline is the general tool. Lot C is the pilot.
4. **Howe Sound / Site 14764:** figures/dive-survey coordinate content needing georeferencing, not
   table OCR -- lower priority than Lot C; defer.

Recommended: gate 1 (Lot C OCR pilot) if the owner will authorize a bounded OCR run, else gate 2. The
HHERA-sourced text-first path is exhausted across all four candidates.

## 5. Scope statement

No coordinate was written, no Supabase write occurred, no publication or `flip_dra_public` was
performed, no OCR/vision/georeferencing/external-map lookup was run, and AGY was not invoked (no GO
candidate warranted an extractor). This document records read-only selection evidence and the owner
gate/options; it records no completed owner decision and authorises nothing further.
