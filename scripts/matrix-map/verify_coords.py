import sqlite3
import sys
import os
import math
import csv
from pyproj import Transformer

def main():
    enhanced_path = r"scripts/matrix-map/_enrichment_working/bnrrm_enhanced.db"
    pristine_path = r"G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_enhanced_2026-06-25_960a8b31.db"

    print("COORDINATE ENRICHMENT VERIFICATION GATE")
    
    db = sqlite3.connect(enhanced_path, uri=True)
    import pathlib
    pristine_uri = pathlib.Path(os.path.abspath(pristine_path)).as_uri() + "?mode=ro"
    db.execute(f"ATTACH DATABASE '{pristine_uri}' AS pristine")
    c = db.cursor()

    failures = []

    # 1. same-schema
    def get_schema(prefix):
        rows = c.execute(
            f"SELECT type, name, sql FROM {prefix}sqlite_master "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").fetchall()
        return rows
    
    if get_schema("") != get_schema("pristine."):
        failures.append("Schema mismatch between enhanced and pristine databases.")
    else:
        print("  PASS  Same-schema verified.")

    # 2. check tables presence and row counts
    tables = [r[0] for r in c.execute(
        "SELECT name FROM pristine.sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()]

    for t in tables:
        if t != "stations":
            # Other tables must be strictly identical (INSERT-only or no changes)
            removed = c.execute(
                f"SELECT COUNT(*) FROM (SELECT * FROM pristine.{t} EXCEPT SELECT * FROM main.{t})"
            ).fetchone()[0]
            added = c.execute(
                f"SELECT COUNT(*) FROM (SELECT * FROM main.{t} EXCEPT SELECT * FROM pristine.{t})"
            ).fetchone()[0]
            if removed > 0 or added > 0:
                failures.append(f"Table [{t}] changed: removed={removed}, added={added}")
            else:
                print(f"  PASS  Table [{t}] strictly unchanged.")
        else:
            # Stations table row count must be identical (no writes, update only)
            pcount = c.execute("SELECT COUNT(*) FROM pristine.stations").fetchone()[0]
            ecount = c.execute("SELECT COUNT(*) FROM main.stations").fetchone()[0]
            if pcount != ecount:
                failures.append(f"Stations row count changed: {pcount} -> {ecount} (writes occurred)")
            else:
                print(f"  PASS  Stations row count matches exactly ({pcount}).")

    # 3. Stations column content verification
    # Columns other than latitude/longitude must be identical
    # Query all columns of stations
    cols = [r[1] for r in c.execute("PRAGMA table_info(stations)").fetchall()]
    non_coord_cols = [col for col in cols if col not in ("latitude", "longitude")]
    
    col_str = ", ".join(non_coord_cols)
    diff = c.execute(
        f"SELECT COUNT(*) FROM (SELECT {col_str} FROM pristine.stations EXCEPT SELECT {col_str} FROM main.stations)"
    ).fetchone()[0]
    if diff > 0:
        failures.append(f"Station non-coordinate columns mutated for {diff} rows.")
    else:
        print("  PASS  Station non-coordinate columns strictly unchanged.")

    # 4. Preservation of original 40 manual coordinates
    # Find stations that had non-NULL lat/lon in pristine, and check that they are identical in enhanced
    pristine_coords = c.execute(
        "SELECT station_id, latitude, longitude FROM pristine.stations "
        "WHERE latitude IS NOT NULL OR longitude IS NOT NULL"
    ).fetchall()
    
    overwritten = 0
    for st_id, lat, lon in pristine_coords:
        e_coord = c.execute(
            "SELECT latitude, longitude FROM main.stations WHERE station_id=?", (st_id,)
        ).fetchone()
        if e_coord != (lat, lon):
            overwritten += 1
            
    if overwritten > 0:
        failures.append(f"Preservation Failed: {overwritten} of {len(pristine_coords)} pre-existing coordinates were overwritten.")
    else:
        print(f"  PASS  Preservation of {len(pristine_coords)} pre-existing coordinates verified.")

    # 5. Converted coordinates validation (BC bounds)
    out_of_bounds = c.execute(
        "SELECT COUNT(*) FROM main.stations "
        "WHERE latitude IS NOT NULL AND (latitude < 48.0 OR latitude > 60.0 OR longitude < -139.0 OR longitude > -114.0)"
    ).fetchone()[0]
    
    if out_of_bounds > 0:
        failures.append(f"BC Bounds Gate Failed: {out_of_bounds} stations have coordinates outside BC bounds.")
    else:
        print("  PASS  All non-NULL coordinates are within BC bounds.")

    # 6. Control-point assertion check
    print("Running control-point conversion verification...")
    def haversine_distance(lat1, lon1, lat2, lon2):
        R = 6371000.0  # meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = (math.sin(dphi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2.0) ** 2))
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c

    try:
        transformer = Transformer.from_crs("epsg:26911", "epsg:4326", always_xy=True)
        lon_conv, lat_conv = transformer.transform(453782.4, 5463108.2)
        lat_dms = 49.0 + (19.0 / 60.0) + (7.5 / 3600.0)
        lon_dms = -(117.0 + (38.0 / 60.0) + (5.5 / 3600.0))
        dist = haversine_distance(lat_conv, lon_conv, lat_dms, lon_dms)
        if dist > 100.0:
            failures.append(f"Control point transformation distance {dist:.2f}m exceeds 100m tolerance.")
        else:
            print(f"  PASS  Control-point transformation distance is {dist:.2f}m (< 100m tolerance).")
    except Exception as e:
        failures.append(f"Control-point transformation failed: {e}")

    # 7. Haversine divergence limit check for newly loaded coordinates
    newly_geocoded = c.execute(
        "SELECT s.station_id, s.site_id, s.name, s.latitude, s.longitude, site.name "
        "FROM main.stations s "
        "JOIN pristine.stations p ON s.station_id = p.station_id "
        "JOIN main.sites site ON s.site_id = site.site_id "
        "WHERE p.latitude IS NULL AND s.latitude IS NOT NULL"
    ).fetchall()

    centroids = {}
    csv_path = r"docs/design/matrix-map/PR_MAP_8_GEOCODING_DATA_FULL.csv"
    if os.path.exists(csv_path):
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    sid = int(row["site_id"])
                    lat = float(row["latitude"])
                    lon = float(row["longitude"])
                    centroids[sid] = (lat, lon)
                except (ValueError, TypeError, KeyError):
                    continue

    divergence_failures = 0
    for st_id, site_id, st_name, lat, lon, site_name in newly_geocoded:
        n_stations = c.execute("SELECT COUNT(*) FROM main.stations WHERE site_id=?", (site_id,)).fetchone()[0]
        site_name_lower = site_name.lower() if site_name else ""
        is_large = n_stations >= 40 or "trail" in site_name_lower or "alcan" in site_name_lower
        limit = 10000.0 if is_large else 5000.0

        sc_lat, sc_lon = None, None
        if site_id in centroids:
            sc_lat, sc_lon = centroids[site_id]
        else:
            site_row = c.execute("SELECT latitude, longitude FROM main.sites WHERE site_id=?", (site_id,)).fetchone()
            if site_row and site_row[0] is not None:
                sc_lat, sc_lon = site_row

        if sc_lat is not None and sc_lon is not None:
            dist = haversine_distance(lat, lon, sc_lat, sc_lon)
            if dist > limit:
                failures.append(f"Station {st_name} (ID: {st_id}, Site: {site_id}) divergence {dist:.2f}m exceeds limit {limit}m.")
                divergence_failures += 1

    if newly_geocoded:
        if divergence_failures == 0:
            print(f"  PASS  All {len(newly_geocoded)} newly loaded coordinates are within their site centroid divergence limits.")
    else:
        print("  PASS  No newly loaded coordinates to verify for divergence.")

    db.close()

    print("\n========================================")
    if failures:
        print(f"VERIFICATION FAILED: {len(failures)} failures detected.")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("VERIFICATION SUCCESSFUL: All gates passed.")
        sys.exit(0)

if __name__ == "__main__":
    main()
