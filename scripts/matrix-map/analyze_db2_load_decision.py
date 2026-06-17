#!/usr/bin/env python3
"""
analyze_db2_load_decision.py -- the DECISION-SCENARIO report for the matrix-map load.

Per the strategic course-correction, PR B merges as a dry-run + DECISION PACKET, and the
actual load is gated on owner decisions. This script reads DB2 (read-only) + the geocoding
CSV and quantifies, with ETL-LOADABLE sediment-chemistry counts, the buckets and the
per-scenario deltas the owner needs to choose a path BEFORE any load.

CORRECTNESS NOTE (numbers drive the owner decision): counts here mirror the ETL's actual
emission semantics, NOT raw row counts:
  - A chem row is LOADABLE iff parameter is non-empty AND sediment_chemistry.id is not null
    AND (value is not null OR (detection_limit is not null AND qualifier='<'))
    -- exactly etl_bnrrm_to_supabase.py lines 858-893.
  - An event is DATED iff date_sampled parses under the ETL's sql_date() formats.
  - source_table_ref encodes the source doc as a 'd<NNN>' token; an event is mis-attributed
    only when that doc id differs from the site's DEFAULT (first-by-doc_id) ra_document.
  - The ETL attributes every measurement to the site's DEFAULT doc, so the per-DRA inventory
    attributes a site's loadable chem to its default doc only (non-default docs control 0).

NO writes to any DB. Plain ASCII.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import re
import sqlite3
import urllib.parse
from collections import defaultdict
from pathlib import Path

DEFAULT_SOURCE_DB = Path(
    r"G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data"
    r"\bnrrm_training_DB2_20260503.db"
)
DEFAULT_GEOCODING_CSV = (
    Path(__file__).resolve().parents[2]
    / "docs" / "design" / "matrix-map" / "PR_MAP_8_GEOCODING_DATA_FULL.csv"
)
DEFAULT_OUT = (
    Path(__file__).resolve().parents[2]
    / "docs" / "design" / "matrix-map" / "PR_MAP_8_LOAD_DECISION_REPORT.md"
)
# Live seed baseline (matrix_map; from migration comments / PR-MAP-0 report).
SEED_SAMPLES = 290
SEED_MEASUREMENTS = 7472  # the seed currently loads ~7,472 measurements
DOC_TOKEN = re.compile(r"d(\d+)", re.IGNORECASE)


def parseable_date(text) -> bool:
    if text is None:
        return False
    s = str(text).strip()
    if not s:
        return False
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y"):
        try:
            dt.datetime.strptime(s, fmt)
            return True
        except ValueError:
            continue
    return False


def date_status(text) -> str:
    if text is None or not str(text).strip():
        return "blank"
    return "parseable" if parseable_date(text) else "unparseable"


def is_loadable(parameter, value, detection_limit, qualifier, chem_id) -> bool:
    """Mirror etl_bnrrm_to_supabase.py measurement acceptance (lines 858-893)."""
    if chem_id is None:
        return False
    if not (parameter or "").strip():
        return False
    if value is not None:
        return True
    return detection_limit is not None and (qualifier or "").strip() == "<"


def open_ro(db_path: Path) -> sqlite3.Connection:
    uri = "file:" + urllib.parse.quote(str(db_path)) + "?mode=ro&immutable=1"
    return sqlite3.connect(uri, uri=True)


def load_geocoded_sites(csv_path: Path) -> set[int]:
    # Mirror the ETL's load_tier_b_centroids: FAIL-CLOSED on a missing CSV; only count rows
    # with coordinate_source='bc_csr_centroid' and parseable lat/lon, keyed by site_id, so a
    # stale / mixed PR-MAP-0 CSV cannot inflate or zero the geometry scenario counts.
    if not csv_path.exists():
        raise SystemExit(f"FATAL: geocoding CSV missing: {csv_path}")
    sites: set[int] = set()
    with csv_path.open("r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if (row.get("coordinate_source") or "").strip() != "bc_csr_centroid":
                continue
            try:
                site_id = int(row["site_id"])
                float(row["latitude"])
                float(row["longitude"])
            except (KeyError, TypeError, ValueError):
                continue
            sites.add(site_id)
    return sites


def ref_doc_id(source_table_ref) -> int | None:
    if not source_table_ref:
        return None
    m = DOC_TOKEN.search(str(source_table_ref))
    return int(m.group(1)) if m else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-db", type=Path, default=DEFAULT_SOURCE_DB)
    ap.add_argument("--geocoding-csv", type=Path, default=DEFAULT_GEOCODING_CSV)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    geocoded = load_geocoded_sites(args.geocoding_csv)
    conn = open_ro(args.source_db)
    cur = conn.cursor()

    # Sites with >=1 ra_document + each site's DEFAULT doc (min doc_id, the ETL's site_default).
    site_default_doc: dict[int, int] = {}
    for r in cur.execute(
        "SELECT site_id, MIN(doc_id) FROM ra_documents WHERE site_id IS NOT NULL GROUP BY site_id"
    ):
        site_default_doc[int(r[0])] = int(r[1])
    sites_with_dra = set(site_default_doc.keys())

    # One pass over chem rows with everything needed for the ETL-accurate predicates.
    rows = cur.execute(
        """
        SELECT st.site_id, se.event_id, se.date_sampled, se.source_table_ref,
               sc.parameter, sc.value, sc.detection_limit, sc.qualifier, sc.id
        FROM sediment_chemistry sc
        JOIN sampling_events se ON se.event_id = sc.event_id
        JOIN stations st ON st.station_id = se.station_id
        """
    ).fetchall()

    total_chem = len(rows)
    by_date_loadable = {"parseable": 0, "blank": 0, "unparseable": 0}
    geom_loadable = geom_dated_loadable = 0
    geom_dra_loadable = geom_dated_dra_loadable = 0
    loadable_total = 0
    no_dra_loadable = 0
    misattr_events: set[int] = set()
    misattr_chem = 0
    misattr_events_dated: set[int] = set()
    misattr_chem_dated = 0
    default_doc_chem: dict[int, int] = defaultdict(int)

    for (site_id, event_id, date_sampled, source_ref,
         parameter, value, dl, qualifier, chem_id) in rows:
        site_id = int(site_id)
        loadable = is_loadable(parameter, value, dl, qualifier, chem_id)
        if not loadable:
            continue
        loadable_total += 1
        ds = date_status(date_sampled)
        by_date_loadable[ds] += 1
        has_geom = site_id in geocoded
        has_dra = site_id in sites_with_dra
        if has_geom:
            geom_loadable += 1
            if ds == "parseable":
                geom_dated_loadable += 1
            if has_dra:
                geom_dra_loadable += 1
                if ds == "parseable":
                    geom_dated_dra_loadable += 1
        if not has_dra:
            no_dra_loadable += 1
        # mis-attribution: source_table_ref doc differs from the site's default doc
        rdoc = ref_doc_id(source_ref)
        default_doc = site_default_doc.get(site_id)
        if rdoc is not None and default_doc is not None and rdoc != default_doc:
            misattr_events.add(int(event_id))
            misattr_chem += 1
            if ds == "parseable":  # only these would mis-attribute under Scenario A (dated-only)
                misattr_events_dated.add(int(event_id))
                misattr_chem_dated += 1
        # per-DRA attribution: site default doc controls this loadable row
        if default_doc is not None:
            default_doc_chem[default_doc] += 1

    # Event-level date buckets (for the "302 dated events" sanity).
    ev_status = {"parseable": 0, "blank": 0, "unparseable": 0}
    for _eid, d in cur.execute("SELECT event_id, date_sampled FROM sampling_events"):
        ev_status[date_status(d)] += 1

    n_dra = cur.execute("SELECT COUNT(*) FROM ra_documents").fetchone()[0]

    # Broader provenance context: ALL events whose source_table_ref doc differs from the site
    # default (regardless of whether they carry a loadable measurement). The LOAD impact is the
    # narrower misattr_events/misattr_chem above (events with a loadable mis-attributed measurement).
    nondefault_ref_events = 0
    for eid, sref, sid in cur.execute(
        """
        SELECT se.event_id, se.source_table_ref, st.site_id
        FROM sampling_events se JOIN stations st ON st.station_id = se.station_id
        WHERE se.source_table_ref IS NOT NULL AND TRIM(se.source_table_ref) <> ''
        """
    ):
        rdoc = ref_doc_id(sref)
        dd = site_default_doc.get(int(sid))
        if rdoc is not None and dd is not None and rdoc != dd:
            nondefault_ref_events += 1

    # Per-DRA inventory: only DEFAULT docs actually control rows under the ETL model.
    inv = []
    for doc_id, chem in default_doc_chem.items():
        meta = cur.execute(
            "SELECT site_id, COALESCE(doc_type,''), COALESCE(filepath,'') FROM ra_documents WHERE doc_id=?",
            (doc_id,),
        ).fetchone()
        if meta:
            inv.append((doc_id, int(meta[0]) if meta[0] is not None else None, meta[1], meta[2], chem))
    inv.sort(key=lambda x: -x[4])

    conn.close()

    # ---- Report -------------------------------------------------------------
    L = []
    A = L.append
    A("# PR-MAP-8 LOAD DECISION REPORT (DB2 -> matrix_map)")
    A("")
    A("Decision packet for the matrix-map growth load. Generated read-only from DB2 + the")
    A("geocoding CSV. **All chem counts are ETL-LOADABLE measurements** (the ETL acceptance")
    A("predicate is applied: non-empty parameter + id + (value, or a censored '<' detection")
    A("limit)), NOT raw rows. **The load is gated on the owner choosing a path below.** PR B")
    A("merges this report + the geocoder WITHOUT loading.")
    A("")
    A("## 1. The binding constraint is DATES + VISIBILITY, not coordinates")
    A("")
    A(f"- Geocoding: {len(geocoded)} of 345 sites resolved a registry centroid; geometry covers")
    A(f"  {geom_loadable} of {loadable_total} loadable measurements. Coordinates are essentially SOLVED.")
    A(f"- Of {total_chem} raw sediment_chemistry rows, {loadable_total} are ETL-loadable measurements")
    A(f"  ({total_chem - loadable_total} are dropped for null value / missing parameter / no id).")
    A("- Only ~0.5% of stations are surveyed -- the map is a registry-centroid SITE-INDEX; medium-tier")
    A("  centroids must be excluded from station-level stats + the calculator bridge (analytical guard).")
    A("")
    A("## 2. Event-date reality (the real blocker)")
    A("")
    A(f"- Events: parseable {ev_status['parseable']}, blank {ev_status['blank']}, unparseable {ev_status['unparseable']}.")
    A(f"- LOADABLE measurements by event-date: parseable {by_date_loadable['parseable']}, "
      f"blank {by_date_loadable['blank']}, unparseable {by_date_loadable['unparseable']}.")
    A("- `sample_events.event_date` is NOT NULL in matrix_map, so blank/unparseable-date measurements")
    A("  are SKIPPED unless the owner relaxes/imputes the date.")
    A("")
    A("## 3. DRA attribution + visibility")
    A("")
    A(f"- ra_documents (DRAs): {n_dra}; sites WITH a DRA: {len(sites_with_dra)}; loadable measurements")
    A(f"  on chem-sites WITHOUT a DRA: {no_dra_loadable} (API-hidden -- no source_dra_id).")
    A(f"- Mis-attributed provenance: {nondefault_ref_events} events reference a non-default-doc")
    A("  source_table_ref ('d<NNN>' != the site's default first-by-doc_id DRA). LOAD impact, BY SCENARIO:")
    A(f"  - Scenario A (dated-only): {misattr_chem_dated} measurements ({len(misattr_events_dated)} events)")
    A("    -- the conflicting refs are on undated events, so dated-only mis-attributes essentially none.")
    A(f"  - Scenario B (relaxed/imputed dates): {misattr_chem} measurements ({len(misattr_events)} events)")
    A("    would be mis-attributed to the site default unless event-level source_dra_id is added -- a small effect.")
    A("- ALL newly loaded DRAs/samples insert `public=false`: visible to ADMINS only until an audited")
    A("  `flip_dra_public` / grant. So without a publication decision, the NON-ADMIN end-user delta is ZERO.")
    A("")
    A("## 4. Per-scenario deltas (LOADABLE measurements vs the live seed)")
    A("")
    A(f"Live seed baseline: ~{SEED_SAMPLES} samples; ~{SEED_MEASUREMENTS} measurements currently loaded.")
    A("")
    A("| Scenario | Date handling | Loadable meass (geometry) | + admin-visible (has DRA) | + END-USER-visible |")
    A("|---|---|---|---|---|")
    A(f"| A | dated-only | {geom_dated_loadable} | {geom_dated_dra_loadable} | 0 (public=false) / publish to enable |")
    A(f"| B | nullable or imputed dates | {geom_loadable} | {geom_dra_loadable} | 0 (public=false) / publish to enable |")
    A("")
    A(f"Reading: Scenario A (dated-only) is {geom_dated_loadable} measurements ~= the live seed "
      f"({SEED_MEASUREMENTS}) -- **the map does not meaningfully grow.** Scenario B (relax/impute dates)")
    A(f"unlocks ~{geom_loadable} (about {geom_loadable/max(SEED_MEASUREMENTS,1):.1f}x the seed), but (a) it is a")
    A("schema + consumer-contract change (event_date NOT NULL; UI/filter/export assume exact dates), and")
    A("(b) END-USER visibility still needs the publish/grant decision -- otherwise the growth is admin-only.")
    A("")
    A("## 5. Owner decisions required before the load")
    A("")
    A("1. **Dates:** dated-only (no growth) / relax event_date to nullable (migration) / impute (e.g. campaign")
    A("   year) -- if relax/impute, the consumer-contract PR (UI/filter/export + date-precision provenance) lands first.")
    A("2. **Visibility:** admin-only-until-reviewed / publish (audited flip) / per-user grants -- see the per-DRA")
    A("   inventory below; this cannot be decided from aggregate counts.")
    A("3. **Provenance:** accept site-default-DRA attribution with disclosure / exclude the source_table_ref")
    A(f"   conflicts / add event-level source_dra_id (migration). Scope: {misattr_chem_dated} measurements under")
    A(f"   Scenario A (dated-only), {misattr_chem} under Scenario B (relaxed dates) -- so this only matters if dates are relaxed.")
    A("4. **Centroid analytical guard** (non-optional): centroid rows excluded from station-level stats + the bridge.")
    A("5. **Substance normalization** (CAS-first EXACT, reviewed alias map) BEFORE the load -- the load bakes")
    A("   substances.key into measurement FKs.")
    A("")
    A("## 6. Per-DRA inventory (DEFAULT docs only -- they alone control rows under the ETL attribution)")
    A("")
    A("Top 40 default docs by attributable LOADABLE measurements. Non-default docs at a site control 0")
    A("rows under the current site-default model (relevant only if event-level provenance is adopted).")
    A("")
    A("| default doc_id | site_id | doc_type | loadable_meass | filepath |")
    A("|---|---|---|---|---|")
    for doc_id, site_id, doc_type, filepath, chem in inv[:40]:
        fp = (filepath or "")[-48:]
        A(f"| {doc_id} | {site_id} | {doc_type} | {chem} | ...{fp} |")
    if len(inv) > 40:
        A(f"| ... | | | | (+{len(inv)-40} more default docs) |")
    A("")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(L), encoding="utf-8")
    print(f"wrote {args.out}")
    print(f"total_chem={total_chem} loadable={loadable_total} geom_loadable={geom_loadable} "
          f"dated_loadable={geom_dated_loadable} dated_events={ev_status['parseable']} "
          f"sites_with_dra={len(sites_with_dra)} no_dra_loadable={no_dra_loadable} "
          f"misattr_events={len(misattr_events)} misattr_chem={misattr_chem} "
          f"misattr_chem_dated={misattr_chem_dated} nondefault_ref_events={nondefault_ref_events}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
