#!/usr/bin/env python3
"""
geocode_bc_csr.py -- BC Contaminated Sites Registry geocoder for the matrix-map ETL.

Reads DB2 (bnrrm_training.db) sites, resolves a site-level coordinate for each site
that carries a BC CSR registry id by querying the BC openmaps WFS layer
pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW (EPSG:4326), and emits:
  - the geocoding CSV the ETL consumes (coordinate_source='bc_csr_centroid', tier 'medium'),
    preserving the existing 17-column PR-MAP-0 contract; and
  - a coverage report that buckets sites (loaded-with-centroid / surveyed-only /
    null-registry / WFS-miss) WITH sediment-chemistry-row counts, so the owner sees the
    data cost before any load.

Load-bearing facts (verified 2026-06-16 against the live layer + DB2):
  - The registry-id field on the WFS layer is SITE_ID (numeric decimal). DB2.sites.registry_id
    is TEXT and may carry leading zeros (e.g. '0311'); we query the zero-stripped integer and
    map the WFS response back to the original DB2 site_id.
  - GetFeature with outputFormat=application/json returns geometry.coordinates as [lon, lat]
    (GeoJSON axis order), consistent with the ETL's ST_MakePoint(lon, lat).
  - The site point is the registry's APPROXIMATE site centroid -- this is a site-index
    coordinate, NOT a surveyed station location. The coverage report foregrounds that.

NO network writes; read-only WFS GETs. The source DB is opened read-only + immutable.
Plain ASCII only.
"""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

# --- Constants ----------------------------------------------------------------

DEFAULT_SOURCE_DB = Path(
    r"G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data"
    r"\bnrrm_training_DB2_20260503.db"
)
DEFAULT_OUT_CSV = Path(__file__).resolve().parents[2] / ".tmp_pr_map_0_geocoding_data.csv"
DEFAULT_COMMITTED_CSV = (
    Path(__file__).resolve().parents[2]
    / "docs" / "design" / "matrix-map" / "PR_MAP_8_GEOCODING_DATA_FULL.csv"
)
DEFAULT_OUT_SUMMARY = (
    Path(__file__).resolve().parents[2]
    / "docs" / "design" / "matrix-map" / "PR_MAP_8_GEOCODING_COVERAGE.md"
)

WFS_BASE = (
    "https://openmaps.gov.bc.ca/geo/pub/WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW/ows"
)
WFS_TYPENAME = "pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW"
WFS_CHUNK = 100          # SITE_IDs per GetFeature IN(...) request
WFS_PAUSE_S = 0.5        # politeness delay between requests

# BC bounding box (axis-order + sanity guard). lat 48..60, lon -139..-114.
BC_LAT_MIN, BC_LAT_MAX = 48.0, 60.0
BC_LON_MIN, BC_LON_MAX = -139.0, -114.0

# CSV column contract (PR-MAP-0 / PR_MAP_0_GEOCODING_DATA.csv, 17 columns).
CSV_COLUMNS = [
    "site_id", "registry_id", "bnrrm_site_name", "bc_csr_site_name",
    "region", "waterbody", "latitude", "longitude",
    "coordinate_source", "coordinate_quality_tier",
    "n_stations", "n_stations_geocoded_before_pr_map_0",
    "n_stations_geocoded_after_pr_map_0",
    "n_reference", "n_impacted_explicit", "n_sampling_or_unknown",
    "sediment_chem_rows",
]

REFERENCE_TYPES = frozenset({"reference"})
IMPACTED_TYPES = frozenset({"exposure", "near_field", "far_field"})


def log(phase: str, **fields) -> None:
    payload = {"script": "geocode_bc_csr", "phase": phase}
    payload.update(fields)
    sys.stdout.write(json.dumps(payload, default=str) + "\n")
    sys.stdout.flush()


# --- DB2 reads ----------------------------------------------------------------

@dataclass
class Site:
    site_id: int
    registry_id: str | None
    name: str
    region: str | None
    waterbody: str | None
    n_stations: int = 0
    n_surveyed_stations: int = 0
    n_reference: int = 0
    n_impacted: int = 0
    n_other: int = 0
    sediment_chem_rows: int = 0
    # resolved later:
    lat: float | None = None
    lon: float | None = None
    wfs_common_name: str | None = None
    status: str = "pending"  # loaded_centroid | surveyed_only | null_registry | wfs_miss | bad_coord


def open_ro(db_path: Path) -> sqlite3.Connection:
    uri = "file:" + urllib.parse.quote(str(db_path)) + "?mode=ro&immutable=1"
    return sqlite3.connect(uri, uri=True)


def read_sites(conn: sqlite3.Connection) -> dict[int, Site]:
    cur = conn.cursor()
    sites: dict[int, Site] = {}
    for row in cur.execute(
        "SELECT site_id, registry_id, name, region, waterbody FROM sites"
    ):
        sid = int(row[0])
        sites[sid] = Site(
            site_id=sid,
            registry_id=(str(row[1]).strip() if row[1] is not None else None) or None,
            name=str(row[2]) if row[2] is not None else "",
            region=(str(row[3]).strip() if row[3] is not None else None) or None,
            waterbody=(str(row[4]).strip() if row[4] is not None else None) or None,
        )

    # station counts + surveyed-coord counts + classification tallies
    for row in cur.execute(
        """
        SELECT site_id,
               COUNT(*) AS n,
               SUM(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) AS surveyed,
               LOWER(COALESCE(station_type,'')) AS st
        FROM stations GROUP BY site_id, st
        """
    ):
        sid = int(row[0])
        s = sites.get(sid)
        if s is None:
            continue
        n = int(row[1])
        s.n_stations += n
        s.n_surveyed_stations += int(row[2] or 0)
        st = row[3] or ""
        if st in REFERENCE_TYPES:
            s.n_reference += n
        elif st in IMPACTED_TYPES:
            s.n_impacted += n
        else:
            s.n_other += n

    # sediment-chemistry row counts per site (chem -> event -> station -> site)
    for row in cur.execute(
        """
        SELECT st.site_id, COUNT(*)
        FROM sediment_chemistry sc
        JOIN sampling_events se ON se.event_id = sc.event_id
        JOIN stations st ON st.station_id = se.station_id
        GROUP BY st.site_id
        """
    ):
        s = sites.get(int(row[0]))
        if s is not None:
            s.sediment_chem_rows = int(row[1])

    cur.close()
    return sites


# --- WFS ----------------------------------------------------------------------

def registry_to_query_int(registry_id: str | None) -> int | None:
    """Zero-stripped integer SITE_ID for the WFS query, or None if not all-digit."""
    if not registry_id:
        return None
    r = registry_id.strip().lstrip("0") or "0"
    try:
        return int(r)
    except ValueError:
        return None


def wfs_get_features(site_ids: list[int]) -> dict[int, tuple[float, float, str | None]]:
    """Query WFS for a batch of numeric SITE_IDs. Returns {SITE_ID: (lon, lat, common_name)}."""
    out: dict[int, tuple[float, float, str | None]] = {}
    if not site_ids:
        return out
    cql = "SITE_ID IN (" + ",".join(str(i) for i in site_ids) + ")"
    params = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typeNames": WFS_TYPENAME, "outputFormat": "application/json",
        "srsName": "EPSG:4326", "count": str(len(site_ids) * 4),
        "CQL_FILTER": cql,
    }
    url = WFS_BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "sstac-matrix-map-geocoder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        geom = feat.get("geometry") or {}
        sid = props.get("SITE_ID")
        coords = geom.get("coordinates")
        if sid is None or not coords or geom.get("type") != "Point":
            continue
        try:
            lon, lat = float(coords[0]), float(coords[1])
        except (TypeError, ValueError, IndexError):
            continue
        # Keep the first feature per SITE_ID (consolidated registry sites can repeat).
        out.setdefault(int(sid), (lon, lat, props.get("COMMON_NAME")))
    return out


def in_bc_bbox(lat: float, lon: float) -> bool:
    return (
        lat == lat and lon == lon  # not NaN
        and BC_LAT_MIN <= lat <= BC_LAT_MAX
        and BC_LON_MIN <= lon <= BC_LON_MAX
    )


# --- Main ---------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="BC CSR WFS geocoder for matrix-map ETL.")
    ap.add_argument("--source-db", type=Path, default=DEFAULT_SOURCE_DB)
    ap.add_argument("--out-csv", type=Path, default=DEFAULT_OUT_CSV,
                    help="runtime CSV the ETL reads by default")
    ap.add_argument("--committed-csv", type=Path, default=DEFAULT_COMMITTED_CSV,
                    help="committed full geocoding CSV (same contract)")
    ap.add_argument("--out-summary", type=Path, default=DEFAULT_OUT_SUMMARY)
    args = ap.parse_args()

    if not args.source_db.exists():
        log("error", msg="source DB missing", path=str(args.source_db))
        return 2

    log("start", source_db=str(args.source_db))
    conn = open_ro(args.source_db)
    try:
        sites = read_sites(conn)
    finally:
        conn.close()
    log("sites_read", n_sites=len(sites),
        total_chem=sum(s.sediment_chem_rows for s in sites.values()))

    # Build numeric SITE_ID -> [db site_ids] map (collisions tracked).
    q_map: dict[int, list[int]] = {}
    for s in sites.values():
        qi = registry_to_query_int(s.registry_id)
        if qi is None:
            s.status = "null_registry"
            continue
        q_map.setdefault(qi, []).append(s.site_id)

    query_ids = sorted(q_map.keys())
    log("wfs_plan", queryable_site_ids=len(query_ids),
        null_registry_sites=sum(1 for s in sites.values() if s.status == "null_registry"))

    # Batched WFS resolution. A failed batch (timeout/HTTP) is RETRIED, then treated as a
    # FATAL run failure -- the coverage numbers drive a load decision, so a partial run must
    # NOT be emitted as authoritative (a genuine no-result for a SITE_ID is a wfs_miss, which
    # is different: it returns cleanly with the id simply absent).
    resolved: dict[int, tuple[float, float, str | None]] = {}
    wfs_failed_ids: set[int] = set()
    for i in range(0, len(query_ids), WFS_CHUNK):
        chunk = query_ids[i:i + WFS_CHUNK]
        got: dict[int, tuple[float, float, str | None]] | None = None
        for attempt in range(3):
            try:
                got = wfs_get_features(chunk)
                break
            except Exception as exc:  # noqa: BLE001 -- retry, then fail the whole run
                log("wfs_retry", chunk_start=i, attempt=attempt + 1, err=str(exc))
                time.sleep(WFS_PAUSE_S * (attempt + 2))
        if got is None:
            wfs_failed_ids.update(chunk)
            log("wfs_chunk_failed", chunk_start=i, n=len(chunk))
            continue
        resolved.update(got)
        log("wfs_progress", done=min(i + WFS_CHUNK, len(query_ids)),
            total=len(query_ids), resolved=len(resolved))
        time.sleep(WFS_PAUSE_S)

    if wfs_failed_ids:
        log("fatal", reason="WFS batch failure(s) -- coverage would be incomplete; rerun",
            failed_query_ids=len(wfs_failed_ids))
        return 3

    # Apply resolutions + bbox guard.
    first_checked = False
    for qi, db_ids in q_map.items():
        hit = resolved.get(qi)
        for sid in db_ids:
            s = sites[sid]
            if hit is None:
                s.status = "wfs_miss"
                continue
            lon, lat, common = hit
            if not in_bc_bbox(lat, lon):
                s.status = "bad_coord"
                log("bbox_reject", site_id=sid, registry=s.registry_id, lat=lat, lon=lon)
                continue
            s.lat, s.lon, s.wfs_common_name = lat, lon, common
            s.status = "loaded_centroid"
            if not first_checked:
                log("axis_sanity", site_id=sid, lat=lat, lon=lon,
                    note="first resolved centroid; must be inside BC bbox")
                first_checked = True

    # Sites with no registry centroid but with surveyed station coords are still mappable
    # by the ETL (per-station surveyed tier); mark them so the coverage report is honest.
    for s in sites.values():
        if s.status in ("null_registry", "wfs_miss", "bad_coord") and s.n_surveyed_stations > 0:
            s.status = "surveyed_only"

    write_csv(args.out_csv, args.committed_csv, sites)
    write_summary(args.out_summary, sites, query_ids, resolved)
    log("done", out_csv=str(args.out_csv), summary=str(args.out_summary))
    return 0


def write_csv(out_csv: Path, committed_csv: Path, sites: dict[int, Site]) -> None:
    rows = []
    for s in sites.values():
        if s.status != "loaded_centroid":
            continue
        rows.append({
            "site_id": s.site_id,
            "registry_id": s.registry_id or "",
            "bnrrm_site_name": s.name,
            "bc_csr_site_name": s.wfs_common_name or "",
            "region": s.region or "",
            "waterbody": s.waterbody or "",
            "latitude": f"{s.lat:.6f}",
            "longitude": f"{s.lon:.6f}",
            "coordinate_source": "bc_csr_centroid",
            "coordinate_quality_tier": "medium",
            "n_stations": s.n_stations,
            "n_stations_geocoded_before_pr_map_0": s.n_surveyed_stations,
            "n_stations_geocoded_after_pr_map_0": s.n_stations,
            "n_reference": s.n_reference,
            "n_impacted_explicit": s.n_impacted,
            "n_sampling_or_unknown": s.n_other,
            "sediment_chem_rows": s.sediment_chem_rows,
        })
    rows.sort(key=lambda r: r["site_id"])
    for path in (out_csv, committed_csv):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=CSV_COLUMNS)
            w.writeheader()
            w.writerows(rows)


def write_summary(path: Path, sites: dict[int, Site], query_ids, resolved) -> None:
    def agg(pred):
        ss = [s for s in sites.values() if pred(s)]
        return len(ss), sum(s.sediment_chem_rows for s in ss), sum(s.n_stations for s in ss)

    n_load, chem_load, stn_load = agg(lambda s: s.status == "loaded_centroid")
    n_surv, chem_surv, stn_surv = agg(lambda s: s.status == "surveyed_only")
    n_null, chem_null, stn_null = agg(lambda s: s.status == "null_registry")
    n_miss, chem_miss, stn_miss = agg(lambda s: s.status == "wfs_miss")
    n_bad, chem_bad, stn_bad = agg(lambda s: s.status == "bad_coord")
    total_chem = sum(s.sediment_chem_rows for s in sites.values())
    surveyed_stns = sum(s.n_surveyed_stations for s in sites.values())
    total_stns = sum(s.n_stations for s in sites.values())

    lines = [
        "# PR-MAP-8 Geocoding Coverage (BC CSR WFS) -- HONEST coordinate-quality report",
        "",
        "Generated by `scripts/matrix-map/geocode_bc_csr.py`. Read-only WFS GETs against",
        "`pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW`. Coordinates are the BC CSR registry's",
        "**approximate site CENTROID** (the registry's own metadata says so) -- this is a",
        "site-index coordinate, NOT a surveyed station location.",
        "",
        "## THE HEADLINE REALITY (read this first)",
        "",
        f"- Total sites: {len(sites)}; total stations: {total_stns}; total sediment-chem rows: {total_chem}.",
        f"- Stations with SURVEYED coordinates: {surveyed_stns} of {total_stns} "
        f"({100.0*surveyed_stns/max(total_stns,1):.1f}%).",
        f"- So ~{total_stns - surveyed_stns} stations would inherit ONE approximate site centroid each.",
        "- The map this produces is a registry-centroid SITE-INDEX, not a station chemistry map.",
        "  Medium-tier centroid rows MUST be excluded/segregated from station-level stats + the",
        "  calculator bridge (see the analytical-guard requirement in the plan).",
        "",
        "## Coverage buckets (sites / sediment-chem rows / stations)",
        "",
        f"- LOADED with registry centroid (tier medium): {n_load} sites / {chem_load} chem / {stn_load} stations.",
        f"- SURVEYED-only (no registry centroid, but has surveyed station coords): {n_surv} / {chem_surv} / {stn_surv}.",
        f"- DROPPED, null/non-numeric registry_id (no coordinate at all): {n_null} / {chem_null} / {stn_null}.",
        f"- DROPPED, WFS miss (registry_id not found on the layer): {n_miss} / {chem_miss} / {stn_miss}.",
        f"- DROPPED, coordinate failed the BC bbox guard: {n_bad} / {chem_bad} / {stn_bad}.",
        "",
        f"WFS: queried {len(query_ids)} distinct numeric SITE_IDs; {len(resolved)} resolved.",
        "",
        "## Dropped sites (registry/WFS miss) -- never silently dropped",
        "",
    ]
    dropped = sorted(
        (s for s in sites.values() if s.status in ("null_registry", "wfs_miss", "bad_coord")),
        key=lambda s: -s.sediment_chem_rows,
    )
    if dropped:
        lines.append("| site_id | registry_id | status | chem_rows | stations | name |")
        lines.append("|---|---|---|---|---|---|")
        for s in dropped[:60]:
            lines.append(
                f"| {s.site_id} | {s.registry_id or '(none)'} | {s.status} | "
                f"{s.sediment_chem_rows} | {s.n_stations} | {s.name[:50]} |"
            )
        if len(dropped) > 60:
            lines.append(f"| ... | | | | | (+{len(dropped)-60} more) |")
    else:
        lines.append("(none)")
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
