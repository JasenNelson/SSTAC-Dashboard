"""
No-write dry-run harness for DRA coordinate extraction.
--apply is owner-gated and fails closed. Coordinates are never fabricated.
"""
import argparse
import json
import os
import re
import sys

try:
    from docling.document_converter import DocumentConverter
    HAS_DOCLING = True
except ImportError:
    HAS_DOCLING = False

try:
    import pyproj
    HAS_PYPROJ = True
except ImportError:
    HAS_PYPROJ = False

UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
STATION_ID_RE = re.compile(r"^[A-Za-z0-9 _.\-/]+$")

def parse_args():
    parser = argparse.ArgumentParser(description="Extract DRA coordinates from PDF.")
    parser.add_argument("--pdf", required=True, help="Absolute path to the source PDF.")
    parser.add_argument("--dra-id", required=True, help="UUID of the DRA.")
    parser.add_argument("--out-sql", required=True, help="Path to write generated SQL.")
    parser.add_argument("--dry-run-report", help="Path to write the JSON report. Default: <out-sql>.dryrun.json")
    parser.add_argument("--apply", action="store_true", help="Apply to DB (GATED, fails closed).")
    return parser.parse_args()

def normalize_and_validate_coords(lat, lon, is_utm=False, zone=None):
    if is_utm:
        if not HAS_PYPROJ:
            raise RuntimeError("pyproj required for UTM conversion but not installed")
        import pyproj
        if zone is None or type(zone) is not int or not (7 <= zone <= 11):
            raise ValueError("UTM zone must be an integer 7-11 for BC")
        transformer = pyproj.Transformer.from_crs(f"EPSG:326{zone:02d}", "EPSG:4326", always_xy=True)
        try:
            easting = float(lat)
            northing = float(lon)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid coordinate format for UTM: easting={lat}, northing={lon}")
        lon_f, lat_f = transformer.transform(easting, northing)
    else:
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid coordinate format: lat={lat}, lon={lon}")
    if not (48.0 <= lat_f <= 60.0 and -140.0 <= lon_f <= -114.0):
        raise ValueError(f"Coordinates out of BC bounds: lat={lat_f}, lon={lon_f}")
    return lat_f, lon_f

def normalize_station_label(label: str) -> str:
    return label.upper().strip().replace(" ", "").replace("-", "")

def match_station_id(label: str, known_ids=None) -> str:
    """
    NEEDS-TUNING -- real DB station_id join is owner-gated (no DB connection here).
    """
    if known_ids is not None:
        norm_label = normalize_station_label(label)
        for known_id in known_ids:
            if normalize_station_label(known_id) == norm_label:
                return known_id
        raise ValueError(f"No station_id match for label: {label}")
    return label.strip()

def _validate_dra_id(dra_id):
    if not UUID_RE.match(dra_id):
        raise ValueError(f"Invalid DRA ID format: {dra_id}")

def _safe_station_literal(station_id):
    if not STATION_ID_RE.match(station_id):
        raise ValueError(f"Invalid station ID format: {station_id}")
    safe_str = station_id.replace("'", "''")
    return f"'{safe_str}'"

def generate_sql(dra_id, stations_data):
    _validate_dra_id(dra_id)
    sql_lines = []
    sql_lines.append(f"-- Coordinate extraction for DRA {dra_id}")
    sql_lines.append("-- PRE-FLIGHT VERIFICATION:")
    sql_lines.append(f"-- SELECT count(*) FROM matrix_map.samples WHERE source_dra_id = '{dra_id}';")
    for station in stations_data:
        station_id = station['station_id']
        lat = station['lat']
        lon = station['lon']
        if not isinstance(lat, float) or not isinstance(lon, float):
            raise ValueError("Coordinates must be floats")
        safe_station_id = _safe_station_literal(station_id)
        sql_lines.append(
            f"UPDATE matrix_map.samples SET latitude = {repr(float(lat))}, longitude = {repr(float(lon))}, "
            f"coordinate_quality_tier = 'high' "
            f"WHERE station_id = {safe_station_id} AND source_dra_id = '{dra_id}';"
        )
    sql_lines.append("-- POST-FLIGHT VERIFICATION:")
    sql_lines.append(f"-- SELECT count(*) FROM matrix_map.samples WHERE source_dra_id = '{dra_id}' AND latitude IS NOT NULL;")
    return "\n".join(sql_lines) + "\n"

def extract_station_table(pdf_path):
    """
    Extracts the station table from the PDF.

    Heuristic:
    1. Scan document for tables with headers containing 'Station', 'Latitude', 'Longitude',
       or 'Easting', 'Northing'.
    2. Extract rows and yield dictionaries of raw data.

    NEEDS-TUNING: The exact table layout, page numbers, and column headers will vary
    by PDF. This function must be tailored to the specific document once inspected.
    UTM conversion, BC-bounds validation, and station-matching are now implemented.
    The remaining step is installing docling and implementing the real table-parse
    heuristic tuned to each source PDF layout (owner-gated ingest step).
    """
    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        pass
    return []

def build_dry_run_report(dra_id, pdf, stations):
    pdf_exists = os.path.exists(pdf)
    stations_extracted = len(stations)
    status = 'OK' if stations_extracted >= 1 else 'BLOCKED'
    missing_inputs = []
    if not pdf_exists:
        missing_inputs.append(f"source PDF not found at: {pdf}")
    if not HAS_DOCLING:
        missing_inputs.append("docling not installed in this environment (pip install docling)")
    missing_inputs.append("extract_station_table table-parse heuristic is NEEDS-TUNING (returns 0 rows); implement real docling table parsing before any run")

    return {
        "status": status,
        "dra_id": dra_id,
        "pdf": pdf,
        "pdf_exists": pdf_exists,
        "docling_available": HAS_DOCLING,
        "pyproj_available": HAS_PYPROJ,
        "stations_extracted": stations_extracted,
        "missing_inputs": missing_inputs,
        "capabilities": {
            "utm_wgs84": HAS_PYPROJ,
            "bc_bounds_validation": True,
            "station_matching": True,
            "table_extraction": False
        },
        "notes": "",
        "generated_by": "extract_dra_coordinates.py dry-run"
    }

def main():
    args = parse_args()

    if args.apply:
        print("ERROR: live DB writes are owner-gated and not implemented. --apply fails closed.", file=sys.stderr)
        sys.exit(2)

    report_path = args.dry_run_report if args.dry_run_report else f"{args.out_sql}.dryrun.json"
    extracted_rows = extract_station_table(args.pdf)
    report = build_dry_run_report(args.dra_id, args.pdf, extracted_rows)

    with open(report_path, "w", encoding="ascii") as f:
        json.dump(report, f, indent=2)

    print(f"Summary: {report['status']} | Report: {report_path} | Stations: {report['stations_extracted']}")

    if report["stations_extracted"] == 0:
        print("Blocked reasons:")
        for reason in report["missing_inputs"]:
            print(f" - {reason}")
        sys.exit(1)

    stations_data = []
    for row in extracted_rows:
        raw_label = row.get("label", "")
        raw_lat = row.get("lat")
        raw_lon = row.get("lon")
        lat_f, lon_f = normalize_and_validate_coords(raw_lat, raw_lon)
        station_id = match_station_id(raw_label)
        stations_data.append({
            "station_id": station_id,
            "lat": lat_f,
            "lon": lon_f
        })

    sql = generate_sql(args.dra_id, stations_data)
    with open(args.out_sql, "w", encoding="ascii") as f:
        f.write(sql)
    print(f"Wrote SQL to {args.out_sql}")

if __name__ == "__main__":
    main()
