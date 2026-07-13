import argparse
import sys
import os

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

def parse_args():
    parser = argparse.ArgumentParser(description="Extract DRA coordinates from PDF.")
    parser.add_argument("--pdf", required=True, help="Absolute path to the source PDF.")
    parser.add_argument("--dra-id", required=True, help="UUID of the DRA.")
    parser.add_argument("--out-sql", required=True, help="Path to output SQL file.")
    parser.add_argument("--apply", action="store_true", help="Apply to DB (GATED).")
    return parser.parse_args()

def extract_station_table(pdf_path):
    """
    Extracts the station table from the PDF.
    
    Heuristic:
    1. Scan document for tables with headers containing 'Station', 'Latitude', 'Longitude',
       or 'Easting', 'Northing'.
    2. Extract rows and yield dictionaries of raw data.
    
    NEEDS-TUNING: The exact table layout, page numbers, and column headers will vary
    by PDF. This function must be tailored to the specific document once inspected.
    """
    if not HAS_DOCLING:
        print("ERROR: docling is required for extraction.", file=sys.stderr)
        sys.exit(1)
        
    print(f"Extracting tables from {pdf_path} using docling...")
    # NEEDS-TUNING: Implement real docling table parsing logic.
    # Do NOT fabricate coordinates. Returning empty list to trigger fail-close for now.
    return []

def normalize_and_validate_coords(lat, lon, is_utm=False, zone=None):
    """
    Normalizes coordinates and validates them against BC bounds.
    BC Bounds approx: Lat 48.0 to 60.0, Lon -140.0 to -114.0
    
    NEEDS-TUNING: Precise bounding box and coordinate system detection per-PDF.
    """
    if is_utm:
        if not HAS_PYPROJ:
            print("ERROR: pyproj is required for UTM->WGS84 conversion, but is not installed.", file=sys.stderr)
            sys.exit(1)
        # NEEDS-TUNING: Implement UTM conversion using pyproj.Proj
        pass
        
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (ValueError, TypeError):
        print(f"ERROR: Invalid coordinate format: lat={lat}, lon={lon}", file=sys.stderr)
        sys.exit(1)
        
    if not (48.0 <= lat_f <= 60.0 and -140.0 <= lon_f <= -114.0):
        print(f"ERROR: Coordinates out of BC bounds: lat={lat_f}, lon={lon_f}", file=sys.stderr)
        sys.exit(1)
        
    return lat_f, lon_f

def match_station_id(label):
    """
    Maps station label from PDF to matrix_map.samples.station_id.
    
    Strategy:
    1. Exact match against known station_ids for this DRA.
    2. Normalized match (strip whitespace, upper/lower case, remove dashes).
    
    NEEDS-TUNING: Wire up to actual station_id list from the DB for this DRA.
    """
    # NEEDS-TUNING: actual lookup logic
    return label.strip()

def generate_sql(dra_id, stations_data):
    """
    Emits an idempotent, id-keyed coordinate-UPDATE SQL.
    """
    sql_lines = []
    sql_lines.append(f"-- Coordinate extraction for DRA {dra_id}")
    sql_lines.append("-- PRE-FLIGHT VERIFICATION:")
    sql_lines.append(f"-- SELECT count(*) FROM matrix_map.samples WHERE source_dra_id = '{dra_id}';")
    
    for station in stations_data:
        station_id = station['station_id']
        lat = station['lat']
        lon = station['lon']
        sql_lines.append(
            f"UPDATE matrix_map.samples SET latitude = {lat}, longitude = {lon}, "
            f"coordinate_quality_tier = 'high' "
            f"WHERE station_id = '{station_id}' AND source_dra_id = '{dra_id}';"
        )
        
    sql_lines.append("-- POST-FLIGHT VERIFICATION:")
    sql_lines.append(f"-- SELECT count(*) FROM matrix_map.samples WHERE source_dra_id = '{dra_id}' AND latitude IS NOT NULL;")
    return "\\n".join(sql_lines) + "\\n"

def main():
    args = parse_args()
    
    if args.apply:
        print("OWNER-GATED: coordinate write not authorized; re-run under explicit owner approval + codex review")
        sys.exit(0)

    if not os.path.exists(args.pdf):
        print(f"ERROR: PDF file not found: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    print(f"Processing DRA {args.dra_id} from {args.pdf}")
    
    extracted_rows = extract_station_table(args.pdf)
    
    if not extracted_rows:
        print("ERROR: Extraction yielded 0 stations. Aborting.", file=sys.stderr)
        sys.exit(1)

    stations_data = []
    for row in extracted_rows:
        # NEEDS-TUNING: Map raw row fields to label, lat, lon
        raw_label = row.get("label")
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
    
    with open(args.out_sql, 'w', encoding='ascii') as f:
        f.write(sql)
        
    print(f"Wrote SQL to {args.out_sql}")

if __name__ == "__main__":
    main()
