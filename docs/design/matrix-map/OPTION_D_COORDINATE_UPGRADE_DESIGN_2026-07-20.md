# Option D -- DRA Coordinate-Upgrade Lane Design (2026-07-20)

DESIGN ONLY. This document designs a pilot; it does not execute one. It writes no coordinate, runs
no OCR/vision, calls no AGY, opens no PDF, and publishes nothing. Building or running any part of it
is OWNER-GATED and requires the owner gates in section 11 plus a strategic `/codex-review` before
any extraction, data write, or publication.

Companion documents (read for context; all canonical on `origin/main`):
- `docs/MATRIX_MAP_OPTION_C_OWNER_DECISION_PACKET_2026-07-20.md` -- the centroid-publication owner
  decision (no publication now / Option C / B / D). Option D is the highest-fidelity of those.
- `docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md` -- the site-aggregate design.
  Option D upgrades the underlying coordinates that Option C aggregates.
- `docs/MATRIX_MAP_DRA_COORD_APPLY_READINESS_2026_07_14.md` -- the prior apply-readiness analysis;
  its section 3 prereq 1 is the standing well-id -> sample-row mapping blocker (section 8 here).
- `docs/MATRIX_MAP_DRA_OCR_DRYRUN_RESULTS_2026_07_14.md` -- the OCR dry-run results (Site 14764
  confirmed; Howe Sound / Lot C page guesses falsified).

---

## 1. Current stance (unchanged by this document)

No DRA publication and no coordinate write now. The map stays at its current state (5 public DRAs;
40 member-visible samples via grants) until the owner rules. This document does not request a flip,
a write, or an extraction run. Reading it does not commit the owner to Option D.

---

## 2. Why Option D exists

Centroid-tier samples share one coordinate per DRA: 118 centroid DRAs collapse to 118 points, with
up to 476 samples stacked on the worst single point. Option C makes that honest at the SITE level
(one aggregate marker per DRA). **Option D upgrades the coordinates themselves** -- extracting the
true per-sample location of each station from the source DRA PDF (text table, OCR, figure, or map)
so the map can eventually show real positions instead of centroids. It is the highest-fidelity and
slowest path, and the only one that changes what a coordinate MEANS rather than how it is displayed.

Option D is deliberately scoped as a **pilot on one DRA** first. A prior corpus-wide vision run over
271 files cost roughly 19M subagent tokens and was halted at 97% of the weekly budget. Nothing in
this lane runs at corpus scale.

---

## 3. Point-in-time facts (read-only; re-derive before any pilot)

Re-derived read-only against `origin/main` = `4ddf654a`, 2026-07-20. These are point-in-time and
MUST be re-derived before any pilot step (queries in section 12).

| Fact | Value |
|---|---|
| DRAs total / public | 574 / 5 |
| Samples total / public (via `samples.public`) | 4494 / 0 |
| Last `dra_visibility_audit` change | 2026-07-18 22:00:25 UTC (nothing since) |
| Candidate DRA: r-0074 (`90d54294`) samples / non-null `display_name` | 24 / 24 (all `medium` tier) |
| Candidate DRA: Site 14764 (`e6c0df6d`) samples | 49 (all `medium` tier) |
| Candidate DRA: Lot C (`578bab5d`) samples | 114 (all `medium` tier) |
| Candidate DRA: Howe Sound (`052c6a9d`) samples | 198 (all `medium` tier) |

For all four candidates, every sample row already carries a non-null `station_id` and
`bnrrm_station_id`, and all are `coordinate_quality_tier = 'medium'`. The mapping TARGET namespace
is therefore fully populated; the open question is purely whether a printed label in the PDF
resolves to one of these rows (section 8).

---

## 4. Prior work is CANONICAL on origin/main -- reuse, do not rebuild or "restore"

A dry-run coordinate-extraction pipeline and its analysis docs already exist and are current on
`origin/main`. They are NOT git-history-only; do not `git checkout <old-commit> -- <path>` to
"restore" them. Any pilot session syncs to `origin/main` (or works from an `origin/main` worktree,
per L0 1.15) and uses the files as-is. `git show <commit>:<path>` is archaeology only.

### 4.1 Two script generations (both live on origin/main)

- **Generation A** (`scripts/matrix-map/scan_coords.py`, `extract_coords.py`, `verify_coords.py`):
  targets a LOCAL SQLite `bnrrm_enhanced.db`, NOT Supabase. It is the mature code and holds logic to
  PORT into the DRA path: doc-wide projection detection (NAD83 / NAD27 / WGS84 / Albers -> EPSG via
  `get_epsg_code`), quarantine of ambiguous projections, a centroid-divergence quality gate
  (5 km, 10 km for large sites), and a control-point assertion in `verify_coords.py`.
- **Generation B** (`scripts/matrix-map/dump_dra_outline.py`, `locate_dra_table_pages.py`,
  `explore_dra_pdf_tables.py`, `ocr_dra_page_range.py`, `parse_dra_well_coordinates.py`,
  `extract_dra_coordinates.py` + its test): the DRA/Supabase path. These are read-only dry-run
  diagnostics. Its terminal writer `extract_dra_coordinates.py` has `extract_station_table()`
  STUBBED to return `[]`, so it always self-BLOCKS -- Generation B has never turned a PDF table into
  rows. That writer is also OBSOLETE (section 10).

### 4.2 Prior analysis docs (all on origin/main)

`MATRIX_MAP_DRA_COORD_APPLY_READINESS_2026_07_14.md`, `..._OCR_DRYRUN_RESULTS_...`,
`..._COORD_DRYRUN_TRIAGE_4CANDIDATES_...`, `..._COORD_EXTRACTION_REVIEW_...`,
`..._COORD_EXTRACTION_DRYRUN_BLOCKER_...`, `..._COORD_DRYRUN_FINDINGS_HOWE_SOUND_...`, plus the two
`MATRIX_OPTIONS_DRA_COORD_*_2026_07_13.md` packets. Read them from `origin/main`. Note a documented
tension: an intermediate 2026-07-13 state of `extract_dra_coordinates.py` removed UTM entirely
(lat/lon-only), but the final 2026-07-13 commit re-added a WGS84-UTM (EPSG 326xx) converter -- which
is the WRONG datum family for the NAD83 data here (section 10.1). The 2026-07-14 line
(`parse_dra_well_coordinates.py` + `ocr_dra_page_range.py`) is UTM-native. Treat the 2026-07-14 UTM
line as current, and note the writer's 326xx converter must be replaced by NAD83/26910 (section 5
gap 2); the 2026-07-13 lat/lon/station_id-join design is superseded.

---

## 5. Artifact 1 -- Extraction protocol (AGY-writes / orchestrator-runs; dry-run only)

Per-DRA, no-write, ending at a dry-run evidence artifact (section 9). Reuse the Generation B
diagnostic chain as-is from `origin/main`. Every step writes reports to a scratch/working directory,
never over the PDF (the scripts already enforce a same-path fail-closed guard).

```
Step 0  READ-ONLY mapping target (orchestrator; NO extraction, safe now or at pilot)
        SELECT id, display_name, station_id, bnrrm_station_id
          FROM matrix_map.samples WHERE source_dra_id = '<dra_uuid>';
        -- establishes the target namespace to match against (section 8)
Step 1  dump_dra_outline.py       --pdf X --report outline.json   (bookmarks -> coord sections)
Step 2  locate_dra_table_pages.py --pdf X --report pages.json     (text-layer coord pages)
Step 3a explore_dra_pdf_tables.py --pdf X --report tables.json --max-pages 30   (TEXT path, NO OCR)
Step 3b OCR path -- ONLY if 3a finds no machine-readable coord table AND the owner has approved
        OCR/vision scope for this DRA (gate 2). Bounded:
        ocr_dra_page_range.py --pdf X --start S --end E --report ocr.json --out-md ocr.md --max-pages 40
Step 4  parse_dra_well_coordinates.py --in <ocr.md|text> --report parsed.json --csv parsed.csv
        + NEW conversion: NAD83 / UTM Zone 10N via EPSG 26910 -> 4326 (see section 5 gap 2 and section 9).
Step 5  MAPPING PROBE (orchestrator, read-only): join parsed labels to the Step-0 display_name set
        under the DRA; classify each candidate exact / normalized / unmatched. NO write.
DELIVERABLE: an evidence CSV/JSON of candidate coordinates + mapping status. STOP. No apply.
```

Three gaps must be filled by NEW code (AGY writes, orchestrator runs -- section 7), not by reviving
the obsolete writer:
1. A DRA-specific table -> rows extractor feeding Step 4 (the `extract_station_table` stub is
   unimplemented). It emits the evidence record (section 9); it does NOT emit SQL.
2. NAD83 / UTM Zone 10N conversion (EPSG 26910 -> 4326). The existing parse step captures raw
   easting/northing + a free-text datum and does no conversion; the obsolete writer's converter is
   WGS84-UTM (326xx) only, the wrong datum family. Port Generation A's `get_epsg_code`.
3. A read-only mapping-probe script (Step 5) plus a DRA-side verification gate that ports Generation
   A's control-point + centroid-divergence checks (no Supabase equivalent exists today).

No apply path is wired. The pilot ends at the evidence artifact. A real apply is a separate,
owner-gated lane (section 10, section 11 gate 4).

---

## 6. Artifact 2 -- Pilot corpus scope

**Recommended pilot: r-0074 (`90d54294`), one DRA only.** Rationale:
- Smallest candidate (24 sediment-sample stations), so the mapping probe and any manual per-record
  review are tractable.
- 198 of 200 pages carry a text layer, so Step 3a (text-table probe) may succeed WITHOUT OCR, which
  means the pilot can likely proceed without triggering the owner OCR/vision gate (gate 2).

**Explicit caveat (do not skip):** the prior `..._COORD_EXTRACTION_REVIEW_...` warns that r-0074's
coordinates may be MAP-EMBEDDED (in figures needing georeferencing, not a machine-readable table).
The text-layer being present does NOT guarantee the COORDINATES are in it. Step 3a is therefore a
go/no-go: if it finds a coordinate table, r-0074 is the cheapest viable pilot; if it does not,
r-0074 is NOT a no-OCR pilot and the decision returns to the owner. Only Site 14764 has a proven
coordinate source (OCR of App C p162-172), but see the feature-class hazard in section 8 before
choosing it.

No second DRA and no scale-up without a fresh owner gate.

---

## 7. Artifact 3 -- AGY workplan (Bounded Batch)

- Mode: Bounded Batch (30-120 min), owner-approved before the first `agy` call. Read-first gate:
  read `docs/AGY_USAGE.md` + the `/AGY` skill BEFORE any invocation. Confirm `write_file(<root>)`
  is in the AGY project allow-list. Per the `/AGY` skill (the authoritative source for this; note
  `docs/AGY_USAGE.md`, last updated 2026-07-07, may lag on the exact mechanism): the CLI-1.1.3
  `default-cli-project` fix is to add `write_file(<root>)` + `write_file(<root>\*)` via an
  interactive `/permissions` session, then verify with a headless write probe.
- The #1 rule: AGY WRITES the scripts; the ORCHESTRATOR RUNS them. AGY does not reliably
  run-code-then-report, so every probe is decomposed AGY-writes / orchestrator-runs.
- AGY deliverables, each driven by a file-based brief (`.tmp_agy_brief_N.md` with exact target
  files, embedded acceptance checks, hard "touch only X; no git; no ollama" limits, and a closeout
  file):
  (a) the r-0074 table -> rows extractor feeding Step 4;
  (b) the NAD83 / 26910 conversion helper (port Generation A `get_epsg_code`);
  (c) the read-only mapping-probe script (Step 5);
  (d) a DRA-side verification gate (port Generation A control-point + centroid-divergence checks).
- Invocation: `agy --model "Gemini 3.1 Pro (High)" --add-dir "C:\Projects\sstac-dashboard"
  --print-timeout 9m -p "Read <brief>.md and execute it. Touch only the files it names; no git."`
- Monitor by POLLING the deliverable file (every 20-30 s), not a long timeout. Diagnose failures
  from `~/.gemini/antigravity-cli/log/cli-*.log`; do not re-guess the model. Never trust AGY's
  closeout -- verify with `git diff` + re-run acceptance checks; codex still gates. Never pass
  `--dangerously-skip-permissions`.

---

## 8. The standing blocker -- well-id -> sample-row mapping (highest risk)

This is the load-bearing correctness item (prior apply-readiness section 3 prereq 1). No apply is
possible until it is resolved for the pilot DRA.

**8.1 The mapping key is `display_name`, not `station_id`.** A read-only probe of r-0074 shows
`station_id` is the BN-RRM integer surrogate ("7987", "7988", ...); the printed sample label lives
in `display_name` (`SED11-137A`, `SED11-138`, ...). A pilot must match the PDF's printed label to
`samples.display_name` under the correct `source_dra_id`, never to `station_id`.

**8.2 Feature-class mismatch is the likely root cause of "unverified".** r-0074's sample rows are
SEDIMENT stations (`SED11-*`). The prior Site 14764 OCR extracted MONITORING WELLS (`MW08-3`) -- a
different physical feature. Monitoring-well coordinates need not correspond to any sediment-sample
row. The pilot must extract the SAME feature class that exists as sample rows (sediment stations for
these DRAs), and the evidence record must carry a `feature_class` field so a well-vs-sediment
mismatch is caught, not silently applied.

**8.3 Resolution rule (design).** A candidate is mapping-eligible only when its printed label
resolves to exactly one `samples.id` under the correct `source_dra_id`, with the same feature class.
The eventual apply keys on `id` (uuid) AND `source_dra_id`, and must assert exactly one row updated
(`GET DIAGNOSTICS` = 1 else `RAISE`). Owner ratifies the correspondence per record before any apply.

---

## 9. Artifact 4 -- Evidence schema (dry-run record; nothing written)

Each candidate row in the dry-run artifact:

| Field | Purpose |
|---|---|
| `source_dra_id` (uuid) + `dra_short` | provenance |
| `source_locator` | page/appendix + method, e.g. "p41 table (text)" or "App C p162-172 (OCR)" |
| `printed_label` | the well/sample id EXACTLY as printed (e.g. `SED11-137A`) |
| `feature_class` | sediment-station / monitoring-well / other (section 8.2 guard) |
| `utm_zone`, `easting_m`, `northing_m` | raw extracted UTM |
| `datum_text` (verbatim), `datum_epsg` | free-text datum + the EPSG it maps to (26910 default) |
| `wgs84_lng`, `wgs84_lat` | derived via 26910 -> 4326, INFORMATIONAL only (see below) |
| `extraction_confidence` | high / low (section 10 rubric) |
| `mapping_status` + `sample_id` + `display_name` | exact / normalized / unmatched, and the matched row |
| `unresolved` | labels with no parseable coordinate; listed, never guessed |

The eventual (separate, owner-gated) apply targets `matrix_map.samples` and sets the `geometry`
column ONLY -- `longitude`/`latitude` are trigger-derived from `geometry` with a WGS84 consistency
CHECK, so an apply never sets them directly. It also sets `coordinate_quality_tier` (owner-decided)
and `coordinate_source` (a provenance label). Apply keying and the row-count assertion are in
section 8.3. The dry-run artifact writes none of this.

---

## 10. Artifact 5 -- Confidence rubric (three axes; do not conflate)

- **Extraction confidence** (parser, anti-fabrication): `high` ONLY when both values are
  direction-bound (a `<num> N` / `<num> E` suffix or a `Northing:` / `Easting:` label) AND there is
  exactly one distinct value per band; otherwise `low`. Unparseable labels go to `unresolved`, never
  guessed.
- **Mapping confidence** (section 8): `exact` (printed_label == display_name under the DRA) /
  `normalized` (matches only after documented case/space/suffix normalization) / `unmatched`. Only
  `exact`, or an owner-verified `normalized`, is apply-eligible, and only when the feature class
  matches.
- **`coordinate_quality_tier`** (owner-set stored column): high / medium / low. OCR- or
  log-derived coordinates are NOT survey-grade, so `medium` is expected even for an
  extraction-`high` record. The owner sets this; the AI never does. Latent ambiguity to flag for the
  owner: the schema comment defines `medium` specifically as "BC Site Registry centroid (dashed
  outline)", so a genuine per-station OCR coordinate stored as `medium` would be indistinguishable
  by tier alone from a coarse site centroid -- the owner may want a distinct `coordinate_source`
  label (or a tier-semantics decision) so the upgrade is legible.

Apply-eligible = (extraction `high` OR owner-verified `low`) AND mapping `exact`/verified-normalized
AND feature-class match AND `datum_epsg` resolved.

### 10.1 The existing DRA write-generator is OBSOLETE -- quarantine it, out of pilot scope

`extract_dra_coordinates.py` `generate_sql()` (origin/main, around lines 98-100) emits
`UPDATE matrix_map.samples SET latitude=..., longitude=..., coordinate_quality_tier='high' WHERE
station_id = <label> AND source_dra_id = <dra>`. This is wrong three ways versus the verified schema
and this design: (1) it writes `latitude`/`longitude` directly, bypassing the authoritative
`geometry` column and its trigger/CHECK; (2) it hardcodes tier `'high'`, but OCR/log-derived must be
owner-set `medium`; (3) it keys on `station_id`, the integer surrogate, not the printed
`display_name` (section 8), via a `match_station_id` NEEDS-TUNING stub (a no-op passthrough on its
only reachable call path; unreachable because `extract_station_table()` returns `[]` first). This writer is
NON-AUTHORITATIVE and OUT OF PILOT SCOPE. The pilot produces an evidence CSV/JSON only; no SQL
writer is used, wired, or "fixed" in this lane.

---

## 11. Artifact 6 -- Owner gates (explicit decisions required before ANY write)

1. **Pilot DRA selection** -- approve r-0074, or choose Site 14764 with the section 8.2
   well-vs-sediment feature-class caveat acknowledged.
2. **Tool / vision scope** -- approve the no-OCR text path for the pilot. OCR/vision (Step 3b) runs
   ONLY if Step 3a finds no table AND the owner then explicitly approves a bounded OCR page range on
   the single pilot DRA. No corpus-wide OCR/vision under any circumstances in this lane.
3. **Mapping resolution (the standing blocker)** -- accept the `display_name`-keyed,
   feature-class-matched correspondence rule (section 8), and ratify each matched record before any
   apply.
4. **Per-tier apply authorization** -- the rule for which confidence/mapping tiers may be applied;
   that every apply is owner-run (agents never write), keyed on `id` + `source_dra_id`, with a
   preflight geometry capture and a documented rollback, and a `/codex-review` on the exact filled
   DO-block. The apply is a separate lane, not this pilot.
5. **`coordinate_quality_tier` + `coordinate_source` labels** for any rows the owner later applies.

Until these gates are cleared, the lane stops at the dry-run evidence artifact.

---

## 12. Re-derivation queries (read-only)

Run before any pilot; re-derive rather than trusting section 3. Each is annotated with its
2026-07-20 value so drift is obvious.

```sql
-- Q1: no-write proof + headline population. Expected 2026-07-20: 5 / 574 / 0 / 4494 / 2026-07-18 22:00.
select
  (select count(*) from matrix_map.dras where public)                 as dras_public,
  (select count(*) from matrix_map.dras)                              as dras_total,
  (select count(*) from matrix_map.samples where public)             as samples_public,
  (select count(*) from matrix_map.samples)                          as samples_total,
  (select max(changed_at) from matrix_map.dra_visibility_audit)      as last_visibility_change;

-- Q2: candidate DRA sample populations + mapping-target readiness.
--   Expected: r-0074 24/24, Site 14764 49/49, Lot C 114/114, Howe Sound 198/198, all tier 'medium'.
with cand(short, dra_id) as (values
  ('Howe Sound','052c6a9d'), ('r-0074','90d54294'),
  ('Lot C','578bab5d'), ('Site 14764','e6c0df6d'))
select c.short,
       count(s.id)                                  as samples,
       count(s.display_name)                        as display_name_nonnull,
       count(distinct s.coordinate_quality_tier)    as distinct_tiers,
       min(s.coordinate_quality_tier)               as a_tier
  from cand c
  join matrix_map.dras d on d.id::text like c.dra_id || '%'
  left join matrix_map.samples s on s.source_dra_id = d.id
 group by c.short order by c.short;

-- Q3: mapping-target label formats for the pilot DRA (read-only; identifiers only).
--   Confirms display_name carries the printed labels (SED11-*) and station_id is the surrogate.
select s.display_name, s.station_id, s.bnrrm_station_id
  from matrix_map.samples s
  join matrix_map.dras d on d.id = s.source_dra_id
 where d.id::text like '90d54294%'
 order by s.display_name;
```

---

## 13. Acceptance criteria for a future PILOT PR (not this doc)

A PR that runs the pilot must satisfy all of the following.

**Containment**
1. No coordinate write, no Supabase write, no publication, no `flip_dra_public`. The pilot ends at
   the evidence CSV/JSON.
2. No corpus-wide OCR/vision; OCR only within an owner-approved bounded range on the single pilot DRA.
3. Domain data (PDFs, extraction JSONs) is opened only inside the approved pilot, never in
   exploration; exploration is filesystem/metadata only.

**Correctness**
4. Extracted feature class matches the sample-row feature class (section 8.2); mismatches are flagged.
5. Mapping keys on `display_name` under `source_dra_id`; classifications are exact/normalized/unmatched.
6. Coordinates convert via EPSG 26910 -> 4326; the free-text datum maps to an explicit EPSG.
7. The obsolete `generate_sql` writer is not used, wired, or revived (section 10.1).

**Process**
8. AGY writes the scripts; the orchestrator runs them; AGY closeout is independently verified.
9. `/codex-review` to mutual-agreement GREEN on any new script before it runs at pilot.
10. Full push-gate suite green for any code PR per `docs/GATE_MODE_SOP.md` (lint -> unit -> monitored
    build -> e2e), monitored build only -- never raw `npm run build`.

---

## 14. Scope note

Nothing in this document authorises an extraction run, an OCR/vision run, an AGY call, a coordinate
write, a migration, or a publication. The next step is a design review and an owner ruling on the
section 11 gates, not an implementation.
