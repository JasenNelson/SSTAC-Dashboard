# BN-RRM Extraction Quality -- Strategy + Systems (2026-06-24)

Strategic record of a systemic extraction-quality failure surfaced during the matrix-map
date/depth work, and the SYSTEMS we build so it cannot silently recur. Plain ASCII.
Owner framing: "less about is-it-junk, more about learning from the problem to overcome it now
AND set up systems that avoid this in future." "Investigate, don't throw out the baby with the
bath water."

## The failure (what happened)
Building an enhanced BN-RRM DB, we found the bulk extraction (588 docs, autonomous) had:
- mis-parsed regulatory-criteria / QA / label columns as sampling STATIONS (e.g. "BC Standard",
  "CSR Drinking Water", "Everglades", "Large Fish") -- ~192+ obvious artifacts;
- dropped sampling DATE (304/8354 events) and DEPTH (11/8354) for all but the 9 manually-seeded sites;
- and, when we filtered the junk, the filter ALSO discarded ~2,600-3,100 REAL stations
  (codex-confirmed) because their cells were MERGED by extraction into one string
  (`SEDIMENT 16-JUN-11 SED11-100A L1020263-1`) and looked unparseable.

The data was largely RECOVERABLE -- it sat unused, then was nearly discarded as "garbage."

## Root cause (layered)
1. **Proximate:** Docling, on certain table layouts (row-per-sample INVENTORY tables, merged/
   spanning cells), concatenated multiple logical cells into one string. The downstream parser
   assumed ONE canonical layout (transposed chemistry) -> it mis-read OR rejected the rest.
2. **Systemic:** the bulk extraction ran AUTONOMOUSLY AT SCALE WITH NO QUALITY GATE. It silently
   loaded whatever it produced (junk stations AND, on the recovery side, discarded real samples),
   with no validation, no anomaly surfacing, no HITL checkpoint. Low quality sat undetected for
   months. A prior session even NARROWED the data (dropped fields) without flagging it.
3. **Meta:** there was no DEFINITION of extraction quality and no MEASUREMENT. "Done" meant "the
   script ran," not "the data is correct and complete."

## The systems we build (so it cannot recur silently)
These make our existing principles (quality-first, monitoring-as-baseline, additive-only) CONCRETE
and ENFORCED in the extraction pipeline, where they were missing.

1. **Quality as a first-class output -- ACCEPTANCE GATES.** No extraction is "accepted" until it
   passes measured checks: % stations matching real-station code patterns; % events with a date;
   % values with a unit; anomaly flags (criteria-column-as-station, merged-cell signature,
   implausible depth, doc with 0 accepted stations). Below threshold -> QUARANTINE for review,
   never auto-load. Quality is tracked over time as a metric, not assumed.
2. **A permanent SALVAGE / RECOVERY layer (multi-format + de-concatenation).** Parse the VARIETY of
   table layouts (transposed chemistry AND row-per-sample inventory); when a cell is merged,
   de-concatenate it (media + date + station + lab id) rather than discard. Ambiguous data is
   QUARANTINED and reviewed, NEVER silently dropped. ("Investigate, don't discard" as a standing rule.)
3. **Provenance + a SPOT-CHECK loop.** Every extracted value traces to source (doc/table). A
   sampling-based QA loop compares extractions against the source PDFs and reports a quality score.
4. **GOLDEN-SET regression.** The 9 seed sites + SITE0141 (SED11-137A=2011-06-16/0-30cm) are a
   fixed fixture; any pipeline change must still reproduce them EXACTLY.
5. **No autonomous-without-gate; no SILENT scope change.** Bulk runs surface anomalies immediately
   (monitoring-baseline); any scope reduction STOPS for owner decision (additive-only memory).

## How this applies now (overcome it)
- The next build step is the SALVAGE LAYER (system #2) as a SECOND recovery pass over the
  "No date or depth" rejects + the merged-cell strings: extract structured station codes, split
  multi-station concatenations, canonicalize spacing/hyphens, strip lab/date suffixes, recover the
  merged date + media, dedup against captured stations. Re-audit + re-run the golden-set gate.
- The salvage pass is built AS an instance of system #2 (reusable + quarantine-gated), not a one-off
  patch -- so it also becomes the prevention going forward.

## Status / anchors
- Schema prereqs applied live (migrations 20260620000001 + 20260622000001); map FE shipped (bbox #413,
  Batch F #412); DB snapshot `matrix_map_backup_20260624`; clean-rebuild WIP in
  `scripts/matrix-map/_enrichment_working/` (gitignored). No data loaded to live until validated.
- Memory: `feedback_bnrrm_dataset_additive_only_and_lane_takeover`,
  `feedback_bnrrm_extraction_quality_systems_2026_06_24`.
- Prior: `MAP_2A_DATASET_INVESTIGATION_2026_06_23.md`, `BNRRM_DATE_DEPTH_ENRICHMENT_PLAN_2026_06_24.md`.
